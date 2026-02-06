import { Check, X, AlertTriangle, Clock } from 'lucide-react';

/**
 * ステータスアイコンを返す
 * @param {string} status
 * @returns {import('react').ReactNode}
 */
function StatusIcon({ status }) {
  const size = 16;
  switch (status) {
    case 'pending':
    case 'validating':
    case 'saving':
      return <Clock size={size} className="text-warning" />;
    case 'ready':
    case 'saved':
      return <Check size={size} className="text-success" />;
    case 'error':
    case 'save_failed':
      return <X size={size} className="text-error" />;
    case 'duplicate_warning':
      return <AlertTriangle size={size} className="text-warning" />;
    default:
      return null;
  }
}

/**
 * ファイルサイズのフォーマット
 * @param {number} bytes
 * @returns {string}
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * ファイルキュー一覧コンポーネント
 * @param {{ queue: Array, onRemove: (id: string) => void, onApproveDuplicate: (id: string) => void }} props
 */
export function FileQueueList({ queue, onRemove, onApproveDuplicate }) {
  if (queue.length === 0) return null;

  return (
    <ul className="space-y-1 my-3">
      {queue.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-2 px-3 py-2 bg-surface border border-border-light rounded-lg text-sm animate-[fadeIn_0.3s_ease]"
          data-file-id={item.id}
        >
          <StatusIcon status={item.status} />
          <span className="font-medium text-text-primary">{item.file.name}</span>
          <span className="text-text-muted text-xs">({formatSize(item.file.size)})</span>

          {item.status === 'error' && (
            <span className="text-xs text-error bg-red-50 px-1.5 py-0.5 rounded">{item.errors.join(', ')}</span>
          )}

          {item.status === 'duplicate_warning' && (
            <>
              <span className="text-xs text-warning bg-amber-50 px-1.5 py-0.5 rounded">重複セッションが検出されました</span>
              <button
                className="text-xs px-2 py-0.5 rounded border border-accent-400 bg-accent-50 text-accent-600 hover:bg-accent-200 transition-colors"
                onClick={() => onApproveDuplicate(item.id)}
              >
                上書き
              </button>
            </>
          )}

          {item.status !== 'saving' && item.status !== 'saved' && (
            <button
              className="ml-auto text-xs px-2 py-0.5 rounded border border-border bg-surface text-error hover:bg-red-50 transition-colors"
              onClick={() => onRemove(item.id)}
            >
              削除
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
