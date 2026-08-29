import { useMemo } from 'react';
import { Card } from '@/components/ui/Card';
import { KpiCard } from '@/components/ui/KpiCard';
import { useApp } from '@/context/AppContext';
import {
  computeIndex,
  computeRouteStats,
  computeAirlineStats,
  computeInsights,
  computeBookingWindowStats,
  getAirportLabel,
} from '@/data/analytics';
import { formatINR, formatPercent } from '@/data/random';
import {
  Activity, TrendingUp, TrendingDown, Gauge, Info, Lightbulb, BarChart3,
} from 'lucide-react';

export function InsightsPage() {
  const { lastUpdate } = useApp();

  const indexPoints = useMemo(() => computeIndex(), [lastUpdate]);
  const routeStats = useMemo(() => computeRouteStats(), [lastUpdate]);
  const airlineStats = useMemo(() => computeAirlineStats(), [lastUpdate]);
  const insights = useMemo(() => computeInsights(), [lastUpdate]);
  const bwStats = useMemo(() => computeBookingWindowStats(), [lastUpdate]);

  const latest = indexPoints[indexPoints.length - 1];
  const topIncrease = [...routeStats].sort((a, b) => b.momChange - a.momChange)[0];
  const topDecrease = [...routeStats].sort((a, b) => a.momChange - b.momChange)[0];
  const mostVolatile = [...routeStats].sort((a, b) => b.volatility - a.volatility)[0];
  const cheapestRoute = [...routeStats].sort((a, b) => a.averageFare - b.averageFare)[0];
  const priciestRoute = [...routeStats].sort((a, b) => b.averageFare - a.averageFare)[0];
  const cheapestAirline = [...airlineStats].sort((a, b) => a.averageFare - b.averageFare)[0];
  const priciestAirline = [...airlineStats].sort((a, b) => b.averageFare - a.averageFare)[0];

  const t45 = bwStats.find((b) => b.window === 45);
  const t1 = bwStats.find((b) => b.window === 1);

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">Policy Insights</h1>
        <p className="text-slate-500 mt-1">Automatically generated analytical insights from prototype data</p>
      </div>

      {/* Disclaimer */}
      <div className="card p-4 mb-6 bg-warning-500/5 border-warning-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-slate-700">
            <strong>Prototype analytical insight.</strong> These insights are generated from internally simulated airfare
            data for demonstration purposes. They do not represent real government findings or official statistics.
          </p>
        </div>
      </div>

      {/* Executive Summary */}
      <Card title="National Airfare Situation" subtitle="Executive summary of current airfare intelligence" className="mb-6">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <KpiCard label="Current Index" value={latest?.indexValue.toFixed(1) ?? '100'} icon={<Activity className="w-4 h-4" />} />
          <KpiCard label="Monthly Movement" value={formatPercent(latest?.percentageChange ?? 0)} icon={<TrendingUp className="w-4 h-4" />} accent={(latest?.percentageChange ?? 0) > 0 ? 'danger' : 'success'} />
          <KpiCard label="Highest Increase" value={topIncrease ? `${getAirportLabel(topIncrease.origin)} → ${getAirportLabel(topIncrease.destination)}` : '—'} sublabel={topIncrease ? formatPercent(topIncrease.momChange) : ''} icon={<TrendingUp className="w-4 h-4" />} accent="danger" />
          <KpiCard label="Largest Decrease" value={topDecrease ? `${getAirportLabel(topDecrease.origin)} → ${getAirportLabel(topDecrease.destination)}` : '—'} sublabel={topDecrease ? formatPercent(topDecrease.momChange) : ''} icon={<TrendingDown className="w-4 h-4" />} accent="success" />
          <KpiCard label="Most Volatile Route" value={mostVolatile ? `${getAirportLabel(mostVolatile.origin)} → ${getAirportLabel(mostVolatile.destination)}` : '—'} sublabel={mostVolatile ? `σ ${formatINR(mostVolatile.volatility)}` : ''} icon={<Gauge className="w-4 h-4" />} accent="warning" />
          <KpiCard label="Lowest Avg Fare" value={cheapestRoute ? `${getAirportLabel(cheapestRoute.origin)} → ${getAirportLabel(cheapestRoute.destination)}` : '—'} sublabel={cheapestRoute ? formatINR(cheapestRoute.averageFare) : ''} icon={<TrendingDown className="w-4 h-4" />} accent="success" />
          <KpiCard label="Highest Avg Fare" value={priciestRoute ? `${getAirportLabel(priciestRoute.origin)} → ${getAirportLabel(priciestRoute.destination)}` : '—'} sublabel={priciestRoute ? formatINR(priciestRoute.averageFare) : ''} icon={<TrendingUp className="w-4 h-4" />} accent="danger" />
          <KpiCard label="Cheapest Airline" value={cheapestAirline?.name ?? '—'} sublabel={cheapestAirline ? formatINR(cheapestAirline.averageFare) : ''} icon={<TrendingDown className="w-4 h-4" />} accent="success" />
        </div>
      </Card>

      {/* Key Observations */}
      <Card title="Key Observations" subtitle="Automatically generated from prototype data" className="mb-6">
        <div className="space-y-3">
          {insights.map((insight) => (
            <div key={insight.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50">
              <div className="w-8 h-8 rounded-lg bg-navy-100 flex items-center justify-center flex-shrink-0">
                <Lightbulb className="w-4 h-4 text-navy-700" />
              </div>
              <div>
                <p className="text-sm text-navy-800">{insight.text}</p>
                <span className="badge-slate mt-1">{insight.category}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Booking window insight */}
      {t45 && t1 && (
        <Card title="Booking Window Impact" subtitle="Policy-relevant fare timing analysis">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-navy-50 flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-navy-700" />
            </div>
            <div>
              <p className="text-sm text-navy-800">
                Fares booked 1 day before departure are <strong>{(((t1.averageFare - t45.averageFare) / t45.averageFare) * 100).toFixed(0)}% higher</strong> on average
                than fares booked 45 days in advance ({formatINR(t1.averageFare)} vs {formatINR(t45.averageFare)}).
                This suggests consumers can achieve significant savings by booking well ahead of departure.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
