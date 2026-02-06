// DashboardView — トップ画面（勉強会グループ一覧 + 参加者一覧）
export class DashboardView {
  #container;
  #fetcher;
  #router;

  constructor(container, fetcher, router) {
    this.#container = container;
    this.#fetcher = fetcher;
    this.#router = router;
  }

  /**
   * トップ画面をレンダリングする
   */
  async render() {
    // ローディング表示
    this.#container.innerHTML = '<div class="loading">読み込み中...</div>';

    const result = await this.#fetcher.fetchIndex();

    if (!result.ok) {
      this.#container.innerHTML = `<div class="error">データ取得エラー: ${result.error}</div>`;
      return;
    }

    const { studyGroups, members } = result.data;

    const wrapper = document.createElement('div');

    // 勉強会グループ一覧セクション
    const groupSection = document.createElement('section');
    groupSection.className = 'study-groups-section';
    const groupHeading = document.createElement('h2');
    groupHeading.textContent = '勉強会グループ';
    groupSection.appendChild(groupHeading);

    for (const group of studyGroups) {
      const card = document.createElement('div');
      card.className = 'study-group-card';

      const name = document.createElement('h3');
      name.textContent = group.name;

      const info = document.createElement('div');
      info.className = 'study-group-info';
      info.textContent = `${group.sessionIds.length}回 / ${formatDuration(group.totalDurationSeconds)}`;

      card.appendChild(name);
      card.appendChild(info);
      groupSection.appendChild(card);
    }

    wrapper.appendChild(groupSection);

    // 参加者一覧セクション（合計時間の降順）
    const memberSection = document.createElement('section');
    memberSection.className = 'members-section';
    const memberHeading = document.createElement('h2');
    memberHeading.textContent = '参加者';
    memberSection.appendChild(memberHeading);

    const sortedMembers = [...members].sort(
      (a, b) => b.totalDurationSeconds - a.totalDurationSeconds
    );

    for (const member of sortedMembers) {
      const card = document.createElement('div');
      card.className = 'member-card';
      card.dataset.memberId = member.id;

      const name = document.createElement('h3');
      name.textContent = member.name;

      const info = document.createElement('div');
      info.className = 'member-info';
      info.textContent = `${formatDuration(member.totalDurationSeconds)} / ${member.sessionIds.length}回`;

      card.appendChild(name);
      card.appendChild(info);

      card.addEventListener('click', () => {
        this.#router.navigate({ view: 'memberDetail', memberId: member.id });
      });

      memberSection.appendChild(card);
    }

    wrapper.appendChild(memberSection);

    this.#container.innerHTML = '';
    this.#container.appendChild(wrapper);
  }
}

/**
 * 秒数を「X時間Y分」形式にフォーマットする
 * @param {number} seconds
 * @returns {string}
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}時間${minutes}分`;
  }
  return `${minutes}分`;
}
