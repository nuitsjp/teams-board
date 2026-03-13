import { describe, it, expect } from 'vitest';
import { IndexEditor } from '../../../src/services/index-editor.js';

describe('IndexEditor', () => {
  const sampleIndex = {
    schemaVersion: 2,
    version: 1,
    groups: [
      {
        id: 'group1',
        name: '旧グループ名',
        totalDurationSeconds: 3600,
        sessionRevisions: ['session1/0', 'session2/0'],
      },
      {
        id: 'group2',
        name: '別のグループ',
        totalDurationSeconds: 1800,
        sessionRevisions: ['session3/0'],
      },
    ],
    members: [
      {
        id: 'member1',
        name: 'メンバー1',
        totalDurationSeconds: 3600,
        sessionRevisions: ['session1/0'],
      },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  describe('updateGroupName', () => {
    it('正常系: グループ名を更新し、version をインクリメントする', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndex, 'group1', '新しいグループ名');

      expect(result.error).toBeUndefined();
      expect(result.index.groups).toHaveLength(2);
      expect(result.index.groups[0].id).toBe('group1');
      expect(result.index.groups[0].name).toBe('新しいグループ名');
      expect(result.index.groups[0].totalDurationSeconds).toBe(3600);
      expect(result.index.groups[0].sessionRevisions).toEqual(['session1/0', 'session2/0']);
      expect(result.index.groups[1].name).toBe('別のグループ');
      expect(result.index.version).toBe(2);
      expect(result.index.schemaVersion).toBe(2);
      expect(result.index.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
    });

    it('正常系: グループIDは変更されない', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndex, 'group1', '新しい名前');

      expect(result.index.groups[0].id).toBe('group1');
    });

    it('正常系: 他のグループには影響しない', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndex, 'group1', '新しい名前');

      expect(result.index.groups[1].name).toBe('別のグループ');
      expect(result.index.groups[1].id).toBe('group2');
    });

    it('正常系: メンバー情報は変更されない', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndex, 'group1', '新しい名前');

      expect(result.index.members).toHaveLength(1);
      expect(result.index.members[0].name).toBe('メンバー1');
      expect(result.index.members[0].sessionRevisions).toEqual(['session1/0']);
    });

    it('異常系: 存在しないグループIDの場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndex, 'nonexistent', '新しい名前');

      expect(result.error).toBe('グループID nonexistent が見つかりません');
      expect(result.index).toBe(sampleIndex);
    });

    it('バリデーションエラー: 空文字の場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndex, 'group1', '');

      expect(result.error).toBe('グループ名を入力してください');
      expect(result.index).toBe(sampleIndex);
    });

    it('バリデーションエラー: 空白のみの場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndex, 'group1', '   ');

      expect(result.error).toBe('グループ名を入力してください');
      expect(result.index).toBe(sampleIndex);
    });

    it('バリデーションエラー: 256文字超過の場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const longName = 'あ'.repeat(257);
      const result = editor.updateGroupName(sampleIndex, 'group1', longName);

      expect(result.error).toBe('グループ名は256文字以内で入力してください');
      expect(result.index).toBe(sampleIndex);
    });

    it('バリデーション成功: 256文字ちょうどの場合は通過する', () => {
      const editor = new IndexEditor();
      const exactName = 'あ'.repeat(256);
      const result = editor.updateGroupName(sampleIndex, 'group1', exactName);

      expect(result.error).toBeUndefined();
      expect(result.index.groups[0].name).toBe(exactName);
    });

    it('バリデーションエラー: 文字列でない場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndex, 'group1', 123);

      expect(result.error).toBe('グループ名は文字列である必要があります');
      expect(result.index).toBe(sampleIndex);
    });
  });

  describe('validateGroupName', () => {
    it('正常系: 有効な名前の場合はnullを返す', () => {
      const editor = new IndexEditor();
      expect(editor.validateGroupName('有効なグループ名')).toBeNull();
    });

    it('異常系: 空文字の場合はエラーメッセージを返す', () => {
      const editor = new IndexEditor();
      expect(editor.validateGroupName('')).toBe('グループ名を入力してください');
    });

    it('異常系: 空白のみの場合はエラーメッセージを返す', () => {
      const editor = new IndexEditor();
      expect(editor.validateGroupName('  ')).toBe('グループ名を入力してください');
    });

    it('異常系: 256文字超過の場合はエラーメッセージを返す', () => {
      const editor = new IndexEditor();
      expect(editor.validateGroupName('あ'.repeat(257))).toBe(
        'グループ名は256文字以内で入力してください'
      );
    });

    it('異常系: 文字列でない場合はエラーメッセージを返す', () => {
      const editor = new IndexEditor();
      expect(editor.validateGroupName(null)).toBe('グループ名は文字列である必要があります');
    });
  });

  describe('mergeGroups', () => {
    it('正常系: 複数グループを統合し、統合元を削除する', () => {
      const editor = new IndexEditor();
      const result = editor.mergeGroups(sampleIndex, 'group1', ['group1', 'group2']);

      expect(result.error).toBeUndefined();
      expect(result.index.groups).toHaveLength(1);
      expect(result.index.groups[0].id).toBe('group1');
      expect(result.index.groups[0].name).toBe('旧グループ名');
      expect(result.index.groups[0].sessionRevisions).toEqual([
        'session1/0',
        'session2/0',
        'session3/0',
      ]);
      expect(result.index.groups[0].totalDurationSeconds).toBe(5400);
      expect(result.index.version).toBe(2);
      expect(result.index.schemaVersion).toBe(2);
      expect(result.index.updatedAt).not.toBe(sampleIndex.updatedAt);
    });

    it('正常系: 重複sessionRevisionは除外して統合を継続する', () => {
      const editor = new IndexEditor();
      const duplicatedIndex = {
        ...sampleIndex,
        groups: [
          {
            id: 'group1',
            name: '旧グループ名',
            totalDurationSeconds: 3600,
            sessionRevisions: ['session1/0', 'session2/0'],
          },
          {
            id: 'group2',
            name: '別のグループ',
            totalDurationSeconds: 1800,
            sessionRevisions: ['session2/0', 'session3/0'],
          },
        ],
      };
      const result = editor.mergeGroups(duplicatedIndex, 'group1', ['group1', 'group2']);

      expect(result.error).toBeUndefined();
      expect(result.index.groups).toHaveLength(1);
      expect(result.index.groups[0].sessionRevisions).toEqual([
        'session1/0',
        'session2/0',
        'session3/0',
      ]);
      expect(result.index.groups[0].totalDurationSeconds).toBe(4500);
    });

    it('正常系: メンバー情報は変更されない', () => {
      const editor = new IndexEditor();
      const result = editor.mergeGroups(sampleIndex, 'group1', ['group1', 'group2']);

      expect(result.index.members).toHaveLength(1);
      expect(result.index.members[0].id).toBe('member1');
      expect(result.index.members[0].sessionRevisions).toEqual(['session1/0']);
    });

    it('正常系: 入力オブジェクトは破壊されない', () => {
      const editor = new IndexEditor();
      const before = JSON.parse(JSON.stringify(sampleIndex));
      editor.mergeGroups(sampleIndex, 'group1', ['group1', 'group2']);

      expect(sampleIndex).toEqual(before);
    });

    it('異常系: 選択数が1件の場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.mergeGroups(sampleIndex, 'group1', ['group1']);

      expect(result.error).toBe('グループ統合には2つ以上のグループ選択が必要です');
      expect(result.index).toBe(sampleIndex);
    });

    it('異常系: 統合先が選択グループに含まれない場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.mergeGroups(sampleIndex, 'group1', ['group2', 'group3']);

      expect(result.error).toBe('統合先グループは選択されたグループに含まれている必要があります');
      expect(result.index).toBe(sampleIndex);
    });

    it('異常系: 存在しないグループIDを指定した場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.mergeGroups(sampleIndex, 'group1', ['group1', 'missing']);

      expect(result.error).toBe('グループID missing が見つかりません');
      expect(result.index).toBe(sampleIndex);
    });

    it('正常系: sessionRevisions が空のグループを含む統合で totalDurationSeconds が正しく計算される', () => {
      const editor = new IndexEditor();
      const indexWithEmptyGroup = {
        ...sampleIndex,
        groups: [
          {
            id: 'group1',
            name: 'セッションありグループ',
            totalDurationSeconds: 3600,
            sessionRevisions: ['session1/0'],
          },
          {
            id: 'group2',
            name: 'セッションなしグループ',
            totalDurationSeconds: 0,
            sessionRevisions: [],
          },
        ],
      };
      const result = editor.mergeGroups(indexWithEmptyGroup, 'group1', ['group1', 'group2']);

      expect(result.error).toBeUndefined();
      expect(result.index.groups).toHaveLength(1);
      expect(result.index.groups[0].sessionRevisions).toEqual(['session1/0']);
      expect(result.index.groups[0].totalDurationSeconds).toBe(3600);
    });
  });

  describe('removeSessionFromGroup', () => {
    const indexForRemove = {
      schemaVersion: 2,
      version: 3,
      groups: [
        {
          id: 'group1',
          name: 'グループA',
          totalDurationSeconds: 7200,
          sessionRevisions: ['session1/0', 'session2/0'],
        },
        {
          id: 'group2',
          name: 'グループB',
          totalDurationSeconds: 1800,
          sessionRevisions: ['session3/0'],
        },
      ],
      members: [
        {
          id: 'member1',
          name: 'メンバー1',
          totalDurationSeconds: 5400,
          sessionRevisions: ['session1/0', 'session2/0'],
        },
        {
          id: 'member2',
          name: 'メンバー2',
          totalDurationSeconds: 1800,
          sessionRevisions: ['session1/0'],
        },
        {
          id: 'member3',
          name: 'メンバー3',
          totalDurationSeconds: 3600,
          sessionRevisions: ['session3/0'],
        },
      ],
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const sessionData1 = {
      sessionId: 'session1',
      revision: 0,
      attendances: [
        { memberId: 'member1', durationSeconds: 3600 },
        { memberId: 'member2', durationSeconds: 1800 },
      ],
    };

    const sessionData2 = {
      sessionId: 'session2',
      revision: 0,
      attendances: [{ memberId: 'member1', durationSeconds: 1800 }],
    };

    it('正常系: グループから sessionRef が除去され、totalDurationSeconds が再計算される', () => {
      const editor = new IndexEditor();
      const result = editor.removeSessionFromGroup(
        indexForRemove,
        'group1',
        'session1/0',
        sessionData1
      );

      expect(result.error).toBeUndefined();
      const group = result.index.groups.find((g) => g.id === 'group1');
      expect(group.sessionRevisions).toEqual(['session2/0']);
      // 7200 - (3600 + 1800) = 1800
      expect(group.totalDurationSeconds).toBe(1800);
    });

    it('正常系: 該当メンバーの sessionRevisions・totalDurationSeconds が更新される', () => {
      const editor = new IndexEditor();
      const result = editor.removeSessionFromGroup(
        indexForRemove,
        'group1',
        'session1/0',
        sessionData1
      );

      expect(result.error).toBeUndefined();
      const member1 = result.index.members.find((m) => m.id === 'member1');
      expect(member1.sessionRevisions).toEqual(['session2/0']);
      expect(member1.totalDurationSeconds).toBe(1800);

      const member2 = result.index.members.find((m) => m.id === 'member2');
      expect(member2.sessionRevisions).toEqual([]);
      expect(member2.totalDurationSeconds).toBe(0);
    });

    it('正常系: 関係ないグループ・メンバーは変更されない', () => {
      const editor = new IndexEditor();
      const result = editor.removeSessionFromGroup(
        indexForRemove,
        'group1',
        'session1/0',
        sessionData1
      );

      const group2 = result.index.groups.find((g) => g.id === 'group2');
      expect(group2.sessionRevisions).toEqual(['session3/0']);
      expect(group2.totalDurationSeconds).toBe(1800);

      const member3 = result.index.members.find((m) => m.id === 'member3');
      expect(member3.sessionRevisions).toEqual(['session3/0']);
      expect(member3.totalDurationSeconds).toBe(3600);
    });

    it('正常系: 入力オブジェクトが変更されないこと（イミュータブル性）', () => {
      const editor = new IndexEditor();
      const before = JSON.parse(JSON.stringify(indexForRemove));
      editor.removeSessionFromGroup(indexForRemove, 'group1', 'session1/0', sessionData1);

      expect(indexForRemove).toEqual(before);
    });

    it('正常系: 最後のセッション削除で空配列・0秒になる', () => {
      const editor = new IndexEditor();
      const singleSessionIndex = {
        ...indexForRemove,
        groups: [
          {
            id: 'group2',
            name: 'グループB',
            totalDurationSeconds: 1800,
            sessionRevisions: ['session3/0'],
          },
        ],
        members: [
          {
            id: 'member3',
            name: 'メンバー3',
            totalDurationSeconds: 3600,
            sessionRevisions: ['session3/0'],
          },
        ],
      };
      const sessionData3 = {
        attendances: [{ memberId: 'member3', durationSeconds: 1800 }],
      };
      const result = editor.removeSessionFromGroup(
        singleSessionIndex,
        'group2',
        'session3/0',
        sessionData3
      );

      expect(result.error).toBeUndefined();
      const group = result.index.groups.find((g) => g.id === 'group2');
      expect(group.sessionRevisions).toEqual([]);
      expect(group.totalDurationSeconds).toBe(0);

      const member = result.index.members.find((m) => m.id === 'member3');
      expect(member.sessionRevisions).toEqual([]);
      expect(member.totalDurationSeconds).toBe(1800);
    });

    it('正常系: version がインクリメントされる', () => {
      const editor = new IndexEditor();
      const result = editor.removeSessionFromGroup(
        indexForRemove,
        'group1',
        'session1/0',
        sessionData1
      );

      expect(result.index.version).toBe(4);
      expect(result.index.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
    });

    it('エラー系: 存在しない groupId', () => {
      const editor = new IndexEditor();
      const result = editor.removeSessionFromGroup(
        indexForRemove,
        'nonexistent',
        'session1/0',
        sessionData1
      );

      expect(result.error).toBe('グループID nonexistent が見つかりません');
      expect(result.index).toBe(indexForRemove);
    });

    it('エラー系: グループに属さない sessionRef', () => {
      const editor = new IndexEditor();
      const result = editor.removeSessionFromGroup(
        indexForRemove,
        'group1',
        'session3/0',
        { attendances: [{ memberId: 'member3', durationSeconds: 1800 }] }
      );

      expect(result.error).toBe('セッション session3/0 はこのグループに属していません');
      expect(result.index).toBe(indexForRemove);
    });

    it('エラー系: groupId が空の場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.removeSessionFromGroup(indexForRemove, '', 'session1/0', sessionData1);

      expect(result.error).toBe('グループIDが指定されていません');
      expect(result.index).toBe(indexForRemove);
    });

    it('エラー系: sessionRef が空の場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.removeSessionFromGroup(indexForRemove, 'group1', '', sessionData1);

      expect(result.error).toBe('セッションRefが指定されていません');
      expect(result.index).toBe(indexForRemove);
    });

    it('エラー系: sessionData が不正な場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.removeSessionFromGroup(indexForRemove, 'group1', 'session1/0', {});

      expect(result.error).toBe('セッションデータが不正です（attendances が必要です）');
      expect(result.index).toBe(indexForRemove);
    });

    it('正常系: 同一 memberId が複数回出現する場合に durationSeconds を合算して減算する', () => {
      const editor = new IndexEditor();
      const indexWithDuplicate = {
        schemaVersion: 2,
        version: 1,
        groups: [
          {
            id: 'group1',
            name: 'グループA',
            totalDurationSeconds: 1800,
            sessionRevisions: ['dup-session/0'],
          },
        ],
        members: [
          {
            id: 'member1',
            name: 'メンバー1',
            totalDurationSeconds: 1800,
            sessionRevisions: ['dup-session/0'],
          },
        ],
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      // 同一メンバーが再入室して2つの attendance レコードを持つケース
      const sessionDataDuplicate = {
        attendances: [
          { memberId: 'member1', durationSeconds: 600 },
          { memberId: 'member1', durationSeconds: 300 },
        ],
      };
      const result = editor.removeSessionFromGroup(
        indexWithDuplicate,
        'group1',
        'dup-session/0',
        sessionDataDuplicate
      );

      expect(result.error).toBeUndefined();
      const member = result.index.members.find((m) => m.id === 'member1');
      // 600 + 300 = 900 を合算して減算: 1800 - 900 = 900
      expect(member.totalDurationSeconds).toBe(900);
      expect(member.sessionRevisions).toEqual([]);
    });

    it('正常系: セッション削除時に講師メンバーの instructorCount が減算される', () => {
      const editor = new IndexEditor();
      const indexWithInstructor = {
        schemaVersion: 2,
        version: 1,
        groups: [
          {
            id: 'group1',
            name: 'グループA',
            totalDurationSeconds: 3600,
            sessionRevisions: ['session1/0'],
          },
        ],
        members: [
          {
            id: 'member1',
            name: 'メンバー1',
            totalDurationSeconds: 3600,
            instructorCount: 2,
            sessionRevisions: ['session1/0'],
          },
          {
            id: 'member2',
            name: 'メンバー2',
            totalDurationSeconds: 1800,
            instructorCount: 1,
            sessionRevisions: ['session1/0'],
          },
        ],
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const sessionDataWithInstructors = {
        attendances: [
          { memberId: 'member1', durationSeconds: 3600 },
          { memberId: 'member2', durationSeconds: 1800 },
        ],
        instructors: ['member1'],
      };
      const result = editor.removeSessionFromGroup(
        indexWithInstructor,
        'group1',
        'session1/0',
        sessionDataWithInstructors
      );

      expect(result.error).toBeUndefined();
      const member1 = result.index.members.find((m) => m.id === 'member1');
      expect(member1.instructorCount).toBe(1);
      // member2 は講師ではないので instructorCount は変わらない
      const member2 = result.index.members.find((m) => m.id === 'member2');
      expect(member2.instructorCount).toBe(1);
    });

    it('正常系: instructorCount 未設定のメンバーでも講師削除時にエラーにならない（0 フォールバック）', () => {
      const editor = new IndexEditor();
      const indexWithoutInstructorCount = {
        schemaVersion: 2,
        version: 1,
        groups: [
          {
            id: 'group1',
            name: 'グループA',
            totalDurationSeconds: 3600,
            sessionRevisions: ['session1/0'],
          },
        ],
        members: [
          {
            id: 'member1',
            name: 'メンバー1',
            totalDurationSeconds: 3600,
            sessionRevisions: ['session1/0'],
          },
        ],
        updatedAt: '2026-01-01T00:00:00.000Z',
      };
      const sessionDataWithInstructors = {
        attendances: [{ memberId: 'member1', durationSeconds: 3600 }],
        instructors: ['member1'],
      };
      const result = editor.removeSessionFromGroup(
        indexWithoutInstructorCount,
        'group1',
        'session1/0',
        sessionDataWithInstructors
      );

      expect(result.error).toBeUndefined();
      const member1 = result.index.members.find((m) => m.id === 'member1');
      expect(member1.instructorCount).toBe(0);
    });
  });

  describe('validateMergeGroupsInput', () => {
    it('異常系: selectedGroupIds が配列でない場合はエラーを返す', () => {
      const editor = new IndexEditor();
      expect(editor.validateMergeGroupsInput('group1', 'not-array')).toBe(
        '選択グループIDは配列である必要があります'
      );
    });
  });

  describe('createSessionRevision', () => {
    const sessionData = {
      sessionId: 'session1',
      startedAt: '2026-01-15T19:00:00',
      endedAt: '2026-01-15T20:00:00',
      attendances: [{ memberId: 'member1', durationSeconds: 3600 }],
      instructors: ['member1'],
      createdAt: '2026-01-15T19:00:00.000Z',
      title: '元のタイトル',
    };

    it('正常系: title を更新して新リビジョンを作成する', () => {
      const editor = new IndexEditor();
      const result = editor.createSessionRevision('session1/0', sessionData, {
        title: '新しいタイトル',
      });

      expect(result.error).toBeUndefined();
      expect(result.sessionRecord.sessionId).toBe('session1');
      expect(result.sessionRecord.revision).toBe(1);
      expect(result.sessionRecord.title).toBe('新しいタイトル');
      expect(result.sessionRecord.instructors).toEqual(['member1']);
      expect(result.sessionRecord.attendances).toEqual(sessionData.attendances);
      expect(result.newRef).toBe('session1/1');
      expect(result.newPath).toBe('data/sessions/session1/1.json');
    });

    it('正常系: instructors を更新して新リビジョンを作成する', () => {
      const editor = new IndexEditor();
      const result = editor.createSessionRevision('session1/0', sessionData, {
        instructors: ['member1', 'member2'],
      });

      expect(result.error).toBeUndefined();
      expect(result.sessionRecord.instructors).toEqual(['member1', 'member2']);
      expect(result.sessionRecord.title).toBe('元のタイトル');
    });

    it('正常系: title と instructors を同時に更新する', () => {
      const editor = new IndexEditor();
      const result = editor.createSessionRevision('session1/0', sessionData, {
        title: '更新タイトル',
        instructors: ['member2'],
      });

      expect(result.error).toBeUndefined();
      expect(result.sessionRecord.title).toBe('更新タイトル');
      expect(result.sessionRecord.instructors).toEqual(['member2']);
    });

    it('正常系: title を空文字にするとタイトルなしになる', () => {
      const editor = new IndexEditor();
      const result = editor.createSessionRevision('session1/0', sessionData, {
        title: '',
      });

      expect(result.error).toBeUndefined();
      expect(result.sessionRecord.title).toBeUndefined();
    });

    it('正常系: revision が正しくインクリメントされる', () => {
      const editor = new IndexEditor();
      const result = editor.createSessionRevision('session1/2', sessionData, {
        title: 'テスト',
      });

      expect(result.sessionRecord.revision).toBe(3);
      expect(result.newRef).toBe('session1/3');
    });

    it('正常系: instructors がない sessionData でもデフォルト空配列が設定される', () => {
      const editor = new IndexEditor();
      const dataWithoutInstructors = { ...sessionData };
      delete dataWithoutInstructors.instructors;

      const result = editor.createSessionRevision('session1/0', dataWithoutInstructors, {
        title: 'テスト',
      });

      expect(result.error).toBeUndefined();
      expect(result.sessionRecord.instructors).toEqual([]);
    });

    it('異常系: instructors が配列でない場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.createSessionRevision('session1/0', sessionData, {
        instructors: 'not-array',
      });

      expect(result.error).toBe('講師は配列である必要があります');
      expect(result.sessionRecord).toBeNull();
    });

    it('異常系: instructors の要素が文字列でない場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.createSessionRevision('session1/0', sessionData, {
        instructors: ['member1', 123],
      });

      expect(result.error).toBe('講師IDは文字列である必要があります');
      expect(result.sessionRecord).toBeNull();
    });
  });

  describe('addMember', () => {
    it('正常系: 新規メンバーを追加し、memberId を返す', () => {
      const editor = new IndexEditor();
      const result = editor.addMember(sampleIndex, '新しいメンバー');

      expect(result.error).toBeUndefined();
      expect(result.memberId).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(result.index.members).toHaveLength(2);
      const newMember = result.index.members.find((m) => m.id === result.memberId);
      expect(newMember.name).toBe('新しいメンバー');
      expect(newMember.totalDurationSeconds).toBe(0);
      expect(newMember.instructorCount).toBe(0);
      expect(newMember.sessionRevisions).toEqual([]);
    });

    it('正常系: version がインクリメントされる', () => {
      const editor = new IndexEditor();
      const result = editor.addMember(sampleIndex, '新しいメンバー');

      expect(result.index.version).toBe(2);
      expect(result.index.updatedAt).not.toBe(sampleIndex.updatedAt);
    });

    it('正常系: 既存メンバーは変更されない', () => {
      const editor = new IndexEditor();
      const result = editor.addMember(sampleIndex, '新しいメンバー');

      expect(result.index.members[0].id).toBe('member1');
      expect(result.index.members[0].name).toBe('メンバー1');
      expect(result.index.members[0].totalDurationSeconds).toBe(3600);
    });

    it('正常系: 入力オブジェクトは変更されない（イミュータブル性）', () => {
      const editor = new IndexEditor();
      const before = JSON.parse(JSON.stringify(sampleIndex));
      editor.addMember(sampleIndex, '新しいメンバー');

      expect(sampleIndex).toEqual(before);
    });

    it('異常系: 空文字の場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.addMember(sampleIndex, '');

      expect(result.error).toBe('メンバー名を入力してください');
      expect(result.index).toBe(sampleIndex);
      expect(result.memberId).toBeNull();
    });

    it('異常系: 空白のみの場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.addMember(sampleIndex, '   ');

      expect(result.error).toBe('メンバー名を入力してください');
      expect(result.index).toBe(sampleIndex);
    });

    it('異常系: 256文字超過の場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const longName = 'あ'.repeat(257);
      const result = editor.addMember(sampleIndex, longName);

      expect(result.error).toBe('メンバー名は256文字以内で入力してください');
      expect(result.index).toBe(sampleIndex);
    });

    it('異常系: 文字列でない場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.addMember(sampleIndex, 123);

      expect(result.error).toBe('メンバー名は文字列である必要があります');
      expect(result.index).toBe(sampleIndex);
    });
  });

  // --- 主催者関連テスト ---

  const sampleIndexWithOrganizers = {
    schemaVersion: 2,
    version: 1,
    organizers: [
      { id: 'org1', name: '開発チーム' },
      { id: 'org2', name: '技術戦略部' },
    ],
    groups: [
      {
        id: 'group1',
        name: 'テストグループ1',
        organizerId: 'org1',
        totalDurationSeconds: 3600,
        sessionRevisions: ['session1/0'],
      },
      {
        id: 'group2',
        name: 'テストグループ2',
        organizerId: null,
        totalDurationSeconds: 1800,
        sessionRevisions: ['session2/0'],
      },
    ],
    members: [
      {
        id: 'member1',
        name: 'メンバー1',
        totalDurationSeconds: 3600,
        sessionRevisions: ['session1/0'],
      },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  describe('addOrganizer', () => {
    it('正常系: 新規主催者を追加し ULID を返す', () => {
      const editor = new IndexEditor();
      const result = editor.addOrganizer(sampleIndexWithOrganizers, '新しい組織');

      expect(result.error).toBeUndefined();
      expect(result.organizerId).toBeTruthy();
      expect(result.index.organizers).toHaveLength(3);
      expect(result.index.organizers[2].name).toBe('新しい組織');
      expect(result.index.organizers[2].id).toBe(result.organizerId);
      expect(result.index.version).toBe(2);
    });

    it('正常系: 入力オブジェクトは変更されない', () => {
      const editor = new IndexEditor();
      const original = JSON.parse(JSON.stringify(sampleIndexWithOrganizers));
      editor.addOrganizer(sampleIndexWithOrganizers, '新しい組織');

      expect(sampleIndexWithOrganizers).toEqual(original);
    });

    it('異常系: 空文字はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.addOrganizer(sampleIndexWithOrganizers, '');

      expect(result.error).toBe('主催者名を入力してください');
      expect(result.index).toBe(sampleIndexWithOrganizers);
    });

    it('異常系: 空白のみはエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.addOrganizer(sampleIndexWithOrganizers, '   ');

      expect(result.error).toBe('主催者名を入力してください');
    });

    it('異常系: 256文字超はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.addOrganizer(sampleIndexWithOrganizers, 'a'.repeat(257));

      expect(result.error).toBe('主催者名は256文字以内で入力してください');
    });

    it('異常系: 文字列でない場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.addOrganizer(sampleIndexWithOrganizers, 123);

      expect(result.error).toBe('主催者名は文字列である必要があります');
    });
  });

  describe('updateGroupOrganizer', () => {
    it('正常系: グループに主催者を設定する', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupOrganizer(sampleIndexWithOrganizers, 'group2', 'org2');

      expect(result.error).toBeUndefined();
      expect(result.index.groups.find((g) => g.id === 'group2').organizerId).toBe('org2');
      expect(result.index.version).toBe(2);
    });

    it('正常系: 主催者を解除（null を設定）する', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupOrganizer(sampleIndexWithOrganizers, 'group1', null);

      expect(result.error).toBeUndefined();
      expect(result.index.groups.find((g) => g.id === 'group1').organizerId).toBeNull();
    });

    it('正常系: 他のグループやメンバーに影響しない', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupOrganizer(sampleIndexWithOrganizers, 'group2', 'org1');

      expect(result.index.groups.find((g) => g.id === 'group1').organizerId).toBe('org1');
      expect(result.index.members).toHaveLength(1);
    });

    it('正常系: 入力オブジェクトは変更されない', () => {
      const editor = new IndexEditor();
      const original = JSON.parse(JSON.stringify(sampleIndexWithOrganizers));
      editor.updateGroupOrganizer(sampleIndexWithOrganizers, 'group2', 'org1');

      expect(sampleIndexWithOrganizers).toEqual(original);
    });

    it('正常系: organizers 配列もイミュータブルにコピーされる', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupOrganizer(sampleIndexWithOrganizers, 'group2', 'org1');

      expect(result.index.organizers).not.toBe(sampleIndexWithOrganizers.organizers);
      expect(result.index.organizers).toEqual(sampleIndexWithOrganizers.organizers);
    });

    it('異常系: 存在しないグループIDはエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupOrganizer(sampleIndexWithOrganizers, 'nonexistent', 'org1');

      expect(result.error).toBe('グループID nonexistent が見つかりません');
      expect(result.index).toBe(sampleIndexWithOrganizers);
    });

    it('異常系: 存在しない主催者IDはエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupOrganizer(sampleIndexWithOrganizers, 'group1', 'nonexistent');

      expect(result.error).toBe('主催者ID nonexistent が見つかりません');
    });

    it('異常系: グループIDが未指定はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupOrganizer(sampleIndexWithOrganizers, '', 'org1');

      expect(result.error).toBe('グループIDが指定されていません');
    });

    it('異常系: 主催者IDが文字列でもnullでもない場合はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupOrganizer(sampleIndexWithOrganizers, 'group1', 123);

      expect(result.error).toBe('主催者IDは文字列またはnullである必要があります');
    });
  });

  describe('removeOrganizer', () => {
    it('正常系: 主催者を削除し、参照グループの organizerId を null にリセットする', () => {
      const editor = new IndexEditor();
      const result = editor.removeOrganizer(sampleIndexWithOrganizers, 'org1');

      expect(result.error).toBeUndefined();
      expect(result.index.organizers).toHaveLength(1);
      expect(result.index.organizers[0].id).toBe('org2');
      expect(result.index.groups.find((g) => g.id === 'group1').organizerId).toBeNull();
      expect(result.index.version).toBe(2);
    });

    it('正常系: 参照されていない主催者も正常に削除できる', () => {
      const editor = new IndexEditor();
      const result = editor.removeOrganizer(sampleIndexWithOrganizers, 'org2');

      expect(result.error).toBeUndefined();
      expect(result.index.organizers).toHaveLength(1);
      expect(result.index.groups.find((g) => g.id === 'group1').organizerId).toBe('org1');
    });

    it('正常系: 入力オブジェクトは変更されない', () => {
      const editor = new IndexEditor();
      const original = JSON.parse(JSON.stringify(sampleIndexWithOrganizers));
      editor.removeOrganizer(sampleIndexWithOrganizers, 'org1');

      expect(sampleIndexWithOrganizers).toEqual(original);
    });

    it('異常系: 存在しない主催者IDはエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.removeOrganizer(sampleIndexWithOrganizers, 'nonexistent');

      expect(result.error).toBe('主催者ID nonexistent が見つかりません');
    });

    it('異常系: 主催者IDが未指定はエラーを返す', () => {
      const editor = new IndexEditor();
      const result = editor.removeOrganizer(sampleIndexWithOrganizers, '');

      expect(result.error).toBe('主催者IDが指定されていません');
    });
  });

  describe('既存メソッドの organizers 保持', () => {
    it('updateGroupName: organizers がイミュータブルにコピーされる', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndexWithOrganizers, 'group1', '新名前');

      expect(result.index.organizers).toEqual(sampleIndexWithOrganizers.organizers);
      expect(result.index.organizers).not.toBe(sampleIndexWithOrganizers.organizers);
    });

    it('mergeGroups: organizers がイミュータブルにコピーされ、統合先 organizerId が保持される', () => {
      const editor = new IndexEditor();
      const result = editor.mergeGroups(sampleIndexWithOrganizers, 'group1', ['group1', 'group2']);

      expect(result.index.organizers).toEqual(sampleIndexWithOrganizers.organizers);
      expect(result.index.organizers).not.toBe(sampleIndexWithOrganizers.organizers);
      expect(result.index.groups).toHaveLength(1);
      expect(result.index.groups[0].organizerId).toBe('org1');
    });

    it('removeSessionFromGroup: organizers がイミュータブルにコピーされる', () => {
      const editor = new IndexEditor();
      const sessionData = {
        attendances: [{ memberId: 'member1', durationSeconds: 1800 }],
        instructors: [],
      };
      const result = editor.removeSessionFromGroup(
        sampleIndexWithOrganizers,
        'group1',
        'session1/0',
        sessionData
      );

      expect(result.index.organizers).toEqual(sampleIndexWithOrganizers.organizers);
      expect(result.index.organizers).not.toBe(sampleIndexWithOrganizers.organizers);
    });

    it('addMember: organizers がイミュータブルにコピーされる', () => {
      const editor = new IndexEditor();
      const result = editor.addMember(sampleIndexWithOrganizers, '新メンバー');

      expect(result.index.organizers).toEqual(sampleIndexWithOrganizers.organizers);
      expect(result.index.organizers).not.toBe(sampleIndexWithOrganizers.organizers);
    });
  });
});
