import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import {
  computeRouteStats,
  getRouteTrend,
  getRouteDailyTrend,
  getRouteAirlineComparison,
  getRouteBookingWindow,
  getAirportLabel,
} from '@/data/analytics';
import { ROUTE_MAP } from '@/data/routes';
import { formatINR, formatPercent } from '@/data/random';
import { ArrowLeft, TrendingUp, Activity, Gauge, BarChart2, Clock } from 'lucide-react';
import { fareTooltipFormatter } from '@/components/chartFormatters';

export function RouteDetailPage() {
  const { routeId } = useParams();
  const navigate = useNavigate();

  const route = routeId ? ROUTE_MAP[routeId] : null;
  const stats = useMemo(() => computeRouteStats().find((r) => r.routeId === routeId), [routeId]);
  const monthlyTrend = useMemo(() => routeId ? getRouteTrend(routeId) : [], [routeId]);
  const dailyTrend = useMemo(() => routeId ? getRouteDailyTrend(routeId) : [], [routeId]);
  const airlineComp = useMemo(() => routeId ? getRouteAirlineComparison(routeId) : [], [routeId]);
  const bwStats = useMemo(() => routeId ? getRouteBookingWindow(routeId) : [], [routeId]);

  if (!route || !stats) {
    return (
      <div className="animate-fade-in">
        <p className="text-slate-500">Route not found.</p>
        <button onClick={() => navigate('/routes')} className="btn-primary mt-4">Back to Routes</button>
      </div>
    );
  }

  const routeLabel = `${getAirportLabel(route.origin)} → ${getAirportLabel(route.destination)}`;

  return (
    <div className="animate-fade-in">
      <button onClick={() => navigate('/routes')} className="btn-ghost mb-4 text-sm">
        <ArrowLeft className="w-4 h-4" /> Back to Routes
      </button>

      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">{routeLabel}</h1>
        <p className="text-slate-500 mt-1">{route.origin} → {route.destination} • {route.distanceKm} km • {route.category} route</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="Current Average Fare" value={formatINR(stats.averageFare)} icon={<TrendingUp className="w-4 h-4" />} />
        <KpiCard label="Airfare Index" value={stats.index.toFixed(1)} change={stats.momChange} sublabel="vs base period" icon={<Activity className="w-4 h-4" />} />
        <KpiCard label="Cheapest Observed" value={formatINR(stats.minFare)} icon={<TrendingUp className="w-4 h-4" />} accent="success" />
        <KpiCard label="Highest Observed" value={formatINR(stats.maxFare)} icon={<TrendingUp className="w-4 h-4" />} accent="danger" />
        <KpiCard label="Price Volatility" value={formatINR(stats.volatility)} sublabel="std deviation" icon={<Gauge className="w-4 h-4" />} accent="warning" />
        <KpiCard label="Observations" value={stats.observations.toLocaleString('en-IN')} icon={<BarChart2 className="w-4 h-4" />} />
        <KpiCard label="MoM Change" value={formatPercent(stats.momChange)} icon={<TrendingUp className="w-4 h-4" />} accent={stats.momChange > 0 ? 'danger' : 'success'} />
        <KpiCard label="Median Fare" value={formatINR(stats.medianFare)} icon={<TrendingUp className="w-4 h-4" />} />
      </div>

      {/* Monthly trend */}
      <Card title="Monthly Price Trend" subtitle="Average fare by month" className="mb-6">
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={monthlyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={fareTooltipFormatter} />
            <Line type="monotone" dataKey="fare" stroke="#244680" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Airline comparison */}
        <Card title="Airline Comparison" subtitle="Average fare by airline on this route">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={airlineComp} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} angle={-15} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={fareTooltipFormatter} />
              <Bar dataKey="avgFare" radius={[4, 4, 0, 0]}>
                {airlineComp.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Booking window curve */}
        <Card title="Booking Window Curve" subtitle="How fare changes as departure approaches">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={bwStats} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={fareTooltipFormatter} />
              <Line type="monotone" dataKey="averageFare" stroke="#dc2626" strokeWidth={2.5} dot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Daily trend */}
      <Card title="Daily Price Trend" subtitle="Average fare by travel date">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={dailyTrend} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} angle={-30} textAnchor="end" height={60} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={fareTooltipFormatter} />
            <Line type="monotone" dataKey="fare" stroke="#345a98" strokeWidth={1.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
