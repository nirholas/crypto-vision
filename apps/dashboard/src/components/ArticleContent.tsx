'use client';

import { useState } from 'react';
import type { EnrichedArticle } from '@/lib/archive-v2';

interface ArticleContentProps {
  article: EnrichedArticle;
}

interface FetchedContent {
  url: string;
  title: string;
  source: string;
  content: string;
  summary: string;
  keyPoints: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  fetchedAt: string;
}

const sentimentEmoji = {
  bullish: '🟢',
  bearish: '🔴',
  neutral: '⚪',
};

export function ArticleContent({ article }: ArticleContentProps) {
  const [content, setContent] = useState<FetchedContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const fetchContent = async () => {
    if (content) {
      setExpanded(!expanded);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        url: article.link,
        title: article.title,
        source: article.source,
      });

      const response = await fetch(`/api/article?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch article content');
      }

      const data = await response.json();
      setContent(data);
      setExpanded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load content');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden">
      {/* Header */}
      <button
        onClick={fetchContent}
        disabled={loading}
        className="w-full p-6 text-left flex items-center justify-between hover:bg-surface-hover transition"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🤖</span>
          <div>
            <h2 className="font-bold text-lg">AI Summary & Analysis</h2>
            <p className="text-sm text-text-muted">
              {content ? 'Click to collapse' : 'Click to load full analysis'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && (
            <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          )}
          <svg
            className={`w-5 h-5 text-text-muted transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content */}
      {expanded && content && (
        <div className="border-t p-6 space-y-6">
          {/* Summary */}
          <div>
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span>📝</span> Summary
            </h3>
            <div className="text-text-secondary leading-relaxed whitespace-pre-line bg-surface p-4 rounded-xl">
              {content.summary}
            </div>
          </div>

          {/* Key Points */}
          {content.keyPoints && content.keyPoints.length > 0 && (
            <div>
              <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span>💡</span> Key Takeaways
              </h3>
              <ul className="space-y-2">
                {content.keyPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg">
                    <span className="text-primary font-bold mt-0.5">{index + 1}</span>
                    <span className="text-text-secondary">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Sentiment */}
          <div>
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <span>📊</span> AI Sentiment Analysis
            </h3>
            <div className="flex items-center gap-3 p-4 bg-surface rounded-xl">
              <span className="text-3xl">{sentimentEmoji[content.sentiment]}</span>
              <div>
                <div className="font-medium capitalize">{content.sentiment}</div>
                <div className="text-sm text-text-muted">Based on content analysis</div>
              </div>
            </div>
          </div>

          {/* Excerpt */}
          {content.content && (
            <div>
              <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <span>📄</span> Article Excerpt
              </h3>
              <div className="text-text-muted text-sm leading-relaxed bg-surface p-4 rounded-xl">
                {content.content.slice(0, 800)}
                {content.content.length > 800 && (
                  <span className="text-text-secondary">... <a href={article.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Read more</a></span>
                )}
              </div>
            </div>
          )}

          {/* Read full article CTA */}
          <div className="pt-4 border-t">
            <a
              href={article.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl font-medium hover:from-orange-600 hover:to-orange-700 transition shadow-lg shadow-orange-500/25"
            >
              Read Full Article on {article.source}
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
            <p className="text-xs text-text-muted mt-3">
              ⏱️ Analysis generated at {new Date(content.fetchedAt).toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border-t p-6">
          <div className="flex items-center gap-3 p-4 bg-red-50 text-red-700 rounded-xl">
            <span>⚠️</span>
            <div>
              <div className="font-medium">Failed to load content</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
          <a
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 text-primary hover:underline"
          >
            Read on {article.source} instead →
          </a>
        </div>
      )}
    </div>
  );
}
