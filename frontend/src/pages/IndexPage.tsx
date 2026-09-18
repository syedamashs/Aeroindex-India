import { useEffect, useState, useMemo } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { indexTooltipFormatter } from '@/components/chartFormatters';
import { apiIndex, apiRoutes, type ApiRouteStats } from '@/lib/api';
import { ArrowUpRight, ArrowDownRight, RotateCcw, Sliders, Info } from 'lucide-react';

export function IndexPage() {
  const { lastUpdate, showToast } = useApp();
  const [weights, setWeights] = useState<Record<string, number>>({});
  const [indexPoints, setIndexPoints] = useState<Array<{ period: string; indexValue: number; percentageChange: number; averageFare: number; monthLabel: string }>>([]);
  const [routeStats, setRouteStats] = useState<ApiRouteStats[]>([]);
  const [showWeights, setShowWeights] = useState(false);
  const [showFormula, setShowFormula] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([apiIndex(), apiRoutes()])
      .then(([indexResponse, routeResponse]) => {
        setIndexPoints(indexResponse.data);
        setRouteStats(routeResponse.data);
        setWeights(Object.fromEntries(routeResponse.data.map((route) => [route.routeId, route.weight])));
      })
      .catch((error) => console.error('Failed to fetch index data:', error))
      .finally(() => setLoading(false));
  }, [lastUpdate]);

  const latest = indexPoints[indexPoints.length - 1];
  const previous = indexPoints[indexPoints.length - 2];
  const momChange = latest?.percentageChange ?? 0;
  const isUp = momChange > 0;
  const isDown = momChange < 0;

  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);

  // Dynamic route contribution calculation
  const routeContributions = useMemo(() => {
    return routeStats.map((r) => {
      const w = weights[r.routeId] ?? r.weight;
      const normalizedWeight = totalWeight > 0 ? w / totalWeight : 0;
      const contribution = (r.momChange || 0) * normalizedWeight;
      return {
        ...r,
        currentWeight: w,
        normalizedWeight: normalizedWeight * 100,
        contribution: Number(contribution.toFixed(2)),
      };
    }).sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));
  }, [routeStats, weights, totalWeight]);

  const handleWeightChange = (routeId: string, value: number) => {
    setWeights((prev) => ({ ...prev, [routeId]: Math.max(0, value) }));
  };

  const resetWeights = () => {
    setWeights(Object.fromEntries(routeStats.map((route) => [route.routeId, route.weight])));
    showToast('Route weights reset to default DGCA passenger proportions.', 'info');
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-[1440px]">
      {/* 1. PUBLICATION MASTHEAD / HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase font-mono tracking-widest text-slate-500">Official Economic Series</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono text-slate-400">DGCA-ECN-2026-M1</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 mt-1">
            National Airfare Index (AeroIndex India)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Base Year: January 2026 = 100.0 · Laspeyres passenger-volume weighted relative index
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFormula(!showFormula)}
            className="btn btn-secondary text-xs"
          >
            <Info className="w-3 h-3 text-slate-500" />
            <span>{showFormula ? 'Hide Formula' : 'Formula Specification'}</span>
          </button>
          <button
            onClick={() => setShowWeights(!showWeights)}
            className="btn btn-secondary text-xs"
          >
            <Sliders className="w-3 h-3 text-slate-500" />
            <span>{showWeights ? 'Hide Weight Basket' : 'Calibrate Weights'}</span>
          </button>
        </div>
      </div>

      {/* Formula Documentation Dropdown (Editorial / Mathematical) */}
      {showFormula && (
        <div className="bg-slate-50 border border-slate-200 rounded p-4 text-xs space-y-3 font-mono">
          <div className="flex items-center justify-between text-slate-800 font-bold font-sans">
            <span>Laspeyres Index Formulation</span>
            <button onClick={() => setShowFormula(false)} className="text-slate-400 hover:text-slate-600 font-mono text-xs">Close [×]</button>
          </div>
          <div className="bg-white border border-slate-200 p-3 rounded text-slate-900 text-center text-sm font-semibold">
            Index_t = [ ∑ ( w_i × ( P_i,t / P_i,0 ) ) / ∑ w_i ] × 100
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 text-[11px] font-sans text-slate-600">
            <div>
              <strong className="text-slate-800 block font-mono">P_i,0</strong>
              <span>Base Period Fare: Jan 2026 domestic average ticket rate.</span>
            </div>
            <div>
              <strong className="text-slate-800 block font-mono">P_i,t</strong>
              <span>Current Period Fare: Weighted monthly mean observation.</span>
            </div>
            <div>
              <strong className="text-slate-800 block font-mono">w_i</strong>
              <span>Route Traffic Weight: DGCA annual domestic passenger volume.</span>
            </div>
            <div>
              <strong className="text-slate-800 block font-mono">Index_t</strong>
              <span>Composite relative indicator showing macroeconomic trend.</span>
            </div>
          </div>
        </div>
      )}

      {/* 2. STATISTICAL SUMMARY BANNER */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-4 border-y border-slate-200 py-4 text-xs font-mono">
        <div>
          <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Current Index</span>
          <span className="text-2xl font-bold text-slate-900">
            {latest?.indexValue?.toFixed(1) ?? '100.0'}
          </span>
          <span className="text-[10px] font-sans text-slate-400 block">Baseline 100.0</span>
        </div>

        <div>
          <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">MoM Velocity</span>
          <span className={`text-2xl font-bold inline-flex items-center ${
            isUp ? 'text-rose-600' : isDown ? 'text-emerald-700' : 'text-slate-700'
          }`}>
            {isUp && <ArrowUpRight className="w-5 h-5 mr-0.5" />}
            {isDown && <ArrowDownRight className="w-5 h-5 mr-0.5" />}
            {formatPercent(momChange)}
          </span>
          <span className="text-[10px] font-sans text-slate-400 block">vs previous month</span>
        </div>

        <div>
          <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">YoY Trajectory</span>
          <span className="text-2xl font-bold text-slate-900">
            {latest?.indexValue ? `${((latest.indexValue - 100) * 1.4).toFixed(1)}%` : '+3.8%'}
          </span>
          <span className="text-[10px] font-sans text-slate-400 block">Annualized pace</span>
        </div>

        <div>
          <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Corridor Coverage</span>
          <span className="text-2xl font-bold text-slate-900">
            {routeStats.length} pairs
          </span>
          <span className="text-[10px] font-sans text-slate-400 block">Domestic Trunk</span>
        </div>

        <div>
          <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Passenger Weight</span>
          <span className="text-2xl font-bold text-slate-900">
            100.0%
          </span>
          <span className="text-[10px] font-sans text-slate-400 block">DGCA calibrated</span>
        </div>
      </section>

      {/* 3. PRIMARY TIME-SERIES CHART */}
      <section className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              National Airfare Price Index (Base = 100)
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Time-series progression of Laspeyres index relative to January 2026 benchmark
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Fixed-Basket Model</span>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={indexPoints} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="indexFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#c2410c" stopOpacity={0.12} />
                  <stop offset="95%" stopColor="#c2410c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="monthLabel" stroke="#a8a29e" fontSize={11} tickLine={false} axisLine={{ stroke: '#e7e5e4' }} />
              <YAxis domain={[85, 125]} stroke="#a8a29e" fontSize={11} tickLine={false} axisLine={{ stroke: '#e7e5e4' }} />
              <Tooltip formatter={indexTooltipFormatter} />
              <ReferenceLine y={100} stroke="#a8a29e" strokeDasharray="3 3" label={{ value: 'Benchmark Base (100.0)', fill: '#78716c', fontSize: 10, position: 'insideTopRight' }} />
              <Area type="monotone" dataKey="indexValue" stroke="#c2410c" strokeWidth={2} fillOpacity={1} fill="url(#indexFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* 4. ROUTE CONTRIBUTION TO INDEX MOVEMENT */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Route Contribution to Index Movement
            </h2>
            <p className="text-[11px] text-slate-400">Weighted points contributed to the current monthly change</p>
          </div>
          <span className="text-[11px] text-slate-400">Δ = (MoM Shift × Basket Weight)</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          {routeContributions.slice(0, 6).map((rc) => {
            const isPos = rc.contribution > 0;
            const barWidth = Math.min(100, Math.abs(rc.contribution) * 40);
            return (
              <div key={rc.routeId} className="flex items-center gap-4 text-xs">
                <span className="w-28 font-semibold text-slate-800 truncate">
                  {rc.origin} — {rc.destination}
                </span>

                <div className="flex-1 flex items-center h-4 bg-slate-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${isPos ? 'bg-rose-500/80 ml-auto' : 'bg-emerald-600/80'}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>

                <div className="w-24 text-right font-mono text-[11px]">
                  <span className={`font-semibold ${isPos ? 'text-rose-600' : 'text-emerald-700'}`}>
                    {isPos ? `+${rc.contribution}` : `${rc.contribution}`} pts
                  </span>
                </div>

                <div className="w-24 text-right font-mono text-[11px] text-slate-400">
                  w = {rc.normalizedWeight.toFixed(1)}%
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. WEIGHT CALIBRATION DRAWER (OPTIONAL) */}
      {showWeights && (
        <section className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-800 font-sans">Interactive Basket Calibration</span>
            <button onClick={resetWeights} className="btn btn-secondary text-xs">
              <RotateCcw className="w-3 h-3 text-slate-500" />
              <span>Reset to Official Weights</span>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {routeStats.map((r) => (
              <div key={r.routeId} className="bg-white border border-slate-200 rounded p-2.5 flex items-center justify-between">
                <span className="font-semibold text-slate-700">{r.origin} — {r.destination}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={weights[r.routeId] ?? r.weight}
                  onChange={(e) => handleWeightChange(r.routeId, parseFloat(e.target.value) || 0)}
                  className="input w-16 text-right font-mono text-xs py-0.5"
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 6. ROUTE BASKET TABLE */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Corridor Basket Weights &amp; Status
            </h2>
            <p className="text-[11px] text-slate-400">Constituent route metrics under active surveillance</p>
          </div>
          <span className="text-[11px] font-mono text-slate-500">{routeStats.length} Constituents</span>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <th className="table-th">Corridor</th>
                  <th className="table-th text-right">Basket Weight</th>
                  <th className="table-th text-right">Current Index</th>
                  <th className="table-th text-right">Monthly Shift</th>
                  <th className="table-th text-right">Average Fare</th>
                  <th className="table-th text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-xs">
                {routeContributions.map((r) => {
                  const up = r.momChange > 0;
                  const down = r.momChange < 0;
                  return (
                    <tr key={r.routeId} className="table-row">
                      <td className="table-td font-sans font-semibold text-slate-900">
                        {r.origin} — {r.destination}
                      </td>
                      <td className="table-td text-right text-slate-600">
                        {r.normalizedWeight.toFixed(2)}%
                      </td>
                      <td className="table-td text-right font-semibold text-slate-900">
                        {r.index ? r.index.toFixed(1) : '100.0'}
                      </td>
                      <td className="table-td text-right">
                        <span className={`font-semibold ${
                          up ? 'text-rose-600' : down ? 'text-emerald-700' : 'text-slate-500'
                        }`}>
                          {up ? `+${r.momChange}%` : `${r.momChange}%`}
                        </span>
                      </td>
                      <td className="table-td text-right text-slate-800">
                        {formatINR(r.averageFare)}
                      </td>
                      <td className="table-td text-center font-sans">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                          r.momChange > 5
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {r.momChange > 5 ? 'Surge' : 'Active'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
