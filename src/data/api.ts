import type {
  IndexPoint,
  RouteStats,
  AirlineStats,
  BookingWindowStat,
  AlertItem,
  Insight,
  PipelineStats,
  Observation,
} from './types';
import {
  computeIndex,
  computeRouteStats,
  computeAirlineStats,
  computeBookingWindowStats,
  computeAlerts,
  computeInsights,
  computePipelineStats,
  getValidObservations,
  filterObservations,
} from './analytics';
import { getObservations } from './generator';
import { ROUTES, ROUTE_MAP } from './routes';
import { AIRLINES } from './airlines';
import { AIRPORTS } from './airports';

export interface ApiResponse<T> {
  data: T;
  meta?: Record<string, unknown>;
}

export const api = {
  '/api/index': (): ApiResponse<IndexPoint[]> => ({ data: computeIndex() }),
  '/api/index/trend': (): ApiResponse<IndexPoint[]> => ({ data: computeIndex() }),
  '/api/routes': (): ApiResponse<RouteStats[]> => ({ data: computeRouteStats() }),
  '/api/routes/:route': (routeId: string): ApiResponse<RouteStats | null> => ({
    data: computeRouteStats().find((r) => r.routeId === routeId) ?? null,
  }),
  '/api/airlines': (): ApiResponse<AirlineStats[]> => ({ data: computeAirlineStats() }),
  '/api/airlines/:airline': (code: string): ApiResponse<AirlineStats | null> => ({
    data: computeAirlineStats().find((a) => a.code === code) ?? null,
  }),
  '/api/booking-window': (): ApiResponse<BookingWindowStat[]> => ({ data: computeBookingWindowStats() }),
  '/api/observations': (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    origin?: string;
    destination?: string;
    airline?: string;
    status?: string;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
  }): ApiResponse<{ rows: Observation[]; total: number; page: number; pageSize: number }> => {
    let rows = getObservations();
    const total = rows.length;

    if (params?.origin && params.origin !== 'all') rows = rows.filter((o) => o.origin === params.origin);
    if (params?.destination && params.destination !== 'all') rows = rows.filter((o) => o.destination === params.destination);
    if (params?.airline && params.airline !== 'all') rows = rows.filter((o) => o.airline === params.airline);
    if (params?.status && params.status !== 'all') rows = rows.filter((o) => o.status === params.status);
    if (params?.search) {
      const q = params.search.toLowerCase();
      rows = rows.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.origin.toLowerCase().includes(q) ||
          o.destination.toLowerCase().includes(q) ||
          o.airline.toLowerCase().includes(q),
      );
    }

    if (params?.sortBy) {
      const dir = params.sortDir === 'desc' ? -1 : 1;
      rows = [...rows].sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[params.sortBy!];
        const bv = (b as unknown as Record<string, unknown>)[params.sortBy!];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    }

    const page = params?.page ?? 1;
    const pageSize = params?.pageSize ?? 20;
    const start = (page - 1) * pageSize;
    const paged = rows.slice(start, start + pageSize);

    return { data: { rows: paged, total: rows.length, page, pageSize } };
  },
  '/api/alerts': (): ApiResponse<AlertItem[]> => ({ data: computeAlerts() }),
  '/api/insights': (): ApiResponse<Insight[]> => ({ data: computeInsights() }),
  '/api/map': (): ApiResponse<{
    airports: typeof AIRPORTS;
    routes: { id: string; origin: string; destination: string; avgFare: number; index: number; momChange: number; observations: number; trend: string }[];
  }> => {
    const stats = computeRouteStats();
    return {
      data: {
        airports: AIRPORTS,
        routes: stats.map((s) => ({
          id: s.routeId,
          origin: s.origin,
          destination: s.destination,
          avgFare: s.averageFare,
          index: s.index,
          momChange: s.momChange,
          observations: s.observations,
          trend: s.trend,
        })),
      },
    };
  },
  '/api/statistics': (): ApiResponse<{
    index: number;
    momChange: number;
    routesMonitored: number;
    airlinesMonitored: number;
    totalObservations: number;
    highPriceRoutes: number;
    dataFreshness: string;
    dataQuality: number;
  }> => {
    const indexPoints = computeIndex();
    const latest = indexPoints[indexPoints.length - 1];
    const routeStats = computeRouteStats();
    const pipeline = computePipelineStats();
    const highPriceRoutes = routeStats.filter((r) => r.momChange > 5).length;

    return {
      data: {
        index: latest?.indexValue ?? 100,
        momChange: latest?.percentageChange ?? 0,
        routesMonitored: ROUTES.length,
        airlinesMonitored: AIRLINES.length,
        totalObservations: getObservations().length,
        highPriceRoutes,
        dataFreshness: '12 minutes ago',
        dataQuality: pipeline.dataQuality,
      },
    };
  },
};

export type ApiEndpoints = typeof api;
