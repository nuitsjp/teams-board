// BlobStorage — Blobへの書き込みを抽象化

/**
 * 本番環境用のBlobStorage
 * Azure Blob Storage APIを使用
 */
export class AzureBlobStorage {
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
   * Blobに単一ファイルを書き込む
   * @param {string} path - ファイルパス
   * @param {string} content - ファイルコンテンツ
   * @param {string} contentType - Content-Type
   * @returns {Promise<{path: string, success: boolean, error?: string}>}
   */
  async write(path, content, contentType) {
    const sasToken = this.#auth.getSasToken();
    const url = `${this.#blobBaseUrl}/${path}?${sasToken}`;

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
          'x-ms-blob-type': 'BlockBlob',
          'x-ms-version': '2025-01-05',
          'x-ms-blob-cache-control': AzureBlobStorage.#resolveCacheControl(path),
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
   * パスに基づいて Cache-Control ヘッダー値を決定する
   * @param {string} path - ファイルパス
   * @returns {string} Cache-Control 値
   */
  static #resolveCacheControl(path) {
    if (path.startsWith('assets/')) return 'max-age=31536000, immutable';
    return 'no-cache';
  }
}

/**
 * 開発環境用のBlobStorage
 * Viteミドルウェアの /dev-fixtures-write エンドポイントを使用
 */
export class DevBlobStorage {
  static #warningShown = false;

  /**
   * Blobに単一ファイルを書き込む
   * @param {string} path - ファイルパス
   * @param {string} content - ファイルコンテンツ
   * @param {string} _contentType - Content-Type（開発環境では未使用）
   * @returns {Promise<{path: string, success: boolean, error?: string}>}
   */
  // eslint-disable-next-line no-unused-vars
  async write(path, content, _contentType) {
    // 初回使用時に警告を表示
    if (!DevBlobStorage.#warningShown) {
      console.warn('[開発モード] BlobStorageはdev-fixtures/data/に書き込みます');
      DevBlobStorage.#warningShown = true;
    }

    try {
      // contentが文字列でない場合はJSON化
      const data = typeof content === 'string' ? JSON.parse(content) : content;

      const response = await fetch('/dev-fixtures-write', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path, data }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          path,
          success: false,
          error: errorData.error || `HTTP ${response.status} ${response.statusText}`,
        };
      }

      const result = await response.json();
      if (!result.success) {
        return { path, success: false, error: result.error };
      }

      return { path, success: true };
    } catch (err) {
      return { path, success: false, error: err.message };
    }
  }
}
