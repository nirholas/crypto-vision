/**
 * Newly Listed Coins Page
 * Shows recently added cryptocurrencies
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';
import { getTopCoins, formatPrice, formatPercent, formatNumber } from '@/lib/market-data';
import type { Metadata } from 'next';
import { Sparkles, Lightbulb } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Newly Listed Coins - Crypto Markets - Crypto Data Aggregator',
  description: 'Discover newly listed cryptocurrencies and recent additions to the market.',
};

export const revalidate = 60;

export default async function NewCoinsPage() {
  const coins = await getTopCoins(250);

  // Sort by last_updated to get recently active coins
  // Note: In a real implementation, you'd want a dedicated "new listings" API
  const newCoins = [...coins]
    .sort((a, b) => new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime())
    .slice(0, 50);

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
            <span className="text-text-primary">New Listings</span>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-text-primary" />
              Newly Listed Coins
            </h1>
            <p className="text-text-secondary">Recently updated cryptocurrencies on the market</p>
          </div>

          {/* Info Banner */}
          <div className="bg-surface-alt border border-surface-border rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-text-primary font-medium">New listing alert</p>
                <p className="text-text-secondary text-sm">
                  New cryptocurrencies can be highly volatile. Always do your own research before
                  investing.
                </p>
              </div>
            </div>
          </div>

          {/* New Coins Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {newCoins.map((coin) => (
              <Link
                key={coin.id}
                href={`/coin/${coin.id}`}
                className="bg-surface rounded-xl border border-surface-border p-4 hover:border-text-secondary hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
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
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-text-primary truncate">{coin.name}</h3>
                    <p className="text-text-muted text-sm">
                      {coin.symbol.toUpperCase()} • #{coin.market_cap_rank}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-surface-border">
                  <span className="font-semibold text-text-primary">
                    {formatPrice(coin.current_price)}
                  </span>
                  <span
                    className={`font-medium ${
                      (coin.price_change_percentage_24h || 0) >= 0
                        ? 'text-text-primary'
                        : 'text-text-muted'
                    }`}
                  >
                    {formatPercent(coin.price_change_percentage_24h)}
                  </span>
                </div>
                <div className="mt-2 text-xs text-text-muted">
                  MCap: ${formatNumber(coin.market_cap)}
                </div>
              </Link>
            ))}
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
