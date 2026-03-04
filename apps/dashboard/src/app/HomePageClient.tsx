/**
 * HomePageClient — Client-side widgets for the home page sidebar
 *
 * BTC Dominance donut, Gas Tracker summary, Quick Stats panel,
 * and interactive gainers/losers cards with live price updates.
 */

'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  type GlobalMarketData,
  type FearGreedIndex,
  type TokenPrice,
  formatNumber,
  formatPercent,
} from '@/lib/market-data';
import { Activity, Flame, Snowflake, BarChart3, ArrowUpRight, ArrowDownRight, Zap } from 'lucide-react';
import MiniDonut from './markets/components/MiniDonut';

interface HomePageClientProps {
  global: GlobalMarketData | null;
  fearGreed: FearGreedIndex | null;
  topGainers: TokenPrice[];
  topLosers: TokenPrice[];
}

type MoversTab = 'gainers' | 'losers';

export function HomePageClient({ global, topGainers, topLosers }: HomePageClientProps) {
  const [moversTab, setMoversTab] = useState<MoversTab>('gainers');

  const movers = moversTab === 'gainers' ? topGainers : topLosers;

  const btcDominance = global?.market_cap_percentage?.btc ?? 0;
  const ethDominance = global?.market_cap_percentage?.eth ?? 0;
  const otherDominance = Math.max(0, 100 - btcDominance - ethDominance);

  return (
    <div className="space-y-4">
      {/* BTC Dominance Donut */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <h3 className="font-semibold text-sm text-text-primary mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          Market Dominance
        </h3>
        <div className="flex items-center justify-center gap-6">
          <div className="relative">
            <svg viewBox="0 0 100 100" className="w-24 h-24 -rotate-90">
              {/* BTC segment */}
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="var(--brand, #F7931A)"
                strokeWidth="12"
                strokeDasharray={`${btcDominance * 2.512} ${251.2 - btcDominance * 2.512}`}
                strokeDashoffset="0"
                className="transition-all duration-700"
              />
              {/* ETH segment */}
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="#8B5CF6"
                strokeWidth="12"
                strokeDasharray={`${ethDominance * 2.512} ${251.2 - ethDominance * 2.512}`}
                strokeDashoffset={`${-btcDominance * 2.512}`}
                className="transition-all duration-700"
              />
              {/* Others segment */}
              <circle
                cx="50" cy="50" r="40"
                fill="none"
                stroke="var(--text-muted, #6B7280)"
                strokeWidth="12"
                strokeDasharray={`${otherDominance * 2.512} ${251.2 - otherDominance * 2.512}`}
                strokeDashoffset={`${-(btcDominance + ethDominance) * 2.512}`}
                className="transition-all duration-700 opacity-30"
              />
            </svg>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: 'var(--brand, #F7931A)' }} />
              <span className="text-text-secondary">BTC</span>
              <span className="font-semibold text-text-primary ml-auto">{btcDominance.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-500" />
              <span className="text-text-secondary">ETH</span>
              <span className="font-semibold text-text-primary ml-auto">{ethDominance.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-text-muted opacity-30" />
              <span className="text-text-secondary">Others</span>
              <span className="font-semibold text-text-primary ml-auto">{otherDominance.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top Movers (Gainers/Losers) */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-sm text-text-primary flex items-center gap-2">
            {moversTab === 'gainers' ? (
              <Flame className="w-4 h-4 text-gain" />
            ) : (
              <Snowflake className="w-4 h-4 text-loss" />
            )}
            Top {moversTab === 'gainers' ? 'Gainers' : 'Losers'}
          </h3>
          <div className="flex bg-surface-alt rounded-lg p-0.5">
            <button
              onClick={() => setMoversTab('gainers')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                moversTab === 'gainers'
                  ? 'bg-surface text-gain shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <ArrowUpRight className="w-3 h-3 inline mr-0.5" />
              Gainers
            </button>
            <button
              onClick={() => setMoversTab('losers')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                moversTab === 'losers'
                  ? 'bg-surface text-loss shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <ArrowDownRight className="w-3 h-3 inline mr-0.5" />
              Losers
            </button>
          </div>
        </div>
        <div className="space-y-1.5">
          {movers.map((coin) => {
            const change = coin.price_change_percentage_24h || 0;
            const isPositive = change >= 0;
            return (
              <Link
                key={coin.id}
                href={`/coin/${coin.id}`}
                className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-hover transition-colors group"
              >
                <div className="relative w-6 h-6 flex-shrink-0">
                  {coin.image && (
                    <Image
                      src={coin.image}
                      alt={coin.name}
                      fill
                      className="rounded-full object-cover"
                      unoptimized
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm text-text-primary group-hover:text-primary transition-colors truncate">
                      {coin.symbol.toUpperCase()}
                    </span>
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isPositive
                      ? 'bg-gain/10 text-gain'
                      : 'bg-loss/10 text-loss'
                  }`}
                >
                  {isPositive ? '+' : ''}{change.toFixed(2)}%
                </span>
              </Link>
            );
          })}
        </div>
        <div className="mt-3 pt-2 border-t border-surface-border">
          <Link
            href={moversTab === 'gainers' ? '/markets/gainers' : '/markets/losers'}
            className="text-xs text-primary hover:underline"
          >
            View all {moversTab === 'gainers' ? 'gainers' : 'losers'} →
          </Link>
        </div>
      </div>

      {/* Quick Stats */}
      {global && (
        <div className="bg-surface rounded-xl border border-surface-border p-4">
          <h3 className="font-semibold text-sm text-text-primary mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Quick Stats
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <QuickStat
              label="Cryptocurrencies"
              value={global.active_cryptocurrencies?.toLocaleString() || '—'}
            />
            <QuickStat
              label="Exchanges"
              value={global.markets?.toLocaleString() || '—'}
            />
            <QuickStat
              label="Total Market Cap"
              value={`$${formatNumber(global.total_market_cap?.usd)}`}
            />
            <QuickStat
              label="24h Volume"
              value={`$${formatNumber(global.total_volume?.usd)}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface-alt rounded-lg p-2.5">
      <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium mb-0.5">
        {label}
      </div>
      <div className="text-sm font-semibold text-text-primary truncate">{value}</div>
    </div>
  );
}
