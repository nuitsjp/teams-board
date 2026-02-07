// DataContractValidator テスト — 出力JSONの契約検証
import { describe, it, expect } from 'vitest';
import { DataContractValidator } from '../../src/local-batch/data-contract-validator.js';

describe('DataContractValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new DataContractValidator();
  });

  // 有効なインデックスデータ
  const validIndex = {
    studyGroups: [
      {
        id: 'abc12345',
        name: 'もくもく勉強会',
        totalDurationSeconds: 3600,
        sessionIds: ['abc12345-2026-01-15'],
      },
    ],
    members: [
      {
        id: 'mem00001',
        name: 'テスト太郎',
        totalDurationSeconds: 3600,
        sessionIds: ['abc12345-2026-01-15'],
      },
    ],
    updatedAt: '2026-02-06T03:00:00.000Z',
  };

  // 有効なセッションデータ
  const validSession = {
    id: 'abc12345-2026-01-15',
    studyGroupId: 'abc12345',
    date: '2026-01-15',
    attendances: [
      { memberId: 'mem00001', durationSeconds: 3600 },
    ],
  };

  describe('インデックス検証 — 正常系', () => {
    it('有効なインデックスに対して空の検証結果を返すこと', () => {
      const issues = validator.validateIndex(validIndex);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('インデックス検証 — 必須キー欠落', () => {
    it('studyGroupsが欠落している場合エラーを返すこと', () => {
      const index = { members: [], updatedAt: '2026-01-01T00:00:00Z' };
      const issues = validator.validateIndex(index);
      expect(issues.some((i) => i.severity === 'error' && i.fieldPath === 'studyGroups')).toBe(true);
    });

    it('membersが欠落している場合エラーを返すこと', () => {
      const index = { studyGroups: [], updatedAt: '2026-01-01T00:00:00Z' };
      const issues = validator.validateIndex(index);
      expect(issues.some((i) => i.severity === 'error' && i.fieldPath === 'members')).toBe(true);
    });

    it('updatedAtが欠落している場合エラーを返すこと', () => {
      const index = { studyGroups: [], members: [] };
      const issues = validator.validateIndex(index);
      expect(issues.some((i) => i.severity === 'error' && i.fieldPath === 'updatedAt')).toBe(true);
    });
  });

  describe('インデックス検証 — 型不正', () => {
    it('studyGroupsが配列でない場合エラーを返すこと', () => {
      const index = { studyGroups: 'invalid', members: [], updatedAt: '2026-01-01T00:00:00Z' };
      const issues = validator.validateIndex(index);
      expect(issues.some((i) => i.severity === 'error' && i.fieldPath === 'studyGroups')).toBe(true);
    });

    it('updatedAtが文字列でない場合エラーを返すこと', () => {
      const index = { studyGroups: [], members: [], updatedAt: 12345 };
      const issues = validator.validateIndex(index);
      expect(issues.some((i) => i.severity === 'error' && i.fieldPath === 'updatedAt')).toBe(true);
    });
  });

  describe('インデックス検証 — StudyGroupSummary要素', () => {
    it('studyGroupの必須フィールドが欠落している場合エラーを返すこと', () => {
      const index = {
        studyGroups: [{ id: 'abc12345' }], // name, totalDurationSeconds, sessionIds欠落
        members: [],
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const issues = validator.validateIndex(index);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    it('studyGroupのtotalDurationSecondsが数値でない場合エラーを返すこと', () => {
      const index = {
        studyGroups: [{
          id: 'abc12345',
          name: 'テスト',
          totalDurationSeconds: 'invalid',
          sessionIds: [],
        }],
        members: [],
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const issues = validator.validateIndex(index);
      expect(issues.some((i) =>
        i.severity === 'error' && i.fieldPath.includes('totalDurationSeconds')
      )).toBe(true);
    });
  });

  describe('インデックス検証 — MemberSummary要素', () => {
    it('memberの必須フィールドが欠落している場合エラーを返すこと', () => {
      const index = {
        studyGroups: [],
        members: [{ id: 'mem00001' }], // name, totalDurationSeconds, sessionIds欠落
        updatedAt: '2026-01-01T00:00:00Z',
      };
      const issues = validator.validateIndex(index);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('セッション検証 — 正常系', () => {
    it('有効なセッションに対して空の検証結果を返すこと', () => {
      const issues = validator.validateSession('sessions/abc12345-2026-01-15.json', validSession);
      const errors = issues.filter((i) => i.severity === 'error');
      expect(errors).toHaveLength(0);
    });
  });

  describe('セッション検証 — 必須キー欠落', () => {
    it('idが欠落している場合エラーを返すこと', () => {
      const session = { studyGroupId: 'abc12345', date: '2026-01-15', attendances: [] };
      const issues = validator.validateSession('sessions/test.json', session);
      expect(issues.some((i) => i.severity === 'error' && i.fieldPath === 'id')).toBe(true);
    });

    it('studyGroupIdが欠落している場合エラーを返すこと', () => {
      const session = { id: 'test', date: '2026-01-15', attendances: [] };
      const issues = validator.validateSession('sessions/test.json', session);
      expect(issues.some((i) => i.severity === 'error' && i.fieldPath === 'studyGroupId')).toBe(true);
    });

    it('dateが欠落している場合エラーを返すこと', () => {
      const session = { id: 'test', studyGroupId: 'abc12345', attendances: [] };
      const issues = validator.validateSession('sessions/test.json', session);
      expect(issues.some((i) => i.severity === 'error' && i.fieldPath === 'date')).toBe(true);
    });

    it('attendancesが欠落している場合エラーを返すこと', () => {
      const session = { id: 'test', studyGroupId: 'abc12345', date: '2026-01-15' };
      const issues = validator.validateSession('sessions/test.json', session);
      expect(issues.some((i) => i.severity === 'error' && i.fieldPath === 'attendances')).toBe(true);
    });
  });

  describe('セッション検証 — attendance要素', () => {
    it('attendance要素のmemberIdが欠落している場合エラーを返すこと', () => {
      const session = {
        id: 'test',
        studyGroupId: 'abc12345',
        date: '2026-01-15',
        attendances: [{ durationSeconds: 3600 }],
      };
      const issues = validator.validateSession('sessions/test.json', session);
      expect(issues.some((i) =>
        i.severity === 'error' && i.fieldPath.includes('memberId')
      )).toBe(true);
    });

    it('attendance要素のdurationSecondsが数値でない場合エラーを返すこと', () => {
      const session = {
        id: 'test',
        studyGroupId: 'abc12345',
        date: '2026-01-15',
        attendances: [{ memberId: 'mem00001', durationSeconds: 'invalid' }],
      };
      const issues = validator.validateSession('sessions/test.json', session);
      expect(issues.some((i) =>
        i.severity === 'error' && i.fieldPath.includes('durationSeconds')
      )).toBe(true);
    });
  });

  describe('検証結果の構造', () => {
    it('検証結果にfilePath, fieldPath, message, severityが含まれること', () => {
      const index = { studyGroups: 'invalid', members: [], updatedAt: '2026-01-01T00:00:00Z' };
      const issues = validator.validateIndex(index);
      expect(issues.length).toBeGreaterThan(0);
      const issue = issues[0];
      expect(issue).toHaveProperty('filePath');
      expect(issue).toHaveProperty('fieldPath');
      expect(issue).toHaveProperty('message');
      expect(issue).toHaveProperty('severity');
    });

    it('セッション検証のfilePathに引数のパスが設定されること', () => {
      const session = { id: 'test' }; // 不完全なデータ
      const issues = validator.validateSession('sessions/test.json', session);
      expect(issues.length).toBeGreaterThan(0);
      expect(issues[0].filePath).toBe('sessions/test.json');
    });
  });

  describe('nullやundefined入力', () => {
    it('nullが渡された場合エラーを返すこと', () => {
      const issues = validator.validateIndex(null);
      expect(issues.some((i) => i.severity === 'error')).toBe(true);
    });

    it('セッションにnullが渡された場合エラーを返すこと', () => {
      const issues = validator.validateSession('sessions/test.json', null);
      expect(issues.some((i) => i.severity === 'error')).toBe(true);
    });
  });
});
