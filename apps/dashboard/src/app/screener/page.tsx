/**
 * Screener Page — Full-Featured Crypto Screener
 *
 * Column customization, advanced filters, preset filter saving,
 * export to CSV. Trading-terminal aesthetic.
 */

import type { Metadata } from 'next';
import { Screener } from '@/components/Screener';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getTopCoins } from '@/lib/market-data';
import { SlidersHorizontal } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Crypto Screener — Filter & Discover | Crypto Vision',
  description:
    'Advanced crypto screener with filters for market cap, price, volume, 24h change, and distance from ATH. Save presets and export to CSV.',
  openGraph: {
    title: 'Crypto Screener — Filter & Discover',
    description: 'Advanced crypto screener with filters for market cap, price, volume, and more.',
  },
};

export const revalidate = 60;

export default async function ScreenerPage() {
  const coins = await getTopCoins(250);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />

        <main id="main-content" className="px-4 py-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <SlidersHorizontal className="w-7 h-7 text-primary" />
              Crypto Screener
            </h1>
            <p className="text-text-secondary">
              Filter and discover cryptocurrencies matching your criteria. Save presets and export results.
            </p>
          </div>

          {coins.length > 0 ? (
            <Screener coins={coins} />
          ) : (
            <div className="text-center py-16 bg-surface rounded-xl border border-surface-border">
              <SlidersHorizontal className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-text-primary mb-1">Unable to load coin data</h3>
              <p className="text-text-muted text-sm">Please try again later</p>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
}
