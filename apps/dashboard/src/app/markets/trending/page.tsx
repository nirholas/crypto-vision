/**
 * Trending Coins Page
 * Shows trending cryptocurrencies
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';
import { getTrending, getTopCoins, formatPercent } from '@/lib/market-data';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Trending Cryptocurrencies - Crypto Data Aggregator',
  description: 'Discover the most searched and trending cryptocurrencies right now.',
};

export const revalidate = 60;

export default async function TrendingPage() {
  const [trending, topCoins] = await Promise.all([getTrending(), getTopCoins(100)]);

  // Create a map of coins for quick lookup
  const coinMap = new Map(topCoins.map((c) => [c.id, c]));

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />

        <main className="px-4 py-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
            <Link href="/markets" className="hover:text-text-primary">
              Markets
            </Link>
            <span>/</span>
            <span className="text-text-primary">Trending</span>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3">
              <svg
                className="w-7 h-7 text-text-primary"
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
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z"
                />
              </svg>
              <h1 className="text-3xl font-bold text-text-primary">Trending Cryptocurrencies</h1>
            </div>
            <p className="text-text-secondary mt-2">
              The most searched coins on CoinGecko in the last 24 hours
            </p>
          </div>

          {/* Trending Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trending.map((coin, index) => {
              const details = coinMap.get(coin.id);
              return (
                <Link
                  key={coin.id}
                  href={`/coin/${coin.id}`}
                  className="bg-surface rounded-xl border border-surface-border p-4 hover:border-text-secondary hover:shadow-lg transition-all"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-text-muted">#{index + 1}</span>
                      <div className="relative w-10 h-10">
                        {coin.large && (
                          <Image
                            src={coin.large}
                            alt={coin.name}
                            fill
                            className="rounded-full object-cover"
                            unoptimized
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-sm text-text-muted">
                      Rank #{coin.market_cap_rank || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-bold text-text-primary">{coin.name}</h3>
                    <p className="text-text-muted text-sm">{coin.symbol.toUpperCase()}</p>
                  </div>
                  {details && (
                    <div className="mt-4 pt-4 border-t border-surface-border">
                      <div className="flex items-center justify-between">
                        <span className="text-text-muted text-sm">24h Change</span>
                        <span
                          className={`font-semibold ${
                            (details.price_change_percentage_24h || 0) >= 0
                              ? 'text-text-primary'
                              : 'text-text-muted'
                          }`}
                        >
                          {formatPercent(details.price_change_percentage_24h)}
                        </span>
                      </div>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Back link */}
          <div className="mt-8 text-center">
            <Link href="/markets" className="text-text-primary hover:underline">
              ← Back to Markets
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
