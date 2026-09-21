import React, { useState, useEffect, useRef } from 'react';
import {
  Bot, X, Send, Sparkles, Trash2, ChevronDown,
  Activity, ArrowUpRight, ShieldCheck, RefreshCw, MessageSquare, Loader2
} from 'lucide-react';
import { askGemini, type ChatMessage, type LiveAppContext } from '@/lib/gemini';

interface AeroBotChatProps {
  liveContext?: LiveAppContext;
  isStoryBarOpen?: boolean;
}

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'welcome-1',
    role: 'model',
    text: `Hello! I am **AeroBot**, the official Aviation Economic Intelligence Agent for Aeroindex India.

I am connected to the **live telemetry** of this application. You can ask me about:
- **Current Airfare Index** & MoM inflation shifts
- **Laspeyres index calculation** & DGCA volume weighting
- **Close-in T+1 vs T+45 surge penalty**
- **Corridor volatility & Markov price escalation**
- **Rule 135(2) statutory disclosures & DQE validation**

How can I assist your tariff analysis today?`,
    timestamp: new Date(),
  },
];

const SUGGESTED_PROMPTS = [
  'What is the National Airfare Index right now?',
  'Why do last-minute T+1 fares surge 2.4x?',
  'Explain the Laspeyres index methodology',
  'What are the most volatile corridors?',
];

export function AeroBotChat({
  liveContext = { isDbLoaded: false },
  isStoryBarOpen = false,
}: AeroBotChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  // Always start with a fresh new session on each page load/reload
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Clear any legacy session storage on mount
  useEffect(() => {
    try {
      sessionStorage.removeItem('aerobot_chat_history');
    } catch {
      // Ignore
    }
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || loading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: textToSend,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!customPrompt) setInput('');
    setLoading(true);
    setError(null);

    try {
      const responseText = await askGemini(textToSend, messages, liveContext);
      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        role: 'model',
        text: responseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, botMessage]);
    } catch (err) {
      console.error('Gemini query error:', err);
      const detail = err instanceof Error ? err.message : String(err);
      setError(detail);
      const errorMessage: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'model',
        text: `⚠️ **AeroBot Notice**: ${detail}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages(INITIAL_MESSAGES);
    sessionStorage.removeItem('aerobot_chat_history');
    setError(null);
  };

  // Render markdown-like text with bold, bullets, and linebreaks
  const renderMessageContent = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, i) => {
      // Bold parser
      const parts = line.split(/(\*\*.*?\*\*)/g);
      const renderedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-bold text-amber-300">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
        return (
          <li key={i} className="ml-4 list-disc text-slate-200">
            {renderedParts}
          </li>
        );
      }

      if (!line.trim()) {
        return <div key={i} className="h-1.5" />;
      }

      return (
        <p key={i} className="leading-relaxed">
          {renderedParts}
        </p>
      );
    });
  };

  const indexValue = liveContext.currentIndex !== undefined ? liveContext.currentIndex.toFixed(1) : '---';
  const momChange = liveContext.momChange !== undefined
    ? (liveContext.momChange > 0 ? `+${liveContext.momChange.toFixed(1)}%` : `${liveContext.momChange.toFixed(1)}%`)
    : '';

  return (
    <>
      {/* =========================================================================
          FLOATING ACTION BUTTON (BOTTOM RIGHT)
          ========================================================================= */}
      <div
        className={`fixed z-40 transition-all duration-300 ${
          isStoryBarOpen ? 'bottom-28 right-4 sm:right-6' : 'bottom-6 right-4 sm:right-6'
        }`}
      >
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-full bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-xl shadow-amber-500/30 ring-2 ring-amber-300 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Open AeroBot AI Assistant (Powered by Gemini 2.5)"
            aria-label="Open AeroBot AI Chat"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-950 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-950" />
            </span>
            <Bot className="w-4 h-4 text-slate-950 fill-slate-950 transition-transform group-hover:rotate-12" />
            <span className="font-extrabold tracking-wide">AeroBot AI</span>
            <span className="hidden sm:inline-block px-1.5 py-0.2 text-[9px] font-mono font-black uppercase rounded bg-slate-950 text-amber-300">
              Live
            </span>
          </button>
        )}
      </div>

      {/* =========================================================================
          FLOATING CHAT WINDOW CARD
          ========================================================================= */}
      {isOpen && (
        <aside
          role="complementary"
          aria-label="AeroBot AI Intelligence Assistant"
          className={`fixed z-40 w-[360px] sm:w-[420px] h-[580px] max-h-[82vh] flex flex-col rounded-2xl bg-[#090d16] border border-amber-500/50 shadow-2xl shadow-black/80 overflow-hidden text-slate-100 animate-in fade-in slide-in-from-bottom-5 duration-200 transition-all ${
            isStoryBarOpen ? 'bottom-28 right-4 sm:right-6' : 'bottom-6 right-4 sm:right-6'
          }`}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-3.5 border-b border-amber-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-inner">
                <Bot className="w-4 h-4 text-amber-400" />
                <span
                  className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-slate-950 ${
                    liveContext.isDbLoaded ? 'bg-emerald-400' : 'bg-amber-400 animate-ping'
                  }`}
                />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-white tracking-tight">AeroBot AI</h3>
                  <span className="px-1.5 py-0.2 text-[8px] font-mono font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase">
                    Gemini 2.5
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-400 flex items-center gap-1">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      liveContext.isDbLoaded ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400 animate-ping'
                    }`}
                  />
                  <span>
                    {liveContext.isDbLoaded ? 'Real-Time Radar Synced' : 'Syncing from Database...'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={clearChat}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Reset conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                title="Minimize AeroBot"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Live Context Telemetry Pill Strip */}
          <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-[10px] font-mono">
            {liveContext.isDbLoaded && liveContext.currentIndex !== undefined ? (
              <span className="text-slate-400 flex items-center gap-1">
                <Activity className="w-3 h-3 text-amber-400" />
                <span>Live Index:</span>
                <strong className="text-amber-400 font-bold">{indexValue}</strong>
                {momChange && <span className="text-emerald-400">({momChange})</span>}
              </span>
            ) : (
              <span className="text-amber-300 flex items-center gap-1.5 animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin text-amber-400" />
                <span>Loading from DB... Sync in progress</span>
              </span>
            )}
            <span className="text-slate-400">
              {liveContext.routesMonitored ? `${liveContext.routesMonitored} Corridors` : 'Querying Database...'}
            </span>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3 font-sans text-xs">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-xs ${
                      isUser
                        ? 'bg-amber-400 text-slate-950 font-semibold rounded-tr-xs'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-100 rounded-tl-xs'
                    }`}
                  >
                    {isUser ? (
                      <p className="leading-snug">{m.text}</p>
                    ) : (
                      <div className="space-y-1.5">{renderMessageContent(m.text)}</div>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 mt-1 px-1">
                    {m.timestamp.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-xl rounded-tl-xs max-w-[70%]">
                <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <span className="text-[11px] font-mono">Analyzing Aeroindex radar...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Chips (Visible when not actively loading) */}
          <div className="px-3 py-1.5 bg-slate-950/90 border-t border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none select-none">
            <span className="text-[9px] font-mono uppercase text-amber-400 font-bold shrink-0">
              Suggestions:
            </span>
            {SUGGESTED_PROMPTS.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="whitespace-nowrap px-2 py-0.5 rounded-full bg-slate-800 hover:bg-amber-500/20 hover:text-amber-300 text-slate-300 border border-slate-700 hover:border-amber-500/40 text-[10px] font-medium transition cursor-pointer disabled:opacity-40"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-slate-950 border-t border-slate-800">
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 focus-within:border-amber-500/70 focus-within:ring-1 focus-within:ring-amber-500/30 transition">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about live index, corridors, methodology..."
                disabled={loading}
                className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                className="p-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-bold transition cursor-pointer shrink-0"
                title="Send query"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[9px] font-mono text-slate-500 text-center mt-1.5">
              AeroBot · Grounded in live Aeroindex database &amp; Gemini 2.5 Flash
            </p>
          </div>
        </aside>
      )}
    </>
  );
}
