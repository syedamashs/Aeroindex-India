import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import {
  AlertTriangle, TrendingDown, TrendingUp, Activity, Database,
  ShieldCheck, ArrowRight, Bell,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import type { AlertItem } from '@/data/types';
import { apiAlerts, type ApiFilters } from '@/lib/api';

const alertIcons: Record<AlertItem['type'], typeof AlertTriangle> = {
  price_spike: TrendingUp,
  price_drop: TrendingDown,
  index_threshold: Activity,
  volatility: AlertTriangle,
  data_quality: Database,
};

export function AlertsPage() {
  const { filters, lastUpdate } = useApp();
  const navigate = useNavigate();
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const apiFilters: ApiFilters = {
      origin: filters.origin !== 'all' ? filters.origin : undefined,
      destination: filters.destination !== 'all' ? filters.destination : undefined,
      airline: filters.airline !== 'all' ? filters.airline : undefined,
      preset: filters.preset,
      customStart: filters.customStart,
      customEnd: filters.customEnd,
    };
    apiAlerts(apiFilters)
      .then((response) => setAlerts(response.data as AlertItem[]))
      .catch((error) => console.error('Failed to fetch alerts:', error))
      .finally(() => setLoading(false));
  }, [filters, lastUpdate]);

  const filtered = severityFilter === 'all' ? alerts : alerts.filter((a) => a.severity === severityFilter);

  const counts = {
    total: alerts.length,
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    low: alerts.filter((a) => a.severity === 'low').length,
  };

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-6 lg:p-8 shadow-xl border border-navy-700/60">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                AUTOMATED TARIFF SURVEILLANCE
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Threshold Triggers & Spike Flags
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              Surveillance Signals & Alerts
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Automated anomaly detection flagging abnormal corridor fare surges, sudden inventory depletion, and tariff threshold violations.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-navy-900/80 p-3.5 rounded-2xl border border-navy-700">
            <Bell className="w-5 h-5 text-accent-400" />
            <div className="text-xs">
              <p className="font-bold text-white">Active Queue</p>
              <p className="text-accent-400 font-mono font-bold text-base">{alerts.length} Incidents</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard
          label="Total Incidents Flagged"
          value={counts.total}
          sublabel="Cross-corridor active signals"
          statusText="Active Queue"
          icon={<Bell className="w-5 h-5" />}
          accent="navy"
          progressPercent={100}
        />

        <DashboardKpiCard
          label="Critical Surge Spikes"
          value={counts.high}
          sublabel=">15% sudden tariff spike"
          statusText={counts.high > 0 ? 'Action Required' : 'Nominal'}
          icon={<AlertTriangle className="w-5 h-5" />}
          accent="danger"
        />

        <DashboardKpiCard
          label="Moderate Volatility"
          value={counts.medium}
          sublabel="5% to 15% fluctuation"
          statusText="Watching"
          icon={<Activity className="w-5 h-5" />}
          accent="warning"
        />

        <DashboardKpiCard
          label="Informational & Safe"
          value={counts.low}
          sublabel="Nominal trajectory"
          statusText="Within Spec"
          icon={<ShieldCheck className="w-5 h-5" />}
          accent="accent"
        />
      </div>

      {/* Filter Tabs */}
      <div className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filter By Severity:</span>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'high', 'medium', 'low'] as const).map((s) => {
                const isActive = severityFilter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSeverityFilter(s)}
                    className={`pill-tab capitalize ${isActive ? 'pill-tab-active' : 'pill-tab-inactive'}`}
                  >
                    {s === 'all' ? `All (${counts.total})` : `${s} (${counts[s]})`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Stream */}
      <div className="glass-card p-6">
        <div className="pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-base font-display font-bold text-navy-950">
            Surveillance Signal Ledger
          </h3>
          <span className="text-xs text-slate-500 font-mono">
            {filtered.length} matching events
          </span>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Scanning surveillance feed...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">No alerts match the selected filter.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((a) => {
              const Icon = alertIcons[a.type] || AlertTriangle;
              const isHigh = a.severity === 'high';
              const isMedium = a.severity === 'medium';

              return (
                <div
                  key={a.id}
                  className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isHigh
                      ? 'bg-rose-50/50 border-rose-200/80 hover:bg-rose-50'
                      : isMedium
                      ? 'bg-amber-50/40 border-amber-200/70 hover:bg-amber-50'
                      : 'bg-slate-50/60 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isHigh
                          ? 'bg-rose-100 text-rose-700'
                          : isMedium
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-navy-950">
                          {a.route || 'Network Wide'}
                        </span>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                            isHigh
                              ? 'bg-rose-100 text-rose-700'
                              : isMedium
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {a.severity}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">{a.date}</span>
                      </div>
                      <p className="text-xs font-semibold text-navy-950 leading-relaxed">
                        {a.message}
                      </p>
                    </div>
                  </div>

                  {a.route && (
                    <button
                      onClick={() => navigate(`/routes/${a.route.replace(' ', '-')}`)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-bold text-navy-800 hover:bg-slate-50 shadow-sm whitespace-nowrap self-end sm:self-center"
                    >
                      <span>Investigate Corridor</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
