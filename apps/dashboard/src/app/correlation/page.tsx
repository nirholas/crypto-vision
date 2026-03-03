import type { Metadata } from 'next';
import { CorrelationMatrix } from '@/components/CorrelationMatrix';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: 'Correlation Matrix | Crypto Asset Correlations',
  description:
    'Analyze correlations between cryptocurrencies. See which coins move together and build a diversified portfolio.',
  openGraph: {
    title: 'Correlation Matrix 📊🔗',
    description: 'Analyze correlations between cryptocurrencies.',
    images: [{
      url: '/api/og?type=page&title=Correlation%20Matrix&subtitle=Crypto%20Asset%20Correlations',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Correlation Matrix 📊🔗',
    description: 'Analyze correlations between cryptocurrencies.',
    images: ['/api/og?type=page&title=Correlation%20Matrix&subtitle=Crypto%20Asset%20Correlations'],
  },
};

export default function CorrelationPage() {
  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main id="main-content" className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Correlation Matrix</h1>
              <p className="text-text-secondary">
                Analyze how cryptocurrencies move in relation to each other. Useful for portfolio
                diversification.
              </p>
            </div>
            <ShareButtons
              url="/correlation"
              title="Analyze crypto correlations with this matrix! 📊🔗"
              variant="compact"
            />
          </div>
        </div>

        <CorrelationMatrix />
      </main>
      <Footer />
    </div>
  );
}
