/**
 * Crypto Vision — Alternative Free Data Sources
 *
 * Fallback and supplementary sources to reduce CoinGecko dependency:
 *  - CoinPaprika (free, 25k req/month)
 *  - CoinCap (free, no key)
 *  - Fear & Greed Index (alternative.me, free)
 *  - DexScreener (free, no key)
 *  - Mempool.space (Bitcoin, free)
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

// ═══════════════════════════════════════════════════════════════
// FEAR & GREED INDEX
// ═══════════════════════════════════════════════════════════════

export interface FearGreedData {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
}

export function getFearGreedIndex(limit = 1): Promise<FearGreedData> {
  return cache.wrap(`fg:${limit}`, 300, () =>
    fetchJSON(`https://api.alternative.me/fng/?limit=${limit}&format=json`)
  );
}

// ═══════════════════════════════════════════════════════════════
// COINPAPRIKA
// ═══════════════════════════════════════════════════════════════

export function getCoinPaprikaGlobal(): Promise<{
  market_cap_usd: number;
  volume_24h_usd: number;
  bitcoin_dominance_percentage: number;
  cryptocurrencies_number: number;
  market_cap_change_24h: number;
}> {
  return cache.wrap("paprika:global", 120, () =>
    fetchJSON("https://api.coinpaprika.com/v1/global")
  );
}

export function getCoinPaprikaTickers(limit = 100): Promise<Array<{
  id: string;
  name: string;
  symbol: string;
  rank: number;
  quotes: {
    USD: {
      price: number;
      volume_24h: number;
      market_cap: number;
      percent_change_24h: number;
      percent_change_7d: number;
    };
  };
}>> {
  return cache.wrap(`paprika:tickers:${limit}`, 120, () =>
    fetchJSON(`https://api.coinpaprika.com/v1/tickers?limit=${limit}`)
  );
}

// ═══════════════════════════════════════════════════════════════
// COINCAP
// ═══════════════════════════════════════════════════════════════

export function getCoinCapAssets(limit = 100): Promise<{
  data: Array<{
    id: string;
    rank: string;
    symbol: string;
    name: string;
    priceUsd: string;
    marketCapUsd: string;
    volumeUsd24Hr: string;
    changePercent24Hr: string;
    supply: string;
    maxSupply: string | null;
  }>;
}> {
  return cache.wrap(`coincap:assets:${limit}`, 60, () =>
    fetchJSON(`https://api.coincap.io/v2/assets?limit=${limit}`)
  );
}

export function getCoinCapHistory(
  id: string,
  interval: "m1" | "m5" | "m15" | "m30" | "h1" | "h2" | "h6" | "h12" | "d1" = "h1",
  start?: number,
  end?: number
): Promise<{
  data: Array<{ priceUsd: string; time: number }>;
}> {
  const p = new URLSearchParams({ interval });
  if (start) p.set("start", String(start));
  if (end) p.set("end", String(end));
  return cache.wrap(`coincap:history:${id}:${interval}`, 120, () =>
    fetchJSON(`https://api.coincap.io/v2/assets/${id}/history?${p}`)
  );
}

// ═══════════════════════════════════════════════════════════════
// DEXSCREENER (DEX / token data, free, no key)
// ═══════════════════════════════════════════════════════════════

export interface DexPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; name: string; symbol: string };
  priceNative: string;
  priceUsd: string;
  txns: { h24: { buys: number; sells: number } };
  volume: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  pairCreatedAt: number;
}

export function dexSearch(query: string): Promise<{ pairs: DexPair[] }> {
  return cache.wrap(`dex:search:${query}`, 30, () =>
    fetchJSON(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`)
  );
}

export function dexTokenPairs(address: string): Promise<{ pairs: DexPair[] }> {
  return cache.wrap(`dex:token:${address}`, 30, () =>
    fetchJSON(`https://api.dexscreener.com/latest/dex/tokens/${address}`)
  );
}

// ═══════════════════════════════════════════════════════════════
// MEMPOOL.SPACE (Bitcoin on-chain, free)
// ═══════════════════════════════════════════════════════════════

export function getBitcoinFees(): Promise<{
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}> {
  return cache.wrap("mempool:fees", 30, () =>
    fetchJSON("https://mempool.space/api/v1/fees/recommended")
  );
}

export function getBitcoinHashrate(): Promise<{
  currentHashrate: number;
  currentDifficulty: number;
}> {
  return cache.wrap("mempool:hashrate", 600, () =>
    fetchJSON("https://mempool.space/api/v1/mining/hashrate/3d")
  );
}

// ═══════════════════════════════════════════════════════════════
// COINPAPRIKA — Extended
// ═══════════════════════════════════════════════════════════════

/** Coin detail by CoinPaprika ID (e.g. "btc-bitcoin") */
export function getCoinPaprikaDetail(id: string): Promise<{
  id: string;
  name: string;
  symbol: string;
  rank: number;
  type: string;
  description: string;
  open_source: boolean;
  started_at: string | null;
  tags: Array<{ id: string; name: string }>;
  team: Array<{ id: string; name: string; position: string }>;
  links: Record<string, string[]>;
  whitepaper: { link: string; thumbnail: string };
  is_active: boolean;
}> {
  return cache.wrap(`paprika:coin:${id}`, 600, () =>
    fetchJSON(`https://api.coinpaprika.com/v1/coins/${id}`)
  );
}

/** CoinPaprika OHLCV (last 30 days) */
export function getCoinPaprikaOHLCV(id: string): Promise<Array<{
  time_open: string;
  time_close: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  market_cap: number;
}>> {
  return cache.wrap(`paprika:ohlcv:${id}`, 300, () =>
    fetchJSON(`https://api.coinpaprika.com/v1/coins/${id}/ohlcv/latest/`)
  );
}

/** CoinPaprika exchanges list */
export function getCoinPaprikaExchanges(): Promise<Array<{
  id: string;
  name: string;
  active: boolean;
  quotes: { USD: { reported_volume_24h: number; adjusted_volume_24h: number } };
  last_updated: string;
}>> {
  return cache.wrap("paprika:exchanges", 600, () =>
    fetchJSON("https://api.coinpaprika.com/v1/exchanges")
  );
}

/** CoinPaprika coin events */
export function getCoinPaprikaEvents(id: string): Promise<Array<{
  id: string;
  date: string;
  name: string;
  description: string;
  is_conference: boolean;
  link: string;
}>> {
  return cache.wrap(`paprika:events:${id}`, 600, () =>
    fetchJSON(`https://api.coinpaprika.com/v1/coins/${id}/events`)
  );
}

// ═══════════════════════════════════════════════════════════════
// COINCAP — Extended
// ═══════════════════════════════════════════════════════════════

/** CoinCap exchange rates (fiat + crypto) */
export function getCoinCapRates(): Promise<{
  data: Array<{
    id: string;
    symbol: string;
    currencySymbol: string | null;
    rateUsd: string;
    type: string;
  }>;
}> {
  return cache.wrap("coincap:rates", 120, () =>
    fetchJSON("https://api.coincap.io/v2/rates")
  );
}

/** CoinCap markets (exchange data) */
export function getCoinCapMarkets(limit = 50): Promise<{
  data: Array<{
    exchangeId: string;
    rank: string;
    baseSymbol: string;
    baseId: string;
    quoteSymbol: string;
    quoteId: string;
    priceQuote: string;
    priceUsd: string;
    volumeUsd24Hr: string;
    percentExchangeVolume: string;
  }>;
}> {
  return cache.wrap(`coincap:markets:${limit}`, 120, () =>
    fetchJSON(`https://api.coincap.io/v2/markets?limit=${limit}`)
  );
}

/** CoinCap exchanges */
export function getCoinCapExchanges(): Promise<{
  data: Array<{
    exchangeId: string;
    name: string;
    rank: string;
    percentTotalVolume: string;
    volumeUsd: string;
    tradingPairs: string;
    socket: boolean;
    exchangeUrl: string;
  }>;
}> {
  return cache.wrap("coincap:exchanges", 300, () =>
    fetchJSON("https://api.coincap.io/v2/exchanges")
  );
}

// ═══════════════════════════════════════════════════════════════
// DEXSCREENER — Extended
// ═══════════════════════════════════════════════════════════════

/** DexScreener pairs by chain */
export function dexPairsByChain(chain: string): Promise<{ pairs: DexPair[] }> {
  return cache.wrap(`dex:chain:${chain}`, 30, () =>
    fetchJSON(`https://api.dexscreener.com/latest/dex/pairs/${chain}`)
  );
}

/** DexScreener — get specific pair by chain + pairAddress */
export function dexPairDetail(chain: string, pairAddress: string): Promise<{ pair: DexPair }> {
  return cache.wrap(`dex:pair:${chain}:${pairAddress}`, 15, () =>
    fetchJSON(`https://api.dexscreener.com/latest/dex/pairs/${chain}/${pairAddress}`)
  );
}

// ═══════════════════════════════════════════════════════════════
// COINGLASS (Free public endpoints)
// ═══════════════════════════════════════════════════════════════

/** Bitcoin Dominance (from CoinGecko global, already have this — alias) */
// Use cg.getGlobal() instead.

// ═══════════════════════════════════════════════════════════════
// BLOCKCHAIN.COM — Simple Price API
// ═══════════════════════════════════════════════════════════════

/** Multi-currency BTC exchange rates (blockchain.com) */
export function getBtcExchangeRates(): Promise<Record<string, {
  "15m": number;
  last: number;
  buy: number;
  sell: number;
  symbol: string;
}>> {
  return cache.wrap("bccom:ticker", 60, () =>
    fetchJSON("https://blockchain.info/ticker")
  );
}
