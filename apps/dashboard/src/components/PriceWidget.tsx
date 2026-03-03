/**
 * @fileoverview Live Crypto Price Widget
 *
 * Displays real-time BTC/ETH prices with change indicators.
 * Fetches from CoinGecko API with automatic refresh.
 *
 * @module components/PriceWidget
 *
 * @example
 * <PriceWidget />
 *
 * @features
 * - Live BTC and ETH prices
 * - 24h change percentage with color coding
 * - Auto-refresh every 60 seconds
 * - Compact and full variants
 * - Loading skeleton state
 */
'use client';

import { useState, useEffect } from 'react';

interface PriceData {
  bitcoin: {
    usd: number;
    usd_24h_change: number;
  };
  ethereum: {
    usd: number;
    usd_24h_change: number;
  };
}

interface PriceWidgetProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export default function PriceWidget({ variant = 'compact', className = '' }: PriceWidgetProps) {
  const [prices, setPrices] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPrices = async () => {
      try {
        const response = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true',
          { cache: 'no-store' }
        );

        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        setPrices(data);
        setError(false);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPrices();
    const interval = setInterval(fetchPrices, 60000); // Refresh every minute

    return () => clearInterval(interval);
  }, []);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: price < 10 ? 2 : 0,
    }).format(price);
  };

  const formatChange = (change: number) => {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className={`flex items-center gap-4 ${className}`}>
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-6 h-6 bg-surface-alt rounded-full" />
          <div className="w-20 h-4 bg-surface-alt rounded" />
        </div>
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-6 h-6 bg-surface-alt rounded-full" />
          <div className="w-20 h-4 bg-surface-alt rounded" />
        </div>
      </div>
    );
  }

  if (error || !prices) {
    return null; // Silently fail - don't show broken widget
  }

  const btcChange = prices.bitcoin.usd_24h_change;
  const ethChange = prices.ethereum.usd_24h_change;

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 text-sm ${className}`}>
        <div className="flex items-center gap-1.5">
          <span className="text-amber-500 font-bold">₿</span>
          <span className="font-medium text-text-primary">{formatPrice(prices.bitcoin.usd)}</span>
          <span className={`text-xs font-medium ${btcChange >= 0 ? 'text-gain' : 'text-loss'}`}>
            {formatChange(btcChange)}
          </span>
        </div>
        <div className="w-px h-4 bg-surface-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-blue-500 font-bold">Ξ</span>
          <span className="font-medium text-text-primary">{formatPrice(prices.ethereum.usd)}</span>
          <span className={`text-xs font-medium ${ethChange >= 0 ? 'text-gain' : 'text-loss'}`}>
            {formatChange(ethChange)}
          </span>
        </div>
      </div>
    );
  }

  // Full variant
  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg">
        <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-xs">₿</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-text-muted">Bitcoin</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-text-primary">
              {formatPrice(prices.bitcoin.usd)}
            </span>
            <span className={`text-xs font-medium ${btcChange >= 0 ? 'text-gain' : 'text-loss'}`}>
              {btcChange >= 0 ? '↑' : '↓'} {formatChange(btcChange)}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 rounded-lg">
        <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
          <span className="text-white font-bold text-xs">Ξ</span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs text-text-muted">Ethereum</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-text-primary">
              {formatPrice(prices.ethereum.usd)}
            </span>
            <span className={`text-xs font-medium ${ethChange >= 0 ? 'text-gain' : 'text-loss'}`}>
              {ethChange >= 0 ? '↑' : '↓'} {formatChange(ethChange)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
