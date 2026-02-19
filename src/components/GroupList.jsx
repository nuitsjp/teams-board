import { memo } from 'react';
import { formatDuration } from '../utils/format-duration';
import { Users, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/** ホバー時にテキストが省略されている場合のみツールチップを有効化 */
function handleTruncateMouseEnter(e) {
    const wrapper = e.currentTarget;
    const textEl = wrapper.querySelector('.truncate');
    if (textEl && textEl.scrollWidth > textEl.clientWidth) {
        wrapper.setAttribute('data-truncated', '');
    }
}

function handleTruncateMouseLeave(e) {
    e.currentTarget.removeAttribute('data-truncated');
}

const GroupRow = memo(function GroupRow({ group, onNavigate, index }) {
    return (
        <div
            data-testid="group-row"
            onClick={() => onNavigate(`/groups/${group.id}`)}
            className="list-accent-primary p-4 px-6 hover:bg-surface-muted cursor-pointer flex justify-between items-center group animate-fade-in-up border-b border-border-light last:border-b-0 last:rounded-b-2xl min-h-[73px]"
            style={{ animationDelay: `${index * 60}ms` }}
        >
            <div
                className="min-w-0 flex-1 truncate-with-tooltip"
                data-fulltext={group.name}
                onMouseEnter={handleTruncateMouseEnter}
                onMouseLeave={handleTruncateMouseLeave}
            >
                <h3 className="font-semibold text-text-primary truncate">{group.name}</h3>
            </div>
            <div className="flex items-center text-sm text-text-secondary gap-4 shrink-0">
                <span className="flex items-center gap-1.5 bg-surface-muted px-2.5 py-1 rounded-md">
                    <span className="font-semibold text-text-primary font-display">
                        {group.sessionRevisions.length}
                    </span>{' '}
                    回開催
                </span>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Clock className="w-4 h-4 text-text-muted" />
                    <span className="font-display">{formatDuration(group.totalDurationSeconds)}</span>
                </span>
                <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 transition-colors" />
            </div>
        </div>
    );
});

export function GroupList({ groups }) {
    const navigate = useNavigate();

    return (
        <div className="card-base">
            <div className="p-6 border-b border-border-light flex items-center min-h-[83px]">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary-600" />
                    グループ
                </h2>
            </div>
            <div>
                {groups.map((group, index) => (
                    <GroupRow key={group.id} group={group} onNavigate={navigate} index={index} />
                ))}
            </div>
        </div>
    );
}
