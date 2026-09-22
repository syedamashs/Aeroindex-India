import { useEffect, useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/data/random';
import { FilterBar } from '@/components/FilterBar';
import { genericFareTooltipFormatter } from '@/components/chartFormatters';
import { apiAirlines, type ApiFilters } from '@/lib/api';
import { InsightBot, AIRLINE_COMPARISON_INSIGHTS } from '@/components/InsightBot';
import { Loader2, Globe, Plane } from 'lucide-react';

type ComparisonMode = 'airline' | 'source';

export function AirlinesPage() {
  const { filters, lastUpdate, setIsUiLoading } = useApp();
  const [selected, setSelected] = useState<string[]>([]);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>('airline');
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

  // Immediate clean mode switch
  const handleModeChange = (mode: ComparisonMode) => {
    if (mode === comparisonMode) return;
    setLoading(true);
    setStats([]);
    setSelected([]);
    setComparisonMode(mode);
  };

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setIsUiLoading(true);
    setStats([]);
    setSelected([]);

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
        if (!isMounted) return;
        const uniqueStats = Array.from(
          new Map(airlineResponse.data.map((item) => [item.code, item])).values()
        );
        setStats(uniqueStats);
        setSelected(uniqueStats.map((item) => item.code));
      })
      .catch((error) => {
        if (!isMounted) return;
        console.error('Failed to fetch comparison data:', error);
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
        setIsUiLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [filters, lastUpdate, comparisonMode, setIsUiLoading]);

  const filtered = useMemo(() => {
    if (!stats.length) return [];
    if (!selected.length) return stats;
    const matches = stats.filter((s) => selected.includes(s.code));
    return matches.length ? matches : stats;
  }, [stats, selected]);

  const toggleCarrier = (code: string) => {
    setSelected((prev) => {
      if (prev.includes(code)) {
        const next = prev.filter((c) => c !== code);
        return next.length ? next : stats.map((s) => s.code);
      }
      return [...prev, code];
    });
  };

  const isOTA = comparisonMode === 'source';

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-slate-400">Market Benchmarks</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono text-slate-500">
              {isOTA ? 'OTA Distribution Channels' : 'Scheduled Domestic Carriers'}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-0.5">
            {isOTA ? 'Online Travel Agency (OTA) Comparison' : 'Airline Carrier Comparison'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isOTA
              ? 'Distribution channels, booking platforms, and aggregate OTA tariff spreads'
              : 'Cross-carrier yield benchmarks, fare dispersion, and observation market share'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InsightBot
            title={isOTA ? 'OTA Platform Comparison' : 'Airline Carrier Comparison'}
            subtitle={isOTA ? 'MakeMyTrip · EaseMyTrip · Cleartrip' : 'IndiGo · Air India · SpiceJet'}
            insights={AIRLINE_COMPARISON_INSIGHTS}
          />

          {/* Group by mode switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => handleModeChange('airline')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                comparisonMode === 'airline'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Plane className="w-3.5 h-3.5" />
              <span>By Airline Carrier</span>
            </button>
            <button
              onClick={() => handleModeChange('source')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                comparisonMode === 'source'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>By OTA Carriers</span>
            </button>
          </div>
        </div>
      </div>

      {/* Global Compact Filter Bar */}
      <FilterBar />

      {/* 2. CARRIER / CHANNEL SELECTION FILTER STRIP */}
      <div className="flex flex-wrap items-center gap-2 text-xs min-h-[36px]">
        <span className="text-[11px] font-mono text-slate-500 uppercase tracking-wider mr-1">
          {isOTA ? 'Filter OTA Channels:' : 'Filter Carriers:'}
        </span>

        {loading ? (
          /* Sleek loading skeleton pills */
          <div className="flex flex-wrap items-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-7 w-24 bg-slate-100 animate-pulse rounded border border-slate-200/80"
              />
            ))}
          </div>
        ) : (
          stats.map((carrier) => {
            const isSelected = selected.includes(carrier.code);
            return (
              <button
                key={carrier.code}
                onClick={() => toggleCarrier(carrier.code)}
                className={`px-3 py-1 rounded border text-xs font-medium transition-all ${
                  isSelected
                    ? isOTA
                      ? 'bg-sky-900 text-white border-sky-900 shadow-xs'
                      : 'bg-slate-900 text-white border-slate-900 shadow-xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {carrier.name}
              </button>
            );
          })
        )}
      </div>

      {/* 3. PRIMARY COMPARISON TABLE */}
      <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        {loading ? (
          /* Cohesive Unified Loading Card for Table */
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className={`w-6 h-6 animate-spin ${isOTA ? 'text-sky-600' : 'text-amber-500'}`} />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                {isOTA
                  ? 'Querying Online Travel Agency (OTA) Distribution Channels...'
                  : 'Querying Scheduled Airline Carrier Telemetry...'}
              </p>
              <p className="text-xs text-slate-400 font-mono">
                Calculating mean tariffs, median spreads, relative index, and volatility across monitored routes
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto animate-fade-in">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-th">{isOTA ? 'OTA Channel / Platform' : 'Carrier'}</th>
                  <th className="table-th text-right">Average Fare</th>
                  <th className="table-th text-right">Median Fare</th>
                  <th className="table-th text-right">Fare Range (Min — Max)</th>
                  <th className="table-th text-right">Relative Index</th>
                  <th className="table-th text-center">Volatility</th>
                  <th className="table-th text-right">Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {filtered.map((carrier) => (
                  <tr key={carrier.code} className="table-row">
                    <td className="table-td font-sans font-semibold text-slate-900 flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: carrier.color || (isOTA ? '#0284c7' : '#c2410c') }}
                      />
                      <span>{carrier.name}</span>
                      <span className="text-slate-400 font-mono font-normal text-[11px]">({carrier.code})</span>
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. VISUAL COMPARISON CHART */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="pb-3 mb-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              {isOTA
                ? 'Average vs. Median Fare Comparison by OTA Channel'
                : 'Average vs. Median Fare Comparison by Airline Carrier'}
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {isOTA
                ? 'Tariff variance across major Indian online booking engines and aggregators'
                : 'Disparity illustrates skew caused by high-priced last-minute inventory'}
            </p>
          </div>
        </div>

        {loading ? (
          /* Sleek chart loading state */
          <div className="h-64 flex flex-col items-center justify-center gap-2 text-xs text-slate-400 font-mono bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
            <Loader2 className={`w-5 h-5 animate-spin ${isOTA ? 'text-sky-600' : 'text-amber-500'}`} />
            <span>
              {isOTA ? 'Rendering OTA price dispersion chart...' : 'Rendering carrier comparison chart...'}
            </span>
          </div>
        ) : (
          <div className="h-64 w-full animate-fade-in">
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
                <Bar dataKey="Average Fare" fill={isOTA ? '#0284c7' : '#c2410c'} radius={[3, 3, 0, 0]} />
                <Bar dataKey="Median Fare" fill="#94a3b8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
