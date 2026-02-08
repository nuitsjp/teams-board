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
    const allSessionIds = new Set([
      ...currentIndex.groups.flatMap((g) => g.sessionIds),
    ]);
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
      (sum, a) => sum + a.durationSeconds, 0
    );
    const groups = currentIndex.groups.map((g) => ({
      ...g,
      sessionIds: [...g.sessionIds],
    }));
    const existingGroup = groups.find((g) => g.id === newSession.groupId);
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
    const members = currentIndex.members.map((m) => ({
      ...m,
      sessionIds: [...m.sessionIds],
    }));
    for (const attendance of newSession.attendances) {
      const existingMember = members.find((m) => m.id === attendance.memberId);
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
