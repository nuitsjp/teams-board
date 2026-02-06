// @ts-check
import { test, expect } from '@playwright/test';

test.describe('ダッシュボード画面', () => {
  test('勉強会グループ一覧が表示されること', async ({ page }) => {
    await page.goto('/');

    // ヘッダーが表示されること
    await expect(page.locator('header h1')).toHaveText('ダッシュボード');

    // 勉強会グループセクションが表示されること
    await expect(page.locator('.study-groups-section h2')).toHaveText('勉強会グループ');

    // 勉強会グループカードが存在すること
    const groupCards = page.locator('.study-group-card');
    await expect(groupCards).not.toHaveCount(0);
  });

  test('参加者一覧が表示されること', async ({ page }) => {
    await page.goto('/');

    // 参加者セクションが表示されること
    await expect(page.locator('.members-section h2')).toHaveText('参加者');

    // メンバーカードが存在すること
    const memberCards = page.locator('.member-card');
    await expect(memberCards).not.toHaveCount(0);
  });
});

test.describe('画面遷移', () => {
  test('メンバーカードをクリックして詳細画面に遷移できること', async ({ page }) => {
    await page.goto('/');

    // メンバーカードが表示されるまで待つ
    const memberCard = page.locator('.member-card').first();
    await expect(memberCard).toBeVisible();

    // メンバー名を取得
    const memberName = await memberCard.locator('h3').textContent();

    // クリック
    await memberCard.click();

    // 詳細画面に遷移
    await expect(page.locator('.member-detail-view')).toBeVisible();
    await expect(page.locator('.member-detail-view h2')).toHaveText(memberName);

    // 「戻る」リンクが表示されること
    await expect(page.locator('.back-link')).toHaveText('← 一覧へ戻る');
  });

  test('「一覧へ戻る」リンクでダッシュボードに戻れること', async ({ page }) => {
    await page.goto('/');

    // メンバーカードをクリック
    const memberCard = page.locator('.member-card').first();
    await expect(memberCard).toBeVisible();
    await memberCard.click();

    // 詳細画面が表示されるまで待つ
    await expect(page.locator('.member-detail-view')).toBeVisible();

    // 「一覧へ戻る」をクリック
    await page.locator('.back-link').click();

    // ダッシュボードに戻る
    await expect(page.locator('.members-section')).toBeVisible();
  });

  test('存在しないルートにアクセスするとダッシュボードにリダイレクトされること', async ({ page }) => {
    await page.goto('/#/nonexistent-route');

    // ダッシュボードが表示されること
    await expect(page.locator('.study-groups-section')).toBeVisible();
  });
});
