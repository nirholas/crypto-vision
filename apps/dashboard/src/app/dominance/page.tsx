import type { Metadata } from 'next';
import { DominanceChart } from '@/components/DominanceChart';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';

export const metadata: Metadata = {
  title: 'Market Dominance | Crypto Market Share',
  description:
    'Visualize cryptocurrency market dominance. See the market share of Bitcoin, Ethereum, and other top cryptocurrencies.',
  openGraph: {
    title: 'Market Dominance 🥇🥈🥉',
    description: 'Visualize cryptocurrency market dominance and market share.',
    images: [{
      url: '/api/og?type=market&title=Market%20Dominance&subtitle=Crypto%20Market%20Share',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Market Dominance 🥇🥈🥉',
    description: 'Visualize cryptocurrency market dominance and market share.',
    images: ['/api/og?type=market&title=Market%20Dominance&subtitle=Crypto%20Market%20Share'],
  },
};

async function getCoins() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false',
      { next: { revalidate: 300 } }
    );
    if (res.ok) return res.json();
  } catch (e) {
    console.error('Failed to fetch coins:', e);
  }
  return [];
}

export default async function DominancePage() {
  const coins = await getCoins();

  return (
    <div className="min-h-screen bg-surface">
      <Header />
      <main id="main-content" className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-text-primary mb-2">Market Dominance</h1>
              <p className="text-text-secondary">
                Visualize market share across the crypto ecosystem. See how BTC and ETH compare to
                altcoins.
              </p>
            </div>
            <ShareButtons
              url="/dominance"
              title="Check out crypto market dominance! 🥇🥈🥉"
              variant="compact"
            />
          </div>
        </div>

        <DominanceChart coins={coins} />
      </main>
      <Footer />
    </div>
  );
}
