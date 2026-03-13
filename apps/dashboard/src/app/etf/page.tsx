/**
 * ETF Dashboard — BTC & ETH Spot ETF Tracker
 *
 * Tracks Bitcoin and Ethereum spot ETF products with:
 * - BTC/ETH benchmark prices and 24h changes
 * - ETF product listings (IBIT, FBTC, GBTC, etc.)
 * - Comparative overview cards
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getETFData,
  formatLargeNumber,
  formatPercentChange,
  changeColor,
  changeBg,
} from '@/lib/dashboard-data';
import type { Metadata } from 'next';
import { Briefcase, TrendingUp, TrendingDown, ArrowUpRight, Bitcoin } from 'lucide-react';

export const metadata: Metadata = {
  title: 'ETF Tracker — BTC & ETH Spot ETF Flows & Performance | Crypto Vision',
  description:
    'Track Bitcoin and Ethereum spot ETF products including IBIT, FBTC, GBTC, ETHA, and more with real-time pricing data.',
};

export const revalidate = 60;

export default async function ETFPage() {
  const etfData = await getETFData();

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />
        <main id="main-content" className="px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Briefcase size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">
                Spot ETF Tracker
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Bitcoin & Ethereum Spot ETF products — real-time pricing
              </p>
            </div>
          </div>

          {/* Benchmark Price Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* BTC Card */}
            <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Bitcoin size={24} className="text-amber-400" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">Bitcoin</div>
                    <div className="text-sm text-[var(--text-muted)]">BTC Spot ETFs</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                    {etfData.btcPrice > 0
                      ? `$${etfData.btcPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                      : '—'}
                  </div>
                  <div className={`text-sm font-mono ${changeColor(etfData.btcChange)}`}>
                    {formatPercentChange(etfData.btcChange)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>{etfData.btcEtfs.length} ETF products tracked</span>
                <span>·</span>
                <span>IBIT · FBTC · GBTC · ARKB · BITB + more</span>
              </div>
            </div>

            {/* ETH Card */}
            <div className="rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/5 border border-blue-500/20 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <svg viewBox="0 0 256 417" width="24" height="24" className="text-blue-400">
                      <path fill="currentColor" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" opacity="0.6"/>
                      <path fill="currentColor" d="M127.962 0L0 212.32l127.962 75.639V154.158z"/>
                      <path fill="currentColor" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z" opacity="0.6"/>
                      <path fill="currentColor" d="M127.962 416.905v-104.72L0 236.585z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-[var(--text-primary)]">Ethereum</div>
                    <div className="text-sm text-[var(--text-muted)]">ETH Spot ETFs</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono text-[var(--text-primary)]">
                    {etfData.ethPrice > 0
                      ? `$${etfData.ethPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                      : '—'}
                  </div>
                  <div className={`text-sm font-mono ${changeColor(etfData.ethChange)}`}>
                    {formatPercentChange(etfData.ethChange)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>{etfData.ethEtfs.length} ETF products tracked</span>
                <span>·</span>
                <span>ETHA · FETH · ETHE · ETHV + more</span>
              </div>
            </div>
          </div>

          {/* BTC ETF Table */}
          {etfData.btcEtfs.length > 0 && (
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Bitcoin Spot ETFs
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                      <th className="text-left px-4 py-2.5 font-medium">Ticker</th>
                      <th className="text-left px-4 py-2.5 font-medium">Name</th>
                      <th className="text-right px-4 py-2.5 font-medium">BTC Price</th>
                      <th className="text-right px-4 py-2.5 font-medium">24h Change</th>
                      <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                        Volume
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfData.btcEtfs.map((etf) => (
                      <tr
                        key={etf.symbol}
                        className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-amber-400">{etf.symbol}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{etf.name}</td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                          ${etf.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${changeBg(etf.changePercent)}`}
                          >
                            {formatPercentChange(etf.changePercent)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-[var(--text-secondary)]">
                          {etf.volume > 0 ? formatLargeNumber(etf.volume) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ETH ETF Table */}
          {etfData.ethEtfs.length > 0 && (
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Ethereum Spot ETFs
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                      <th className="text-left px-4 py-2.5 font-medium">Ticker</th>
                      <th className="text-left px-4 py-2.5 font-medium">Name</th>
                      <th className="text-right px-4 py-2.5 font-medium">ETH Price</th>
                      <th className="text-right px-4 py-2.5 font-medium">24h Change</th>
                      <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                        Volume
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {etfData.ethEtfs.map((etf) => (
                      <tr
                        key={etf.symbol}
                        className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-blue-400">{etf.symbol}</span>
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{etf.name}</td>
                        <td className="px-4 py-3 text-right font-mono text-[var(--text-primary)]">
                          ${etf.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${changeBg(etf.changePercent)}`}
                          >
                            {formatPercentChange(etf.changePercent)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden md:table-cell font-mono text-[var(--text-secondary)]">
                          {etf.volume > 0 ? formatLargeNumber(etf.volume) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Info Banner */}
          <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
            <div className="flex items-start gap-3">
              <ArrowUpRight size={16} className="text-[var(--text-muted)] mt-0.5 flex-shrink-0" />
              <div className="text-xs text-[var(--text-muted)] leading-relaxed">
                <strong>Note:</strong> ETF prices shown are based on the underlying asset
                (BTC/ETH) spot price. Actual ETF share prices may differ due to NAV premiums,
                management fees, and trading hours. Data updates every 60 seconds.
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
