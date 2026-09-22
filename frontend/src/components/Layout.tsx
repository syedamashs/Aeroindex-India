import { NavLink, useLocation } from 'react-router-dom';
import { type ReactNode, useState, useRef, useEffect } from 'react';
import {
  Menu,
  X,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ArrowUpRight,
  Compass,
  Play,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { apiRunScheduler, apiSchedulerStatus, apiStatistics, apiIndex, type SchedulerTaskStatus, API_BASE } from '@/lib/api';
import { AviationTickerTape } from '@/components/animation/AviationTickerTape';
import { PlatformGuideModal, STORY_STEPS } from '@/components/PlatformGuideModal';
import { AeroBotChat } from '@/components/AeroBotChat';

interface NavItem {
  to: string;
  label: string;
  desc: string;
}

interface NavCategory {
  id: string;
  title: string;
  primaryTo: string;
  items: NavItem[];
}

const NAV_CATEGORIES: NavCategory[] = [
  {
    id: 'overview',
    title: 'Overview',
    primaryTo: '/dashboard',
    items: [
      { to: '/dashboard', label: 'Executive Dashboard', desc: 'National headline index, movers & market coverage' },
    ],
  },
  {
    id: 'surveillance',
    title: 'Surveillance',
    primaryTo: '/routes',
    items: [
      { to: '/routes', label: 'Route Watch', desc: 'Active trunk & regional routes, yield spreads & volatility' },
      { to: '/map', label: 'India Airway Map', desc: 'Geospatial network topology & corridor surge status' },
    ],
  },
  {
    id: 'economics',
    title: 'Market Economics',
    primaryTo: '/airlines',
    items: [
      { to: '/airlines', label: 'Carrier Yields', desc: 'Airline pricing dispersion, median benchmarks & spread' },
      { to: '/booking-window', label: 'Advance Curve', desc: 'T+45 to T+1 advance-purchase pricing escalation' },
      { to: '/fare-state', label: 'Markov Fare States', desc: 'Fare escalation probability (FEP) & transition matrix' },
    ],
  },
  {
    id: 'data',
    title: 'Observations',
    primaryTo: '/dqe',
    items: [
      { to: '/dqe', label: 'Data Quality & Reliability', desc: 'Ingestion validation rules, outlier isolation & reliability index' },
    ],
  },
  {
    id: 'governance',
    title: 'Governance & API',
    primaryTo: '/alerts',
    items: [
      { to: '/alerts', label: 'Surveillance Alerts', desc: 'Automated corridor surge trigger notifications' },
    ],
  },
];

const SCHEDULER_AIRLINES = [
  { value: 'airindia', label: 'Air India' },
  { value: 'indigo', label: 'IndiGo' },
  { value: 'spicejet', label: 'SpiceJet' },
];

const SCHEDULER_LEAD_TIMES = [1, 7, 15, 30];
const SCHEDULER_ROUTES = [
  { value: 'DELHI_MUMBAI', label: 'Delhi — Mumbai' },
  { value: 'CHENNAI_DELHI', label: 'Chennai — Delhi' },
  { value: 'CHENNAI_MUMBAI', label: 'Chennai — Mumbai' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { lastUpdate, triggerUpdate, isUiLoading } = useApp();
  const location = useLocation();

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [schedulerModalOpen, setSchedulerModalOpen] = useState(false);
  const [schedulerRunning, setSchedulerRunning] = useState(false);
  const [schedulerTasks, setSchedulerTasks] = useState<SchedulerTaskStatus[]>([]);
  const [backendReady, setBackendReady] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [previewTimestamp, setPreviewTimestamp] = useState<number>(Date.now());
  const [previewLoaded, setPreviewLoaded] = useState(false);

  const canScrape = !isUiLoading && backendReady && !schedulerRunning && !isRefreshing;
  const [selectedSchedulerAirlines, setSelectedSchedulerAirlines] = useState<string[]>(SCHEDULER_AIRLINES.map((a) => a.value));
  const [selectedSchedulerLeadTimes, setSelectedSchedulerLeadTimes] = useState<number[]>(SCHEDULER_LEAD_TIMES);
  const [selectedSchedulerRoutes, setSelectedSchedulerRoutes] = useState<string[]>(SCHEDULER_ROUTES.map((r) => r.value));
  const [schedulerResult, setSchedulerResult] = useState<{
    kind: 'success' | 'warning' | 'error';
    message: string;
    errorDetail?: string | null;
    observationsBefore?: number;
    observationsAfter?: number;
    observationsInserted?: number;
  } | null>(null);

  const [liveStats, setLiveStats] = useState<any>(null);
  const [liveIndexPoints, setLiveIndexPoints] = useState<any[]>([]);

  // Verify backend database is ready and fetch live data for AeroBot AI
  useEffect(() => {
    let isMounted = true;
    Promise.all([
      apiStatistics().catch(() => ({ data: null })),
      apiIndex().catch(() => ({ data: [] })),
    ]).then(([statsRes, indexRes]) => {
      if (!isMounted) return;
      if (statsRes.data) {
        setBackendReady(true);
        setLiveStats(statsRes.data);
      }
      if (indexRes.data && indexRes.data.length) {
        setLiveIndexPoints(indexRes.data);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [lastUpdate]);

  const latestIndex = liveIndexPoints[liveIndexPoints.length - 1];
  const isDbLoaded = Boolean(latestIndex?.indexValue !== undefined);

  const liveAppContext = {
    isDbLoaded,
    currentIndex: latestIndex?.indexValue,
    momChange: latestIndex?.percentageChange,
    routesMonitored: liveStats?.routesMonitored ?? liveStats?.total_routes,
    activeAirlines: ['IndiGo', 'Air India', 'SpiceJet', 'Akasa Air', 'AIX Connect', 'Alliance Air'],
    activeOtas: liveStats?.otasActive,
    bookingWindowMultiplier: 2.4,
    dqeIntegrityRate: 98.4,
    lastUpdated: new Date(lastUpdate).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
  };


  const dropdownContainerRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleDropdownEnter = (categoryId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setActiveDropdown(categoryId);
  };

  const handleDropdownLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // 280ms grace period so moving mouse downward never abruptly closes the dropdown
    hoverTimeoutRef.current = setTimeout(() => {
      setActiveDropdown(null);
    }, 280);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownContainerRef.current && !dropdownContainerRef.current.contains(e.target as Node)) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
        }
        setActiveDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Close dropdown on route change
  useEffect(() => {
    setActiveDropdown(null);
    setMobileOpen(false);
  }, [location.pathname]);

  const openSchedulerModal = () => {
    setSchedulerResult(null);
    setPreviewLoaded(false);
    setPreviewTimestamp(Date.now());
    setSelectedSchedulerAirlines(['spicejet']);
    setSelectedSchedulerLeadTimes([7]);
    setSelectedSchedulerRoutes(['DELHI_MUMBAI']);
    setSchedulerModalOpen(true);
  };

  const closeSchedulerModal = () => {
    setSchedulerModalOpen(false);
    if (schedulerResult) {
      triggerUpdate();
    }
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
    setPreviewLoaded(false);
    setPreviewTimestamp(Date.now());

    let pollTimer: number | undefined;

    const pollProgress = async () => {
      try {
        const status = await apiSchedulerStatus();
        setSchedulerTasks(status.tasks ?? []);
        setPreviewTimestamp(Date.now());
      } catch {
        // Ignore transient polling failures
      }
    };

    pollTimer = window.setInterval(() => {
      void pollProgress();
    }, 1200);

    try {
      const result = await apiRunScheduler(selection);
      await pollProgress();
      setSchedulerResult({
        kind: !result.schedulerSucceeded ? 'error' : result.observationsInserted === 0 ? 'warning' : result.uploadCompleted ? 'success' : 'warning',
        message: result.message,
        errorDetail: result.errorDetail,
        observationsBefore: result.observationsBefore,
        observationsAfter: result.observationsAfter,
        observationsInserted: result.observationsInserted,
      });
      // Set isRefreshing so UI updates before re-enabling scraping
      setIsRefreshing(true);
      triggerUpdate(result.observationsInserted || 200);
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1200);
    } catch (error) {
      await pollProgress();
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

  const isCategoryActive = (category: NavCategory) => {
    return category.items.some((item) => {
      if (item.to === '/dashboard') {
        return location.pathname === '/' || location.pathname === '/dashboard';
      }
      return location.pathname === item.to || location.pathname.startsWith(item.to + '/');
    });
  };

  const isItemActive = (path: string) => {
    if (path === '/dashboard') {
      return location.pathname === '/' || location.pathname === '/dashboard';
    }
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col text-stone-900 selection:bg-amber-200/60 selection:text-stone-900">
      {/* =========================================================================
          TIER 1: THE OFFICIAL EDITORIAL MASTHEAD (TOP ROW)
          ========================================================================= */}
      <header className="bg-[#1c1917] text-stone-300 border-b border-[#292524] px-4 lg:px-8 py-3 select-none">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
          {/* Left: National Brand & Authority Benchmark */}
          <div className="flex items-center gap-4 sm:gap-6">
            <NavLink to="/dashboard" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-lg bg-[#292524] border border-[#44403c] p-1 flex items-center justify-center shadow-xs group-hover:border-amber-500/60 transition-colors overflow-hidden shrink-0">
                <img src="/logo.png" alt="Vayuyaan Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-white tracking-[0.16em] text-base font-sans drop-shadow-xs">
                    VAYUYAAN
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-700/60 text-[10px] text-amber-400 font-mono font-bold tracking-wider">
                    IND
                  </span>
                </div>
                <p className="text-[10px] text-stone-400 uppercase tracking-wider font-mono">
                  National Airfare &amp; Economic Intelligence
                </p>
              </div>
            </NavLink>

            {/* Official Context Badges (hidden on small mobile) */}
            <div className="hidden md:flex items-center gap-3 pl-4 border-l border-[#292524] text-[11px] font-mono text-stone-400">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
                <span>DGCA Statistical Framework</span>
              </div>
              <span className="text-stone-600">|</span>
              <div className="text-stone-400">
                Base Period: <strong className="text-stone-200 font-medium">Jan 2026 = 100.0</strong>
              </div>
            </div>
          </div>

          {/* Right: Telemetry Status & Scraper Ingestion Trigger */}
          <div className="flex items-center gap-3 sm:gap-4 text-xs font-mono">
            {/* Live Sync Status */}
            <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded bg-[#292524]/60 border border-[#292524] text-stone-400 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                Synced:{' '}
                <span className="text-stone-200">
                  {new Date(lastUpdate).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </span>
            </div>

            {/* VIMAAN-Style "Guide me" Interactive Walkthrough Button */}
            <button
              id="storyStart"
              onClick={() => setGuideOpen(true)}
              className="relative group flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/25 transition-all duration-200 cursor-pointer overflow-hidden ring-1 ring-amber-300 active:scale-95"
              title="Start Interactive Platform Walkthrough (VIMAAN-Style Guided Tour)"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950 text-slate-950 transition-transform group-hover:scale-110" />
              <span className="tracking-wide font-sans">Guide me</span>
              <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-black uppercase rounded bg-slate-950 text-amber-300">
                {STORY_STEPS.length} Steps
              </span>
            </button>

            {/* Live Scraping Trigger Button - Only enabled after backend DB fetched and UI ready */}
            <button
              id="guide-live-scraping"
              onClick={openSchedulerModal}
              disabled={!canScrape}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#292524] hover:bg-[#38332f] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#292524] text-stone-200 border border-[#44403c] text-xs font-medium transition-colors cursor-pointer"
              title={
                !canScrape
                  ? 'Waiting for database fetch & UI update to complete...'
                  : 'Execute live on-demand reservation tariff scraper'
              }
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-amber-500 ${!canScrape ? 'animate-spin' : ''}`}
              />
              <span className="hidden sm:inline">
                {!canScrape ? 'Syncing DB...' : 'Live Scraping'}
              </span>
              <span className="sm:hidden">
                {!canScrape ? 'Sync...' : 'Scrape'}
              </span>
            </button>

            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden p-1.5 rounded bg-[#292524] text-stone-300 hover:text-white border border-[#38332f]"
              aria-label="Toggle navigation menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* =========================================================================
          TIER 2: HORIZONTAL CATEGORIZED NAVIGATION RIBBON (BOTTOM ROW)
          ========================================================================= */}
      <nav
        ref={dropdownContainerRef}
        className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/90 shadow-xs px-4 lg:px-8 select-none"
      >
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          {/* Desktop Categories Ribbon */}
          <div className="hidden lg:flex items-center space-x-1">
            {NAV_CATEGORIES.map((category) => {
              const active = isCategoryActive(category);
              const isOpen = activeDropdown === category.id;

              return (
                <div
                  key={category.id}
                  className="relative py-2"
                  onMouseEnter={() => handleDropdownEnter(category.id)}
                  onMouseLeave={handleDropdownLeave}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (hoverTimeoutRef.current) {
                        clearTimeout(hoverTimeoutRef.current);
                        hoverTimeoutRef.current = null;
                      }
                      setActiveDropdown(activeDropdown === category.id ? null : category.id);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-amber-50 text-amber-950 font-semibold border-b-2 border-amber-700'
                        : isOpen
                        ? 'bg-stone-100 text-stone-900'
                        : 'text-stone-600 hover:text-stone-900 hover:bg-stone-50'
                    }`}
                  >
                    <span>{category.title}</span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-stone-900' : 'text-stone-400'
                      }`}
                    />
                  </button>

                  {/* Editorial Popover Mega-Card */}
                  {isOpen && (
                    <div
                      className="absolute top-full left-0 pt-1 w-80 z-40"
                      onMouseEnter={() => handleDropdownEnter(category.id)}
                      onMouseLeave={handleDropdownLeave}
                    >
                      {/* Invisible hover bridge spanning the top gap so cursor never leaves hit-box */}
                      <div className="absolute -top-3 left-0 right-0 h-4" aria-hidden="true" />

                      <div className="bg-white rounded-lg border border-stone-200 shadow-xl p-2.5 animate-in fade-in slide-in-from-top-1 duration-150">
                        <div className="px-2.5 py-1.5 mb-1.5 border-b border-stone-100 flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                            {category.title} Section
                          </span>
                          <NavLink
                            to={category.primaryTo}
                            className="text-[11px] text-amber-700 hover:text-amber-800 font-medium flex items-center gap-0.5"
                            onClick={() => setActiveDropdown(null)}
                          >
                            <span>Open Primary</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </NavLink>
                        </div>

                        <div className="space-y-1">
                          {category.items.map((item) => {
                            const itemActive = isItemActive(item.to);
                            return (
                              <NavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setActiveDropdown(null)}
                                className={`block p-2 rounded-md transition-colors ${
                                  itemActive
                                    ? 'bg-amber-50/80 border-l-2 border-amber-700 pl-2.5'
                                    : 'hover:bg-stone-50'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    className={`text-xs font-medium ${
                                      itemActive ? 'text-amber-950 font-semibold' : 'text-stone-900'
                                    }`}
                                  >
                                    {item.label}
                                  </span>
                                  {itemActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-700" />
                                  )}
                                </div>
                                <p className="text-[11px] text-stone-500 mt-0.5 leading-snug line-clamp-1">
                                  {item.desc}
                                </p>
                              </NavLink>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Direct Secondary Quick-Links */}
          <div className="hidden sm:flex items-center gap-3 text-xs font-mono text-stone-500 py-2">
            <span>DGCA Monitored Corridors</span>
          </div>
        </div>
      </nav>

      {/* =========================================================================
          MOBILE EXPANDABLE NAVIGATION DRAWER
          ========================================================================= */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 top-[57px] z-40 bg-[#1c1917] text-stone-200 overflow-y-auto px-5 py-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-[#292524] text-xs font-mono text-stone-400">
            <span>PLATFORM SECTIONS</span>
            <button
              onClick={() => setMobileOpen(false)}
              className="p-1 rounded text-stone-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-5">
            {NAV_CATEGORIES.map((category) => (
              <div key={category.id} className="space-y-2">
                <div className="text-[11px] font-mono uppercase tracking-wider font-semibold text-amber-500/90">
                  {category.title}
                </div>
                <div className="grid grid-cols-1 gap-1 pl-2 border-l border-[#292524]">
                  {category.items.map((item) => {
                    const active = isItemActive(item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setMobileOpen(false)}
                        className={`block py-1.5 px-2 rounded text-xs transition-colors ${
                          active
                            ? 'bg-[#292524] text-white font-medium border-l-2 border-amber-600'
                            : 'text-stone-400 hover:text-white hover:bg-[#292524]/40'
                        }`}
                      >
                        <div className="font-medium text-stone-200">{item.label}</div>
                        <div className="text-[10px] text-stone-500 line-clamp-1">{item.desc}</div>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-[#292524] space-y-2">
            <button
              onClick={() => {
                setGuideOpen(true);
                setMobileOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 text-xs font-bold shadow-md cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
              <span>Launch Interactive Walkthrough (Guide me)</span>
            </button>

            <button
              onClick={() => {
                if (canScrape) {
                  openSchedulerModal();
                  setMobileOpen(false);
                }
              }}
              disabled={!canScrape}
              className="w-full flex items-center justify-center gap-2 py-2 rounded bg-[#292524] disabled:opacity-40 disabled:cursor-not-allowed text-stone-200 border border-[#38332f] text-xs font-medium"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-amber-500 ${!canScrape ? 'animate-spin' : ''}`}
              />
              <span>
                {!canScrape ? 'Syncing Backend DB & UI...' : 'Trigger Live Scraping'}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          LIVE CORRIDOR TICKER TAPE (FULL SCREEN WIDTH)
          ========================================================================= */}
      <AviationTickerTape />

      {/* =========================================================================
          MAIN WORKSPACE VIEWPORT (100% FULL WIDTH REAL ESTATE)
          ========================================================================= */}
      <main className="app-main-shell min-w-0 p-3 lg:p-6 pb-6 lg:pb-8 max-w-[1600px] w-full mx-auto flex-1">
        {children}
      </main>

      {/* =========================================================================
          DATA INGESTION / SCRAPER WORKER MODAL
          ========================================================================= */}
      {schedulerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/70 backdrop-blur-xs p-2 sm:p-3 md:p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="scheduler-modal-title"
            className="w-full max-w-5xl xl:max-w-6xl max-h-[95vh] flex flex-col overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl transition-all"
          >
            <div className="flex items-start justify-between border-b border-stone-200 px-4 py-2.5 bg-stone-50 shrink-0">
              <div>
                <h2 id="scheduler-modal-title" className="text-sm font-semibold text-stone-900 font-serif">
                  Live Tariff Scraping Pipeline
                </h2>
                <p className="text-[11px] text-stone-500 mt-0.5">Real-time domestic airline reservation tariff scraping</p>
              </div>
              <button
                onClick={closeSchedulerModal}
                disabled={schedulerRunning}
                className="text-stone-400 hover:text-stone-600 p-1 cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 sm:p-4 space-y-3 text-xs overflow-hidden flex flex-col flex-1 min-h-0">
              {!schedulerResult && !schedulerRunning && (
                <>
                  <p className="text-stone-600 leading-relaxed text-xs">
                    Select target flight corridors, domestic scheduled carriers, and advance-purchase booking horizons for on-demand tariff capture.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="border border-stone-200 rounded-lg p-2.5 bg-stone-50/50 flex flex-col">
                      <p className="font-semibold text-stone-700 text-[10px] uppercase tracking-wider mb-2 font-mono">
                        Corridors
                      </p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {SCHEDULER_ROUTES.map((route) => (
                          <label key={route.value} className="flex items-center gap-2 cursor-pointer text-stone-800 text-xs">
                            <input
                              type="checkbox"
                              checked={selectedSchedulerRoutes.includes(route.value)}
                              onChange={(e) =>
                                setSelectedSchedulerRoutes((current) =>
                                  e.target.checked ? [...current, route.value] : current.filter((v) => v !== route.value)
                                )
                              }
                              className="rounded border-stone-300 text-stone-900 focus:ring-0"
                            />
                            <span>{route.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="border border-stone-200 rounded-lg p-2.5 bg-stone-50/50 flex flex-col">
                      <p className="font-semibold text-stone-700 text-[10px] uppercase tracking-wider mb-2 font-mono">
                        Carriers
                      </p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {SCHEDULER_AIRLINES.map((airline) => (
                          <label key={airline.value} className="flex items-center gap-2 cursor-pointer text-stone-800 text-xs">
                            <input
                              type="checkbox"
                              checked={selectedSchedulerAirlines.includes(airline.value)}
                              onChange={(e) =>
                                setSelectedSchedulerAirlines((current) =>
                                  e.target.checked ? [...new Set([...current, airline.value])] : current.filter((v) => v !== airline.value)
                                )
                              }
                              className="rounded border-stone-300 text-stone-900 focus:ring-0"
                            />
                            <span>{airline.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="border border-stone-200 rounded-lg p-2.5 bg-stone-50/50 flex flex-col">
                      <p className="font-semibold text-stone-700 text-[10px] uppercase tracking-wider mb-2 font-mono">
                        Booking Windows
                      </p>
                      <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                        {SCHEDULER_LEAD_TIMES.map((days) => (
                          <label key={days} className="flex items-center gap-2 cursor-pointer text-stone-800 text-xs">
                            <input
                              type="checkbox"
                              checked={selectedSchedulerLeadTimes.includes(days)}
                              onChange={(e) =>
                                setSelectedSchedulerLeadTimes((current) =>
                                  e.target.checked ? [...new Set([...current, days])] : current.filter((v) => v !== days)
                                )
                              }
                              className="rounded border-stone-300 text-stone-900 focus:ring-0"
                            />
                            <span className="font-mono">T+{days} Days Lead</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {schedulerRunning && (
                <div className="space-y-2.5 flex-1 flex flex-col min-h-0">
                  {/* Live Browser Viewport Frame */}
                  {(() => {
                    const activeTask = schedulerTasks.find((t) => t.status === 'RUNNING') || schedulerTasks.find((t) => t.status === 'SUCCESS') || schedulerTasks[0];
                    const activeAirline = (activeTask?.source || selectedSchedulerAirlines[0] || 'spicejet').toLowerCase();
                    const activeUrl = activeAirline.includes('airindia') 
                      ? 'https://www.airindia.com/' 
                      : activeAirline.includes('indigo') 
                      ? 'https://www.goindigo.in/' 
                      : 'https://www.spicejet.com/';
                    return (
                      <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-900 shadow-md flex-1 flex flex-col min-h-0">
                        <div className="bg-[#1c1917] px-3 py-1.5 border-b border-stone-800 flex items-center justify-between text-[11px] font-mono shrink-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="flex gap-1 shrink-0">
                              <span className="w-2 h-2 rounded-full bg-rose-500/80 inline-block"></span>
                              <span className="w-2 h-2 rounded-full bg-amber-500/80 inline-block"></span>
                              <span className="w-2 h-2 rounded-full bg-emerald-500/80 inline-block"></span>
                            </div>
                            <span className="text-stone-300 ml-1.5 bg-stone-800/90 px-2 py-0.5 rounded text-[10px] border border-stone-700/60 truncate font-mono">
                              {activeUrl}
                            </span>
                            {activeTask && (
                              <span className="hidden sm:inline text-stone-400 text-[10px] ml-1 font-mono">
                                {activeTask.origin} → {activeTask.destination} · T+{activeTask.target_lead_days}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-amber-400 font-semibold shrink-0 text-[10px]">
                            <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                            <span className="tracking-wide uppercase">LIVE VIEWPORT</span>
                          </div>
                        </div>
                        <div className="relative h-[48vh] sm:h-[54vh] md:h-[58vh] max-h-[540px] min-h-[290px] w-full bg-stone-950 flex items-center justify-center overflow-hidden">
                          <img
                            src={`${API_BASE}/api/scheduler/preview?t=${previewTimestamp}`}
                            alt="Live Browser Scraper Feed"
                            className={`w-full h-full object-contain ${previewLoaded ? 'block' : 'hidden'}`}
                            onLoad={() => setPreviewLoaded(true)}
                            onError={() => setPreviewLoaded(false)}
                          />
                          {!previewLoaded && (
                            <div className="flex flex-col items-center justify-center p-6 text-center text-stone-400 space-y-2">
                              <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                              <p className="text-xs font-mono text-stone-200">Connecting to Playwright browser viewport...</p>
                              <p className="text-[11px] text-stone-400">Live viewport stream renders as the airline portal loads.</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between text-stone-800 text-[11px] shrink-0 pt-0.5">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700 shrink-0" />
                      <span className="font-medium truncate">Collecting observations from airline distribution engines...</span>
                    </div>
                    {schedulerTasks.length > 0 && (
                      <span className="text-[10px] font-mono text-stone-500 shrink-0">
                        {schedulerTasks.filter(t => t.status === 'SUCCESS').length}/{schedulerTasks.length} Completed
                      </span>
                    )}
                  </div>
                  <div className="border border-stone-200 rounded divide-y divide-stone-100 max-h-20 overflow-y-auto bg-stone-50/50 shrink-0">
                    {schedulerTasks.length === 0 ? (
                      <div className="p-2 text-stone-400 text-center font-mono text-[10px]">Initializing Playwright worker...</div>
                    ) : (
                      schedulerTasks.map((task) => (
                        <div key={task.task_id} className="p-1.5 text-[11px]">
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="font-semibold text-stone-800">{task.source.toUpperCase()}</span>
                              <span className="text-stone-400 ml-1.5 font-mono">
                                T+{task.target_lead_days} · {task.departure_date}
                              </span>
                            </div>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-mono ${
                                task.status === 'SUCCESS'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : task.status === 'FAILED'
                                  ? 'bg-rose-100 text-rose-800'
                                  : task.status === 'RUNNING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-stone-200 text-stone-700'
                              }`}
                            >
                              {task.status}
                            </span>
                          </div>
                          {task.status === 'FAILED' && (task.error_message || task.error_type) && (
                            <p className="mt-0.5 text-[9px] font-mono text-rose-700 break-words bg-rose-50 p-1 rounded">
                              {task.error_type ? `${task.error_type}: ` : ''}{task.error_message}
                            </p>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {schedulerResult && (
                <div className="space-y-2.5 flex-1 flex flex-col min-h-0">
                  {previewLoaded && (
                    <div className="border border-stone-800 rounded-lg overflow-hidden bg-stone-900 shadow-md">
                      <div className="bg-[#1c1917] px-3 py-1.5 border-b border-stone-800 flex items-center justify-between text-[10px] font-mono">
                        <span className="text-stone-300">LIVE BROWSER FEED</span>
                        <div className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                          <span>SCRAPING COMPLETE</span>
                        </div>
                      </div>
                      <div className="relative h-[46vh] sm:h-[52vh] md:h-[56vh] max-h-[520px] min-h-[280px] w-full bg-stone-950 flex items-center justify-center overflow-hidden">
                        <img
                          src={`${API_BASE}/api/scheduler/preview?t=${previewTimestamp}`}
                          alt="Scraped Browser Viewport"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  )}

                  <div
                    className={`p-2.5 rounded-lg border text-xs ${
                      schedulerResult.kind === 'success'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                        : schedulerResult.kind === 'warning'
                        ? 'border-amber-200 bg-amber-50 text-amber-900'
                        : 'border-rose-200 bg-rose-50 text-rose-900'
                    }`}
                  >
                  <div className="flex gap-2 items-start">
                    {schedulerResult.kind === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{schedulerResult.message}</p>
                      {schedulerResult.errorDetail && (
                        <p className="mt-1 p-1.5 rounded bg-rose-100/80 border border-rose-300 text-[10px] font-mono text-rose-900 break-words">
                          {schedulerResult.errorDetail}
                        </p>
                      )}
                      {schedulerResult.observationsAfter !== undefined && (
                        <p className="mt-0.5 text-[10px] text-stone-600 font-mono">
                          Records: {schedulerResult.observationsBefore?.toLocaleString()} →{' '}
                          {schedulerResult.observationsAfter?.toLocaleString()} (+
                          {schedulerResult.observationsInserted?.toLocaleString()} new)
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

              <div className="flex justify-end gap-2 pt-1.5 border-t border-stone-100">
                {!schedulerResult && !schedulerRunning ? (
                  <>
                    <button onClick={closeSchedulerModal} className="btn btn-secondary text-xs py-1.5 px-3">
                      Cancel
                    </button>
                    <button onClick={handleSchedulerRun} className="btn btn-ochre text-xs py-1.5 px-3">
                      Start Live Scraping
                    </button>
                  </>
                ) : !schedulerRunning ? (
                  <button onClick={closeSchedulerModal} className="btn btn-primary text-xs py-1.5 px-3">
                    Close
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* =========================================================================
          SIH INTERACTIVE PLATFORM WALKTHROUGH GUIDE MODAL
          ========================================================================= */}
      <PlatformGuideModal
        isOpen={guideOpen}
        onClose={() => setGuideOpen(false)}
      />

      {/* =========================================================================
          FLOATING GEMINI 2.5 AEROINDEX INTELLIGENCE ASSISTANT (AEROBOT)
          ========================================================================= */}
      <AeroBotChat
        liveContext={liveAppContext}
        isStoryBarOpen={guideOpen}
      />
    </div>
  );
}
