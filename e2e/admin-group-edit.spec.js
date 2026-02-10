// @ts-check
import { test, expect } from '@playwright/test';

test.describe('管理者パネル — グループ名編集', () => {
  test('グループ管理セクションが表示されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token#/admin');

    // グループ管理セクションの見出しが表示されること
    await expect(page.getByRole('heading', { name: 'グループ管理' })).toBeVisible();

    // 説明文が表示されること
    await expect(
      page.getByText('グループ名を編集できます（グループIDは変更されません）')
    ).toBeVisible();
  });

  test('グループ一覧が表示されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token#/admin');

    // グループ管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ管理' }).scrollIntoViewIfNeeded();

    // テーブルヘッダーが表示されること
    await expect(page.getByRole('columnheader', { name: 'グループID' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'グループ名' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '総学習時間' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'セッション数' })).toBeVisible();

    // グループが表示されること（dev-fixturesのデータを想定）
    await expect(page.getByText('フロントエンド勉強会')).toBeVisible();
    await expect(page.getByText('TypeScript読書会')).toBeVisible();
  });

  test('グループ名の編集ボタンが表示されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token#/admin');

    // グループ管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ管理' }).scrollIntoViewIfNeeded();

    // 編集ボタンが存在すること（少なくとも1つ）
    const editButtons = page.getByTitle('グループ名を編集');
    await expect(editButtons.first()).toBeVisible();
  });

  test('編集ボタンをクリックすると入力フィールドが表示されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token#/admin');

    // グループ管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ管理' }).scrollIntoViewIfNeeded();

    // 最初の編集ボタンをクリック
    const editButtons = page.getByTitle('グループ名を編集');
    await editButtons.first().click();

    // 入力フィールドが表示されること
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    // 保存とキャンセルボタンが表示されること
    await expect(page.getByTitle('保存').first()).toBeVisible();
    await expect(page.getByTitle('キャンセル').first()).toBeVisible();
  });

  test('キャンセルボタンをクリックすると編集モードが解除されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token#/admin');

    // グループ管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ管理' }).scrollIntoViewIfNeeded();

    // 編集ボタンをクリック
    const editButtons = page.getByTitle('グループ名を編集');
    await editButtons.first().click();

    // 入力フィールドが表示されることを確認
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();

    // キャンセルボタンをクリック
    await page.getByTitle('キャンセル').first().click();

    // 入力フィールドが非表示になること
    await expect(input).not.toBeVisible();
  });

  test('Escapeキーで編集モードが解除されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token#/admin');

    // グループ管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ管理' }).scrollIntoViewIfNeeded();

    // 編集ボタンをクリック
    const editButtons = page.getByTitle('グループ名を編集');
    await editButtons.first().click();

    // 入力フィールドが表示されることを確認
    const input = page.locator('input[type="text"]').first();
    await expect(input).toBeVisible();

    // Escapeキーを押す
    await input.press('Escape');

    // 入力フィールドが非表示になること
    await expect(input).not.toBeVisible();
  });

  test('空文字での保存を試みるとエラーメッセージが表示されること', async ({ page }) => {
    await page.goto('/?token=test-sas-token#/admin');

    // グループ管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ管理' }).scrollIntoViewIfNeeded();

    // 編集ボタンをクリック
    const editButtons = page.getByTitle('グループ名を編集');
    await editButtons.first().click();

    // 入力フィールドをクリアして空にする
    const input = page.locator('input[type="text"]').first();
    await input.clear();

    // 保存ボタンをクリック
    await page.getByTitle('保存').first().click();

    // エラーメッセージが表示されること
    await expect(page.getByText('グループ名を入力してください')).toBeVisible();

    // 編集モードが継続されること
    await expect(input).toBeVisible();
  });
});
