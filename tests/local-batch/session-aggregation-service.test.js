// SessionAggregationService テスト — 複数CSV変換結果をセッション集約する
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionAggregationService } from '../../src/local-batch/session-aggregation-service.js';

/**
 * テスト用のIndexMergerモックを生成する
 */
function createMockMerger() {
  return {
    merge: vi.fn(),
  };
}

describe('SessionAggregationService', () => {
  let service;
  let mockMerger;

  beforeEach(() => {
    mockMerger = createMockMerger();
    service = new SessionAggregationService({ indexMerger: mockMerger });
  });

  const emptyIndex = {
    studyGroups: [],
    members: [],
    updatedAt: '',
  };

  describe('単一セッションの集約', () => {
    it('1件の変換結果からインデックスとセッション一覧を構築すること', () => {
      const sessionRecord = {
        id: 'abc12345-2026-01-15',
        studyGroupId: 'abc12345',
        date: '2026-01-15',
        attendances: [{ memberId: 'mem00001', durationSeconds: 3600 }],
      };
      const mergeInput = {
        sessionId: 'abc12345-2026-01-15',
        studyGroupId: 'abc12345',
        studyGroupName: 'もくもく勉強会',
        date: '2026-01-15',
        attendances: [
          { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
        ],
      };

      const mergedIndex = {
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
      mockMerger.merge.mockReturnValue({ index: mergedIndex, warnings: [] });

      const result = service.aggregate([
        { sessionRecord, mergeInput },
      ]);

      expect(result.index).toEqual(mergedIndex);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0]).toEqual(sessionRecord);
      expect(result.warnings).toEqual([]);
    });
  });

  describe('複数セッションの逐次集約', () => {
    it('複数の変換結果を逐次マージしてインデックスを累積構築すること', () => {
      const session1 = {
        sessionRecord: {
          id: 'abc12345-2026-01-15',
          studyGroupId: 'abc12345',
          date: '2026-01-15',
          attendances: [{ memberId: 'mem00001', durationSeconds: 3600 }],
        },
        mergeInput: {
          sessionId: 'abc12345-2026-01-15',
          studyGroupId: 'abc12345',
          studyGroupName: 'もくもく勉強会',
          date: '2026-01-15',
          attendances: [
            { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
          ],
        },
      };

      const session2 = {
        sessionRecord: {
          id: 'abc12345-2026-01-22',
          studyGroupId: 'abc12345',
          date: '2026-01-22',
          attendances: [{ memberId: 'mem00001', durationSeconds: 1800 }],
        },
        mergeInput: {
          sessionId: 'abc12345-2026-01-22',
          studyGroupId: 'abc12345',
          studyGroupName: 'もくもく勉強会',
          date: '2026-01-22',
          attendances: [
            { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 1800 },
          ],
        },
      };

      const indexAfterFirst = {
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

      const indexAfterSecond = {
        studyGroups: [{
          id: 'abc12345',
          name: 'もくもく勉強会',
          totalDurationSeconds: 5400,
          sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'],
        }],
        members: [{
          id: 'mem00001',
          name: 'テスト太郎',
          totalDurationSeconds: 5400,
          sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'],
        }],
        updatedAt: '2026-02-06T03:00:00.000Z',
      };

      mockMerger.merge
        .mockReturnValueOnce({ index: indexAfterFirst, warnings: [] })
        .mockReturnValueOnce({ index: indexAfterSecond, warnings: [] });

      const result = service.aggregate([session1, session2]);

      // IndexMergerが2回呼ばれること
      expect(mockMerger.merge).toHaveBeenCalledTimes(2);
      // 最初の呼び出しは空インデックスから
      expect(mockMerger.merge.mock.calls[0][0]).toEqual(emptyIndex);
      expect(mockMerger.merge.mock.calls[0][1]).toEqual(session1.mergeInput);
      // 2回目は1回目の結果を入力として
      expect(mockMerger.merge.mock.calls[1][0]).toEqual(indexAfterFirst);
      expect(mockMerger.merge.mock.calls[1][1]).toEqual(session2.mergeInput);

      expect(result.index).toEqual(indexAfterSecond);
      expect(result.sessions).toHaveLength(2);
    });
  });

  describe('セッションID重複の検出', () => {
    it('IndexMergerが重複警告を返した場合、警告を記録し重複セッションを除外すること', () => {
      const session1 = {
        sessionRecord: {
          id: 'abc12345-2026-01-15',
          studyGroupId: 'abc12345',
          date: '2026-01-15',
          attendances: [{ memberId: 'mem00001', durationSeconds: 3600 }],
        },
        mergeInput: {
          sessionId: 'abc12345-2026-01-15',
          studyGroupId: 'abc12345',
          studyGroupName: 'もくもく勉強会',
          date: '2026-01-15',
          attendances: [
            { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
          ],
        },
      };

      // 同じセッションID（重複）
      const session2 = {
        sessionRecord: {
          id: 'abc12345-2026-01-15',
          studyGroupId: 'abc12345',
          date: '2026-01-15',
          attendances: [{ memberId: 'mem00001', durationSeconds: 9999 }],
        },
        mergeInput: {
          sessionId: 'abc12345-2026-01-15',
          studyGroupId: 'abc12345',
          studyGroupName: 'もくもく勉強会',
          date: '2026-01-15',
          attendances: [
            { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 9999 },
          ],
        },
      };

      const mergedIndex = {
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

      mockMerger.merge
        .mockReturnValueOnce({ index: mergedIndex, warnings: [] })
        .mockReturnValueOnce({
          index: mergedIndex,
          warnings: ['重複セッションID検出: abc12345-2026-01-15 は既に存在します'],
        });

      const result = service.aggregate([session1, session2]);

      // 重複セッションはsessionsに含まれない
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].id).toBe('abc12345-2026-01-15');
      // 警告が記録される
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('重複');
    });
  });

  describe('空入力の処理', () => {
    it('空の配列を渡した場合、空のインデックスとセッション一覧を返すこと', () => {
      const result = service.aggregate([]);

      expect(result.index).toEqual(emptyIndex);
      expect(result.sessions).toEqual([]);
      expect(result.warnings).toEqual([]);
      // IndexMergerは呼ばれない
      expect(mockMerger.merge).not.toHaveBeenCalled();
    });
  });

  describe('集約結果の構造', () => {
    it('インデックス、セッション一覧、警告一覧の3つを返却すること', () => {
      const mergedIndex = {
        studyGroups: [],
        members: [],
        updatedAt: '2026-02-06T03:00:00.000Z',
      };
      mockMerger.merge.mockReturnValue({ index: mergedIndex, warnings: [] });

      const result = service.aggregate([{
        sessionRecord: { id: 'test-2026-01-15', studyGroupId: 'test', date: '2026-01-15', attendances: [] },
        mergeInput: { sessionId: 'test-2026-01-15', studyGroupId: 'test', studyGroupName: 'テスト', date: '2026-01-15', attendances: [] },
      }]);

      expect(result).toHaveProperty('index');
      expect(result).toHaveProperty('sessions');
      expect(result).toHaveProperty('warnings');
    });
  });
});
