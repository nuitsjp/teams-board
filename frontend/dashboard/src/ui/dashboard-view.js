// DashboardView — ダッシュボード一覧表示
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
   * ダッシュボード一覧をレンダリングする
   */
  async render() {
    // ローディング表示
    this.#container.innerHTML = '<div class="loading">読み込み中...</div>';

    const result = await this.#fetcher.fetchIndex();

    if (!result.ok) {
      this.#container.innerHTML = `<div class="error">データ取得エラー: ${result.error}</div>`;
      return;
    }

    const { items } = result.data;
    const list = document.createElement('ul');
    list.className = 'item-list';

    for (const item of items) {
      const card = document.createElement('li');
      card.className = 'item-card';
      card.dataset.itemId = item.id;

      const title = document.createElement('h2');
      title.textContent = item.title;

      const summary = document.createElement('div');
      summary.className = 'item-summary';
      summary.textContent = Object.entries(item.summary)
        .map(([k, v]) => `${k}: ${v}`)
        .join(' / ');

      card.appendChild(title);
      card.appendChild(summary);

      card.addEventListener('click', () => {
        this.#router.navigate({ view: 'detail', itemId: item.id });
      });

      list.appendChild(card);
    }

    this.#container.innerHTML = '';
    this.#container.appendChild(list);
  }
}
