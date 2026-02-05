// DetailView — ドリルダウン詳細表示
export class DetailView {
  #container;
  #fetcher;
  #router;

  constructor(container, fetcher, router) {
    this.#container = container;
    this.#fetcher = fetcher;
    this.#router = router;
  }

  /**
   * 指定IDのアイテム詳細を表示する
   * @param {string} itemId
   */
  async render(itemId) {
    this.#container.innerHTML = '<div class="loading">読み込み中...</div>';

    const result = await this.#fetcher.fetchItem(itemId);

    if (!result.ok) {
      this.#container.innerHTML = '';
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = `詳細データ取得エラー: ${result.error}`;

      const backLink = document.createElement('a');
      backLink.className = 'back-link';
      backLink.textContent = '一覧へ戻る';
      backLink.addEventListener('click', () => {
        this.#router.navigate({ view: 'dashboard' });
      });

      this.#container.appendChild(error);
      this.#container.appendChild(backLink);
      return;
    }

    const { title, data } = result.data;
    const detail = document.createElement('div');
    detail.className = 'detail-view';

    const backLink = document.createElement('a');
    backLink.className = 'back-link';
    backLink.textContent = '← 一覧へ戻る';
    backLink.addEventListener('click', () => {
      this.#router.navigate({ view: 'dashboard' });
    });

    const heading = document.createElement('h2');
    heading.textContent = title;

    const dataTable = document.createElement('table');
    dataTable.className = 'preview-table';
    for (const [key, value] of Object.entries(data)) {
      const row = document.createElement('tr');
      const th = document.createElement('th');
      th.textContent = key;
      const td = document.createElement('td');
      td.textContent = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      row.appendChild(th);
      row.appendChild(td);
      dataTable.appendChild(row);
    }

    detail.appendChild(backLink);
    detail.appendChild(heading);
    detail.appendChild(dataTable);

    this.#container.innerHTML = '';
    this.#container.appendChild(detail);
  }
}
