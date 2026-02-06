// MemberDetailView — 個人ドリルダウン詳細表示
import { formatDuration } from './dashboard-view.js';

export class MemberDetailView {
  #container;
  #fetcher;
  #router;

  constructor(container, fetcher, router) {
    this.#container = container;
    this.#fetcher = fetcher;
    this.#router = router;
  }

  /**
   * 指定メンバーの出席詳細を表示する
   * @param {string} memberId
   */
  async render(memberId) {
    this.#container.innerHTML = '<div class="loading">読み込み中...</div>';

    // DashboardIndex から該当メンバーのsessionIdsを取得
    const indexResult = await this.#fetcher.fetchIndex();
    if (!indexResult.ok) {
      this.#renderError(`データ取得エラー: ${indexResult.error}`);
      return;
    }

    const { studyGroups, members } = indexResult.data;
    const member = members.find((m) => m.id === memberId);
    if (!member) {
      this.#renderError('参加者が見つかりません');
      return;
    }

    // 勉強会名のルックアップマップを作成
    const groupNameMap = new Map(studyGroups.map((g) => [g.id, g.name]));

    // sessionIdsに対応するSessionRecordを並列取得
    const sessionResults = await Promise.all(
      member.sessionIds.map((sid) => this.#fetcher.fetchSession(sid))
    );

    // エラーチェック
    const failedSessions = sessionResults.filter((r) => !r.ok);
    if (failedSessions.length === sessionResults.length) {
      this.#renderError('セッションデータの取得に失敗しました');
      return;
    }

    // 該当メンバーの出席記録を抽出して開催日降順でソート
    const attendanceList = [];
    for (const result of sessionResults) {
      if (!result.ok) continue;
      const session = result.data;
      const attendance = session.attendances.find((a) => a.memberId === memberId);
      if (attendance) {
        attendanceList.push({
          studyGroupName: groupNameMap.get(session.studyGroupId) || '不明',
          date: session.date,
          durationSeconds: attendance.durationSeconds,
        });
      }
    }

    attendanceList.sort((a, b) => b.date.localeCompare(a.date));

    // 描画
    const wrapper = document.createElement('div');
    wrapper.className = 'member-detail-view';

    // 戻るリンク
    const backLink = document.createElement('a');
    backLink.className = 'back-link';
    backLink.textContent = '← 一覧へ戻る';
    backLink.addEventListener('click', () => {
      this.#router.navigate({ view: 'dashboard' });
    });
    wrapper.appendChild(backLink);

    // メンバー名
    const heading = document.createElement('h2');
    heading.textContent = member.name;
    wrapper.appendChild(heading);

    // サマリ
    const summary = document.createElement('div');
    summary.className = 'member-summary';
    summary.textContent = `合計: ${formatDuration(member.totalDurationSeconds)} / ${member.sessionIds.length}回`;
    wrapper.appendChild(summary);

    // 出席一覧
    const list = document.createElement('ul');
    list.className = 'attendance-list';
    for (const item of attendanceList) {
      const li = document.createElement('li');
      li.className = 'attendance-item';
      li.textContent = `${item.date} — ${item.studyGroupName} — ${formatDuration(item.durationSeconds)}`;
      list.appendChild(li);
    }
    wrapper.appendChild(list);

    this.#container.innerHTML = '';
    this.#container.appendChild(wrapper);
  }

  /**
   * エラー表示とトップへの戻り手段を描画する
   * @param {string} message
   */
  #renderError(message) {
    this.#container.innerHTML = '';

    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = message;

    const backLink = document.createElement('a');
    backLink.className = 'back-link';
    backLink.textContent = '← 一覧へ戻る';
    backLink.addEventListener('click', () => {
      this.#router.navigate({ view: 'dashboard' });
    });

    this.#container.appendChild(error);
    this.#container.appendChild(backLink);
  }
}
