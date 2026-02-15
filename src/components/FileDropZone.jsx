import { useState, useCallback, useRef } from 'react';
import { Upload } from 'lucide-react';

/**
 * ファイルドラッグ&ドロップ + ファイル選択コンポーネント
 * @param {{ onFilesAdded: (files: FileList) => void, disabled: boolean, hasFiles: boolean }} props
 */
export function FileDropZone({ onFilesAdded, disabled, hasFiles }) {
  const [dragover, setDragover] = useState(false);
  const fileInputRef = useRef(null);
  const dragoverRef = useRef(false);
  const disabledRef = useRef(disabled);

  // disabledの最新値をrefに同期
  disabledRef.current = disabled;

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    // 既にドラッグオーバー状態なら早期return（不要な再レンダリング防止）
    if (dragoverRef.current) return;
    // disabledの最新値を参照
    if (disabledRef.current) return;
    
    dragoverRef.current = true;
    setDragover(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    dragoverRef.current = false;
    setDragover(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      dragoverRef.current = false;
      setDragover(false);
      if (!disabledRef.current && e.dataTransfer.files.length > 0) {
        onFilesAdded(e.dataTransfer.files);
      }
    },
    [onFilesAdded]
  );

  const handleFileChange = useCallback(
    (e) => {
      if (e.target.files.length > 0) {
        onFilesAdded(e.target.files);
        e.target.value = '';
      }
    },
    [onFilesAdded]
  );

  const text = dragover
    ? 'ここにドロップ'
    : hasFiles
      ? 'さらにファイルを追加'
      : 'Teams出席レポートCSVをドラッグ&ドロップ、またはファイルを選択';

  return (
    <div
      className={[
        'border-2 border-dashed rounded-lg text-center transition-all',
        hasFiles ? 'py-3 px-4 text-sm' : 'py-8 px-6',
        dragover
          ? 'border-primary-500 text-primary-600 bg-primary-50'
          : 'border-border text-text-muted hover:border-primary-300',
      ].join(' ')}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <Upload
        className={`mx-auto text-text-muted ${hasFiles ? 'w-5 h-5 inline mr-2' : 'w-8 h-8 mb-3'}`}
      />
      <span className={hasFiles ? '' : 'block mb-3'}>{text}</span>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        multiple
        disabled={disabled}
        onChange={handleFileChange}
        className="mt-2 text-sm file:mr-3 file:py-1.5 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 file:cursor-pointer"
      />
    </div>
  );
}
