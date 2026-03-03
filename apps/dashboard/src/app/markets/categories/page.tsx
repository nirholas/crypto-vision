/**
 * Categories List Page
 * Shows all cryptocurrency categories
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getCategoryIcon } from '@/lib/category-icons';
import { Folder } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cryptocurrency Categories - Crypto Data Aggregator',
  description:
    'Browse cryptocurrencies by category: DeFi, NFT, Gaming, Layer 1, Layer 2, Meme coins, and more.',
};

// Category definitions with descriptions
const CATEGORIES = [
  {
    id: 'defi',
    name: 'DeFi',
    iconKey: 'defi',
    description: 'Decentralized Finance protocols for lending, borrowing, and trading',
    examples: ['Uniswap', 'Aave', 'Lido'],
    color: 'from-purple-500 to-indigo-500',
  },
  {
    id: 'nft',
    name: 'NFT',
    iconKey: 'nft',
    description: 'Tokens and platforms powering the NFT ecosystem',
    examples: ['Blur', 'ApeCoin', 'Immutable X'],
    color: 'from-pink-500 to-rose-500',
  },
  {
    id: 'gaming',
    name: 'Gaming',
    iconKey: 'gaming',
    description: 'Blockchain gaming and play-to-earn platforms',
    examples: ['Axie Infinity', 'The Sandbox', 'Gala'],
    color: 'from-green-500 to-emerald-500',
  },
  {
    id: 'layer-1',
    name: 'Layer 1',
    iconKey: 'layer-1',
    description: 'Base layer blockchain networks',
    examples: ['Ethereum', 'Solana', 'Avalanche'],
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'layer-2',
    name: 'Layer 2',
    iconKey: 'layer-2',
    description: 'Scaling solutions built on top of Layer 1 networks',
    examples: ['Polygon', 'Arbitrum', 'Optimism'],
    color: 'from-orange-500 to-amber-500',
  },
  {
    id: 'meme',
    name: 'Meme Coins',
    iconKey: 'meme',
    description: 'Community-driven tokens often inspired by memes',
    examples: ['Dogecoin', 'Shiba Inu', 'Pepe'],
    color: 'from-yellow-500 to-orange-500',
  },
  {
    id: 'ai',
    name: 'AI & Big Data',
    iconKey: 'ai',
    description: 'Artificial intelligence and data-focused crypto projects',
    examples: ['Render', 'Fetch.ai', 'Ocean Protocol'],
    color: 'from-violet-500 to-purple-500',
  },
  {
    id: 'exchange',
    name: 'Exchange Tokens',
    iconKey: 'exchange',
    description: 'Native tokens of cryptocurrency exchanges',
    examples: ['BNB', 'OKB', 'KCS'],
    color: 'from-red-500 to-rose-500',
  },
  {
    id: 'stablecoin',
    name: 'Stablecoins',
    iconKey: 'stablecoin',
    description: 'Price-stable cryptocurrencies pegged to fiat currencies',
    examples: ['USDT', 'USDC', 'DAI'],
    color: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'privacy',
    name: 'Privacy Coins',
    iconKey: 'privacy',
    description: 'Cryptocurrencies focused on transaction privacy',
    examples: ['Monero', 'Zcash', 'Secret'],
    color: 'from-slate-600 to-slate-800',
  },
  {
    id: 'storage',
    name: 'Storage',
    iconKey: 'storage',
    description: 'Decentralized storage and file sharing networks',
    examples: ['Filecoin', 'Arweave', 'Storj'],
    color: 'from-sky-500 to-blue-500',
  },
  {
    id: 'oracle',
    name: 'Oracles',
    iconKey: 'oracle',
    description: 'Data feeds connecting blockchains to real-world data',
    examples: ['Chainlink', 'Band Protocol', 'API3'],
    color: 'from-indigo-500 to-blue-600',
  },
];

export default function CategoriesPage() {
  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />

        <main className="px-4 py-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
            <Link href="/markets" className="hover:text-primary">
              Markets
            </Link>
            <span>/</span>
            <span className="text-text-primary">Categories</span>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <Folder className="w-8 h-8 text-brand-500" />
              Cryptocurrency Categories
            </h1>
            <p className="text-text-muted">
              Explore cryptocurrencies organized by their primary use case
            </p>
          </div>

          {/* Categories Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((category) => {
              const CategoryIcon = getCategoryIcon(category.iconKey);
              return (
                <Link
                  key={category.id}
                  href={`/markets/categories/${category.id}`}
                  className="group bg-surface rounded-xl border border-surface-border overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className={`h-2 bg-gradient-to-r ${category.color}`} />
                  <div className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <CategoryIcon className="w-8 h-8" />
                      <h2 className="text-xl font-bold text-text-primary group-hover:text-primary transition-colors">
                        {category.name}
                      </h2>
                    </div>
                    <p className="text-text-muted text-sm mb-4">
                      {category.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {category.examples.map((example) => (
                        <span
                          key={example}
                          className="px-2 py-1 bg-surface-alt text-text-secondary text-xs rounded-full"
                        >
                          {example}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Back link */}
          <div className="mt-8 text-center">
            <Link href="/markets" className="text-primary hover:underline">
              ← Back to Markets
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
