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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      <div className="max-w-7xl mx-auto">
        <Header />
        
        <main className="px-4 py-8">
          {/* Page Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-3 text-gray-900 dark:text-white">🏷️ Browse Topics</h1>
            <p className="text-gray-600 dark:text-slate-400 max-w-2xl mx-auto">
              Explore crypto news by topic. Find the latest updates on what matters to you.
            </p>
          </div>

          {/* Categories Section */}
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">📂 Categories</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/category/${cat.slug}`}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 hover:shadow-lg hover:border-gray-300 dark:hover:border-slate-600 transition group"
                >
                  <span className="text-4xl block mb-3">{cat.emoji}</span>
                  <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">{cat.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">{cat.description}</p>
                </Link>
              ))}
            </div>
          </div>

          {/* Topics Section */}
          <div>
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">🔥 Trending Topics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {topics.map((topic) => (
                <Link
                  key={topic.slug}
                  href={`/topic/${topic.slug}`}
                  className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 hover:shadow-lg hover:border-gray-300 dark:hover:border-slate-600 transition group flex items-start gap-4"
                >
                  <span className="text-3xl">{topic.emoji}</span>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">{topic.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-slate-400">{topic.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Search CTA */}
          <div className="mt-12 text-center bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-8">
            <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-white">Can&apos;t find what you&apos;re looking for?</h3>
            <p className="text-gray-600 dark:text-slate-400 mb-4">Use our search to find any crypto topic.</p>
            <Link
              href="/search"
              className="inline-block bg-black dark:bg-white text-white dark:text-black px-6 py-3 rounded-full font-medium hover:bg-gray-800 dark:hover:bg-gray-200 transition"
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
