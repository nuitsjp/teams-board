// AtomicPublicDataWriter テスト — ステージング経由で公開データを安全に置換する
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AtomicPublicDataWriter } from '../../local-batch/atomic-public-data-writer.js';

/**
 * テスト用のfsモックを生成する
 */
function createMockFs() {
  return {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    rename: vi.fn().mockResolvedValue(undefined),
    rm: vi.fn().mockResolvedValue(undefined),
    access: vi.fn().mockResolvedValue(undefined),
    // デフォルトではロックファイルが存在しない（statがエラーを投げる）
    stat: vi.fn().mockRejectedValue(new Error('ENOENT: no such file')),
  };
}

const mockJoin = (...args) => args.join('/');

describe('AtomicPublicDataWriter', () => {
  let writer;
  let mockFs;

  beforeEach(() => {
    mockFs = createMockFs();
    writer = new AtomicPublicDataWriter({ fs: mockFs, joinPath: mockJoin });
  });

  const sampleIndex = {
    studyGroups: [{
      id: 'abc12345',
      name: 'もくもく勉強会',
      totalDurationSeconds: 3600,
      sessionIds: ['abc12345-2026-01-15'],
    }],
    members: [{
      id: 'mem00001',
      name: 'テスト太郎',
      totalDurationSeconds: 3600,
      sessionIds: ['abc12345-2026-01-15'],
    }],
    updatedAt: '2026-02-06T03:00:00.000Z',
  };

  const sampleSessions = [
    {
      id: 'abc12345-2026-01-15',
      studyGroupId: 'abc12345',
      date: '2026-01-15',
      attendances: [{ memberId: 'mem00001', durationSeconds: 3600 }],
    },
  ];

  describe('正常な公開データ置換', () => {
    it('ステージングディレクトリを作成してデータを書き出すこと', async () => {
      const result = await writer.publish('/output', sampleIndex, sampleSessions);

      // staging用のディレクトリ作成
      expect(mockFs.mkdir).toHaveBeenCalled();
      // index.jsonとセッションファイルの書き込み
      expect(mockFs.writeFile).toHaveBeenCalled();
      expect(result.allSucceeded).toBe(true);
    });

    it('index.jsonとセッションJSONをステージングに書き込むこと', async () => {
      await writer.publish('/output', sampleIndex, sampleSessions);

      const writeCalls = mockFs.writeFile.mock.calls;
      const writtenPaths = writeCalls.map((c) => c[0]);

      // staging配下にindex.jsonが書き込まれる
      expect(writtenPaths.some((p) => p.includes('index.json'))).toBe(true);
      // staging配下にセッションJSONが書き込まれる
      expect(writtenPaths.some((p) => p.includes('abc12345-2026-01-15.json'))).toBe(true);
    });

    it('ステージングから公開ディレクトリへ切り替えること', async () => {
      await writer.publish('/output', sampleIndex, sampleSessions);

      // renameが呼ばれる（staging → public切替）
      expect(mockFs.rename).toHaveBeenCalled();
    });

    it('ファイルごとの処理結果を返すこと', async () => {
      const result = await writer.publish('/output', sampleIndex, sampleSessions);

      expect(result).toHaveProperty('allSucceeded');
      expect(result).toHaveProperty('results');
      expect(result.results.length).toBeGreaterThan(0);
      // 各結果にpath, ok, errorが含まれること
      const firstResult = result.results[0];
      expect(firstResult).toHaveProperty('path');
      expect(firstResult).toHaveProperty('ok');
    });
  });

  describe('複数セッションの書き込み', () => {
    it('複数セッションを個別ファイルとして書き出すこと', async () => {
      const sessions = [
        {
          id: 'abc12345-2026-01-15',
          studyGroupId: 'abc12345',
          date: '2026-01-15',
          attendances: [{ memberId: 'mem00001', durationSeconds: 3600 }],
        },
        {
          id: 'abc12345-2026-01-22',
          studyGroupId: 'abc12345',
          date: '2026-01-22',
          attendances: [{ memberId: 'mem00001', durationSeconds: 1800 }],
        },
      ];

      const result = await writer.publish('/output', sampleIndex, sessions);

      // ロック + index.json + 2セッションファイル = 4回の書き込み
      expect(mockFs.writeFile).toHaveBeenCalledTimes(4);
      // 結果はロックを除いた3件（index + 2セッション）
      expect(result.results).toHaveLength(3);
    });
  });

  describe('ステージング書き込み失敗', () => {
    it('書き込みに失敗した場合は公開ディレクトリを変更しないこと', async () => {
      mockFs.writeFile
        .mockResolvedValueOnce(undefined) // ロックファイル書き込み
        .mockRejectedValueOnce(new Error('ENOSPC: no space left')); // index.json失敗

      const result = await writer.publish('/output', sampleIndex, sampleSessions);

      expect(result.allSucceeded).toBe(false);
      // rename（swap）は呼ばれない
      expect(mockFs.rename).not.toHaveBeenCalled();
    });

    it('失敗したファイルの理由が結果に含まれること', async () => {
      mockFs.writeFile
        .mockResolvedValueOnce(undefined) // ロックファイル書き込み
        .mockResolvedValueOnce(undefined) // index.json成功
        .mockRejectedValueOnce(new Error('ENOSPC: no space left')); // セッション失敗

      const result = await writer.publish('/output', sampleIndex, sampleSessions);

      const failed = result.results.filter((r) => !r.ok);
      expect(failed.length).toBeGreaterThan(0);
      expect(failed[0]).toHaveProperty('error');
      expect(failed[0].error).toContain('ENOSPC');
    });
  });

  describe('ステージングディレクトリ作成失敗', () => {
    it('ステージングディレクトリ作成に失敗した場合はエラーを返すこと', async () => {
      mockFs.mkdir.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await writer.publish('/output', sampleIndex, sampleSessions);

      expect(result.allSucceeded).toBe(false);
    });
  });

  describe('ロック機構', () => {
    it('ロックファイルが存在する場合はエラーを返すこと', async () => {
      // ロックファイルが既に存在する状態をシミュレート（statが成功 = ファイル存在）
      mockFs.stat.mockResolvedValue({ isFile: () => true });

      const result = await writer.publish('/output', sampleIndex, sampleSessions);

      expect(result.allSucceeded).toBe(false);
      expect(result.results[0].error).toContain('別のプロセス');
    });
  });

  describe('クリーンアップ', () => {
    it('置換完了後にステージングディレクトリを削除すること', async () => {
      await writer.publish('/output', sampleIndex, sampleSessions);

      // rmが呼ばれること（staging削除）
      expect(mockFs.rm).toHaveBeenCalled();
    });
  });

  describe('JSONの内容', () => {
    it('index.jsonに整形されたJSONを書き込むこと', async () => {
      await writer.publish('/output', sampleIndex, sampleSessions);

      const indexWriteCall = mockFs.writeFile.mock.calls.find(
        (c) => c[0].includes('index.json')
      );
      expect(indexWriteCall).toBeDefined();
      const written = JSON.parse(indexWriteCall[1]);
      expect(written).toEqual(sampleIndex);
    });

    it('セッションJSONに整形されたJSONを書き込むこと', async () => {
      await writer.publish('/output', sampleIndex, sampleSessions);

      const sessionWriteCall = mockFs.writeFile.mock.calls.find(
        (c) => c[0].includes('abc12345-2026-01-15.json')
      );
      expect(sessionWriteCall).toBeDefined();
      const written = JSON.parse(sessionWriteCall[1]);
      expect(written).toEqual(sampleSessions[0]);
    });
  });
});
