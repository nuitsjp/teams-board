import { useState } from 'react';
import { formatDuration } from '../utils/format-duration.js';
import { ChevronDown, ChevronRight } from 'lucide-react';

/**
 * パース結果のプレビューカード
 * @param {{ item: object }} props
 */
function PreviewCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const { mergeInput } = item.parseResult;
  const totalDuration = mergeInput.attendances.reduce((sum, a) => sum + a.durationSeconds, 0);

  return (
    <div className="bg-surface border border-border-light rounded-lg overflow-hidden" data-preview-id={item.id}>
      <div
        className="flex flex-wrap items-center gap-3 px-4 py-3 cursor-pointer hover:bg-surface-muted transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-text-muted" />
          : <ChevronRight className="w-4 h-4 text-text-muted" />
        }
        <span className="font-semibold text-text-primary">{mergeInput.studyGroupName}</span>
        <span className="text-text-secondary text-sm">{mergeInput.date}</span>
        <span className="text-sm text-text-secondary">参加者: {mergeInput.attendances.length}名</span>
        <span className="text-sm text-text-secondary">合計: {formatDuration(totalDuration)}</span>
        {item.hasDuplicate && (
          <span className="text-xs text-warning bg-amber-50 px-1.5 py-0.5 rounded">重複</span>
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-3">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border-light text-text-secondary">
                <th className="text-left py-2 px-3 font-medium">参加者</th>
                <th className="text-left py-2 px-3 font-medium">学習時間</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-light">
              {mergeInput.attendances.map((a, i) => (
                <tr key={i}>
                  <td className="py-2 px-3 text-text-primary">{a.memberName}</td>
                  <td className="py-2 px-3 text-text-secondary">{formatDuration(a.durationSeconds)}</td>
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
    <div className="space-y-2">
      {readyItems.map((item) => (
        <PreviewCard key={item.id} item={item} />
      ))}
    </div>
  );
}
