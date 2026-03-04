'use client';

import React from 'react';
import { useMessariComprehensive } from '@/hooks/data-sources';

interface FundamentalDataCardProps {
  symbol: string;
}

// Helper to format numbers
const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return 'N/A';
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toLocaleString();
};

/**
 * Fundamental Data Card Component
 *
 * Displays comprehensive fundamental data for a crypto asset
 * including profile, metrics, market data, and technology overview
 */
export function FundamentalDataCard({ symbol }: FundamentalDataCardProps) {
  const { asset, metrics, markets, profile, isLoading, error } = useMessariComprehensive(
    symbol.toLowerCase()
  );

  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg p-6 animate-pulse">
        <div className="h-8 bg-surface-alt rounded w-48 mb-4"></div>
        <div className="grid grid-cols-2 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-20 bg-surface-alt rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface rounded-lg p-6 border border-red-500/20">
        <p className="text-red-500">Error loading fundamental data: {error.message}</p>
      </div>
    );
  }

  if (!asset) {
    return (
      <div className="bg-surface rounded-lg p-6 border border-surface-border">
        <p className="text-text-muted">No data available for {symbol}</p>
      </div>
    );
  }

  const marketData = metrics?.market_data;
  const marketcap = metrics?.marketcap;
  const mining = metrics?.mining_stats;
  const developer = metrics?.developer_activity;
  const roi = metrics?.roi_data;

  // Get category color
  const getCategoryColor = (category: string): string => {
    const colors: Record<string, string> = {
      Currency: 'bg-yellow-500/20 text-yellow-500',
      'Smart Contract Platform': 'bg-purple-500/20 text-purple-500',
      DeFi: 'bg-blue-500/20 text-blue-500',
      Exchange: 'bg-green-500/20 text-green-500',
      NFT: 'bg-pink-500/20 text-pink-500',
      Gaming: 'bg-orange-500/20 text-orange-500',
      Infrastructure: 'bg-cyan-500/20 text-cyan-500',
    };
    return colors[category] || 'bg-surface-alt text-text-muted';
  };

  return (
    <div className="bg-surface rounded-lg border border-surface-border overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-surface-border">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-surface-alt rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-text-primary">
              {asset.symbol?.[0] || '?'}
            </span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-text-primary">
              {asset.name} ({asset.symbol})
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {asset.profile?.general?.overview?.category && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(asset.profile.general.overview.category)}`}
                >
                  {asset.profile.general.overview.category}
                </span>
              )}
              {asset.profile?.general?.overview?.sector && (
                <span className="text-text-muted text-sm">
                  {asset.profile.general.overview.sector}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tagline */}
        {asset.profile?.general?.overview?.tagline && (
          <p className="mt-4 text-text-muted text-sm italic">
            &quot;{asset.profile.general.overview.tagline}&quot;
          </p>
        )}
      </div>

      {/* Market Data */}
      <div className="p-6 border-b border-surface-border">
        <h3 className="text-sm font-medium text-text-muted mb-4">📊 Market Data</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-alt rounded-lg p-3">
            <p className="text-text-muted text-xs">Price (USD)</p>
            <p className="text-lg font-bold text-text-primary">
              ${formatNumber(marketData?.price_usd)}
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <p className="text-text-muted text-xs">Market Cap</p>
            <p className="text-lg font-bold text-text-primary">
              ${formatNumber(marketcap?.current_marketcap_usd)}
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <p className="text-text-muted text-xs">24h Volume</p>
            <p className="text-lg font-bold text-text-primary">
              ${formatNumber(marketData?.volume_last_24_hours)}
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <p className="text-text-muted text-xs">24h Change</p>
            <p
              className={`text-lg font-bold ${
                (marketData?.percent_change_usd_last_24_hours ?? 0) >= 0
                  ? 'text-green-500'
                  : 'text-red-500'
              }`}
            >
              {marketData?.percent_change_usd_last_24_hours?.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>

      {/* Supply Stats */}
      <div className="p-6 border-b border-surface-border">
        <h3 className="text-sm font-medium text-text-muted mb-4">📦 Supply</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-alt rounded-lg p-3">
            <p className="text-text-muted text-xs">Circulating</p>
            <p className="text-sm font-medium text-text-primary">
              {formatNumber(metrics?.supply?.circulating)}
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <p className="text-text-muted text-xs">Total</p>
            <p className="text-sm font-medium text-text-primary">
              {formatNumber(metrics?.supply?.total)}
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <p className="text-text-muted text-xs">Max</p>
            <p className="text-sm font-medium text-text-primary">
              {metrics?.supply?.max ? formatNumber(metrics.supply.max) : '∞'}
            </p>
          </div>
          <div className="bg-surface-alt rounded-lg p-3">
            <p className="text-text-muted text-xs">% Issued</p>
            <p className="text-sm font-medium text-text-primary">
              {metrics?.supply?.stock_to_flow
                ? metrics.supply.stock_to_flow.toFixed(2)
                : 'N/A'}
            </p>
          </div>
        </div>
      </div>

      {/* ROI Data */}
      {roi && (
        <div className="p-6 border-b border-surface-border">
          <h3 className="text-sm font-medium text-text-muted mb-4">📈 Return on Investment</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-surface-alt rounded-lg p-3 text-center">
              <p className="text-text-muted text-xs">1 Week</p>
              <p
                className={`text-sm font-bold ${
                  (roi.percent_change_last_1_week ?? 0) >= 0
                    ? 'text-green-500'
                    : 'text-red-500'
                }`}
              >
                {roi.percent_change_last_1_week?.toFixed(2)}%
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3 text-center">
              <p className="text-text-muted text-xs">1 Month</p>
              <p
                className={`text-sm font-bold ${
                  (roi.percent_change_last_1_month ?? 0) >= 0
                    ? 'text-green-500'
                    : 'text-red-500'
                }`}
              >
                {roi.percent_change_last_1_month?.toFixed(2)}%
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3 text-center">
              <p className="text-text-muted text-xs">3 Months</p>
              <p
                className={`text-sm font-bold ${
                  (roi.percent_change_last_3_months ?? 0) >= 0
                    ? 'text-green-500'
                    : 'text-red-500'
                }`}
              >
                {roi.percent_change_last_3_months?.toFixed(2)}%
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3 text-center">
              <p className="text-text-muted text-xs">1 Year</p>
              <p
                className={`text-sm font-bold ${
                  (roi.percent_change_last_1_year ?? 0) >= 0
                    ? 'text-green-500'
                    : 'text-red-500'
                }`}
              >
                {roi.percent_change_last_1_year?.toFixed(2)}%
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3 text-center">
              <p className="text-text-muted text-xs">YTD</p>
              <p
                className={`text-sm font-bold ${
                  (roi.percent_change_year_to_date ?? 0) >= 0
                    ? 'text-green-500'
                    : 'text-red-500'
                }`}
              >
                {roi.percent_change_year_to_date?.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Developer Activity */}
      {developer && (
        <div className="p-6 border-b border-surface-border">
          <h3 className="text-sm font-medium text-text-muted mb-4">👨‍💻 Developer Activity</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-alt rounded-lg p-3">
              <p className="text-text-muted text-xs">Stars</p>
              <p className="text-lg font-bold text-text-primary">
                {formatNumber(developer.stars)}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <p className="text-text-muted text-xs">Watchers</p>
              <p className="text-lg font-bold text-text-primary">
                {formatNumber(developer.watchers)}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <p className="text-text-muted text-xs">Commits (90d)</p>
              <p className="text-lg font-bold text-text-primary">
                {formatNumber(developer.commits_last_90_days)}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <p className="text-text-muted text-xs">Contributors (90d)</p>
              <p className="text-lg font-bold text-text-primary">
                {formatNumber(developer.committers_last_90_days)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mining Stats (if applicable) */}
      {mining && mining.hash_rate && (
        <div className="p-6 border-b border-surface-border">
          <h3 className="text-sm font-medium text-text-muted mb-4">⛏️ Mining Stats</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-surface-alt rounded-lg p-3">
              <p className="text-text-muted text-xs">Hash Rate</p>
              <p className="text-sm font-medium text-text-primary">
                {formatNumber(mining.hash_rate)} H/s
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <p className="text-text-muted text-xs">Difficulty</p>
              <p className="text-sm font-medium text-text-primary">
                {formatNumber(mining.mining_algo)}
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <p className="text-text-muted text-xs">Block Time</p>
              <p className="text-sm font-medium text-text-primary">
                {mining.average_block_time?.toFixed(1)}s
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-3">
              <p className="text-text-muted text-xs">Network % Change</p>
              <p
                className={`text-sm font-medium ${
                  (mining.network_hash_rate_change_last_24_hours ?? 0) >= 0
                    ? 'text-green-500'
                    : 'text-red-500'
                }`}
              >
                {mining.network_hash_rate_change_last_24_hours?.toFixed(2)}%
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top Markets */}
      {markets && markets.length > 0 && (
        <div className="p-6 border-b border-surface-border">
          <h3 className="text-sm font-medium text-text-muted mb-4">🏛️ Top Markets</h3>
          <div className="overflow-x-auto scrollbar-hide">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-text-muted border-b border-surface-border">
                  <th className="pb-2">Exchange</th>
                  <th className="pb-2">Pair</th>
                  <th className="pb-2 text-right">Volume (24h)</th>
                  <th className="pb-2 text-right">Volume %</th>
                </tr>
              </thead>
              <tbody>
                {markets.slice(0, 5).map((market: { exchange_name: string; pair: string; volume_last_24_hours: number; volume_percentage: number }, idx: number) => (
                  <tr key={idx} className="border-b border-surface-border/50 last:border-0">
                    <td className="py-2 text-text-primary">{market.exchange_name}</td>
                    <td className="py-2 text-text-muted">{market.pair}</td>
                    <td className="py-2 text-right text-text-primary">
                      ${formatNumber(market.volume_last_24_hours)}
                    </td>
                    <td className="py-2 text-right text-text-muted">
                      {market.volume_percentage?.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Description */}
      {profile?.general?.overview?.project_details && (
        <div className="p-6">
          <h3 className="text-sm font-medium text-text-muted mb-4">📝 About</h3>
          <p className="text-text-primary text-sm leading-relaxed line-clamp-4">
            {profile.general.overview.project_details}
          </p>
        </div>
      )}

      {/* Links */}
      {profile?.general?.overview && (
        <div className="px-6 pb-6 flex flex-wrap gap-2">
          {profile.general.overview.official_links?.map((link: { name: string; link: string }, idx: number) => (
            <a
              key={idx}
              href={link.link}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-surface-alt hover:bg-surface-alt/80 rounded-full text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              🔗 {link.name}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export default FundamentalDataCard;
