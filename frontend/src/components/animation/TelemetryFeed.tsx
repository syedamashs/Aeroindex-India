import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, ShieldCheck, Database, Radio, Pause, Play, Trash2 } from 'lucide-react';

interface TelemetryLog {
  id: string;
  time: string;
  level: 'info' | 'success' | 'warn';
  channel: 'SCRAPER' | 'DQE' | 'INDEX' | 'SQLITE';
  message: string;
}

const SEED_LOGS: TelemetryLog[] = [
  { id: '1', time: '22:14:02', level: 'info', channel: 'SCRAPER', message: 'Playwright headless worker dispatched for DEL-BOM (IndiGo 6E-204)' },
  { id: '2', time: '22:14:04', level: 'success', channel: 'DQE', message: 'Schema validated: 14 fields passed ISO-8601 & Tariff Bound checks' },
  { id: '3', time: '22:14:05', level: 'info', channel: 'SQLITE', message: 'INSERT batch: 48 domestic flight observation records committed (0.42ms)' },
  { id: '4', time: '22:14:07', level: 'success', channel: 'INDEX', message: 'Laspeyres monthly basket recalculated. Current index: 142.8 pts (+1.2%)' },
  { id: '5', time: '22:14:09', level: 'info', channel: 'SCRAPER', message: 'Air India AI-805 BLR-DEL fare fetched: ₹6,150 (T+7 horizon)' },
  { id: '6', time: '22:14:11', level: 'warn', channel: 'DQE', message: 'Surge indicator: BOM-GOI holiday premium detected (+18.4% above baseline)' },
];

const GENERATED_POOL = [
  { channel: 'SCRAPER' as const, level: 'info' as const, msg: 'Scraping worker poll: SpiceJet SG-112 fare captured: ₹2,890' },
  { channel: 'DQE' as const, level: 'success' as const, msg: 'SHA-256 deduplication hash verified: 0 duplicate rows quarantined' },
  { channel: 'SQLITE' as const, level: 'info' as const, msg: 'Query optimizer: indexed scan on apix_observations (carrier_id, travel_date)' },
  { channel: 'INDEX' as const, level: 'success' as const, msg: 'Laspeyres trunk weights normalized: 27 domestic corridors weighted 100%' },
  { channel: 'SCRAPER' as const, level: 'info' as const, msg: 'Akasa Air QP-1304 HYD-BOM booking curve captured across T+1 to T+30' },
  { channel: 'DQE' as const, level: 'success' as const, msg: 'Outlier rejection: 3-sigma modified z-score isolation confirmed zero false tariffs' },
  { channel: 'SQLITE' as const, level: 'info' as const, msg: 'WAL checkpoint completed: 0 dirty pages in write-ahead log' },
  { channel: 'INDEX' as const, level: 'info' as const, msg: 'MoCA national airfare monitor: high-frequency volatility index: 14.8%' },
];

export function TelemetryFeed({ maxLogs = 12 }: { maxLogs?: number }) {
  const [logs, setLogs] = useState<TelemetryLog[]>(SEED_LOGS);
  const [isPaused, setIsPaused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'SCRAPER' | 'DQE' | 'INDEX' | 'SQLITE'>('ALL');
  const feedEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      const template = GENERATED_POOL[Math.floor(Math.random() * GENERATED_POOL.length)];
      const now = new Date();
      const time = now.toTimeString().split(' ')[0];

      const newLog: TelemetryLog = {
        id: String(Date.now()),
        time,
        level: template.level,
        channel: template.channel,
        message: template.msg,
      };

      setLogs((prev) => [...prev.slice(-(maxLogs - 1)), newLog]);
    }, 3200);

    return () => clearInterval(interval);
  }, [isPaused, maxLogs]);

  const filteredLogs = activeFilter === 'ALL' ? logs : logs.filter((l) => l.channel === activeFilter);

  return (
    <div className="rounded-2xl bg-navy-950 border border-navy-800 text-white shadow-2xl overflow-hidden font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="px-4 py-3 bg-navy-900/80 border-b border-navy-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold text-xs ml-2">
            <Terminal className="w-3.5 h-3.5 text-accent-400" />
            <span>AeroIndex Telemetry Ingest Stream</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Channel Filters */}
          <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-lg border border-navy-800 text-[10px]">
            {(['ALL', 'SCRAPER', 'DQE', 'INDEX', 'SQLITE'] as const).map((ch) => (
              <button
                key={ch}
                onClick={() => setActiveFilter(ch)}
                className={`px-2 py-0.5 rounded transition-colors ${
                  activeFilter === ch ? 'bg-navy-800 text-accent-400 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsPaused(!isPaused)}
            className="p-1.5 rounded-lg bg-navy-950 border border-navy-800 text-slate-300 hover:text-white transition-colors"
            title={isPaused ? 'Resume stream' : 'Pause stream'}
          >
            {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
          </button>

          <button
            onClick={() => setLogs([])}
            className="p-1.5 rounded-lg bg-navy-950 border border-navy-800 text-slate-400 hover:text-rose-400 transition-colors"
            title="Clear logs"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Log Stream */}
      <div className="p-4 space-y-2 max-h-72 overflow-y-auto bg-navy-950/90 font-mono">
        <AnimatePresence initial={false}>
          {filteredLogs.map((log) => {
            const badgeColor =
              log.channel === 'SCRAPER'
                ? 'text-cyan-400 bg-cyan-950/60 border-cyan-800/60'
                : log.channel === 'DQE'
                ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/60'
                : log.channel === 'INDEX'
                ? 'text-indigo-400 bg-indigo-950/60 border-indigo-800/60'
                : 'text-amber-400 bg-amber-950/60 border-amber-800/60';

            return (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="flex items-start gap-2.5 leading-relaxed hover:bg-navy-900/40 p-1 rounded"
              >
                <span className="text-slate-500 select-none text-[11px] shrink-0 font-medium">[{log.time}]</span>
                <span
                  className={`px-1.5 py-0.2 text-[9px] font-bold rounded border shrink-0 ${badgeColor}`}
                >
                  {log.channel}
                </span>
                <span
                  className={`text-[11px] ${
                    log.level === 'warn'
                      ? 'text-amber-300'
                      : log.level === 'success'
                      ? 'text-emerald-300'
                      : 'text-slate-200'
                  }`}
                >
                  {log.message}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={feedEndRef} />
      </div>

      {/* Footer Info */}
      <div className="px-4 py-2 bg-navy-900/40 border-t border-navy-800/80 flex items-center justify-between text-[10px] text-navy-400">
        <span className="flex items-center gap-1.5">
          <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
          Listening on localhost:3001/ws/telemetry • Live Data Ingestion
        </span>
        <span>{filteredLogs.length} events buffered</span>
      </div>
    </div>
  );
}
