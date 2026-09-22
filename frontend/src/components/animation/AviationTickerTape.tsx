import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface TickerItem {
  id: string;
  corridor: string;
  origin: string;
  dest: string;
  fare: number;
  change: number;
  airline: string;
}

const INITIAL_CORRIDORS: TickerItem[] = [
  { id: 'DELHI_MUMBAI', corridor: 'DEL → BOM', origin: 'DEL', dest: 'BOM', fare: 4820, change: -2.8, airline: '6E' },
  { id: 'BENGALURU_DELHI', corridor: 'BLR → DEL', origin: 'BLR', dest: 'DEL', fare: 6240, change: +4.1, airline: 'AI' },
  { id: 'DELHI_GOA', corridor: 'DEL → GOI', origin: 'DEL', dest: 'GOI', fare: 2890, change: -1.2, airline: 'SG' },
  { id: 'KOLKATA_MUMBAI', corridor: 'CCU → BOM', origin: 'CCU', dest: 'BOM', fare: 5120, change: +1.5, airline: '6E' },
  { id: 'HYDERABAD_MUMBAI', corridor: 'HYD → BOM', origin: 'HYD', dest: 'BOM', fare: 3450, change: -3.4, airline: 'QP' },
  { id: 'CHENNAI_DELHI', corridor: 'MAA → DEL', origin: 'MAA', dest: 'DEL', fare: 5890, change: +2.3, airline: 'AI' },
  { id: 'DELHI_PUNE', corridor: 'DEL → PNQ', origin: 'DEL', dest: 'PNQ', fare: 4210, change: 0.0, airline: '6E' },
  { id: 'BENGALURU_MUMBAI', corridor: 'BLR → BOM', origin: 'BLR', dest: 'BOM', fare: 3180, change: -4.2, airline: 'AI' },
  { id: 'AHMEDABAD_DELHI', corridor: 'AMD → DEL', origin: 'AMD', dest: 'DEL', fare: 2950, change: +0.8, airline: 'SG' },
  { id: 'DELHI_SRINAGAR', corridor: 'DEL → SXR', origin: 'DEL', dest: 'SXR', fare: 7350, change: +6.5, airline: '6E' },
];

export function AviationTickerTape() {
  const [items, setItems] = useState<TickerItem[]>(INITIAL_CORRIDORS);
  const [isPaused, setIsPaused] = useState(false);
  const navigate = useNavigate();

  // Periodic market tick simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setItems((prev) => {
        const randomIndex = Math.floor(Math.random() * prev.length);
        const current = prev[randomIndex];
        const delta = (Math.random() * 60 - 30);
        const newFare = Math.max(1800, Math.round(current.fare + delta));
        const newChange = Number((current.change + (delta / current.fare) * 8).toFixed(1));

        return prev.map((item, idx) =>
          idx === randomIndex
            ? { ...item, fare: newFare, change: newChange }
            : item
        );
      });
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const duplicatedItems = [...items, ...items];

  return (
    <div
      id="guide-ticker-tape"
      className="w-full bg-[#18181b] text-stone-300 border-b border-[#27272a] text-[11px] font-mono py-1.5 px-4 select-none flex items-center overflow-hidden z-10"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-center gap-2 pr-3 mr-2 border-r border-[#3f3f46] shrink-0 text-stone-400 font-sans text-[10px] uppercase font-semibold tracking-wider">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="text-amber-400/90">Trunk Corridors</span>
      </div>

      <div className="overflow-hidden flex-1 relative">
        <motion.div
          className="flex items-center gap-6 whitespace-nowrap"
          animate={{ x: isPaused ? undefined : ['0%', '-50%'] }}
          transition={{
            x: {
              repeat: Infinity,
              repeatType: 'loop',
              duration: 42,
              ease: 'linear',
            },
          }}
        >
          {duplicatedItems.map((item, idx) => {
            const isPositive = item.change > 0;
            const isNegative = item.change < 0;

            return (
              <button
                key={`${item.id}-${idx}`}
                type="button"
                onClick={() => navigate(`/routes/${item.id}`)}
                className="inline-flex items-center gap-2 hover:text-white transition-colors cursor-pointer text-left"
              >
                <span className="font-semibold text-stone-200">{item.corridor}</span>
                <span className="text-stone-500 text-[10px]">{item.airline}</span>
                <span className="text-stone-100 font-bold">₹{item.fare.toLocaleString('en-IN')}</span>
                <span className={`text-[10px] ${isPositive ? 'text-rose-400' : isNegative ? 'text-emerald-400' : 'text-stone-400'}`}>
                  {isPositive ? `+${item.change}%` : `${item.change}%`}
                </span>
                <span className="text-stone-600">/</span>
              </button>
            );
          })}
        </motion.div>
      </div>

      <div className="hidden md:flex items-center gap-2 pl-3 ml-2 border-l border-slate-700/80 shrink-0 text-slate-400 font-sans text-[10px]">
        <span>27 Monitored Pairs</span>
      </div>
    </div>
  );
}
