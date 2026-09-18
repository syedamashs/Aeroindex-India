import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatINR, formatPercent } from '@/data/random';
import { ArrowLeft, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { fareTooltipFormatter } from '@/components/chartFormatters';
import { apiRouteDetail, apiRoutes, type ApiObservation, type ApiRouteStats } from '@/lib/api';

export function RouteDetailPage() {
  const { routeId } = useParams();
  const navigate = useNavigate();

  const [route, setRoute] = useState<ApiRouteStats | null>(null);
  const [observations, setObservations] = useState<ApiObservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!routeId) return;
    setLoading(true);
    apiRouteDetail(routeId)
      .then(async (response) => {
        if (response.data.route) {
          return response;
        }

        const airportCodeMatch = routeId.match(/^([A-Z]{3})-([A-Z]{3})$/i);
        if (!airportCodeMatch) return response;

        const routesResponse = await apiRoutes();
        const [origin, destination] = airportCodeMatch.slice(1).map((code) => code.toUpperCase());
        const monitoredRoute = routesResponse.data.find(
          (candidate) => candidate.origin === origin && candidate.destination === destination,
        ) ?? routesResponse.data.find(
          (candidate) => candidate.origin === destination && candidate.destination === origin,
        );
        return monitoredRoute ? apiRouteDetail(monitoredRoute.routeId) : response;
      })
      .then((response) => {
        setRoute(response.data.route);
        setObservations(response.data.observations);
      })
      .catch((error) => console.error('Failed to fetch route detail:', error))
      .finally(() => setLoading(false));
  }, [routeId]);

  const monthlyTrend = useMemo(() => {
    const groups = new Map<string, number[]>();
    observations.forEach((obs) => {
      const month = obs.travelDate.slice(0, 7);
      groups.set(month, [...(groups.get(month) || []), obs.totalFare]);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, fares]) => ({
        label: month,
        fare: Math.round(fares.reduce((sum, f) => sum + f, 0) / fares.length),
      }));
  }, [observations]);

  const airlineComp = useMemo(() => {
    const groups = new Map<string, number[]>();
    observations.forEach((obs) =>
      groups.set(obs.airline, [...(groups.get(obs.airline) || []), obs.totalFare])
    );
    return [...groups.entries()].map(([name, fares]) => ({
      name,
      avgFare: Math.round(fares.reduce((sum, f) => sum + f, 0) / fares.length),
      minFare: Math.min(...fares),
      maxFare: Math.max(...fares),
      count: fares.length,
    }));
  }, [observations]);

  const bwStats = useMemo(() => {
    const groups = new Map<number, number[]>();
    observations.forEach((obs) =>
      groups.set(obs.bookingWindow, [...(groups.get(obs.bookingWindow) || []), obs.totalFare])
    );
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([window, fares]) => ({
        window,
        label: `T+${window}`,
        averageFare: Math.round(fares.reduce((sum, f) => sum + f, 0) / fares.length),
        count: fares.length,
      }));
  }, [observations]);

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 font-mono">
        Loading corridor dossier...
      </div>
    );
  }

  if (!route) {
    return (
      <div className="p-8 text-center space-y-3">
        <p className="text-xs text-slate-500">Corridor data not available.</p>
        <button onClick={() => navigate('/routes')} className="btn btn-secondary">
          Return to Corridor Table
        </button>
      </div>
    );
  }

  const isUp = (route.momChange || 0) > 0;
  const isDown = (route.momChange || 0) < 0;

  return (
    <div className="space-y-8 animate-fade-in max-w-[1440px]">
      {/* Back link */}
      <div>
        <button
          onClick={() => navigate('/routes')}
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          <span>Back to All Corridors</span>
        </button>
      </div>

      {/* 1. CORRIDOR REPORT HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono uppercase text-slate-400">Corridor Dossier</span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-mono text-slate-500">{route.origin} — {route.destination}</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            {route.origin} to {route.destination}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Scheduled Domestic Trunk Airway · Direct passenger market telemetry
          </p>
        </div>

        <span className="text-xs font-mono text-slate-400">
          Last sampled: {new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* 2. CORE CORRIDOR METRICS STRIP */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6 border-b border-slate-200 pb-6 text-xs font-mono">
        <div>
          <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Average Fare</span>
          <span className="text-2xl font-bold text-slate-900">{formatINR(route.averageFare)}</span>
          <span className="text-[10px] font-sans text-slate-400 block">Weighted across horizons</span>
        </div>

        <div>
          <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Corridor Index</span>
          <span className="text-2xl font-bold text-slate-900">{route.index ? route.index.toFixed(1) : '100.0'}</span>
          <span className="text-[10px] font-sans text-slate-400 block">Base 100.0</span>
        </div>

        <div>
          <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Monthly Shift (MoM)</span>
          <span className={`text-2xl font-bold inline-flex items-center ${
            isUp ? 'text-rose-600' : isDown ? 'text-emerald-700' : 'text-slate-700'
          }`}>
            {isUp && <ArrowUpRight className="w-5 h-5 mr-0.5" />}
            {isDown && <ArrowDownRight className="w-5 h-5 mr-0.5" />}
            {formatPercent(route.momChange || 0)}
          </span>
          <span className="text-[10px] font-sans text-slate-400 block">Relative delta</span>
        </div>

        <div>
          <span className="text-[11px] font-sans text-slate-500 uppercase tracking-wider block">Observations Monitored</span>
          <span className="text-2xl font-bold text-slate-900">{route.observations?.toLocaleString('en-IN') ?? observations.length}</span>
          <span className="text-[10px] font-sans text-slate-400 block">Verified fare points</span>
        </div>
      </section>

      {/* 3. CHARTS GRID: FARE TREND & BOOKING WINDOW CURVE */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Fare Trend */}
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="pb-3 mb-3 border-b border-slate-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Monthly Average Fare Trend
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Historical trajectory over collection periods</p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fareTooltipFormatter} />
                <Area type="monotone" dataKey="fare" stroke="#c2410c" fill="#c2410c" fillOpacity={0.08} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Booking Window Curve */}
        <section className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="pb-3 mb-3 border-b border-slate-100">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Advance Booking Horizon Curve
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Fare pricing behavior by days prior to departure</p>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bwStats} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickLine={false} />
                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fareTooltipFormatter} />
                <Area type="monotone" dataKey="averageFare" stroke="#d97706" fill="#d97706" fillOpacity={0.08} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* 4. AIRLINE PRICING COMPARISON TABLE */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Carrier Pricing Breakdown on Corridor
          </h2>
          <p className="text-[11px] text-slate-400">Scheduled carriers operating on {route.origin} — {route.destination}</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-th">Carrier</th>
                <th className="table-th text-right">Average Fare</th>
                <th className="table-th text-right">Fare Range (Min – Max)</th>
                <th className="table-th text-right">Obs Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {airlineComp.map((a) => (
                <tr key={a.name} className="table-row">
                  <td className="table-td font-sans font-semibold text-slate-900">{a.name}</td>
                  <td className="table-td text-right font-bold text-slate-900">{formatINR(a.avgFare)}</td>
                  <td className="table-td text-right text-slate-600">{formatINR(a.minFare)} – {formatINR(a.maxFare)}</td>
                  <td className="table-td text-right text-slate-500">{a.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. RECENT OBSERVATION SAMPLES */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent Monitored Tariff Observations
          </h2>
          <p className="text-[11px] text-slate-400">Sample flight queries recorded by scraper</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-th">Observation ID</th>
                <th className="table-th">Travel Date</th>
                <th className="table-th">Airline</th>
                <th className="table-th">Window</th>
                <th className="table-th">Class</th>
                <th className="table-th text-right">Fare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {observations.slice(0, 8).map((obs) => (
                <tr key={obs.id} className="table-row">
                  <td className="table-td text-slate-500">{obs.id}</td>
                  <td className="table-td text-slate-800">{obs.travelDate}</td>
                  <td className="table-td font-sans font-medium text-slate-900">{obs.airline}</td>
                  <td className="table-td text-slate-600">T+{obs.bookingWindow}</td>
                  <td className="table-td font-sans text-slate-600">{obs.travelClass}</td>
                  <td className="table-td text-right font-bold text-slate-900">{formatINR(obs.totalFare)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
