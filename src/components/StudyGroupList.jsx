import { formatDuration } from '../utils/format-duration';
import { Users, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function StudyGroupList({ groups }) {
  const navigate = useNavigate();

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
          <div
            key={group.id}
            data-testid="study-group-row"
            onClick={() => navigate(`/study-groups/${group.id}`)}
            className="p-5 hover:bg-surface-muted transition-colors cursor-pointer flex justify-between items-center group"
          >
            <div>
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
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
}
