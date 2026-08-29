import type {
  Observation,
  IndexPoint,
  RouteStats,
  AirlineStats,
  BookingWindowStat,
  AlertItem,
  Insight,
  PipelineStats,
  DateRange,
} from './types';
import { getObservations } from './generator';
import { ROUTES, ROUTE_MAP, TOTAL_WEIGHT } from './routes';
import { AIRLINES, AIRLINE_MAP } from './airlines';
import { getAirportLabel } from './generator';

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function getMonthKey(dateStr: string): string {
  return dateStr.slice(0, 7); // YYYY-MM
}

function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

export function getValidObservations(): Observation[] {
  return getObservations().filter((o) => o.status === 'valid');
}

export function filterObservations(
  obs: Observation[],
  filters: {
    origin?: string;
    destination?: string;
    airline?: string;
    travelClass?: string;
    bookingWindow?: string;
    dateRange?: DateRange | null;
  },
): Observation[] {
  return obs.filter((o) => {
    if (filters.origin && filters.origin !== 'all' && o.origin !== filters.origin) return false;
    if (filters.destination && filters.destination !== 'all' && o.destination !== filters.destination) return false;
    if (filters.airline && filters.airline !== 'all' && o.airline !== filters.airline) return false;
    if (filters.travelClass && filters.travelClass !== 'all' && o.travelClass !== filters.travelClass) return false;
    if (filters.bookingWindow && filters.bookingWindow !== 'all' && String(o.bookingWindow) !== filters.bookingWindow) return false;
    if (filters.dateRange) {
      if (o.travelDate < filters.dateRange.start || o.travelDate > filters.dateRange.end) return false;
    }
    return true;
  });
}

// Route-level average fare by month
function routeMonthlyAverages(routeId: string): Map<string, number> {
  const route = ROUTE_MAP[routeId];
  const obs = getValidObservations().filter(
    (o) => o.origin === route.origin && o.destination === route.destination,
  );
  const byMonth = new Map<string, number[]>();
  for (const o of obs) {
    const key = getMonthKey(o.travelDate);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(o.totalFare);
  }
  const result = new Map<string, number>();
  for (const [key, vals] of byMonth) {
    result.set(key, vals.reduce((s, v) => s + v, 0) / vals.length);
  }
  return result;
}

const BASE_MONTH = '2026-01';

// Compute the overall index using configurable weights
export function computeIndex(weights?: Record<string, number>): IndexPoint[] {
  const w = weights ?? Object.fromEntries(ROUTES.map((r) => [r.id, r.weight]));
  const totalW = Object.values(w).reduce((s, v) => s + v, 0) || 1;

  // For each route, compute monthly average and base period average
  const routeMonthly = new Map<string, Map<string, number>>();
  for (const route of ROUTES) {
    routeMonthly.set(route.id, routeMonthlyAverages(route.id));
  }

  // Get all months
  const allMonths = new Set<string>();
  for (const m of routeMonthly.values()) {
    for (const key of m.keys()) allMonths.add(key);
  }
  const sortedMonths = [...allMonths].sort();

  // Base period average per route
  const routeBase = new Map<string, number>();
  for (const route of ROUTES) {
    const monthly = routeMonthly.get(route.id)!;
    routeBase.set(route.id, monthly.get(BASE_MONTH) ?? 0);
  }

  const points: IndexPoint[] = [];
  let prevIndex = 100;

  for (const month of sortedMonths) {
    let weightedSum = 0;
    let weightUsed = 0;
    let fareSum = 0;
    let fareCount = 0;

    for (const route of ROUTES) {
      const base = routeBase.get(route.id)!;
      const current = routeMonthly.get(route.id)!.get(month);
      if (base > 0 && current && current > 0) {
        const relative = current / base;
        const rw = w[route.id] ?? route.weight;
        weightedSum += relative * rw;
        weightUsed += rw;
        fareSum += current;
        fareCount++;
      }
    }

    if (weightUsed === 0) continue;
    const indexValue = (weightedSum / weightUsed) * 100;
    const pctChange = month === BASE_MONTH ? 0 : ((indexValue - prevIndex) / prevIndex) * 100;
    const avgFare = fareCount > 0 ? fareSum / fareCount : 0;

    points.push({
      period: month,
      indexValue: Math.round(indexValue * 10) / 10,
      percentageChange: Math.round(pctChange * 100) / 100,
      averageFare: Math.round(avgFare),
      monthLabel: monthLabel(month),
    });
    prevIndex = indexValue;
  }

  return points;
}

export function computeRouteStats(): RouteStats[] {
  const obs = getValidObservations();
  const byRoute = new Map<string, Observation[]>();

  for (const o of obs) {
    const id = `${o.origin}-${o.destination}`;
    if (!byRoute.has(id)) byRoute.set(id, []);
    byRoute.get(id)!.push(o);
  }

  const stats: RouteStats[] = [];
  const indexPoints = computeIndex();
  const lastPoint = indexPoints[indexPoints.length - 1];
  const prevPoint = indexPoints[indexPoints.length - 2];

  for (const route of ROUTES) {
    const routeObs = byRoute.get(route.id) ?? [];
    if (routeObs.length === 0) continue;

    const fares = routeObs.map((o) => o.totalFare);
    const avg = fares.reduce((s, v) => s + v, 0) / fares.length;
    const med = median(fares);
    const min = Math.min(...fares);
    const max = Math.max(...fares);
    const vol = stdDev(fares);

    // Route index relative to base
    const monthly = routeMonthlyAverages(route.id);
    const base = monthly.get(BASE_MONTH) ?? avg;
    const latestMonth = [...monthly.keys()].sort().pop()!;
    const latest = monthly.get(latestMonth) ?? avg;
    const index = base > 0 ? (latest / base) * 100 : 100;

    // MoM: compare last two months
    const sortedMonths = [...monthly.keys()].sort();
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const prevMonth = sortedMonths[sortedMonths.length - 2];
    const lastVal = monthly.get(lastMonth) ?? 0;
    const prevVal = monthly.get(prevMonth) ?? 0;
    const mom = prevVal > 0 ? ((lastVal - prevVal) / prevVal) * 100 : 0;

    // YoY: not enough data for real YoY, approximate with Jan vs Aug
    const janVal = monthly.get(BASE_MONTH) ?? 0;
    const yoy = janVal > 0 ? ((lastVal - janVal) / janVal) * 100 : 0;

    const trend: 'up' | 'down' | 'stable' = mom > 1.5 ? 'up' : mom < -1.5 ? 'down' : 'stable';
    const risk: 'high' | 'medium' | 'low' =
      Math.abs(mom) > 8 ? 'high' : Math.abs(mom) > 3 ? 'medium' : 'low';

    stats.push({
      routeId: route.id,
      origin: route.origin,
      destination: route.destination,
      averageFare: Math.round(avg),
      medianFare: Math.round(med),
      minFare: Math.round(min),
      maxFare: Math.round(max),
      index: Math.round(index * 10) / 10,
      momChange: Math.round(mom * 100) / 100,
      yoyChange: Math.round(yoy * 100) / 100,
      observations: routeObs.length,
      volatility: Math.round(vol),
      trend,
      risk,
    });
  }

  // Sort by weight (importance)
  stats.sort((a, b) => (ROUTE_MAP[a.routeId].weight > ROUTE_MAP[b.routeId].weight ? -1 : 1));

  void lastPoint;
  void prevPoint;
  return stats;
}

export function computeAirlineStats(): AirlineStats[] {
  const obs = getValidObservations();
  const byAirline = new Map<string, Observation[]>();

  for (const o of obs) {
    if (!byAirline.has(o.airline)) byAirline.set(o.airline, []);
    byAirline.get(o.airline)!.push(o);
  }

  const stats: AirlineStats[] = [];
  for (const airline of AIRLINES) {
    const aObs = byAirline.get(airline.code) ?? [];
    if (aObs.length === 0) continue;

    const fares = aObs.map((o) => o.totalFare);
    const avg = fares.reduce((s, v) => s + v, 0) / fares.length;
    const med = median(fares);
    const min = Math.min(...fares);
    const max = Math.max(...fares);
    const vol = stdDev(fares);

    // Average index: each observation's route index
    const routeStats = computeRouteStats();
    const routeIndexMap = new Map(routeStats.map((r) => [r.routeId, r.index]));
    let indexSum = 0;
    let indexCount = 0;
    for (const o of aObs) {
      const ri = routeIndexMap.get(`${o.origin}-${o.destination}`);
      if (ri) {
        indexSum += ri;
        indexCount++;
      }
    }

    stats.push({
      code: airline.code,
      name: airline.name,
      averageFare: Math.round(avg),
      medianFare: Math.round(med),
      minFare: Math.round(min),
      maxFare: Math.round(max),
      volatility: Math.round(vol),
      observations: aObs.length,
      averageIndex: indexCount > 0 ? Math.round((indexSum / indexCount) * 10) / 10 : 100,
      color: airline.color,
    });
  }

  return stats;
}

export function computeBookingWindowStats(
  filters?: { origin?: string; destination?: string; airline?: string },
): BookingWindowStat[] {
  let obs = getValidObservations();
  if (filters) {
    obs = filterObservations(obs, filters);
  }

  const byWindow = new Map<number, number[]>();
  for (const o of obs) {
    if (!byWindow.has(o.bookingWindow)) byWindow.set(o.bookingWindow, []);
    byWindow.get(o.bookingWindow)!.push(o.totalFare);
  }

  const windows = [45, 30, 15, 7, 1];
  return windows.map((w) => {
    const fares = byWindow.get(w) ?? [];
    const avg = fares.length > 0 ? fares.reduce((s, v) => s + v, 0) / fares.length : 0;
    return {
      window: w,
      label: `T+${w}`,
      averageFare: Math.round(avg),
      observations: fares.length,
    };
  });
}

export function computeAlerts(): AlertItem[] {
  const alerts: AlertItem[] = [];
  const routeStats = computeRouteStats();
  const indexPoints = computeIndex();
  const latestIndex = indexPoints[indexPoints.length - 1];

  for (const rs of routeStats) {
    const routeLabel = `${getAirportLabel(rs.origin)} → ${getAirportLabel(rs.destination)}`;
    if (rs.momChange > 10) {
      alerts.push({
        id: `alert-${rs.routeId}-spike`,
        type: 'price_spike',
        severity: 'high',
        route: `${rs.origin}-${rs.destination}`,
        message: `${routeLabel} average airfare increased ${rs.momChange.toFixed(1)}% this month.`,
        date: '2026-08-26',
      });
    } else if (rs.momChange > 5) {
      alerts.push({
        id: `alert-${rs.routeId}-moderate`,
        type: 'price_spike',
        severity: 'medium',
        route: `${rs.origin}-${rs.destination}`,
        message: `${routeLabel} recorded a moderate price increase of ${rs.momChange.toFixed(1)}%.`,
        date: '2026-08-26',
      });
    } else if (rs.momChange < -5) {
      alerts.push({
        id: `alert-${rs.routeId}-drop`,
        type: 'price_drop',
        severity: rs.momChange < -10 ? 'medium' : 'low',
        route: `${rs.origin}-${rs.destination}`,
        message: `${routeLabel} airfare decreased ${Math.abs(rs.momChange).toFixed(1)}%.`,
        date: '2026-08-26',
      });
    }

    if (rs.volatility > 2500) {
      alerts.push({
        id: `alert-${rs.routeId}-vol`,
        type: 'volatility',
        severity: 'medium',
        route: `${rs.origin}-${rs.destination}`,
        message: `${routeLabel} shows high price volatility (₹${rs.volatility.toLocaleString('en-IN')} std dev).`,
        date: '2026-08-26',
      });
    }
  }

  if (latestIndex && latestIndex.indexValue > 110) {
    alerts.push({
      id: 'alert-index-threshold',
      type: 'index_threshold',
      severity: 'high',
      route: 'National',
      message: `Airfare Index crossed 110 (current: ${latestIndex.indexValue}).`,
      date: '2026-08-26',
    });
  }

  // Sort by severity
  const sevOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);

  return alerts;
}

export function computeInsights(): Insight[] {
  const insights: Insight[] = [];
  const indexPoints = computeIndex();
  const routeStats = computeRouteStats();
  const airlineStats = computeAirlineStats();
  const bwStats = computeBookingWindowStats();

  const latestIndex = indexPoints[indexPoints.length - 1];
  if (latestIndex) {
    const aboveBase = latestIndex.indexValue - 100;
    insights.push({
      id: 'ins-index',
      text: `Domestic airfare levels are ${aboveBase.toFixed(1)}% above the January 2026 base period (index: ${latestIndex.indexValue}).`,
      category: 'index',
    });
  }

  const topIncrease = [...routeStats].sort((a, b) => b.momChange - a.momChange)[0];
  if (topIncrease) {
    insights.push({
      id: 'ins-route-up',
      text: `${getAirportLabel(topIncrease.origin)} → ${getAirportLabel(topIncrease.destination)} shows the highest monthly increase (+${topIncrease.momChange.toFixed(1)}%) among monitored routes.`,
      category: 'route',
    });
  }

  const topDecrease = [...routeStats].sort((a, b) => a.momChange - b.momChange)[0];
  if (topDecrease && topDecrease.momChange < 0) {
    insights.push({
      id: 'ins-route-down',
      text: `${getAirportLabel(topDecrease.origin)} → ${getAirportLabel(topDecrease.destination)} recorded the largest monthly decrease (${topDecrease.momChange.toFixed(1)}%).`,
      category: 'route',
    });
  }

  if (bwStats.length >= 2) {
    const t45 = bwStats.find((b) => b.window === 45);
    const t1 = bwStats.find((b) => b.window === 1);
    if (t45 && t1 && t45.averageFare > 0) {
      const diff = ((t1.averageFare - t45.averageFare) / t45.averageFare) * 100;
      insights.push({
        id: 'ins-bw',
        text: `Average fares are ${diff.toFixed(0)}% higher within 1 day of departure compared to 45 days out (₹${t1.averageFare.toLocaleString('en-IN')} vs ₹${t45.averageFare.toLocaleString('en-IN')}).`,
        category: 'booking',
      });
    }
  }

  const mostVolatile = [...routeStats].sort((a, b) => b.volatility - a.volatility)[0];
  if (mostVolatile) {
    insights.push({
      id: 'ins-vol',
      text: `${getAirportLabel(mostVolatile.origin)} → ${getAirportLabel(mostVolatile.destination)} is the most volatile route (std dev: ₹${mostVolatile.volatility.toLocaleString('en-IN')}), indicating larger fare fluctuations.`,
      category: 'volatility',
    });
  }

  const cheapestAirline = [...airlineStats].sort((a, b) => a.averageFare - b.averageFare)[0];
  const priciestAirline = [...airlineStats].sort((a, b) => b.averageFare - a.averageFare)[0];
  if (cheapestAirline && priciestAirline) {
    insights.push({
      id: 'ins-airline',
      text: `${cheapestAirline.name} offers the lowest average fares (₹${cheapestAirline.averageFare.toLocaleString('en-IN')}), while ${priciestAirline.name} has the highest (₹${priciestAirline.averageFare.toLocaleString('en-IN')}).`,
      category: 'airline',
    });
  }

  return insights;
}

export function computePipelineStats(): PipelineStats {
  const all = getObservations();
  const valid = all.filter((o) => o.status === 'valid').length;
  const duplicates = all.filter((o) => o.status === 'duplicate').length;
  const invalid = all.filter((o) => o.status === 'invalid').length;
  const dataQuality = (valid / all.length) * 100;

  return {
    recordsCollected: all.length,
    recordsProcessed: all.length,
    duplicatesRemoved: duplicates,
    invalidRecords: invalid,
    validObservations: valid,
    lastUpdate: '2026-08-26T12:00:00',
    dataQuality: Math.round(dataQuality * 10) / 10,
  };
}

export function getRouteTrend(routeId: string): { date: string; fare: number; label: string }[] {
  const route = ROUTE_MAP[routeId];
  if (!route) return [];
  const obs = getValidObservations().filter(
    (o) => o.origin === route.origin && o.destination === route.destination,
  );

  const byMonth = new Map<string, number[]>();
  for (const o of obs) {
    const key = getMonthKey(o.travelDate);
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(o.totalFare);
  }

  return [...byMonth.keys()].sort().map((key) => ({
    date: key,
    fare: Math.round(byMonth.get(key)!.reduce((s, v) => s + v, 0) / byMonth.get(key)!.length),
    label: monthLabel(key),
  }));
}

export function getRouteDailyTrend(routeId: string): { date: string; fare: number }[] {
  const route = ROUTE_MAP[routeId];
  if (!route) return [];
  const obs = getValidObservations().filter(
    (o) => o.origin === route.origin && o.destination === route.destination,
  );

  const byDate = new Map<string, number[]>();
  for (const o of obs) {
    if (!byDate.has(o.travelDate)) byDate.set(o.travelDate, []);
    byDate.get(o.travelDate)!.push(o.totalFare);
  }

  return [...byDate.keys()].sort().map((key) => ({
    date: key,
    fare: Math.round(byDate.get(key)!.reduce((s, v) => s + v, 0) / byDate.get(key)!.length),
  }));
}

export function getRouteAirlineComparison(routeId: string): { airline: string; name: string; color: string; avgFare: number }[] {
  const route = ROUTE_MAP[routeId];
  if (!route) return [];
  const obs = getValidObservations().filter(
    (o) => o.origin === route.origin && o.destination === route.destination,
  );

  const byAirline = new Map<string, number[]>();
  for (const o of obs) {
    if (!byAirline.has(o.airline)) byAirline.set(o.airline, []);
    byAirline.get(o.airline)!.push(o.totalFare);
  }

  return AIRLINES.map((a) => {
    const fares = byAirline.get(a.code) ?? [];
    const avg = fares.length > 0 ? fares.reduce((s, v) => s + v, 0) / fares.length : 0;
    return {
      airline: a.code,
      name: a.name,
      color: a.color,
      avgFare: Math.round(avg),
    };
  }).filter((x) => x.avgFare > 0);
}

export function getRouteBookingWindow(routeId: string): BookingWindowStat[] {
  const route = ROUTE_MAP[routeId];
  if (!route) return [];
  return computeBookingWindowStats({ origin: route.origin, destination: route.destination });
}

export { AIRLINE_MAP, AIRLINES, ROUTES, ROUTE_MAP, TOTAL_WEIGHT, getAirportLabel };
