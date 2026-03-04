'use client';

import React from 'react';
import { useAggregatedOverview, useDataSourceHealth } from '@/hooks/data-sources';

interface AssetData {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  marketCap: number;
}

interface SourceStatus {
  available: boolean;
  latency: number | null;
}

/**
 * Aggregated Market Overview Component
 *
 * Displays comprehensive market data aggregated from multiple sources:
 * - CoinPaprika, CoinCap, CoinLore: Global market stats
 * - Coinglass: Derivatives data
 * - Etherscan: Network stats
 */
export function AggregatedMarketOverview() {
  const { global, derivatives, topAssets, sources, isLoading, error } = useAggregatedOverview();
  const sourceStatus = useDataSourceHealth() as Record<string, SourceStatus>;

  // Calculate health from status
  const sourceNames = Object.keys(sourceStatus);
  const healthyCount = sourceNames.filter((name) => sourceStatus[name]?.available).length;
  const totalCount = sourceNames.length || 4;
  const isHealthy = healthyCount >= totalCount / 2;

  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg p-6 animate-pulse">
        <div className="h-8 bg-surface-alt rounded w-64 mb-6"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-24 bg-surface-alt rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-lg p-6 border border-red-500/20">
        <p className="text-red-500">Error loading market overview: {error.message}</p>
      </div>
    );
  }

  // Format large numbers
  const formatLargeNumber = (value: number | undefined): string => {
    if (value === undefined) return 'N/A';
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    return `$${value.toLocaleString()}`;
  };

  return (
    <div className="space-y-6">
      {/* Header with data source health */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text-primary">📊 Market Overview</h2>
        <div className="flex items-center gap-2">
          <span
            className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-500' : 'bg-orange-500'}`}
          ></span>
          <span className="text-sm text-text-muted">
            {healthyCount}/{totalCount} sources active
          </span>
        </div>
      </div>

      {/* Global Market Stats */}
      {global && (
        <div className="bg-surface rounded-lg p-6 border border-surface-border">
          <h3 className="text-sm font-medium text-text-muted mb-4">🌍 Global Market</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">Total Market Cap</p>
              <p className="text-xl font-bold text-text-primary">
                {formatLargeNumber(global.total_market_cap?.usd || global.totalMarketCap)}
              </p>
              {global.market_cap_change_percentage_24h_usd && (
                <p
                  className={`text-xs ${
                    global.market_cap_change_percentage_24h_usd >= 0
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}
                >
                  {global.market_cap_change_percentage_24h_usd >= 0 ? '↑' : '↓'}{' '}
                  {Math.abs(global.market_cap_change_percentage_24h_usd).toFixed(2)}%
                </p>
              )}
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">24h Volume</p>
              <p className="text-xl font-bold text-text-primary">
                {formatLargeNumber(global.total_volume?.usd || global.totalVolume)}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">BTC Dominance</p>
              <p className="text-xl font-bold text-orange-500">
                {(global.market_cap_percentage?.btc || global.btcDominance)?.toFixed(1)}%
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">ETH Dominance</p>
              <p className="text-xl font-bold text-blue-500">
                {(global.market_cap_percentage?.eth || global.ethDominance)?.toFixed(1)}%
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">Active Cryptocurrencies</p>
              <p className="text-xl font-bold text-text-primary">
                {(global.active_cryptocurrencies || global.cryptoCount)?.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">Total Markets</p>
              <p className="text-xl font-bold text-text-primary">
                {(global.markets || global.marketCount)?.toLocaleString()}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">Market Sentiment</p>
              <p className="text-xl font-bold text-purple-500 capitalize">
                {derivatives?.marketSentiment || 'Neutral'}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">Avg Funding Rate</p>
              <p
                className={`text-xl font-bold ${
                  (derivatives?.avgFundingRate || 0) >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {((derivatives?.avgFundingRate || 0) * 100).toFixed(4)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Assets */}
      {topAssets && topAssets.length > 0 && (
        <div className="bg-surface rounded-lg p-6 border border-surface-border">
          <h3 className="text-sm font-medium text-text-muted mb-4">💰 Top Assets</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {topAssets.slice(0, 12).map((asset: AssetData) => (
              <div key={asset.symbol} className="bg-surface-alt rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-text-primary">{asset.symbol}</span>
                  <span
                    className={`text-xs ${(asset.change24h || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {(asset.change24h || 0) >= 0 ? '↑' : '↓'}
                    {Math.abs(asset.change24h || 0).toFixed(1)}%
                  </span>
                </div>
                <p className="text-lg font-bold text-text-primary">
                  $
                  {asset.price >= 1
                    ? asset.price.toLocaleString(undefined, { maximumFractionDigits: 2 })
                    : asset.price.toFixed(6)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Derivatives Overview */}
      {derivatives && (
        <div className="bg-surface rounded-lg p-6 border border-surface-border">
          <h3 className="text-sm font-medium text-text-muted mb-4">📈 Derivatives Market</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">Total Open Interest</p>
              <p className="text-xl font-bold text-text-primary">
                {formatLargeNumber(derivatives.totalOpenInterest)}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">24h Liquidations</p>
              <p className="text-xl font-bold text-red-500">
                {formatLargeNumber(derivatives.totalLiquidations24h)}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">Market Sentiment</p>
              <p
                className={`text-xl font-bold capitalize ${
                  derivatives.marketSentiment === 'bullish'
                    ? 'text-green-500'
                    : derivatives.marketSentiment === 'bearish'
                      ? 'text-red-500'
                      : 'text-yellow-500'
                }`}
              >
                {derivatives.marketSentiment}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4">
              <p className="text-text-muted text-xs">Avg Funding Rate</p>
              <p
                className={`text-xl font-bold ${
                  derivatives.avgFundingRate >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {(derivatives.avgFundingRate * 100).toFixed(4)}%
              </p>
            </div>
          </div>

          {/* Top by OI */}
          {derivatives.topByOI && derivatives.topByOI.length > 0 && (
            <div className="mt-4">
              <p className="text-text-muted text-xs mb-2">Top by Open Interest</p>
              <div className="flex flex-wrap gap-2">
                {derivatives.topByOI.slice(0, 5).map((item: { symbol: string; oi: number }) => (
                  <span
                    key={item.symbol}
                    className="px-3 py-1 bg-surface rounded text-sm text-text-primary"
                  >
                    {item.symbol}: {formatLargeNumber(item.oi)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Data Source Attribution */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span>Data from:</span>
        {sources?.map((source: string, idx: number) => (
          <span key={idx} className="px-2 py-1 bg-surface-alt rounded-full capitalize">
            {source}
          </span>
        ))}
      </div>
    </div>
  );
}

export default AggregatedMarketOverview;
