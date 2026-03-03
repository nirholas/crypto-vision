/**
 * Top Gainers and Losers Page
 * Real-time price movers in crypto
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';
import MarketMoodWidget from '@/components/MarketMoodWidget';
import { getTopCoins, formatPrice, formatPercent, formatNumber } from '@/lib/market-data';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Top Gainers & Losers - Crypto Price Movers',
  description:
    'Real-time crypto price movers. See which coins are pumping and dumping in the last 24 hours.',
  openGraph: {
    title: 'Top Gainers & Losers 📈📉',
    description: 'Real-time crypto price movers. See which coins are pumping and dumping today!',
    images: [{
      url: '/api/og?type=market&title=Top%20Gainers%20%26%20Losers&subtitle=Real-time%20crypto%20price%20movers',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Top Gainers & Losers 📈📉',
    description: 'Real-time crypto price movers. See which coins are pumping and dumping today!',
    images: ['/api/og?type=market&title=Top%20Gainers%20%26%20Losers&subtitle=Real-time%20crypto%20price%20movers'],
  },
};

export const revalidate = 60;

export default async function MoversPage() {
  const coins = await getTopCoins(100);

  // Sort by 24h change
  const sortedByChange = [...coins].sort(
    (a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0)
  );

  const gainers = sortedByChange.slice(0, 20);
  const losers = sortedByChange.slice(-20).reverse();

  // Calculate market stats
  const totalGainers = coins.filter((c) => (c.price_change_percentage_24h || 0) > 0).length;
  const totalLosers = coins.filter((c) => (c.price_change_percentage_24h || 0) < 0).length;
  const avgChange =
    coins.reduce((sum, c) => sum + (c.price_change_percentage_24h || 0), 0) / coins.length;

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />

        <main className="px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <svg
                  className="w-8 h-8 text-text-primary"
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
                <h1 className="text-4xl font-bold text-text-primary">Top Movers</h1>
              </div>
              <ShareButtons
                url="/movers"
                title="Check out today's top crypto movers! 📈📉"
                variant="compact"
              />
            </div>
            <p className="text-text-secondary mt-2">Biggest price changes in the last 24 hours</p>
          </div>

          {/* Market Mood Banner */}
          <div className="mb-6">
            <MarketMoodWidget />   
          </div>

          {/* Market Sentiment */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
              <p className="text-text-muted text-sm">Gainers (24h)</p>
              <p className="text-2xl font-bold text-text-primary">{totalGainers}</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
              <p className="text-text-muted text-sm">Losers (24h)</p>
              <p className="text-2xl font-bold text-text-muted">{totalLosers}</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
              <p className="text-text-muted text-sm">Avg Change</p>
              <p
                className={`text-2xl font-bold ${avgChange >= 0 ? 'text-text-primary' : 'text-text-muted'}`}
              >
                {formatPercent(avgChange)}
              </p>
            </div>
            <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
              <p className="text-text-muted text-sm">Sentiment</p>
              <p
                className={`text-2xl font-bold ${totalGainers > totalLosers ? 'text-text-primary' : 'text-text-muted'}`}
              >
                {totalGainers > totalLosers ? 'Bullish' : 'Bearish'}
              </p>
            </div>
          </div>

          {/* Main Content */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top Gainers */}
            <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
              <div className="p-4 border-b border-surface-border bg-surface-alt">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 10l7-7m0 0l7 7m-7-7v18"
                    />
                  </svg>
                  <div>
                    <h2 className="font-bold text-lg text-text-primary">Top Gainers</h2>
                    <p className="text-sm text-text-secondary">Best performers in 24h</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-surface-border">
                {gainers.map((coin, index) => (
                  <Link
                    key={coin.id}
                    href={`/coin/${coin.id}`}
                    className="flex items-center justify-between p-4 hover:bg-surface-alt transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted text-sm w-6">{index + 1}</span>
                      {coin.image && (
                        <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                      )}
                      <div>
                        <span className="font-medium text-text-primary">{coin.name}</span>
                        <span className="text-text-muted text-sm ml-2">
                          {coin.symbol.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-text-primary">
                        {formatPrice(coin.current_price)}
                      </p>
                      <p className="text-text-primary font-bold">
                        +{formatPercent(coin.price_change_percentage_24h)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Top Losers */}
            <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
              <div className="p-4 border-b border-surface-border bg-surface-alt">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-6 h-6 text-text-muted"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 14l-7 7m0 0l-7-7m7 7V3"
                    />
                  </svg>
                  <div>
                    <h2 className="font-bold text-lg text-text-primary">Top Losers</h2>
                    <p className="text-sm text-text-secondary">Worst performers in 24h</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-surface-border">
                {losers.map((coin, index) => (
                  <Link
                    key={coin.id}
                    href={`/coin/${coin.id}`}
                    className="flex items-center justify-between p-4 hover:bg-surface-alt transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-text-muted text-sm w-6">{index + 1}</span>
                      {coin.image && (
                        <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                      )}
                      <div>
                        <span className="font-medium text-text-primary">{coin.name}</span>
                        <span className="text-text-muted text-sm ml-2">
                          {coin.symbol.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-text-primary">
                        {formatPrice(coin.current_price)}
                      </p>
                      <p className="text-text-muted font-bold">
                        {formatPercent(coin.price_change_percentage_24h)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/markets"
              className="bg-text-primary text-surface px-6 py-3 rounded-lg font-medium hover:opacity-90 transition"
            >
              Full Markets Dashboard
            </Link>
            <Link
              href="/category/markets"
              className="bg-surface border border-surface-border text-text-secondary px-6 py-3 rounded-lg font-medium hover:bg-surface-alt transition"
            >
              Market News
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
