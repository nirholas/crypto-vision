'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, ExternalLink, RefreshCw } from 'lucide-react';

interface SourceData {
  name: string;
  slug: string;
  articles24h: number;
  articlesWeek: number;
  sentiment: number;
  topCategories: string[];
  lastUpdated: Date;
}

const SOURCES = [
  { name: 'CoinDesk', slug: 'coindesk' },
  { name: 'CoinTelegraph', slug: 'cointelegraph' },
  { name: 'The Block', slug: 'theblock' },
  { name: 'Decrypt', slug: 'decrypt' },
  { name: 'Bitcoin Magazine', slug: 'bitcoinmagazine' },
  { name: 'CryptoSlate', slug: 'cryptoslate' },
  { name: 'BeInCrypto', slug: 'beincrypto' },
  { name: 'CryptoPotato', slug: 'cryptopotato' },
];

export function SourceComparison() {
  const [sources, setSources] = useState<SourceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'articles24h' | 'articlesWeek' | 'sentiment'>('articles24h');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchSourceData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch real article counts from our API for each source
      const sourceDataPromises = SOURCES.map(async (source) => {
        try {
          // Fetch articles from our API filtered by source
          const [todayRes, weekRes] = await Promise.all([
            fetch(`/api/news?source=${source.slug}&limit=100`),
            fetch(`/api/news?source=${source.slug}&limit=200`),
          ]);

          const todayData = todayRes.ok ? await todayRes.json() : { articles: [] };
          const weekData = weekRes.ok ? await weekRes.json() : { articles: [] };

          // Count articles from last 24h and last week
          const now = Date.now();
          const dayAgo = now - 24 * 60 * 60 * 1000;
          const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

          const articles24h = (todayData.articles || []).filter(
            (a: { pubDate: string }) => new Date(a.pubDate).getTime() > dayAgo
          ).length;

          const articlesWeek = (weekData.articles || []).filter(
            (a: { pubDate: string }) => new Date(a.pubDate).getTime() > weekAgo
          ).length;

          // Extract top categories from articles
          const categories: Record<string, number> = {};
          for (const article of weekData.articles || []) {
            const cat = article.category || 'General';
            categories[cat] = (categories[cat] || 0) + 1;
          }
          const topCategories = Object.entries(categories)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([cat]) => cat);

          // Calculate sentiment from recent articles (if sentiment data available)
          let sentiment = 0;
          const articlesWithSentiment = (todayData.articles || []).filter(
            (a: { sentiment?: number }) => typeof a.sentiment === 'number'
          );
          if (articlesWithSentiment.length > 0) {
            sentiment = articlesWithSentiment.reduce(
              (sum: number, a: { sentiment: number }) => sum + a.sentiment, 0
            ) / articlesWithSentiment.length;
          }

          return {
            ...source,
            articles24h,
            articlesWeek,
            sentiment: Math.round(sentiment),
            topCategories: topCategories.length > 0 ? topCategories : ['General'],
            lastUpdated: new Date(),
          };
        } catch {
          // Return default data if fetch fails
          return {
            ...source,
            articles24h: 0,
            articlesWeek: 0,
            sentiment: 0,
            topCategories: ['General'],
            lastUpdated: new Date(),
          };
        }
      });

      const sourceData = await Promise.all(sourceDataPromises);
      setSources(sourceData);
    } catch (error) {
      console.error('Failed to fetch source data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSourceData();
  }, [fetchSourceData]);

  const sortedSources = [...sources].sort((a, b) => {
    const multiplier = sortOrder === 'desc' ? -1 : 1;
    return (a[sortBy] - b[sortBy]) * multiplier;
  });

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const getSentimentColor = (sentiment: number) => {
    if (sentiment > 20) return 'text-green-500';
    if (sentiment < -20) return 'text-red-500';
    return 'text-amber-500';
  };

  const getSentimentIcon = (sentiment: number) => {
    if (sentiment > 0) return <TrendingUp className="w-4 h-4" />;
    if (sentiment < 0) return <TrendingDown className="w-4 h-4" />;
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-surface rounded w-48" />
        <div className="h-64 bg-surface rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-amber-500" />
          Source Comparison
        </h2>
        <button
          onClick={fetchSourceData}
          className="p-2 text-text-muted hover:text-text-secondary hover:bg-surface-hover rounded-lg"
          title="Refresh data"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-border bg-surface-hover">
                <th className="text-left px-4 py-3 text-sm font-medium text-text-muted">Source</th>
                <th
                  className="text-right px-4 py-3 text-sm font-medium text-text-muted cursor-pointer hover:text-text-secondary"
                  onClick={() => handleSort('articles24h')}
                >
                  <span className="flex items-center justify-end gap-1">
                    24h Articles
                    {sortBy === 'articles24h' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </span>
                </th>
                <th
                  className="text-right px-4 py-3 text-sm font-medium text-text-muted cursor-pointer hover:text-text-secondary"
                  onClick={() => handleSort('articlesWeek')}
                >
                  <span className="flex items-center justify-end gap-1">
                    7d Articles
                    {sortBy === 'articlesWeek' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </span>
                </th>
                <th
                  className="text-right px-4 py-3 text-sm font-medium text-text-muted cursor-pointer hover:text-text-secondary"
                  onClick={() => handleSort('sentiment')}
                >
                  <span className="flex items-center justify-end gap-1">
                    Sentiment
                    {sortBy === 'sentiment' && (sortOrder === 'desc' ? '↓' : '↑')}
                  </span>
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-text-muted">
                  Top Categories
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-text-muted"></th>
              </tr>
            </thead>
            <tbody>
              {sortedSources.map((source, index) => (
                <tr
                  key={source.slug}
                  className={`border-b border-surface-border hover:bg-surface-hover ${
                    index === 0 ? 'bg-warning/10' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <span className="text-xs font-medium text-warning bg-warning/20 px-1.5 py-0.5 rounded">
                          #1
                        </span>
                      )}
                      <span className="font-medium">{source.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{source.articles24h}</td>
                  <td className="px-4 py-3 text-right font-mono">{source.articlesWeek}</td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`flex items-center justify-end gap-1 ${getSentimentColor(source.sentiment)}`}
                    >
                      {getSentimentIcon(source.sentiment)}
                      <span className="font-mono">
                        {source.sentiment > 0 ? '+' : ''}
                        {source.sentiment}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {source.topCategories.map((category) => (
                        <span
                          key={category}
                          className="text-xs px-2 py-0.5 bg-surface rounded-full"
                        >
                          {category}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/source/${source.slug}`}
                      className="p-1.5 text-text-muted hover:text-amber-500 inline-block"
                      title={`View ${source.name} articles`}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Comparison */}
      <div className="bg-surface rounded-xl p-6 border border-surface-border">
        <h3 className="text-sm font-medium text-text-muted mb-4">24h Article Volume</h3>
        <div className="space-y-3">
          {sortedSources.map((source) => {
            const maxArticles = Math.max(...sources.map((s) => s.articles24h));
            const percentage = (source.articles24h / maxArticles) * 100;

            return (
              <div key={source.slug} className="flex items-center gap-3">
                <span className="w-32 text-sm truncate">{source.name}</span>
                <div className="flex-1 h-6 bg-surface-hover rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all flex items-center justify-end pr-2"
                    style={{ width: `${percentage}%` }}
                  >
                    <span className="text-xs font-medium text-white">{source.articles24h}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
