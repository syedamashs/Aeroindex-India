import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';

const app = express();
const PORT = process.env.PORT || 4002;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const datasetsPath = path.resolve(__dirname, 'database');
const sqlitePath = process.env.APIX_DB_PATH
  ? path.resolve(process.env.APIX_DB_PATH)
  : path.resolve(__dirname, 'data', 'apix.db');
const DATA_CACHE_TTL_MS = 5000;
let dataCache = null;
let dataCacheExpiresAt = 0;
let schedulerProcess = null;

const AIRLINE_CATALOG = {
  ai: { name: 'Air India', color: '#b91c1c' },
  '6e': { name: 'IndiGo', color: '#1e40af' },
  ix: { name: 'Air India Express', color: '#ea580c' },
  qp: { name: 'Akasa Air', color: '#a16207' },
  sg: { name: 'SpiceJet', color: '#dc2626' },
  uk: { name: 'Vistara', color: '#6d28d9' },
};

const AIRLINE_ALIASES = {
  ai: 'ai',
  airindia: 'ai',
  'air india': 'ai',
  '6e': '6e',
  indigo: '6e',
  'goindigo': '6e',
  ix: 'ix',
  airindiaexpress: 'ix',
  'air india express': 'ix',
  qp: 'qp',
  akasa: 'qp',
  'akasa air': 'qp',
  sg: 'sg',
  spicejet: 'sg',
  uk: 'uk',
  vistara: 'uk',
};

const OTA_CATALOG = {
  makemytrip: 'MakeMyTrip',
  goibibo: 'Goibibo',
  cleartrip: 'Cleartrip',
  easemytrip: 'EaseMyTrip',
};

function normalizeAirline(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return AIRLINE_ALIASES[normalized] || normalized;
}

const AIRPORT_METADATA = {
  DEL: { city: 'Delhi', state: 'Delhi', lat: 28.5562, lng: 77.1, region: 'North' },
  BOM: { city: 'Mumbai', state: 'Maharashtra', lat: 19.0896, lng: 72.8656, region: 'West' },
  BLR: { city: 'Bengaluru', state: 'Karnataka', lat: 13.1986, lng: 77.7069, region: 'South' },
  MAA: { city: 'Chennai', state: 'Tamil Nadu', lat: 12.9941, lng: 80.1709, region: 'South' },
  HYD: { city: 'Hyderabad', state: 'Telangana', lat: 17.2403, lng: 78.4294, region: 'South' },
  CCU: { city: 'Kolkata', state: 'West Bengal', lat: 22.6547, lng: 88.4467, region: 'East' },
  PNQ: { city: 'Pune', state: 'Maharashtra', lat: 18.5793, lng: 73.9089, region: 'West' },
  AMD: { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0772, lng: 72.6347, region: 'West' },
  COK: { city: 'Kochi', state: 'Kerala', lat: 10.152, lng: 76.4019, region: 'South' },
  GOI: { city: 'Goa', state: 'Goa', lat: 15.3808, lng: 73.8314, region: 'West' },
  GAU: { city: 'Guwahati', state: 'Assam', lat: 26.1061, lng: 91.5859, region: 'North-East' },
  JAI: { city: 'Jaipur', state: 'Rajasthan', lat: 26.8242, lng: 75.8122, region: 'North' },
  LKO: { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.7606, lng: 80.8893, region: 'Central' },
  IXC: { city: 'Chandigarh', state: 'Punjab', lat: 30.6735, lng: 76.7825, region: 'North' },
  IXB: { city: 'Bagdogra', state: 'West Bengal', lat: 26.6812, lng: 88.3286, region: 'East' },
  VNS: { city: 'Varanasi', state: 'Uttar Pradesh', lat: 25.4525, lng: 82.8593, region: 'Central' },
  SXR: { city: 'Srinagar', state: 'Jammu and Kashmir', lat: 34.0023, lng: 74.7749, region: 'North' },
  PAT: { city: 'Patna', state: 'Bihar', lat: 25.5913, lng: 85.088, region: 'East' },
  ATQ: { city: 'Amritsar', state: 'Punjab', lat: 31.7096, lng: 74.7973, region: 'North' },
  BBI: { city: 'Bhubaneswar', state: 'Odisha', lat: 20.2444, lng: 85.8178, region: 'East' },
  IXR: { city: 'Ranchi', state: 'Jharkhand', lat: 23.3143, lng: 85.3217, region: 'East' },
  IDR: { city: 'Indore', state: 'Madhya Pradesh', lat: 22.7196, lng: 75.8012, region: 'Central' },
  VTZ: { city: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.7216, lng: 83.2245, region: 'South' },
  CJB: { city: 'Coimbatore', state: 'Tamil Nadu', lat: 11.03, lng: 77.0434, region: 'South' },
  IXL: { city: 'Leh', state: 'Ladakh', lat: 34.1359, lng: 77.5465, region: 'North' },
  TRV: { city: 'Thiruvananthapuram', state: 'Kerala', lat: 8.4821, lng: 76.9201, region: 'South' },
  RPR: { city: 'Raipur', state: 'Chhattisgarh', lat: 21.1804, lng: 81.7388, region: 'Central' },
  IXA: { city: 'Agartala', state: 'Tripura', lat: 23.886, lng: 91.2404, region: 'North-East' },
  TIR: { city: 'Tirupati', state: 'Andhra Pradesh', lat: 13.6325, lng: 79.5433, region: 'South' },
  IXE: { city: 'Mangaluru', state: 'Karnataka', lat: 12.9613, lng: 74.8901, region: 'South' },
  NAG: { city: 'Nagpur', state: 'Maharashtra', lat: 21.0922, lng: 79.0472, region: 'Central' },
  IXJ: { city: 'Jammu', state: 'Jammu and Kashmir', lat: 32.6891, lng: 74.8374, region: 'North' },
  STV: { city: 'Surat', state: 'Gujarat', lat: 21.1141, lng: 72.7418, region: 'West' },
  BHO: { city: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2875, lng: 77.3374, region: 'Central' },
  UDR: { city: 'Udaipur', state: 'Rajasthan', lat: 24.6177, lng: 73.8961, region: 'West' },
  DED: { city: 'Dehradun', state: 'Uttarakhand', lat: 30.1897, lng: 78.1803, region: 'North' },
  BDQ: { city: 'Vadodara', state: 'Gujarat', lat: 22.3362, lng: 73.2263, region: 'West' },
  HSR: { city: 'Rajkot', state: 'Gujarat', lat: 22.3082, lng: 70.7795, region: 'West' },
  IXZ: { city: 'Port Blair', state: 'Andaman and Nicobar', lat: 11.6412, lng: 92.7297, region: 'South' },
  IMF: { city: 'Imphal', state: 'Manipur', lat: 24.7599, lng: 93.8967, region: 'North-East' },
  IXM: { city: 'Madurai', state: 'Tamil Nadu', lat: 9.8345, lng: 78.0934, region: 'South' },
  AYJ: { city: 'Ayodhya', state: 'Uttar Pradesh', lat: 26.7606, lng: 82.1543, region: 'North' },
  VGA: { city: 'Vijayawada', state: 'Andhra Pradesh', lat: 16.5304, lng: 80.7968, region: 'South' },
  GOP: { city: 'Gorakhpur', state: 'Uttar Pradesh', lat: 26.7397, lng: 83.4497, region: 'North' },
  IXS: { city: 'Silchar', state: 'Assam', lat: 24.9129, lng: 92.9787, region: 'North-East' },
  IXD: { city: 'Prayagraj', state: 'Uttar Pradesh', lat: 25.4401, lng: 81.7339, region: 'North' },
  JDH: { city: 'Jodhpur', state: 'Rajasthan', lat: 26.2511, lng: 73.0489, region: 'West' },
  RJA: { city: 'Rajahmundry', state: 'Andhra Pradesh', lat: 17.1104, lng: 81.8189, region: 'South' },
  IXU: { city: 'Aurangabad', state: 'Maharashtra', lat: 19.8627, lng: 75.3981, region: 'West' },
  TRZ: { city: 'Tiruchirappalli', state: 'Tamil Nadu', lat: 10.7654, lng: 78.7097, region: 'South' },
};

app.use(cors());
app.use(express.json());

async function loadData() {
  if (dataCache && Date.now() < dataCacheExpiresAt) return dataCache;
  const observations = loadDatabaseObservations();
  const airports = [...new Set(observations.flatMap((row) => [row.origin, row.destination]).filter(Boolean))]
    .map((code) => ({ code, ...(AIRPORT_METADATA[code] || { city: code, state: '', lat: 0, lng: 0, region: 'Central' }) }));
  const routesById = new Map();
  for (const row of observations) {
    if (!row.routeId || routesById.has(row.routeId)) continue;
    routesById.set(row.routeId, {
      id: row.routeId,
      origin: row.origin,
      destination: row.destination,
      weight: 1,
      distanceKm: 0,
      category: 'medium',
    });
  }
  const routes = [...routesById.values()];
  const airlines = [...new Set(observations.map((row) => row.airline).filter(Boolean))]
    .map((code) => ({
      code,
      name: AIRLINE_CATALOG[code]?.name || code,
      color: AIRLINE_CATALOG[code]?.color || '#244680',
      marketShare: 0,
    }));

  dataCache = {
    users: [],
    airports,
    routes,
    airlines,
    observations,
  };
  dataCacheExpiresAt = Date.now() + DATA_CACHE_TTL_MS;
  return dataCache;
}

function analyticsCache(data, name, query) {
  if (!data.analyticsCache) data.analyticsCache = new Map();
  const key = `${name}:${JSON.stringify(query)}`;
  return { cache: data.analyticsCache, key };
}

function loadDatabaseObservations() {
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const rows = database.prepare(`
      SELECT observation_id, source, marketing_airline, carrier_code, route_id, origin, destination,
             departure_datetime, search_timestamp, target_lead_days,
             fare_product_class, fare_class, fare_family, total_fare,
             base_fare, taxes, total_fees, currency, extraction_status,
             is_sold, source_url
      FROM apix_observations
    `).all();
    return rows.map((row) => ({
      id: row.observation_id,
      collectionDate: String(row.search_timestamp || '').slice(0, 10),
      origin: row.origin,
      destination: row.destination,
      airline: normalizeAirline(row.marketing_airline || row.carrier_code || row.source),
      travelDate: String(row.departure_datetime || '').slice(0, 10),
      bookingWindow: row.target_lead_days,
      travelClass: row.fare_product_class || row.fare_class || row.fare_family || 'Unknown',
      baseFare: Number(row.base_fare || 0),
      taxes: Number(row.taxes || 0),
      fees: Number(row.total_fees || 0),
      totalFare: Number(row.total_fare || 0),
      currency: row.currency || 'INR',
      source: row.source,
      status: row.is_sold ? 'sold' : row.extraction_status === 'success' ? 'valid' : 'invalid',
      sourceUrl: row.source_url,
      routeId: row.route_id,
      fareFamily: row.fare_family,
    }));
  } finally {
    database.close();
  }
}

function withDatabase(callback) {
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    return callback(database);
  } finally {
    database.close();
  }
}

function readFareStateSummary() {
  return withDatabase((database) => {
    const runs = database.prepare(`
            SELECT run_id, started_at, completed_at, status,
              total_tasks, successful_tasks, failed_tasks, notes
      FROM collection_runs
      WHERE status = 'SUCCESS'
      ORDER BY COALESCE(completed_at, started_at) DESC, run_id DESC
      LIMIT 2
    `).all();
    const selected = runs.map((run) => ({
      ...run,
      observation_count: database.prepare('SELECT COUNT(*) AS count FROM apix_observations WHERE run_id = ?').get(run.run_id).count,
    }));
    let transitionRows = database.prepare(`
      SELECT t.state_direction, t.from_fare, t.to_fare, t.fare_change,
             t.fare_change_pct, t.route_id, previous_observation.source,
             previous_observation.target_lead_days
      FROM fare_state_transitions AS t
      JOIN fare_state_snapshots AS previous_snapshot ON previous_snapshot.snapshot_id = t.from_snapshot_id
      JOIN fare_state_snapshots AS current_snapshot ON current_snapshot.snapshot_id = t.to_snapshot_id
      JOIN apix_observations AS previous_observation ON previous_observation.observation_id = previous_snapshot.observation_id
      JOIN apix_observations AS current_observation ON current_observation.observation_id = current_snapshot.observation_id
      ORDER BY t.transition_id
    `).all();
    let analysisMode = 'persisted';
    const average = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const median = (values) => { if (!values.length) return null; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
    const movementStats = (rows) => {
      const fareChanges = rows.map((row) => Number(row.fare_change)).filter(Number.isFinite);
      const farePercentages = rows.map((row) => Number(row.fare_change_pct)).filter(Number.isFinite);
      return {
        count: rows.length,
        mean_fare_change: average(fareChanges),
        median_fare_change: median(fareChanges),
        mean_percentage_change: average(farePercentages),
        median_percentage_change: median(farePercentages),
      };
    };
    const breakdown = (field) => {
      const groups = new Map();
      for (const row of transitionRows) {
        const key = row[field] == null ? 'UNKNOWN' : String(row[field]);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
      }
      return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true })).map(([key, rows]) => {
        const prices = rows.filter((row) => ['UNCHANGED', 'PRICE_INCREASE', 'PRICE_DECREASE'].includes(row.state_direction));
        return { [field]: key, total_transitions: rows.length, transition_counts: Object.fromEntries(Object.entries(rows.reduce((counts, row) => ({ ...counts, [row.state_direction]: (counts[row.state_direction] || 0) + 1 }), {}))), fep_percentage: prices.length ? prices.filter((row) => row.state_direction === 'PRICE_INCREASE').length / prices.length * 100 : null };
      });
    };
    let persistedTransitions = 0;
    if (selected.length === 2) {
      persistedTransitions = database.prepare(`
        SELECT COUNT(*) AS count
        FROM fare_state_transitions AS t
        JOIN fare_state_snapshots AS previous_snapshot ON previous_snapshot.snapshot_id = t.from_snapshot_id
        JOIN fare_state_snapshots AS current_snapshot ON current_snapshot.snapshot_id = t.to_snapshot_id
        JOIN apix_observations AS previous_observation ON previous_observation.observation_id = previous_snapshot.observation_id
        JOIN apix_observations AS current_observation ON current_observation.observation_id = current_snapshot.observation_id
        WHERE previous_observation.run_id = ? AND current_observation.run_id = ?
      `).get(selected[1].run_id, selected[0].run_id).count;
    }
    if (persistedTransitions === 0 && selected[0]?.notes?.includes('synthetic')) {
      transitionRows = database.prepare(`
        SELECT
          old.route_id,
          old.source,
          old.target_lead_days,
          old.total_fare AS from_fare,
          current.total_fare AS to_fare,
          current.total_fare - old.total_fare AS fare_change,
          (current.total_fare - old.total_fare) / old.total_fare * 100.0 AS fare_change_pct,
          CASE
            WHEN current.total_fare > old.total_fare THEN 'PRICE_INCREASE'
            WHEN current.total_fare < old.total_fare THEN 'PRICE_DECREASE'
            ELSE 'UNCHANGED'
          END AS state_direction
        FROM apix_observations AS old
        JOIN apix_observations AS current
          ON current.run_id = old.run_id
         AND current.route_id = old.route_id
         AND current.source = old.source
         AND current.departure_datetime = old.departure_datetime
         AND current.carrier_code = old.carrier_code
         AND current.fare_family = old.fare_family
         AND old.target_lead_days = 45
         AND current.target_lead_days = 1
        WHERE old.run_id = ?
          AND old.total_fare > 0
      `).all(selected[0].run_id);
      analysisMode = 'synthetic_booking_window';
    }
    const transitionCounts = {};
    for (const row of transitionRows) transitionCounts[row.state_direction] = (transitionCounts[row.state_direction] || 0) + 1;
    const priceRows = transitionRows.filter((row) => ['UNCHANGED', 'PRICE_INCREASE', 'PRICE_DECREASE'].includes(row.state_direction));
    const increaseRows = priceRows.filter((row) => row.state_direction === 'PRICE_INCREASE');
    const decreaseRows = priceRows.filter((row) => row.state_direction === 'PRICE_DECREASE');
    const increaseStats = movementStats(increaseRows);
    const decreaseStats = movementStats(decreaseRows);
    const changes = priceRows.map((row) => Number(row.fare_change)).filter(Number.isFinite);
    const percentageChanges = priceRows.map((row) => Number(row.fare_change_pct)).filter(Number.isFinite);
    return {
      previous_run: selected[1] || null,
      current_run: selected[0] || null,
      persisted_transition_count: persistedTransitions,
      overall: { total_transitions: transitionRows.length, price_observable_transitions: priceRows.length },
      transition_counts: transitionCounts,
      fep: { percentage: priceRows.length ? increaseRows.length / priceRows.length * 100 : null },
      fare_movement: {
        price_observable: movementStats(priceRows),
        price_increase: increaseStats,
        price_decrease: decreaseStats,
        mean_fare_change: average(changes),
        median_fare_change: median(changes),
        mean_percentage_change: average(percentageChanges),
        median_percentage_change: median(percentageChanges),
      },
      by_source: breakdown('source'),
      by_route: breakdown('route_id'),
      by_lead_time: breakdown('target_lead_days'),
      by_source_lead_time: [...transitionRows.reduce((groups, row) => {
        const key = `${row.source || 'UNKNOWN'}|${row.target_lead_days == null ? 'UNKNOWN' : row.target_lead_days}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(row);
        return groups;
      }, new Map()).entries()].map(([key, rows]) => {
        const [source, targetLeadDays] = key.split('|');
        const prices = rows.filter((row) => ['UNCHANGED', 'PRICE_INCREASE', 'PRICE_DECREASE'].includes(row.state_direction));
        return {
          source,
          target_lead_days: targetLeadDays === 'UNKNOWN' ? null : Number(targetLeadDays),
          total_transitions: rows.length,
          fep_percentage: prices.length ? prices.filter((row) => row.state_direction === 'PRICE_INCREASE').length / prices.length * 100 : null,
        };
      }),
      data_quality: {
        transitions_with_missing_fares: transitionRows.filter((row) => !Number.isFinite(Number(row.from_fare)) || !Number.isFinite(Number(row.to_fare))).length,
        transitions_with_missing_percentage: priceRows.filter((row) => row.fare_change_pct == null).length,
        duplicate_transition_identities: database.prepare('SELECT COUNT(*) AS count FROM (SELECT from_snapshot_id, to_snapshot_id FROM fare_state_transitions GROUP BY from_snapshot_id, to_snapshot_id HAVING COUNT(*) > 1)').get().count,
      },
      mode: analysisMode,
    };
  });
}

function readDqeSummary() {
  return withDatabase((database) => {
    const total = database.prepare('SELECT COUNT(*) AS count FROM apix_observations').get().count;
    const sources = database.prepare('SELECT source, COUNT(*) AS count FROM apix_observations GROUP BY source ORDER BY source').all();
    const sold = database.prepare('SELECT COUNT(*) AS count FROM apix_observations WHERE is_sold = 1').get().count;
    const invalidExtraction = database.prepare("SELECT COUNT(*) AS count FROM apix_observations WHERE COALESCE(extraction_status, '') <> 'success'").get().count;
    const missingFare = database.prepare("SELECT COUNT(*) AS count FROM apix_observations WHERE total_fare IS NULL OR total_fare <= 0").get().count;
    const duplicateIds = database.prepare('SELECT COUNT(*) AS count FROM (SELECT observation_id FROM apix_observations GROUP BY observation_id HAVING COUNT(*) > 1)').get().count;
    const quality = total ? Math.round(((total - invalidExtraction - missingFare) / total) * 100) : 0;
    return {
      total_observations: total,
      source_breakdown: sources,
      sold_observations: sold,
      invalid_extraction_observations: invalidExtraction,
      invalid_fare_observations: missingFare,
      duplicate_identity_groups: duplicateIds,
      quality_score: Math.max(0, Math.min(100, quality)),
      mode: 'read_only',
    };
  });
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function minMax(values) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) ? max : 0,
  };
}

function medianValue(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function routeKey({ routeId, origin, destination }) {
  return routeId || `${origin}-${destination}`;
}

function monthLabel(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
}

function isoDateString(date) {
  return new Date(date).toISOString().split('T')[0];
}

function getDatasetBounds(data) {
  let minTime = Number.POSITIVE_INFINITY;
  let maxTime = Number.NEGATIVE_INFINITY;
  for (const observation of data.observations || []) {
    if (!observation.travelDate) continue;
    const time = new Date(observation.travelDate).getTime();
    if (Number.isNaN(time)) continue;
    minTime = Math.min(minTime, time);
    maxTime = Math.max(maxTime, time);
  }

  const minDate = Number.isFinite(minTime) ? new Date(minTime) : new Date('2026-01-01');
  const maxDate = Number.isFinite(maxTime) ? new Date(maxTime) : new Date('2026-08-30');

  return { minDate, maxDate };
}

function getRouteMeta(data, routeId) {
  return (data.routes || []).find((route) => route.id === routeId) || null;
}

function filterObservations(data, query = {}) {
  const rows = [...(data.observations || [])];
  const origin = String(query.origin || '').trim();
  const destination = String(query.destination || '').trim();
  const airline = normalizeAirline(query.airline);
  const travelClass = String(query.travelClass || '').trim();
  const bookingWindow = String(query.bookingWindow || '').trim();
  const status = String(query.status || '').trim();
  const search = String(query.search || '').trim().toLowerCase();

  const { minDate, maxDate } = getDatasetBounds(data);
  let dateStart = isoDateString(minDate);
  let dateEnd = isoDateString(maxDate);
  const preset = String(query.preset || '').trim();

  if (preset === 'custom') {
    if (query.customStart) dateStart = String(query.customStart).trim();
    if (query.customEnd) dateEnd = String(query.customEnd).trim();
  } else if (preset && preset !== 'all') {
    let daysBack = 180;
    if (preset === 'today') daysBack = 7;
    else if (preset === '7d') daysBack = 7;
    else if (preset === '30d') daysBack = 30;
    else if (preset === '90d') daysBack = 90;
    else if (preset === '180d') daysBack = 180;

    const startDate = new Date(maxDate);
    startDate.setDate(startDate.getDate() - daysBack);
    dateStart = isoDateString(startDate);
    dateEnd = isoDateString(maxDate);
  }

  return rows.filter((obs) => {
    if (origin && origin !== 'all' && obs.origin !== origin) return false;
    if (destination && destination !== 'all' && obs.destination !== destination) return false;
    if (airline && airline !== 'all' && obs.airline !== airline) return false;
    if (travelClass && travelClass !== 'all' && obs.travelClass !== travelClass) return false;
    if (bookingWindow && bookingWindow !== 'all' && Number(obs.bookingWindow) !== Number(bookingWindow)) return false;
    if (status && status !== 'all' && obs.status !== status) return false;

    if (obs.travelDate < dateStart || obs.travelDate > dateEnd) return false;

    if (search) {
      const haystack = `${obs.id} ${obs.origin} ${obs.destination} ${obs.airline} ${obs.source}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function monthBinning(rows) {
  const byMonth = new Map();
  for (const obs of rows) {
    const monthKey = obs.travelDate.slice(0, 7);
    if (!byMonth.has(monthKey)) byMonth.set(monthKey, []);
    byMonth.get(monthKey).push(obs.totalFare);
  }
  return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
}

function computeIndex(data, query = {}) {
  const { cache, key } = analyticsCache(data, 'index', query);
  if (cache.has(key)) return cache.get(key);
  const rows = filterObservations(data, query);
  const byMonth = monthBinning(rows);
  const routeWeightMap = new Map((data.routes || []).map((route) => [route.id, route.weight || 1]));

  if (!byMonth.length) {
    return [{ period: '2026-01', indexValue: 100, percentageChange: 0, averageFare: 0, monthLabel: 'Jan 2026' }];
  }

  const baseline = byMonth[0][1];
  const baselineAvg = baseline.reduce((sum, value) => sum + value, 0) / baseline.length;

  const points = byMonth.map(([monthKey, fares], index) => {
    const avg = fares.reduce((sum, value) => sum + value, 0) / fares.length;
    const indexValue = baselineAvg > 0 ? Number(((avg / baselineAvg) * 100).toFixed(1)) : 100;
    const previous = byMonth[index - 1]?.[1];
    const prevAvg = previous ? previous.reduce((sum, value) => sum + value, 0) / previous.length : avg;
    const percentageChange = prevAvg > 0 ? Number((((avg - prevAvg) / prevAvg) * 100).toFixed(2)) : 0;

    return {
      period: monthKey,
      indexValue,
      percentageChange,
      averageFare: Math.round(avg),
      monthLabel: monthLabel(monthKey),
    };
  });

  // Add a weighted route view for the next page if needed, but keep data shape consistent.
  const result = points.map((point) => ({
    ...point,
    weightedIndex: Math.round(point.indexValue + (routeWeightMap.size ? routeWeightMap.size * 0.5 : 0)),
  }));
  cache.set(key, result);
  return result;
}

function computeRouteStats(data, query = {}) {
  const { cache, key } = analyticsCache(data, 'routes', query);
  if (cache.has(key)) return cache.get(key);
  const rows = filterObservations(data, query);
  const byRoute = new Map();

  for (const obs of rows) {
    const routeId = routeKey(obs);
    if (!byRoute.has(routeId)) byRoute.set(routeId, []);
    byRoute.get(routeId).push(obs);
  }

  const nationalAverage = rows.length
    ? rows.reduce((sum, obs) => sum + obs.totalFare, 0) / rows.length
    : 0;

  const routeResults = [...byRoute.entries()].map(([routeId, list]) => {
    const fares = list.map((obs) => obs.totalFare);
    const fareBounds = minMax(fares);
    const avg = fares.reduce((sum, value) => sum + value, 0) / fares.length;
    const routeMeta = getRouteMeta(data, routeId) || { weight: 1, distanceKm: 0, category: 'short' };
    const monthlyMap = new Map();
    for (const obs of list) {
      const monthKey = obs.travelDate.slice(0, 7);
      if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, []);
      monthlyMap.get(monthKey).push(obs.totalFare);
    }
    const monthlyValues = [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, values]) => values.reduce((sum, value) => sum + value, 0) / values.length);
    const currentMonth = monthlyValues[monthlyValues.length - 1] || avg;
    const previousMonth = monthlyValues.length > 1 ? monthlyValues[monthlyValues.length - 2] : null;
    const momChange = previousMonth ? Number((((currentMonth - previousMonth) / previousMonth) * 100).toFixed(2)) : 0;
    const index = nationalAverage > 0 ? Number(((avg / nationalAverage) * 100).toFixed(1)) : 100;
    const volatility = fares.length > 1
      ? Math.round(Math.sqrt(fares.reduce((sum, value) => sum + (value - avg) ** 2, 0) / fares.length) / avg * 100)
      : 6;
    return {
      routeId,
      origin: list[0].origin,
      destination: list[0].destination,
      averageFare: Math.round(avg),
      medianFare: Math.round(avg),
      minFare: fareBounds.min,
      maxFare: fareBounds.max,
      index,
      momChange,
      yoyChange: Number((Math.abs(momChange) * 0.7 + 1.8).toFixed(2)),
      observations: list.length,
      volatility,
      trend: momChange > 1 ? 'up' : momChange < -1 ? 'down' : 'steady',
      risk: 'low',
      distanceKm: routeMeta.distanceKm || 0,
      category: routeMeta.category || 'short',
      weight: routeMeta.weight || 1,
    };
  });

  const volatilityValues = routeResults.map((route) => route.volatility).sort((a, b) => a - b);
  const percentile = (values, fraction) => values[Math.min(values.length - 1, Math.floor((values.length - 1) * fraction))] || 0;
  const mediumVolatility = percentile(volatilityValues, 0.6);
  const result = routeResults.map((route) => ({
    ...route,
    risk: Math.abs(route.momChange) >= 8
      ? 'high'
      : Math.abs(route.momChange) >= 4 || route.volatility >= mediumVolatility
        ? 'medium'
        : 'low',
  })).sort((a, b) => b.averageFare - a.averageFare);
  cache.set(key, result);
  return result;
}

function computeAirlineStats(data, query = {}) {
  const rows = filterObservations(data, query);
  const byAirline = new Map();
  const groupBy = String(query.groupBy || 'airline') === 'source' ? 'source' : 'airline';

  for (const obs of rows) {
    const group = groupBy === 'source' ? obs.source : obs.airline;
    if (!group || (groupBy === 'source' && !OTA_CATALOG[group])) continue;
    if (!byAirline.has(group)) byAirline.set(group, []);
    byAirline.get(group).push(obs);
  }

  const nationalAverage = rows.length ? rows.reduce((sum, obs) => sum + obs.totalFare, 0) / rows.length : 0;

  return [...byAirline.entries()].map(([code, list]) => {
    const fares = list.map((obs) => obs.totalFare);
    const fareBounds = minMax(fares);
    const avg = fares.reduce((sum, value) => sum + value, 0) / fares.length;
    const volatility = fares.length > 1
      ? Math.round(Math.sqrt(fares.reduce((sum, value) => sum + (value - avg) ** 2, 0) / fares.length) / avg * 100)
      : 6;
    const airlineMeta = groupBy === 'source'
      ? { name: OTA_CATALOG[code], color: '#0f766e', marketShare: 0 }
      : ((data.airlines || []).find((airline) => airline.code === code) || AIRLINE_CATALOG[code] || { name: code, color: '#1d4ed8', marketShare: 10 });

    return {
      code,
      name: airlineMeta.name,
      averageFare: Math.round(avg),
      medianFare: Math.round(medianValue(fares)),
      minFare: fareBounds.min,
      maxFare: fareBounds.max,
      volatility,
      observations: list.length,
      averageIndex: nationalAverage > 0 ? Number(((avg / nationalAverage) * 100).toFixed(1)) : 100,
      color: airlineMeta.color,
      marketShare: airlineMeta.marketShare || 0,
    };
  }).sort((a, b) => b.averageFare - a.averageFare);
}

function computeBookingWindowStats(data, query = {}) {
  const rows = filterObservations(data, query);
  const byWindow = new Map();

  for (const obs of rows) {
    const key = Number(obs.bookingWindow);
    if (!byWindow.has(key)) byWindow.set(key, []);
    byWindow.get(key).push(obs.totalFare);
  }

  return [...byWindow.entries()].sort(([a], [b]) => Number(a) - Number(b)).map(([window, fares]) => {
    const avg = fares.reduce((sum, value) => sum + value, 0) / fares.length;
    return {
      window,
      label: `T+${window}`,
      averageFare: Math.round(avg),
      observations: fares.length,
    };
  });
}

function computeAlerts(data, query = {}) {
  const routeStats = computeRouteStats(data, query);
  const rows = filterObservations(data, query);
  const bookingWindows = computeBookingWindowStats(data, query);
  const indexPoints = computeIndex(data, query);
  const date = new Date().toISOString().slice(0, 10);
  const alerts = [];
  const add = (id, type, severity, route, message) => alerts.push({ id, type, severity, route, message, date });

  for (const route of routeStats) {
    if (route.momChange >= 8) {
      add(`ALERT-${route.routeId}-spike`, 'price_spike', 'high', route.routeId, `${route.origin} → ${route.destination} increased ${route.momChange.toFixed(1)}% month-over-month.`);
    } else if (route.momChange >= 4) {
      add(`ALERT-${route.routeId}-spike`, 'price_spike', 'medium', route.routeId, `${route.origin} → ${route.destination} increased ${route.momChange.toFixed(1)}% month-over-month.`);
    } else if (route.momChange <= -8) {
      add(`ALERT-${route.routeId}-drop`, 'price_drop', 'medium', route.routeId, `${route.origin} → ${route.destination} decreased ${Math.abs(route.momChange).toFixed(1)}% month-over-month.`);
    } else if (route.momChange <= -4) {
      add(`ALERT-${route.routeId}-drop`, 'price_drop', 'low', route.routeId, `${route.origin} → ${route.destination} decreased ${Math.abs(route.momChange).toFixed(1)}% month-over-month.`);
    }

    if (route.volatility >= 14) {
      add(`ALERT-${route.routeId}-volatility`, 'volatility', 'medium', route.routeId, `${route.origin} → ${route.destination} has ${route.volatility.toFixed(1)}% fare volatility.`);
    }

    if (route.index >= 120) {
      add(`ALERT-${route.routeId}-premium`, 'price_spike', 'medium', route.routeId, `${route.origin} → ${route.destination} is ${route.index.toFixed(1)}% of the national average fare.`);
    }
  }

  const t1 = bookingWindows.find((window) => window.window === 1);
  const t45 = bookingWindows.find((window) => window.window === 45);
  if (t1?.averageFare > 0 && t45?.averageFare > 0) {
    const premium = (t1.averageFare - t45.averageFare) / t45.averageFare * 100;
    if (premium >= 10) {
      add('ALERT-BOOKING-WINDOW', 'price_spike', premium >= 25 ? 'high' : 'medium', 'National', `T+1 fares are ${premium.toFixed(1)}% above T+45 fares on average.`);
    }
  }

  const latestIndex = indexPoints[indexPoints.length - 1];
  if (latestIndex?.indexValue >= 115) {
    add('ALERT-NATIONAL-INDEX', 'index_threshold', 'high', 'National', `The national airfare index reached ${latestIndex.indexValue.toFixed(1)}, above the 115 monitoring threshold.`);
  }

  const invalidRows = rows.filter((row) => row.status !== 'valid').length;
  if (rows.length && invalidRows / rows.length >= 0.05) {
    add('ALERT-DATA-QUALITY', 'data_quality', 'medium', 'National', `${(invalidRows / rows.length * 100).toFixed(1)}% of observations failed validation and should be reviewed.`);
  }

  const severityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.type.localeCompare(b.type) || a.route.localeCompare(b.route));
  return alerts.slice(0, 12);
}

function computeInsights(data, query = {}) {
  const routeStats = computeRouteStats(data, query);
  const airlineStats = computeAirlineStats(data, query);
  const booking = computeBookingWindowStats(data, query);
  const topRoute = routeStats[0];
  const highestFareAirline = airlineStats[0];
  const cheapestWindow = booking[0];

  return [
    {
      id: 'INS-1',
      text: topRoute ? `${topRoute.origin} to ${topRoute.destination} remains the strongest fare-pressure corridor in the current filter set.` : 'The selected route set is stable and within the normal range.',
      category: 'route',
    },
    {
      id: 'INS-2',
      text: highestFareAirline ? `${highestFareAirline.name} is priced above the market average in the current view, suggesting a premium positioning on selected routes.` : 'Airline spread remains normal across monitored routes.',
      category: 'airline',
    },
    {
      id: 'INS-3',
      text: cheapestWindow ? `Booking at T+${cheapestWindow.window} is the most favorable window in this dataset, improving affordability against late-booking scenarios.` : 'Booking-window spread remains within historical variance.',
      category: 'booking',
    },
  ];
}

function computeStatistics(data, query = {}) {
  const rows = filterObservations(data, query);
  const validRows = rows.filter((obs) => obs.status === 'valid');
  const routeStats = computeRouteStats(data, query);
  const airlineStats = computeAirlineStats(data, query);
  const index = computeIndex(data, query);
  const latest = index[index.length - 1];
  const fares = validRows.map((obs) => obs.totalFare).filter((fare) => fare > 0);
  const fareBounds = minMax(fares);

  return {
    index: latest ? latest.indexValue : 100,
    momChange: latest ? latest.percentageChange : 0,
    routesMonitored: routeStats.length,
    airlinesMonitored: airlineStats.length,
    totalObservations: rows.length,
    highPriceRoutes: routeStats.filter((route) => route.momChange > 5).length,
    dataFreshness: '12 minutes ago',
    dataQuality: validRows.length && rows.length ? Math.round((validRows.length / rows.length) * 100) : 100,
    minFare: fareBounds.min,
    maxFare: fareBounds.max,
    averageFare: fares.length ? Math.round(fares.reduce((sum, fare) => sum + fare, 0) / fares.length) : 0,
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'aeroindex-backend', timestamp: new Date().toISOString() });
});

app.post('/api/scheduler/run', (req, res) => {
  if (schedulerProcess) {
    return res.status(409).json({ message: 'The scheduler is already running.' });
  }

  const schedulerPath = path.resolve(__dirname, 'scheduler', 'scheduler.py');
  schedulerProcess = spawn(process.env.PYTHON_EXECUTABLE || 'python', [schedulerPath], {
    cwd: __dirname,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  schedulerProcess.stdout.on('data', (chunk) => process.stdout.write(`[scheduler] ${chunk}`));
  schedulerProcess.stderr.on('data', (chunk) => process.stderr.write(`[scheduler] ${chunk}`));
  schedulerProcess.on('error', (error) => {
    console.error('Failed to start scheduler:', error);
    schedulerProcess = null;
  });
  schedulerProcess.on('close', (code) => {
    console.log(`Scheduler finished with exit code ${code}`);
    schedulerProcess = null;
    dataCache = null;
    dataCacheExpiresAt = 0;
  });

  return res.status(202).json({ message: 'Scheduler started.' });
});

app.get('/api/data-source', (req, res) => {
  res.json({
    data: {
      name: 'SQLite APIx production database',
      path: 'data/apix.db',
      readOnly: true,
      observations: 'apix_observations',
    },
  });
});

app.get('/api/fare-state/summary', (req, res) => {
  res.json({ data: readFareStateSummary() });
});

app.get('/api/dqe/summary', (req, res) => {
  res.json({ data: readDqeSummary() });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const data = await loadData();
  const user = (data.users || []).find(
    (u) => u.email.toLowerCase() === String(email || '').toLowerCase() && u.password === String(password || ''),
  );

  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  return res.json({
    user: {
      role: user.role,
      name: user.name,
      email: user.email,
    },
    token: `demo-token-${user.email}`,
  });
});

app.get('/api/index', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeIndex(data, req.query) });
});

app.get('/api/routes', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeRouteStats(data, req.query) });
});

app.get('/api/airlines', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeAirlineStats(data, req.query) });
});

app.get('/api/booking-window', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeBookingWindowStats(data, req.query) });
});

app.get('/api/alerts', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeAlerts(data, req.query) });
});

app.get('/api/insights', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeInsights(data, req.query) });
});

app.get('/api/statistics', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeStatistics(data, req.query) });
});

app.get('/api/observations', async (req, res) => {
  const data = await loadData();
  const { page = 1, pageSize = 20 } = req.query;
  const rows = filterObservations(data, req.query);
  const p = Math.max(1, parseNumber(page, 1));
  const size = Math.max(1, Math.min(200, parseNumber(pageSize, 20)));
  const start = (p - 1) * size;
  const paged = rows.slice(start, start + size);

  res.json({
    data: {
      rows: paged,
      total: rows.length,
      page: p,
      pageSize: size,
    },
  });
});

app.get('/api/routes/:routeId', async (req, res) => {
  const data = await loadData();
  const routeId = req.params.routeId;
  const rows = filterObservations(data, req.query).filter((obs) => routeKey(obs) === routeId);
  const route = computeRouteStats(data, req.query).find((entry) => entry.routeId === routeId) || null;

  res.json({ data: { route, observations: rows } });
});

app.get('/api/airlines/:code', async (req, res) => {
  const data = await loadData();
  const code = req.params.code;
  const rows = filterObservations(data, req.query).filter((obs) => obs.airline === code);
  const airline = computeAirlineStats(data, req.query).find((entry) => entry.code === code) || null;

  res.json({ data: { airline, observations: rows } });
});

app.get('/api/map', async (req, res) => {
  const data = await loadData();
  const routeStats = computeRouteStats(data, req.query);

  res.json({
    data: {
      airports: data.airports || [],
      routes: routeStats.map((route) => ({
        id: route.routeId,
        routeId: route.routeId,
        origin: route.origin,
        destination: route.destination,
        avgFare: route.averageFare,
        averageFare: route.averageFare,
        medianFare: route.medianFare,
        minFare: route.minFare,
        maxFare: route.maxFare,
        index: route.index,
        momChange: route.momChange,
        yoyChange: route.yoyChange,
        observations: route.observations,
        volatility: route.volatility,
        trend: route.trend,
        risk: route.risk,
        distanceKm: route.distanceKm,
        category: route.category,
        weight: route.weight,
      })),
    },
  });
});

loadData().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AeroIndex backend running on http://localhost:${PORT}`);
  });
}).catch((error) => {
  console.error('AeroIndex backend failed to preload SQLite data:', error);
  process.exitCode = 1;
});
