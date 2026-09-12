import { Card } from '@/components/ui/Card';
import { Database, Filter, Sparkles, Scale, Route as RouteIcon, Plane, Clock, ArrowRight, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function MethodologyPage() {
  const navigate = useNavigate();

  return (
    <div className="animate-fade-in max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-10 border-b border-slate-200 pb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent-600">Detailed Index Calculation</p>
        <h1 className="font-display text-3xl font-bold text-navy-900 mb-3">AeroIndex Calculation Methodology</h1>
        <p className="text-slate-600 max-w-2xl">A comprehensive technical guide to how the Airfare Price Index is calculated, from raw observations to the final weighted national index.</p>
        <div className="mt-6 flex items-center gap-3 text-sm text-slate-500">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-500/10 text-success-600"><ShieldCheck className="h-4 w-4" /></span>
          <span>Base Period: <strong className="font-semibold text-navy-800">January 2026 = 100</strong></span>
        </div>
      </div>

      {/* Section 1: Dataset Summary */}
      <Card title="1. Dataset Summary" className="mb-6">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">The current local dataset contains:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg">
            <div>
              <p className="text-xs text-slate-500 font-semibold">Monitored Routes</p>
              <p className="text-lg font-bold text-navy-900">30</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Total Observations</p>
              <p className="text-lg font-bold text-navy-900">54,762</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Valid Observations</p>
              <p className="text-lg font-bold text-navy-900">51,212</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Invalid Records</p>
              <p className="text-lg font-bold text-navy-900">2,138</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Duplicates</p>
              <p className="text-lg font-bold text-navy-900">1,412</p>
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold">Total Route Weight</p>
              <p className="text-lg font-bold text-navy-900">132</p>
            </div>
          </div>
          <p className="text-slate-600 text-xs">Each observation contains route, airline, travel date, booking window, travel class, and fare components. The index uses <code className="bg-slate-100 px-2 py-1 rounded text-navy-900">totalFare</code> as the price value.</p>
        </div>
      </Card>

      {/* Section 2: Route Metadata */}
      <Card title="2. Route Metadata" className="mb-6">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">Each route contains: id, origin, destination, weight, distanceKm, and category.</p>
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <p className="font-mono text-xs text-slate-600 mb-2">Example Route:</p>
            <pre className="text-xs text-navy-900 overflow-auto">
{`{
  "id": "DEL-BOM",
  "origin": "DEL",
  "destination": "BOM",
  "weight": 15,
  "distanceKm": 1148,
  "category": "medium"
}`}
            </pre>
          </div>
          <div className="space-y-3">
            <h4 className="font-semibold text-navy-900">Distance Categories:</h4>
            <ul className="list-disc list-inside text-slate-600 space-y-1">
              <li><strong>Short:</strong> distance &lt; 700 km (base fare: ₹2,800)</li>
              <li><strong>Medium:</strong> distance 700–1,399 km (base fare: ₹4,500)</li>
              <li><strong>Long:</strong> distance ≥ 1,400 km (base fare: ₹7,500)</li>
            </ul>
          </div>
          <p className="text-xs text-slate-500 italic">Distance is calculated using the Haversine formula from airport coordinates. Category influences the fare model but does not directly appear in the national index formula.</p>
        </div>
      </Card>

      {/* Section 3: Observation Validation */}
      <Card title="3. Observation Validation" className="mb-6">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">Only valid observations are used for index calculation:</p>
          <div className="bg-accent-50 border border-accent-200 p-4 rounded-lg">
            <p className="font-mono text-sm text-accent-900">valid observations = observations where status == "valid"</p>
          </div>
          <p className="text-slate-600">Invalid and duplicate records are excluded by the frontend analytics implementation. The pipeline tracks data quality at each stage and reports removal counts.</p>
        </div>
      </Card>

      {/* Section 4: Fare Composition */}
      <Card title="4. Fare Composition" className="mb-6">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">Each observation's total fare is decomposed as:</p>
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="text-slate-600">Base fare portion</span>
              <span className="font-bold text-navy-900">78%</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-slate-200">
              <span className="text-slate-600">Taxes</span>
              <span className="font-bold text-navy-900">15%</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-slate-600">Fees</span>
              <span className="font-bold text-navy-900">7%</span>
            </div>
          </div>
          <div className="bg-accent-50 border border-accent-200 p-4 rounded-lg">
            <p className="text-xs font-mono text-accent-900">totalFare = baseFare + taxes + fees</p>
          </div>
        </div>
      </Card>

      {/* Section 5: Route-Level Monthly Average */}
      <Card title="5. Route-Level Monthly Average" className="mb-6">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">For a route r and month m, the average fare is:</p>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg overflow-x-auto">
            <p className="font-mono text-xs text-blue-900">RouteMonthlyAverage(r,m) = Σ(totalFare observations for route r in month m) / count</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-navy-900">Example:</h4>
            <p className="text-slate-600">Suppose DEL-BOM has three valid observations in August: ₹10,000, ₹11,000, ₹12,000</p>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="font-mono text-xs text-slate-600">RouteMonthlyAverage(DEL-BOM, Aug) = (10,000 + 11,000 + 12,000) / 3 = <span className="font-bold text-navy-900">₹11,000</span></p>
            </div>
          </div>
          <p className="text-xs text-slate-500 italic">Implementation: frontend/src/data/analytics.ts in routeMonthlyAverages()</p>
        </div>
      </Card>

      {/* Section 6: Route-Level Index */}
      <Card title="6. Route-Level Index" className="mb-6">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">January 2026 is the base period with an index value of 100. For each route, calculate:</p>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3 overflow-x-auto">
            <p className="font-mono text-xs text-blue-900">RouteBase(r) = RouteMonthlyAverage(r, Jan 2026)</p>
            <p className="font-mono text-xs text-blue-900">RouteIndex(r,m) = (RouteMonthlyAverage(r,m) / RouteBase(r)) × 100</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-navy-900">Example:</h4>
            <p className="text-slate-600">DEL-BOM has January average: ₹10,000 and August average: ₹11,500</p>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="font-mono text-xs text-slate-600">RouteIndex(DEL-BOM, Aug) = (11,500 / 10,000) × 100 = <span className="font-bold text-navy-900">115</span></p>
              <p className="text-xs text-slate-500 mt-2 italic">Interpretation: DEL-BOM fares are 15% above the route's January 2026 level.</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Section 7: National Airfare Index */}
      <Card title="7. National Airfare Index (Weighted)" className="mb-6">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">The national index is a weighted average of route-level relatives:</p>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-3 overflow-x-auto">
            <p className="font-mono text-xs text-blue-900">RouteRelative(r,m) = RouteMonthlyAverage(r,m) / RouteBase(r)</p>
            <p className="font-mono text-xs text-blue-900">NationalIndex(m) = [Σ(RouteRelative(r,m) × RouteWeight(r))] / [Σ RouteWeight(r)] × 100</p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold text-navy-900">Example with Simplified Basket:</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-3 py-2 text-left">Route</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Route Relative</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Weight</th>
                    <th className="border border-slate-300 px-3 py-2 text-right">Weighted Value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-slate-300 px-3 py-2">DEL-BOM</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">1.15</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">15</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">17.25</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-3 py-2">DEL-BLR</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">1.08</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">14</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">15.12</td>
                  </tr>
                  <tr>
                    <td className="border border-slate-300 px-3 py-2">BLR-HYD</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">1.20</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">8</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">9.60</td>
                  </tr>
                  <tr className="bg-accent-50 font-semibold">
                    <td className="border border-slate-300 px-3 py-2">TOTAL</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">—</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">37</td>
                    <td className="border border-slate-300 px-3 py-2 text-right">41.97</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <p className="font-mono text-xs text-slate-600">National Index = (41.97 / 37) × 100 = <span className="font-bold text-navy-900">113.4</span></p>
              <p className="text-xs text-slate-500 mt-2 italic">Interpretation: The combined airfare level is approximately 13.4% above the January 2026 base.</p>
            </div>
          </div>
          <p className="text-xs text-slate-500 italic">Implementation: frontend/src/data/analytics.ts in computeIndex()</p>
        </div>
      </Card>

      {/* Section 8: Month-over-Month Change */}
      <Card title="8. Month-over-Month Change" className="mb-6">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">The dashboard displays the month-over-month percentage change:</p>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg overflow-x-auto">
            <p className="font-mono text-xs text-blue-900">MoM Change(m) = [(Index(m) - Index(m-1)) / Index(m-1)] × 100</p>
          </div>
          <p className="text-slate-600">For January 2026, the change is set to zero because it is the base period.</p>
        </div>
      </Card>

      {/* Section 9: Booking Window Analysis */}
      <Card title="9. Booking Window Analysis" className="mb-6">
        <div className="space-y-4 text-sm">
          <p className="text-slate-600">Fares are analyzed across booking windows to quantify the premium for late bookings:</p>
          <div className="bg-slate-50 p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-3 py-1">
              <span className="font-mono text-xs text-accent-600 min-w-12">T+45:</span>
              <span className="text-slate-600">45 days before departure</span>
            </div>
            <div className="flex items-center gap-3 py-1">
              <span className="font-mono text-xs text-accent-600 min-w-12">T+30:</span>
              <span className="text-slate-600">30 days before departure</span>
            </div>
            <div className="flex items-center gap-3 py-1">
              <span className="font-mono text-xs text-accent-600 min-w-12">T+15:</span>
              <span className="text-slate-600">15 days before departure</span>
            </div>
            <div className="flex items-center gap-3 py-1">
              <span className="font-mono text-xs text-accent-600 min-w-12">T+7:</span>
              <span className="text-slate-600">7 days before departure</span>
            </div>
            <div className="flex items-center gap-3 py-1">
              <span className="font-mono text-xs text-accent-600 min-w-12">T+1:</span>
              <span className="text-slate-600">1 day before departure</span>
            </div>
          </div>
          <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg overflow-x-auto">
            <p className="font-mono text-xs text-blue-900">AverageFare(w) = Σ(totalFare where bookingWindow = w) / count</p>
            <p className="font-mono text-xs text-blue-900 mt-2">LateBookingIncrease = [(Fare(T+1) - Fare(T+45)) / Fare(T+45)] × 100</p>
          </div>
          <p className="text-xs text-slate-500 italic">This shows how much more expensive it is to book close to departure versus far in advance.</p>
        </div>
      </Card>

      {/* Key Takeaways */}
      <Card title="Key Calculation Principles" className="mb-6 bg-accent-50 border-accent-200">
        <ul className="space-y-3 text-sm">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent-600 text-xs font-bold text-white">✓</span>
            <span><strong>Base Period:</strong> January 2026 = 100 for all routes</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent-600 text-xs font-bold text-white">✓</span>
            <span><strong>Route Weighting:</strong> Each route has a configurable weight reflecting its importance (total = 132)</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent-600 text-xs font-bold text-white">✓</span>
            <span><strong>Monthly Averaging:</strong> Observations grouped by travel date month for consistent periods</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent-600 text-xs font-bold text-white">✓</span>
            <span><strong>Data Quality:</strong> Only valid observations are included; invalid and duplicate records excluded</span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent-600 text-xs font-bold text-white">✓</span>
            <span><strong>Transparency:</strong> Every step is auditable; all source data and calculations documented</span>
          </li>
        </ul>
      </Card>

      {/* Navigation */}
      <div className="flex gap-3 justify-center mt-10">
        <button onClick={() => navigate('/dashboard')} className="btn-primary">
          Go to Dashboard <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
