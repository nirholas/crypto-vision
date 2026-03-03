'use client';

import { useState, useCallback } from 'react';

interface Brief {
  headline: string;
  summary: string;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  importance: 'high' | 'medium' | 'low';
  relatedTicker?: string;
}

interface AIFlashBriefProps {
  category?: string;
  maxItems?: number;
}

const importanceIcon: Record<string, string> = {
  high: '🔴',
  medium: '🟡',
  low: '🟢',
};

const sentimentStyle: Record<string, { bg: string; text: string }> = {
  bullish: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400' },
  bearish: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400' },
  neutral: { bg: 'bg-gray-100 dark:bg-slate-700', text: 'text-gray-600 dark:text-slate-400' },
};

export function AIFlashBrief({ category, maxItems = 5 }: AIFlashBriefProps) {
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchBrief = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      params.set('limit', String(maxItems));
      const res = await fetch(`/api/ai/flash-briefing?${params}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      const items = (data.briefs || data.data || []).slice(0, maxItems).map((b: Record<string, unknown>) => ({
        headline: (b.headline as string) || (b.title as string) || '',
        summary: (b.summary as string) || (b.description as string) || '',
        sentiment: ((b.sentiment as string) || 'neutral') as Brief['sentiment'],
        importance: ((b.importance as string) || 'medium') as Brief['importance'],
        relatedTicker: (b.relatedTicker as string) || (b.ticker as string) || undefined,
      }));
      setBriefs(items);
      setGeneratedAt(data.generatedAt || new Date().toISOString());
      setLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate briefing');
    } finally {
      setLoading(false);
    }
  }, [category, maxItems]);

  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl overflow-hidden shadow-lg relative">
      {/* Decorative glow */}
      <div className="absolute -top-16 -right-16 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-brand-500/10 rounded-full blur-3xl" />

      <div className="relative p-6">
        {/* Header + CTA */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <h3 className="text-lg font-bold text-white">Flash Briefing</h3>
          </div>
          <button
            onClick={fetchBrief}
            disabled={loading}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              loading
                ? 'bg-gray-600 text-gray-300 cursor-wait'
                : 'bg-gradient-to-r from-amber-400 to-amber-500 text-black hover:from-amber-300 hover:to-amber-400 hover:shadow-lg hover:shadow-amber-500/20 active:scale-95'
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Generating...
              </>
            ) : loaded ? (
              '🔄 Refresh Brief'
            ) : (
              '⚡ Get Flash Brief'
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/30 text-red-400 rounded-lg text-sm flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {/* Briefs list */}
        {briefs.length > 0 && (
          <div className="space-y-3">
            {briefs.map((brief, i) => {
              const sStyle = sentimentStyle[brief.sentiment] || sentimentStyle.neutral;
              return (
                <div
                  key={i}
                  className="p-3 bg-slate-700/50 rounded-xl border border-slate-600/50 hover:bg-slate-700/70 transition-colors"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-sm mt-0.5 flex-shrink-0">{importanceIcon[brief.importance] || '🟡'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-white line-clamp-1">{brief.headline}</h4>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold flex-shrink-0 ${sStyle.bg} ${sStyle.text}`}>
                          {brief.sentiment}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 line-clamp-1">{brief.summary}</p>
                      {brief.relatedTicker && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-slate-600/50 text-amber-400">
                          ${brief.relatedTicker}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {generatedAt && (
          <p className="mt-3 text-[10px] text-gray-500 text-right">
            Generated: {new Date(generatedAt).toLocaleTimeString()}
          </p>
        )}

        {/* Empty state */}
        {!loaded && !loading && !error && (
          <p className="text-sm text-gray-500 text-center py-2">
            Click the button to generate your AI-powered market briefing
          </p>
        )}
      </div>
    </div>
  );
}
