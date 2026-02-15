import { useState, memo } from 'react';
import { Check, X, AlertTriangle, Clock, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { formatDuration } from '../utils/format-duration.js';

/**
 * ステータスアイコンを返す
 * @param {{ status: string }} props
 */
function StatusIcon({ status }) {
  const size = 16;
  switch (status) {
    case 'pending':
    case 'validating':
      return <Clock size={size} className="text-warning" />;
    case 'saving':
      return <Loader2 size={size} className="text-primary-600 animate-spin" />;
    case 'ready':
    case 'saved':
      return <Check size={size} className="text-success" />;
    case 'error':
    case 'save_failed':
      return <X size={size} className="text-error" />;
    case 'missing_group':
      return <AlertTriangle size={size} className="text-error" />;
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
 * ステータスに応じた左ボーダーカラーのクラスを返す
 * @param {string} status
 * @returns {string}
 */
function getBorderColorClass(status) {
  switch (status) {
    case 'ready':
    case 'saved':
      return 'border-l-green-500';
    case 'error':
    case 'save_failed':
    case 'missing_group':
      return 'border-l-red-500';
    case 'duplicate_warning':
      return 'border-l-amber-500';
    case 'saving':
      return 'border-l-primary-500';
    default:
      return 'border-l-gray-300';
  }
}

/**
 * 統合ファイルキューカード
 * 1ファイル = 1カード。ファイルメタ + パース結果サマリー + 展開テーブル + エラー/警告 + アクションボタン
 *
 * @param {{ item: object, groups: Array, onRemove: (id: string) => void, onApproveDuplicate: (id: string) => void, onSelectGroup: (fileId: string, groupId: string, groupName: string) => void }} props
 */
export const FileQueueCard = memo(function FileQueueCard({ item, groups = [], onRemove, onApproveDuplicate, onSelectGroup }) {
  const [expanded, setExpanded] = useState(false);

  const hasParseResult = item.parseResult && item.parseResult.ok;
  const canExpand = hasParseResult && item.status !== 'saving';
  const isMissingGroup = item.status === 'missing_group';

  // パース結果からサマリー情報を抽出
  const mergeInput = hasParseResult ? item.parseResult.mergeInput : null;

  // 表示用のグループ情報（上書きがあればそちらを優先）
  const displayGroupId = item.groupOverride?.groupId ?? mergeInput?.groupId;

  // 自動検出グループが既存グループに含まれるか
  const isAutoDetectedExisting = mergeInput && groups.some((g) => g.id === mergeInput.groupId);
  const isDisabled = item.status === 'saving' || item.status === 'saved';
  const totalDuration = mergeInput
    ? mergeInput.attendances.reduce((sum, a) => sum + a.durationSeconds, 0)
    : 0;

  return (
    <div
      className={`card-base overflow-hidden border-l-4 ${getBorderColorClass(item.status)} animate-scale-in`}
      data-file-id={item.id}
    >
      {/* ファイルメタ行 */}
      <div className="flex items-center gap-2 px-4 py-3">
        <StatusIcon status={item.status} />
        <span className="font-medium text-text-primary">{item.file.name}</span>
        <span className="text-text-muted text-xs">({formatSize(item.file.size)})</span>

        {/* エラー表示 */}
        {item.status === 'error' && (
          <span className="text-xs text-error bg-red-50 px-1.5 py-0.5 rounded">
            {item.errors.join(', ')}
          </span>
        )}

        {/* グループ未選択の警告 */}
        {isMissingGroup && (
          <span className="text-xs text-error bg-red-50 px-1.5 py-0.5 rounded">
            グループを選択してください
          </span>
        )}

        {/* 重複警告 + 上書きボタン */}
        {item.status === 'duplicate_warning' && (
          <>
            <span className="text-xs text-warning bg-amber-50 px-1.5 py-0.5 rounded">
              重複セッションが検出されました
            </span>
            <button
              className="text-xs px-2 py-0.5 rounded border border-accent-400 bg-accent-50 text-accent-600 hover:bg-accent-200 transition-colors"
              onClick={() => onApproveDuplicate(item.id)}
            >
              上書き
            </button>
          </>
        )}

        {/* 削除ボタン */}
        {item.status !== 'saving' && item.status !== 'saved' && (
          <button
            className="ml-auto text-xs px-2 py-0.5 rounded border border-border bg-surface text-error hover:bg-red-50 transition-colors"
            onClick={() => onRemove(item.id)}
          >
            削除
          </button>
        )}
      </div>

      {/* パース結果サマリー（パース成功時のみ表示） */}
      {hasParseResult && (
        <>
          <div className="border-t border-border-light" />
          <div
            className={`flex flex-wrap items-center gap-3 px-4 py-3 ${canExpand ? 'cursor-pointer hover:bg-surface-muted' : ''} transition-colors`}
            onClick={() => canExpand && setExpanded(!expanded)}
          >
            {canExpand &&
              (expanded ? (
                <ChevronDown className="w-4 h-4 text-text-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-text-muted" />
              ))}
            <select
              className={`font-semibold text-text-primary bg-surface border border-border-light rounded px-2 py-1 text-sm ${isMissingGroup ? 'border-red-500' : ''}`}
              value={displayGroupId || ''}
              disabled={isDisabled}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                const selectedId = e.target.value;
                if (!selectedId) return;
                // 自動検出グループ（新規）を選択した場合
                if (selectedId === mergeInput?.groupId && !isAutoDetectedExisting) {
                  onSelectGroup?.(item.id, mergeInput.groupId, mergeInput.groupName);
                  return;
                }
                const selected = groups.find((g) => g.id === selectedId);
                if (selected) {
                  onSelectGroup?.(item.id, selected.id, selected.name);
                }
              }}
            >
              {isMissingGroup && (
                <option value="">グループを選択してください</option>
              )}
              {!isAutoDetectedExisting && mergeInput?.groupName && (
                <option value={mergeInput.groupId}>（新規）{mergeInput.groupName}</option>
              )}
              {groups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <span className="text-text-secondary text-sm">{mergeInput.date}</span>
            <span className="text-sm text-text-secondary">
              参加者: {mergeInput.attendances.length}名
            </span>
            <span className="text-sm text-text-secondary">
              合計: {formatDuration(totalDuration)}
            </span>
            {item.hasDuplicate && (
              <span className="text-xs text-warning bg-amber-50 px-1.5 py-0.5 rounded">重複</span>
            )}
          </div>

          {/* 展開時の参加者テーブル */}
          {expanded && (
            <div className="px-4 pb-3">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-light text-text-secondary">
                    <th className="text-left py-2 px-3 font-medium">参加者</th>
                    <th className="text-left py-2 px-3 font-medium">参加時間</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {mergeInput.attendances.map((a, i) => (
                    <tr key={i} className="hover:bg-surface-muted transition-colors">
                      <td className="py-2 px-3 text-text-primary">{a.memberName}</td>
                      <td className="py-2 px-3 text-text-secondary tabular-nums">
                        {formatDuration(a.durationSeconds)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
});
