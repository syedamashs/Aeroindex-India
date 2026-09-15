import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plane, Radio, Shield, Crosshair } from 'lucide-react';

interface RadarBlip {
  id: string;
  callsign: string;
  route: string;
  fare: string;
  x: number; // percentage from center (-50 to 50)
  y: number; // percentage from center (-50 to 50)
  heading: number;
  altitude: string;
}

const BLIPS: RadarBlip[] = [
  { id: '1', callsign: '6E-2041', route: 'DEL-BOM', fare: '₹4,820', x: -18, y: -24, heading: 140, altitude: 'FL340' },
  { id: '2', callsign: 'AI-805', route: 'BLR-DEL', fare: '₹6,150', x: 28, y: -12, heading: 320, altitude: 'FL360' },
  { id: '3', callsign: 'SG-112', route: 'BOM-GOI', fare: '₹2,890', x: -26, y: 22, heading: 175, altitude: 'FL280' },
  { id: '4', callsign: 'QP-1304', route: 'HYD-BOM', fare: '₹3,450', x: 8, y: 18, heading: 260, altitude: 'FL310' },
  { id: '5', callsign: '6E-549', route: 'CCU-DEL', fare: '₹5,120', x: 34, y: 14, heading: 295, altitude: 'FL330' },
  { id: '6', callsign: 'UK-992', route: 'MAA-DEL', fare: '₹5,890', x: 14, y: 32, heading: 350, altitude: 'FL350' },
];

export function RadarScanner({ size = 260, className = '' }: { size?: number; className?: string }) {
  const [activeBlip, setActiveBlip] = useState<RadarBlip | null>(null);
  const [pingCount, setPingCount] = useState(27);

  useEffect(() => {
    const timer = setInterval(() => {
      setPingCount((c) => (c % 5 === 0 ? 28 : 27));
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      {/* Radar HUD Container */}
      <div
        className="relative rounded-full bg-navy-950 border-2 border-emerald-500/40 shadow-[0_0_40px_rgba(16,185,129,0.15)] overflow-hidden"
        style={{ width: size, height: size }}
      >
        {/* Radar concentric grid circles */}
        <div className="absolute inset-0 rounded-full border border-emerald-500/15" />
        <div className="absolute inset-8 rounded-full border border-emerald-500/20" />
        <div className="absolute inset-16 rounded-full border border-emerald-500/25 border-dashed" />
        <div className="absolute inset-24 rounded-full border border-emerald-500/30" />

        {/* Crosshair grid lines */}
        <div className="absolute inset-x-0 top-1/2 h-[1px] bg-emerald-500/20" />
        <div className="absolute inset-y-0 left-1/2 w-[1px] bg-emerald-500/20" />

        {/* Range distance markings */}
        <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-emerald-400/60">
          500 NM
        </span>
        <span className="absolute top-10 left-1/2 -translate-x-1/2 text-[8px] font-mono text-emerald-400/50">
          250 NM
        </span>
        <span className="absolute top-18 left-1/2 -translate-x-1/2 text-[8px] font-mono text-emerald-400/40">
          100 NM
        </span>

        {/* Azimuth angles */}
        <span className="absolute top-1 right-1 text-[8px] font-mono text-emerald-500/40">045°</span>
        <span className="absolute bottom-1 right-1 text-[8px] font-mono text-emerald-500/40">135°</span>
        <span className="absolute bottom-1 left-1 text-[8px] font-mono text-emerald-500/40">225°</span>
        <span className="absolute top-1 left-1 text-[8px] font-mono text-emerald-500/40">315°</span>

        {/* 360-degree rotating radar sweep beam */}
        <motion.div
          className="absolute inset-0 origin-center pointer-events-none"
          animate={{ rotate: 360 }}
          transition={{
            repeat: Infinity,
            duration: 4.5,
            ease: 'linear',
          }}
        >
          <div
            className="w-1/2 h-1/2 absolute top-0 left-1/2 origin-bottom-left"
            style={{
              background: 'conic-gradient(from 0deg at 0% 100%, rgba(16, 185, 129, 0.4) 0deg, rgba(16, 185, 129, 0.05) 50deg, transparent 65deg)',
            }}
          />
          {/* Sweep leading line */}
          <div className="w-[1.5px] h-1/2 bg-emerald-400 absolute top-0 left-1/2 shadow-[0_0_8px_#34d399]" />
        </motion.div>

        {/* Flight Radar Blips */}
        {BLIPS.map((blip) => {
          const centerX = size / 2;
          const centerY = size / 2;
          const left = centerX + (blip.x / 100) * size;
          const top = centerY + (blip.y / 100) * size;

          return (
            <div
              key={blip.id}
              onClick={() => setActiveBlip(blip)}
              className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-10"
              style={{ left, top }}
            >
              <div className="relative">
                {/* Blip glow ping */}
                <motion.span
                  className="absolute -inset-1 rounded-full bg-emerald-400/40"
                  animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                  transition={{ duration: 2.2, repeat: Infinity, delay: Number(blip.id) * 0.4 }}
                />
                {/* Blip plane icon */}
                <div
                  className="w-4 h-4 rounded-full bg-emerald-500/90 text-navy-950 flex items-center justify-center shadow-[0_0_6px_#10b981] group-hover:scale-125 transition-transform"
                  style={{ transform: `rotate(${blip.heading}deg)` }}
                >
                  <Plane className="w-2.5 h-2.5 text-navy-950" />
                </div>
              </div>

              {/* Blip Telemetry Label */}
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-navy-900/90 backdrop-blur-sm border border-emerald-500/40 px-1.5 py-0.5 rounded shadow-lg whitespace-nowrap opacity-75 group-hover:opacity-100 group-hover:scale-105 transition-all pointer-events-none">
                <p className="text-[9px] font-mono font-bold text-emerald-300 leading-none">
                  {blip.callsign}
                </p>
                <p className="text-[8px] font-mono text-white/90 leading-none mt-0.5">
                  {blip.route} • {blip.fare}
                </p>
              </div>
            </div>
          );
        })}

        {/* Center Radar Station Dot */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-emerald-400 border-2 border-navy-950 shadow-[0_0_8px_#34d399] z-20" />
      </div>

      {/* Radar Bottom Status Bar */}
      <div className="mt-2.5 flex items-center justify-between gap-4 text-[10px] font-mono text-emerald-400/80 w-full px-2">
        <span className="flex items-center gap-1">
          <Radio className="w-3 h-3 animate-pulse text-emerald-400" />
          ATC RADAR • SWEEP 360°
        </span>
        <span className="text-white/80 font-bold">{pingCount} TARGETS MONITORED</span>
      </div>
    </div>
  );
}
