import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/data/random';
import {
  Search, Download, ChevronLeft, ChevronRight, ChevronsUpDown,
  Database, ShieldCheck,
} from 'lucide-react';
import { apiAirlines, apiMap, apiObservations, type ApiFilters, type ApiObservation } from '@/lib/api';
import { fireConfetti } from '@/components/animation/confetti';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';

const PAGE_SIZE = 20;

type SortKey = 'id' | 'collectionDate' | 'origin' | 'destination' | 'airline' | 'travelDate' | 'bookingWindow' | 'totalFare' | 'status';

export function DataExplorerPage() {
  const { filters, lastUpdate } = useApp();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [origin, setOrigin] = useState('all');
  const [destination, setDestination] = useState('all');
  const [airline, setAirline] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('collectionDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [data, setData] = useState<{ rows: ApiObservation[]; total: number }>({ rows: [], total: 0 });
  const [airports, setAirports] = useState<Array<{ code: string }>>([]);
  const [airlines, setAirlines] = useState<Array<{ code: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const apiFilters: ApiFilters = {
          origin: origin !== 'all' ? origin : undefined,
          destination: destination !== 'all' ? destination : undefined,
          airline: airline !== 'all' ? airline : undefined,
          status: status !== 'all' ? status : undefined,
          search: search || undefined,
          preset: filters.preset,
          customStart: filters.customStart,
          customEnd: filters.customEnd,
          page,
          pageSize: PAGE_SIZE,
          sortBy: sortBy as string,
          sortDir,
        };
        const res = await apiObservations(apiFilters);
        setData({ rows: res.data.rows, total: res.data.total });
        setLoading(false);

        const [mapRes, airlineRes] = await Promise.all([apiMap(), apiAirlines()]);
        setAirports(mapRes.data.airports);
        setAirlines(airlineRes.data);
      } catch (error) {
        console.error('Failed to fetch observations:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [origin, destination, airline, status, search, page, sortBy, sortDir, filters.preset, filters.customStart, filters.customEnd, lastUpdate]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
    setPage(1);
  };

  const exportCSV = () => {
    const headers = ['Observation ID', 'Collection Date', 'Origin', 'Destination', 'Airline', 'Travel Date', 'Booking Window', 'Travel Class', 'Base Fare', 'Taxes', 'Fees', 'Total Fare', 'Currency', 'Source', 'Status'];
    const rows = data.rows.map((o: ApiObservation) => [
      o.id, o.collectionDate, o.origin, o.destination, o.airline, o.travelDate, o.bookingWindow, o.travelClass, o.baseFare, o.taxes, o.fees, o.totalFare, o.currency, o.source, o.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aeroindex-observations.csv';
    a.click();
    URL.revokeObjectURL(url);
    fireConfetti({ spread: 60, origin: { y: 0.3 } });
  };

  const sortIcon = (key: SortKey) => {
    if (sortBy !== key) return <ChevronsUpDown className="w-3 h-3 text-slate-300 inline ml-1" />;
    return <span className="font-mono text-navy-700 ml-1">{sortDir === 'desc' ? '↓' : '↑'}</span>;
  };

  const statusBadge = (s: string) => {
    if (s === 'valid') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />valid</span>;
    if (s === 'invalid') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><span className="w-1.5 h-1.5 rounded-full bg-rose-500" />invalid</span>;
    if (s === 'duplicate') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />duplicate</span>;
    return <span className="badge badge-slate">{s}</span>;
  };

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const paged = data.rows;

  return (
    <div className="data-explorer-page animate-fade-in space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-800 text-white p-6 lg:p-8 shadow-xl border border-navy-700/60">
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-navy-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                OBSERVATION STORE TERMINAL
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/10 text-navy-200 text-xs font-medium backdrop-blur-sm">
                Production SQLite apix.db
              </span>
            </div>

            <h1 className="font-display font-extrabold text-2xl lg:text-3xl tracking-tight text-white">
              Data Explorer Terminal
            </h1>
            <p className="text-sm text-navy-200 leading-relaxed">
              Low-latency exploration and audit terminal for raw ingested airfare observations, taxes, flight timestamps, and verification status.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-navy-900/80 border border-navy-700 text-xs text-white">
              <span className="text-slate-400">Total Ingest: </span>
              <span className="font-mono font-bold text-accent-400">
                <AnimatedCounter value={data.total} /> rows
              </span>
            </div>

            <button
              onClick={exportCSV}
              disabled={loading || data.rows.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-navy-900 hover:bg-slate-100 text-xs font-bold transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar Glass Card */}
      <div className="glass-card p-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="relative sm:col-span-2 lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50/70 text-navy-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500/20 focus:border-navy-500 transition"
              placeholder="Search observation ID, flight, carrier..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 font-semibold focus:outline-none focus:ring-2 focus:ring-navy-500/20"
            value={origin}
            onChange={(e) => { setOrigin(e.target.value); setPage(1); }}
          >
            <option value="all">All Origins</option>
            {airports.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
          </select>
          <select
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 font-semibold focus:outline-none focus:ring-2 focus:ring-navy-500/20"
            value={destination}
            onChange={(e) => { setDestination(e.target.value); setPage(1); }}
          >
            <option value="all">All Destinations</option>
            {airports.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
          </select>
          <select
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 font-semibold focus:outline-none focus:ring-2 focus:ring-navy-500/20"
            value={airline}
            onChange={(e) => { setAirline(e.target.value); setPage(1); }}
          >
            <option value="all">All Carriers</option>
            {airlines.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
          </select>
          <select
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-navy-900 font-semibold focus:outline-none focus:ring-2 focus:ring-navy-500/20"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="all">All Statuses</option>
            <option value="valid">Valid Only</option>
            <option value="invalid">Invalid Records</option>
            <option value="duplicate">Duplicate Ident</option>
          </select>
        </div>
      </div>

      {/* Main Table Glass Card */}
      <div className="glass-card p-6">
        <div className="pb-4 mb-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-navy-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">Observation Records</span>
          </div>
          <span className="text-xs text-slate-500 font-mono">
            {loading ? 'Refreshing...' : `Matching ${data.total.toLocaleString('en-IN')} rows`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="table-th cursor-pointer hover:text-navy-900" onClick={() => handleSort('id')}>
                  ID {sortIcon('id')}
                </th>
                <th className="table-th hidden md:table-cell cursor-pointer hover:text-navy-900" onClick={() => handleSort('collectionDate')}>
                  Collected {sortIcon('collectionDate')}
                </th>
                <th className="table-th cursor-pointer hover:text-navy-900" onClick={() => handleSort('origin')}>
                  Origin {sortIcon('origin')}
                </th>
                <th className="table-th cursor-pointer hover:text-navy-900" onClick={() => handleSort('destination')}>
                  Dest. {sortIcon('destination')}
                </th>
                <th className="table-th cursor-pointer hover:text-navy-900" onClick={() => handleSort('airline')}>
                  Airline {sortIcon('airline')}
                </th>
                <th className="table-th hidden md:table-cell cursor-pointer hover:text-navy-900" onClick={() => handleSort('travelDate')}>
                  Travel Date {sortIcon('travelDate')}
                </th>
                <th className="table-th hidden md:table-cell cursor-pointer hover:text-navy-900" onClick={() => handleSort('bookingWindow')}>
                  Window {sortIcon('bookingWindow')}
                </th>
                <th className="table-th text-right cursor-pointer hover:text-navy-900" onClick={() => handleSort('totalFare')}>
                  Total Fare {sortIcon('totalFare')}
                </th>
                <th className="table-th hidden md:table-cell">Channel</th>
                <th className="table-th cursor-pointer hover:text-navy-900 text-center" onClick={() => handleSort('status')}>
                  Status {sortIcon('status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paged.map((o) => (
                <tr key={o.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="table-td font-mono text-xs font-semibold text-slate-700 max-w-[120px] truncate">{o.id}</td>
                  <td className="table-td hidden md:table-cell font-mono text-xs text-slate-500">{o.collectionDate}</td>
                  <td className="table-td font-bold text-navy-950">{o.origin}</td>
                  <td className="table-td font-bold text-navy-950">{o.destination}</td>
                  <td className="table-td font-semibold text-navy-900 capitalize">{o.airline}</td>
                  <td className="table-td hidden md:table-cell font-mono text-xs text-slate-600">{o.travelDate}</td>
                  <td className="table-td hidden md:table-cell font-mono text-xs font-bold text-navy-900">T+{o.bookingWindow}</td>
                  <td className="table-td text-right font-mono font-extrabold text-navy-950">{formatINR(o.totalFare)}</td>
                  <td className="table-td hidden md:table-cell text-xs text-slate-500 max-w-[130px] truncate">{o.source}</td>
                  <td className="table-td text-center">{statusBadge(o.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-slate-100">
          <p className="text-xs font-medium text-slate-500 font-mono">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total.toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-1.5">
            <button
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => setPage(1)}
              disabled={page === 1 || loading}
            >
              First
            </button>
            <button
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-mono font-bold text-navy-950 px-2">Page {page} of {totalPages}</span>
            <button
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || loading}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <button
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || loading}
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
