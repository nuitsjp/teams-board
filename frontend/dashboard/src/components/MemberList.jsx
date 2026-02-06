import { formatDuration } from '../utils/format-duration';
import { User, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function MemberList({ members }) {
  const navigate = useNavigate();
  const sortedMembers = [...members].sort(
    (a, b) => b.totalDurationSeconds - a.totalDurationSeconds
  );

  return (
    <div className="bg-surface rounded-xl border border-border-light overflow-hidden">
      <div className="p-6 border-b border-border-light bg-surface-muted flex justify-between items-center">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
          <User className="w-5 h-5 text-primary-600" />
          メンバー
        </h2>
        <span className="text-xs font-medium bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
          {members.length} 名
        </span>
      </div>
      <div className="divide-y divide-border-light max-h-[600px] overflow-y-auto">
        {sortedMembers.map((member) => (
          <div
            key={member.id}
            data-testid="member-row"
            onClick={() => navigate(`/members/${member.id}`)}
            className="p-4 px-6 hover:bg-surface-muted transition-colors cursor-pointer flex justify-between items-center group"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary-50 flex items-center justify-center text-primary-700 font-bold text-sm">
                {member.name.charAt(0)}
              </div>
              <h3 className="font-medium text-text-primary">{member.name}</h3>
            </div>
            <div className="flex items-center text-sm text-text-secondary gap-4">
              <span className="flex items-center gap-1.5 bg-surface-muted px-2 py-1 rounded">
                <span className="font-semibold text-text-primary">{member.sessionIds.length}</span> 回
              </span>
              <span className="flex items-center gap-1.5 w-24 justify-end">
                <Clock className="w-4 h-4 text-text-muted" />
                {formatDuration(member.totalDurationSeconds)}
              </span>
              <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
