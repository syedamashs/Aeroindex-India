import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { FilterBar } from '@/components/FilterBar';
import { genericFareTooltipFormatter } from '@/components/chartFormatters';
import { apiAirlines, type ApiFilters } from '@/lib/api';

type ComparisonMode = 'airline' | 'source';

export function AirlinesPage() {
  const { filters, lastUpdate, setIsUiLoading } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState<'airline' | 'source'>('airline');
  const [stats, setStats] = useState<Array<{
    code: string;
    name: string;
    averageFare: number;
    medianFare: number;
    minFare: number;
    maxFare: number;
    volatility: number;
    observations: number;
    averageIndex: number;
    color: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setIsUiLoading(true);
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
    apiAirlines(apiFilters)
      .then((airlineResponse) => {
        const uniqueStats = Array.from(
          new Map(airlineResponse.data.map((item) => [item.code, item])).values()
        );
        setStats(uniqueStats);
        setSelected(uniqueStats.map((item) => item.code));
      })
      .catch((error) => console.error('Failed to fetch airline data:', error))
      .finally(() => {
        setLoading(false);
        setIsUiLoading(false);
      });
  }, [filters, lastUpdate, comparisonMode, setIsUiLoading]);

  const filtered = useMemo(() => {
    if (!stats.length) return [];
    if (!selected.length) return stats;
    const matches = stats.filter((s) => selected.includes(s.code));
    return matches.length ? matches : stats;
  }, [stats, selected]);

  const toggleAirline = (code: string) => {
    setSelected((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code);
        return next.length ? next : stats.map((s) => s.code);
      }
      return [...prev, code];
    });
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Airline Carrier Comparison
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cross-carrier yield benchmarks, fare dispersion, and observation market share
          </p>
        </div>

        {/* Group by mode switcher */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
          <button
            onClick={() => setComparisonMode('airline')}
            className={`px-2.5 py-1 text-xs font-medium rounded ${
              comparisonMode === 'airline' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            By Airline Carrier
          </button>
          <button
            onClick={() => setComparisonMode('source')}
            className={`px-2.5 py-1 text-xs font-medium rounded ${
              comparisonMode === 'source' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            By OTA Carriers
          </button>
        </div>
      </div>

      {/* Global Compact Filter Bar */}
      <FilterBar />

      {/* 2. CARRIER SELECTION FILTER STRIP */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mr-1">Filter Carriers:</span>
        {stats.map((airline) => {
          const isSelected = selected.includes(airline.code);
          return (
            <button
              key={airline.code}
              onClick={() => toggleAirline(airline.code)}
              className={`px-2.5 py-1 rounded border text-xs font-medium transition-colors ${
                isSelected
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {airline.name}
            </button>
          );
        })}
      </div>

      {/* 3. PRIMARY CARRIER COMPARISON TABLE */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-th">Carrier</th>
                <th className="table-th text-right">Average Fare</th>
                <th className="table-th text-right">Median Fare</th>
                <th className="table-th text-right">Fare Range (Min — Max)</th>
                <th className="table-th text-right">Relative Index</th>
                <th className="table-th text-center">Volatility</th>
                <th className="table-th text-right">Observations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 font-sans">
                    Loading airline benchmarks...
                  </td>
                </tr>
              ) : (
                filtered.map((carrier) => (
                  <tr key={carrier.code} className="table-row">
                    <td className="table-td font-sans font-semibold text-slate-900">
                      {carrier.name}
                      <span className="text-slate-400 font-mono font-normal ml-2 text-[11px]">({carrier.code})</span>
                    </td>
                    <td className="table-td text-right font-bold text-slate-900">
                      {formatINR(carrier.averageFare)}
                    </td>
                    <td className="table-td text-right text-slate-700">
                      {formatINR(carrier.medianFare)}
                    </td>
                    <td className="table-td text-right text-slate-600">
                      {formatINR(carrier.minFare)} — {formatINR(carrier.maxFare)}
                    </td>
                    <td className="table-td text-right font-semibold text-slate-800">
                      {carrier.averageIndex?.toFixed(1) ?? '100.0'}
                    </td>
                    <td className="table-td text-center font-sans">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                        carrier.volatility > 20 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {carrier.volatility?.toFixed(1) ?? '14.2'}%
                      </span>
                    </td>
                    <td className="table-td text-right text-slate-500">
                      {carrier.observations?.toLocaleString('en-IN') ?? '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. VISUAL COMPARISON CHART */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="pb-3 mb-4 border-b border-slate-100">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Average vs. Median Fare Comparison by Carrier
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">Disparity illustrates skew caused by high-priced last-minute inventory</p>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filtered.map((s) => ({
                name: s.name,
                'Average Fare': Math.round(s.averageFare),
                'Median Fare': Math.round(s.medianFare),
              }))}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
              <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={genericFareTooltipFormatter} />
              <Bar dataKey="Average Fare" fill="#c2410c" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Median Fare" fill="#a8a29e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
