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
  BarChart3,
  Database,
} from 'lucide-react';

export function LandingPage() {
  const navigate = useNavigate();

  const features = [
    { icon: TrendingUp, title: 'Airfare Price Index', desc: 'A transparent, weighted index tracking domestic fare movements from a January 2026 base.' },
    { icon: RouteIcon, title: 'Route Intelligence', desc: 'Route-level fare analysis with trend, volatility, and risk classification across 25+ routes.' },
    { icon: PlaneIcon, title: 'Airline Comparison', desc: 'Compare average, median, and volatility metrics across all major Indian carriers.' },
    { icon: Clock, title: 'Booking Window Analysis', desc: 'Understand how fares change from T+45 to T+1 days before departure.' },
    { icon: MapIcon, title: 'Geographic Visualization', desc: 'Interactive India map with color-coded route movements and airport markers.' },
    { icon: Activity, title: 'Policy Insights', desc: 'Automatically generated, plain-English insights for policymakers and administrators.' },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <section className="relative bg-navy-900 text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(34,197,94,0.1) 0%, transparent 50%)',
        }} />
        <div className="relative max-w-6xl mx-auto px-6 py-20 lg:py-28">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
              <Plane className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-display font-bold text-2xl">AeroIndex India</h1>
              <p className="text-navy-300 text-sm">National Airfare Price Intelligence & Index Platform</p>
            </div>
          </div>

          <h2 className="font-display font-bold text-4xl lg:text-5xl leading-tight max-w-3xl">
            India Airfare Price Intelligence
          </h2>
          <p className="mt-4 text-lg text-navy-200 max-w-2xl leading-relaxed">
            Continuous monitoring and statistical analysis of domestic airfare movements for better price measurement and policy decisions.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => navigate('/login')}
              className="btn bg-white text-navy-900 hover:bg-navy-50 px-6 py-3 text-base font-semibold"
            >
              Enter Dashboard
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/methodology')}
              className="btn bg-white/10 text-white border border-white/20 hover:bg-white/20 px-6 py-3 text-base font-semibold"
            >
              <BookOpen className="w-5 h-5" />
              View Methodology
            </button>
          </div>

          <div className="mt-12 flex items-center gap-2 text-sm text-navy-300">
            <Shield className="w-4 h-4" />
            SIH 2026 • Problem Statement SIH26056
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 py-16 lg:py-20">
        <div className="text-center mb-12">
          <h3 className="font-display font-bold text-3xl text-navy-900">Platform Capabilities</h3>
          <p className="mt-2 text-slate-500">A complete airfare intelligence pipeline from observation to policy insight.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="card card-hover p-6">
                <div className="w-11 h-11 rounded-lg bg-navy-50 flex items-center justify-center mb-4">
                  <Icon className="w-5 h-5 text-navy-700" />
                </div>
                <h4 className="font-display font-semibold text-lg text-navy-900">{f.title}</h4>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Architecture preview */}
      <section className="bg-slate-50 py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-10">
            <h3 className="font-display font-bold text-3xl text-navy-900">End-to-End Pipeline</h3>
            <p className="mt-2 text-slate-500">Designed for future replacement of mock data with compliant live airline/OTA/API feeds.</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {['Data Sources', 'Collection', 'Validation', 'Cleaning', 'Normalization', 'Index Engine', 'Analytics', 'API', 'Dashboard'].map((stage, i) => (
              <div key={stage} className="flex items-center gap-3">
                <div className="card px-4 py-3 text-center min-w-[120px]">
                  <div className="flex items-center justify-center gap-2">
                    {i === 0 && <Database className="w-4 h-4 text-navy-600" />}
                    {i === 8 && <BarChart3 className="w-4 h-4 text-navy-600" />}
                    <span className="text-sm font-medium text-navy-800">{stage}</span>
                  </div>
                </div>
                {i < 8 && <ArrowRight className="w-4 h-4 text-slate-300" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-16 text-center">
        <h3 className="font-display font-bold text-2xl text-navy-900">Ready to explore the data?</h3>
        <p className="mt-2 text-slate-500">Access the full interactive dashboard with demo authentication.</p>
        <button
          onClick={() => navigate('/login')}
          className="btn-primary mt-6 px-6 py-3 text-base"
        >
          Enter Dashboard
          <ArrowRight className="w-5 h-5" />
        </button>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        AeroIndex India • Prototype for SIH 2026 • SIH26056
      </footer>
    </div>
  );
}
