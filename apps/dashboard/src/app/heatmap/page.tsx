/**
 * Heatmap Page — Treemap Market Visualization
 *
 * Color gradient: deep red → red → neutral → green → deep green based on 24h change.
 * Restyled with trading-terminal aesthetic.
 */

import type { Metadata } from 'next';
import { Heatmap } from '@/components/Heatmap';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';
import { getTopCoins } from '@/lib/market-data';
import { Grid3X3 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Market Heatmap — Crypto Vision',
  description:
    'Visual heatmap of the cryptocurrency market. Size = market cap, color = price change. See the entire market at a glance.',
  openGraph: {
    title: 'Market Heatmap — Crypto Vision',
    description:
      'Visual heatmap of the cryptocurrency market. See which coins are up or down at a glance.',
    images: [{
      url: '/api/og?type=market&title=Market%20Heatmap&subtitle=Crypto%20Market%20Overview',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Heatmap — Crypto Vision',
    description: 'Visual heatmap of the cryptocurrency market.',
    images: ['/api/og?type=market&title=Market%20Heatmap&subtitle=Crypto%20Market%20Overview'],
  },
};

export const revalidate = 60;

export default async function HeatmapPage() {
  const coins = await getTopCoins(200);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />

        <main id="main-content" className="px-4 py-6">
          <div className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
                  <Grid3X3 className="w-7 h-7 text-primary" />
                  Market Heatmap
                </h1>
                <p className="text-text-secondary">
                  Visualize the entire crypto market at a glance. Size indicates market cap, color indicates price change.
                </p>
              </div>
              <ShareButtons
                url="/heatmap"
                title="Check out this crypto market heatmap!"
                variant="compact"
              />
            </div>
          </div>

          {coins.length > 0 ? (
            <Heatmap coins={coins} />
          ) : (
            <div className="text-center py-16 bg-surface rounded-xl border border-surface-border">
              <Grid3X3 className="w-12 h-12 text-text-muted mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-text-primary mb-1">Unable to load market data</h3>
              <p className="text-text-muted text-sm">Please try again later</p>
            </div>
          )}
        </main>

        <Footer />
      </div>
    </div>
  );
}
