// BlobWriter — Blobサービスエンドポイントへのデータ書き込み
export class BlobWriter {
  #auth;
  #blobBaseUrl;

  /**
   * @param {object} auth - { getSasToken: () => string|null } インターフェース
   * @param {string} blobBaseUrl - Blobサービスエンドポイント（例: https://account.blob.core.windows.net/$web）
   */
  constructor(auth, blobBaseUrl) {
    this.#auth = auth;
    this.#blobBaseUrl = blobBaseUrl;
  }

  /**
   * 書き込みシーケンスを実行する（raw → items → index）
   * @param {object} params
   * @param {object} [params.rawCsv] - 元CSV書き込み情報
   * @param {Array} params.newItems - 新規items書き込み情報
   * @param {function} params.indexUpdater - 最新indexを受け取り更新後indexを返す関数
   * @returns {Promise<{results: Array, allSucceeded: boolean}>}
   */
  async executeWriteSequence({ rawCsv, newItems, indexUpdater }) {
    const results = [];

    // 1. raw CSV の書き込み
    if (rawCsv) {
      const result = await this.#putBlob(rawCsv);
      results.push(result);
      if (!result.success) {
        return { results, allSucceeded: false };
      }
    }

    // 2. items の書き込み
    for (const item of newItems) {
      const result = await this.#putBlob(item);
      results.push(result);
      if (!result.success) {
        return { results, allSucceeded: false };
      }
    }

    // 3. 最新 index.json を取得
    const currentIndex = await this.#fetchCurrentIndex();
    if (!currentIndex.ok) {
      results.push({ path: 'data/index.json', success: false, error: currentIndex.error });
      return { results, allSucceeded: false };
    }

    // 4. indexUpdater で更新してPUT
    const updatedIndex = indexUpdater(currentIndex.data);
    const indexResult = await this.#putBlob({
      path: 'data/index.json',
      content: JSON.stringify(updatedIndex, null, 2),
      contentType: 'application/json',
    });
    results.push(indexResult);

    return {
      results,
      allSucceeded: results.every((r) => r.success),
    };
  }

  /**
   * 失敗した操作をリトライする
   * @param {Array} failedResults - 失敗した操作の一覧
   * @returns {Promise<{results: Array, allSucceeded: boolean}>}
   */
  async retryFailed(failedResults) {
    const results = [];
    for (const failed of failedResults) {
      const result = await this.#putBlob({
        path: failed.path,
        content: failed.content,
        contentType: failed.contentType,
      });
      results.push(result);
    }
    return {
      results,
      allSucceeded: results.every((r) => r.success),
    };
  }

  /**
   * Blobに単一ファイルをPUTする
   * @param {object} op - { path, content, contentType }
   * @returns {Promise<{path: string, success: boolean, error?: string}>}
   */
  async #putBlob({ path, content, contentType }) {
    const sasToken = this.#auth.getSasToken();
    const url = `${this.#blobBaseUrl}/${path}?${sasToken}`;
    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-ms-blob-type': 'BlockBlob',
          'x-ms-version': '2025-01-05',
        },
        body: content,
      });
      if (!response.ok) {
        return { path, success: false, error: `HTTP ${response.status} ${response.statusText}` };
      }
      return { path, success: true };
    } catch (err) {
      return { path, success: false, error: err.message };
    }
  }

  /**
   * 最新のindex.jsonを取得する
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async #fetchCurrentIndex() {
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
