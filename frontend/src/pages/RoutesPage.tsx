import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterBar } from '@/components/FilterBar';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent, formatNumber } from '@/data/random';
import {
  Search, ArrowUp, ArrowDown, Minus, Download, Route as RouteIcon,
  AlertTriangle, TrendingUp, ShieldCheck, Map as MapIcon,
  ArrowUpDown, CheckCircle2,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import type { RouteStats } from '@/data/types';
import { apiRoutes, type ApiFilters } from '@/lib/api';
import { StaggerContainer, MotionItem, MotionCard } from '@/components/animation/MotionCard';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { fireConfetti } from '@/components/animation/confetti';
import { motion } from 'framer-motion';

type SortKey = keyof Pick<RouteStats, 'averageFare' | 'index' | 'momChange' | 'yoyChange' | 'observations' | 'volatility'>;

export function RoutesPage() {
  const { filters, lastUpdate } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('momChange');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [routeStats, setRouteStats] = useState<any[]>([]);
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
        const res = await apiRoutes(apiFilters);
        setRouteStats(res.data);
      } catch (error) {
        console.error('Failed to fetch routes:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters, lastUpdate]);

  // Derived KPIs
  const topSurgeRoute = useMemo(() => {
    if (!routeStats.length) return null;
    return [...routeStats].sort((a, b) => b.momChange - a.momChange)[0];
  }, [routeStats]);

  const mostVolatileRoute = useMemo(() => {
    if (!routeStats.length) return null;
    return [...routeStats].sort((a, b) => b.volatility - a.volatility)[0];
  }, [routeStats]);

  const bestValueRoute = useMemo(() => {
    if (!routeStats.length) return null;
    return [...routeStats].sort((a, b) => a.averageFare - b.averageFare)[0];
  }, [routeStats]);

  const filtered = useMemo(() => {
    let result = routeStats;

    if (riskFilter !== 'all') {
      result = result.filter((r) => r.risk === riskFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.origin.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          `${r.origin}-${r.destination}`.toLowerCase().includes(q),
      );
    }

    result = [...result].sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * dir;
    });

    return result;
  }, [routeStats, search, sortBy, sortDir, riskFilter]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const exportCSV = () => {
    const headers = ['Route', 'Average Fare', 'Median Fare', 'Index', 'MoM Change %', 'YoY Change %', 'Min Fare', 'Max Fare', 'Volatility', 'Observations', 'Risk'];
    const rows = filtered.map((r) => [
      `${r.origin}-${r.destination}`,
      r.averageFare,
      r.medianFare,
      r.index,
      r.momChange,
      r.yoyChange,
      r.minFare,
      r.maxFare,
      r.volatility,
      r.observations,
      r.risk,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vayuyaan-route-analysis.csv';
    a.click();
    URL.revokeObjectURL(url);
    fireConfetti({ spread: 55, origin: { y: 0.3 } });
  };

  const maxFareAcrossAll = useMemo(() => {
    return Math.max(...routeStats.map((r) => r.averageFare || 0), 25000);
  }, [routeStats]);

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
                CORRIDOR-LEVEL SURVEILLANCE
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                High-Density Passenger Trunk Routes
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              Route-Level Airfare Intelligence
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Granular price dynamics, volatility indices, and tariff gouging risk assessments across Indian domestic trunk corridors.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => navigate('/map')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold transition-all backdrop-blur-sm active:scale-95"
            >
              <MapIcon className="w-3.5 h-3.5" />
              <span>India Network Map</span>
            </button>
            <button
              onClick={exportCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-navy-900 hover:bg-slate-100 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Surveillance KPI Grid */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MotionItem>
          <DashboardKpiCard
            label="Corridors Monitored"
            value={`${routeStats.length} Corridors`}
            sublabel="Trunk & regional connections"
            statusText="Active Coverage"
            icon={<RouteIcon className="w-5 h-5" />}
            accent="navy"
            progressPercent={100}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Highest Surge Corridor"
            value={topSurgeRoute ? `${topSurgeRoute.origin} → ${topSurgeRoute.destination}` : '—'}
            change={topSurgeRoute?.momChange}
            sublabel={topSurgeRoute ? `Avg ${formatINR(topSurgeRoute.averageFare)}` : undefined}
            statusText="Max MoM Spike"
            icon={<AlertTriangle className="w-5 h-5" />}
            accent="danger"
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Top Volatility Corridor"
            value={mostVolatileRoute ? `${mostVolatileRoute.origin} → ${mostVolatileRoute.destination}` : '—'}
            sublabel={mostVolatileRoute ? `Volatility ${formatINR(mostVolatileRoute.volatility)}` : undefined}
            statusText="Dynamic Pricing"
            icon={<TrendingUp className="w-5 h-5" />}
            accent="warning"
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Best Value Corridor"
            value={bestValueRoute ? `${bestValueRoute.origin} → ${bestValueRoute.destination}` : '—'}
            sublabel={bestValueRoute ? `Lowest Avg ${formatINR(bestValueRoute.averageFare)}` : undefined}
            statusText="Economical Trunk"
            icon={<CheckCircle2 className="w-5 h-5" />}
            accent="accent"
            loading={loading}
          />
        </MotionItem>
      </StaggerContainer>

      <FilterBar />

      {/* Main Table Glass Card */}
      <div className="glass-card p-6">
        {/* Table Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 mb-5 border-b border-slate-100">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 text-navy-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500 transition"
              placeholder="Search corridors by city code (e.g., DEL, BOM, BLR)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Risk Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setRiskFilter('all')}
              className={`pill-tab ${riskFilter === 'all' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
            >
              All ({routeStats.length})
            </button>
            <button
              onClick={() => setRiskFilter('high')}
              className={`pill-tab ${riskFilter === 'high' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
            >
              High Risk ({routeStats.filter((r) => r.risk === 'high').length})
            </button>
            <button
              onClick={() => setRiskFilter('medium')}
              className={`pill-tab ${riskFilter === 'medium' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
            >
              Moderate ({routeStats.filter((r) => r.risk === 'medium').length})
            </button>
            <button
              onClick={() => setRiskFilter('low')}
              className={`pill-tab ${riskFilter === 'low' ? 'pill-tab-active' : 'pill-tab-inactive'}`}
            >
              Stable ({routeStats.filter((r) => r.risk === 'low').length})
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <div className="inline-block w-7 h-7 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-500">Loading route intelligence...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Corridor</th>
                  <th
                    className="table-th text-right cursor-pointer hover:text-navy-900 group"
                    onClick={() => handleSort('averageFare')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Avg Fare <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-navy-700" />
                    </span>
                  </th>
                  <th
                    className="table-th text-right cursor-pointer hover:text-navy-900 group"
                    onClick={() => handleSort('index')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Index <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-navy-700" />
                    </span>
                  </th>
                  <th
                    className="table-th text-right cursor-pointer hover:text-navy-900 group"
                    onClick={() => handleSort('momChange')}
                  >
                    <span className="inline-flex items-center gap-1">
                      MoM Change <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-navy-700" />
                    </span>
                  </th>
                  <th className="table-th text-right">Fare Spread (Min – Max)</th>
                  <th
                    className="table-th text-right cursor-pointer hover:text-navy-900 group"
                    onClick={() => handleSort('observations')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Observations <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-navy-700" />
                    </span>
                  </th>
                  <th
                    className="table-th text-right cursor-pointer hover:text-navy-900 group"
                    onClick={() => handleSort('volatility')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Volatility <ArrowUpDown className="w-3 h-3 text-slate-400 group-hover:text-navy-700" />
                    </span>
                  </th>
                  <th className="table-th text-center">Risk Level</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => {
                  const isSurge = r.momChange > 1.5;
                  const isDrop = r.momChange < -1.5;
                  const farePercent = Math.min(100, (r.averageFare / maxFareAcrossAll) * 100);

                  return (
                    <tr
                      key={r.routeId}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                      onClick={() => navigate(`/routes/${r.routeId}`)}
                    >
                      <td className="table-td font-medium">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-navy-50 group-hover:bg-navy-100 text-navy-700 flex items-center justify-center transition-colors">
                            <RouteIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-navy-950 group-hover:text-navy-600 transition-colors">
                              {r.origin} → {r.destination}
                            </span>
                            <span className="block text-[10px] text-slate-400 uppercase font-semibold">
                              {r.category || 'Trunk Route'}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="table-td text-right">
                        <div className="font-mono font-bold text-navy-950">{formatINR(r.averageFare)}</div>
                        <div className="w-24 ml-auto bg-slate-100 h-1 rounded-full mt-1 overflow-hidden">
                          <div className="bg-navy-600 h-full rounded-full" style={{ width: `${farePercent}%` }} />
                        </div>
                      </td>

                      <td className="table-td text-right font-mono font-bold text-navy-950">
                        {r.index.toFixed(1)}
                      </td>

                      <td className="table-td text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
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

                      <td className="table-td text-right font-mono text-xs text-slate-600">
                        {formatINR(r.minFare)} – {formatINR(r.maxFare)}
                      </td>

                      <td className="table-td text-right font-mono text-slate-700">
                        {formatNumber(r.observations)}
                      </td>

                      <td className="table-td text-right font-mono text-slate-700">
                        {formatINR(r.volatility)}
                      </td>

                      <td className="table-td text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${
                            r.risk === 'high'
                              ? 'bg-rose-100/80 text-rose-700 border border-rose-200'
                              : r.risk === 'medium'
                              ? 'bg-amber-100/80 text-amber-700 border border-amber-200'
                              : 'bg-emerald-100/80 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              r.risk === 'high' ? 'bg-rose-600' : r.risk === 'medium' ? 'bg-amber-600' : 'bg-emerald-600'
                            }`}
                          />
                          {r.risk}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Showing {filtered.length} of {routeStats.length} monitored routes</span>
          <span className="font-semibold text-navy-700">Click any row for route historical breakdown</span>
        </div>
      </div>
    </div>
  );
}
