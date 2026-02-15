/**
 * E2E テストのナビゲーション共通ヘルパー
 *
 * `waitUntil: 'domcontentloaded'` に統一することで、
 * 画像やスタイルシートの完全読み込みを待たず、DOM 構築完了時点で次に進み、
 * その後各テストで必要な UI 要素の表示待機を明示的に行う戦略を採用する。
 */

/**
 * 指定 URL へナビゲートし、DOMContentLoaded 完了を待機する
 *
 * @param {import('@playwright/test').Page} page - Playwright Page オブジェクト
 * @param {string} path - ナビゲート先パス（baseURL からの相対パスまたは絶対パス）
 * @returns {Promise<import('@playwright/test').Response|null>} - ナビゲーション結果
 */
export async function navigateTo(page, path) {
    return await page.goto(path, { waitUntil: 'domcontentloaded' });
}
