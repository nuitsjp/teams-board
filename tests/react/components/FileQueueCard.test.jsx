import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileQueueCard } from '../../../src/components/FileQueueCard.jsx';

// 共通テストデータ
const mockGroups = [
    { id: 'grp001', name: 'フロントエンド勉強会', totalDurationSeconds: 7200, sessionIds: [] },
    { id: 'grp002', name: 'バックエンド勉強会', totalDurationSeconds: 3600, sessionIds: [] },
];

function createReadyItem(overrides = {}) {
    return {
        id: 'item-1',
        file: { name: 'test.csv', size: 1024 },
        status: 'ready',
        parseResult: {
            ok: true,
            mergeInput: {
                sessionId: 'grp001-2026-01-15',
                groupId: 'grp001',
                groupName: 'フロントエンド勉強会',
                date: '2026-01-15',
                attendances: [
                    { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                ],
            },
        },
        errors: [],
        warnings: [],
        hasDuplicate: false,
        ...overrides,
    };
}

describe('FileQueueCard — グループ選択プルダウン', () => {
    it('パース成功後にグループ選択プルダウンが表示される', () => {
        const item = createReadyItem();
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toBeInTheDocument();
    });

    it('既存グループが選択肢に表示される', () => {
        const item = createReadyItem();
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        const options = screen.getAllByRole('option');
        const optionTexts = options.map((o) => o.textContent);
        expect(optionTexts).toContain('フロントエンド勉強会');
        expect(optionTexts).toContain('バックエンド勉強会');
    });

    it('自動検出グループが既存と一致する場合デフォルト選択される', () => {
        const item = createReadyItem();
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        const select = screen.getByRole('combobox');
        expect(select.value).toBe('grp001');
    });

    it('自動検出グループが既存と一致しない場合「（新規）」オプションが表示される', () => {
        const item = createReadyItem({
            parseResult: {
                ok: true,
                mergeInput: {
                    sessionId: 'newgrp1-2026-01-15',
                    groupId: 'newgrp1',
                    groupName: '新しい勉強会',
                    date: '2026-01-15',
                    attendances: [
                        { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                    ],
                },
            },
        });

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        const options = screen.getAllByRole('option');
        const newOption = options.find((o) => o.textContent.includes('（新規）'));
        expect(newOption).toBeDefined();
        expect(newOption.textContent).toBe('（新規）新しい勉強会');
    });

    it('プルダウンで別グループを選択すると onSelectGroup が呼ばれる', async () => {
        const user = userEvent.setup();
        const onSelectGroup = vi.fn();
        const item = createReadyItem();

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={onSelectGroup}
            />
        );

        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'grp002');

        expect(onSelectGroup).toHaveBeenCalledWith('item-1', 'grp002', 'バックエンド勉強会');
    });
});

describe('FileQueueCard — missing_group ステータス', () => {
    it('missing_group 時にエラーメッセージが表示される', () => {
        const item = createReadyItem({
            status: 'missing_group',
            parseResult: {
                ok: true,
                mergeInput: {
                    sessionId: 'e3b0c442-2026-01-15',
                    groupId: 'e3b0c442',
                    groupName: '',
                    date: '2026-01-15',
                    attendances: [
                        { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                    ],
                },
            },
        });

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.getAllByText('グループを選択してください').length).toBeGreaterThanOrEqual(1);
    });

    it('missing_group 時にプルダウンの先頭が空のプレースホルダーになる', () => {
        const item = createReadyItem({
            status: 'missing_group',
            parseResult: {
                ok: true,
                mergeInput: {
                    sessionId: 'e3b0c442-2026-01-15',
                    groupId: 'e3b0c442',
                    groupName: '',
                    date: '2026-01-15',
                    attendances: [
                        { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                    ],
                },
            },
        });

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        const select = screen.getByRole('combobox');
        expect(select.value).toBe('');
    });
});

describe('FileQueueCard — プルダウンの無効化', () => {
    it('saving ステータスではプルダウンが disabled になる', () => {
        const item = createReadyItem({ status: 'saving' });

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toBeDisabled();
    });

    it('saved ステータスではプルダウンが disabled になる', () => {
        const item = createReadyItem({ status: 'saved' });

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        const select = screen.getByRole('combobox');
        expect(select).toBeDisabled();
    });
});

describe('FileQueueCard — ステータスアイコン', () => {
    it.each([
        ['pending', 'text-warning'],
        ['validating', 'text-warning'],
        ['saving', 'text-primary-600'],
        ['ready', 'text-success'],
        ['saved', 'text-success'],
        ['error', 'text-error'],
        ['save_failed', 'text-error'],
        ['duplicate_warning', 'text-warning'],
    ])('%s ステータスのアイコンが正しいクラスで表示される', (status, expectedClass) => {
        const item = createReadyItem({ status });
        const { container } = render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        const icon = container.querySelector(`.${expectedClass}`);
        expect(icon).toBeTruthy();
    });

    it('missing_group ステータスのアイコンが表示される', () => {
        const item = createReadyItem({
            status: 'missing_group',
            parseResult: {
                ok: true,
                mergeInput: {
                    sessionId: 'e3b0c442-2026-01-15',
                    groupId: 'e3b0c442',
                    groupName: '',
                    date: '2026-01-15',
                    attendances: [
                        { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                    ],
                },
            },
        });
        const { container } = render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        // missing_group は AlertTriangle (text-error)
        expect(container.querySelector('.text-error')).toBeTruthy();
    });
});

describe('FileQueueCard — ファイルサイズ表示', () => {
    it('1024バイト未満は B 表示される', () => {
        const item = createReadyItem({ file: { name: 'test.csv', size: 500 } });
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.getByText('(500 B)')).toBeInTheDocument();
    });

    it('1024バイト以上1MB未満は KB 表示される', () => {
        const item = createReadyItem({ file: { name: 'test.csv', size: 2048 } });
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.getByText('(2.0 KB)')).toBeInTheDocument();
    });

    it('1MB以上は MB 表示される', () => {
        const item = createReadyItem({
            file: { name: 'test.csv', size: 1024 * 1024 * 2.5 },
        });
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.getByText('(2.5 MB)')).toBeInTheDocument();
    });
});

describe('FileQueueCard — ボーダーカラー', () => {
    it.each([
        ['ready', 'border-l-green-500'],
        ['saved', 'border-l-green-500'],
        ['error', 'border-l-red-500'],
        ['save_failed', 'border-l-red-500'],
        ['missing_group', 'border-l-red-500'],
        ['duplicate_warning', 'border-l-amber-500'],
        ['saving', 'border-l-primary-500'],
        ['pending', 'border-l-gray-300'],
    ])('%s ステータスで %s ボーダーが適用される', (status, expectedBorder) => {
        const item = createReadyItem({
            status,
            ...(status === 'missing_group'
                ? {
                      parseResult: {
                          ok: true,
                          mergeInput: {
                              sessionId: 'e3b0c442-2026-01-15',
                              groupId: 'e3b0c442',
                              groupName: '',
                              date: '2026-01-15',
                              attendances: [
                                  {
                                      memberId: 'mem001',
                                      memberName: '佐藤 太郎',
                                      durationSeconds: 3600,
                                  },
                              ],
                          },
                      },
                  }
                : {}),
        });
        const { container } = render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        const card = container.firstChild;
        expect(card.className).toContain(expectedBorder);
    });
});

describe('FileQueueCard — エラー・警告表示', () => {
    it('error ステータス時にエラーメッセージが表示される', () => {
        const item = createReadyItem({
            status: 'error',
            parseResult: { ok: false },
            errors: ['パースエラー', 'フォーマット不正'],
        });
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.getByText('パースエラー, フォーマット不正')).toBeInTheDocument();
    });

    it('duplicate_warning ステータス時に警告メッセージと上書きボタンが表示される', () => {
        const item = createReadyItem({ status: 'duplicate_warning' });
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.getByText('重複セッションが検出されました')).toBeInTheDocument();
        expect(screen.getByText('上書き')).toBeInTheDocument();
    });

    it('上書きボタンをクリックすると onApproveDuplicate が呼ばれる', async () => {
        const user = userEvent.setup();
        const onApproveDuplicate = vi.fn();
        const item = createReadyItem({ status: 'duplicate_warning' });

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={onApproveDuplicate}
                onSelectGroup={vi.fn()}
            />
        );

        await user.click(screen.getByText('上書き'));
        expect(onApproveDuplicate).toHaveBeenCalledWith('item-1');
    });
});

describe('FileQueueCard — 削除ボタン', () => {
    it('通常ステータスで削除ボタンが表示される', () => {
        const item = createReadyItem();
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.getByText('削除')).toBeInTheDocument();
    });

    it('削除ボタンをクリックすると onRemove が呼ばれる', async () => {
        const user = userEvent.setup();
        const onRemove = vi.fn();
        const item = createReadyItem();

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={onRemove}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        await user.click(screen.getByText('削除'));
        expect(onRemove).toHaveBeenCalledWith('item-1');
    });

    it('saving ステータスでは削除ボタンが非表示', () => {
        const item = createReadyItem({ status: 'saving' });
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.queryByText('削除')).not.toBeInTheDocument();
    });

    it('saved ステータスでは削除ボタンが非表示', () => {
        const item = createReadyItem({ status: 'saved' });
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.queryByText('削除')).not.toBeInTheDocument();
    });
});

describe('FileQueueCard — 参加者テーブル展開', () => {
    it('クリックで参加者テーブルが展開される', async () => {
        const user = userEvent.setup();
        const item = createReadyItem({
            parseResult: {
                ok: true,
                mergeInput: {
                    sessionId: 'grp001-2026-01-15',
                    groupId: 'grp001',
                    groupName: 'フロントエンド勉強会',
                    date: '2026-01-15',
                    attendances: [
                        { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                        { memberId: 'mem002', memberName: '鈴木 花子', durationSeconds: 1800 },
                    ],
                },
            },
        });

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        // 展開前はテーブルが非表示
        expect(screen.queryByText('佐藤 太郎')).not.toBeInTheDocument();

        // サマリー行をクリックして展開
        const summaryRow = screen.getByText('2026-01-15').closest('div');
        await user.click(summaryRow);

        // 展開後はテーブルが表示される
        expect(screen.getByText('佐藤 太郎')).toBeInTheDocument();
        expect(screen.getByText('鈴木 花子')).toBeInTheDocument();
        expect(screen.getByText('参加者')).toBeInTheDocument();
        expect(screen.getByText('参加時間')).toBeInTheDocument();
    });

    it('saving ステータスでは展開できない', () => {
        const item = createReadyItem({ status: 'saving' });
        const { container } = render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        // saving 時は cursor-pointer がない
        const summaryRow = screen.getByText('2026-01-15').closest('div');
        expect(summaryRow.className).not.toContain('cursor-pointer');
    });
});

describe('FileQueueCard — 重複バッジ', () => {
    it('hasDuplicate が true の場合に重複バッジが表示される', () => {
        const item = createReadyItem({ hasDuplicate: true });
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.getByText('重複')).toBeInTheDocument();
    });
});

describe('FileQueueCard — グループ選択の新規グループ', () => {
    it('新規グループを選択すると onSelectGroup がグループ情報付きで呼ばれる', async () => {
        const user = userEvent.setup();
        const onSelectGroup = vi.fn();
        const item = createReadyItem({
            parseResult: {
                ok: true,
                mergeInput: {
                    sessionId: 'newgrp1-2026-01-15',
                    groupId: 'newgrp1',
                    groupName: '新しい勉強会',
                    date: '2026-01-15',
                    attendances: [
                        { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                    ],
                },
            },
        });

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={onSelectGroup}
            />
        );

        const select = screen.getByRole('combobox');
        await user.selectOptions(select, 'newgrp1');

        expect(onSelectGroup).toHaveBeenCalledWith('item-1', 'newgrp1', '新しい勉強会');
    });

    it('空の値が選択された場合 onSelectGroup は呼ばれない', async () => {
        const user = userEvent.setup();
        const onSelectGroup = vi.fn();
        const item = createReadyItem({
            status: 'missing_group',
            parseResult: {
                ok: true,
                mergeInput: {
                    sessionId: 'e3b0c442-2026-01-15',
                    groupId: 'e3b0c442',
                    groupName: '',
                    date: '2026-01-15',
                    attendances: [
                        { memberId: 'mem001', memberName: '佐藤 太郎', durationSeconds: 3600 },
                    ],
                },
            },
        });

        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={onSelectGroup}
            />
        );

        const select = screen.getByRole('combobox');
        // 空オプションを選択
        await user.selectOptions(select, '');

        expect(onSelectGroup).not.toHaveBeenCalled();
    });

    it('パース結果がない場合はサマリーセクションが非表示', () => {
        const item = createReadyItem({
            status: 'pending',
            parseResult: null,
        });
        render(
            <FileQueueCard
                item={item}
                groups={mockGroups}
                onRemove={vi.fn()}
                onApproveDuplicate={vi.fn()}
                onSelectGroup={vi.fn()}
            />
        );

        expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    });
});
