/**
 * Exchanges List Page
 * Shows cryptocurrency exchanges ranked by volume and trust score
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';
import { formatNumber } from '@/lib/market-data';
import type { Metadata } from 'next';
import { Building2 } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Cryptocurrency Exchanges - Crypto Data Aggregator',
  description: 'Browse cryptocurrency exchanges ranked by 24h trading volume and trust score.',
};

export const revalidate = 300; // 5 minutes

// Exchange data type
interface Exchange {
  id: string;
  name: string;
  year_established: number | null;
  country: string | null;
  url: string;
  image: string;
  trust_score: number;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  trade_volume_24h_btc_normalized: number;
}

// Fetch exchanges from CoinGecko
async function getExchanges(): Promise<Exchange[]> {
  try {
    const response = await fetch('https://api.coingecko.com/api/v3/exchanges?per_page=100', {
      next: { revalidate: 300 },
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

// Trust score color mapping
function getTrustScoreColor(score: number): string {
  if (score >= 9) return 'text-gain';
  if (score >= 7) return 'text-lime-500';
  if (score >= 5) return 'text-warning';
  if (score >= 3) return 'text-orange-500';
  return 'text-loss';
}

function getTrustScoreBg(score: number): string {
  if (score >= 9) return 'bg-gain/10';
  if (score >= 7) return 'bg-lime-500/10';
  if (score >= 5) return 'bg-warning/10';
  if (score >= 3) return 'bg-orange-500/10';
  return 'bg-loss/10';
}

// Average BTC price for volume calculation (rough estimate)
const BTC_PRICE_ESTIMATE = 100000;

export default async function ExchangesPage() {
  const exchanges = await getExchanges();

  return (
    <div className="min-h-screen bg-surface">
      <div className="max-w-7xl mx-auto">
        <Header />

        <main className="px-4 py-6">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-text-muted mb-6">
            <Link href="/markets" className="hover:text-primary">
              Markets
            </Link>
            <span>/</span>
            <span className="text-text-primary">Exchanges</span>
          </nav>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-text-primary mb-2 flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              Cryptocurrency Exchanges
            </h1>
            <p className="text-text-secondary">
              Top {exchanges.length} exchanges ranked by 24-hour trading volume
            </p>
          </div>

          {/* Exchanges Table */}
          <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-alt border-b border-surface-border">
                    <th className="text-left text-text-muted text-sm font-medium p-4">
                      #
                    </th>
                    <th className="text-left text-text-muted text-sm font-medium p-4">
                      Exchange
                    </th>
                    <th className="text-center text-text-muted text-sm font-medium p-4">
                      Trust Score
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4">
                      24h Volume (BTC)
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4 hidden md:table-cell">
                      24h Volume (USD)
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4 hidden lg:table-cell">
                      Year Est.
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4 hidden lg:table-cell">
                      Country
                    </th>
                    <th className="text-center text-text-muted text-sm font-medium p-4 hidden sm:table-cell">
                      Visit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {exchanges.map((exchange) => (
                    <tr
                      key={exchange.id}
                      className="border-b border-surface-border hover:bg-surface-hover transition-colors"
                    >
                      <td className="p-4 text-text-muted">
                        {exchange.trust_score_rank}
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/markets/exchanges/${exchange.id}`}
                          className="flex items-center gap-3"
                        >
                          <div className="relative w-8 h-8">
                            {exchange.image && (
                              <Image
                                src={exchange.image}
                                alt={exchange.name}
                                fill
                                className="rounded-full object-cover"
                                unoptimized
                              />
                            )}
                          </div>
                          <span className="font-medium text-text-primary hover:text-primary">
                            {exchange.name}
                          </span>
                        </Link>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium ${getTrustScoreBg(exchange.trust_score)} ${getTrustScoreColor(exchange.trust_score)}`}
                        >
                          {exchange.trust_score}/10
                        </span>
                      </td>
                      <td className="p-4 text-right font-medium text-text-primary">
                        ₿ {formatNumber(exchange.trade_volume_24h_btc_normalized)}
                      </td>
                      <td className="p-4 text-right text-text-secondary hidden md:table-cell">
                        $
                        {formatNumber(
                          exchange.trade_volume_24h_btc_normalized * BTC_PRICE_ESTIMATE
                        )}
                      </td>
                      <td className="p-4 text-right text-text-secondary hidden lg:table-cell">
                        {exchange.year_established || '—'}
                      </td>
                      <td className="p-4 text-right text-text-secondary hidden lg:table-cell">
                        {exchange.country || '—'}
                      </td>
                      <td className="p-4 text-center hidden sm:table-cell">
                        <a
                          href={exchange.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-surface-alt hover:bg-primary/10 text-text-muted hover:text-primary transition-colors"
                          title={`Visit ${exchange.name}`}
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                            />
                          </svg>
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Info Banner */}
          <div className="mt-6 bg-primary/10 border border-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-xl">ℹ️</span>
              <div className="text-sm">
                <p className="text-primary font-medium">About Trust Score</p>
                <p className="text-text-secondary">
                  Trust score is calculated based on liquidity, scale of operations, cyber security,
                  and regulatory compliance. Volume shown is normalized to account for potential
                  wash trading.
                </p>
              </div>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8 text-center">
            <Link href="/markets" className="text-primary hover:underline">
              ← Back to Markets
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
