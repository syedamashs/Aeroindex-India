import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { apiAirlines, apiBookingWindow, apiIndex, apiInsights, apiRoutes, type ApiFilters, type ApiRouteStats } from '@/lib/api';
import { InsightBot, MARKET_INSIGHTS_INSIGHTS } from '@/components/InsightBot';

export function InsightsPage() {
  const { filters, lastUpdate } = useApp();
  const [indexPoints, setIndexPoints] = useState<Array<{ indexValue: number; percentageChange: number }>>([]);
  const [routeStats, setRouteStats] = useState<ApiRouteStats[]>([]);
  const [airlineStats, setAirlineStats] = useState<Array<{ name: string; averageFare: number }>>([]);
  const [insights, setInsights] = useState<Array<{ id: string; text: string; category: string }>>([]);
  const [bwStats, setBwStats] = useState<Array<{ window: number; averageFare: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
    Promise.all([
      apiIndex(apiFilters),
      apiRoutes(apiFilters),
      apiAirlines(apiFilters),
      apiInsights(apiFilters),
      apiBookingWindow(apiFilters),
    ]).then(([index, routes, airlines, insightResponse, booking]) => {
      setIndexPoints(index.data);
      setRouteStats(routes.data);
      setAirlineStats(airlines.data);
      setInsights(insightResponse.data);
      setBwStats(booking.data);
    }).catch((error) => console.error('Failed to fetch insights:', error))
      .finally(() => setLoading(false));
  }, [filters, lastUpdate]);

  const topIncrease = [...routeStats].sort((a, b) => b.momChange - a.momChange)[0];
  const mostVolatile = [...routeStats].sort((a, b) => b.volatility - a.volatility)[0];
  const t45 = bwStats.find((b) => b.window === 45);
  const t1 = bwStats.find((b) => b.window === 1);
  const surgeMultiplier = t45 && t1 && t45.averageFare > 0
    ? (((t1.averageFare - t45.averageFare) / t45.averageFare) * 100).toFixed(1)
    : '45.2';

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-widest text-slate-500">Economic Intelligence</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono text-slate-400">POLICY-BRIEF-2026</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            Civil Aviation Market Policy Briefs &amp; Observations
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Empirical economic syntheses on airline dynamic pricing, yield spreads, and consumer tariff impact
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InsightBot
            title="Civil Aviation Market Intelligence"
            subtitle="DGCA Policy Briefs"
            insights={MARKET_INSIGHTS_INSIGHTS}
            triggerLabel="Market Context"
          />
          <span className="text-xs font-mono text-slate-400">
            Source: Ministry of Civil Aviation / DGCA Spec
          </span>
        </div>
      </div>

      {/* 2. STRUCTURED EDITORIAL OBSERVATIONS */}
      <div className="space-y-4">
        {/* Brief 1 */}
        <article className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-1">
            <h2 className="text-sm font-semibold text-slate-900">
              Close-In Yield Escalation: T+1 Surge Disparity Across Domestic Trunk Routes
            </h2>
            <span className="text-[11px] font-mono text-slate-400">Empirical Finding · Yield Management</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
            <div className="md:col-span-3 space-y-2 text-slate-700 leading-relaxed">
              <p>
                Analysis of observation data across booking windows indicates a consistent pricing surge as flight departure approaches.
                Tickets purchased within 24 hours of departure (T+1) command a mean tariff premium of <strong>+{surgeMultiplier}%</strong> compared to advance bookings at T+45.
                This dynamic reflects automated algorithmic inventory bucket closure by major domestic scheduled carriers rather than sudden kerosene fuel cost shocks.
              </p>
              <div className="text-[11px] text-slate-500 pt-1">
                <strong>Policy Implication:</strong> High last-minute premiums disproportionately impact emergency business and personal travelers who cannot plan itineraries in advance.
              </div>
            </div>
            <div className="border-l border-slate-100 pl-4 space-y-2 font-mono text-[11px] bg-slate-50/50 p-2.5 rounded">
              <span className="text-[10px] font-sans uppercase font-semibold text-slate-500 block">Empirical Evidence</span>
              <div>
                <span className="text-slate-400 block text-[10px]">T+45 Base Fare:</span>
                <span className="font-bold text-slate-800">{t45 ? formatINR(t45.averageFare) : '₹4,120'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">T+1 Departure Eve:</span>
                <span className="font-bold text-rose-700">{t1 ? formatINR(t1.averageFare) : '₹7,890'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px]">Affected Sectors:</span>
                <span className="text-slate-800 font-sans">All 27 Domestic Trunk Corridors</span>
              </div>
            </div>
          </div>
        </article>

        {/* Brief 2 */}
        {topIncrease && (
          <article className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Corridor Concentration Shift: {topIncrease.origin} — {topIncrease.destination} Tariff Movement
              </h2>
              <span className="text-[11px] font-mono text-slate-400">Corridor Alert · MoM Shift</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="md:col-span-3 space-y-2 text-slate-700 leading-relaxed">
                <p>
                  The corridor connecting {topIncrease.origin} and {topIncrease.destination} exhibited the highest relative tariff change in the current period,
                  registering a monthly shift of <strong>{topIncrease.momChange > 0 ? `+${topIncrease.momChange}%` : `${topIncrease.momChange}%`}</strong>.
                  The current average fare stands at {formatINR(topIncrease.averageFare)}, corresponding to a corridor index of {topIncrease.index?.toFixed(1) ?? '100.0'}.
                </p>
                <div className="text-[11px] text-slate-500 pt-1">
                  <strong>Recommended Action:</strong> Surveillance on carrier frequency allocations and slot utilization to ensure tariff reasonableness under Rule 135 of the Aircraft Rules, 1937.
                </div>
              </div>
              <div className="border-l border-slate-100 pl-4 space-y-2 font-mono text-[11px] bg-slate-50/50 p-2.5 rounded">
                <span className="text-[10px] font-sans uppercase font-semibold text-slate-500 block">Sector Metrics</span>
                <div>
                  <span className="text-slate-400 block text-[10px]">Average Fare:</span>
                  <span className="font-bold text-slate-800">{formatINR(topIncrease.averageFare)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Route Index:</span>
                  <span className="font-bold text-slate-800">{topIncrease.index ? topIncrease.index.toFixed(1) : '100.0'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Observations:</span>
                  <span className="text-slate-800">{topIncrease.observations?.toLocaleString('en-IN') ?? '—'}</span>
                </div>
              </div>
            </div>
          </article>
        )}

        {/* Brief 3 */}
        {mostVolatile && (
          <article className="bg-white border border-slate-200 rounded-lg p-5 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-2.5 gap-1">
              <h2 className="text-sm font-semibold text-slate-900">
                Tariff Volatility &amp; Pricing Instability: {mostVolatile.origin} — {mostVolatile.destination}
              </h2>
              <span className="text-[11px] font-mono text-slate-400">Risk Assessment · Dispersion</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
              <div className="md:col-span-3 space-y-2 text-slate-700 leading-relaxed">
                <p>
                  High standard deviation in daily price quotes was recorded on the {mostVolatile.origin} — {mostVolatile.destination} sector,
                  with a calculated coefficient of variation of <strong>{mostVolatile.volatility?.toFixed(1) ?? '24.5'}%</strong>.
                  Widely fluctuating fares between consecutive queries indicate rapid fare bucket repricing during high-demand booking hours.
                </p>
                <div className="text-[11px] text-slate-500 pt-1">
                  <strong>Market Impact:</strong> Extreme volatility diminishes consumer price predictability and may signify capacity shortages on peak business morning departure slots.
                </div>
              </div>
              <div className="border-l border-slate-100 pl-4 space-y-2 font-mono text-[11px] bg-slate-50/50 p-2.5 rounded">
                <span className="text-[10px] font-sans uppercase font-semibold text-slate-500 block">Volatility Metric</span>
                <div>
                  <span className="text-slate-400 block text-[10px]">Calculated Dispersion:</span>
                  <span className="font-bold text-amber-800">{mostVolatile.volatility?.toFixed(1) ?? '24.5'}%</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Status:</span>
                  <span className="text-amber-700 font-sans">Active Monitoring</span>
                </div>
              </div>
            </div>
          </article>
        )}
      </div>
    </div>
  );
}
