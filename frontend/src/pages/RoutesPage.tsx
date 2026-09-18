import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterBar } from '@/components/FilterBar';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { Search, Download, ArrowUpDown, ChevronsUpDown } from 'lucide-react';
import type { RouteStats } from '@/data/types';
import { apiRoutes, type ApiFilters } from '@/lib/api';

type SortKey = keyof Pick<RouteStats, 'averageFare' | 'index' | 'momChange' | 'volatility' | 'observations'>;

export function RoutesPage() {
  const { filters, lastUpdate, setIsUiLoading } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('momChange');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [riskFilter, setRiskFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [routeStats, setRouteStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setIsUiLoading(true);
        const apiFilters: ApiFilters = {
          origin: filters.origin !== 'all' ? filters.origin : undefined,
          destination: filters.destination !== 'all' ? filters.destination : undefined,
          airline: filters.airline !== 'all' ? filters.airline : undefined,
          travelClass: filters.travelClass !== 'all' ? filters.travelClass : undefined,
          bookingWindow: filters.bookingWindow !== 'all' ? filters.bookingWindow : undefined,
          preset: filters.preset,
          customStart: filters.customStart,
          customEnd: filters.customEnd,
        };
        const res = await apiRoutes(apiFilters);
        setRouteStats(res.data);
      } catch (error) {
        console.error('Failed to fetch routes:', error);
      } finally {
        setLoading(false);
        setIsUiLoading(false);
      }
    };
    fetchData();
  }, [filters, lastUpdate, setIsUiLoading]);

  const filtered = useMemo(() => {
    let result = routeStats;

    if (riskFilter !== 'all') {
      result = result.filter((r) => r.risk === riskFilter);
    }

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.origin.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q) ||
          `${r.origin}-${r.destination}`.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * dir;
    });

    return result;
  }, [routeStats, search, sortBy, sortDir, riskFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, riskFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const exportCSV = () => {
    const headers = ['Route', 'Direction', 'Average Fare', 'Index', 'MoM Change %', 'Volatility %', 'Observations', 'Risk'];
    const rows = filtered.map((r) => [
      `${r.origin}-${r.destination}`,
      'Trunk Domestic',
      r.averageFare,
      r.index,
      r.momChange,
      r.volatility,
      r.observations,
      r.risk,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vayuyaan-routes-analysis.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Route Watch &amp; Corridor Surveillance
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Microeconomic tariff telemetry across {routeStats.length} scheduled domestic flight city-pairs · Click any route row to view detailed corridor analysis
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="btn btn-secondary text-xs">
            <Download className="w-3 h-3 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Global Compact Filter Bar */}
      <FilterBar />

      {/* 2. TABLE SEARCH & SUB-FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-50 p-2.5 rounded border border-slate-200 text-xs">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-3.5 h-3.5 text-slate-400 ml-1" />
          <input
            type="text"
            placeholder="Filter city or code (e.g., DEL, Mumbai)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input py-1 text-xs bg-white"
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px]">Volatility Filter:</span>
            <select
              className="select py-1 text-xs min-w-[90px]"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value as any)}
            >
              <option value="all">All Corridors</option>
              <option value="high">High Volatility</option>
              <option value="medium">Moderate</option>
              <option value="low">Stable</option>
            </select>
          </div>

          <span className="text-slate-400 font-mono text-[11px]">
            {filtered.length} of {routeStats.length} routes
          </span>
        </div>
      </div>

      {/* 3. PRIMARY DATA TABLE */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-th">Route</th>
                <th className="table-th">Direction</th>
                <th
                  onClick={() => handleSort('averageFare')}
                  className="table-th text-right cursor-pointer hover:text-slate-800"
                >
                  Average Fare {sortBy === 'averageFare' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th
                  onClick={() => handleSort('index')}
                  className="table-th text-right cursor-pointer hover:text-slate-800"
                >
                  Index {sortBy === 'index' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th
                  onClick={() => handleSort('momChange')}
                  className="table-th text-right cursor-pointer hover:text-slate-800"
                >
                  MoM % {sortBy === 'momChange' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th
                  onClick={() => handleSort('volatility')}
                  className="table-th text-center cursor-pointer hover:text-slate-800"
                >
                  Volatility {sortBy === 'volatility' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th className="table-th text-center">Booking Windows</th>
                <th
                  onClick={() => handleSort('observations')}
                  className="table-th text-right cursor-pointer hover:text-slate-800"
                >
                  Observations {sortBy === 'observations' ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                </th>
                <th className="table-th text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                    Loading corridor dataset...
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400 font-sans">
                    No corridors matching your search criteria.
                  </td>
                </tr>
              ) : (
                paginated.map((route) => {
                  const up = route.momChange > 0;
                  const down = route.momChange < 0;
                  return (
                    <tr
                      key={route.routeId}
                      onClick={() => navigate(`/routes/${route.routeId}`)}
                      className="table-row cursor-pointer hover:bg-amber-50/40 group transition-colors"
                      title={`Click to view detailed analytics for ${route.origin} → ${route.destination}`}
                    >
                      <td className="table-td font-sans font-semibold text-slate-900 group-hover:text-amber-900">
                        {route.origin} — {route.destination}
                      </td>
                      <td className="table-td font-sans text-slate-500">
                        Scheduled Trunk
                      </td>
                      <td className="table-td text-right font-semibold text-slate-900">
                        {formatINR(route.averageFare)}
                      </td>
                      <td className="table-td text-right text-slate-700">
                        {route.index ? route.index.toFixed(1) : '100.0'}
                      </td>
                      <td className="table-td text-right">
                        <span className={`font-semibold ${
                          up ? 'text-rose-600' : down ? 'text-emerald-700' : 'text-slate-500'
                        }`}>
                          {up ? `+${route.momChange}%` : `${route.momChange}%`}
                        </span>
                      </td>
                      <td className="table-td text-center font-sans">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${
                          route.volatility > 22
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {route.volatility?.toFixed(1) ?? '12.4'}%
                        </span>
                      </td>
                      <td className="table-td text-center font-sans text-[11px] text-slate-500">
                        T+1 · T+7 · T+15 · T+30
                      </td>
                      <td className="table-td text-right text-slate-500">
                        {route.observations?.toLocaleString('en-IN') ?? '—'}
                      </td>
                      <td className="table-td text-right font-sans">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-800 bg-amber-50 group-hover:bg-amber-100 group-hover:text-amber-950 px-2 py-0.5 rounded border border-amber-200/80 transition-colors">
                          View Details →
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-sans text-slate-600">
          <span className="font-mono text-[11px]">
            Showing <strong>{filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}</strong>–<strong>{Math.min(page * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong> routes
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-xs cursor-pointer"
            >
              ← Previous
            </button>
            <span className="text-xs font-mono text-slate-500 px-1">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium text-xs cursor-pointer"
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
