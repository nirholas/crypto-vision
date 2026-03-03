/**
 * Crypto Vision — Binance Public Market Data Source
 *
 * 100% free, no API key required.
 * Public endpoints: 1200 req/min IP limit (very generous).
 *
 * Provides: tickers, order books, recent trades, klines/candles,
 *           average prices, exchange info (trading pairs).
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BASE = "https://api.binance.com/api/v3";

function bn<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`bn:${path}`, ttl, () =>
    fetchJSON<T>(`${BASE}${path}`)
  );
}

// ─── 24hr Ticker ─────────────────────────────────────────────

export interface Ticker24h {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  askPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  count: number;
}

/** Get 24h ticker for a specific symbol or all symbols */
export function getTicker24h(symbol?: string): Promise<Ticker24h | Ticker24h[]> {
  const path = symbol ? `/ticker/24hr?symbol=${symbol}` : "/ticker/24hr";
  return bn(path, symbol ? 15 : 30);
}

// ─── Mini Ticker ─────────────────────────────────────────────

export interface MiniTicker {
  symbol: string;
  lastPrice: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
}

/** Lightweight 24h ticker — faster than full ticker */
export function getMiniTicker(symbol?: string): Promise<MiniTicker | MiniTicker[]> {
  const path = symbol ? `/ticker?symbol=${symbol}&windowSize=1d` : "/ticker?windowSize=1d";
  return bn(path, 15);
}

// ─── Order Book ──────────────────────────────────────────────

export interface OrderBook {
  lastUpdateId: number;
  bids: [string, string][]; // [price, qty]
  asks: [string, string][];
}

export function getOrderBook(symbol: string, limit = 20): Promise<OrderBook> {
  const l = Math.min(limit, 1000);
  return bn(`/depth?symbol=${symbol}&limit=${l}`, 5);
}

// ─── Recent Trades ───────────────────────────────────────────

export interface Trade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
}

export function getRecentTrades(symbol: string, limit = 50): Promise<Trade[]> {
  const l = Math.min(limit, 1000);
  return bn(`/trades?symbol=${symbol}&limit=${l}`, 5);
}

// ─── Klines (Candlesticks) ──────────────────────────────────

export type Kline = [
  number, // Open time
  string, // Open
  string, // High
  string, // Low
  string, // Close
  string, // Volume
  number, // Close time
  string, // Quote asset volume
  number, // Number of trades
  string, // Taker buy base vol
  string, // Taker buy quote vol
  string, // Ignore
];

export function getKlines(
  symbol: string,
  interval: string = "1h",
  limit = 100,
): Promise<Kline[]> {
  const l = Math.min(limit, 1000);
  return bn(`/klines?symbol=${symbol}&interval=${interval}&limit=${l}`, 30);
}

// ─── Average Price ───────────────────────────────────────────

export function getAvgPrice(symbol: string): Promise<{ mins: number; price: string }> {
  return bn(`/avgPrice?symbol=${symbol}`, 15);
}

// ─── Book Ticker (Best Bid/Ask) ──────────────────────────────

export interface BookTicker {
  symbol: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
}

export function getBookTicker(symbol?: string): Promise<BookTicker | BookTicker[]> {
  const path = symbol ? `/ticker/bookTicker?symbol=${symbol}` : "/ticker/bookTicker";
  return bn(path, 5);
}

// ─── Exchange Info (Trading Pairs) ───────────────────────────

export interface SymbolInfo {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  baseAssetPrecision: number;
  quoteAssetPrecision: number;
}

export interface ExchangeInfo {
  timezone: string;
  serverTime: number;
  symbols: SymbolInfo[];
}

export function getExchangeInfo(): Promise<ExchangeInfo> {
  return bn("/exchangeInfo", 3600); // 1hr cache, rarely changes
}

// ─── Ticker Price ────────────────────────────────────────────

export interface TickerPrice {
  symbol: string;
  price: string;
}

export function getTickerPrice(symbol?: string): Promise<TickerPrice | TickerPrice[]> {
  const path = symbol ? `/ticker/price?symbol=${symbol}` : "/ticker/price";
  return bn(path, 10);
}
