/**
 * Trending Page — Card Grid Layout
 *
 * Trending coins, Most Searched, Most Visited sections.
 * Each card: coin logo, name, price, 24h chart indicator, volume spike.
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { Flame, TrendingUp, TrendingDown, Minus, BarChart3, Search, Eye } from 'lucide-react';
import MarketMoodWidget from '@/components/MarketMoodWidget';
import { SocialBuzz } from '@/components/SocialBuzz';
import { getTrending, getTopCoins, formatPrice, formatPercent } from '@/lib/market-data';

export const metadata: Metadata = {
  title: 'Trending Coins — Crypto Vision',
  description:
    "See what's trending in crypto right now. Real-time trending coins, top gainers, and social buzz.",
  openGraph: {
    title: 'Trending Coins — Crypto Vision',
    description: "See what's trending in crypto right now.",
  },
};

export const revalidate = 60;

export default async function TrendingPage() {
  const [trending, allCoins] = await Promise.all([
    getTrending(),
    getTopCoins(100),
  ]);

  // Derive top gainers for "Most Visited" proxy
  const sortedByChange = [...allCoins].sort(
    (a, b) => Math.abs(b.price_change_percentage_24h || 0) - Math.abs(a.price_change_percentage_24h || 0)
  );
  const mostActive = sortedByChange.slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />

        <main className="px-4 py-6">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <Flame className="w-8 h-8 text-orange-500" />
              Trending Coins
            </h1>
            <p className="text-text-secondary">
              Real-time view of what&apos;s hot in crypto
            </p>
          </div>

          {/* Market Mood Banner */}
          <div className="mb-6">
            <MarketMoodWidget variant="compact" />
          </div>

          {/* Trending Coins Grid */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              Trending Now
            </h2>
            {trending.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {trending.slice(0, 12).map((coin, index) => (
                  <Link
                    key={coin.id}
                    href={`/coin/${coin.id}`}
                    className="bg-surface rounded-xl border border-surface-border p-4 hover:border-primary/50 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-text-muted bg-surface-alt rounded-full w-6 h-6 flex items-center justify-center">
                        {index + 1}
                      </span>
                      <div className="relative w-8 h-8">
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
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-text-primary group-hover:text-primary transition-colors truncate">
                          {coin.name}
                        </div>
                        <div className="text-xs text-text-muted">{coin.symbol.toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      {coin.market_cap_rank && (
                        <span className="text-xs text-text-muted">
                          Rank #{coin.market_cap_rank}
                        </span>
                      )}
                      <span className="text-xs bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full font-medium">
                        Trending
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-surface rounded-xl border border-surface-border">
                <BarChart3 className="w-12 h-12 text-text-muted mx-auto mb-3" />
                <p className="text-text-secondary">No trending data available</p>
              </div>
            )}
          </section>

          {/* Most Active (High Volume / Volatility) */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-primary" />
              Most Active
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {mostActive.map((coin) => {
                const change = coin.price_change_percentage_24h || 0;
                const isPositive = change >= 0;
                return (
                  <Link
                    key={coin.id}
                    href={`/coin/${coin.id}`}
                    className="bg-surface rounded-xl border border-surface-border p-4 hover:border-primary/50 hover:shadow-lg transition-all group"
                  >
                    <div className="flex items-center gap-3 mb-2">
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
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm text-text-primary group-hover:text-primary transition-colors truncate">
                          {coin.name}
                        </div>
                        <div className="text-xs text-text-muted">{coin.symbol.toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-sm text-text-primary">
                        {formatPrice(coin.current_price)}
                      </span>
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          isPositive
                            ? 'bg-gain/10 text-gain'
                            : 'bg-loss/10 text-loss'
                        }`}
                      >
                        {formatPercent(change)}
                      </span>
                    </div>
                    {/* Volume spike indicator */}
                    <div className="mt-2 flex items-center gap-1">
                      <div className="flex-1 h-1 bg-surface-hover rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary/50 rounded-full"
                          style={{
                            width: `${Math.min(
                              (coin.total_volume / coin.market_cap) * 100 * 5,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-text-muted">Vol</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Social Buzz */}
          <section className="mb-8">
            <SocialBuzz />
          </section>
        </main>

        <Footer />
      </div>
    </div>
  );
}
