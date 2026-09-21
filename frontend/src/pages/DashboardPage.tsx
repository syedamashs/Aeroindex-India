import { useState, useEffect, useMemo } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { FilterBar } from '@/components/FilterBar';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { indexTooltipFormatter, genericFareTooltipFormatter } from '@/components/chartFormatters';
import {
  apiIndex, apiRoutes, apiAlerts, apiStatistics, apiAirlines, type ApiFilters,
} from '@/lib/api';
import { ArrowUpRight, ArrowDownRight, Minus, Loader2 } from 'lucide-react';
import { InsightBot, DASHBOARD_OVERVIEW_INSIGHTS, INDEX_TRAJECTORY_INSIGHTS } from '@/components/InsightBot';
import { FlightTrajectoryChart } from '@/components/FlightTrajectoryChart';

export function DashboardPage() {
  const { filters, lastUpdate, setIsUiLoading } = useApp();
  const navigate = useNavigate();

  const [indexPoints, setIndexPoints] = useState<any[]>([]);
  const [routeStats, setRouteStats] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [, setAirlines] = useState<any[]>([]);
  const [statistics, setStatistics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<'index' | 'fare'>('index');
  const [routePage, setRoutePage] = useState(1);

  const indexYDomain = useMemo(() => {
    const vals = indexPoints.map((p: any) => p.indexValue).filter(Boolean);
    if (!vals.length) return [90, 115] as [number, number];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    return [Math.floor(min - 3), Math.ceil(max + 3)] as [number, number];
  }, [indexPoints]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setIsUiLoading(true);
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
        setIsUiLoading(false);
      }
    };

    fetchData();
  }, [filters, lastUpdate, setIsUiLoading]);

  const latest = indexPoints[indexPoints.length - 1];
  const momChange = latest?.percentageChange ?? 0;
  const isUp = momChange > 0;
  const isDown = momChange < 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
          {error}
        </div>
      )}

      {/* 1. NATIONAL AIRFARE INDEX HEADLINE (ON TOP) */}
      <section className="pb-1" id="guide-headline-index">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-stone-900">
            National Airfare Index
          </h1>

          {/* Eye-catching Signature Index Badge */}
          <div className="inline-flex items-center px-4 py-1.5 rounded-xl bg-stone-900 border border-stone-800 shadow-sm ring-1 ring-amber-500/20 min-h-[44px]">
            {loading ? (
              <span className="inline-flex items-center gap-2 py-0.5 text-amber-400">
                <Loader2 className="w-5 h-5 animate-spin text-amber-400" />
                <span className="text-sm font-mono tracking-wider text-amber-300">Loading...</span>
              </span>
            ) : (
              <span className="text-2xl sm:text-3xl lg:text-4xl font-mono font-extrabold text-amber-400 tracking-tight">
                {latest?.indexValue ? latest.indexValue.toFixed(1) : '100.0'}
              </span>
            )}
          </div>

          <InsightBot
            title="National Airfare Index"
            subtitle="Composite dashboard overview"
            insights={DASHBOARD_OVERVIEW_INSIGHTS}
            triggerLabel="What is this?"
          />
        </div>
      </section>

      {/* 2. GLOBAL COMPACT FILTER BAR (BELOW THE AIRFARE INDEX) */}
      <FilterBar />

      {/* 3. MARKET COVERAGE & SUMMARY METRICS (BELOW FILTER BAR) */}
      <section id="guide-market-coverage" className="bg-slate-100/70 border border-slate-200 rounded-lg p-4">
        <div className="mb-3 border-b border-slate-200 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
            Market Coverage &amp; Pipeline Health
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 text-xs font-mono">
          <div>
            <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Routes Monitored</span>
            <span className="text-base sm:text-lg font-bold text-slate-900">
              {loading ? (
                <span className="inline-block w-8 h-4 bg-slate-200 animate-pulse rounded my-1" />
              ) : (
                statistics?.routesMonitored ?? (statistics?.total_routes || routeStats.length || 152)
              )}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">Trunk Corridors</span>
          </div>
          <div>
            <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Airlines Active</span>
            <span className="text-base sm:text-lg font-bold text-slate-900">
              {loading ? (
                <span className="inline-block w-6 h-4 bg-slate-200 animate-pulse rounded my-1" />
              ) : (
                statistics?.airlinesMonitored ?? 6
              )}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">Scheduled Domestic</span>
          </div>
          <div>
            <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">OTAs Active</span>
            <span className="text-base sm:text-lg font-bold text-slate-900">
              {loading ? (
                <span className="inline-block w-6 h-4 bg-slate-200 animate-pulse rounded my-1" />
              ) : (
                statistics?.otasActive ?? 5
              )}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">Distribution Channels</span>
          </div>
          <div>
            <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">MoM Shift</span>
            <span className={`text-base sm:text-lg font-bold inline-flex items-center ${isUp ? 'text-rose-600' : isDown ? 'text-emerald-700' : 'text-slate-700'}`}>
              {loading ? (
                <span className="inline-block w-12 h-4 bg-slate-200 animate-pulse rounded my-1" />
              ) : (
                <>
                  {isUp && <ArrowUpRight className="w-4 h-4 mr-0.5" />}
                  {isDown && <ArrowDownRight className="w-4 h-4 mr-0.5" />}
                  {formatPercent(momChange)}
                </>
              )}
            </span>
            <span className="text-[10px] text-slate-400 block font-sans">vs Previous Month</span>
          </div>
          <div>
            <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Baseline Benchmark</span>
            <span className="text-base sm:text-lg font-bold text-slate-900">100.0</span>
            <span className="text-[10px] text-slate-400 block font-sans">January 2026 = 100.0</span>
          </div>
        </div>
      </section>

      {/* 3. PRIMARY TIME-SERIES CHART WITH FLIGHT SIMULATION */}
      <div id="guide-trajectory-chart">
        <FlightTrajectoryChart
          data={indexPoints}
          loading={loading}
          title="National Airfare Index Trajectory"
          subtitle="Monthly weighted cohort aggregation across monitored domestic city-pairs"
          showModeSwitcher={true}
          showInsightBot={true}
          botInsights={INDEX_TRAJECTORY_INSIGHTS}
        />
      </div>

      {/* 4. ROUTE ACTIVITY TABLE (PAGINATED 10 PER PAGE) */}
      {(() => {
        const ROUTE_PAGE_SIZE = 10;
        const totalRoutePages = Math.max(1, Math.ceil(routeStats.length / ROUTE_PAGE_SIZE));
        const paginatedRoutes = routeStats.slice((routePage - 1) * ROUTE_PAGE_SIZE, routePage * ROUTE_PAGE_SIZE);

        return (
          <section id="guide-route-activity" className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Route Activity
                  </h2>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200">
                    {routeStats.length} Monitored Corridors
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Click any route to view detailed pricing analytics, carrier market share &amp; fare trajectory
                </p>
              </div>
              <button
                onClick={() => navigate('/routes')}
                className="text-xs text-amber-800 hover:text-amber-900 font-medium underline decoration-amber-300 self-start sm:self-auto"
              >
                Open Route Watch →
              </button>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr>
                      <th className="table-th">Route</th>
                      <th className="table-th">Direction</th>
                      <th className="table-th text-right">Current Fare</th>
                      <th className="table-th text-right">MoM Change</th>
                      <th className="table-th text-right">Route Index</th>
                      <th className="table-th text-center">Volatility</th>
                      <th className="table-th text-right">Observations</th>
                      <th className="table-th text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-xs">
                    {paginatedRoutes.map((route) => {
                      const up = route.momChange > 0;
                      const down = route.momChange < 0;
                      return (
                        <tr
                          key={route.routeId}
                          onClick={() => navigate(`/routes/${route.routeId}`)}
                          className="table-row cursor-pointer hover:bg-amber-50/40 group transition-colors"
                          title={`Click to view detailed analytics for ${route.origin} → ${route.destination}`}
                        >
                          <td className="table-td font-sans font-semibold text-slate-900 group-hover:text-amber-900">
                            {route.origin} — {route.destination}
                          </td>
                          <td className="table-td font-sans text-slate-500">
                            Domestic Trunk
                          </td>
                          <td className="table-td text-right font-semibold text-slate-900">
                            {formatINR(route.averageFare)}
                          </td>
                          <td className="table-td text-right">
                            <span className={`inline-flex items-center font-semibold ${up ? 'text-rose-600' : down ? 'text-emerald-700' : 'text-slate-500'
                              }`}>
                              {up ? `+${route.momChange}%` : `${route.momChange}%`}
                            </span>
                          </td>
                          <td className="table-td text-right text-slate-700">
                            {route.index ? route.index.toFixed(1) : '100.0'}
                          </td>
                          <td className="table-td text-center font-sans">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${route.volatility > 20
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                              }`}>
                              {route.volatility?.toFixed(1) ?? '12.0'}%
                            </span>
                          </td>
                          <td className="table-td text-right text-slate-500">
                            {route.observations?.toLocaleString('en-IN') ?? '—'}
                          </td>
                          <td className="table-td text-right font-sans">
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 group-hover:bg-amber-100 group-hover:text-amber-950 px-2 py-0.5 rounded border border-amber-200/80 transition-colors">
                              View Details →
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-slate-600">
                <span className="font-mono text-[11px]">
                  Showing <strong>{routeStats.length ? (routePage - 1) * ROUTE_PAGE_SIZE + 1 : 0}</strong>–<strong>{Math.min(routePage * ROUTE_PAGE_SIZE, routeStats.length)}</strong> of <strong>{routeStats.length}</strong> routes
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRoutePage((p) => Math.max(1, p - 1))}
                    disabled={routePage <= 1}
                    className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-xs cursor-pointer"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs font-mono text-slate-500 px-1">
                    Page {routePage} of {totalRoutePages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setRoutePage((p) => Math.min(totalRoutePages, p + 1))}
                    disabled={routePage >= totalRoutePages}
                    className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-xs cursor-pointer"
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      })()}
    </div>
  );
}
