import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { formatINR, formatNumber } from '@/data/random';
import {
  Plane, Globe, Filter, TrendingUp, CheckCircle2, ShieldCheck,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { FilterBar } from '@/components/FilterBar';
import { genericFareTooltipFormatter } from '@/components/chartFormatters';
import { apiAirlines, apiIndex, type ApiFilters } from '@/lib/api';
import { StaggerContainer, MotionItem } from '@/components/animation/MotionCard';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { motion } from 'framer-motion';

type ComparisonMode = 'airline' | 'source';

export function AirlinesPage() {
  const { filters, lastUpdate } = useApp();
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('airline');
  const [selected, setSelected] = useState<string[]>([]);
  const [stats, setStats] = useState<Array<{ code: string; name: string; averageFare: number; medianFare: number; minFare: number; maxFare: number; volatility: number; observations: number; averageIndex: number; color: string }>>([]);
  const [loading, setLoading] = useState(true);

  const handleModeChange = (mode: ComparisonMode) => {
    if (mode === comparisonMode) return;
    setSelected([]);
    setComparisonMode(mode);
  };

  useEffect(() => {
    setLoading(true);
    const apiFilters: ApiFilters = {
      origin: filters.origin !== 'all' ? filters.origin : undefined,
      destination: filters.destination !== 'all' ? filters.destination : undefined,
      travelClass: filters.travelClass !== 'all' ? filters.travelClass : undefined,
      bookingWindow: filters.bookingWindow !== 'all' ? filters.bookingWindow : undefined,
      preset: filters.preset,
      customStart: filters.customStart,
      customEnd: filters.customEnd,
      groupBy: comparisonMode,
    };
    Promise.all([apiAirlines(apiFilters), apiIndex(apiFilters)])
      .then(([airlineResponse]) => {
        const uniqueStats = Array.from(
          new Map(airlineResponse.data.map((item) => [item.code, item])).values()
        );
        setStats(uniqueStats);
        setSelected(uniqueStats.map((item) => item.code));
      })
      .catch((error) => console.error('Failed to fetch airline data:', error))
      .finally(() => setLoading(false));
  }, [filters, lastUpdate, comparisonMode]);

  const filtered = useMemo(() => {
    if (!stats.length) return [];
    if (!selected.length) return stats;
    const matches = stats.filter((s) => selected.includes(s.code));
    return matches.length ? matches : stats;
  }, [stats, selected]);

  const toggleAirline = (code: string) => {
    setSelected((prev) => {
      const current = prev.length ? prev : stats.map((s) => s.code);
      if (current.includes(code)) {
        const next = current.filter((c) => c !== code);
        return next.length ? next : stats.map((s) => s.code);
      }
      return [...current, code];
    });
  };

  const highestFareEntity = useMemo(() => {
    if (!stats.length) return null;
    return [...stats].sort((a, b) => b.averageFare - a.averageFare)[0];
  }, [stats]);

  const lowestFareEntity = useMemo(() => {
    if (!stats.length) return null;
    return [...stats].sort((a, b) => a.averageFare - b.averageFare)[0];
  }, [stats]);

  const totalObs = useMemo(() => {
    return stats.reduce((sum, s) => sum + s.observations, 0);
  }, [stats]);

  const barData = useMemo(() => {
    return filtered.map((s) => ({
      name: s.name,
      averageFare: s.averageFare,
      medianFare: s.medianFare,
      color: s.color,
    }));
  }, [filtered]);

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
                CROSS-CARRIER BENCHMARK
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Direct Scrapers & OTA Aggregators
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              Airline & Channel Fare Intelligence
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Compare base pricing, median yield, and tariff dispersion between scheduled airlines and major online travel agencies (OTAs).
            </p>
          </div>

          {/* Grouping Switcher Pill */}
          <div className="flex items-center bg-navy-900/80 p-1 rounded-xl border border-navy-700">
            <button
              onClick={() => handleModeChange('airline')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                comparisonMode === 'airline' ? 'bg-accent-500 text-navy-950 shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span>Airlines</span>
            </button>
            <button
              onClick={() => handleModeChange('source')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                comparisonMode === 'source' ? 'bg-accent-500 text-navy-950 shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>OTA Channels</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MotionItem>
          <DashboardKpiCard
            label={`Active ${comparisonMode === 'airline' ? 'Airlines' : 'OTAs'} Monitored`}
            value={`${stats.length} Entities`}
            sublabel={`${selected.length} selected for comparison`}
            statusText="Live Feeds"
            icon={<Plane className="w-5 h-5" />}
            accent="navy"
            progressPercent={100}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Highest Average Fare"
            value={highestFareEntity ? formatINR(highestFareEntity.averageFare) : '—'}
            sublabel={highestFareEntity ? highestFareEntity.name : undefined}
            statusText="Premium Tier"
            icon={<TrendingUp className="w-5 h-5" />}
            accent="danger"
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Most Economical Channel"
            value={lowestFareEntity ? formatINR(lowestFareEntity.averageFare) : '—'}
            sublabel={lowestFareEntity ? lowestFareEntity.name : undefined}
            statusText="Value Leader"
            icon={<CheckCircle2 className="w-5 h-5" />}
            accent="accent"
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Total Price Records"
            value={formatNumber(totalObs)}
            sublabel="Multi-source observations"
            statusText="Verified Pipeline"
            icon={<Globe className="w-5 h-5" />}
            accent="purple"
            loading={loading}
          />
        </MotionItem>
      </StaggerContainer>

      <FilterBar />

      {/* Selector Multi-Chips */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-navy-600" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Select {comparisonMode === 'airline' ? 'Airlines' : 'OTA Channels'} to Compare
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {stats.map((a) => {
            const isSelected = selected.includes(a.code);
            return (
              <button
                key={a.code}
                onClick={() => toggleAirline(a.code)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 ${
                  isSelected
                    ? 'border-navy-400 bg-navy-900 text-white shadow-sm'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: a.color || '#244680' }}
                />
                <span className="capitalize">{a.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bar Chart */}
      <div className="glass-card p-6">
        <div className="pb-5 mb-5 border-b border-slate-100">
          <h2 className="text-base font-display font-bold text-navy-950">
            Average vs. Median Fare Comparison
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Evaluating pricing skewness across selected {comparisonMode === 'airline' ? 'carriers' : 'booking sources'}
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Loading comparison metrics...</div>
        ) : (
          <div className="w-full h-80 lg:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 15 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={genericFareTooltipFormatter} />
                <Legend />
                <Bar dataKey="averageFare" name="Average Fare" fill="#244680" radius={[6, 6, 0, 0]} />
                <Bar dataKey="medianFare" name="Median Fare" fill="#38bdf8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Comparison Table */}
      <div className="glass-card p-6">
        <div className="pb-4 mb-4 border-b border-slate-100">
          <h3 className="text-base font-display font-bold text-navy-950">
            Detailed Statistical Breakdown
          </h3>
          <p className="text-xs text-slate-500">
            Comprehensive metrics including volatility and observation counts
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">{comparisonMode === 'airline' ? 'Carrier' : 'Channel'}</th>
                <th className="table-th text-right">Avg Fare</th>
                <th className="table-th text-right">Median Fare</th>
                <th className="table-th text-right">Min Fare</th>
                <th className="table-th text-right">Max Fare</th>
                <th className="table-th text-right">Volatility</th>
                <th className="table-th text-right">Observations</th>
                <th className="table-th text-right">Index Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="table-td font-bold text-navy-950">
                    <span className="w-2.5 h-2.5 rounded-full inline-block mr-2" style={{ backgroundColor: s.color }} />
                    <span className="capitalize">{s.name}</span>
                  </td>
                  <td className="table-td text-right font-mono font-bold text-navy-950">{formatINR(s.averageFare)}</td>
                  <td className="table-td text-right font-mono text-slate-700">{formatINR(s.medianFare)}</td>
                  <td className="table-td text-right font-mono text-xs text-slate-500">{formatINR(s.minFare)}</td>
                  <td className="table-td text-right font-mono text-xs text-slate-500">{formatINR(s.maxFare)}</td>
                  <td className="table-td text-right font-mono text-slate-700">{formatINR(s.volatility)}</td>
                  <td className="table-td text-right font-mono text-slate-700">{formatNumber(s.observations)}</td>
                  <td className="table-td text-right font-mono font-bold text-navy-950">{s.averageIndex.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
