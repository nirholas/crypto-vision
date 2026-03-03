/**
 * Trending Sidebar - Right column with trending, categories, and market data
 * Sticky sidebar for desktop views
 */

import Link from 'next/link';
import { categories } from '@/lib/categories';
import MarketStats from '@/components/MarketStats';
import NewsCard from '@/components/NewsCard';
import { NewsletterSignup } from '@/components/sidebar';
import { Folder, Rocket, Code } from 'lucide-react';
import { CATEGORY_ICONS, getCategoryIcon } from '@/lib/category-icons';
import type { EnrichedArticle } from '@/lib/archive-v2';

interface Article {
  title: string;
  link: string;
  description?: string;
  pubDate: string;
  source: string;
  timeAgo: string;
}

interface TrendingSidebarProps {
  trendingArticles: EnrichedArticle[] | Article[];
}

// Helper to convert EnrichedArticle to Article format
function toArticle(item: EnrichedArticle | Article): Article {
  if ('pub_date' in item) {
    // It's an EnrichedArticle
    const date = new Date(item.pub_date || item.first_seen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    let timeAgo = 'just now';
    if (diffDays > 0) timeAgo = `${diffDays}d ago`;
    else if (diffHours > 0) timeAgo = `${diffHours}h ago`;
    else if (diffMins > 0) timeAgo = `${diffMins}m ago`;
    
    return {
      title: item.title,
      link: item.link,
      description: item.description,
      pubDate: item.pub_date || item.first_seen,
      source: item.source,
      timeAgo,
    };
  }
  return item as Article;
}

export default function TrendingSidebar({ trendingArticles }: TrendingSidebarProps) {
  const articles = trendingArticles.map(toArticle);
  const topTrending = articles.slice(0, 5);
  const featuredCategories = categories.slice(0, 6);

  return (
    <aside className="space-y-8 lg:sticky lg:top-4">
      {/* Trending Stories */}
      <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-surface-border bg-surface/50">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <h3 className="font-bold text-text-primary">Trending Now</h3>
          </div>
        </div>
        <div className="divide-y divide-surface-border">
          {topTrending.map((article, index) => (
            <NewsCard key={article.link} article={article} variant="compact" priority={index + 1} />
          ))}
        </div>
        <div className="px-5 py-3 border-t border-surface-border">
          <Link
            href="/trending"
            className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1"
          >
            View All Trending
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>

      {/* Market Stats */}
      <MarketStats />

      {/* Categories */}
      <div className="bg-surface rounded-2xl border border-surface-border overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-surface-border bg-surface/50">
          <h3 className="font-bold text-text-primary flex items-center gap-2">
            <Folder className="w-4 h-4" />
            Categories
          </h3>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {featuredCategories.map((cat) => {
              const CategoryIcon = getCategoryIcon(cat.slug);
              return (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-surface hover:bg-surface-hover text-text-secondary hover:text-text-primary transition-colors ${cat.color}`}
                >
                  <CategoryIcon className="w-4 h-4" />
                  {cat.name}
                </Link>
              );
            })}
          </div>
          <Link
            href="/topics"
            className="mt-3 text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center justify-center gap-1"
          >
            All Topics →
          </Link>
        </div>
      </div>

      {/* API Promo */}
      <div className="bg-gradient-to-br from-background via-surface-hover to-background rounded-2xl p-6 text-text-primary shadow-xl overflow-hidden relative">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/30 rounded-full blur-3xl" />
        <div className="absolute -bottom-10 -left-10 w-24 h-24 bg-purple-500/20 rounded-full blur-2xl" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-3">
            <Rocket className="w-6 h-6" />
            <h3 className="font-bold text-lg">Free API</h3>
          </div>
          <p className="text-white/70 text-sm mb-4">
            No API keys required. No rate limits. Build your own crypto news app.
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/about"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-surface text-text-primary rounded-lg text-sm font-semibold hover:bg-surface-hover transition-colors"
            >
              Learn More
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
            <Link
              href="/examples"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white/10 text-white rounded-lg text-sm font-semibold hover:bg-white/20 transition-colors"
            >
              <Code className="w-4 h-4" />
              Code Examples
            </Link>
          </div>
        </div>
      </div>

      {/* Newsletter Signup - using new sidebar component */}
      <NewsletterSignup />
    </aside>
  );
}
