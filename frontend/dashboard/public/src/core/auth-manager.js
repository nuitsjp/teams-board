// AuthManager — SASトークン管理・管理者モード制御
export class AuthManager {
  /** @type {string | null} */
  #sasToken = null;

  /**
   * URLからSASトークンを抽出して初期化する
   * @param {string} [url] - テスト用にURLを外部注入可能（省略時はlocation.href）
   * @returns {AuthManager}
   */
  static initialize(url) {
    const instance = new AuthManager();
    instance.#extractToken(url ?? window.location.href);
    return instance;
  }

  /**
   * URLからtokenパラメータを抽出し、URLからtokenを除去する
   * @param {string} urlStr
   */
  #extractToken(urlStr) {
    const url = new URL(urlStr);
    const token = url.searchParams.get('token');

    if (!token) {
      this.#sasToken = null;
      return;
    }

    this.#sasToken = token;

    // URLからtokenパラメータを除去
    url.searchParams.delete('token');
    const cleanUrl = url.searchParams.toString()
      ? `${url.origin}${url.pathname}?${url.searchParams.toString()}${url.hash}`
      : `${url.origin}${url.pathname}${url.hash}`;
    window.history.replaceState(null, '', cleanUrl);
  }

  /** @returns {boolean} */
  isAdminMode() {
    return this.#sasToken !== null;
  }

  /** @returns {string | null} */
  getSasToken() {
    return this.#sasToken;
  }
}
