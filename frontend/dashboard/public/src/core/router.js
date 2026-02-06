// Router — ハッシュベース画面遷移制御
export class Router {
  /** @type {Array<function>} */
  #listeners = [];

  constructor() {
    window.addEventListener('hashchange', () => {
      const route = this.getCurrentRoute();
      this.#listeners.forEach((cb) => cb(route));
    });
  }

  /**
   * 現在のハッシュからルートを解析する
   * @returns {{ view: 'dashboard' } | { view: 'memberDetail', memberId: string }}
   */
  getCurrentRoute() {
    const hash = window.location.hash;
    const match = hash.match(/^#\/members\/(.+)$/);
    if (match) {
      return { view: 'memberDetail', memberId: match[1] };
    }
    return { view: 'dashboard' };
  }

  /**
   * 指定ルートへ遷移する
   * @param {{ view: 'dashboard' } | { view: 'memberDetail', memberId: string }} route
   */
  navigate(route) {
    if (route.view === 'memberDetail') {
      window.location.hash = `#/members/${route.memberId}`;
    } else {
      window.location.hash = '#/';
    }
    // navigate経由ではリスナーを即時発火（hashchangeの非同期を補完）
    this.#listeners.forEach((cb) => cb(route));
  }

  /**
   * ルート変更時のコールバックを登録する
   * @param {function} callback
   */
  onRouteChange(callback) {
    this.#listeners.push(callback);
  }
}
