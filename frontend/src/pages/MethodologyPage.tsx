import { Card } from '@/components/ui/Card';
import {
  Database, Filter, Sparkles, Scale, Route as RouteIcon, Plane, Clock, MapPin,
  Bell, Lightbulb, ArrowRight, ShieldCheck,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SECTIONS = [
  {
    icon: Database,
    title: '1. Problem',
    body: 'Domestic airfare prices in India fluctuate significantly based on route, airline, booking timing, season, and demand. There is no standardized, continuously-updated index that policymakers can use to track fare movements the way CPI tracks consumer prices. AeroIndex India fills this gap.',
  },
  {
    icon: Filter,
    title: '2. Why Airfare Is Difficult To Measure',
    body: 'Unlike fixed-price goods, airfares change dynamically multiple times per day. The same seat can sell at very different prices depending on when you book, which airline you fly, and how far in advance you purchase. A robust index must normalize across all these dimensions.',
  },
  {
    icon: Database,
    title: '3. Data Collection',
    body: 'The prototype uses a deterministic mock data generator (MockAirfareDataSource) that simulates realistic airfare observations. The architecture is designed so this can be replaced by a LiveAirfareDataSource connected to permitted airline portals, OTA feeds, or licensed APIs without changing the rest of the application.',
  },
  {
    icon: Sparkles,
    title: '4. Data Cleaning',
    body: 'Raw observations pass through validation. Invalid records (malformed fares, missing routes) and duplicate entries are flagged and excluded. The pipeline tracks how many records were removed at each stage and reports a data quality percentage.',
  },
  {
    icon: Scale,
    title: '5. Price Normalization',
    body: 'Each observation is decomposed into base fare, taxes, and fees. The total fare is used for index calculation. Observations are grouped by route, month, airline, booking window, and travel class to enable consistent comparison.',
  },
  {
    icon: RouteIcon,
    title: '6. Route Selection',
    body: 'A basket of 25 representative domestic routes is selected based on passenger volume and geographic coverage. Each route carries a configurable weight reflecting its importance. Short, medium, and long-haul routes are all included.',
  },
  {
    icon: Scale,
    title: '7. Index Calculation',
    body: 'For each route, the average fare in each month is calculated. A price relative is computed by dividing the current month average by the January 2026 base-period average. These relatives are combined using route weights to produce the national Airfare Price Index. Base period: January 2026 = 100.',
  },
  {
    icon: RouteIcon,
    title: '8. Route Analysis',
    body: 'Each route is analyzed for average fare, median fare, minimum and maximum observed fare, month-over-month change, volatility (standard deviation), and risk classification (high, medium, low) based on the magnitude of fare movements.',
  },
  {
    icon: Plane,
    title: '9. Airline Analysis',
    body: 'Airlines are compared on average fare, median fare, price range, volatility, and observation count. This reveals which carriers consistently offer lower or higher fares and which have more variable pricing.',
  },
  {
    icon: Clock,
    title: '10. Booking-Window Analysis',
    body: 'Fares are grouped by booking window (T+1, T+7, T+15, T+30, T+45). The analysis shows how average fares increase as departure approaches, quantifying the premium paid for late bookings.',
  },
  {
    icon: MapPin,
    title: '11. Geographic Visualization',
    body: 'An interactive India map displays all monitored airports and routes. Route colors indicate fare movement direction and magnitude: green for decreasing/stable, yellow for moderate increase, red for significant increase.',
  },
  {
    icon: Bell,
    title: '12. Alerts',
    body: 'The system automatically detects significant fare movements — spikes above 10%, drops below 5%, high volatility routes, and index threshold crossings — and generates alerts with severity levels for administrator attention.',
  },
  {
    icon: Lightbulb,
    title: '13. Policy Insights',
    body: 'Rather than presenting only charts, the system converts analytics into plain-English statements that policymakers can act on: current index level, highest-increase routes, booking-window impact, and volatility warnings.',
  },
  {
    icon: ShieldCheck,
    title: '14. Future Live-Data Integration',
    body: 'The DataSource abstraction allows swapping the mock generator for a live data collection pipeline. All production data collection will follow applicable website terms, robots.txt, rate limits, API licensing, and ethical data-collection requirements.',
  },
];

const PHASES = [
  { label: 'Foundation', description: 'Define the problem and build a representative airfare dataset.', items: SECTIONS.slice(0, 3) },
  { label: 'Data processing', description: 'Clean, normalize, and weight observations for fair comparison.', items: SECTIONS.slice(3, 7) },
  { label: 'Analysis', description: 'Turn the prepared data into route, airline, and booking insights.', items: SECTIONS.slice(7, 10) },
  { label: 'Decision support', description: 'Make movements visible, actionable, and ready for future live data.', items: SECTIONS.slice(10) },
];

export function MethodologyPage() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="font-display font-bold text-2xl lg:text-3xl text-navy-900">Methodology</h1>
        <p className="text-slate-500 mt-1">How AeroIndex India works — explained for non-technical readers</p>
      </div>

      <div className="space-y-5">
        {PHASES.map((phase, phaseIndex) => (
          <Card key={phase.label} className="overflow-hidden" bodyClassName="px-0 pb-0">
            <div className="flex items-start gap-4 px-5 pb-4">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy-800 text-sm font-semibold text-white">
                {phaseIndex + 1}
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold text-navy-900">{phase.label}</h2>
                <p className="mt-0.5 text-sm text-slate-500">{phase.description}</p>
              </div>
            </div>
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {phase.items.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.title} className="flex items-start gap-4 px-5 py-4 lg:px-7">
                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-600" />
                    <div className="min-w-0">
                      <h3 className="font-display font-semibold text-navy-900">{s.title.replace(/^\d+\.\s*/, '')}</h3>
                      <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-600">{s.body}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Card title="Future Production Integration" className="mt-6">
        <div className="grid gap-3 md:grid-cols-3 mb-6">
          {['Airline Portals', 'OTA Portals', 'Permitted APIs'].map((src, i) => (
            <div key={src} className="flex items-center gap-3">
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                <span className="text-sm font-medium text-navy-800">{src}</span>
              </div>
              {i < 2 && <ArrowRight className="hidden h-4 w-4 flex-shrink-0 text-slate-300 md:block" />}
            </div>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {['Automated Collection', 'Validation', 'Database', 'Index'].map((stage, i) => (
            <div key={stage} className="flex items-center gap-3">
              <div className="w-full rounded-lg border border-navy-100 bg-navy-50 px-4 py-3 text-center">
                <span className="text-sm font-medium text-navy-800">{stage}</span>
              </div>
              {i < 3 && <ArrowRight className="hidden h-4 w-4 flex-shrink-0 text-slate-300 lg:block" />}
            </div>
          ))}
        </div>
        <p className="text-sm text-slate-500 mt-6 text-center max-w-2xl mx-auto">
          All production data collection will follow applicable website terms, robots.txt, rate limits,
          API licensing and ethical data-collection requirements. The prototype does not currently scrape any live source.
        </p>
      </Card>

      <div className="text-center mt-8">
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Go to Dashboard <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
