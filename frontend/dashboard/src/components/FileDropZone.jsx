import { useState, useCallback, useRef } from 'react';

/**
 * ファイルドラッグ&ドロップ + ファイル選択コンポーネント
 * @param {{ onFilesAdded: (files: FileList) => void, disabled: boolean, hasFiles: boolean }} props
 */
export function FileDropZone({ onFilesAdded, disabled, hasFiles }) {
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    if (!disabled) setDragover(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setDragover(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragover(false);
    if (!disabled && e.dataTransfer.files.length > 0) {
      onFilesAdded(e.dataTransfer.files);
    }
  }, [disabled, onFilesAdded]);

  const handleFileChange = useCallback((e) => {
    if (e.target.files.length > 0) {
      onFilesAdded(e.target.files);
      e.target.value = '';
    }
  }, [onFilesAdded]);

  const classNames = [
    'csv-drop-zone',
    dragover ? 'dragover' : '',
    hasFiles ? 'compact' : '',
  ].filter(Boolean).join(' ');

  const text = dragover
    ? 'ここにドロップ'
    : hasFiles
      ? 'さらにファイルを追加'
      : 'Teams出席レポートCSVをドラッグ&ドロップ、またはファイルを選択';

  return (
    <div
      className={classNames}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="drop-zone-icon">&#128196;</div>
      <div className="drop-zone-text">{text}</div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        disabled={disabled}
        onChange={handleFileChange}
      />
    </div>
  );
}
