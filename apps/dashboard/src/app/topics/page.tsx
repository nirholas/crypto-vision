/**
 * All Topics Page
 * Browse all available news topics
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Topics',
  description: 'Browse all crypto news topics - Bitcoin ETF, DeFi, NFTs, Regulation, and more.',
};

const topics = [
  { slug: 'bitcoin-etf', title: 'Bitcoin ETF', emoji: '📈', description: 'ETF approvals & institutional products' },
  { slug: 'ethereum-etf', title: 'Ethereum ETF', emoji: '📊', description: 'ETH ETF news & filings' },
  { slug: 'stablecoin', title: 'Stablecoins', emoji: '💵', description: 'USDT, USDC, DAI & CBDC news' },
  { slug: 'regulation', title: 'Regulation', emoji: '⚖️', description: 'SEC, laws & compliance' },
  { slug: 'hack', title: 'Hacks & Security', emoji: '🔓', description: 'Exploits & security incidents' },
  { slug: 'institutional', title: 'Institutional', emoji: '🏦', description: 'Wall Street & corporate adoption' },
  { slug: 'layer2', title: 'Layer 2', emoji: '🔗', description: 'Rollups & scaling solutions' },
  { slug: 'airdrop', title: 'Airdrops', emoji: '🪂', description: 'Token distributions & claims' },
  { slug: 'mining', title: 'Mining', emoji: '⛏️', description: 'Hashrate, miners & difficulty' },
  { slug: 'ai', title: 'AI & Crypto', emoji: '🤖', description: 'AI tokens & blockchain AI' },
  { slug: 'gaming', title: 'Gaming', emoji: '🎮', description: 'GameFi & play-to-earn' },
  { slug: 'exchange', title: 'Exchanges', emoji: '🏪', description: 'CEX & DEX news' },
  { slug: 'whale', title: 'Whale Activity', emoji: '🐋', description: 'Large transactions & moves' },
];

const categories = [
  { slug: 'bitcoin', title: 'Bitcoin', emoji: '₿', description: 'All Bitcoin news' },
  { slug: 'ethereum', title: 'Ethereum', emoji: 'Ξ', description: 'All Ethereum news' },
  { slug: 'defi', title: 'DeFi', emoji: '🏦', description: 'Decentralized finance' },
  { slug: 'nft', title: 'NFTs', emoji: '🎨', description: 'Non-fungible tokens' },
  { slug: 'markets', title: 'Markets', emoji: '📈', description: 'Price & trading analysis' },
];

export default function TopicsPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />
        
        <main className="px-4 py-8">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-3">🏷️ Browse Topics</h1>
            <p className="text-text-muted max-w-2xl mx-auto">
              Explore crypto news by topic. Find the latest updates on what matters to you.
            </p>
          </div>

          {/* Categories Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6">📂 Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="bg-surface rounded-xl border border-surface-border p-6 hover:shadow-lg hover:border-surface-hover transition group"
                >
                  <span className="text-4xl block mb-3">{cat.emoji}</span>
                  <h3 className="font-bold text-lg group-hover:text-primary transition">{cat.title}</h3>
                  <p className="text-sm text-text-muted mt-1">{cat.description}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Topics Section */}
          <div>
            <h2 className="text-2xl font-bold mb-6">🔥 Trending Topics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/topic/${topic.slug}`}
                  className="bg-surface rounded-xl border border-surface-border p-5 hover:shadow-lg hover:border-surface-hover transition group flex items-start gap-4"
                >
                  <span className="text-3xl">{topic.emoji}</span>
                  <div>
                    <h3 className="font-bold group-hover:text-primary transition">{topic.title}</h3>
                    <p className="text-sm text-text-muted">{topic.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Search CTA */}
          <div className="mt-12 text-center bg-surface rounded-xl border border-surface-border p-8">
            <h3 className="text-xl font-bold mb-2">Can't find what you're looking for?</h3>
            <p className="text-text-muted mb-4">Use our search to find any crypto topic.</p>
            <Link
              href="/search"
              className="inline-block bg-primary text-white px-6 py-3 rounded-full font-medium hover:bg-primary-hover transition"
            >
              🔍 Search News
            </Link>
          </div>
        </main>
        
        <Footer />
      </div>
    </div>
  );
}
