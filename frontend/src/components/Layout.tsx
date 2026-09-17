import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { type ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  TrendingUp,
  Route as RouteIcon,
  Plane,
  Clock,
  Map as MapIcon,
  Table2,
  Bell,
  BookOpen,
  LogOut,
  Menu,
  X,
  Zap,
  Shield,
  GitCompareArrows,
  ClipboardCheck,
  Lightbulb,
  Settings2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { apiRunScheduler, apiSchedulerStatus, type SchedulerTaskStatus } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { AviationTickerTape } from '@/components/animation/AviationTickerTape';
import { fireConfetti } from '@/components/animation/confetti';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/index', label: 'Airfare Index', icon: TrendingUp },
  { to: '/routes', label: 'Route Analysis', icon: RouteIcon },
  { to: '/airlines', label: 'Airline Analysis', icon: Plane },
  { to: '/booking-window', label: 'Booking Window', icon: Clock },
  { to: '/map', label: 'India Map', icon: MapIcon },
  { to: '/explorer', label: 'Data Explorer', icon: Table2 },
  { to: '/fare-state', label: 'Fare-State Analysis', icon: GitCompareArrows },
  { to: '/dqe', label: 'Data Quality', icon: ClipboardCheck },
  { to: '/insights', label: 'Policy Insights', icon: Lightbulb },
  { to: '/system', label: 'System & API', icon: Settings2 },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/methodology', label: 'Methodology', icon: BookOpen },
];

const SCHEDULER_AIRLINES = [
  { value: 'airindia', label: 'Air India' },
  { value: 'indigo', label: 'IndiGo' },
  { value: 'spicejet', label: 'SpiceJet' },
];

const SCHEDULER_LEAD_TIMES = [1, 7, 15, 30];
const SCHEDULER_ROUTES = [
  { value: 'DELHI_MUMBAI', label: 'Delhi to Mumbai' },
  { value: 'CHENNAI_DELHI', label: 'Chennai to Delhi' },
  { value: 'CHENNAI_MUMBAI', label: 'Chennai to Mumbai' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { lastUpdate } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [schedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerTasks, setSchedulerTasks] = useState<SchedulerTaskStatus[]>([]);
  const [selectedSchedulerAirlines, setSelectedSchedulerAirlines] = useState<string[]>(SCHEDULER_AIRLINES.map((airline) => airline.value));
  const [selectedSchedulerLeadTimes, setSelectedSchedulerLeadTimes] = useState<number[]>(SCHEDULER_LEAD_TIMES);
  const [selectedSchedulerRoutes, setSelectedSchedulerRoutes] = useState<string[]>(SCHEDULER_ROUTES.map((route) => route.value));
  const [schedulerResult, setSchedulerResult] = useState<{
    kind: 'success' | 'warning' | 'error';
    message: string;
    observationsBefore?: number;
    observationsAfter?: number;
    observationsInserted?: number;
  } | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const openSchedulerModal = () => {
    setSchedulerResult(null);
    setSelectedSchedulerAirlines(SCHEDULER_AIRLINES.map((airline) => airline.value));
    setSelectedSchedulerLeadTimes([...SCHEDULER_LEAD_TIMES]);
    setSelectedSchedulerRoutes(SCHEDULER_ROUTES.map((route) => route.value));
    setSchedulerModalOpen(true);
  };

  const handleSchedulerRun = async () => {
    const selection = {
      airlines: [...selectedSchedulerAirlines],
      leadTimes: [...selectedSchedulerLeadTimes],
      routes: [...selectedSchedulerRoutes],
    };

    if (!selection.airlines.length || !selection.leadTimes.length || !selection.routes.length) {
      setSchedulerResult({
        kind: 'error',
        message: 'Select at least one airline, route, and booking window.',
      });
      return;
    }

    setSchedulerRunning(true);
    setSchedulerResult(null);
    setSchedulerTasks([]);

    let pollTimer: number | undefined;

    const pollProgress = async () => {
      try {
        const status = await apiSchedulerStatus();
        setSchedulerTasks(status.tasks ?? []);
      } catch {
        // Ignore transient polling failures while the scheduler is still running.
      }
    };

    pollTimer = window.setInterval(() => {
      void pollProgress();
    }, 1200);

    try {
      const result = await apiRunScheduler(selection);
      await pollProgress();
      fireConfetti();
      setSchedulerResult({
        kind: result.observationsInserted === 0 ? 'warning' : result.uploadCompleted ? 'success' : 'warning',
        message: result.message,
        observationsBefore: result.observationsBefore,
        observationsAfter: result.observationsAfter,
        observationsInserted: result.observationsInserted,
      });
    } catch (error) {
      setSchedulerResult({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Unable to run the scheduler.',
      });
    } finally {
      if (pollTimer) {
        window.clearInterval(pollTimer);
      }
      setSchedulerRunning(false);
    }
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-navy-950 text-white fixed inset-y-0 left-0 z-30 border-r border-navy-800/80 shadow-2xl">
        <div className="px-5 py-5 border-b border-navy-800/80 bg-navy-950/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-navy-800 to-navy-600 flex items-center justify-center shadow-md ring-1 ring-white/10 overflow-hidden p-1">
              <img src="/logo.png" alt="AeroIndex Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-lg leading-tight tracking-tight text-white flex items-center gap-1.5">
                Vayuyaan
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-400 border border-accent-500/30">IN</span>
              </h1>
              <p className="text-[11px] font-medium text-navy-400">National Aviation Grid</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`app-nav-item flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                  active
                    ? 'bg-gradient-to-r from-navy-800 to-navy-800/80 text-white shadow-sm border-l-2 border-accent-400 translate-x-0.5'
                    : 'text-slate-400 hover:text-white hover:bg-navy-900/80'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${active ? 'text-accent-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-navy-800/80 bg-navy-950/40 space-y-2.5">
          <button
            onClick={openSchedulerModal}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-accent-500/20 to-accent-500/10 text-accent-300 hover:from-accent-500/30 hover:to-accent-500/20 transition-all text-xs font-bold border border-accent-500/30 shadow-sm active:scale-95"
          >
            <Zap className="w-4 h-4 text-accent-400" />
            <span>Run Scraper</span>
          </button>

          <NavLink
            to="/audit"
            className={({ isActive: active }) =>
              `flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                active || isActive('/audit')
                  ? 'bg-navy-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-navy-900'
              }`
            }
          >
            <Shield className="w-4 h-4 flex-shrink-0 text-slate-400" />
            <span>Audit Trail</span>
          </NavLink>

          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-navy-900/60 border border-navy-800">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-navy-700 border border-navy-600 flex items-center justify-center text-xs font-bold text-white">
                  {user?.name?.charAt(0) ?? 'U'}
                </div>
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-navy-900" />
              </div>
              <div className="text-xs">
                <p className="text-white font-bold leading-tight truncate max-w-[100px]">{user?.name}</p>
                <p className="text-[10px] text-navy-400 capitalize">{user?.role || 'Analyst'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="text-slate-400 hover:text-rose-400 transition-colors p-1.5 rounded-lg hover:bg-navy-800"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 bg-navy-950 text-white px-4 py-3 flex items-center justify-between border-b border-navy-800">
        <div className="flex items-center gap-2.5">
          <img src="/logo.png" alt="AeroIndex Logo" className="w-7 h-7 object-contain" />
          <span className="font-display font-extrabold text-white">Vayuyaan India</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1 rounded-lg text-slate-300 hover:text-white">
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-navy-950/95 backdrop-blur-xl text-white overflow-y-auto pt-16 px-4 pb-8 space-y-4">
          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive: active }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold ${
                      active || isActive(item.to) ? 'bg-navy-800 text-white border-l-2 border-accent-400' : 'text-slate-300'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
            <NavLink
              to="/audit"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-300"
            >
              <Shield className="w-4 h-4" />
              <span>Audit Trail</span>
            </NavLink>
          </nav>
          <div className="pt-4 border-t border-navy-800 space-y-3">
            <button
              onClick={() => { openSchedulerModal(); setMobileOpen(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent-500/20 text-accent-300 text-sm font-bold border border-accent-500/30"
            >
              <Zap className="w-4 h-4" />
              <span>Run Scraper</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-rose-400 hover:bg-rose-500/10"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 lg:ml-64 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-4 lg:px-8 py-3 flex items-center justify-between shadow-sm">
          <div className="hidden lg:flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-navy-50 text-navy-700 text-xs font-semibold border border-navy-200/60">
              SIH26056
            </span>
            <span className="text-xs text-slate-500 font-mono font-medium">Civil Aviation Data Intelligence</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="app-sync-status text-xs text-slate-500 hidden sm:inline font-mono">
              <span className="app-sync-dot" />
              Live Synced: {new Date(lastUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={openSchedulerModal}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-900 text-white hover:bg-navy-800 text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-accent-400" />
              <span>Run Scraper</span>
            </button>
          </div>
        </header>

        {schedulerModalOpen && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-navy-950/65 px-4 py-6 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="scheduler-modal-title"
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            >
              <div className="flex items-start justify-between border-b border-slate-100 bg-navy-950 px-6 py-5 text-white">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-500/20 text-accent-300">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-accent-300">Stage-A live collection</p>
                    <h2 id="scheduler-modal-title" className="mt-1 text-xl font-extrabold tracking-tight">Run scraper?</h2>
                  </div>
                </div>
                <button
                  onClick={() => setSchedulerModalOpen(false)}
                  disabled={schedulerRunning}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Close scheduler dialog"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5 px-6 py-6">
                {!schedulerResult && !schedulerRunning && (
                  <>
                    <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <p className="text-sm leading-6">Stage-A Scraping -&gt; 3 routes, 3 airlines, 4 time windows. All are selected by default; untick anything you do not want to collect.</p>
                      <p className="mt-2 text-xs font-semibold text-amber-800">
                        Selected now: {selectedSchedulerAirlines.length} airlines, {selectedSchedulerRoutes.length} routes, {selectedSchedulerLeadTimes.length} time windows.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Routes</p>
                        <div className="mt-3 space-y-2">
                          {SCHEDULER_ROUTES.map((route) => (
                            <label key={route.value} className="flex items-center gap-2 text-sm font-semibold text-navy-950">
                              <input
                                type="checkbox"
                                checked={selectedSchedulerRoutes.includes(route.value)}
                                onChange={(event) => setSelectedSchedulerRoutes((current) => event.target.checked
                                  ? [...current, route.value]
                                  : current.filter((value) => value !== route.value))}
                                className="h-4 w-4 accent-emerald-600"
                              />
                              {route.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Airlines</p>
                        <div className="mt-3 space-y-2">
                          {SCHEDULER_AIRLINES.map((airline) => (
                            <label key={airline.value} className="flex items-center gap-2 text-sm font-semibold text-navy-950">
                              <input
                                type="checkbox"
                                checked={selectedSchedulerAirlines.includes(airline.value)}
                                onChange={(event) => setSelectedSchedulerAirlines((current) => event.target.checked
                                  ? [...new Set([...current, airline.value])]
                                  : current.filter((value) => value !== airline.value))}
                                className="h-4 w-4 accent-emerald-600"
                              />
                              {airline.label}
                            </label>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Booking windows</p>
                        <div className="mt-3 flex flex-wrap gap-4">
                          {SCHEDULER_LEAD_TIMES.map((days) => (
                            <label key={days} className="flex items-center gap-2 text-sm font-semibold text-navy-950">
                              <input
                                type="checkbox"
                                checked={selectedSchedulerLeadTimes.includes(days)}
                                onChange={(event) => setSelectedSchedulerLeadTimes((current) => event.target.checked
                                  ? [...current, days].filter((value, index, values) => values.indexOf(value) === index)
                                  : current.filter((value) => value !== days))}
                                className="h-4 w-4 accent-emerald-600"
                              />
                              T+{days}
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {schedulerRunning && (
                  <div className="space-y-4 rounded-xl border border-navy-200 bg-navy-50 p-4 text-navy-950">
                    <div className="flex items-center gap-3">
                      <Loader2 className="h-5 w-5 animate-spin text-accent-600" />
                      <div>
                        <p className="font-bold">Scraping and updating the database...</p>
                        <p className="mt-1 text-sm text-slate-600">Live task progress for the selected airlines and booking windows.</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {schedulerTasks.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-white/70 px-3 py-2 text-sm text-slate-600">
                          Waiting for the first task to start...
                        </div>
                      ) : (
                        schedulerTasks.map((task) => (
                          <div key={task.task_id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                            <div>
                              <p className="font-semibold text-slate-800">{task.source.toUpperCase()} · T+{task.target_lead_days}</p>
                              <p className="text-xs text-slate-500">{task.departure_date}</p>
                            </div>
                            <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${
                              task.status === 'SUCCESS'
                                ? 'bg-emerald-100 text-emerald-700'
                                : task.status === 'FAILED'
                                  ? 'bg-rose-100 text-rose-700'
                                  : task.status === 'RUNNING'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-slate-200 text-slate-600'
                            }`}>
                              {task.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {schedulerResult && (
                  <div className={`rounded-xl border p-4 ${schedulerResult.kind === 'success' ? 'border-emerald-200 bg-emerald-50' : schedulerResult.kind === 'warning' ? 'border-amber-200 bg-amber-50' : 'border-rose-200 bg-rose-50'}`}>
                    <div className="flex gap-3">
                      {schedulerResult.kind === 'success' ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />}
                      <div>
                        <p className="font-bold text-slate-950">{schedulerResult.message}</p>
                        {schedulerResult.observationsAfter !== undefined && (
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            Observations: {schedulerResult.observationsBefore?.toLocaleString()} to {schedulerResult.observationsAfter.toLocaleString()} ({schedulerResult.observationsInserted?.toLocaleString()} new).
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  {!schedulerResult && !schedulerRunning ? (
                    <>
                      <button onClick={() => setSchedulerModalOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-100">Cancel</button>
                      <button onClick={handleSchedulerRun} disabled={selectedSchedulerAirlines.length === 0 || selectedSchedulerLeadTimes.length === 0 || selectedSchedulerRoutes.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:opacity-50">
                        <Zap className="h-4 w-4 text-accent-400" />
                        Run Scraper
                      </button>
                    </>
                  ) : !schedulerRunning ? (
                    <button onClick={() => setSchedulerModalOpen(false)} className="rounded-xl bg-navy-950 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-navy-800">Done</button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Live Domestic Aviation Ticker Tape */}
        <AviationTickerTape />

        <main className="app-main-shell min-w-0 p-4 lg:p-8 mt-14 lg:mt-0 max-w-[1600px] w-full mx-auto flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
