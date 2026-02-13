// @ts-check
import { test, expect } from '@playwright/test';
import { registerIndexRoute } from './helpers/route-fixtures.js';

test.beforeEach(async ({ page }) => {
  await registerIndexRoute(page);
});

test.describe('管理者パネル', () => {
  test('トークンなしでアクセスした場合に管理者リンクが非表示であること', async ({ page }) => {
    await page.goto('/');

    // ヘッダーに「管理」リンクが存在しないことを確認
    await expect(page.getByRole('link', { name: '管理' })).not.toBeVisible();
  });

  test('SASトークン付きURLで管理者リンクが表示されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token');

    // 「管理」リンクが表示されること
    await expect(page.getByRole('link', { name: '管理' })).toBeVisible();
  });

  test('管理者パネル画面にCSVドロップゾーンが表示されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token#/admin');

    // 管理者パネルの見出しが表示されること
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // ドロップゾーンが表示されること
    await expect(page.getByText('Teams出席レポートCSV')).toBeVisible();

    // ファイル入力が存在すること
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });
});
