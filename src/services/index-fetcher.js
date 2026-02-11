// IndexFetcher — index.jsonの取得を抽象化

/**
 * 本番環境用のIndexFetcher
 * Azure Blob Storageから取得
 */
export class ProductionIndexFetcher {
  #blobBaseUrl;
  #auth;

  /**
   * @param {string} blobBaseUrl - Blobサービスエンドポイント
   * @param {object} auth - { getSasToken: () => string|null }
   */
  constructor(blobBaseUrl, auth) {
    this.#blobBaseUrl = blobBaseUrl;
    this.#auth = auth;
  }

  /**
   * 最新のindex.jsonを取得する
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async fetch() {
    const sasToken = this.#auth.getSasToken();
    const url = `${this.#blobBaseUrl}/data/index.json?${sasToken}`;

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

/**
 * 開発環境用のIndexFetcher
 * 相対パスから取得（Viteミドルウェアが処理）
 */
export class DevIndexFetcher {
  /**
   * 最新のindex.jsonを取得する
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async fetch() {
    const url = `/data/index.json?v=${Date.now()}`;

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
