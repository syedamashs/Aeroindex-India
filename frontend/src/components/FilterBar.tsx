import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { apiAirlines, apiMap } from '@/lib/api';
import type { DatePreset } from '@/data/types';

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: 'all', label: 'All Observations' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Past 7 Days' },
  { value: '30d', label: 'Past 30 Days' },
  { value: '90d', label: 'Past 90 Days' },
  { value: '180d', label: 'Past 6 Months' },
  { value: 'custom', label: 'Custom Range' },
];

export function FilterBar() {
  const { filters, setFilters, resetFilters } = useApp();
  const [airports, setAirports] = useState<Array<{ code: string; city: string }>>([]);
  const [airlines, setAirlines] = useState<Array<{ code: string; name: string }>>([]);

  useEffect(() => {
    Promise.all([apiMap(), apiAirlines()])
      .then(([map, airlineResponse]) => {
        setAirports(map.data.airports.map(({ code, city }) => ({ code, city })));
        const uniqueAirlines = Array.from(
          new Map(airlineResponse.data.map(({ code, name }) => [code, { code, name }])).values()
        );
        setAirlines(uniqueAirlines);
      })
      .catch(() => {
        setAirports([]);
        setAirlines([]);
      });
  }, []);

  const hasActiveFilters =
    filters.origin !== 'all' ||
    filters.destination !== 'all' ||
    filters.airline !== 'all' ||
    filters.travelClass !== 'all' ||
    filters.bookingWindow !== 'all' ||
    filters.preset !== 'all';

  return (
    <div className="bg-white border border-slate-200 rounded-md px-3.5 py-2.5 mb-6 text-xs shadow-xs">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[11px] font-mono uppercase font-semibold text-slate-400 tracking-wider">
          Filter Horizon:
        </span>

        {/* Period Preset */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">Period</label>
          <select
            className="select py-1 text-xs min-w-[120px]"
            value={filters.preset}
            onChange={(e) => setFilters({ preset: e.target.value as DatePreset })}
          >
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        {/* Custom Range if selected */}
        {filters.preset === 'custom' && (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              className="input py-0.5 text-xs w-28"
              value={filters.customStart}
              onChange={(e) => setFilters({ customStart: e.target.value })}
            />
            <span className="text-slate-400">—</span>
            <input
              type="date"
              className="input py-0.5 text-xs w-28"
              value={filters.customEnd}
              onChange={(e) => setFilters({ customEnd: e.target.value })}
            />
          </div>
        )}

        {/* Origin */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">Origin</label>
          <select
            className="select py-1 text-xs min-w-[100px]"
            value={filters.origin}
            onChange={(e) => setFilters({ origin: e.target.value })}
          >
            <option value="all">All</option>
            {airports.map((a) => (
              <option key={a.code} value={a.code}>{a.city} ({a.code})</option>
            ))}
          </select>
        </div>

        {/* Destination */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">Dest</label>
          <select
            className="select py-1 text-xs min-w-[100px]"
            value={filters.destination}
            onChange={(e) => setFilters({ destination: e.target.value })}
          >
            <option value="all">All</option>
            {airports.map((a) => (
              <option key={a.code} value={a.code}>{a.city} ({a.code})</option>
            ))}
          </select>
        </div>

        {/* Airline */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">Carrier</label>
          <select
            className="select py-1 text-xs min-w-[100px]"
            value={filters.airline}
            onChange={(e) => setFilters({ airline: e.target.value })}
          >
            <option value="all">All</option>
            {airlines.map((a) => (
              <option key={a.code} value={a.code}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* Travel Class */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">Class</label>
          <select
            className="select py-1 text-xs min-w-[90px]"
            value={filters.travelClass}
            onChange={(e) => setFilters({ travelClass: e.target.value })}
          >
            <option value="all">All</option>
            <option value="Economy">Economy</option>
            <option value="Premium Economy">Prem Econ</option>
            <option value="Business">Business</option>
          </select>
        </div>

        {/* Booking Window */}
        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">Booking Window</label>
          <select
            className="select py-1 text-xs min-w-[90px]"
            value={filters.bookingWindow}
            onChange={(e) => setFilters({ bookingWindow: e.target.value })}
          >
            <option value="all">All</option>
            <option value="1">T+1</option>
            <option value="7">T+7</option>
            <option value="15">T+15</option>
            <option value="30">T+30</option>
            <option value="45">T+45</option>
          </select>
        </div>

        {/* Reset */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="text-[11px] text-slate-500 hover:text-slate-800 underline decoration-slate-300 ml-auto cursor-pointer"
          >
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
