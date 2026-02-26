// @ts-check
import { test, expect } from '@playwright/test';
import { getIndexFixture, registerIndexRoute } from './helpers/route-fixtures.js';
import { navigateTo } from './helpers/navigation.js';

const fetchIndex = async () => getIndexFixture();

test.beforeEach(async ({ page }) => {
  await registerIndexRoute(page);
});

test.describe('管理者パネル — グループ名編集', () => {
  test('グループ管理セクションが表示されること', async ({ page }) => {
    await navigateTo(page, '/?token=test-sas-token#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // グループ・セッション管理セクションの見出しが表示されること
    await expect(page.getByRole('heading', { name: 'グループ・セッション管理' })).toBeVisible();

    // 説明文が表示されること
    await expect(
      page.getByText('グループの編集・統合と、セッション名の管理ができます')
    ).toBeVisible();
  });

  test('グループ一覧が表示されること', async ({ page }) => {
    await navigateTo(page, '/?token=test-sas-token#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // グループ・セッション管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ・セッション管理' }).scrollIntoViewIfNeeded();

    // グループ名が表示されていること
    const index = await fetchIndex();
    const groupNames = index.groups.map((group) => group.name).slice(0, 2);
    for (const name of groupNames) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
  });

  test('グループ名の編集ボタンが表示されること', async ({ page }) => {
    await navigateTo(page, '/?token=test-sas-token#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // グループ・セッション管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ・セッション管理' }).scrollIntoViewIfNeeded();

    // 編集ボタンが存在すること（少なくとも1つ）
    const editButtons = page.getByTitle('グループ名を編集');
    await expect(editButtons.first()).toBeVisible();
  });

  test('編集ボタンをクリックすると入力フィールドが表示されること', async ({ page }) => {
    await navigateTo(page, '/?token=test-sas-token#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // グループ・セッション管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ・セッション管理' }).scrollIntoViewIfNeeded();

    // 最初の編集ボタンをクリック
    const editButtons = page.getByTitle('グループ名を編集');
    await editButtons.first().click();

    // 入力フィールドが表示されること
    const input = page.getByPlaceholder('グループ名を入力');
    await expect(input).toBeVisible();
    await expect(input).toBeFocused();

    // 保存とキャンセルボタンが表示されること
    await expect(page.getByTitle('保存').first()).toBeVisible();
    await expect(page.getByTitle('キャンセル').first()).toBeVisible();
  });

  test('キャンセルボタンをクリックすると編集モードが解除されること', async ({ page }) => {
    await navigateTo(page, '/?token=test-sas-token#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // グループ・セッション管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ・セッション管理' }).scrollIntoViewIfNeeded();

    // 編集ボタンをクリック
    const editButtons = page.getByTitle('グループ名を編集');
    await editButtons.first().click();

    // 入力フィールドが表示されることを確認
    const input = page.getByPlaceholder('グループ名を入力');
    await expect(input).toBeVisible();

    // キャンセルボタンをクリック
    await page.getByTitle('キャンセル').first().click();

    // 入力フィールドが非表示になること
    await expect(input).not.toBeVisible();
  });

  test('Escapeキーで編集モードが解除されること', async ({ page }) => {
    await navigateTo(page, '/?token=test-sas-token#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // グループ・セッション管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ・セッション管理' }).scrollIntoViewIfNeeded();

    // 編集ボタンをクリック
    const editButtons = page.getByTitle('グループ名を編集');
    await editButtons.first().click();

    // 入力フィールドが表示されることを確認
    const input = page.getByPlaceholder('グループ名を入力');
    await expect(input).toBeVisible();

    // Escapeキーを押す
    await input.press('Escape');

    // 入力フィールドが非表示になること
    await expect(input).not.toBeVisible();
  });

  test('空文字での保存を試みるとエラーメッセージが表示されること', async ({ page }) => {
    await navigateTo(page, '/?token=test-sas-token#/admin');

    // 管理者パネル見出しで画面準備完了を確認
    await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

    // グループ・セッション管理セクションまでスクロール
    await page.getByRole('heading', { name: 'グループ・セッション管理' }).scrollIntoViewIfNeeded();

    // 編集ボタンをクリック
    const editButtons = page.getByTitle('グループ名を編集');
    await editButtons.first().click();

    // 入力フィールドをクリアして空にする
    const input = page.getByPlaceholder('グループ名を入力');
    await input.clear();

    // 保存ボタンをクリック
    await page.getByTitle('保存').first().click();

    // エラーメッセージが表示されること
    await expect(page.getByText('グループ名を入力してください')).toBeVisible();

    // 編集モードが継続されること
    await expect(input).toBeVisible();
  });
});
