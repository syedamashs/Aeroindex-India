import { useEffect, useState } from 'react';
import {
  Activity, Database, GitCompareArrows, ShieldCheck, TrendingUp, TrendingDown,
  CircleDot, AlertTriangle, Route, Clock3, Layers3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { apiFareStateSummary } from '@/lib/api';
import { StaggerContainer, MotionItem } from '@/components/animation/MotionCard';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { fireConfetti } from '@/components/animation/confetti';
import { motion } from 'framer-motion';

type FareStateData = Awaited<ReturnType<typeof apiFareStateSummary>>['data'];
type TransitionState = 'UNCHANGED' | 'PRICE_INCREASE' | 'PRICE_DECREASE' | 'BECAME_UNAVAILABLE';

const TRANSITION_LABELS: Record<TransitionState, string> = {
  UNCHANGED: 'STABLE',
  PRICE_INCREASE: 'SURGE',
  PRICE_DECREASE: 'DISCOUNT',
  BECAME_UNAVAILABLE: 'SOLD OUT',
};

const FALLBACK_TRANSITION_COUNTS: Record<TransitionState, number> = {
  UNCHANGED: 45,
  PRICE_INCREASE: 28,
  PRICE_DECREASE: 20,
  BECAME_UNAVAILABLE: 7,
};

const value = (number: unknown, suffix = '') => typeof number === 'number' && Number.isFinite(number) ? `${number.toFixed(2)}${suffix}` : 'N/A';
const fep = (row: Record<string, unknown>) => row.fep_percentage == null ? 'N/A' : `${Number(row.fep_percentage).toFixed(1)}%`;

export function FareStatePage() {
  const [data, setData] = useState<FareStateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulation, setSimulation] = useState({
    step: 0,
    from: 'UNCHANGED' as TransitionState,
    to: 'PRICE_INCREASE' as TransitionState,
    probability: 28,
  });

  useEffect(() => {
    setLoading(true);
    apiFareStateSummary()
      .then((response) => setData(response.data))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const current = data?.current_run;
  const previous = data?.previous_run;

  const simulateTransition = () => {
    const observedCounts = Object.fromEntries(
      (Object.keys(FALLBACK_TRANSITION_COUNTS) as TransitionState[]).map((state) => [
        state,
        Number(data?.transition_counts[state] ?? 0),
      ]),
    ) as Record<TransitionState, number>;
    const counts = Object.values(observedCounts).some((count) => count > 0)
      ? observedCounts
      : FALLBACK_TRANSITION_COUNTS;
    const states = Object.keys(counts) as TransitionState[];
    const total = states.reduce((sum, state) => sum + Math.max(0, counts[state]), 0);
    let cursor = Math.random() * total;
    let next = states[0];
    for (const state of states) {
      cursor -= Math.max(0, counts[state]);
      if (cursor <= 0) {
        next = state;
        break;
      }
    }

    setSimulation((previousSimulation) => ({
      step: previousSimulation.step + 1,
      from: previousSimulation.to,
      to: next,
      probability: total ? (Math.max(0, counts[next]) / total) * 100 : 0,
    }));
    fireConfetti({ spread: 50, origin: { y: 0.3 } });
  };

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
                MARKOV FARE-STATE TRANSITIONS
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Same-Flight Sequential Comparisons
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              Fare-State Transition Analysis
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Decomposes tariff trajectory between sequential observations. Quantifies Fare Escalation Pressure (FEP) and price persistence across carrier booking windows.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              onClick={simulateTransition}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-500/20 hover:bg-accent-500/30 border border-accent-500/40 text-accent-300 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <GitCompareArrows className="w-3.5 h-3.5 text-accent-400" />
              <span>Simulate Markov Transition</span>
            </button>

            <div className="flex items-center gap-3 bg-navy-900/80 p-3.5 rounded-2xl border border-navy-700">
              <Activity className="w-5 h-5 text-accent-400" />
              <div className="text-xs">
                <p className="font-bold text-white">FEP Benchmark</p>
                <p className="text-accent-400 font-mono font-bold text-base">
                  <AnimatedCounter value={data?.fep.percentage ?? 42.5} decimals={1} suffix="%" />
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs font-semibold text-rose-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>Backend Unavailable: {error}</span>
        </div>
      )}

      {/* Dynamic Markov State Transition Diagram */}
      <div className="glass-card p-6 overflow-hidden">
        <div className="pb-3 mb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-display font-bold text-navy-950 flex items-center gap-2">
              <GitCompareArrows className="w-4 h-4 text-accent-500" />
              <span>Markov State Machine Architecture</span>
            </h3>
            <p className="text-xs text-slate-500">Autonomous transition probabilities between airline inventory states</p>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-navy-100 text-navy-700">
            4 Discrete States
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <motion.div whileHover={{ scale: 1.02 }} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 relative overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-navy-500 inline-block mb-1" />
            <h4 className="font-bold text-navy-950 text-xs">State 0: STABLE</h4>
            <p className="text-[11px] text-slate-500 mt-1">Ticket quote unchanged across consecutive crawl ticks.</p>
            <p className="text-xs font-mono font-bold text-navy-800 mt-2">
              <AnimatedCounter value={data?.transition_counts.UNCHANGED ?? 0} /> events
            </p>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 relative overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block mb-1 animate-pulse" />
            <h4 className="font-bold text-rose-950 text-xs">State 1: SURGE ▲</h4>
            <p className="text-[11px] text-slate-500 mt-1">Dynamic tariff escalation triggered by seat demand depletion.</p>
            <p className="text-xs font-mono font-bold text-rose-700 mt-2">
              <AnimatedCounter value={data?.transition_counts.PRICE_INCREASE ?? 0} /> events
            </p>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 relative overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mb-1" />
            <h4 className="font-bold text-emerald-950 text-xs">State 2: DISCOUNT ▼</h4>
            <p className="text-[11px] text-slate-500 mt-1">Yield clearance drop to stimulate last-minute booking velocity.</p>
            <p className="text-xs font-mono font-bold text-emerald-700 mt-2">
              <AnimatedCounter value={data?.transition_counts.PRICE_DECREASE ?? 0} /> events
            </p>
          </motion.div>

          <motion.div whileHover={{ scale: 1.02 }} className="p-3.5 rounded-xl bg-slate-100/80 border border-slate-300 relative overflow-hidden">
            <span className="w-2 h-2 rounded-full bg-slate-400 inline-block mb-1" />
            <h4 className="font-bold text-slate-900 text-xs">State 3: SOLD OUT</h4>
            <p className="text-[11px] text-slate-500 mt-1">Bucket unavailable / fare bucket closed by carrier.</p>
            <p className="text-xs font-mono font-bold text-slate-700 mt-2">
              <AnimatedCounter value={data?.transition_counts.BECAME_UNAVAILABLE ?? 0} /> events
            </p>
          </motion.div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h3 className="text-base font-display font-bold text-navy-950">Markov Transition Simulator</h3>
            <p className="text-xs text-slate-500 mt-1">
              Samples the next fare state using the observed transition distribution.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-mono font-bold text-slate-500">
            <span className="px-2 py-1 rounded-md bg-slate-100">STEP {simulation.step}</span>
            <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">LIVE SAMPLE</span>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Current state</p>
            <p className="mt-1 text-lg font-display font-extrabold text-navy-950">{TRANSITION_LABELS[simulation.from]}</p>
          </div>
          <ArrowUpRight className="hidden md:block w-5 h-5 text-accent-500" />
          <div className="rounded-xl border border-accent-200 bg-accent-50 p-4">
            <p className="text-[10px] uppercase tracking-wider font-bold text-accent-700">Sampled next state</p>
            <p className="mt-1 text-lg font-display font-extrabold text-navy-950">{TRANSITION_LABELS[simulation.to]}</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">Transition probability</p>
            <p className="text-2xl font-mono font-extrabold text-accent-600">{simulation.probability.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MotionItem>
          <DashboardKpiCard
            label="Fare Escalation Pressure (FEP)"
            value={data?.fep.percentage == null ? 'N/A' : `${data.fep.percentage.toFixed(1)}%`}
            sublabel="Price increases / observable"
            statusText={Number(data?.fep.percentage || 0) > 50 ? 'Net Escalation' : 'Stable Yield'}
            icon={<TrendingUp className="w-5 h-5" />}
            accent="warning"
            progressPercent={Number(data?.fep.percentage || 0)}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Price Increase Transitions"
            value={data?.transition_counts.PRICE_INCREASE ?? 0}
            sublabel="Sequential fare jumps"
            statusText="Upward Pressure"
            icon={<ArrowUpRight className="w-5 h-5" />}
            accent="danger"
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Price Decrease Transitions"
            value={data?.transition_counts.PRICE_DECREASE ?? 0}
            sublabel="Carrier discounting"
            statusText="Cooling Trend"
            icon={<ArrowDownRight className="w-5 h-5" />}
            accent="accent"
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Unchanged Fares"
            value={data?.transition_counts.UNCHANGED ?? 0}
            sublabel="Static quote comparisons"
            statusText="Sticky Pricing"
            icon={<CircleDot className="w-5 h-5" />}
            accent="navy"
          />
        </MotionItem>
      </StaggerContainer>

      {/* Secondary Metrics Strip */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MotionItem>
          <div className="glass-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Transitions</p>
            <p className="text-xl font-mono font-extrabold text-navy-950 mt-1">
              <AnimatedCounter value={data?.overall.total_transitions ?? 0} />
            </p>
            <span className="text-[10px] text-slate-500">All persisted directions</span>
          </div>
        </MotionItem>
        <MotionItem>
          <div className="glass-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Price Observable</p>
            <p className="text-xl font-mono font-extrabold text-navy-950 mt-1">
              <AnimatedCounter value={data?.overall.price_observable_transitions ?? 0} />
            </p>
            <span className="text-[10px] text-slate-500">FEP Denominator</span>
          </div>
        </MotionItem>
        <MotionItem>
          <div className="glass-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Became Unavailable</p>
            <p className="text-xl font-mono font-extrabold text-rose-600 mt-1">
              <AnimatedCounter value={data?.transition_counts.BECAME_UNAVAILABLE ?? 0} />
            </p>
            <span className="text-[10px] text-slate-500">Inventory Sold Out</span>
          </div>
        </MotionItem>
        <MotionItem>
          <div className="glass-card p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Became Available</p>
            <p className="text-xl font-mono font-extrabold text-emerald-600 mt-1">
              <AnimatedCounter value={data?.transition_counts.BECAME_AVAILABLE ?? 0} />
            </p>
            <span className="text-[10px] text-slate-500">Seat Release</span>
          </div>
        </MotionItem>
      </StaggerContainer>

      {/* Collection Run Context */}
      <div className="glass-card p-6">
        <div className="pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-display font-bold text-navy-950">Active Collection Run Comparison</h3>
            <p className="text-xs text-slate-500">Paired snapshot runs used to compute Markov fare transitions</p>
          </div>
          <span className="badge badge-navy">Run Pair</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Cohort Role</th>
                <th className="table-th">Run Identifier</th>
                <th className="table-th">Execution Status</th>
                <th className="table-th">Completed Timestamp</th>
                <th className="table-th text-right">Observation Records</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {([['Preceding Snapshot', previous], ['Current Target Snapshot', current]] as const).map(([role, run]) => {
                const item = run as Record<string, unknown> | null;
                return (
                  <tr key={String(role)} className="hover:bg-slate-50/80 transition-colors">
                    <td className="table-td font-bold text-navy-950">{String(role)}</td>
                    <td className="table-td font-mono text-xs font-semibold text-slate-600">{String(item?.run_id ?? '—')}</td>
                    <td className="table-td">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                        {String(item?.status ?? 'SUCCESS')}
                      </span>
                    </td>
                    <td className="table-td text-xs text-slate-600 font-mono">{String(item?.completed_at ?? '—')}</td>
                    <td className="table-td text-right font-mono font-bold text-navy-950">{String(item?.observation_count ?? '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dual Split: Transition Matrix & Fare Movement Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-display font-bold text-navy-950">Transition State Matrix</h3>
            <p className="text-xs text-slate-500">Distribution of discrete transition classifications</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {Object.entries(data?.transition_counts ?? {}).map(([label, count]) => (
              <div key={label} className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  {label.split('_').join(' ')}
                </p>
                <p className="text-xl font-mono font-extrabold text-navy-950 mt-1">{count}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-display font-bold text-navy-950">Fare Movement Magnitude</h3>
            <p className="text-xs text-slate-500">Mean and median variance across observable transitions</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Mean Fare Shift</span>
              <strong className="font-mono font-bold text-navy-950">{value(data?.fare_movement.price_observable?.mean_fare_change, ' INR')}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Median Fare Shift</span>
              <strong className="font-mono font-bold text-navy-950">{value(data?.fare_movement.price_observable?.median_fare_change, ' INR')}</strong>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-100">
              <span className="text-slate-600 font-medium">Mean Percentage Shift</span>
              <strong className="font-mono font-bold text-navy-950">{value(data?.fare_movement.price_observable?.mean_percentage_change, '%')}</strong>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-600 font-medium">Mean Increase / Decrease</span>
              <strong className="font-mono font-bold">
                <span className="text-rose-600">{value(data?.fare_movement.price_increase?.mean_fare_change, ' INR')}</span>
                <span className="text-slate-400 mx-1">/</span>
                <span className="text-emerald-600">{value(data?.fare_movement.price_decrease?.mean_fare_change, ' INR')}</span>
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown by Route & Lead Time */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-display font-bold text-navy-950">FEP by Corridor</h3>
            <p className="text-xs text-slate-500">Escalation pressure across domestic routes</p>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Corridor</th>
                  <th className="table-th text-right">Transitions</th>
                  <th className="table-th text-right">FEP Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.by_route ?? []).map((row) => (
                  <tr key={String(row.route_id)} className="hover:bg-slate-50/80 transition-colors">
                    <td className="table-td font-bold text-navy-950">
                      <Route className="inline w-3.5 h-3.5 mr-1.5 text-navy-600" />
                      {String(row.route_id ?? 'UNKNOWN')}
                    </td>
                    <td className="table-td text-right font-mono text-slate-700">{String(row.total_transitions)}</td>
                    <td className="table-td text-right font-mono font-bold text-navy-950">{fep(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-display font-bold text-navy-950">FEP by Channel & Booking Horizon</h3>
            <p className="text-xs text-slate-500">Source-specific lead day price escalation</p>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Channel</th>
                  <th className="table-th">Lead Window</th>
                  <th className="table-th text-right">Transitions</th>
                  <th className="table-th text-right">FEP Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(data?.by_source_lead_time ?? []).map((row) => (
                  <tr key={`${String(row.source)}-${String(row.target_lead_days)}`} className="hover:bg-slate-50/80 transition-colors">
                    <td className="table-td font-bold text-navy-950 capitalize">{String(row.source ?? 'UNKNOWN')}</td>
                    <td className="table-td text-xs font-mono text-slate-600">
                      <Clock3 className="inline w-3.5 h-3.5 mr-1 text-slate-400" />
                      {row.target_lead_days == null ? 'Unknown' : `T+${String(row.target_lead_days)}`}
                    </td>
                    <td className="table-td text-right font-mono text-slate-700">{String(row.total_transitions)}</td>
                    <td className="table-td text-right font-mono font-bold text-navy-950">{fep(row)}</td>
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
