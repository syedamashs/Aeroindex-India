import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { computeAlerts, getAirportLabel } from '@/data/analytics';
import { AlertTriangle, TrendingDown, TrendingUp, Activity, Database, Filter } from 'lucide-react';
import type { AlertItem } from '@/data/types';

const SEVERITY_ORDER = { high: 0, medium: 1, low: 2 } as const;

const alertIcons: Record<AlertItem['type'], typeof AlertTriangle> = {
  price_spike: TrendingUp,
  price_drop: TrendingDown,
  index_threshold: Activity,
  volatility: AlertTriangle,
  data_quality: Database,
};

export function AlertsPage() {
  const { lastUpdate } = useApp();
  const [severityFilter, setSeverityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  const alerts = useMemo(() => computeAlerts(), [lastUpdate]);
  const filtered = severityFilter === 'all' ? alerts : alerts.filter((a) => a.severity === severityFilter);

  const counts = {
    high: alerts.filter((a) => a.severity === 'high').length,
    medium: alerts.filter((a) => a.severity === 'medium').length,
    low: alerts.filter((a) => a.severity === 'low').length,
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">Airfare Alerts</h1>
        <p className="text-slate-500 mt-1">Significant fare movements detected from prototype data</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-danger-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-danger-600" />
          </div>
          <div>
            <p className="kpi-label">High Severity</p>
            <p className="text-2xl font-display font-bold text-navy-900">{counts.high}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-warning-600" />
          </div>
          <div>
            <p className="kpi-label">Medium Severity</p>
            <p className="text-2xl font-display font-bold text-navy-900">{counts.medium}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success-500/10 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-success-600" />
          </div>
          <div>
            <p className="kpi-label">Low Severity</p>
            <p className="text-2xl font-display font-bold text-navy-900">{counts.low}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <Card className="mb-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600 mr-2">Filter by severity:</span>
          {(['all', 'high', 'medium', 'low'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSeverityFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                severityFilter === s
                  ? 'bg-navy-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </Card>

      {/* Alert list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card>
            <p className="text-sm text-slate-500 text-center py-8">No alerts match the current filter.</p>
          </Card>
        ) : (
          filtered.map((alert) => {
            const Icon = alertIcons[alert.type] ?? AlertTriangle;
            const severityColor =
              alert.severity === 'high' ? 'border-l-danger-500' :
              alert.severity === 'medium' ? 'border-l-warning-500' :
              'border-l-success-500';

            return (
              <div key={alert.id} className={`card p-4 border-l-4 ${severityColor} flex items-start gap-4`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  alert.severity === 'high' ? 'bg-danger-500/10' :
                  alert.severity === 'medium' ? 'bg-warning-500/10' :
                  'bg-success-500/10'
                }`}>
                  <Icon className={`w-5 h-5 ${
                    alert.severity === 'high' ? 'text-danger-600' :
                    alert.severity === 'medium' ? 'text-warning-600' :
                    'text-success-600'
                  }`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`badge ${
                      alert.severity === 'high' ? 'badge-danger' :
                      alert.severity === 'medium' ? 'badge-warning' :
                      'badge-success'
                    }`}>
                      {alert.severity}
                    </span>
                    <span className="badge-slate">{alert.type.replace('_', ' ')}</span>
                    <span className="text-xs text-slate-400">{alert.date}</span>
                  </div>
                  <p className="text-sm text-navy-800">{alert.message}</p>
                  {alert.route !== 'National' && (
                    <p className="text-xs text-slate-500 mt-1">
                      Route: {getAirportLabel(alert.route.split('-')[0])} → {getAirportLabel(alert.route.split('-')[1])}
                    </p>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
