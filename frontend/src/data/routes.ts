import type { RouteDef } from './types';

interface RouteSeed {
  origin: string;
  destination: string;
  weight: number;
}

const ROUTE_SEEDS: RouteSeed[] = [
  { origin: 'DEL', destination: 'BOM', weight: 15 },
  { origin: 'DEL', destination: 'BLR', weight: 14 },
  { origin: 'MAA', destination: 'DEL', weight: 10 },
  { origin: 'BLR', destination: 'HYD', weight: 8 },
  { origin: 'BOM', destination: 'BLR', weight: 8 },
  { origin: 'DEL', destination: 'CCU', weight: 7 },
  { origin: 'BOM', destination: 'MAA', weight: 6 },
  { origin: 'DEL', destination: 'HYD', weight: 6 },
  { origin: 'BOM', destination: 'CCU', weight: 5 },
  { origin: 'BLR', destination: 'COK', weight: 5 },
  { origin: 'DEL', destination: 'PNQ', weight: 4 },
  { origin: 'DEL', destination: 'AMD', weight: 4 },
  { origin: 'BOM', destination: 'GOI', weight: 3 },
  { origin: 'BLR', destination: 'MAA', weight: 3 },
  { origin: 'DEL', destination: 'JAI', weight: 3 },
  { origin: 'DEL', destination: 'LKO', weight: 3 },
  { origin: 'BOM', destination: 'PNQ', weight: 2 },
  { origin: 'DEL', destination: 'IXC', weight: 2 },
  { origin: 'CCU', destination: 'GAU', weight: 2 },
  { origin: 'DEL', destination: 'GAU', weight: 2 },
  { origin: 'BLR', destination: 'GOI', weight: 2 },
  { origin: 'MAA', destination: 'COK', weight: 2 },
  { origin: 'DEL', destination: 'VNS', weight: 2 },
  { origin: 'CCU', destination: 'IXB', weight: 2 },
  { origin: 'BOM', destination: 'AMD', weight: 2 },
];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

function categoryFor(km: number): 'short' | 'medium' | 'long' {
  if (km < 700) return 'short';
  if (km < 1400) return 'medium';
  return 'long';
}

import { AIRPORT_MAP } from './airports';

export const ROUTES: RouteDef[] = ROUTE_SEEDS.map((r, i) => {
  const o = AIRPORT_MAP[r.origin];
  const d = AIRPORT_MAP[r.destination];
  const km = haversine(o.lat, o.lng, d.lat, d.lng);
  return {
    id: `${r.origin}-${r.destination}`,
    origin: r.origin,
    destination: r.destination,
    weight: r.weight,
    distanceKm: km,
    category: categoryFor(km),
  };
});

export const ROUTE_MAP: Record<string, RouteDef> = Object.fromEntries(
  ROUTES.map((r) => [r.id, r]),
);

export const TOTAL_WEIGHT = ROUTES.reduce((s, r) => s + r.weight, 0);
