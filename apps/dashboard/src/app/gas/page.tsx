import type { Metadata } from 'next';
import { GasTracker } from '@/components/GasTracker';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: 'Gas Tracker | Ethereum Gas Prices',
  description:
    'Live Ethereum gas prices and transaction cost estimator. Track gas fees for ETH transfers, swaps, and smart contract interactions.',
  openGraph: {
    title: 'Gas Tracker ⛽💸',
    description: 'Live Ethereum gas prices and transaction cost estimator.',
    images: [{
      url: '/api/og?type=page&title=Gas%20Tracker&subtitle=Ethereum%20Gas%20Prices',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Gas Tracker ⛽💸',
    description: 'Live Ethereum gas prices and transaction cost estimator.',
    images: ['/api/og?type=page&title=Gas%20Tracker&subtitle=Ethereum%20Gas%20Prices'],
  },
};

export default function GasPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Gas Tracker</h1>
              <p className="text-text-secondary">
                Live Ethereum gas prices. Estimate transaction costs before you send.
              </p>
            </div>
            <ShareButtons
              url="/gas"
              title="Track Ethereum gas prices in real-time! ⛽💸"
              variant="compact"
            />
          </div>
        </div>

        <GasTracker />
      </main>
      <Footer />
    </div>
  );
}
