import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionEditorPanel } from '../../../src/components/SessionEditorPanel.jsx';

describe('SessionEditorPanel', () => {
    const defaultSession = {
        _ref: 'session1/0',
        startedAt: '2026-02-08T19:00:00',
        title: 'テストセッション',
    };

    it('セッション未選択時にプレースホルダが表示される', () => {
        render(
            <SessionEditorPanel
                session={null}
                sessionName=""
                onSessionNameChange={vi.fn()}
                onSave={vi.fn()}
                saving={false}
                message={{ type: '', text: '' }}
            />
        );

        expect(
            screen.getByText('左のグループからセッションを選択してください')
        ).toBeInTheDocument();
    });

    it('セッション選択時に編集フォームが表示される', () => {
        render(
            <SessionEditorPanel
                session={defaultSession}
                sessionName="テスト名"
                onSessionNameChange={vi.fn()}
                onSave={vi.fn()}
                saving={false}
                message={{ type: '', text: '' }}
            />
        );

        expect(screen.getByText('session1/0')).toBeInTheDocument();
        expect(screen.getByText('2026-02-08')).toBeInTheDocument();
        expect(screen.getByDisplayValue('テスト名')).toBeInTheDocument();
        expect(screen.getByText('講師')).toBeInTheDocument();
        expect(screen.getByText('この機能は今後のアップデートで実装予定です')).toBeInTheDocument();
    });

    it('startedAt が null の場合「日付なし」が表示される', () => {
        render(
            <SessionEditorPanel
                session={{ _ref: 'session1/0', startedAt: null }}
                sessionName=""
                onSessionNameChange={vi.fn()}
                onSave={vi.fn()}
                saving={false}
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
                session={defaultSession}
                sessionName="新しい名前"
                onSessionNameChange={vi.fn()}
                onSave={onSave}
                saving={false}
                message={{ type: '', text: '' }}
            />
        );

        await user.click(screen.getByRole('button', { name: '保存' }));
        expect(onSave).toHaveBeenCalledWith('session1/0', '新しい名前');
    });

    it('Enter キーで onSave が呼ばれる', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();

        render(
            <SessionEditorPanel
                session={defaultSession}
                sessionName="テスト"
                onSessionNameChange={vi.fn()}
                onSave={onSave}
                saving={false}
                message={{ type: '', text: '' }}
            />
        );

        const input = screen.getByRole('textbox');
        await user.click(input);
        await user.keyboard('{Enter}');
        expect(onSave).toHaveBeenCalledWith('session1/0', 'テスト');
    });

    it('Enter 以外のキーでは onSave が呼ばれない', async () => {
        const user = userEvent.setup();
        const onSave = vi.fn();

        render(
            <SessionEditorPanel
                session={defaultSession}
                sessionName="テスト"
                onSessionNameChange={vi.fn()}
                onSave={onSave}
                saving={false}
                message={{ type: '', text: '' }}
            />
        );

        const input = screen.getByRole('textbox');
        await user.click(input);
        await user.keyboard('a');
        expect(onSave).not.toHaveBeenCalled();
    });

    it('IME 変換中の Enter では onSave が呼ばれない', async () => {
        const { fireEvent } = await import('@testing-library/react');
        const onSave = vi.fn();

        render(
            <SessionEditorPanel
                session={defaultSession}
                sessionName="テスト"
                onSessionNameChange={vi.fn()}
                onSave={onSave}
                saving={false}
                message={{ type: '', text: '' }}
            />
        );

        const input = screen.getByRole('textbox');
        fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
        expect(onSave).not.toHaveBeenCalled();
    });

    it('成功メッセージが表示される', () => {
        render(
            <SessionEditorPanel
                session={defaultSession}
                sessionName=""
                onSessionNameChange={vi.fn()}
                onSave={vi.fn()}
                saving={false}
                message={{ type: 'success', text: '保存しました' }}
            />
        );

        expect(screen.getByText('保存しました')).toBeInTheDocument();
    });

    it('エラーメッセージが表示される', () => {
        render(
            <SessionEditorPanel
                session={defaultSession}
                sessionName=""
                onSessionNameChange={vi.fn()}
                onSave={vi.fn()}
                saving={false}
                message={{ type: 'error', text: '保存に失敗しました' }}
            />
        );

        expect(screen.getByText('保存に失敗しました')).toBeInTheDocument();
    });

    it('saving 中は入力とボタンが無効になる', () => {
        render(
            <SessionEditorPanel
                session={defaultSession}
                sessionName="テスト"
                onSessionNameChange={vi.fn()}
                onSave={vi.fn()}
                saving={true}
                message={{ type: '', text: '' }}
            />
        );

        expect(screen.getByRole('textbox')).toBeDisabled();
        expect(screen.getByRole('button', { name: '保存' })).toBeDisabled();
    });

    it('入力変更時に onSessionNameChange が呼ばれる', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();

        render(
            <SessionEditorPanel
                session={defaultSession}
                sessionName=""
                onSessionNameChange={onChange}
                onSave={vi.fn()}
                saving={false}
                message={{ type: '', text: '' }}
            />
        );

        await user.type(screen.getByRole('textbox'), 'A');
        expect(onChange).toHaveBeenCalledWith('A');
    });
});
