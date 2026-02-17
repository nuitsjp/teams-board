import { memo } from 'react';
import { formatDuration } from '../utils/format-duration';
import { Users, Clock, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const GroupRow = memo(function GroupRow({ group, onNavigate, index }) {
    return (
        <div
            data-testid="group-row"
            onClick={() => onNavigate(`/groups/${group.id}`)}
            className="list-accent-primary p-5 hover:bg-surface-muted cursor-pointer flex justify-between items-center group animate-fade-in-up"
            style={{ animationDelay: `${index * 60}ms` }}
        >
            <div>
                <h3 className="font-semibold text-text-primary mb-2">{group.name}</h3>
                <div className="flex items-center text-sm text-text-secondary gap-6">
                    <span className="flex items-center gap-1.5 bg-surface-muted px-2.5 py-1 rounded-md">
                        <span className="font-bold text-text-primary font-display">
                            {group.sessionRevisions.length}
                        </span>{' '}
                        回開催
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-text-muted" />
                        <span className="font-display">{formatDuration(group.totalDurationSeconds)}</span>
                    </span>
                </div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted group-hover:text-primary-600 group-hover:translate-x-0.5 transition-all" />
        </div>
    );
});

export function GroupList({ groups }) {
    const navigate = useNavigate();

    return (
        <div className="card-base overflow-hidden card-interactive">
            <div className="p-6 border-b border-border-light">
                <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary-600" />
                    グループ
                </h2>
            </div>
            <div className="divide-y divide-border-light">
                {groups.map((group, index) => (
                    <GroupRow key={group.id} group={group} onNavigate={navigate} index={index} />
                ))}
            </div>
        </div>
    );
}
