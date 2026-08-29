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
  Server,
  LogOut,
  Menu,
  X,
  Zap,
  Shield,
  Activity,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useApp } from '@/context/AppContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/index', label: 'Airfare Index', icon: TrendingUp },
  { to: '/routes', label: 'Route Analysis', icon: RouteIcon },
  { to: '/airlines', label: 'Airline Analysis', icon: Plane },
  { to: '/booking-window', label: 'Booking Window', icon: Clock },
  { to: '/map', label: 'India Map', icon: MapIcon },
  { to: '/explorer', label: 'Data Explorer', icon: Table2 },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/insights', label: 'Policy Insights', icon: Activity },
  { to: '/methodology', label: 'Methodology', icon: BookOpen },
  { to: '/system', label: 'System/API', icon: Server },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { demoMode, triggerUpdate, lastUpdate } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleSimulate = () => {
    triggerUpdate(200);
  };

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col bg-navy-900 text-white fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 border-b border-navy-700">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
              <Plane className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg leading-tight">AeroIndex</h1>
              <p className="text-xs text-navy-300">India Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive: active }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active || isActive(item.to)
                      ? 'bg-navy-700 text-white'
                      : 'text-navy-300 hover:bg-navy-800 hover:text-white'
                  }`
                }
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-navy-700 space-y-2">
          <button
            onClick={handleSimulate}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-accent-500/20 text-accent-300 hover:bg-accent-500/30 transition-colors text-sm font-medium border border-accent-500/30"
          >
            <Zap className="w-4 h-4" />
            Simulate Price Update
          </button>
          <NavLink
            to="/audit"
            className={({ isActive: active }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active || isActive('/audit')
                  ? 'bg-navy-700 text-white'
                  : 'text-navy-300 hover:bg-navy-800 hover:text-white'
              }`
            }
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            Audit Log
          </NavLink>
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-navy-600 flex items-center justify-center text-xs font-semibold">
                {user?.name?.charAt(0) ?? 'U'}
              </div>
              <div className="text-xs">
                <p className="text-white font-medium leading-tight">{user?.name}</p>
                <p className="text-navy-400">{user?.role}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="text-navy-400 hover:text-white" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 bg-navy-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plane className="w-5 h-5" />
          <span className="font-display font-bold">AeroIndex India</span>
        </div>
        <button onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile nav overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-navy-900 text-white overflow-y-auto pt-16">
          <nav className="px-3 py-4 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive: active }) =>
                    `flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium ${
                      active || isActive(item.to) ? 'bg-navy-700 text-white' : 'text-navy-300'
                    }`
                  }
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              );
            })}
            <NavLink
              to="/audit"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-navy-300"
            >
              <Shield className="w-4 h-4" />
              Audit Log
            </NavLink>
            <button
              onClick={() => { handleSimulate(); setMobileOpen(false); }}
              className="w-full flex items-center justify-center gap-2 px-3 py-3 rounded-lg bg-accent-500/20 text-accent-300 text-sm font-medium border border-accent-500/30"
            >
              <Zap className="w-4 h-4" />
              Simulate Price Update
            </button>
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-navy-300">
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 py-3 flex items-center justify-between">
          <div className="hidden lg:block">
            <p className="text-xs text-slate-500">SIH 2026 • SIH26056</p>
          </div>
          <div className="flex items-center gap-3">
            {demoMode && (
              <span className="badge bg-warning-500/10 text-warning-600">
                <span className="w-1.5 h-1.5 rounded-full bg-warning-500 animate-pulse-soft"></span>
                DEMO DATA
              </span>
            )}
            <span className="text-xs text-slate-500 hidden sm:inline">
              Updated {new Date(lastUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={handleSimulate}
              className="btn-secondary text-xs py-1.5 px-3"
            >
              <Zap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Simulate Update</span>
            </button>
          </div>
        </header>

        <main className="p-4 lg:p-8 mt-14 lg:mt-0 max-w-[1600px] mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
