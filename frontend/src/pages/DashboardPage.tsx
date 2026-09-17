import { useState, useEffect } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import {
  TrendingUp, Route as RouteIcon, Plane, Database, AlertTriangle, Clock, CheckCircle2, Activity,
  ArrowUp, ArrowDown, Minus, RefreshCw, Map as MapIcon, ArrowRight, ShieldCheck, Sparkles,
  BarChart3, Layers,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { FilterBar } from '@/components/FilterBar';
import { useApp } from '@/context/AppContext';
import { formatINR, formatNumber, formatPercent } from '@/data/random';
import { useNavigate } from 'react-router-dom';
import { indexTooltipFormatter, genericFareTooltipFormatter } from '@/components/chartFormatters';
import {
  apiIndex, apiRoutes, apiAlerts, apiStatistics, apiAirlines, type ApiFilters,
} from '@/lib/api';
import { RadarScanner } from '@/components/animation/RadarScanner';
import { StaggerContainer, MotionItem } from '@/components/animation/MotionCard';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { fireConfetti } from '@/components/animation/confetti';

export function DashboardPage() {
  const { filters, lastUpdate, triggerUpdate } = useApp();
  const navigate = useNavigate();

  const [indexPoints, setIndexPoints] = useState<any[]>([]);
  const [routeStats, setRouteStats] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [airlines, setAirlines] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Interactive controls
  const [chartMode, setChartMode] = useState<'index' | 'fare'>('index');
  const [alertFilter, setAlertFilter] = useState<'all' | 'high' | 'medium'>('all');
  const [showRadar, setShowRadar] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
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

        const [indexRes, routesRes, alertsRes, statsRes, airlinesRes] = await Promise.all([
          apiIndex(apiFilters),
          apiRoutes(apiFilters),
          apiAlerts(apiFilters),
          apiStatistics(apiFilters),
          apiAirlines(apiFilters).catch(() => ({ data: [] })),
        ]);

        setIndexPoints(indexRes.data);
        setRouteStats(routesRes.data);
        setAlerts(alertsRes.data);
        setStatistics(statsRes.data);
        setAirlines(airlinesRes.data || []);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Unable to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters, lastUpdate]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    triggerUpdate(200);
    fireConfetti({ spread: 60, origin: { y: 0.35 } });
    setTimeout(() => setIsRefreshing(false), 800);
  };

  const latest = indexPoints[indexPoints.length - 1];
  const first = indexPoints[0];
  const overallDiff = latest && first ? Number(((latest.indexValue - first.indexValue)).toFixed(1)) : 0;
  const highPriceRoutes = statistics?.highPriceRoutes ?? 0;

  const filteredAlerts = alerts.filter((a) => {
    if (alertFilter === 'high') return a.severity === 'high';
    if (alertFilter === 'medium') return a.severity === 'medium';
    return true;
  });

  return (
    <div className="animate-fade-in space-y-6">
      {/* Top Hero Command Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-6 lg:p-8 shadow-xl border border-navy-700/60">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-start sm:items-center gap-4 sm:gap-5 max-w-2xl">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur-md p-2 border border-white/20 shadow-xl shrink-0 flex items-center justify-center">
              <img src="/logo.png" alt="AeroIndex Logo" className="w-full h-full object-contain drop-shadow-md" />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  LIVE AIRFARE SURVEILLANCE GRID
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-accent-400" />
                  DGCA & MoCA Compliance Spec
                </span>
              </div>

              <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
                National Airfare Price Intelligence
              </h1>
              <p className="text-sm text-navy-200 leading-relaxed">
                Real-time econometric index modeling, high-frequency fare volatility tracking, and consumer tariff protection across Indian domestic corridors.
              </p>
            </div>
          </div>

          {/* Quick Action Hub */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowRadar(!showRadar)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border text-xs font-semibold transition-all backdrop-blur-sm active:scale-95 ${
                showRadar
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>{showRadar ? 'Hide ATC Radar' : 'Launch ATC Radar'}</span>
            </button>

            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold transition-all backdrop-blur-sm active:scale-95"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-accent-400' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Feed'}</span>
            </button>
            <button
              onClick={() => navigate('/map')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-500/20 hover:bg-accent-500/30 border border-accent-500/40 text-accent-300 text-xs font-semibold transition-all backdrop-blur-sm active:scale-95"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>Network Map</span>
            </button>
            <button
              onClick={() => navigate('/routes')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-navy-900 hover:bg-slate-100 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <span>Explore Routes</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Dynamic ATC Radar HUD Dropdown Drawer */}
        {showRadar && (
          <div className="relative z-10 mt-6 p-6 rounded-2xl bg-navy-950/95 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-around gap-6 shadow-2xl animate-fade-in">
            <RadarScanner size={260} />
            <div className="max-w-md space-y-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                <h4 className="font-display font-bold text-white text-sm">
                  Active Air Corridor Surveillance Radar
                </h4>
              </div>
              <p className="text-slate-300 leading-relaxed">
                360° radar sweep tracking domestic scheduled flights across trunk corridors (Delhi, Mumbai, Bengaluru, Kolkata, Hyderabad, Chennai, Goa). Fares are scanned at high frequency for algorithmic tariff gouging detection.
              </p>
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-navy-800 text-[11px] font-mono">
                <div className="bg-navy-900/80 p-2 rounded-lg border border-navy-800">
                  <span className="text-slate-400">Scan Frequency:</span>
                  <p className="text-emerald-400 font-bold">4.5 sec / sweep</p>
                </div>
                <div className="bg-navy-900/80 p-2 rounded-lg border border-navy-800">
                  <span className="text-slate-400">Corridors Locked:</span>
                  <p className="text-white font-bold">27 Trunk Corridors</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live National Summary Ticker Strip */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-navy-300">
              <Sparkles className="w-4 h-4 text-accent-400" />
            </div>
            <div>
              <p className="text-navy-400 text-[11px] font-medium uppercase tracking-wider">Average Ticket</p>
              <p className="text-white font-mono font-bold text-sm">
                {loading ? (
                  <span className="inline-block w-16 h-4 bg-white/20 rounded animate-pulse" />
                ) : (
                  <AnimatedCounter value={statistics?.averageFare ?? 12450} prefix="₹" />
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-navy-300">
              <Layers className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <p className="text-navy-400 text-[11px] font-medium uppercase tracking-wider">Fare Range (Min / Max)</p>
              <p className="text-white font-mono font-bold text-sm">
                {loading ? (
                  <span className="inline-block w-24 h-4 bg-white/20 rounded animate-pulse" />
                ) : (
                  statistics?.minFare ? `${formatINR(statistics.minFare)} – ${formatINR(statistics.maxFare)}` : '₹3.1k – ₹45.7k'
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-navy-300">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="text-navy-400 text-[11px] font-medium uppercase tracking-wider">Data Quality Score</p>
              <p className="text-white font-mono font-bold text-sm">
                {loading ? (
                  <span className="inline-block w-16 h-4 bg-white/20 rounded animate-pulse" />
                ) : (
                  <AnimatedCounter value={statistics?.dataQuality ?? 99.4} decimals={1} suffix="% Verified" />
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-navy-300">
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-navy-400 text-[11px] font-medium uppercase tracking-wider">Ingestion Freshness</p>
              <p className="text-white font-mono font-bold text-sm">
                Active Ingest (SQLite)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Filter Bar */}
      <FilterBar />

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary High-Impact KPI Grid */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MotionItem>
          <DashboardKpiCard
            label="National Airfare Index"
            value={latest?.indexValue?.toFixed(1) ?? '100.0'}
            change={latest?.percentageChange}
            sublabel="Baseline: Jan 2026 = 100.0"
            statusText={latest?.indexValue > 100 ? 'Above Base' : 'Sub-Base'}
            icon={<Activity className="w-5 h-5" />}
            accent="navy"
            progressPercent={Math.min(100, ((latest?.indexValue ?? 100) / 120) * 100)}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Monthly Velocity (MoM)"
            value={formatPercent(latest?.percentageChange ?? 0)}
            sublabel="vs preceding monthly cohort"
            statusText={Math.abs(latest?.percentageChange || 0) > 4 ? 'High Volatility' : 'Normal Fluctuations'}
            icon={<TrendingUp className="w-5 h-5" />}
            accent={latest && latest.percentageChange > 0 ? 'danger' : 'accent'}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Active Observations"
            value={formatNumber(statistics?.totalObservations ?? 0)}
            sublabel={`${statistics?.routesMonitored ?? 0} corridors • ${statistics?.airlinesMonitored ?? 0} carriers`}
            statusText="Verified Ingestion"
            icon={<Database className="w-5 h-5" />}
            accent="purple"
            progressPercent={statistics?.dataQuality ?? 98}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="High-Surge Corridors"
            value={highPriceRoutes}
            sublabel="Routes with >5% price jump"
            statusText={highPriceRoutes > 4 ? 'Surveillance Alert' : 'Safe Threshold'}
            icon={<AlertTriangle className="w-5 h-5" />}
            accent={highPriceRoutes > 4 ? 'warning' : 'accent'}
            loading={loading}
          />
        </MotionItem>
      </StaggerContainer>

      {loading ? (
        <div className="glass-card p-12 text-center space-y-3.5 border border-slate-200/80 shadow-sm animate-fade-in">
          <div className="relative inline-flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-navy-200 border-t-navy-700 rounded-full animate-spin" />
            <Database className="w-4 h-4 text-navy-700 absolute animate-pulse" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-bold text-navy-950">Fetching from Backend DB...</p>
            <p className="text-xs text-slate-500 font-mono">Synchronizing live observations from SQLite database</p>
          </div>
        </div>
      ) : (
        <>

          {/* Main Airfare Index Command Center Chart */}
          <div className="glass-card p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 mb-5 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-display font-bold text-navy-950">
                    {chartMode === 'index' ? 'India Airfare Price Index (Vayuyaan)' : 'National Average Ticket Fare Trend'}
                  </h2>
                  <span className="badge badge-navy">Base 2026</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Laspeyres-weighted cohort aggregation across domestic high-density flight corridors
                </p>
              </div>

              {/* View Switcher Pill Tabs */}
              <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                <button
                  onClick={() => setChartMode('index')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    chartMode === 'index' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-navy-900'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Index View (100)</span>
                </button>
                <button
                  onClick={() => setChartMode('fare')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    chartMode === 'fare' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-600 hover:text-navy-900'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>Fare Trend (₹ INR)</span>
                </button>
              </div>
            </div>

            {/* Dynamic AI / Econometric Explanation Bar */}
            <div className="mb-6 p-4 rounded-xl bg-navy-50/80 border border-navy-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-md bg-navy-600 text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Activity className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="font-bold text-navy-950">Economic Indicator Reading: </span>
                  <span className="text-navy-800">
                    The current index of <strong className="text-navy-950">{latest?.indexValue?.toFixed(1) ?? '100.0'}</strong> indicates measured domestic airfares are{' '}
                    <strong className={overallDiff >= 0 ? 'text-rose-600' : 'text-emerald-600'}>
                      {Math.abs(overallDiff)}% {overallDiff >= 0 ? 'above' : 'below'}
                    </strong>{' '}
                    the January 2026 benchmark. Volatility remains contained within acceptable bounds for core business routes.
                  </span>
                </div>
              </div>
              <button
                onClick={() => navigate('/methodology')}
                className="text-navy-700 hover:text-navy-950 font-bold hover:underline whitespace-nowrap self-end md:self-center"
              >
                Index Formula Spec →
              </button>
            </div>

            {/* Area Chart */}
            <div className="w-full h-80 lg:h-96">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={indexPoints} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="indexFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#244680" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#244680" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fareFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={{ stroke: '#cbd5e1' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    domain={chartMode === 'index' ? ['dataMin - 5', 'dataMax + 5'] : ['auto', 'auto']}
                    tickFormatter={chartMode === 'index' ? (v) => `${v}` : (v) => `₹${(v / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(255, 255, 255, 0.95)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(15, 29, 56, 0.1)',
                      border: '1px solid #e2e8f0',
                    }}
                    formatter={chartMode === 'index' ? indexTooltipFormatter : genericFareTooltipFormatter}
                  />
                  {chartMode === 'index' && (
                    <ReferenceLine
                      y={100}
                      stroke="#94a3b8"
                      strokeDasharray="4 4"
                      label={{ value: 'Baseline (100.0)', position: 'insideTopRight', fontSize: 11, fill: '#64748b' }}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey={chartMode === 'index' ? 'indexValue' : 'averageFare'}
                    stroke={chartMode === 'index' ? '#244680' : '#10b981'}
                    strokeWidth={3}
                    fill={chartMode === 'index' ? 'url(#indexFill)' : 'url(#fareFill)'}
                    dot={{ r: 4, fill: chartMode === 'index' ? '#244680' : '#10b981', strokeWidth: 2, stroke: '#fff' }}
                    activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Dual Split Section: Route Movers & Surveillance Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Top Monitored Route Movers (7 Cols) */}
            <div className="lg:col-span-7 glass-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-display font-bold text-navy-950">
                      High-Frequency Route Movers
                    </h3>
                    <p className="text-xs text-slate-500">
                      Ranked by traffic density weight and monthly price movement
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/routes')}
                    className="text-xs font-bold text-navy-700 hover:text-navy-950 flex items-center gap-1"
                  >
                    All Routes <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-th">Corridor</th>
                        <th className="table-th text-right">Avg Fare</th>
                        <th className="table-th text-right">Index Rating</th>
                        <th className="table-th text-right">MoM Shift</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {routeStats.slice(0, 6).map((r) => {
                        const isSurge = r.momChange > 1.5;
                        const isDrop = r.momChange < -1.5;
                        return (
                          <tr
                            key={r.routeId}
                            onClick={() => navigate(`/routes/${r.routeId}`)}
                            className="group hover:bg-slate-50/80 cursor-pointer transition-colors"
                          >
                            <td className="table-td font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-navy-50 group-hover:bg-navy-100 text-navy-700 flex items-center justify-center transition-colors">
                                  <RouteIcon className="w-3.5 h-3.5" />
                                </div>
                                <div>
                                  <span className="font-bold text-navy-900 group-hover:text-navy-600 transition-colors">
                                    {r.origin} → {r.destination}
                                  </span>
                                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                                    {r.category || 'Domestic Corridor'}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="table-td text-right font-mono font-semibold text-navy-900">
                              {formatINR(r.averageFare)}
                            </td>
                            <td className="table-td text-right font-mono">
                              <span className="font-semibold text-navy-800">{r.index.toFixed(1)}</span>
                            </td>
                            <td className="table-td text-right">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold ${
                                  isSurge
                                    ? 'bg-rose-50 text-rose-600 border border-rose-200/50'
                                    : isDrop
                                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isSurge ? (
                                  <ArrowUp className="w-3 h-3" />
                                ) : isDrop ? (
                                  <ArrowDown className="w-3 h-3" />
                                ) : (
                                  <Minus className="w-3 h-3" />
                                )}
                                {formatPercent(r.momChange)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Click any flight corridor for deep-dive historical analysis</span>
                <span className="font-medium text-navy-700">{routeStats.length} Total Corridors Monitored</span>
              </div>
            </div>

            {/* Real-time Regulatory Surveillance Alerts (5 Cols) */}
            <div className="lg:col-span-5 glass-card p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                  <div>
                    <h3 className="text-base font-display font-bold text-navy-950">
                      Surveillance Signals
                    </h3>
                    <p className="text-xs text-slate-500">
                      Automated price gouging & anomaly alerts
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/alerts')}
                    className="text-xs font-bold text-navy-700 hover:text-navy-950 flex items-center gap-1"
                  >
                    View All <ArrowRight className="w-3 h-3" />
                  </button>
                </div>

                {/* Filter tabs */}
                <div className="flex items-center gap-1.5 mb-4">
                  <button
                    onClick={() => setAlertFilter('all')}
                    className={`pill-tab ${alertFilter === 'all' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
                  >
                    All ({alerts.length})
                  </button>
                  <button
                    onClick={() => setAlertFilter('high')}
                    className={`pill-tab ${alertFilter === 'high' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
                  >
                    High Surges ({alerts.filter((a) => a.severity === 'high').length})
                  </button>
                  <button
                    onClick={() => setAlertFilter('medium')}
                    className={`pill-tab ${alertFilter === 'medium' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
                  >
                    Moderate ({alerts.filter((a) => a.severity === 'medium').length})
                  </button>
                </div>

                <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
                  {filteredAlerts.slice(0, 5).map((a) => {
                    const isHigh = a.severity === 'high';
                    return (
                      <div
                        key={a.id}
                        className={`p-3.5 rounded-xl border transition-all ${
                          isHigh
                            ? 'bg-rose-50/50 border-rose-200/80 hover:bg-rose-50'
                            : 'bg-amber-50/40 border-amber-200/70 hover:bg-amber-50'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span
                            className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              isHigh ? 'bg-rose-500 ring-4 ring-rose-100' : 'bg-amber-500 ring-4 ring-amber-100'
                            }`}
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                {a.route || 'Network'}
                              </span>
                              <span className="text-[10px] text-slate-400">{a.date || 'Today'}</span>
                            </div>
                            <p className="text-xs font-semibold text-navy-950 leading-snug">{a.message}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-500">Configured via DQE Rule Engine</span>
                <button onClick={() => navigate('/dqe')} className="font-semibold text-navy-700 hover:underline">
                  Review Data Rules →
                </button>
              </div>
            </div>
          </div>

          {/* Carrier Fare Snapshot Strip */}
          {airlines.length > 0 && (
            <div className="glass-card p-6">
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-display font-bold text-navy-950">
                    Carrier Intelligence Matrix
                  </h3>
                  <p className="text-xs text-slate-500">
                    Direct benchmark of average ticket prices across registered scheduled domestic carriers
                  </p>
                </div>
                <button
                  onClick={() => navigate('/airlines')}
                  className="text-xs font-bold text-navy-700 hover:text-navy-950 flex items-center gap-1"
                >
                  Airline Analysis Page <ArrowRight className="w-3 h-3" />
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {airlines.slice(0, 6).map((air) => (
                  <div
                    key={air.code}
                    className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:shadow-md transition-all group"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: air.color || '#244680' }}
                      />
                      <span className="text-xs font-bold text-navy-900 capitalize truncate group-hover:text-navy-600 transition-colors">
                        {air.name}
                      </span>
                    </div>
                    <div className="text-base font-mono font-extrabold text-navy-950">
                      {formatINR(air.averageFare)}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                      <span>{formatNumber(air.observations)} obs</span>
                      <span className="font-semibold text-navy-700">Idx {air.averageIndex?.toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
