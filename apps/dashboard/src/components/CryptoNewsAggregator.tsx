'use client';

import React, { useState } from 'react';
import { useCryptoCompareNews, useMessariNews } from '@/hooks/data-sources';

/**
 * Crypto News Aggregator Component
 *
 * Aggregates news from multiple sources:
 * - CryptoCompare News API
 * - Messari News API
 */
export function CryptoNewsAggregator() {
  const [source, setSource] = useState<'all' | 'cryptocompare' | 'messari'>('all');

  // Hook takes no arguments - categories would need to be added to the hook
  const { news: ccNews, isLoading: ccLoading } = useCryptoCompareNews();
  const { news: messariNews, isLoading: messariLoading } = useMessariNews(1, 20);

  const isLoading = ccLoading || messariLoading;

  // Normalize and combine news
  type NormalizedNews = {
    id: string;
    title: string;
    body: string;
    source: string;
    sourceApi: 'cryptocompare' | 'messari';
    url: string;
    imageUrl?: string;
    publishedAt: Date;
    categories: string[];
  };

  const normalizeNews = (): NormalizedNews[] => {
    const normalized: NormalizedNews[] = [];

    // Add CryptoCompare news
    if (source === 'all' || source === 'cryptocompare') {
      ccNews.forEach((item: {
        id: string;
        title: string;
        body: string;
        source: string;
        url: string;
        imageurl?: string;
        published_on: number;
        categories: string;
      }) => {
        normalized.push({
          id: `cc-${item.id}`,
          title: item.title,
          body: item.body,
          source: item.source,
          sourceApi: 'cryptocompare',
          url: item.url,
          imageUrl: item.imageurl,
          publishedAt: new Date(item.published_on * 1000),
          categories: item.categories?.split('|') || [],
        });
      });
    }

    // Add Messari news
    if (source === 'all' || source === 'messari') {
      messariNews.forEach((item: {
        id: string;
        title: string;
        content?: string;
        author?: { name: string };
        url: string;
        published_at: string;
        tags?: { name: string }[];
      }) => {
        normalized.push({
          id: `messari-${item.id}`,
          title: item.title,
          body: item.content || '',
          source: item.author?.name || 'Messari',
          sourceApi: 'messari',
          url: item.url,
          publishedAt: new Date(item.published_at),
          categories: item.tags?.map((t) => t.name) || [],
        });
      });
    }

    // Sort by date
    return normalized.sort(
      (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime()
    );
  };

  const allNews = normalizeNews();

  // Format relative time
  const formatRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg p-6 animate-pulse">
        <div className="h-8 bg-surface-alt rounded w-48 mb-6"></div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="w-24 h-16 bg-surface-alt rounded"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-surface-alt rounded w-3/4"></div>
                <div className="h-3 bg-surface-alt rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg border border-surface-border overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-surface-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <h2 className="text-xl font-bold text-text-primary">📰 Crypto News</h2>

          {/* Source Filter */}
          <div className="flex gap-1 bg-surface-alt rounded-lg p-1">
            {(['all', 'cryptocompare', 'messari'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSource(s)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  source === s
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <p className="text-text-muted text-sm mt-2">
          {allNews.length} articles from {source === 'all' ? 'all sources' : source}
        </p>
      </div>

      {/* News List */}
      <div className="divide-y divide-surface-border">
        {allNews.slice(0, 20).map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex gap-4 p-4 hover:bg-surface-alt/50 transition-colors"
          >
            {/* Image */}
            {item.imageUrl && (
              <div className="w-24 h-16 flex-shrink-0 bg-surface-alt rounded overflow-hidden">
                <img
                  src={item.imageUrl}
                  alt={item.title ? `Image for ${item.title.slice(0, 50)}` : 'News article thumbnail'}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className="text-text-primary font-medium line-clamp-2 hover:text-primary transition-colors">
                {item.title}
              </h3>
              <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
                <span
                  className={`px-1.5 py-0.5 rounded ${
                    item.sourceApi === 'cryptocompare'
                      ? 'bg-blue-500/20 text-blue-500'
                      : 'bg-purple-500/20 text-purple-500'
                  }`}
                >
                  {item.sourceApi}
                </span>
                <span>{item.source}</span>
                <span>•</span>
                <span>{formatRelativeTime(item.publishedAt)}</span>
              </div>
              {item.categories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.categories.slice(0, 3).map((cat, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 bg-surface-alt rounded text-xs text-text-muted"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </a>
        ))}
      </div>

      {/* Footer */}
      {allNews.length > 20 && (
        <div className="p-4 text-center border-t border-surface-border">
          <p className="text-text-muted text-sm">
            Showing 20 of {allNews.length} articles
          </p>
        </div>
      )}
    </div>
  );
}

export default CryptoNewsAggregator;
