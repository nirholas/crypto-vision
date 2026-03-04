/**
 * DeFi Dashboard Page
 * Comprehensive DeFi data: protocols, yields, chains, TVL
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import ShareButtons from '@/components/ShareButtons';
import MarketMoodWidget from '@/components/MarketMoodWidget';
import { getTopProtocols, getTopChains, formatNumber, formatPercent } from '@/lib/market-data';
import { getDefiNews } from '@/lib/crypto-news';
import Posts from '@/components/Posts';
import ProtocolImage from '@/components/ProtocolImage';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DeFi Dashboard - Protocol Rankings & TVL',
  description:
    'Live DeFi data - Protocol TVL rankings, chain analytics, yield opportunities, and DeFi news.',
  openGraph: {
    title: 'DeFi Dashboard 🏦💰',
    description: 'Live DeFi protocol rankings, chain TVL analytics, and yield opportunities',
    images: [{
      url: '/api/og?type=page&title=DeFi%20Dashboard&subtitle=Protocol%20Rankings%20%26%20TVL%20Analytics',
      width: 1200,
      height: 630,
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DeFi Dashboard 🏦💰',
    description: 'Live DeFi protocol rankings, chain TVL analytics, and yield opportunities',
    images: ['/api/og?type=page&title=DeFi%20Dashboard&subtitle=Protocol%20Rankings%20%26%20TVL%20Analytics'],
  },
};

export const revalidate = 60; // Revalidate every minute

export default async function DefiPage() {
  const [protocols, chains, newsData] = await Promise.all([
    getTopProtocols(30),
    getTopChains(15),
    getDefiNews(10),
  ]);

  // Calculate total TVL
  const totalTVL = protocols.reduce((sum, p) => sum + (p.tvl || 0), 0);
  const totalChainTVL = chains.reduce((sum, c) => sum + (c.tvl || 0), 0);

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />

        <main className="px-4 py-8">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <svg
                  className="w-8 h-8 text-text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <h1 className="text-4xl font-bold text-text-primary">DeFi Dashboard</h1>
              </div>
              <ShareButtons
                url="/defi"
                title="Check out the DeFi Dashboard - Live TVL rankings! 🏦"
                variant="compact"
              />
            </div>
            <p className="text-text-secondary mt-2">
              Live DeFi protocol rankings, chain TVL, and yield opportunities
            </p>
          </div>

          {/* Market Mood Widget */}
          <div className="mb-6">
            <MarketMoodWidget />
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
              <p className="text-text-muted text-sm">Total DeFi TVL</p>
              <p className="text-2xl font-bold text-text-primary">${formatNumber(totalTVL)}</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
              <p className="text-text-muted text-sm">Top Protocols</p>
              <p className="text-2xl font-bold text-text-primary">{protocols.length}+</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
              <p className="text-text-muted text-sm">Active Chains</p>
              <p className="text-2xl font-bold text-text-primary">{chains.length}+</p>
            </div>
            <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
              <p className="text-text-muted text-sm">Chain TVL</p>
              <p className="text-2xl font-bold text-text-primary">${formatNumber(totalChainTVL)}</p>
            </div>
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Protocols Table (2/3) */}
            <div className="lg:col-span-2">
              <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
                <div className="p-4 border-b border-surface-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                    <div>
                      <h2 className="font-bold text-lg text-text-primary">Top DeFi Protocols</h2>
                      <p className="text-sm text-text-muted">Ranked by Total Value Locked</p>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-surface-border bg-surface-alt text-sm">
                        <th className="text-left text-text-muted font-medium p-4">#</th>
                        <th className="text-left text-text-muted font-medium p-4">Protocol</th>
                        <th className="text-right text-text-muted font-medium p-4">TVL</th>
                        <th className="text-right text-text-muted font-medium p-4 hidden sm:table-cell">
                          1d %
                        </th>
                        <th className="text-right text-text-muted font-medium p-4 hidden md:table-cell">
                          7d %
                        </th>
                        <th className="text-left text-text-muted font-medium p-4 hidden lg:table-cell">
                          Category
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {protocols.map((protocol, index) => (
                        <tr
                          key={protocol.id}
                          className="border-b border-surface-border hover:bg-surface-alt transition"
                        >
                          <td className="p-4 text-text-muted">{index + 1}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              {protocol.logo && (
                                <ProtocolImage
                                  src={protocol.logo}
                                  alt={protocol.name}
                                  className="w-8 h-8 rounded-full"
                                />
                              )}
                              <div>
                                <span className="font-medium text-text-primary">
                                  {protocol.name}
                                </span>
                                {protocol.symbol && (
                                  <span className="text-text-muted text-sm ml-2">
                                    {protocol.symbol}
                                  </span>
                                )}
                                <div className="text-xs text-text-secondary">{protocol.chain}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-right font-medium text-text-primary">
                            ${formatNumber(protocol.tvl)}
                          </td>
                          <td
                            className={`p-4 text-right hidden sm:table-cell ${(protocol.change_1d || 0) >= 0 ? 'text-text-primary font-semibold' : 'text-text-muted'}`}
                          >
                            {formatPercent(protocol.change_1d)}
                          </td>
                          <td
                            className={`p-4 text-right hidden md:table-cell ${(protocol.change_7d || 0) >= 0 ? 'text-text-primary font-semibold' : 'text-text-muted'}`}
                          >
                            {formatPercent(protocol.change_7d)}
                          </td>
                          <td className="p-4 hidden lg:table-cell">
                            <span className="text-xs bg-surface-alt text-text-secondary px-2 py-1 rounded-full">
                              {protocol.category}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar (1/3) */}
            <div className="space-y-6">
              {/* Chains TVL */}
              <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
                <div className="p-4 border-b border-surface-border">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5 text-text-primary"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <div>
                      <h2 className="font-bold text-lg text-text-primary">Chain TVL</h2>
                      <p className="text-sm text-text-muted">Total Value Locked by blockchain</p>
                    </div>
                  </div>
                </div>
                <div className="divide-y divide-surface-border">
                  {chains.slice(0, 10).map((chain, index) => (
                    <div
                      key={chain.name}
                      className="flex items-center justify-between p-4 hover:bg-surface-alt transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-text-muted text-sm w-5">{index + 1}</span>
                        <div>
                          <span className="font-medium text-text-primary">{chain.name}</span>
                          {chain.tokenSymbol && (
                            <span className="text-text-muted text-xs ml-1">
                              ({chain.tokenSymbol})
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-medium text-text-primary">
                        ${formatNumber(chain.tvl)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-surface rounded-xl border border-surface-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg
                    className="w-5 h-5 text-text-primary"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <h3 className="font-bold text-text-primary">Quick Links</h3>
                </div>
                <div className="space-y-2">
                  <Link href="/category/defi" className="block text-text-primary hover:underline">
                    DeFi News →
                  </Link>
                  <Link href="/topic/layer2" className="block text-text-primary hover:underline">
                    Layer 2 News →
                  </Link>
                  <Link
                    href="/topic/stablecoin"
                    className="block text-text-primary hover:underline"
                  >
                    Stablecoin News →
                  </Link>
                  <a
                    href="https://defillama.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-text-primary hover:underline"
                  >
                    DeFiLlama ↗
                  </a>
                </div>
              </div>

              {/* Data Source */}
              <div className="text-center text-text-muted text-sm">
                <p>
                  Data from{' '}
                  <a
                    href="https://defillama.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-text-primary hover:underline"
                  >
                    DeFiLlama
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* DeFi News Section */}
          <div className="mt-12">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <svg
                  className="w-6 h-6 text-text-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
                  />
                </svg>
                <h2 className="text-2xl font-bold text-text-primary">Latest DeFi News</h2>
              </div>
              <Link href="/category/defi" className="text-text-primary hover:underline">
                View All →
              </Link>
            </div>
            <Posts articles={newsData.articles} />
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
