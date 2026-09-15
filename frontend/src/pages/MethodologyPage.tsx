import { useEffect, useState, type ReactNode } from 'react';
import { ArrowRight, Database, ShieldCheck, BookOpen, Code2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiDqeSummary, apiRoutes, apiStatistics } from '@/lib/api';

function MethodSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass-card p-6 space-y-4">
      <h3 className="text-base font-display font-bold text-navy-950 border-b border-slate-100 pb-3">
        {title}
      </h3>
      <div className="space-y-3 text-xs leading-relaxed text-slate-600">
        {children}
      </div>
    </div>
  );
}

function Formula({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-navy-800 bg-navy-950 p-4 shadow-inner">
      <p className="whitespace-nowrap font-mono text-xs font-bold text-accent-400">{children}</p>
    </div>
  );
}

export function MethodologyPage() {
  const navigate = useNavigate();
  const [statistics, setStatistics] = useState({ routesMonitored: 0, totalObservations: 0 });
  const [quality, setQuality] = useState({ invalid: 0, duplicates: 0, valid: 0 });
  const [routeWeight, setRouteWeight] = useState(0);

  useEffect(() => {
    Promise.all([apiStatistics(), apiDqeSummary(), apiRoutes()])
      .then(([stats, dqe, routes]) => {
        setStatistics({ routesMonitored: stats.data.routesMonitored, totalObservations: stats.data.totalObservations });
        const invalid = dqe.data.invalid_extraction_observations + dqe.data.invalid_fare_observations;
        setQuality({ invalid, duplicates: dqe.data.duplicate_identity_groups, valid: Math.max(0, dqe.data.total_observations - invalid) });
        setRouteWeight(routes.data.reduce((sum, route) => sum + route.weight, 0));
      })
      .catch((error) => console.error('Failed to fetch methodology statistics:', error));
  }, []);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-6 lg:p-8 shadow-xl border border-navy-700/60">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                ECONOMETRIC METHODOLOGY SPECIFICATION
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Base Standard: January 2026 = 100.0
              </span>
            </div>

            <h1 className="font-display font-extrabold text-3xl lg:text-4xl tracking-tight text-white">
              AeroIndex Mathematical Methodology
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Formal mathematical specification detailing how raw multi-source flight observations are cleaned, matched into identity cohorts, and aggregated into national price indices.
            </p>
          </div>

          <button
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white text-navy-900 hover:bg-slate-100 text-xs font-bold transition-all shadow-md active:scale-95 whitespace-nowrap self-start lg:self-center"
          >
            <span>Return to Dashboard</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Scope Metric Grid */}
      <MethodSection title="1. Observation Unit & Population Bounds">
        <p>A price observation is a validated canonical record in <code className="font-mono font-semibold text-navy-900 bg-slate-100 px-1.5 py-0.5 rounded">apix_observations</code> with verified total fare, route, departure timestamp, and origin provenance.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400">Routes Monitored</p>
            <p className="text-base font-mono font-bold text-navy-950 mt-0.5">{statistics.routesMonitored.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400">Total Observations</p>
            <p className="text-base font-mono font-bold text-navy-950 mt-0.5">{statistics.totalObservations.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400">Valid Fare Rows</p>
            <p className="text-base font-mono font-bold text-emerald-600 mt-0.5">{quality.valid.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400">Invalid Records</p>
            <p className="text-base font-mono font-bold text-rose-600 mt-0.5">{quality.invalid.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400">Duplicate Groups</p>
            <p className="text-base font-mono font-bold text-amber-600 mt-0.5">{quality.duplicates.toLocaleString('en-IN')}</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-[10px] uppercase font-bold text-slate-400">Route Weight Sum</p>
            <p className="text-base font-mono font-bold text-navy-950 mt-0.5">{routeWeight.toLocaleString('en-IN')}</p>
          </div>
        </div>
      </MethodSection>

      <MethodSection title="2. Elementary Price Relative Equation">
        <p>For one comparable flight identity <em>i</em> between base period <em>0</em> and observation period <em>t</em>, the elementary price relative measures proportional movement:</p>
        <Formula>r(i, t) = p(i, t) / p(i, 0)</Formula>
        <p>Only positive, finite total fares are eligible. If either base or period price is unavailable, the relative is quarantined in DQE integrity logs.</p>
      </MethodSection>

      <MethodSection title="3. Laspeyres & Jevons Estimator Formulations">
        <p>AeroIndex implements weighted Laspeyres aggregation across representative high-density passenger trunk corridors:</p>
        <Formula>AeroIndex(t) = [ ∑ ( w_r × I(r, t) ) / ∑ w_r ] × 100</Formula>
        <p>Where <em>w_r</em> represents the official DGCA passenger volume weight for route <em>r</em>, and <em>I(r, t)</em> is the route-level elementary relative.</p>
      </MethodSection>

      <MethodSection title="4. Advance Departure Lead-Time Horizon (T+45 to T+1)">
        <p>Booking windows are modeled as separate analytical cohorts to decompose dynamic seat yield curves:</p>
        <Formula>Late Booking Urgency Premium = [ ( AvgFare(T+1) - AvgFare(T+45) ) / AvgFare(T+45) ] × 100</Formula>
        <p>Fares exhibit steep quadratic inflection starting at <strong>T-7 days</strong>, culminating in last-minute urgency tariffs.</p>
      </MethodSection>

      <MethodSection title="5. Surveillance Alert Rules & Gouging Thresholds">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="font-bold text-rose-700">Price Spike Flag</p>
            <p className="text-slate-600 mt-0.5">Route MoM escalation ≥ 4% (Medium) or ≥ 8% (High Alert)</p>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
            <p className="font-bold text-amber-700">Volatility Threshold</p>
            <p className="text-slate-600 mt-0.5">Route fare standard deviation σ ≥ 14% of route mean</p>
          </div>
        </div>
      </MethodSection>

      {/* Backend Architecture Note */}
      <div className="p-4 rounded-xl bg-navy-900 text-white border border-navy-700 flex items-start gap-3 text-xs">
        <Code2 className="w-5 h-5 text-accent-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold">Source Implementation Reference</p>
          <p className="text-slate-300 mt-0.5 leading-relaxed">
            Index computation algorithms live in <code>backend/index_engine/</code>; Markov state transitions in <code>backend/fare_state/</code>; live REST gateway in <code>backend/server.js</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
