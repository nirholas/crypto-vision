/**
 * @fileoverview Compact Market Overview Widget
 *
 * Displays total crypto market cap and BTC dominance in the header.
 * Fetches from CoinGecko global endpoint with auto-refresh.
 *
 * @module components/MarketWidget
 */
'use client';

import { useState, useEffect } from 'react';

interface GlobalData {
  total_market_cap: Record<string, number>;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
}

export default function MarketWidget({ className = '' }: { className?: string }) {
  const [data, setData] = useState<GlobalData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGlobal = async () => {
      try {
        const res = await fetch('/api/global');
        if (!res.ok) throw new Error('Failed');
        const json = await res.json();
        setData(json);
      } catch {
        // silent fail
      } finally {
        setLoading(false);
      }
    };

    fetchGlobal();
    const interval = setInterval(fetchGlobal, 120_000); // refresh every 2 min
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-24 h-4 bg-gray-700 rounded" />
        </div>
        <div className="w-px h-4 bg-gray-700" />
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-20 h-4 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!data) return null;

  const marketCap = data.total_market_cap?.usd ?? 0;
  const mcChange = data.market_cap_change_percentage_24h_usd ?? 0;
  const btcDom = data.market_cap_percentage?.btc ?? 0;

  const formatCap = (n: number) => {
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    return `$${(n / 1e6).toFixed(0)}M`;
  };

  return (
    <div className={`flex items-center gap-3 text-sm ${className}`}>
      {/* Total Market Cap */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400 text-xs">MCap</span>
        <span className="font-medium text-white">
          {formatCap(marketCap)}
        </span>
        <span
          className={`text-xs font-medium ${mcChange >= 0 ? 'text-green-500' : 'text-red-500'}`}
        >
          {mcChange >= 0 ? '+' : ''}
          {mcChange.toFixed(1)}%
        </span>
      </div>

      <div className="w-px h-4 bg-gray-700" />

      {/* BTC Dominance */}
      <div className="flex items-center gap-1.5">
        <span className="text-gray-400 text-xs">BTC Dom</span>
        <span className="font-medium text-white">
          {btcDom.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
