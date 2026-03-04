'use client';

import React from 'react';
import Link from 'next/link';
import { Star, ChevronRight, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { useWatchlist } from './WatchlistProvider';

interface WatchlistCoin {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  image?: string;
}

interface WatchlistMiniWidgetProps {
  coins?: WatchlistCoin[];
  maxItems?: number;
  className?: string;
}

export function WatchlistMiniWidget({
  coins = [],
  maxItems = 5,
  className = '',
}: WatchlistMiniWidgetProps) {
  const { watchlist, isLoaded, removeFromWatchlist } = useWatchlist();

  // Filter coins data to only show watchlisted coins
  const watchlistedCoins = coins.filter((coin) => watchlist.includes(coin.id));
  const displayCoins = watchlistedCoins.slice(0, maxItems);
  const hasMore = watchlistedCoins.length > maxItems;

  if (!isLoaded) {
    return (
      <div className={`bg-surface rounded-xl border border-surface-border p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-text-primary">Watchlist</h3>
        </div>
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-surface-alt rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (watchlist.length === 0) {
    return (
      <div className={`bg-surface rounded-xl border border-surface-border p-4 ${className}`}>
        <div className="flex items-center gap-2 mb-4">
          <Star className="w-5 h-5 text-yellow-500" />
          <h3 className="font-semibold text-text-primary">Watchlist</h3>
        </div>
        <div className="text-center py-6">
          <Star className="w-10 h-10 text-text-muted mx-auto mb-2" />
          <p className="text-sm text-text-muted mb-3">Your watchlist is empty</p>
          <Link href="/markets" className="text-sm text-primary hover:underline">
            Browse markets →
          </Link>
        </div>
      </div>
    );
  }

  // If we have watchlist but no coin data available
  if (displayCoins.length === 0 && watchlist.length > 0) {
    return (
      <div className={`bg-surface rounded-xl border border-surface-border p-4 ${className}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
            <h3 className="font-semibold text-text-primary">Watchlist</h3>
            <span className="text-xs bg-warning/20 text-warning px-2 py-0.5 rounded-full">
              {watchlist.length}
            </span>
          </div>
          <Link
            href="/watchlist"
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-2">
          {watchlist.slice(0, maxItems).map((coinId) => (
            <div
              key={coinId}
              className="flex items-center justify-between py-2 px-3 bg-surface-alt rounded-lg"
            >
              <span className="text-sm font-medium text-text-primary capitalize">
                {coinId.replace(/-/g, ' ')}
              </span>
              <button
                onClick={() => removeFromWatchlist(coinId)}
                className="text-xs text-text-muted hover:text-loss transition-colors"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface rounded-xl border border-surface-border p-4 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
          <h3 className="font-semibold text-text-primary">Watchlist</h3>
          <span className="text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded-full">
            {watchlist.length}
          </span>
        </div>
        <Link
          href="/watchlist"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View all <ChevronRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="space-y-2">
        {displayCoins.map((coin) => (
          <Link
            key={coin.id}
            href={`/coin/${coin.id}`}
            className="flex items-center justify-between py-2 px-3 hover:bg-surface-hover rounded-lg transition-colors group"
          >
            <div className="flex items-center gap-3">
              {coin.image ? (
                <img src={coin.image} alt={coin.name} className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-surface-hover" />
              )}
              <div>
                <p className="text-sm font-medium text-text-primary">{coin.symbol.toUpperCase()}</p>
                <p className="text-xs text-text-muted">{coin.name}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-text-primary">
                $
                {coin.price.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 6,
                })}
              </p>
              <p
                className={`text-xs flex items-center justify-end gap-0.5 ${
                  coin.change24h >= 0 ? 'text-gain' : 'text-loss'
                }`}
              >
                {coin.change24h >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(coin.change24h).toFixed(2)}%
              </p>
            </div>
          </Link>
        ))}

        {hasMore && (
          <Link
            href="/watchlist"
            className="block text-center py-2 text-sm text-primary hover:underline"
          >
            +{watchlistedCoins.length - maxItems} more coins
          </Link>
        )}
      </div>
    </div>
  );
}

export default WatchlistMiniWidget;
