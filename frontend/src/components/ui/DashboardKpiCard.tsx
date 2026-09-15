import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface DashboardKpiCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  change?: number;
  icon?: ReactNode;
  accent?: 'navy' | 'accent' | 'warning' | 'danger' | 'purple';
  valueClassName?: string;
  statusText?: string;
  progressPercent?: number;
}

export function DashboardKpiCard({
  label,
  value,
  sublabel,
  change,
  icon,
  accent = 'navy',
  valueClassName = '',
  statusText,
  progressPercent,
}: DashboardKpiCardProps) {
  const accentStyles = {
    navy: {
      border: 'border-t-navy-600',
      iconBg: 'bg-navy-50 text-navy-700 ring-1 ring-navy-200/50',
      badge: 'bg-navy-50 text-navy-700',
      progress: 'bg-navy-600',
      glow: 'group-hover:shadow-[0_8px_30px_rgb(36,70,128,0.12)]',
    },
    accent: {
      border: 'border-t-emerald-500',
      iconBg: 'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50',
      badge: 'bg-emerald-50 text-emerald-700',
      progress: 'bg-emerald-500',
      glow: 'group-hover:shadow-[0_8px_30px_rgb(16,185,129,0.14)]',
    },
    warning: {
      border: 'border-t-amber-500',
      iconBg: 'bg-amber-50 text-amber-600 ring-1 ring-amber-200/50',
      badge: 'bg-amber-50 text-amber-700',
      progress: 'bg-amber-500',
      glow: 'group-hover:shadow-[0_8px_30px_rgb(245,158,11,0.14)]',
    },
    danger: {
      border: 'border-t-rose-500',
      iconBg: 'bg-rose-50 text-rose-600 ring-1 ring-rose-200/50',
      badge: 'bg-rose-50 text-rose-700',
      progress: 'bg-rose-500',
      glow: 'group-hover:shadow-[0_8px_30px_rgb(244,63,94,0.14)]',
    },
    purple: {
      border: 'border-t-indigo-500',
      iconBg: 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/50',
      badge: 'bg-indigo-50 text-indigo-700',
      progress: 'bg-indigo-500',
      glow: 'group-hover:shadow-[0_8px_30px_rgb(99,102,241,0.14)]',
    },
  };

  const currentTheme = accentStyles[accent] || accentStyles.navy;

  return (
    <div
      className={`group relative bg-white rounded-2xl border border-slate-200/80 border-t-4 ${currentTheme.border} p-5 flex flex-col justify-between shadow-sm hover:border-slate-300 transition-all duration-300 hover:-translate-y-1 ${currentTheme.glow}`}
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {label}
          </span>
          {icon && (
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 duration-200 ${currentTheme.iconBg}`}>
              {icon}
            </div>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <div className={`text-3xl font-display font-extrabold text-navy-950 tracking-tight ${valueClassName}`}>
            {value}
          </div>
          {statusText && (
            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md ${currentTheme.badge}`}>
              {statusText}
            </span>
          )}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs">
          {change !== undefined && (
            <span
              className={`inline-flex items-center gap-1 font-semibold px-2 py-0.5 rounded-md ${
                change > 0
                  ? 'bg-rose-50 text-rose-600 border border-rose-200/60'
                  : change < 0
                  ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {change > 0 ? (
                <TrendingUp className="w-3.5 h-3.5" />
              ) : change < 0 ? (
                <TrendingDown className="w-3.5 h-3.5" />
              ) : (
                <Minus className="w-3.5 h-3.5" />
              )}
              {change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
            </span>
          )}
          {sublabel && <span className="text-slate-500 font-medium text-[11px] truncate">{sublabel}</span>}
        </div>

        {progressPercent !== undefined && (
          <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${currentTheme.progress}`}
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
