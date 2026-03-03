/**
 * DerivativesTab - Futures & perpetual contracts data for a coin
 * Shows funding rates, open interest, basis, and top exchanges
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DerivativeTicker } from '@/lib/market-data';

interface DerivativesTabProps {
  coinSymbol: string;
  coinName: string;
}

function formatUSD(n: number | null): string {
  if (n == null || n === 0) return '—';
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function formatRate(rate: number | null | undefined): string {
  if (rate == null) return '—';
  return `${(rate * 100).toFixed(4)}%`;
}

function rateColor(rate: number | null | undefined): string {
  if (rate == null || rate === 0) return 'text-gray-400';
  return rate > 0 ? 'text-green-400' : 'text-red-400';
}

export default function DerivativesTab({ coinSymbol, coinName }: DerivativesTabProps) {
  const [tickers, setTickers] = useState<DerivativeTicker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'perpetual' | 'futures'>('all');
  const [sortBy, setSortBy] = useState<'volume' | 'oi' | 'funding'>('volume');

  // Fetch derivatives data client-side  
  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      try {
        const res = await fetch('/api/derivatives');
        if (!res.ok) throw new Error('Failed to fetch');
        const data: DerivativeTicker[] = await res.json();
        if (!cancelled) {
          setTickers(data);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError('Unable to load derivatives data');
          setLoading(false);
        }
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Filter for this coin's contracts
  const sym = coinSymbol.toUpperCase();
  const coinTickers = useMemo(() => {
    return tickers.filter(t => {
      const s = t.symbol?.toUpperCase() || '';
      // Match BTC, BTCUSD, BTCUSDT, BTC/USD, BTC-PERP, XBTUSD, etc.
      return s.startsWith(sym) || s.includes(`${sym}/`) || s.includes(`${sym}-`);
    });
  }, [tickers, sym]);

  const filtered = useMemo(() => {
    let items = coinTickers;
    if (filter === 'perpetual') items = items.filter(t => t.contract_type === 'perpetual');
    if (filter === 'futures') items = items.filter(t => t.contract_type === 'futures');

    // Sort
    return items.sort((a, b) => {
      if (sortBy === 'volume') return (b.volume_24h || 0) - (a.volume_24h || 0);
      if (sortBy === 'oi') return (b.open_interest || 0) - (a.open_interest || 0);
      if (sortBy === 'funding') return Math.abs(b.funding_rate || 0) - Math.abs(a.funding_rate || 0);
      return 0;
    });
  }, [coinTickers, filter, sortBy]);

  // Aggregate stats
  const stats = useMemo(() => {
    const perps = coinTickers.filter(t => t.contract_type === 'perpetual');
    const totalOI = coinTickers.reduce((acc, t) => acc + (t.open_interest || 0), 0);
    const totalVol = coinTickers.reduce((acc, t) => acc + (t.volume_24h || 0), 0);
    const rates = perps.map(t => t.funding_rate).filter(r => r != null && r !== 0);
    const avgFunding = rates.length > 0 ? rates.reduce((a, b) => a + b, 0) / rates.length : null;
    const avgBasis = coinTickers.length > 0
      ? coinTickers.reduce((a, t) => a + (t.basis || 0), 0) / coinTickers.length
      : null;

    return {
      totalOI,
      totalVol,
      avgFunding,
      avgBasis,
      numExchanges: new Set(coinTickers.map(t => t.market)).size,
      numContracts: coinTickers.length,
    };
  }, [coinTickers]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 p-6 animate-pulse">
          <div className="h-6 w-48 bg-gray-700 rounded mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 bg-gray-700/50 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 p-6 animate-pulse">
          <div className="h-6 w-32 bg-gray-700 rounded mb-4" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-700/30 rounded mb-2" />
          ))}
        </div>
      </div>
    );
  }

  if (error || coinTickers.length === 0) {
    return (
      <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 p-8 text-center">
        <div className="text-4xl mb-3">📉</div>
        <h3 className="text-lg font-semibold text-white mb-2">No Derivatives Data</h3>
        <p className="text-gray-400 text-sm">
          {error || `No futures or perpetual contracts found for ${coinName}. This coin may not have active derivatives markets.`}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Aggregate Stats */}
      <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          📊 {coinName} Derivatives Overview
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <StatCard label="Open Interest" value={formatUSD(stats.totalOI)} />
          <StatCard label="24h Volume" value={formatUSD(stats.totalVol)} />
          <StatCard
            label="Avg Funding Rate"
            value={formatRate(stats.avgFunding)}
            valueClass={rateColor(stats.avgFunding)}
          />
          <StatCard
            label="Avg Basis"
            value={stats.avgBasis != null ? `${(stats.avgBasis * 100).toFixed(3)}%` : '—'}
          />
          <StatCard label="Exchanges" value={String(stats.numExchanges)} />
          <StatCard label="Contracts" value={String(stats.numContracts)} />
        </div>

        {/* Funding Rate Sentiment */}
        {stats.avgFunding != null && (
          <div className="mt-4 p-3 rounded-xl bg-gray-900/50">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Funding Sentiment:</span>
              <span className={`text-sm font-semibold ${
                stats.avgFunding > 0.0001 ? 'text-green-400' :
                stats.avgFunding < -0.0001 ? 'text-red-400' : 'text-gray-300'
              }`}>
                {stats.avgFunding > 0.0001 ? '🟢 Longs Paying Shorts (Bullish Bias)' :
                 stats.avgFunding < -0.0001 ? '🔴 Shorts Paying Longs (Bearish Bias)' :
                 '⚪ Neutral'}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Annualized: {stats.avgFunding != null ? `${(stats.avgFunding * 3 * 365 * 100).toFixed(2)}%` : '—'}
            </p>
          </div>
        )}
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg border border-gray-700/50">
          {(['all', 'perpetual', 'futures'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                filter === f ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'All' : f === 'perpetual' ? 'Perpetual' : 'Futures'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 p-1 bg-gray-800/50 rounded-lg border border-gray-700/50">
          {(['volume', 'oi', 'funding'] as const).map(s => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                sortBy === s ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {s === 'volume' ? 'Volume' : s === 'oi' ? 'Open Interest' : 'Funding'}
            </button>
          ))}
        </div>
        <span className="text-sm text-gray-500">
          {filtered.length} contract{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Contracts Table */}
      <div className="bg-gray-800/50 rounded-2xl border border-gray-700/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700/50 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Exchange</th>
                <th className="px-4 py-3 font-medium">Pair</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium text-right">Price</th>
                <th className="px-4 py-3 font-medium text-right">24h Volume</th>
                <th className="px-4 py-3 font-medium text-right">Open Interest</th>
                <th className="px-4 py-3 font-medium text-right">Funding Rate</th>
                <th className="px-4 py-3 font-medium text-right">Basis</th>
                <th className="px-4 py-3 font-medium text-right">Spread</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map((t, i) => (
                <tr
                  key={`${t.market}-${t.symbol}-${i}`}
                  className="border-b border-gray-700/20 hover:bg-gray-700/20 transition-colors"
                >
                  <td className="px-4 py-3 text-white font-medium capitalize">{t.market}</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{t.symbol}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      t.contract_type === 'perpetual'
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        : 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                    }`}>
                      {t.contract_type || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-white font-mono">
                    ${parseFloat(t.price || '0').toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{formatUSD(t.volume_24h)}</td>
                  <td className="px-4 py-3 text-right text-gray-300">{formatUSD(t.open_interest)}</td>
                  <td className={`px-4 py-3 text-right font-mono ${rateColor(t.funding_rate)}`}>
                    {formatRate(t.funding_rate)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {t.basis != null ? `${(t.basis * 100).toFixed(3)}%` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">
                    {t.spread != null ? `${t.spread.toFixed(2)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 50 && (
          <div className="px-4 py-3 text-center text-sm text-gray-500 border-t border-gray-700/30">
            Showing 50 of {filtered.length} contracts
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-500">
        Data from CoinGecko derivatives API. Funding rates are per-period (typically 8h). OI and volume in USD.
      </p>
    </div>
  );
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-gray-900/50 rounded-xl p-3">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${valueClass || 'text-white'}`}>{value}</p>
    </div>
  );
}
