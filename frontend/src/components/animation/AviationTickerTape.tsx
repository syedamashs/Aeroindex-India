import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plane, TrendingUp, TrendingDown, Zap, Radio } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface TickerItem {
  id: string;
  corridor: string;
  origin: string;
  dest: string;
  fare: number;
  change: number;
  airline: string;
  status: 'active' | 'surge' | 'drop' | 'stable';
}

const INITIAL_CORRIDORS: TickerItem[] = [
  { id: 'DELHI_MUMBAI', corridor: 'DEL ➔ BOM', origin: 'DEL', dest: 'BOM', fare: 4820, change: -2.8, airline: '6E', status: 'drop' },
  { id: 'BENGALURU_DELHI', corridor: 'BLR ➔ DEL', origin: 'BLR', dest: 'DEL', fare: 6240, change: +4.1, airline: 'AI', status: 'surge' },
  { id: 'DELHI_GOA', corridor: 'DEL ➔ GOI', origin: 'DEL', dest: 'GOI', fare: 2890, change: -1.2, airline: 'SG', status: 'drop' },
  { id: 'KOLKATA_MUMBAI', corridor: 'CCU ➔ BOM', origin: 'CCU', dest: 'BOM', fare: 5120, change: +1.5, airline: '6E', status: 'surge' },
  { id: 'HYDERABAD_MUMBAI', corridor: 'HYD ➔ BOM', origin: 'HYD', dest: 'BOM', fare: 3450, change: -3.4, airline: 'QP', status: 'drop' },
  { id: 'CHENNAI_DELHI', corridor: 'MAA ➔ DEL', origin: 'MAA', dest: 'DEL', fare: 5890, change: +2.3, airline: 'AI', status: 'surge' },
  { id: 'DELHI_PUNE', corridor: 'DEL ➔ PNQ', origin: 'DEL', dest: 'PNQ', fare: 4210, change: 0.0, airline: '6E', status: 'stable' },
  { id: 'BENGALURU_MUMBAI', corridor: 'BLR ➔ BOM', origin: 'BLR', dest: 'BOM', fare: 3180, change: -4.2, airline: 'AI', status: 'drop' },
  { id: 'AHMEDABAD_DELHI', corridor: 'AMD ➔ DEL', origin: 'AMD', dest: 'DEL', fare: 2950, change: +0.8, airline: 'SG', status: 'stable' },
  { id: 'DELHI_SRINAGAR', corridor: 'DEL ➔ SXR', origin: 'DEL', dest: 'SXR', fare: 7350, change: +6.5, airline: '6E', status: 'surge' },
];

export function AviationTickerTape() {
  const [items, setItems] = useState<TickerItem[]>(INITIAL_CORRIDORS);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();

  // Subtle live tick every 4 seconds simulating live domestic scraping pings
  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) => {
        const randomIndex = Math.floor(Math.random() * prev.length);
        const current = prev[randomIndex];
        const delta = (Math.random() * 80 - 40); // -40 to +40 fare shift
        const newFare = Math.max(1800, Math.round(current.fare + delta));
        const newChange = Number((current.change + (delta / current.fare) * 10).toFixed(1));

        return prev.map((item, idx) =>
          idx === randomIndex
            ? {
                ...item,
                fare: newFare,
                change: newChange,
                status: newChange > 2 ? 'surge' : newChange < -2 ? 'drop' : 'stable',
              }
            : item
        );
      });
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  // Double items for seamless infinite scroll loop
  const duplicatedItems = [...items, ...items];

  return (
    <div
      className="relative w-full bg-navy-950/90 backdrop-blur-md border-b border-navy-800/80 text-white overflow-hidden py-1.5 px-3 select-none flex items-center z-10 text-xs shadow-inner"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Left Badge */}
      <div className="flex items-center gap-2 pr-3.5 border-r border-navy-800 flex-shrink-0 z-10 bg-navy-950">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="font-mono font-bold tracking-wider text-[10px] text-accent-400 uppercase flex items-center gap-1">
          <Radio className="w-3 h-3 animate-pulse" />
          FEED
        </span>
      </div>

      {/* Marquee Animation Container */}
      <div className="overflow-hidden flex-1 relative mx-2">
        <motion.div
          className="flex items-center gap-6 whitespace-nowrap"
          animate={{
            x: isPaused ? undefined : ['0%', '-50%'],
          }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 38,
              ease: 'linear',
            },
          }}
        >
          {duplicatedItems.map((item, idx) => {
            const isPositive = item.change > 0;
            const isZero = item.change === 0;

            return (
              <div
                key={`${item.id}-${idx}`}
                onClick={() => navigate(`/routes/${item.id}`)}
                className="group inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-navy-900/60 hover:bg-navy-800 border border-navy-800 hover:border-accent-500/40 transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
              >
                <div className="flex items-center gap-1 text-[11px] font-bold text-slate-200 group-hover:text-white">
                  <Plane className="w-3 h-3 text-accent-400 transform -rotate-45 group-hover:translate-x-0.5 transition-transform" />
                  <span>{item.corridor}</span>
                </div>

                <span className="text-[10px] font-mono font-medium px-1 rounded bg-navy-950 text-navy-400 border border-navy-800">
                  {item.airline}
                </span>

                <span className="font-mono font-bold text-white text-[11px]">
                  ₹{item.fare.toLocaleString('en-IN')}
                </span>

                <span
                  className={`inline-flex items-center text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    isZero
                      ? 'text-slate-400 bg-slate-800/40'
                      : isPositive
                      ? 'text-rose-400 bg-rose-500/15'
                      : 'text-emerald-400 bg-emerald-500/15'
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                  ) : isZero ? null : (
                    <TrendingDown className="w-2.5 h-2.5 mr-0.5" />
                  )}
                  {item.change > 0 ? `+${item.change}%` : `${item.change}%`}
                </span>

                {item.status === 'surge' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" />
                )}
                {item.status === 'drop' && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </div>
            );
          })}
        </motion.div>
      </div>

      {/* Right Indicator */}
      <div className="hidden sm:flex items-center gap-1.5 pl-3 border-l border-navy-800 text-[10px] text-navy-400 font-mono flex-shrink-0 z-10 bg-navy-950">
        <Zap className="w-3 h-3 text-amber-400" />
        <span>27 Corridors</span>
      </div>
    </div>
  );
}
