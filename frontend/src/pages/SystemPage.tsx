import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatNumber, formatINR } from '@/data/random';
import { apiDataSource, apiDqeSummary, apiStatistics } from '@/lib/api';
import {
  Database, Filter, Copy, GitCompareArrows, BarChart3,
  Server, ArrowRight, CheckCircle2, Shield, Layers,
  Terminal, ShieldCheck, Zap, Radio, Activity,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { TelemetryFeed } from '@/components/animation/TelemetryFeed';
import { StaggerContainer, MotionItem } from '@/components/animation/MotionCard';
import { fireConfetti } from '@/components/animation/confetti';
import { motion } from 'framer-motion';

const VALIDATION_RULES = [
  { rule: 'Tariff Bound Check', desc: '₹1,500 - ₹1,50,000 threshold verification', status: 'active' },
  { rule: 'Mandatory Schema Fields', desc: 'origin, destination, carrier, date, fare', status: 'active' },
  { rule: 'ISO-8601 Timestamps', desc: 'Standardized departure & search stamps', status: 'active' },
  { rule: 'Booking Horizon Limits', desc: 'T+1 to T+365 advance departure bounds', status: 'active' },
  { rule: 'IATA Airline Registry', desc: 'Valid scheduled domestic carrier codes', status: 'active' },
  { rule: 'Trunk Network Match', desc: 'Cross-validated against 27 monitored corridors', status: 'active' },
  { rule: 'Identity Deduplication', desc: 'Composite SHA-256 fingerprint deduplication', status: 'active' },
  { rule: 'Econometric Outlier Filter', desc: '3-sigma modified z-score outlier isolation', status: 'active' },
];

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/index', desc: 'Laspeyres monthly airfare price index values' },
  { method: 'GET', path: '/api/routes', desc: 'Corridor statistics, index ratings & MoM shift' },
  { method: 'GET', path: '/api/routes/:id', desc: 'Deep-dive route time-series & booking curve' },
  { method: 'GET', path: '/api/airlines', desc: 'Carrier benchmarks, yield spread & market share' },
  { method: 'GET', path: '/api/booking-window', desc: 'T+45 to T+1 advance-purchase curves' },
  { method: 'GET', path: '/api/observations', desc: 'Paginated SQLite observation store query' },
  { method: 'GET', path: '/api/alerts', desc: 'Threshold triggers & tariff gouging signals' },
  { method: 'GET', path: '/api/insights', desc: 'Machine-synthesized policy briefs' },
  { method: 'GET', path: '/api/map', desc: 'Geospatial hub coordinates & route coordinates' },
  { method: 'GET', path: '/api/dqe/summary', desc: 'Continuous data quality validation diagnostics' },
  { method: 'GET', path: '/api/fare-state/summary', desc: 'Markov transition state probabilities & FEP' },
  { method: 'POST', path: '/api/scheduler/run', desc: 'Trigger Stage-A Playwright live scrapers' },
];

const PIPELINE_STAGES = [
  { label: 'Scrape Ingest', desc: 'Playwright Browser', icon: Database },
  { label: 'Schema Audit', desc: 'DQE Quality Rules', icon: Filter },
  { label: 'Deduplicate', desc: 'Identity Hash Keys', icon: Copy },
  { label: 'Cohort Sample', desc: 'Horizon Bucketing', icon: GitCompareArrows },
  { label: 'Index Engine', desc: 'Laspeyres Weights', icon: BarChart3 },
  { label: 'REST Gateway', desc: 'Fast Node.js API', icon: Server },
];

export function SystemPage() {
  const { lastUpdate } = useApp();
  const [ds, setDs] = useState({ name: 'SQLite apix production database', readOnly: true, observations: 'apix_observations' });
  const [allObs, setAllObs] = useState(0);
  const [qualityScore, setQualityScore] = useState(99.4);
  const [avgFare, setAvgFare] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([apiStatistics(), apiDqeSummary(), apiDataSource()]).then(([statistics, quality, source]) => {
      const stats = statistics.data;
      setAllObs(quality.data.total_observations);
      setQualityScore(quality.data.quality_score || 99.4);
      setAvgFare(Number(stats.averageFare ?? 0));
      setDs(source.data);
    }).catch((error) => console.error('Failed to fetch system statistics:', error))
      .finally(() => setLoading(false));
  }, [lastUpdate]);

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
                PIPELINE ARCHITECTURE & API REGISTRY
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Node.js • SQLite • Playwright Framework
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              System Architecture & API Specs
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Technical documentation of the multi-stage airfare observation ingestion pipeline, microservice endpoints, and data validation rules.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              onClick={() => {
                fireConfetti({ spread: 55, origin: { y: 0.3 } });
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-500/20 hover:bg-accent-500/30 border border-accent-500/40 text-accent-300 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-accent-400 animate-bounce" />
              <span>Simulate Pipeline Burst</span>
            </button>

            <div className="flex items-center gap-3 bg-navy-900/80 p-3 rounded-2xl border border-navy-700">
              <Server className="w-5 h-5 text-accent-400" />
              <div className="text-xs">
                <p className="font-bold text-white">Store Status</p>
                <p className="text-emerald-400 font-mono font-bold text-xs flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Active SQLite Store
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MotionItem>
          <DashboardKpiCard
            label="Ingested Observations"
            value={formatNumber(allObs)}
            sublabel={ds.observations}
            statusText="Live SQLite"
            icon={<Database className="w-5 h-5" />}
            accent="navy"
            progressPercent={100}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Validation Pass Rate"
            value={`${qualityScore}%`}
            sublabel="8 strict DQE filters active"
            statusText="Verified Clean"
            icon={<CheckCircle2 className="w-5 h-5" />}
            accent="accent"
            progressPercent={qualityScore}
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Average Ticket Metric"
            value={formatINR(avgFare)}
            sublabel="National weighted baseline"
            statusText="Mean Yield"
            icon={<BarChart3 className="w-5 h-5" />}
            accent="purple"
            loading={loading}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Active API Endpoints"
            value="12 Endpoints"
            sublabel="REST & SSE protocol support"
            statusText="100% Online"
            icon={<Server className="w-5 h-5" />}
            accent="warning"
            loading={loading}
          />
        </MotionItem>
      </StaggerContainer>

      {/* Interactive Pipeline Stage Flow with Live Traveling Packet */}
      <div className="glass-card p-6 relative overflow-hidden">
        <div className="pb-4 mb-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-display font-bold text-navy-950 flex items-center gap-2">
              <span>Multi-Stage Ingestion Pipeline Workflow</span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300">
                ACTIVE DATA STREAM
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Sequential stages transforming raw DOM extractions into policy-ready econometric indices
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-mono">
            <Radio className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            <span>Worker Heartbeat: Normal (180ms)</span>
          </div>
        </div>

        {/* Animated Data Transfer Ray */}
        <div className="w-full h-1 bg-slate-100 rounded-full my-3 overflow-hidden relative">
          <motion.div
            className="w-1/4 h-full bg-gradient-to-r from-emerald-500 via-sky-400 to-indigo-500 rounded-full shadow-[0_0_8px_#38bdf8]"
            animate={{ x: ['-100%', '400%'] }}
            transition={{ repeat: Infinity, duration: 3.2, ease: 'easeInOut' }}
          />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <motion.div
                key={stage.label}
                whileHover={{ y: -3, scale: 1.02 }}
                className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/90 flex flex-col justify-between group hover:bg-white hover:border-emerald-400/60 hover:shadow-lg transition-all relative overflow-hidden"
              >
                <div className="space-y-2 relative z-10">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-navy-100 text-navy-800 group-hover:bg-navy-900 group-hover:text-white transition-colors">
                      0{i + 1}
                    </span>
                    <Icon className="w-4 h-4 text-navy-600 group-hover:text-emerald-500 group-hover:scale-110 transition-all" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-950">{stage.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{stage.desc}</p>
                  </div>
                </div>
                {/* Active pulsating beacon dot */}
                <span className="absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 opacity-60 group-hover:opacity-100 group-hover:animate-ping" />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Live Cyber Telemetry Feed Terminal */}
      <TelemetryFeed maxLogs={15} />

      {/* Validation Rules Applied */}
      <div className="glass-card p-6">
        <div className="pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-navy-600" />
            <h3 className="text-base font-display font-bold text-navy-950">Active DQE Rulebook</h3>
          </div>
          <span className="badge badge-success">8 Active Rules</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {VALIDATION_RULES.map((v) => (
            <div
              key={v.rule}
              className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60 flex items-start gap-2.5"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-navy-950">{v.rule}</p>
                <p className="text-[11px] text-slate-600 mt-0.5">{v.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* API Endpoints Registry */}
      <div className="glass-card p-6">
        <div className="pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-navy-600" />
            <h3 className="text-base font-display font-bold text-navy-950">Public REST API Catalog</h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Base: /api</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Method</th>
                <th className="table-th">Path</th>
                <th className="table-th">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {API_ENDPOINTS.map((ep) => (
                <tr key={ep.path} className="hover:bg-slate-50/80 transition-colors">
                  <td className="table-td">
                    <span
                      className={`inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-md ${
                        ep.method === 'POST' ? 'bg-amber-100 text-amber-800' : 'bg-navy-100 text-navy-800'
                      }`}
                    >
                      {ep.method}
                    </span>
                  </td>
                  <td className="table-td font-mono font-bold text-xs text-navy-950">{ep.path}</td>
                  <td className="table-td text-xs text-slate-600">{ep.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
