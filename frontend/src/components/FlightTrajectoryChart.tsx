import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Plane, TrendingUp, TrendingDown } from 'lucide-react';
import { formatINR, formatPercent } from '@/data/random';
import { indexTooltipFormatter, genericFareTooltipFormatter } from '@/components/chartFormatters';
import { InsightBot, INDEX_TRAJECTORY_INSIGHTS } from '@/components/InsightBot';

export interface FlightDataPoint {
  period: string;
  indexValue: number;
  percentageChange: number;
  averageFare: number;
  monthLabel: string;
  [key: string]: any;
}

export interface MonthPopupData {
  month: string;
  season: string;
  bullets: string[];
}

export const MONTH_POPUP_DETAILS: Record<string, MonthPopupData> = {
  'Jan 2026': {
    month: 'Jan 2026',
    season: 'Base Benchmark',
    bullets: [
      'Index 100.0 (Base) · Avg Fare: ₹5,420',
      'Republic Day travel surge & North fog schedule compression',
      'Corporate contract resets across DEL-BOM & BLR-DEL trunk corridors'
    ]
  },
  'Feb 2026': {
    month: 'Feb 2026',
    season: 'Q1 Lean Window',
    bullets: [
      'Index 98.4 (-1.6%) · Avg Fare: ₹5,310',
      'Pre-examination season sharply contracts leisure travel nationwide',
      'Carriers offer 15-day advance discount sales on leisure routes'
    ]
  },
  'Mar 2026': {
    month: 'Mar 2026',
    season: 'Holi & FY-End Surge',
    bullets: [
      'Index 102.8 (+4.5%) · Avg Fare: ₹5,570',
      'Holi festive migration sparks 30-40% spot surge on East routes (DEL-PAT)',
      'Corporate travel budgets expensed ahead of March 31st fiscal close'
    ]
  },
  'Apr 2026': {
    month: 'Apr 2026',
    season: 'Summer Vacation Start',
    bullets: [
      'Index 104.1 (+1.3%) · Avg Fare: ₹5,640',
      'School summer vacations commence across North and West states',
      'Heavy booking velocity for Srinagar, Leh, and Bagdogra holiday gateways'
    ]
  },
  'May 2026': {
    month: 'May 2026',
    season: 'Peak Summer Apex',
    bullets: [
      'Index 107.6 (+3.4%) · Avg Fare: ₹5,830',
      'Annual peak of domestic family leisure & wedding season travel',
      'Metro-to-holiday destination fares trade at 50-70% seasonal premium'
    ]
  },
  'Jun 2026': {
    month: 'Jun 2026',
    season: 'Monsoon Onset',
    bullets: [
      'Index 101.9 (-5.3%) · Avg Fare: ₹5,520',
      'Monsoon arrives; discretionary holiday demand drops sharply',
      'Schools reopen nationwide; carriers slash tariffs to protect load factor'
    ]
  },
  'Jul 2026': {
    month: 'Jul 2026',
    season: 'Mid-Monsoon Low',
    bullets: [
      'Index 96.5 (-5.3%) · Avg Fare: ₹5,230',
      'Deepest seasonal lull; major airline promotional monsoon sales run',
      'Lowest domestic fares of the year, offering maximum passenger affordability'
    ]
  },
  'Aug 2026': {
    month: 'Aug 2026',
    season: 'Holiday Weekend Spikes',
    bullets: [
      'Index 99.8 (+3.4%) · Avg Fare: ₹5,410',
      'Consecutive long weekends (Aug 15th, Raksha Bandhan) spark travel',
      'Tier-2 regional routes see strong load factors and short-term rebound'
    ]
  },
  'Sep 2026': {
    month: 'Sep 2026',
    season: 'Pre-Festive Calm',
    bullets: [
      'Index 100.4 (+0.6%) · Avg Fare: ₹5,440',
      'Calm before Q4 festive rush; heavy 30-day advance booking for Diwali',
      'Fleet maintenance scheduled before peak winter deployment'
    ]
  }
};

interface FlightTrajectoryChartProps {
  data: FlightDataPoint[];
  loading?: boolean;
  title?: string;
  subtitle?: string;
  showModeSwitcher?: boolean;
  defaultMode?: 'index' | 'fare';
  showInsightBot?: boolean;
  botInsights?: any[];
}

export function FlightTrajectoryChart({
  data,
  loading = false,
  title = 'National Airfare Index Trajectory',
  subtitle = 'Monthly weighted cohort aggregation across monitored domestic city-pairs',
  showModeSwitcher = true,
  defaultMode = 'index',
  showInsightBot = true,
  botInsights = INDEX_TRAJECTORY_INSIGHTS,
}: FlightTrajectoryChartProps) {
  const [chartMode, setChartMode] = useState<'index' | 'fare'>(defaultMode);

  // Simulation State: autonomous continuous loop
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flightPhase, setFlightPhase] = useState<'dwelling' | 'flying'>('dwelling');

  // Container & Coordinates
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const coordsMapRef = useRef<Record<number, { x: number; y: number }>>({});
  const [planeCoords, setPlaneCoords] = useState<{ x: number; y: number; angle: number }>({ x: 0, y: 0, angle: 0 });

  // Dwell: 2600ms; Flight: 900ms
  const dwellDuration = 2600;
  const flightDuration = 900;

  // Track container width for responsive clamping
  useEffect(() => {
    if (!containerRef.current) return;
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Safe data points fallback
  const validData = useMemo(() => {
    if (data && data.length > 0) return data;
    return [
      { period: '2026-01', indexValue: 100.0, percentageChange: 0, averageFare: 5420, monthLabel: 'Jan 2026' },
      { period: '2026-02', indexValue: 98.4, percentageChange: -1.6, averageFare: 5310, monthLabel: 'Feb 2026' },
      { period: '2026-03', indexValue: 102.8, percentageChange: 4.47, averageFare: 5570, monthLabel: 'Mar 2026' },
      { period: '2026-04', indexValue: 104.1, percentageChange: 1.26, averageFare: 5640, monthLabel: 'Apr 2026' },
      { period: '2026-05', indexValue: 107.6, percentageChange: 3.36, averageFare: 5830, monthLabel: 'May 2026' },
      { period: '2026-06', indexValue: 101.9, percentageChange: -5.3, averageFare: 5520, monthLabel: 'Jun 2026' },
      { period: '2026-07', indexValue: 96.5, percentageChange: -5.3, averageFare: 5230, monthLabel: 'Jul 2026' },
      { period: '2026-08', indexValue: 99.8, percentageChange: 3.42, averageFare: 5410, monthLabel: 'Aug 2026' },
      { period: '2026-09', indexValue: 100.4, percentageChange: 0.6, averageFare: 5440, monthLabel: 'Sep 2026' },
    ];
  }, [data]);

  // Y-Axis Domain calculation: tight left limit (no huge empty gap)
  const { yDomain, yTicks } = useMemo(() => {
    if (chartMode === 'index') {
      const vals = validData.map((d) => d.indexValue).filter((v) => typeof v === 'number' && !isNaN(v));
      if (!vals.length) return { yDomain: [95, 110] as [number, number], yTicks: [95, 100, 105, 110] };
      const minVal = Math.min(...vals);
      const maxVal = Math.max(...vals);

      const lower = Math.max(0, Math.floor(minVal - 1.5));
      const upper = Math.ceil(maxVal + 2);

      const ticks: number[] = [];
      const step = (upper - lower) <= 12 ? 2 : 4;
      const start = Math.floor(lower / step) * step;
      for (let v = start; v <= upper + 1; v += step) {
        if (v >= lower && v <= upper) {
          ticks.push(v);
        }
      }
      if (!ticks.includes(lower)) ticks.unshift(lower);
      if (!ticks.includes(upper)) ticks.push(upper);
      const sortedTicks = [...new Set(ticks)].sort((a, b) => a - b);

      return { yDomain: [lower, upper] as [number, number], yTicks: sortedTicks };
    } else {
      const vals = validData.map((d) => d.averageFare).filter((v) => typeof v === 'number' && !isNaN(v));
      if (!vals.length) return { yDomain: [4500, 6500] as [number, number], yTicks: [4500, 5000, 5500, 6000, 6500] };
      const minVal = Math.min(...vals);
      const maxVal = Math.max(...vals);

      const lower = Math.max(0, Math.floor((minVal - 150) / 100) * 100);
      const upper = Math.ceil((maxVal + 250) / 100) * 100;

      const ticks: number[] = [];
      const step = 250;
      for (let v = lower; v <= upper; v += step) {
        ticks.push(v);
      }
      return { yDomain: [lower, upper] as [number, number], yTicks: ticks };
    }
  }, [validData, chartMode]);

  // Current active data point & popup content
  const activePoint = validData[currentIndex] || validData[0];
  const popupData = MONTH_POPUP_DETAILS[activePoint?.monthLabel] || {
    month: activePoint?.monthLabel || 'Current Month',
    season: 'Observed Data',
    bullets: [
      `Index: ${activePoint?.indexValue?.toFixed(1) ?? '100.0'} · Fare: ${formatINR(activePoint?.averageFare || 0)}`,
      'Weighted DGCA passenger capacity across monitored domestic trunk routes',
      'Dynamic yield equilibrium based on forward booking windows'
    ]
  };

  // Register coordinate from Dot callback
  const handleRegisterCoord = useCallback((idx: number, cx: number, cy: number) => {
    if (typeof cx === 'number' && typeof cy === 'number' && !isNaN(cx) && !isNaN(cy)) {
      coordsMapRef.current[idx] = { x: cx, y: cy };
      if (idx === currentIndex && (planeCoords.x === 0 && planeCoords.y === 0)) {
        setPlaneCoords({ x: cx, y: cy, angle: 0 });
      }
    }
  }, [currentIndex, planeCoords.x, planeCoords.y]);

  // Autonomous continuous simulation loop:
  // Jan -> Feb -> ... -> Sep -> Jan (keeps simulating on and on)
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (flightPhase === 'dwelling') {
      timer = setTimeout(() => {
        const nextIdx = (currentIndex + 1) % validData.length;
        const currentCoord = coordsMapRef.current[currentIndex];
        const nextCoord = coordsMapRef.current[nextIdx];

        let targetAngle = 0;
        if (currentCoord && nextCoord) {
          const dx = nextCoord.x - currentCoord.x;
          const dy = nextCoord.y - currentCoord.y;
          targetAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        }

        setFlightPhase('flying');

        if (nextCoord) {
          setPlaneCoords({ x: nextCoord.x, y: nextCoord.y, angle: targetAngle });
        }

        setTimeout(() => {
          setCurrentIndex(nextIdx);
          setFlightPhase('dwelling');
          if (nextCoord) {
            setPlaneCoords({ x: nextCoord.x, y: nextCoord.y, angle: 0 });
          }
        }, flightDuration);

      }, dwellDuration);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [flightPhase, currentIndex, validData.length, dwellDuration, flightDuration]);

  // Calculate clamped box position so it never overflows left or right of the chart
  const boxWidth = 270;
  const halfBox = boxWidth / 2;
  const clampedX = Math.min(
    Math.max(halfBox + 8, planeCoords.x),
    Math.max(halfBox + 8, containerWidth - halfBox - 8)
  );

  // If point is too near the top, show box below; otherwise show box on top
  const isNearTop = planeCoords.y < 120;

  const isUp = activePoint?.percentageChange > 0;
  const isDown = activePoint?.percentageChange < 0;

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-all">
      {/* 1. TOP HEADER BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              FLIGHT SIMULATION
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-mono text-slate-500">Continuous Route Progression</span>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mt-1">
            {title}
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {subtitle}
          </p>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-2">
          {showInsightBot && (
            <InsightBot
              title="National Airfare Index Trajectory"
              subtitle="Jan 2026 – present"
              insights={botInsights}
            />
          )}

          {showModeSwitcher && (
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                onClick={() => setChartMode('index')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                  chartMode === 'index' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Composite Index
              </button>
              <button
                onClick={() => setChartMode('fare')}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                  chartMode === 'fare' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Average Fare (₹)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. CHART & SIMULATION CANVAS */}
      <div className="relative w-full" ref={containerRef}>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-xs text-slate-400 font-mono">
            Loading flight path...
          </div>
        ) : (
          <div className="h-72 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={validData}
                margin={{ top: 24, right: 16, left: -6, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="chartGradientAero" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c2410c" stopOpacity={0.16} />
                    <stop offset="95%" stopColor="#c2410c" stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

                <XAxis
                  dataKey="monthLabel"
                  stroke="#a8a29e"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e7e5e4' }}
                />

                <YAxis
                  domain={yDomain}
                  ticks={yTicks}
                  allowDataOverflow={true}
                  stroke="#a8a29e"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e7e5e4' }}
                  tickFormatter={chartMode === 'fare' ? (v) => `₹${(v / 1000).toFixed(1)}k` : (v) => v.toFixed(0)}
                />

                <Tooltip
                  formatter={chartMode === 'index' ? indexTooltipFormatter : genericFareTooltipFormatter}
                />

                {chartMode === 'index' && (
                  <ReferenceLine
                    y={100}
                    stroke="#a8a29e"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Base 100.0',
                      fill: '#78716c',
                      fontSize: 10,
                      position: 'right',
                    }}
                  />
                )}

                <Area
                  type="monotone"
                  dataKey={chartMode === 'index' ? 'indexValue' : 'averageFare'}
                  stroke="#c2410c"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#chartGradientAero)"
                  dot={(dotProps: any) => {
                    const { cx, cy, index: dotIndex } = dotProps;
                    handleRegisterCoord(dotIndex, cx, cy);

                    const isCurrent = dotIndex === currentIndex;
                    return (
                      <g key={`dot-${dotIndex}`}>
                        {isCurrent ? (
                          <g>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={14}
                              fill="#f59e0b"
                              opacity={0.25}
                              className="animate-ping origin-center"
                            />
                            <circle
                              cx={cx}
                              cy={cy}
                              r={6.5}
                              fill="#f59e0b"
                              stroke="#ffffff"
                              strokeWidth={2}
                            />
                            <circle
                              cx={cx}
                              cy={cy}
                              r={2.5}
                              fill="#78350f"
                            />
                          </g>
                        ) : (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={3.5}
                            fill="#ffffff"
                            stroke="#ea580c"
                            strokeWidth={1.5}
                          />
                        )}
                      </g>
                    );
                  }}
                  activeDot={{ r: 6, stroke: '#ea580c', strokeWidth: 2, fill: '#ffffff' }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* 3. THE ANIMATED FLIGHT PLANE */}
            {planeCoords.x > 0 && planeCoords.y > 0 && (
              <div
                className="absolute pointer-events-none z-20 flex items-center justify-center transition-all"
                style={{
                  left: `${planeCoords.x}px`,
                  top: `${planeCoords.y}px`,
                  transform: `translate(-50%, -50%) rotate(${planeCoords.angle}deg)`,
                  transitionDuration: flightPhase === 'flying' ? `${flightDuration}ms` : '200ms',
                  transitionTimingFunction: 'cubic-bezier(0.25, 1, 0.5, 1)',
                }}
              >
                <div className="relative flex items-center justify-center">
                  {/* Jet Exhaust Trail Glow */}
                  {flightPhase === 'flying' && (
                    <div
                      className="absolute -left-6 w-8 h-1.5 bg-gradient-to-l from-amber-400 via-orange-500 to-transparent rounded-full blur-[1px] animate-pulse"
                      style={{ transform: 'translateX(-4px)' }}
                    />
                  )}

                  {/* Stylized Jet Plane Icon */}
                  <div className="p-1.5 rounded-full bg-amber-500 text-stone-950 shadow-md ring-2 ring-white flex items-center justify-center">
                    <Plane className="w-3.5 h-3.5 fill-stone-950 text-stone-950 transform rotate-45" />
                  </div>

                  {/* Wingtip strobe light */}
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
              </div>
            )}

            {/* 4. COMPACT FLOATING DETAILS BOX DIRECTLY ON TOP OF THE FLIGHT SPOT */}
            {planeCoords.x > 0 && planeCoords.y > 0 && (
              <div
                className={`absolute z-30 transition-all duration-300 pointer-events-none ${
                  flightPhase === 'dwelling' ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                }`}
                style={{
                  left: `${clampedX}px`,
                  top: isNearTop ? `${planeCoords.y + 16}px` : `${planeCoords.y - 14}px`,
                  transform: isNearTop ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
                }}
              >
                {/* Point-wise Floating Box */}
                <div className="bg-slate-900/95 backdrop-blur-md text-white border border-amber-500/40 rounded-xl shadow-2xl p-2.5 w-[270px] text-xs">
                  {/* Mini Header */}
                  <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="font-bold text-white text-xs tracking-tight">
                        {activePoint.monthLabel}
                      </span>
                      <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-500/30">
                        {popupData.season}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {chartMode === 'index'
                          ? activePoint.indexValue?.toFixed(1) ?? '100.0'
                          : formatINR(activePoint.averageFare || 0)}
                      </span>
                      {chartMode === 'index' && activePoint.percentageChange !== 0 && (
                        <span className={`text-[10px] font-mono font-semibold flex items-center ${
                          isUp ? 'text-rose-400' : isDown ? 'text-emerald-400' : 'text-slate-400'
                        }`}>
                          {isUp ? '+' : ''}{activePoint.percentageChange.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Important point-wise details */}
                  <ul className="space-y-1 text-[11px] text-slate-300">
                    {popupData.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-1.5 leading-tight">
                        <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Direct Arrow pointing down to the flight / point */}
                <div
                  className={`w-0 h-0 border-solid mx-auto ${
                    isNearTop
                      ? 'border-b-slate-900/95 border-b-[6px] border-x-transparent border-x-[6px] border-t-0 -mt-[calc(100%+6px)]'
                      : 'border-t-slate-900/95 border-t-[6px] border-x-transparent border-x-[6px] border-b-0'
                  }`}
                  style={{
                    transform: `translateX(${planeCoords.x - clampedX}px)`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
