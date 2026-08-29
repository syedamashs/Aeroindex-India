import { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { computeIndex, computeRouteStats } from '@/data/analytics';
import { ROUTES, ROUTE_MAP, getAirportLabel } from '@/data/analytics';
import { formatINR, formatPercent } from '@/data/random';
import { Info, Settings2, RotateCcw } from 'lucide-react';
import { indexTooltipFormatter } from '@/components/chartFormatters';

export function IndexPage() {
  const { lastUpdate, showToast } = useApp();
  const [weights, setWeights] = useState<Record<string, number>>(
    Object.fromEntries(ROUTES.map((r) => [r.id, r.weight])),
  );
  const [showWeights, setShowWeights] = useState(false);

  const indexPoints = useMemo(() => computeIndex(weights), [weights, lastUpdate]);
  const routeStats = useMemo(() => computeRouteStats(), [lastUpdate]);
  const latest = indexPoints[indexPoints.length - 1];

  const handleWeightChange = (routeId: string, value: number) => {
    setWeights((prev) => ({ ...prev, [routeId]: Math.max(0, value) }));
  };

  const resetWeights = () => {
    setWeights(Object.fromEntries(ROUTES.map((r) => [r.id, r.weight])));
    showToast('Route weights reset to defaults.', 'info');
  };

  const totalWeight = Object.values(weights).reduce((s, v) => s + v, 0);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">Airfare Index Engine</h1>
        <p className="text-slate-500 mt-1">Transparent, weighted index calculation from underlying observations</p>
      </div>

      {/* Methodology card */}
      <Card className="mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-50 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-navy-700" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-navy-900">How the index is calculated</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              The Airfare Price Index is a weighted aggregate of route-level price relatives. Each route's average fare
              is compared to its January 2026 base-period average, producing a price relative. These relatives are
              combined using configurable route weights (based on passenger importance) to produce the national index.
              <strong> Base Period: January 2026 = 100.</strong> An index of {latest?.indexValue.toFixed(1) ?? '100'} means
              fares are approximately {Math.abs((latest?.indexValue ?? 100) - 100).toFixed(1)}% {(latest?.indexValue ?? 100) > 100 ? 'above' : 'below'} the base.
            </p>
          </div>
        </div>
      </Card>

      {/* Index chart */}
      <Card
        title="India Airfare Price Index"
        subtitle="Monthly composite index — Base Period: January 2026 = 100"
        action={
          <button onClick={() => setShowWeights(!showWeights)} className="btn-secondary text-xs">
            <Settings2 className="w-3.5 h-3.5" />
            {showWeights ? 'Hide' : 'Adjust'} Weights
          </button>
        }
        className="mb-6"
      >
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={indexPoints} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} domain={['dataMin - 5', 'dataMax + 5']} />
            <Tooltip formatter={indexTooltipFormatter} />
            <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 5" label={{ value: 'Base (100)', position: 'right', fontSize: 11, fill: '#94a3b8' }} />
            <Line type="monotone" dataKey="indexValue" stroke="#244680" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Weight management */}
      {showWeights && (
        <Card
          title="Route Basket & Weights"
          subtitle="The group of representative domestic flight routes used to calculate the national airfare index. Adjust weights to see the index recalculate live."
          action={
            <button onClick={resetWeights} className="btn-ghost text-xs">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          }
          className="mb-6"
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Route</th>
                  <th className="table-th text-right">Weight</th>
                  <th className="table-th text-right">Weight %</th>
                  <th className="table-th text-right">Avg Fare</th>
                  <th className="table-th text-right">Index</th>
                  <th className="table-th text-right">Contribution</th>
                </tr>
              </thead>
              <tbody>
                {ROUTES.map((r) => {
                  const rs = routeStats.find((s) => s.routeId === r.id);
                  const w = weights[r.id] ?? 0;
                  const wPct = totalWeight > 0 ? (w / totalWeight) * 100 : 0;
                  const contribution = rs ? (rs.index / 100) * wPct : 0;
                  return (
                    <tr key={r.id} className="table-row">
                      <td className="table-td font-medium">{getAirportLabel(r.origin)} → {getAirportLabel(r.destination)}</td>
                      <td className="table-td text-right">
                        <input
                          type="number"
                          min={0}
                          value={w}
                          onChange={(e) => handleWeightChange(r.id, Number(e.target.value))}
                          className="input w-20 text-right py-1"
                        />
                      </td>
                      <td className="table-td text-right font-mono">{wPct.toFixed(1)}%</td>
                      <td className="table-td text-right font-mono">{rs ? formatINR(rs.averageFare) : '—'}</td>
                      <td className="table-td text-right font-mono">{rs?.index.toFixed(1) ?? '—'}</td>
                      <td className="table-td text-right font-mono">{contribution.toFixed(2)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200">
                  <td className="table-td font-bold">Total</td>
                  <td className="table-td text-right font-bold">{totalWeight}</td>
                  <td className="table-td text-right font-bold">100.0%</td>
                  <td className="table-td"></td>
                  <td className="table-td"></td>
                  <td className="table-td text-right font-bold">{latest?.indexValue.toFixed(1) ?? '100.0'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* Monthly table */}
      <Card title="Monthly Index History" subtitle="All computed index values with month-over-month changes">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Month</th>
                <th className="table-th text-right">Index</th>
                <th className="table-th text-right">Change %</th>
                <th className="table-th text-right">Average Fare</th>
              </tr>
            </thead>
            <tbody>
              {indexPoints.map((p) => (
                <tr key={p.period} className="table-row">
                  <td className="table-td font-medium">{p.monthLabel}</td>
                  <td className="table-td text-right font-mono">{p.indexValue.toFixed(1)}</td>
                  <td className="table-td text-right">
                    {p.percentageChange === 0 ? (
                      <span className="badge-slate">—</span>
                    ) : (
                      <span className={`badge ${p.percentageChange > 0 ? 'badge-danger' : 'badge-success'}`}>
                        {formatPercent(p.percentageChange)}
                      </span>
                    )}
                  </td>
                  <td className="table-td text-right font-mono">{formatINR(p.averageFare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
