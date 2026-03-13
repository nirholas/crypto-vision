/**
 * Whale Tracker Dashboard — Bitcoin On-Chain Analytics & Mempool
 *
 * Real-time Bitcoin blockchain data from mempool.space and blockchain.info:
 * - Network stats (hash rate, difficulty, block height)
 * - Mempool state (pending transactions, size)
 * - Recent blocks with transaction counts
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getBitcoinWhaleData,
  getRecentBlocks,
  formatLargeNumber,
  formatCompactNumber,
} from '@/lib/dashboard-data';
import type { Metadata } from 'next';
import { Anchor, Cpu, HardDrive, Layers, Zap, Clock, Hash, Box } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Whale Tracker — On-Chain Analytics & Bitcoin Network | Crypto Vision',
  description:
    'Track Bitcoin whale activity, network stats, mempool state, and recent blocks in real-time.',
};

export const revalidate = 60;

export default async function WhalesPage() {
  const [stats, blocks] = await Promise.all([getBitcoinWhaleData(), getRecentBlocks()]);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />
        <main id="main-content" className="px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Anchor size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                Whale Tracker
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Bitcoin network stats, mempool analytics & recent blocks
              </p>
            </div>
          </div>

          {/* Network Stats Grid */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <StatCard
                icon={<Zap size={16} className="text-amber-400" />}
                label="BTC Price"
                value={stats.marketPrice > 0 ? `$${stats.marketPrice.toLocaleString()}` : '—'}
              />
              <StatCard
                icon={<Cpu size={16} className="text-blue-400" />}
                label="Hash Rate"
                value={
                  stats.hashRate > 0
                    ? formatCompactNumber(stats.hashRate / 1e18) + ' EH/s'
                    : '—'
                }
              />
              <StatCard
                icon={<HardDrive size={16} className="text-purple-400" />}
                label="Difficulty Adj"
                value={
                  stats.difficulty !== 0
                    ? (stats.difficulty > 0 ? '+' : '') + stats.difficulty.toFixed(2) + '%'
                    : '—'
                }
              />
              <StatCard
                icon={<Layers size={16} className="text-emerald-400" />}
                label="Block Height"
                value={
                  stats.latestBlock > 0 ? stats.latestBlock.toLocaleString() : '—'
                }
              />
              <StatCard
                icon={<Clock size={16} className="text-cyan-400" />}
                label="Mempool TXs"
                value={
                  stats.mempoolTxCount > 0
                    ? stats.mempoolTxCount.toLocaleString()
                    : '—'
                }
              />
              <StatCard
                icon={<Hash size={16} className="text-pink-400" />}
                label="Mempool Size"
                value={
                  stats.mempoolSize > 0
                    ? (stats.mempoolSize / 1_000_000).toFixed(1) + ' MB'
                    : '—'
                }
              />
            </div>
          )}

          {!stats && (
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-8 text-center">
              <p className="text-[var(--text-muted)]">
                Unable to load Bitcoin network data. Please try again later.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Recent Blocks */}
            <div className="lg:col-span-8">
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Box size={16} className="text-orange-400" />
                    Recent Blocks
                  </h2>
                  <span className="text-xs text-[var(--text-muted))]">
                    {blocks.length} blocks
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium">Height</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden sm:table-cell">
                          Hash
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">Transactions</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                          Size
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blocks.map((block) => (
                        <tr
                          key={block.id}
                          className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono font-medium text-amber-400">
                              {block.height.toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3 hidden sm:table-cell">
                            <span className="font-mono text-xs text-[var(--text-muted)] truncate max-w-[200px] block">
                              {block.id.slice(0, 16)}…{block.id.slice(-8)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div
                                className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                                style={{
                                  width: `${Math.min(100, (block.tx_count / 4000) * 100)}%`,
                                  minWidth: '8px',
                                  maxWidth: '60px',
                                }}
                              />
                              <span className="font-mono text-[var(--text-primary)]">
                                {block.tx_count.toLocaleString()}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-[var(--text-secondary)]">
                            {(block.size / 1_000_000).toFixed(2)} MB
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--text-muted)]">
                            {getTimeAgo(block.timestamp)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {blocks.length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    No recent blocks available
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar — Network Health */}
            <div className="lg:col-span-4 space-y-4">
              {/* Bitcoin Supply Info */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-4">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Bitcoin Supply
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
                      <span>Mined Supply</span>
                      <span>~19.8M / 21M</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                        style={{ width: '94.3%' }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Max Supply</div>
                      <div className="font-mono text-[var(--text-primary)]">21,000,000</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Block Reward</div>
                      <div className="font-mono text-[var(--text-primary)]">3.125 BTC</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Next Halving</div>
                      <div className="font-mono text-[var(--text-primary)]">~2028</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Halvings</div>
                      <div className="font-mono text-[var(--text-primary)]">4 completed</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mempool Heat */}
              {stats && stats.mempoolTxCount > 0 && (
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Mempool Status
                  </h3>
                  <div className="space-y-2">
                    <MempoolBar
                      label="Pending TXs"
                      value={stats.mempoolTxCount}
                      max={200000}
                      color="from-cyan-500 to-blue-500"
                    />
                    <MempoolBar
                      label="Size (vMB)"
                      value={Math.round(stats.mempoolSize / 1_000_000)}
                      max={300}
                      color="from-purple-500 to-pink-500"
                    />
                  </div>
                  <div className="text-xs text-[var(--text-muted)] pt-1">
                    {stats.mempoolTxCount > 50000
                      ? '⚠️ High congestion — fees may be elevated'
                      : stats.mempoolTxCount > 20000
                        ? '⏳ Moderate activity'
                        : '✅ Low congestion — low fees expected'}
                  </div>
                </div>
              )}

              {/* Block Stats */}
              {blocks.length > 0 && (
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Block Statistics
                  </h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Avg TXs/Block</div>
                      <div className="font-mono text-[var(--text-primary)]">
                        {Math.round(
                          blocks.reduce((s, b) => s + b.tx_count, 0) / blocks.length
                        ).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Avg Block Size</div>
                      <div className="font-mono text-[var(--text-primary)]">
                        {(
                          blocks.reduce((s, b) => s + b.size, 0) /
                          blocks.length /
                          1_000_000
                        ).toFixed(2)}{' '}
                        MB
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Avg Weight</div>
                      <div className="font-mono text-[var(--text-primary)]">
                        {(
                          blocks.reduce((s, b) => s + b.weight, 0) /
                          blocks.length /
                          1_000_000
                        ).toFixed(2)}{' '}
                        MWU
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--text-muted)]">Latest Block</div>
                      <div className="font-mono text-amber-400">
                        #{blocks[0]?.height.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}

/* ─── Helper Components ─────────────────────────────────────────────── */

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-bold font-mono text-[var(--text-primary)]">{value}</div>
    </div>
  );
}

function MempoolBar({
  label,
  value,
  max,
  color,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-xs text-[var(--text-muted)] mb-1">
        <span>{label}</span>
        <span className="font-mono">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full bg-[var(--surface-alt)] overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function getTimeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
