import { useMemo, useState, useEffect } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import {
  TrendingUp, Route as RouteIcon, Plane, Database, AlertTriangle, Clock, CheckCircle2, Activity,
  ArrowUp, ArrowDown, Minus,
} from 'lucide-react';
import { KpiCard } from '@/components/ui/KpiCard';
import { Card } from '@/components/ui/Card';
import { FilterBar } from '@/components/FilterBar';
import { useApp } from '@/context/AppContext';
import {
  computePipelineStats,
} from '@/data/analytics';
import { formatINR, formatNumber, formatPercent } from '@/data/random';
import { getAirportLabel } from '@/data/generator';
import { useNavigate } from 'react-router-dom';
import { indexTooltipFormatter } from '@/components/chartFormatters';
import { apiIndex, apiRoutes, apiAlerts, apiStatistics, apiObservations, type ApiFilters } from '@/lib/api';

export function DashboardPage() {
  const { filters, lastUpdate } = useApp();
  const navigate = useNavigate();

  const [indexPoints, setIndexPoints] = useState<any[]>([]);
  const [routeStats, setRouteStats] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiFilters: ApiFilters = {
          origin: filters.origin !== 'all' ? filters.origin : undefined,
          destination: filters.destination !== 'all' ? filters.destination : undefined,
          airline: filters.airline !== 'all' ? filters.airline : undefined,
          travelClass: filters.travelClass !== 'all' ? filters.travelClass : undefined,
          bookingWindow: filters.bookingWindow !== 'all' ? filters.bookingWindow : undefined,
          preset: filters.preset,
          customStart: filters.customStart,
          customEnd: filters.customEnd,
        };

        const [indexRes, routesRes, alertsRes, statsRes] = await Promise.all([
          apiIndex(apiFilters),
          apiRoutes(apiFilters),
          apiAlerts(apiFilters),
          apiStatistics(apiFilters),
        ]);

        setIndexPoints(indexRes.data);
        setRouteStats(routesRes.data);
        setAlerts(alertsRes.data);
        setStatistics(statsRes.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters, lastUpdate]);

  const pipeline = useMemo(() => computePipelineStats(), [lastUpdate]);
  const filteredObs = useMemo(() => statistics?.totalObservations ?? 0, [statistics]);

  const latest = indexPoints[indexPoints.length - 1];
  const highPriceRoutes = (statistics?.highPriceRoutes ?? 0);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">India Airfare Price Intelligence</h1>
        <p className="text-slate-500 mt-1">Monitoring domestic airfare movements across major Indian air routes</p>
      </div>

      <FilterBar />

      {loading ? (
        <div className="text-center py-12">
          <p className="text-slate-500">Loading data...</p>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
            <KpiCard
              label="Current Airfare Index"
              value={latest?.indexValue?.toFixed(1) ?? '100.0'}
              change={latest?.percentageChange}
              sublabel="Base: Jan 2026 = 100"
              icon={<Activity className="w-4 h-4" />}
              accent="navy"
            />
            <KpiCard
              label="Monthly Change"
              value={formatPercent(latest?.percentageChange ?? 0)}
              sublabel="vs previous month"
              icon={<TrendingUp className="w-4 h-4" />}
              accent={latest && latest.percentageChange > 0 ? 'danger' : 'success'}
            />
            <KpiCard
              label="Routes Monitored"
              value={statistics?.routesMonitored ?? 0}
              icon={<RouteIcon className="w-4 h-4" />}
            />
            <KpiCard
              label="Airlines Monitored"
              value={statistics?.airlinesMonitored ?? 0}
              icon={<Plane className="w-4 h-4" />}
            />
            <KpiCard
              label="Price Observations"
              value={formatNumber(statistics?.totalObservations ?? 0) + '+'}
              sublabel={`${formatNumber(filteredObs)} filtered`}
              icon={<Database className="w-4 h-4" />}
            />
            <KpiCard
              label="High-Price Routes"
              value={highPriceRoutes}
              sublabel=">5% MoM increase"
              icon={<AlertTriangle className="w-4 h-4" />}
              accent={highPriceRoutes > 5 ? 'warning' : 'navy'}
            />
            <KpiCard
              label="Data Freshness"
              value="12 min"
              sublabel="Updated 12 minutes ago"
              icon={<Clock className="w-4 h-4" />}
              accent="success"
            />
            <KpiCard
              label="Data Quality"
              value={`${statistics?.dataQuality ?? 0}%`}
              sublabel={`${formatNumber(Math.round(((statistics?.totalObservations ?? 0) * (statistics?.dataQuality ?? 0)) / 100))} valid records`}
              icon={<CheckCircle2 className="w-4 h-4" />}
              accent="success"
            />
          </div>

          {/* Main Index Chart */}
          <Card
            title="India Airfare Price Index"
            subtitle="Monthly composite index — Base Period: January 2026 = 100"
            className="mb-6"
          >
            <div className="mb-4 p-3 bg-navy-50 rounded-lg text-sm text-navy-700">
              <strong>What does this mean?</strong> An index of {latest?.indexValue?.toFixed(1) ?? '100'} means the measured airfare level is approximately {((latest?.indexValue ?? 100) - 100).toFixed(1)}% above the base period.
            </div>
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={indexPoints} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="indexGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#244680" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#244680" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} domain={['dataMin - 5', 'dataMax + 5']} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0' }}
                  formatter={indexTooltipFormatter}
                />
                <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'Base (100)', position: 'right', fontSize: 11, fill: '#94a3b8' }} />
                <Area
                  type="monotone"
                  dataKey="indexValue"
                  stroke="#244680"
                  strokeWidth={2.5}
                  fill="url(#indexGradient)"
                  dot={{ r: 4, fill: '#244680' }}
                  activeDot={{ r: 6 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* MoM Table */}
            <Card title="Monthly Airfare Movement" subtitle="Index values and month-over-month changes">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-th">Month</th>
                      <th className="table-th text-right">Index</th>
                      <th className="table-th text-right">Change %</th>
                      <th className="table-th text-right">Avg Fare</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indexPoints.map((p, i) => (
                      <tr key={p.period} className="table-row">
                        <td className="table-td font-medium">{p.monthLabel}</td>
                        <td className="table-td text-right font-mono">{p.indexValue.toFixed(1)}</td>
                        <td className="table-td text-right">
                          {i === 0 ? (
                            <span className="badge-slate">—</span>
                          ) : (
                            <span className={`badge ${p.percentageChange > 0.5 ? 'badge-danger' : p.percentageChange < -0.5 ? 'badge-success' : 'badge-slate'}`}>
                              {p.percentageChange > 0.5 ? <ArrowUp className="w-3 h-3" /> : p.percentageChange < -0.5 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                              {formatPercent(p.percentageChange)}
                            </span>
                          )}
                        </td>
                        <td className="table-td text-right font-mono">{formatINR(p.averageFare)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Top Routes + Alerts */}
            <div className="space-y-6">
          <Card title="Top Monitored Routes" subtitle="By route weight and MoM change">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-th">Route</th>
                    <th className="table-th text-right">Avg Fare</th>
                    <th className="table-th text-right">Index</th>
                    <th className="table-th text-right">MoM</th>
                  </tr>
                </thead>
                <tbody>
                  {routeStats.slice(0, 6).map((r) => (
                    <tr
                      key={r.routeId}
                      className="table-row cursor-pointer"
                      onClick={() => navigate(`/routes/${r.routeId}`)}
                    >
                      <td className="table-td font-medium">
                        {getAirportLabel(r.origin)} → {getAirportLabel(r.destination)}
                      </td>
                      <td className="table-td text-right font-mono">{formatINR(r.averageFare)}</td>
                      <td className="table-td text-right font-mono">{r.index.toFixed(1)}</td>
                      <td className="table-td text-right">
                        <span className={`badge ${r.momChange > 1.5 ? 'badge-danger' : r.momChange < -1.5 ? 'badge-success' : 'badge-slate'}`}>
                          {formatPercent(r.momChange)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Recent Alerts" subtitle="Significant fare movements detected">
            <div className="space-y-2">
              {alerts.slice(0, 4).map((a) => (
                <div key={a.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${a.severity === 'high' ? 'bg-danger-500' : a.severity === 'medium' ? 'bg-warning-500' : 'bg-success-500'}`} />
                  <p className="text-sm text-navy-800 flex-1">{a.message}</p>
                </div>
              ))}
              <button onClick={() => navigate('/alerts')} className="btn-ghost text-xs w-full">
                View all alerts →
              </button>
            </div>
          </Card>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
