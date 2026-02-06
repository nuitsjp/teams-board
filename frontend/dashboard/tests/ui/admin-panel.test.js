// AdminPanel テスト — Teams出席レポート対応
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminPanel } from '../../src/ui/admin-panel.js';

describe('AdminPanel', () => {
  let container;
  let mockAuth;
  let mockCsvTransformer;
  let mockBlobWriter;
  let mockIndexMerger;
  let panel;

  const parseResult = {
    ok: true,
    sessionRecord: {
      id: 'abc12345-2026-01-15',
      studyGroupId: 'abc12345',
      date: '2026-01-15',
      attendances: [
        { memberId: 'mem00001', durationSeconds: 3600 },
        { memberId: 'mem00002', durationSeconds: 1800 },
      ],
    },
    mergeInput: {
      sessionId: 'abc12345-2026-01-15',
      studyGroupId: 'abc12345',
      studyGroupName: 'もくもく勉強会',
      date: '2026-01-15',
      attendances: [
        { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
        { memberId: 'mem00002', memberName: 'テスト花子', durationSeconds: 1800 },
      ],
    },
    warnings: [],
  };

  beforeEach(() => {
    container = document.createElement('section');
    container.id = 'admin-panel';
    container.className = 'hidden';
    document.body.innerHTML = '';
    document.body.appendChild(container);

    mockAuth = {
      isAdminMode: vi.fn(() => false),
      getSasToken: vi.fn(() => null),
    };
    mockCsvTransformer = {
      parse: vi.fn(),
    };
    mockBlobWriter = {
      executeWriteSequence: vi.fn(),
      retryFailed: vi.fn(),
    };
    mockIndexMerger = {
      merge: vi.fn(),
    };
  });

  describe('管理者モード表示切替', () => {
    it('管理者モード有効時に管理者UIセクションがDOMに表示されること', () => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      panel.initialize();
      expect(container.classList.contains('hidden')).toBe(false);
    });

    it('管理者モード無効時に管理者UIセクションがDOMに非表示であること', () => {
      mockAuth.isAdminMode.mockReturnValue(false);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      panel.initialize();
      expect(container.classList.contains('hidden')).toBe(true);
    });
  });

  describe('CsvUploader', () => {
    beforeEach(() => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      panel.initialize();
    });

    it('ファイル選択UIがDOMに表示されること', () => {
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).not.toBeNull();
    });

    it('Drag&Dropエリアが表示されること', () => {
      const dropZone = container.querySelector('.csv-drop-zone');
      expect(dropZone).not.toBeNull();
    });

    it('ファイル投入時にCsvTransformerのparseが呼び出されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');

      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        expect(mockCsvTransformer.parse).toHaveBeenCalledWith(file);
      });
    });

    it('パースエラー時にエラー詳細がDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue({
        ok: false,
        errors: ['Teams出席レポート形式ではありません'],
      });

      const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        const error = container.querySelector('.error');
        expect(error).not.toBeNull();
        expect(error.textContent).toContain('Teams出席レポート形式');
      });
    });
  });

  describe('プレビューと保存確定', () => {
    beforeEach(() => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      panel.initialize();
    });

    it('パース成功時にセッション情報のプレビューがDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        const previews = container.querySelectorAll('.preview-table');
        expect(previews.length).toBeGreaterThanOrEqual(1);
        // セッション情報テーブル
        expect(previews[0].textContent).toContain('もくもく勉強会');
        expect(previews[0].textContent).toContain('2026-01-15');
        // 参加者テーブル
        expect(previews[1].textContent).toContain('テスト太郎');
      });
    });

    it('保存確定ボタンがDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        const saveBtn = container.querySelector('.btn-primary');
        expect(saveBtn).not.toBeNull();
        expect(saveBtn.textContent).toContain('保存');
      });
    });

    it('保存確定ボタンクリック時にBlobWriterのexecuteWriteSequenceが呼び出されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);
      mockBlobWriter.executeWriteSequence.mockResolvedValue({
        results: [{ path: 'data/index.json', success: true }],
        allSucceeded: true,
      });

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        expect(container.querySelector('.btn-primary')).not.toBeNull();
      });

      container.querySelector('.btn-primary').click();

      await vi.waitFor(() => {
        expect(mockBlobWriter.executeWriteSequence).toHaveBeenCalled();
      });
    });
  });

  describe('書き込み進捗・結果表示', () => {
    beforeEach(() => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      panel.initialize();
    });

    it('全PUT成功時に完了メッセージがDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);
      mockBlobWriter.executeWriteSequence.mockResolvedValue({
        results: [
          { path: 'data/sessions/abc12345-2026-01-15.json', success: true },
          { path: 'data/index.json', success: true },
        ],
        allSucceeded: true,
      });

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        expect(container.querySelector('.btn-primary')).not.toBeNull();
      });

      container.querySelector('.btn-primary').click();

      await vi.waitFor(() => {
        const successMsg = container.querySelector('.progress-item.success');
        expect(successMsg).not.toBeNull();
      });
    });

    it('一部失敗時に成功/失敗ファイルの一覧がDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);
      mockBlobWriter.executeWriteSequence.mockResolvedValue({
        results: [
          { path: 'data/sessions/abc12345-2026-01-15.json', success: true },
          { path: 'data/index.json', success: false, error: 'HTTP 403' },
        ],
        allSucceeded: false,
      });

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
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
    });

    it('失敗ファイルにリトライボタンが表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);
      mockBlobWriter.executeWriteSequence.mockResolvedValue({
        results: [
          { path: 'data/index.json', success: false, error: 'HTTP 500' },
        ],
        allSucceeded: false,
      });

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        expect(container.querySelector('.btn-primary')).not.toBeNull();
      });

      container.querySelector('.btn-primary').click();

      await vi.waitFor(() => {
        const retryBtn = container.querySelector('.btn-retry');
        expect(retryBtn).not.toBeNull();
      });
    });

    it('リトライボタンクリックでBlobWriterのretryFailedが呼び出されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);
      mockBlobWriter.executeWriteSequence.mockResolvedValue({
        results: [
          { path: 'data/index.json', success: false, error: 'HTTP 500', content: '{}', contentType: 'application/json' },
        ],
        allSucceeded: false,
      });
      mockBlobWriter.retryFailed.mockResolvedValue({
        results: [{ path: 'data/index.json', success: true }],
        allSucceeded: true,
      });

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        expect(container.querySelector('.btn-primary')).not.toBeNull();
      });

      container.querySelector('.btn-primary').click();

      await vi.waitFor(() => {
        expect(container.querySelector('.btn-retry')).not.toBeNull();
      });

      container.querySelector('.btn-retry').click();

      await vi.waitFor(() => {
        expect(mockBlobWriter.retryFailed).toHaveBeenCalled();
      });
    });
  });
});
