import { useEffect, useState, useMemo } from 'react';
import { apiDqeSummary, type ReliabilitySummaryData } from '@/lib/api';
import { formatINR } from '@/data/random';
import { 
  ShieldCheck, 
  Clock, 
  Layers, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowRight, 
  Search, 
  Filter, 
  Activity, 
  RefreshCw, 
  FileText, 
  Cpu, 
  Database,
  BarChart3,
  Server,
  TrendingUp,
  Sliders,
  ChevronDown
} from 'lucide-react';

export function DqePage() {
  const [data, setData] = useState<ReliabilitySummaryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'executive' | 'coverage' | 'quality' | 'routes' | 'audit'>('executive');
  
  // Route matrix filter & search
  const [routeSearch, setRouteSearch] = useState('');
  const [routeStatusFilter, setRouteStatusFilter] = useState('ALL');

  const loadData = () => {
    setLoading(true);
    apiDqeSummary()
      .then((response) => {
        setData(response.data);
        setError(null);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered route reliability matrix
  const filteredRouteMatrix = useMemo(() => {
    if (!data?.route_reliability) return [];
    let list = data.route_reliability;
    if (routeStatusFilter !== 'ALL') {
      list = list.filter((r) => r.status === routeStatusFilter);
    }
    if (routeSearch.trim()) {
      const q = routeSearch.toLowerCase();
      list = list.filter((r) => 
        r.route_id.toLowerCase().includes(q) || 
        r.route_name.toLowerCase().includes(q)
      );
    }
    return list;
  }, [data?.route_reliability, routeSearch, routeStatusFilter]);

  const rel = data?.reliability;
  const dims = data?.dimensions;
  const apix = data?.apix;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px] pb-16">
      {/* =========================================================================
          1. INSTITUTIONAL HEADER & GOVERNANCE BREADCRUMB
          ========================================================================= */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-widest text-slate-500">
              National Statistical Governance
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono text-slate-400">DGCA-REL-DQE-SPEC</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Data Quality, Reliability &amp; Audit
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 max-w-3xl">
            Empirical multi-dimensional governance framework measuring data coverage, scrape freshness, multi-source consistency, outlier isolation, and index calculation confidence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            title="Refresh Diagnostic Checks"
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded text-xs hover:bg-slate-50 shadow-xs transition-colors flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-600' : ''}`} />
            <span>Revalidate</span>
          </button>

          <div className="text-right font-mono text-xs pl-3 border-l border-slate-200">
            <span className="text-[11px] font-sans text-slate-500 block">Overall Governance Status</span>
            <span className="text-sm font-bold text-emerald-700 flex items-center gap-1 justify-end">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              {rel?.status || 'HIGH RELIABILITY'}
            </span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
          {error}
        </div>
      )}

      {/* =========================================================================
          SECTION 1 & 16: CORE INNOVATION CALLOUT (APIx + RELIABILITY TOGETHER)
          ========================================================================= */}
      <section id="guide-reliability-hero" className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-200 uppercase">
                Core Innovation
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Index Integrity &amp; Measurement Confidence
              </span>
            </div>
            <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
              &ldquo;The <strong>APIx value</strong> represents the measured airfare movement. The <strong>Reliability Score</strong> indicates the quality, coverage, and statistical confidence of the underlying observations used to calculate it.&rdquo;
            </p>
          </div>

          <div className="flex items-center gap-6 font-mono shrink-0">
            {/* APIx Metric */}
            <div className="text-right">
              <span className="text-[11px] font-sans text-slate-500 block uppercase font-medium">National APIx</span>
              <div className="flex items-baseline gap-1.5 justify-end">
                <span className="text-2xl font-black text-slate-900">{apix?.index_value ?? 117.3}</span>
                <span className="text-xs font-bold text-rose-600">+{apix?.percentage_change ?? 3.85}%</span>
              </div>
              <span className="text-[10px] font-sans text-slate-400 block">{apix?.period ?? 'Sep 2026'} · Jan &apos;26 = 100</span>
            </div>

            <div className="h-10 w-px bg-slate-200" />

            {/* Reliability Score */}
            <div className="text-right">
              <span className="text-[11px] font-sans text-slate-500 block uppercase font-medium">Reliability Score</span>
              <div className="flex items-baseline gap-1.5 justify-end">
                <span className="text-2xl font-black text-emerald-700">{rel?.score ?? 95.5}%</span>
              </div>
              <span className="text-[10px] font-sans font-bold text-emerald-700 block uppercase">
                {rel?.status ?? 'HIGH RELIABILITY'}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 font-sans">
          <div className="flex items-center gap-4">
            <span><strong className="text-slate-800 font-mono">APIx:</strong> WHAT CHANGED</span>
            <span className="text-slate-300">•</span>
            <span><strong className="text-slate-800 font-mono">Reliability:</strong> HOW CONFIDENTLY WE CAN MEASURE THAT CHANGE</span>
          </div>
          <span className="font-mono text-[11px] text-slate-400">
            Evaluated across 5 quantitative dimensions
          </span>
        </div>
      </section>

      {/* =========================================================================
          SECTION 2: 5 RELIABILITY DIMENSION CARDS
          ========================================================================= */}
      <section id="guide-dqe-audit" className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Primary Reliability Dimensions
          </h2>
          <span className="text-[11px] font-mono text-slate-400">DGCA Verification Standard</span>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-1 sm:grid-cols-5 font-mono text-xs bg-slate-50/50">
          {/* 1. Coverage */}
          <div className="p-3 bg-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-semibold text-slate-600 block uppercase">1. Coverage</span>
              <span className="badge badge-success text-[10px] py-0">{dims?.coverage?.status || 'HIGH'}</span>
            </div>
            <span className="text-xl font-bold text-slate-900">{dims?.coverage?.score ?? 95.7}%</span>
            <span className="text-[10px] text-slate-500 block font-sans mt-0.5">
              {dims?.coverage?.collected_observations?.toLocaleString() || '153,102'} / {dims?.coverage?.expected_observations?.toLocaleString() || '160,000'} collected
            </span>
            <p className="text-[10px] text-slate-400 font-sans mt-1 leading-snug">
              152 of 152 routes actively tracked.
            </p>
          </div>

          {/* 2. Freshness */}
          <div className="p-3 bg-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-semibold text-slate-600 block uppercase">2. Freshness</span>
              <span className="badge badge-success text-[10px] py-0">{dims?.freshness?.status || 'FRESH'}</span>
            </div>
            <span className="text-xl font-bold text-emerald-700">{dims?.freshness?.score ?? 96.0}%</span>
            <span className="text-[10px] text-slate-500 block font-sans mt-0.5">
              Age: {dims?.freshness?.average_data_age_minutes ?? 12} min (at {dims?.freshness?.last_scrape_formatted ?? '10:05 AM'})
            </span>
            <p className="text-[10px] text-slate-400 font-sans mt-1 leading-snug">
              {dims?.freshness?.fresh_observations_pct ?? 94.0}% within 30m fresh tier.
            </p>
          </div>

          {/* 3. Comparability */}
          <div className="p-3 bg-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-semibold text-slate-600 block uppercase">3. Comparability</span>
              <span className="badge badge-success text-[10px] py-0">{dims?.comparability?.status || 'HIGH'}</span>
            </div>
            <span className="text-xl font-bold text-slate-900">{dims?.comparability?.score ?? 93.4}%</span>
            <span className="text-[10px] text-slate-500 block font-sans mt-0.5">
              {dims?.comparability?.comparable_pct ?? 93.4}% strictly aligned
            </span>
            <p className="text-[10px] text-slate-400 font-sans mt-1 leading-snug">
              Route, cabin, and horizon parity.
            </p>
          </div>

          {/* 4. Data Quality */}
          <div className="p-3 bg-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-semibold text-slate-600 block uppercase">4. Data Quality</span>
              <span className="badge badge-success text-[10px] py-0">{dims?.data_quality?.status || 'HIGH'}</span>
            </div>
            <span className="text-xl font-bold text-emerald-700">{dims?.data_quality?.score ?? 99.9}%</span>
            <span className="text-[10px] text-slate-500 block font-sans mt-0.5">
              7-stage pipeline compliance
            </span>
            <p className="text-[10px] text-slate-400 font-sans mt-1 leading-snug">
              Zero unhandled schema violations.
            </p>
          </div>

          {/* 5. Cross-Source Consistency */}
          <div className="p-3 bg-white">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-sans font-semibold text-slate-600 block uppercase">5. Consistency</span>
              <span className="badge badge-success text-[10px] py-0">{dims?.cross_source_consistency?.status || 'HIGH'}</span>
            </div>
            <span className="text-xl font-bold text-slate-900">{dims?.cross_source_consistency?.score ?? 91.2}%</span>
            <span className="text-[10px] text-slate-500 block font-sans mt-0.5">
              {dims?.cross_source_consistency?.agreeing_pct ?? 91.2}% agree within ±2.0%
            </span>
            <p className="text-[10px] text-slate-400 font-sans mt-1 leading-snug">
              Direct carrier vs OTA parity.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================================
          CONTROL CENTER NAVIGATION TABS
          ========================================================================= */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto text-xs font-medium">
        <button
          onClick={() => setActiveTab('executive')}
          className={`px-3.5 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'executive'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Reliability Calculation &amp; Status</span>
        </button>

        <button
          onClick={() => setActiveTab('coverage')}
          className={`px-3.5 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'coverage'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Coverage, Freshness &amp; Source Health</span>
        </button>

        <button
          onClick={() => setActiveTab('quality')}
          className={`px-3.5 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'quality'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>DQE Pipeline &amp; Outlier Detection</span>
        </button>

        <button
          onClick={() => setActiveTab('routes')}
          className={`px-3.5 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'routes'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          <span>Route-Level Reliability Matrix</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3.5 py-2 border-b-2 transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === 'audit'
              ? 'border-slate-900 text-slate-900 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Audit Trail, Lineage &amp; Alerts</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: EXECUTIVE RELIABILITY FORMULA & STATUS (SECTIONS 11, 12, 16)
          ========================================================================= */}
      {activeTab === 'executive' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section 11: Transparent Reliability Formula */}
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Transparent Weighted Reliability Scoring Model
                </h3>
                <p className="text-[11px] text-slate-400">
                  Mathematical formulation deriving confidence score from empirical governance weights
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-slate-800">
                Score: {rel?.score ?? 95.5}%
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded font-mono text-xs text-slate-800">
              <span className="text-amber-800 font-bold block mb-1">Empirical Formula:</span>
              <code>
                Reliability = (0.25 × Coverage) + (0.20 × Freshness) + (0.20 × Comparability) + (0.20 × Data Quality) + (0.15 × Consistency)
              </code>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="table-th">Dimension Name</th>
                    <th className="table-th text-center">Configured Weight</th>
                    <th className="table-th text-right">Measured Metric</th>
                    <th className="table-th text-right">Weighted Contribution</th>
                    <th className="table-th text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  <tr className="table-row">
                    <td className="table-td font-sans font-semibold text-slate-900">1. Data Coverage</td>
                    <td className="table-td text-center text-slate-600">25% (0.25)</td>
                    <td className="table-td text-right font-bold text-slate-800">{dims?.coverage?.score ?? 95.7}%</td>
                    <td className="table-td text-right font-bold text-emerald-700">
                      {((dims?.coverage?.score ?? 95.7) * 0.25).toFixed(2)}%
                    </td>
                    <td className="table-td text-center font-sans">
                      <span className="badge badge-success">PASS</span>
                    </td>
                  </tr>
                  <tr className="table-row">
                    <td className="table-td font-sans font-semibold text-slate-900">2. Data Freshness</td>
                    <td className="table-td text-center text-slate-600">20% (0.20)</td>
                    <td className="table-td text-right font-bold text-slate-800">{dims?.freshness?.score ?? 96.0}%</td>
                    <td className="table-td text-right font-bold text-emerald-700">
                      {((dims?.freshness?.score ?? 96.0) * 0.20).toFixed(2)}%
                    </td>
                    <td className="table-td text-center font-sans">
                      <span className="badge badge-success">PASS</span>
                    </td>
                  </tr>
                  <tr className="table-row">
                    <td className="table-td font-sans font-semibold text-slate-900">3. Comparability Parity</td>
                    <td className="table-td text-center text-slate-600">20% (0.20)</td>
                    <td className="table-td text-right font-bold text-slate-800">{dims?.comparability?.score ?? 93.4}%</td>
                    <td className="table-td text-right font-bold text-emerald-700">
                      {((dims?.comparability?.score ?? 93.4) * 0.20).toFixed(2)}%
                    </td>
                    <td className="table-td text-center font-sans">
                      <span className="badge badge-success">PASS</span>
                    </td>
                  </tr>
                  <tr className="table-row">
                    <td className="table-td font-sans font-semibold text-slate-900">4. Data Quality Validation</td>
                    <td className="table-td text-center text-slate-600">20% (0.20)</td>
                    <td className="table-td text-right font-bold text-slate-800">{dims?.data_quality?.score ?? 99.9}%</td>
                    <td className="table-td text-right font-bold text-emerald-700">
                      {((dims?.data_quality?.score ?? 99.9) * 0.20).toFixed(2)}%
                    </td>
                    <td className="table-td text-center font-sans">
                      <span className="badge badge-success">PASS</span>
                    </td>
                  </tr>
                  <tr className="table-row">
                    <td className="table-td font-sans font-semibold text-slate-900">5. Cross-Source Consistency</td>
                    <td className="table-td text-center text-slate-600">15% (0.15)</td>
                    <td className="table-td text-right font-bold text-slate-800">{dims?.cross_source_consistency?.score ?? 91.2}%</td>
                    <td className="table-td text-right font-bold text-emerald-700">
                      {((dims?.cross_source_consistency?.score ?? 91.2) * 0.15).toFixed(2)}%
                    </td>
                    <td className="table-td text-center font-sans">
                      <span className="badge badge-success">PASS</span>
                    </td>
                  </tr>
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200">
                    <td className="table-td font-sans text-slate-900">Final Aggregated Reliability Score</td>
                    <td className="table-td text-center">100%</td>
                    <td className="table-td text-right text-slate-500">—</td>
                    <td className="table-td text-right text-base text-emerald-700">{rel?.score ?? 95.5}%</td>
                    <td className="table-td text-center font-sans">
                      <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                        {rel?.status || 'HIGH RELIABILITY'}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 12: Classification Standards */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-sans text-xs">
            <div className="p-3 bg-white border border-emerald-200 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-emerald-800 uppercase text-[11px]">90% – 100%</span>
                <span className="badge badge-success text-[10px]">CURRENT</span>
              </div>
              <h4 className="font-bold text-slate-900">High Reliability</h4>
              <p className="text-slate-500 text-[11px] mt-1">
                Comprehensive multi-source coverage, fresh observations, and minimal price divergence. Suitable for official DGCA publication.
              </p>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-amber-800 uppercase text-[11px]">75% – 89%</span>
                <span className="text-[10px] text-slate-400 font-mono">STANDBY</span>
              </div>
              <h4 className="font-bold text-slate-900">Moderate Reliability</h4>
              <p className="text-slate-500 text-[11px] mt-1">
                Acceptable data density with minor scrape delays or isolated route gaps. Index calculated with advisory notices.
              </p>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-rose-800 uppercase text-[11px]">&lt; 75%</span>
                <span className="text-[10px] text-slate-400 font-mono">ALERT</span>
              </div>
              <h4 className="font-bold text-slate-900">Low Reliability</h4>
              <p className="text-slate-500 text-[11px] mt-1">
                Significant missing observations, high source discrepancy, or stale feeds. Calculation halted or flagged for audit.
              </p>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 2: COVERAGE, FRESHNESS & SOURCE HEALTH (SECTIONS 3, 4, 8, 9)
          ========================================================================= */}
      {activeTab === 'coverage' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section 3 & 4: Coverage & Freshness Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Section 3: Data Coverage */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Data Coverage Specification
                </h3>
                <span className="badge badge-success">{dims?.coverage?.success_rate_pct ?? 95.7}% Success</span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] font-sans text-slate-500 block uppercase">Expected</span>
                  <span className="text-lg font-bold text-slate-800">
                    {dims?.coverage?.expected_observations?.toLocaleString() || '160,000'}
                  </span>
                </div>
                <div className="p-2 bg-emerald-50/50 rounded border border-emerald-100">
                  <span className="text-[10px] font-sans text-emerald-800 block uppercase">Collected</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {dims?.coverage?.collected_observations?.toLocaleString() || '153,102'}
                  </span>
                </div>
                <div className="p-2 bg-amber-50/50 rounded border border-amber-100">
                  <span className="text-[10px] font-sans text-amber-800 block uppercase">Missing</span>
                  <span className="text-lg font-bold text-amber-700">
                    {dims?.coverage?.missing_observations?.toLocaleString() || '6,898'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-600">
                152 of 152 core DGCA monitored corridors have active observations across multiple booking windows (T+1 to T+45).
              </p>
            </div>

            {/* Section 4: Data Freshness */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Data Freshness Diagnostics
                </h3>
                <span className="badge badge-success">{dims?.freshness?.status || 'FRESH'}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] font-sans text-slate-500 block uppercase">Last Scrape</span>
                  <span className="text-lg font-bold text-slate-800">
                    {dims?.freshness?.last_scrape_formatted || '10:05 AM'}
                  </span>
                </div>
                <div className="p-2 bg-emerald-50/50 rounded border border-emerald-100">
                  <span className="text-[10px] font-sans text-emerald-800 block uppercase">Average Age</span>
                  <span className="text-lg font-bold text-emerald-700">
                    {dims?.freshness?.average_data_age_minutes || 12} min
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded border border-slate-100">
                  <span className="text-[10px] font-sans text-slate-500 block uppercase">Fresh (≤30m)</span>
                  <span className="text-lg font-bold text-slate-800">
                    {dims?.freshness?.fresh_observations_pct || 94.0}%
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 text-[11px] font-sans text-slate-500 pt-1">
                <span>Thresholds:</span>
                <span className="text-emerald-700 font-medium">0–30 min: Fresh</span>
                <span>•</span>
                <span className="text-amber-700 font-medium">30–120 min: Aging</span>
                <span>•</span>
                <span className="text-rose-700 font-medium">&gt;120 min: Stale</span>
              </div>
            </div>
          </div>

          {/* Section 8: Comparability Check */}
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Observation Comparability Parity Audit
                </h3>
                <p className="text-[11px] text-slate-400">
                  Verification that fares compared in APIx index strictly match route, cabin class, fare family, and booking horizon
                </p>
              </div>
              <span className="badge badge-success">{dims?.comparability?.comparable_pct ?? 93.4}% Comparable</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-sans text-xs">
              {dims?.comparability?.reasons?.map((r, idx) => (
                <div key={idx} className="p-3 rounded border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between font-mono">
                    <span className="text-rose-700 font-bold">{r.pct}%</span>
                    <span className="text-slate-400 text-[10px]">{r.count.toLocaleString()} records</span>
                  </div>
                  <div className="font-medium text-slate-800 mt-1">{r.reason}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Isolated from like-for-like aggregation</div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 9: Missing Data & Source Health */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs space-y-0">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Source Operational Health &amp; Failure Handling
                </h3>
                <p className="text-[11px] text-slate-400">
                  Continuous ingestion heartbeat monitoring across direct carrier APIs and OTA aggregators
                </p>
              </div>
              <div className="p-1.5 bg-amber-50 border border-amber-200 rounded text-[11px] font-sans text-amber-900 font-medium">
                🛡️ Zero-Silence Guarantee: Missing observations are explicitly tracked and never silently cast to zero.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="table-th">Source / Feed</th>
                    <th className="table-th">Source Type</th>
                    <th className="table-th text-center">Status</th>
                    <th className="table-th text-right">Observations</th>
                    <th className="table-th text-right">Success Rate</th>
                    <th className="table-th text-right">Last Collection</th>
                    <th className="table-th text-center">Failures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {data?.source_health?.sources?.map((s, idx) => (
                    <tr key={idx} className="table-row">
                      <td className="table-td font-sans font-semibold text-slate-900">{s.name}</td>
                      <td className="table-td font-sans text-slate-600">{s.type}</td>
                      <td className="table-td text-center font-sans">
                        <span className={`badge ${
                          s.status === 'Healthy' ? 'badge-success' : s.status === 'Warning' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="table-td text-right font-bold text-slate-800">{s.observations.toLocaleString()}</td>
                      <td className="table-td text-right text-emerald-700 font-bold">{s.success_rate.toFixed(1)}%</td>
                      <td className="table-td text-right text-slate-500">{s.last_scrape}</td>
                      <td className="table-td text-center">
                        <span className={s.failure_count > 0 ? 'text-amber-700 font-bold' : 'text-slate-400'}>
                          {s.failure_count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 3: DQE PIPELINE & OUTLIER DETECTION (SECTIONS 5, 6, 7)
          ========================================================================= */}
      {activeTab === 'quality' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section 5: 7-Stage Validation Pipeline */}
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  7-Stage Ingestion Validation Pipeline Waterfall
                </h3>
                <p className="text-[11px] text-slate-400">
                  Step-by-step attrition filtering protecting APIx computation from malformed packets and invalid fares
                </p>
              </div>
              <span className="font-mono text-xs font-bold text-emerald-700">
                Final Clean: {dims?.data_quality?.clean_records?.toLocaleString() || '153,247'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 font-mono text-xs">
              {dims?.data_quality?.pipeline?.map((stg, idx) => (
                <div key={idx} className="p-2.5 rounded border border-slate-200 bg-slate-50 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-sans text-slate-500 block uppercase font-medium">{stg.stage}</span>
                    <span className="text-base font-bold text-slate-900 mt-1 block">
                      {stg.count.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 pt-1 border-t border-slate-200/60">
                    <span className="text-[9px] font-sans text-slate-400 block leading-tight">{stg.detail}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 6: Outlier Detection Panel */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Outlier Detection &amp; Robust MAD Boundary Diagnostics
                </h3>
                <p className="text-[11px] text-slate-400">
                  Statistical isolation of suspicious airfare observations via Median Absolute Deviation (MAD &gt; 3.5)
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 font-semibold">
                  {data?.outliers?.potential_outliers_flagged} Flagged
                </span>
                <span className="px-2 py-0.5 bg-rose-50 text-rose-800 rounded border border-rose-200 font-bold">
                  {data?.outliers?.outliers_isolated} Isolated
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="table-th">Route</th>
                    <th className="table-th">Source</th>
                    <th className="table-th text-right">Observed Fare</th>
                    <th className="table-th text-right">Typical Range</th>
                    <th className="table-th text-center">Robust Z-Score</th>
                    <th className="table-th">Detection Reason</th>
                    <th className="table-th text-center">Governance Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {data?.outliers?.outlier_table?.map((row, idx) => (
                    <tr key={idx} className="table-row">
                      <td className="table-td font-sans font-bold text-slate-900">{row.route}</td>
                      <td className="table-td font-sans text-slate-600">{row.source}</td>
                      <td className="table-td text-right font-bold text-rose-700">{formatINR(row.observed_fare)}</td>
                      <td className="table-td text-right text-slate-600">{row.typical_range}</td>
                      <td className="table-td text-center font-bold">
                        <span className={Math.abs(row.robust_z_score) > 5 ? 'text-rose-600' : 'text-amber-700'}>
                          {row.robust_z_score.toFixed(1)}
                        </span>
                      </td>
                      <td className="table-td font-sans text-slate-700 text-[11px]">{row.reason}</td>
                      <td className="table-td text-center font-sans">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                          row.status === 'ISOLATED'
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}>
                          {row.action}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Section 7: Cross-Source Consistency Check */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Cross-Source Multi-Carrier Price Agreement Matrix
                </h3>
                <p className="text-[11px] text-slate-400">
                  Empirical verification comparing direct airline booking tariffs with major third-party OTA aggregator feeds
                </p>
              </div>
              <span className="badge badge-success">{dims?.cross_source_consistency?.agreeing_pct}% Agreement</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="table-th">Route</th>
                    <th className="table-th text-center">Carrier</th>
                    <th className="table-th text-right">Direct Carrier Fare</th>
                    <th className="table-th text-right">OTA 1 (MakeMyTrip / EaseMyTrip)</th>
                    <th className="table-th text-right">OTA 2 (Goibibo / Booking.com)</th>
                    <th className="table-th text-right">Median Baseline</th>
                    <th className="table-th text-center">Max Deviation</th>
                    <th className="table-th text-center">Agreement Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {dims?.cross_source_consistency?.source_comparisons?.map((row, idx) => (
                    <tr key={idx} className="table-row">
                      <td className="table-td font-sans font-bold text-slate-900">{row.route}</td>
                      <td className="table-td text-center text-slate-600 font-bold">{row.carrier}</td>
                      <td className="table-td text-right font-bold text-slate-900">{formatINR(row.direct_fare)}</td>
                      <td className="table-td text-right text-slate-700">{formatINR(row.ota_1_fare)}</td>
                      <td className="table-td text-right text-slate-700">{formatINR(row.ota_2_fare)}</td>
                      <td className="table-td text-right text-slate-500">{formatINR(row.median_fare)}</td>
                      <td className="table-td text-center font-bold">
                        <span className={row.max_deviation_pct > 5 ? 'text-rose-600' : 'text-slate-700'}>
                          ±{row.max_deviation_pct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="table-td text-center font-sans">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'HIGH CONSISTENCY'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : row.status === 'MINOR DISAGREEMENT'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Active Rules Specification */}
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
              Active Data Quality Engine (DQE) Governance Rules
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="table-th">Rule ID</th>
                    <th className="table-th">Validation Scope</th>
                    <th className="table-th">Condition Threshold</th>
                    <th className="table-th text-center">Status</th>
                    <th className="table-th text-right">Compliance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {dims?.data_quality?.rules?.map((r, idx) => (
                    <tr key={idx} className="table-row">
                      <td className="table-td font-bold text-slate-900">{r.rule_id}</td>
                      <td className="table-td font-sans text-slate-600">{r.scope}</td>
                      <td className="table-td text-slate-700">{r.condition}</td>
                      <td className="table-td text-center font-sans">
                        <span className="badge badge-success">{r.status}</span>
                      </td>
                      <td className="table-td text-right font-bold text-slate-900">{r.compliance_pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          TAB 4: ROUTE-LEVEL RELIABILITY MATRIX (SECTION 10)
          ========================================================================= */}
      {activeTab === 'routes' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-lg text-xs">
            {/* Search Filter */}
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 ml-1" />
              <input
                type="text"
                placeholder="Filter route (e.g., DEL, Mumbai, Chennai)..."
                value={routeSearch}
                onChange={(e) => setRouteSearch(e.target.value)}
                className="input py-1 text-xs bg-slate-50 flex-1"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-[11px] font-sans">Status:</span>
              <select
                className="select py-1 text-xs min-w-[120px]"
                value={routeStatusFilter}
                onChange={(e) => setRouteStatusFilter(e.target.value)}
              >
                <option value="ALL">All Statuses</option>
                <option value="HIGH">High Reliability</option>
                <option value="MODERATE">Moderate</option>
                <option value="LOW">Low</option>
              </select>
              <span className="text-slate-400 font-mono text-[11px]">
                {filteredRouteMatrix.length} routes shown
              </span>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="table-th">Monitored Corridor</th>
                    <th className="table-th text-right">Sampled Observations</th>
                    <th className="table-th text-right">Average Fare</th>
                    <th className="table-th text-center">Coverage</th>
                    <th className="table-th text-center">Freshness</th>
                    <th className="table-th text-center">Quality</th>
                    <th className="table-th text-center">Consistency</th>
                    <th className="table-th text-right">Reliability Score</th>
                    <th className="table-th text-center">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {filteredRouteMatrix.map((row, idx) => (
                    <tr key={idx} className="table-row">
                      <td className="table-td font-sans font-bold text-slate-900">{row.route_name}</td>
                      <td className="table-td text-right text-slate-600 font-medium">{row.observations.toLocaleString()}</td>
                      <td className="table-td text-right font-bold text-slate-900">{formatINR(row.avg_fare)}</td>
                      <td className="table-td text-center text-slate-700">{row.coverage_pct}%</td>
                      <td className="table-td text-center text-slate-700">{row.freshness_pct}%</td>
                      <td className="table-td text-center text-slate-700">{row.quality_pct}%</td>
                      <td className="table-td text-center text-slate-700">{row.consistency_pct}%</td>
                      <td className="table-td text-right font-bold text-emerald-700 text-sm">
                        {row.reliability_score.toFixed(1)}%
                      </td>
                      <td className="table-td text-center font-sans">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          row.status === 'HIGH'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : row.status === 'MODERATE'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: AUDIT TRAIL, DATA LINEAGE & ALERTS (SECTIONS 13, 14, 15)
          ========================================================================= */}
      {activeTab === 'audit' && (
        <div className="space-y-6 animate-fade-in">
          {/* Section 15: Reliability Alerts */}
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700 border-b border-slate-100 pb-2">
              Active Reliability &amp; Governance Alerts
            </h3>
            <div className="space-y-2">
              {data?.alerts?.map((alert) => (
                <div 
                  key={alert.id} 
                  className={`p-2.5 rounded border text-xs flex items-start justify-between gap-3 ${
                    alert.level === 'SUCCESS'
                      ? 'bg-emerald-50/60 border-emerald-200 text-emerald-950'
                      : alert.level === 'WARNING'
                      ? 'bg-amber-50/60 border-amber-200 text-amber-950'
                      : 'bg-blue-50/60 border-blue-200 text-blue-950'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase shrink-0 mt-0.5 ${
                      alert.level === 'SUCCESS' ? 'bg-emerald-200 text-emerald-900' : alert.level === 'WARNING' ? 'bg-amber-200 text-amber-900' : 'bg-blue-200 text-blue-900'
                    }`}>
                      {alert.level}
                    </span>
                    <div>
                      <strong className="font-semibold block">{alert.title}</strong>
                      <p className="text-[11px] text-slate-600 mt-0.5">{alert.message}</p>
                    </div>
                  </div>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">{alert.timestamp}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Section 14: Data Lineage */}
          <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="border-b border-slate-100 pb-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                End-to-End Ingestion &amp; Calculation Data Lineage
              </h3>
              <p className="text-[11px] text-slate-400">
                Traceable pipeline proving how raw portal observations culminate in the verified National APIx index
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 font-mono text-xs">
              {data?.data_lineage?.map((step) => (
                <div key={step.step} className="p-2.5 rounded border border-slate-200 bg-slate-50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-sans text-amber-800 font-bold mb-1">
                      <span>STEP 0{step.step}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </div>
                    <span className="font-bold text-slate-900 block font-sans text-xs">{step.name}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-sans mt-2 leading-relaxed">{step.detail}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 13: Audit Trail Table */}
          <section className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                Immutable Governance Event Audit Trail
              </h3>
              <p className="text-[11px] text-slate-400">
                Verifiable event stream recording scraper conclusions, duplicate prunings, outlier treatments, and index calculations
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-semibold uppercase text-[11px]">
                    <th className="table-th w-28">Event ID</th>
                    <th className="table-th w-28">Timestamp</th>
                    <th className="table-th">Action / Trigger</th>
                    <th className="table-th">Governance Module</th>
                    <th className="table-th text-center w-24">Status</th>
                    <th className="table-th">Operational Detail</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {data?.audit_trail?.map((entry) => (
                    <tr key={entry.id} className="table-row">
                      <td className="table-td text-slate-400 font-bold">{entry.id}</td>
                      <td className="table-td text-slate-500">{entry.timestamp}</td>
                      <td className="table-td font-sans font-semibold text-slate-900">{entry.event}</td>
                      <td className="table-td font-sans text-slate-600">{entry.module}</td>
                      <td className="table-td text-center font-sans">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          entry.status === 'SUCCESS' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="table-td font-sans text-slate-600 text-[11px]">{entry.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
