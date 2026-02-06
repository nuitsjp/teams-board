import { useState } from 'react';
import { formatDuration } from '../utils/format-duration.js';

/**
 * パース結果のプレビューカード
 * @param {{ item: object }} props
 */
function PreviewCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const { mergeInput } = item.parseResult;
  const totalDuration = mergeInput.attendances.reduce((sum, a) => sum + a.durationSeconds, 0);

  return (
    <div className="preview-card" data-preview-id={item.id}>
      <div className="summary-card" onClick={() => setExpanded(!expanded)}>
        <span className="summary-group">{mergeInput.studyGroupName}</span>
        <span className="summary-date">{mergeInput.date}</span>
        <span className="summary-count">参加者: {mergeInput.attendances.length}名</span>
        <span className="summary-duration">合計: {formatDuration(totalDuration)}</span>
        {item.hasDuplicate && <span className="msg-warning">⚠ 重複</span>}
      </div>

      {expanded && (
        <div className="preview-detail">
          <table className="preview-table">
            <thead>
              <tr><th>参加者</th><th>学習時間</th></tr>
            </thead>
            <tbody>
              {mergeInput.attendances.map((a, i) => (
                <tr key={i}>
                  <td>{a.memberName}</td>
                  <td>{formatDuration(a.durationSeconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * プレビューエリアコンポーネント
 * @param {{ readyItems: Array }} props
 */
export function PreviewArea({ readyItems }) {
  if (readyItems.length === 0) return null;

  return (
    <div>
      {readyItems.map((item) => (
        <PreviewCard key={item.id} item={item} />
      ))}
    </div>
  );
}
