// 管理者フロー結合テスト（10.2）
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthManager } from '../../src/core/auth-manager.js';
import { IndexMerger } from '../../src/data/index-merger.js';

// PapaParseモック
vi.mock('papaparse', () => ({
  default: {
    parse: vi.fn(),
  },
}));

import Papa from 'papaparse';
import { CsvTransformer } from '../../src/logic/csv-transformer.js';
import { BlobWriter } from '../../src/data/blob-writer.js';
import { AdminPanel } from '../../src/ui/admin-panel.js';

describe('管理者フロー結合テスト', () => {
  let container;
  let mockFetch;
  let fetchCalls;

  beforeEach(() => {
    document.body.innerHTML = '<section id="admin-panel" class="hidden"></section>';
    container = document.getElementById('admin-panel');
    fetchCalls = [];
    mockFetch = vi.fn(async (url, options) => {
      fetchCalls.push({ url, method: options?.method || 'GET' });
      return { ok: true, json: () => Promise.resolve({ items: [], updatedAt: '' }) };
    });
    vi.stubGlobal('fetch', mockFetch);
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    vi.clearAllMocks();
  });

  it('SAS付きURL → トークン取得 → 管理者UI表示のフローが動作すること', () => {
    const auth = AuthManager.initialize('https://example.com/?token=test-sas-token');
    expect(auth.isAdminMode()).toBe(true);
    expect(auth.getSasToken()).toBe('test-sas-token');
    expect(window.history.replaceState).toHaveBeenCalled();

    const csvTransformer = new CsvTransformer();
    const blobWriter = new BlobWriter(auth, 'https://test.blob.core.windows.net/$web');
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter);
    panel.initialize();

    expect(container.classList.contains('hidden')).toBe(false);
    expect(container.querySelector('input[type="file"]')).not.toBeNull();
    expect(container.querySelector('.csv-drop-zone')).not.toBeNull();
  });

  it('SASトークンなしでのアクセス時に管理者UIが非表示であること', () => {
    const auth = AuthManager.initialize('https://example.com/');
    expect(auth.isAdminMode()).toBe(false);

    const csvTransformer = new CsvTransformer();
    const blobWriter = new BlobWriter(auth, 'https://test.blob.core.windows.net/$web');
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter);
    panel.initialize();

    expect(container.classList.contains('hidden')).toBe(true);
  });

  it('CSV投入 → パース → プレビュー表示のフローが動作すること', async () => {
    const auth = AuthManager.initialize('https://example.com/?token=sas123');
    const csvTransformer = new CsvTransformer();
    const blobWriter = new BlobWriter(auth, 'https://test.blob.core.windows.net/$web');
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter);
    panel.initialize();

    // PapaParseモック設定
    Papa.parse.mockImplementation((_file, config) => {
      config.complete({
        data: [
          { id: 'new-001', title: '新規レポート', category: '製品A', amount: '1000000', count: '10' },
        ],
        errors: [],
      });
    });

    const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
    const fileInput = container.querySelector('input[type="file"]');
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      const table = container.querySelector('.preview-table');
      expect(table).not.toBeNull();
      expect(table.textContent).toContain('new-001');
      expect(table.textContent).toContain('新規レポート');
    });

    // 保存ボタンが表示されること
    expect(container.querySelector('.btn-primary')).not.toBeNull();
  });

  it('保存確定 → Blob書き込みシーケンスの順序が正しいこと', async () => {
    const auth = AuthManager.initialize('https://example.com/?token=sas-write');
    const csvTransformer = new CsvTransformer();
    const blobWriter = new BlobWriter(auth, 'https://test.blob.core.windows.net/$web');
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter);
    panel.initialize();

    Papa.parse.mockImplementation((_file, config) => {
      config.complete({
        data: [{ id: 'w-001', title: 'Write Test', category: 'C', amount: '500', count: '3' }],
        errors: [],
      });
    });

    const file = new File(['csv data'], 'write-test.csv', { type: 'text/csv' });
    const fileInput = container.querySelector('input[type="file"]');
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(container.querySelector('.btn-primary')).not.toBeNull();
    });

    // 保存確定
    container.querySelector('.btn-primary').click();

    await vi.waitFor(() => {
      const progressItems = container.querySelectorAll('.progress-item');
      expect(progressItems.length).toBeGreaterThan(0);
    });

    // 書き込み順序の検証: raw → items → (GET index) → PUT index
    const putCalls = fetchCalls.filter((c) => c.method === 'PUT');
    expect(putCalls.length).toBeGreaterThanOrEqual(3);
    expect(putCalls[0].url).toContain('raw/');
    expect(putCalls[1].url).toContain('data/items/');
    expect(putCalls[2].url).toContain('data/index.json');
  });

  it('IndexMergerが既存indexに新規アイテムをマージできること', () => {
    const merger = new IndexMerger();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-06T12:00:00+09:00'));

    const current = {
      items: [{ id: 'old-1', title: '既存', summary: {} }],
      updatedAt: '2026-01-01',
    };
    const newItems = [
      { id: 'new-1', title: '新規1', summary: {} },
      { id: 'new-2', title: '新規2', summary: {} },
    ];
    const result = merger.merge(current, newItems);

    expect(result.items).toHaveLength(3);
    expect(result.items[0].id).toBe('old-1');
    expect(result.items[1].id).toBe('new-1');
    expect(result.items[2].id).toBe('new-2');
    expect(result.warnings).toHaveLength(0);

    vi.useRealTimers();
  });

  it('PUT失敗時の結果表示・リトライフローが動作すること', async () => {
    const auth = AuthManager.initialize('https://example.com/?token=sas-fail');
    const csvTransformer = new CsvTransformer();

    // PUT失敗のモック
    mockFetch.mockImplementation(async (url, options) => {
      fetchCalls.push({ url, method: options?.method || 'GET' });
      if (options?.method === 'PUT' && url.includes('data/index.json')) {
        return { ok: false, status: 403, statusText: 'Forbidden' };
      }
      return { ok: true, json: () => Promise.resolve({ items: [], updatedAt: '' }) };
    });

    const blobWriter = new BlobWriter(auth, 'https://test.blob.core.windows.net/$web');
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter);
    panel.initialize();

    Papa.parse.mockImplementation((_file, config) => {
      config.complete({
        data: [{ id: 'f-001', title: 'Fail Test', category: 'X', amount: '100', count: '1' }],
        errors: [],
      });
    });

    const file = new File(['fail csv'], 'fail.csv', { type: 'text/csv' });
    const fileInput = container.querySelector('input[type="file"]');
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(container.querySelector('.btn-primary')).not.toBeNull();
    });

    container.querySelector('.btn-primary').click();

    await vi.waitFor(() => {
      const failItem = container.querySelector('.progress-item.failure');
      expect(failItem).not.toBeNull();
      expect(failItem.textContent).toContain('index.json');
    });

    // リトライボタンが表示されること
    const retryBtn = container.querySelector('.btn-retry');
    expect(retryBtn).not.toBeNull();
  });
});
