import type { Metadata } from 'next';
import { CryptoCalculator } from '@/components/CryptoCalculator';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: 'Crypto Calculator | Convert & Calculate Profits',
  description:
    'Convert between cryptocurrencies and calculate your potential profits. Free crypto converter and profit/loss calculator.',
  openGraph: {
    title: 'Crypto Calculator 📱💰',
    description: 'Convert between cryptocurrencies and calculate your potential profits.',
    images: [{
      url: '/api/og?type=page&title=Crypto%20Calculator&subtitle=Convert%20%26%20Calculate%20Profits',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Crypto Calculator 📱💰',
    description: 'Convert between cryptocurrencies and calculate your potential profits.',
    images: ['/api/og?type=page&title=Crypto%20Calculator&subtitle=Convert%20%26%20Calculate%20Profits'],
  },
};

export default function CalculatorPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Crypto Calculator</h1>
              <p className="text-text-secondary">
                Convert between cryptocurrencies and calculate your potential profits or losses.
              </p>
            </div>
            <ShareButtons
              url="/calculator"
              title="Check out this crypto calculator! 📱💰"
              variant="compact"
            />
          </div>
        </div>

        <CryptoCalculator />
      </main>
      <Footer />
    </div>
  );
}
