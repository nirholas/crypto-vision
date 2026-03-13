/**
 * Macro Dashboard — Crypto vs TradFi Market Overview
 *
 * Cross-market dashboard bridging crypto and traditional finance:
 * - Total DeFi TVL and Stablecoin market cap
 * - Top crypto assets with 24h changes
 * - Protocol fees and DEX volumes
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getMacroData,
  getDexVolumes,
  getProtocolFees,
  formatLargeNumber,
  formatCompactNumber,
  formatPercentChange,
  changeColor,
  changeBg,
} from '@/lib/dashboard-data';
import type { Metadata } from 'next';
import { Globe, TrendingUp, DollarSign, BarChart3, Layers, ArrowUpDown } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Macro Dashboard — Crypto & DeFi Market Overview | Crypto Vision',
  description:
    'Cross-market dashboard with DeFi TVL, stablecoin metrics, crypto prices, DEX volumes, and protocol fees.',
};

export const revalidate = 120;

export default async function MacroPage() {
  const [macro, dexes, fees] = await Promise.all([
    getMacroData(),
    getDexVolumes(),
    getProtocolFees(),
  ]);

  const totalDexVol = dexes.reduce((s, d) => s + d.totalVolume24h, 0);
  const totalFees24h = fees.reduce((s, f) => s + f.total24h, 0);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />
        <main id="main-content" className="px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Globe size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Macro Dashboard</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Cross-market view — DeFi, stablecoins, protocol revenue & volumes
              </p>
            </div>
          </div>

          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              icon={<Layers size={16} className="text-cyan-400" />}
              label="Total DeFi TVL"
              value={formatLargeNumber(macro.defiTvl)}
              sub="Across all protocols"
            />
            <MetricCard
              icon={<DollarSign size={16} className="text-emerald-400" />}
              label="Stablecoin Market Cap"
              value={formatLargeNumber(macro.stablecoinMcap)}
              sub="USDT, USDC, DAI & more"
            />
            <MetricCard
              icon={<ArrowUpDown size={16} className="text-purple-400" />}
              label="24h DEX Volume"
              value={formatLargeNumber(totalDexVol)}
              sub={`${dexes.length} DEXs tracked`}
            />
            <MetricCard
              icon={<BarChart3 size={16} className="text-amber-400" />}
              label="24h Protocol Fees"
              value={formatLargeNumber(totalFees24h)}
              sub={`${fees.length} protocols`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Crypto Benchmarks */}
            <div className="lg:col-span-5">
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-400" />
                    Crypto Benchmarks
                  </h2>
                </div>
                <div className="p-2">
                  {macro.crypto
                    .sort((a, b) => b.price - a.price)
                    .map((coin) => (
                      <div
                        key={coin.symbol}
                        className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <div>
                          <div className="text-sm font-medium text-[var(--text-primary)]">
                            {coin.name}
                          </div>
                          <div className="text-xs text-[var(--text-muted)]">
                            {coin.symbol.slice(0, 3).toUpperCase()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono text-[var(--text-primary)]">
                            ${coin.price.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: coin.price < 1 ? 6 : 2,
                            })}
                          </div>
                          <span
                            className={`text-xs font-mono px-1.5 py-0.5 rounded ${changeBg(coin.changePercent)}`}
                          >
                            {formatPercentChange(coin.changePercent)}
                          </span>
                        </div>
                      </div>
                    ))}
                  {macro.crypto.length === 0 && (
                    <div className="p-6 text-center text-[var(--text-muted)] text-sm">
                      Price data unavailable
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* DEX Volumes + Fees */}
            <div className="lg:col-span-7 space-y-4">
              {/* DEX Volumes */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Top DEXs by 24h Volume
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">
                    Total: {formatLargeNumber(totalDexVol)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                        <th className="text-left px-4 py-2.5 font-medium">Protocol</th>
                        <th className="text-right px-4 py-2.5 font-medium">24h Volume</th>
                        <th className="text-right px-4 py-2.5 font-medium">24h Δ</th>
                        <th className="text-left px-4 py-2.5 font-medium hidden md:table-cell">
                          Chains
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dexes.slice(0, 15).map((dex, i) => (
                        <tr
                          key={dex.name}
                          className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                            {dex.name}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {formatLargeNumber(dex.totalVolume24h)}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-xs font-mono ${changeColor(dex.change_1d)}`}>
                              {formatPercentChange(dex.change_1d)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 hidden md:table-cell">
                            <div className="flex flex-wrap gap-1">
                              {dex.chains.slice(0, 3).map((chain) => (
                                <span
                                  key={chain}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-alt)] text-[var(--text-muted)]"
                                >
                                  {chain}
                                </span>
                              ))}
                              {dex.chains.length > 3 && (
                                <span className="text-[10px] text-[var(--text-muted)]">
                                  +{dex.chains.length - 3}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Protocol Fees */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                    Top Protocols by 24h Fees
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">
                    Total: {formatLargeNumber(totalFees24h)}
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium w-8">#</th>
                        <th className="text-left px-4 py-2.5 font-medium">Protocol</th>
                        <th className="text-right px-4 py-2.5 font-medium">24h Fees</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                          7d Fees
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium">Δ 1d</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fees.slice(0, 15).map((f, i) => (
                        <tr
                          key={f.name}
                          className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">{i + 1}</td>
                          <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                            {f.name}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {formatLargeNumber(f.total24h)}
                          </td>
                          <td className="px-4 py-2.5 text-right hidden md:table-cell font-mono text-[var(--text-secondary)]">
                            {f.total7d > 0 ? formatLargeNumber(f.total7d) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-xs font-mono ${changeColor(f.change_1d)}`}>
                              {formatPercentChange(f.change_1d)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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

function MetricCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-xl font-bold text-[var(--text-primary)]">{value}</div>
      <div className="text-xs text-[var(--text-muted)] mt-1">{sub}</div>
    </div>
  );
}
