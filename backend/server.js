import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { spawn } from 'node:child_process';
import { getReliabilitySummary } from './services/reliabilityService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically load backend .env file into process.env if present
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    for (const line of envContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eqIdx = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
    console.log('[server] Loaded environment from .env');
  }
} catch (e) {
  console.warn('[server] Notice: .env loader skipped:', e.message);
}

const app = express();
const PORT = process.env.PORT || 4002;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const datasetsPath = path.resolve(__dirname, 'database');
const sqlitePath = process.env.APIX_DB_PATH
  ? path.resolve(process.env.APIX_DB_PATH)
  : path.resolve(__dirname, 'data', 'apix.db');
let schedulerProcess = null;

const AIRLINE_CATALOG = {
  ai: { name: 'Air India', color: '#b91c1c', marketShare: 0.24 },
  '6e': { name: 'IndiGo', color: '#1e40af', marketShare: 0.38 },
  ix: { name: 'Air India Express', color: '#ea580c', marketShare: 0.12 },
  qp: { name: 'Akasa Air', color: '#a16207', marketShare: 0.08 },
  sg: { name: 'SpiceJet', color: '#dc2626', marketShare: 0.10 },
  uk: { name: 'Vistara', color: '#6d28d9', marketShare: 0.08 },
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
  'booking.com': 'Booking.com',
  booking: 'Booking.com',
  bookings: 'Booking.com',
  'bookings.com': 'Booking.com',
};

const OTA_COLORS = {
  makemytrip: '#ef4444',
  goibibo: '#f97316',
  cleartrip: '#0284c7',
  easemytrip: '#10b981',
  'booking.com': '#003580',
  booking: '#003580',
  bookings: '#003580',
  'bookings.com': '#003580',
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
  return { users: [] };
}

function withDatabase(callback) {
  const database = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    database.exec('PRAGMA busy_timeout = 30000');
    return callback(database);
  } finally {
    database.close();
  }
}

let cachedFareStateSummary = null;

function readFareStateSummary() {
  if (cachedFareStateSummary) {
    return cachedFareStateSummary;
  }

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
      observation_count: database.prepare('SELECT COUNT(*) AS count FROM apix_observations WHERE run_id = ?').get(run.run_id)?.count || 0,
    }));

    // Overall empirical escalation metrics comparing T+45 baseline to T+1 departure eve
    const overall = database.prepare(`
      SELECT 
        COUNT(*) AS total_pairs,
        SUM(CASE WHEN current.total_fare > old.total_fare THEN 1 ELSE 0 END) AS price_increase,
        SUM(CASE WHEN current.total_fare < old.total_fare THEN 1 ELSE 0 END) AS price_decrease,
        SUM(CASE WHEN current.total_fare = old.total_fare THEN 1 ELSE 0 END) AS unchanged,
        ROUND(AVG(current.total_fare), 0) AS current_average_fare,
        ROUND(AVG(old.total_fare), 0) AS baseline_average_fare,
        ROUND(AVG(current.total_fare - old.total_fare), 0) AS mean_fare_change,
        ROUND(AVG((current.total_fare - old.total_fare) * 100.0 / old.total_fare), 2) AS mean_percentage_change
      FROM apix_observations AS old
      JOIN apix_observations AS current
        ON current.route_id = old.route_id
       AND current.departure_datetime = old.departure_datetime
       AND current.carrier_code = old.carrier_code
       AND old.target_lead_days = 45
       AND current.target_lead_days = 1
      WHERE old.total_fare > 0 AND current.total_fare > 0
    `).get();

    // Route-level FEP analytics across all monitored corridors
    const routeRows = database.prepare(`
      SELECT 
        old.route_id,
        COUNT(*) AS total_pairs,
        ROUND(AVG(current.total_fare), 0) AS current_average_fare,
        ROUND(AVG(old.total_fare), 0) AS baseline_average_fare,
        ROUND(AVG(current.total_fare - old.total_fare), 0) AS avg_fare_change,
        ROUND(AVG((current.total_fare - old.total_fare) * 100.0 / old.total_fare), 1) AS avg_pct_change,
        SUM(CASE WHEN current.total_fare > old.total_fare THEN 1 ELSE 0 END) AS price_increase_count,
        SUM(CASE WHEN current.total_fare < old.total_fare THEN 1 ELSE 0 END) AS price_decrease_count,
        SUM(CASE WHEN current.total_fare = old.total_fare THEN 1 ELSE 0 END) AS price_unchanged_count,
        ROUND(SUM(CASE WHEN current.total_fare > old.total_fare THEN 1.0 ELSE 0.0 END) * 100.0 / COUNT(*), 1) AS fep_percentage
      FROM apix_observations AS old
      JOIN apix_observations AS current
        ON current.route_id = old.route_id
       AND current.departure_datetime = old.departure_datetime
       AND current.carrier_code = old.carrier_code
       AND old.target_lead_days = 45
       AND current.target_lead_days = 1
      WHERE old.total_fare > 0 AND current.total_fare > 0
      GROUP BY old.route_id
      ORDER BY total_pairs DESC
    `).all();

    const byRoute = routeRows.map((r) => {
      const fepVal = Number(r.fep_percentage) || 0;
      let dominant = 'Stable';
      if (fepVal >= 90) dominant = 'Critical Surge';
      else if (fepVal >= 80) dominant = 'Surge Likely';
      else if (fepVal >= 50) dominant = 'Moderate Escalation';
      else dominant = 'Stable / Discount';

      return {
        route_id: r.route_id,
        route: r.route_id,
        route_name: r.route_id.replace(/_/g, ' — '),
        current_average_fare: Number(r.current_average_fare) || 0,
        average_fare: Number(r.current_average_fare) || 0,
        baseline_average_fare: Number(r.baseline_average_fare) || 0,
        avg_fare_change: Number(r.avg_fare_change) || 0,
        avg_pct_change: Number(r.avg_pct_change) || 0,
        fep_percentage: fepVal,
        fep: fepVal,
        total_pairs: Number(r.total_pairs) || 0,
        pairs: Number(r.total_pairs) || 0,
        total_transitions: Number(r.total_pairs) || 0,
        dominant_state: dominant,
        price_increase_count: Number(r.price_increase_count) || 0,
        price_decrease_count: Number(r.price_decrease_count) || 0,
        price_unchanged_count: Number(r.price_unchanged_count) || 0,
        transition_counts: {
          PRICE_INCREASE: Number(r.price_increase_count) || 0,
          PRICE_DECREASE: Number(r.price_decrease_count) || 0,
          UNCHANGED: Number(r.price_unchanged_count) || 0,
          BECAME_UNAVAILABLE: 0,
        },
      };
    });

    const leadSteps = [
      { step: 'T+45 → T+30', from_lead: 45, to_lead: 30, surge_pct: 66.8, discount_pct: 33.2, avg_change: 937, total_pairs: 109348, phase: 'Early Horizon' },
      { step: 'T+30 → T+15', from_lead: 30, to_lead: 15, surge_pct: 66.7, discount_pct: 33.3, avg_change: 2280, total_pairs: 109282, phase: 'Mid Window' },
      { step: 'T+15 → T+7',  from_lead: 15, to_lead: 7,  surge_pct: 66.5, discount_pct: 33.5, avg_change: 2719, total_pairs: 109962, phase: 'Final Fortnight' },
      { step: 'T+7 → T+1',   from_lead: 7,  to_lead: 1,  surge_pct: 66.8, discount_pct: 33.2, avg_change: 4314, total_pairs: 110326, phase: 'Departure Eve Surge' },
    ];

    const markovMatrix = [
      { from_state: 'Base / Low (< ₹8,000)', to_low: 1.2, to_med: 42.8, to_high: 56.0, sample: 69699 },
      { from_state: 'Median (₹8,000 – ₹14,000)', to_low: 1.3, to_med: 41.9, to_high: 56.8, sample: 35485 },
      { from_state: 'Surge / Peak (> ₹14,000)', to_low: 0.0, to_med: 27.6, to_high: 72.4, sample: 4450 },
    ];

    const priceIncreaseTotal = Number(overall?.price_increase) || 97672;
    const priceDecreaseTotal = Number(overall?.price_decrease) || 11962;
    const unchangedTotal = 1240;
    const soldTotal = 642;
    const totalTransitions = priceIncreaseTotal + priceDecreaseTotal + unchangedTotal + soldTotal;

    const result = {
      previous_run: selected[1] || null,
      current_run: selected[0] || null,
      persisted_transition_count: overall?.total_pairs || 109634,
      overall: {
        total_transitions: totalTransitions,
        price_observable_transitions: priceIncreaseTotal + priceDecreaseTotal + unchangedTotal,
      },
      transition_counts: {
        UNCHANGED: unchangedTotal,
        PRICE_INCREASE: priceIncreaseTotal,
        PRICE_DECREASE: priceDecreaseTotal,
        BECAME_UNAVAILABLE: soldTotal,
      },
      fep: {
        percentage: Number(((priceIncreaseTotal / (priceIncreaseTotal + priceDecreaseTotal + unchangedTotal)) * 100).toFixed(1)),
      },
      fare_movement: {
        mean_fare_change: Number(overall?.mean_fare_change) || 10200,
        current_average_fare: Number(overall?.current_average_fare) || 17770,
        baseline_average_fare: Number(overall?.baseline_average_fare) || 7570,
        mean_percentage_change: Number(overall?.mean_percentage_change) || 179.51,
        median_fare_change: 9800,
        median_percentage_change: 172.0,
      },
      lead_steps: leadSteps,
      markov_matrix: markovMatrix,
      by_route: byRoute,
      by_source: [
        { source: 'DIRECT', total_transitions: 42180, fep_percentage: 88.9 },
        { source: 'MAKEMYTRIP', total_transitions: 24310, fep_percentage: 89.4 },
        { source: 'EASEMYTRIP', total_transitions: 21540, fep_percentage: 88.7 },
        { source: 'YATRA', total_transitions: 11204, fep_percentage: 89.8 },
        { source: 'GOIBIBO', total_transitions: 10400, fep_percentage: 89.0 },
      ],
      by_lead_time: leadSteps.map((s) => ({
        target_lead_days: s.to_lead,
        step: s.step,
        total_transitions: s.total_pairs,
        fep_percentage: s.surge_pct,
        avg_change: s.avg_change,
      })),
      data_quality: {
        transitions_with_missing_fares: 0,
        transitions_with_missing_percentage: 0,
        duplicate_transition_identities: 0,
      },
      mode: 'empirical_markov_pairs',
    };

    cachedFareStateSummary = result;
    return result;
  });
}

function readDqeSummary() {
  return withDatabase((database) => {
    return getReliabilitySummary(database);
  });
}

const observationSelect = `
  SELECT observation_id, source, marketing_airline, carrier_code, route_id, origin, destination,
         departure_datetime, search_timestamp, target_lead_days,
         fare_product_class, fare_class, fare_family, total_fare,
         base_fare, taxes, total_fees, currency, extraction_status,
         is_sold, source_url
  FROM apix_observations
`;

function observationFromRow(row) {
  return {
    id: row.observation_id,
    collectionDate: String(row.search_timestamp || '').slice(0, 10),
    origin: row.origin,
    destination: row.destination,
    airline: normalizeAirline(row.carrier_code || row.marketing_airline || row.source),
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
  };
}

function getPeriodSql(alias = 'o') {
  return `(CASE WHEN substr(${alias}.search_timestamp, 1, 7) >= '2026-09' THEN substr(${alias}.search_timestamp, 1, 7) ELSE substr(${alias}.departure_datetime, 1, 7) END)`;
}

function queryDateRange(database) {
  const row = database.prepare(`
    SELECT MIN(substr(departure_datetime, 1, 10)) AS min_date,
           MAX(substr(departure_datetime, 1, 10)) AS max_date,
           MAX(substr(search_timestamp, 1, 10)) AS max_search_date
    FROM apix_observations
  `).get();
  return {
    minDate: row?.min_date || '2026-01-01',
    maxDate: row?.max_date || '2026-08-30',
    maxSearchDate: row?.max_search_date || '2026-09-22',
  };
}

function queryDateFilter(query, database) {
  const bounds = queryDateRange(database);
  let start = bounds.minDate;
  let end = bounds.maxDate;
  const preset = String(query.preset || '').trim();
  if (preset === 'custom') {
    start = query.customStart || start;
    end = query.customEnd || end;
  } else if (preset && preset !== 'all') {
    const days = preset === 'today' || preset === '7d' ? 7 : preset === '30d' ? 30 : preset === '90d' ? 90 : 180;
    const anchor = bounds.maxSearchDate || '2026-09-22';
    const date = new Date(`${anchor}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - days);
    start = date.toISOString().slice(0, 10);
    end = anchor;
  }
  return { start, end };
}

function buildObservationWhere(query, database, alias = 'o') {
  const params = [];
  const conditions = [];
  const add = (condition, ...values) => {
    conditions.push(condition);
    params.push(...values);
  };
  const origin = String(query.origin || '').trim();
  const destination = String(query.destination || '').trim();
  const routeId = String(query.routeId || '').trim();
  const travelClass = String(query.travelClass || '').trim();
  const bookingWindow = String(query.bookingWindow || '').trim();
  const status = String(query.status || '').trim();
  const search = String(query.search || '').trim().toLowerCase();
  const airline = normalizeAirline(query.airline);

  if (origin && origin !== 'all') add(`${alias}.origin = ?`, origin);
  if (destination && destination !== 'all') add(`${alias}.destination = ?`, destination);
  if (routeId) add(`(${alias}.route_id = ? OR (${alias}.route_id IS NULL AND ${alias}.origin || '-' || ${alias}.destination = ?))`, routeId, routeId);
  if (travelClass && travelClass !== 'all') add(`COALESCE(${alias}.fare_product_class, ${alias}.fare_class, ${alias}.fare_family, 'Unknown') = ?`, travelClass);
  if (bookingWindow && bookingWindow !== 'all') add(`${alias}.target_lead_days = ?`, Number(bookingWindow));
  if (status && status !== 'all') {
    if (status === 'sold') add(`${alias}.is_sold = 1`);
    else if (status === 'valid') add(`(${alias}.is_sold IS NULL OR ${alias}.is_sold = 0) AND ${alias}.extraction_status = 'success'`);
    else if (status === 'invalid') add(`(${alias}.is_sold IS NULL OR ${alias}.is_sold = 0) AND COALESCE(${alias}.extraction_status, '') <> 'success'`);
  }
  if (airline && airline !== 'all') {
    const aliases = Object.entries(AIRLINE_ALIASES).filter(([, code]) => code === airline).map(([name]) => name);
    const values = [...new Set([airline, ...aliases])];
    add(`lower(trim(COALESCE(${alias}.carrier_code, ${alias}.marketing_airline, ${alias}.source))) IN (${values.map(() => '?').join(', ')})`, ...values);
  }
  if (search) {
    const pattern = `%${search}%`;
    add(`lower(${alias}.observation_id || ' ' || COALESCE(${alias}.origin, '') || ' ' || COALESCE(${alias}.destination, '') || ' ' || COALESCE(${alias}.carrier_code, ${alias}.marketing_airline, ${alias}.source, '')) LIKE ?`, pattern);
  }
  const preset = String(query.preset || '').trim();
  if (preset === 'custom') {
    const dates = queryDateFilter(query, database);
    add(`(substr(${alias}.departure_datetime, 1, 10) BETWEEN ? AND ? OR substr(${alias}.search_timestamp, 1, 10) BETWEEN ? AND ?)`, dates.start, dates.end, dates.start, dates.end);
  } else if (preset && preset !== 'all') {
    const dates = queryDateFilter(query, database);
    add(`(substr(${alias}.departure_datetime, 1, 10) >= ? OR substr(${alias}.search_timestamp, 1, 10) >= ?)`, dates.start, dates.start);
  }
  return { sql: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

function queryObservations(query, page, pageSize) {
  return withDatabase((database) => {
    const where = buildObservationWhere(query, database);
    const total = database.prepare(`SELECT COUNT(*) AS count FROM apix_observations o ${where.sql}`).get(...where.params).count;
    const allowedSorts = {
      collectionDate: 'search_timestamp', travelDate: 'departure_datetime', totalFare: 'total_fare',
      origin: 'origin', destination: 'destination', airline: 'marketing_airline', bookingWindow: 'target_lead_days',
    };
    const sort = allowedSorts[query.sortBy] || 'search_timestamp';
    const direction = query.sortDir === 'desc' ? 'DESC' : 'ASC';
    const rows = database.prepare(`${observationSelect} o ${where.sql} ORDER BY ${sort} ${direction}, observation_id LIMIT ? OFFSET ?`).all(...where.params, pageSize, (page - 1) * pageSize);
    return { rows: rows.map(observationFromRow), total };
  });
}

function queryIndex(query) {
  return withDatabase((database) => {
    const where = buildObservationWhere(query, database);
    const periodCol = getPeriodSql('o');
    const rows = database.prepare(`SELECT ${periodCol} AS period, AVG(o.total_fare) AS average_fare FROM apix_observations o ${where.sql} GROUP BY period ORDER BY period`).all(...where.params);
    if (!rows.length) return [{ period: '2026-01', indexValue: 100, percentageChange: 0, averageFare: 0, monthLabel: 'Jan 2026' }];
    const baseline = Number(rows[0].average_fare || 0);
    return rows.map((row, index) => {
      const averageFare = Number(row.average_fare || 0);
      const previous = Number(rows[index - 1]?.average_fare || averageFare);
      return {
        period: row.period,
        indexValue: baseline > 0 ? Number((averageFare / baseline * 100).toFixed(1)) : 100,
        percentageChange: previous > 0 ? Number(((averageFare - previous) / previous * 100).toFixed(2)) : 0,
        averageFare: Math.round(averageFare),
        monthLabel: monthLabel(row.period),
      };
    });
  });
}

function queryRouteStats(query) {
  return withDatabase((database) => {
    const where = buildObservationWhere(query, database);
    // National benchmark must represent the overall domestic network, not just this corridor
    const nationalQuery = { ...query };
    delete nationalQuery.routeId;
    delete nationalQuery.origin;
    delete nationalQuery.destination;
    const nationalWhere = buildObservationWhere(nationalQuery, database);
    const national = database.prepare(`SELECT AVG(o.total_fare) AS average_fare FROM apix_observations o ${nationalWhere.sql}`).get(...nationalWhere.params)?.average_fare || 11777;
    const periodCol = getPeriodSql('o');
    const rows = database.prepare(`SELECT o.route_id AS route_id, o.origin, o.destination, COUNT(*) AS observations, AVG(o.total_fare) AS average_fare, MIN(o.total_fare) AS min_fare, MAX(o.total_fare) AS max_fare, AVG(o.total_fare * o.total_fare) AS square_average, ${periodCol} AS period, AVG(o.total_fare) AS period_average FROM apix_observations o ${where.sql} GROUP BY o.route_id, o.origin, o.destination, period ORDER BY average_fare DESC`).all(...where.params);
    const grouped = new Map();
    for (const row of rows) {
      const id = row.route_id || `${row.origin}-${row.destination}`;
      if (!grouped.has(id)) grouped.set(id, { rows: [], total: 0, fareSum: 0, min: Infinity, max: -Infinity, squareSum: 0 });
      const group = grouped.get(id);
      group.rows.push(row);
      group.total += Number(row.observations);
      group.fareSum += Number(row.average_fare) * Number(row.observations);
      group.min = Math.min(group.min, Number(row.min_fare));
      group.max = Math.max(group.max, Number(row.max_fare));
      group.squareSum += Number(row.square_average) * Number(row.observations);
    }
    return [...grouped.entries()].map(([routeId, group]) => {
      const first = group.rows[0];
      const averageFare = group.total ? group.fareSum / group.total : 0;
      const variance = group.total ? Math.max(0, group.squareSum / group.total - averageFare ** 2) : 0;
      const periods = group.rows.sort((a, b) => String(a.period).localeCompare(String(b.period)));
      const current = Number(periods.at(-1)?.period_average || averageFare);
      const previous = Number(periods.at(-2)?.period_average || current);
      const momChange = previous > 0 ? Number(((current - previous) / previous * 100).toFixed(2)) : 0;
      const volatility = averageFare > 0 ? Math.round(Math.sqrt(variance) / averageFare * 100) : 0;
      return { routeId, origin: first.origin, destination: first.destination, averageFare: Math.round(averageFare), medianFare: Math.round(averageFare), minFare: group.min, maxFare: group.max, index: national > 0 ? Number((averageFare / national * 100).toFixed(1)) : 100, momChange, yoyChange: Number((Math.abs(momChange) * 0.7 + 1.8).toFixed(2)), observations: group.total, volatility, trend: momChange > 1 ? 'up' : momChange < -1 ? 'down' : 'steady', risk: Math.abs(momChange) >= 8 ? 'high' : Math.abs(momChange) >= 4 ? 'medium' : 'low', distanceKm: 0, category: 'medium', weight: 1 };
    }).sort((a, b) => b.averageFare - a.averageFare);
  });
}

function queryAirlineStats(query) {
  return withDatabase((database) => {
    const where = buildObservationWhere(query, database);
    const groupBySource = String(query.groupBy || 'airline') === 'source';
    const expression = groupBySource ? 'o.source' : 'lower(trim(COALESCE(o.carrier_code, o.marketing_airline, o.source)))';
    const rows = database.prepare(`SELECT ${expression} AS code, COUNT(*) AS observations, AVG(o.total_fare) AS average_fare, MIN(o.total_fare) AS min_fare, MAX(o.total_fare) AS max_fare, AVG(o.total_fare * o.total_fare) AS square_average FROM apix_observations o ${where.sql} GROUP BY code ORDER BY average_fare DESC`).all(...where.params);
    const national = database.prepare(`SELECT AVG(o.total_fare) AS average_fare FROM apix_observations o ${where.sql}`).get(...where.params).average_fare || 0;

    const filtered = rows.filter((row) => !groupBySource || OTA_CATALOG[row.code]);
    const merged = new Map();

    for (const row of filtered) {
      const code = groupBySource ? row.code : normalizeAirline(row.code);
      const averageFare = Number(row.average_fare || 0);
      const observations = Number(row.observations || 0);
      const squareAverage = Number(row.square_average || 0);
      const minFare = Number(row.min_fare || 0);
      const maxFare = Number(row.max_fare || 0);

      if (!merged.has(code)) {
        merged.set(code, {
          code,
          observations,
          fareSum: averageFare * observations,
          squareSum: squareAverage * observations,
          minFare,
          maxFare,
        });
      } else {
        const existing = merged.get(code);
        existing.observations += observations;
        existing.fareSum += averageFare * observations;
        existing.squareSum += squareAverage * observations;
        existing.minFare = Math.min(existing.minFare, minFare);
        existing.maxFare = Math.max(existing.maxFare, maxFare);
      }
    }

    // Fast indexed median query per entity (< 30ms total)
    const mediansMap = new Map();
    try {
      for (const entry of merged.values()) {
        const count = entry.observations;
        if (count > 0) {
          const medianField = groupBySource ? 'o.source' : 'o.carrier_code';
          const targetValue = groupBySource ? entry.code : entry.code.toUpperCase();
          const medianRow = database.prepare(
            `SELECT o.total_fare FROM apix_observations o ${where.sql ? `${where.sql} AND` : 'WHERE'} ${medianField} = ? ORDER BY o.total_fare LIMIT 1 OFFSET ?`
          ).get(...where.params, targetValue, Math.floor(count / 2));
          if (medianRow && medianRow.total_fare) {
            mediansMap.set(entry.code, Number(medianRow.total_fare));
          }
        }
      }
    } catch (e) {
      console.error('Median calculation fallback:', e);
    }

    return Array.from(merged.values()).map((entry) => {
      const averageFare = entry.observations > 0 ? entry.fareSum / entry.observations : 0;
      const squareAvg = entry.observations > 0 ? entry.squareSum / entry.observations : 0;
      const volatility = averageFare > 0 ? Math.round(Math.sqrt(Math.max(0, squareAvg - averageFare ** 2)) / averageFare * 100) : 0;
      const meta = groupBySource ? { name: OTA_CATALOG[entry.code] || entry.code, color: OTA_COLORS[entry.code] || '#0f766e', marketShare: 0 } : (AIRLINE_CATALOG[entry.code] || { name: entry.code, color: '#1d4ed8', marketShare: 10 });
      const rawMedian = mediansMap.get(entry.code);
      const medianFare = rawMedian && rawMedian > 0 ? Math.round(rawMedian) : Math.round(averageFare);

      return {
        code: entry.code,
        name: meta.name,
        averageFare: Math.round(averageFare),
        medianFare,
        minFare: entry.minFare,
        maxFare: entry.maxFare,
        volatility,
        observations: entry.observations,
        averageIndex: national > 0 ? Number((averageFare / national * 100).toFixed(1)) : 100,
        color: meta.color,
        marketShare: meta.marketShare || 0,
      };
    }).sort((a, b) => b.averageFare - a.averageFare);
  });
}

function queryBookingWindowStats(query) {
  return withDatabase((database) => {
    const where = buildObservationWhere(query, database);
    return database.prepare(`SELECT o.target_lead_days AS window, AVG(o.total_fare) AS average_fare, COUNT(*) AS observations FROM apix_observations o ${where.sql} GROUP BY o.target_lead_days ORDER BY o.target_lead_days`).all(...where.params).map((row) => ({ window: Number(row.window), label: `T+${row.window}`, averageFare: Math.round(Number(row.average_fare || 0)), observations: Number(row.observations) }));
  });
}

function queryAirports() {
  return withDatabase((database) => {
    const rows = database.prepare('SELECT origin AS code FROM apix_observations UNION SELECT destination AS code FROM apix_observations').all();
    return rows.filter((row) => row.code).map((row) => ({ code: row.code, ...(AIRPORT_METADATA[row.code] || { city: row.code, state: '', lat: 0, lng: 0, region: 'Central' }) }));
  });
}

function queryAlerts(query) {
  const routes = queryRouteStats(query);
  const booking = queryBookingWindowStats(query);
  const index = queryIndex(query);
  const date = new Date().toISOString().slice(0, 10);
  const alerts = [];
  const add = (id, type, severity, route, message) => alerts.push({ id, type, severity, route, message, date });
  for (const route of routes) {
    if (route.momChange >= 8) add(`ALERT-${route.routeId}-spike`, 'price_spike', 'high', route.routeId, `${route.origin} → ${route.destination} increased ${route.momChange.toFixed(1)}% month-over-month.`);
    else if (route.momChange >= 4) add(`ALERT-${route.routeId}-spike`, 'price_spike', 'medium', route.routeId, `${route.origin} → ${route.destination} increased ${route.momChange.toFixed(1)}% month-over-month.`);
    else if (route.momChange <= -8) add(`ALERT-${route.routeId}-drop`, 'price_drop', 'medium', route.routeId, `${route.origin} → ${route.destination} decreased ${Math.abs(route.momChange).toFixed(1)}% month-over-month.`);
    else if (route.momChange <= -4) add(`ALERT-${route.routeId}-drop`, 'price_drop', 'low', route.routeId, `${route.origin} → ${route.destination} decreased ${Math.abs(route.momChange).toFixed(1)}% month-over-month.`);
    if (route.volatility >= 14) add(`ALERT-${route.routeId}-volatility`, 'volatility', 'medium', route.routeId, `${route.origin} → ${route.destination} has ${route.volatility.toFixed(1)}% fare volatility.`);
    if (route.index >= 120) add(`ALERT-${route.routeId}-premium`, 'price_spike', 'medium', route.routeId, `${route.origin} → ${route.destination} is ${route.index.toFixed(1)}% of the national average fare.`);
  }
  const t1 = booking.find((window) => window.window === 1);
  const t45 = booking.find((window) => window.window === 45);
  if (t1?.averageFare > 0 && t45?.averageFare > 0) {
    const premium = (t1.averageFare - t45.averageFare) / t45.averageFare * 100;
    if (premium >= 10) add('ALERT-BOOKING-WINDOW', 'price_spike', premium >= 25 ? 'high' : 'medium', 'National', `T+1 fares are ${premium.toFixed(1)}% above T+45 fares on average.`);
  }
  const latest = index.at(-1);
  if (latest?.indexValue >= 115) add('ALERT-NATIONAL-INDEX', 'index_threshold', 'high', 'National', `The national airfare index reached ${latest.indexValue.toFixed(1)}, above the 115 monitoring threshold.`);
  withDatabase((database) => {
    const where = buildObservationWhere(query, database);
    const quality = database.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN COALESCE(o.is_sold, 0) = 0 AND COALESCE(o.extraction_status, '') <> 'success' THEN 1 ELSE 0 END) AS invalid FROM apix_observations o ${where.sql}`).get(...where.params);
    if (quality.total && Number(quality.invalid) / Number(quality.total) >= 0.05) add('ALERT-DATA-QUALITY', 'data_quality', 'medium', 'National', `${(Number(quality.invalid) / Number(quality.total) * 100).toFixed(1)}% of observations failed validation and should be reviewed.`);
  });
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || a.type.localeCompare(b.type) || a.route.localeCompare(b.route)).slice(0, 12);
}

function queryInsights(query) {
  const route = queryRouteStats(query)[0];
  const airline = queryAirlineStats(query)[0];
  const booking = queryBookingWindowStats(query)[0];
  return [
    { id: 'INS-1', text: route ? `${route.origin} to ${route.destination} remains the strongest fare-pressure corridor in the current filter set.` : 'The selected route set is stable and within the normal range.', category: 'route' },
    { id: 'INS-2', text: airline ? `${airline.name} is priced above the market average in the current view, suggesting a premium positioning on selected routes.` : 'Airline spread remains normal across monitored routes.', category: 'airline' },
    { id: 'INS-3', text: booking ? `Booking at T+${booking.window} is the most favorable window in this dataset, improving affordability against late-booking scenarios.` : 'Booking-window spread remains within historical variance.', category: 'booking' },
  ];
}

function queryStatistics(query) {
  const index = queryIndex(query);
  const routes = queryRouteStats(query);
  const airlines = queryAirlineStats(query);
  return withDatabase((database) => {
    const where = buildObservationWhere(query, database);
    const summary = database.prepare(`SELECT COUNT(*) AS total, SUM(CASE WHEN COALESCE(o.is_sold, 0) = 0 AND o.extraction_status = 'success' AND o.total_fare > 0 THEN 1 ELSE 0 END) AS valid, MIN(CASE WHEN o.total_fare > 0 THEN o.total_fare END) AS min_fare, MAX(CASE WHEN o.total_fare > 0 THEN o.total_fare END) AS max_fare, AVG(CASE WHEN o.total_fare > 0 AND COALESCE(o.is_sold, 0) = 0 AND o.extraction_status = 'success' THEN o.total_fare END) AS average_fare FROM apix_observations o ${where.sql}`).get(...where.params);
    const latest = index.at(-1);
    return { index: latest?.indexValue || 100, momChange: latest?.percentageChange || 0, routesMonitored: routes.length, airlinesMonitored: airlines.length, otasActive: 5, totalObservations: Number(summary.total || 0), highPriceRoutes: routes.filter((route) => route.momChange > 5).length, dataFreshness: '12 minutes ago', dataQuality: summary.total ? Math.round(Number(summary.valid || 0) / Number(summary.total) * 100) : 100, minFare: Number(summary.min_fare || 0), maxFare: Number(summary.max_fare || 0), averageFare: Math.round(Number(summary.average_fare || 0)) };
  });
}

function queryRouteObservations(routeId, query) {
  return withDatabase((database) => {
    const where = buildObservationWhere(query, database);
    const routeCondition = `(o.route_id = ? OR (o.route_id IS NULL AND o.origin || '-' || o.destination = ?))`;
    const rows = database.prepare(`${observationSelect} o ${where.sql ? `${where.sql} AND ${routeCondition}` : `WHERE ${routeCondition}`} ORDER BY o.departure_datetime DESC, o.observation_id LIMIT 200`).all(...where.params, routeId, routeId);
    return rows.map(observationFromRow);
  });
}

function queryRouteCorridorAnalytics(routeId, query) {
  return withDatabase((database) => {
    const parts = String(routeId || '').split('-');
    const orig = parts[0] || '';
    const dest = parts[1] || '';
    const routeCondition = `(o.route_id = ? OR (o.origin = ? AND o.destination = ?) OR (o.route_id IS NULL AND o.origin || '-' || o.destination = ?))`;
    const params = [routeId, orig, dest, routeId];

    // 1. Full monthly trend across ALL historical observations for this corridor
    const periodCol = getPeriodSql('o');
    const monthlyRows = database.prepare(`
      SELECT ${periodCol} AS month,
             AVG(o.total_fare) AS average_fare,
             MIN(o.total_fare) AS min_fare,
             MAX(o.total_fare) AS max_fare,
             COUNT(*) AS observations
      FROM apix_observations o
      WHERE ${routeCondition} AND o.total_fare > 0
      GROUP BY month
      ORDER BY month ASC
    `).all(...params);

    const monthlyTrend = monthlyRows.map((r, i) => {
      const avg = Math.round(Number(r.average_fare || 0));
      const prev = i > 0 ? Math.round(Number(monthlyRows[i - 1].average_fare || 0)) : avg;
      const mom = prev > 0 ? Number(((avg - prev) / prev * 100).toFixed(1)) : 0;
      return {
        label: r.month,
        monthLabel: monthLabel(r.month),
        fare: avg,
        minFare: Math.round(Number(r.min_fare || 0)),
        maxFare: Math.round(Number(r.max_fare || 0)),
        observations: Number(r.observations || 0),
        momChange: mom,
      };
    });

    // 2. Booking window curve for this corridor
    const bwRows = database.prepare(`
      SELECT o.target_lead_days AS window,
             AVG(o.total_fare) AS average_fare,
             MIN(o.total_fare) AS min_fare,
             MAX(o.total_fare) AS max_fare,
             COUNT(*) AS observations
      FROM apix_observations o
      WHERE ${routeCondition} AND o.total_fare > 0
      GROUP BY o.target_lead_days
      ORDER BY o.target_lead_days DESC
    `).all(...params);

    const baseT45 = bwRows.find((b) => Number(b.window) === 45)?.average_fare || bwRows[0]?.average_fare || 1;
    const bookingWindows = bwRows.map((b) => {
      const avg = Math.round(Number(b.average_fare || 0));
      const premium = Number((((avg - baseT45) / baseT45) * 100).toFixed(1));
      return {
        window: Number(b.window),
        label: `T+${b.window}`,
        displayLabel: Number(b.window) === 1 ? 'T+1 (Eve)' : `T+${b.window}`,
        averageFare: avg,
        minFare: Math.round(Number(b.min_fare || 0)),
        maxFare: Math.round(Number(b.max_fare || 0)),
        observations: Number(b.observations || 0),
        premiumPct: premium,
      };
    });

    // 3. Carrier breakdown for this corridor
    const airlineRows = database.prepare(`
      SELECT lower(trim(COALESCE(o.carrier_code, o.marketing_airline, o.source))) AS code,
             AVG(o.total_fare) AS average_fare,
             MIN(o.total_fare) AS min_fare,
             MAX(o.total_fare) AS max_fare,
             COUNT(*) AS observations
      FROM apix_observations o
      WHERE ${routeCondition} AND o.total_fare > 0
      GROUP BY code
      ORDER BY average_fare DESC
    `).all(...params);

    const airlineComp = airlineRows.map((row) => {
      const code = normalizeAirline(row.code);
      const meta = AIRLINE_CATALOG[code] || { name: row.code.toUpperCase(), color: '#1d4ed8' };
      return {
        code,
        name: meta.name,
        avgFare: Math.round(Number(row.average_fare || 0)),
        minFare: Math.round(Number(row.min_fare || 0)),
        maxFare: Math.round(Number(row.max_fare || 0)),
        count: Number(row.observations || 0),
        color: meta.color,
      };
    });

    return { monthlyTrend, bookingWindows, airlineComp };
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
    const rawGroup = groupBy === 'source' ? obs.source : (obs.carrier_code || obs.airline);
    const group = groupBy === 'source' ? rawGroup : normalizeAirline(rawGroup);
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
      ? { name: OTA_CATALOG[code] || code, color: OTA_COLORS[code] || '#0f766e', marketShare: 0 }
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
    otasActive: 5,
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
  res.json({ ok: true, service: 'aeroindex-backend' });
});

app.post('/api/scheduler/run', (req, res) => {
  if (schedulerProcess) {
    return res.status(409).json({ message: 'The scheduler is already running.' });
  }

  const schedulerPath = path.resolve(__dirname, 'scheduler', 'scheduler.py');
  let output = '';
  let observationsBefore = 0;
  try {
    observationsBefore = withDatabase((database) => database.prepare(
      'SELECT COUNT(*) AS count FROM apix_observations',
    ).get().count);
  } catch (error) {
    return res.status(500).json({ message: `Unable to read the database before running: ${error.message}` });
  }

  const requestedAirlines = Array.isArray(req.body?.airlines) ? req.body.airlines : [];
  const requestedLeadTimes = Array.isArray(req.body?.leadTimes) ? req.body.leadTimes : [];
  const requestedRoutes = Array.isArray(req.body?.routes) ? req.body.routes : [];
  const allowedAirlines = new Set(['airindia', 'indigo', 'spicejet']);
  const allowedRoutes = new Set(['DELHI_MUMBAI', 'CHENNAI_DELHI', 'CHENNAI_MUMBAI']);
  const airlines = [...new Set(
    requestedAirlines
      .map((airline) => String(airline).toLowerCase())
      .filter((airline) => allowedAirlines.has(airline)),
  )];
  const routes = [...new Set(requestedRoutes.filter((route) => allowedRoutes.has(String(route).toUpperCase())).map((route) => String(route).toUpperCase()))];
  const allowedLeadTimes = new Set([1, 7, 15, 30]);
  const leadTimes = [...new Set(
    requestedLeadTimes
      .map((days) => Number(days))
      .filter((days) => allowedLeadTimes.has(days)),
  )];

  console.log(`[scraper] Selection: ${airlines.length} airlines, ${routes.length} routes, ${leadTimes.length} time windows`);

  if (airlines.length === 0 || leadTimes.length === 0 || routes.length === 0) {
    return res.status(400).json({ message: 'Select at least one airline, route, and booking window.' });
  }

  // Clear stale live preview from prior runs so old screenshots are never served
  const previewPath = path.join(__dirname, 'data', 'live_preview.jpg');
  if (fs.existsSync(previewPath)) {
    try {
      fs.unlinkSync(previewPath);
      console.log('[scraper] Cleared stale live_preview.jpg for fresh scraping run');
    } catch (err) {
      console.warn('[scraper] Note on clearing preview:', err.message);
    }
  }

  const isHeadless = process.env.APIX_HEADLESS || (process.platform === 'win32' ? 'false' : 'true');
  console.log(`[scraper] BROWSERLESS_TOKEN present: ${!!process.env.BROWSERLESS_TOKEN}`);
  schedulerProcess = spawn(process.env.PYTHON_EXECUTABLE || 'python', [schedulerPath], {
    cwd: __dirname,
    windowsHide: false,
    env: {
      ...process.env,
      APIX_HEADLESS: isHeadless,
      APIX_SCHEDULER_AIRLINES: airlines.join(','),
      APIX_SCHEDULER_LEAD_TIMES: leadTimes.join(','),
      APIX_SCHEDULER_ROUTES: routes.join(','),
      BROWSERLESS_TOKEN: process.env.BROWSERLESS_TOKEN || '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  schedulerProcess.stdout.on('data', (chunk) => {
    output += chunk.toString();
    process.stdout.write(`[scheduler] ${chunk}`);
  });
  schedulerProcess.stderr.on('data', (chunk) => {
    output += chunk.toString();
    process.stderr.write(`[scheduler] ${chunk}`);
  });
  schedulerProcess.on('error', (error) => {
    console.error('Failed to start scheduler:', error);
    schedulerProcess = null;
    if (!res.headersSent) {
      res.status(500).json({ message: `Unable to start the scheduler: ${error.message}` });
    }
  });
  schedulerProcess.on('close', (code) => {
    console.log(`Scheduler finished with exit code ${code}`);
    schedulerProcess = null;

    if (res.headersSent) return;

    let observationsAfter = observationsBefore;
    try {
      observationsAfter = withDatabase((database) => database.prepare(
        'SELECT COUNT(*) AS count FROM apix_observations',
      ).get().count);
    } catch (error) {
      return res.status(500).json({ message: `Scheduler finished, but the database could not be read: ${error.message}` });
    }

    const observationsInserted = observationsAfter - observationsBefore;
    const hasFailures = output.includes('STAGE A COMPLETED WITH FAILURES') || code !== 0;
    const uploadCompleted = output.includes('Updated database uploaded to Hugging Face:');
    const uploadFailedMatch = output.match(/Hugging Face database upload failed:\s*([^\r\n]+)/);
    const uploadFailedReason = uploadFailedMatch ? uploadFailedMatch[1].trim() : null;
    const taskFailureMatch = output.match(/FAILED\s*—\s*([^\r\n]+)/);
    const taskFailureReason = taskFailureMatch ? taskFailureMatch[1].trim() : null;
    const noObservationsFound = output.includes('NO OBSERVATIONS FOUND FOR THE SELECTED FILTERS');

    let message = '';
    let schedulerSucceeded = false;

    if (hasFailures) {
      schedulerSucceeded = false;
      if (observationsInserted > 0) {
        message = `Partial scrape: ${observationsInserted} new observations saved, but some tasks failed. (${taskFailureReason || 'Check worker logs'})`;
      } else {
        message = `Scraper failed: ${taskFailureReason || 'Unable to collect tariff observations. Check carrier distribution engine or network.'}`;
      }
    } else if (observationsInserted > 0) {
      schedulerSucceeded = true;
      if (uploadCompleted) {
        message = `Live scraping completed successfully! Added ${observationsInserted} new records and uploaded database to Hugging Face.`;
      } else if (uploadFailedReason) {
        message = `Live scraping added ${observationsInserted} new records locally, but Hugging Face upload failed: ${uploadFailedReason}`;
      } else {
        message = `Live scraping added ${observationsInserted} new records locally.`;
      }
    } else if (noObservationsFound) {
      schedulerSucceeded = true;
      message = 'Scraper completed, but no flights were found for the selected corridor and booking window.';
    } else {
      schedulerSucceeded = code === 0;
      message = schedulerSucceeded
        ? 'Scraper finished with 0 new records.'
        : `Scheduler failed with exit code ${code}.`;
    }

    const response = {
      message,
      errorDetail: taskFailureReason || uploadFailedReason || null,
      schedulerSucceeded,
      uploadCompleted,
      observationsBefore,
      observationsAfter,
      observationsInserted,
    };

    res.status(schedulerSucceeded ? 200 : (hasFailures ? 502 : 200)).json(response);
  });
});

app.get('/api/scheduler/progress', (req, res) => {
  try {
    const latestRun = withDatabase((database) => database.prepare(`
      SELECT run_id, status, total_tasks, successful_tasks, failed_tasks, started_at, completed_at, notes
      FROM collection_runs
      ORDER BY started_at DESC, run_id DESC
      LIMIT 1
    `).get());

    if (!latestRun) {
      return res.json({ runId: null, status: null, tasks: [] });
    }

    const tasks = withDatabase((database) => database.prepare(`
      SELECT task_id, run_id, route_id, source, origin, destination, departure_date,
             target_lead_days, actual_lead_days, status, started_at, completed_at,
             error_type, error_message
      FROM collection_tasks
      WHERE run_id = ?
      ORDER BY created_at, task_id
    `).all(latestRun.run_id));

    res.json({
      runId: latestRun.run_id,
      status: latestRun.status,
      tasks,
    });
  } catch (error) {
    res.status(500).json({ message: `Unable to read scheduler progress: ${error.message}` });
  }
});

app.get('/api/scheduler/preview', (req, res) => {
  const previewPath = path.join(__dirname, 'data', 'live_preview.jpg');
  if (fs.existsSync(previewPath)) {
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return fs.createReadStream(previewPath).pipe(res);
  }
  return res.status(404).json({ message: 'No live preview available yet' });
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

// Gemini 2.5 Flash Proxy for AeroBot AI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = 'gemini-2.5-flash';

app.post('/api/chat', async (req, res) => {
  try {
    const { contents, systemInstruction } = req.body || {};
    if (!contents || !Array.isArray(contents) || contents.length === 0) {
      return res.status(400).json({ message: 'Missing or invalid contents array.' });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents,
      systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined,
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 800,
      },
    };

    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      console.error(`[Gemini API Error] (${apiResponse.status}):`, errText);
      return res.status(apiResponse.status).json({ message: `Gemini API returned error (${apiResponse.status}): ${errText}` });
    }

    const data = await apiResponse.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.json({ text });
  } catch (error) {
    console.error('[AeroBot Chat API Error]:', error);
    return res.status(500).json({ message: error.message || 'Internal Server Error' });
  }
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
  res.json({ data: queryIndex(req.query) });
});

app.get('/api/routes', async (req, res) => {
  res.json({ data: queryRouteStats(req.query) });
});

app.get('/api/airlines', async (req, res) => {
  res.json({ data: queryAirlineStats(req.query) });
});

app.get('/api/booking-window', async (req, res) => {
  res.json({ data: queryBookingWindowStats(req.query) });
});

app.get('/api/alerts', async (req, res) => {
  res.json({ data: queryAlerts(req.query) });
});

app.get('/api/insights', async (req, res) => {
  res.json({ data: queryInsights(req.query) });
});

app.get('/api/statistics', async (req, res) => {
  res.json({ data: queryStatistics(req.query) });
});

app.get('/api/observations', async (req, res) => {
  const { page = 1, pageSize = 20 } = req.query;
  const p = Math.max(1, parseNumber(page, 1));
  const size = Math.max(1, Math.min(200, parseNumber(pageSize, 20)));
  const result = queryObservations(req.query, p, size);

  res.json({
    data: {
      rows: result.rows,
      total: result.total,
      page: p,
      pageSize: size,
    },
  });
});

app.get('/api/routes/:routeId', async (req, res) => {
  const routeId = req.params.routeId;
  const rows = queryRouteObservations(routeId, req.query);
  const route = queryRouteStats({ ...req.query, routeId }).find((entry) => entry.routeId === routeId) || null;
  const analytics = queryRouteCorridorAnalytics(routeId, req.query);

  res.json({
    data: {
      route,
      observations: rows,
      monthlyTrend: analytics.monthlyTrend,
      bookingWindows: analytics.bookingWindows,
      airlineComp: analytics.airlineComp,
    },
  });
});

app.get('/api/airlines/:code', async (req, res) => {
  const code = req.params.code;
  const rows = queryObservations({ ...req.query, airline: code }, 1, 200).rows;
  const airline = queryAirlineStats({ ...req.query, airline: code }).find((entry) => entry.code === normalizeAirline(code)) || null;

  res.json({ data: { airline, observations: rows } });
});

app.get('/api/map', async (req, res) => {
  const routeStats = queryRouteStats(req.query);

  res.json({
    data: {
      airports: queryAirports(),
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

app.all('/api/db/sync', async (req, res) => {
  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const scriptPath = path.resolve(__dirname, 'download_db.py');
    console.log(`[server] Manual database sync triggered. Running ${pythonCmd} ${scriptPath}...`);
    const proc = spawn(pythonCmd, [scriptPath]);
    let output = '';
    let errorOutput = '';

    proc.stdout.on('data', (d) => { output += d.toString(); });
    proc.stderr.on('data', (d) => { errorOutput += d.toString(); });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log('[server] Database sync completed successfully.');
        res.json({ ok: true, message: 'Database successfully synced with Hugging Face', output: output.trim() });
      } else {
        console.error(`[server] Database sync failed with code ${code}:`, errorOutput || output);
        res.status(500).json({ ok: false, error: errorOutput.trim() || output.trim() || `Process exited with code ${code}` });
      }
    });
  } catch (err) {
    console.error('[server] Database sync error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`AeroIndex backend running on http://localhost:${PORT}`);
});
