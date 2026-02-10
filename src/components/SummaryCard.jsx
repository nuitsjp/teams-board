export function SummaryCard({ title, value, icon: Icon, className = "" }) {
  return (
    <div className={`bg-surface rounded-xl border border-border-light p-6 flex items-center space-x-5 ${className}`}>
      {Icon && (
        <div className="p-3 bg-primary-50 rounded-xl text-primary-600">
          <Icon size={28} strokeWidth={1.5} />
        </div>
      )}
      <div>
        <p className="text-sm font-medium text-text-muted mb-1">{title}</p>
        <p className="text-2xl font-bold text-text-primary tracking-tight">{value}</p>
      </div>
    </div>
  );
}
