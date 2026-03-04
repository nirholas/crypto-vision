/**
 * Category Detail Page
 * Shows coins in a specific category
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';
import { getTopCoins, formatPrice, formatPercent, formatNumber } from '@/lib/market-data';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getCategoryIcon } from '@/lib/category-icons';
import { Search } from 'lucide-react';

// Category metadata
const CATEGORY_META: Record<string, { name: string; iconKey: string; description: string }> = {
  defi: {
    name: 'DeFi',
    iconKey: 'defi',
    description: 'Decentralized Finance protocols',
  },
  nft: {
    name: 'NFT',
    iconKey: 'nft',
    description: 'NFT ecosystem tokens',
  },
  gaming: {
    name: 'Gaming',
    iconKey: 'gaming',
    description: 'Blockchain gaming tokens',
  },
  'layer-1': {
    name: 'Layer 1',
    iconKey: 'layer-1',
    description: 'Base layer blockchains',
  },
  'layer-2': {
    name: 'Layer 2',
    iconKey: 'layer-2',
    description: 'Scaling solutions',
  },
  meme: {
    name: 'Meme Coins',
    iconKey: 'meme',
    description: 'Community-driven meme tokens',
  },
  ai: {
    name: 'AI & Big Data',
    iconKey: 'ai',
    description: 'AI and data-focused projects',
  },
  exchange: {
    name: 'Exchange Tokens',
    iconKey: 'exchange',
    description: 'Cryptocurrency exchange native tokens',
  },
  stablecoin: {
    name: 'Stablecoins',
    iconKey: 'stablecoin',
    description: 'Price-stable cryptocurrencies',
  },
  privacy: {
    name: 'Privacy Coins',
    iconKey: 'privacy',
    description: 'Privacy-focused cryptocurrencies',
  },
  storage: {
    name: 'Storage',
    iconKey: 'storage',
    description: 'Decentralized storage networks',
  },
  oracle: {
    name: 'Oracles',
    iconKey: 'oracle',
    description: 'Blockchain oracle networks',
  },
};

// Example coin mappings by category (in production, use CoinGecko categories API)
const CATEGORY_COINS: Record<string, string[]> = {
  defi: [
    'uniswap',
    'aave',
    'lido-dao',
    'maker',
    'curve-dao-token',
    'compound-governance-token',
    'sushi',
    'yearn-finance',
    '1inch',
    'pancakeswap-token',
  ],
  nft: [
    'blur',
    'apecoin',
    'immutable-x',
    'flow',
    'theta-token',
    'enjincoin',
    'decentraland',
    'the-sandbox',
    'axie-infinity',
    'looks-rare',
  ],
  gaming: [
    'axie-infinity',
    'the-sandbox',
    'gala',
    'illuvium',
    'stepn',
    'vulcan-forged',
    'ultra',
    'magic',
    'yield-guild-games',
    'merit-circle',
  ],
  'layer-1': [
    'bitcoin',
    'ethereum',
    'solana',
    'avalanche-2',
    'near',
    'aptos',
    'sui',
    'fantom',
    'tron',
    'cosmos',
  ],
  'layer-2': [
    'matic-network',
    'arbitrum',
    'optimism',
    'starknet',
    'immutable-x',
    'loopring',
    'metis-token',
    'mantle',
    'base',
    'scroll',
  ],
  meme: [
    'dogecoin',
    'shiba-inu',
    'pepe',
    'floki',
    'bonk',
    'dogwifcoin',
    'memecoin',
    'wojak',
    'book-of-meme',
    'brett',
  ],
  ai: [
    'render-token',
    'fetch-ai',
    'ocean-protocol',
    'singularitynet',
    'numeraire',
    'worldcoin-wld',
    'arkham',
    'bittensor',
    'phala-network',
    'cortex',
  ],
  exchange: [
    'binancecoin',
    'okb',
    'kucoin-shares',
    'crypto-com-chain',
    'huobi-token',
    'ftx-token',
    'bitget-token',
    'mx-token',
    'bitmax-token',
    'leo-token',
  ],
  stablecoin: [
    'tether',
    'usd-coin',
    'dai',
    'frax',
    'trueusd',
    'paxos-standard',
    'paypal-usd',
    'liquity-usd',
    'celo-dollar',
    'reserve-rights-token',
  ],
  privacy: [
    'monero',
    'zcash',
    'dash',
    'secret',
    'horizen',
    'verge',
    'beam',
    'decred',
    'pivx',
    'firo',
  ],
  storage: [
    'filecoin',
    'arweave',
    'storj',
    'siacoin',
    'bittorent',
    'internet-computer',
    'crust-network',
    'bluzelle',
    'opacity',
    'stratos',
  ],
  oracle: [
    'chainlink',
    'band-protocol',
    'api3',
    'uma',
    'tellor',
    'dia-data',
    'pyth-network',
    'flux',
    'nest-protocol',
    'razor-network',
  ],
};

interface CategoryPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { id } = await params;
  const category = CATEGORY_META[id];
  if (!category) return { title: 'Category Not Found' };

  return {
    title: `${category.name} Cryptocurrencies - Crypto Data Aggregator`,
    description: `Browse ${category.name} cryptocurrencies. ${category.description}`,
  };
}

export function generateStaticParams() {
  return Object.keys(CATEGORY_META).map((id) => ({ id }));
}

export default async function CategoryDetailPage({ params }: CategoryPageProps) {
  const { id } = await params;
  const category = CATEGORY_META[id];

  if (!category) {
    notFound();
  }

  const allCoins = await getTopCoins(250);
  const categoryCoins = CATEGORY_COINS[id] || [];

  // Filter coins that belong to this category
  const coins = allCoins.filter((coin) =>
    categoryCoins.some(
      (catCoin) =>
        coin.id.toLowerCase() === catCoin.toLowerCase() ||
        coin.symbol.toLowerCase() === catCoin.toLowerCase()
    )
  );

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
            <Link
              href="/markets/categories"
              className="hover:text-primary"
            >
              Categories
            </Link>
            <span>/</span>
            <span className="text-text-primary">{category.name}</span>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              {(() => {
                const Icon = getCategoryIcon(category.iconKey);
                return <Icon className="w-8 h-8 text-primary" />;
              })()}
              {category.name} Cryptocurrencies
            </h1>
            <p className="text-text-muted">
              {category.description} • {coins.length} coins
            </p>
          </div>

          {/* Coins Table */}
          {coins.length > 0 ? (
            <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
              <div className="overflow-x-auto scrollbar-hide">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-alt border-b border-surface-border">
                      <th className="text-left text-text-muted text-sm font-medium p-4">
                        #
                      </th>
                      <th className="text-left text-text-muted text-sm font-medium p-4">
                        Coin
                      </th>
                      <th className="text-right text-text-muted text-sm font-medium p-4">
                        Price
                      </th>
                      <th className="text-right text-text-muted text-sm font-medium p-4">
                        24h %
                      </th>
                      <th className="text-right text-text-muted text-sm font-medium p-4 hidden md:table-cell">
                        7d %
                      </th>
                      <th className="text-right text-text-muted text-sm font-medium p-4 hidden lg:table-cell">
                        Market Cap
                      </th>
                      <th className="text-right text-text-muted text-sm font-medium p-4 hidden lg:table-cell">
                        Volume (24h)
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {coins.map((coin, index) => (
                      <tr
                        key={coin.id}
                        className="border-b border-surface-border hover:bg-surface-hover transition-colors"
                      >
                        <td className="p-4 text-text-muted">{index + 1}</td>
                        <td className="p-4">
                          <Link href={`/coin/${coin.id}`} className="flex items-center gap-3">
                            <div className="relative w-8 h-8">
                              {coin.image && (
                                <Image
                                  src={coin.image}
                                  alt={coin.name}
                                  fill
                                  className="rounded-full object-cover"
                                  unoptimized
                                />
                              )}
                            </div>
                            <div>
                              <span className="font-medium text-text-primary hover:text-primary">
                                {coin.name}
                              </span>
                              <span className="text-text-muted text-sm ml-2">
                                {coin.symbol.toUpperCase()}
                              </span>
                            </div>
                          </Link>
                        </td>
                        <td className="p-4 text-right font-medium text-text-primary">
                          {formatPrice(coin.current_price)}
                        </td>
                        <td
                          className={`p-4 text-right font-medium ${
                            (coin.price_change_percentage_24h || 0) >= 0
                              ? 'text-gain'
                              : 'text-loss'
                          }`}
                        >
                          {formatPercent(coin.price_change_percentage_24h)}
                        </td>
                        <td
                          className={`p-4 text-right hidden md:table-cell ${
                            (coin.price_change_percentage_7d_in_currency || 0) >= 0
                              ? 'text-gain'
                              : 'text-loss'
                          }`}
                        >
                          {formatPercent(coin.price_change_percentage_7d_in_currency)}
                        </td>
                        <td className="p-4 text-right text-text-secondary hidden lg:table-cell">
                          ${formatNumber(coin.market_cap)}
                        </td>
                        <td className="p-4 text-right text-text-secondary hidden lg:table-cell">
                          ${formatNumber(coin.total_volume)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-surface rounded-xl border border-surface-border p-8 text-center">
              <div className="flex justify-center mb-4">
                <Search className="w-10 h-10 text-text-muted" />
              </div>
              <h3 className="text-lg font-semibold text-text-primary mb-2">
                No coins found
              </h3>
              <p className="text-text-muted">
                No cryptocurrencies available in this category at the moment.
              </p>
            </div>
          )}

          {/* Back link */}
          <div className="mt-8 text-center flex justify-center gap-6">
            <Link
              href="/markets/categories"
              className="text-primary hover:underline"
            >
              ← All Categories
            </Link>
            <Link href="/markets" className="text-primary hover:underline">
              Back to Markets
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
