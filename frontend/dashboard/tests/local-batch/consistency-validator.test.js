// ConsistencyValidator テスト — 集計値と明細値の整合性検証
import { describe, it, expect, beforeEach } from 'vitest';
import { ConsistencyValidator } from '../../local-batch/consistency-validator.js';

describe('ConsistencyValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new ConsistencyValidator();
  });

  // 整合性のある有効データ
  const validIndex = {
    studyGroups: [
      {
        id: 'abc12345',
        name: 'もくもく勉強会',
        totalDurationSeconds: 5400,
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
      {
        id: 'mem00002',
        name: 'テスト花子',
        totalDurationSeconds: 1800,
        sessionIds: ['abc12345-2026-01-15'],
      },
    ],
    updatedAt: '2026-02-06T03:00:00.000Z',
  };

  const validSessions = [
    {
      id: 'abc12345-2026-01-15',
      studyGroupId: 'abc12345',
      date: '2026-01-15',
      attendances: [
        { memberId: 'mem00001', durationSeconds: 3600 },
        { memberId: 'mem00002', durationSeconds: 1800 },
      ],
    },
  ];

  describe('正常系', () => {
    it('整合性のあるデータに対して空の検証結果を返すこと', () => {
      const issues = validator.validate(validIndex, validSessions);
      expect(issues).toHaveLength(0);
    });
  });

  describe('セッションID参照の検証', () => {
    it('studyGroupのsessionIdが実在しないセッションを参照している場合エラーを返すこと', () => {
      const index = {
        ...validIndex,
        studyGroups: [{
          id: 'abc12345',
          name: 'もくもく勉強会',
          totalDurationSeconds: 3600,
          sessionIds: ['abc12345-2026-01-15', 'nonexistent-session'],
        }],
      };

      const issues = validator.validate(index, validSessions);
      expect(issues.some((i) =>
        i.issueType === 'missing-session' && i.message.includes('nonexistent-session')
      )).toBe(true);
    });

    it('memberのsessionIdが実在しないセッションを参照している場合エラーを返すこと', () => {
      const index = {
        ...validIndex,
        members: [
          {
            id: 'mem00001',
            name: 'テスト太郎',
            totalDurationSeconds: 3600,
            sessionIds: ['abc12345-2026-01-15', 'nonexistent-session'],
          },
          validIndex.members[1],
        ],
      };

      const issues = validator.validate(index, validSessions);
      expect(issues.some((i) =>
        i.issueType === 'missing-session' && i.message.includes('nonexistent-session')
      )).toBe(true);
    });
  });

  describe('メンバー出席記録の整合性検証', () => {
    it('memberのsessionIdに対応するセッションに出席記録がない場合エラーを返すこと', () => {
      const index = {
        ...validIndex,
        members: [
          {
            id: 'mem00003', // このメンバーはセッションのattendancesにいない
            name: '不在メンバー',
            totalDurationSeconds: 0,
            sessionIds: ['abc12345-2026-01-15'],
          },
          ...validIndex.members,
        ],
      };

      const issues = validator.validate(index, validSessions);
      expect(issues.some((i) =>
        i.issueType === 'missing-member-attendance' && i.message.includes('mem00003')
      )).toBe(true);
    });
  });

  describe('合計時間の整合性検証', () => {
    it('memberのtotalDurationSecondsが明細合計と不一致の場合エラーを返すこと', () => {
      const index = {
        ...validIndex,
        members: [
          {
            id: 'mem00001',
            name: 'テスト太郎',
            totalDurationSeconds: 9999, // 明細合計は3600のはず
            sessionIds: ['abc12345-2026-01-15'],
          },
          validIndex.members[1],
        ],
      };

      const issues = validator.validate(index, validSessions);
      expect(issues.some((i) =>
        i.issueType === 'duration-mismatch' && i.message.includes('mem00001')
      )).toBe(true);
    });

    it('studyGroupのtotalDurationSecondsがセッション明細合計と不一致の場合エラーを返すこと', () => {
      const index = {
        ...validIndex,
        studyGroups: [{
          id: 'abc12345',
          name: 'もくもく勉強会',
          totalDurationSeconds: 9999, // 明細合計は5400のはず
          sessionIds: ['abc12345-2026-01-15'],
        }],
      };

      const issues = validator.validate(index, validSessions);
      expect(issues.some((i) =>
        i.issueType === 'duration-mismatch' && i.message.includes('abc12345')
      )).toBe(true);
    });
  });

  describe('検証結果の構造', () => {
    it('検証結果にfilePath, issueType, messageが含まれること', () => {
      const index = {
        ...validIndex,
        studyGroups: [{
          id: 'abc12345',
          name: 'もくもく勉強会',
          totalDurationSeconds: 3600,
          sessionIds: ['nonexistent'],
        }],
      };

      const issues = validator.validate(index, validSessions);
      expect(issues.length).toBeGreaterThan(0);
      const issue = issues[0];
      expect(issue).toHaveProperty('filePath');
      expect(issue).toHaveProperty('issueType');
      expect(issue).toHaveProperty('message');
    });
  });

  describe('複数セッションでの検証', () => {
    it('複数セッションにまたがるメンバーの合計時間を正しく検証すること', () => {
      const index = {
        studyGroups: [{
          id: 'abc12345',
          name: 'もくもく勉強会',
          totalDurationSeconds: 10800, // 3600+1800 + 3600+1800 = 10800
          sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'],
        }],
        members: [
          {
            id: 'mem00001',
            name: 'テスト太郎',
            totalDurationSeconds: 7200, // 3600 + 3600 = 7200
            sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'],
          },
          {
            id: 'mem00002',
            name: 'テスト花子',
            totalDurationSeconds: 3600, // 1800 + 1800 = 3600
            sessionIds: ['abc12345-2026-01-15', 'abc12345-2026-01-22'],
          },
        ],
        updatedAt: '2026-02-06T03:00:00.000Z',
      };

      const sessions = [
        {
          id: 'abc12345-2026-01-15',
          studyGroupId: 'abc12345',
          date: '2026-01-15',
          attendances: [
            { memberId: 'mem00001', durationSeconds: 3600 },
            { memberId: 'mem00002', durationSeconds: 1800 },
          ],
        },
        {
          id: 'abc12345-2026-01-22',
          studyGroupId: 'abc12345',
          date: '2026-01-22',
          attendances: [
            { memberId: 'mem00001', durationSeconds: 3600 },
            { memberId: 'mem00002', durationSeconds: 1800 },
          ],
        },
      ];

      const issues = validator.validate(index, sessions);
      expect(issues).toHaveLength(0);
    });
  });
});
