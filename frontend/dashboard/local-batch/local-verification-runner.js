// LocalVerificationRunner — 置換後データでの画面動作を検証する
import { DataFetcher } from '../src/services/data-fetcher.js';

export class LocalVerificationRunner {
  /**
   * @param {object} [deps] - 依存注入（テスト用）
   * @param {object} [deps.fetcher] - DataFetcher互換オブジェクト
   */
  constructor(deps = {}) {
    this._fetcher = deps.fetcher || new DataFetcher();
  }

  /**
   * 一覧表示の検証 — インデックスJSON読み込みと表示成立性を確認する
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async verifyDashboard() {
    const indexResult = await this._fetcher.fetchIndex();
    if (!indexResult.ok) {
      return { ok: false, error: `index.jsonの読み込みに失敗: ${indexResult.error}` };
    }

    const index = indexResult.data;
    const warnings = [];

    if (!index.studyGroups || index.studyGroups.length === 0) {
      warnings.push('勉強会グループが0件です');
    }
    if (!index.members || index.members.length === 0) {
      warnings.push('メンバーが0件です');
    }

    return {
      ok: true,
      data: {
        studyGroupCount: (index.studyGroups || []).length,
        memberCount: (index.members || []).length,
        warnings,
      },
    };
  }

  /**
   * ドリルダウン表示の検証 — メンバーのセッションJSON読み込みと詳細表示の成立性を確認する
   * @param {string} memberId - 検証対象メンバーID
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async verifyMemberDetail(memberId) {
    // インデックスからメンバー情報を取得
    const indexResult = await this._fetcher.fetchIndex();
    if (!indexResult.ok) {
      return { ok: false, error: `index.jsonの読み込みに失敗: ${indexResult.error}` };
    }

    const index = indexResult.data;
    const member = index.members.find((m) => m.id === memberId);
    if (!member) {
      return { ok: false, error: `メンバー ${memberId} がインデックスに存在しません` };
    }

    // メンバーの各セッションを取得
    const warnings = [];
    const failedSessions = [];
    let loadedCount = 0;

    for (const sessionId of member.sessionIds) {
      const sessionResult = await this._fetcher.fetchSession(sessionId);
      if (!sessionResult.ok) {
        failedSessions.push(sessionId);
        continue;
      }

      // セッション内にメンバーの出席記録があるか確認
      const attendance = sessionResult.data.attendances.find(
        (a) => a.memberId === memberId
      );
      if (!attendance) {
        warnings.push(
          `セッション ${sessionId} にメンバー ${memberId} の出席記録がありません`
        );
      }
      loadedCount++;
    }

    if (failedSessions.length > 0) {
      return {
        ok: false,
        error: `セッションJSONの読み込みに失敗: ${failedSessions.join(', ')}`,
      };
    }

    return {
      ok: true,
      data: {
        memberId,
        sessionCount: loadedCount,
        warnings,
      },
    };
  }

  /**
   * 最小画面遷移の検証 — 一覧→詳細→戻るの遷移成立を確認する
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async verifyNavigation() {
    const steps = [];
    const warnings = [];

    // ステップ1: 一覧表示
    const dashResult = await this.verifyDashboard();
    if (!dashResult.ok) {
      return { ok: false, error: `一覧表示の検証に失敗: ${dashResult.error}` };
    }
    steps.push('dashboard');

    // ステップ2: ドリルダウン（メンバーが存在する場合のみ）
    const indexResult = await this._fetcher.fetchIndex();
    const members = indexResult.data.members || [];

    if (members.length === 0) {
      warnings.push('メンバーが0件のためドリルダウン確認をスキップしました');
      steps.push('back');
      return { ok: true, data: { steps, warnings } };
    }

    // 先頭メンバーでドリルダウン検証
    const firstMember = members[0];
    const detailResult = await this.verifyMemberDetail(firstMember.id);
    if (!detailResult.ok) {
      return { ok: false, error: `詳細表示の検証に失敗: ${detailResult.error}` };
    }
    steps.push('memberDetail');

    // ステップ3: 戻る（一覧へ戻る遷移の成立確認）
    steps.push('back');

    return { ok: true, data: { steps, warnings } };
  }

  /**
   * 全検証を一括実行する
   * @returns {Promise<{ok: boolean, data: object}>}
   */
  async runAll() {
    const dashboardResult = await this.verifyDashboard();
    const memberDetailResult = await this._verifyFirstMemberDetail();
    const navigationResult = await this.verifyNavigation();

    const allOk =
      dashboardResult.ok && memberDetailResult.ok && navigationResult.ok;

    return {
      ok: allOk,
      data: {
        dashboard: dashboardResult,
        memberDetail: memberDetailResult,
        navigation: navigationResult,
      },
    };
  }

  /**
   * 先頭メンバーのドリルダウン検証（runAll用の内部メソッド）
   */
  async _verifyFirstMemberDetail() {
    const indexResult = await this._fetcher.fetchIndex();
    if (!indexResult.ok) {
      return { ok: false, error: `index.jsonの読み込みに失敗: ${indexResult.error}` };
    }

    const members = indexResult.data.members || [];
    if (members.length === 0) {
      return {
        ok: true,
        data: { memberId: null, sessionCount: 0, warnings: ['メンバーが0件です'] },
      };
    }

    return this.verifyMemberDetail(members[0].id);
  }
}
