/**
 * @fileoverview News Card Component
 *
 * A versatile article card component with multiple display variants.
 * Used throughout the application for displaying news articles in
 * various layouts and contexts.
 *
 * @module components/NewsCard
 * @requires next/link
 * @requires @/lib/archive-v2
 * @requires @/lib/reading-time
 *
 * @example
 * // Default card (for grids)
 * <NewsCard article={article} />
 *
 * // Compact card (for sidebars)
 * <NewsCard article={article} variant="compact" priority={1} />
 *
 * // Horizontal card (for lists)
 * <NewsCard article={article} variant="horizontal" showDescription={true} />
 *
 * @variants
 * - `default` - Full card with border, shadow, and description
 * - `compact` - Minimal card with optional priority number
 * - `horizontal` - Wide card with left accent bar
 *
 * @features
 * - Source-specific color coding
 * - Reading time estimates
 * - Keyboard navigation support via `data-article` attribute
 * - Dark mode compatible
 * - Accessible focus states
 * - Smooth hover animations
 *
 * @see {@link ./cards/ArticleCardLarge} For premium featured cards
 */
'use client';

import Link from 'next/link';
import { generateArticleId } from '@/lib/archive-v2';
import { estimateReadingTime } from '@/lib/reading-time';

interface Article {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  source: string;
  timeAgo: string;
}

interface NewsCardProps {
  article: Article;
  variant?: 'default' | 'compact' | 'horizontal';
  showDescription?: boolean;
  priority?: number;
  /** Stagger index for animation delay (0-based) */
  staggerIndex?: number;
  /** Whether to animate on mount */
  animate?: boolean;
}

const sourceColors: Record<string, { bg: string; light: string; text: string; border: string }> = {
  CoinDesk: {
    bg: 'bg-blue-600',
    light: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  'The Block': {
    bg: 'bg-purple-600',
    light: 'bg-purple-50',
    text: 'text-purple-700',
    border: 'border-purple-200',
  },
  Decrypt: {
    bg: 'bg-emerald-600',
    light: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  CoinTelegraph: {
    bg: 'bg-orange-500',
    light: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  'Bitcoin Magazine': {
    bg: 'bg-amber-500',
    light: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  Blockworks: {
    bg: 'bg-indigo-600',
    light: 'bg-indigo-50',
    text: 'text-indigo-700',
    border: 'border-indigo-200',
  },
  'The Defiant': {
    bg: 'bg-pink-600',
    light: 'bg-pink-50',
    text: 'text-pink-700',
    border: 'border-pink-200',
  },
};

const defaultStyle = {
  bg: 'bg-surface-hover',
  light: 'bg-surface',
  text: 'text-text-secondary',
  border: 'border-surface-border',
};

export default function NewsCard({
  article,
  variant = 'default',
  showDescription = true,
  priority,
  staggerIndex,
  animate = false,
}: NewsCardProps) {
  const articleId = generateArticleId(article.link);
  const style = sourceColors[article.source] || defaultStyle;

  const readingTime = estimateReadingTime(article.title, article.description);

  // Animation styles for staggered entrance
  const animationStyle = animate && staggerIndex !== undefined
    ? {
        '--stagger-index': staggerIndex,
        animationDelay: `${staggerIndex * 50}ms`,
        animationFillMode: 'both' as const,
      }
    : {};

  const animationClass = animate ? 'animate-slide-up-fade' : '';

  if (variant === 'compact') {
    return (
      <article className={`group ${animationClass}`} style={animationStyle} data-article>
        <Link
          href={`/article/${articleId}`}
          className="flex items-start gap-4 p-4 rounded-xl hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          {priority && (
            <span className="flex-shrink-0 w-8 h-8 rounded-full bg-surface text-text-muted font-bold text-sm flex items-center justify-center group-hover:bg-primary/10 group-hover:text-primary transition-colors">
              {priority}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <span
              className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${style.light} ${style.text} mb-2`}
            >
              {article.source}
            </span>
            <h3 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors line-clamp-2 leading-snug">
              {article.title}
            </h3>
            <time className="text-xs text-text-muted mt-1 block" dateTime={article.pubDate}>
              {article.timeAgo}
            </time>
          </div>
        </Link>
      </article>
    );
  }

  if (variant === 'horizontal') {
    return (
      <article className={`group ${animationClass}`} style={animationStyle} data-article>
        <Link
          href={`/article/${articleId}`}
          className="flex gap-5 p-4 bg-surface rounded-xl border border-surface-border hover:border-primary/30 hover:shadow-lg transition-all focus:outline-none focus:ring-2 focus:ring-primary card-lift"
        >
          {/* Left accent */}
          <div className={`w-1 self-stretch ${style.bg} rounded-full flex-shrink-0`} />

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${style.light} ${style.text}`}
              >
                {article.source}
              </span>
              <time className="text-xs text-text-muted" dateTime={article.pubDate}>
                {article.timeAgo}
              </time>
            </div>
            <h3 className="text-base font-semibold text-text-primary group-hover:text-primary transition-colors line-clamp-2 leading-snug mb-2">
              {article.title}
            </h3>
            {showDescription && article.description && (
              <p className="text-sm text-text-muted line-clamp-2">{article.description}</p>
            )}
          </div>

          <svg
            className="w-5 h-5 text-text-muted group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0 self-center"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </article>
    );
  }

  // Default card style
  return (
    <article className={`group h-full ${animationClass}`} style={animationStyle} data-article>
      <Link
        href={`/article/${articleId}`}
        className="block h-full bg-surface rounded-2xl border border-surface-border overflow-hidden hover:shadow-xl hover:border-primary/30 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 card-lift card-shine"
      >
        <div className="p-5 h-full flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <span
              className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ring-1 ring-inset ${style.light} ${style.text} ${style.border}`}
            >
              {article.source}
            </span>
            <span className="text-xs text-text-muted flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {readingTime.text}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-base font-bold text-text-primary group-hover:text-primary transition-colors line-clamp-3 leading-snug mb-3 flex-grow">
            {article.title}
          </h3>

          {/* Description */}
          {showDescription && article.description && (
            <p className="text-sm text-text-muted line-clamp-2 mb-4">{article.description}</p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t border-surface-border mt-auto">
            <time className="text-xs text-text-muted" dateTime={article.pubDate}>
              {article.timeAgo}
            </time>
            <span className="text-primary text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              Read
              <svg
                className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
