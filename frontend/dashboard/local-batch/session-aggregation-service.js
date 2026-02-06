// SessionAggregationService — 複数CSV変換結果をセッション集約する
import { IndexMerger } from '../src/services/index-merger.js';

export class SessionAggregationService {
  /**
   * @param {object} [deps] - 依存注入（テスト用）
   * @param {object} [deps.indexMerger] - IndexMerger互換オブジェクト（mergeメソッド）
   */
  constructor(deps = {}) {
    this._merger = deps.indexMerger || new IndexMerger();
  }

  /**
   * 複数の変換結果からDashboardIndexとSessionRecord一覧を構築する
   * @param {Array<{sessionRecord: object, mergeInput: object}>} parsedSessions - 変換結果の配列
   * @returns {{index: object, sessions: object[], warnings: string[]}}
   */
  aggregate(parsedSessions) {
    let currentIndex = {
      studyGroups: [],
      members: [],
      updatedAt: '',
    };
    const sessions = [];
    const warnings = [];

    for (const { sessionRecord, mergeInput } of parsedSessions) {
      const result = this._merger.merge(currentIndex, mergeInput);

      // IndexMergerが重複警告を返した場合、セッションを除外
      if (result.warnings.length > 0) {
        warnings.push(...result.warnings);
      } else {
        sessions.push(sessionRecord);
      }

      currentIndex = result.index;
    }

    return { index: currentIndex, sessions, warnings };
  }
}
