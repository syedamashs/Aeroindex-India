import { useMemo, useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { useApp } from '@/context/AppContext';
import { AIRPORTS } from '@/data/airports';
import { AIRLINES } from '@/data/airlines';
import { formatINR } from '@/data/random';
import { Search, Download, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import type { Observation } from '@/data/types';
import { apiObservations, type ApiFilters } from '@/lib/api';

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
  const [data, setData] = useState<{ rows: Observation[]; total: number }> ({ rows: [], total: 0 });
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
    const rows = data.rows.map((o: Observation) => [
      o.id, o.collectionDate, o.origin, o.destination, o.airline, o.travelDate, o.bookingWindow, o.travelClass, o.baseFare, o.taxes, o.fees, o.totalFare, o.currency, o.source, o.status,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'observations.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortIcon = (key: SortKey) => {
    if (sortBy !== key) return <ChevronsUpDown className="w-3 h-3 text-slate-300 inline" />;
    return sortDir === 'desc' ? '↓' : '↑';
  };

  const statusBadge = (s: string) => {
    if (s === 'valid') return <span className="badge-success">valid</span>;
    if (s === 'invalid') return <span className="badge-danger">invalid</span>;
    if (s === 'duplicate') return <span className="badge-warning">duplicate</span>;
    return <span className="badge-slate">{s}</span>;
  };

  const totalPages = Math.ceil(data.total / PAGE_SIZE);
  const paged = data.rows;

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">Data Explorer</h1>
          <p className="text-slate-500 mt-1">Underlying airfare observations — {data.total.toLocaleString('en-IN')} total records</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary">
          <Download className="w-4 h-4" /> Export CSV ({data.total.toLocaleString('en-IN')})
        </button>
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search by ID, origin, destination, airline..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <select className="select min-w-[120px]" value={origin} onChange={(e) => { setOrigin(e.target.value); setPage(1); }}>
            <option value="all">All Origins</option>
            {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
          </select>
          <select className="select min-w-[120px]" value={destination} onChange={(e) => { setDestination(e.target.value); setPage(1); }}>
            <option value="all">All Dest.</option>
            {AIRPORTS.map((a) => <option key={a.code} value={a.code}>{a.code}</option>)}
          </select>
          <select className="select min-w-[120px]" value={airline} onChange={(e) => { setAirline(e.target.value); setPage(1); }}>
            <option value="all">All Airlines</option>
            {AIRLINES.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
          </select>
          <select className="select min-w-[120px]" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="all">All Status</option>
            <option value="valid">Valid</option>
            <option value="invalid">Invalid</option>
            <option value="duplicate">Duplicate</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th cursor-pointer hover:text-navy-700" onClick={() => handleSort('id')}>ID {sortIcon('id')}</th>
                <th className="table-th cursor-pointer hover:text-navy-700" onClick={() => handleSort('collectionDate')}>Collected {sortIcon('collectionDate')}</th>
                <th className="table-th cursor-pointer hover:text-navy-700" onClick={() => handleSort('origin')}>Origin {sortIcon('origin')}</th>
                <th className="table-th cursor-pointer hover:text-navy-700" onClick={() => handleSort('destination')}>Dest. {sortIcon('destination')}</th>
                <th className="table-th cursor-pointer hover:text-navy-700" onClick={() => handleSort('airline')}>Airline {sortIcon('airline')}</th>
                <th className="table-th cursor-pointer hover:text-navy-700" onClick={() => handleSort('travelDate')}>Travel Date {sortIcon('travelDate')}</th>
                <th className="table-th cursor-pointer hover:text-navy-700" onClick={() => handleSort('bookingWindow')}>Window {sortIcon('bookingWindow')}</th>
                <th className="table-th">Class</th>
                <th className="table-th text-right cursor-pointer hover:text-navy-700" onClick={() => handleSort('totalFare')}>Total Fare {sortIcon('totalFare')}</th>
                <th className="table-th">Source</th>
                <th className="table-th cursor-pointer hover:text-navy-700" onClick={() => handleSort('status')}>Status {sortIcon('status')}</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((o) => (
                <tr key={o.id} className="table-row">
                  <td className="table-td font-mono text-xs">{o.id}</td>
                  <td className="table-td font-mono text-xs">{o.collectionDate}</td>
                  <td className="table-td font-medium">{o.origin}</td>
                  <td className="table-td font-medium">{o.destination}</td>
                  <td className="table-td">{o.airline}</td>
                  <td className="table-td font-mono text-xs">{o.travelDate}</td>
                  <td className="table-td font-mono">T+{o.bookingWindow}</td>
                  <td className="table-td">{o.travelClass}</td>
                  <td className="table-td text-right font-mono">{formatINR(o.totalFare)}</td>
                  <td className="table-td text-xs text-slate-500">{o.source}</td>
                  <td className="table-td">{statusBadge(o.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, data.total)} of {data.total.toLocaleString('en-IN')}
          </p>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary py-1.5 px-3"
              onClick={() => setPage(1)}
              disabled={page === 1 || loading}
            >
              First
            </button>
            <button
              className="btn-secondary py-1.5 px-3"
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-slate-600 px-2">Page {page} of {totalPages}</span>
            <button
              className="btn-secondary py-1.5 px-3"
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages || loading}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              className="btn-secondary py-1.5 px-3"
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages || loading}
            >
              Last
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
