'use client';

import React, { useState } from 'react';

interface Article {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  source: string;
  sourceKey: string;
  category: string;
  timeAgo: string;
}

interface ArticleContent {
  url: string;
  title: string;
  source: string;
  content: string;
  summary: string;
  keyPoints: string[];
  sentiment: 'bullish' | 'bearish' | 'neutral';
  fetchedAt: string;
}

interface ReaderContentProps {
  articles: Article[];
}

const sourceColors: Record<string, string> = {
  CoinDesk: 'bg-blue-100 text-blue-800 border-blue-200',
  'The Block': 'bg-purple-100 text-purple-800 border-purple-200',
  Decrypt: 'bg-green-100 text-green-800 border-green-200',
  CoinTelegraph: 'bg-orange-100 text-orange-800 border-orange-200',
  'Bitcoin Magazine': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  Blockworks: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  'The Defiant': 'bg-pink-100 text-pink-800 border-pink-200',
};

const sentimentConfig = {
  bullish: { emoji: '🟢', label: 'Bullish', color: 'text-green-600 bg-green-50' },
  bearish: { emoji: '🔴', label: 'Bearish', color: 'text-red-600 bg-red-50' },
  neutral: { emoji: '⚪', label: 'Neutral', color: 'text-text-secondary bg-surface-alt' },
};

function SourceFilter({
  sources,
  selected,
  onSelect,
}: {
  sources: string[];
  selected: string | null;
  onSelect: (source: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mb-6 justify-center">
      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition ${
          selected === null
            ? 'bg-background text-text-primary'
            : 'bg-surface text-text-secondary border hover:bg-surface-hover'
        }`}
      >
        All Sources
      </button>
      {sources.map((source) => (
        <button
          key={source}
          onClick={() => onSelect(source)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition ${
            selected === source
              ? 'bg-background text-text-primary'
              : `${sourceColors[source]?.split(' ')[0] || 'bg-surface-alt'} border hover:opacity-80`
          }`}
        >
          {source}
        </button>
      ))}
    </div>
  );
}

function ArticleCard({
  article,
  isExpanded,
  onToggle,
  content,
  isLoading,
}: {
  article: Article;
  isExpanded: boolean;
  onToggle: () => void;
  content: ArticleContent | null;
  isLoading: boolean;
}) {
  return (
    <div className="bg-surface rounded-xl border border-surface-border shadow-sm overflow-hidden transition-all">
      {/* Header - Always visible */}
      <div
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        role="button"
        tabIndex={0}
        className="p-5 cursor-pointer hover:bg-surface-hover transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500"
        aria-expanded={isExpanded}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs px-2 py-1 rounded-full border ${sourceColors[article.source] || 'bg-surface-alt text-text-primary'}`}>
                {article.source}
              </span>
              <span className="text-xs text-text-muted">{article.timeAgo}</span>
            </div>
            <h3 className="text-lg font-semibold text-text-primary leading-tight">
              {article.title}
            </h3>
            {article.description && !isExpanded && (
              <p className="text-text-secondary mt-2 text-sm line-clamp-2">{article.description}</p>
            )}
          </div>
          <button className="flex-shrink-0 mt-1">
            <svg
              className={`w-5 h-5 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-surface-border">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-surface-border border-t-background mb-3"></div>
              <p className="text-text-muted">Fetching full article content...</p>
            </div>
          ) : content ? (
            <div className="p-5 space-y-5">
              {/* Sentiment Badge */}
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${sentimentConfig[content.sentiment].color}`}
                >
                  {sentimentConfig[content.sentiment].emoji}
                  {sentimentConfig[content.sentiment].label} Sentiment
                </span>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <h4 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
                  <span>✨</span> AI Summary
                </h4>
                <p className="text-blue-800 leading-relaxed whitespace-pre-wrap">
                  {content.summary}
                </p>
              </div>

              {/* Key Points */}
              {content.keyPoints.length > 0 && (
                <div className="bg-surface-alt rounded-lg p-4 border border-surface-border">
                  <h4 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <span>📌</span> Key Takeaways
                  </h4>
                  <ul className="space-y-2">
                    {content.keyPoints.map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-text-secondary">
                        <span className="text-gain mt-0.5">✓</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Read Original */}
              <div className="pt-3 flex items-center justify-between">
                <span className="text-xs text-text-muted">
                  Analyzed at {new Date(content.fetchedAt).toLocaleTimeString()}
                </span>
                <a
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-background text-text-primary rounded-full text-sm font-medium hover:bg-surface-hover transition"
                >
                  Read Original Article
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </div>
            </div>
          ) : (
            <div className="p-5 text-center text-text-muted">
              <p>Failed to load article content.</p>
              <a
                href={article.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline mt-2 inline-block"
              >
                Read on {article.source} →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ReaderContent({ articles }: ReaderContentProps) {
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [articleContents, setArticleContents] = useState<Record<string, ArticleContent>>({});
  const [loadingArticle, setLoadingArticle] = useState<string | null>(null);

  // Get unique sources
  const sources = [...new Set(articles.map((a) => a.source))];

  // Filter articles
  const filteredArticles = selectedSource
    ? articles.filter((a) => a.source === selectedSource)
    : articles;

  const handleToggle = async (article: Article) => {
    const articleId = article.link;

    if (expandedId === articleId) {
      setExpandedId(null);
      return;
    }

    setExpandedId(articleId);

    // Fetch content if not cached
    if (!articleContents[articleId]) {
      setLoadingArticle(articleId);
      try {
        const params = new URLSearchParams({
          url: article.link,
          title: article.title,
          source: article.source,
        });
        const response = await fetch(`/api/article?${params}`);
        if (response.ok) {
          const content = await response.json();
          setArticleContents((prev) => ({ ...prev, [articleId]: content }));
        }
      } catch (error) {
        console.error('Failed to fetch article:', error);
      } finally {
        setLoadingArticle(null);
      }
    }
  };

  return (
    <div>
      <SourceFilter sources={sources} selected={selectedSource} onSelect={setSelectedSource} />

      <div className="space-y-4 max-w-4xl mx-auto">
        {filteredArticles.map((article) => (
          <ArticleCard
            key={article.link}
            article={article}
            isExpanded={expandedId === article.link}
            onToggle={() => handleToggle(article)}
            content={articleContents[article.link] || null}
            isLoading={loadingArticle === article.link}
          />
        ))}
      </div>

      {filteredArticles.length === 0 && (
        <div className="text-center py-12 text-text-muted">No articles found for this source.</div>
      )}
    </div>
  );
}
