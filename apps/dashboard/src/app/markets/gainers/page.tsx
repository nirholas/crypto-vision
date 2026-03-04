/**
 * Top Gainers Page — Card Grid with Flame Indicators
 *
 * Time period toggle: 1h, 24h, 7d. Card grid showing top movers.
 * Trading-terminal aesthetic.
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';
import { getTopCoins, formatPrice, formatPercent, formatNumber } from '@/lib/market-data';
import type { Metadata } from 'next';
import { TrendingUp, Flame, ArrowLeft, BarChart3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Top Gainers — Crypto Vision',
  description: 'Cryptocurrencies with the highest price gains. View 24h, 7d top gainers.',
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
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />

        <main className="px-4 py-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
            <Link href="/markets" className="hover:text-text-primary transition-colors">
              Markets
            </Link>
            <span className="text-text-muted/50">/</span>
            <span className="text-text-primary font-medium">Gainers</span>
          </nav>

          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-text-primary flex items-center gap-3 mb-2">
              <TrendingUp className="w-7 h-7 text-gain" />
              Top Gainers
            </h1>
            <p className="text-text-secondary">
              Cryptocurrencies with the highest 24h price gains
            </p>
          </div>

          {/* Card Grid */}
          {gainers.length > 0 ? (
            <>
              {/* Top 3 Featured */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {gainers.slice(0, 3).map((coin, index) => {
                  const change = coin.price_change_percentage_24h || 0;
                  return (
                    <Link
                      key={coin.id}
                      href={`/coin/${coin.id}`}
                      className="bg-surface rounded-xl border border-gain/20 p-5 hover:border-gain/50 hover:shadow-lg hover:shadow-gain/5 transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-24 h-24 bg-gain/5 rounded-bl-full" />
                      <div className="flex items-center gap-3 mb-4">
                        <span className="text-xl font-black text-gain/40">#{index + 1}</span>
                        <div className="relative w-10 h-10">
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
                          <div className="font-bold text-text-primary group-hover:text-gain transition-colors">
                            {coin.name}
                          </div>
                          <div className="text-xs text-text-muted">{coin.symbol.toUpperCase()}</div>
                        </div>
                        <Flame className="w-5 h-5 text-gain ml-auto animate-pulse" />
                      </div>
                      <div className="flex items-end justify-between">
                        <div className="font-mono text-lg text-text-primary">{formatPrice(coin.current_price)}</div>
                        <div className="text-xl font-bold text-gain">
                          +{change.toFixed(2)}%
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-text-muted">
                        Vol ${formatNumber(coin.total_volume)} · MCap ${formatNumber(coin.market_cap)}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Full Table */}
              <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-surface-alt border-b border-surface-border">
                        <th className="text-left text-text-muted text-sm font-medium p-4">#</th>
                        <th className="text-left text-text-muted text-sm font-medium p-4">Coin</th>
                        <th className="text-right text-text-muted text-sm font-medium p-4">Price</th>
                        <th className="text-right text-text-muted text-sm font-medium p-4">24h Change</th>
                        <th className="text-right text-text-muted text-sm font-medium p-4 hidden md:table-cell">7d Change</th>
                        <th className="text-right text-text-muted text-sm font-medium p-4 hidden lg:table-cell">Market Cap</th>
                        <th className="text-right text-text-muted text-sm font-medium p-4 hidden lg:table-cell">Volume (24h)</th>
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
                                  <Image src={coin.image} alt={coin.name} fill className="rounded-full object-cover" unoptimized />
                                )}
                              </div>
                              <div>
                                <span className="font-medium text-text-primary hover:text-primary transition-colors">{coin.name}</span>
                                <span className="text-text-muted text-sm ml-2">{coin.symbol.toUpperCase()}</span>
                              </div>
                            </Link>
                          </td>
                          <td className="p-4 text-right font-mono font-medium text-text-primary">{formatPrice(coin.current_price)}</td>
                          <td className="p-4 text-right font-semibold text-gain">{formatPercent(coin.price_change_percentage_24h)}</td>
                          <td className={`p-4 text-right hidden md:table-cell ${(coin.price_change_percentage_7d_in_currency || 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                            {formatPercent(coin.price_change_percentage_7d_in_currency)}
                          </td>
                          <td className="p-4 text-right text-text-secondary hidden lg:table-cell">${formatNumber(coin.market_cap)}</td>
                          <td className="p-4 text-right text-text-secondary hidden lg:table-cell">${formatNumber(coin.total_volume)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-16 bg-surface rounded-xl border border-surface-border">
              <BarChart3 className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary">No gainers found in current market data</p>
            </div>
          )}

          {/* Back link */}
          <div className="mt-8 text-center">
            <Link href="/markets" className="inline-flex items-center gap-2 text-primary hover:underline">
              <ArrowLeft className="w-4 h-4" />
              Back to Markets
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
