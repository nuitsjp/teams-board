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

    const dropZone = container.querySelector('.csv-drop-zone');
    fireEvent.dragOver(dropZone);
    expect(dropZone.classList.contains('dragover')).toBe(true);
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
});
