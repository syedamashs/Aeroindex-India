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

export function MapPage() {
  const { lastUpdate } = useApp();
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  const routeStats = useMemo(() => computeRouteStats(), [lastUpdate]);
  const statsMap = useMemo(
    () => new Map(routeStats.map((r) => [r.routeId, r])),
    [routeStats],
  );

  const center: [number, number] = [22.5, 80];

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">India Airfare Movement Map</h1>
        <p className="text-slate-500 mt-1">Interactive geographic visualization of domestic airfare movements</p>
      </div>

      {/* Legend */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-6 text-sm">
          <span className="font-medium text-slate-600">Route Color Legend:</span>
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
          <div className="flex items-center gap-2 ml-auto">
            <div className="w-3 h-3 rounded-full bg-navy-700 border-2 border-white shadow"></div>
            <span className="text-slate-600">Airport</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card bodyClassName="p-0 overflow-hidden">
            <div style={{ height: '600px' }} className="rounded-xl overflow-hidden">
              <MapContainer center={center} zoom={5} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; OpenStreetMap &copy; CARTO'
                />

                {/* Route lines */}
                {ROUTES.map((route) => {
                  const o = AIRPORT_MAP[route.origin];
                  const d = AIRPORT_MAP[route.destination];
                  const stats = statsMap.get(route.id);
                  if (!stats) return null;
                  const color = routeColor(stats.momChange);
                  const isSelected = selectedRoute === route.id;

                  return (
                    <Polyline
                      key={route.id}
                      positions={[[o.lat, o.lng], [d.lat, d.lng]]}
                      pathOptions={{
                        color,
                        weight: isSelected ? 5 : 3,
                        opacity: isSelected ? 1 : 0.7,
                      }}
                      eventHandlers={{
                        click: () => setSelectedRoute(route.id),
                      }}
                    >
                      <LeafletTooltip>
                        <div className="text-xs">
                          <strong>{getAirportLabel(route.origin)} → {getAirportLabel(route.destination)}</strong>
                          <br />Avg: {formatINR(stats.averageFare)} | MoM: {formatPercent(stats.momChange)}
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
                    radius={6}
                    pathOptions={{
                      color: '#15294d',
                      fillColor: '#244680',
                      fillOpacity: 0.9,
                      weight: 2,
                    }}
                  >
                    <Popup>
                      <div className="text-sm">
                        <strong>{airport.city}</strong> ({airport.code})
                        <br />
                        <span className="text-slate-500">{airport.state}</span>
                        <br />
                        <span className="text-slate-500">Region: {airport.region}</span>
                      </div>
                    </Popup>
                    <LeafletTooltip>
                      <strong>{airport.city} ({airport.code})</strong>
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
            <Card title="Selected Route" subtitle="Click another route to inspect">
              {(() => {
                const stats = statsMap.get(selectedRoute);
                const route = ROUTES.find((r) => r.id === selectedRoute)!;
                if (!stats) return <p>No data available.</p>;
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="text-lg font-display font-bold text-navy-900">
                        {getAirportLabel(route.origin)} → {getAirportLabel(route.destination)}
                      </p>
                      <p className="text-xs text-slate-500">{route.origin}-{route.destination} • {route.distanceKm} km</p>
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
                        <p className="text-xs text-slate-500">Monthly Change</p>
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
                      <p className="text-xs text-slate-500">Volatility</p>
                      <p className="text-lg font-mono font-semibold text-navy-900">{formatINR(stats.volatility)}</p>
                    </div>
                  </div>
                );
              })()}
            </Card>
          ) : (
            <Card title="Route Information" subtitle="Click a route on the map to see details">
              <p className="text-sm text-slate-500">
                Click any colored route line or airport marker on the map to view detailed airfare information including
                average fare, index, monthly change, and observation count.
              </p>
            </Card>
          )}

          <Card title="Regional Summary" subtitle="Route count by trend">
            <div className="space-y-2">
              {[
                { label: 'Significant Increase', count: routeStats.filter((r) => r.momChange > 5).length, color: 'bg-danger-500' },
                { label: 'Moderate Increase', count: routeStats.filter((r) => r.momChange > 1.5 && r.momChange <= 5).length, color: 'bg-warning-500' },
                { label: 'Stable', count: routeStats.filter((r) => r.momChange >= -1.5 && r.momChange <= 1.5).length, color: 'bg-slate-400' },
                { label: 'Decreasing', count: routeStats.filter((r) => r.momChange < -1.5).length, color: 'bg-success-500' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${item.color}`}></div>
                    <span className="text-sm text-slate-600">{item.label}</span>
                  </div>
                  <span className="text-sm font-mono font-semibold text-navy-900">{item.count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
