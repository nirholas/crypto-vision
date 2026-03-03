/**
 * Top Gainers Page
 * Shows cryptocurrencies with the highest 24h gains
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';
import { getTopCoins, formatPrice, formatPercent, formatNumber } from '@/lib/market-data';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Top Gainers - Crypto Markets - Crypto Data Aggregator',
  description: 'Cryptocurrencies with the highest price gains in the last 24 hours.',
};

export const revalidate = 60;

export default async function GainersPage() {
  const coins = await getTopCoins(250);

  // Sort by 24h change (descending) and filter gainers
  const gainers = coins
    .filter((c) => (c.price_change_percentage_24h || 0) > 0)
    .sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0))
    .slice(0, 100);

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
            <span className="text-text-primary">Gainers</span>
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
                  d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                />
              </svg>
              <h1 className="text-3xl font-bold text-text-primary">Top Gainers</h1>
            </div>
            <p className="text-text-secondary mt-2">
              Cryptocurrencies with the highest 24h price gains
            </p>
          </div>

          {/* Gainers Table */}
          <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-alt border-b border-surface-border">
                    <th className="text-left text-text-muted text-sm font-medium p-4">#</th>
                    <th className="text-left text-text-muted text-sm font-medium p-4">Coin</th>
                    <th className="text-right text-text-muted text-sm font-medium p-4">Price</th>
                    <th className="text-right text-text-muted text-sm font-medium p-4">
                      24h Change
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4 hidden md:table-cell">
                      7d Change
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4 hidden lg:table-cell">
                      Market Cap
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4 hidden lg:table-cell">
                      Volume (24h)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {gainers.map((coin, index) => (
                    <tr
                      key={coin.id}
                      className="border-b border-surface-border hover:bg-surface-hover transition-colors"
                    >
                      <td className="p-4 text-text-muted">{index + 1}</td>
                      <td className="p-4">
                        <Link href={`/coin/${coin.id}`} className="flex items-center gap-3">
                          <div className="relative w-8 h-8">
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
                          <div>
                            <span className="font-medium text-text-primary hover:text-text-secondary">
                              {coin.name}
                            </span>
                            <span className="text-text-muted text-sm ml-2">
                              {coin.symbol.toUpperCase()}
                            </span>
                          </div>
                        </Link>
                      </td>
                      <td className="p-4 text-right font-medium text-text-primary">
                        {formatPrice(coin.current_price)}
                      </td>
                      <td className="p-4 text-right font-semibold text-text-primary">
                        {formatPercent(coin.price_change_percentage_24h)}
                      </td>
                      <td
                        className={`p-4 text-right hidden md:table-cell ${
                          (coin.price_change_percentage_7d_in_currency || 0) >= 0
                            ? 'text-text-primary font-semibold'
                            : 'text-text-muted'
                        }`}
                      >
                        {formatPercent(coin.price_change_percentage_7d_in_currency)}
                      </td>
                      <td className="p-4 text-right text-text-secondary hidden lg:table-cell">
                        ${formatNumber(coin.market_cap)}
                      </td>
                      <td className="p-4 text-right text-text-secondary hidden lg:table-cell">
                        ${formatNumber(coin.total_volume)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
