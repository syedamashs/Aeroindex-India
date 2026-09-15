import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { formatINR, formatPercent, formatNumber } from '@/data/random';
import {
  ArrowLeft, TrendingUp, Activity, Gauge, BarChart2, Clock,
  Route as RouteIcon, ShieldCheck,
} from 'lucide-react';
import { DashboardKpiCard } from '@/components/ui/DashboardKpiCard';
import { fareTooltipFormatter } from '@/components/chartFormatters';
import { apiRouteDetail, apiRoutes, type ApiObservation, type ApiRouteStats } from '@/lib/api';
import { FlightPathTrajectory } from '@/components/animation/FlightPathTrajectory';
import { StaggerContainer, MotionItem } from '@/components/animation/MotionCard';

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
    observations.forEach((observation) => {
      const month = observation.travelDate.slice(0, 7);
      groups.set(month, [...(groups.get(month) || []), observation.totalFare]);
    });
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, fares]) => ({
        label: month,
        fare: fares.reduce((sum, fare) => sum + fare, 0) / fares.length,
      }));
  }, [observations]);

  const airlineComp = useMemo(() => {
    const groups = new Map<string, number[]>();
    observations.forEach((observation) =>
      groups.set(observation.airline, [...(groups.get(observation.airline) || []), observation.totalFare])
    );
    const colors = ['#244680', '#10b981', '#f43f5e', '#f59e0b', '#6366f1', '#06b6d4'];
    return [...groups.entries()].map(([name, fares], index) => ({
      name,
      avgFare: fares.reduce((sum, fare) => sum + fare, 0) / fares.length,
      color: colors[index % colors.length],
    }));
  }, [observations]);

  const bwStats = useMemo(() => {
    const groups = new Map<number, number[]>();
    observations.forEach((observation) =>
      groups.set(observation.bookingWindow, [...(groups.get(observation.bookingWindow) || []), observation.totalFare])
    );
    return [...groups.entries()]
      .sort(([a], [b]) => a - b)
      .map(([window, fares]) => ({
        window,
        label: `T+${window}`,
        averageFare: fares.reduce((sum, fare) => sum + fare, 0) / fares.length,
      }));
  }, [observations]);

  if (loading) {
    return (
      <div className="glass-card p-12 text-center space-y-3">
        <div className="inline-block w-8 h-8 border-4 border-navy-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-slate-600">Loading corridor deep-dive...</p>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="glass-card p-12 text-center space-y-4">
        <p className="text-sm font-semibold text-slate-600">Flight corridor not found or unmonitored.</p>
        <button onClick={() => navigate('/routes')} className="btn-primary">
          Back to Route Analysis
        </button>
      </div>
    );
  }

  const routeLabel = `${route.origin} → ${route.destination}`;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Back Button */}
      <button
        onClick={() => navigate('/routes')}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-navy-800 hover:bg-slate-50 transition-all shadow-sm"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Back to All Corridors</span>
      </button>

      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-6 lg:p-8 shadow-xl border border-navy-700/60">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                CORRIDOR COCKPIT DEEP DIVE
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm uppercase">
                {route.category} Corridor • {route.distanceKm || 1150} KM
              </span>
            </div>

            <h1 className="font-display font-extrabold text-3xl lg:text-4xl tracking-tight text-white flex items-center gap-3">
              <RouteIcon className="w-7 h-7 text-accent-400" />
              <span>{routeLabel}</span>
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Historical price relative evolution, carrier price yield benchmark, and advance booking elasticity curve for this flight corridor.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-navy-900/80 p-3.5 rounded-2xl border border-navy-700">
            <div className="text-right">
              <p className="text-[11px] text-slate-400 uppercase font-semibold">Route Index</p>
              <p className="text-2xl font-display font-black text-white font-mono">{route.index.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Great Circle Flight Trajectory Animation */}
      <FlightPathTrajectory
        origin={route.origin}
        destination={route.destination}
        distanceKm={route.distanceKm || 1150}
        fare={route.averageFare}
        duration={route.distanceKm && route.distanceKm > 1500 ? '2h 45m' : '1h 55m'}
        altitude="FL340 (34,000 ft)"
      />

      {/* KPI Cards */}
      <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MotionItem>
          <DashboardKpiCard
            label="Corridor Average Fare"
            value={formatINR(route.averageFare)}
            change={route.momChange}
            sublabel="Current monitored cohort"
            statusText="Weighted Mean"
            icon={<TrendingUp className="w-5 h-5" />}
            accent="navy"
            progressPercent={100}
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Corridor Index Score"
            value={route.index.toFixed(1)}
            sublabel="Base Jan 2026 = 100.0"
            statusText={route.index > 100 ? 'Surge Trend' : 'Below Base'}
            icon={<Activity className="w-5 h-5" />}
            accent="purple"
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Price Spread (Min – Max)"
            value={`${formatINR(route.minFare)} – ${formatINR(route.maxFare)}`}
            sublabel="Dynamic tariff range"
            statusText="Spread Bounds"
            icon={<BarChart2 className="w-5 h-5" />}
            accent="accent"
          />
        </MotionItem>

        <MotionItem>
          <DashboardKpiCard
            label="Volatility Index (σ)"
            value={formatINR(route.volatility)}
            sublabel="Observed standard deviation"
            statusText={route.volatility > 2000 ? 'High Dispersion' : 'Stable Band'}
            icon={<Gauge className="w-5 h-5" />}
            accent={route.volatility > 2000 ? 'warning' : 'accent'}
          />
        </MotionItem>
      </StaggerContainer>

      {/* Monthly Price Curve Chart */}
      <div className="glass-card p-6">
        <div className="pb-5 mb-5 border-b border-slate-100">
          <h3 className="text-base font-display font-bold text-navy-950">
            Historical Corridor Fare Trajectory
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Mean airfare progression for {routeLabel} across collection periods
          </p>
        </div>

        <div className="w-full h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={monthlyTrend} margin={{ top: 15, right: 30, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="routeAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#244680" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#244680" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={fareTooltipFormatter} />
              <Area
                type="monotone"
                dataKey="fare"
                stroke="#244680"
                strokeWidth={3}
                fill="url(#routeAreaGrad)"
                dot={{ r: 4, fill: '#244680', strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dual Split: Carrier Comparison & Corridor Booking Curve */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-display font-bold text-navy-950">
              Carrier Pricing on this Corridor
            </h3>
            <p className="text-xs text-slate-500">Average ticket pricing by operating airline</p>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={airlineComp} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fareTooltipFormatter} />
                <Bar dataKey="avgFare" radius={[6, 6, 0, 0]}>
                  {airlineComp.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 glass-card p-6">
          <div className="pb-4 mb-4 border-b border-slate-100">
            <h3 className="text-base font-display font-bold text-navy-950">
              Corridor Booking Window Curve
            </h3>
            <p className="text-xs text-slate-500">Advance departure lead-day yield curve for {routeLabel}</p>
          </div>

          <div className="w-full h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bwStats} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={fareTooltipFormatter} />
                <Bar dataKey="averageFare" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
