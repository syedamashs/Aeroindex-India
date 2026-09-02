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
  return request<{ data: Array<{ routeId: string; origin: string; destination: string; averageFare: number; medianFare: number; minFare: number; maxFare: number; index: number; momChange: number; yoyChange: number; observations: number; volatility: number; trend: string; risk: string }> }>(`/api/routes${qs}`);
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
  return request<{ data: { rows: Array<any>; total: number; page: number; pageSize: number } }>(`/api/observations${qs}`);
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
  return request<{ data: { index: number; momChange: number; routesMonitored: number; airlinesMonitored: number; totalObservations: number; highPriceRoutes: number; dataFreshness: string; dataQuality: number } }>(`/api/statistics${qs}`);
}

export async function apiMap(filters?: ApiFilters) {
  const qs = buildQueryString(filters || {});
  return request<{ data: { airports: Array<any>; routes: Array<any> } }>(`/api/map${qs}`);
}
