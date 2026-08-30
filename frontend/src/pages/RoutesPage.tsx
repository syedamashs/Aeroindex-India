import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { FilterBar } from '@/components/FilterBar';
import { useApp } from '@/context/AppContext';
import { getAirportLabel } from '@/data/analytics';
import { formatINR, formatPercent } from '@/data/random';
import { Search, ArrowUp, ArrowDown, Minus, Download } from 'lucide-react';
import type { RouteStats } from '@/data/types';
import { apiRoutes, type ApiFilters } from '@/lib/api';

type SortKey = keyof Pick<RouteStats, 'averageFare' | 'index' | 'momChange' | 'yoyChange' | 'observations' | 'volatility'>;

export function RoutesPage() {
  const { filters, lastUpdate } = useApp();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('momChange');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [routeStats, setRouteStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
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
      }
    };
    fetchData();
  }, [filters, lastUpdate]);

  const filtered = useMemo(() => {
    let result = routeStats;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          getAirportLabel(r.origin).toLowerCase().includes(q) ||
          getAirportLabel(r.destination).toLowerCase().includes(q) ||
          r.origin.toLowerCase().includes(q) ||
          r.destination.toLowerCase().includes(q),
      );
    }
    result = [...result].sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1;
      return (a[sortBy] - b[sortBy]) * dir;
    });
    return result;
  }, [routeStats, search, sortBy, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const exportCSV = () => {
    const headers = ['Route', 'Average Fare', 'Median Fare', 'Index', 'MoM Change %', 'YoY Change %', 'Min Fare', 'Max Fare', 'Volatility', 'Observations', 'Risk'];
    const rows = filtered.map((r) => [
      `${r.origin}-${r.destination}`,
      r.averageFare,
      r.medianFare,
      r.index,
      r.momChange,
      r.yoyChange,
      r.minFare,
      r.maxFare,
      r.volatility,
      r.observations,
      r.risk,
    ]);
    const csv = [headers, ...rows].map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'route-analysis.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const sortIcon = (key: SortKey) => {
    if (sortBy !== key) return null;
    return sortDir === 'desc' ? '↓' : '↑';
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">Route-Level Airfare Intelligence</h1>
          <p className="text-slate-500 mt-1">Detailed fare analysis across all monitored domestic routes</p>
        </div>
        <button onClick={exportCSV} className="btn-secondary">
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <FilterBar />

      <Card>
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              className="input pl-9"
              placeholder="Search routes by city or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-sm text-slate-500">{filtered.length} routes</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="table-th">Route</th>
                <th className="table-th text-right cursor-pointer hover:text-navy-700" onClick={() => handleSort('averageFare')}>Avg Fare {sortIcon('averageFare')}</th>
                <th className="table-th text-right cursor-pointer hover:text-navy-700" onClick={() => handleSort('index')}>Index {sortIcon('index')}</th>
                <th className="table-th text-right cursor-pointer hover:text-navy-700" onClick={() => handleSort('momChange')}>MoM Change {sortIcon('momChange')}</th>
                <th className="table-th text-right cursor-pointer hover:text-navy-700" onClick={() => handleSort('yoyChange')}>YoY Change {sortIcon('yoyChange')}</th>
                <th className="table-th text-right">Min Fare</th>
                <th className="table-th text-right">Max Fare</th>
                <th className="table-th text-right cursor-pointer hover:text-navy-700" onClick={() => handleSort('observations')}>Obs. {sortIcon('observations')}</th>
                <th className="table-th text-right cursor-pointer hover:text-navy-700" onClick={() => handleSort('volatility')}>Volatility {sortIcon('volatility')}</th>
                <th className="table-th">Risk</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.routeId}
                  className="table-row cursor-pointer"
                  onClick={() => navigate(`/routes/${r.routeId}`)}
                >
                  <td className="table-td font-medium">
                    {getAirportLabel(r.origin)} → {getAirportLabel(r.destination)}
                    <span className="text-xs text-slate-400 ml-1">({r.origin}-{r.destination})</span>
                  </td>
                  <td className="table-td text-right font-mono">{formatINR(r.averageFare)}</td>
                  <td className="table-td text-right font-mono">{r.index.toFixed(1)}</td>
                  <td className="table-td text-right">
                    <span className={`badge ${r.momChange > 1.5 ? 'badge-danger' : r.momChange < -1.5 ? 'badge-success' : 'badge-slate'}`}>
                      {r.momChange > 1.5 ? <ArrowUp className="w-3 h-3" /> : r.momChange < -1.5 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                      {formatPercent(r.momChange)}
                    </span>
                  </td>
                  <td className="table-td text-right font-mono">{formatPercent(r.yoyChange)}</td>
                  <td className="table-td text-right font-mono">{formatINR(r.minFare)}</td>
                  <td className="table-td text-right font-mono">{formatINR(r.maxFare)}</td>
                  <td className="table-td text-right font-mono">{r.observations.toLocaleString('en-IN')}</td>
                  <td className="table-td text-right font-mono">{formatINR(r.volatility)}</td>
                  <td className="table-td">
                    <span className={`badge ${r.risk === 'high' ? 'badge-danger' : r.risk === 'medium' ? 'badge-warning' : 'badge-success'}`}>
                      {r.risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
