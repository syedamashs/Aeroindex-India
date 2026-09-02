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
    <div className="animate-fade-in px-1 sm:px-2">
      <div className="mb-7 flex flex-col gap-4 border-b border-slate-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">The measurement framework</p>
          <h1 className="font-display text-2xl font-bold text-navy-900 lg:text-3xl">How AeroIndex works</h1>
          <p className="mt-1.5 max-w-2xl text-sm text-slate-500">A transparent path from raw airfare observations to policy-ready signals.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-500">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 text-success-600"><ShieldCheck className="h-4 w-4" /></span>
          <span>Prototype framework<br /><strong className="font-semibold text-navy-800">January 2026 base period</strong></span>
        </div>
        <button onClick={() => navigate('/dashboard')} className="btn-primary self-start lg:self-auto">
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PHASES.map((phase, phaseIndex) => (
          <div key={phase.label} className="relative border-t-2 border-navy-800 pt-4">
            <div className="mb-3 flex items-start gap-3">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-navy-800 text-xs font-bold text-white">0{phaseIndex + 1}</span>
              <div>
                <h2 className="font-display font-semibold text-navy-900">{phase.label}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{phase.description}</p>
              </div>
            </div>
            <div className="space-y-2.5 pl-10">
              {phase.items.map((section) => {
                const Icon = section.icon;
                return (
                  <div key={section.title} className="flex items-center gap-2 text-sm text-slate-600">
                    <Icon className="h-3.5 w-3.5 flex-shrink-0 text-accent-600" />
                    <span>{section.title.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Card title="From collection to decision support" subtitle="The production architecture is ready to accept a permitted live feed without changing the analysis layer." className="mb-6">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Potential sources</p>
            <div className="flex flex-wrap gap-2">
              {['Airline portals', 'OTA feeds', 'Permitted APIs'].map((source) => <span key={source} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-navy-800">{source}</span>)}
            </div>
          </div>
          <div className="rounded-lg border border-navy-100 bg-navy-50 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-navy-600">Processing path</p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-navy-800">
              {['Collect', 'Validate', 'Normalize', 'Index'].map((stage, index) => <span key={stage} className="flex items-center gap-2">{stage}{index < 3 && <ArrowRight className="h-3.5 w-3.5 text-navy-400" />}</span>)}
            </div>
          </div>
        </div>
        <p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-relaxed text-slate-500">All production data collection will follow applicable website terms, robots.txt, rate limits, API licensing, and ethical data-collection requirements. The prototype does not currently scrape any live source.</p>
      </Card>

    </div>
  );
}
