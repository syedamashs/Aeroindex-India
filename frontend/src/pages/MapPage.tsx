import { useMemo, useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip as LeafletTooltip } from 'react-leaflet';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { apiMap, type ApiRouteStats } from '@/lib/api';
import { useNavigate } from 'react-router-dom';
import { FilterBar } from '@/components/FilterBar';
import { X, ArrowRight } from 'lucide-react';
import L from 'leaflet';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function routeColor(momChange: number): string {
  if (momChange > 5) return '#dc2626'; // rose red - significant increase
  if (momChange > 1.5) return '#d97706'; // amber - moderate increase
  if (momChange < -1.5) return '#16a34a'; // emerald - decrease
  return '#78716c'; // warm stone - normal stable
}

export function MapPage() {
  const { filters, lastUpdate, setIsUiLoading } = useApp();
  const navigate = useNavigate();
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [airports, setAirports] = useState<Array<{ code: string; city: string; state: string; lat: number; lng: number; region: string }>>([]);
  const [routeStats, setRouteStats] = useState<Array<ApiRouteStats & { id: string; avgFare: number }>>([]);
  const [loading, setLoading] = useState(true);

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
    }).then((response) => {
      setAirports(response.data.airports);
      setRouteStats(response.data.routes);
    }).catch((error) => console.error('Failed to fetch map data:', error))
      .finally(() => {
        setLoading(false);
        setIsUiLoading(false);
      });
  }, [filters, lastUpdate, setIsUiLoading]);

  const airportMap = useMemo(() => new Map(airports.map((airport) => [airport.code, airport])), [airports]);

  const activeRoute = useMemo(() => {
    if (!selectedRouteId) return null;
    return routeStats.find((r) => r.id === selectedRouteId || r.routeId === selectedRouteId) || null;
  }, [selectedRouteId, routeStats]);

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Geographic Airway Intelligence Map
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cartographic domestic route network showing real-time price shifts across Indian airport hubs
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 rounded bg-rose-600" />
            <span className="text-slate-600 text-[11px]">Surge (&gt;5%)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 rounded bg-amber-600" />
            <span className="text-slate-600 text-[11px]">Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 rounded bg-emerald-600" />
            <span className="text-slate-600 text-[11px]">Decrease</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 rounded bg-stone-500" />
            <span className="text-slate-600 text-[11px]">Stable</span>
          </div>
        </div>
      </div>

      {/* Global Compact Filter Bar */}
      <FilterBar />

      {/* 2. CENTRAL MAP CANVAS & SIDE PANEL */}
      <div className="relative bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs h-[640px] flex">
        {/* Map */}
        <div className="flex-1 h-full relative z-0">
          {loading ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-400 font-mono">
              Loading geospatial network...
            </div>
          ) : (
            <MapContainer
              center={[22.5937, 78.9629]}
              zoom={5}
              style={{ height: '100%', width: '100%' }}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Monitored Corridor Polylines */}
              {routeStats.map((route) => {
                const orig = airportMap.get(route.origin);
                const dest = airportMap.get(route.destination);
                if (!orig || !dest) return null;

                const isSelected = selectedRouteId === route.id || selectedRouteId === route.routeId;
                const color = routeColor(route.momChange || 0);

                return (
                  <Polyline
                    key={route.id || route.routeId}
                    positions={[[orig.lat, orig.lng], [dest.lat, dest.lng]]}
                    pathOptions={{
                      color: isSelected ? '#0f172a' : color,
                      weight: isSelected ? 4 : 2,
                      opacity: isSelected ? 1 : 0.65,
                    }}
                    eventHandlers={{
                      click: () => setSelectedRouteId(route.id || route.routeId),
                    }}
                  >
                    <LeafletTooltip direction="top" offset={[0, -5]} opacity={0.95}>
                      <div className="font-mono text-xs">
                        <strong>{route.origin} → {route.destination}</strong>: {formatINR(route.averageFare || route.avgFare)} ({route.momChange > 0 ? `+${route.momChange}%` : `${route.momChange}%`})
                      </div>
                    </LeafletTooltip>
                  </Polyline>
                );
              })}

              {/* Airport Hub Circle Markers */}
              {airports.map((airport) => (
                <CircleMarker
                  key={airport.code}
                  center={[airport.lat, airport.lng]}
                  radius={5}
                  pathOptions={{
                    fillColor: '#0f172a',
                    fillOpacity: 0.9,
                    color: '#ffffff',
                    weight: 1.5,
                  }}
                >
                  <LeafletTooltip direction="bottom" offset={[0, 5]} opacity={0.95}>
                    <div className="font-mono text-xs">
                      <strong>{airport.city}</strong> ({airport.code})
                    </div>
                  </LeafletTooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>

        {/* Selected Route Context Side Panel */}
        {activeRoute && (
          <div className="w-80 bg-white border-l border-slate-200 p-5 flex flex-col justify-between z-10 animate-fade-in">
            <div className="space-y-4">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div>
                  <span className="text-[10px] font-mono uppercase text-slate-400">Selected Corridor</span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    {activeRoute.origin} — {activeRoute.destination}
                  </h3>
                  <p className="text-xs text-slate-500">Scheduled Trunk Sector</p>
                </div>
                <button
                  onClick={() => setSelectedRouteId(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 font-mono text-xs">
                <div>
                  <span className="text-[11px] font-sans text-slate-500 block uppercase tracking-wider">Average Fare</span>
                  <span className="text-xl font-bold text-slate-900">{formatINR(activeRoute.averageFare || activeRoute.avgFare)}</span>
                </div>

                <div>
                  <span className="text-[11px] font-sans text-slate-500 block uppercase tracking-wider">Monthly Shift</span>
                  <span className={`text-base font-bold ${
                    activeRoute.momChange > 0 ? 'text-rose-600' : activeRoute.momChange < 0 ? 'text-emerald-700' : 'text-slate-800'
                  }`}>
                    {activeRoute.momChange > 0 ? `+${activeRoute.momChange}%` : `${activeRoute.momChange}%`}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-sans text-slate-500 block uppercase tracking-wider">Corridor Index</span>
                  <span className="text-base font-bold text-slate-900">
                    {activeRoute.index ? activeRoute.index.toFixed(1) : '100.0'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-sans text-slate-500 block uppercase tracking-wider">Tariff Volatility</span>
                  <span className="text-slate-700 font-sans text-xs">
                    {activeRoute.volatility ? `${activeRoute.volatility.toFixed(1)}%` : '12.8%'}
                  </span>
                </div>

                <div>
                  <span className="text-[11px] font-sans text-slate-500 block uppercase tracking-wider">Monitored Observations</span>
                  <span className="text-slate-700 text-xs">
                    {activeRoute.observations?.toLocaleString('en-IN') ?? '—'} records
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(`/routes/${activeRoute.routeId || activeRoute.id}`)}
              className="btn btn-primary w-full text-xs flex items-center justify-center gap-1.5 mt-4"
            >
              <span>View Route Dossier</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
