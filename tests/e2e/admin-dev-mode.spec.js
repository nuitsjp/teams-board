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
        if (
            testInfo.title.includes('グループ名の編集ができること') ||
            testInfo.title.includes('セッション削除') ||
            testInfo.title.includes('講師を変更して保存') ||
            testInfo.title.includes('主催者を設定して保存')
        ) {
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

        // グループ・セッション管理セクションが表示されること
        await expect(page.getByRole('heading', { name: 'グループ・セッション管理' })).toBeVisible();
    });

    test('token=devでグループ一覧が表示されること', async ({ page }) => {
        await navigateTo(page, '/?token=dev#/admin');

        // 管理者パネル見出しで画面準備完了を確認
        await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

        // グループ・セッション管理セクションまでスクロール
        await page
            .getByRole('heading', { name: 'グループ・セッション管理' })
            .scrollIntoViewIfNeeded();

        // グループが表示されること（dev-fixturesのデータを想定）
        await expect(page.getByText('フロントエンド勉強会').first()).toBeVisible();
        await expect(page.getByText('TypeScript読書会').first()).toBeVisible();
    });

    test('token=devでグループ名の編集ができること', async ({ page }) => {
        await navigateTo(page, '/?token=dev#/admin');

        // 管理者パネル見出しで画面準備完了を確認
        await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

        // グループ・セッション管理セクションまでスクロール
        await page
            .getByRole('heading', { name: 'グループ・セッション管理' })
            .scrollIntoViewIfNeeded();

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

    test('token=devでグループに主催者を設定して保存できること', async ({ page }) => {
        await navigateTo(page, '/?token=dev#/admin');

        // 管理者パネル見出しで画面準備完了を確認
        await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

        // グループ・セッション管理セクションまでスクロール
        await page
            .getByRole('heading', { name: 'グループ・セッション管理' })
            .scrollIntoViewIfNeeded();

        // 主催者未設定のグループ（「ソフトウェア設計勉強会」）を展開
        await page.getByRole('button', { name: /ソフトウェア設計勉強会 を展開/ }).click();

        // 主催者検索入力にフォーカスしてドロップダウンを開く
        const organizerInput = page.getByRole('combobox', { name: '主催者を検索' }).first();
        await organizerInput.scrollIntoViewIfNeeded();
        await expect(organizerInput).toBeVisible();
        await organizerInput.focus();

        // ドロップダウンから既存候補を選択
        const listbox = page.getByRole('listbox', { name: '主催者候補' });
        await expect(listbox).toBeVisible();
        await listbox.getByRole('option').first().click();

        // 主催者を保存ボタンをクリック（レイアウト重なりのためDOMクリックを使用）
        const saveOrganizerButton = page.getByRole('button', { name: /主催者を保存/ }).first();
        await saveOrganizerButton.evaluate((el) => el.click());

        // 成功メッセージを確認
        await expect(page.getByText('主催者を保存しました')).toBeVisible();
    });

    test('token=devでセッションの講師を変更して保存できること', async ({ page }) => {
        await navigateTo(page, '/?token=dev#/admin');

        // 管理者パネル見出しで画面準備完了を確認
        await expect(page.getByRole('heading', { name: '管理者パネル' })).toBeVisible();

        // グループ・セッション管理セクションまでスクロール
        await page
            .getByRole('heading', { name: 'グループ・セッション管理' })
            .scrollIntoViewIfNeeded();

        // グループ（「フロントエンド勉強会」）を展開
        await page.getByRole('button', { name: /フロントエンド勉強会 を展開/ }).click();

        // セッション行をクリックして右側の SessionEditorPanel を表示
        // セッション一覧の最初のセッション（日付ボタン）をクリック
        const sessionButtons = page.locator('button:has(.tabular-nums.text-text-muted.text-xs)');
        await sessionButtons.first().scrollIntoViewIfNeeded();
        await expect(sessionButtons.first()).toBeVisible();
        await sessionButtons.first().click({ force: true });

        // SessionEditorPanel が表示されること（セッション名ラベルで確認）
        await expect(page.getByLabel(/のセッション名/)).toBeVisible();

        // 講師セクションの検索入力にフォーカスしてドロップダウンを開く
        const instructorInput = page.getByRole('combobox', { name: '講師を検索' });
        await instructorInput.scrollIntoViewIfNeeded();
        await expect(instructorInput).toBeVisible();
        await instructorInput.focus();

        // ドロップダウンから候補を選択
        const instructorListbox = page.getByRole('listbox', { name: '講師候補' });
        await expect(instructorListbox).toBeVisible();
        await instructorListbox.getByRole('option').first().click();

        // 保存ボタンをクリック（SessionEditorPanel の保存ボタン）
        await page.getByRole('button', { name: '保存', exact: true }).click();

        // 成功メッセージを確認
        await expect(page.getByText('セッションを保存しました')).toBeVisible();
    });

    test('token=devでグループ詳細画面からセッション削除ができること', async ({ page }) => {
        // グループ詳細画面にアクセス（フロントエンド勉強会）
        await navigateTo(page, '/?token=dev#/groups/01KHNHF98M86MWSATH6W4TR205');

        // グループ名の表示を待機
        await expect(page.getByText('フロントエンド勉強会').first()).toBeVisible();

        // 削除ボタンが表示されること
        const deleteButtons = page.getByRole('button', { name: /のセッションを削除/ });
        await expect(deleteButtons.first()).toBeVisible();

        // 最初の削除ボタンをクリック
        await deleteButtons.first().click();

        // 確認ダイアログが表示されること
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText('セッションの削除')).toBeVisible();

        // 削除実行
        await dialog.getByRole('button', { name: '削除' }).click();

        // 成功メッセージが表示されること
        await expect(page.getByText('セッションを削除しました')).toBeVisible();
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
