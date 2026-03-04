'use client';

import React, { useState } from 'react';
import { useCryptoCompareHistory } from '@/hooks/data-sources';

type TimeframeKey = '1D' | '1W' | '1M' | '3M' | '1Y';

interface HistoryDataPoint {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumefrom: number;
  volumeto: number;
}

interface PriceHistoryChartProps {
  symbol?: string;
  currency?: string;
}

/**
 * Price History Chart Component
 *
 * Displays historical OHLCV data from CryptoCompare
 * with selectable timeframes and simple line visualization
 */
export function PriceHistoryChart({
  symbol = 'BTC',
}: PriceHistoryChartProps) {
  const [timeframe, setTimeframe] = useState<TimeframeKey>('1W');

  // Calculate limit based on timeframe
  const getLimit = (): number => {
    const limits: Record<TimeframeKey, number> = {
      '1D': 24, // hourly for 1 day
      '1W': 168, // hourly for 1 week
      '1M': 30, // daily for 1 month
      '3M': 90, // daily for 3 months
      '1Y': 365, // daily for 1 year
    };
    return limits[timeframe];
  };

  // Note: hook only takes symbol and days
  const { history, isLoading, error } = useCryptoCompareHistory(symbol, getLimit());
  const data: HistoryDataPoint[] = history || [];

  const timeframes: TimeframeKey[] = ['1D', '1W', '1M', '3M', '1Y'];

  // Calculate price change
  const getPriceChange = () => {
    if (!data || data.length < 2) return { change: 0, percent: 0 };
    const first = data[0].close;
    const last = data[data.length - 1].close;
    const change = last - first;
    const percent = (change / first) * 100;
    return { change, percent };
  };

  const { change, percent } = getPriceChange();
  const isPositive = percent >= 0;

  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg p-6 animate-pulse">
        <div className="flex justify-between items-center mb-4">
          <div className="h-6 bg-surface-alt rounded w-32"></div>
          <div className="flex gap-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 w-12 bg-surface-alt rounded"></div>
            ))}
          </div>
        </div>
        <div className="h-64 bg-surface-alt rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-lg p-6 border border-red-500/20">
        <p className="text-red-500">Error loading price history: {error.message}</p>
      </div>
    );
  }

  // Calculate chart dimensions
  const chartWidth = 100;
  const chartHeight = 200;

  // Generate SVG path for price line
  const generatePath = () => {
    if (!data || data.length === 0) return '';

    const prices = data.map((d) => d.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * chartWidth;
      const y = chartHeight - ((d.close - minPrice) / priceRange) * chartHeight;
      return `${x},${y}`;
    });

    return `M${points.join(' L')}`;
  };

  // Generate area fill path
  const generateAreaPath = () => {
    if (!data || data.length === 0) return '';

    const prices = data.map((d) => d.close);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * chartWidth;
      const y = chartHeight - ((d.close - minPrice) / priceRange) * chartHeight;
      return `${x},${y}`;
    });

    return `M0,${chartHeight} L${points.join(' L')} L${chartWidth},${chartHeight} Z`;
  };

  // Get latest and high/low prices
  const latestPrice = data && data.length > 0 ? data[data.length - 1].close : 0;
  const highPrice = data ? Math.max(...data.map((d) => d.high)) : 0;
  const lowPrice = data ? Math.min(...data.map((d) => d.low)) : 0;
  const totalVolume = data ? data.reduce((sum, d) => sum + d.volumeto, 0) : 0;

  return (
    <div className="bg-surface rounded-lg border border-surface-border overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-surface-border">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-text-primary">
                {symbol}/USD
              </h3>
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  isPositive ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'
                }`}
              >
                {isPositive ? '↑' : '↓'} {Math.abs(percent).toFixed(2)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-text-primary mt-1">
              ${latestPrice.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: latestPrice < 1 ? 6 : 2,
              })}
            </p>
            <p className={`text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
              {isPositive ? '+' : ''}
              {change.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{' '}
              ({timeframe})
            </p>
          </div>

          {/* Timeframe selector */}
          <div className="flex gap-1 bg-surface-alt rounded-lg p-1">
            {timeframes.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:text-text-primary hover:bg-surface'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-6">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full h-64"
          preserveAspectRatio="none"
        >
          {/* Gradient fill */}
          <defs>
            <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0%"
                stopColor={isPositive ? '#22c55e' : '#ef4444'}
                stopOpacity="0.3"
              />
              <stop
                offset="100%"
                stopColor={isPositive ? '#22c55e' : '#ef4444'}
                stopOpacity="0"
              />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <path d={generateAreaPath()} fill={`url(#gradient-${symbol})`} />

          {/* Price line */}
          <path
            d={generatePath()}
            fill="none"
            stroke={isPositive ? '#22c55e' : '#ef4444'}
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 p-6 bg-surface-alt/50 border-t border-surface-border">
        <div className="text-center">
          <p className="text-text-muted text-xs">High</p>
          <p className="text-sm font-medium text-green-500">
            ${highPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-text-muted text-xs">Low</p>
          <p className="text-sm font-medium text-red-500">
            ${lowPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </p>
        </div>
        <div className="text-center">
          <p className="text-text-muted text-xs">Open</p>
          <p className="text-sm font-medium text-text-primary">
            ${data && data.length > 0
              ? data[0].open.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : 'N/A'}
          </p>
        </div>
        <div className="text-center">
          <p className="text-text-muted text-xs">Volume</p>
          <p className="text-sm font-medium text-text-primary">
            ${(totalVolume / 1e9).toFixed(2)}B
          </p>
        </div>
      </div>
    </div>
  );
}

export default PriceHistoryChart;
