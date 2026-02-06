// 管理者フロー結合テスト — ドメインモデル対応
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
      return {
        ok: true,
        json: () => Promise.resolve({ studyGroups: [], members: [], updatedAt: '' }),
      };
    });
    vi.stubGlobal('fetch', mockFetch);
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {});
    vi.clearAllMocks();

    // crypto.subtle モック（CsvTransformerのID生成用）
    if (!globalThis.crypto?.subtle) {
      vi.stubGlobal('crypto', {
        subtle: {
          digest: vi.fn(async (_algo, data) => {
            const bytes = new Uint8Array(data);
            const hash = new Uint8Array(32);
            for (let i = 0; i < bytes.length; i++) {
              hash[i % 32] = (hash[i % 32] + bytes[i]) & 0xff;
            }
            return hash.buffer;
          }),
        },
      });
    }

    // File.prototype.arrayBuffer ポリフィル
    if (!File.prototype.arrayBuffer) {
      File.prototype.arrayBuffer = function () {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(this);
        });
      };
    }
  });

  it('SAS付きURL → トークン取得 → 管理者UI表示のフローが動作すること', () => {
    const auth = AuthManager.initialize('https://example.com/?token=test-sas-token');
    expect(auth.isAdminMode()).toBe(true);
    expect(auth.getSasToken()).toBe('test-sas-token');
    expect(window.history.replaceState).toHaveBeenCalled();

    const csvTransformer = new CsvTransformer();
    const blobWriter = new BlobWriter(auth, 'https://test.blob.core.windows.net/$web');
    const indexMerger = new IndexMerger();
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter, indexMerger);
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
    const indexMerger = new IndexMerger();
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter, indexMerger);
    panel.initialize();

    expect(container.classList.contains('hidden')).toBe(true);
  });

  it('CSV投入 → パース → プレビュー表示のフローが動作すること', async () => {
    const auth = AuthManager.initialize('https://example.com/?token=sas123');
    const csvTransformer = new CsvTransformer();
    const blobWriter = new BlobWriter(auth, 'https://test.blob.core.windows.net/$web');
    const indexMerger = new IndexMerger();
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter, indexMerger);
    panel.initialize();

    // PapaParseモック設定（参加者セクションのTSVパース）
    Papa.parse.mockImplementation((_input, config) => {
      config.complete({
        data: [
          { '名前': 'テスト太郎', 'メール アドレス': 'taro@example.com', '会議の長さ': '30 分 0 秒' },
        ],
        errors: [],
      });
    });

    // UTF-16LEエンコードのTeamsレポートCSVを作成
    const reportText = '1. 要約\n会議のタイトル\tもくもく勉強会\n開始時刻\t2026/1/15 19:00:00\n\n2. 参加者\n名前\tメール アドレス\t会議の長さ\nテスト太郎\ttaro@example.com\t30 分 0 秒\n\n3. 会議中のアクティビティ\nなし';
    const buf = new ArrayBuffer(reportText.length * 2);
    const view = new Uint16Array(buf);
    for (let i = 0; i < reportText.length; i++) {
      view[i] = reportText.charCodeAt(i);
    }

    const file = new File([buf], 'test.csv', { type: 'text/csv' });
    const fileInput = container.querySelector('input[type="file"]');
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      const tables = container.querySelectorAll('.preview-table');
      expect(tables.length).toBeGreaterThanOrEqual(1);
      expect(tables[0].textContent).toContain('もくもく勉強会');
      expect(tables[0].textContent).toContain('2026-01-15');
    });

    expect(container.querySelector('.btn-primary')).not.toBeNull();
  });

  it('保存確定 → Blob書き込みシーケンスの順序が正しいこと', async () => {
    const auth = AuthManager.initialize('https://example.com/?token=sas-write');
    const csvTransformer = new CsvTransformer();
    const blobWriter = new BlobWriter(auth, 'https://test.blob.core.windows.net/$web');
    const indexMerger = new IndexMerger();
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter, indexMerger);
    panel.initialize();

    Papa.parse.mockImplementation((_input, config) => {
      config.complete({
        data: [{ '名前': 'テスト太郎', 'メール アドレス': 'taro@example.com', '会議の長さ': '30 分 0 秒' }],
        errors: [],
      });
    });

    const reportText = '1. 要約\n会議のタイトル\tもくもく勉強会\n開始時刻\t2026/1/15 19:00:00\n\n2. 参加者\n名前\tメール アドレス\t会議の長さ\nテスト太郎\ttaro@example.com\t30 分 0 秒\n\n3. 会議中のアクティビティ\nなし';
    const buf = new ArrayBuffer(reportText.length * 2);
    const view = new Uint16Array(buf);
    for (let i = 0; i < reportText.length; i++) {
      view[i] = reportText.charCodeAt(i);
    }

    const file = new File([buf], 'write-test.csv', { type: 'text/csv' });
    const fileInput = container.querySelector('input[type="file"]');
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fileInput.dispatchEvent(new Event('change'));

    await vi.waitFor(() => {
      expect(container.querySelector('.btn-primary')).not.toBeNull();
    });

    container.querySelector('.btn-primary').click();

    await vi.waitFor(() => {
      const progressItems = container.querySelectorAll('.progress-item');
      expect(progressItems.length).toBeGreaterThan(0);
    });

    // 書き込み順序の検証: raw → sessions → (GET index) → PUT index
    const putCalls = fetchCalls.filter((c) => c.method === 'PUT');
    expect(putCalls.length).toBeGreaterThanOrEqual(3);
    expect(putCalls[0].url).toContain('raw/');
    expect(putCalls[1].url).toContain('data/sessions/');
    expect(putCalls[2].url).toContain('data/index.json');
  });

  it('IndexMergerが新しいドメインモデルでStudyGroupとMemberをマージできること', () => {
    const merger = new IndexMerger();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-06T12:00:00+09:00'));

    const current = {
      studyGroups: [],
      members: [],
      updatedAt: '2026-01-01',
    };
    const newSession = {
      sessionId: 'abc12345-2026-01-15',
      studyGroupId: 'abc12345',
      studyGroupName: 'もくもく勉強会',
      date: '2026-01-15',
      attendances: [
        { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
        { memberId: 'mem00002', memberName: 'テスト花子', durationSeconds: 1800 },
      ],
    };
    const result = merger.merge(current, newSession);

    expect(result.index.studyGroups).toHaveLength(1);
    expect(result.index.studyGroups[0].name).toBe('もくもく勉強会');
    expect(result.index.studyGroups[0].totalDurationSeconds).toBe(5400);
    expect(result.index.members).toHaveLength(2);
    expect(result.index.members[0].name).toBe('テスト太郎');
    expect(result.warnings).toHaveLength(0);

    vi.useRealTimers();
  });

  it('PUT失敗時の結果表示・リトライフローが動作すること', async () => {
    const auth = AuthManager.initialize('https://example.com/?token=sas-fail');
    const csvTransformer = new CsvTransformer();

    mockFetch.mockImplementation(async (url, options) => {
      fetchCalls.push({ url, method: options?.method || 'GET' });
      if (options?.method === 'PUT' && url.includes('data/index.json')) {
        return { ok: false, status: 403, statusText: 'Forbidden' };
      }
      return {
        ok: true,
        json: () => Promise.resolve({ studyGroups: [], members: [], updatedAt: '' }),
      };
    });

    const blobWriter = new BlobWriter(auth, 'https://test.blob.core.windows.net/$web');
    const indexMerger = new IndexMerger();
    const panel = new AdminPanel(container, auth, csvTransformer, blobWriter, indexMerger);
    panel.initialize();

    Papa.parse.mockImplementation((_input, config) => {
      config.complete({
        data: [{ '名前': 'テスト太郎', 'メール アドレス': 'taro@example.com', '会議の長さ': '10 分 0 秒' }],
        errors: [],
      });
    });

    const reportText = '1. 要約\n会議のタイトル\tもくもく勉強会\n開始時刻\t2026/1/15 19:00:00\n\n2. 参加者\n名前\tメール アドレス\t会議の長さ\nテスト太郎\ttaro@example.com\t10 分 0 秒\n\n3. 会議中のアクティビティ\nなし';
    const buf = new ArrayBuffer(reportText.length * 2);
    const view = new Uint16Array(buf);
    for (let i = 0; i < reportText.length; i++) {
      view[i] = reportText.charCodeAt(i);
    }

    const file = new File([buf], 'fail.csv', { type: 'text/csv' });
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

    const retryBtn = container.querySelector('.btn-retry');
    expect(retryBtn).not.toBeNull();
  });
});
