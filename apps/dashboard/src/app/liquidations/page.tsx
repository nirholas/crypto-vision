import type { Metadata } from 'next';
import { LiquidationsFeed } from '@/components/LiquidationsFeed';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: 'Liquidations | Live Futures Liquidation Feed',
  description:
    'Real-time cryptocurrency futures liquidations across major exchanges. Track longs and shorts getting liquidated.',
  openGraph: {
    title: 'Liquidations Feed 💥📉',
    description: 'Real-time cryptocurrency futures liquidations across major exchanges.',
    images: [{
      url: '/api/og?type=market&title=Liquidations%20Feed&subtitle=Live%20Futures%20Liquidations',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Liquidations Feed 💥📉',
    description: 'Real-time cryptocurrency futures liquidations across major exchanges.',
    images: ['/api/og?type=market&title=Liquidations%20Feed&subtitle=Live%20Futures%20Liquidations'],
  },
};

export default function LiquidationsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Liquidations Feed</h1>
              <p className="text-text-secondary">
                Live futures liquidations across major exchanges. See who&apos;s getting rekt in
                real-time.
              </p>
            </div>
            <ShareButtons
              url="/liquidations"
              title="Live crypto liquidations feed - see who's getting rekt! 💥📉"
              variant="compact"
            />
          </div>
        </div>

        <LiquidationsFeed />
      </main>
      <Footer />
    </div>
  );
}
