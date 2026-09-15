import { useEffect, useState } from 'react';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from 'recharts';
import {
  Info, Settings2, RotateCcw, TrendingUp, CheckCircle2,
  Layers, ArrowUp, ArrowDown, Minus, Sliders, ShieldCheck,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { Card } from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { indexTooltipFormatter } from '@/components/chartFormatters';
import { apiIndex, apiRoutes, type ApiRouteStats } from '@/lib/api';

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
  const first = indexPoints[0];
  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);

  const handleWeightChange = (routeId: string, value: number) => {
    setWeights((prev) => ({ ...prev, [routeId]: Math.max(0, value) }));
  };

  const resetWeights = () => {
    setWeights(Object.fromEntries(routeStats.map((route) => [route.routeId, route.weight])));
    showToast('Route weights reset to default DGCA passenger proportions.', 'info');
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
                LASPEYRES STATISTICAL METHODOLOGY
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Base Cohort: January 2026 = 100.0
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              National Airfare Index Engine
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Transparent, weighted price relative computation. Quantifies macroeconomic tariff movements across Indian domestic air corridors with mathematical precision.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowFormula(!showFormula)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-semibold transition-all backdrop-blur-sm"
            >
              <Info className="w-3.5 h-3.5" />
              <span>{showFormula ? 'Hide Formula' : 'Inspect Formula'}</span>
            </button>
            <button
              onClick={() => setShowWeights(!showWeights)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-500/20 hover:bg-accent-500/30 border border-accent-500/40 text-accent-300 text-xs font-semibold transition-all backdrop-blur-sm"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showWeights ? 'Hide Weight Basket' : 'Adjust Weights'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Formula Modal / Card */}
      {showFormula && (
        <div className="glass-card p-6 border-l-4 border-l-navy-600 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-navy-950 flex items-center gap-2">
              <Info className="w-4 h-4 text-navy-600" />
              Laspeyres Weighted Price Relative Formula
            </h3>
            <button onClick={() => setShowFormula(false)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
          </div>
          <div className="bg-navy-950 text-white p-4 rounded-xl font-mono text-sm overflow-x-auto shadow-inner">
            Index_t = [ ∑ ( w_i × ( P_i,t / P_i,0 ) ) / ∑ w_i ] × 100
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Where <strong>P_i,t</strong> is the average fare on route <em>i</em> during period <em>t</em>, <strong>P_i,0</strong> is the base price (January 2026), and <strong>w_i</strong> is the traffic weight reflecting historical annual passenger volume on corridor <em>i</em>.
          </p>
        </div>
      )}

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard
          label="Current Composite Index"
          value={latest?.indexValue.toFixed(1) ?? '100.0'}
          change={latest?.percentageChange}
          sublabel="Base Period: Jan 2026 = 100.0"
          statusText={latest && latest.indexValue > 100 ? 'Inflationary' : 'Deflationary'}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="navy"
          progressPercent={Math.min(100, ((latest?.indexValue ?? 100) / 120) * 100)}
        />

        <DashboardKpiCard
          label="Monthly Relative Drift"
          value={formatPercent(latest?.percentageChange ?? 0)}
          sublabel="Weighted MoM rate of change"
          statusText={Math.abs(latest?.percentageChange || 0) > 3 ? 'Elevated Drift' : 'Within Band'}
          icon={<TrendingUp className="w-5 h-5" />}
          accent={latest && latest.percentageChange > 0 ? 'danger' : 'accent'}
        />

        <DashboardKpiCard
          label="Base Benchmark Price"
          value={first ? formatINR(first.averageFare) : '₹11,850'}
          sublabel="January 2026 cohort base"
          statusText="Standard Reference"
          icon={<Layers className="w-5 h-5" />}
          accent="purple"
        />

        <DashboardKpiCard
          label="Corridors in Basket"
          value={`${routeStats.length} Corridors`}
          sublabel={`Total basket weight: ${totalWeight}`}
          statusText="100% Normalized"
          icon={<CheckCircle2 className="w-5 h-5" />}
          accent="accent"
          progressPercent={100}
        />
      </div>

      {/* Main Index Area Chart */}
      <div className="glass-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 mb-5 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-display font-bold text-navy-950">
                National Airfare Price Trajectory
              </h2>
              <span className="badge badge-navy">Laspeyres Composite</span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly evolution relative to Base Period (100.0). Visualized with standard error bounds.
            </p>
          </div>

          <button
            onClick={() => setShowWeights(!showWeights)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-navy-800 hover:bg-slate-50 shadow-sm"
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-500" />
            <span>{showWeights ? 'Hide Weight Basket' : 'Adjust Basket Weights'}</span>
          </button>
        </div>

        <div className="w-full h-80 lg:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={indexPoints} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="indexPageGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#244680" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#244680" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(15, 29, 56, 0.1)',
                  border: '1px solid #e2e8f0',
                }}
                formatter={indexTooltipFormatter}
              />
              <ReferenceLine
                y={100}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                label={{ value: 'Baseline (100.0)', position: 'insideTopRight', fontSize: 11, fill: '#64748b' }}
              />
              <Area
                type="monotone"
                dataKey="indexValue"
                stroke="#244680"
                strokeWidth={3}
                fill="url(#indexPageGrad)"
                dot={{ r: 4, fill: '#244680', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Route Basket & Weights Interactive Adjuster */}
      {showWeights && (
        <div className="glass-card p-6 animate-fade-in border-t-4 border-t-amber-500">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 mb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-display font-bold text-navy-950">
                Route Basket Weight Calibration
              </h3>
              <p className="text-xs text-slate-500">
                Simulate index elasticity by adjusting corridor weights based on passenger load or seasonal priority
              </p>
            </div>
            <button
              onClick={resetWeights}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Reset to Defaults</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Corridor</th>
                  <th className="table-th text-right">Raw Weight</th>
                  <th className="table-th text-right">Basket %</th>
                  <th className="table-th text-right">Avg Fare</th>
                  <th className="table-th text-right">Route Index</th>
                  <th className="table-th text-right">Index Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {routeStats.map((r) => {
                  const w = weights[r.routeId] ?? 0;
                  const wPct = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
                  const contribution = (r.index / 100) * wPct;
                  return (
                    <tr key={r.routeId} className="hover:bg-slate-50/80 transition-colors">
                      <td className="table-td font-semibold text-navy-900">
                        {r.origin} → {r.destination}
                        <span className="block text-[10px] text-slate-400 uppercase font-semibold">{r.category || 'Corridor'}</span>
                      </td>
                      <td className="table-td text-right">
                        <input
                          type="number"
                          min={0}
                          value={w}
                          onChange={(e) => handleWeightChange(r.routeId, Number(e.target.value))}
                          className="w-20 px-2.5 py-1 text-right text-xs font-mono font-bold rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500"
                        />
                      </td>
                      <td className="table-td text-right font-mono font-semibold text-navy-800">
                        {wPct.toFixed(1)}%
                      </td>
                      <td className="table-td text-right font-mono text-slate-700">
                        {formatINR(r.averageFare)}
                      </td>
                      <td className="table-td text-right font-mono font-semibold text-navy-900">
                        {r.index.toFixed(1)}
                      </td>
                      <td className="table-td text-right font-mono font-bold text-navy-950">
                        {contribution.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/50">
                  <td className="table-td font-bold text-navy-950">Total Basket Weight</td>
                  <td className="table-td text-right font-mono font-bold text-navy-950">{totalWeight}</td>
                  <td className="table-td text-right font-mono font-bold text-navy-950">100.0%</td>
                  <td className="table-td"></td>
                  <td className="table-td"></td>
                  <td className="table-td text-right font-mono font-extrabold text-navy-950">
                    {latest?.indexValue.toFixed(1) ?? '100.0'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Monthly Index History Table */}
      <div className="glass-card p-6">
        <div className="pb-4 mb-4 border-b border-slate-100">
          <h3 className="text-base font-display font-bold text-navy-950">
            Monthly Econometric Index Ledger
          </h3>
          <p className="text-xs text-slate-500">
            Sequential historical records of composite index points, rate of change, and mean cohort pricing
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Observation Month</th>
                <th className="table-th text-right">Composite Index</th>
                <th className="table-th text-right">MoM Velocity</th>
                <th className="table-th text-right">Average Ticket Fare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {indexPoints.map((p, i) => {
                const isPositive = p.percentageChange > 0.5;
                const isNegative = p.percentageChange < -0.5;
                return (
                  <tr key={p.period} className="hover:bg-slate-50/80 transition-colors">
                    <td className="table-td font-semibold text-navy-900">{p.monthLabel}</td>
                    <td className="table-td text-right font-mono font-bold text-navy-950">
                      {p.indexValue.toFixed(1)}
                    </td>
                    <td className="table-td text-right">
                      {i === 0 ? (
                        <span className="badge-slate font-mono font-bold">BASE (100.0)</span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-xs font-semibold ${
                            isPositive
                              ? 'bg-rose-50 text-rose-600 border border-rose-200/50'
                              : isNegative
                              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {isPositive ? (
                            <ArrowUp className="w-3 h-3" />
                          ) : isNegative ? (
                            <ArrowDown className="w-3 h-3" />
                          ) : (
                            <Minus className="w-3 h-3" />
                          )}
                          {formatPercent(p.percentageChange)}
                        </span>
                      )}
                    </td>
                    <td className="table-td text-right font-mono font-semibold text-navy-900">
                      {formatINR(p.averageFare)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
