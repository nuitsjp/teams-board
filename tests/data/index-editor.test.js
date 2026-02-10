import { describe, it, expect } from 'vitest';
import { IndexEditor } from '../../src/services/index-editor.js';

describe('IndexEditor', () => {
  const sampleIndex = {
    groups: [
      {
        id: 'group1',
        name: '旧グループ名',
        totalDurationSeconds: 3600,
        sessionIds: ['session1', 'session2'],
      },
      {
        id: 'group2',
        name: '別のグループ',
        totalDurationSeconds: 1800,
        sessionIds: ['session3'],
      },
    ],
    members: [
      {
        id: 'member1',
        name: 'メンバー1',
        totalDurationSeconds: 3600,
        sessionIds: ['session1'],
      },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  describe('updateGroupName', () => {
    it('正常系: グループ名を更新し、updatedAtを現在時刻に設定する', () => {
      const editor = new IndexEditor();
      const result = editor.updateGroupName(sampleIndex, 'group1', '新しいグループ名');

      expect(result.error).toBeUndefined();
      expect(result.index.groups).toHaveLength(2);
      expect(result.index.groups[0].id).toBe('group1');
      expect(result.index.groups[0].name).toBe('新しいグループ名');
      expect(result.index.groups[0].totalDurationSeconds).toBe(3600);
      expect(result.index.groups[0].sessionIds).toEqual(['session1', 'session2']);
      expect(result.index.groups[1].name).toBe('別のグループ');
      expect(result.index.updatedAt).not.toBe('2026-01-01T00:00:00.000Z');
      expect(new Date(result.index.updatedAt).getTime()).toBeGreaterThan(
        new Date('2026-01-01T00:00:00.000Z').getTime()
      );
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
});
