'use client';

/**
 * Coin Row Component
 * Individual row in the coins table with premium animations
 */

import Link from 'next/link';
import { useRef, useEffect, useState } from 'react';
import type { TokenPrice } from '@/lib/market-data';
import SparklineCell from './SparklineCell';
import { useWatchlist } from '@/components/watchlist/WatchlistProvider';
import {
  FormattedNumber,
  PriceDisplay,
  PercentChange,
  MarketCapDisplay,
  SupplyDisplay,
} from '@/components/ui/FormattedNumber';
import { TokenIcon } from '@/components/ui/TokenWithChain';

interface CoinRowProps {
  coin: TokenPrice;
  showWatchlist?: boolean;
  /** Stagger index for animation delay */
  staggerIndex?: number;
}

export default function CoinRow({ coin, showWatchlist = false, staggerIndex }: CoinRowProps) {
  const { addToWatchlist, removeFromWatchlist, isWatchlisted } = useWatchlist();
  const isInWatchlist = isWatchlisted(coin.id);
  
  // Track price changes for flash effect
  const previousPrice = useRef<number>(coin.current_price);
  const [priceFlash, setPriceFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (previousPrice.current !== coin.current_price) {
      const direction = coin.current_price > previousPrice.current ? 'up' : 'down';
      setPriceFlash(direction);
      previousPrice.current = coin.current_price;

      const timeout = setTimeout(() => setPriceFlash(null), 500);
      return () => clearTimeout(timeout);
    }
  }, [coin.current_price]);
  
  const supplyPercentage = coin.max_supply
    ? (coin.circulating_supply / coin.max_supply) * 100
    : null;

  const handleWatchlistToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isInWatchlist) {
      removeFromWatchlist(coin.id);
    } else {
      addToWatchlist(coin.id);
    }
  };

  // Animation style for staggered entrance
  const animationStyle = staggerIndex !== undefined
    ? {
        animationDelay: `${staggerIndex * 30}ms`,
        animationFillMode: 'both' as const,
      }
    : {};

  // Price flash class
  const priceFlashClass = priceFlash === 'up' ? 'price-flash-up' : priceFlash === 'down' ? 'price-flash-down' : '';

  return (
    <tr 
      className={`border-b border-surface-border row-highlight group cursor-pointer ${staggerIndex !== undefined ? 'animate-slide-up-fade' : ''}`}
      style={animationStyle}
    >
      {/* Rank */}
      <td className="p-4 text-text-muted text-sm font-medium">{coin.market_cap_rank}</td>

      {/* Coin */}
      <td className="p-4">
        <Link href={`/coin/${coin.id}`} className="flex items-center gap-3">
          <TokenIcon
            symbol={coin.symbol}
            name={coin.name}
            iconUrl={coin.image}
            size="md"
          />
          <div>
            <span className="font-medium text-text-primary group-hover:text-primary transition-colors">
              {coin.name}
            </span>
            <span className="text-text-muted text-sm ml-2">
              {coin.symbol.toUpperCase()}
            </span>
          </div>
        </Link>
      </td>

      {/* Price */}
      <td className={`p-4 text-right ${priceFlashClass}`}>
        <PriceDisplay value={coin.current_price} className="font-medium" />
      </td>

      {/* 24h % */}
      <td className="p-4 text-right hidden sm:table-cell">
        <PercentChange value={coin.price_change_percentage_24h} />
      </td>

      {/* 7d % */}
      <td className="p-4 text-right hidden md:table-cell">
        <PercentChange value={coin.price_change_percentage_7d_in_currency} />
      </td>

      {/* Market Cap */}
      <td className="p-4 text-right hidden lg:table-cell">
        <MarketCapDisplay value={coin.market_cap} className="text-text-secondary" />
      </td>

      {/* 24h Volume */}
      <td className="p-4 text-right hidden xl:table-cell">
        <FormattedNumber value={coin.total_volume} type="currency" className="text-text-secondary" />
      </td>

      {/* Circulating Supply */}
      <td className="p-4 text-right hidden xl:table-cell">
        <div className="flex flex-col items-end">
          <SupplyDisplay
            value={coin.circulating_supply}
            symbol={coin.symbol}
            className="text-text-secondary"
          />
          {supplyPercentage !== null && (
            <div className="w-full max-w-[80px] mt-1">
              <div className="h-1.5 bg-surface-hover rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${Math.min(supplyPercentage, 100)}%` }}
                />
              </div>
              <span className="text-xs text-text-muted font-mono tabular-nums">
                {supplyPercentage.toFixed(0)}%
              </span>
            </div>
          )}
        </div>
      </td>

      {/* 7d Chart */}
      <td className="p-4 hidden lg:table-cell">
        {coin.sparkline_in_7d?.price ? (
          <div className="group-hover:scale-105 transition-transform duration-200">
            <SparklineCell
              data={coin.sparkline_in_7d.price}
              change={coin.price_change_percentage_7d_in_currency || 0}
              showEndDot={false}
            />
          </div>
        ) : (
          <div className="w-[100px] h-[32px] bg-surface-hover rounded" />
        )}
      </td>

      {/* Watchlist star */}
      {showWatchlist && (
        <td className="p-4 text-center">
          <button
            onClick={handleWatchlistToggle}
            className={`transition-colors ${
              isInWatchlist 
                ? 'text-warning hover:text-warning/80' 
                : 'text-text-muted hover:text-warning'
            }`}
            aria-label={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
          >
            <svg 
              className="w-5 h-5" 
              fill={isInWatchlist ? 'currentColor' : 'none'} 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
              />
            </svg>
          </button>
        </td>
      )}
    </tr>
  );
}
