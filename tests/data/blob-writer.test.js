// BlobWriter テスト
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BlobWriter } from '../../src/services/blob-writer.js';

describe('BlobWriter', () => {
  let writer;
  let mockIndexFetcher;
  let mockBlobStorage;
  let fetchCalls;
  let putCalls;

  beforeEach(() => {
    fetchCalls = [];
    putCalls = [];

    mockIndexFetcher = {
      fetch: vi.fn(async () => ({
        ok: true,
        data: { items: [], updatedAt: '2026-02-06' },
      })),
    };

    mockBlobStorage = {
      write: vi.fn(async (path, content, contentType) => {
        putCalls.push({ path, content, contentType });
        return { path, success: true };
      }),
    };

    writer = new BlobWriter(mockIndexFetcher, mockBlobStorage);
  });

  describe('単一PUT操作', () => {
    it('BlobStorageのwriteメソッドが呼び出されること', async () => {
      await writer.executeWriteSequence({
        newItems: [
          { path: 'data/items/new-1.json', content: '{}', contentType: 'application/json' },
        ],
        indexUpdater: (idx) => idx,
      });

      expect(mockBlobStorage.write).toHaveBeenCalled();
      const call = putCalls.find((c) => c.path === 'data/items/new-1.json');
      expect(call).toBeDefined();
      expect(call.content).toBe('{}');
      expect(call.contentType).toBe('application/json');
    });
  });

  describe('書き込み順序', () => {
    it('書き込み順序が raw → items → index の順であること', async () => {
      await writer.executeWriteSequence({
        rawCsv: {
          path: 'raw/2026-02-06-test.csv',
          content: 'csv data',
          contentType: 'text/csv',
        },
        newItems: [
          { path: 'data/items/n.json', content: '{}', contentType: 'application/json' },
        ],
        indexUpdater: (idx) => idx,
      });

      expect(putCalls[0].path).toContain('raw/');
      expect(putCalls[1].path).toContain('data/items/');
      expect(putCalls[2].path).toContain('data/index.json');
    });

    it('rawCsvが省略された場合はitems→indexの順であること', async () => {
      await writer.executeWriteSequence({
        newItems: [
          { path: 'data/items/n.json', content: '{}', contentType: 'application/json' },
        ],
        indexUpdater: (idx) => idx,
      });

      expect(putCalls[0].path).toContain('data/items/');
      expect(putCalls[1].path).toContain('data/index.json');
    });

    it('itemsのPUTが並列実行されること', async () => {
      const resolvers = new Map();
      mockBlobStorage.write.mockImplementation((path, content, contentType) => {
        putCalls.push({ path, content, contentType });
        if (path === 'data/index.json') {
          return Promise.resolve({ path, success: true });
        }
        return new Promise((resolve) => {
          resolvers.set(path, resolve);
        });
      });

      const executePromise = writer.executeWriteSequence({
        newItems: [
          { path: 'data/items/a.json', content: '{}', contentType: 'application/json' },
          { path: 'data/items/b.json', content: '{}', contentType: 'application/json' },
        ],
        indexUpdater: (idx) => idx,
      });

      await Promise.resolve();

      expect(mockBlobStorage.write).toHaveBeenCalledTimes(2);
      expect(mockIndexFetcher.fetch).not.toHaveBeenCalled();

      resolvers.get('data/items/a.json')({ path: 'data/items/a.json', success: true });
      resolvers.get('data/items/b.json')({ path: 'data/items/b.json', success: true });

      await executePromise;
      expect(mockIndexFetcher.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('index更新', () => {
    it('index.jsonのPUT直前に最新indexがIndexFetcherから取得されること', async () => {
      await writer.executeWriteSequence({
        newItems: [],
        indexUpdater: (idx) => idx,
      });

      expect(mockIndexFetcher.fetch).toHaveBeenCalled();
    });

    it('取得した最新indexに対してindexUpdater関数が呼び出されること', async () => {
      const currentIndex = { items: [{ id: 'old' }], updatedAt: '2026-01-01' };
      mockIndexFetcher.fetch.mockResolvedValue({ ok: true, data: currentIndex });

      const updater = vi.fn((idx) => ({ ...idx, updatedAt: '2026-02-06' }));
      await writer.executeWriteSequence({ newItems: [], indexUpdater: updater });

      expect(updater).toHaveBeenCalledWith(currentIndex, []);
    });

    it('indexUpdaterにはnewItemsの書き込み結果が渡されること', async () => {
      const currentIndex = { items: [{ id: 'old' }], updatedAt: '2026-01-01' };
      mockIndexFetcher.fetch.mockResolvedValue({ ok: true, data: currentIndex });

      const updater = vi.fn((idx) => idx);
      await writer.executeWriteSequence({
        newItems: [{ path: 'data/items/new-1.json', content: '{}', contentType: 'application/json' }],
        indexUpdater: updater,
      });

      expect(updater).toHaveBeenCalledWith(currentIndex, [
        expect.objectContaining({ path: 'data/items/new-1.json', success: true }),
      ]);
    });

    it('indexUpdaterがnullを返した場合はindex.jsonのPUTをスキップすること', async () => {
      await writer.executeWriteSequence({
        newItems: [{ path: 'data/items/new-1.json', content: '{}', contentType: 'application/json' }],
        indexUpdater: () => null,
      });

      const indexPuts = putCalls.filter((c) => c.path.includes('data/index.json'));
      expect(indexPuts).toHaveLength(0);
    });

    it('最新index取得失敗時に書き込みシーケンス全体が中断されること', async () => {
      mockIndexFetcher.fetch.mockResolvedValue({ ok: false, error: 'Network error' });

      const result = await writer.executeWriteSequence({
        newItems: [],
        indexUpdater: (idx) => idx,
      });

      expect(result.allSucceeded).toBe(false);
      // index PUTが行われていないことを確認
      const indexPuts = putCalls.filter((c) => c.path.includes('data/index.json'));
      expect(indexPuts).toHaveLength(0);
    });
  });

  describe('結果', () => {
    it('すべてのPUT成功時に { allSucceeded: true } を返すこと', async () => {
      const result = await writer.executeWriteSequence({
        rawCsv: { path: 'raw/test.csv', content: 'csv', contentType: 'text/csv' },
        newItems: [
          { path: 'data/items/a.json', content: '{}', contentType: 'application/json' },
        ],
        indexUpdater: (idx) => idx,
      });

      expect(result.allSucceeded).toBe(true);
      expect(result.results.every((r) => r.success)).toBe(true);
    });

    it('いずれかのPUT失敗時に失敗したパスとエラーを含む結果を返すこと', async () => {
      mockBlobStorage.write.mockImplementation(async (path) => {
        if (path.includes('fail.json')) {
          return { path, success: false, error: 'HTTP 403 Forbidden' };
        }
        return { path, success: true };
      });

      const result = await writer.executeWriteSequence({
        newItems: [
          { path: 'data/items/fail.json', content: '{}', contentType: 'application/json' },
        ],
        indexUpdater: (idx) => idx,
      });

      expect(result.allSucceeded).toBe(false);
      const failed = result.results.find((r) => !r.success);
      expect(failed).toBeDefined();
      expect(failed.path).toContain('fail.json');
    });

    it('onItemCompleteがnewItemsごとに呼ばれること', async () => {
      const onItemComplete = vi.fn();
      await writer.executeWriteSequence({
        newItems: [
          { path: 'data/items/a.json', content: '{}', contentType: 'application/json' },
          { path: 'data/items/b.json', content: '{}', contentType: 'application/json' },
        ],
        indexUpdater: () => null,
        onItemComplete,
      });

      expect(onItemComplete).toHaveBeenCalledTimes(2);
      expect(onItemComplete).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'data/items/a.json', success: true }),
        expect.objectContaining({ path: 'data/items/a.json' })
      );
    });
  });

  describe('retryFailed', () => {
    it('失敗した操作のみ再実行されること', async () => {
      const failedResults = [
        {
          path: 'data/items/retry.json',
          success: false,
          error: '403',
          content: '{}',
          contentType: 'application/json',
        },
      ];

      const result = await writer.retryFailed(failedResults);

      expect(result.results).toHaveLength(1);
      expect(result.results[0].path).toContain('retry.json');
      expect(result.results[0].success).toBe(true);
    });
  });

  describe('rawCsv書き込み失敗', () => {
    it('rawCsvの書き込みが失敗した場合にシーケンスが中断されること', async () => {
      mockBlobStorage.write.mockImplementation(async (path) => {
        if (path.includes('raw/')) {
          return { path, success: false, error: 'HTTP 403 Forbidden' };
        }
        return { path, success: true };
      });

      const result = await writer.executeWriteSequence({
        rawCsv: {
          path: 'raw/2026-02-06-test.csv',
          content: 'csv data',
          contentType: 'text/csv',
        },
        newItems: [
          { path: 'data/items/n.json', content: '{}', contentType: 'application/json' },
        ],
        indexUpdater: (idx) => idx,
      });

      expect(result.allSucceeded).toBe(false);
      // rawCsvの失敗で中断されるため、itemsの書き込みは行われない
      expect(result.results).toHaveLength(1);
      expect(result.results[0].path).toContain('raw/');
      expect(result.results[0].success).toBe(false);
    });
  });

  describe('indexUpdater省略', () => {
    it('indexUpdaterが関数でない場合はindex取得・更新をスキップすること', async () => {
      const result = await writer.executeWriteSequence({
        newItems: [
          { path: 'data/items/a.json', content: '{}', contentType: 'application/json' },
        ],
      });

      // IndexFetcher.fetchは呼ばれないこと
      expect(mockIndexFetcher.fetch).not.toHaveBeenCalled();
      expect(result.allSucceeded).toBe(true);
      expect(result.results).toHaveLength(1);
    });

    it('indexUpdaterがundefinedの場合はindex.jsonのPUTをスキップすること', async () => {
      const result = await writer.executeWriteSequence({
        newItems: [
          { path: 'data/items/a.json', content: '{}', contentType: 'application/json' },
        ],
        indexUpdater: undefined,
      });

      expect(mockIndexFetcher.fetch).not.toHaveBeenCalled();
      const indexPuts = putCalls.filter((c) => c.path === 'data/index.json');
      expect(indexPuts).toHaveLength(0);
      expect(result.allSucceeded).toBe(true);
    });
  });
});
