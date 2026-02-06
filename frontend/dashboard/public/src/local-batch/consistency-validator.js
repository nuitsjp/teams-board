// ConsistencyValidator — 集計値と明細値の整合性検証
export class ConsistencyValidator {
  /**
   * インデックスとセッション群の参照整合・合計整合を検証する
   * @param {object} index - DashboardIndex
   * @param {object[]} sessions - SessionRecord[]
   * @returns {Array<{filePath: string, issueType: string, message: string}>}
   */
  validate(index, sessions) {
    const issues = [];
    const sessionMap = new Map(sessions.map((s) => [s.id, s]));

    // StudyGroup の sessionIds 参照検証と合計時間検証
    for (const group of index.studyGroups) {
      let computedTotal = 0;

      for (const sid of group.sessionIds) {
        const session = sessionMap.get(sid);
        if (!session) {
          issues.push({
            filePath: 'index.json',
            issueType: 'missing-session',
            message: `studyGroup ${group.id} が参照するセッション ${sid} が存在しません`,
          });
        } else {
          // このグループに属するセッションの全出席者時間を合算
          const sessionTotal = session.attendances.reduce(
            (sum, a) => sum + a.durationSeconds, 0
          );
          computedTotal += sessionTotal;
        }
      }

      if (computedTotal !== group.totalDurationSeconds) {
        issues.push({
          filePath: 'index.json',
          issueType: 'duration-mismatch',
          message: `studyGroup ${group.id} の totalDurationSeconds (${group.totalDurationSeconds}) が明細合計 (${computedTotal}) と一致しません`,
        });
      }
    }

    // Member の sessionIds 参照検証・出席記録整合・合計時間検証
    for (const member of index.members) {
      let computedTotal = 0;

      for (const sid of member.sessionIds) {
        const session = sessionMap.get(sid);
        if (!session) {
          issues.push({
            filePath: 'index.json',
            issueType: 'missing-session',
            message: `member ${member.id} が参照するセッション ${sid} が存在しません`,
          });
          continue;
        }

        // メンバーの出席記録がセッションに存在するか検証
        const attendance = session.attendances.find((a) => a.memberId === member.id);
        if (!attendance) {
          issues.push({
            filePath: `sessions/${sid}.json`,
            issueType: 'missing-member-attendance',
            message: `セッション ${sid} にメンバー ${member.id} の出席記録がありません`,
          });
        } else {
          computedTotal += attendance.durationSeconds;
        }
      }

      if (computedTotal !== member.totalDurationSeconds) {
        issues.push({
          filePath: 'index.json',
          issueType: 'duration-mismatch',
          message: `member ${member.id} の totalDurationSeconds (${member.totalDurationSeconds}) が明細合計 (${computedTotal}) と一致しません`,
        });
      }
    }

    return issues;
  }
}
