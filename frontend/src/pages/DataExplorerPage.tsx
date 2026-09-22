import { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { formatINR } from '@/data/random';
import { Search, Download, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { apiAirlines, apiMap, apiObservations, type ApiFilters, type ApiObservation } from '@/lib/api';

const PAGE_SIZE = 25;

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
        const uniqueAirlines = Array.from(
          new Map(airlineRes.data.map((item) => [item.code, { code: item.code, name: item.name }])).values()
        );
        setAirlines(uniqueAirlines);
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
    const headers = ['Observation ID', 'Collection Date', 'Origin', 'Destination', 'Airline', 'Travel Date', 'Booking Window', 'Travel Class', 'Base Fare', 'Taxes', 'Total Fare', 'Currency', 'Source', 'Status'];
    const rows = data.rows.map((o: ApiObservation) => [
      o.id, o.collectionDate, o.origin, o.destination, o.airline, o.travelDate, o.bookingWindow, o.travelClass, o.baseFare, o.taxes, o.totalFare, o.currency, o.source, o.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vayuyaan-observations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(data.total / PAGE_SIZE) || 1;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Observation Data Explorer
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Query individual raw reservation tariff observation records ingested into the SQLite store
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-500">
            {data.total.toLocaleString('en-IN')} total records
          </span>
          <button onClick={exportCSV} className="btn btn-secondary text-xs">
            <Download className="w-3 h-3 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 2. COMPACT TABLE FILTER BAR */}
      <div className="bg-white border border-slate-200 rounded p-3 text-xs flex flex-wrap items-center gap-3 shadow-xs">
        <div className="flex items-center gap-1.5 flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search observation ID, flight number..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="input py-1 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">Origin</label>
          <select
            className="select py-1 text-xs min-w-[80px]"
            value={origin}
            onChange={(e) => { setOrigin(e.target.value); setPage(1); }}
          >
            <option value="all">All</option>
            {airports.map((a) => (
              <option key={a.code} value={a.code}>{a.code}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">Dest</label>
          <select
            className="select py-1 text-xs min-w-[80px]"
            value={destination}
            onChange={(e) => { setDestination(e.target.value); setPage(1); }}
          >
            <option value="all">All</option>
            {airports.map((a) => (
              <option key={a.code} value={a.code}>{a.code}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">Carrier</label>
          <select
            className="select py-1 text-xs min-w-[100px]"
            value={airline}
            onChange={(e) => { setAirline(e.target.value); setPage(1); }}
          >
            <option value="all">All</option>
            {airlines.map((a) => (
              <option key={a.code} value={a.code}>{a.name}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5">
          <label className="text-slate-500 text-[11px]">DQE Status</label>
          <select
            className="select py-1 text-xs min-w-[80px]"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="all">All</option>
            <option value="valid">Valid</option>
            <option value="warning">Warning</option>
            <option value="invalid">Invalid</option>
          </select>
        </div>
      </div>

      {/* 3. OBSERVATION DATA TABLE */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th onClick={() => handleSort('id')} className="table-th cursor-pointer hover:text-slate-800">
                  ID {sortBy === 'id' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th onClick={() => handleSort('collectionDate')} className="table-th cursor-pointer hover:text-slate-800">
                  Collection Date {sortBy === 'collectionDate' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th className="table-th">Route</th>
                <th className="table-th">Carrier</th>
                <th onClick={() => handleSort('travelDate')} className="table-th cursor-pointer hover:text-slate-800">
                  Departure {sortBy === 'travelDate' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th onClick={() => handleSort('bookingWindow')} className="table-th text-center cursor-pointer hover:text-slate-800">
                  Window {sortBy === 'bookingWindow' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th className="table-th">Class</th>
                <th onClick={() => handleSort('totalFare')} className="table-th text-right cursor-pointer hover:text-slate-800">
                  Total Fare {sortBy === 'totalFare' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th className="table-th text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                    Querying observation database...
                  </td>
                </tr>
              ) : data.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                    No observations found matching the specified parameters.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="table-row">
                    <td className="table-td text-slate-500 font-mono text-[11px]">{row.id}</td>
                    <td className="table-td text-slate-600">{row.collectionDate}</td>
                    <td className="table-td font-sans font-semibold text-slate-900">
                      {row.origin} — {row.destination}
                    </td>
                    <td className="table-td font-sans text-slate-700">{row.airline}</td>
                    <td className="table-td text-slate-800">{row.travelDate}</td>
                    <td className="table-td text-center text-slate-600">T+{row.bookingWindow}</td>
                    <td className="table-td font-sans text-slate-600 text-[11px]">{row.travelClass}</td>
                    <td className="table-td text-right font-bold text-slate-900">{formatINR(row.totalFare)}</td>
                    <td className="table-td text-center font-sans">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                        row.status === 'valid' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        row.status === 'warning' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                        'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs bg-slate-50/50">
          <span className="text-slate-500 font-mono text-[11px]">
            Page {page} of {totalPages} ({data.total.toLocaleString('en-IN')} observations)
          </span>

          <div className="flex items-center gap-1 sm:mr-36">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="btn btn-secondary py-1 text-xs"
            >
              <ChevronLeft className="w-3 h-3" />
              <span>Previous</span>
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="btn btn-secondary py-1 text-xs"
            >
              <span>Next</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
