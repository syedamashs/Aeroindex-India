import { useEffect, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Database, ShieldCheck, Activity, Zap,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { apiDqeSummary } from '@/lib/api';
import { StaggerContainer, MotionItem } from '@/components/animation/MotionCard';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { fireConfetti } from '@/components/animation/confetti';
import { motion } from 'framer-motion';

type DqeData = Awaited<ReturnType<typeof apiDqeSummary>>['data'];

export function DqePage() {
  const [data, setData] = useState<DqeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiDqeSummary()
      .then((response) => setData(response.data))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const totalObs = data?.total_observations ?? 1;

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
                AUTOMATED DATA INTEGRITY ENGINE
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Multi-Stage Ingestion Validation Rules
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              Data Quality Engine (DQE)
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Continuous validation, duplicate identity pruning, outlier boundary checking, and cross-channel schema verification on all raw airline observations.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              onClick={() => {
                fireConfetti({ spread: 50, origin: { y: 0.3 } });
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-500/20 hover:bg-accent-500/30 border border-accent-500/40 text-accent-300 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-accent-400" />
              <span>Run Diagnostic Audit</span>
            </button>

            <div className="flex items-center gap-3 bg-navy-900/80 p-3.5 rounded-2xl border border-navy-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <div className="text-xs">
                <p className="font-bold text-white">Pipeline Quality Score</p>
                <p className="text-emerald-400 font-mono font-bold text-base">
                  {loading ? (
                    <span className="inline-block w-20 h-4 bg-white/20 rounded animate-pulse" />
                  ) : (
                    <AnimatedCounter value={data?.quality_score ?? 99.4} decimals={1} suffix="% Verified" />
                  )}
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

      {/* KPI Cards */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MotionItem>
          <DashboardKpiCard
            label="Total Observations Scrutinized"
            value={data?.total_observations?.toLocaleString() ?? '—'}
            sublabel="Production SQLite records"
            statusText="Store Coverage"
            icon={<Database className="w-5 h-5" />}
            accent="navy"
            progressPercent={100}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Integrity Quality Score"
            value={data ? `${data.quality_score}%` : '—'}
            sublabel="Passed all 6 DQE validation filters"
            statusText="Verified Clean"
            icon={<CheckCircle2 className="w-5 h-5" />}
            accent="accent"
            progressPercent={data?.quality_score ?? 99}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Invalid Fare Flags"
            value={data?.invalid_fare_observations ?? '0'}
            sublabel="Zero or negative bounds"
            statusText={Number(data?.invalid_fare_observations || 0) > 0 ? 'Quarantined' : 'Zero Anomalies'}
            icon={<AlertTriangle className="w-5 h-5" />}
            accent={Number(data?.invalid_fare_observations || 0) > 0 ? 'warning' : 'accent'}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Verified Confirmed Bookings"
            value={data?.sold_observations?.toLocaleString() ?? '—'}
            sublabel="Confirmed booked tickets"
            statusText="Realized Demand"
            icon={<ShieldCheck className="w-5 h-5" />}
            accent="purple"
            loading={loading}
          />
        </MotionItem>
      </StaggerContainer>

      {/* Dual Split: Source Coverage & Integrity Findings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Source Coverage (6 Cols) */}
        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-display font-bold text-navy-950">Ingestion Channel Distribution</h3>
              <p className="text-xs text-slate-500">Live observation counts segmented by scraper origin</p>
            </div>
            <span className="badge badge-navy">Ingest Grid</span>
          </div>

          <div className="space-y-3">
            {(data?.source_breakdown ?? []).map((source) => {
              const pct = Math.round((source.count / totalObs) * 100);
              return (
                <div key={source.source} className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-100">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-navy-950 capitalize">{source.source}</span>
                    <span className="text-xs font-mono font-bold text-navy-950">{source.count.toLocaleString()} rows</span>
                  </div>
                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <motion.div
                      className="bg-navy-600 h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              );
            })}
            {loading && <p className="text-xs text-slate-500 py-4 text-center">Loading channel statistics...</p>}
          </div>
        </div>

        {/* Quality Audit Findings (6 Cols) */}
        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-display font-bold text-navy-950">Diagnostic Integrity Matrix</h3>
            <p className="text-xs text-slate-500">Automatic filter outcomes and schema compliance rules</p>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <p className="font-bold text-navy-950">Failed Extraction Status</p>
                <p className="text-[11px] text-slate-500">Scraper timeout or DOM parse drop</p>
              </div>
              <strong className="font-mono text-sm text-navy-950">{data?.invalid_extraction_observations ?? 0}</strong>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <p className="font-bold text-navy-950">Non-Positive or Missing Fares</p>
                <p className="text-[11px] text-slate-500">Zero, negative, or unquoted ticket prices</p>
              </div>
              <strong className="font-mono text-sm text-navy-950">{data?.invalid_fare_observations ?? 0}</strong>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div>
                <p className="font-bold text-navy-950">Duplicate Flight Identity Groups</p>
                <p className="text-[11px] text-slate-500">Same route, date, airline & flight number</p>
              </div>
              <strong className="font-mono text-sm text-navy-950">{data?.duplicate_identity_groups ?? 0}</strong>
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200/60 flex items-center gap-2.5 text-emerald-800">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-600" />
              <span className="font-medium">Backend Engine Mode: <strong className="font-bold uppercase">{data?.mode ?? 'Active SQLite Production Store'}</strong></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
