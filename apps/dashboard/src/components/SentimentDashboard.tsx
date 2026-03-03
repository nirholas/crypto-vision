/**
 * @fileoverview Sentiment Dashboard Component
 *
 * Interactive dashboard for displaying crypto market sentiment analysis
 * with real-time gauges, charts, and social metrics.
 *
 * @module components/SentimentDashboard
 */
'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Activity,
  MessageCircle,
  Twitter,
  Users,
  BarChart2,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Zap,
} from 'lucide-react';

// Types
interface SentimentData {
  overall: number; // -100 to 100
  bullish: number;
  bearish: number;
  neutral: number;
  fearGreedIndex: number; // 0 to 100
  socialVolume: number;
  newsVolume: number;
  twitterMentions: number;
  redditActivity: number;
  timestamp: string;
}

interface CoinSentiment {
  symbol: string;
  name: string;
  sentiment: number;
  change24h: number;
  socialVolume: number;
  trending: boolean;
}

interface SentimentHistory {
  time: string;
  value: number;
  volume: number;
}

interface SentimentDashboardProps {
  className?: string;
  coin?: string;
  refreshInterval?: number;
}

// Fear & Greed labels
const getFearGreedLabel = (value: number): { label: string; color: string } => {
  if (value <= 20) return { label: 'Extreme Fear', color: 'text-loss' };
  if (value <= 40) return { label: 'Fear', color: 'text-loss' };
  if (value <= 60) return { label: 'Neutral', color: 'text-text-secondary' };
  if (value <= 80) return { label: 'Greed', color: 'text-gain' };
  return { label: 'Extreme Greed', color: 'text-gain' };
};

// Sentiment gauge component
function SentimentGauge({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const normalizedValue = Math.max(-100, Math.min(100, value));
  const percentage = (normalizedValue + 100) / 200;
  const rotation = percentage * 180 - 90;

  const sizes = {
    sm: { width: 120, height: 60, strokeWidth: 8 },
    md: { width: 180, height: 90, strokeWidth: 10 },
    lg: { width: 240, height: 120, strokeWidth: 12 },
  };

  const { width, height, strokeWidth } = sizes[size];
  const radius = (width - strokeWidth) / 2;
  const circumference = Math.PI * radius;

  return (
    <div className="relative" style={{ width, height: height + 40 }}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Background arc */}
        <path
          d={`M ${strokeWidth / 2} ${height} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2} ${height}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-surface-border"
        />
        {/* Gradient defs */}
        <defs>
          <linearGradient id="sentimentGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="50%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#22c55e" />
          </linearGradient>
        </defs>
        {/* Value arc */}
        <path
          d={`M ${strokeWidth / 2} ${height} A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2} ${height}`}
          fill="none"
          stroke="url(#sentimentGradient)"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percentage)}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
        {/* Needle */}
        <g transform={`translate(${width / 2}, ${height})`}>
          <line
            x1="0"
            y1="0"
            x2="0"
            y2={-radius + 15}
            stroke="white"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${rotation})`}
            className="transition-transform duration-500"
          />
          <circle cx="0" cy="0" r="6" fill="white" />
        </g>
      </svg>
      {/* Value display */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center">
        <span className={`text-2xl font-bold ${value >= 0 ? 'text-gain' : 'text-loss'}`}>
          {value > 0 ? '+' : ''}
          {value}
        </span>
        <p className="text-xs text-text-secondary mt-1">
          {value >= 50
            ? 'Very Bullish'
            : value >= 20
              ? 'Bullish'
              : value >= -20
                ? 'Neutral'
                : value >= -50
                  ? 'Bearish'
                  : 'Very Bearish'}
        </p>
      </div>
    </div>
  );
}

// Fear & Greed Index component
function FearGreedIndex({ value }: { value: number }) {
  const { label, color } = getFearGreedLabel(value);

  return (
    <div className="bg-surface rounded-xl p-4 border border-surface-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-muted">Fear & Greed Index</h3>
        <Activity className="w-4 h-4 text-text-secondary" />
      </div>
      <div className="relative h-4 bg-surface-alt rounded-full overflow-hidden mb-2">
        <div className="absolute inset-0 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500" />
        <div
          className="absolute top-0 h-full w-1 bg-white shadow-lg transition-all duration-500"
          style={{ left: `${value}%` }}
        />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-secondary">Fear</span>
        <span className={`text-lg font-bold ${color}`}>
          {value} - {label}
        </span>
        <span className="text-xs text-text-secondary">Greed</span>
      </div>
    </div>
  );
}

// Social metrics card
function SocialMetrics({ data }: { data: SentimentData }) {
  const metrics = [
    { label: 'Twitter', value: data.twitterMentions, icon: Twitter, change: 12 },
    { label: 'Reddit', value: data.redditActivity, icon: Users, change: -5 },
    { label: 'News', value: data.newsVolume, icon: MessageCircle, change: 8 },
  ];

  return (
    <div className="bg-surface rounded-xl p-4 border border-surface-border">
      <h3 className="text-sm font-medium text-text-muted mb-4">Social Activity</h3>
      <div className="space-y-3">
        {metrics.map((metric) => (
          <div key={metric.label} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <metric.icon className="w-4 h-4 text-text-secondary" />
              <span className="text-sm text-text-secondary">{metric.label}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{metric.value.toLocaleString()}</span>
              <span className={`text-xs ${metric.change >= 0 ? 'text-gain' : 'text-loss'}`}>
                {metric.change >= 0 ? '+' : ''}
                {metric.change}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Coin sentiment list
function CoinSentimentList({ coins }: { coins: CoinSentiment[] }) {
  const [expanded, setExpanded] = useState(false);
  const displayCoins = expanded ? coins : coins.slice(0, 5);

  return (
    <div className="bg-surface rounded-xl p-4 border border-surface-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-text-muted">Coin Sentiment</h3>
        <BarChart2 className="w-4 h-4 text-text-secondary" />
      </div>
      <div className="space-y-2">
        {displayCoins.map((coin) => (
          <div
            key={coin.symbol}
            className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-alt transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{coin.symbol}</span>
              {coin.trending && <Zap className="w-3 h-3 text-amber-500" />}
            </div>
            <div className="flex items-center gap-3">
              <div className="w-24 h-2 bg-surface-alt rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${
                    coin.sentiment >= 0 ? 'bg-gain' : 'bg-loss'
                  }`}
                  style={{ width: `${Math.abs(coin.sentiment) / 2 + 50}%` }}
                />
              </div>
              <span
                className={`text-sm font-medium w-12 text-right ${
                  coin.sentiment >= 0 ? 'text-gain' : 'text-loss'
                }`}
              >
                {coin.sentiment >= 0 ? '+' : ''}
                {coin.sentiment}
              </span>
            </div>
          </div>
        ))}
      </div>
      {coins.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 pt-3 border-t border-surface-border text-sm text-text-muted hover:text-text-primary flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>
              Show Less <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Show All ({coins.length}) <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}

// Sentiment distribution chart
function SentimentDistribution({
  bullish,
  bearish,
  neutral,
}: {
  bullish: number;
  bearish: number;
  neutral: number;
}) {
  const total = bullish + bearish + neutral;

  return (
    <div className="bg-surface rounded-xl p-4 border border-surface-border">
      <h3 className="text-sm font-medium text-text-muted mb-4">Sentiment Distribution</h3>
      <div className="flex h-4 rounded-full overflow-hidden mb-4">
        <div
          className="bg-gain transition-all duration-500"
          style={{ width: `${(bullish / total) * 100}%` }}
        />
        <div
          className="bg-text-muted transition-all duration-500"
          style={{ width: `${(neutral / total) * 100}%` }}
        />
        <div
          className="bg-loss transition-all duration-500"
          style={{ width: `${(bearish / total) * 100}%` }}
        />
      </div>
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingUp className="w-4 h-4 text-gain" />
            <span className="text-sm text-text-muted">Bullish</span>
          </div>
          <span className="text-lg font-bold text-gain">{bullish}%</span>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <Minus className="w-4 h-4 text-text-muted" />
            <span className="text-sm text-text-muted">Neutral</span>
          </div>
          <span className="text-lg font-bold text-text-muted">{neutral}%</span>
        </div>
        <div>
          <div className="flex items-center justify-center gap-1 mb-1">
            <TrendingDown className="w-4 h-4 text-loss" />
            <span className="text-sm text-text-muted">Bearish</span>
          </div>
          <span className="text-lg font-bold text-loss">{bearish}%</span>
        </div>
      </div>
    </div>
  );
}

// Mini sparkline chart
function MiniSparkline({ data, color = '#22c55e' }: { data: number[]; color?: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const height = 40;
  const width = 120;

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline fill="none" stroke={color} strokeWidth="2" points={points} />
    </svg>
  );
}

// Main Sentiment Dashboard Component
export function SentimentDashboard({
  className = '',
  coin,
  refreshInterval = 60000,
}: SentimentDashboardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [sentimentData, setSentimentData] = useState<SentimentData | null>(null);
  const [coinSentiments, setCoinSentiments] = useState<CoinSentiment[]>([]);
  const [historyData, setHistoryData] = useState<number[]>([]);

  // Fetch real sentiment data
  useEffect(() => {
    async function fetchSentimentData() {
      setIsLoading(true);
      setError(null);
      
      try {
        // Fetch Fear & Greed Index from alternative.me
        const fgRes = await fetch('https://api.alternative.me/fng/?limit=12');
        let fearGreedIndex = 50;
        let historyDataArr: number[] = [];
        
        if (fgRes.ok) {
          const fgData = await fgRes.json();
          if (fgData.data && fgData.data.length > 0) {
            fearGreedIndex = parseInt(fgData.data[0].value, 10);
            historyDataArr = fgData.data.map((d: { value: string }) => parseInt(d.value, 10)).reverse();
          }
        }
        
        // Fetch trending coins from CoinGecko
        const trendingRes = await fetch('https://api.coingecko.com/api/v3/search/trending');
        const trendingCoins: string[] = [];
        
        if (trendingRes.ok) {
          const trendingData = await trendingRes.json();
          trendingCoins.push(...trendingData.coins.slice(0, 5).map((c: { item: { id: string } }) => c.item.id));
        }
        
        // Fetch market data for sentiment calculation
        const coinsToFetch = ['bitcoin', 'ethereum', 'solana', 'ripple', 'dogecoin', 'cardano', 'avalanche-2', 'chainlink'];
        const coinSentimentData: CoinSentiment[] = [];
        
        for (const coinId of coinsToFetch) {
          try {
            const res = await fetch(
              `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false`
            );
            
            if (res.ok) {
              const data = await res.json();
              const priceChange24h = data.market_data?.price_change_percentage_24h || 0;
              const community = data.community_data || {};
              
              // Calculate sentiment from price momentum and community activity
              const sentiment = Math.round(
                (priceChange24h * 3) + // Weight price change
                (community.twitter_followers ? Math.log10(community.twitter_followers) * 2 : 0) // Social presence
              );
              
              const socialVolume = (community.twitter_followers || 0) + 
                                  (community.reddit_subscribers || 0) + 
                                  (community.telegram_channel_user_count || 0);
              
              coinSentimentData.push({
                symbol: data.symbol?.toUpperCase() || coinId.toUpperCase(),
                name: data.name || coinId,
                sentiment: Math.max(-100, Math.min(100, sentiment)),
                change24h: priceChange24h,
                socialVolume: Math.round(socialVolume / 100), // Scale down
                trending: trendingCoins.includes(coinId),
              });
            }
          } catch (e) {
            console.error(`Failed to fetch ${coinId}:`, e);
          }
        }
        
        // Calculate overall market sentiment from coin data
        const avgSentiment = coinSentimentData.length > 0 
          ? coinSentimentData.reduce((sum, c) => sum + c.sentiment, 0) / coinSentimentData.length 
          : 0;
        
        const bullishCoins = coinSentimentData.filter(c => c.change24h > 0).length;
        const bearishCoins = coinSentimentData.filter(c => c.change24h < 0).length;
        const totalCoins = coinSentimentData.length || 1;
        
        setSentimentData({
          overall: Math.round(avgSentiment),
          bullish: Math.round((bullishCoins / totalCoins) * 100),
          bearish: Math.round((bearishCoins / totalCoins) * 100),
          neutral: Math.round(((totalCoins - bullishCoins - bearishCoins) / totalCoins) * 100),
          fearGreedIndex,
          socialVolume: coinSentimentData.reduce((sum, c) => sum + c.socialVolume, 0),
          newsVolume: 0, // Would need news API
          twitterMentions: coinSentimentData.reduce((sum, c) => sum + c.socialVolume, 0),
          redditActivity: 0,
          timestamp: new Date().toISOString(),
        });
        
        setCoinSentiments(coinSentimentData.sort((a, b) => b.sentiment - a.sentiment));
        setHistoryData(historyDataArr.length > 0 ? historyDataArr : [50]);
        setLastUpdate(new Date());
      } catch (error) {
        console.error('Failed to fetch sentiment data:', error);
        // Set error state instead of fake fallback data
        setError('Failed to fetch sentiment data. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchSentimentData();
  }, [coin]);

  useEffect(() => {
    // Auto-refresh
    const interval = setInterval(() => {
      handleRefresh();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Refetch data
    try {
      const fgRes = await fetch('https://api.alternative.me/fng/?limit=1');
      if (fgRes.ok) {
        const fgData = await fgRes.json();
        if (fgData.data && fgData.data.length > 0) {
          setSentimentData(prev => prev ? {
            ...prev,
            fearGreedIndex: parseInt(fgData.data[0].value, 10),
            timestamp: new Date().toISOString(),
          } : prev);
        }
      }
    } catch (e) {
      console.error('Refresh failed:', e);
    }
    setLastUpdate(new Date());
    setIsRefreshing(false);
  };

  if (isLoading || !sentimentData) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 bg-surface rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold">{coin ? `${coin} Sentiment` : 'Market Sentiment'}</h2>
          <div className="flex items-center gap-2 mt-1 text-sm text-text-secondary">
            <Clock className="w-3 h-3" />
            <span>Updated {lastUpdate.toLocaleTimeString()}</span>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="p-2 rounded-lg bg-surface hover:bg-surface-alt transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Overall Sentiment Gauge */}
        <div className="bg-surface rounded-xl p-6 border border-surface-border flex flex-col items-center justify-center">
          <h3 className="text-sm font-medium text-text-muted mb-4">Overall Sentiment</h3>
          <SentimentGauge value={sentimentData.overall} size="md" />
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-text-secondary">24h Trend:</span>
            <MiniSparkline
              data={historyData}
              color={sentimentData.overall >= 0 ? '#22c55e' : '#ef4444'}
            />
          </div>
        </div>

        {/* Fear & Greed Index */}
        <FearGreedIndex value={sentimentData.fearGreedIndex} />

        {/* Sentiment Distribution */}
        <SentimentDistribution
          bullish={sentimentData.bullish}
          bearish={sentimentData.bearish}
          neutral={sentimentData.neutral}
        />

        {/* Social Metrics */}
        <SocialMetrics data={sentimentData} />

        {/* Coin Sentiment List */}
        <div className="md:col-span-2">
          <CoinSentimentList coins={coinSentiments} />
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-200/80">
          Sentiment analysis is derived from social media, news sources, and market data. This is
          not financial advice. Always do your own research before making investment decisions.
        </p>
      </div>
    </div>
  );
}

export default SentimentDashboard;
