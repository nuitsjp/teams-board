// IndexMerger — DashboardIndexのマージロジック（ドメインモデル対応）
export class IndexMerger {
  /**
   * 新セッション追加に伴いDashboardIndexのGroupSummaryとMemberSummaryを更新する
   * @param {object} currentIndex - 現在のDashboardIndex
   * @param {object} newSession - 追加するセッション情報（MergeInput）
   * @returns {{ index: object, warnings: string[] }}
   */
  merge(currentIndex, newSession) {
    const warnings = [];

    // 重複セッションID検出
    const allSessionIds = new Set([...currentIndex.groups.flatMap((g) => g.sessionIds)]);
    if (allSessionIds.has(newSession.sessionId)) {
      warnings.push(`重複セッションID検出: ${newSession.sessionId} は既に存在します`);
      return {
        index: {
          groups: currentIndex.groups.map((g) => ({ ...g, sessionIds: [...g.sessionIds] })),
          members: currentIndex.members.map((m) => ({ ...m, sessionIds: [...m.sessionIds] })),
          updatedAt: new Date().toISOString(),
        },
        warnings,
      };
    }

    // GroupSummary の更新
    const sessionTotalDuration = newSession.attendances.reduce(
      (sum, a) => sum + a.durationSeconds,
      0
    );
    const groupMap = new Map();
    const groups = currentIndex.groups.map((g) => {
      const copy = { ...g, sessionIds: [...g.sessionIds] };
      groupMap.set(copy.id, copy);
      return copy;
    });
    const existingGroup = groupMap.get(newSession.groupId);
    if (existingGroup) {
      existingGroup.totalDurationSeconds += sessionTotalDuration;
      existingGroup.sessionIds.push(newSession.sessionId);
    } else {
      groups.push({
        id: newSession.groupId,
        name: newSession.groupName,
        totalDurationSeconds: sessionTotalDuration,
        sessionIds: [newSession.sessionId],
      });
    }

    // MemberSummary の更新
    const memberMap = new Map();
    const members = currentIndex.members.map((m) => {
      const copy = { ...m, sessionIds: [...m.sessionIds] };
      memberMap.set(copy.id, copy);
      return copy;
    });
    for (const attendance of newSession.attendances) {
      const existingMember = memberMap.get(attendance.memberId);
      if (existingMember) {
        existingMember.totalDurationSeconds += attendance.durationSeconds;
        existingMember.sessionIds.push(newSession.sessionId);
      } else {
        members.push({
          id: attendance.memberId,
          name: attendance.memberName,
          totalDurationSeconds: attendance.durationSeconds,
          sessionIds: [newSession.sessionId],
        });
      }
    }

    return {
      index: {
        groups,
        members,
        updatedAt: new Date().toISOString(),
      },
      warnings,
    };
  }
}
