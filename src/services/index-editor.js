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
    const groupMap = new Map();
    const groups = currentIndex.groups.map((g) => {
      const copy = { ...g, sessionIds: [...g.sessionIds] };
      groupMap.set(copy.id, copy);
      return copy;
    });
    const targetGroup = groupMap.get(groupId);

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
   * 複数グループを1つに統合する
   * @param {object} currentIndex - 現在のDashboardIndex
   * @param {string} targetGroupId - 統合先グループID
   * @param {string[]} selectedGroupIds - 選択されたグループID一覧（統合先を含む）
   * @returns {{ index: object, error?: string }}
   */
  mergeGroups(currentIndex, targetGroupId, selectedGroupIds) {
    const validationError = this.validateMergeGroupsInput(targetGroupId, selectedGroupIds);
    if (validationError) {
      return { index: currentIndex, error: validationError };
    }

    const groupMap = new Map();
    const groups = currentIndex.groups.map((g) => {
      const copy = { ...g, sessionIds: [...g.sessionIds] };
      groupMap.set(copy.id, copy);
      return copy;
    });

    for (const groupId of selectedGroupIds) {
      if (!groupMap.has(groupId)) {
        return { index: currentIndex, error: `グループID ${groupId} が見つかりません` };
      }
    }

    const targetGroup = groupMap.get(targetGroupId);
    const sourceGroups = selectedGroupIds
      .filter((groupId) => groupId !== targetGroupId)
      .map((groupId) => groupMap.get(groupId));

    const orderedGroups = [targetGroup, ...sourceGroups];
    const allSessionIds = orderedGroups.flatMap((group) => group.sessionIds);
    const mergedSessionIds = [...new Set(allSessionIds)];

    const sessionDurationMap = new Map();
    for (const group of orderedGroups) {
      const groupSessionCount = group.sessionIds.length;
      if (groupSessionCount === 0) {
        continue;
      }
      const durationPerSession = group.totalDurationSeconds / groupSessionCount;
      for (const sessionId of group.sessionIds) {
        if (!sessionDurationMap.has(sessionId)) {
          sessionDurationMap.set(sessionId, durationPerSession);
        }
      }
    }

    const mergedDuration = mergedSessionIds.reduce(
      (sum, sessionId) => sum + (sessionDurationMap.get(sessionId) ?? 0),
      0
    );
    targetGroup.sessionIds = mergedSessionIds;
    targetGroup.totalDurationSeconds = Math.round(mergedDuration);

    const sourceGroupIdSet = new Set(sourceGroups.map((group) => group.id));
    const filteredGroups = groups.filter((group) => !sourceGroupIdSet.has(group.id));

    return {
      index: {
        groups: filteredGroups,
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

  /**
   * グループ統合入力をバリデーションする
   * @param {string} targetGroupId - 統合先グループID
   * @param {string[]} selectedGroupIds - 選択されたグループID一覧
   * @returns {string|null}
   */
  validateMergeGroupsInput(targetGroupId, selectedGroupIds) {
    if (!Array.isArray(selectedGroupIds)) {
      return '選択グループIDは配列である必要があります';
    }

    if (selectedGroupIds.length < 2) {
      return 'グループ統合には2つ以上のグループ選択が必要です';
    }

    if (!selectedGroupIds.includes(targetGroupId)) {
      return '統合先グループは選択されたグループに含まれている必要があります';
    }

    return null;
  }
}
