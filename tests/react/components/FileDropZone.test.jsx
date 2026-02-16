import { render, screen, fireEvent } from '@testing-library/react';
import { FileDropZone } from '../../../src/components/FileDropZone.jsx';

describe('FileDropZone', () => {
  it('デフォルトのテキストが表示されること', () => {
    render(<FileDropZone onFilesAdded={() => {}} disabled={false} hasFiles={false} />);
    expect(screen.getByText(/Teams出席レポートCSV/)).toBeInTheDocument();
  });

  it('ファイルがある場合に「さらにファイルを追加」と表示すること', () => {
    render(<FileDropZone onFilesAdded={() => {}} disabled={false} hasFiles={true} />);
    expect(screen.getByText('さらにファイルを追加')).toBeInTheDocument();
  });

  it('ドラッグオーバー時にdragoverクラスが追加されること', () => {
    const { container } = render(
      <FileDropZone onFilesAdded={() => {}} disabled={false} hasFiles={false} />
    );

    // ドロップゾーンはborder-dashedクラスを持つdiv
    const dropZone = container.querySelector('.border-dashed');
    fireEvent.dragOver(dropZone);
    // ドラッグオーバー時にプライマリカラーのボーダーに変わる
    expect(dropZone.className).toContain('border-primary-500');
  });

  it('重複したdragOverイベントで不要な再レンダリングが防止されること', () => {
    const onFilesAdded = vi.fn();
    const { container } = render(
      <FileDropZone onFilesAdded={onFilesAdded} disabled={false} hasFiles={false} />
    );

    const dropZone = container.querySelector('.border-dashed');

    // 最初のdragOverイベント - dragover状態をtrueにする
    fireEvent.dragOver(dropZone);
    expect(dropZone.className).toContain('border-primary-500');

    // classNameを確認（変更されていることを確認）
    const classNameAfterFirstDrag = dropZone.className;

    // 2回目以降のdragOverイベント（ドラッグ継続中）
    // 内部のdragoverRef.currentがtrueなので早期returnされる
    fireEvent.dragOver(dropZone);
    fireEvent.dragOver(dropZone);
    fireEvent.dragOver(dropZone);

    // classNameが変わっていないことを確認（再レンダリングされていない）
    expect(dropZone.className).toBe(classNameAfterFirstDrag);
    expect(dropZone.className).toContain('border-primary-500');
  });

  it('ファイル選択時にonFilesAddedが呼ばれること', async () => {
    const onFilesAdded = vi.fn();
    const { container } = render(
      <FileDropZone onFilesAdded={onFilesAdded} disabled={false} hasFiles={false} />
    );

    const input = container.querySelector('input[type="file"]');
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });
    const fileList = { 0: file, length: 1, item: (i) => file };

    Object.defineProperty(input, 'files', { value: fileList, configurable: true });
    input.dispatchEvent(new Event('change', { bubbles: true }));

    expect(onFilesAdded).toHaveBeenCalled();
  });

  it('ドラッグリーブ時にdragoverクラスが削除されること', () => {
    const { container } = render(
      <FileDropZone onFilesAdded={() => {}} disabled={false} hasFiles={false} />
    );

    const dropZone = container.querySelector('.border-dashed');
    // ドラッグオーバー
    fireEvent.dragOver(dropZone);
    expect(dropZone.className).toContain('border-primary-500');

    // ドラッグリーブ
    fireEvent.dragLeave(dropZone);
    expect(dropZone.className).not.toContain('border-primary-500');
  });

  it('ファイルドロップ時にonFilesAddedが呼ばれること', () => {
    const onFilesAdded = vi.fn();
    const { container } = render(
      <FileDropZone onFilesAdded={onFilesAdded} disabled={false} hasFiles={false} />
    );

    const dropZone = container.querySelector('.border-dashed');
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(onFilesAdded).toHaveBeenCalledWith(expect.objectContaining({ 0: file }));
  });

  it('ファイルドロップ後にdragover状態がリセットされること', () => {
    const { container } = render(
      <FileDropZone onFilesAdded={() => {}} disabled={false} hasFiles={false} />
    );

    const dropZone = container.querySelector('.border-dashed');

    // ドラッグオーバーしてからドロップ
    fireEvent.dragOver(dropZone);
    expect(dropZone.className).toContain('border-primary-500');

    fireEvent.drop(dropZone, {
      dataTransfer: { files: [] },
    });

    // ドロップ後はdragover状態がリセット
    expect(dropZone.className).not.toContain('border-primary-500');
  });

  it('disabled時にドラッグオーバーしてもdragoverクラスが追加されないこと', () => {
    const { container } = render(
      <FileDropZone onFilesAdded={() => {}} disabled={true} hasFiles={false} />
    );

    const dropZone = container.querySelector('.border-dashed');
    fireEvent.dragOver(dropZone);
    expect(dropZone.className).not.toContain('border-primary-500');
  });

  it('disabled時にファイルドロップしてもonFilesAddedが呼ばれないこと', () => {
    const onFilesAdded = vi.fn();
    const { container } = render(
      <FileDropZone onFilesAdded={onFilesAdded} disabled={true} hasFiles={false} />
    );

    const dropZone = container.querySelector('.border-dashed');
    const file = new File(['content'], 'test.csv', { type: 'text/csv' });

    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file],
      },
    });

    expect(onFilesAdded).not.toHaveBeenCalled();
  });

  it('空ファイルリストのドロップではonFilesAddedが呼ばれないこと', () => {
    const onFilesAdded = vi.fn();
    const { container } = render(
      <FileDropZone onFilesAdded={onFilesAdded} disabled={false} hasFiles={false} />
    );

    const dropZone = container.querySelector('.border-dashed');
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [] },
    });

    expect(onFilesAdded).not.toHaveBeenCalled();
  });

  it('input要素がdisabled時にdisabled属性を持つこと', () => {
    const { container } = render(
      <FileDropZone onFilesAdded={() => {}} disabled={true} hasFiles={false} />
    );

    const input = container.querySelector('input[type="file"]');
    expect(input).toBeDisabled();
  });
});
