import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { FilterBar } from '@/components/FilterBar';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/data/random';
import { Info, TrendingUp } from 'lucide-react';
import { fareTooltipFormatter } from '@/components/chartFormatters';
import { apiBookingWindow, type ApiFilters } from '@/lib/api';

export function BookingWindowPage() {
  const { filters, lastUpdate } = useApp();
  const [bwStats, setBwStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiFilters: ApiFilters = {
          origin: filters.origin !== 'all' ? filters.origin : undefined,
          destination: filters.destination !== 'all' ? filters.destination : undefined,
          airline: filters.airline !== 'all' ? filters.airline : undefined,
          travelClass: filters.travelClass !== 'all' ? filters.travelClass : undefined,
          bookingWindow: filters.bookingWindow !== 'all' ? filters.bookingWindow : undefined,
          preset: filters.preset,
          customStart: filters.customStart,
          customEnd: filters.customEnd,
        };
        const res = await apiBookingWindow(apiFilters);
        setBwStats(res.data);
      } catch (error) {
        console.error('Failed to fetch booking window stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters, lastUpdate]);

  const t45 = bwStats.find((b) => b.window === 45);
  const t1 = bwStats.find((b) => b.window === 1);
  const priceDiff = t45 && t1 && t45.averageFare > 0
    ? ((t1.averageFare - t45.averageFare) / t45.averageFare) * 100
    : 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">Booking Window Intelligence</h1>
        <p className="text-slate-500 mt-1">How airfare changes as the departure date approaches</p>
      </div>

      {/* Explanation */}
      <Card className="mb-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-navy-50 flex items-center justify-center flex-shrink-0">
            <Info className="w-5 h-5 text-navy-700" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-navy-900">What is a booking window?</h3>
            <p className="text-sm text-slate-600 mt-1 leading-relaxed">
              The booking window (T+N) is the number of days between booking and departure.
              <strong> T+1</strong> means the flight is one day away. <strong>T+7</strong> means seven days away,
              <strong> T+15</strong> fifteen days, <strong>T+30</strong> thirty days, and <strong>T+45</strong> forty-five days.
              Booking closer to departure typically results in higher fares.
            </p>
          </div>
        </div>
      </Card>

      <FilterBar />

      {/* Insight */}
      <div className="card p-4 mb-6 bg-navy-50 border-navy-200">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-navy-700" />
          <p className="text-sm text-navy-800">
            <strong>Key insight:</strong> Average observed fares increase as the departure date approaches.
            Fares at T+1 are approximately <strong>{priceDiff.toFixed(0)}% higher</strong> than at T+45
            ({formatINR(t1?.averageFare ?? 0)} vs {formatINR(t45?.averageFare ?? 0)}).
          </p>
        </div>
      </div>

      {/* Line chart */}
      <Card title="Booking Window vs Average Fare" subtitle="Average fare by days before departure" className="mb-6">
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={bwStats} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 13, fill: '#64748b' }} label={{ value: 'Days before departure', position: 'insideBottom', offset: -5, fontSize: 11, fill: '#94a3b8' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={fareTooltipFormatter} />
            <Line type="monotone" dataKey="averageFare" stroke="#dc2626" strokeWidth={3} dot={{ r: 6, fill: '#dc2626' }} activeDot={{ r: 8 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      {/* Bar chart + table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Fare by Window" subtitle="Bar chart comparison">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={bwStats} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={fareTooltipFormatter} />
              <Bar dataKey="averageFare" fill="#244680" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Detailed Breakdown" subtitle="All booking window statistics">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-th">Window</th>
                  <th className="table-th">Meaning</th>
                  <th className="table-th text-right">Avg Fare</th>
                  <th className="table-th text-right">Observations</th>
                </tr>
              </thead>
              <tbody>
                {bwStats.map((b) => (
                  <tr key={b.window} className="table-row">
                    <td className="table-td font-mono font-medium">{b.label}</td>
                    <td className="table-td text-slate-600">{b.window === 1 ? '1 day before departure' : `${b.window} days before departure`}</td>
                    <td className="table-td text-right font-mono">{formatINR(b.averageFare)}</td>
                    <td className="table-td text-right font-mono">{b.observations.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
