import { memo } from 'react';

/**
 * 一括保存の進捗バーコンポーネント
 * @param {{ current: number, total: number, visible: boolean, statusText: string }} props
 */
export const ProgressBar = memo(function ProgressBar({ current, total, visible, statusText }) {
  if (!visible) return null;

  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="my-4 space-y-2">
      <div className="w-full h-3 bg-surface-muted rounded-full overflow-hidden border border-border-light">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="text-center text-sm text-text-secondary">
        {statusText || '保存中...'} ({percentage}%)
      </div>
    </div>
  );
});
