/**
 * Exchange Detail Page
 * Shows details and trading pairs for a specific exchange
 */

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import Link from 'next/link';
import Image from 'next/image';
import { formatNumber, formatPrice } from '@/lib/market-data';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

export const revalidate = 300;

interface Ticker {
  base: string;
  target: string;
  last: number;
  volume: number;
  trust_score: 'green' | 'yellow' | 'red' | null;
  bid_ask_spread_percentage: number;
  trade_url: string;
  converted_volume: {
    usd: number;
  };
  converted_last: {
    usd: number;
  };
}

interface ExchangeDetails {
  id: string;
  name: string;
  year_established: number | null;
  country: string | null;
  description: string;
  url: string;
  image: string;
  facebook_url: string;
  reddit_url: string;
  telegram_url: string;
  twitter_handle: string;
  trust_score: number;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  trade_volume_24h_btc_normalized: number;
  tickers: Ticker[];
}

interface ExchangePageProps {
  params: Promise<{ id: string }>;
}

async function getExchangeDetails(id: string): Promise<ExchangeDetails | null> {
  try {
    const response = await fetch(`https://api.coingecko.com/api/v3/exchanges/${id}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: ExchangePageProps): Promise<Metadata> {
  const { id } = await params;
  const exchange = await getExchangeDetails(id);

  if (!exchange) {
    return { title: 'Exchange Not Found' };
  }

  return {
    title: `${exchange.name} - Cryptocurrency Exchange - Crypto Data Aggregator`,
    description:
      exchange.description ||
      `${exchange.name} exchange information, trading pairs, and volume statistics.`,
  };
}

function getTrustScoreColor(score: string | null): string {
  switch (score) {
    case 'green':
      return 'bg-green-500';
    case 'yellow':
      return 'bg-yellow-500';
    case 'red':
      return 'bg-red-500';
    default:
      return 'bg-text-muted';
  }
}

const BTC_PRICE_ESTIMATE = 100000;

export default async function ExchangeDetailPage({ params }: ExchangePageProps) {
  const { id } = await params;
  const exchange = await getExchangeDetails(id);

  if (!exchange) {
    notFound();
  }

  // Sort tickers by volume
  const topTickers = exchange.tickers
    .sort((a, b) => (b.converted_volume?.usd || 0) - (a.converted_volume?.usd || 0))
    .slice(0, 100);

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
            <Link
              href="/markets/exchanges"
              className="hover:text-primary"
            >
              Exchanges
            </Link>
            <span>/</span>
            <span className="text-text-primary">{exchange.name}</span>
          </nav>

          {/* Exchange Header */}
          <div className="bg-surface rounded-xl border border-surface-border p-6 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="relative w-20 h-20 flex-shrink-0">
                {exchange.image && (
                  <Image
                    src={exchange.image}
                    alt={exchange.name}
                    fill
                    className="rounded-xl object-cover"
                    unoptimized
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="text-3xl font-bold text-text-primary">
                    {exchange.name}
                  </h1>
                  <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
                    Rank #{exchange.trust_score_rank}
                  </span>
                  <span className="px-3 py-1 bg-gain/10 text-gain rounded-full text-sm font-medium">
                    Trust Score: {exchange.trust_score}/10
                  </span>
                </div>
                {exchange.description && (
                  <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                    {exchange.description}
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <a
                    href={exchange.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    Visit Exchange
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                  {exchange.twitter_handle && (
                    <a
                      href={`https://twitter.com/${exchange.twitter_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-surface-alt hover:bg-surface-hover text-text-secondary rounded-lg text-sm font-medium transition-colors"
                    >
                      Twitter
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-surface rounded-xl border border-surface-border p-4">
              <p className="text-text-muted text-sm">24h Volume (BTC)</p>
              <p className="text-xl font-bold text-text-primary">
                ₿ {formatNumber(exchange.trade_volume_24h_btc_normalized)}
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-surface-border p-4">
              <p className="text-text-muted text-sm">24h Volume (USD)</p>
              <p className="text-xl font-bold text-text-primary">
                ${formatNumber(exchange.trade_volume_24h_btc_normalized * BTC_PRICE_ESTIMATE)}
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-surface-border p-4">
              <p className="text-text-muted text-sm">Year Established</p>
              <p className="text-xl font-bold text-text-primary">
                {exchange.year_established || 'Unknown'}
              </p>
            </div>
            <div className="bg-surface rounded-xl border border-surface-border p-4">
              <p className="text-text-muted text-sm">Country</p>
              <p className="text-xl font-bold text-text-primary">
                {exchange.country || 'Unknown'}
              </p>
            </div>
          </div>

          {/* Trading Pairs */}
          <div className="bg-surface rounded-xl border border-surface-border overflow-hidden">
            <div className="p-4 border-b border-surface-border">
              <h2 className="text-lg font-bold text-text-primary">
                Top Trading Pairs ({topTickers.length})
              </h2>
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full">
                <thead>
                  <tr className="bg-surface-alt border-b border-surface-border">
                    <th className="text-left text-text-muted text-sm font-medium p-4">
                      #
                    </th>
                    <th className="text-left text-text-muted text-sm font-medium p-4">
                      Pair
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4">
                      Price
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4 hidden sm:table-cell">
                      24h Volume
                    </th>
                    <th className="text-right text-text-muted text-sm font-medium p-4 hidden md:table-cell">
                      Spread
                    </th>
                    <th className="text-center text-text-muted text-sm font-medium p-4">
                      Trust
                    </th>
                    <th className="text-center text-text-muted text-sm font-medium p-4">
                      Trade
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {topTickers.map((ticker, index) => (
                    <tr
                      key={`${ticker.base}-${ticker.target}-${index}`}
                      className="border-b border-surface-border hover:bg-surface-hover transition-colors"
                    >
                      <td className="p-4 text-text-muted">{index + 1}</td>
                      <td className="p-4">
                        <span className="font-medium text-text-primary">
                          {ticker.base}
                        </span>
                        <span className="text-text-muted">/{ticker.target}</span>
                      </td>
                      <td className="p-4 text-right font-medium text-text-primary">
                        {formatPrice(ticker.converted_last?.usd || ticker.last)}
                      </td>
                      <td className="p-4 text-right text-text-secondary hidden sm:table-cell">
                        ${formatNumber(ticker.converted_volume?.usd || 0)}
                      </td>
                      <td className="p-4 text-right text-text-secondary hidden md:table-cell">
                        {ticker.bid_ask_spread_percentage?.toFixed(2) || '—'}%
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block w-3 h-3 rounded-full ${getTrustScoreColor(ticker.trust_score)}`}
                          title={ticker.trust_score || 'Unknown'}
                        />
                      </td>
                      <td className="p-4 text-center">
                        {ticker.trade_url ? (
                          <a
                            href={ticker.trade_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-sm font-medium transition-colors"
                          >
                            Trade
                          </a>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Back link */}
          <div className="mt-8 text-center flex justify-center gap-6">
            <Link
              href="/markets/exchanges"
              className="text-primary hover:underline"
            >
              ← All Exchanges
            </Link>
            <Link href="/markets" className="text-primary hover:underline">
              Back to Markets
            </Link>
          </div>
        </main>

        <Footer />
      </div>
    </div>
  );
}
