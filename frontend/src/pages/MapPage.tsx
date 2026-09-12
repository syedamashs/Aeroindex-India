import { useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, CircleMarker, Popup, Tooltip as LeafletTooltip } from 'react-leaflet';
import { Card } from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { computeRouteStats, getAirportLabel } from '@/data/analytics';
import { AIRPORTS, AIRPORT_MAP } from '@/data/airports';
import { ROUTES } from '@/data/routes';
import { formatINR, formatPercent } from '@/data/random';
import L from 'leaflet';

// Fix Leaflet default icon issue
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function routeColor(momChange: number): string {
  if (momChange > 5) return '#dc2626'; // red - significant increase
  if (momChange > 1.5) return '#f59e0b'; // yellow - moderate increase
  if (momChange < -1.5) return '#16a34a'; // green - decrease
  return '#16a34a'; // green - stable
}

function volatilityWeight(volatility: number, maxVolatility: number): number {
  // Scale weight from 2 to 6 based on volatility
  return 2 + (volatility / maxVolatility) * 4;
}

function priceLevel(averageFare: number, minFare: number, maxFare: number): 'low' | 'medium' | 'high' {
  const range = maxFare - minFare;
  const mid = minFare + range / 2;
  if (averageFare < mid) return 'low';
  if (averageFare > minFare + (range * 2 / 3)) return 'high';
  return 'medium';
}

function distanceBadge(distanceKm: number): string {
  if (distanceKm < 700) return '🔵 Short';
  if (distanceKm < 1400) return '🟡 Medium';
  return '🔴 Long';
}

export function MapPage() {
  const { lastUpdate } = useApp();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showVolatility, setShowVolatility] = useState(true);

  const routeStats = useMemo(() => computeRouteStats(), [lastUpdate]);
  const statsMap = useMemo(
    () => new Map(routeStats.map((r) => [r.routeId, r])),
    [routeStats],
  );

  // Calculate max volatility for scaling
  const maxVolatility = useMemo(
    () => Math.max(...routeStats.map((r) => r.volatility)),
    [routeStats],
  );

  // Calculate fare range for price levels
  const fareRange = useMemo(() => {
    const fares = routeStats.map((r) => r.averageFare);
    return { min: Math.min(...fares), max: Math.max(...fares) };
  }, [routeStats]);

  // Get unique regions
  const regions = useMemo(() => {
    const uniqueRegions = new Set<string>();
    AIRPORTS.forEach((a) => uniqueRegions.add(a.region));
    return Array.from(uniqueRegions).sort();
  }, []);

  // Filter routes based on selected region
  const filteredRoutes = useMemo(() => {
    if (!selectedRegion) return ROUTES;
    return ROUTES.filter((route) => {
      const originRegion = AIRPORT_MAP[route.origin].region;
      const destRegion = AIRPORT_MAP[route.destination].region;
      return originRegion === selectedRegion || destRegion === selectedRegion;
    });
  }, [selectedRegion]);

  // Regional statistics
  const regionalStats = useMemo(() => {
    const stats: Record<string, { routes: number; avgFare: number; avgChange: number }> = {};
    regions.forEach((r) => {
      stats[r] = { routes: 0, avgFare: 0, avgChange: 0 };
    });
    
    routeStats.forEach((rs) => {
      const route = ROUTES.find((r) => r.id === rs.routeId)!;
      const originRegion = AIRPORT_MAP[route.origin].region;
      const destRegion = AIRPORT_MAP[route.destination].region;
      
      stats[originRegion].routes++;
      stats[originRegion].avgFare += rs.averageFare;
      stats[originRegion].avgChange += rs.momChange;
      
      if (originRegion !== destRegion) {
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
  }, [routeStats, regions]);

  const center: [number, number] = [22.5, 80];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">India Airfare Movement Map</h1>
        <p className="text-slate-500 mt-1">Interactive geographic visualization of domestic airfare movements with volatility, regional analysis, and price levels</p>
      </div>

      {/* Enhanced Legend */}
      <Card className="mb-4">
        <div className="space-y-3">
          <div>
            <p className="font-medium text-slate-700 mb-2">Price Trend (Line Color):</p>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded bg-success-500"></div>
                <span className="text-slate-600">Decreasing / Stable</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded bg-warning-500"></div>
                <span className="text-slate-600">Moderate Increase</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-1 rounded bg-danger-500"></div>
                <span className="text-slate-600">Significant Increase</span>
              </div>
            </div>
          </div>
          <div>
            <p className="font-medium text-slate-700 mb-2">Route Distance:</p>
            <div className="flex flex-wrap items-center gap-6 text-sm">
              <span className="text-slate-600">🔵 Short (&lt;700 km) | 🟡 Medium (700-1399 km) | 🔴 Long (≥1400 km)</span>
            </div>
          </div>
          <div>
            <p className="font-medium text-slate-700 mb-2">Line Thickness:</p>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-slate-600">Thicker lines = Higher volatility (price variability)</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-navy-700 border-2 border-white shadow"></div>
            <span className="text-sm text-slate-600">Airport hub</span>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card className="mb-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Filter by Region</label>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedRegion(null)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                    selectedRegion === null
                      ? 'bg-navy-900 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  All Regions
                </button>
                {regions.map((region) => (
                  <button
                    key={region}
                    onClick={() => setSelectedRegion(region)}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      selectedRegion === region
                        ? 'bg-navy-900 text-white'
                        : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                    }`}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showVolatility}
                  onChange={() => setShowVolatility(!showVolatility)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium text-slate-700">Show Volatility (Line Width)</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card bodyClassName="p-0 overflow-hidden">
            <div style={{ height: '650px' }} className="rounded-xl overflow-hidden">
              <MapContainer center={center} zoom={5} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap &copy; CARTO'
                />

                {/* Route lines */}
                {filteredRoutes.map((route) => {
                  const o = AIRPORT_MAP[route.origin];
                  const d = AIRPORT_MAP[route.destination];
                  const stats = statsMap.get(route.id);
                  if (!stats) return null;
                  const color = routeColor(stats.momChange);
                  const isSelected = selectedRoute === route.id;
                  const weight = showVolatility ? volatilityWeight(stats.volatility, maxVolatility) : 3;

                  return (
                    <Polyline
                      key={route.id}
                      positions={[[o.lat, o.lng], [d.lat, d.lng]]}
                      pathOptions={{
                        color,
                        weight: isSelected ? weight + 2 : weight,
                        opacity: isSelected ? 1 : 0.7,
                      }}
                      eventHandlers={{
                        click: () => setSelectedRoute(route.id),
                      }}
                    >
                      <LeafletTooltip>
                        <div className="text-xs font-medium">
                          <strong>{getAirportLabel(route.origin)} → {getAirportLabel(route.destination)}</strong>
                          <br />
                          <span>{route.distanceKm} km • {distanceBadge(route.distanceKm)}</span>
                          <br />
                          <span>Avg: {formatINR(stats.averageFare)}</span>
                          <br />
                          <span>MoM: {formatPercent(stats.momChange)}</span>
                          <br />
                          <span>Volatility: {formatINR(stats.volatility)}</span>
                        </div>
                      </LeafletTooltip>
                    </Polyline>
                  );
                })}

                {/* Airport markers */}
                {AIRPORTS.map((airport) => (
                  <CircleMarker
                    key={airport.code}
                    center={[airport.lat, airport.lng]}
                    radius={7}
                    pathOptions={{
                      color: '#15294d',
                      fillColor: '#244680',
                      fillOpacity: 0.95,
                      weight: 2.5,
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{airport.city}</strong> ({airport.code})
                        <br />
                        <span className="text-slate-500">{airport.state}</span>
                        <br />
                        <span className="text-slate-500 font-medium">Region: {airport.region}</span>
                        <br />
                        <span className="text-xs text-slate-400">Lat: {airport.lat.toFixed(4)}, Lng: {airport.lng.toFixed(4)}</span>
                      </div>
                    </Popup>
                    <LeafletTooltip>
                      <strong>{airport.city} ({airport.code})</strong>
                      <br />
                      <span className="text-xs">{airport.region}</span>
                    </LeafletTooltip>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>
          </Card>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {selectedRoute ? (
            <Card title="Route Details" subtitle="Click another route to inspect">
              {(() => {
                const stats = statsMap.get(selectedRoute);
                const route = ROUTES.find((r) => r.id === selectedRoute)!;
                if (!stats) return <p>No data available.</p>;
                const level = priceLevel(stats.averageFare, fareRange.min, fareRange.max);
                const levelColor = level === 'high' ? 'text-danger-600' : level === 'low' ? 'text-success-600' : 'text-warning-600';
                const levelLabel = level === 'high' ? '💰 High' : level === 'low' ? '💵 Low' : '💴 Medium';

                return (
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-display font-bold text-navy-900">
                        {getAirportLabel(route.origin)} → {getAirportLabel(route.destination)}
                      </p>
                      <p className="text-xs text-slate-500">{route.origin}-{route.destination}</p>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Distance</span>
                        <span className="text-sm font-mono font-semibold text-navy-900">{route.distanceKm} km {distanceBadge(route.distanceKm)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Price Level</span>
                        <span className={`text-sm font-semibold ${levelColor}`}>{levelLabel}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Average Fare</p>
                        <p className="text-lg font-mono font-semibold text-navy-900">{formatINR(stats.averageFare)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Index</p>
                        <p className="text-lg font-mono font-semibold text-navy-900">{stats.index.toFixed(1)}</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">MoM Change</p>
                        <p className={`text-lg font-mono font-semibold ${stats.momChange > 0 ? 'text-danger-600' : 'text-success-600'}`}>
                          {formatPercent(stats.momChange)}
                        </p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3">
                        <p className="text-xs text-slate-500">Observations</p>
                        <p className="text-lg font-mono font-semibold text-navy-900">{stats.observations.toLocaleString('en-IN')}</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3">
                      <p className="text-xs text-slate-500 mb-1">Volatility (Std Dev)</p>
                      <p className="text-lg font-mono font-semibold text-navy-900">{formatINR(stats.volatility)}</p>
                      <div className="mt-2 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-success-500 via-warning-500 to-danger-500 h-full"
                          style={{ width: `${(stats.volatility / maxVolatility) * 100}%` }}
                        ></div>
                      </div>
                    </div>

                    <div className="text-xs text-slate-500 bg-blue-50 rounded-lg p-2">
                      <strong>Route Info:</strong> {getAirportLabel(route.origin)} is in <strong>{AIRPORT_MAP[route.origin].region}</strong> | {getAirportLabel(route.destination)} is in <strong>{AIRPORT_MAP[route.destination].region}</strong>
                    </div>
                  </div>
                );
              })()}
            </Card>
          ) : (
            <Card title="Route Information" subtitle="Click a route on the map to see details">
              <p className="text-sm text-slate-500">
                Click any colored route line to view detailed airfare information including distance, price level, average fare, index, volatility, and regional context.
              </p>
            </Card>
          )}

          {/* Regional Summary */}
          <Card title="Regional Analysis" subtitle={selectedRegion ? `Filtered: ${selectedRegion}` : 'All regions'}>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {regions.map((region) => {
                const stats = regionalStats[region];
                if (stats.routes === 0) return null;
                const changeColor = stats.avgChange > 0 ? 'text-danger-600' : 'text-success-600';
                return (
                  <div
                    key={region}
                    onClick={() => setSelectedRegion(selectedRegion === region ? null : region)}
                    className={`p-3 rounded-lg cursor-pointer transition ${
                      selectedRegion === region ? 'bg-navy-100 border-2 border-navy-900' : 'bg-slate-50 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-slate-700">{region}</span>
                      <span className="text-xs bg-slate-200 px-2 py-1 rounded-full">{stats.routes} routes</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="text-slate-600">Avg: <strong className="text-navy-900">{formatINR(stats.avgFare)}</strong></div>
                      <div className={`${changeColor}`}>MoM: <strong>{formatPercent(stats.avgChange)}</strong></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Summary Stats */}
          <Card title="Map Summary" subtitle="Global metrics">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Total Routes:</span>
                <strong className="text-navy-900">{filteredRoutes.length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Avg Fare Range:</span>
                <strong className="text-navy-900">{formatINR(fareRange.min)} - {formatINR(fareRange.max)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Max Volatility:</span>
                <strong className="text-navy-900">{formatINR(maxVolatility)}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Increasing:</span>
                <strong className="text-danger-600">{routeStats.filter((r) => r.momChange > 1.5).length}</strong>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Decreasing:</span>
                <strong className="text-success-600">{routeStats.filter((r) => r.momChange < -1.5).length}</strong>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
