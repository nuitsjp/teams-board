import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InstructorSelector } from '../../../../src/components/InstructorSelector.jsx';
import { MemberSelector } from '../../../../src/components/MemberSelector.jsx';

const defaultMembers = [
    { id: 'member-1', name: 'Suzuki Taro' },
    { id: 'member-2', name: 'Tanaka Koji' },
    { id: 'member-3', name: 'Yamada Hanako' },
];

describe('InstructorSelector', () => {
    it('初期状態で検索入力が表示される', () => {
        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        expect(screen.getByText('講師')).toBeInTheDocument();
        expect(screen.getByRole('combobox')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('メンバーを検索または新規追加...')).toBeInTheDocument();
    });

    it('選択済み講師がタグ表示される', () => {
        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={['member-1', 'member-3']}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        expect(screen.getByText('Suzuki Taro')).toBeInTheDocument();
        expect(screen.getByText('Yamada Hanako')).toBeInTheDocument();
    });

    it('入力フォーカスでドロップダウンが表示される', async () => {
        const user = userEvent.setup();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        await user.click(screen.getByRole('combobox'));

        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByText('Suzuki Taro')).toBeInTheDocument();
        expect(screen.getByText('Tanaka Koji')).toBeInTheDocument();
        expect(screen.getByText('Yamada Hanako')).toBeInTheDocument();
    });

    it('検索テキストでメンバーがフィルタリングされる', async () => {
        const user = userEvent.setup();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        await user.type(screen.getByRole('combobox'), 'Suzuki');

        expect(screen.getByText('Suzuki Taro')).toBeInTheDocument();
        expect(screen.queryByText('Tanaka Koji')).not.toBeInTheDocument();
        expect(screen.queryByText('Yamada Hanako')).not.toBeInTheDocument();
    });

    it('メンバーをクリックで選択すると onInstructorChange が呼ばれる', async () => {
        const user = userEvent.setup();
        const onInstructorChange = vi.fn();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={onInstructorChange}
                onAddNewMember={vi.fn()}
            />
        );

        await user.click(screen.getByRole('combobox'));
        await user.click(screen.getByText('Tanaka Koji'));

        expect(onInstructorChange).toHaveBeenCalledWith(['member-2']);
    });

    it('選択済みメンバーはドロップダウンに表示されない', async () => {
        const user = userEvent.setup();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={['member-1']}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        await user.click(screen.getByRole('combobox'));

        // member-1 はタグとして表示されるが、ドロップダウンの option には表示されない
        const options = screen.getAllByRole('option');
        const optionTexts = options.map((option) => option.textContent);
        expect(optionTexts).not.toContain('Suzuki Taro');
        expect(optionTexts).toContain('Tanaka Koji');
    });

    it('削除ボタンで講師を除外すると onInstructorChange が呼ばれる', async () => {
        const user = userEvent.setup();
        const onInstructorChange = vi.fn();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={['member-1', 'member-2']}
                onInstructorChange={onInstructorChange}
                onAddNewMember={vi.fn()}
            />
        );

        await user.click(screen.getByLabelText('Suzuki Taro を削除'));

        expect(onInstructorChange).toHaveBeenCalledWith(['member-2']);
    });

    it('一致しない名前を入力すると新規追加オプションが表示される', async () => {
        const user = userEvent.setup();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        await user.type(screen.getByRole('combobox'), '新しい講師');

        expect(screen.getByText(/「新しい講師」を新しい講師として追加/)).toBeInTheDocument();
    });

    it('新規講師追加で onAddNewMember が呼ばれ、返された ID で onInstructorChange が呼ばれる', async () => {
        const user = userEvent.setup();
        const onAddNewMember = vi.fn().mockResolvedValue('new-member-id');
        const onInstructorChange = vi.fn();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={['member-1']}
                onInstructorChange={onInstructorChange}
                onAddNewMember={onAddNewMember}
            />
        );

        await user.type(screen.getByRole('combobox'), '新しい講師');
        await user.click(screen.getByText(/「新しい講師」を新しい講師として追加/));

        expect(onAddNewMember).toHaveBeenCalledWith('新しい講師');
        expect(onInstructorChange).toHaveBeenCalledWith(['member-1', 'new-member-id']);
    });

    it('disabled 時に入力が無効になる', () => {
        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={['member-1']}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
                disabled={true}
            />
        );

        expect(screen.getByRole('combobox')).toBeDisabled();
        expect(screen.getByLabelText('Suzuki Taro を削除')).toBeDisabled();
    });

    it('disabled 時にドロップダウンが表示されない', async () => {
        const user = userEvent.setup();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
                disabled={true}
            />
        );

        await user.click(screen.getByRole('combobox'));

        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('Escape キーでドロップダウンが閉じる', async () => {
        const user = userEvent.setup();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        await user.click(screen.getByRole('combobox'));
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('メンバーが空の場合に「該当するメンバーがありません」が表示される', async () => {
        const user = userEvent.setup();

        render(
            <InstructorSelector
                members={[]}
                selectedInstructorIds={[]}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        await user.click(screen.getByRole('combobox'));

        expect(screen.getByText('該当するアイテムがありません')).toBeInTheDocument();
    });

    it('IME 入力中は Escape キーが無視される', async () => {
        const user = userEvent.setup();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        const combobox = screen.getByRole('combobox');
        await user.click(combobox);
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        // IME 入力中の Escape はドロップダウンを閉じない
        combobox.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true })
        );
        expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('ドロップダウンが既に開いている状態で入力しても正常に動作する', async () => {
        const user = userEvent.setup();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        await user.click(screen.getByRole('combobox'));
        expect(screen.getByRole('listbox')).toBeInTheDocument();

        // ドロップダウンが開いている状態で入力
        await user.type(screen.getByRole('combobox'), 'Suzuki');
        expect(screen.getByRole('listbox')).toBeInTheDocument();
        expect(screen.getByText('Suzuki Taro')).toBeInTheDocument();
    });

    it('選択済み講師の ID がメンバーに見つからない場合 ID がそのまま表示される', () => {
        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={['unknown-id']}
                onInstructorChange={vi.fn()}
                onAddNewMember={vi.fn()}
            />
        );

        expect(screen.getByText('unknown-id')).toBeInTheDocument();
        expect(screen.getByLabelText('unknown-id を削除')).toBeInTheDocument();
    });

    it('onAddNewMember が null を返した場合に onInstructorChange が呼ばれない', async () => {
        const user = userEvent.setup();
        const onAddNewMember = vi.fn().mockResolvedValue(null);
        const onInstructorChange = vi.fn();

        render(
            <InstructorSelector
                members={defaultMembers}
                selectedInstructorIds={[]}
                onInstructorChange={onInstructorChange}
                onAddNewMember={onAddNewMember}
            />
        );

        await user.type(screen.getByRole('combobox'), '新しい講師');
        await user.click(screen.getByText(/「新しい講師」を新しい講師として追加/));

        expect(onAddNewMember).toHaveBeenCalledWith('新しい講師');
        expect(onInstructorChange).not.toHaveBeenCalled();
    });
});

describe('MemberSelector — single-select (multiple=false)', () => {
    it('multiple=false 時にアイテム選択で既存選択が置換されること', async () => {
        const user = userEvent.setup();
        const onSelectionChange = vi.fn();

        render(
            <MemberSelector
                items={defaultMembers}
                selectedIds={['member-1']}
                onSelectionChange={onSelectionChange}
                onAddNew={vi.fn()}
                multiple={false}
            />
        );

        await user.click(screen.getByRole('combobox'));
        await user.click(screen.getByText('Tanaka Koji'));

        // multiple=false なので既存の member-1 は置換され [member-2] のみ
        expect(onSelectionChange).toHaveBeenCalledWith(['member-2']);
    });

    it('multiple=false 時に新規追加で selectedIds が置換されること', async () => {
        const user = userEvent.setup();
        const onAddNew = vi.fn().mockResolvedValue('new-id');
        const onSelectionChange = vi.fn();

        render(
            <MemberSelector
                items={defaultMembers}
                selectedIds={['member-1']}
                onSelectionChange={onSelectionChange}
                onAddNew={onAddNew}
                multiple={false}
                addNewLabelFn={(name) => `「${name}」を新しい主催者として追加`}
            />
        );

        await user.type(screen.getByRole('combobox'), '新しい主催者');
        await user.click(screen.getByText(/「新しい主催者」を新しい主催者として追加/));

        expect(onAddNew).toHaveBeenCalledWith('新しい主催者');
        expect(onSelectionChange).toHaveBeenCalledWith(['new-id']);
    });

    it('カスタム label と searchPlaceholder が表示されること', () => {
        render(
            <MemberSelector
                items={defaultMembers}
                selectedIds={[]}
                onSelectionChange={vi.fn()}
                onAddNew={vi.fn()}
                label="主催者"
                searchPlaceholder="主催者を検索..."
            />
        );

        expect(screen.getByText('主催者')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('主催者を検索...')).toBeInTheDocument();
    });
});
