import type { Metadata } from 'next';
import { Heatmap } from '@/components/Heatmap';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: 'Market Heatmap | Crypto Overview',
  description:
    'Visual heatmap of the cryptocurrency market. See which coins are up or down at a glance with our interactive market visualization.',
  openGraph: {
    title: 'Market Heatmap 🗺️📊',
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
    title: 'Market Heatmap 🗺️📊',
    description: 'Visual heatmap of the cryptocurrency market. See which coins are up or down at a glance.',
    images: ['/api/og?type=market&title=Market%20Heatmap&subtitle=Crypto%20Market%20Overview'],
  },
};

async function getCoins() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=200&page=1&sparkline=false&price_change_percentage=24h,7d',
      {
        next: { revalidate: 120 },
        headers: {
          Accept: 'application/json',
        },
      }
    );

    if (!res.ok) {
      console.error('Failed to fetch coins:', res.status);
      return [];
    }

    return res.json();
  } catch (error) {
    console.error('Error fetching coins:', error);
    return [];
  }
}

export default async function HeatmapPage() {
  const coins = await getCoins();

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main id="main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Market Heatmap</h1>
              <p className="text-text-secondary">
                Visualize the entire crypto market at a glance. Size indicates market cap, shade
                indicates price change.
              </p>
            </div>
            <ShareButtons
              url="/heatmap"
              title="Check out this crypto market heatmap! 🗺️📊"
              variant="compact"
            />
          </div>
        </div>

        {coins.length > 0 ? (
          <Heatmap coins={coins} />
        ) : (
          <div className="text-center py-12 text-text-muted">
            Unable to load market data. Please try again later.
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
