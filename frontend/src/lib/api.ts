const API_BASE = import.meta.env.VITE_API_BASE ?? '';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message || 'Request failed');
  }

  return (await response.json()) as T;
}

export async function apiLogin(email: string, password: string) {
  return request<{ user: { role: string; name: string; email: string }; token: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function apiHealth() {
  return request<{ ok: boolean; service: string; timestamp: string }>('/api/health');
}

export async function apiRunScheduler(options: { airlines: string[]; leadTimes: number[]; routes: string[] }) {
  return request<{
    message: string;
    schedulerSucceeded: boolean;
    uploadCompleted: boolean;
    observationsBefore: number;
    observationsAfter: number;
    observationsInserted: number;
  }>('/api/scheduler/run', { method: 'POST', body: JSON.stringify(options) });
}

export interface SchedulerTaskStatus {
  task_id: string;
  run_id: string;
  route_id: string;
  source: string;
  origin: string;
  destination: string;
  departure_date: string;
  target_lead_days: number;
  actual_lead_days: number | null;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'SKIPPED';
  started_at: string | null;
  completed_at: string | null;
  error_type: string | null;
  error_message: string | null;
}

export async function apiSchedulerStatus() {
  return request<{ runId: string | null; status: string | null; tasks: SchedulerTaskStatus[] }>('/api/scheduler/progress');
}

export interface ApiFilters {
  origin?: string;
  destination?: string;
  airline?: string;
  travelClass?: string;
  bookingWindow?: string;
  status?: string;
  search?: string;
  preset?: string;
  customStart?: string;
  customEnd?: string;
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  groupBy?: 'airline' | 'source';
}

export interface ApiRouteStats {
  routeId: string;
  origin: string;
  destination: string;
  averageFare: number;
  medianFare: number;
  minFare: number;
  maxFare: number;
  index: number;
  momChange: number;
  yoyChange: number;
  observations: number;
  volatility: number;
  trend: string;
  risk: string;
  distanceKm: number;
  category: string;
  weight: number;
}

export interface ApiObservation {
  id: string;
  collectionDate: string;
  origin: string;
  destination: string;
  airline: string;
  travelDate: string;
  bookingWindow: number;
  travelClass: string;
  baseFare: number;
  taxes: number;
  fees: number;
  totalFare: number;
  currency: string;
  source: string;
  status: string;
}

function buildQueryString(params: ApiFilters): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.append(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export async function apiIndex(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: Array<{ period: string; indexValue: number; percentageChange: number; averageFare: number; monthLabel: string }> }>(`/api/index${qs}`);
}

export async function apiRoutes(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: ApiRouteStats[] }>(`/api/routes${qs}`);
}

export async function apiRouteDetail(routeId: string, filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: { route: ApiRouteStats | null; observations: ApiObservation[] } }>(`/api/routes/${encodeURIComponent(routeId)}${qs}`);
}

export async function apiAirlines(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: Array<{ code: string; name: string; averageFare: number; medianFare: number; minFare: number; maxFare: number; volatility: number; observations: number; averageIndex: number; color: string; marketShare?: number }> }>(`/api/airlines${qs}`);
}

export async function apiBookingWindow(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: Array<{ window: number; label: string; averageFare: number; observations: number }> }>(`/api/booking-window${qs}`);
}

export async function apiObservations(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: { rows: ApiObservation[]; total: number; page: number; pageSize: number } }>(`/api/observations${qs}`);
}

export async function apiAlerts(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: Array<{ id: string; type: string; severity: string; route: string; message: string; date: string }> }>(`/api/alerts${qs}`);
}

export async function apiInsights(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: Array<{ id: string; text: string; category: string }> }>(`/api/insights${qs}`);
}

export async function apiStatistics(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: { index: number; momChange: number; routesMonitored: number; airlinesMonitored: number; otasActive?: number; totalObservations: number; highPriceRoutes: number; dataFreshness: string; dataQuality: number; minFare: number; maxFare: number; averageFare: number } }>(`/api/statistics${qs}`);
}

export async function apiDataSource() {
  return request<{ data: { name: string; path: string; readOnly: boolean; observations: string } }>('/api/data-source');
}

export async function apiFareStateSummary() {
  return request<{ data: {
    previous_run: Record<string, unknown> | null;
    current_run: Record<string, unknown> | null;
    persisted_transition_count: number;
    overall: { total_transitions: number; price_observable_transitions: number };
    transition_counts: Record<string, number>;
    fep: { percentage: number | null };
    fare_movement: {
      price_observable: Record<string, number | null>;
      price_increase: Record<string, number | null>;
      price_decrease: Record<string, number | null>;
      mean_fare_change: number | null;
      median_fare_change: number | null;
      mean_percentage_change: number | null;
      median_percentage_change: number | null;
    };
    by_source: Array<Record<string, unknown>>;
    by_route: Array<Record<string, unknown>>;
    by_lead_time: Array<Record<string, unknown>>;
    by_source_lead_time: Array<Record<string, unknown>>;
    data_quality: Record<string, number>;
    mode: string;
  } }>('/api/fare-state/summary');
}

export async function apiDqeSummary() {
  return request<{ data: {
    total_observations: number;
    source_breakdown: Array<{ source: string; count: number }>;
    sold_observations: number;
    invalid_extraction_observations: number;
    invalid_fare_observations: number;
    duplicate_identity_groups: number;
    quality_score: number;
    mode: string;
  } }>('/api/dqe/summary');
}

export async function apiMap(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: {
    airports: Array<{ code: string; city: string; state: string; lat: number; lng: number; region: string }>;
    routes: Array<ApiRouteStats & { id: string; avgFare: number }>;
  } }>(`/api/map${qs}`);
}
