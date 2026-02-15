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
            className={`card-base p-6 flex items-center space-x-5 animate-fade-in-up ${className}`}
            style={style}
        >
            {Icon && (
                <div className="p-3 bg-primary-50 rounded-xl text-primary-600">
                    <Icon size={28} strokeWidth={1.5} />
                </div>
            )}
            <div>
                <p className="text-sm font-medium text-text-muted mb-1 tracking-wide">{title}</p>
                <p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>
            </div>
        </div>
    );
});
