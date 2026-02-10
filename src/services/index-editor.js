// IndexEditor — DashboardIndexの編集ロジック
export class IndexEditor {
  /**
   * グループ名を更新する
   * @param {object} currentIndex - 現在のDashboardIndex
   * @param {string} groupId - 対象グループのID
   * @param {string} newName - 新しいグループ名
   * @returns {{ index: object, error?: string }}
   */
  updateGroupName(currentIndex, groupId, newName) {
    // バリデーション
    const validationError = this.validateGroupName(newName);
    if (validationError) {
      return { index: currentIndex, error: validationError };
    }

    // グループを検索
    const groups = currentIndex.groups.map((g) => ({ ...g, sessionIds: [...g.sessionIds] }));
    const targetGroup = groups.find((g) => g.id === groupId);

    if (!targetGroup) {
      return { index: currentIndex, error: `グループID ${groupId} が見つかりません` };
    }

    // グループ名を更新
    targetGroup.name = newName;

    return {
      index: {
        groups,
        members: currentIndex.members.map((m) => ({ ...m, sessionIds: [...m.sessionIds] })),
        updatedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * グループ名をバリデーションする
   * @param {string} name - 検証するグループ名
   * @returns {string|null} エラーメッセージ、または null（バリデーション成功）
   */
  validateGroupName(name) {
    if (typeof name !== 'string') {
      return 'グループ名は文字列である必要があります';
    }

    if (name.length === 0 || name.trim().length === 0) {
      return 'グループ名を入力してください';
    }

    if (name.length > 256) {
      return 'グループ名は256文字以内で入力してください';
    }

    return null;
  }
}
