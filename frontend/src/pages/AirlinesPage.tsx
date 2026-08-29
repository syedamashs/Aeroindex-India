import { useMemo, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { computeAirlineStats, computeIndex } from '@/data/analytics';
import { formatINR, formatNumber } from '@/data/random';
import { AIRLINES } from '@/data/airlines';
import { Filter } from 'lucide-react';
import { genericFareTooltipFormatter, indexTooltipFormatter } from '@/components/chartFormatters';

export function AirlinesPage() {
  const { lastUpdate } = useApp();
  const [selected, setSelected] = useState<string[]>(AIRLINES.map((a) => a.code));

  const stats = useMemo(() => computeAirlineStats(), [lastUpdate]);
  const indexPoints = useMemo(() => computeIndex(), [lastUpdate]);

  const filtered = stats.filter((s) => selected.includes(s.code));

  const toggleAirline = (code: string) => {
    setSelected((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const barData = filtered.map((s) => ({
    name: s.name,
    averageFare: s.averageFare,
    medianFare: s.medianFare,
    color: s.color,
  }));

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">Airline Fare Intelligence</h1>
        <p className="text-slate-500 mt-1">Comparative fare analysis across Indian domestic carriers</p>
      </div>

      {/* Airline selector */}
      <Card className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">Select airlines to compare</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {AIRLINES.map((a) => (
            <button
              key={a.code}
              onClick={() => toggleAirline(a.code)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                selected.includes(a.code)
                  ? 'border-navy-300 bg-navy-50 text-navy-800'
                  : 'border-slate-200 bg-white text-slate-400'
              }`}
            >
              <span className="w-2 h-2 rounded-full inline-block mr-2" style={{ backgroundColor: a.color }} />
              {a.name}
            </button>
          ))}
        </div>
      </Card>

      {/* Bar chart */}
      <Card title="Average vs Median Fare" subtitle="Comparison across selected airlines" className="mb-6">
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={barData} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-15} textAnchor="end" height={60} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={genericFareTooltipFormatter} />
            <Legend />
            <Bar dataKey="averageFare" name="Average Fare" fill="#244680" radius={[4, 4, 0, 0]} />
            <Bar dataKey="medianFare" name="Median Fare" fill="#5779b3" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Comparison table */}
      <Card title="Detailed Comparison" subtitle="All metrics for selected airlines">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th">Airline</th>
                <th className="table-th text-right">Avg Fare</th>
                <th className="table-th text-right">Median Fare</th>
                <th className="table-th text-right">Min Fare</th>
                <th className="table-th text-right">Max Fare</th>
                <th className="table-th text-right">Volatility</th>
                <th className="table-th text-right">Observations</th>
                <th className="table-th text-right">Avg Index</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.code} className="table-row">
                  <td className="table-td font-medium">
                    <span className="w-2.5 h-2.5 rounded-full inline-block mr-2" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </td>
                  <td className="table-td text-right font-mono">{formatINR(s.averageFare)}</td>
                  <td className="table-td text-right font-mono">{formatINR(s.medianFare)}</td>
                  <td className="table-td text-right font-mono">{formatINR(s.minFare)}</td>
                  <td className="table-td text-right font-mono">{formatINR(s.maxFare)}</td>
                  <td className="table-td text-right font-mono">{formatINR(s.volatility)}</td>
                  <td className="table-td text-right font-mono">{formatNumber(s.observations)}</td>
                  <td className="table-td text-right font-mono">{s.averageIndex.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Trend chart */}
      <Card title="Index Trend" subtitle="National airfare index over time (context for airline comparison)" className="mt-6">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={indexPoints} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
            <Tooltip formatter={indexTooltipFormatter} />
            <Line type="monotone" dataKey="indexValue" stroke="#244680" strokeWidth={2.5} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
