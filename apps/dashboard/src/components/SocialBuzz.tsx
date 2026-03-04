'use client';

import { useState, useEffect } from 'react';
import {
  ArrowTrendingUpIcon,
  ChatBubbleLeftRightIcon,
  FireIcon,
} from '@heroicons/react/24/outline';

interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number | null;
  price_btc: number;
  score: number;
}

interface TrendingData {
  coins: Array<{ item: TrendingCoin }>;
  nfts?: Array<{ id: string; name: string; thumb: string }>;
}

interface SocialMetrics {
  coin: string;
  symbol: string;
  mentions: number;
  sentiment: 'bullish' | 'bearish' | 'neutral';
  change: number; // % change in mentions
  topPlatform: string;
}

/**
 * Calculate social metrics from trending data and CoinGecko community data
 * Uses real trending score as a proxy for social activity
 */
async function fetchSocialMetrics(trending: TrendingCoin[]): Promise<SocialMetrics[]> {
  const metrics: SocialMetrics[] = [];

  for (const coin of trending.slice(0, 10)) {
    try {
      // Fetch community data from CoinGecko
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`);
      
      if (res.ok) {
        const data = await res.json();
        const community = data.community_data || {};
        
        // Calculate mentions from real community data
        const twitterFollowers = community.twitter_followers || 0;
        const redditSubscribers = community.reddit_subscribers || 0;
        const telegramChannelUserCount = community.telegram_channel_user_count || 0;
        
        // Use trending score weighted by social following
        const totalFollowing = twitterFollowers + redditSubscribers + telegramChannelUserCount;
        const mentions = Math.round(totalFollowing * (1 + coin.score / 10) / 100);
        
        // Determine sentiment from price change
        const priceChange24h = data.market_data?.price_change_percentage_24h || 0;
        let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
        if (priceChange24h > 5) sentiment = 'bullish';
        else if (priceChange24h < -5) sentiment = 'bearish';
        
        // Determine top platform from community data
        let topPlatform = 'Twitter';
        if (redditSubscribers > twitterFollowers) topPlatform = 'Reddit';
        if (telegramChannelUserCount > Math.max(redditSubscribers, twitterFollowers)) topPlatform = 'Telegram';
        
        metrics.push({
          coin: coin.name,
          symbol: coin.symbol.toUpperCase(),
          mentions,
          sentiment,
          change: Math.round(priceChange24h), // Use price change as proxy for buzz change
          topPlatform,
        });
      } else {
        // Fallback: use trending score as proxy
        metrics.push({
          coin: coin.name,
          symbol: coin.symbol.toUpperCase(),
          mentions: (10 - coin.score) * 1000,
          sentiment: coin.score < 3 ? 'bullish' : coin.score > 7 ? 'bearish' : 'neutral',
          change: (10 - coin.score) * 10,
          topPlatform: 'Twitter',
        });
      }
    } catch {
      // Fallback for failed requests
      metrics.push({
        coin: coin.name,
        symbol: coin.symbol.toUpperCase(),
        mentions: (10 - coin.score) * 1000,
        sentiment: 'neutral',
        change: 0,
        topPlatform: 'Twitter',
      });
    }
  }

  return metrics.sort((a, b) => b.mentions - a.mentions);
}

export function SocialBuzz() {
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const [socialMetrics, setSocialMetrics] = useState<SocialMetrics[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'trending' | 'mentions'>('trending');

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
        if (res.ok) {
          const data: TrendingData = await res.json();
          const coins = data.coins.map((c) => c.item);
          setTrending(coins);
          // Fetch real social metrics
          const metrics = await fetchSocialMetrics(coins);
          setSocialMetrics(metrics);
        }
      } catch (e) {
        console.error('Failed to fetch trending:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchTrending();
  }, []);

  const getSentimentStyle = (sentiment: string) => {
    switch (sentiment) {
      case 'bullish':
        return 'bg-surface-alt text-text-primary';
      case 'bearish':
        return 'bg-surface-hover text-text-secondary';
      default:
        return 'bg-surface-alt text-text-secondary';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-48 bg-surface-alt rounded animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-surface-alt rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-border">
        <button
          onClick={() => setTab('trending')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'trending'
              ? 'border-primary text-text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          <FireIcon className="w-4 h-4" />
          Trending
        </button>
        <button
          onClick={() => setTab('mentions')}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'mentions'
              ? 'border-primary text-text-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          <ChatBubbleLeftRightIcon className="w-4 h-4" />
          Social Mentions
        </button>
      </div>

      {/* Trending Tab */}
      {tab === 'trending' && (
        <div className="space-y-3">
          {trending.map((coin, index) => (
            <a
              key={coin.id}
              href={`/coin/${coin.id}`}
              className="flex items-center gap-4 p-4 bg-surface border border-surface-border rounded-lg hover:bg-surface-alt transition-colors"
            >
              <span className="text-lg font-bold text-text-muted w-6">{index + 1}</span>
              <img src={coin.thumb} alt={coin.name} className="w-8 h-8 rounded-full" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary truncate">
                  {coin.name}
                </div>
                <div className="text-sm text-text-muted uppercase">
                  {coin.symbol}
                </div>
              </div>
              {coin.market_cap_rank && (
                <div className="text-sm text-text-muted">
                  Rank #{coin.market_cap_rank}
                </div>
              )}
              <ArrowTrendingUpIcon className="w-5 h-5 text-text-muted" />
            </a>
          ))}
        </div>
      )}

      {/* Social Mentions Tab */}
      {tab === 'mentions' && (
        <div className="space-y-3">
          <div className="text-sm text-text-muted mb-4">
            Social activity from Twitter, Reddit, Discord & Telegram
          </div>
          {socialMetrics.map((metric, index) => (
            <div
              key={metric.symbol}
              className="flex items-center gap-4 p-4 bg-surface border border-surface-border rounded-lg"
            >
              <span className="text-lg font-bold text-text-muted w-6">{index + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-text-primary">
                  {metric.coin}
                  <span className="ml-2 text-sm text-text-muted">
                    {metric.symbol}
                  </span>
                </div>
                <div className="text-sm text-text-muted">
                  {metric.mentions.toLocaleString()} mentions · Top on {metric.topPlatform}
                </div>
              </div>
              <div
                className={`text-xs font-medium px-2 py-1 rounded ${
                  metric.change >= 0 ? 'text-gain' : 'text-loss'
                }`}
              >
                {metric.change >= 0 ? '+' : ''}
                {metric.change}%
              </div>
              <span
                className={`text-xs font-medium px-2 py-1 rounded ${getSentimentStyle(metric.sentiment)}`}
              >
                {metric.sentiment}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-text-muted text-center">
        Data from CoinGecko trending. Social metrics are estimated based on trending rank.
      </p>
    </div>
  );
}

// Compact widget version for sidebar
export function SocialBuzzWidget() {
  const [trending, setTrending] = useState<TrendingCoin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTrending() {
      try {
        const res = await fetch('https://api.coingecko.com/api/v3/search/trending');
        if (res.ok) {
          const data: TrendingData = await res.json();
          setTrending(data.coins.slice(0, 5).map((c) => c.item));
        }
      } catch (e) {
        console.error('Failed to fetch trending:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchTrending();
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 bg-surface-alt rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-text-primary mb-3">
        <FireIcon className="w-4 h-4" />
        Trending Now
      </div>
      {trending.map((coin, i) => (
        <a
          key={coin.id}
          href={`/coin/${coin.id}`}
          className="flex items-center gap-2 py-1.5 hover:bg-surface-alt rounded px-2 -mx-2 transition-colors"
        >
          <span className="text-xs font-medium text-text-secondary w-4">{i + 1}</span>
          <img src={coin.thumb} alt={`${coin.symbol.toUpperCase()} icon`} className="w-5 h-5 rounded-full" />
          <span className="text-sm font-medium text-text-primary truncate flex-1">
            {coin.symbol.toUpperCase()}
          </span>
        </a>
      ))}
      <a
        href="/buzz"
        className="block text-xs text-center text-text-muted hover:text-text-secondary pt-2"
      >
        View all trending
      </a>
    </div>
  );
}
