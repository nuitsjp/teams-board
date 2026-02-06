// FileQueueManager テスト — 複数ファイルキュー管理
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FileQueueManager } from '../../public/js/ui/file-queue-manager.js';

describe('FileQueueManager', () => {
  let mockCsvTransformer;
  let onQueueUpdate;
  let manager;

  const createCsvFile = (name = 'test.csv', size = 1024) => {
    const content = 'a'.repeat(size);
    return new File([content], name, { type: 'text/csv' });
  };

  const createParseResult = (sessionId = 'abc12345-2026-01-15') => ({
    ok: true,
    sessionRecord: {
      id: sessionId,
      studyGroupId: 'abc12345',
      date: '2026-01-15',
      attendances: [{ memberId: 'mem00001', durationSeconds: 3600 }],
    },
    mergeInput: {
      sessionId,
      studyGroupId: 'abc12345',
      studyGroupName: 'もくもく勉強会',
      date: '2026-01-15',
      attendances: [{ memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 }],
    },
    warnings: [],
  });

  beforeEach(() => {
    mockCsvTransformer = { parse: vi.fn() };
    onQueueUpdate = vi.fn();
    manager = new FileQueueManager(mockCsvTransformer, onQueueUpdate);
  });

  describe('ファイルキューの基本管理', () => {
    it('初期状態でキューが空であること', () => {
      expect(manager.getQueue()).toEqual([]);
    });

    it('ファイルを追加するとキューにアイテムが追加されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      const file = createCsvFile();
      await manager.addFiles([file]);

      const queue = manager.getQueue();
      expect(queue).toHaveLength(1);
      expect(queue[0].file).toBe(file);
      expect(queue[0].id).toBeTruthy();
    });

    it('複数ファイルを一度に追加できること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      const files = [createCsvFile('a.csv'), createCsvFile('b.csv')];
      await manager.addFiles(files);

      expect(manager.getQueue()).toHaveLength(2);
    });

    it('ファイル追加時にonQueueUpdateコールバックが呼ばれること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      await manager.addFiles([createCsvFile()]);

      expect(onQueueUpdate).toHaveBeenCalled();
      const lastCall = onQueueUpdate.mock.calls[onQueueUpdate.mock.calls.length - 1];
      expect(lastCall[0]).toHaveLength(1);
    });

    it('removeFileでキューからファイルを削除できること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      await manager.addFiles([createCsvFile()]);
      const id = manager.getQueue()[0].id;

      manager.removeFile(id);
      expect(manager.getQueue()).toHaveLength(0);
    });

    it('removeFile後にonQueueUpdateが呼ばれること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      await manager.addFiles([createCsvFile()]);
      onQueueUpdate.mockClear();

      const id = manager.getQueue()[0].id;
      manager.removeFile(id);

      expect(onQueueUpdate).toHaveBeenCalledWith([]);
    });

    it('各アイテムのIDが一意であること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      await manager.addFiles([createCsvFile('a.csv'), createCsvFile('b.csv')]);

      const queue = manager.getQueue();
      expect(queue[0].id).not.toBe(queue[1].id);
    });
  });

  describe('ファイルバリデーション', () => {
    it('CSV以外の拡張子のファイルがerror状態になること', async () => {
      const txtFile = new File(['data'], 'test.txt', { type: 'text/plain' });
      await manager.addFiles([txtFile]);

      const queue = manager.getQueue();
      expect(queue[0].status).toBe('error');
      expect(queue[0].errors).toContain('CSVファイルのみ対応しています');
      expect(mockCsvTransformer.parse).not.toHaveBeenCalled();
    });

    it('10MBを超えるファイルがerror状態になること', async () => {
      const bigFile = createCsvFile('big.csv', 10 * 1024 * 1024 + 1);
      await manager.addFiles([bigFile]);

      const queue = manager.getQueue();
      expect(queue[0].status).toBe('error');
      expect(queue[0].errors[0]).toContain('10MB');
    });

    it('10MBちょうどのファイルはバリデーションを通過すること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      const file = createCsvFile('exact.csv', 10 * 1024 * 1024);
      await manager.addFiles([file]);

      const queue = manager.getQueue();
      expect(queue[0].status).not.toBe('error');
    });

    it('.CSVのように大文字拡張子も許可されること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      const file = new File(['data'], 'test.CSV', { type: 'text/csv' });
      await manager.addFiles([file]);

      const queue = manager.getQueue();
      expect(queue[0].status).not.toBe('error');
    });

    it('拡張子なしのファイルがerror状態になること', async () => {
      const noExtFile = new File(['data'], 'noext', { type: '' });
      await manager.addFiles([noExtFile]);

      const queue = manager.getQueue();
      expect(queue[0].status).toBe('error');
    });
  });

  describe('CSVパース実行と結果管理', () => {
    it('パース成功時にparsed状態に遷移すること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      await manager.addFiles([createCsvFile()]);

      const queue = manager.getQueue();
      expect(queue[0].status).toBe('ready');
      expect(queue[0].parseResult).not.toBeNull();
    });

    it('パース失敗時にerror状態に遷移すること', async () => {
      mockCsvTransformer.parse.mockResolvedValue({
        ok: false,
        errors: ['Teams出席レポート形式ではありません'],
      });
      await manager.addFiles([createCsvFile()]);

      const queue = manager.getQueue();
      expect(queue[0].status).toBe('error');
      expect(queue[0].errors).toContain('Teams出席レポート形式ではありません');
    });

    it('複数ファイルで1つが失敗しても他は正常に処理されること', async () => {
      mockCsvTransformer.parse
        .mockResolvedValueOnce(createParseResult())
        .mockResolvedValueOnce({ ok: false, errors: ['エラー'] });

      await manager.addFiles([createCsvFile('good.csv'), createCsvFile('bad.csv')]);

      const queue = manager.getQueue();
      expect(queue[0].status).toBe('ready');
      expect(queue[1].status).toBe('error');
    });

    it('パース結果のwarningsが保持されること', async () => {
      const result = createParseResult();
      result.warnings = ['時間フォーマット不正'];
      mockCsvTransformer.parse.mockResolvedValue(result);

      await manager.addFiles([createCsvFile()]);

      const queue = manager.getQueue();
      expect(queue[0].warnings).toContain('時間フォーマット不正');
    });
  });

  describe('重複セッションID検出', () => {
    it('既存セッションIDと重複する場合にduplicate_warning状態になること', async () => {
      manager.setExistingSessionIds(new Set(['abc12345-2026-01-15']));
      mockCsvTransformer.parse.mockResolvedValue(createParseResult('abc12345-2026-01-15'));

      await manager.addFiles([createCsvFile()]);

      const queue = manager.getQueue();
      expect(queue[0].status).toBe('duplicate_warning');
      expect(queue[0].hasDuplicate).toBe(true);
    });

    it('重複なしの場合はready状態になること', async () => {
      manager.setExistingSessionIds(new Set(['other-session-id']));
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());

      await manager.addFiles([createCsvFile()]);

      const queue = manager.getQueue();
      expect(queue[0].status).toBe('ready');
      expect(queue[0].hasDuplicate).toBe(false);
    });

    it('approveDuplicateで重複承認後にready状態に遷移すること', async () => {
      manager.setExistingSessionIds(new Set(['abc12345-2026-01-15']));
      mockCsvTransformer.parse.mockResolvedValue(createParseResult('abc12345-2026-01-15'));

      await manager.addFiles([createCsvFile()]);

      const id = manager.getQueue()[0].id;
      manager.approveDuplicate(id);

      const queue = manager.getQueue();
      expect(queue[0].status).toBe('ready');
    });

    it('approveDuplicate後にonQueueUpdateが呼ばれること', async () => {
      manager.setExistingSessionIds(new Set(['abc12345-2026-01-15']));
      mockCsvTransformer.parse.mockResolvedValue(createParseResult('abc12345-2026-01-15'));

      await manager.addFiles([createCsvFile()]);
      onQueueUpdate.mockClear();

      const id = manager.getQueue()[0].id;
      manager.approveDuplicate(id);

      expect(onQueueUpdate).toHaveBeenCalled();
    });
  });

  describe('保存関連のアイテム取得と状態更新', () => {
    it('getReadyItemsがready状態のアイテムのみ返すこと', async () => {
      mockCsvTransformer.parse
        .mockResolvedValueOnce(createParseResult('session-1'))
        .mockResolvedValueOnce({ ok: false, errors: ['エラー'] });

      await manager.addFiles([createCsvFile('good.csv'), createCsvFile('bad.csv')]);

      const readyItems = manager.getReadyItems();
      expect(readyItems).toHaveLength(1);
      expect(readyItems[0].status).toBe('ready');
    });

    it('getFailedItemsがsave_failed状態のアイテムのみ返すこと', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      await manager.addFiles([createCsvFile()]);

      const id = manager.getQueue()[0].id;
      manager.updateStatus(id, 'save_failed');

      const failedItems = manager.getFailedItems();
      expect(failedItems).toHaveLength(1);
      expect(failedItems[0].status).toBe('save_failed');
    });

    it('updateStatusで状態を更新できること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      await manager.addFiles([createCsvFile()]);

      const id = manager.getQueue()[0].id;
      manager.updateStatus(id, 'saving');

      expect(manager.getQueue()[0].status).toBe('saving');
    });

    it('updateStatusで追加情報（errors等）を設定できること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      await manager.addFiles([createCsvFile()]);

      const id = manager.getQueue()[0].id;
      manager.updateStatus(id, 'save_failed', { errors: ['HTTP 500'] });

      expect(manager.getQueue()[0].errors).toContain('HTTP 500');
    });

    it('updateStatus後にonQueueUpdateが呼ばれること', async () => {
      mockCsvTransformer.parse.mockResolvedValue(createParseResult());
      await manager.addFiles([createCsvFile()]);
      onQueueUpdate.mockClear();

      const id = manager.getQueue()[0].id;
      manager.updateStatus(id, 'saving');

      expect(onQueueUpdate).toHaveBeenCalled();
    });
  });
});
