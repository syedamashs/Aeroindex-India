import { useState, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { FilterBar } from '@/components/FilterBar';
import { useApp } from '@/context/AppContext';
import { formatINR, formatNumber } from '@/data/random';
import {
  Clock, TrendingUp, ShieldCheck, CheckCircle2, ArrowRight,
  Info,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { fareTooltipFormatter } from '@/components/chartFormatters';
import { apiBookingWindow, type ApiFilters } from '@/lib/api';
import { StaggerContainer, MotionItem } from '@/components/animation/MotionCard';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';

export function BookingWindowPage() {
  const { filters, lastUpdate } = useApp();
  const [bwStats, setBwStats] = useState<any[]>([]);
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
        const res = await apiBookingWindow(apiFilters);
        setBwStats(res.data);
      } catch (error) {
        console.error('Failed to fetch booking window stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters, lastUpdate]);

  const t45 = bwStats.find((b) => b.window === 45);
  const t1 = bwStats.find((b) => b.window === 1);
  const priceDiff = t45 && t1 && t45.averageFare > 0
    ? ((t1.averageFare - t45.averageFare) / t45.averageFare) * 100
    : 0;

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
                FARE ELASTICITY & HORIZON CURVES
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Cohort Horizon: T+45 to T+1 Lead Days
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              Booking Window Intelligence
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Analyzes dynamic price escalation and yield management strategies as the flight departure horizon draws closer.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-navy-900/80 p-3 rounded-2xl border border-navy-700/80 backdrop-blur-sm">
            <Clock className="w-5 h-5 text-accent-400" />
            <div className="text-xs">
              <p className="font-bold text-white">Inflection Cliff: T-7 Days</p>
              <p className="text-[11px] text-navy-300">Exponential tariff escalation starts</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MotionItem>
          <DashboardKpiCard
            label="Last-Minute Surge Delta"
            value={`+${priceDiff.toFixed(0)}%`}
            sublabel="T+1 vs T+45 average ticket price"
            statusText="Urgency Premium"
            icon={<TrendingUp className="w-5 h-5" />}
            accent="danger"
            progressPercent={Math.min(100, priceDiff)}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Mean Last-Minute Fare (T+1)"
            value={t1 ? formatINR(t1.averageFare) : '—'}
            sublabel="1 day prior to departure"
            statusText="Peak Tariff"
            icon={<Clock className="w-5 h-5" />}
            accent="warning"
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Mean Advance Fare (T+45)"
            value={t45 ? formatINR(t45.averageFare) : '—'}
            sublabel="45 days advance booking"
            statusText="Baseline Tier"
            icon={<CheckCircle2 className="w-5 h-5" />}
            accent="accent"
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Recommended Window"
            value="T+21 to T+30"
            sublabel="Lowest volatility & optimal seat yield"
            statusText="Best Value"
            icon={<Info className="w-5 h-5" />}
            accent="navy"
            loading={loading}
          />
        </MotionItem>
      </StaggerContainer>

      <FilterBar />

      {/* Dynamic Analytical Insight Callout */}
      <div className="glass-card p-5 border-l-4 border-l-navy-600 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center flex-shrink-0 mt-0.5">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-bold text-navy-950 text-sm">Consumer & Regulatory Advisory</h4>
            <p className="text-slate-600 mt-0.5 leading-relaxed">
              Ticket quotes remain relatively stable between <strong>T+45 and T+15</strong>, but exhibit steep quadratic surge pricing inside the final <strong>7 days</strong>. Flights booked at T+1 command an average premium of <strong>{priceDiff.toFixed(0)}%</strong> over early bookings.
            </p>
          </div>
        </div>
      </div>

      {/* Main Curve Area Chart */}
      <div className="glass-card p-6">
        <div className="pb-5 mb-5 border-b border-slate-100">
          <h2 className="text-base font-display font-bold text-navy-950">
            Advance Purchase Price Curve (T+45 to T+1)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Observed fare trajectories across domestic flight booking windows
          </p>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-500">Synthesizing booking curves...</div>
        ) : (
          <div className="w-full h-80 lg:h-96">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bwStats} margin={{ top: 15, right: 30, left: 10, bottom: 10 }}>
                <defs>
                  <linearGradient id="bwGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fareTooltipFormatter} />
                {t45 && (
                  <ReferenceLine
                    y={t45.averageFare}
                    stroke="#10b981"
                    strokeDasharray="4 4"
                    label={{ value: `T+45 Base (${formatINR(t45.averageFare)})`, position: 'insideTopLeft', fontSize: 11, fill: '#10b981' }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="averageFare"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  fill="url(#bwGrad)"
                  dot={{ r: 5, fill: '#f43f5e', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 8, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Dual Split: Bar Chart & Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-display font-bold text-navy-950">
              Discrete Window Comparison
            </h3>
            <p className="text-xs text-slate-500">
              Bar breakdown of mean ticket prices per window cohort
            </p>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bwStats} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fareTooltipFormatter} />
                <Bar dataKey="averageFare" fill="#244680" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-display font-bold text-navy-950">
              Booking Window Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Observation volume and mean fares by lead day
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Window</th>
                  <th className="table-th">Description</th>
                  <th className="table-th text-right">Mean Fare</th>
                  <th className="table-th text-right">Observations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {bwStats.map((b) => (
                  <tr key={b.window} className="hover:bg-slate-50/80 transition-colors">
                    <td className="table-td font-mono font-bold text-navy-950">{b.label}</td>
                    <td className="table-td text-xs text-slate-600">
                      {b.window === 1 ? '1 day before flight' : `${b.window} days before flight`}
                    </td>
                    <td className="table-td text-right font-mono font-bold text-navy-950">
                      {formatINR(b.averageFare)}
                    </td>
                    <td className="table-td text-right font-mono text-slate-700">
                      {formatNumber(b.observations)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
