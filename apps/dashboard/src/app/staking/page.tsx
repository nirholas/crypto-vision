/**
 * Staking Dashboard — DeFi Yields & Liquid Staking
 *
 * Comprehensive staking overview powered by DeFiLlama:
 * - Top staking/liquid staking yields sorted by TVL
 * - Chain breakdown, APY comparison
 * - Staking calculator
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getStakingYields,
  getDefiYields,
  formatLargeNumber,
  formatCompactNumber,
  formatPercentChange,
  changeColor,
} from '@/lib/dashboard-data';
import type { Metadata } from 'next';
import { Shield, Percent, TrendingUp, Lock, Database, Gem } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Staking — DeFi Yields & Liquid Staking Overview | Crypto Vision',
  description:
    'Compare staking yields across Lido, Rocket Pool, Coinbase, and 50+ protocols. Liquid staking APY, TVL, and chain breakdown.',
};

export const revalidate = 120;

export default async function StakingPage() {
  const [staking, yields] = await Promise.all([getStakingYields(), getDefiYields()]);

  // Stats
  const totalStakingTvl = staking.reduce((s, y) => s + y.tvlUsd, 0);
  const avgApy =
    staking.length > 0 ? staking.reduce((s, y) => s + y.apy, 0) / staking.length : 0;
  const topProject = staking[0];

  // Chain distribution
  const chainMap = new Map<string, { count: number; totalTvl: number }>();
  for (const s of staking) {
    const existing = chainMap.get(s.chain) || { count: 0, totalTvl: 0 };
    chainMap.set(s.chain, {
      count: existing.count + 1,
      totalTvl: existing.totalTvl + s.tvlUsd,
    });
  }
  const chainDistribution = [...chainMap.entries()]
    .sort((a, b) => b[1].totalTvl - a[1].totalTvl)
    .slice(0, 10);

  // Top yield pools (non-staking)
  const topYields = yields
    .filter((y) => y.apy > 1 && y.apy < 100 && y.tvlUsd > 5_000_000)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 15);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />
        <main id="main-content" className="px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Staking</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Liquid staking yields, TVL breakdown & DeFi yield comparison
              </p>
            </div>
          </div>

          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Lock size={14} className="text-violet-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Staking TVL
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {formatLargeNumber(totalStakingTvl)}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Percent size={14} className="text-emerald-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Avg APY
                </span>
              </div>
              <div className="text-xl font-bold text-emerald-400">{avgApy.toFixed(2)}%</div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Database size={14} className="text-cyan-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Protocols
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">{staking.length}</div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Gem size={14} className="text-amber-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Top Protocol
                </span>
              </div>
              <div className="text-lg font-bold text-[var(--text-primary)] truncate">
                {topProject?.project || '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Staking Table */}
            <div className="lg:col-span-8">
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Shield size={16} className="text-violet-400" />
                    Staking & Liquid Staking Protocols
                  </h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                        <th className="text-left px-4 py-2.5 font-medium">Protocol</th>
                        <th className="text-left px-4 py-2.5 font-medium">Chain</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">
                          Asset
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">APY</th>
                        <th className="text-right px-4 py-2.5 font-medium">TVL</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">
                          Base APY
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">
                          Reward APY
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {staking.map((s, i) => (
                        <tr
                          key={`${s.pool}-${i}`}
                          className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                            {s.project}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-[var(--surface-alt)] text-[var(--text-secondary)]">
                              {s.chain}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell text-[var(--text-secondary)] font-mono text-xs">
                            {s.symbol}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className="font-mono font-medium text-emerald-400">
                              {s.apy.toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {formatLargeNumber(s.tvlUsd)}
                          </td>
                          <td className="px-4 py-2.5 text-right hidden lg:table-cell font-mono text-[var(--text-muted)]">
                            {s.apyBase != null ? s.apyBase.toFixed(2) + '%' : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right hidden lg:table-cell font-mono text-[var(--text-muted)]">
                            {s.apyReward != null ? s.apyReward.toFixed(2) + '%' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {staking.length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    No staking data available
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Chain Distribution */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  TVL by Chain
                </h3>
                {chainDistribution.map(([chain, data]) => {
                  const pct = totalStakingTvl > 0 ? (data.totalTvl / totalStakingTvl) * 100 : 0;
                  return (
                    <div key={chain}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--text-secondary)]">
                          {chain}{' '}
                          <span className="text-[var(--text-muted)]">({data.count})</span>
                        </span>
                        <span className="font-mono text-[var(--text-primary)]">
                          {formatLargeNumber(data.totalTvl)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Top DeFi Yields */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <TrendingUp size={14} className="text-emerald-400" />
                    Top DeFi Yields
                  </h3>
                </div>
                <div className="p-2">
                  {topYields.map((y, i) => (
                    <div
                      key={`yield-${y.pool}-${i}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                          {y.project}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                          <span>{y.chain}</span>
                          <span>·</span>
                          <span className="truncate max-w-[100px]">{y.symbol}</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-sm font-mono font-medium text-emerald-400">
                          {y.apy.toFixed(2)}%
                        </div>
                        <div className="text-xs font-mono text-[var(--text-muted)]">
                          {formatLargeNumber(y.tvlUsd)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {topYields.length === 0 && (
                    <div className="p-4 text-center text-[var(--text-muted)] text-sm">
                      No yield data available
                    </div>
                  )}
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
