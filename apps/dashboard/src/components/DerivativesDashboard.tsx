'use client';

import React from 'react';
import {
  useCoinglassLiquidations,
  useCoinglassLongShort,
  useCoinglassOpenInterest,
} from '@/hooks/data-sources';

interface LiquidationItem {
  symbol: string;
  total: number;
  longPercent: number;
}

interface LongShortItem {
  symbol: string;
  longShortRatio: number;
  longRate: number;
  shortRate: number;
}

interface OpenInterestItem {
  symbol: string;
  openInterestValue?: number;
  oiChangePercent?: number;
  volume24h?: number;
}

/**
 * Derivatives Dashboard Component
 *
 * Displays liquidations, open interest, and long/short ratios
 * using data from Coinglass API
 */
export function DerivativesDashboard() {
  const { summary: liquidations, isLoading: liqLoading } = useCoinglassLiquidations();
  const { longShort, isLoading: lsLoading } = useCoinglassLongShort();
  const { openInterest, isLoading: oiLoading } = useCoinglassOpenInterest();

  const isLoading = liqLoading || lsLoading || oiLoading;

  if (isLoading) {
    return (
      <div className="bg-surface rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-surface-alt rounded w-48 mb-4"></div>
        <div className="space-y-4">
          <div className="h-24 bg-surface-alt rounded"></div>
          <div className="h-24 bg-surface-alt rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-lg p-6 border border-surface-border">
      <h2 className="text-xl font-bold text-text-primary mb-6">
        📊 Derivatives Dashboard
      </h2>

      {/* Liquidations Summary */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-text-primary mb-3">
          🔥 24h Liquidations
        </h3>
        {liquidations && (
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface-alt rounded-lg p-4 text-center">
              <p className="text-text-muted text-sm">Total</p>
              <p className="text-2xl font-bold text-text-primary">
                ${(liquidations.total24h / 1e6).toFixed(1)}M
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4 text-center">
              <p className="text-text-muted text-sm">Longs</p>
              <p className="text-2xl font-bold text-red-500">
                ${(liquidations.long24h / 1e6).toFixed(1)}M
              </p>
            </div>
            <div className="bg-surface-alt rounded-lg p-4 text-center">
              <p className="text-text-muted text-sm">Shorts</p>
              <p className="text-2xl font-bold text-green-500">
                ${(liquidations.short24h / 1e6).toFixed(1)}M
              </p>
            </div>
          </div>
        )}

        {/* Top Liquidations */}
        {liquidations?.topLiquidations && (
          <div className="mt-4">
            <h4 className="text-sm text-text-muted mb-2">Top by Liquidations</h4>
            <div className="space-y-2">
              {(liquidations.topLiquidations as LiquidationItem[]).slice(0, 5).map((item) => (
                <div
                  key={item.symbol}
                  className="flex items-center justify-between p-2 bg-surface-alt rounded"
                >
                  <span className="font-medium text-text-primary">{item.symbol}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-text-muted">
                      ${(item.total / 1e6).toFixed(2)}M
                    </span>
                    <div className="w-24 h-2 bg-surface rounded overflow-hidden">
                      <div
                        className="h-full bg-red-500"
                        style={{ width: `${item.longPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Long/Short Ratios */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-text-primary mb-3">
          ⚖️ Long/Short Ratios
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(longShort as LongShortItem[] | null)?.slice(0, 8).map((item) => (
            <div
              key={item.symbol}
              className="bg-surface-alt rounded-lg p-3 text-center"
            >
              <p className="text-sm font-medium text-text-primary">{item.symbol}</p>
              <p
                className={`text-lg font-bold ${
                  item.longShortRatio > 1 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {item.longShortRatio.toFixed(2)}
              </p>
              <div className="mt-1 flex gap-1 text-xs">
                <span className="text-green-500">{(item.longRate * 100).toFixed(0)}%L</span>
                <span className="text-text-muted">/</span>
                <span className="text-red-500">{(item.shortRate * 100).toFixed(0)}%S</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Open Interest */}
      <div>
        <h3 className="text-lg font-semibold text-text-primary mb-3">
          📈 Open Interest
        </h3>
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full">
            <thead>
              <tr className="text-left text-text-muted text-sm border-b border-surface-border">
                <th className="pb-2">Symbol</th>
                <th className="pb-2 text-right">OI Value</th>
                <th className="pb-2 text-right">24h Change</th>
                <th className="pb-2 text-right">Volume 24h</th>
              </tr>
            </thead>
            <tbody>
              {(openInterest as OpenInterestItem[] | null)?.slice(0, 10).map((item) => (
                <tr
                  key={item.symbol}
                  className="border-b border-surface-border/50"
                >
                  <td className="py-2 font-medium text-text-primary">
                    {item.symbol}
                  </td>
                  <td className="py-2 text-right text-text-primary">
                    ${((item.openInterestValue || 0) / 1e9).toFixed(2)}B
                  </td>
                  <td
                    className={`py-2 text-right ${
                      (item.oiChangePercent || 0) >= 0
                        ? 'text-green-500'
                        : 'text-red-500'
                    }`}
                  >
                    {(item.oiChangePercent || 0) >= 0 ? '+' : ''}
                    {(item.oiChangePercent || 0).toFixed(2)}%
                  </td>
                  <td className="py-2 text-right text-text-muted">
                    ${((item.volume24h || 0) / 1e9).toFixed(2)}B
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DerivativesDashboard;
