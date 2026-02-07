// @ts-check
import { test, expect } from '@playwright/test';

test.describe('管理者パネル', () => {
  test('トークンなしでアクセスした場合に管理者パネルが非表示であること', async ({ page }) => {
    await page.goto('/');

    // 管理者パネルが存在しないことを確認
    await expect(page.locator('#admin-panel')).not.toBeVisible();
  });

  test('SASトークン付きURLで管理者パネルが表示されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token');

    // 管理者パネルが表示されること
    await expect(page.locator('#admin-panel')).toBeVisible();
    await expect(page.locator('#admin-panel h2')).toHaveText('管理者パネル');

    // ドロップゾーンが表示されること
    await expect(page.locator('.csv-drop-zone')).toBeVisible();
  });

  test('SASトークン付きURLでドラッグ&ドロップ領域が機能すること', async ({ page }) => {
    await page.goto('/?token=test-sas-token');

    // ドロップゾーンが存在すること
    const dropZone = page.locator('.csv-drop-zone');
    await expect(dropZone).toBeVisible();
    await expect(dropZone).toContainText('Teams出席レポートCSV');

    // ファイル入力が存在すること
    const fileInput = page.locator('input[type="file"]');
    await expect(fileInput).toBeAttached();
  });
});
