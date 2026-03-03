/**
 * Home Market Strip - Compact crypto market overview for the homepage
 * Shows top coins with prices and 24h changes in a clean grid
 */

import Link from 'next/link';
import { getTopCoins } from '@/lib/market-data';

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

function formatMarketCap(mc: number): string {
  if (mc >= 1e12) return `$${(mc / 1e12).toFixed(2)}T`;
  if (mc >= 1e9) return `$${(mc / 1e9).toFixed(1)}B`;
  if (mc >= 1e6) return `$${(mc / 1e6).toFixed(1)}M`;
  return `$${mc.toLocaleString()}`;
}

// Common crypto symbols
const symbolMap: Record<string, string> = {
  btc: '₿', eth: 'Ξ', sol: '◎', bnb: '⬡', xrp: '✕',
  ada: '₳', doge: 'Ð', dot: '●', avax: 'A', link: '⬡',
  matic: '⬡', uni: '🦄', atom: '⚛', ltc: 'Ł', near: 'Ⓝ',
};

export default async function HomeMarketStrip() {
  const coins = await getTopCoins(12);

  if (!coins || coins.length === 0) return null;

  return (
    <section className="mb-8" aria-label="Crypto Market Overview">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 bg-white dark:bg-white rounded-full" />
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
            Markets
          </h2>
        </div>
        <Link
          href="/markets"
          className="text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center gap-1"
        >
          View all
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {coins.slice(0, 12).map((coin: any) => {
          const change = coin.price_change_percentage_24h ?? 0;
          const isPositive = change >= 0;
          const sym = coin.symbol?.toLowerCase();

          return (
            <Link
              key={coin.id}
              href={`/coin/${coin.id}`}
              className="group bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-4 hover:shadow-lg hover:border-gray-300 dark:hover:border-slate-500 hover:-translate-y-0.5 transition-all duration-200"
            >
              <div className="flex items-center gap-2 mb-2">
                {coin.image ? (
                  <img
                    src={coin.image}
                    alt={coin.name}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full"
                    loading="lazy"
                  />
                ) : (
                  <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-slate-700 rounded-full">
                    {symbolMap[sym] || coin.symbol?.charAt(0)?.toUpperCase()}
                  </span>
                )}
                <div className="min-w-0">
                  <span className="text-xs font-bold text-gray-900 dark:text-white uppercase truncate block">
                    {coin.symbol}
                  </span>
                </div>
                <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">
                  #{coin.market_cap_rank}
                </span>
              </div>

              <div className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                {formatPrice(coin.current_price ?? 0)}
              </div>

              <div className={`text-xs font-medium ${
                isPositive 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(2)}%
              </div>

              {coin.market_cap ? (
                <div className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                  MCap {formatMarketCap(coin.market_cap)}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
