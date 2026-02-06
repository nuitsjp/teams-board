// BlobWriter テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlobWriter } from '../../public/js/data/blob-writer.js';

describe('BlobWriter', () => {
  let writer;
  let mockAuth;
  let mockFetch;
  let fetchCalls;

  beforeEach(() => {
    mockAuth = {
      getSasToken: () => 'sv=2025-01-05&ss=b&srt=co&sp=rwc',
    };
    fetchCalls = [];
    mockFetch = vi.fn(async (url, options) => {
      fetchCalls.push({ url, method: options?.method || 'GET' });
      return { ok: true, json: () => Promise.resolve({ items: [], updatedAt: '' }) };
    });
    vi.stubGlobal('fetch', mockFetch);
    writer = new BlobWriter(mockAuth, 'https://test.blob.core.windows.net/$web');
  });

  describe('単一PUT操作', () => {
    it('PUTリクエストが正しいURLで送信されること', async () => {
      await writer.executeWriteSequence({
        newItems: [{ path: 'data/items/new-1.json', content: '{}', contentType: 'application/json' }],
        indexUpdater: (idx) => idx,
      });
      const putCall = fetchCalls.find((c) => c.url.includes('data/items/new-1.json'));
      expect(putCall).toBeDefined();
      expect(putCall.url).toContain('https://test.blob.core.windows.net/$web/data/items/new-1.json');
    });

    it('SASトークンがURLクエリパラメータとして付与されること', async () => {
      await writer.executeWriteSequence({
        newItems: [{ path: 'data/items/x.json', content: '{}', contentType: 'application/json' }],
        indexUpdater: (idx) => idx,
      });
      const putCall = fetchCalls.find((c) => c.url.includes('data/items/x.json'));
      expect(putCall.url).toContain('sv=2025-01-05');
    });

    it('x-ms-blob-type: BlockBlob と x-ms-version ヘッダーが設定されること', async () => {
      await writer.executeWriteSequence({
        newItems: [{ path: 'data/items/y.json', content: '{}', contentType: 'application/json' }],
        indexUpdater: (idx) => idx,
      });
      const call = mockFetch.mock.calls.find((c) => c[0].includes('data/items/y.json'));
      expect(call[1].headers['x-ms-blob-type']).toBe('BlockBlob');
      expect(call[1].headers['x-ms-version']).toBe('2025-01-05');
    });
  });

  describe('書き込み順序', () => {
    it('書き込み順序が raw → items → index の順であること', async () => {
      await writer.executeWriteSequence({
        rawCsv: { path: 'raw/2026-02-06-test.csv', content: 'csv data', contentType: 'text/csv' },
        newItems: [{ path: 'data/items/n.json', content: '{}', contentType: 'application/json' }],
        indexUpdater: (idx) => idx,
      });
      const putCalls = fetchCalls.filter((c) => c.method === 'PUT');
      expect(putCalls[0].url).toContain('raw/');
      expect(putCalls[1].url).toContain('data/items/');
      expect(putCalls[2].url).toContain('data/index.json');
    });

    it('rawCsvが省略された場合はitems→indexの順であること', async () => {
      await writer.executeWriteSequence({
        newItems: [{ path: 'data/items/n.json', content: '{}', contentType: 'application/json' }],
        indexUpdater: (idx) => idx,
      });
      const putCalls = fetchCalls.filter((c) => c.method === 'PUT');
      expect(putCalls[0].url).toContain('data/items/');
      expect(putCalls[1].url).toContain('data/index.json');
    });
  });

  describe('index更新', () => {
    it('index.jsonのPUT直前に最新indexがGETで取得されること', async () => {
      await writer.executeWriteSequence({
        newItems: [],
        indexUpdater: (idx) => idx,
      });
      const getCalls = fetchCalls.filter((c) => c.method === 'GET');
      expect(getCalls.some((c) => c.url.includes('data/index.json'))).toBe(true);
    });

    it('取得した最新indexに対してindexUpdater関数が呼び出されること', async () => {
      const currentIndex = { items: [{ id: 'old' }], updatedAt: '2026-01-01' };
      mockFetch.mockImplementation(async (url, options) => {
        fetchCalls.push({ url, method: options?.method || 'GET' });
        if (!options?.method && url.includes('data/index.json')) {
          return { ok: true, json: () => Promise.resolve(currentIndex) };
        }
        return { ok: true };
      });

      const updater = vi.fn((idx) => ({ ...idx, updatedAt: '2026-02-06' }));
      await writer.executeWriteSequence({ newItems: [], indexUpdater: updater });
      expect(updater).toHaveBeenCalledWith(currentIndex);
    });

    it('最新index取得失敗時に書き込みシーケンス全体が中断されること', async () => {
      mockFetch.mockImplementation(async (url, options) => {
        fetchCalls.push({ url, method: options?.method || 'GET' });
        if (!options?.method && url.includes('data/index.json')) {
          return { ok: false, status: 500, statusText: 'Error' };
        }
        return { ok: true };
      });

      const result = await writer.executeWriteSequence({
        newItems: [],
        indexUpdater: (idx) => idx,
      });
      expect(result.allSucceeded).toBe(false);
      // index PUTが行われていないことを確認
      const indexPuts = fetchCalls.filter((c) => c.method === 'PUT' && c.url.includes('data/index.json'));
      expect(indexPuts).toHaveLength(0);
    });
  });

  describe('結果', () => {
    it('すべてのPUT成功時に { allSucceeded: true } を返すこと', async () => {
      const result = await writer.executeWriteSequence({
        rawCsv: { path: 'raw/test.csv', content: 'csv', contentType: 'text/csv' },
        newItems: [{ path: 'data/items/a.json', content: '{}', contentType: 'application/json' }],
        indexUpdater: (idx) => idx,
      });
      expect(result.allSucceeded).toBe(true);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('いずれかのPUT失敗時に失敗したパスとエラーを含む結果を返すこと', async () => {
      mockFetch.mockImplementation(async (url, options) => {
        fetchCalls.push({ url, method: options?.method || 'GET' });
        if (options?.method === 'PUT' && url.includes('data/items/fail.json')) {
          return { ok: false, status: 403, statusText: 'Forbidden' };
        }
        if (!options?.method && url.includes('data/index.json')) {
          return { ok: true, json: () => Promise.resolve({ items: [], updatedAt: '' }) };
        }
        return { ok: true };
      });

      const result = await writer.executeWriteSequence({
        newItems: [{ path: 'data/items/fail.json', content: '{}', contentType: 'application/json' }],
        indexUpdater: (idx) => idx,
      });
      expect(result.allSucceeded).toBe(false);
      const failed = result.results.find((r) => !r.success);
      expect(failed).toBeDefined();
      expect(failed.path).toContain('fail.json');
    });
  });

  describe('retryFailed', () => {
    it('失敗した操作のみ再実行されること', async () => {
      const failedResults = [
        { path: 'data/items/retry.json', success: false, error: '403', content: '{}', contentType: 'application/json' },
      ];
      const result = await writer.retryFailed(failedResults);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].path).toContain('retry.json');
      expect(result.results[0].success).toBe(true);
    });
  });
});
