/**
 * 一括保存の進捗バーコンポーネント
 * @param {{ current: number, total: number, visible: boolean, statusText: string }} props
 */
export function ProgressBar({ current, total, visible, statusText }) {
  if (!visible) return null;

  return (
    <div className="save-progress">
      <progress value={current} max={total}></progress>
      <div className="save-status">{statusText || '保存中...'}</div>
    </div>
  );
}
