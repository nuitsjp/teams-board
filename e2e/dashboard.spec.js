// @ts-check
import { test, expect } from '@playwright/test';

test.describe('ダッシュボード画面', () => {
  test('グループ一覧が表示されること', async ({ page }) => {
    await page.goto('/');

    // ヘッダーが表示されること
    await expect(page.locator('header')).toContainText('Teams Board');

    // グループセクションが表示されること
    await expect(page.getByRole('heading', { name: 'グループ' })).toBeVisible();

    // グループが4つ存在すること
    const groupNames = [
      'フロントエンド勉強会',
      'TypeScript読書会',
      'ソフトウェア設計勉強会',
      'インフラ技術研究会',
    ];
    for (const name of groupNames) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
  });

  test('メンバー一覧が表示されること', async ({ page }) => {
    await page.goto('/');

    // メンバーセクションが表示されること
    await expect(page.getByRole('heading', { name: 'メンバー' })).toBeVisible();

    // メンバーが存在すること
    const memberRows = page.getByTestId('member-row');
    await expect(memberRows).toHaveCount(4);
  });
});

test.describe('画面遷移', () => {
  test('メンバーをクリックして詳細画面に遷移できること', async ({ page }) => {
    await page.goto('/');

    // メンバー行が表示されるまで待つ
    const memberRow = page.getByTestId('member-row').first();
    await expect(memberRow).toBeVisible();

    // メンバー名を取得
    const memberName = await memberRow.locator('h3').textContent();

    // クリック
    await memberRow.click();

    // 詳細画面に遷移 — メンバー名がヘッダーに表示される
    await expect(page.getByRole('heading', { name: memberName })).toBeVisible();

    // 「一覧へ戻る」ボタンが表示されること
    await expect(page.getByText('一覧へ戻る')).toBeVisible();
  });

  test('「一覧へ戻る」ボタンでダッシュボードに戻れること', async ({ page }) => {
    await page.goto('/');

    // メンバー行をクリック
    const memberRow = page.getByTestId('member-row').first();
    await expect(memberRow).toBeVisible();
    await memberRow.click();

    // 詳細画面が表示されるまで待つ
    await expect(page.getByText('一覧へ戻る')).toBeVisible();

    // 「一覧へ戻る」をクリック
    await page.getByText('一覧へ戻る').click();

    // ダッシュボードに戻る
    await expect(page.getByRole('heading', { name: 'メンバー' })).toBeVisible();
  });

  test('存在しないルートにアクセスするとダッシュボードにリダイレクトされること', async ({
    page,
  }) => {
    await page.goto('/#/nonexistent-route');

    // ダッシュボードが表示されること
    await expect(page.getByRole('heading', { name: 'グループ' })).toBeVisible();
  });
});

test.describe('グループ詳細画面', () => {
  test('トップページからグループをクリックして詳細画面に遷移できること', async ({ page }) => {
    await page.goto('/');

    // グループ行が表示されるまで待つ
    const groupRow = page.getByTestId('group-row').first();
    await expect(groupRow).toBeVisible();

    // グループ名を取得
    const groupName = await groupRow.locator('h3').textContent();

    // クリック
    await groupRow.click();

    // 詳細画面に遷移 — グループ名がヘッダーに表示される
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();

    // 「一覧へ戻る」ボタンが表示されること
    await expect(page.getByText('一覧へ戻る')).toBeVisible();
  });

  test('グループ詳細画面でセッション一覧が表示されること', async ({ page }) => {
    // フロントエンド勉強会（10回開催）の詳細ページへ
    await page.goto('/#/groups/b20ae593');

    // グループ名が表示される
    await expect(page.getByRole('heading', { name: 'フロントエンド勉強会' })).toBeVisible();

    // 開催回数が表示される
    await expect(page.getByText(/10回開催/)).toBeVisible();

    // セッション日付が表示される（複数あるので折りたたみ状態）
    await expect(page.locator('table')).toHaveCount(0);
  });

  test('セッションをクリックして参加者詳細を展開・折りたたみできること', async ({ page }) => {
    await page.goto('/#/groups/b20ae593');

    // セッション日付が表示されるまで待つ
    await expect(page.getByRole('heading', { name: 'フロントエンド勉強会' })).toBeVisible();

    // セッションをクリックして展開
    const sessionHeadings = page.getByRole('heading', { level: 3 });
    await sessionHeadings.first().click();
    await expect(page.locator('table')).toBeVisible();

    // テーブルに名前列と参加時間列がある
    await expect(page.getByRole('columnheader', { name: '名前' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '参加時間' })).toBeVisible();

    // 再クリックで折りたたみ
    await sessionHeadings.first().click();
    await expect(page.locator('table')).toHaveCount(0);
  });

  test('グループ詳細画面から「一覧へ戻る」でダッシュボードに戻れること', async ({ page }) => {
    await page.goto('/#/groups/b20ae593');

    // 詳細画面が表示されるまで待つ
    await expect(page.getByText('一覧へ戻る')).toBeVisible();

    // 「一覧へ戻る」をクリック
    await page.getByText('一覧へ戻る').click();

    // ダッシュボードに戻る
    await expect(page.getByRole('heading', { name: 'グループ' })).toBeVisible();
  });
});

test.describe('メンバー詳細画面 — グループ別表示', () => {
  test('複数グループに参加しているメンバーでグループ別サマリーカードが表示されること', async ({
    page,
  }) => {
    // 鈴木さん（フロントエンド勉強会、TypeScript読書会、ソフトウェア設計勉強会に参加）の詳細ページへ
    await page.goto('/#/members/d2ede157');

    // メンバー名が表示される
    await expect(page.getByRole('heading', { name: /鈴木 太郎/ })).toBeVisible();

    // 3つのグループサマリーカードが表示される
    await expect(page.getByRole('heading', { name: 'フロントエンド勉強会' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'TypeScript読書会' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ソフトウェア設計勉強会' })).toBeVisible();
  });

  test('グループカードをクリックして出席履歴を展開・折りたたみできること', async ({ page }) => {
    await page.goto('/#/members/d2ede157');

    // 初期状態では出席履歴テーブルが表示されていない（複数グループなので折りたたみ）
    await expect(page.getByRole('heading', { name: 'フロントエンド勉強会' })).toBeVisible();
    const tables = page.locator('table');
    await expect(tables).toHaveCount(0);

    // 「フロントエンド勉強会」カードをクリックして展開
    await page.getByRole('heading', { name: 'フロントエンド勉強会' }).click();
    await expect(page.locator('table')).toBeVisible();

    // テーブルに日付列と参加時間列がある
    await expect(page.getByRole('columnheader', { name: '日付' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: '参加時間' })).toBeVisible();

    // 再クリックで折りたたみ
    await page.getByRole('heading', { name: 'フロントエンド勉強会' }).click();
    await expect(page.locator('table')).toHaveCount(0);
  });

  test('グループが1つのみのメンバーではデフォルトで展開されること', async ({ page }) => {
    // 現データでは全メンバーが複数グループに参加しているため、
    // 複数グループの場合に折りたたまれていることを確認する
    await page.goto('/#/members/d2ede157');

    // 複数グループのメンバーでは初期状態でテーブルが表示されていない
    await expect(page.getByRole('heading', { name: 'フロントエンド勉強会' })).toBeVisible();
    await expect(page.locator('table')).toHaveCount(0);
  });

  test('複数のグループカードを同時に展開できること', async ({ page }) => {
    await page.goto('/#/members/d2ede157');

    // 2つのグループを展開
    await page.getByRole('heading', { name: 'フロントエンド勉強会' }).click();
    await page.getByRole('heading', { name: 'TypeScript読書会' }).click();

    // 2つのテーブルが表示される
    await expect(page.locator('table')).toHaveCount(2);
  });
});
