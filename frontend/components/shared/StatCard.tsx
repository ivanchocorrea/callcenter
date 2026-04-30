interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: number; positive?: boolean };
  icon?: React.ReactNode;
}

export function StatCard({ label, value, hint, trend, icon }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
          <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
          {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
          {trend && (
            <div className={`mt-2 text-xs font-medium ${trend.positive ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend.positive ? '▲' : '▼'} {trend.value}%
            </div>
          )}
        </div>
        {icon && <div className="text-brand-600">{icon}</div>}
      </div>
    </div>
  );
}
