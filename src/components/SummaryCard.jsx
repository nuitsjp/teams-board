import { memo } from 'react';

export const SummaryCard = memo(function SummaryCard({
    title,
    value,
    icon: Icon,
    className = '',
    style,
}) {
    return (
        <div
            className={`card-base p-6 flex flex-col animate-fade-in-up ${className}`}
            style={style}
        >
            <div className="flex items-center justify-between mb-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-widest">
                    {title}
                </p>
                {Icon && (
                    <div className="p-2 bg-primary-50 rounded-lg text-primary-500">
                        <Icon size={18} strokeWidth={1.5} />
                    </div>
                )}
            </div>
            <p className="text-4xl font-bold font-display tracking-tighter text-text-primary tabular-nums">
                {value}
            </p>
        </div>
    );
});
