/**
 * Derivatives Dashboard — Funding Rates, Open Interest & Liquidations
 *
 * Data from CoinGecko /derivatives endpoint showing futures/perpetuals
 * across major exchanges like Binance, Bybit, OKX, dYdX.
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getDerivativesTickers, type DerivativeTicker } from '@/lib/market-data';
import {
  getDerivativesExchanges,
  formatLargeNumber,
  formatPercentChange,
  changeColor,
  changeBg,
  type DerivativesExchange,
} from '@/lib/dashboard-data';
import type { Metadata } from 'next';
import { Activity, TrendingUp, TrendingDown, BarChart3, Layers } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Derivatives — Funding Rates, Open Interest & Liquidations | Crypto Vision',
  description:
    'Real-time derivatives market dashboard with funding rates, open interest, and liquidation data across Binance, Bybit, OKX, and more.',
};

export const revalidate = 60;

function groupBySymbol(tickers: DerivativeTicker[]): Map<string, DerivativeTicker[]> {
  const map = new Map<string, DerivativeTicker[]>();
  for (const t of tickers) {
    const sym = t.index_id || t.symbol.split('/')[0] || t.symbol;
    const normalizedSym = sym.toUpperCase();
    if (!map.has(normalizedSym)) map.set(normalizedSym, []);
    map.get(normalizedSym)!.push(t);
  }
  return map;
}

export default async function DerivativesPage() {
  const [tickers, exchanges] = await Promise.all([
    getDerivativesTickers(),
    getDerivativesExchanges(),
  ]);

  // Group tickers by symbol and calculate aggregates
  const grouped = groupBySymbol(tickers);
  const perpetuals = tickers.filter((t) => t.contract_type === 'perpetual');
  const futures = tickers.filter(
    (t) => t.contract_type === 'futures' || t.contract_type === 'future'
  );

  // Stats
  const totalOI = tickers.reduce((sum, t) => sum + (t.open_interest || 0), 0);
  const totalVol = tickers.reduce((sum, t) => sum + (t.volume_24h || 0), 0);
  const avgFunding =
    perpetuals.length > 0
      ? perpetuals.reduce((sum, t) => sum + (t.funding_rate || 0), 0) / perpetuals.length
      : 0;
  const positiveFunding = perpetuals.filter((t) => t.funding_rate > 0).length;
  const negativeFunding = perpetuals.filter((t) => t.funding_rate < 0).length;

  // Top movers
  const topByOI = [...tickers]
    .filter((t) => t.open_interest && t.open_interest > 0)
    .sort((a, b) => (b.open_interest || 0) - (a.open_interest || 0))
    .slice(0, 10);

  const topByVolume = [...tickers]
    .sort((a, b) => b.volume_24h - a.volume_24h)
    .slice(0, 10);

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-[1600px] mx-auto">
        <Header />
        <main id="main-content" className="px-4 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Activity size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">Derivatives</h1>
              <p className="text-sm text-[var(--text-muted)]">
                Real-time funding rates, open interest & liquidations across exchanges
              </p>
            </div>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Total Open Interest
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {formatLargeNumber(totalOI)}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                24h Volume
              </div>
              <div className="text-xl font-bold text-[var(--text-primary)]">
                {formatLargeNumber(totalVol)}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Avg Funding Rate
              </div>
              <div className={`text-xl font-bold ${changeColor(avgFunding)}`}>
                {(avgFunding * 100).toFixed(4)}%
              </div>
            </div>
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] p-4">
              <div className="text-xs text-[var(--text-muted)] uppercase tracking-wider mb-1">
                Funding Sentiment
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex items-center gap-1 text-emerald-400">
                  <TrendingUp size={14} />
                  <span className="text-sm font-medium">{positiveFunding} Long</span>
                </div>
                <span className="text-[var(--text-muted)]">/</span>
                <div className="flex items-center gap-1 text-red-400">
                  <TrendingDown size={14} />
                  <span className="text-sm font-medium">{negativeFunding} Short</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Table — All Derivatives */}
            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)] flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <BarChart3 size={16} className="text-purple-400" />
                    Perpetual Contracts
                  </h2>
                  <span className="text-xs text-[var(--text-muted)]">{perpetuals.length} pairs</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                        <th className="text-left px-4 py-2.5 font-medium">Pair</th>
                        <th className="text-left px-4 py-2.5 font-medium">Exchange</th>
                        <th className="text-right px-4 py-2.5 font-medium">Price</th>
                        <th className="text-right px-4 py-2.5 font-medium">24h %</th>
                        <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                          Funding Rate
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">
                          Open Interest
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                          24h Volume
                        </th>
                        <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">
                          Spread
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {perpetuals.slice(0, 50).map((t, i) => (
                        <tr
                          key={`${t.market}-${t.symbol}-${i}`}
                          className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                        >
                          <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                            {t.symbol}
                          </td>
                          <td className="px-4 py-2.5 text-[var(--text-secondary)]">{t.market}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                            ${parseFloat(t.price || '0').toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${changeBg(t.price_percentage_change_24h)}`}>
                              {formatPercentChange(t.price_percentage_change_24h)}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right hidden md:table-cell">
                            <span
                              className={`font-mono text-xs ${changeColor(t.funding_rate)}`}
                            >
                              {(t.funding_rate * 100).toFixed(4)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right hidden lg:table-cell font-mono text-[var(--text-secondary)]">
                            {t.open_interest ? formatLargeNumber(t.open_interest) : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right hidden md:table-cell font-mono text-[var(--text-secondary)]">
                            {formatLargeNumber(t.volume_24h)}
                          </td>
                          <td className="px-4 py-2.5 text-right hidden lg:table-cell font-mono text-[var(--text-muted)]">
                            {t.spread != null ? t.spread.toFixed(2) + '%' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-4 space-y-4">
              {/* Top by Open Interest */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2">
                    <Layers size={14} className="text-indigo-400" />
                    Top by Open Interest
                  </h3>
                </div>
                <div className="p-2">
                  {topByOI.map((t, i) => (
                    <div
                      key={`oi-${i}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <div>
                        <div className="text-sm font-medium text-[var(--text-primary)]">
                          {t.symbol}
                        </div>
                        <div className="text-xs text-[var(--text-muted)]">{t.market}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-[var(--text-primary)]">
                          {formatLargeNumber(t.open_interest || 0)}
                        </div>
                        <div
                          className={`text-xs font-mono ${changeColor(t.price_percentage_change_24h)}`}
                        >
                          {formatPercentChange(t.price_percentage_change_24h)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Derivatives Exchanges */}
              {exchanges.length > 0 && (
                <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                      Derivatives Exchanges
                    </h3>
                  </div>
                  <div className="p-2">
                    {exchanges.slice(0, 10).map((ex) => (
                      <div
                        key={ex.id}
                        className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          {ex.image && (
                            <img
                              src={ex.image}
                              alt={ex.name}
                              width={20}
                              height={20}
                              className="rounded-full"
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">
                              {ex.name}
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">
                              {ex.number_of_perpetual_pairs} perps ·{' '}
                              {ex.number_of_futures_pairs} futures
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-mono text-[var(--text-secondary)]">
                            {ex.open_interest_btc
                              ? `${(ex.open_interest_btc / 1000).toFixed(1)}K BTC`
                              : '—'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Top by Volume */}
              <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
                <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                    Top by 24h Volume
                  </h3>
                </div>
                <div className="p-2">
                  {topByVolume.map((t, i) => (
                    <div
                      key={`vol-${i}`}
                      className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--surface-hover)] transition-colors"
                    >
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate max-w-[140px]">
                        {t.symbol}
                      </div>
                      <div className="text-sm font-mono text-[var(--text-secondary)]">
                        {formatLargeNumber(t.volume_24h)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Futures Table */}
          {futures.length > 0 && (
            <div className="rounded-xl bg-[var(--surface)] border border-[var(--surface-border)] overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--surface-border)]">
                <h2 className="text-sm font-semibold text-[var(--text-primary)]">
                  Futures Contracts ({futures.length})
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--surface-border)] text-[var(--text-muted)]">
                      <th className="text-left px-4 py-2.5 font-medium">Pair</th>
                      <th className="text-left px-4 py-2.5 font-medium">Exchange</th>
                      <th className="text-right px-4 py-2.5 font-medium">Price</th>
                      <th className="text-right px-4 py-2.5 font-medium">24h %</th>
                      <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                        Basis
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium hidden md:table-cell">
                        Volume 24h
                      </th>
                      <th className="text-right px-4 py-2.5 font-medium hidden lg:table-cell">
                        Expiry
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {futures.slice(0, 30).map((t, i) => (
                      <tr
                        key={`fut-${i}`}
                        className="border-b border-[var(--surface-border)]/50 hover:bg-[var(--surface-hover)] transition-colors"
                      >
                        <td className="px-4 py-2.5 font-medium text-[var(--text-primary)]">
                          {t.symbol}
                        </td>
                        <td className="px-4 py-2.5 text-[var(--text-secondary)]">{t.market}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-[var(--text-primary)]">
                          ${parseFloat(t.price || '0').toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${changeBg(t.price_percentage_change_24h)}`}>
                            {formatPercentChange(t.price_percentage_change_24h)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right hidden md:table-cell font-mono text-[var(--text-secondary)]">
                          {t.basis.toFixed(2)}%
                        </td>
                        <td className="px-4 py-2.5 text-right hidden md:table-cell font-mono text-[var(--text-secondary)]">
                          {formatLargeNumber(t.volume_24h)}
                        </td>
                        <td className="px-4 py-2.5 text-right hidden lg:table-cell text-[var(--text-muted)]">
                          {t.expired_at
                            ? new Date(t.expired_at).toLocaleDateString()
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}
