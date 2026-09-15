import { useEffect, useState } from 'react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import {
  Activity, TrendingUp, TrendingDown, Gauge, Lightbulb, BarChart3,
  ShieldCheck, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { apiAirlines, apiBookingWindow, apiIndex, apiInsights, apiRoutes, type ApiFilters, type ApiRouteStats } from '@/lib/api';

export function InsightsPage() {
  const { filters, lastUpdate } = useApp();

  const [indexPoints, setIndexPoints] = useState<Array<{ indexValue: number; percentageChange: number }>>([]);
  const [routeStats, setRouteStats] = useState<ApiRouteStats[]>([]);
  const [airlineStats, setAirlineStats] = useState<Array<{ name: string; averageFare: number }>>([]);
  const [insights, setInsights] = useState<Array<{ id: string; text: string; category: string }>>([]);
  const [bwStats, setBwStats] = useState<Array<{ window: number; averageFare: number }>>([]);

  useEffect(() => {
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
    Promise.all([apiIndex(apiFilters), apiRoutes(apiFilters), apiAirlines(apiFilters), apiInsights(apiFilters), apiBookingWindow(apiFilters)]).then(([index, routes, airlines, insightResponse, booking]) => {
      setIndexPoints(index.data);
      setRouteStats(routes.data);
      setAirlineStats(airlines.data);
      setInsights(insightResponse.data);
      setBwStats(booking.data);
    }).catch((error) => console.error('Failed to fetch insights:', error));
  }, [filters, lastUpdate]);

  const latest = indexPoints[indexPoints.length - 1];
  const topIncrease = [...routeStats].sort((a, b) => b.momChange - a.momChange)[0];
  const topDecrease = [...routeStats].sort((a, b) => a.momChange - b.momChange)[0];
  const mostVolatile = [...routeStats].sort((a, b) => b.volatility - a.volatility)[0];
  const cheapestRoute = [...routeStats].sort((a, b) => a.averageFare - b.averageFare)[0];
  const priciestRoute = [...routeStats].sort((a, b) => b.averageFare - a.averageFare)[0];
  const cheapestAirline = [...airlineStats].sort((a, b) => a.averageFare - b.averageFare)[0];

  const t45 = bwStats.find((b) => b.window === 45);
  const t1 = bwStats.find((b) => b.window === 1);

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
                POLICYMAKER & REGULATORY ADVISORY
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Automated Economic Intelligence Synthesis
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              National Policy & Tariff Insights
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Algorithmic synthesis of consumer airfare impact, corridor surge vulnerability, and tariff transparency directives for MoCA & DGCA leadership.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-navy-900/80 p-3.5 rounded-2xl border border-navy-700">
            <Lightbulb className="w-5 h-5 text-accent-400" />
            <div className="text-xs">
              <p className="font-bold text-white">Active Policy Signals</p>
              <p className="text-accent-400 font-mono font-bold text-base">{insights.length} Synthesized</p>
            </div>
          </div>
        </div>
      </div>

      {/* Executive KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard
          label="Current Composite Index"
          value={latest?.indexValue.toFixed(1) ?? '100.0'}
          change={latest?.percentageChange}
          sublabel="Base Jan 2026 = 100"
          statusText="Macro Benchmark"
          icon={<Activity className="w-5 h-5" />}
          accent="navy"
          progressPercent={Math.min(100, ((latest?.indexValue ?? 100) / 120) * 100)}
        />

        <DashboardKpiCard
          label="Top Inflationary Corridor"
          value={topIncrease ? `${topIncrease.origin} → ${topIncrease.destination}` : '—'}
          change={topIncrease?.momChange}
          sublabel="Highest MoM surge"
          statusText="Surge Alert"
          icon={<ArrowUpRight className="w-5 h-5" />}
          accent="danger"
        />

        <DashboardKpiCard
          label="Top Deflationary Corridor"
          value={topDecrease ? `${topDecrease.origin} → ${topDecrease.destination}` : '—'}
          change={topDecrease?.momChange}
          sublabel="Highest MoM price drop"
          statusText="Price Relief"
          icon={<ArrowDownRight className="w-5 h-5" />}
          accent="accent"
        />

        <DashboardKpiCard
          label="Highest Volatility Corridor"
          value={mostVolatile ? `${mostVolatile.origin} → ${mostVolatile.destination}` : '—'}
          sublabel={mostVolatile ? `Volatility σ ${formatINR(mostVolatile.volatility)}` : undefined}
          statusText="Erratic Quotes"
          icon={<Gauge className="w-5 h-5" />}
          accent="warning"
        />
      </div>

      {/* Secondary Metrics Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Lowest Mean Fare Route</p>
          <p className="text-base font-display font-extrabold text-navy-950 mt-1">
            {cheapestRoute ? `${cheapestRoute.origin} → ${cheapestRoute.destination}` : '—'}
          </p>
          <span className="text-xs font-mono font-bold text-emerald-600">
            {cheapestRoute ? formatINR(cheapestRoute.averageFare) : '—'}
          </span>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Highest Mean Fare Route</p>
          <p className="text-base font-display font-extrabold text-navy-950 mt-1">
            {priciestRoute ? `${priciestRoute.origin} → ${priciestRoute.destination}` : '—'}
          </p>
          <span className="text-xs font-mono font-bold text-rose-600">
            {priciestRoute ? formatINR(priciestRoute.averageFare) : '—'}
          </span>
        </div>
        <div className="glass-card p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Value Carrier Leader</p>
          <p className="text-base font-display font-extrabold text-navy-950 mt-1 capitalize">
            {cheapestAirline?.name ?? '—'}
          </p>
          <span className="text-xs font-mono font-bold text-navy-700">
            {cheapestAirline ? `Avg ${formatINR(cheapestAirline.averageFare)}` : '—'}
          </span>
        </div>
      </div>

      {/* Key Policy Observations */}
      <div className="glass-card p-6">
        <div className="pb-4 mb-4 border-b border-slate-100">
          <h3 className="text-base font-display font-bold text-navy-950">
            Automated Machine-Synthesized Policy Briefs
          </h3>
          <p className="text-xs text-slate-500">
            Derived automatically from cross-route regression and multi-source scraping observations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 hover:bg-white hover:shadow-md transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-navy-100 text-navy-700 flex items-center justify-center flex-shrink-0 group-hover:bg-navy-900 group-hover:text-white transition-colors">
                  <Lightbulb className="w-4 h-4" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-navy-50 text-navy-700 border border-navy-200/60">
                      {insight.category}
                    </span>
                  </div>
                  <p className="text-xs font-semibold text-navy-900 leading-relaxed pt-1">
                    {insight.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Booking Window Advisory Card */}
      {t45 && t1 && (
        <div className="glass-card p-6 border-l-4 border-l-navy-900">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-navy-50 flex items-center justify-center flex-shrink-0 text-navy-700">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-display font-bold text-base text-navy-950">
                Advance Purchase Consumer Tariff Impact
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                Tickets reserved <strong>1 day before departure</strong> command an average premium of{' '}
                <strong className="text-rose-600 font-bold font-mono">
                  +{(((t1.averageFare - t45.averageFare) / t45.averageFare) * 100).toFixed(0)}%
                </strong>{' '}
                over early reservations ({formatINR(t1.averageFare)} vs {formatINR(t45.averageFare)}). MoCA guidelines recommend travelers lock in bookings at least 15 days prior to departure to avoid peak yield-management surges.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
