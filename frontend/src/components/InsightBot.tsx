import { useState } from 'react';
import { Bot, X, Sparkles, ChevronRight } from 'lucide-react';

export interface BotInsight {
  type: 'ai' | 'highlight';
  text: string;
  tag?: string;
}

interface InsightBotProps {
  title: string;
  subtitle?: string;
  insights: BotInsight[];
  triggerLabel?: string;
}

export function InsightBot({ title, subtitle, insights, triggerLabel = 'AI Explain' }: InsightBotProps) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(1);

  const handleOpen = () => {
    setOpen(true);
    setRevealed(1);
    insights.forEach((_, i) => {
      setTimeout(() => setRevealed(i + 2), (i + 1) * 700);
    });
  };

  return (
    <>
      {/* Premium Trigger Button */}
      <button
        id={`insightbot-trigger-${title.replace(/\s+/g, '-').toLowerCase()}`}
        onClick={handleOpen}
        className="group relative inline-flex items-center gap-2 text-xs font-semibold transition-all duration-300"
        style={{
          padding: '6px 14px',
          borderRadius: 10,
          background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 45%, #4f46e5 100%)',
          color: '#fff',
          border: '1px solid rgba(196,181,253,0.35)',
          boxShadow: '0 0 10px rgba(139,92,246,0.45), 0 2px 6px rgba(0,0,0,0.12)',
          animation: 'ibGlow 2.5s ease-in-out infinite',
          letterSpacing: '0.01em',
        }}
      >
        {/* Shimmer overlay */}
        <span
          className="absolute inset-0 rounded-[9px] pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.18) 50%, transparent 65%)',
            animation: 'ibShimmer 3s ease-in-out infinite',
          }}
        />
        <Sparkles className="w-3 h-3 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.7))' }} />
        <span className="relative">{triggerLabel}</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          />
          <div
            className="relative w-full flex flex-col overflow-hidden"
            style={{
              maxWidth: 420, maxHeight: '85vh', borderRadius: 20,
              background: '#fff', boxShadow: '0 32px 80px rgba(0,0,0,0.25)',
              border: '1px solid #e2e8f0',
              animation: 'insightSlideUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #4338ca)' }}>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center rounded-full flex-shrink-0"
                  style={{ width: 32, height: 32, background: 'rgba(255,255,255,0.2)' }}>
                  <Bot className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="text-white text-sm font-bold">AeroIndex AI</div>
                  <div className="text-violet-200 text-[10px] font-mono">Economic Insight Engine</div>
                </div>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition-colors">
                <X className="w-4 h-4 text-white/80" />
              </button>
            </div>

            {/* Context bar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0"
              style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
              <ChevronRight className="w-3 h-3 text-violet-500 flex-shrink-0" />
              <span className="text-[11px] font-semibold text-slate-700 truncate">{title}</span>
              {subtitle && <span className="text-[10px] text-slate-400 truncate">· {subtitle}</span>}
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: '#f8fafc' }}>
              {insights.slice(0, revealed).map((insight, i) => (
                <div key={i} style={{ animation: 'insightFadeIn 0.4s ease both' }}>
                  {insight.type === 'ai' ? (
                    <div className="flex gap-2 items-start">
                      <div className="flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                        style={{ width: 24, height: 24, background: 'linear-gradient(135deg, #7c3aed, #4338ca)' }}>
                        <Bot className="w-3 h-3 text-white" />
                      </div>
                      <div className="text-xs text-slate-700 leading-relaxed"
                        style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '0 14px 14px 14px',
                          padding: '8px 12px', maxWidth: '88%', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
                        {insight.text}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs"
                      style={{ background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)',
                        border: '1px solid #c4b5fd', borderRadius: 12, padding: '8px 12px', marginLeft: 32 }}>
                      {insight.tag && (
                        <span className="block mb-1 font-bold uppercase tracking-wide"
                          style={{ fontSize: 10, color: '#6d28d9' }}>{insight.tag}</span>
                      )}
                      <span className="text-indigo-900">{insight.text}</span>
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {revealed < insights.length && (
                <div className="flex gap-2 items-center pl-8">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="rounded-full"
                        style={{ width: 6, height: 6, background: '#a78bfa',
                          animation: `insightBounce 1s ${i * 0.2}s ease-in-out infinite` }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2 flex-shrink-0 border-t text-center"
              style={{ background: '#fff', borderColor: '#f1f5f9' }}>
              <p className="text-[10px] text-slate-400">
                Powered by AeroIndex Economic Intelligence · DGCA-calibrated analysis
              </p>
            </div>
          </div>

          <style>{`
            @keyframes insightSlideUp {
              from { opacity:0; transform:translateY(40px) scale(0.95); }
              to   { opacity:1; transform:translateY(0) scale(1); }
            }
            @keyframes insightFadeIn {
              from { opacity:0; transform:translateY(8px); }
              to   { opacity:1; transform:translateY(0); }
            }
            @keyframes insightBounce {
              0%,100% { transform:translateY(0); opacity:0.5; }
              50%      { transform:translateY(-4px); opacity:1; }
            }
            @keyframes ibGlow {
              0%,100% { box-shadow: 0 0 10px rgba(139,92,246,0.4), 0 2px 6px rgba(0,0,0,0.1); }
              50%      { box-shadow: 0 0 22px rgba(139,92,246,0.75), 0 4px 12px rgba(0,0,0,0.15); }
            }
            @keyframes ibShimmer {
              0%   { background-position: -200% center; }
              100% { background-position: 200% center; }
            }
          `}</style>
        </div>
      )}
    </>
  );
}

// ── Pre-written Insights ──────────────────────────────────────

export const INDEX_TRAJECTORY_INSIGHTS: BotInsight[] = [
  { type: 'ai', text: 'The AeroIndex India starts at baseline 100.0 in January 2026 — our fixed reference point representing the weighted average fare across all monitored trunk corridors in the base month.' },
  { type: 'ai', text: 'January and February show suppressed fare pressure. After Republic Day, Indian domestic aviation enters a predictable demand trough — leisure travel slows, corporate travel restarts cautiously, and airlines deploy discounted promotional inventory to fill seats.' },
  { type: 'highlight', tag: '📉 Jan–Feb Pattern', text: 'Post-holiday normalization + airline promotional pricing = below-baseline index. Airlines historically release early-bird discounts in this window, especially on metro trunk routes.' },
  { type: 'ai', text: 'From March onward, the index begins its structural ascent. Three demand drivers converge: summer vacation bookings for 300M+ school students (April–June holidays), board exam result travel to college cities, and IPL-driven Tier-2 city weekend demand spikes.' },
  { type: 'ai', text: 'July–August shows a stabilization plateau. Monsoon seasonality reduces leisure travel, but steady business travel absorbs capacity — keeping fares elevated without further compression.' },
  { type: 'highlight', tag: '📈 Sep Surge', text: "September marks India's festive travel surge — Navratri, Dussehra, and Diwali create the highest domestic aviation demand period of the year, driving the index to its annual peak trajectory." },
];

export const DASHBOARD_OVERVIEW_INSIGHTS: BotInsight[] = [
  { type: 'ai', text: "The National Airfare Index is a Laspeyres passenger-volume weighted composite. It tracks fare movement relative to January 2026 across India's highest-traffic domestic corridors." },
  { type: 'ai', text: 'The index rising above 100 means average Indian domestic fares exceed the baseline. Each monitored route contributes proportionally to its DGCA passenger traffic share — Delhi–Mumbai, being the highest volume corridor, carries the largest weight.' },
  { type: 'highlight', tag: '⚡ Why This Matters', text: 'Unlike raw fare data, the index filters route-specific noise. A fare spike on a low-traffic route barely moves the index, but a 5% move on Delhi–Mumbai shifts the national composite meaningfully.' },
  { type: 'ai', text: 'Real-time collection via direct airline distribution engine scraping ensures the index reflects actual booking prices — capturing the true market clearing price consumers pay, not listed fares.' },
];

export const ROUTE_CONTRIBUTION_INSIGHTS: BotInsight[] = [
  { type: 'ai', text: "Route contributions show how each corridor pushes the composite index up or down month-over-month. A positive contribution means that route's fares rose faster than the basket average." },
  { type: 'ai', text: 'Delhi–Mumbai dominates because it carries the highest DGCA-certified annual passenger volume. Its basket weight (~35–40%) means fare changes on this corridor disproportionately drive the national composite.' },
  { type: 'highlight', tag: '🛫 Chennai Routes', text: "Chennai corridors (DEL–MAA, BOM–MAA) show distinct seasonality driven by South India's academic calendar, IT industry travel cycles, and temple tourism — creating differentiated patterns vs. North Indian routes." },
];

export const BOOKING_WINDOW_INSIGHTS: BotInsight[] = [
  { type: 'ai', text: 'The booking window analysis reveals how far in advance Indian travelers purchase tickets — and how fare levels change as departure approaches.' },
  { type: 'ai', text: 'T+1 fares (booked 1 day before departure) are typically 40–80% higher than T+30 fares on the same route. This is the last-minute premium — airlines price remaining inventory aggressively to maximize yield on perishable seats.' },
  { type: 'highlight', tag: '💡 Optimal Window', text: 'The T+7 to T+15 window consistently shows the best price-to-availability ratio on Indian trunk routes. Booking 1–2 weeks out captures most discount inventory while availability is still good.' },
  { type: 'ai', text: 'Advance purchase curves flatten after T+30 on competitive routes — multiple airlines compete for early bookings, suppressing fares. As departure nears, capacity locks in and pricing power shifts to airlines.' },
];

export const AIRLINE_COMPARISON_INSIGHTS: BotInsight[] = [
  { type: 'ai', text: 'This carrier comparison benchmarks IndiGo, Air India, and SpiceJet across yield metrics — average fare, fare dispersion (volatility), and observation market share captured in our scraping pipeline.' },
  { type: 'ai', text: "IndiGo consistently prices below the market average — it operates India's largest LCC (Low Cost Carrier) network with the highest seat density, allowing it to undercut full-service carriers on most trunk routes while maintaining profitability through ancillary revenue." },
  { type: 'highlight', tag: '✈️ Air India Premium', text: 'Air India commands a yield premium on long-haul trunk routes (DEL–BOM, DEL–MAA) due to its full-service positioning — in-flight meals, larger seat pitch, and Maharaja Club loyalty points justify 15–25% higher average fares vs. IndiGo on identical routes.' },
  { type: 'ai', text: "SpiceJet's fare volatility is notably higher than peers — reflecting its capacity utilization challenges and frequent flash sale events to move unsold inventory rapidly. High volatility = higher risk and higher opportunity for price-sensitive travelers." },
  { type: 'highlight', tag: '📊 Market Concentration', text: "India's domestic aviation is a concentrated oligopoly: IndiGo holds ~58% market share by passengers, Air India ~24%, SpiceJet ~8%. This concentration limits price competition on trunk routes and explains why fares trend upward across carriers simultaneously." },
];

export const ROUTES_PAGE_INSIGHTS: BotInsight[] = [
  { type: 'ai', text: 'This route surveillance table tracks 10+ city-pair corridors in real-time, monitoring fare telemetry across booking windows and lead times to identify pricing anomalies and surge events.' },
  { type: 'ai', text: "India's domestic aviation network is hub-and-spoke centered on Delhi (DEL), Mumbai (BOM), Bengaluru (BLR), Chennai (MAA), Kolkata (CCU), and Hyderabad (HYD). These 6 metros account for ~75% of all domestic passenger movements per DGCA annual statistics." },
  { type: 'highlight', tag: '🔴 High MoM = Surge Alert', text: 'Routes with >5% month-on-month fare increase are flagged as surge corridors. This typically indicates an upcoming demand event (festival, exam season, IPL venue) or capacity reduction by airlines.' },
  { type: 'ai', text: "Volatility score measures intra-month fare dispersion — high volatility routes are actively being yield-managed by airlines. A volatile route is one where the airline frequently adjusts its pricing buckets as booking pace changes." },
];

export const FARE_STATE_INSIGHTS: BotInsight[] = [
  { type: 'ai', text: 'Fare-state transition analysis applies Markov chain methodology to track how reservation prices move between states over consecutive collection cycles — UNCHANGED, PRICE_INCREASE, PRICE_DECREASE, and BECAME_UNAVAILABLE.' },
  { type: 'ai', text: "PRICE_INCREASE is the most common transition on India's trunk routes — reflecting airlines' dynamic yield management systems which continuously raise fares as seats are booked and booking pace accelerates toward departure." },
  { type: 'highlight', tag: '⚠️ BECAME_UNAVAILABLE', text: "When a fare bucket becomes unavailable, it means the airline has sold all seats at that price point and moved to the next higher bucket. This is the purest signal of genuine demand pressure — not artificial scarcity." },
  { type: 'ai', text: 'PRICE_DECREASE transitions are rare (<20% of observations) and typically occur during fare war periods, flash sales by capacity-excess carriers, or when booking pace lags significantly behind seat-fill targets 10–15 days before departure.' },
  { type: 'highlight', tag: '📐 Markov Model', text: 'The steady-state distribution derived from these transition probabilities can predict the long-run probability that any observed fare will increase before departure — a key metric for travel timing optimization.' },
];

export const MARKET_INSIGHTS_INSIGHTS: BotInsight[] = [
  { type: 'ai', text: 'AeroIndex Policy Briefs synthesize our real-time scraping data with DGCA regulatory frameworks to generate actionable intelligence for aviation economists and policy makers.' },
  { type: 'ai', text: "India's domestic aviation market is the world's 3rd largest by passengers (2024) — growing at 8-12% CAGR. This explosive growth creates structural fare pressure as capacity additions lag demand growth, especially on Tier-2 to Tier-2 city connections." },
  { type: 'highlight', tag: '🏛️ DGCA Mandate', text: "India's DGCA has a price cap mechanism on key routes (UDAN scheme routes) to ensure affordability. However, uncapped metro trunk routes (DEL-BOM, DEL-BLR) show free-market pricing dynamics with significantly higher fare volatility." },
  { type: 'ai', text: 'The T+1 surge premium (last-minute fare spike) is an inefficiency in India\'s booking market — driven by business travelers who book late and are price-inelastic. Airlines deliberately hold back inventory at lower prices to capture both leisure and business segments.' },
  { type: 'highlight', tag: '📈 Policy Implication', text: 'A transparent, real-time national airfare index (like AeroIndex) is the prerequisite for evidence-based price regulation — allowing DGCA to distinguish genuine demand-driven increases from artificial capacity restriction by airlines.' },
];

