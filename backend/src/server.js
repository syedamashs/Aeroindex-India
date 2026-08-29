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

function computeIndex(data) {
  const observations = data.observations || [];
  const routeMap = new Map();

  for (const obs of observations) {
    const key = `${obs.origin}-${obs.destination}`;
    if (!routeMap.has(key)) routeMap.set(key, []);
    routeMap.get(key).push(obs.totalFare);
  }

  const points = [];
  for (const [routeKey, fares] of [...routeMap.entries()].slice(0, 6)) {
    const avg = fares.reduce((a, b) => a + b, 0) / fares.length;
    points.push({
      period: routeKey,
      indexValue: Math.round((avg / 5000) * 100),
      percentageChange: 4.5,
      averageFare: Math.round(avg),
      monthLabel: routeKey,
    });
  }

  return points;
}

function computeRouteStats(data) {
  const observations = data.observations || [];
  const byRoute = new Map();

  for (const obs of observations) {
    const key = `${obs.origin}-${obs.destination}`;
    if (!byRoute.has(key)) byRoute.set(key, []);
    byRoute.get(key).push(obs);
  }

  return [...byRoute.entries()].map(([routeId, list]) => {
    const fares = list.map((o) => o.totalFare);
    const avg = fares.reduce((a, b) => a + b, 0) / fares.length;
    return {
      routeId,
      origin: list[0].origin,
      destination: list[0].destination,
      averageFare: Math.round(avg),
      medianFare: Math.round(avg),
      minFare: Math.min(...fares),
      maxFare: Math.max(...fares),
      index: 104,
      momChange: 3.8,
      yoyChange: 7.2,
      observations: list.length,
      volatility: 8.2,
      trend: 'up',
      risk: 'medium',
    };
  });
}

function computeAirlineStats(data) {
  const observations = data.observations || [];
  const byAirline = new Map();

  for (const obs of observations) {
    if (!byAirline.has(obs.airline)) byAirline.set(obs.airline, []);
    byAirline.get(obs.airline).push(obs);
  }

  return [...byAirline.entries()].map(([code, list]) => {
    const fares = list.map((o) => o.totalFare);
    const avg = fares.reduce((a, b) => a + b, 0) / fares.length;
    return {
      code,
      name: data.airlines.find((a) => a.code === code)?.name || code,
      averageFare: Math.round(avg),
      medianFare: Math.round(avg),
      minFare: Math.min(...fares),
      maxFare: Math.max(...fares),
      volatility: 7.4,
      observations: list.length,
      averageIndex: 103,
      color: data.airlines.find((a) => a.code === code)?.color || '#1d4ed8',
    };
  });
}

function computeBookingWindowStats(data) {
  const observations = data.observations || [];
  const byWindow = new Map();

  for (const obs of observations) {
    const key = obs.bookingWindow;
    if (!byWindow.has(key)) byWindow.set(key, []);
    byWindow.get(key).push(obs.totalFare);
  }

  return [...byWindow.entries()].map(([window, fares]) => ({
    window,
    label: `T+${window}`,
    averageFare: Math.round(fares.reduce((a, b) => a + b, 0) / fares.length),
    observations: fares.length,
  }));
}

function computeAlerts(data) {
  return [
    {
      id: 'ALERT-1',
      type: 'price_spike',
      severity: 'high',
      route: 'DEL-BOM',
      message: 'Fare increase above 5% compared to previous month.',
      date: '2026-08-20',
    },
    {
      id: 'ALERT-2',
      type: 'volatility',
      severity: 'medium',
      route: 'BLR-HYD',
      message: 'Volatility elevated due to weekend and holiday demand.',
      date: '2026-08-18',
    },
  ];
}

function computeInsights() {
  return [
    { id: 'INS-1', text: 'Delhi to Mumbai remains the top monitored route with the highest observed fare pressure.', category: 'route' },
    { id: 'INS-2', text: 'Booking closer to departure remains significantly more expensive than T+45 windows.', category: 'booking' },
    { id: 'INS-3', text: 'Weekend and holiday travel continue to elevate domestic fare volatility across short routes.', category: 'volatility' },
  ];
}

function computeStatistics(data) {
  const observations = data.observations || [];
  return {
    index: 112,
    momChange: 4.6,
    routesMonitored: (data.routes || []).length,
    airlinesMonitored: (data.airlines || []).length,
    totalObservations: observations.length,
    highPriceRoutes: 6,
    dataFreshness: '12 minutes ago',
    dataQuality: 96,
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
  res.json({ data: computeIndex(data) });
});

app.get('/api/routes', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeRouteStats(data) });
});

app.get('/api/airlines', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeAirlineStats(data) });
});

app.get('/api/booking-window', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeBookingWindowStats(data) });
});

app.get('/api/alerts', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeAlerts(data) });
});

app.get('/api/insights', async (req, res) => {
  res.json({ data: computeInsights() });
});

app.get('/api/statistics', async (req, res) => {
  const data = await loadData();
  res.json({ data: computeStatistics(data) });
});

app.get('/api/observations', async (req, res) => {
  const data = await loadData();
  const rows = data.observations || [];
  res.json({ data: { rows, total: rows.length, page: 1, pageSize: rows.length } });
});

app.listen(PORT, () => {
  console.log(`AeroIndex backend running on http://localhost:${PORT}`);
});
