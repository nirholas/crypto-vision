'use client';

/**
 * Trending Section Component
 * Displays trending coins and top gainers/losers
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { TrendingCoin, TokenPrice } from '@/lib/market-data';
import { formatPercent } from '@/lib/market-data';

interface TrendingSectionProps {
  trending: TrendingCoin[];
  coins: TokenPrice[];
}

type GainersLosersTab = 'gainers' | 'losers';

export default function TrendingSection({ trending, coins }: TrendingSectionProps) {
  const [activeTab, setActiveTab] = useState<GainersLosersTab>('gainers');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Sort coins by 24h change
  const sortedCoins = [...coins].sort(
    (a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
  );

  const topGainers = sortedCoins.slice(0, 5);
  const topLosers = sortedCoins.slice(-5).reverse();
  const displayList = activeTab === 'gainers' ? topGainers : topLosers;

  return (
    <div className="grid md:grid-cols-2 gap-4 mb-6">
      {/* Trending Coins */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <svg
              className="w-5 h-5 text-text-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z"
              />
            </svg>
            <span className="text-text-primary">Trending</span>
          </h2>
          <Link
            href="/markets/trending"
            className="text-sm text-text-primary hover:underline"
          >
            View All →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {trending.slice(0, 7).map((coin, index) => (
            <Link
              key={coin.id}
              href={`/coin/${coin.id}`}
              className="flex items-center gap-2 bg-surface-alt hover:bg-surface-hover rounded-lg px-3 py-2 transition-colors"
            >
              <span className="text-text-muted text-xs font-medium">{index + 1}</span>
              <div className="relative w-6 h-6">
                {coin.thumb && (
                  <Image
                    src={coin.thumb}
                    alt={coin.name}
                    fill
                    className="rounded-full object-cover"
                    unoptimized
                  />
                )}
              </div>
              <span className="font-medium text-sm">{coin.symbol.toUpperCase()}</span>
              {coin.market_cap_rank && (
                <span className="text-text-muted text-xs">#{coin.market_cap_rank}</span>
              )}
            </Link>
          ))}
        </div>
      </div>

      {/* Top Gainers/Losers */}
      <div className="bg-surface rounded-xl border border-surface-border p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <svg
                className="w-5 h-5 text-text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {activeTab === 'gainers' ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
                  />
                )}
              </svg>
              <span className="text-text-primary">
                Top {activeTab === 'gainers' ? 'Gainers' : 'Losers'}
              </span>
            </h2>
          </div>
          <div className="flex bg-surface-alt rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('gainers')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'gainers'
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Gainers
            </button>
            <button
              onClick={() => setActiveTab('losers')}
              className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'losers'
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              Losers
            </button>
          </div>
        </div>
        <div className="space-y-2">
          {mounted &&
            displayList.map((coin) => (
              <Link
                key={coin.id}
                href={`/coin/${coin.id}`}
                className="flex items-center justify-between hover:bg-surface-hover rounded-lg px-2 py-1.5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-6 h-6">
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
                  <span className="font-medium text-sm text-text-primary">
                    {coin.symbol.toUpperCase()}
                  </span>
                  <span className="text-text-muted text-xs hidden sm:inline">{coin.name}</span>
                </div>
                <span
                  className={`font-semibold text-sm ${
                    (coin.price_change_percentage_24h || 0) >= 0
                      ? 'text-gain'
                      : 'text-loss'
                  }`}
                >
                  {formatPercent(coin.price_change_percentage_24h)}
                </span>
              </Link>
            ))}
        </div>
        <div className="mt-3 pt-3 border-t border-surface-border">
          <Link
            href={activeTab === 'gainers' ? '/markets/gainers' : '/markets/losers'}
            className="text-sm text-text-primary hover:underline"
          >
            View All {activeTab === 'gainers' ? 'Gainers' : 'Losers'} →
          </Link>
        </div>
      </div>
    </div>
  );
}
