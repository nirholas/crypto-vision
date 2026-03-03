'use client';

/**
 * Live Price Display Component
 *
 * Shows real-time price updates via WebSocket.
 * Falls back to static price if WebSocket unavailable.
 * Features:
 * - Green/red flash on price changes
 * - Pulsing "LIVE" indicator dot
 * - Last update timestamp on hover
 * - Stale data indicator
 */

import { useLivePrices, formatLivePrice } from '@/lib/price-websocket';
import { usePriceFlash } from '@/hooks/usePriceFlash';
import { useEffect, useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';

interface LivePriceProps {
  coinId: string;
  initialPrice: number;
  className?: string;
  showChange?: boolean;
  showLiveIndicator?: boolean;
  showTimestamp?: boolean;
  compact?: boolean;
}

export function LivePrice({
  coinId,
  initialPrice,
  className = '',
  showChange = false,
  showLiveIndicator = true,
  showTimestamp = true,
  compact = false,
}: LivePriceProps) {
  const { prices, isConnected } = useLivePrices([coinId]);
  const priceData = prices[coinId];
  const currentPrice = priceData?.price ?? initialPrice;
  
  // Use the usePriceFlash hook for flash effects
  const { flash, flashClass: priceFlashClass } = usePriceFlash(currentPrice, {
    duration: 500,
    debounceMs: 100,
  });

  // Track stale data (no update in 60 seconds)
  const isStale = useMemo(() => {
    if (!priceData?.timestamp) return false;
    return Date.now() - priceData.timestamp > 60_000;
  }, [priceData?.timestamp]);

  // Format last update time
  const lastUpdateText = useMemo(() => {
    if (!priceData?.timestamp) return 'No recent update';
    return `Updated ${formatDistanceToNow(priceData.timestamp, { addSuffix: true })}`;
  }, [priceData?.timestamp]);

  // Combined classes for flash animation
  const flashClasses = flash === 'up'
    ? 'bg-gain/20 price-flash-up'
    : flash === 'down'
      ? 'bg-loss/20 price-flash-down'
      : '';

  return (
    <span
      className={`
        inline-flex items-center gap-1 
        transition-colors duration-300 rounded px-1
        ${flashClasses}
        ${isStale ? 'opacity-60' : ''}
        ${className}
      `}
      title={showTimestamp ? lastUpdateText : isConnected ? 'Live price' : 'Price may be delayed'}
    >
      <span className={isConnected ? 'price-updating' : ''}>
        {formatLivePrice(currentPrice)}
      </span>
      
      {showLiveIndicator && isConnected && !isStale && (
        <span
          className="live-dot"
          title="Live"
          aria-label="Live price indicator"
        />
      )}
      
      {isStale && (
        <span
          className="inline-block w-2 h-2 bg-warning rounded-full"
          title="Data may be stale"
          aria-label="Stale data warning"
        />
      )}
    </span>
  );
}

interface LivePriceTickerProps {
  coins: Array<{
    id: string;
    symbol: string;
    initialPrice: number;
  }>;
  showConnectionStatus?: boolean;
}

export function LivePriceTicker({ coins, showConnectionStatus = true }: LivePriceTickerProps) {
  const coinIds = coins.map((c) => c.id);
  const { prices, isConnected } = useLivePrices(coinIds);

  return (
    <div className="flex items-center gap-4 text-sm">
      {showConnectionStatus && isConnected && (
        <span className="flex items-center gap-1 text-gain">
          <span className="live-dot" />
          Live
        </span>
      )}
      {coins.map((coin) => {
        const priceData = prices[coin.id];
        const price = priceData?.price ?? coin.initialPrice;
        return (
          <LivePriceTickerItem
            key={coin.id}
            symbol={coin.symbol}
            price={price}
          />
        );
      })}
    </div>
  );
}

function LivePriceTickerItem({ symbol, price }: { symbol: string; price: number }) {
  const { flash, flashClass } = usePriceFlash(price);
  
  return (
    <div className={`flex items-center gap-1 transition-colors duration-300 rounded px-1 ${
      flash === 'up' ? 'bg-gain/20' : flash === 'down' ? 'bg-loss/20' : ''
    }`}>
      <span className="font-medium text-text-muted">{symbol.toUpperCase()}:</span>
      <span className="font-mono">{formatLivePrice(price)}</span>
    </div>
  );
}

interface LivePriceCardProps {
  coinId: string;
  symbol: string;
  name: string;
  initialPrice: number;
  initialChange24h: number;
  image?: string;
}

export function LivePriceCard({
  coinId,
  symbol,
  name,
  initialPrice,
  initialChange24h,
  image,
}: LivePriceCardProps) {
  const { prices, isConnected } = useLivePrices([coinId]);
  const priceData = prices[coinId];
  const currentPrice = priceData?.price ?? initialPrice;

  // Use the usePriceFlash hook
  const { flash } = usePriceFlash(currentPrice);

  // Calculate live change (approximate) or use initial
  const [previousPrice, setPreviousPrice] = useState(initialPrice);
  
  useEffect(() => {
    if (currentPrice !== previousPrice) {
      setPreviousPrice(currentPrice);
    }
  }, [currentPrice, previousPrice]);

  const priceChange =
    previousPrice > 0 ? ((currentPrice - previousPrice) / previousPrice) * 100 : 0;

  // Use initial 24h change if no live update yet
  const displayChange = isConnected && priceChange !== 0 ? priceChange : initialChange24h;

  // Track stale data
  const isStale = useMemo(() => {
    if (!priceData?.timestamp) return false;
    return Date.now() - priceData.timestamp > 60_000;
  }, [priceData?.timestamp]);

  // Format last update
  const lastUpdateText = useMemo(() => {
    if (!priceData?.timestamp) return 'No recent update';
    return `Updated ${formatDistanceToNow(priceData.timestamp, { addSuffix: true })}`;
  }, [priceData?.timestamp]);

  return (
    <div 
      className={`
        flex items-center justify-between p-4 bg-surface rounded-lg border border-surface-border
        transition-all duration-300
        ${flash === 'up' ? 'border-gain/50 shadow-gain/10 shadow-md' : ''}
        ${flash === 'down' ? 'border-loss/50 shadow-loss/10 shadow-md' : ''}
        ${isStale ? 'opacity-75' : ''}
      `}
      title={lastUpdateText}
    >
      <div className="flex items-center gap-3">
        {image && <img src={image} alt={name} className="w-8 h-8 rounded-full" />}
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-sm text-text-muted">{symbol.toUpperCase()}</div>
        </div>
      </div>

      <div className="text-right">
        <div className={`font-mono font-medium flex items-center justify-end gap-1 ${
          flash === 'up' ? 'text-gain' : flash === 'down' ? 'text-loss' : ''
        }`}>
          {formatLivePrice(currentPrice)}
          {isConnected && !isStale && <span className="live-dot" />}
          {isStale && (
            <span className="w-2 h-2 bg-warning rounded-full" title="Data may be stale" />
          )}
        </div>
        <div className={`text-sm ${displayChange >= 0 ? 'text-gain' : 'text-loss'}`}>
          {displayChange >= 0 ? '+' : ''}
          {displayChange.toFixed(2)}%
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced Live Price Display with more features
 */
interface EnhancedLivePriceProps {
  coinId: string;
  initialPrice: number;
  initialChange24h?: number;
  symbol?: string;
  size?: 'sm' | 'md' | 'lg';
  showChange?: boolean;
  showLiveIndicator?: boolean;
  showTimestamp?: boolean;
  className?: string;
}

export function EnhancedLivePrice({
  coinId,
  initialPrice,
  initialChange24h = 0,
  symbol,
  size = 'md',
  showChange = true,
  showLiveIndicator = true,
  showTimestamp = true,
  className = '',
}: EnhancedLivePriceProps) {
  const { prices, isConnected } = useLivePrices([coinId]);
  const priceData = prices[coinId];
  const currentPrice = priceData?.price ?? initialPrice;

  const { flash } = usePriceFlash(currentPrice);

  const isStale = useMemo(() => {
    if (!priceData?.timestamp) return false;
    return Date.now() - priceData.timestamp > 60_000;
  }, [priceData?.timestamp]);

  const lastUpdateText = useMemo(() => {
    if (!priceData?.timestamp) return 'Price may be delayed';
    return `Updated ${formatDistanceToNow(priceData.timestamp, { addSuffix: true })}`;
  }, [priceData?.timestamp]);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl font-semibold',
  };

  return (
    <div 
      className={`
        inline-flex flex-col 
        ${sizeClasses[size]} 
        ${className}
      `}
      title={showTimestamp ? lastUpdateText : undefined}
    >
      <div className={`
        inline-flex items-center gap-1 font-mono
        transition-all duration-300 rounded px-1
        ${flash === 'up' ? 'bg-gain/20 text-gain' : ''}
        ${flash === 'down' ? 'bg-loss/20 text-loss' : ''}
        ${isStale ? 'opacity-60' : ''}
      `}>
        {symbol && <span className="text-text-muted font-sans">{symbol}</span>}
        <span className={isConnected ? 'price-updating' : ''}>
          {formatLivePrice(currentPrice)}
        </span>
        {showLiveIndicator && isConnected && !isStale && (
          <span className="live-dot" aria-label="Live" />
        )}
        {isStale && (
          <span className="w-2 h-2 bg-warning rounded-full" aria-label="Stale" />
        )}
      </div>
      {showChange && (
        <span className={`text-xs ${initialChange24h >= 0 ? 'text-gain' : 'text-loss'}`}>
          {initialChange24h >= 0 ? '+' : ''}{initialChange24h.toFixed(2)}% (24h)
        </span>
      )}
    </div>
  );
}
