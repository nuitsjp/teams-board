import { FileQueueCard } from './FileQueueCard.jsx';

/**
 * ファイルキューカードリスト
 * queue を map して FileQueueCard を並べるリストラッパー
 *
 * @param {{ queue: Array, onRemove: (id: string) => void, onApproveDuplicate: (id: string) => void }} props
 */
export function FileQueueCardList({ queue, onRemove, onApproveDuplicate }) {
  if (queue.length === 0) return null;

  return (
    <div className="space-y-3">
      {queue.map((item) => (
        <FileQueueCard
          key={item.id}
          item={item}
          onRemove={onRemove}
          onApproveDuplicate={onApproveDuplicate}
        />
      ))}
    </div>
  );
}
