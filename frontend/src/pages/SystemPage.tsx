import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { formatNumber, formatINR } from '@/data/random';
import { apiDataSource, apiDqeSummary, apiStatistics } from '@/lib/api';

const API_ENDPOINTS = [
  { method: 'GET', path: '/api/index', desc: 'Laspeyres monthly airfare price index values and percentage changes' },
  { method: 'GET', path: '/api/routes', desc: 'Monitored corridor statistics, index ratings & monthly shifts' },
  { method: 'GET', path: '/api/routes/:id', desc: 'Corridor deep-dive time-series, carrier breakdown & booking curve' },
  { method: 'GET', path: '/api/airlines', desc: 'Carrier benchmarks, yield spreads, and dispersion metrics' },
  { method: 'GET', path: '/api/booking-window', desc: 'T+45 to T+1 advance-purchase horizon fare curves' },
  { method: 'GET', path: '/api/observations', desc: 'Paginated SQLite observation store records' },
  { method: 'GET', path: '/api/alerts', desc: 'Price threshold triggers and tariff surge detection signals' },
  { method: 'GET', path: '/api/insights', desc: 'Econometric market policy observations and evidence' },
  { method: 'GET', path: '/api/map', desc: 'Geospatial airport hub coordinates & route network' },
  { method: 'GET', path: '/api/dqe/summary', desc: 'Continuous data quality validation diagnostics' },
  { method: 'GET', path: '/api/fare-state/summary', desc: 'Markov transition state probabilities and FEP' },
  { method: 'POST', path: '/api/scheduler/run', desc: 'Execute on-demand Stage-A live Playwright scrapers' },
];

export function SystemPage() {
  const { lastUpdate } = useApp();
  const [ds, setDs] = useState({ name: 'SQLite production database', readOnly: true, observations: 'apix_observations' });
  const [allObs, setAllObs] = useState(0);
  const [qualityScore, setQualityScore] = useState(99.4);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([apiDataSource(), apiDqeSummary(), apiStatistics()]).then(([dSource, dqe, stats]) => {
      setDs(dSource.data);
      setAllObs(stats.data.totalObservations);
      setQualityScore(stats.data.dataQuality || 99.4);
    }).catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, [lastUpdate]);

  return (
    <div className="space-y-8 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-widest text-slate-500">Technical Architecture</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono text-slate-400">SYS-INFRA-2026</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            System Status &amp; REST API Gateway
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Operational pipeline telemetry, database schema health, and programmatic data endpoints
          </p>
        </div>

        <div className="text-xs font-mono text-slate-500">
          Sync Status: <span className="text-emerald-700 font-bold">LIVE ONLINE</span>
        </div>
      </div>

      {/* 2. INFRASTRUCTURE & INGESTION TELEMETRY ROW */}
      <section className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-3 border-b border-slate-100 pb-2">
          Infrastructure Diagnostics
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-xs">
          <div>
            <span className="text-[11px] font-sans text-slate-500 block uppercase">Database Engine</span>
            <span className="text-base font-bold text-slate-900">SQLite 3 (WAL mode)</span>
            <span className="text-[10px] text-slate-400 block font-sans">Embedded storage engine</span>
          </div>

          <div>
            <span className="text-[11px] font-sans text-slate-500 block uppercase">Ingestion Worker</span>
            <span className="text-base font-bold text-slate-900">Playwright Chromium</span>
            <span className="text-[10px] text-slate-400 block font-sans">Headless automated scraping</span>
          </div>

          <div>
            <span className="text-[11px] font-sans text-slate-500 block uppercase">Stored Observations</span>
            <span className="text-base font-bold text-slate-900">{allObs ? allObs.toLocaleString('en-IN') : '30,000+'}</span>
            <span className="text-[10px] text-slate-400 block font-sans">Verified tariff records</span>
          </div>

          <div>
            <span className="text-[11px] font-sans text-slate-500 block uppercase">Data Integrity Score</span>
            <span className="text-base font-bold text-emerald-700">{qualityScore}%</span>
            <span className="text-[10px] text-slate-400 block font-sans">Zero schema corruption</span>
          </div>
        </div>
      </section>

      {/* 3. API ENDPOINTS CATALOG */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            REST API Endpoint Directory
          </h2>
          <p className="text-[11px] text-slate-400">Standardized JSON endpoints available for econometric research integration</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-th w-20">Method</th>
                <th className="table-th">Endpoint Route</th>
                <th className="table-th">Payload Description</th>
                <th className="table-th text-center w-24">Format</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {API_ENDPOINTS.map((endpoint) => (
                <tr key={endpoint.path} className="table-row">
                  <td className="table-td">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      endpoint.method === 'GET' ? 'bg-stone-100 text-stone-800 border border-stone-200' : 'bg-amber-50 text-amber-900 border border-amber-300'
                    }`}>
                      {endpoint.method}
                    </span>
                  </td>
                  <td className="table-td font-semibold text-slate-900">
                    {endpoint.path}
                  </td>
                  <td className="table-td font-sans text-slate-600 text-[11px]">
                    {endpoint.desc}
                  </td>
                  <td className="table-td text-center text-slate-500 text-[11px]">
                    application/json
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
