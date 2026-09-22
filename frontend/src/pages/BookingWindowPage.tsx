import { useState, useEffect, useMemo } from 'react';
import { FilterBar } from '@/components/FilterBar';
import { useApp } from '@/context/AppContext';
import { formatINR, formatPercent } from '@/data/random';
import { apiBookingWindow, type ApiFilters } from '@/lib/api';
import { InsightBot, BOOKING_WINDOW_INSIGHTS } from '@/components/InsightBot';
import { AdvanceWindowTrajectoryChart } from '@/components/AdvanceWindowTrajectoryChart';

export function BookingWindowPage() {
  const { filters, lastUpdate } = useApp();
  const [bwStats, setBwStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightedWindow, setHighlightedWindow] = useState<number | null>(null);

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
        const res = await apiBookingWindow(apiFilters);
        setBwStats(res.data);
      } catch (error) {
        console.error('Failed to fetch booking window stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filters, lastUpdate]);

  // Order by departure proximity: T+45 down to T+1
  const sortedCurve = useMemo(() => {
    return [...bwStats].sort((a, b) => b.window - a.window).map((item) => ({
      ...item,
      label: `T+${item.window}`,
      avgFare: Math.round(item.averageFare),
    }));
  }, [bwStats]);

  const t45 = bwStats.find((b) => b.window === 45);
  const t1 = bwStats.find((b) => b.window === 1);
  const surgeMultiplier = t45 && t1 && t45.averageFare > 0
    ? Number((((t1.averageFare - t45.averageFare) / t45.averageFare) * 100).toFixed(1))
    : 0;

  return (
    <div className="space-y-6 animate-fade-in max-w-[1440px]">
      {/* 1. HEADER */}
      <div className="border-b border-slate-200 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Booking Window &amp; Advance-Purchase Curve
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Econometric price trajectory as flight departure date approaches (T+45 days to T+1 day)
          </p>
        </div>

        <div className="flex items-center gap-3">
          <InsightBot
            title="Advance-Purchase Curve"
            subtitle="Booking window price dynamics"
            insights={BOOKING_WINDOW_INSIGHTS}
          />
          {t1 && t45 && (
            <div className="text-right font-mono text-xs">
              <span className="text-slate-500 block text-[11px] font-sans">Close-in Surge Premium (T+1 vs T+45)</span>
              <span className="text-lg font-bold text-rose-600">+{surgeMultiplier}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Global Compact Filter Bar */}
      <FilterBar />

      {/* 2. ADVANCE-PURCHASE CURVE INTERACTIVE VISUALIZATION */}
      <section id="guide-booking-curve">
        <AdvanceWindowTrajectoryChart
          data={bwStats}
          loading={loading}
          onWindowSelect={(w) => setHighlightedWindow(w)}
        />
      </section>

      {/* 3. STRUCTURED DATA TABLE */}
      <section className="space-y-3">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Booking Horizon Breakdown
          </h2>
          <p className="text-[11px] text-slate-400">Mean tariffs, delta relative to early booking, and observation counts</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-xs">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr>
                <th className="table-th">Booking Horizon</th>
                <th className="table-th">Lead Time Description</th>
                <th className="table-th text-right">Average Fare</th>
                <th className="table-th text-right">Premium vs T+45</th>
                <th className="table-th text-right">Observations Recorded</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-xs">
              {sortedCurve.map((item) => {
                const baseT45Fare = t45?.averageFare ?? item.averageFare;
                const premium = baseT45Fare > 0 ? ((item.averageFare - baseT45Fare) / baseT45Fare) * 100 : 0;
                const isHighlighted = highlightedWindow === item.window;
                return (
                  <tr
                    key={item.window}
                    className={`table-row transition-all duration-300 ${
                      isHighlighted ? 'bg-amber-50/90 ring-1 ring-amber-300' : ''
                    }`}
                  >
                    <td className="table-td font-sans font-bold text-slate-900 flex items-center gap-1.5">
                      {isHighlighted && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />}
                      <span>T+{item.window}</span>
                    </td>
                    <td className="table-td font-sans text-slate-600">
                      {item.window === 1 ? '1 Day (Last Minute / Departure Eve)' :
                       item.window === 7 ? '7 Days (1 Week Advance)' :
                       item.window === 15 ? '15 Days (Mid-Horizon Advance)' :
                       item.window === 30 ? '30 Days (1 Month Advance)' :
                       '45 Days (Early Planning Baseline)'}
                    </td>
                    <td className="table-td text-right font-bold text-slate-900">
                      {formatINR(item.averageFare)}
                    </td>
                    <td className="table-td text-right">
                      <span className={`font-semibold ${
                        premium > 20 ? 'text-rose-600' : premium > 0 ? 'text-amber-700' : 'text-slate-500'
                      }`}>
                        {premium > 0 ? `+${premium.toFixed(1)}%` : 'Baseline'}
                      </span>
                    </td>
                    <td className="table-td text-right text-slate-500">
                      {item.observations?.toLocaleString('en-IN') ?? item.count ?? '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
