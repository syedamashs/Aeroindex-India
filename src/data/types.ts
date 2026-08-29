export type TravelClass = 'Economy' | 'Premium Economy' | 'Business';

export type BookingWindow = 1 | 7 | 15 | 30 | 45;

export type ObservationStatus = 'valid' | 'invalid' | 'duplicate' | 'pending';

export interface Airport {
  code: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  region: 'North' | 'South' | 'East' | 'West' | 'Central' | 'North-East';
}

export interface Airline {
  code: string;
  name: string;
  color: string;
  marketShare: number;
}

export interface RouteDef {
  id: string;
  origin: string;
  destination: string;
  weight: number;
  distanceKm: number;
  category: 'short' | 'medium' | 'long';
}

export interface Observation {
  id: string;
  collectionDate: string;
  origin: string;
  destination: string;
  airline: string;
  travelDate: string;
  bookingWindow: BookingWindow;
  travelClass: TravelClass;
  baseFare: number;
  taxes: number;
  fees: number;
  totalFare: number;
  currency: string;
  source: string;
  status: ObservationStatus;
}

export interface IndexPoint {
  period: string;
  indexValue: number;
  percentageChange: number;
  averageFare: number;
  monthLabel: string;
}

export interface RouteStats {
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
  trend: 'up' | 'down' | 'stable';
  risk: 'high' | 'medium' | 'low';
}

export interface AirlineStats {
  code: string;
  name: string;
  averageFare: number;
  medianFare: number;
  minFare: number;
  maxFare: number;
  volatility: number;
  observations: number;
  averageIndex: number;
  color: string;
}

export interface BookingWindowStat {
  window: number;
  label: string;
  averageFare: number;
  observations: number;
}

export interface AlertItem {
  id: string;
  type: 'price_spike' | 'price_drop' | 'index_threshold' | 'volatility' | 'data_quality';
  severity: 'high' | 'medium' | 'low';
  route: string;
  message: string;
  date: string;
}

export interface Insight {
  id: string;
  text: string;
  category: 'index' | 'route' | 'airline' | 'booking' | 'volatility' | 'geography';
}

export interface PipelineStats {
  recordsCollected: number;
  recordsProcessed: number;
  duplicatesRemoved: number;
  invalidRecords: number;
  validObservations: number;
  lastUpdate: string;
  dataQuality: number;
}

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  module: string;
  timestamp: string;
}

export interface UserRole {
  role: 'Administrator' | 'Analyst' | 'Viewer';
  name: string;
  email: string;
}

export interface DateRange {
  start: string;
  end: string;
}

export type DatePreset = 'today' | '7d' | '30d' | '90d' | '180d' | 'custom';

export interface Filters {
  origin: string;
  destination: string;
  airline: string;
  travelClass: string;
  bookingWindow: string;
  preset: DatePreset;
  customStart: string;
  customEnd: string;
}
