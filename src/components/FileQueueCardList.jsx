import { FileQueueCard } from './FileQueueCard.jsx';

/**
 * ファイルキューカードリスト
 * queue を map して FileQueueCard を並べるリストラッパー
 *
 * @param {{ queue: Array, groups: Array, onRemove: (id: string) => void, onApproveDuplicate: (id: string) => void, onSelectGroup: (fileId: string, groupId: string, groupName: string) => void }} props
 */
export function FileQueueCardList({ queue, groups = [], onRemove, onApproveDuplicate, onSelectGroup }) {
  if (queue.length === 0) return null;

  return (
    <div className="space-y-4">
      {queue.map((item) => (
        <FileQueueCard
          key={item.id}
          item={item}
          groups={groups}
          onRemove={onRemove}
          onApproveDuplicate={onApproveDuplicate}
          onSelectGroup={onSelectGroup}
        />
      ))}
    </div>
  );
}
