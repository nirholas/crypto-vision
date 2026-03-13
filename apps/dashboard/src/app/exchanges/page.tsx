/**
 * Exchanges Dashboard — Rankings, Volume & Trust Scores
 *
 * Comprehensive exchange comparison using CoinGecko data with
 * trust score, 24h volume, country, and normalized metrics.
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getExchanges, formatNumber, type Exchange } from '@/lib/market-data';
import { formatLargeNumber } from '@/lib/dashboard-data';
import type { Metadata } from 'next';
import {
  Building2,
  TrendingUp,
  Shield,
  Globe,
  BarChart3,
  Star,
  ArrowUpRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Exchanges — Rankings & Volume | Crypto Vision',
  description:
    'Compare crypto exchanges by trust score, 24h trading volume, country, and normalized metrics. Real-time data from CoinGecko.',
};

export const revalidate = 120;

function trustColor(score: number): string {
  if (score >= 8) return 'text-emerald-400';
  if (score >= 5) return 'text-amber-400';
  return 'text-red-400';
}

function trustBg(score: number): string {
  if (score >= 8) return 'bg-emerald-500/15 border-emerald-500/30';
  if (score >= 5) return 'bg-amber-500/15 border-amber-500/30';
  return 'bg-red-500/15 border-red-500/30';
}

function trustBar(score: number): string {
  if (score >= 8) return 'bg-gradient-to-r from-emerald-500 to-green-400';
  if (score >= 5) return 'bg-gradient-to-r from-amber-500 to-yellow-400';
  return 'bg-gradient-to-r from-red-500 to-orange-400';
}

export default async function ExchangesPage() {
  const exchanges = await getExchanges(250, 1);

  const btcPrice = 100000; // approximate for display conversion
  const totalVol = exchanges.reduce((s, e) => s + (e.trade_volume_24h_btc || 0), 0);
  const avgTrust =
    exchanges.length > 0
      ? exchanges.reduce((s, e) => s + (e.trust_score || 0), 0) / exchanges.length
      : 0;

  // Country distribution
  const countryMap = new Map<string, number>();
  for (const ex of exchanges) {
    const country = ex.country || 'Unknown';
    countryMap.set(country, (countryMap.get(country) || 0) + 1);
  }
  const countries = [...countryMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />
        <main id="main-content" className="px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Building2 size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Exchanges</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Trust scores, volumes & rankings for {exchanges.length} exchanges
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Building2 size={14} className="text-blue-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Exchanges
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {exchanges.length}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 size={14} className="text-cyan-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  24h Volume (BTC)
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {formatLargeNumber(totalVol)}
              </div>
              <div className="text-xs text-[var(--text-muted)]">
                ≈ ${formatLargeNumber(totalVol * btcPrice)}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Shield size={14} className="text-emerald-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Avg Trust
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {avgTrust.toFixed(1)}/10
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="flex items-center gap-2 mb-1">
                <Globe size={14} className="text-violet-400" />
                <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">
                  Countries
                </span>
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {countries.length}+
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Table */}
            <div className="lg:col-span-8">
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Star size={16} className="text-amber-400" />
                    Exchange Rankings
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">By Trust Score Rank</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium w-10">#</th>
                        <th className="text-left px-4 py-2.5 font-medium">Exchange</th>
                        <th className="text-center px-4 py-2.5 font-medium">Trust</th>
                        <th className="text-right px-4 py-2.5 font-medium">24h Vol (BTC)</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                          Normalized
                        </th>
                        <th className="text-left px-4 py-2.5 font-medium hidden lg:table-cell">
                          Country
                        </th>
                        <th className="text-center px-4 py-2.5 font-medium hidden lg:table-cell">
                          Est.
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {exchanges.slice(0, 100).map((ex) => (
                        <tr
                          key={ex.id}
                          className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <td className="px-4 py-2.5 text-[var(--text-muted)]">
                            {ex.trust_score_rank}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {ex.image && (
                                <img
                                  src={ex.image}
                                  alt=""
                                  width={20}
                                  height={20}
                                  className="rounded-full"
                                  loading="lazy"
                                />
                              )}
                              <div>
                                <div className="font-medium text-[var(--text-primary)] flex items-center gap-1">
                                  {ex.name}
                                  <a
                                    href={ex.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300"
                                  >
                                    <ArrowUpRight size={12} />
                                  </a>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <div className="flex flex-col items-center gap-1">
                              <span
                                className={`text-xs font-bold px-2 py-0.5 rounded-full border ${trustBg(ex.trust_score)}`}
                              >
                                <span className={trustColor(ex.trust_score)}>
                                  {ex.trust_score ?? '—'}
                                </span>
                              </span>
                              <div className="w-12 h-1 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${trustBar(ex.trust_score)}`}
                                  style={{ width: `${(ex.trust_score ?? 0) * 10}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            {formatNumber(ex.trade_volume_24h_btc)}
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-muted)] hidden md:table-cell">
                            {formatNumber(ex.trade_volume_24h_btc_normalized)}
                          </td>
                          <td className="px-4 py-2.5 hidden lg:table-cell text-[var(--text-secondary)]">
                            {ex.country || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-center hidden lg:table-cell text-[var(--text-muted)]">
                            {ex.year_established || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {exchanges.length === 0 && (
                  <div className="p-8 text-center text-[var(--text-muted)]">
                    No exchange data available
                  </div>
                )}
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Top by Volume */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <TrendingUp size={14} className="text-cyan-400" />
                  Top by Volume
                </h3>
                {[...exchanges]
                  .sort(
                    (a, b) =>
                      (b.trade_volume_24h_btc || 0) - (a.trade_volume_24h_btc || 0)
                  )
                  .slice(0, 10)
                  .map((ex, i) => {
                    const pct =
                      totalVol > 0
                        ? ((ex.trade_volume_24h_btc || 0) / totalVol) * 100
                        : 0;
                    return (
                      <div key={ex.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--text-secondary)]">
                            {i + 1}. {ex.name}
                          </span>
                          <span className="font-mono text-[var(--text-primary)]">
                            {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--surface-alt)] overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400"
                            style={{ width: `${Math.max(pct, 1)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Country Distribution */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                  <Globe size={14} className="text-violet-400" />
                  By Country
                </h3>
                {countries.map(([country, count]) => {
                  const pct =
                    exchanges.length > 0 ? (count / exchanges.length) * 100 : 0;
                  return (
                    <div key={country} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--text-secondary)]">{country}</span>
                      <span className="font-mono text-[var(--text-primary)]">
                        {count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Wash Trading Awareness */}
              <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/5 border border-amber-500/20 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-amber-400">Volume vs. Normalized</h3>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  CoinGecko provides both raw and &quot;normalized&quot; trading volumes. The
                  normalized figure adjusts for suspected wash trading — a significant
                  discrepancy between the two numbers is a red flag.
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                  Always compare both metrics and trust score when evaluating an exchange.
                  Higher trust scores ({'>'}8) indicate verified proof-of-reserves and
                  regulatory compliance.
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
