// IndexMerger テスト — 新ドメインモデル対応
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndexMerger } from '../../src/services/index-merger.js';

describe('IndexMerger', () => {
  let merger;

  beforeEach(() => {
    merger = new IndexMerger();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-06T12:00:00+09:00'));
  });

  const emptyIndex = {
    studyGroups: [],
    members: [],
    updatedAt: '2026-01-01T00:00:00+09:00',
  };

  describe('新規グループ追加', () => {
    it('空のindexに新規セッションを追加するとStudyGroupSummaryが作成されること', () => {
      const newSession = {
        sessionId: 'abc12345-2026-01-15',
        studyGroupId: 'abc12345',
        studyGroupName: 'もくもく勉強会',
        date: '2026-01-15',
        attendances: [
          { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
        ],
      };
      const result = merger.merge(emptyIndex, newSession);
      expect(result.index.studyGroups).toHaveLength(1);
      expect(result.index.studyGroups[0].id).toBe('abc12345');
      expect(result.index.studyGroups[0].name).toBe('もくもく勉強会');
      expect(result.index.studyGroups[0].totalDurationSeconds).toBe(3600);
      expect(result.index.studyGroups[0].sessionIds).toContain('abc12345-2026-01-15');
    });
  });

  describe('既存グループ更新', () => {
    it('既存のStudyGroupSummaryにセッションを追加するとtotalDurationSecondsが加算されること', () => {
      const currentIndex = {
        studyGroups: [
          { id: 'abc12345', name: 'もくもく勉強会', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] },
        ],
        members: [
          { id: 'mem00001', name: 'テスト太郎', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] },
        ],
        updatedAt: '2026-01-15T00:00:00+09:00',
      };
      const newSession = {
        sessionId: 'abc12345-2026-01-22',
        studyGroupId: 'abc12345',
        studyGroupName: 'もくもく勉強会',
        date: '2026-01-22',
        attendances: [
          { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 1800 },
        ],
      };
      const result = merger.merge(currentIndex, newSession);
      expect(result.index.studyGroups[0].totalDurationSeconds).toBe(5400);
      expect(result.index.studyGroups[0].sessionIds).toHaveLength(2);
    });
  });

  describe('新規メンバー追加', () => {
    it('新しいメンバーがMemberSummaryに追加されること', () => {
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
      const result = merger.merge(emptyIndex, newSession);
      expect(result.index.members).toHaveLength(2);
      expect(result.index.members[0].id).toBe('mem00001');
      expect(result.index.members[0].name).toBe('テスト太郎');
      expect(result.index.members[0].totalDurationSeconds).toBe(3600);
      expect(result.index.members[0].sessionIds).toContain('abc12345-2026-01-15');
      expect(result.index.members[1].totalDurationSeconds).toBe(1800);
    });
  });

  describe('既存メンバー更新', () => {
    it('既存メンバーのtotalDurationSecondsとsessionIdsが更新されること', () => {
      const currentIndex = {
        studyGroups: [
          { id: 'abc12345', name: 'もくもく勉強会', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] },
        ],
        members: [
          { id: 'mem00001', name: 'テスト太郎', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] },
        ],
        updatedAt: '2026-01-15T00:00:00+09:00',
      };
      const newSession = {
        sessionId: 'abc12345-2026-01-22',
        studyGroupId: 'abc12345',
        studyGroupName: 'もくもく勉強会',
        date: '2026-01-22',
        attendances: [
          { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 2400 },
        ],
      };
      const result = merger.merge(currentIndex, newSession);
      expect(result.index.members[0].totalDurationSeconds).toBe(6000);
      expect(result.index.members[0].sessionIds).toEqual(['abc12345-2026-01-15', 'abc12345-2026-01-22']);
    });
  });

  describe('重複セッションID検出', () => {
    it('重複セッションIDが検出された場合にwarningsを返し上書きしないこと', () => {
      const currentIndex = {
        studyGroups: [
          { id: 'abc12345', name: 'もくもく勉強会', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] },
        ],
        members: [
          { id: 'mem00001', name: 'テスト太郎', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] },
        ],
        updatedAt: '2026-01-15T00:00:00+09:00',
      };
      const newSession = {
        sessionId: 'abc12345-2026-01-15',
        studyGroupId: 'abc12345',
        studyGroupName: 'もくもく勉強会',
        date: '2026-01-15',
        attendances: [
          { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 9999 },
        ],
      };
      const result = merger.merge(currentIndex, newSession);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('abc12345-2026-01-15');
      // 元のデータは変更されない
      expect(result.index.studyGroups[0].totalDurationSeconds).toBe(3600);
    });
  });

  describe('updatedAt更新', () => {
    it('マージ後のupdatedAtが現在時刻に更新されていること', () => {
      const newSession = {
        sessionId: 'abc12345-2026-01-15',
        studyGroupId: 'abc12345',
        studyGroupName: 'もくもく勉強会',
        date: '2026-01-15',
        attendances: [
          { memberId: 'mem00001', memberName: 'テスト太郎', durationSeconds: 3600 },
        ],
      };
      const result = merger.merge(emptyIndex, newSession);
      expect(result.index.updatedAt).toBe('2026-02-06T03:00:00.000Z');
    });
  });

  describe('イミュータブル性', () => {
    it('元のindexオブジェクトが変更されないこと', () => {
      const currentIndex = {
        studyGroups: [
          { id: 'abc12345', name: 'もくもく勉強会', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] },
        ],
        members: [
          { id: 'mem00001', name: 'テスト太郎', totalDurationSeconds: 3600, sessionIds: ['abc12345-2026-01-15'] },
        ],
        updatedAt: '2026-01-15T00:00:00+09:00',
      };
      const original = JSON.parse(JSON.stringify(currentIndex));
      const newSession = {
        sessionId: 'abc12345-2026-01-22',
        studyGroupId: 'abc12345',
        studyGroupName: 'もくもく勉強会',
        date: '2026-01-22',
        attendances: [
          { memberId: 'mem00002', memberName: 'テスト花子', durationSeconds: 2400 },
        ],
      };
      merger.merge(currentIndex, newSession);
      expect(currentIndex).toEqual(original);
    });
  });

  describe('グループ合計のtotalDurationSeconds', () => {
    it('StudyGroupSummaryのtotalDurationSecondsが全参加者の時間を合計した値であること', () => {
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
      const result = merger.merge(emptyIndex, newSession);
      expect(result.index.studyGroups[0].totalDurationSeconds).toBe(5400);
    });
  });
});
