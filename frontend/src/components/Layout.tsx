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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';
import { apiRunScheduler } from '@/lib/api';
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

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { lastUpdate } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSchedulerRun = async () => {
    const confirmed = window.confirm(
      'Run the Stage-A scheduler now? This will start live collection for the configured route, airlines, and booking windows. Continue?'
    );
    if (!confirmed) return;

    try {
      await apiRunScheduler();
      fireConfetti();
      window.alert('Scheduler started. Collection is running in the backend.');
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'Unable to start the scheduler.');
    }
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-navy-950 text-white fixed inset-y-0 left-0 z-30 border-r border-navy-800/80 shadow-2xl">
        <div className="px-5 py-5 border-b border-navy-800/80 bg-navy-950/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-navy-800 to-navy-600 flex items-center justify-center shadow-md ring-1 ring-white/10">
              <Plane className="w-5 h-5 text-white" />
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
            onClick={handleSchedulerRun}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-gradient-to-r from-accent-500/20 to-accent-500/10 text-accent-300 hover:from-accent-500/30 hover:to-accent-500/20 transition-all text-xs font-bold border border-accent-500/30 shadow-sm active:scale-95"
          >
            <Zap className="w-4 h-4 text-accent-400" />
            <span>Run Pipeline Scheduler</span>
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
          <Plane className="w-5 h-5 text-accent-400" />
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
              onClick={() => { handleSchedulerRun(); setMobileOpen(false); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent-500/20 text-accent-300 text-sm font-bold border border-accent-500/30"
            >
              <Zap className="w-4 h-4" />
              <span>Run Pipeline Scheduler</span>
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
              SIH 2026
            </span>
            <span className="text-xs text-slate-500 font-mono font-medium">SIH26056 • Ministry of Civil Aviation Spec</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="app-sync-status text-xs text-slate-500 hidden sm:inline font-mono">
              <span className="app-sync-dot" />
              Live Synced: {new Date(lastUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
            <button
              onClick={handleSchedulerRun}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-900 text-white hover:bg-navy-800 text-xs font-semibold transition-all shadow-sm active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 text-accent-400" />
              <span>Run Scheduler</span>
            </button>
          </div>
        </header>

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
