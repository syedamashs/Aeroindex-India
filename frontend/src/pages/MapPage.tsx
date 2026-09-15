import { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { apiMap, type ApiRouteStats } from '@/lib/api';
import {
  Map as MapIcon, Route as RouteIcon, ShieldCheck, Radio, Activity,
} from 'lucide-react';
import L from 'leaflet';
import { RadarScanner } from '@/components/animation/RadarScanner';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { motion, AnimatePresence } from 'framer-motion';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function routeColor(momChange: number): string {
  if (momChange > 5) return '#f43f5e'; // rose - significant increase
  if (momChange > 1.5) return '#f59e0b'; // amber - moderate increase
  if (momChange < -1.5) return '#10b981'; // emerald - decrease
  return '#10b981'; // emerald - stable
}

function volatilityWeight(volatility: number, maxVolatility: number): number {
  return 2 + (volatility / maxVolatility) * 4;
}

export function MapPage() {
  const { filters, lastUpdate } = useApp();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showVolatility, setShowVolatility] = useState(true);
  const [showRadarHUD, setShowRadarHUD] = useState(false);

  const [airports, setAirports] = useState<Array<{ code: string; city: string; state: string; lat: number; lng: number; region: string }>>([]);
  const [routeStats, setRouteStats] = useState<Array<ApiRouteStats & { id: string; avgFare: number }>>([]);

  useEffect(() => {
    apiMap({
      origin: filters.origin !== 'all' ? filters.origin : undefined,
      destination: filters.destination !== 'all' ? filters.destination : undefined,
      airline: filters.airline !== 'all' ? filters.airline : undefined,
      preset: filters.preset,
      customStart: filters.customStart,
      customEnd: filters.customEnd,
    }).then((response) => {
      setAirports(response.data.airports);
      setRouteStats(response.data.routes);
    }).catch((error) => console.error('Failed to fetch map data:', error));
  }, [filters, lastUpdate]);

  const airportMap = useMemo(() => new Map(airports.map((airport) => [airport.code, airport])), [airports]);
  const statsMap = useMemo(
    () => new Map(routeStats.map((r) => [r.routeId, r])),
    [routeStats],
  );

  const maxVolatility = useMemo(
    () => Math.max(...routeStats.map((r) => r.volatility), 1000),
    [routeStats],
  );

  const fareRange = useMemo(() => {
    if (!routeStats.length) return { min: 0, max: 0 };
    const fares = routeStats.map((r) => r.averageFare);
    return { min: Math.min(...fares), max: Math.max(...fares) };
  }, [routeStats]);

  const regions = useMemo(() => {
    const uniqueRegions = new Set<string>();
    airports.forEach((a) => uniqueRegions.add(a.region));
    return Array.from(uniqueRegions).sort();
  }, [airports]);

  const filteredRoutes = useMemo(() => {
    if (!selectedRegion) return routeStats;
    return routeStats.filter((route) => {
      const originRegion = airportMap.get(route.origin)?.region;
      const destRegion = airportMap.get(route.destination)?.region;
      return originRegion === selectedRegion || destRegion === selectedRegion;
    });
  }, [selectedRegion, routeStats, airportMap]);

  const regionalStats = useMemo(() => {
    const stats: Record<string, { routes: number; avgFare: number; avgChange: number }> = {};
    regions.forEach((r) => {
      stats[r] = { routes: 0, avgFare: 0, avgChange: 0 };
    });

    routeStats.forEach((rs) => {
      const originRegion = airportMap.get(rs.origin)?.region || 'Central';
      const destRegion = airportMap.get(rs.destination)?.region || 'Central';

      if (!stats[originRegion]) stats[originRegion] = { routes: 0, avgFare: 0, avgChange: 0 };
      stats[originRegion].routes++;
      stats[originRegion].avgFare += rs.averageFare;
      stats[originRegion].avgChange += rs.momChange;

      if (originRegion !== destRegion) {
        if (!stats[destRegion]) stats[destRegion] = { routes: 0, avgFare: 0, avgChange: 0 };
        stats[destRegion].routes++;
        stats[destRegion].avgFare += rs.averageFare;
        stats[destRegion].avgChange += rs.momChange;
      }
    });

    Object.keys(stats).forEach((region) => {
      if (stats[region].routes > 0) {
        stats[region].avgFare = Math.round(stats[region].avgFare / stats[region].routes);
        stats[region].avgChange = Math.round((stats[region].avgChange / stats[region].routes) * 10) / 10;
      }
    });

    return stats;
  }, [routeStats, regions, airportMap]);

  const center: [number, number] = [22.5, 80];

  return (
    <div className="animate-fade-in space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-6 lg:p-8 shadow-xl border border-navy-700/60">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                GEOSPATIAL AIR CORRIDOR RADAR
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                India Domestic Flight Density Network
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              India Airfare Movement Map
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Interactive geographic visualization of domestic route pricing dynamics, regional tariff variance, and price surge corridors.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <button
              onClick={() => setShowRadarHUD(!showRadarHUD)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all backdrop-blur-sm active:scale-95 ${
                showRadarHUD
                  ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 ring-2 ring-emerald-500/20'
                  : 'bg-white/10 hover:bg-white/20 border-white/15 text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5 text-emerald-400" />
              <span>{showRadarHUD ? 'Hide Radar HUD' : 'Launch ATC Radar HUD'}</span>
            </button>

            <div className="flex items-center gap-3 bg-navy-900/80 p-3 rounded-2xl border border-navy-700">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
                <span>Stable / Low</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span>Moderate</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block" />
                <span>Surge Spike</span>
              </div>
            </div>
          </div>
        </div>

        {/* Expandable Radar HUD */}
        {showRadarHUD && (
          <div className="relative z-10 mt-6 p-6 rounded-2xl bg-navy-950/95 border border-emerald-500/30 flex flex-col md:flex-row items-center justify-around gap-6 shadow-2xl animate-fade-in">
            <RadarScanner size={260} />
            <div className="max-w-md space-y-2 text-xs">
              <h4 className="font-display font-bold text-white text-sm flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span>Live Indian Airspace Surveillance Vector</span>
              </h4>
              <p className="text-slate-300 leading-relaxed">
                Visualizing active commercial flight vectors across India. Concentric range rings map major metro trunk nodes (DEL, BOM, BLR, CCU, HYD, MAA, GOI) with continuous 360° frequency radar tracking.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Filter Toolbar */}
      <div className="glass-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filter by Geographical Zone</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setSelectedRegion(null)}
                className={`pill-tab ${selectedRegion === null ? 'pill-tab-active' : 'pill-tab-inactive'}`}
              >
                All Zones ({routeStats.length} Routes)
              </button>
              {regions.map((region) => (
                <button
                  key={region}
                  onClick={() => setSelectedRegion(region)}
                  className={`pill-tab ${selectedRegion === region ? 'pill-tab-active' : 'pill-tab-inactive'}`}
                >
                  {region}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showVolatility}
                onChange={() => setShowVolatility(!showVolatility)}
                className="w-4 h-4 rounded text-navy-600 focus:ring-navy-500"
              />
              <span>Volatility Line Thickness</span>
            </label>
          </div>
        </div>
      </div>

      {/* Map & Detail Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map Container (8 Cols) */}
        <div className="lg:col-span-8 glass-card p-0 overflow-hidden shadow-md">
          <div style={{ height: '620px' }} className="w-full">
            <MapContainer center={center} zoom={5} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap &copy; CARTO'
              />

              {/* Route lines */}
              {filteredRoutes.map((route) => {
                const o = airportMap.get(route.origin);
                const d = airportMap.get(route.destination);
                const stats = statsMap.get(route.routeId);
                if (!o || !d || !stats) return null;
                const color = routeColor(stats.momChange);
                const isSelected = selectedRoute === route.routeId;
                const weight = showVolatility && Number.isFinite(maxVolatility) && maxVolatility > 0
                  ? volatilityWeight(stats.volatility, maxVolatility)
                  : 3;

                return (
                  <Polyline
                    key={route.routeId}
                    positions={[[o.lat, o.lng], [d.lat, d.lng]]}
                    color={isSelected ? '#0f172a' : color}
                    weight={isSelected ? weight + 3 : weight}
                    opacity={isSelected ? 1 : 0.75}
                    eventHandlers={{
                      click: () => setSelectedRoute(route.routeId),
                    }}
                  >
                    <LeafletTooltip sticky>
                      <div className="text-xs font-sans">
                        <strong className="text-navy-950 font-bold">{route.origin} → {route.destination}</strong>
                        <div>Avg: <strong className="font-mono">{formatINR(stats.averageFare)}</strong></div>
                        <div>MoM: <strong className="font-mono">{formatPercent(stats.momChange)}</strong></div>
                      </div>
                    </LeafletTooltip>
                  </Polyline>
                );
              })}

              {/* Airport hub markers */}
              {airports.map((airport) => (
                <CircleMarker
                  key={airport.code}
                  center={[airport.lat, airport.lng]}
                  radius={6}
                  fillColor="#0f1d38"
                  color="#ffffff"
                  weight={2}
                  opacity={1}
                  fillOpacity={0.9}
                >
                  <Popup>
                    <div className="text-xs font-sans space-y-1">
                      <strong className="text-navy-950 font-bold text-sm">{airport.city} ({airport.code})</strong>
                      <p className="text-slate-600">{airport.state} • {airport.region} Region</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>
        </div>

        {/* Sidebar Info & Region Stats (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          {/* Selected Route Inspector */}
          {selectedRoute && statsMap.get(selectedRoute) ? (
            (() => {
              const stats = statsMap.get(selectedRoute)!;
              const route = filteredRoutes.find((r) => r.routeId === selectedRoute);
              if (!route) return null;
              const isSurge = stats.momChange > 1.5;
              const isDrop = stats.momChange < -1.5;

              return (
                <div className="glass-card p-5 border-t-4 border-t-navy-900 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Corridor</span>
                    <button onClick={() => setSelectedRoute(null)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
                  </div>
                  <h3 className="text-lg font-display font-extrabold text-navy-950">
                    {route.origin} → {route.destination}
                  </h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-slate-500 font-medium">Average Fare</p>
                      <p className="text-base font-mono font-bold text-navy-950">{formatINR(stats.averageFare)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-slate-500 font-medium">Index Score</p>
                      <p className="text-base font-mono font-bold text-navy-950">{stats.index.toFixed(1)}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-slate-500 font-medium">MoM Shift</p>
                      <p className={`text-base font-mono font-bold ${isSurge ? 'text-rose-600' : isDrop ? 'text-emerald-600' : 'text-slate-700'}`}>
                        {formatPercent(stats.momChange)}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="text-slate-500 font-medium">Observations</p>
                      <p className="text-base font-mono font-bold text-navy-950">{stats.observations.toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="glass-card p-5 text-center space-y-2">
              <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-700 flex items-center justify-center mx-auto">
                <RouteIcon className="w-5 h-5" />
              </div>
              <h4 className="font-display font-bold text-sm text-navy-950">Corridor Inspector</h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Click any colored corridor polyline on the map to inspect real-time pricing, volatility standard deviation, and regional bounds.
              </p>
            </div>
          )}

          {/* Regional Summary List */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h4 className="font-display font-bold text-sm text-navy-950">Regional Pricing Overview</h4>
              <span className="text-[11px] text-slate-500">{regions.length} Zones</span>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {regions.map((region) => {
                const stats = regionalStats[region];
                if (!stats || stats.routes === 0) return null;
                const isSurge = stats.avgChange > 0;
                return (
                  <div
                    key={region}
                    onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      selectedRegion === region
                        ? 'border-navy-900 bg-navy-50 text-navy-950'
                        : 'border-slate-100 bg-slate-50/60 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-navy-900">{region} Region</span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white border border-slate-200">
                        {stats.routes} routes
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600 font-mono font-medium">
                        Avg <AnimatedCounter value={stats.avgFare} prefix="₹" />
                      </span>
                      <span className={`font-mono font-bold ${isSurge ? 'text-rose-600' : 'text-emerald-600'}`}>
                        MoM {formatPercent(stats.avgChange)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
