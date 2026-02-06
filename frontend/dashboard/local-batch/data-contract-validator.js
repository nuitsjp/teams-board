// DataContractValidator — 出力JSONの契約検証
export class DataContractValidator {
  /**
   * インデックスJSONの必須キーと型を検証する
   * @param {object} index - DashboardIndex
   * @returns {Array<{filePath: string, fieldPath: string, message: string, severity: 'error'|'warning'}>}
   */
  validateIndex(index) {
    const filePath = 'index.json';
    const issues = [];

    if (index == null || typeof index !== 'object') {
      issues.push({ filePath, fieldPath: '', message: 'インデックスデータがnullまたはオブジェクトではありません', severity: 'error' });
      return issues;
    }

    // トップレベル必須キー検証
    if (!Array.isArray(index.studyGroups)) {
      issues.push({
        filePath, fieldPath: 'studyGroups',
        message: index.studyGroups === undefined
          ? '必須キー studyGroups が欠落しています'
          : 'studyGroups は配列である必要があります',
        severity: 'error',
      });
    }

    if (!Array.isArray(index.members)) {
      issues.push({
        filePath, fieldPath: 'members',
        message: index.members === undefined
          ? '必須キー members が欠落しています'
          : 'members は配列である必要があります',
        severity: 'error',
      });
    }

    if (typeof index.updatedAt !== 'string') {
      issues.push({
        filePath, fieldPath: 'updatedAt',
        message: index.updatedAt === undefined
          ? '必須キー updatedAt が欠落しています'
          : 'updatedAt は文字列である必要があります',
        severity: 'error',
      });
    }

    // StudyGroupSummary要素の検証
    if (Array.isArray(index.studyGroups)) {
      index.studyGroups.forEach((group, i) => {
        this._validateSummaryElement(issues, filePath, `studyGroups[${i}]`, group);
      });
    }

    // MemberSummary要素の検証
    if (Array.isArray(index.members)) {
      index.members.forEach((member, i) => {
        this._validateSummaryElement(issues, filePath, `members[${i}]`, member);
      });
    }

    return issues;
  }

  /**
   * セッションJSONの必須キーと型を検証する
   * @param {string} sessionPath - セッションファイルパス
   * @param {object} session - SessionRecord
   * @returns {Array<{filePath: string, fieldPath: string, message: string, severity: 'error'|'warning'}>}
   */
  validateSession(sessionPath, session) {
    const issues = [];

    if (session == null || typeof session !== 'object') {
      issues.push({ filePath: sessionPath, fieldPath: '', message: 'セッションデータがnullまたはオブジェクトではありません', severity: 'error' });
      return issues;
    }

    // 必須文字列キー
    for (const key of ['id', 'studyGroupId', 'date']) {
      if (typeof session[key] !== 'string') {
        issues.push({
          filePath: sessionPath, fieldPath: key,
          message: session[key] === undefined
            ? `必須キー ${key} が欠落しています`
            : `${key} は文字列である必要があります`,
          severity: 'error',
        });
      }
    }

    // attendances検証
    if (!Array.isArray(session.attendances)) {
      issues.push({
        filePath: sessionPath, fieldPath: 'attendances',
        message: session.attendances === undefined
          ? '必須キー attendances が欠落しています'
          : 'attendances は配列である必要があります',
        severity: 'error',
      });
    } else {
      session.attendances.forEach((att, i) => {
        if (typeof att.memberId !== 'string') {
          issues.push({
            filePath: sessionPath,
            fieldPath: `attendances[${i}].memberId`,
            message: att.memberId === undefined
              ? '必須キー memberId が欠落しています'
              : 'memberId は文字列である必要があります',
            severity: 'error',
          });
        }
        if (typeof att.durationSeconds !== 'number') {
          issues.push({
            filePath: sessionPath,
            fieldPath: `attendances[${i}].durationSeconds`,
            message: att.durationSeconds === undefined
              ? '必須キー durationSeconds が欠落しています'
              : 'durationSeconds は数値である必要があります',
            severity: 'error',
          });
        }
      });
    }

    return issues;
  }

  /**
   * StudyGroupSummary / MemberSummary の共通フィールドを検証する
   * @private
   */
  _validateSummaryElement(issues, filePath, prefix, element) {
    if (typeof element.id !== 'string') {
      issues.push({
        filePath, fieldPath: `${prefix}.id`,
        message: `${prefix}.id は文字列である必要があります`,
        severity: 'error',
      });
    }
    if (typeof element.name !== 'string') {
      issues.push({
        filePath, fieldPath: `${prefix}.name`,
        message: `${prefix}.name は文字列である必要があります`,
        severity: 'error',
      });
    }
    if (typeof element.totalDurationSeconds !== 'number') {
      issues.push({
        filePath, fieldPath: `${prefix}.totalDurationSeconds`,
        message: `${prefix}.totalDurationSeconds は数値である必要があります`,
        severity: 'error',
      });
    }
    if (!Array.isArray(element.sessionIds)) {
      issues.push({
        filePath, fieldPath: `${prefix}.sessionIds`,
        message: `${prefix}.sessionIds は配列である必要があります`,
        severity: 'error',
      });
    }
  }
}
