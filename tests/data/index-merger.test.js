// IndexMerger テスト — V2 名前ベースマッチング
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IndexMerger } from '../../src/services/index-merger.js';

// ULID パターン（Crockford's Base32: 26文字）
const ULID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('IndexMerger', () => {
  let merger;

  beforeEach(() => {
    merger = new IndexMerger();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-06T12:00:00+09:00'));
  });

  const emptyIndex = {
    schemaVersion: 2,
    version: 0,
    groups: [],
    members: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  // V2 parsedSession ヘルパー
  function createParsedSession(overrides = {}) {
    return {
      sessionId: '01TESTID0000000000000000A',
      groupName: 'フロントエンド勉強会',
      date: '2026-01-15',
      startedAt: '2026-01-15T19:00:00',
      endedAt: null,
      attendances: [
        { memberName: '佐藤 一郎', memberEmail: 'ichiro@example.com', durationSeconds: 3600 },
      ],
      ...overrides,
    };
  }

  describe('新規グループ追加', () => {
    it('空のindexに新規セッションを追加するとGroupSummaryが作成されること', () => {
      const parsedSession = createParsedSession();
      const result = merger.merge(emptyIndex, parsedSession);

      expect(result.index.groups).toHaveLength(1);
      expect(result.index.groups[0].id).toMatch(ULID_PATTERN);
      expect(result.index.groups[0].name).toBe('フロントエンド勉強会');
      expect(result.index.groups[0].totalDurationSeconds).toBe(3600);
      expect(result.index.groups[0].sessionRevisions).toContain('01TESTID0000000000000000A/0');
    });
  });

  describe('既存グループ更新（名前ベースマッチング）', () => {
    it('同名グループが存在する場合は既存IDを再利用しセッションを追加すること', () => {
      const currentIndex = {
        schemaVersion: 2,
        version: 1,
        groups: [
          {
            id: '01EXISTGROUP00000000000A',
            name: 'フロントエンド勉強会',
            totalDurationSeconds: 3600,
            sessionRevisions: ['01EXISTSESSION000000000A/0'],
          },
        ],
        members: [
          {
            id: '01EXISTMEMBER00000000000',
            name: '佐藤 一郎',
            totalDurationSeconds: 3600,
            sessionRevisions: ['01EXISTSESSION000000000A/0'],
          },
        ],
        updatedAt: '2026-01-15T00:00:00.000Z',
      };
      const parsedSession = createParsedSession({
        sessionId: '01NEWSESSION0000000000000',
      });

      const result = merger.merge(currentIndex, parsedSession);

      // 既存グループIDが再利用される
      expect(result.index.groups[0].id).toBe('01EXISTGROUP00000000000A');
      expect(result.index.groups[0].totalDurationSeconds).toBe(7200);
      expect(result.index.groups[0].sessionRevisions).toHaveLength(2);
      expect(result.index.groups[0].sessionRevisions).toContain('01NEWSESSION0000000000000/0');
    });
  });

  describe('新規メンバー追加', () => {
    it('新しいメンバーがMemberSummaryに追加されること', () => {
      const parsedSession = createParsedSession({
        attendances: [
          { memberName: '佐藤 一郎', memberEmail: 'ichiro@example.com', durationSeconds: 3600 },
          { memberName: '高橋 美咲', memberEmail: 'misaki@example.com', durationSeconds: 1800 },
        ],
      });

      const result = merger.merge(emptyIndex, parsedSession);

      expect(result.index.members).toHaveLength(2);
      expect(result.index.members[0].id).toMatch(ULID_PATTERN);
      expect(result.index.members[0].name).toBe('佐藤 一郎');
      expect(result.index.members[0].totalDurationSeconds).toBe(3600);
      expect(result.index.members[0].instructorCount).toBe(0);
      expect(result.index.members[0].sessionRevisions).toHaveLength(1);
      expect(result.index.members[1].name).toBe('高橋 美咲');
      expect(result.index.members[1].totalDurationSeconds).toBe(1800);
      expect(result.index.members[1].instructorCount).toBe(0);
    });
  });

  describe('既存メンバー更新（名前ベースマッチング）', () => {
    it('同名メンバーが存在する場合は既存IDを再利用し情報を更新すること', () => {
      const currentIndex = {
        schemaVersion: 2,
        version: 1,
        groups: [
          {
            id: '01EXISTGROUP00000000000A',
            name: 'フロントエンド勉強会',
            totalDurationSeconds: 3600,
            sessionRevisions: ['01EXISTSESSION000000000A/0'],
          },
        ],
        members: [
          {
            id: '01EXISTMEMBER00000000000',
            name: '佐藤 一郎',
            totalDurationSeconds: 3600,
            sessionRevisions: ['01EXISTSESSION000000000A/0'],
          },
        ],
        updatedAt: '2026-01-15T00:00:00.000Z',
      };
      const parsedSession = createParsedSession({
        sessionId: '01NEWSESSION0000000000000',
        attendances: [
          { memberName: '佐藤 一郎', memberEmail: 'ichiro@example.com', durationSeconds: 2400 },
        ],
      });

      const result = merger.merge(currentIndex, parsedSession);

      expect(result.index.members[0].id).toBe('01EXISTMEMBER00000000000');
      expect(result.index.members[0].totalDurationSeconds).toBe(6000);
      expect(result.index.members[0].sessionRevisions).toEqual([
        '01EXISTSESSION000000000A/0',
        '01NEWSESSION0000000000000/0',
      ]);
    });

    it('既存メンバーの instructorCount が保持されること', () => {
      const currentIndex = {
        schemaVersion: 2,
        version: 1,
        groups: [
          {
            id: '01EXISTGROUP00000000000A',
            name: 'フロントエンド勉強会',
            totalDurationSeconds: 3600,
            sessionRevisions: ['01EXISTSESSION000000000A/0'],
          },
        ],
        members: [
          {
            id: '01EXISTMEMBER00000000000',
            name: '佐藤 一郎',
            totalDurationSeconds: 3600,
            instructorCount: 3,
            sessionRevisions: ['01EXISTSESSION000000000A/0'],
          },
        ],
        updatedAt: '2026-01-15T00:00:00.000Z',
      };
      const parsedSession = createParsedSession({
        sessionId: '01NEWSESSION0000000000000',
        attendances: [
          { memberName: '佐藤 一郎', memberEmail: 'ichiro@example.com', durationSeconds: 2400 },
        ],
      });

      const result = merger.merge(currentIndex, parsedSession);

      expect(result.index.members[0].instructorCount).toBe(3);
    });
  });

  describe('version インクリメント', () => {
    it('マージ後の version が +1 されること', () => {
      const parsedSession = createParsedSession();
      const result = merger.merge(emptyIndex, parsedSession);

      expect(result.index.version).toBe(1);
    });

    it('既存 version が存在する場合はインクリメントされること', () => {
      const currentIndex = { ...emptyIndex, version: 5 };
      const parsedSession = createParsedSession();
      const result = merger.merge(currentIndex, parsedSession);

      expect(result.index.version).toBe(6);
    });
  });

  describe('schemaVersion', () => {
    it('マージ後の schemaVersion が 2 であること', () => {
      const parsedSession = createParsedSession();
      const result = merger.merge(emptyIndex, parsedSession);

      expect(result.index.schemaVersion).toBe(2);
    });
  });

  describe('updatedAt更新', () => {
    it('マージ後のupdatedAtが現在時刻に更新されていること', () => {
      const parsedSession = createParsedSession();
      const result = merger.merge(emptyIndex, parsedSession);

      expect(result.index.updatedAt).toBe('2026-02-06T03:00:00.000Z');
    });
  });

  describe('sessionRecord 返却', () => {
    it('resolved memberId 入りの sessionRecord を返すこと', () => {
      const parsedSession = createParsedSession({
        attendances: [
          { memberName: '佐藤 一郎', memberEmail: 'ichiro@example.com', durationSeconds: 3600 },
          { memberName: '高橋 美咲', memberEmail: 'misaki@example.com', durationSeconds: 1800 },
        ],
      });

      const result = merger.merge(emptyIndex, parsedSession);

      expect(result.sessionRecord.sessionId).toBe('01TESTID0000000000000000A');
      expect(result.sessionRecord.revision).toBe(0);
      expect(result.sessionRecord.title).toBe('');
      expect(result.sessionRecord.startedAt).toBe('2026-01-15T19:00:00');
      expect(result.sessionRecord.endedAt).toBeNull();
      expect(result.sessionRecord.attendances).toHaveLength(2);
      expect(result.sessionRecord.attendances[0].memberId).toMatch(ULID_PATTERN);
      expect(result.sessionRecord.attendances[0].durationSeconds).toBe(3600);
      expect(result.sessionRecord.attendances[1].memberId).toMatch(ULID_PATTERN);
      expect(result.sessionRecord.attendances[1].durationSeconds).toBe(1800);
      expect(result.sessionRecord.createdAt).toBe('2026-02-06T03:00:00.000Z');
    });

    it('sessionRecord に instructors: [] がデフォルトで含まれること', () => {
      const parsedSession = createParsedSession();
      const result = merger.merge(emptyIndex, parsedSession);

      expect(result.sessionRecord.instructors).toEqual([]);
    });

    it('sessionRecord の memberId が index.members の ID と一致すること', () => {
      const parsedSession = createParsedSession();
      const result = merger.merge(emptyIndex, parsedSession);

      const memberIdInIndex = result.index.members[0].id;
      const memberIdInRecord = result.sessionRecord.attendances[0].memberId;
      expect(memberIdInRecord).toBe(memberIdInIndex);
    });
  });

  describe('イミュータブル性', () => {
    it('元のindexオブジェクトが変更されないこと', () => {
      const currentIndex = {
        schemaVersion: 2,
        version: 1,
        groups: [
          {
            id: '01EXISTGROUP00000000000A',
            name: 'フロントエンド勉強会',
            totalDurationSeconds: 3600,
            sessionRevisions: ['01EXISTSESSION000000000A/0'],
          },
        ],
        members: [
          {
            id: '01EXISTMEMBER00000000000',
            name: '佐藤 一郎',
            totalDurationSeconds: 3600,
            sessionRevisions: ['01EXISTSESSION000000000A/0'],
          },
        ],
        updatedAt: '2026-01-15T00:00:00.000Z',
      };
      const original = JSON.parse(JSON.stringify(currentIndex));
      const parsedSession = createParsedSession({
        sessionId: '01NEWSESSION0000000000000',
        attendances: [
          { memberName: '高橋 美咲', memberEmail: 'misaki@example.com', durationSeconds: 2400 },
        ],
      });

      merger.merge(currentIndex, parsedSession);
      expect(currentIndex).toEqual(original);
    });
  });

  describe('グループ合計のtotalDurationSeconds', () => {
    it('GroupSummaryのtotalDurationSecondsが全参加者の時間を合計した値であること', () => {
      const parsedSession = createParsedSession({
        attendances: [
          { memberName: '佐藤 一郎', memberEmail: 'ichiro@example.com', durationSeconds: 3600 },
          { memberName: '高橋 美咲', memberEmail: 'misaki@example.com', durationSeconds: 1800 },
        ],
      });

      const result = merger.merge(emptyIndex, parsedSession);
      expect(result.index.groups[0].totalDurationSeconds).toBe(5400);
    });
  });

  describe('warnings', () => {
    it('通常のマージでは空の warnings を返すこと', () => {
      const parsedSession = createParsedSession();
      const result = merger.merge(emptyIndex, parsedSession);

      expect(result.warnings).toEqual([]);
    });
  });
});
