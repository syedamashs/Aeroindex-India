import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { apiAirlines, apiMap } from '@/lib/api';
import { Calendar, Plane, Building2, Armchair, Clock, RotateCcw } from 'lucide-react';
import type { DatePreset } from '@/data/types';

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All Available Data' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 3 Months' },
  { value: '180d', label: 'Last 6 Months' },
  { value: 'custom', label: 'Custom Range' },
];

export function FilterBar() {
  const { filters, setFilters, resetFilters } = useApp();
  const [airports, setAirports] = useState<Array<{ code: string; city: string }>>([]);
  const [airlines, setAirlines] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    Promise.all([apiMap(), apiAirlines()]).then(([map, airlineResponse]) => {
      setAirports(map.data.airports.map(({ code, city }) => ({ code, city })));
      const uniqueAirlines = Array.from(
        new Map(airlineResponse.data.map(({ code, name }) => [code, { code, name }])).values()
      );
      setAirlines(uniqueAirlines);
    }).catch(() => {
      setAirports([]);
      setAirlines([]);
    });
  }, []);

  return (
    <div className="card p-4 mb-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Calendar className="w-3 h-3" /> Date Range
          </label>
          <select
            className="select min-w-[140px]"
            value={filters.preset}
            onChange={(e) => setFilters({ preset: e.target.value as DatePreset })}
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {filters.preset === 'custom' && (
          <>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">Start</label>
              <input
                type="date"
                className="input"
                value={filters.customStart}
                onChange={(e) => setFilters({ customStart: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-500">End</label>
              <input
                type="date"
                className="input"
                value={filters.customEnd}
                onChange={(e) => setFilters({ customEnd: e.target.value })}
              />
            </div>
          </>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Plane className="w-3 h-3" /> Origin
          </label>
          <select
            className="select min-w-[120px]"
            value={filters.origin}
            onChange={(e) => setFilters({ origin: e.target.value })}
          >
            <option value="all">All Origins</option>
            {airports.map((a) => (
              <option key={a.code} value={a.code}>{a.city} ({a.code})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Plane className="w-3 h-3" /> Destination
          </label>
          <select
            className="select min-w-[120px]"
            value={filters.destination}
            onChange={(e) => setFilters({ destination: e.target.value })}
          >
            <option value="all">All Destinations</option>
            {airports.map((a) => (
              <option key={a.code} value={a.code}>{a.city} ({a.code})</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Building2 className="w-3 h-3" /> Airline
          </label>
          <select
            className="select min-w-[120px]"
            value={filters.airline}
            onChange={(e) => setFilters({ airline: e.target.value })}
          >
            <option value="all">All Airlines</option>
            {airlines.map((a) => (
              <option key={a.code} value={a.code}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Armchair className="w-3 h-3" /> Travel Class
          </label>
          <select
            className="select min-w-[120px]"
            value={filters.travelClass}
            onChange={(e) => setFilters({ travelClass: e.target.value })}
          >
            <option value="all">All Classes</option>
            <option value="Economy">Economy</option>
            <option value="Premium Economy">Premium Economy</option>
            <option value="Business">Business</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 flex items-center gap-1">
            <Clock className="w-3 h-3" /> Booking Window
          </label>
          <select
            className="select min-w-[120px]"
            value={filters.bookingWindow}
            onChange={(e) => setFilters({ bookingWindow: e.target.value })}
          >
            <option value="all">All Windows</option>
            <option value="1">T+1 (1 day)</option>
            <option value="7">T+7 (7 days)</option>
            <option value="15">T+15 (15 days)</option>
            <option value="30">T+30 (30 days)</option>
            <option value="45">T+45 (45 days)</option>
          </select>
        </div>

        <button className="btn-ghost" onClick={resetFilters} title="Reset filters">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
      </div>
    </div>
  );
}
