import { formatDuration } from '../utils/format-duration';
import { Users, Clock } from 'lucide-react';

export function StudyGroupList({ groups }) {
  return (
    <div className="bg-surface rounded-xl border border-border-light overflow-hidden">
      <div className="p-6 border-b border-border-light bg-surface-muted">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-600" />
          勉強会グループ
        </h2>
      </div>
      <div className="divide-y divide-border-light">
        {groups.map((group) => (
          <div key={group.id} className="p-5">
            <h3 className="font-semibold text-text-primary mb-2">{group.name}</h3>
            <div className="flex items-center text-sm text-text-secondary gap-6">
              <span className="flex items-center gap-1.5 bg-surface-muted px-2.5 py-1 rounded-md">
                <span className="font-bold text-text-primary">{group.sessionIds.length}</span> 回開催
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-text-muted" />
                {formatDuration(group.totalDurationSeconds)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
