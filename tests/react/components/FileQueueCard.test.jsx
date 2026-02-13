import { render, screen } from '@testing-library/react';
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
