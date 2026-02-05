// AdminPanel テスト（9.1〜9.4 統合）
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminPanel } from '../../src/ui/admin-panel.js';

describe('AdminPanel', () => {
  let container;
  let mockAuth;
  let mockCsvTransformer;
  let mockBlobWriter;
  let panel;

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
  });

  // 9.1: 管理者モード表示切替
  describe('管理者モード表示切替', () => {
    it('管理者モード有効時に管理者UIセクションがDOMに表示されること', () => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter);
      panel.initialize();
      expect(container.classList.contains('hidden')).toBe(false);
    });

    it('管理者モード無効時に管理者UIセクションがDOMに非表示であること', () => {
      mockAuth.isAdminMode.mockReturnValue(false);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter);
      panel.initialize();
      expect(container.classList.contains('hidden')).toBe(true);
    });
  });

  // 9.2: CsvUploader
  describe('CsvUploader', () => {
    beforeEach(() => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter);
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
      mockCsvTransformer.parse.mockResolvedValue({
        ok: true,
        dashboardItems: [{ id: 'x', title: 'X', summary: {} }],
        itemDetails: [{ id: 'x', title: 'X', data: {} }],
        warnings: [],
      });

      const file = new File(['test'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');

      // ファイル選択をシミュレート
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      // 非同期処理の完了を待つ
      await vi.waitFor(() => {
        expect(mockCsvTransformer.parse).toHaveBeenCalledWith(file);
      });
    });

    it('パースエラー時にエラー詳細がDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue({
        ok: false,
        errors: ['行0: 区切り文字が不正です'],
      });

      const file = new File(['bad'], 'bad.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        const error = container.querySelector('.error');
        expect(error).not.toBeNull();
        expect(error.textContent).toContain('区切り文字');
      });
    });
  });

  // 9.3: PreviewPanel と保存確定
  describe('PreviewPanel と保存確定', () => {
    beforeEach(() => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter);
      panel.initialize();
    });

    it('変換結果がテーブル形式でDOMにプレビュー表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue({
        ok: true,
        dashboardItems: [{ id: 'p1', title: 'Preview1', summary: { key: 'val' } }],
        itemDetails: [{ id: 'p1', title: 'Preview1', data: { key: 'val' } }],
        warnings: [],
      });

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        const table = container.querySelector('.preview-table');
        expect(table).not.toBeNull();
      });
    });

    it('保存確定ボタンがDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue({
        ok: true,
        dashboardItems: [{ id: 'p1', title: 'P1', summary: {} }],
        itemDetails: [{ id: 'p1', title: 'P1', data: {} }],
        warnings: [],
      });

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
      mockCsvTransformer.parse.mockResolvedValue({
        ok: true,
        dashboardItems: [{ id: 'p1', title: 'P1', summary: {} }],
        itemDetails: [{ id: 'p1', title: 'P1', data: {} }],
        warnings: [],
      });
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

  // 9.4: 書き込み進捗・結果表示とリトライ
  describe('書き込み進捗・結果表示', () => {
    beforeEach(() => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter);
      panel.initialize();
    });

    it('全PUT成功時に完了メッセージがDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue({
        ok: true,
        dashboardItems: [{ id: 's1', title: 'S1', summary: {} }],
        itemDetails: [{ id: 's1', title: 'S1', data: {} }],
        warnings: [],
      });
      mockBlobWriter.executeWriteSequence.mockResolvedValue({
        results: [
          { path: 'data/items/s1.json', success: true },
          { path: 'data/index.json', success: true },
        ],
        allSucceeded: true,
      });

      // CSV投入
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
      mockCsvTransformer.parse.mockResolvedValue({
        ok: true,
        dashboardItems: [{ id: 'f1', title: 'F1', summary: {} }],
        itemDetails: [{ id: 'f1', title: 'F1', data: {} }],
        warnings: [],
      });
      mockBlobWriter.executeWriteSequence.mockResolvedValue({
        results: [
          { path: 'data/items/f1.json', success: true },
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
      mockCsvTransformer.parse.mockResolvedValue({
        ok: true,
        dashboardItems: [{ id: 'r1', title: 'R1', summary: {} }],
        itemDetails: [{ id: 'r1', title: 'R1', data: {} }],
        warnings: [],
      });
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
      mockCsvTransformer.parse.mockResolvedValue({
        ok: true,
        dashboardItems: [{ id: 'r1', title: 'R1', summary: {} }],
        itemDetails: [{ id: 'r1', title: 'R1', data: {} }],
        warnings: [],
      });
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
