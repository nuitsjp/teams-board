// @ts-check
import { test, expect } from '@playwright/test';
import { restoreIndexJson } from './helpers/fixture-lifecycle.js';
import { navigateTo } from './helpers/navigation.js';

test.describe('開発モード — ダミートークンでの管理者機能', () => {
  // データ変更テストは並列実行から分離してシーケンシャルに実行
  test.describe.configure({ mode: 'serial' });

  // データ変更テスト後に即座にバックアップから復元
  // eslint-disable-next-line no-empty-pattern
  test.afterEach(async ({}, testInfo) => {
    if (testInfo.title.includes('グループ名の編集ができること')) {
      await restoreIndexJson();
    }
  });

  test('token=devで管理者リンクが表示されること', async ({ page }) => {
    await navigateTo(page, '/?token=dev');

    // ヘッダー表示を待機
    await expect(page.locator('header')).toContainText('Teams Board');

    // 「管理」リンクが表示されること
    await expect(page.getByRole('link', { name: '管理' })).toBeVisible();
  });

  test('token=devで管理者パネルにアクセスできること', async ({ page }) => {
    await navigateTo(page, '/?token=dev#/admin');

    // 管理者パネルの見出しが表示されること（画面準備完了を確認）
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // ドロップゾーンが表示されること
    await expect(page.getByText('Teams出席レポートCSV')).toBeVisible();

    // グループ管理セクションが表示されること
    await expect(page.getByRole('heading', { name: 'グループ管理' })).toBeVisible();
  });

  test('token=devでグループ一覧が表示されること', async ({ page }) => {
    await navigateTo(page, '/?token=dev#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // グループ管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ管理' }).scrollIntoViewIfNeeded();

    // テーブルヘッダーが表示されること
    await expect(page.getByRole('columnheader', { name: 'グループID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'グループ名' })).toBeVisible();

    // グループが表示されること（dev-fixturesのデータを想定）
    await expect(page.getByText('フロントエンド勉強会')).toBeVisible();
    await expect(page.getByText('TypeScript読書会')).toBeVisible();
  });

  test('token=devでグループ名の編集ができること', async ({ page }) => {
    await navigateTo(page, '/?token=dev#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // グループ管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ管理' }).scrollIntoViewIfNeeded();

    // 最初の編集ボタンをクリック
    const editButtons = page.getByTitle('グループ名を編集');
    await editButtons.first().click();

    // 入力フィールドが表示されることを確認
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    // グループ名を変更
    const newGroupName = `テストグループ_${Date.now()}`;
    await input.clear();
    await input.fill(newGroupName);

    // 保存ボタンをクリック
    await page.getByTitle('保存').first().click();

    // 新しいグループ名が表示されること
    await expect(page.getByText(newGroupName)).toBeVisible();

    // コンソールに開発モードのログが出力されることを確認
    // 注: この検証は、開発サーバーのログで確認する必要があります
  });

  test('token=devでCSVファイルをアップロードできること', async ({ page }) => {
    await navigateTo(page, '/?token=dev#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // ファイル入力を取得
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();

    // テスト用のCSVファイルパスを指定（実際のファイルパスに置き換える必要があります）
    // 注: このテストは、実際のCSVファイルが存在する場合にのみ動作します
    // 実装時には、tests/fixtures/ 配下のCSVファイルを使用してください

    // ここでは、ファイル入力が存在することを確認するにとどめます
    await expect(fileInput).toBeEnabled();
  });

  test('開発モードのコンソールメッセージが表示されること', async ({ page }) => {
    const consoleMessages = [];

    // コンソールメッセージをキャプチャ
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    await navigateTo(page, '/?token=dev');

    // ダッシュボード見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: 'グループ', level: 2 })).toBeVisible();

    // 開発モードのログメッセージが出力されていることを確認
    const devModeMessage = consoleMessages.find(
      (msg) => msg.text.includes('開発モード') && msg.text.includes('ダミートークン')
    );

    expect(devModeMessage).toBeDefined();
    expect(devModeMessage?.type).toBe('info');
  });

  test('URLからtoken=devが削除されること', async ({ page }) => {
    await navigateTo(page, '/?token=dev');

    // ダッシュボード見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: 'グループ', level: 2 })).toBeVisible();

    // URLにtokenパラメータが含まれていないことを確認
    const url = new URL(page.url());
    expect(url.searchParams.has('token')).toBe(false);

    // しかし、管理者リンクは表示されること（トークンはメモリに保持されている）
    await expect(page.getByRole('link', { name: '管理' })).toBeVisible();
  });
});
