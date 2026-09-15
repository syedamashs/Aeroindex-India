import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plane, Compass, Navigation, Clock, Gauge, ArrowRight } from 'lucide-react';

interface FlightPathTrajectoryProps {
  origin: string;
  originCity?: string;
  destination: string;
  destinationCity?: string;
  distanceKm?: number;
  duration?: string;
  altitude?: string;
  fare?: number | string;
  className?: string;
}

export function FlightPathTrajectory({
  origin,
  originCity = 'Origin Hub',
  destination,
  destinationCity = 'Destination Hub',
  distanceKm = 1148,
  duration = '2h 10m',
  altitude = 'FL340 (34,000 ft)',
  fare,
  className = '',
}: FlightPathTrajectoryProps) {
  // Flight progress loop 0 to 100%
  const [progress, setProgress] = useState(42);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => (p >= 98 ? 5 : p + 3));
    }, 800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl bg-gradient-to-r from-navy-950 via-navy-900 to-navy-950 border border-navy-800 p-5 text-white shadow-xl ${className}`}
    >
      {/* Background Radar Grid */}
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

      {/* Top Corridor Header */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-navy-800/80">
        <div className="flex items-center gap-4">
          <div className="text-left">
            <span className="text-2xl font-display font-black tracking-tight text-white">{origin}</span>
            <p className="text-[11px] font-medium text-navy-400">{originCity}</p>
          </div>

          <div className="flex flex-col items-center px-3">
            <div className="flex items-center gap-1 text-[10px] font-mono text-accent-400 uppercase font-bold tracking-wider">
              <Compass className="w-3 h-3" />
              <span>Great Circle Route</span>
            </div>
            <div className="w-24 sm:w-36 h-[2px] bg-gradient-to-r from-emerald-500/20 via-emerald-400 to-emerald-500/20 my-1 relative">
              <motion.div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                style={{ left: `${progress}%` }}
              >
                <Plane className="w-4 h-4 text-emerald-300 transform rotate-90 drop-shadow-[0_0_8px_#34d399]" />
              </motion.div>
            </div>
            <span className="text-[10px] font-mono text-slate-400">{distanceKm} km direct</span>
          </div>

          <div className="text-right">
            <span className="text-2xl font-display font-black tracking-tight text-white">{destination}</span>
            <p className="text-[11px] font-medium text-navy-400">{destinationCity}</p>
          </div>
        </div>

        {/* Live Flight Telemetry Badges */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-navy-900/80 border border-navy-700/60 flex items-center gap-2 text-xs">
            <Clock className="w-3.5 h-3.5 text-accent-400" />
            <div>
              <p className="text-[10px] text-navy-400 uppercase font-semibold">Block Time</p>
              <p className="font-mono font-bold text-white leading-tight">{duration}</p>
            </div>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-navy-900/80 border border-navy-700/60 flex items-center gap-2 text-xs">
            <Gauge className="w-3.5 h-3.5 text-blue-400" />
            <div>
              <p className="text-[10px] text-navy-400 uppercase font-semibold">Cruise Alt</p>
              <p className="font-mono font-bold text-white leading-tight">{altitude}</p>
            </div>
          </div>

          {fare && (
            <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center gap-2 text-xs">
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              <div>
                <p className="text-[10px] text-emerald-300 uppercase font-semibold">Active Base Fare</p>
                <p className="font-mono font-bold text-emerald-400 leading-tight">
                  {typeof fare === 'number' ? `₹${fare.toLocaleString('en-IN')}` : fare}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Curved Trajectory Arc SVG */}
      <div className="relative z-10 pt-4 pb-2">
        <svg className="w-full h-24 overflow-visible" viewBox="0 0 600 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="corridorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#6366f1" stopOpacity="0.8" />
            </linearGradient>
            <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#38bdf8" />
            </filter>
          </defs>

          {/* Background guide arc */}
          <path
            d="M 20 80 Q 300 0 580 80"
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="3"
            strokeDasharray="4 4"
          />

          {/* Animated glowing flight path */}
          <motion.path
            d="M 20 80 Q 300 0 580 80"
            fill="none"
            stroke="url(#corridorGrad)"
            strokeWidth="3"
            filter="url(#glowEffect)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2.2, ease: 'easeInOut' }}
          />

          {/* Origin Radar Ping Ring */}
          <circle cx="20" cy="80" r="5" fill="#10b981" />
          <circle cx="20" cy="80" r="11" fill="none" stroke="#10b981" strokeWidth="1.5" className="animate-ping opacity-75" />

          {/* Destination Radar Ping Ring */}
          <circle cx="580" cy="80" r="5" fill="#6366f1" />
          <circle cx="580" cy="80" r="11" fill="none" stroke="#6366f1" strokeWidth="1.5" className="animate-ping opacity-75" />
        </svg>

        {/* Dynamic Flight Corridor Progress Bar */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-2">
          <span className="flex items-center gap-1 text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Origin: {origin} Gate Cleared
          </span>
          <span className="text-white font-bold">En Route ({progress}%)</span>
          <span className="flex items-center gap-1 text-indigo-400">
            Destination: {destination} Inbound
            <span className="w-2 h-2 rounded-full bg-indigo-400" />
          </span>
        </div>
      </div>
    </div>
  );
}
