/**
 * Shared type definitions for the universal-crypto-mcp project
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */

// ==================== OHLCV & Market Data ====================

export interface OhlcvData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OhlcvAsset {
  dates: Date[];
  openings: number[];
  highs: number[];
  lows: number[];
  closings: number[];
  volumes: number[];
}

export interface MarketTicker {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  high: number;
  low: number;
  volume: number;
  change: number;
  changePercent: number;
  timestamp: number;
}

// ==================== Token & Coin Info ====================

export interface TokenInfo {
  name: string;
  symbol: string;
  address?: string;
  chainId?: number;
  decimals?: number;
  logoUrl?: string;
}

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  high24h: number;
  low24h: number;
  circulatingSupply: number;
  totalSupply?: number;
  maxSupply?: number;
  ath: number;
  athChangePercent: number;
  athDate: string;
  atl: number;
  atlChangePercent: number;
  atlDate: string;
}

// ==================== Technical Indicators ====================

export type TradingSignal = -1 | 0 | 1; // SELL | HOLD | BUY

export interface IndicatorResult {
  values: number[];
  signal?: TradingSignal;
  metadata?: Record<string, unknown>;
}

export interface BollingerBands {
  upper: number[];
  middle: number[];
  lower: number[];
  width: number[];
}

export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

export interface IchimokuCloud {
  conversionLine: number[];
  baseLine: number[];
  leadingSpanA: number[];
  leadingSpanB: number[];
  laggingSpan: number[];
}

// ==================== Blockchain Types ====================

export interface TransactionInfo {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasPrice?: string;
  gasUsed?: string;
  blockNumber: number;
  timestamp: number;
  status: "pending" | "confirmed" | "failed";
}

export interface WalletBalance {
  address: string;
  balance: string;
  symbol: string;
  decimals: number;
  usdValue?: number;
}

export interface TokenBalance extends WalletBalance {
  tokenAddress: string;
  tokenName: string;
}

// ==================== Exchange Types ====================

export interface OrderBook {
  symbol: string;
  bids: Array<[number, number]>; // [price, amount]
  asks: Array<[number, number]>;
  timestamp: number;
}

export interface Trade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  price: number;
  amount: number;
  timestamp: number;
}

export interface Order {
  id: string;
  symbol: string;
  type: "market" | "limit" | "stop" | "stop_limit";
  side: "buy" | "sell";
  price?: number;
  amount: number;
  filled: number;
  remaining: number;
  status: "open" | "closed" | "canceled";
  timestamp: number;
}

// ==================== DeFi Types ====================

export interface LiquidityPool {
  address: string;
  token0: TokenInfo;
  token1: TokenInfo;
  reserve0: string;
  reserve1: string;
  totalSupply: string;
  fee: number;
  apr?: number;
}

export interface SwapQuote {
  inputToken: TokenInfo;
  outputToken: TokenInfo;
  inputAmount: string;
  outputAmount: string;
  priceImpact: number;
  route: string[];
  fee: number;
  gasEstimate?: string;
}

export interface YieldPosition {
  protocol: string;
  pool: string;
  depositedAmount: string;
  currentValue: string;
  rewards: Array<{
    token: TokenInfo;
    amount: string;
  }>;
  apy: number;
}

// ==================== Research Types ====================

export interface ResearchSource {
  title: string;
  url: string;
  snippet: string;
  source: string;
  timestamp?: string;
}

export interface ResearchSection {
  name: string;
  description: string;
  status: "planned" | "in_progress" | "completed";
  sources: string[];
  findings?: string[];
}

// ==================== API Response Types ====================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ==================== Tool Response Types ====================

export interface ToolContent {
  type: "text" | "image" | "resource";
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface ToolResponse {
  content: ToolContent[];
  isError?: boolean;
}

// ==================== Chain Configuration ====================

export interface ChainConfig {
  chainId: number;
  name: string;
  symbol: string;
  rpcUrls: string[];
  blockExplorer?: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  isTestnet?: boolean;
}
