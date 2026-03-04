/**
 * Popular Stories Sidebar Widget
 * Shows most read articles with view count estimates and time filter
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { generateArticleId } from '@/lib/archive-v2';

interface Article {
  title: string;
  link: string;
  source: string;
  pubDate: string;
  timeAgo: string;
  id?: string;
}

interface PopularStoriesProps {
  articles: Article[];
}

type TimeFilter = '24h' | '7d';

const sourceColors: Record<string, string> = {
  CoinDesk: 'from-blue-500 to-blue-600',
  'The Block': 'from-purple-500 to-purple-600',
  Decrypt: 'from-emerald-500 to-emerald-600',
  CoinTelegraph: 'from-orange-500 to-orange-600',
  'Bitcoin Magazine': 'from-amber-500 to-amber-600',
  Blockworks: 'from-indigo-500 to-indigo-600',
  'The Defiant': 'from-pink-500 to-pink-600',
};

// Display rank indicator based on position
function getRankDisplay(index: number): string {
  return `#${index + 1}`;
}

export default function PopularStories({ articles }: PopularStoriesProps) {
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('24h');
  const popularArticles = articles.slice(0, 5);

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-surface-border p-6">
      {/* Header with Filter */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">
            📈
          </span>
          Most Read
        </h3>

        {/* Time Filter Toggle */}
        <div className="flex items-center bg-surface-hover rounded-lg p-0.5">
          <button
            onClick={() => setTimeFilter('24h')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              timeFilter === '24h'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            aria-pressed={timeFilter === '24h'}
          >
            24h
          </button>
          <button
            onClick={() => setTimeFilter('7d')}
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all ${
              timeFilter === '7d'
                ? 'bg-surface text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
            aria-pressed={timeFilter === '7d'}
          >
            7d
          </button>
        </div>
      </div>

      {/* Popular Articles List */}
      <div className="space-y-3" role="list" aria-label="Most read articles">
        {popularArticles.map((article, index) => {
          const articleId = article.id || generateArticleId(article.link);
          const gradient = sourceColors[article.source] || 'from-surface-hover to-surface-alt';
          const rank = getRankDisplay(index);

          return (
            <Link
              key={articleId}
              href={`/article/${articleId}`}
              className="group flex gap-3 p-2 -mx-2 rounded-xl hover:bg-surface-hover transition-colors focus-ring"
              role="listitem"
            >
              {/* Gradient Thumbnail Placeholder */}
              <div
                className={`flex-shrink-0 w-16 h-16 rounded-xl bg-gradient-to-br ${gradient} relative overflow-hidden`}
                aria-hidden="true"
              >
                {/* Decorative pattern */}
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-1 right-1 w-6 h-6 border border-white/30 rounded-full" />
                  <div className="absolute bottom-2 left-1 w-3 h-3 bg-white/20 rounded-full" />
                </div>
                {/* Rank indicator overlay */}
                <div className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-sm rounded px-1.5 py-0.5">
                  <span className="text-[10px] font-bold text-white">
                    {rank}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 py-0.5">
                <h4 className="text-sm font-medium text-text-primary line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                  {article.title}
                </h4>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-xs text-text-muted">{article.source}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
