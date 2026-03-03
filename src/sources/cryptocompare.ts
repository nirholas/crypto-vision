/**
 * Crypto Vision — CryptoCompare Data Source
 *
 * Free tier: 100,000 calls/month with CRYPTOCOMPARE_API_KEY.
 * Falls back to unauthenticated (lower limits) when no key set.
 *
 * Provides: prices, OHLCV, social stats, trading signals,
 *           exchange volume rankings, on-chain data.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const API = "https://min-api.cryptocompare.com/data";

function headers(): Record<string, string> {
  const key = process.env.CRYPTOCOMPARE_API_KEY;
  return key ? { authorization: `Apikey ${key}` } : {};
}

function cc<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`cc:${path}`, ttl, () =>
    fetchJSON<T>(`${API}${path}`, { headers: headers() }),
  );
}

// ─── Price ───────────────────────────────────────────────────

export function getPrice(
  fsyms: string,
  tsyms = "USD",
): Promise<Record<string, Record<string, number>>> {
  return cc(`/pricemulti?fsyms=${fsyms}&tsyms=${tsyms}`, 30);
}

export function getPriceFull(
  fsyms: string,
  tsyms = "USD",
): Promise<{
  RAW: Record<string, Record<string, {
    PRICE: number;
    VOLUME24HOUR: number;
    MKTCAP: number;
    CHANGEPCT24HOUR: number;
    HIGH24HOUR: number;
    LOW24HOUR: number;
    SUPPLY: number;
    TOTALVOLUME24HTO: number;
  }>>;
}> {
  return cc(`/pricemultifull?fsyms=${fsyms}&tsyms=${tsyms}`, 30);
}

// ─── OHLCV ───────────────────────────────────────────────────

export interface OHLCVEntry {
  time: number;
  high: number;
  low: number;
  open: number;
  close: number;
  volumefrom: number;
  volumeto: number;
}

export function getHistoDay(
  fsym: string,
  tsym = "USD",
  limit = 30,
): Promise<{ Data: { Data: OHLCVEntry[] } }> {
  return cc(`/v2/histoday?fsym=${fsym}&tsym=${tsym}&limit=${limit}`, 300);
}

export function getHistoHour(
  fsym: string,
  tsym = "USD",
  limit = 24,
): Promise<{ Data: { Data: OHLCVEntry[] } }> {
  return cc(`/v2/histohour?fsym=${fsym}&tsym=${tsym}&limit=${limit}`, 120);
}

// ─── Top Coins ───────────────────────────────────────────────

export function getTopByMarketCap(
  tsym = "USD",
  limit = 50,
): Promise<{
  Data: Array<{
    CoinInfo: {
      Id: string;
      Name: string;
      FullName: string;
      ImageUrl: string;
      Algorithm: string;
    };
    RAW: Record<string, {
      PRICE: number;
      MKTCAP: number;
      VOLUME24HOUR: number;
      CHANGEPCT24HOUR: number;
      SUPPLY: number;
    }>;
  }>;
}> {
  return cc(`/top/mktcapfull?limit=${limit}&tsym=${tsym}`, 120);
}

export function getTopByVolume(
  tsym = "USD",
  limit = 50,
): Promise<{
  Data: Array<{
    CoinInfo: { Name: string; FullName: string };
    RAW: Record<string, { PRICE: number; VOLUME24HOUR: number; CHANGEPCT24HOUR: number }>;
  }>;
}> {
  return cc(`/top/totalvolfull?limit=${limit}&tsym=${tsym}`, 120);
}

// ─── Trading Signals ─────────────────────────────────────────

export function getTradingSignals(
  fsym: string,
): Promise<{
  Data: {
    inOutVar: { sentiment: string; score: number };
    largetxsVar: { sentiment: string; score: number };
    addressesNetGrowth: { sentiment: string; score: number };
    concentrationVar: { sentiment: string; score: number };
  };
}> {
  return cc(`/tradingsignals/intotheblock?fsym=${fsym}`, 300);
}

// ─── Social Stats ────────────────────────────────────────────

export function getSocialStats(
  coinId: number,
): Promise<{
  Data: {
    General: { Name: string; Points: number };
    Twitter: { followers: number; statuses: number; favourites: number };
    Reddit: { subscribers: number; active_users: number; posts_per_day: number; comments_per_day: number };
    CodeRepository?: { List: Array<{ stars: number; forks: number; last_push: number }> };
  };
}> {
  return cc(`/social/coin/latest?coinId=${coinId}`, 600);
}

// ─── Exchange Rankings ───────────────────────────────────────

export function getTopExchanges(
  fsym: string,
  tsym = "USD",
  limit = 20,
): Promise<{
  Data: {
    Exchanges: Array<{
      exchange: string;
      fromSymbol: string;
      toSymbol: string;
      volume24h: number;
      volume24hTo: number;
    }>;
  };
}> {
  return cc(`/top/exchanges/full?fsym=${fsym}&tsym=${tsym}&limit=${limit}`, 300);
}

// ─── News ────────────────────────────────────────────────────

export interface CCNewsArticle {
  id: string;
  title: string;
  url: string;
  body: string;
  source: string;
  published_on: number;
  categories: string;
  tags: string;
  imageurl: string;
}

export function getNews(
  categories?: string,
  feeds?: string,
  lang = "EN",
): Promise<{ Data: CCNewsArticle[] }> {
  const p = new URLSearchParams({ lang });
  if (categories) p.set("categories", categories);
  if (feeds) p.set("feeds", feeds);
  return cc(`/v2/news/?${p}`, 120);
}

export function getNewsCategories(): Promise<{
  Data: Array<{ categoryName: string; wordsAssociatedWithCategory: string[] }>;
}> {
  return cc("/news/categories", 3600);
}

// ─── Blockchain Data ─────────────────────────────────────────

export function getBlockchainAvailable(): Promise<{
  Data: Record<string, {
    id: number;
    symbol: string;
    data_available_from_ts: number;
  }>;
}> {
  return cc("/blockchain/list", 3600);
}
