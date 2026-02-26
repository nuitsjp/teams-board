import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionEditorPanel } from '../../../src/components/SessionEditorPanel.jsx';

describe('SessionEditorPanel', () => {
    const defaultSession = {
        _ref: 'session1/0',
        startedAt: '2026-02-08T19:00:00',
        title: 'テストセッション',
        instructors: ['member-1'],
    };

    const defaultMembers = [
        { id: 'member-1', name: 'Suzuki Taro' },
        { id: 'member-2', name: 'Tanaka Koji' },
    ];

    const defaultProps = {
        sessionName: '',
        onSessionNameChange: vi.fn(),
        onSave: vi.fn(),
        saving: false,
        message: { type: '', text: '' },
        members: defaultMembers,
        instructorIds: [],
        onInstructorChange: vi.fn(),
        onAddNewMember: vi.fn(),
    };

    it('セッション未選択時にプレースホルダが表示される', () => {
        render(
            <SessionEditorPanel
                {...defaultProps}
                session={null}
            />
        );

        expect(
            screen.getByText('左のグループからセッションを選択してください')
        ).toBeInTheDocument();
    });

    it('セッション選択時に編集フォームが表示される', () => {
        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                sessionName="テスト名"
            />
        );

        expect(screen.getByText('session1/0')).toBeInTheDocument();
        expect(screen.getByText('2026-02-08')).toBeInTheDocument();
        expect(screen.getByDisplayValue('テスト名')).toBeInTheDocument();
        expect(screen.getByText('講師')).toBeInTheDocument();
    });

    it('startedAt が null の場合「日付なし」が表示される', () => {
        render(
            <SessionEditorPanel
                {...defaultProps}
                session={{ _ref: 'session1/0', startedAt: null }}
                message={null}
            />
        );

        expect(screen.getByText('日付なし')).toBeInTheDocument();
    });

    it('保存ボタンクリックで onSave が呼ばれる', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();

        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                sessionName="新しい名前"
                onSave={onSave}
                instructorIds={['member-1']}
            />
        );

        await user.click(screen.getByRole('button', { name: '保存' }));
        expect(onSave).toHaveBeenCalledWith('session1/0', '新しい名前', ['member-1']);
    });

    it('Enter キーで onSave が呼ばれる', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();

        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                sessionName="テスト"
                onSave={onSave}
                instructorIds={[]}
            />
        );

        const input = screen.getByLabelText(/のセッション名/);
        await user.click(input);
        await user.keyboard('{Enter}');
        expect(onSave).toHaveBeenCalledWith('session1/0', 'テスト', []);
    });

    it('Enter 以外のキーでは onSave が呼ばれない', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();

        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                sessionName="テスト"
                onSave={onSave}
            />
        );

        const input = screen.getByLabelText(/のセッション名/);
        await user.click(input);
        await user.keyboard('a');
        expect(onSave).not.toHaveBeenCalled();
    });

    it('IME 変換中の Enter では onSave が呼ばれない', async () => {
        const { fireEvent } = await import('@testing-library/react');
        const onSave = vi.fn();

        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                sessionName="テスト"
                onSave={onSave}
            />
        );

        const input = screen.getByLabelText(/のセッション名/);
        fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
        expect(onSave).not.toHaveBeenCalled();
    });

    it('成功メッセージが表示される', () => {
        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                message={{ type: 'success', text: '保存しました' }}
            />
        );

        expect(screen.getByText('保存しました')).toBeInTheDocument();
    });

    it('エラーメッセージが表示される', () => {
        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                message={{ type: 'error', text: '保存に失敗しました' }}
            />
        );

        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument();
    });

    it('saving 中は入力とボタンが無効になる', () => {
        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                sessionName="テスト"
                saving={true}
            />
        );

        expect(screen.getByLabelText(/のセッション名/)).toBeDisabled();
        expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    });

    it('入力変更時に onSessionNameChange が呼ばれる', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                onSessionNameChange={onChange}
            />
        );

        await user.type(screen.getByLabelText(/のセッション名/), 'A');
        expect(onChange).toHaveBeenCalledWith('A');
    });

    it('講師セクションに InstructorSelector が表示される', () => {
        render(
            <SessionEditorPanel
                {...defaultProps}
                session={defaultSession}
                members={[{ id: 'member-1', name: 'Suzuki Taro' }]}
                instructorIds={['member-1']}
            />
        );

        expect(screen.getByText('講師')).toBeInTheDocument();
        expect(screen.getByText('Suzuki Taro')).toBeInTheDocument();
        expect(screen.getByLabelText('講師を検索')).toBeInTheDocument();
    });
});
