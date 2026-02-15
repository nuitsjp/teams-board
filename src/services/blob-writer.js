// BlobWriter — Blobサービスエンドポイントへのデータ書き込み
export class BlobWriter {
  #indexFetcher;
  #blobStorage;

  /**
   * @param {object} indexFetcher - IndexFetcherインターフェース実装
   * @param {object} blobStorage - BlobStorageインターフェース実装
   */
  constructor(indexFetcher, blobStorage) {
    this.#indexFetcher = indexFetcher;
    this.#blobStorage = blobStorage;
  }

  /**
   * 書き込みシーケンスを実行する（raw → items → index）
   * @param {object} params
   * @param {object} [params.rawCsv] - 元CSV書き込み情報
   * @param {Array} params.newItems - 新規items書き込み情報
   * @param {function} params.indexUpdater - 最新indexとnewItems結果を受け取り更新後indexを返す関数
   * @param {function} [params.onItemComplete] - newItemsの各書き込み完了時に呼ばれるコールバック
   * @returns {Promise<{results: Array, allSucceeded: boolean}>}
   */
  async executeWriteSequence({ rawCsv, newItems, indexUpdater, onItemComplete }) {
    const results = [];

    // 1. raw CSV の書き込み
    if (rawCsv) {
      const result = await this.#putBlob(rawCsv);
      results.push(result);
      if (!result.success) {
        return { results, allSucceeded: false };
      }
    }

    // 2. items の書き込み（並列）
    const itemResults = await Promise.all(
      newItems.map(async (item) => {
        const result = await this.#putBlob(item);
        if (onItemComplete) {
          onItemComplete(result, item);
        }
        return result;
      })
    );
    results.push(...itemResults);

    if (typeof indexUpdater !== 'function') {
      return {
        results,
        allSucceeded: results.every((r) => r.success),
      };
    }

    // 3. 最新 index.json を取得
    const currentIndex = await this.#fetchCurrentIndex();
    if (!currentIndex.ok) {
      results.push({ path: 'data/index.json', success: false, error: currentIndex.error });
      return { results, allSucceeded: false };
    }

    // 4. indexUpdater で更新してPUT（null/undefinedの場合はindex更新をスキップ）
    const updatedIndex = indexUpdater(currentIndex.data, itemResults);
    if (updatedIndex == null) {
      return {
        results,
        allSucceeded: results.every((r) => r.success),
      };
    }

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
    return await this.#blobStorage.write(path, content, contentType);
  }

  /**
   * 最新のindex.jsonを取得する
   * @returns {Promise<{ok: true, data: object} | {ok: false, error: string}>}
   */
  async #fetchCurrentIndex() {
    return await this.#indexFetcher.fetch();
  }
}
