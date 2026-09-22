import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Plane, TrendingUp, AlertTriangle, CheckCircle2, Play, Pause, Compass } from 'lucide-react';
import { formatINR } from '@/data/random';
import { InsightBot, BOOKING_WINDOW_INSIGHTS } from '@/components/InsightBot';

export interface BookingWindowItem {
  window: number;
  label?: string;
  averageFare: number;
  observations: number;
  [key: string]: any;
}

export interface WindowMilestoneDetail {
  window: number;
  label: string;
  badge: string;
  badgeColor: string;
  headline: string;
  recommendation: 'STRONGLY RECOMMENDED' | 'ACCEPTABLE' | 'CAUTION' | 'HIGH SURGE' | 'EXTREME GOUGING';
  bullets: string[];
}

export const WINDOW_MILESTONE_DETAILS: Record<number, WindowMilestoneDetail> = {
  45: {
    window: 45,
    label: 'T+45 Days',
    badge: 'Base Benchmark',
    badgeColor: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/30',
    headline: 'Early-Bird Horizon · Maximum Bucket Availability',
    recommendation: 'STRONGLY RECOMMENDED',
    bullets: [
      'Cheapest tier baseline across domestic network (DGCA quota open)',
      'Optimal window for family, leisure, and planned personal itineraries',
      'Zero algorithmic urgency multiplier applied by revenue management systems'
    ]
  },
  30: {
    window: 30,
    label: 'T+30 Days',
    badge: 'Stable Planning',
    badgeColor: 'bg-blue-950/80 text-blue-300 border-blue-500/30',
    headline: '1-Month Advance · Stable Inventory Depth',
    recommendation: 'ACCEPTABLE',
    bullets: [
      'Mild +2% to +5% drift above base baseline as promotional quotas fill',
      'High seat selection availability with standard baggage bundle eligibility',
      'Standard corporate advance purchase policy threshold'
    ]
  },
  15: {
    window: 15,
    label: 'T+15 Days',
    badge: 'Mid-Horizon Pivot',
    badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-500/30',
    headline: '2-Week Pivot Point · Yield gouging Starts',
    recommendation: 'CAUTION',
    bullets: [
      '15-day advance-booking discount rules expire across all major trunk routes',
      'Carriers start locking lowest RBD (Reservation Booking Designator) buckets',
      'Last viable window before steep exponential tariff escalation'
    ]
  },
  7: {
    window: 7,
    label: 'T+7 Days',
    badge: 'Dynamic Surge',
    badgeColor: 'bg-orange-950/80 text-orange-300 border-orange-500/30',
    headline: 'Final 7 Days · Algorithmic Bucket Closure',
    recommendation: 'HIGH SURGE',
    bullets: [
      'Inelastic business travelers enter booking pipeline; prices jump sharply',
      'Remaining inventory restricted to high-tier flex & corporate fare codes',
      'Surge velocity averages +15% to +28% escalation over T+45 baseline'
    ]
  },
  1: {
    window: 1,
    label: 'T+1 Day',
    badge: 'Departure Eve',
    badgeColor: 'bg-rose-950/80 text-rose-300 border-rose-500/30',
    headline: 'Departure Eve · Maximum Monopoly Pricing',
    recommendation: 'EXTREME GOUGING',
    bullets: [
      'Emergency & last-minute corporate distress demand captured at maximum ceiling',
      'Carriers exploit short-fuse inelasticity with peak capacity surcharges',
      'Close-in surge multiplier reaches peak domestic escalation (+30% to +85%)'
    ]
  }
};

interface AdvanceWindowTrajectoryChartProps {
  data: BookingWindowItem[];
  loading?: boolean;
  onWindowSelect?: (window: number) => void;
}

export function AdvanceWindowTrajectoryChart({
  data,
  loading = false,
  onWindowSelect,
}: AdvanceWindowTrajectoryChartProps) {
  // Chart Display Mode
  const [metricMode, setMetricMode] = useState<'fare' | 'premium' | 'index'>('fare');
  const [isPlaying, setIsPlaying] = useState(true);

  // Active Milestone Index (Order: T+45 -> T+30 -> T+15 -> T+7 -> T+1)
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flightPhase, setFlightPhase] = useState<'dwelling' | 'flying'>('dwelling');

  // Coordinates Map for SVG Overlay
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const coordsMapRef = useRef<Record<number, { x: number; y: number }>>({});
  const [planeCoords, setPlaneCoords] = useState<{ x: number; y: number; angle: number }>({ x: 0, y: 0, angle: 0 });

  const dwellDuration = 2800;
  const flightDuration = 850;

  // Track container width for responsive positioning
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

  // Process & Sort Data: Countdown sequence (T+45 down to T+1)
  const processedData = useMemo(() => {
    const raw = data && data.length > 0 ? data : [
      { window: 45, averageFare: 4850, observations: 512 },
      { window: 30, averageFare: 5120, observations: 498 },
      { window: 15, averageFare: 5890, observations: 540 },
      { window: 7, averageFare: 6840, observations: 525 },
      { window: 1, averageFare: 8420, observations: 480 },
    ];

    const sorted = [...raw].sort((a, b) => b.window - a.window);
    const baseFare = sorted[0]?.averageFare || 1;

    return sorted.map((item) => {
      const avg = Math.round(item.averageFare);
      const premium = Number((((avg - baseFare) / baseFare) * 100).toFixed(1));
      const indexVal = Number(((avg / baseFare) * 100).toFixed(1));
      return {
        ...item,
        label: `T+${item.window}`,
        displayLabel: item.window === 1 ? 'T+1 (Eve)' : `T+${item.window}`,
        avgFare: avg,
        premiumPct: premium,
        indexValue: indexVal,
      };
    });
  }, [data]);

  // Y-Axis Domain calculation based on selected metric mode
  const { yDomain, yTicks } = useMemo(() => {
    if (metricMode === 'fare') {
      const vals = processedData.map((d) => d.avgFare).filter(Boolean);
      if (!vals.length) return { yDomain: [4000, 9000] as [number, number], yTicks: [4000, 6000, 8000] };
      const minVal = Math.min(...vals);
      const maxVal = Math.max(...vals);
      const lower = Math.max(0, Math.floor((minVal - 300) / 500) * 500);
      const upper = Math.ceil((maxVal + 500) / 500) * 500;
      const ticks: number[] = [];
      const step = 1000;
      for (let v = lower; v <= upper; v += step) {
        ticks.push(v);
      }
      return { yDomain: [lower, upper] as [number, number], yTicks: ticks };
    } else if (metricMode === 'premium') {
      const vals = processedData.map((d) => d.premiumPct);
      const maxVal = Math.max(...vals, 10);
      const upper = Math.ceil((maxVal + 10) / 10) * 10;
      return {
        yDomain: [0, upper] as [number, number],
        yTicks: [0, Math.round(upper * 0.25), Math.round(upper * 0.5), Math.round(upper * 0.75), upper],
      };
    } else {
      // index mode (Base 100 at T+45)
      const vals = processedData.map((d) => d.indexValue);
      const maxVal = Math.max(...vals, 110);
      const upper = Math.ceil((maxVal + 10) / 10) * 10;
      return {
        yDomain: [100, upper] as [number, number],
        yTicks: [100, Math.round(100 + (upper - 100) * 0.33), Math.round(100 + (upper - 100) * 0.66), upper],
      };
    }
  }, [processedData, metricMode]);

  // Current active data point & milestone info
  const activePoint = processedData[currentIndex] || processedData[0];
  const activeMilestone = WINDOW_MILESTONE_DETAILS[activePoint?.window] || {
    window: activePoint?.window || 1,
    label: `T+${activePoint?.window || 1} Days`,
    badge: 'Observed Horizon',
    badgeColor: 'bg-amber-950/80 text-amber-300 border-amber-500/30',
    headline: `Booking Window Milestone (T+${activePoint?.window})`,
    recommendation: 'CAUTION',
    bullets: [
      `Average Fare: ${formatINR(activePoint?.avgFare || 0)} across domestic city pairs`,
      `Relative tariff premium: +${activePoint?.premiumPct || 0}% over early baseline`,
      'Dynamic yield bucket adjustment based on remaining seat capacity'
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

  // Jump flight to a specific window
  const jumpToMilestone = (idx: number) => {
    setCurrentIndex(idx);
    setFlightPhase('dwelling');
    const targetCoord = coordsMapRef.current[idx];
    if (targetCoord) {
      setPlaneCoords({ x: targetCoord.x, y: targetCoord.y, angle: 0 });
    }
    if (onWindowSelect && processedData[idx]) {
      onWindowSelect(processedData[idx].window);
    }
  };

  // Autonomous continuous flight simulation loop
  useEffect(() => {
    if (!isPlaying) return;

    let timer: NodeJS.Timeout;
    if (flightPhase === 'dwelling') {
      timer = setTimeout(() => {
        const nextIdx = (currentIndex + 1) % processedData.length;
        const currentCoord = coordsMapRef.current[currentIndex];
        const nextCoord = coordsMapRef.current[nextIdx];

        let targetAngle = 0;
        if (currentCoord && nextCoord) {
          const dx = nextCoord.x - currentCoord.x;
          const dy = nextCoord.y - currentCoord.y;
          // Calculate flight trajectory angle (pitching up on steep climbs)
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
          if (onWindowSelect && processedData[nextIdx]) {
            onWindowSelect(processedData[nextIdx].window);
          }
        }, flightDuration);

      }, dwellDuration);
    }

    return () => clearTimeout(timer);
  }, [isPlaying, flightPhase, currentIndex, processedData, onWindowSelect]);

  // Box positioning & horizontal clamping
  const boxWidth = 280;
  const halfBox = boxWidth / 2;
  const clampedX = Math.min(
    Math.max(halfBox + 8, planeCoords.x),
    Math.max(halfBox + 8, containerWidth - halfBox - 8)
  );
  const isNearTop = planeCoords.y < 130;

  // Key stats
  const t45 = processedData.find((d) => d.window === 45) || processedData[0];
  const t1 = processedData.find((d) => d.window === 1) || processedData[processedData.length - 1];
  const totalEscalation = t45 && t1 && t45.avgFare > 0
    ? Number((((t1.avgFare - t45.avgFare) / t45.avgFare) * 100).toFixed(1))
    : 0;

  const currentMetricKey = metricMode === 'fare' ? 'avgFare' : metricMode === 'premium' ? 'premiumPct' : 'indexValue';

  return (
    <section className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs transition-all">
      {/* 1. HEADER WITH CONTROLS & INSIGHTS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 mb-3 border-b border-slate-100 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-50 text-amber-900 border border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
              DEPARTURE COUNTDOWN FLIGHT PATH
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-mono text-slate-500">T+45 Advance → T+1 Departure Eve</span>
          </div>
          <h2 className="text-sm font-bold text-slate-900 mt-1 flex items-center gap-2">
            Advance Purchase Yield Escalation Trajectory
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Real-time algorithmic yield curve: Track how carrier algorithms elevate fares as departure proximity tightens
          </p>
        </div>

        {/* Controls: Simulation Play/Pause & Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Play/Pause Toggle */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors"
            title={isPlaying ? 'Pause simulation flight' : 'Resume autonomous flight'}
          >
            {isPlaying ? (
              <>
                <Pause className="w-3 h-3 text-amber-600 fill-amber-600" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3 h-3 text-emerald-600 fill-emerald-600" />
                <span>Auto-Fly</span>
              </>
            )}
          </button>

          {/* Metric View Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button
              onClick={() => setMetricMode('fare')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                metricMode === 'fare' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Fare (₹)
            </button>
            <button
              onClick={() => setMetricMode('premium')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                metricMode === 'premium' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Surge Premium (%)
            </button>
            <button
              onClick={() => setMetricMode('index')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-all ${
                metricMode === 'index' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Yield Index
            </button>
          </div>
        </div>
      </div>

      {/* 2. INTERACTIVE TIMELINE PILLS (DIRECT JUMP TO ANY HORIZON) */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3 p-1.5 bg-slate-50 border border-slate-200/80 rounded-lg">
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider pl-1 pr-1 flex items-center gap-1">
          <Compass className="w-3 h-3 text-slate-400" />
          Milestones:
        </span>
        {processedData.map((d, idx) => {
          const isCurrent = idx === currentIndex;
          const milestone = WINDOW_MILESTONE_DETAILS[d.window];
          return (
            <button
              key={d.window}
              onClick={() => jumpToMilestone(idx)}
              className={`px-2.5 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 ${
                isCurrent
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-xs ring-1 ring-amber-600'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />}
              <span>{d.displayLabel}</span>
              <span className={`text-[10px] ${isCurrent ? 'text-slate-900 font-semibold' : 'text-slate-500'}`}>
                {metricMode === 'fare'
                  ? formatINR(d.avgFare)
                  : metricMode === 'premium'
                  ? `+${d.premiumPct}%`
                  : d.indexValue}
              </span>
            </button>
          );
        })}

        <div className="ml-auto text-right pr-2 hidden md:block">
          <span className="text-[10px] font-sans text-slate-400">Total Escalation: </span>
          <span className="text-xs font-mono font-bold text-rose-600">+{totalEscalation}%</span>
        </div>
      </div>

      {/* 3. CHART CANVAS WITH SIMULATED FLIGHT JET OVERLAY */}
      <div className="relative w-full" ref={containerRef}>
        {loading ? (
          <div className="h-72 flex items-center justify-center text-xs text-slate-400 font-mono">
            Loading horizon trajectory...
          </div>
        ) : (
          <div className="h-72 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={processedData}
                margin={{ top: 28, right: 24, left: -6, bottom: 4 }}
              >
                <defs>
                  <linearGradient id="bwTrajectoryGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#d97706" stopOpacity={0.24} />
                    <stop offset="95%" stopColor="#d97706" stopOpacity={0.01} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />

                <XAxis
                  dataKey="displayLabel"
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                />

                <YAxis
                  domain={yDomain}
                  ticks={yTicks}
                  allowDataOverflow={true}
                  stroke="#94a3b8"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: '#e2e8f0' }}
                  tickFormatter={
                    metricMode === 'fare'
                      ? (v) => `₹${(v / 1000).toFixed(1)}k`
                      : metricMode === 'premium'
                      ? (v) => `+${v}%`
                      : (v) => `${v}`
                  }
                />

                <Tooltip
                  formatter={(value: any) => [
                    metricMode === 'fare'
                      ? formatINR(Number(value))
                      : metricMode === 'premium'
                      ? `+${value}% vs T+45`
                      : `${value} (Base 100)`,
                    metricMode === 'fare' ? 'Average Tariff' : metricMode === 'premium' ? 'Surge Premium' : 'Yield Index',
                  ]}
                  labelFormatter={(label) => `Horizon: ${label}`}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    border: '1px solid #d97706',
                    borderRadius: '8px',
                    fontSize: '11px',
                    color: '#fff',
                  }}
                />

                {metricMode === 'index' && (
                  <ReferenceLine
                    y={100}
                    stroke="#94a3b8"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Base 100.0 (T+45)',
                      fill: '#64748b',
                      fontSize: 10,
                      position: 'right',
                    }}
                  />
                )}

                <Area
                  type="monotone"
                  dataKey={currentMetricKey}
                  stroke="#d97706"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#bwTrajectoryGrad)"
                  dot={(dotProps: any) => {
                    const { cx, cy, index: dotIndex } = dotProps;
                    handleRegisterCoord(dotIndex, cx, cy);

                    const isCurrent = dotIndex === currentIndex;
                    return (
                      <g key={`dot-bw-${dotIndex}`} className="cursor-pointer" onClick={() => jumpToMilestone(dotIndex)}>
                        {isCurrent ? (
                          <g>
                            <circle
                              cx={cx}
                              cy={cy}
                              r={16}
                              fill="#f59e0b"
                              opacity={0.3}
                              className="animate-ping origin-center"
                            />
                            <circle
                              cx={cx}
                              cy={cy}
                              r={7}
                              fill="#f59e0b"
                              stroke="#ffffff"
                              strokeWidth={2.5}
                            />
                            <circle
                              cx={cx}
                              cy={cy}
                              r={3}
                              fill="#78350f"
                            />
                          </g>
                        ) : (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4.5}
                            fill="#ffffff"
                            stroke="#d97706"
                            strokeWidth={2}
                          />
                        )}
                      </g>
                    );
                  }}
                  activeDot={{ r: 7, stroke: '#d97706', strokeWidth: 2, fill: '#ffffff' }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* 4. THE ANIMATED FLIGHT JET OVERLAY */}
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
                      className="absolute -left-6 w-9 h-1.5 bg-gradient-to-l from-amber-400 via-orange-500 to-transparent rounded-full blur-[1px] animate-pulse"
                      style={{ transform: 'translateX(-4px)' }}
                    />
                  )}

                  {/* Stylized Jet Plane Icon */}
                  <div className="p-1.5 rounded-full bg-amber-500 text-stone-950 shadow-lg ring-2 ring-white flex items-center justify-center">
                    <Plane className="w-3.5 h-3.5 fill-stone-950 text-stone-950 transform rotate-45" />
                  </div>

                  {/* Wingtip strobe light */}
                  <div className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                </div>
              </div>
            )}

            {/* 5. FLOATING HUD CARD DIRECTLY AT THE ACTIVE HORIZON NODE */}
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
                <div className="bg-slate-900/95 backdrop-blur-md text-white border border-amber-500/40 rounded-xl shadow-2xl p-2.5 w-[280px] text-xs">
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-700/70 pb-1.5 mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="font-bold text-white text-xs tracking-tight">
                        {activeMilestone.label}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${activeMilestone.badgeColor}`}>
                        {activeMilestone.badge}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-right">
                      <span className="text-[11px] font-mono font-bold text-amber-400">
                        {formatINR(activePoint.avgFare)}
                      </span>
                      {activePoint.premiumPct > 0 && (
                        <span className="text-[10px] font-mono font-semibold text-rose-400">
                          +{activePoint.premiumPct}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Headline & Recommendation */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-slate-400 font-sans">Consumer Advice:</span>
                      <span className={`font-mono font-bold ${
                        activeMilestone.recommendation === 'STRONGLY RECOMMENDED'
                          ? 'text-emerald-400'
                          : activeMilestone.recommendation === 'ACCEPTABLE'
                          ? 'text-blue-400'
                          : activeMilestone.recommendation === 'CAUTION'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}>
                        {activeMilestone.recommendation}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-200 font-medium leading-tight">
                      {activeMilestone.headline}
                    </p>
                  </div>

                  {/* Bullet points */}
                  <ul className="space-y-1 text-[11px] text-slate-300">
                    {activeMilestone.bullets.map((bullet, i) => (
                      <li key={i} className="flex items-start gap-1.5 leading-tight">
                        <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Arrow pointer */}
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
