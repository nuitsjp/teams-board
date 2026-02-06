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
   * セッション詳細JSONを取得する（キャッシュバスターなし、不変リソース）
   * @param {string} sessionId
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async fetchSession(sessionId) {
    const url = `data/sessions/${sessionId}.json`;
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
