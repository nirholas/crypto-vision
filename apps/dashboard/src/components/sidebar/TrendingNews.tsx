/**
 * Trending News Sidebar Widget
 * Displays numbered list of trending/hot stories
 */

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

interface TrendingNewsProps {
  articles: Article[];
  title?: string;
  showRefreshIndicator?: boolean;
}

const sourceColors: Record<string, string> = {
  CoinDesk: 'bg-blue-500',
  'The Block': 'bg-purple-500',
  Decrypt: 'bg-emerald-500',
  CoinTelegraph: 'bg-orange-500',
  'Bitcoin Magazine': 'bg-amber-500',
  Blockworks: 'bg-indigo-500',
  'The Defiant': 'bg-pink-500',
};

export default function TrendingNews({
  articles,
  title = 'Trending Now',
  showRefreshIndicator = true,
}: TrendingNewsProps) {
  const trendingArticles = articles.slice(0, 5);

  return (
    <div className="bg-surface rounded-2xl shadow-sm border border-surface-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
          <span className="text-xl" aria-hidden="true">
            🔥
          </span>
          {title}
        </h3>
        {showRefreshIndicator && (
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Live
          </div>
        )}
      </div>

      {/* Trending List */}
      <div className="space-y-1" role="list" aria-label="Trending news articles">
        {trendingArticles.map((article, index) => {
          const articleId = article.id || generateArticleId(article.link);
          const sourceColor = sourceColors[article.source] || 'bg-surface-hover';

          return (
            <Link
              key={articleId}
              href={`/article/${articleId}`}
              className="group flex items-start gap-3 p-3 -mx-3 rounded-xl hover:bg-surface-hover transition-colors focus-ring"
              role="listitem"
            >
              {/* Rank Number */}
              <span
                className={`
                  flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-sm font-bold
                  ${index < 3 ? 'bg-primary text-black' : 'bg-surface text-text-muted'}
                `}
              >
                {index + 1}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-text-primary line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                  {article.title}
                </h4>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${sourceColor}`} aria-hidden="true" />
                  <span className="text-xs text-text-muted truncate">{article.source}</span>
                  <span className="text-surface-border" aria-hidden="true">
                    •
                  </span>
                  <time className="text-xs text-text-muted" dateTime={article.pubDate}>
                    {article.timeAgo}
                  </time>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* See All Link */}
      <Link
        href="/trending"
        className="mt-4 pt-4 border-t border-surface-border flex items-center justify-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors focus-ring rounded-lg py-2 -mx-2"
      >
        See all trending
        <svg
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
