import { useEffect, useState, type ReactNode } from 'react';
import { apiDqeSummary, apiRoutes, apiStatistics } from '@/lib/api';

export function MethodologyPage() {
  const [statistics, setStatistics] = useState({ routesMonitored: 0, totalObservations: 0 });
  const [quality, setQuality] = useState({ invalid: 0, duplicates: 0, valid: 0 });
  const [routeWeight, setRouteWeight] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([apiStatistics(), apiDqeSummary(), apiRoutes()])
      .then(([stats, dqe, routes]) => {
        setStatistics({ routesMonitored: stats.data.routesMonitored, totalObservations: stats.data.totalObservations });
        const invalid = dqe.data.invalid_extraction_observations + dqe.data.invalid_fare_observations;
        setQuality({ invalid, duplicates: dqe.data.duplicate_identity_groups, valid: Math.max(0, dqe.data.total_observations - invalid) });
        setRouteWeight(routes.data.reduce((sum, route) => sum + route.weight, 0));
      })
      .catch((error) => console.error('Failed to fetch methodology statistics:', error))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-fade-in text-slate-800">
      {/* 1. DOCUMENT MASTHEAD */}
      <div className="border-b border-slate-300 pb-5">
        <div className="flex items-center gap-2 text-xs font-mono text-slate-500 uppercase tracking-widest">
          <span>Technical White Paper</span>
          <span className="text-slate-300">/</span>
          <span>DGCA-VAYU-SPEC-2026.01</span>
        </div>
        <h1 className="text-2xl font-serif font-bold text-slate-900 tracking-tight mt-1.5">
          Methodological Specification for the National Airfare Price Index (AeroIndex)
        </h1>
        <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
          Mathematical formulation, Laspeyres weighting framework, sampling protocol, and quality engine architecture for domestic scheduled passenger aviation.
        </p>
      </div>

      {/* 2. TWO-COLUMN RESEARCH LAYOUT (Table of Contents + Document Body) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Sticky Table of Contents */}
        <div className="hidden md:block col-span-1">
          <div className="sticky top-20 space-y-2 text-xs border-l border-slate-200 pl-3 font-sans">
            <span className="text-[11px] font-mono uppercase text-slate-400 font-semibold block mb-2">Sections</span>
            <a href="#sec-1" className="block text-slate-600 hover:text-slate-900">1. Executive Overview</a>
            <a href="#sec-2" className="block text-slate-600 hover:text-slate-900">2. Laspeyres Formulation</a>
            <a href="#sec-3" className="block text-slate-600 hover:text-slate-900">3. Corridor Weight Basket</a>
            <a href="#sec-4" className="block text-slate-600 hover:text-slate-900">4. Booking Window Stratification</a>
            <a href="#sec-5" className="block text-slate-600 hover:text-slate-900">5. DQE Ingestion Rules</a>
            <a href="#sec-6" className="block text-slate-600 hover:text-slate-900">6. Legal &amp; Regulatory Basis</a>
          </div>
        </div>

        {/* Document Body */}
        <div className="col-span-1 md:col-span-3 space-y-8 text-xs leading-relaxed text-slate-700">
          {/* Section 1 */}
          <section id="sec-1" className="space-y-3">
            <h2 className="text-base font-serif font-bold text-slate-900 border-b border-slate-200 pb-1.5">
              1. Executive Overview
            </h2>
            <p>
              The Vayuyaan National Airfare Price Index (AeroIndex India) is a statistical benchmark created to monitor and quantify macroeconomic price dynamics across Indian domestic scheduled commercial flight corridors. Modeled after official price indices published by central economic statistical organizations, Vayuyaan establishes an empirical standard for airline passenger tariffs.
            </p>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded font-mono text-[11px] space-y-1">
              <div><strong>Benchmark Base:</strong> January 2026 = 100.0</div>
              <div><strong>Network Sampling:</strong> 27 Domestic Trunk City-Pairs</div>
              <div><strong>Target Class:</strong> Economy Scheduled Passenger Service</div>
            </div>
          </section>

          {/* Section 2 */}
          <section id="sec-2" className="space-y-3">
            <h2 className="text-base font-serif font-bold text-slate-900 border-b border-slate-200 pb-1.5">
              2. Laspeyres Mathematical Formulation
            </h2>
            <p>
              The composite index employs a Laspeyres price relative aggregator with fixed base-period passenger volume weights. Under this formulation, current period average fares for each corridor are normalized against the fixed January 2026 base fare:
            </p>
            <div className="bg-slate-900 text-white p-4 rounded font-mono text-center text-sm font-semibold tracking-wide">
              I_t = [ ∑ ( w_i × ( P_i,t / P_i,0 ) ) / ∑ w_i ] × 100
            </div>
            <p className="text-[11px] text-slate-600">
              Where <em>I_t</em> denotes the composite index at observation period <em>t</em>, <em>w_i</em> is the predetermined passenger traffic weight allocated to corridor <em>i</em>, <em>P_i,t</em> is the volume-weighted mean fare observed in period <em>t</em>, and <em>P_i,0</em> is the baseline January 2026 tariff.
            </p>
          </section>

          {/* Section 3 */}
          <section id="sec-3" className="space-y-3">
            <h2 className="text-base font-serif font-bold text-slate-900 border-b border-slate-200 pb-1.5">
              3. Corridor Weight Basket Allocation
            </h2>
            <p>
              Individual route weights are calibrated directly from Directorate General of Civil Aviation (DGCA) annual domestic passenger traffic statistics. Monitored trunk sectors (including Delhi—Mumbai, Bengaluru—Delhi, and Chennai—Mumbai) receive proportional representation matching real consumer expenditure volume.
            </p>
          </section>

          {/* Section 4 */}
          <section id="sec-4" className="space-y-3">
            <h2 className="text-base font-serif font-bold text-slate-900 border-b border-slate-200 pb-1.5">
              4. Booking Window Stratification
            </h2>
            <p>
              Airfare pricing is intrinsically multi-dimensional due to airline revenue management systems. To eliminate temporal bias, observations are stratified across four advance-purchase horizons:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-700">
              <li><strong>T+1 Day:</strong> Close-in / emergency personal and business travel.</li>
              <li><strong>T+7 Days:</strong> Standard 1-week domestic business planning.</li>
              <li><strong>T+15 Days:</strong> Mid-horizon advance leisure and corporate travel.</li>
              <li><strong>T+30 Days:</strong> 1-month planning baseline.</li>
            </ul>
          </section>

          {/* Section 5 */}
          <section id="sec-5" className="space-y-3">
            <h2 className="text-base font-serif font-bold text-slate-900 border-b border-slate-200 pb-1.5">
              5. Data Quality Engine (DQE) Protocol
            </h2>
            <p>
              Raw tariff observations collected via Playwright headless scrapers undergo mandatory pre-index sanitization. Any record violating schema bounds (e.g. fare quotes below ₹1,500 or above ₹1,50,000, missing carrier identifiers, or identical flight key hashes within the same sweep) is isolated and excluded from index calculation.
            </p>
          </section>

          {/* Section 6 */}
          <section id="sec-6" className="space-y-3">
            <h2 className="text-base font-serif font-bold text-slate-900 border-b border-slate-200 pb-1.5">
              6. Legal &amp; Regulatory Basis
            </h2>
            <p>
              This methodology aligns with consumer tariff protection principles set forth under Rule 135 of the Indian Aircraft Rules, 1937, requiring carriers to establish reasonable tariff structures considering operating costs and prevailing market conditions without predatory gouging.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
