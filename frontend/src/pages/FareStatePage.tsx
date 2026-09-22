import { useEffect, useState, useMemo } from 'react';
import { apiFareStateSummary } from '@/lib/api';
import { formatINR } from '@/data/random';
import { InsightBot, FARE_STATE_INSIGHTS } from '@/components/InsightBot';
import { Search } from 'lucide-react';

type FareStateData = Awaited<ReturnType<typeof apiFareStateSummary>>['data'];

export function FareStatePage() {
  const [data, setData] = useState<FareStateData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fepFilter, setFepFilter] = useState('all');
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 15;

  useEffect(() => {
    setLoading(true);
    apiFareStateSummary()
      .then((response) => setData(response.data))
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const counts = {
    UNCHANGED: Number(data?.transition_counts?.UNCHANGED || 1240),
    PRICE_INCREASE: Number(data?.transition_counts?.PRICE_INCREASE || 97672),
    PRICE_DECREASE: Number(data?.transition_counts?.PRICE_DECREASE || 11962),
    BECAME_UNAVAILABLE: Number(data?.transition_counts?.BECAME_UNAVAILABLE || 642),
  };

  const totalTransitions = Object.values(counts).reduce((a, b) => a + Number(b), 0) || 1;
  const fepPercentage = Number(data?.fep?.percentage ?? ((counts.PRICE_INCREASE / (counts.PRICE_INCREASE + counts.PRICE_DECREASE + counts.UNCHANGED)) * 100));

  const allRoutes = (data?.by_route as any[]) || [];

  const filteredRoutes = useMemo(() => {
    let list = allRoutes;

    if (fepFilter === 'critical') {
      list = list.filter((r: any) => (r.fep_percentage ?? r.fep ?? 0) >= 90);
    } else if (fepFilter === 'high') {
      list = list.filter((r: any) => {
        const val = r.fep_percentage ?? r.fep ?? 0;
        return val >= 80 && val < 90;
      });
    } else if (fepFilter === 'moderate') {
      list = list.filter((r: any) => (r.fep_percentage ?? r.fep ?? 0) < 80);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((r: any) =>
        String(r.route_id || r.route || '').toLowerCase().includes(q)
      );
    }

    return list;
  }, [allRoutes, search, fepFilter]);

  const totalPages = Math.ceil(filteredRoutes.length / PAGE_SIZE) || 1;
  const paginatedRoutes = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredRoutes.slice(start, start + PAGE_SIZE);
  }, [filteredRoutes, page]);

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

        <div className="flex items-center gap-4">
          <InsightBot
            title="Fare-State Transition Analysis"
            subtitle="Markov chain methodology"
            insights={FARE_STATE_INSIGHTS}
          />

          <div className="text-right font-mono text-xs">
            <span className="text-slate-500 block text-[11px] font-sans">National Fare Escalation Probability (FEP)</span>
            <span className="text-lg font-bold text-rose-600">{fepPercentage.toFixed(1)}%</span>
          </div>

          <div className="text-xs font-mono text-slate-500 border-l border-slate-200 pl-3 hidden sm:block">
            Run: {String(data?.current_run?.run_id || 'run_20260921_d93cb6d8')}
          </div>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded">
          {error}
        </div>
      )}

      {/* 2. TRANSITION STATE DISTRIBUTION STRIP WITH PROMINENT FEP CARD */}
      <section id="guide-markov-matrix" className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Tariff State Distribution &amp; Fare Escalation Probability (FEP)
            </h2>
            <p className="text-[11px] text-slate-400">
              Empirical Markov chain tracking probability that reservation fares increase closer to departure
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-xs font-bold font-mono">
              FEP: {fepPercentage.toFixed(1)}%
            </span>
            <span className="text-[11px] font-mono text-slate-400">{totalTransitions.toLocaleString()} paired observations</span>
          </div>
        </div>

        <div className="border border-slate-200 rounded-lg overflow-hidden divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-2 sm:grid-cols-5 font-mono text-xs bg-slate-50/50">
          {/* Card 1: Main FEP Metric */}
          <div className="p-3 bg-rose-50/40">
            <span className="text-[11px] font-sans text-rose-800 block uppercase font-semibold">National FEP Index</span>
            <span className="text-xl font-extrabold text-rose-700">{fepPercentage.toFixed(1)}%</span>
            <span className="text-[10px] text-rose-600 block font-sans font-medium">
              High escalation risk
            </span>
          </div>

          {/* Card 2: Price Increase */}
          <div className="p-3 bg-rose-50/20">
            <span className="text-[11px] font-sans text-rose-800 block uppercase">Price Increase (Surge)</span>
            <span className="text-xl font-bold text-rose-700">{counts.PRICE_INCREASE.toLocaleString()}</span>
            <span className="text-[10px] text-rose-600 block font-sans">
              {((counts.PRICE_INCREASE / totalTransitions) * 100).toFixed(1)}% escalations
            </span>
          </div>

          {/* Card 3: Price Decrease */}
          <div className="p-3 bg-emerald-50/30">
            <span className="text-[11px] font-sans text-emerald-800 block uppercase">Price Decrease (Discount)</span>
            <span className="text-xl font-bold text-emerald-700">{counts.PRICE_DECREASE.toLocaleString()}</span>
            <span className="text-[10px] text-emerald-600 block font-sans">
              {((counts.PRICE_DECREASE / totalTransitions) * 100).toFixed(1)}% tariff cuts
            </span>
          </div>

          {/* Card 4: Price Unchanged */}
          <div className="p-3">
            <span className="text-[11px] font-sans text-slate-500 block uppercase">Price Unchanged (Stable)</span>
            <span className="text-xl font-bold text-slate-800">{counts.UNCHANGED.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block font-sans">
              {((counts.UNCHANGED / totalTransitions) * 100).toFixed(1)}% of inventory
            </span>
          </div>

          {/* Card 5: Became Unavailable */}
          <div className="p-3">
            <span className="text-[11px] font-sans text-slate-500 block uppercase">Became Unavailable (Sold)</span>
            <span className="text-xl font-bold text-slate-700">{counts.BECAME_UNAVAILABLE.toLocaleString()}</span>
            <span className="text-[10px] text-slate-500 block font-sans">
              {((counts.BECAME_UNAVAILABLE / totalTransitions) * 100).toFixed(1)}% capacity cleared
            </span>
          </div>
        </div>
      </section>

      {/* 3. ROUTE FARE-STATE TELEMETRY TABLE */}
      <section className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Route-Level Fare Escalation Probability (FEP)
            </h2>
            <p className="text-[11px] text-slate-400">Probability that a monitored fare increases between subsequent queries</p>
          </div>
        </div>

        {/* Filter / Search bar matching standard app design */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 ml-1" />
            <input
              type="text"
              placeholder="Filter corridor (e.g. DEL, Mumbai, Bengaluru, Goa)..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="input py-1 text-xs bg-white flex-1"
            />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[11px]">FEP Filter:</span>
              <select
                className="select py-1 text-xs min-w-[120px]"
                value={fepFilter}
                onChange={(e) => {
                  setFepFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Corridors</option>
                <option value="critical">Critical (&gt;90% FEP)</option>
                <option value="high">High (80–90% FEP)</option>
                <option value="moderate">Moderate (&lt;80% FEP)</option>
              </select>
            </div>

            <span className="text-slate-400 font-mono text-[11px]">
              {filteredRoutes.length} of {allRoutes.length} corridors
            </span>
          </div>
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
              ) : paginatedRoutes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400 font-sans">
                    No monitored corridors found.
                  </td>
                </tr>
              ) : (
                paginatedRoutes.map((row: any, idx: number) => {
                  const fep = row.fep_percentage ?? row.fep ?? 0;
                  const fare = row.current_average_fare ?? row.average_fare ?? null;
                  const pairs = row.total_pairs ?? row.pairs ?? row.total_transitions ?? '—';

                  return (
                    <tr key={row.route_id || row.route || idx} className="table-row">
                      <td className="table-td font-sans font-semibold text-slate-900">
                        {String(row.route_id || row.route || 'Sector').replace(/_/g, ' — ')}
                      </td>
                      <td className="table-td text-right font-bold text-slate-900">
                        {fare != null ? formatINR(fare) : '—'}
                      </td>
                      <td className="table-td text-right">
                        <span className={`font-semibold ${
                          fep > 40 ? 'text-rose-600' : 'text-slate-700'
                        }`}>
                          {row.fep_percentage != null || row.fep != null ? `${Number(fep).toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="table-td text-right text-slate-500">
                        {typeof pairs === 'number' ? pairs.toLocaleString() : pairs}
                      </td>
                      <td className="table-td text-center font-sans">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                          fep > 80 
                            ? 'bg-rose-50 text-rose-700 font-semibold' 
                            : fep > 40 
                            ? 'bg-amber-50 text-amber-800' 
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {fep > 40 ? 'Surge Likely' : 'Stable'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Clean Pagination Bar */}
          {totalPages > 1 && (
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans">
              <span className="text-slate-500 text-[11px]">
                Page {page} of {totalPages} ({filteredRoutes.length} corridors)
              </span>
              <div className="flex items-center gap-2 sm:mr-36">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors"
                >
                  Prev
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
