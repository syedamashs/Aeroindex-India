import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  change?: number;
  icon?: ReactNode;
  accent?: 'navy' | 'success' | 'warning' | 'danger';
}

export function KpiCard({ label, value, sublabel, change, icon, accent = 'navy' }: KpiCardProps) {
  const accentColors = {
    navy: 'bg-navy-50 text-navy-700',
    success: 'bg-success-500/10 text-success-600',
    warning: 'bg-warning-500/10 text-warning-600',
    danger: 'bg-danger-500/10 text-danger-600',
  };

  return (
    <div className="card card-hover p-5 flex flex-col gap-2 animate-fade-in">
      <div className="flex items-center justify-between">
        <span className="kpi-label">{label}</span>
        {icon && (
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accentColors[accent]}`}>
            {icon}
          </div>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      <div className="flex items-center gap-2 text-xs">
        {change !== undefined && (
          <span
            className={`badge ${
              change > 0
                ? 'badge-danger'
                : change < 0
                  ? 'badge-success'
                  : 'badge-slate'
            }`}
          >
            {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            {change.toFixed(1)}%
          </span>
        )}
        {sublabel && <span className="text-slate-500">{sublabel}</span>}
      </div>
    </div>
  );
}
