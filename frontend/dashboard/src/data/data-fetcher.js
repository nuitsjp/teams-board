// DataFetcher — 静的サイトからのJSONデータ取得
export class DataFetcher {
  /**
   * index.jsonを取得する（キャッシュバスター付き）
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async fetchIndex() {
    const url = `data/index.json?v=${Date.now()}`;
    return this.#fetchJson(url);
  }

  /**
   * アイテム詳細JSONを取得する（キャッシュバスターなし、不変リソース）
   * @param {string} itemId
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async fetchItem(itemId) {
    const url = `data/items/${itemId}.json`;
    return this.#fetchJson(url);
  }

  /**
   * @param {string} url
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async #fetchJson(url) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { ok: false, error: `HTTP ${response.status} ${response.statusText}` };
      }
      const data = await response.json();
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}
