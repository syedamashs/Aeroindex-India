import type {
  Observation,
  BookingWindow,
  TravelClass,
  ObservationStatus,
} from './types';
import { SeededRandom } from './random';
import { ROUTES } from './routes';
import { AIRLINES } from './airlines';
import { AIRPORT_MAP } from './airports';

const BOOKING_WINDOWS: BookingWindow[] = [1, 7, 15, 30, 45];
const TRAVEL_CLASSES: TravelClass[] = ['Economy', 'Premium Economy', 'Business'];
const SOURCES = ['Mock-OTA-Aggregator', 'Mock-Airline-Portal', 'Mock-GDS-Feed', 'Mock-Price-Observer'];

const BASE_DATE = new Date('2026-01-01');
const MONTHS = 8; // Jan 2026 - Aug 2026
const OBS_PER_ROUTE_PER_MONTH = 28;

const HOLIDAY_DATES = [
  '2026-01-26', // Republic Day
  '2026-03-18', // Holi
  '2026-08-15', // Independence Day
  '2026-03-28', // Ram Navami
  '2026-04-14', // Ambedkar Jayanti
  '2026-07-06', // Eid
];

function isHoliday(dateStr: string): boolean {
  return HOLIDAY_DATES.includes(dateStr);
}

function baseFareForRoute(routeId: string): number {
  const route = ROUTES.find((r) => r.id === routeId)!;
  if (route.category === 'short') return 2800;
  if (route.category === 'medium') return 4500;
  return 7500;
}

function seasonalMultiplier(monthIndex: number): number {
  // Jan=0 ... Aug=7
  const factors = [1.0, 1.024, 0.998, 1.061, 1.094, 1.112, 1.089, 1.127];
  return factors[monthIndex] ?? 1.0;
}

function bookingWindowMultiplier(bw: BookingWindow): number {
  // Closer to departure = more expensive
  const multipliers: Record<BookingWindow, number> = {
    1: 2.35,
    7: 1.78,
    15: 1.42,
    30: 1.12,
    45: 1.0,
  };
  return multipliers[bw];
}

function travelClassMultiplier(tc: TravelClass): number {
  if (tc === 'Economy') return 1.0;
  if (tc === 'Premium Economy') return 1.55;
  return 2.8;
}

function airlineMultiplier(airlineCode: string): number {
  const m: Record<string, number> = {
    '6E': 0.92,
    'AI': 1.08,
    'IX': 0.88,
    'QP': 0.95,
    'SG': 0.98,
    'UK': 1.12,
  };
  return m[airlineCode] ?? 1.0;
}

function dateToStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function generateObservations(seed: number): Observation[] {
  const rng = new SeededRandom(seed);
  const observations: Observation[] = [];
  let obsCounter = 0;

  for (const route of ROUTES) {
    const baseFare = baseFareForRoute(route.id);

    for (let m = 0; m < MONTHS; m++) {
      for (let i = 0; i < OBS_PER_ROUTE_PER_MONTH; i++) {
        const airline = rng.pick(AIRLINES);
        const bw = rng.pick(BOOKING_WINDOWS);
        const tc = rng.pick(TRAVEL_CLASSES);

        // Travel date: random day in this month
        const travelDate = new Date(BASE_DATE.getFullYear(), BASE_DATE.getMonth() + m, rng.int(1, 28));
        const travelDateStr = dateToStr(travelDate);
        const dayOfWeek = travelDate.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Collection date: travel date minus booking window
        const collectionDate = new Date(travelDate);
        collectionDate.setDate(collectionDate.getDate() - bw);
        const collectionDateStr = dateToStr(collectionDate);

        // Compute fare
        let fare =
          baseFare *
          seasonalMultiplier(m) *
          bookingWindowMultiplier(bw) *
          travelClassMultiplier(tc) *
          airlineMultiplier(airline.code);

        if (isWeekend) fare *= 1.18;
        if (isHoliday(travelDateStr)) fare *= 1.35;

        fare *= rng.gaussian(1.0, 0.06);
        fare = Math.max(1200, fare);

        const baseFarePortion = fare * 0.78;
        const taxes = fare * 0.15;
        const fees = fare * 0.07;
        const totalFare = baseFarePortion + taxes + fees;

        // ~3% invalid, ~2% duplicate
        let status: ObservationStatus = 'valid';
        const r = rng.next();
        if (r < 0.03) status = 'invalid';
        else if (r < 0.05) status = 'duplicate';

        observations.push({
          id: `OBS-${String(obsCounter).padStart(6, '0')}`,
          collectionDate: collectionDateStr,
          origin: route.origin,
          destination: route.destination,
          airline: airline.code,
          travelDate: travelDateStr,
          bookingWindow: bw,
          travelClass: tc,
          baseFare: Math.round(baseFarePortion),
          taxes: Math.round(taxes),
          fees: Math.round(fees),
          totalFare: Math.round(totalFare),
          currency: 'INR',
          source: rng.pick(SOURCES),
          status,
        });
        obsCounter++;
      }
    }
  }

  return observations;
}

const DEFAULT_SEED = 26056;
let _observations: Observation[] | null = null;
let _currentSeed = DEFAULT_SEED;

export function getObservations(): Observation[] {
  if (!_observations) {
    _observations = generateObservations(DEFAULT_SEED);
  }
  return _observations;
}

export function regenerateWithSeed(seed: number): Observation[] {
  _currentSeed = seed;
  _observations = generateObservations(seed);
  return _observations;
}

export function getCurrentSeed(): number {
  return _currentSeed;
}

export function appendNewObservations(count: number): Observation[] {
  const rng = new SeededRandom(Date.now() % 1000000);
  const existing = getObservations();
  const newObs: Observation[] = [];
  let counter = existing.length;

  for (let i = 0; i < count; i++) {
    const route = rng.pick(ROUTES);
    const airline = rng.pick(AIRLINES);
    const bw = rng.pick(BOOKING_WINDOWS);
    const tc = rng.pick(TRAVEL_CLASSES);

    const travelDate = new Date();
    travelDate.setDate(travelDate.getDate() + rng.int(1, 45));
    const travelDateStr = dateToStr(travelDate);
    const dayOfWeek = travelDate.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const collectionDateStr = dateToStr(new Date());

    const monthIndex = 7; // Aug
    let fare =
      baseFareForRoute(route.id) *
      seasonalMultiplier(monthIndex) *
      bookingWindowMultiplier(bw) *
      travelClassMultiplier(tc) *
      airlineMultiplier(airline.code);

    if (isWeekend) fare *= 1.18;
    if (isHoliday(travelDateStr)) fare *= 1.35;
    fare *= rng.gaussian(1.0, 0.06);
    fare = Math.max(1200, fare);

    const baseFarePortion = fare * 0.78;
    const taxes = fare * 0.15;
    const fees = fare * 0.07;
    const totalFare = baseFarePortion + taxes + fees;

    newObs.push({
      id: `OBS-${String(counter).padStart(6, '0')}`,
      collectionDate: collectionDateStr,
      origin: route.origin,
      destination: route.destination,
      airline: airline.code,
      travelDate: travelDateStr,
      bookingWindow: bw,
      travelClass: tc,
      baseFare: Math.round(baseFarePortion),
      taxes: Math.round(taxes),
      fees: Math.round(fees),
      totalFare: Math.round(totalFare),
      currency: 'INR',
      source: rng.pick(SOURCES),
      status: 'valid',
    });
    counter++;
  }

  _observations = [...existing, ...newObs];
  return newObs;
}

export function getAirportLabel(code: string): string {
  return AIRPORT_MAP[code]?.city ?? code;
}

export { DEFAULT_SEED };
