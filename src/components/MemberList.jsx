import { useMemo, useState } from 'react';
import { formatDuration } from '../utils/format-duration';
import { User, Clock, ChevronRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function MemberList({ members }) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = useMemo(() => {
    if (searchQuery === '') return members;
    const loweredQuery = searchQuery.toLowerCase();
    return members.filter((member) =>
      member.name.toLowerCase().includes(loweredQuery)
    );
  }, [members, searchQuery]);

  const sortedMembers = useMemo(() => (
    [...filteredMembers].sort((a, b) => a.name.localeCompare(b.name, 'ja'))
  ), [filteredMembers]);

  return (
    <div className="bg-surface rounded-xl border border-border-light overflow-hidden">
      <div className="p-6 border-b border-border-light bg-surface-muted flex justify-between items-center gap-4">
        <h2 className="text-lg font-bold text-text-primary flex items-center gap-2 shrink-0">
          <User className="w-5 h-5 text-primary-600" />
          メンバー
        </h2>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="名前で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-border-light rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <span className="text-xs font-medium bg-primary-50 text-primary-700 px-2 py-1 rounded-full shrink-0">
          {sortedMembers.length} 名
        </span>
      </div>
      <div className="divide-y divide-border-light max-h-[600px] overflow-y-auto">
        {sortedMembers.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            該当するメンバーが見つかりません
          </div>
        ) : sortedMembers.map((member) => (
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
