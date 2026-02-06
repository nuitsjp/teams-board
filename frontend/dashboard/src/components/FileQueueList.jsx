/**
 * ステータスアイコンを返す
 * @param {string} status
 * @returns {string}
 */
function statusIcon(status) {
  switch (status) {
    case 'pending':
    case 'validating':
      return '⏳';
    case 'ready':
      return '✓';
    case 'saving':
      return '⏳';
    case 'saved':
      return '✓';
    case 'error':
    case 'save_failed':
      return '✗';
    case 'duplicate_warning':
      return '⚠';
    default:
      return '';
  }
}

/**
 * ステータスアイコンのCSSクラス
 * @param {string} status
 * @returns {string}
 */
function statusClass(status) {
  switch (status) {
    case 'pending':
    case 'validating':
    case 'saving':
      return 'pending';
    case 'ready':
    case 'saved':
      return 'success';
    case 'error':
    case 'save_failed':
      return 'failure';
    case 'duplicate_warning':
      return 'warning';
    default:
      return '';
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
    <ul className="queue-list">
      {queue.map((item) => (
        <li key={item.id} className={`queue-item queue-item-${item.status}`} data-file-id={item.id}>
          <span className={`status-icon ${statusClass(item.status)}`}>
            {statusIcon(item.status)}
          </span>
          <span className="queue-item-name">{item.file.name}</span>
          <span className="queue-item-size">({formatSize(item.file.size)})</span>

          {item.status === 'error' && (
            <span className="queue-item-error msg-error">{item.errors.join(', ')}</span>
          )}

          {item.status === 'duplicate_warning' && (
            <>
              <span className="queue-item-warning msg-warning">重複セッションが検出されました</span>
              <button
                className="btn btn-sm btn-approve"
                onClick={() => onApproveDuplicate(item.id)}
              >
                上書き
              </button>
            </>
          )}

          {item.status !== 'saving' && item.status !== 'saved' && (
            <button
              className="btn btn-sm btn-remove"
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
