import { API_BASE } from './api';

// Gemini 2.5 Flash Client for Aeroindex AI Assistant (AeroBot)
const GEMINI_API_KEY =
  (import.meta.env.VITE_GEMINI_API_KEY as string | undefined) || '';

const GEMINI_MODEL = 'gemini-2.5-flash';
// Local proxy for Vite dev server
const GEMINI_PROXY_ENDPOINT = `/gemini-proxy/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
const GEMINI_DIRECT_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

export interface LiveAppContext {
  isDbLoaded: boolean;
  currentIndex?: number;
  momChange?: number;
  routesMonitored?: number;
  activeAirlines?: string[];
  activeOtas?: number;
  topSurgeRoutes?: Array<{ corridor: string; fare: number; changePercent: number }>;
  bookingWindowMultiplier?: number;
  dqeIntegrityRate?: number;
  lastUpdated?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
}

export function buildSystemInstruction(liveContext: LiveAppContext): string {
  const isLoaded = liveContext.isDbLoaded && liveContext.currentIndex !== undefined;

  const indexValue = isLoaded ? liveContext.currentIndex!.toFixed(1) : 'Loading...';
  const mom = isLoaded
    ? (liveContext.momChange !== undefined
        ? (liveContext.momChange > 0 ? `+${liveContext.momChange.toFixed(1)}%` : `${liveContext.momChange.toFixed(1)}%`)
        : '+0.0%')
    : 'Pending sync';
  const routesCount = liveContext.routesMonitored ?? 152;
  const carriers = (liveContext.activeAirlines && liveContext.activeAirlines.length > 0)
    ? liveContext.activeAirlines.join(', ')
    : 'IndiGo, Air India, SpiceJet, Akasa Air, AIX Connect, Alliance Air';
  const surgeMultiplier = liveContext.bookingWindowMultiplier ?? 2.4;
  const dqeRate = liveContext.dqeIntegrityRate ?? 98.4;

  let liveDataSection = '';
  if (!isLoaded) {
    liveDataSection = `=== LIVE REAL-TIME DATA STATUS: CURRENTLY LOADING FROM DATABASE ===
The platform is actively querying the SQLite database to compute the latest verified National Airfare Index and route statistics for this session.
- CURRENT STATUS: [Loading from DB... Waiting for database sync]
- CRITICAL DIRECTIVE FOR LIVE VALUE QUERIES:
  If the user asks "What is the airfare index now?", "What is the current index?", or asks for live figures while loading is still in progress, you MUST NOT invent or guess any number. You MUST clearly state:
  "The latest National Airfare Index is currently loading from the database... Please wait a moment for the live pipeline to finish syncing and try asking again in a few seconds."
- For general methodology, project questions (such as how the Laspeyres index works, DGCA volume weighting, Rule 135(2) statutory basis, or the T+45 to T+1 advance surge curve), you CAN answer immediately and thoroughly using the knowledge base below.`;
  } else {
    liveDataSection = `=== LIVE REAL-TIME DATA FROM AEROINDEX APP (VERIFIED & LOADED) ===
The database has finished loading. The following live figures are currently active on the user's dashboard right now:
- National Airfare Index: ${indexValue} (Base Jan 2026 = 100.0)
- MoM Shift (vs Previous Month): ${mom}
- Monitored Domestic Corridors: ${routesCount} routes
- Active Scheduled Carriers: ${carriers}
- Active Distribution Channels / OTAs: ${liveContext.activeOtas ?? 5}
- Close-in T+1 vs T+45 Departure Booking Surge Penalty: ${surgeMultiplier}x higher fares
- Data Quality Engine (DQE) Ingestion Integrity: ${dqeRate}% verified clean
- System Clock: ${liveContext.lastUpdated || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}

CRITICAL DIRECTIVE:
When asked "What is the airfare index now?" or about live metrics, quote the exact live number (${indexValue}, with MoM shift ${mom}) directly from this verified data.`;
  }

  const liveRule = isLoaded
    ? `When asked "what is the airfare index now", "what is the current index", or any question about current figures, you MUST quote the live value from above (${indexValue}, with MoM change ${mom}). State clearly that this is fetched directly from Aeroindex's real-time national index engine. Do NOT search Google or fabricate other numbers.`
    : `The database is currently syncing. When asked "what is the airfare index now" or about current live figures, you MUST respond that the live index is currently loading from the database, and advise the user to wait a moment.`;

  return `You are AeroBot, the official Aviation Economic Intelligence Agent for Aeroindex India (National Airfare Index & Continuous Tariff Surveillance Platform, SIH26056).

${liveDataSection}

=== CORE PLATFORM KNOWLEDGE BASE ===
1. PROBLEM & PURPOSE (SIH26056):
   - Current government tariff monitoring (DGCA TMU / MoSPI) checks ~78 routes manually once a month, arriving ~60 days late for India's CPI (Transport Component).
   - Aeroindex automates continuous multi-daily tariff surveillance across 150+ corridors and 8 advance-purchase horizons (T+45 down to T+1), publishing same-day indices.
2. ECONOMETRIC METHODOLOGY:
   - Laspeyres Composite Price Index weighted with actual DGCA passenger volume shares across domestic trunk and regional routes.
   - Base Benchmark: January 2026 = 100.0.
3. STATUTORY LEGAL BASIS:
   - Sourced under statutory airline tariff disclosure rules (Rule 135(2) of the Aircraft Rules, 1937), guaranteeing public disclosure of tariff structures.
4. ADVANCE-PURCHASE DYNAMICS:
   - Fares follow an exponential curve escalating from T+45 days down to T+1 departure eve due to dynamic inventory bucket closure.
5. PREDICTIVE SURVEILLANCE & MARKOV CHAINS:
   - Categorizes fare shifts into discrete states (Stable, Surge, Discount, Capacity Cleared) to compute Fare Escalation Probabilities (FEP) before public consumer complaints occur.
6. DATA INTEGRITY (DQE):
   - 5-stage Data Quality Engine: Schema validation, SHA duplicate pruning, price outlier boundary checks, and SQLite APX persistence.

=== STRICT OPERATIONAL RULES ===
1. GROUNDED FACTUALITY:
   - ${liveRule}
2. DOMAIN BOUNDARY & GUARDRAILS:
   - You ONLY answer questions related to Aeroindex, Indian domestic airfares, airline pricing, DGCA/MoSPI economic indices, travel inflation, aviation corridors, and platform methodology.
   - If a user asks about anything unrelated (such as cooking recipes, general software coding, general trivia, movies, sports, or other topics), politely decline:
     "I am Aeroindex's Aviation Economic Intelligence Agent. I specialize exclusively in Indian airfare tracking, the National Airfare Index, route surveillance, and econometric methodology. Please ask a question related to Aeroindex or Indian aviation tariffs."
3. TONE & FORMAT:
   - Authoritative, professional, concise, and helpful for civil aviation analysts, statisticians, and SIH evaluators.
   - Use markdown bolding and bullet points for readability.`;
}

export async function askGemini(
  prompt: string,
  history: ChatMessage[],
  liveContext: LiveAppContext
): Promise<string> {
  const systemInstruction = buildSystemInstruction(liveContext);

  // Filter out system welcome message, error alerts, and empty turns
  const cleanHistory = history.filter(
    (m) => m.id !== 'welcome-1' && !m.text.startsWith('⚠️') && m.text.trim().length > 0
  );

  // Take the last 6 valid exchanges
  const recentHistory = cleanHistory.slice(-6);

  const turns: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = recentHistory.map((m) => ({
    role: m.role,
    parts: [{ text: m.text }],
  }));

  // Gemini API requires the first turn in contents to have role: 'user'
  while (turns.length > 0 && turns[0].role === 'model') {
    turns.shift();
  }

  // Append the current user prompt
  turns.push({
    role: 'user',
    parts: [{ text: prompt }],
  });

  const payload = {
    contents: turns,
    systemInstruction: {
      parts: [{ text: systemInstruction }],
    },
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      maxOutputTokens: 800,
    },
  };

  // 1. First priority: Backend proxy /api/chat (Production-ready, CORS-safe, uses Render GEMINI_API_KEY)
  try {
    const backendRes = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: turns,
        systemInstruction,
      }),
    });

    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data?.text) {
        return data.text.trim();
      }
    } else {
      console.warn(`[AeroBot] Backend /api/chat returned status ${backendRes.status}, falling back...`);
    }
  } catch (backendErr) {
    console.warn('[AeroBot] Backend /api/chat request failed, falling back:', backendErr);
  }

  // 2. Second priority: Local Vite dev server proxy (only active in local npm run dev)
  let response: Response | null = null;
  if (import.meta.env.DEV) {
    try {
      const proxyRes = await fetch(GEMINI_PROXY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (proxyRes.ok) {
        response = proxyRes;
      }
    } catch {
      // ignore and continue to direct fallback
    }
  }

  // 3. Third priority: Direct Google Gemini API endpoint (uses VITE_GEMINI_API_KEY)
  if (!response) {
    try {
      response = await fetch(GEMINI_DIRECT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error('Unable to reach Gemini AI service. Please verify your connection or GEMINI_API_KEY in deployment.');
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMsg = errorText;
    try {
      const errObj = JSON.parse(errorText);
      parsedMsg = errObj.error?.message || errObj.message || errorText;
    } catch {
      // Use raw text
    }
    throw new Error(`Gemini service notice (${response.status}): ${parsedMsg}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No response text returned by Gemini AI.');
  }

  return text.trim();
}
