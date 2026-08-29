import type { Airline } from './types';

export const AIRLINES: Airline[] = [
  { code: '6E', name: 'IndiGo', color: '#1e40af', marketShare: 0.38 },
  { code: 'AI', name: 'Air India', color: '#b91c1c', marketShare: 0.24 },
  { code: 'IX', name: 'Air India Express', color: '#ea580c', marketShare: 0.12 },
  { code: 'QP', name: 'Akasa Air', color: '#a16207', marketShare: 0.08 },
  { code: 'SG', name: 'SpiceJet', color: '#dc2626', marketShare: 0.10 },
  { code: 'UK', name: 'Vistara', color: '#6d28d9', marketShare: 0.08 },
];

export const AIRLINE_MAP: Record<string, Airline> = Object.fromEntries(
  AIRLINES.map((a) => [a.code, a]),
);
