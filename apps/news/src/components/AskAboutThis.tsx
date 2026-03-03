'use client';

import { useState, useRef, useCallback } from 'react';

interface Source {
  title: string;
  url: string;
}

interface QAEntry {
  question: string;
  answer: string;
  confidence: number;
  sources: Source[];
  followUpQuestions: string[];
}

interface AskAboutThisProps {
  context: string;
  contextType: 'article' | 'coin' | 'general';
  placeholder?: string;
}

export function AskAboutThis({ context, contextType, placeholder }: AskAboutThisProps) {
  const [entries, setEntries] = useState<QAEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [revealedChars, setRevealedChars] = useState<Record<number, number>>({});

  const typeReveal = useCallback((index: number, text: string) => {
    let pos = 0;
    const interval = setInterval(() => {
      pos += 3; // reveal 3 chars at a time for speed
      if (pos >= text.length) {
        pos = text.length;
        clearInterval(interval);
      }
      setRevealedChars(prev => ({ ...prev, [index]: pos }));
    }, 15);
    return () => clearInterval(interval);
  }, []);

  const ask = async (question: string) => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError(null);
    setInput('');

    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim(), context, contextType }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      const entry: QAEntry = {
        question: question.trim(),
        answer: (data.answer as string) || 'No answer available.',
        confidence: Number(data.confidence || 0),
        sources: ((data.sources || []) as Record<string, string>[]).map(s => ({
          title: s.title || 'Source',
          url: s.url || '#',
        })),
        followUpQuestions: ((data.followUpQuestions || data.followUp || []) as string[]).slice(0, 3),
      };

      const newEntries = [entry, ...entries].slice(0, 3);
      setEntries(newEntries);

      // Trigger type reveal for the new answer
      typeReveal(0, entry.answer);
      // Shift revealed chars for older entries
      setRevealedChars(prev => {
        const shifted: Record<number, number> = { 0: 0 };
        for (const [k, v] of Object.entries(prev)) {
          shifted[Number(k) + 1] = v;
        }
        return shifted;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get answer');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    ask(input);
  };

  const handleFollowUp = (q: string) => {
    ask(q);
  };

  const handleClear = () => {
    setEntries([]);
    setRevealedChars({});
    setError(null);
    inputRef.current?.focus();
  };

  const confidenceColor = (c: number) =>
    c > 0.8 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
    : c > 0.5 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-b border-gray-100 dark:border-slate-700">
        <span className="text-lg flex-shrink-0">❓</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={placeholder || 'Ask AI a question...'}
          className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-500 text-black hover:bg-brand-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          {loading ? (
            <span className="inline-flex items-center gap-1">
              <span className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Thinking
            </span>
          ) : 'Ask'}
        </button>
        {entries.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition"
          >
            Clear
          </button>
        )}
      </form>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs">
          ⚠️ {error}
        </div>
      )}

      {/* Q&A entries */}
      {entries.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {entries.map((entry, i) => {
            const revealed = revealedChars[i] ?? entry.answer.length;
            const displayedAnswer = entry.answer.slice(0, revealed);
            const isRevealing = revealed < entry.answer.length;

            return (
              <div key={i} className={`p-4 ${i > 0 ? 'opacity-70' : ''}`}>
                {/* Question */}
                <div className="flex items-start gap-2 mb-2">
                  <span className="text-xs font-bold text-brand-600 dark:text-amber-400 mt-0.5">Q:</span>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{entry.question}</p>
                </div>

                {/* Answer with type reveal */}
                <div className="flex items-start gap-2 mb-3">
                  <span className="text-xs font-bold text-gray-400 dark:text-slate-500 mt-0.5">A:</span>
                  <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
                    {displayedAnswer}
                    {isRevealing && <span className="animate-pulse">▌</span>}
                  </p>
                </div>

                {/* Meta row */}
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  {/* Confidence */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${confidenceColor(entry.confidence)}`}>
                    {Math.round(entry.confidence * 100)}% confidence
                  </span>
                  {/* Sources */}
                  {entry.sources.map((src, j) => (
                    <a
                      key={j}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition"
                    >
                      📎 {src.title}
                    </a>
                  ))}
                </div>

                {/* Follow-up questions */}
                {i === 0 && entry.followUpQuestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {entry.followUpQuestions.map((fq, j) => (
                      <button
                        key={j}
                        onClick={() => handleFollowUp(fq)}
                        disabled={loading}
                        className="px-2.5 py-1 rounded-lg text-xs bg-gray-50 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-600 transition border border-gray-200 dark:border-slate-600"
                      >
                        {fq}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
