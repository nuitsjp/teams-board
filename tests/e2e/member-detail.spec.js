// @ts-check
import { test, expect } from '@playwright/test';
import { navigateTo } from './helpers/navigation.js';

test.describe('メンバー期別グループ詳細画面', () => {
    // Suzuki Taro A — 複数グループ参加、フロントエンド勉強会にメンバー情報あり
    const memberId = '01KHNHF98NYNJPQV869R3WT90Y';
    const memberName = 'Suzuki Taro A';

    test('期別グループ詳細画面にヘッダー情報が表示されること', async ({ page }) => {
        await navigateTo(page, `/#/members/${memberId}`);
        await expect(page.getByRole('heading', { name: memberName })).toBeVisible();

        // フロントエンド勉強会のグループ行をクリック
        const groupRow = page
            .getByTestId('group-card')
            .filter({ hasText: 'フロントエンド勉強会' });
        await expect(groupRow).toBeVisible();
        await groupRow.click();

        // 期別グループ詳細画面のURLパターンを確認
        await expect(page).toHaveURL(/#\/members\/.+\/groups\/.+\/terms\/.+$/);

        // ヘッダーにメンバー名・グループ名が表示されること
        await expect(page.getByRole('heading', { name: memberName })).toBeVisible();
        await expect(page.getByText('フロントエンド勉強会').first()).toBeVisible();
    });

    test('セッション一覧が表示されること', async ({ page }) => {
        await navigateTo(page, `/#/members/${memberId}`);
        await expect(page.getByRole('heading', { name: memberName })).toBeVisible();

        const groupRow = page
            .getByTestId('group-card')
            .filter({ hasText: 'フロントエンド勉強会' });
        await groupRow.click();

        await expect(page).toHaveURL(/#\/members\/.+\/groups\/.+\/terms\/.+$/);

        // セッション一覧が表示されること
        await expect(page.getByText('セッション一覧')).toBeVisible();

        // 合計時間と参加回数が表示されること
        await expect(page.getByText(/合計/)).toBeVisible();
        await expect(page.getByText(/回参加/)).toBeVisible();
    });

    test('詳細セクションにメンバー情報が表示されること', async ({ page }) => {
        await navigateTo(page, `/#/members/${memberId}`);
        await expect(page.getByRole('heading', { name: memberName })).toBeVisible();

        // フロントエンド勉強会（メンバー情報あり）をクリック
        const groupRow = page
            .getByTestId('group-card')
            .filter({ hasText: 'フロントエンド勉強会' });
        await groupRow.click();

        // 詳細セクションが表示されること
        await expect(page.getByText('詳細')).toBeVisible();

        // 共通情報が優先表示されること（group-term-details のデータ）
        await expect(page.getByText('フロントエンド技術のキャッチアップと実践力向上')).toBeVisible();
    });

    test('講師バッジがセッション一覧に表示されること', async ({ page }) => {
        await navigateTo(page, `/#/members/${memberId}`);
        await expect(page.getByRole('heading', { name: memberName })).toBeVisible();

        const groupRow = page
            .getByTestId('group-card')
            .filter({ hasText: 'フロントエンド勉強会' });
        await groupRow.click();

        await expect(page.getByText('セッション一覧')).toBeVisible();

        // 講師バッジが少なくとも1つ表示されること
        const instructorBadges = page.locator('.bg-amber-50').filter({ hasText: '講師' });
        await expect(instructorBadges.first()).toBeVisible();
    });

    test('「戻る」ボタンで前画面に戻れること', async ({ page }) => {
        await navigateTo(page, `/#/members/${memberId}`);
        await expect(page.getByRole('heading', { name: memberName })).toBeVisible();

        const groupRow = page
            .getByTestId('group-card')
            .filter({ hasText: 'フロントエンド勉強会' });
        await groupRow.click();

        await expect(page).toHaveURL(/#\/members\/.+\/groups\/.+\/terms\/.+$/);

        // 「戻る」をクリック
        await page.getByText('戻る').click();

        // メンバー詳細画面に戻ること
        await expect(page.getByTestId('group-card').first()).toBeVisible();
    });
});
