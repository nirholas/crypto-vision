/**
 * NFT Dashboard — Collections, Floor Prices & Market Overview
 *
 * NFT market data from CoinGecko with collection listings.
 * Shows top collections, platform distribution, and market trends.
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getNFTList, type NFTCollection } from '@/lib/dashboard-data';
import type { Metadata } from 'next';
import { Image, Palette, Grid3X3, Sparkles, ExternalLink } from 'lucide-react';

export const metadata: Metadata = {
  title: 'NFT Dashboard — Collections & Market Overview | Crypto Vision',
  description:
    'Browse top NFT collections, floor prices, market volumes, and platform breakdown across Ethereum, Solana, Bitcoin Ordinals, and more.',
};

export const revalidate = 120;

export default async function NFTPage() {
  const collections = await getNFTList(200);

  // Platform distribution
  const platformMap = new Map<string, number>();
  for (const c of collections) {
    const platform = c.asset_platform_id || 'unknown';
    platformMap.set(platform, (platformMap.get(platform) || 0) + 1);
  }
  const platforms = [...platformMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />
        <main id="main-content" className="px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/20">
              <Palette size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">NFT Market</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Top collections, platform breakdown & market overview
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Grid3X3 size={14} className="text-fuchsia-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Collections
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {collections.length}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-amber-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Platforms
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {platforms.length}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Image size={14} className="text-cyan-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Top Platform
                </span>
              </div>
              <div className="text-lg font-bold text-[var(--text-primary)] truncate">
                {platforms[0]?.[0] || '—'}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <ExternalLink size={14} className="text-emerald-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Data Source
                </span>
              </div>
              <div className="text-lg font-bold text-[var(--text-primary)]">CoinGecko</div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Collections Grid */}
            <div className="lg:col-span-8">
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Palette size={16} className="text-fuchsia-400" />
                    NFT Collections
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">
                    {collections.length} indexed
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                        <th className="text-left px-4 py-2.5 font-medium">Collection</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">
                          Symbol
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium">Platform</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">
                          Contract
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {collections.slice(0, 100).map((c, i) => (
                        <tr
                          key={c.id}
                          className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{i + 1}</td>
                          <td className="px-4 py-2.5">
                            <div className="font-medium text-[var(--text-primary)]">{c.name}</div>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell font-mono text-xs text-[var(--text-muted)]">
                            {c.symbol || '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-500/10 text-fuchsia-400">
                              {c.asset_platform_id || 'unknown'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell">
                            {c.contract_address ? (
                              <span className="font-mono text-xs text-[var(--text-muted)]">
                                {c.contract_address.slice(0, 8)}…
                                {c.contract_address.slice(-6)}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {collections.length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    No NFT data available
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Platform Distribution */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Collections by Platform
                </h3>
                {platforms.map(([platform, count]) => {
                  const pct =
                    collections.length > 0 ? (count / collections.length) * 100 : 0;
                  return (
                    <div key={platform}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)] capitalize">
                          {platform.replace(/-/g, ' ')}
                        </span>
                        <span className="font-mono text-[var(--text-primary)]">
                          {count} ({pct.toFixed(0)}%)
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-violet-500"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Info Card */}
              <div className="rounded-xl bg-gradient-to-br from-fuchsia-500/10 to-violet-500/5 border border-fuchsia-500/20 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-fuchsia-400">About NFT Data</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  NFT collection data is sourced from CoinGecko&apos;s free API. The list
                  includes top collections ranked by market capitalization across Ethereum,
                  Solana, Polygon, and other chains.
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Floor prices and volume data require CoinGecko Pro API. Detailed collection
                  analytics including sales history, trait pricing, and rarity scores are
                  available via the Reservoir API integration.
                </p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
