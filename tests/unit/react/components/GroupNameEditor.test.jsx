import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GroupNameEditor } from '../../../../src/components/GroupNameEditor.jsx';

describe('GroupNameEditor', () => {
  it('表示モードで初期グループ名と編集ボタンを表示する', () => {
    const onSave = vi.fn();
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    expect(screen.getByText('テストグループ')).toBeInTheDocument();
    expect(screen.getByTitle('グループ名を編集')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('編集ボタンをクリックすると編集モードに切り替わる', () => {
    const onSave = vi.fn();
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('テストグループ');
    expect(screen.getByTitle('保存')).toBeInTheDocument();
    expect(screen.getByTitle('キャンセル')).toBeInTheDocument();
  });

  it('編集モードで入力値を変更できる', () => {
    const onSave = vi.fn();
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: '新しいグループ名' } });

    expect(input).toHaveValue('新しいグループ名');
  });

  it('保存ボタンをクリックするとonSaveが呼ばれ、成功時は表示モードに戻る', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '新しいグループ名' } });
    fireEvent.click(screen.getByTitle('保存'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('group1', '新しいグループ名');
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });

  it('onSaveが失敗した場合は編集モードのままになる', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '新しいグループ名' } });
    fireEvent.click(screen.getByTitle('保存'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('group1', '新しいグループ名');
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  it('キャンセルボタンをクリックすると編集内容を破棄して表示モードに戻る', () => {
    const onSave = vi.fn();
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '新しいグループ名' } });
    fireEvent.click(screen.getByTitle('キャンセル'));

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText('テストグループ')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('Enterキーで保存できる', async () => {
    const onSave = vi.fn().mockResolvedValue(true);
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '新しいグループ名' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith('group1', '新しいグループ名');
    });
  });

  it('Escapeキーでキャンセルできる', () => {
    const onSave = vi.fn();
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '新しいグループ名' } });
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('バリデーション: 空文字の場合はエラーメッセージを表示する', async () => {
    const onSave = vi.fn();
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.click(screen.getByTitle('保存'));

    await waitFor(() => {
      expect(screen.getByText('グループ名を入力してください')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('バリデーション: 空白のみの場合はエラーメッセージを表示する', async () => {
    const onSave = vi.fn();
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByTitle('保存'));

    await waitFor(() => {
      expect(screen.getByText('グループ名を入力してください')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('バリデーション: 256文字超過の場合はエラーメッセージを表示する', async () => {
    const onSave = vi.fn();
    render(<GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />);

    fireEvent.click(screen.getByTitle('グループ名を編集'));
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'あ'.repeat(257) } });
    fireEvent.click(screen.getByTitle('保存'));

    await waitFor(() => {
      expect(screen.getByText('グループ名は256文字以内で入力してください')).toBeInTheDocument();
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it('disabled=trueの場合、編集ボタンが無効化される', () => {
    const onSave = vi.fn();
    render(
      <GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} disabled />
    );

    const editButton = screen.getByTitle('グループ名を編集');
    expect(editButton).toBeDisabled();
  });

  it('編集モード中にdisabled=trueになると、保存とキャンセルボタンが無効化される', () => {
    const onSave = vi.fn();
    const { rerender } = render(
      <GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} />
    );

    fireEvent.click(screen.getByTitle('グループ名を編集'));

    rerender(
      <GroupNameEditor groupId="group1" initialName="テストグループ" onSave={onSave} disabled />
    );

    expect(screen.getByTitle('保存')).toBeDisabled();
    expect(screen.getByTitle('キャンセル')).toBeDisabled();
  });
});
