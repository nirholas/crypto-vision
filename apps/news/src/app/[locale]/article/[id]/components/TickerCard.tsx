/**
 * TickerCard - Mini price card for mentioned tickers in articles
 * Fetches current price client-side and shows 24h change
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface TickerCardProps {
  ticker: string;
}

interface PriceData {
  price: number;
  change24h: number;
}

// Map common ticker symbols to CoinGecko IDs
const TICKER_TO_COINGECKO: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  SOL: 'solana',
  BNB: 'binancecoin',
  XRP: 'ripple',
  ADA: 'cardano',
  DOGE: 'dogecoin',
  DOT: 'polkadot',
  AVAX: 'avalanche-2',
  MATIC: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  ATOM: 'cosmos',
  LTC: 'litecoin',
  NEAR: 'near',
  APT: 'aptos',
  ARB: 'arbitrum',
  OP: 'optimism',
  SUI: 'sui',
  SEI: 'sei-network',
  TIA: 'celestia',
  PEPE: 'pepe',
  SHIB: 'shiba-inu',
  FIL: 'filecoin',
  INJ: 'injective-protocol',
  RENDER: 'render-token',
  FET: 'fetch-ai',
  AAVE: 'aave',
  MKR: 'maker',
  CRV: 'curve-dao-token',
};

function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

export default function TickerCard({ ticker }: TickerCardProps) {
  const [priceData, setPriceData] = useState<PriceData | null>(null);
  const [loading, setLoading] = useState(true);

  const coinId = TICKER_TO_COINGECKO[ticker.toUpperCase()] || ticker.toLowerCase();

  useEffect(() => {
    const controller = new AbortController();

    async function fetchPrice() {
      try {
        const res = await fetch(
          `/api/prices?coins=${coinId}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (data[coinId]) {
          setPriceData({
            price: data[coinId].usd,
            change24h: data[coinId].usd_24h_change ?? 0,
          });
        }
      } catch {
        // silent fail — price is supplementary
      } finally {
        setLoading(false);
      }
    }

    fetchPrice();
    return () => controller.abort();
  }, [coinId]);

  const changeColor = priceData && priceData.change24h >= 0
    ? 'text-green-600 dark:text-green-400'
    : 'text-red-600 dark:text-red-400';

  const changeArrow = priceData && priceData.change24h >= 0 ? '▲' : '▼';

  return (
    <Link
      href={`/coin/${coinId}`}
      className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700/40 text-gray-800 dark:text-gray-300 rounded-full text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800/40 transition group"
    >
      <span className="font-semibold">${ticker}</span>
      {loading ? (
        <span className="w-12 h-3 bg-gray-200/50 dark:bg-gray-700/30 rounded animate-pulse" />
      ) : priceData ? (
        <span className="flex items-center gap-1 text-xs">
          <span className="text-gray-600 dark:text-gray-300">{formatPrice(priceData.price)}</span>
          <span className={changeColor}>
            {changeArrow} {Math.abs(priceData.change24h).toFixed(1)}%
          </span>
        </span>
      ) : null}
    </Link>
  );
}
