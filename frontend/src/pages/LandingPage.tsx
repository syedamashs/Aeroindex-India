import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plane,
  TrendingUp,
  Route as RouteIcon,
  Plane as PlaneIcon,
  Clock,
  Map as MapIcon,
  Activity,
  ArrowRight,
  BookOpen,
  Shield,
  Sparkles,
  Database,
  Cpu,
  BarChart3,
  CheckCircle2,
  Radio,
  ArrowUpRight,
  ScanLine,
  Layers3,
  BellRing,
} from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setPulse((value) => (value + 1) % 4), 2600);
    return () => window.clearInterval(timer);
  }, []);

  const features = [
    {
      icon: TrendingUp,
      title: 'Econometric Airfare Index',
      desc: 'Laspeyres price-relative index tracking weighted domestic tariff fluctuations from a January 2026 macroeconomic base.',
      color: 'text-navy-700 bg-navy-50 ring-navy-200/50',
    },
    {
      icon: RouteIcon,
      title: 'Corridor-Level Surveillance',
      desc: 'Continuous price monitoring across 25+ trunk routes with volatility scoring and surge threshold detection.',
      color: 'text-emerald-600 bg-emerald-50 ring-emerald-200/50',
    },
    {
      icon: PlaneIcon,
      title: 'Carrier Benchmark Intelligence',
      desc: 'Live comparison of average, median, and dynamic pricing spread across scheduled carriers including IndiGo, Air India, and Akasa.',
      color: 'text-amber-800 bg-amber-50 ring-amber-200/50',
    },
    {
      icon: Clock,
      title: 'Advance Booking Curve (T-45)',
      desc: 'Decomposes fare elasticity curves from T-45 days down to departure day to pinpoint price jump inflections.',
      color: 'text-amber-600 bg-amber-50 ring-amber-200/50',
    },
    {
      icon: MapIcon,
      title: 'Geospatial Route Radar',
      desc: 'Interactive India flight corridors map with real-time hub traffic density and route pricing differentials.',
      color: 'text-purple-600 bg-purple-50 ring-purple-200/50',
    },
    {
      icon: Activity,
      title: 'Automated Regulatory Insights',
      desc: 'Machine-synthesized economic briefs for civil aviation authorities and policymaker oversight.',
      color: 'text-rose-600 bg-rose-50 ring-rose-200/50',
    },
  ];

  const highlights = [
    { label: 'Observations Ingested', value: '150,000+', icon: Database },
    { label: 'Monitored Flight Corridors', value: '27 Routes', icon: RouteIcon },
    { label: 'Carrier Sources Monitored', value: '6 Airlines + OTAs', icon: Plane },
    { label: 'Data Quality Accuracy', value: '99.4%', icon: CheckCircle2 },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      {/* Navbar Header */}
      <header className="sticky top-0 z-30 bg-navy-950/90 backdrop-blur-md border-b border-navy-800/80 text-white px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ring-1 ring-white/20 overflow-hidden p-1">
              <img src="/logo.png" alt="AeroIndex Logo" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-display font-extrabold text-lg tracking-tight text-white flex items-center gap-1.5">
                Vayuyaan India
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-accent-500/20 text-accent-400 border border-accent-500/30">SIH 2026</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login', { state: { from: '/methodology' } })}
              className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              <span>Methodology</span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-accent-500 to-emerald-600 text-navy-950 hover:opacity-95 text-xs font-bold transition-all shadow-md active:scale-95"
            >
              <span>Launch Platform</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="landing-hero relative overflow-hidden bg-navy-950 text-white">
        <div className="landing-grid absolute inset-0 pointer-events-none" />
        <div className="landing-scanline absolute inset-x-0 top-0 pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-6 py-16 lg:px-10 lg:py-24">
          <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-7">
              <div className="landing-reveal inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                <span>LIVE INTELLIGENCE LAYER • SIH26056</span>
              </div>

              <h1 className="landing-reveal landing-delay-1 font-display font-extrabold text-4xl sm:text-5xl lg:text-[4.2rem] tracking-tight text-white leading-[1.05] max-w-3xl">
                See the fare signal before it becomes a public problem.
              </h1>

              <p className="landing-reveal landing-delay-2 text-base sm:text-lg text-slate-300 max-w-xl leading-relaxed">
                Vayuyaan turns millions of airfare observations into a clear national index, route pressure map, and policy-ready alert stream for Indian aviation.
              </p>

              <div className="landing-reveal landing-delay-3 flex flex-wrap items-center gap-4">
            <button
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white text-navy-950 hover:bg-slate-100 text-sm font-extrabold transition-all shadow-xl hover:-translate-y-0.5 active:scale-95"
            >
              <span>Enter Command Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => navigate('/login', { state: { from: '/map' } })}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-sm font-semibold transition-all backdrop-blur-sm active:scale-95"
            >
              <MapIcon className="w-4 h-4" />
              <span>Explore India Air Map</span>
            </button>
          </div>

              <div className="landing-reveal landing-delay-4 flex items-center gap-3 text-xs text-slate-400">
                <span className="flex -space-x-1.5">
                  {['AI', '6E', 'IX', 'OTA'].map((label) => <span key={label} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-navy-950 bg-navy-700 font-mono text-[9px] font-bold text-slate-200">{label}</span>)}
                </span>
                <span>Airlines, OTAs, routes, and booking windows in one view</span>
              </div>
            </div>

            <div className="landing-reveal landing-delay-2 relative">
              <div className="landing-orbit landing-orbit-one" />
              <div className="landing-orbit landing-orbit-two" />
              <div className="relative overflow-hidden rounded-[1.5rem] border border-white/15 bg-white/[0.07] p-5 shadow-2xl shadow-black/30 backdrop-blur-xl">
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300">Fare pulse / national</p>
                    <p className="mt-1 text-sm text-slate-300">Live market pressure</p>
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold text-emerald-300"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> STREAMING</span>
                </div>

                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="font-display text-5xl font-extrabold tracking-tight text-white">113.8</p>
                    <p className="mt-2 flex items-center gap-1 text-sm text-rose-300"><ArrowUpRight className="h-4 w-4" /> +4.8% this month</p>
                  </div>
                  <div className="flex h-20 items-end gap-1.5 pb-1">
                    {[32, 44, 39, 58, 49, 68, 62, 78, 72, 91, 84, 100].map((height, index) => <span key={index} className="landing-bar w-2 rounded-t-sm bg-emerald-400/80" style={{ height: `${height}%`, animationDelay: `${index * 70}ms` }} />)}
                  </div>
                </div>

                <div className="my-6 h-px bg-white/10" />
                <div className="space-y-2.5">
                  {[
                    ['DEL → BOM', '+13.7%', 'SURGE', 'bg-rose-400'],
                    ['BLR → JAI', '+12.7%', 'WATCH', 'bg-amber-400'],
                    ['T+1 vs T+45', '+134.2%', 'PREMIUM', 'bg-emerald-400'],
                  ].map(([label, change, status, dot], index) => <div key={label} className={`flex items-center justify-between rounded-lg px-3 py-2.5 transition-all duration-500 ${pulse === index ? 'bg-white/10 translate-x-1' : 'bg-white/[0.03]'}`}><span className="flex items-center gap-2 text-xs text-slate-300"><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{label}</span><span className="flex items-center gap-2 font-mono text-xs font-bold text-white">{change}<span className="text-[9px] tracking-wider text-slate-500">{status}</span></span></div>)}
                </div>

                <div className="mt-5 flex items-center justify-between text-[10px] text-slate-500"><span>152 route basket</span><span>JEVONS / DGCA WEIGHTED</span></div>
              </div>
            </div>
          </div>

          {/* Key Metrics Counter Strip */}
          <div className="landing-reveal landing-delay-4 pt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl">
            {highlights.map((h) => {
              const Icon = h.icon;
              return (
                <div key={h.label} className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm text-left group hover:bg-white/10 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-accent-500/20 text-accent-400 flex items-center justify-center mb-2">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-display font-black text-white">{h.value}</div>
                  <div className="text-[11px] font-medium text-slate-400 mt-0.5">{h.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Signal ticker */}
      <div className="overflow-hidden border-b border-slate-200 bg-white">
        <div className="landing-ticker flex min-w-max items-center gap-8 py-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {[...Array(2)].flatMap((_, copy) => [
            ['INDEX', '113.8', '+4.8%', 'text-rose-600'],
            ['FEP', '88.9%', 'T+45 → T+1', 'text-amber-600'],
            ['ROUTE WATCH', 'DEL → BOM', '+13.7%', 'text-rose-600'],
            ['COVERAGE', '152 ROUTES', 'DGCA BASKET', 'text-emerald-600'],
            ['ESTIMATOR', 'JEVONS', 'LOG-STABLE', 'text-stone-700'],
          ].map(([label, value, detail, color], index) => <span key={`${copy}-${label}`} className="flex items-center gap-2"><span>{label}</span><strong className={color}>{value}</strong><span className="text-slate-300">{detail}</span><span className="text-slate-200">/</span></span>))}
        </div>
      </div>

      {/* Signal pipeline */}
      <section className="relative overflow-hidden bg-slate-50 px-6 py-20 lg:px-10">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-accent-600">From raw fare to public signal</p>
              <h2 className="font-display text-3xl font-extrabold tracking-tight text-navy-950">One intelligence loop. Three decisive moments.</h2>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-slate-500">Every number on the platform carries a path back to an observation, a comparison rule, and a policy-relevant signal.</p>
          </div>

          <div className="relative grid gap-4 md:grid-cols-3">
            <div className="landing-pipeline-line absolute left-[16%] right-[16%] top-14 hidden h-px bg-gradient-to-r from-stone-200 via-emerald-300 to-amber-200 md:block" />
            {[
              { icon: ScanLine, step: '01', title: 'Observe', text: 'Collect fares across routes, carriers, OTAs, travel dates, and exact booking windows.', accent: 'bg-stone-100 text-stone-800 ring-stone-200', tag: '164,160 records' },
              { icon: Layers3, step: '02', title: 'Compare', text: 'Validate identities, match comparable fare states, and estimate proportional movement with Jevons.', accent: 'bg-emerald-50 text-emerald-600 ring-emerald-200', tag: '152-route basket' },
              { icon: BellRing, step: '03', title: 'Act', text: 'Turn route pressure and booking premiums into prioritized alerts and policy-ready insight.', accent: 'bg-amber-50 text-amber-600 ring-amber-200', tag: '12 priority alerts' },
            ].map((item, index) => {
              const Icon = item.icon;
              return <div key={item.step} className="landing-pipeline-card glass-card relative p-6" style={{ animationDelay: `${index * 120}ms` }}>
                <div className="relative z-10 mb-6 flex items-center justify-between"><div className={`flex h-11 w-11 items-center justify-center rounded-xl ring-1 ${item.accent}`}><Icon className="h-5 w-5" /></div><span className="font-mono text-xs font-bold text-slate-400">{item.step}</span></div>
                <h3 className="mb-2 font-display text-xl font-bold text-navy-950">{item.title}</h3>
                <p className="min-h-[3rem] text-sm leading-relaxed text-slate-600">{item.text}</p>
                <div className="mt-5 border-t border-slate-100 pt-4 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">{item.tag}</div>
              </div>;
            })}
          </div>
        </div>
      </section>

      {/* Platform Capabilities Grid */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-navy-600 bg-navy-50 px-3 py-1 rounded-full border border-navy-200/60">
            Platform Capabilities
          </span>
          <h2 className="font-display font-extrabold text-3xl text-navy-950">
            End-to-End Civil Aviation Intelligence
          </h2>
          <p className="text-sm text-slate-500">
            From automated scraper pipelines to econometric aggregation and tariff regulation alerts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="glass-card p-6 flex flex-col justify-between group hover:border-navy-400/40"
              >
                <div>
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ring-1 transition-transform group-hover:scale-110 duration-200 ${f.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="font-display font-bold text-base text-navy-950 mb-2">
                    {f.title}
                  </h3>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {f.desc}
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center text-xs font-semibold text-navy-700 group-hover:text-navy-900 gap-1">
                  <span>Explore module</span>
                  <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-navy-950 text-white border-t border-navy-800/80 px-6 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-accent-400" />
            <span>Vayuyaan India • Smart India Hackathon (SIH 2026) Prototype</span>
          </div>
          <p>Ministry of Civil Aviation / DGCA Tariff Transparency Framework</p>
        </div>
      </footer>
    </div>
  );
}
