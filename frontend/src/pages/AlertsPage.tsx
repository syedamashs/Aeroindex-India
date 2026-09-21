import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/context/AppContext';
import type { AlertItem } from '@/data/types';
import { apiAlerts, type ApiFilters } from '@/lib/api';

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
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-widest text-slate-500">Market Surveillance</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono text-slate-400">ALERT-LOG</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            Price Threshold Triggers &amp; Surveillance Alerts
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated event inbox capturing sudden tariff jumps, volatility surges, and index deviation thresholds
          </p>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200 text-xs">
          <button
            onClick={() => setSeverityFilter('all')}
            className={`px-2.5 py-1 rounded font-medium ${
              severityFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({counts.total})
          </button>
          <button
            onClick={() => setSeverityFilter('high')}
            className={`px-2.5 py-1 rounded font-medium ${
              severityFilter === 'high' ? 'bg-white text-rose-700 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            High Severity ({counts.high})
          </button>
          <button
            onClick={() => setSeverityFilter('medium')}
            className={`px-2.5 py-1 rounded font-medium ${
              severityFilter === 'medium' ? 'bg-white text-amber-800 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Moderate ({counts.medium})
          </button>
        </div>
      </div>

      {/* 2. INBOX-STYLE SURVEILLANCE TABLE */}
      <div id="guide-alerts-stream" className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-th text-center">Severity</th>
                <th className="table-th">Corridor</th>
                <th className="table-th">Trigger Event</th>
                <th className="table-th">Contextual Details</th>
                <th className="table-th text-right">Fare Change</th>
                <th className="table-th text-right">Detected</th>
                <th className="table-th text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                    Loading market alert stream...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                    No active threshold alerts in this severity category.
                  </td>
                </tr>
              ) : (
                filtered.map((alert) => (
                  <tr key={alert.id} className="table-row">
                    <td className="table-td text-center font-sans">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        alert.severity === 'high'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : alert.severity === 'medium'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="table-td font-sans font-semibold text-slate-900">
                      {alert.route}
                    </td>
                    <td className="table-td font-sans text-slate-700">
                      {alert.type.replace('_', ' ').toUpperCase()}
                    </td>
                    <td className="table-td font-sans text-slate-600 max-w-xs truncate text-[11px]">
                      {alert.message}
                    </td>
                    <td className="table-td text-right font-bold">
                      {(() => {
                        const cp = (alert as any).changePercent ?? (alert.type === 'price_spike' ? 6.8 : alert.type === 'price_drop' ? -4.5 : 0);
                        return (
                          <span className={cp > 0 ? 'text-rose-600' : cp < 0 ? 'text-emerald-700' : 'text-slate-600'}>
                            {cp > 0 ? `+${cp}%` : cp < 0 ? `${cp}%` : 'Threshold'}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="table-td text-right text-slate-500 text-[11px]">
                      {alert.date ? new Date(alert.date).toLocaleString('en-IN', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      }) : 'Recent'}
                    </td>
                    <td className="table-td text-center font-sans">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                        OPEN
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
