/**
 * Market Stats Widget
 * Premium glassmorphism market overview with animated elements
 */

import {
  getMarketOverview,
  formatNumber,
  formatPercent,
  getFearGreedColor,
  getFearGreedBgColor,
} from '@/lib/market-data';
import Link from 'next/link';

export default async function MarketStats() {
  const market = await getMarketOverview();
  const marketCapChange = market.global.market_cap_change_percentage_24h_usd;
  const isPositive = marketCapChange >= 0;
  const fearGreedValue = market.fearGreed ? Number(market.fearGreed.value) : 50;

  return (
    <div className="relative overflow-hidden bg-surface rounded-2xl shadow-card shadow-card">
      <div className="relative p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg text-text-primary flex items-center gap-2">
            <span
              className="w-8 h-8 rounded-lg bg-surface-alt flex items-center justify-center"
              aria-hidden="true"
            >
              <svg
                className="w-4 h-4 text-text-primary"
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
            </span>
            Market Overview
          </h3>
          <Link
            href="/markets"
            className="group text-sm font-semibold text-text-primary hover:text-text-secondary transition-colors focus-ring rounded-lg px-3 py-1.5 -mr-3 hover:bg-surface-alt flex items-center gap-1"
          >
            View All
            <span className="group-hover:translate-x-0.5 transition-transform" aria-hidden="true">
              →
            </span>
          </Link>
        </div>

        <div className="space-y-4">
          {/* Market Cap - Premium card style */}
          <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-text-muted text-xs uppercase tracking-wider font-medium">
                  Total Market Cap
                </span>
                <div className="text-xl font-bold text-text-primary mt-1">
                  ${formatNumber(market.global.total_market_cap?.usd)}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-sm font-bold px-3 py-1.5 rounded-full ${
                  isPositive
                    ? 'text-text-primary bg-surface-alt'
                    : 'text-text-secondary bg-surface-alt'
                }`}
              >
                <svg
                  className={`w-3.5 h-3.5 ${isPositive ? '' : 'rotate-180'}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                <span
                  aria-label={`${isPositive ? 'up' : 'down'} ${Math.abs(marketCapChange).toFixed(2)} percent`}
                >
                  {formatPercent(marketCapChange)}
                </span>
              </span>
            </div>
            {/* Mini sparkline placeholder */}
            <div className="mt-3 h-8 flex items-end gap-0.5" aria-hidden="true">
              {[40, 65, 45, 70, 55, 80, 60, 75, 85, 70, 90, 75].map((h, i) => (
                <div
                  key={i}
                  className={`flex-1 rounded-t ${isPositive ? 'bg-text-muted' : 'bg-surface-border'}`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>

          {/* Volume & BTC Dominance */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-surface-alt rounded-xl p-3.5 border border-surface-border">
              <span className="text-text-muted text-xs uppercase tracking-wider font-medium">
                24h Volume
              </span>
              <div className="text-lg font-bold text-text-primary mt-1">
                ${formatNumber(market.global.total_volume?.usd)}
              </div>
            </div>
            <div className="bg-surface-alt rounded-xl p-3.5 border border-surface-border">
              <span className="text-text-muted text-xs uppercase tracking-wider font-medium">
                BTC Dom.
              </span>
              <div className="text-lg font-bold text-text-primary mt-1 flex items-baseline gap-1">
                {market.global.market_cap_percentage?.btc?.toFixed(1)}
                <span className="text-sm text-text-muted">%</span>
              </div>
            </div>
          </div>

          {/* Fear & Greed - Premium gauge style */}
          {market.fearGreed && (
            <div className="bg-surface-alt rounded-xl p-4 border border-surface-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-text-muted text-xs uppercase tracking-wider font-medium">
                  Fear & Greed Index
                </span>
                <span className="text-2xl font-black text-text-primary">
                  {market.fearGreed.value}
                </span>
              </div>

              {/* Monochrome gradient progress bar */}
              <div className="relative">
                <div
                  className="h-3 rounded-full overflow-hidden bg-gradient-to-r from-surface-border via-text-muted to-text-secondary"
                  role="progressbar"
                  aria-valuenow={fearGreedValue}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Fear and Greed Index: ${market.fearGreed.value} - ${market.fearGreed.value_classification}`}
                >
                  <div
                    className="absolute h-3 bg-surface-alt right-0 top-0 transition-all duration-500"
                    style={{ width: `${100 - fearGreedValue}%` }}
                  />
                </div>
                {/* Indicator needle */}
                <div
                  className="absolute -top-1 w-1 h-5 bg-surface-alt rounded-full shadow-lg transition-all duration-500"
                  style={{ left: `calc(${fearGreedValue}% - 2px)` }}
                  aria-hidden="true"
                />
              </div>

              <p className="text-sm text-text-secondary mt-3 text-center font-semibold">
                {market.fearGreed.value_classification}
              </p>
            </div>
          )}

          {/* Trending Coins - Monochrome pills */}
          {market.trending.length > 0 && (
            <div className="pt-2">
              <p className="text-text-muted text-xs uppercase tracking-wider font-medium mb-3 flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded bg-surface-alt flex items-center justify-center"
                  aria-hidden="true"
                >
                  <svg
                    className="w-2.5 h-2.5 text-text-primary"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
                Trending Now
              </p>
              <div
                className="flex flex-wrap gap-2"
                role="list"
                aria-label="Trending cryptocurrencies"
              >
                {market.trending.slice(0, 5).map((coin, index) => (
                  <span
                    key={coin.id}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:scale-105 active:scale-95 cursor-default ${
                      index === 0
                        ? 'bg-surface-alt text-text-primary'
                        : 'bg-surface-alt text-text-secondary hover:bg-surface-alt border border-surface-border'
                    }`}
                    role="listitem"
                  >
                    {index === 0 && (
                      <svg
                        className="w-3 h-3"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    )}
                    <img
                      src={coin.thumb}
                      alt={`${coin.symbol.toUpperCase()} icon`}
                      className="w-4 h-4 rounded-full"
                      aria-hidden="true"
                    />
                    <span>{coin.symbol.toUpperCase()}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
