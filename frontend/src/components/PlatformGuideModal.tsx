import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Compass, X, ChevronRight, ChevronLeft, Play, Pause,
  Sparkles, Activity, TrendingUp, Award, BookOpen, Layers,
  MapPin, ShieldCheck, Bell
} from 'lucide-react';

export interface TourStep {
  id: string;
  title: string;
  route: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  headline: string;
  bullets: string[];
}

// Strictly matching the active tabs in the top navigation bar
export const TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard',
    title: 'Executive Dashboard',
    route: '/dashboard',
    category: 'Overview',
    icon: Activity,
    headline: 'National Airfare Index (Base Jan 2026 = 100.0) & Market Pulse',
    bullets: [
      'Headline Laspeyres Index: Composite domestic ticket indicator weighted by DGCA passenger volume.',
      'Autonomous Flight Curve: Simulates seasonal movements along the line (winter fog ➔ summer peak ➔ autumn calm).',
      'Market Coverage: High-level pipeline metrics across monitored domestic trunk corridors & active carriers.'
    ]
  },
  {
    id: 'routes',
    title: 'Route Watch',
    route: '/routes',
    category: 'Surveillance',
    icon: TrendingUp,
    headline: '150+ Monitored Domestic Trunk & Regional Corridors',
    bullets: [
      'Corridor Volatility: Standard deviation indexing to isolate unstable domestic pricing bands.',
      'Surge Detection: Flags routes exceeding statistical pricing ceilings to protect consumer affordability.',
      'One-Click CSV Export: Instant downloadable dataset for Civil Aviation Ministry reporting & audits.'
    ]
  },
  {
    id: 'map',
    title: 'India Airway Map',
    route: '/map',
    category: 'Surveillance',
    icon: MapPin,
    headline: 'Geospatial Network Topology & Corridor Load Arcs',
    bullets: [
      'Geospatial Airway Arcs: Interactive Leaflet map connecting Indian airport nodes with flight arcs.',
      'Corridor Pricing Tiers: Color-coded routes indicating normal vs elevated surge pricing across regions.',
      'Hub-and-Spoke Density: Visualizes capacity concentration around Delhi and Mumbai mega-hubs.'
    ]
  },
  {
    id: 'airlines',
    title: 'Carrier Yields',
    route: '/airlines',
    category: 'Market Economics',
    icon: Award,
    headline: 'Airline Pricing Dispersion & Market Share',
    bullets: [
      'Carrier Spreads: Real-time price benchmarks between IndiGo, Air India, SpiceJet, and Akasa Air.',
      'Pricing Power Audit: Evaluates whether carrier consolidation causes anti-competitive fare surges.',
      'Yield Dispersion: Compares low-cost vs full-service airline pricing behaviors on identical corridors.'
    ]
  },
  {
    id: 'booking-window',
    title: 'Advance Curve',
    route: '/booking-window',
    category: 'Market Economics',
    icon: BookOpen,
    headline: 'Quantifying the Last-Minute T+1 Booking Surge Penalty',
    bullets: [
      'Exponential Curve: Empirically measures the 2.4x surge penalty from T+45 down to T+1 departure.',
      'Affordability Horizons: Pinpoints optimal lead-time booking windows for Indian travelers.',
      'Regulatory Evidence: Hard empirical data for DGCA committees evaluating dynamic fare caps.'
    ]
  },
  {
    id: 'fare-state',
    title: 'Markov Fare States',
    route: '/fare-state',
    category: 'Market Economics',
    icon: Layers,
    headline: 'Markov Chain Fare Escalation Probability (FEP)',
    bullets: [
      'Discrete Fare States: Classifies fares into Low, Moderate, High, and Surge states.',
      'Transition Matrix: Calculates mathematical probabilities of a route transitioning into surge pricing.',
      'Predictive Surveillance: Forecasts upcoming price escalations before public consumer complaints occur.'
    ]
  },
  {
    id: 'dqe',
    title: 'Data Quality Audit',
    route: '/dqe',
    category: 'Observations',
    icon: ShieldCheck,
    headline: 'Production Data Integrity & Ingestion Validation',
    bullets: [
      '5-Stage Pipeline: Schema validation, deduplication, price outlier filtering, and DB integrity checks.',
      'Zero-Corruption Guarantee: Ensures raw web scraping noise never corrupts official economic indices.',
      'Audit Logging: Real-time pass/fail observation tracking on production SQLite APX database.'
    ]
  },
  {
    id: 'alerts',
    title: 'Surveillance Alerts',
    route: '/alerts',
    category: 'Governance & API',
    icon: Bell,
    headline: 'Automated Surge Notifications for Civil Aviation',
    bullets: [
      'Automated Thresholds: Algorithmic rules trigger incident notices when fares breach statistical norms.',
      'Severity Tiers: High, Moderate, and Advisory notices with collection timestamps and route IDs.',
      'Actionable Governance: Direct intelligence feed for ministry intervention and consumer advisories.'
    ]
  }
];

export function PlatformGuideModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [autoPlay, setAutoPlay] = useState(false);

  // Sync step with current route if user navigates manually
  useEffect(() => {
    const foundIndex = TOUR_STEPS.findIndex((s) => s.route === location.pathname);
    if (foundIndex !== -1) {
      setCurrentStepIndex(foundIndex);
    }
  }, [location.pathname]);

  // Navigate to page when step changes
  const goToStep = (index: number) => {
    const targetIndex = Math.max(0, Math.min(TOUR_STEPS.length - 1, index));
    setCurrentStepIndex(targetIndex);
    const step = TOUR_STEPS[targetIndex];
    if (location.pathname !== step.route) {
      navigate(step.route);
    }
  };

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      goToStep(0); // loop back
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  };

  // Auto-play timer (advances step every 8.5 seconds)
  useEffect(() => {
    if (!isOpen || !autoPlay) return;
    const interval = setInterval(() => {
      goToStep((currentStepIndex + 1) % TOUR_STEPS.length);
    }, 8500);
    return () => clearInterval(interval);
  }, [isOpen, autoPlay, currentStepIndex]);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;

  return (
    <aside
      aria-label="SIH Interactive Platform Guide Docked Bar"
      className="fixed bottom-3 left-3 right-3 sm:bottom-4 sm:left-6 sm:right-6 max-w-6xl mx-auto z-50 animate-in fade-in slide-in-from-bottom-5 duration-300 pointer-events-auto"
    >
      <div className="bg-slate-950/95 backdrop-blur-md border border-amber-500/50 rounded-2xl shadow-2xl overflow-hidden ring-1 ring-amber-500/20 text-slate-100">
        {/* Top Accent Gradient Line */}
        <div className="h-1 bg-gradient-to-r from-amber-500 via-orange-400 to-amber-500" />

        {/* Step Quick-Jump Pills (Strictly matching top bar tabs) */}
        <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800/80 flex items-center gap-1 overflow-x-auto select-none">
          <span className="text-[10px] font-mono uppercase text-amber-400 font-bold px-1.5 shrink-0 flex items-center gap-1">
            <Compass className="w-3 h-3 animate-spin-slow" />
            <span>Top Bar Tabs:</span>
          </span>
          {TOUR_STEPS.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            return (
              <button
                key={step.id}
                onClick={() => goToStep(idx)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer ${isActive
                    ? 'bg-amber-400 text-slate-950 font-bold shadow-xs scale-105 ring-1 ring-amber-300'
                    : 'bg-slate-800/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
              >
                <span>{idx + 1}.</span>
                <span>{step.title}</span>
              </button>
            );
          })}
        </div>

        {/* Main Docked Bar Body */}
        <div className="p-3 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Step Identity */}
          <div className="flex items-center gap-3 shrink-0 md:max-w-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <StepIcon className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider">
                  TAB {currentStepIndex + 1} OF {TOUR_STEPS.length}
                </span>
                <span className="px-1.5 py-0.2 text-[9px] font-mono rounded bg-slate-800 border border-slate-700 text-slate-300">
                  {currentStep.category}
                </span>
              </div>
              <h3 className="text-sm font-bold text-white tracking-tight truncate">
                {currentStep.title}
              </h3>
              <p className="text-[10px] font-mono text-slate-400">
                URL: <code className="text-amber-300">{currentStep.route}</code>
              </p>
            </div>
          </div>

          {/* Middle: Point-wise content about what is shown on this active tab */}
          <div className="flex-1 bg-slate-900/70 rounded-xl p-2.5 border border-slate-800/80 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-300 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="truncate">{currentStep.headline}</span>
            </div>
            <ul className="space-y-0.5 text-[11px] text-slate-300">
              {currentStep.bullets.map((bullet, i) => (
                <li key={i} className="flex items-start gap-1.5 leading-snug">
                  <span className="text-amber-400 font-bold shrink-0 mt-0.5">•</span>
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: Navigation Controls */}
          <div className="flex items-center gap-1.5 shrink-0 self-end md:self-center">
            {/* Auto Play Toggle */}
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className={`p-1.5 sm:px-2 sm:py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1 cursor-pointer border ${autoPlay
                  ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 animate-pulse'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              title={autoPlay ? 'Pause auto-play tour' : 'Auto-advance page every 8.5s'}
            >
              {autoPlay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline text-[11px]">{autoPlay ? 'Auto' : 'Auto'}</span>
            </button>

            {/* Previous Step */}
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1 cursor-pointer"
              title="Previous Tab"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Prev</span>
            </button>

            {/* Next Step */}
            <button
              onClick={handleNext}
              className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-bold transition flex items-center gap-1 shadow-md shadow-amber-500/20 cursor-pointer"
              title="Next Tab"
            >
              <span>{currentStepIndex === TOUR_STEPS.length - 1 ? 'Restart ↺' : 'Next Tab'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer ml-1"
              title="Close Tour Bar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
