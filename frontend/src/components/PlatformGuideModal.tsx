import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X, ChevronRight, ChevronLeft, Play, Pause,
  Sparkles, Activity, TrendingUp, BookOpen, Layers,
  ShieldCheck, Bell, CheckCircle2
} from 'lucide-react';

export interface StoryStep {
  id: string;
  route: string;
  spotSelector: string;
  stepBadge: string;
  category: string;
  shortTitle: string;
  headline: string;
  narrativeLead: string;
  narrativeText: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

export const STORY_STEPS: StoryStep[] = [
  {
    id: 'headline-index',
    route: '/dashboard',
    spotSelector: '#guide-headline-index',
    stepBadge: 'Step 1 of 7 · National Airfare Index',
    category: 'Macroeconomic Metric',
    shortTitle: 'National Index',
    headline: 'This is the headline number that feeds national inflation.',
    narrativeLead: 'Composite Laspeyres Index (Jan 2026 = 100.0)',
    narrativeText:
      'Calibrated directly with DGCA domestic passenger volume weights. It measures true airfare movement across India and feeds the transport component of the Consumer Price Index (CPI) used for monetary policy.',
    icon: Activity,
    accentColor: 'text-amber-400'
  },
  {
    id: 'trajectory-simulation',
    route: '/dashboard',
    spotSelector: '#guide-trajectory-chart',
    stepBadge: 'Step 2 of 7 · Continuous Automated Radar',
    category: 'Surveillance Engine',
    shortTitle: 'Trajectory Radar',
    headline: 'Manual monthly sampling misses 99% of pricing reality.',
    narrativeLead: 'Autonomous Time-Series Flight Radar',
    narrativeText:
      'Current DGCA monitoring inspects ~78 routes by hand once a month—arriving 60 days late. Aeroindex automates multi-daily tariff ingestion across 150+ corridors, capturing winter fog surges, festive spikes, and off-peak troughs in real time.',
    icon: Sparkles,
    accentColor: 'text-sky-400'
  },
  {
    id: 'corridor-surveillance',
    route: '/routes',
    spotSelector: '#guide-routes-table',
    stepBadge: 'Step 3 of 7 · Route Watch & Volatility',
    category: 'Market Intelligence',
    shortTitle: 'Route Watch',
    headline: 'A flight has no single price across the network.',
    narrativeLead: '150+ Monitored Domestic Trunk & Regional Corridors',
    narrativeText:
      'Monitors IndiGo, Air India, SpiceJet, and Akasa with standard deviation volatility tracking. Automated surge alarms flag anti-competitive tariff escalation and sudden pricing anomalies before travelers are exploited.',
    icon: TrendingUp,
    accentColor: 'text-emerald-400'
  },
  {
    id: 'booking-window-curve',
    route: '/booking-window',
    spotSelector: '#guide-booking-curve',
    stepBadge: 'Step 4 of 7 · Close-in Surge Multiplier',
    category: 'Market Economics',
    shortTitle: 'Advance Curve',
    headline: 'Quantifying the last-minute T+1 booking penalty.',
    narrativeLead: 'Exponential Yield Curve (T+45 down to T+1)',
    narrativeText:
      'Empirically measures the steep 2.4x surge multiplier between 45-day advance purchase and last-minute emergency departures. Delivers rigorous mathematical proof for Civil Aviation committees evaluating dynamic fare caps.',
    icon: BookOpen,
    accentColor: 'text-amber-400'
  },
  {
    id: 'markov-transition',
    route: '/fare-state',
    spotSelector: '#guide-markov-matrix',
    stepBadge: 'Step 5 of 7 · Markov Fare State Analytics',
    category: 'Predictive Modeling',
    shortTitle: 'Fare Escalation',
    headline: 'Predicting price escalation before complaints occur.',
    narrativeLead: 'Markov Chain Fare Escalation Probability (FEP)',
    narrativeText:
      'Discrete state transitions (Stable, Surge, Discount, Capacity Cleared) compute empirical mathematical probabilities that a corridor enters an aggressive escalation cycle during subsequent inventory sweeps.',
    icon: Layers,
    accentColor: 'text-indigo-400'
  },
  {
    id: 'dqe-governance',
    route: '/dqe',
    spotSelector: '#guide-dqe-audit',
    stepBadge: 'Step 6 of 7 · Statutory Collection & DQE Audit',
    category: 'Regulatory Compliance',
    shortTitle: 'Quality Engine',
    headline: 'Statutory basis under Rule 135(2) and zero-noise audit.',
    narrativeLead: '5-Stage Data Quality Engine (DQE)',
    narrativeText:
      'Tariffs are collected under statutory airline disclosures (Aircraft Rules 1937, Rule 135(2)). The 5-stage DQE validates schemas, prunes duplicates via SHA fingerprints, and discards outliers so raw web noise never corrupts official indices.',
    icon: ShieldCheck,
    accentColor: 'text-teal-400'
  },
  {
    id: 'surveillance-alerts',
    route: '/alerts',
    spotSelector: '#guide-alerts-stream',
    stepBadge: 'Step 7 of 7 · Automated Governance Alerts',
    category: 'Aviation Governance',
    shortTitle: 'Surveillance Alerts',
    headline: 'Automated intelligence for Civil Aviation authorities.',
    narrativeLead: 'Algorithmic Surge Incident Stream',
    narrativeText:
      'Automated incident stream alerts officials the moment corridor volatility or fare ceilings breach statistical thresholds—providing verifiable timestamps, carrier identities, and severity tiers for prompt regulatory action.',
    icon: Bell,
    accentColor: 'text-rose-400'
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
  const [autoProgress, setAutoProgress] = useState(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Clear existing spotlights
  const clearSpot = useCallback(() => {
    document.querySelectorAll('.spot').forEach((node) => {
      node.classList.remove('spot');
    });
  }, []);

  // Spotlight target element with smooth centering and pulse ring
  const highlightTarget = useCallback((selector: string) => {
    clearSpot();
    if (!selector) return;

    let attempts = 0;
    const maxAttempts = 8;

    const findAndSpot = () => {
      const target = document.querySelector(selector);
      if (target) {
        target.classList.add('spot');
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      } else if (attempts < maxAttempts) {
        attempts++;
        retryTimeoutRef.current = setTimeout(findAndSpot, 140);
      }
    };

    findAndSpot();
  }, [clearSpot]);

  // Navigate to step
  const goToStep = useCallback((index: number) => {
    const targetIdx = Math.max(0, Math.min(STORY_STEPS.length - 1, index));
    setCurrentStepIndex(targetIdx);
    setAutoProgress(0);

    const step = STORY_STEPS[targetIdx];
    if (location.pathname !== step.route) {
      navigate(step.route);
    }

    // Trigger spotlight with slight delay for route transition
    setTimeout(() => {
      highlightTarget(step.spotSelector);
    }, 150);
  }, [location.pathname, navigate, highlightTarget]);

  const handleNext = useCallback(() => {
    if (currentStepIndex < STORY_STEPS.length - 1) {
      goToStep(currentStepIndex + 1);
    } else {
      // Finished
      clearSpot();
      setCurrentStepIndex(0);
      onClose();
    }
  }, [currentStepIndex, goToStep, clearSpot, onClose]);

  const handlePrev = useCallback(() => {
    if (currentStepIndex > 0) {
      goToStep(currentStepIndex - 1);
    }
  }, [currentStepIndex, goToStep]);

  // When guide opens, ALWAYS restart from Step 0 and navigate to dashboard
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('storyOn');
      setCurrentStepIndex(0);
      goToStep(0);
    } else {
      document.body.classList.remove('storyOn');
      clearSpot();
      setCurrentStepIndex(0);
      setAutoPlay(false);
      setAutoProgress(0);
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    }
    return () => {
      document.body.classList.remove('storyOn');
      clearSpot();
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
    };
  }, [isOpen]);

  // Keyboard navigation: ArrowRight / ArrowLeft / Esc / Space
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        clearSpot();
        setCurrentStepIndex(0);
        onClose();
      } else if (e.key === ' ' && e.target === document.body) {
        e.preventDefault();
        setAutoPlay((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleNext, handlePrev, clearSpot, onClose]);

  // Auto-play timer with smooth progress bar
  useEffect(() => {
    if (!isOpen || !autoPlay) return;

    const DURATION = 8500; // 8.5 seconds per step
    const STEP_INTERVAL = 100;
    const progressIncrement = (STEP_INTERVAL / DURATION) * 100;

    const timer = setInterval(() => {
      setAutoProgress((prev) => {
        if (prev >= 100) {
          handleNext();
          return 0;
        }
        return prev + progressIncrement;
      });
    }, STEP_INTERVAL);

    return () => clearInterval(timer);
  }, [isOpen, autoPlay, handleNext]);

  if (!isOpen) return null;

  const currentStep = STORY_STEPS[currentStepIndex];
  const StepIcon = currentStep.icon;
  const isLastStep = currentStepIndex === STORY_STEPS.length - 1;

  return (
    <>
      {/* Subtle Focus Mask Vignette (allows clicks through to page) */}
      <div
        className="fixed inset-0 bg-slate-950/20 pointer-events-none z-30 transition-opacity duration-300"
        aria-hidden="true"
      />

      {/* =========================================================================
          VIMAAN-STYLE DOCKED STORY BAR (Solid Obsidian Dark with High Contrast)
          ========================================================================= */}
      <div
        id="storyBar"
        role="region"
        aria-label="Platform Guided Walkthrough"
        className="fixed bottom-0 left-0 right-0 z-50 animate-story-slide-up bg-[#090d16] border-t-2 border-amber-500 shadow-[0_-16px_50px_rgba(0,0,0,0.85)] text-slate-100"
      >
        {/* Top Accent Gradient Line + Auto-Play Progress Indicator */}
        <div className="relative h-1 w-full bg-slate-800/80 overflow-hidden">
          <div
            className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-amber-500 via-amber-300 to-amber-500 transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(245,158,11,0.8)]"
            style={{
              width: autoPlay
                ? `${autoProgress}%`
                : `${((currentStepIndex + 1) / STORY_STEPS.length) * 100}%`
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 py-3 sm:py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Step Identity & Category Card */}
          <div className="flex items-center gap-3 shrink-0 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shrink-0 shadow-inner">
              <StepIcon className="w-5 h-5 text-amber-400" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono font-black uppercase tracking-widest text-amber-400">
                  STEP {currentStepIndex + 1} OF {STORY_STEPS.length}
                </span>
                <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-bold rounded bg-slate-800 border border-slate-700 text-amber-300">
                  {currentStep.category}
                </span>
              </div>
              <h3 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate flex items-center gap-1.5 mt-0.5">
                <span>{currentStep.shortTitle}</span>
                <span className="text-slate-500 font-normal">·</span>
                <span className="text-[11px] font-mono font-semibold text-amber-300">
                  {currentStep.route}
                </span>
              </h3>
            </div>
          </div>

          {/* Middle: Rich Story Text Card with Bold Punchlines */}
          <div className="flex-1 min-w-0 bg-slate-900/90 rounded-xl px-4 py-2.5 border border-slate-800 shadow-inner">
            <p className="text-xs sm:text-[13px] leading-relaxed text-slate-200">
              <b className="font-bold text-amber-300 mr-1.5">
                {currentStep.headline}
              </b>
              <span className="text-slate-200 font-normal">{currentStep.narrativeText}</span>
            </p>
          </div>

          {/* Right: Controls & Interactive Navigation */}
          <div className="flex items-center gap-2 shrink-0 self-end md:self-center bg-slate-900/90 border border-slate-800 rounded-xl px-3 py-2 shadow-xs">
            {/* Step Pip Indicators */}
            <div className="flex items-center gap-1.5 mr-1" aria-hidden="true">
              {STORY_STEPS.map((step, k) => {
                const isActive = k === currentStepIndex;
                const isPassed = k < currentStepIndex;
                return (
                  <button
                    key={step.id}
                    onClick={() => goToStep(k)}
                    title={`Jump to Step ${k + 1}: ${step.shortTitle}`}
                    className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                      isActive
                        ? 'w-6 bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.9)]'
                        : isPassed
                        ? 'w-2 bg-amber-400/50 hover:bg-amber-400'
                        : 'w-2 bg-slate-700 hover:bg-slate-500'
                    }`}
                  />
                );
              })}
            </div>

            {/* Auto-Play Toggle Button */}
            <button
              onClick={() => setAutoPlay(!autoPlay)}
              className={`px-2 py-1.5 rounded-lg text-xs font-mono transition flex items-center gap-1 cursor-pointer border ${
                autoPlay
                  ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
              title={autoPlay ? 'Pause Auto-Play (Space)' : 'Auto-Play Walkthrough (Space)'}
            >
              {autoPlay ? <Pause className="w-3.5 h-3.5 text-emerald-300" /> : <Play className="w-3.5 h-3.5" />}
              <span className="hidden lg:inline text-[10px]">{autoPlay ? 'Auto ON' : 'Auto'}</span>
            </button>

            {/* Previous Step Button */}
            <button
              onClick={handlePrev}
              disabled={currentStepIndex === 0}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 text-xs font-semibold transition border border-slate-700 flex items-center gap-1 cursor-pointer"
              title="Previous Step (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back</span>
            </button>

            {/* Next / Finish Button */}
            <button
              onClick={handleNext}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-md ${
                isLastStep
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25 font-black'
                  : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-amber-500/25 font-black'
              }`}
              title={isLastStep ? 'Finish and Explore' : 'Next Step (Right Arrow)'}
            >
              <span>{isLastStep ? 'Finish & Explore' : 'Next'}</span>
              {isLastStep ? <CheckCircle2 className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {/* Exit Button */}
            <button
              onClick={() => {
                clearSpot();
                setCurrentStepIndex(0);
                onClose();
              }}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 hover:border-rose-700 text-slate-400 hover:text-white border border-slate-700 transition cursor-pointer"
              title="Exit Walkthrough (Esc)"
              aria-label="Exit walkthrough"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
