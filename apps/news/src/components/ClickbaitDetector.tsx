'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ClickbaitResult {
  score: number;
  isClickbait: boolean;
  reasons: string[];
  rewrittenTitle?: string;
}

interface ClickbaitDetectorProps {
  title: string;
  source: string;
}

export function ClickbaitDetector({ title, source }: ClickbaitDetectorProps) {
  const [result, setResult] = useState<ClickbaitResult | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [fetched, setFetched] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);

  const fetchScore = useCallback(async () => {
    if (fetched) return;
    setFetched(true);
    try {
      const res = await fetch(`/api/clickbait?title=${encodeURIComponent(title)}&source=${encodeURIComponent(source)}`);
      if (!res.ok) return;
      const data = await res.json();
      setResult({
        score: Number(data.score || 0),
        isClickbait: Boolean(data.isClickbait),
        reasons: (data.reasons || []) as string[],
        rewrittenTitle: (data.rewrittenTitle as string) || undefined,
      });
    } catch { /* silent */ }
  }, [title, source, fetched]);

  // IntersectionObserver — only fetch when visible
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          fetchScore();
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchScore]);

  // Don't render anything for low scores
  if (!result || result.score < 30) {
    return <span ref={containerRef} className="inline" />;
  }

  const isHigh = result.score > 60;
  const icon = isHigh ? '🚩' : '⚠️';
  const level = isHigh ? 'High clickbait' : 'Moderate clickbait';

  return (
    <span
      ref={containerRef}
      className="relative inline-flex items-center ml-1"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      onFocus={() => setShowTooltip(true)}
      onBlur={() => setShowTooltip(false)}
      tabIndex={0}
      role="note"
      aria-label={`${level} detected. Score: ${result.score}`}
    >
      <span className="text-xs cursor-help">{icon}</span>

      {/* Custom tooltip */}
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-64 p-3 bg-gray-900 dark:bg-black text-white text-xs rounded-xl shadow-xl border border-gray-700 pointer-events-none">
          {/* Arrow */}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-black" />

          <div className="flex items-center gap-2 mb-1.5">
            <span>{icon}</span>
            <span className="font-semibold">{level}</span>
            <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold ${
              isHigh ? 'bg-red-600' : 'bg-yellow-600'
            }`}>
              {result.score}/100
            </span>
          </div>

          {result.reasons.length > 0 && (
            <ul className="space-y-0.5 mb-1.5 text-gray-300">
              {result.reasons.slice(0, 3).map((r, i) => (
                <li key={i} className="flex items-start gap-1">
                  <span className="mt-0.5 flex-shrink-0">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}

          {result.rewrittenTitle && (
            <div className="mt-1.5 pt-1.5 border-t border-gray-700">
              <span className="text-gray-400 text-[10px] uppercase font-semibold">Better title:</span>
              <p className="text-green-400 mt-0.5 leading-tight">{result.rewrittenTitle}</p>
            </div>
          )}
        </span>
      )}
    </span>
  );
}
