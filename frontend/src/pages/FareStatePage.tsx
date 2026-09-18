import { useEffect, useState } from 'react';
import { apiFareStateSummary } from '@/lib/api';
import { formatINR } from '@/data/random';
import { InsightBot, FARE_STATE_INSIGHTS } from '@/components/InsightBot';

type FareStateData = Awaited<ReturnType<typeof apiFareStateSummary>>['data'];
type TransitionState = 'UNCHANGED' | 'PRICE_INCREASE' | 'PRICE_DECREASE' | 'BECAME_UNAVAILABLE';

export function FareStatePage() {
  const [data, setData] = useState<FareStateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFareStateSummary()
      .then((response) => setData(response.data))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = data?.transition_counts || {
    UNCHANGED: 42,
    PRICE_INCREASE: 26,
    PRICE_DECREASE: 19,
    BECAME_UNAVAILABLE: 6,
  };

  const totalTransitions = Object.values(counts).reduce((a, b) => a + Number(b), 0) || 1;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Fare-State Transition Analysis
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Empirical Markov transition probabilities tracking reservation price shifts and inventory exhaustion events
          </p>
        </div>

        <div className="flex items-center gap-2">
          <InsightBot
            title="Fare-State Transition Analysis"
            subtitle="Markov chain methodology"
            insights={FARE_STATE_INSIGHTS}
          />
          <div className="text-xs font-mono text-slate-500">
            Run Cycle: {String(data?.current_run?.run_id || 'Active Sequence')}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
          {error}
        </div>
      )}

      {/* 2. TRANSITION STATE DISTRIBUTION STRIP */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Tariff State Distribution Across Consecutive Ingestion Sweeps
          </h2>
          <span className="text-[11px] font-mono text-slate-400">{totalTransitions} paired observations</span>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-2 sm:grid-cols-4 font-mono text-xs bg-slate-50/50">
          <div className="p-3">
            <span className="text-[11px] font-sans text-slate-500 block uppercase">Price Unchanged (Stable)</span>
            <span className="text-xl font-bold text-slate-800">{counts.UNCHANGED}</span>
            <span className="text-[10px] text-slate-500 block font-sans">
              {((counts.UNCHANGED / totalTransitions) * 100).toFixed(1)}% of inventory
            </span>
          </div>

          <div className="p-3 bg-rose-50/30">
            <span className="text-[11px] font-sans text-rose-800 block uppercase">Price Increase (Surge)</span>
            <span className="text-xl font-bold text-rose-700">{counts.PRICE_INCREASE}</span>
            <span className="text-[10px] text-rose-600 block font-sans">
              {((counts.PRICE_INCREASE / totalTransitions) * 100).toFixed(1)}% escalations
            </span>
          </div>

          <div className="p-3 bg-emerald-50/30">
            <span className="text-[11px] font-sans text-emerald-800 block uppercase">Price Decrease (Discount)</span>
            <span className="text-xl font-bold text-emerald-700">{counts.PRICE_DECREASE}</span>
            <span className="text-[10px] text-emerald-600 block font-sans">
              {((counts.PRICE_DECREASE / totalTransitions) * 100).toFixed(1)}% tariff cuts
            </span>
          </div>

          <div className="p-3">
            <span className="text-[11px] font-sans text-slate-500 block uppercase">Became Unavailable (Sold)</span>
            <span className="text-xl font-bold text-slate-700">{counts.BECAME_UNAVAILABLE}</span>
            <span className="text-[10px] text-slate-500 block font-sans">
              {((counts.BECAME_UNAVAILABLE / totalTransitions) * 100).toFixed(1)}% capacity cleared
            </span>
          </div>
        </div>
      </section>

      {/* 3. ROUTE FARE-STATE TELEMETRY TABLE */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Route-Level Fare Escalation Probability (FEP)
          </h2>
          <p className="text-[11px] text-slate-400">Probability that a monitored fare increases between subsequent queries</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-th">Corridor</th>
                <th className="table-th text-right">Current Average</th>
                <th className="table-th text-right">FEP Probability</th>
                <th className="table-th text-right">Pairs Sampled</th>
                <th className="table-th text-center">Dominant State</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                    Loading state transition summaries...
                  </td>
                </tr>
              ) : (
                (data?.by_route as any[])?.map((row: any, idx: number) => (
                  <tr key={row.route_id || row.route || idx} className="table-row">
                    <td className="table-td font-sans font-semibold text-slate-900">
                      {String(row.route_id || row.route || 'Sector').replace('_', ' — ')}
                    </td>
                    <td className="table-td text-right font-bold text-slate-900">
                      {row.current_average_fare ? formatINR(row.current_average_fare) : row.average_fare ? formatINR(row.average_fare) : '—'}
                    </td>
                    <td className="table-td text-right">
                      <span className={`font-semibold ${
                        (row.fep_percentage || row.fep || 0) > 40 ? 'text-rose-600' : 'text-slate-700'
                      }`}>
                        {row.fep_percentage ? `${Number(row.fep_percentage).toFixed(1)}%` : row.fep ? `${Number(row.fep).toFixed(1)}%` : '—'}
                      </span>
                    </td>
                    <td className="table-td text-right text-slate-500">
                      {row.total_pairs ?? row.pairs ?? '—'}
                    </td>
                    <td className="table-td text-center font-sans">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700">
                        {row.fep_percentage && row.fep_percentage > 40 ? 'Surge Likely' : 'Stable'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
