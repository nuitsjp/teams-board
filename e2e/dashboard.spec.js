// @ts-check
import { test, expect } from '@playwright/test';
import { getIndexFixture, registerIndexRoute } from './helpers/route-fixtures.js';
import { navigateTo } from './helpers/navigation.js';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getMemberGroups = (index, member) =>
  index.groups.filter((group) => group.sessionRevisions.some((ref) => member.sessionRevisions.includes(ref)));

const selectMember = (index, minGroups) =>
  index.members.find((member) => getMemberGroups(index, member).length >= minGroups) ??
  index.members[0];

const selectGroup = (index) => index.groups[0];

const fetchIndex = async () => getIndexFixture();

test.beforeEach(async ({ page }) => {
  await registerIndexRoute(page);
});

test.describe('ダッシュボード画面', () => {
  test('グループ一覧が表示されること', async ({ page }) => {
    await navigateTo(page, '/');

    // ヘッダーが表示されること（画面準備完了を確認）
    await expect(page.locator('header')).toContainText('Teams Board');

    // グループセクションが表示されること
    await expect(page.getByRole('heading', { name: 'グループ', level: 2 })).toBeVisible();

    // グループが存在すること
    const index = await fetchIndex();
    const groupNames = index.groups.map((group) => group.name).slice(0, 4);
    for (const name of groupNames) {
      await expect(page.getByText(name).first()).toBeVisible();
    }
  });

  test('メンバー一覧が表示されること', async ({ page }) => {
    await navigateTo(page, '/');

    // ヘッダー表示で画面準備完了を確認
    await expect(page.locator('header')).toContainText('Teams Board');

    // メンバーセクションが表示されること
    await expect(page.getByRole('heading', { name: 'メンバー' })).toBeVisible();

    // メンバーが存在すること
    const index = await fetchIndex();
    const memberRows = page.getByTestId('member-row');
    await expect(memberRows).toHaveCount(index.members.length);
  });
});

test.describe('画面遷移', () => {
  test('メンバーをクリックして詳細画面に遷移できること', async ({ page }) => {
    await navigateTo(page, '/');

    // ヘッダー表示で画面準備完了を確認
    await expect(page.locator('header')).toContainText('Teams Board');

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
    await navigateTo(page, '/');

    // ヘッダー表示で画面準備完了を確認
    await expect(page.locator('header')).toContainText('Teams Board');

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
    await navigateTo(page, '/#/nonexistent-route');

    // ダッシュボードが表示されること
    await expect(page.getByRole('heading', { name: 'グループ', level: 2 })).toBeVisible();
  });
});

test.describe('グループ詳細画面', () => {
  test('トップページからグループをクリックして詳細画面に遷移できること', async ({ page }) => {
    await navigateTo(page, '/');

    // ヘッダー表示で画面準備完了を確認
    await expect(page.locator('header')).toContainText('Teams Board');

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
    const index = await fetchIndex();
    const group = selectGroup(index);
    if (!group) {
      throw new Error('グループデータが存在しないためテストできません');
    }
    await navigateTo(page, `/#/groups/${group.id}`);

    // グループ名が表示される（画面準備完了を確認）
    await expect(page.getByRole('heading', { name: group.name })).toBeVisible();

    // 開催回数が表示される
    await expect(page.getByText(new RegExp(`${group.sessionRevisions.length}回開催`))).toBeVisible();

    // セッション日付が表示される（複数あるので折りたたみ状態）
    const expandedTables = page.locator('.accordion-panel[data-expanded="true"] table');
    await expect(expandedTables).toHaveCount(0);
  });

  test('セッションをクリックして参加者詳細を展開・折りたたみできること', async ({ page }) => {
    const index = await fetchIndex();
    const group = selectGroup(index);
    if (!group) {
      throw new Error('グループデータが存在しないためテストできません');
    }
    await navigateTo(page, `/#/groups/${group.id}`);

    // セッション日付が表示されるまで待つ（画面準備完了を確認）
    await expect(page.getByRole('heading', { name: group.name })).toBeVisible();

    // セッションをクリックして展開
    const expandedTables = page.locator('.accordion-panel[data-expanded="true"] table');
    const sessionHeadings = page.getByRole('heading', { level: 3 });
    await sessionHeadings.first().click();
    await expect(expandedTables).toHaveCount(1);

    // テーブルに名前列と参加時間列がある
    const expandedPanel = page.locator('.accordion-panel[data-expanded="true"]').first();
    await expect(expandedPanel.getByRole('columnheader', { name: '名前' })).toBeVisible();
    await expect(expandedPanel.getByRole('columnheader', { name: '参加時間' })).toBeVisible();

    // 再クリックで折りたたみ
    await sessionHeadings.first().click();
    await expect(expandedTables).toHaveCount(0);
  });

  test('グループ詳細画面から「一覧へ戻る」でダッシュボードに戻れること', async ({ page }) => {
    const index = await fetchIndex();
    const group = selectGroup(index);
    if (!group) {
      throw new Error('グループデータが存在しないためテストできません');
    }
    await navigateTo(page, `/#/groups/${group.id}`);

    // 詳細画面が表示されるまで待つ（画面準備完了を確認）
    await expect(page.getByRole('heading', { name: group.name })).toBeVisible();

    // 「一覧へ戻る」をクリック
    await page.getByText('一覧へ戻る').click();

    // ダッシュボードに戻る
    await expect(page.getByRole('heading', { name: 'グループ', level: 2 })).toBeVisible();
  });
});

test.describe('メンバー詳細画面 — グループ別表示', () => {
  test('複数グループに参加しているメンバーでグループ別サマリーカードが表示されること', async ({
    page,
  }) => {
    const index = await fetchIndex();
    const member = selectMember(index, 2);
    const memberGroups = member ? getMemberGroups(index, member) : [];
    if (!member || memberGroups.length < 2) {
      throw new Error('複数グループのメンバーが必要です');
    }
    await navigateTo(page, `/#/members/${member.id}`);

    // メンバー名が表示される（画面準備完了を確認）
    await expect(
      page.getByRole('heading', { name: new RegExp(escapeRegExp(member.name)) })
    ).toBeVisible();

    // グループサマリーカードが表示される
    for (const group of memberGroups) {
      await expect(page.getByRole('heading', { name: group.name, level: 3 })).toBeVisible();
    }
  });

  test('グループカードをクリックして出席履歴を展開・折りたたみできること', async ({ page }) => {
    const index = await fetchIndex();
    const member = selectMember(index, 2);
    const memberGroups = member ? getMemberGroups(index, member) : [];
    if (!member || memberGroups.length < 2) {
      throw new Error('複数グループのメンバーが必要です');
    }
    await navigateTo(page, `/#/members/${member.id}`);

    // メンバー名が表示される（画面準備完了を確認）
    await expect(
      page.getByRole('heading', { name: new RegExp(escapeRegExp(member.name)) })
    ).toBeVisible();

    // 初期状態では出席履歴テーブルが表示されていない（複数グループなので折りたたみ）
    await expect(page.getByRole('heading', { name: memberGroups[0].name, level: 3 })).toBeVisible();
    const attendanceSection = page.locator('[data-section="attendance"]');
    const expandedTables = attendanceSection.locator('.accordion-panel[data-expanded="true"] table');
    await expect(expandedTables).toHaveCount(0);

    // 「フロントエンド勉強会」カードをクリックして展開
    await page.getByRole('heading', { name: memberGroups[0].name, level: 3 }).click();
    await expect(expandedTables).toHaveCount(1);

    // テーブルに日付列と参加時間列がある
    const expandedPanel = attendanceSection.locator('.accordion-panel[data-expanded="true"]').first();
    await expect(expandedPanel.getByRole('columnheader', { name: '日付' })).toBeVisible();
    await expect(expandedPanel.getByRole('columnheader', { name: '参加時間' })).toBeVisible();

    // 再クリックで折りたたみ
    await page.getByRole('heading', { name: memberGroups[0].name, level: 3 }).click();
    await expect(expandedTables).toHaveCount(0);
  });

  test('グループが1つのみのメンバーではデフォルトで展開されること', async ({ page }) => {
    const index = await fetchIndex();
    const member = index.members.find(
      (candidate) => getMemberGroups(index, candidate).length === 1
    );
    if (!member) {
      throw new Error('単一グループのメンバーが必要です');
    }
    const memberGroups = getMemberGroups(index, member);
    await navigateTo(page, `/#/members/${member.id}`);

    // グループ名が表示される（画面準備完了を確認）
    await expect(page.getByRole('heading', { name: memberGroups[0].name, level: 3 })).toBeVisible();

    // 単一グループのメンバーでは初期状態でテーブルが表示されている
    await expect(page.getByRole('heading', { name: memberGroups[0].name, level: 3 })).toBeVisible();
    await expect(page.locator('[data-section="attendance"] .accordion-panel[data-expanded="true"] table')).toHaveCount(1);
  });

  test('複数のグループカードを同時に展開できること', async ({ page }) => {
    const index = await fetchIndex();
    const member = selectMember(index, 2);
    const memberGroups = member ? getMemberGroups(index, member) : [];
    if (!member || memberGroups.length < 2) {
      throw new Error('複数グループのメンバーが必要です');
    }
    await navigateTo(page, `/#/members/${member.id}`);

    // メンバー名が表示される（画面準備完了を確認）
    await expect(
      page.getByRole('heading', { name: new RegExp(escapeRegExp(member.name)) })
    ).toBeVisible();

    // 2つのグループを展開
    await page.getByRole('heading', { name: memberGroups[0].name, level: 3 }).click();
    await page.getByRole('heading', { name: memberGroups[1].name, level: 3 }).click();

    // 2つのテーブルが表示される
    await expect(page.locator('[data-section="attendance"] .accordion-panel[data-expanded="true"] table')).toHaveCount(2);
  });
});
