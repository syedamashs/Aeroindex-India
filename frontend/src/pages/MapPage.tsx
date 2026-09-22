import { useMemo, useState, useEffect, useRef } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Marker,
  Tooltip as LeafletTooltip,
  useMap,
} from 'react-leaflet';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { apiMap, type ApiRouteStats } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { FilterBar } from '@/components/FilterBar';
import {
  X,
  ArrowRight,
  Plane,
  Layers,
  Search,
  Compass,
  Radio,
  RotateCcw,
  TrendingUp,
  TrendingDown,
  Activity,
  MapPin,
  Maximize2,
  Sparkles,
  Info,
} from 'lucide-react';
import L from 'leaflet';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Major hubs with priority radar pulse animation
const MAJOR_HUBS = new Set(['DEL', 'BOM', 'BLR', 'HYD', 'CCU', 'MAA', 'AMD', 'COK', 'GOI', 'PNQ']);

type BasemapKey = 'dark' | 'light' | 'satellite' | 'osm';
interface BasemapConfig {
  name: string;
  url: string;
  refUrl?: string;
  subdomains?: string;
  attribution: string;
  isDark: boolean;
}

const BASEMAPS: Record<BasemapKey, BasemapConfig> = {
  dark: {
    name: 'ATC Dark Ops',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    refUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, DeLorme, NAVTEQ',
    isDark: true,
  },
  light: {
    name: 'Aero Light',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    refUrl: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, DeLorme, NAVTEQ',
    isDark: false,
  },
  satellite: {
    name: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, Earthstar Geographics',
    isDark: true,
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    isDark: false,
  },
};

type QuickFilter = 'all' | 'surge' | 'decline' | 'metro' | 'longhaul';

interface FlightSchedule {
  id: string;
  callsign: string;
  airline: string;
  airlineCode: string;
  origin: string;
  destination: string;
  altitude: string;
  speed: string;
  durationMs: number;
  startOffsetMs: number;
}

const SIMULATED_FLIGHTS: FlightSchedule[] = [
  { id: 'f1', callsign: '6E-2041', airline: 'IndiGo', airlineCode: '6E', origin: 'DEL', destination: 'BOM', altitude: 'FL360', speed: '450 kts', durationMs: 24000, startOffsetMs: 2000 },
  { id: 'f2', callsign: 'AI-805', airline: 'Air India', airlineCode: 'AI', origin: 'BLR', destination: 'DEL', altitude: 'FL340', speed: '460 kts', durationMs: 28000, startOffsetMs: 11000 },
  { id: 'f3', callsign: 'SG-112', airline: 'SpiceJet', airlineCode: 'SG', origin: 'BOM', destination: 'GOI', altitude: 'FL260', speed: '380 kts', durationMs: 18000, startOffsetMs: 6000 },
  { id: 'f4', callsign: 'QP-1304', airline: 'Akasa Air', airlineCode: 'QP', origin: 'HYD', destination: 'BOM', altitude: 'FL310', speed: '420 kts', durationMs: 20000, startOffsetMs: 14000 },
  { id: 'f5', callsign: '6E-549', airline: 'IndiGo', airlineCode: '6E', origin: 'CCU', destination: 'DEL', altitude: 'FL370', speed: '440 kts', durationMs: 26000, startOffsetMs: 19000 },
  { id: 'f6', callsign: 'UK-992', airline: 'Vistara', airlineCode: 'UK', origin: 'MAA', destination: 'DEL', altitude: 'FL380', speed: '470 kts', durationMs: 29000, startOffsetMs: 7000 },
  { id: 'f7', callsign: '6E-188', airline: 'IndiGo', airlineCode: '6E', origin: 'DEL', destination: 'BLR', altitude: 'FL350', speed: '465 kts', durationMs: 27000, startOffsetMs: 16000 },
  { id: 'f8', callsign: 'AI-631', airline: 'Air India', airlineCode: 'AI', origin: 'BOM', destination: 'CCU', altitude: 'FL330', speed: '455 kts', durationMs: 25000, startOffsetMs: 22000 },
];

function routeColor(momChange: number, isDark = true): string {
  if (momChange > 5) return isDark ? '#f43f5e' : '#dc2626'; // rose red surge
  if (momChange > 1.5) return isDark ? '#fbbf24' : '#d97706'; // amber moderate increase
  if (momChange < -1.5) return isDark ? '#34d399' : '#16a34a'; // emerald decrease
  return isDark ? '#38bdf8' : '#64748b'; // cyan/slate stable
}

/**
 * Calculates authentic quadratic bezier curved arc coordinates between two lat/lng endpoints.
 */
function getArcPoints(
  p1: [number, number],
  p2: [number, number],
  numPoints = 18,
  curveFactor = 0.13
): [number, number][] {
  const lat1 = p1[0], lng1 = p1[1];
  const lat2 = p2[0], lng2 = p2[1];
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const dist = Math.sqrt(dLat * dLat + dLng * dLng);
  if (dist === 0) return [p1];

  const midLat = (lat1 + lat2) / 2 - (dLng / dist) * (dist * curveFactor);
  const midLng = (lng1 + lng2) / 2 + (dLat / dist) * (dist * curveFactor);

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * midLat + t * t * lat2;
    const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * midLng + t * t * lng2;
    points.push([lat, lng]);
  }
  return points;
}

/**
 * Calculates bearing angle (heading 0-360) between two coordinates.
 */
function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const y = Math.sin((lng2 - lng1) * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180));
  const x =
    Math.cos(lat1 * (Math.PI / 180)) * Math.sin(lat2 * (Math.PI / 180)) -
    Math.sin(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.cos((lng2 - lng1) * (Math.PI / 180));
  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Controller to smoothly animate map center / zoom / bounds.
 */
function MapController({
  target,
  zoom,
  bounds,
}: {
  target: [number, number] | null;
  zoom: number;
  bounds: L.LatLngBoundsExpression | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 7, duration: 1.1 });
    } else if (target) {
      map.flyTo(target, zoom, { duration: 1.1 });
    }
  }, [target, zoom, bounds, map]);
  return null;
}

export function MapPage() {
  const { filters, lastUpdate, setIsUiLoading } = useApp();
  const navigate = useNavigate();

  const [airports, setAirports] = useState<Array<{ code: string; city: string; state: string; lat: number; lng: number; region: string }>>([]);
  const [routeStats, setRouteStats] = useState<Array<ApiRouteStats & { id: string; avgFare: number }>>([]);
  const [loading, setLoading] = useState(true);

  // Map state
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedAirportCode, setSelectedAirportCode] = useState<string | null>(null);
  const [activeBasemap, setActiveBasemap] = useState<BasemapKey>('dark');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [liveFlightsEnabled, setLiveFlightsEnabled] = useState(true);

  // Map camera control
  const [mapTarget, setMapTarget] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(4.7);
  const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);

  // Live flight animation positions
  const [flightPositions, setFlightPositions] = useState<
    Record<string, { pos: [number, number]; bearing: number; orig: string; dest: string }>
  >({});

  // Fetch data
  useEffect(() => {
    setLoading(true);
    setIsUiLoading(true);
    apiMap({
      origin: filters.origin !== 'all' ? filters.origin : undefined,
      destination: filters.destination !== 'all' ? filters.destination : undefined,
      airline: filters.airline !== 'all' ? filters.airline : undefined,
      preset: filters.preset,
      customStart: filters.customStart,
      customEnd: filters.customEnd,
    })
      .then((response) => {
        setAirports(response.data.airports);
        setRouteStats(response.data.routes);
      })
      .catch((error) => console.error('Failed to fetch map data:', error))
      .finally(() => {
        setLoading(false);
        setIsUiLoading(false);
      });
  }, [filters, lastUpdate, setIsUiLoading]);

  const airportMap = useMemo(() => new Map(airports.map((airport) => [airport.code, airport])), [airports]);

  // Compute curved arc coordinates for each route
  const routeArcs = useMemo(() => {
    const map = new Map<string, [number, number][]>();
    routeStats.forEach((route) => {
      const orig = airportMap.get(route.origin);
      const dest = airportMap.get(route.destination);
      if (orig && dest) {
        const id = route.id || route.routeId;
        const key = `${route.origin}-${route.destination}`;
        const points = getArcPoints([orig.lat, orig.lng], [dest.lat, dest.lng]);
        map.set(id, points);
        map.set(key, points);
      }
    });
    return map;
  }, [routeStats, airportMap]);

  // Animated flight positions ticker
  useEffect(() => {
    if (!liveFlightsEnabled || routeArcs.size === 0) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const updated: Record<string, { pos: [number, number]; bearing: number; orig: string; dest: string }> = {};

      SIMULATED_FLIGHTS.forEach((sim) => {
        const arc = routeArcs.get(`${sim.origin}-${sim.destination}`);
        if (!arc || arc.length < 2) return;

        const progress = ((now + sim.startOffsetMs) % sim.durationMs) / sim.durationMs;
        const exactIndex = progress * (arc.length - 1);
        const idx = Math.floor(exactIndex);
        const nextIdx = Math.min(idx + 1, arc.length - 1);
        const ratio = exactIndex - idx;

        const p1 = arc[idx];
        const p2 = arc[nextIdx];
        const lat = p1[0] + (p2[0] - p1[0]) * ratio;
        const lng = p1[1] + (p2[1] - p1[1]) * ratio;
        const bearing = getBearing(p1[0], p1[1], p2[0], p2[1]);

        updated[sim.id] = { pos: [lat, lng], bearing, orig: sim.origin, dest: sim.destination };
      });

      setFlightPositions(updated);
    }, 80);

    return () => clearInterval(interval);
  }, [liveFlightsEnabled, routeArcs]);

  // Filtered route list
  const filteredRoutes = useMemo(() => {
    return routeStats.filter((route) => {
      // 1. Text Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const origCity = airportMap.get(route.origin)?.city.toLowerCase() || '';
        const destCity = airportMap.get(route.destination)?.city.toLowerCase() || '';
        const matchOrigin = route.origin.toLowerCase().includes(q) || origCity.includes(q);
        const matchDest = route.destination.toLowerCase().includes(q) || destCity.includes(q);
        if (!matchOrigin && !matchDest) return false;
      }

      // 2. Preset Quick Filter
      if (quickFilter === 'surge') return (route.momChange || 0) > 5;
      if (quickFilter === 'decline') return (route.momChange || 0) < -1.5;
      if (quickFilter === 'metro') {
        return MAJOR_HUBS.has(route.origin) && MAJOR_HUBS.has(route.destination);
      }
      if (quickFilter === 'longhaul') return (route.distanceKm || 0) > 1200;

      return true;
    });
  }, [routeStats, searchQuery, quickFilter, airportMap]);

  // Selected route object
  const activeRoute = useMemo(() => {
    if (!selectedRouteId) return null;
    return routeStats.find((r) => r.id === selectedRouteId || r.routeId === selectedRouteId) || null;
  }, [selectedRouteId, routeStats]);

  // Selected airport object
  const activeAirport = useMemo(() => {
    if (!selectedAirportCode) return null;
    return airportMap.get(selectedAirportCode) || null;
  }, [selectedAirportCode, airportMap]);

  // Hub stats when an airport is focused
  const hubStats = useMemo(() => {
    if (!activeAirport) return null;
    const connected = routeStats.filter(
      (r) => r.origin === activeAirport.code || r.destination === activeAirport.code
    );
    if (connected.length === 0) return { count: 0, avgFare: 0, busiest: null, lowest: null, connected: [] };

    const totalFare = connected.reduce((acc, r) => acc + (r.averageFare || r.avgFare || 0), 0);
    const avgFare = Math.round(totalFare / connected.length);

    const sortedByFare = [...connected].sort(
      (a, b) => (a.averageFare || a.avgFare || 0) - (b.averageFare || b.avgFare || 0)
    );
    const lowest = sortedByFare[0];

    const sortedByObs = [...connected].sort((a, b) => (b.observations || 0) - (a.observations || 0));
    const busiest = sortedByObs[0];

    return {
      count: connected.length,
      avgFare,
      busiest,
      lowest,
      connected,
    };
  }, [activeAirport, routeStats]);

  // Top National Airway Telemetry
  const telemetry = useMemo(() => {
    if (routeStats.length === 0) return null;
    let minR = routeStats[0];
    let maxR = routeStats[0];
    let sumFare = 0;

    routeStats.forEach((r) => {
      const fare = r.averageFare || r.avgFare || 0;
      sumFare += fare;
      if (fare < (minR.averageFare || minR.avgFare || 0)) minR = r;
      if (fare > (maxR.averageFare || maxR.avgFare || 0)) maxR = r;
    });

    return {
      totalRoutes: routeStats.length,
      totalHubs: airports.length,
      avgFare: Math.round(sumFare / routeStats.length),
      lowestRoute: minR,
      highestRoute: maxR,
    };
  }, [routeStats, airports]);

  // Handlers
  const handleSelectRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    setSelectedAirportCode(null);
    const route = routeStats.find((r) => r.id === routeId || r.routeId === routeId);
    if (route) {
      const orig = airportMap.get(route.origin);
      const dest = airportMap.get(route.destination);
      if (orig && dest) {
        setMapBounds([[orig.lat, orig.lng], [dest.lat, dest.lng]]);
        setMapTarget(null);
      }
    }
  };

  const handleSelectAirport = (code: string) => {
    setSelectedAirportCode(code);
    setSelectedRouteId(null);
    const apt = airportMap.get(code);
    if (apt) {
      setMapBounds(null);
      setMapTarget([apt.lat, apt.lng]);
      setMapZoom(6);
    }
  };

  const handleResetView = () => {
    setSelectedRouteId(null);
    setSelectedAirportCode(null);
    setSearchQuery('');
    setQuickFilter('all');
    setMapBounds(null);
    setMapTarget([22.0, 78.8]);
    setMapZoom(4.7);
  };

  const currentBasemap = BASEMAPS[activeBasemap];

  return (
    <div className="space-y-2 animate-fade-in max-w-[1600px]">
      {/* 1. COMPACT UNIFIED HEADER & TELEMETRY STRIP */}
      <div className="bg-white border border-stone-200/90 rounded-lg px-3 py-2 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-sm font-bold tracking-tight text-stone-900 font-sans">
              Airway Intelligence Radar
            </h1>
          </div>

          {telemetry && (
            <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono border-l border-stone-200 pl-2.5">
              <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 font-semibold">
                {telemetry.totalRoutes} Sectors
              </span>
              <span className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700">
                {telemetry.totalHubs} Hubs
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px]">
                Min: {telemetry.lowestRoute.origin}-{telemetry.lowestRoute.destination} ({formatINR(telemetry.lowestRoute.averageFare || telemetry.lowestRoute.avgFare)})
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-800 border border-rose-200 text-[10px]">
                Max: {telemetry.highestRoute.origin}-{telemetry.highestRoute.destination} ({formatINR(telemetry.highestRoute.averageFare || telemetry.highestRoute.avgFare)})
              </span>
            </div>
          )}
        </div>

        {/* Search, Live Flight Toggle, & Reset */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Search city/IATA..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-6 py-1 text-xs rounded border border-stone-200 bg-stone-50 text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-amber-700 w-36 sm:w-44"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <button
            onClick={() => setLiveFlightsEnabled(!liveFlightsEnabled)}
            className={`btn text-xs px-2 py-1 flex items-center gap-1.5 transition-colors ${
              liveFlightsEnabled
                ? 'bg-sky-50 text-sky-800 border border-sky-300'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
            title="Toggle live simulated airborne flights"
          >
            <Plane className={`w-3 h-3 ${liveFlightsEnabled ? 'text-sky-600 animate-pulse' : ''}`} />
            <span className="hidden sm:inline text-[11px]">Flights</span>
            <span className="font-mono text-[10px] font-bold">
              {liveFlightsEnabled ? 'ON' : 'OFF'}
            </span>
          </button>

          <button
            onClick={handleResetView}
            className="btn btn-secondary text-xs px-2 py-1 text-[11px]"
            title="Reset map view to all India"
          >
            <RotateCcw className="w-3 h-3 text-stone-600" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {/* 2. CORRIDOR QUICK-FILTER PILLS */}
      <div className="flex items-center gap-1.5 text-xs overflow-x-auto pb-0.5 select-none">
        <span className="text-[11px] font-mono text-stone-400 mr-1 flex items-center gap-1 shrink-0">
          <Compass className="w-3 h-3" /> Corridors:
        </span>
        <button
          onClick={() => setQuickFilter('all')}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors shrink-0 ${
            quickFilter === 'all'
              ? 'bg-stone-900 text-white'
              : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
        >
          All Sectors ({routeStats.length})
        </button>
        <button
          onClick={() => setQuickFilter('surge')}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1 shrink-0 ${
            quickFilter === 'surge'
              ? 'bg-rose-700 text-white'
              : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
          }`}
        >
          <TrendingUp className="w-3 h-3" /> Surge (&gt;5%)
        </button>
        <button
          onClick={() => setQuickFilter('decline')}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1 shrink-0 ${
            quickFilter === 'decline'
              ? 'bg-emerald-700 text-white'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
          }`}
        >
          <TrendingDown className="w-3 h-3" /> Declining (&lt;-1.5%)
        </button>
        <button
          onClick={() => setQuickFilter('metro')}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors flex items-center gap-1 shrink-0 ${
            quickFilter === 'metro'
              ? 'bg-amber-700 text-white'
              : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
          }`}
        >
          <Sparkles className="w-3 h-3" /> Metro Golden Quad
        </button>
        <button
          onClick={() => setQuickFilter('longhaul')}
          className={`px-2 py-0.5 rounded text-xs font-medium transition-colors shrink-0 ${
            quickFilter === 'longhaul'
              ? 'bg-stone-900 text-white'
              : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-100'
          }`}
        >
          Long Haul (&gt;1,200 km)
        </button>
      </div>

      {/* 3. CENTRAL MAP CANVAS & FLOATING DOSSIER */}
      <div
        id="guide-airway-map"
        className="relative z-10 isolate bg-stone-950 border border-stone-800 rounded-xl overflow-hidden shadow-lg h-[490px] xl:h-[515px] flex"
      >
        {/* Floating Basemap Selector (Top-Left) */}
        <div className="absolute top-3 left-3 z-20 bg-stone-900/90 backdrop-blur-md border border-stone-700/80 rounded-lg p-1 shadow-lg flex items-center gap-1 text-[11px] font-mono text-stone-300">
          <Layers className="w-3 h-3 text-stone-400 ml-1.5 mr-0.5" />
          {(['dark', 'light', 'satellite', 'osm'] as BasemapKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setActiveBasemap(key)}
              className={`px-2 py-0.5 rounded text-[10px] sm:text-[11px] transition-colors ${
                activeBasemap === key
                  ? 'bg-amber-600 text-white font-bold shadow-xs'
                  : 'hover:bg-stone-800 text-stone-400'
              }`}
            >
              {BASEMAPS[key].name}
            </button>
          ))}
        </div>

        {/* Floating Route Legend (Top-Right) */}
        <div className="absolute top-3 right-3 z-20 hidden md:flex items-center gap-2.5 bg-stone-900/90 backdrop-blur-md border border-stone-700/80 rounded-lg px-2.5 py-1 shadow-lg text-[10px] font-mono">
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded bg-rose-500 shadow-[0_0_8px_#f43f5e]" />
            <span className="text-stone-300">Surge (&gt;5%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
            <span className="text-stone-300">Moderate</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="text-stone-300">Decline (&lt;-1.5%)</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2.5 h-1 rounded bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
            <span className="text-stone-300">Stable</span>
          </div>
        </div>

        {/* Leaflet Map Canvas */}
        <div className="flex-1 h-full relative z-0">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-xs text-stone-400 font-mono gap-2 bg-stone-950">
              <Radio className="w-6 h-6 animate-spin text-amber-500" />
              <span>Calibrating India Airway Cartography...</span>
            </div>
          ) : (
            <MapContainer
              center={[22.0, 78.8]}
              zoom={4.7}
              zoomSnap={0.25}
              minZoom={4}
              maxZoom={12}
              style={{ height: '100%', width: '100%', background: currentBasemap.isDark ? '#0c0a09' : '#f5f5f4' }}
              zoomControl={false}
            >
              <MapController target={mapTarget} zoom={mapZoom} bounds={mapBounds} />

              <TileLayer
                key={activeBasemap}
                attribution={currentBasemap.attribution}
                url={currentBasemap.url}
                subdomains={currentBasemap.subdomains || 'abc'}
                maxZoom={18}
              />
              {currentBasemap.refUrl && (
                <TileLayer
                  key={`${activeBasemap}-ref`}
                  url={currentBasemap.refUrl}
                  subdomains={currentBasemap.subdomains || 'abc'}
                  maxZoom={18}
                  opacity={0.85}
                />
              )}

              {/* Monitored Geodesic Airway Curved Polylines */}
              {filteredRoutes.map((route) => {
                const id = route.id || route.routeId;
                const arcPoints = routeArcs.get(id);
                if (!arcPoints) return null;

                const isSelected = selectedRouteId === id;
                const isConnectedToHub =
                  selectedAirportCode !== null &&
                  (route.origin === selectedAirportCode || route.destination === selectedAirportCode);

                const hasHubSelection = selectedAirportCode !== null;

                let opacity = 0.65;
                let weight = 2.2;

                if (isSelected) {
                  opacity = 1;
                  weight = 4.5;
                } else if (hasHubSelection) {
                  if (isConnectedToHub) {
                    opacity = 0.95;
                    weight = 3.5;
                  } else {
                    opacity = 0.12; // dim non-connected routes
                    weight = 1.2;
                  }
                }

                const color = routeColor(route.momChange || 0, currentBasemap.isDark);

                return (
                  <Polyline
                    key={id}
                    positions={arcPoints}
                    pathOptions={{
                      color: isSelected ? '#ffffff' : color,
                      weight,
                      opacity,
                      dashArray: isSelected ? '6, 6' : undefined,
                      lineCap: 'round',
                      lineJoin: 'round',
                    }}
                    eventHandlers={{
                      click: () => handleSelectRoute(id),
                    }}
                  >
                    <LeafletTooltip direction="top" offset={[0, -5]} opacity={0.96}>
                      <div className="font-mono text-xs p-1">
                        <div className="font-bold text-stone-900 border-b border-stone-200 pb-1 mb-1 flex items-center justify-between gap-3">
                          <span>{route.origin} ➔ {route.destination}</span>
                          <span className={route.momChange > 0 ? 'text-rose-600' : route.momChange < 0 ? 'text-emerald-700' : 'text-stone-600'}>
                            {route.momChange > 0 ? `+${route.momChange}%` : `${route.momChange}%`}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-600 space-y-0.5">
                          <div>Avg Tariff: <strong>{formatINR(route.averageFare || route.avgFare)}</strong></div>
                          {route.distanceKm && <div>Sector Distance: {route.distanceKm} km</div>}
                          <div>Monitored Obs: {route.observations?.toLocaleString('en-IN') || '—'}</div>
                        </div>
                      </div>
                    </LeafletTooltip>
                  </Polyline>
                );
              })}

              {/* Airport Hub Markers */}
              {airports.map((airport) => {
                const isSelected = selectedAirportCode === airport.code;
                const isMajor = MAJOR_HUBS.has(airport.code);
                const isConnectedToSelectedRoute =
                  activeRoute && (activeRoute.origin === airport.code || activeRoute.destination === airport.code);

                return (
                  <CircleMarker
                    key={airport.code}
                    center={[airport.lat, airport.lng]}
                    radius={isSelected || isConnectedToSelectedRoute ? 9 : isMajor ? 6.5 : 4}
                    pathOptions={{
                      fillColor: isSelected
                        ? '#f59e0b'
                        : isConnectedToSelectedRoute
                        ? '#38bdf8'
                        : isMajor
                        ? currentBasemap.isDark ? '#38bdf8' : '#0284c7'
                        : currentBasemap.isDark ? '#a8a29e' : '#44403c',
                      fillOpacity: isSelected || isConnectedToSelectedRoute ? 1 : 0.9,
                      color: isSelected ? '#ffffff' : currentBasemap.isDark ? '#0c0a09' : '#ffffff',
                      weight: isSelected ? 2.5 : 1.5,
                    }}
                    eventHandlers={{
                      click: () => handleSelectAirport(airport.code),
                    }}
                  >
                    <LeafletTooltip direction="bottom" offset={[0, 8]} opacity={0.96}>
                      <div className="font-mono text-xs p-1">
                        <div className="font-bold text-stone-900">
                          {airport.city} ({airport.code})
                        </div>
                        <div className="text-[10px] text-stone-500">{airport.state} · {airport.region}</div>
                        <div className="text-[10px] text-amber-700 font-sans mt-0.5">
                          Click to focus hub & inspect departures
                        </div>
                      </div>
                    </LeafletTooltip>
                  </CircleMarker>
                );
              })}

              {/* Animated Live Airborne Flight Markers */}
              {liveFlightsEnabled &&
                SIMULATED_FLIGHTS.map((sim) => {
                  const state = flightPositions[sim.id];
                  if (!state) return null;

                  const planeDivIcon = L.divIcon({
                    className: 'flight-plane-marker',
                    html: `
                      <div style="transform: rotate(${state.bearing - 45}deg); display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; filter: drop-shadow(0 0 6px rgba(56,189,248,0.9));">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="#38bdf8" stroke="#0369a1" stroke-width="1.5">
                          <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                        </svg>
                      </div>
                    `,
                    iconSize: [22, 22],
                    iconAnchor: [11, 11],
                  });

                  return (
                    <Marker
                      key={sim.id}
                      position={state.pos}
                      icon={planeDivIcon}
                      eventHandlers={{
                        click: () => {
                          const route = routeStats.find(
                            (r) => r.origin === sim.origin && r.destination === sim.destination
                          );
                          if (route) handleSelectRoute(route.id || route.routeId);
                        },
                      }}
                    >
                      <LeafletTooltip direction="top" offset={[0, -8]} opacity={0.96}>
                        <div className="font-mono text-xs p-1">
                          <div className="font-bold text-sky-800 flex items-center gap-1.5">
                            <Plane className="w-3 h-3" />
                            <span>{sim.callsign}</span>
                            <span className="text-[10px] text-stone-500">({sim.airline})</span>
                          </div>
                          <div className="text-[11px] text-stone-700 mt-0.5">
                            Sector: <strong>{sim.origin} ➔ {sim.destination}</strong>
                          </div>
                          <div className="text-[10px] text-stone-500 flex gap-2 mt-0.5">
                            <span>Alt: {sim.altitude}</span>
                            <span>Speed: {sim.speed}</span>
                          </div>
                        </div>
                      </LeafletTooltip>
                    </Marker>
                  );
                })}
            </MapContainer>
          )}
        </div>

        {/* 4. RIGHT SIDE INTERACTIVE DOSSIER PANEL */}
        {(activeRoute || activeAirport) && (
          <div className="w-84 md:w-96 bg-stone-900/95 backdrop-blur-md border-l border-stone-800 text-stone-100 p-5 flex flex-col justify-between z-20 animate-fade-in shadow-2xl overflow-y-auto">
            {/* CORRIDOR DOSSIER VIEW */}
            {activeRoute && (
              <div className="space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between border-b border-stone-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-semibold flex items-center gap-1">
                      <Radio className="w-3 h-3 animate-pulse text-amber-400" />
                      Active Sector Dossier
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      {activeRoute.origin} ➔ {activeRoute.destination}
                    </h3>
                    <p className="text-xs text-stone-400">
                      {airportMap.get(activeRoute.origin)?.city} to {airportMap.get(activeRoute.destination)?.city}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedRouteId(null)}
                    className="text-stone-400 hover:text-white p-1 rounded-md hover:bg-stone-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Metrics Grid */}
                <div className="space-y-3 font-mono text-xs">
                  <div className="bg-stone-800/80 border border-stone-700/60 rounded-lg p-3">
                    <span className="text-[10px] font-sans text-stone-400 uppercase tracking-wider block">
                      Weighted Average Fare
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl font-bold text-white">
                        {formatINR(activeRoute.averageFare || activeRoute.avgFare)}
                      </span>
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                          activeRoute.momChange > 0
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : activeRoute.momChange < 0
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-stone-800 text-stone-300'
                        }`}
                      >
                        {activeRoute.momChange > 0 ? `+${activeRoute.momChange}%` : `${activeRoute.momChange}%`} MoM
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-stone-800/60 border border-stone-700/40 rounded p-2.5">
                      <span className="text-[10px] font-sans text-stone-400 uppercase block">Laspeyres Index</span>
                      <span className="text-base font-bold text-stone-200">
                        {activeRoute.index ? activeRoute.index.toFixed(1) : '100.0'}
                      </span>
                    </div>
                    <div className="bg-stone-800/60 border border-stone-700/40 rounded p-2.5">
                      <span className="text-[10px] font-sans text-stone-400 uppercase block">Distance</span>
                      <span className="text-base font-bold text-stone-200">
                        {activeRoute.distanceKm ? `${activeRoute.distanceKm} km` : '—'}
                      </span>
                    </div>
                    <div className="bg-stone-800/60 border border-stone-700/40 rounded p-2.5">
                      <span className="text-[10px] font-sans text-stone-400 uppercase block">Volatility</span>
                      <span className="text-base font-bold text-stone-200">
                        {activeRoute.volatility ? `${activeRoute.volatility.toFixed(1)}%` : '12.4%'}
                      </span>
                    </div>
                    <div className="bg-stone-800/60 border border-stone-700/40 rounded p-2.5">
                      <span className="text-[10px] font-sans text-stone-400 uppercase block">Observations</span>
                      <span className="text-base font-bold text-stone-200">
                        {activeRoute.observations?.toLocaleString('en-IN') || '—'}
                      </span>
                    </div>
                  </div>

                  {/* Fare Range Bounds */}
                  {activeRoute.minFare && activeRoute.maxFare && (
                    <div className="bg-stone-800/60 border border-stone-700/40 rounded p-2.5">
                      <div className="flex justify-between text-[11px] text-stone-400 mb-1">
                        <span>Min: {formatINR(activeRoute.minFare)}</span>
                        <span>Max: {formatINR(activeRoute.maxFare)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-rose-500"
                          style={{
                            width: `${Math.min(
                              100,
                              Math.max(
                                10,
                                (((activeRoute.averageFare || activeRoute.avgFare) - activeRoute.minFare) /
                                  (activeRoute.maxFare - activeRoute.minFare || 1)) *
                                  100
                              )
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button
                    onClick={() => navigate(`/routes/${activeRoute.routeId || activeRoute.id}`)}
                    className="btn w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 py-2 rounded-lg transition"
                  >
                    <span>Inspect Full Route Dossier</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => {
                      const orig = airportMap.get(activeRoute.origin);
                      const dest = airportMap.get(activeRoute.destination);
                      if (orig && dest) {
                        setMapBounds([[orig.lat, orig.lng], [dest.lat, dest.lng]]);
                      }
                    }}
                    className="btn w-full bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-stone-700 transition"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Zoom / Fit Corridor</span>
                  </button>
                </div>
              </div>
            )}

            {/* AIRPORT HUB INTELLIGENCE VIEW */}
            {activeAirport && !activeRoute && hubStats && (
              <div className="space-y-5">
                <div className="flex items-start justify-between border-b border-stone-800 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-semibold flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-sky-400" />
                      Airport Hub Intelligence
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">
                      {activeAirport.city} ({activeAirport.code})
                    </h3>
                    <p className="text-xs text-stone-400">{activeAirport.state} · {activeAirport.region} Region</p>
                  </div>
                  <button
                    onClick={() => setSelectedAirportCode(null)}
                    className="text-stone-400 hover:text-white p-1 rounded-md hover:bg-stone-800 transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div className="bg-stone-800/80 border border-stone-700/60 rounded-lg p-3">
                    <span className="text-[10px] font-sans text-stone-400 uppercase tracking-wider block">
                      Average Outbound Departure Tariff
                    </span>
                    <span className="text-2xl font-bold text-white block mt-0.5">
                      {formatINR(hubStats.avgFare)}
                    </span>
                    <span className="text-[11px] text-stone-400 font-sans block mt-1">
                      Computed across {hubStats.count} active monitored corridors
                    </span>
                  </div>

                  {hubStats.busiest && (
                    <div className="bg-stone-800/60 border border-stone-700/40 rounded p-2.5">
                      <span className="text-[10px] font-sans text-stone-400 uppercase block">Highest Volume Sector</span>
                      <span className="text-sm font-bold text-sky-300 block">
                        {hubStats.busiest.origin} ➔ {hubStats.busiest.destination}
                      </span>
                      <span className="text-[10px] text-stone-400 font-sans">
                        {hubStats.busiest.observations?.toLocaleString('en-IN')} monitored fare samples
                      </span>
                    </div>
                  )}

                  {hubStats.lowest && (
                    <div className="bg-stone-800/60 border border-stone-700/40 rounded p-2.5">
                      <span className="text-[10px] font-sans text-stone-400 uppercase block">Lowest Fare Destination</span>
                      <span className="text-sm font-bold text-emerald-400 block">
                        {hubStats.lowest.origin} ➔ {hubStats.lowest.destination} ({formatINR(hubStats.lowest.averageFare || hubStats.lowest.avgFare)})
                      </span>
                    </div>
                  )}

                  {/* Connected Corridors List */}
                  <div>
                    <span className="text-[10px] font-sans text-stone-400 uppercase tracking-wider block mb-1.5">
                      Connected Corridors ({hubStats.count})
                    </span>
                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {hubStats.connected.map((conn) => (
                        <button
                          key={conn.id || conn.routeId}
                          onClick={() => handleSelectRoute(conn.id || conn.routeId)}
                          className="w-full text-left px-2.5 py-1.5 rounded bg-stone-800/50 hover:bg-stone-700/80 border border-stone-700/30 flex items-center justify-between text-[11px] transition"
                        >
                          <span className="text-stone-300 font-bold">
                            {conn.origin} ➔ {conn.destination}
                          </span>
                          <span className={conn.momChange > 0 ? 'text-rose-400' : 'text-emerald-400'}>
                            {formatINR(conn.averageFare || conn.avgFare)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => setSelectedAirportCode(null)}
                    className="btn w-full bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs flex items-center justify-center gap-1.5 py-2 rounded-lg border border-stone-700 transition"
                  >
                    <span>Clear Hub Focus</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
