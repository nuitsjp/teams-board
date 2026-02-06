// AdminPanel テスト — Teams出席レポート対応（複数ファイル対応版）
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
    it('管理者モード有効時に管理者UIセクションがDOMに表示されること', async () => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      await panel.initialize();
      expect(container.classList.contains('hidden')).toBe(false);
    });

    it('管理者モード無効時に管理者UIセクションがDOMに非表示であること', async () => {
      mockAuth.isAdminMode.mockReturnValue(false);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      await panel.initialize();
      expect(container.classList.contains('hidden')).toBe(true);
    });
  });

  describe('CsvUploader', () => {
    beforeEach(async () => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      await panel.initialize();
    });

    it('ファイル選択UIがDOMに表示されること', () => {
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput).not.toBeNull();
    });

    it('ファイル選択inputにmultiple属性があること', () => {
      const fileInput = container.querySelector('input[type="file"]');
      expect(fileInput.hasAttribute('multiple')).toBe(true);
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
        const errorEl = container.querySelector('.msg-error');
        expect(errorEl).not.toBeNull();
        expect(errorEl.textContent).toContain('Teams出席レポート形式');
      });
    });
  });

  describe('プレビューと保存確定', () => {
    beforeEach(async () => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      await panel.initialize();
    });

    it('パース成功時にサマリーカードがDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        const summaryCard = container.querySelector('.summary-card');
        expect(summaryCard).not.toBeNull();
        expect(summaryCard.textContent).toContain('もくもく勉強会');
        expect(summaryCard.textContent).toContain('2026-01-15');
      });
    });

    it('サマリーカードクリックで詳細テーブルが展開されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        expect(container.querySelector('.summary-card')).not.toBeNull();
      });

      container.querySelector('.summary-card').click();
      const detail = container.querySelector('.preview-detail');
      expect(detail.style.display).not.toBe('none');
      expect(detail.textContent).toContain('テスト太郎');
    });

    it('一括保存ボタンがDOMに表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        const saveBtn = container.querySelector('#save-all-btn');
        expect(saveBtn).not.toBeNull();
        expect(saveBtn.textContent).toContain('一括保存');
      });
    });

    it('一括保存ボタンクリック時にBlobWriterのexecuteWriteSequenceが呼び出されること', async () => {
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
        expect(container.querySelector('#save-all-btn')).not.toBeNull();
      });

      container.querySelector('#save-all-btn').click();

      await vi.waitFor(() => {
        expect(mockBlobWriter.executeWriteSequence).toHaveBeenCalled();
      });
    });
  });

  describe('書き込み進捗・結果表示', () => {
    beforeEach(async () => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      await panel.initialize();
    });

    it('保存中にプログレスバーが表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);
      // 保存を遅延させてプログレスバー表示を確認
      let resolveWrite;
      mockBlobWriter.executeWriteSequence.mockReturnValue(
        new Promise((resolve) => { resolveWrite = resolve; })
      );

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        expect(container.querySelector('#save-all-btn')).not.toBeNull();
      });

      container.querySelector('#save-all-btn').click();

      await vi.waitFor(() => {
        const progressBar = container.querySelector('progress');
        expect(progressBar).not.toBeNull();
      });

      // 保存完了
      resolveWrite({ results: [{ path: 'data/index.json', success: true }], allSucceeded: true });
    });

    it('全ファイル保存成功時にsaved状態のアイテムが表示されること', async () => {
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
        expect(container.querySelector('#save-all-btn')).not.toBeNull();
      });

      container.querySelector('#save-all-btn').click();

      await vi.waitFor(() => {
        const savedItem = container.querySelector('.queue-item-saved');
        expect(savedItem).not.toBeNull();
      });
    });

    it('一部失敗時にリトライボタンが表示されること', async () => {
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
        expect(container.querySelector('#save-all-btn')).not.toBeNull();
      });

      container.querySelector('#save-all-btn').click();

      await vi.waitFor(() => {
        const retryBtn = container.querySelector('#retry-btn');
        expect(retryBtn).not.toBeNull();
      });
    });

    it('リトライボタンクリックで再度executeWriteSequenceが呼び出されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);
      mockBlobWriter.executeWriteSequence
        .mockResolvedValueOnce({
          results: [{ path: 'data/index.json', success: false, error: 'HTTP 500' }],
          allSucceeded: false,
        })
        .mockResolvedValueOnce({
          results: [{ path: 'data/index.json', success: true }],
          allSucceeded: true,
        });

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        expect(container.querySelector('#save-all-btn')).not.toBeNull();
      });

      container.querySelector('#save-all-btn').click();

      await vi.waitFor(() => {
        expect(container.querySelector('#retry-btn')).not.toBeNull();
      });

      container.querySelector('#retry-btn').click();

      await vi.waitFor(() => {
        expect(mockBlobWriter.executeWriteSequence).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('キュー管理UI', () => {
    beforeEach(async () => {
      mockAuth.isAdminMode.mockReturnValue(true);
      panel = new AdminPanel(container, mockAuth, mockCsvTransformer, mockBlobWriter, mockIndexMerger);
      await panel.initialize();
    });

    it('ファイル追加後にキュー一覧が表示されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        const queueItems = container.querySelectorAll('.queue-item');
        expect(queueItems.length).toBe(1);
        expect(queueItems[0].textContent).toContain('test.csv');
      });
    });

    it('削除ボタンクリックでキューからファイルが除去されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(parseResult);

      const file = new File(['dummy'], 'test.csv', { type: 'text/csv' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [file] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        expect(container.querySelector('.btn-remove')).not.toBeNull();
      });

      container.querySelector('.btn-remove').click();

      await vi.waitFor(() => {
        const queueItems = container.querySelectorAll('.queue-item');
        expect(queueItems.length).toBe(0);
      });
    });

    it('CSV以外のファイルにエラーメッセージが表示されること', async () => {
      const txtFile = new File(['data'], 'test.txt', { type: 'text/plain' });
      const fileInput = container.querySelector('input[type="file"]');
      Object.defineProperty(fileInput, 'files', { value: [txtFile] });
      fileInput.dispatchEvent(new Event('change'));

      await vi.waitFor(() => {
        const errorEl = container.querySelector('.msg-error');
        expect(errorEl).not.toBeNull();
        expect(errorEl.textContent).toContain('CSVファイルのみ対応');
      });
    });
  });
});
