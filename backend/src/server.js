import express from 'express';
import cors from 'cors';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const app = express();
const PORT = 4002;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataPath = path.resolve(__dirname, '../data/mockData.json');

app.use(cors());
app.use(express.json());

async function loadData() {
  const raw = await readFile(dataPath, 'utf8');
  return JSON.parse(raw);
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function routeKey({ origin, destination }) {
  return `${origin}-${destination}`;
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
  const travelDates = (data.observations || [])
    .map((obs) => obs.travelDate)
    .filter(Boolean)
    .map((dateString) => new Date(dateString))
    .filter((value) => !Number.isNaN(value.getTime()));

  const minDate = travelDates.length ? new Date(Math.min(...travelDates.map((d) => d.getTime()))) : new Date('2026-01-01');
  const maxDate = travelDates.length ? new Date(Math.max(...travelDates.map((d) => d.getTime()))) : new Date('2026-08-30');

  return { minDate, maxDate };
}

function getRouteMeta(data, routeId) {
  return (data.routes || []).find((route) => route.id === routeId) || null;
}

function filterObservations(data, query = {}) {
  const rows = [...(data.observations || [])];
  const origin = String(query.origin || '').trim();
  const destination = String(query.destination || '').trim();
  const airline = String(query.airline || '').trim();
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
  return points.slice(-8).map((point) => ({
    ...point,
    weightedIndex: Math.round(point.indexValue + (routeWeightMap.size ? routeWeightMap.size * 0.5 : 0)),
  }));
}

function computeRouteStats(data, query = {}) {
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

  return [...byRoute.entries()].map(([routeId, list]) => {
    const fares = list.map((obs) => obs.totalFare);
    const avg = fares.reduce((sum, value) => sum + value, 0) / fares.length;
    const routeMeta = getRouteMeta(data, routeId) || { weight: 1, distanceKm: 0, category: 'short' };
    const monthlyMap = new Map();
    for (const obs of list) {
      const monthKey = obs.travelDate.slice(0, 7);
      if (!monthlyMap.has(monthKey)) monthlyMap.set(monthKey, []);
      monthlyMap.get(monthKey).push(obs.totalFare);
    }
    const monthlyValues = [...monthlyMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, values]) => {
      return values.reduce((sum, value) => sum + value, 0) / values.length;
    });
    const prevMonth = monthlyValues.length > 1 ? monthlyValues[monthlyValues.length - 2] : monthlyValues[monthlyValues.length - 1] || avg;
    const momChange = prevMonth ? Number((((avg - prevMonth) / prevMonth) * 100).toFixed(2)) : 0;
    const index = nationalAverage > 0 ? Number(((avg / nationalAverage) * 100).toFixed(1)) : 100;
    const volatility = fares.length > 1
      ? Math.round(Math.sqrt(fares.reduce((sum, value) => sum + (value - avg) ** 2, 0) / fares.length) / avg * 100)
      : 6;
    const risk = Math.abs(momChange) > 8 || volatility > 14 ? 'high' : Math.abs(momChange) > 4 || volatility > 9 ? 'medium' : 'low';

    return {
      routeId,
      origin: list[0].origin,
      destination: list[0].destination,
      averageFare: Math.round(avg),
      medianFare: Math.round(avg),
      minFare: Math.min(...fares),
      maxFare: Math.max(...fares),
      index,
      momChange,
      yoyChange: Number((Math.abs(momChange) * 0.7 + 1.8).toFixed(2)),
      observations: list.length,
      volatility,
      trend: momChange > 1 ? 'up' : momChange < -1 ? 'down' : 'steady',
      risk,
      distanceKm: routeMeta.distanceKm || 0,
      category: routeMeta.category || 'short',
      weight: routeMeta.weight || 1,
    };
  }).sort((a, b) => b.averageFare - a.averageFare);
}

function computeAirlineStats(data, query = {}) {
  const rows = filterObservations(data, query);
  const byAirline = new Map();

  for (const obs of rows) {
    if (!byAirline.has(obs.airline)) byAirline.set(obs.airline, []);
    byAirline.get(obs.airline).push(obs);
  }

  const nationalAverage = rows.length ? rows.reduce((sum, obs) => sum + obs.totalFare, 0) / rows.length : 0;

  return [...byAirline.entries()].map(([code, list]) => {
    const fares = list.map((obs) => obs.totalFare);
    const avg = fares.reduce((sum, value) => sum + value, 0) / fares.length;
    const volatility = fares.length > 1
      ? Math.round(Math.sqrt(fares.reduce((sum, value) => sum + (value - avg) ** 2, 0) / fares.length) / avg * 100)
      : 6;
    const airlineMeta = (data.airlines || []).find((airline) => airline.code === code) || { name: code, color: '#1d4ed8', marketShare: 10 };

    return {
      code,
      name: airlineMeta.name,
      averageFare: Math.round(avg),
      medianFare: Math.round(avg),
      minFare: Math.min(...fares),
      maxFare: Math.max(...fares),
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
  const alerts = [];

  for (const route of routeStats.slice(0, 5)) {
    if (route.momChange > 4) {
      alerts.push({
        id: `ALERT-${route.routeId}`,
        type: 'price_spike',
        severity: route.momChange > 9 ? 'high' : 'medium',
        route: route.routeId,
        message: `${route.origin} → ${route.destination} has risen ${route.momChange.toFixed(1)}% month-over-month and is above its baseline trend.`,
        date: new Date().toISOString().slice(0, 10),
      });
    }
  }

  if (!alerts.length && routeStats.length) {
    const topRoute = routeStats[0];
    alerts.push({
      id: `ALERT-${topRoute.routeId}`,
      type: 'volatility',
      severity: 'medium',
      route: topRoute.routeId,
      message: `${topRoute.origin} → ${topRoute.destination} shows elevated fare volatility over the current observation window.`,
      date: new Date().toISOString().slice(0, 10),
    });
  }

  return alerts.slice(0, 5);
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

  return {
    index: latest ? latest.indexValue : 100,
    momChange: latest ? latest.percentageChange : 0,
    routesMonitored: routeStats.length,
    airlinesMonitored: airlineStats.length,
    totalObservations: rows.length,
    highPriceRoutes: routeStats.filter((route) => route.momChange > 5).length,
    dataFreshness: '12 minutes ago',
    dataQuality: validRows.length && rows.length ? Math.round((validRows.length / rows.length) * 100) : 100,
  };
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'aeroindex-backend', timestamp: new Date().toISOString() });
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
        origin: route.origin,
        destination: route.destination,
        avgFare: route.averageFare,
        index: route.index,
        momChange: route.momChange,
        observations: route.observations,
        trend: route.trend,
      })),
    },
  });
});

app.listen(PORT, () => {
  console.log(`AeroIndex backend running on http://localhost:${PORT}`);
});
