/**
 * L2 Analytics Dashboard — Layer 2 Comparison & TVL Breakdown
 *
 * Compares Layer 2 networks across TVL, chain metrics, and ecosystem data.
 * Sources: DeFiLlama chains API.
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getL2Data,
  getChainsTvl,
  formatLargeNumber,
  formatCompactNumber,
  formatPercentChange,
  changeColor,
} from '@/lib/dashboard-data';
import type { Metadata } from 'next';
import { Layers, ArrowUpRight, Database, BarChart3, Network, Zap } from 'lucide-react';

export const metadata: Metadata = {
  title: 'L2 Analytics — Layer 2 Comparison & TVL Breakdown | Crypto Vision',
  description:
    'Compare Layer 2 networks like Arbitrum, Optimism, Base, and zkSync by TVL, ecosystem metrics, and performance data.',
};

export const revalidate = 120;

export default async function L2Page() {
  const [l2s, chains] = await Promise.all([getL2Data(), getChainsTvl()]);

  // Stats
  const totalL2Tvl = l2s.reduce((s, l) => s + l.tvl, 0);
  const totalChainTvl = chains.reduce((s, c) => s + c.tvl, 0);
  const l2Share = totalChainTvl > 0 ? (totalL2Tvl / totalChainTvl) * 100 : 0;

  // Top L1s for comparison
  const l1s = chains
    .filter((c) =>
      ['Ethereum', 'BSC', 'Solana', 'Tron', 'Bitcoin', 'Avalanche', 'Sui', 'Aptos', 'Near', 'Cardano'].includes(c.name)
    )
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />
        <main id="main-content" className="px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Layers size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">L2 Analytics</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Layer 2 comparison — TVL, ecosystem metrics & L1 context
              </p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Database size={14} className="text-sky-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  L2 Total TVL
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {formatLargeNumber(totalL2Tvl)}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={14} className="text-emerald-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  L2 / All Chains
                </span>
              </div>
              <div className="text-xl font-bold text-emerald-400">
                {l2Share.toFixed(1)}%
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Network size={14} className="text-purple-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  L2 Networks
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{l2s.length}</div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Zap size={14} className="text-amber-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  All Chains TVL
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {formatLargeNumber(totalChainTvl)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* L2 Rankings */}
            <div className="lg:col-span-8">
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Layers size={16} className="text-sky-400" />
                    Layer 2 Networks by TVL
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">{l2s.length} networks</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                        <th className="text-left px-4 py-2.5 font-medium">Network</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">
                          Category
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">TVL</th>
                        <th className="text-right px-4 py-2.5 font-medium">Market Share</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">
                          TVL Distribution
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {l2s.map((l, i) => {
                        const share = totalL2Tvl > 0 ? (l.tvl / totalL2Tvl) * 100 : 0;
                        return (
                          <tr
                            key={l.id}
                            className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                          >
                            <td className="px-4 py-3 text-[var(--text-muted)]">{i + 1}</td>
                            <td className="px-4 py-3">
                              <div className="font-medium text-[var(--text-primary)]">
                                {l.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400">
                                {l.category}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-medium text-[var(--text-primary)]">
                              {formatLargeNumber(l.tvl)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[var(--text-secondary)]">
                              {share.toFixed(1)}%
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden max-w-[120px]">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400"
                                    style={{ width: `${Math.max(share, 1)}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {l2s.length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    No L2 data available
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar — L1 Comparison */}
            <div className="lg:col-span-4 space-y-4">
              {/* L1 Chains for context */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    L1 Chains (For Context)
                  </h3>
                </div>
                <div className="p-2">
                  {l1s.map((chain) => (
                    <div
                      key={chain.name}
                      className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">
                          {chain.name}
                        </div>
                        {chain.tokenSymbol && (
                          <div className="text-xs text-[var(--text-muted)] font-mono">
                            {chain.tokenSymbol}
                          </div>
                        )}
                      </div>
                      <div className="text-sm font-mono text-[var(--text-primary)]">
                        {formatLargeNumber(chain.tvl)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Top All Chains */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    All Chains by TVL (Top 15)
                  </h3>
                </div>
                <div className="p-2">
                  {chains.slice(0, 15).map((chain, i) => {
                    const isL2 = l2s.some(
                      (l) => l.name.toLowerCase() === chain.name.toLowerCase()
                    );
                    return (
                      <div
                        key={chain.name}
                        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-[var(--text-muted)] w-5 text-right">
                            {i + 1}
                          </span>
                          <div className="text-sm text-[var(--text-primary)] truncate">
                            {chain.name}
                            {isL2 && (
                              <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400">
                                L2
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-sm font-mono text-[var(--text-secondary)] flex-shrink-0 ml-2">
                          {formatLargeNumber(chain.tvl)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
