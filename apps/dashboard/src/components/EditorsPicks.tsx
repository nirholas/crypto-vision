/**
 * Editor's Picks - Horizontal row of 3 medium article cards
 * Secondary featured section below the hero
 */
'use client';

import Link from 'next/link';
import { generateArticleId } from '@/lib/archive-v2';

interface Article {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  source: string;
  timeAgo: string;
}

interface EditorsPicksProps {
  articles: Article[];
}

const sourceColors: Record<string, { bg: string; light: string; text: string }> = {
  CoinDesk: { bg: 'bg-blue-600', light: 'bg-blue-50', text: 'text-blue-700' },
  'The Block': { bg: 'bg-purple-600', light: 'bg-purple-50', text: 'text-purple-700' },
  Decrypt: { bg: 'bg-emerald-600', light: 'bg-emerald-50', text: 'text-emerald-700' },
  CoinTelegraph: { bg: 'bg-orange-500', light: 'bg-orange-50', text: 'text-orange-700' },
  'Bitcoin Magazine': { bg: 'bg-amber-500', light: 'bg-amber-50', text: 'text-amber-700' },
  Blockworks: { bg: 'bg-indigo-600', light: 'bg-indigo-50', text: 'text-indigo-700' },
  'The Defiant': { bg: 'bg-pink-600', light: 'bg-pink-50', text: 'text-pink-700' },
};

const defaultStyle = { bg: 'bg-surface-hover', light: 'bg-surface', text: 'text-text-secondary' };

export default function EditorsPicks({ articles }: EditorsPicksProps) {
  // Take only first 3 articles
  const picks = articles.slice(0, 3);

  if (picks.length === 0) return null;

  return (
    <section className="py-12">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-primary rounded-full" />
          <h2 className="text-2xl md:text-3xl font-bold text-text-primary">Editor&apos;s Picks</h2>
        </div>
        <Link
          href="/trending"
          className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
        >
          See all trending
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {picks.map((article, index) => {
          const articleId = generateArticleId(article.link);
          const style = sourceColors[article.source] || defaultStyle;

          return (
            <article key={article.link} className="group">
              <Link href={`/article/${articleId}`} className="block h-full">
                <div className="relative h-full bg-surface rounded-2xl border border-surface-border overflow-hidden hover:shadow-xl hover:border-primary/30 hover:-translate-y-1 transition-all duration-300">
                  {/* Top accent bar */}
                  <div className={`h-1 ${style.bg}`} />

                  {/* Content */}
                  <div className="p-6">
                    {/* Number badge */}
                    <div className="flex items-start justify-between mb-4">
                      <span
                        className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full ${style.light} ${style.text}`}
                      >
                        {article.source}
                      </span>
                      <span className="text-4xl font-bold text-surface-border group-hover:text-primary/20 transition-colors">
                        0{index + 1}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-text-primary group-hover:text-primary transition-colors line-clamp-3 mb-3 leading-snug">
                      {article.title}
                    </h3>

                    {article.description && (
                      <p className="text-text-muted text-sm line-clamp-2 mb-4">
                        {article.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-4 border-t border-surface-border">
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
                </div>
              </Link>
            </article>
          );
        })}
      </div>
    </section>
  );
}
