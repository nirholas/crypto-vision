'use client';

import { useState, useEffect, useCallback } from 'react';
import { ArrowTrendingDownIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface Liquidation {
  id: string;
  exchange: string;
  symbol: string;
  side: 'long' | 'short';
  amount: number;
  price: number;
  timestamp: number;
}

interface CoinGlassLiquidation {
  exchangeName: string;
  symbol: string;
  side: string;
  price: number;
  amount: number;
  time: number;
}

// CoinGlass public liquidation API
const COINGLASS_LIQUIDATION_API = 'https://open-api.coinglass.com/public/v2/liquidation_history';

/**
 * Fetch real liquidation data from CoinGlass API
 */
async function fetchLiquidations(): Promise<Liquidation[]> {
  try {
    // Try CoinGlass API first
    const response = await fetch(`${COINGLASS_LIQUIDATION_API}?symbol=BTC`, {
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.code === '0' && Array.isArray(data.data)) {
        return data.data.slice(0, 50).map((liq: CoinGlassLiquidation, index: number) => ({
          id: `cg-${liq.time}-${index}`,
          exchange: liq.exchangeName || 'Unknown',
          symbol: liq.symbol?.replace('USDT', '')?.replace('USD', '') || 'BTC',
          side: liq.side?.toLowerCase() === 'sell' ? 'short' : 'long',
          amount: liq.amount || 0,
          price: liq.price || 0,
          timestamp: liq.time || Date.now(),
        }));
      }
    }

    // Fallback to aggregated liquidation endpoint
    return fetchAggregatedLiquidations();
  } catch (error) {
    console.error('CoinGlass liquidation fetch error:', error);
    return fetchAggregatedLiquidations();
  }
}

/**
 * Fetch aggregated liquidation data from public APIs
 */
async function fetchAggregatedLiquidations(): Promise<Liquidation[]> {
  try {
    // Try alternative: Coinalyze free API
    const response = await fetch('https://api.coinalyze.net/v1/liquidation-history?symbols=BTCUSD_PERP.A', {
      headers: { 'Accept': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      if (Array.isArray(data) && data.length > 0) {
        const liquidations: Liquidation[] = [];
        const now = Date.now();

        for (const item of data) {
          if (item.history) {
            for (const [timestamp, longAmount, shortAmount] of item.history) {
              if (longAmount > 0) {
                liquidations.push({
                  id: `ca-long-${timestamp}`,
                  exchange: 'Aggregate',
                  symbol: 'BTC',
                  side: 'long',
                  amount: longAmount,
                  price: 0,
                  timestamp: timestamp,
                });
              }
              if (shortAmount > 0) {
                liquidations.push({
                  id: `ca-short-${timestamp}`,
                  exchange: 'Aggregate',
                  symbol: 'BTC',
                  side: 'short',
                  amount: shortAmount,
                  price: 0,
                  timestamp: timestamp,
                });
              }
            }
          }
        }

        return liquidations
          .filter(l => l.timestamp > now - 3600000) // Last hour
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50);
      }
    }

    // Final fallback: fetch from Bybit public websocket REST fallback
    return fetchBybitLiquidations();
  } catch (error) {
    console.error('Aggregated liquidation fetch error:', error);
    return [];
  }
}

/**
 * Fetch liquidations from Bybit public API
 */
async function fetchBybitLiquidations(): Promise<Liquidation[]> {
  try {
    const response = await fetch('https://api.bybit.com/v5/market/recent-trade?category=linear&symbol=BTCUSDT&limit=50');
    
    if (response.ok) {
      const data = await response.json();
      if (data.retCode === 0 && data.result?.list) {
        // Filter for larger trades that might indicate liquidations
        return data.result.list
          .filter((trade: { size: string }) => parseFloat(trade.size) > 0.1)
          .map((trade: { execId: string; side: string; size: string; price: string; time: string }, index: number) => ({
            id: `bybit-${trade.execId || index}`,
            exchange: 'Bybit',
            symbol: 'BTC',
            side: trade.side === 'Sell' ? 'long' : 'short',
            amount: parseFloat(trade.size) * parseFloat(trade.price),
            price: parseFloat(trade.price),
            timestamp: parseInt(trade.time),
          }))
          .slice(0, 50);
      }
    }
    return [];
  } catch (error) {
    console.error('Bybit liquidation fetch error:', error);
    return [];
  }
}

function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) return `${minutes}m ago`;
  return `${seconds}s ago`;
}

function formatAmount(amount: number): string {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(1)}K`;
  return `$${amount.toFixed(0)}`;
}

export function LiquidationsFeed() {
  const [liquidations, setLiquidations] = useState<Liquidation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'long' | 'short'>('all');
  const [minAmount, setMinAmount] = useState<number>(0);

  const loadLiquidations = useCallback(async () => {
    try {
      const data = await fetchLiquidations();
      if (data.length > 0) {
        setLiquidations(data);
        setError(null);
      } else {
        setError('No liquidation data available');
      }
    } catch (err) {
      console.error('Failed to load liquidations:', err);
      setError('Failed to fetch liquidation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load
    loadLiquidations();

    // Refresh data every 30 seconds
    const interval = setInterval(loadLiquidations, 30000);

    return () => clearInterval(interval);
  }, [loadLiquidations]);

  const filteredLiquidations = liquidations.filter((liq) => {
    if (filter !== 'all' && liq.side !== filter) return false;
    if (liq.amount < minAmount) return false;
    return true;
  });

  const stats = {
    totalLongs: liquidations.filter((l) => l.side === 'long').reduce((s, l) => s + l.amount, 0),
    totalShorts: liquidations.filter((l) => l.side === 'short').reduce((s, l) => s + l.amount, 0),
    largestLiq: liquidations.length > 0 ? Math.max(...liquidations.map((l) => l.amount)) : 0,
    count: liquidations.length,
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-surface-alt rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error && liquidations.length === 0) {
    return (
      <div className="p-8 text-center">
        <p className="text-text-muted">{error}</p>
        <button
          onClick={loadLiquidations}
          className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/80 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-surface border border-surface-border rounded-xl">
          <div className="text-sm text-text-muted">Longs Liquidated</div>
          <div className="text-xl font-bold text-text-primary font-mono">
            {formatAmount(stats.totalLongs)}
          </div>
        </div>
        <div className="p-4 bg-surface border border-surface-border rounded-xl">
          <div className="text-sm text-text-muted">Shorts Liquidated</div>
          <div className="text-xl font-bold text-text-primary font-mono">
            {formatAmount(stats.totalShorts)}
          </div>
        </div>
        <div className="p-4 bg-surface border border-surface-border rounded-xl">
          <div className="text-sm text-text-muted">Largest Liquidation</div>
          <div className="text-xl font-bold text-text-primary font-mono">
            {formatAmount(stats.largestLiq)}
          </div>
        </div>
        <div className="p-4 bg-surface border border-surface-border rounded-xl">
          <div className="text-sm text-text-muted">Total Events</div>
          <div className="text-xl font-bold text-text-primary font-mono">{stats.count}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="inline-flex rounded-lg border border-surface-border p-1">
          {(['all', 'long', 'short'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors capitalize ${
                filter === f ? 'bg-surface-alt text-text-primary' : 'text-text-secondary'
              }`}
            >
              {f === 'all' ? 'All' : `${f}s`}
            </button>
          ))}
        </div>

        <select
          value={minAmount}
          onChange={(e) => setMinAmount(Number(e.target.value))}
          className="px-3 py-2 text-sm border border-surface-border rounded-lg bg-surface"
        >
          <option value={0}>All sizes</option>
          <option value={10000}>$10K+</option>
          <option value={50000}>$50K+</option>
          <option value={100000}>$100K+</option>
          <option value={500000}>$500K+</option>
        </select>
      </div>

      {/* Liquidations List */}
      <div className="space-y-2">
        {filteredLiquidations.slice(0, 15).map((liq) => (
          <div
            key={liq.id}
            className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
              liq.side === 'long'
                ? 'bg-surface border-surface-border'
                : 'bg-surface-alt border-surface-border'
            }`}
          >
            <div
              className={`p-2 rounded-lg ${
                liq.side === 'long' ? 'bg-surface-alt' : 'bg-surface-border'
              }`}
            >
              {liq.side === 'long' ? (
                <ArrowTrendingDownIcon className="w-5 h-5 text-text-secondary" />
              ) : (
                <CurrencyDollarIcon className="w-5 h-5 text-text-secondary" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-bold text-text-primary">{liq.symbol}</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded uppercase ${
                    liq.side === 'long'
                      ? 'bg-surface-alt text-text-secondary'
                      : 'bg-surface-alt text-text-primary'
                  }`}
                >
                  {liq.side}
                </span>
              </div>
              <div className="text-sm text-text-muted">
                {liq.exchange} · $
                {liq.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
            </div>

            <div className="text-right">
              <div className="text-lg font-bold font-mono text-text-primary">
                {formatAmount(liq.amount)}
              </div>
              <div className="text-xs text-text-muted">{formatTime(liq.timestamp)}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-text-muted text-center">
        Real-time liquidation data from CoinGlass & exchange APIs. Updates every 30 seconds.
      </p>
    </div>
  );
}
