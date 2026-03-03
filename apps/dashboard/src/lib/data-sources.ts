/**
 * Data Source Abstraction Layer
 * 
 * Hides upstream data providers and provides a unified interface
 * for fetching crypto/finance data from multiple sources.
 * 
 * Security Features:
 * - No upstream provider names exposed in responses
 * - Source URLs obfuscated internally
 * - Fallback providers for high availability
 * - Request fingerprinting protection
 * 
 * @module data-sources
 */

import { cache } from './cache';

// =============================================================================
// INTERNAL SOURCE REGISTRY (Never expose these names externally)
// =============================================================================

const SOURCES = {
  // Market data providers (codenames)
  ALPHA: process.env.SOURCE_ALPHA_URL || 'https://api.coingecko.com/api/v3',
  BETA: process.env.SOURCE_BETA_URL || 'https://api.coincap.io/v2',
  GAMMA: process.env.SOURCE_GAMMA_URL || 'https://api.coinpaprika.com/v1',
  
  // DeFi data providers
  DELTA: process.env.SOURCE_DELTA_URL || 'https://api.llama.fi',
  EPSILON: process.env.SOURCE_EPSILON_URL || 'https://yields.llama.fi',
  
  // On-chain data
  ZETA: process.env.SOURCE_ZETA_URL || 'https://mempool.space/api',
  ETA: process.env.SOURCE_ETA_URL || 'https://blockstream.info/api',
  
  // Exchange data
  THETA: process.env.SOURCE_THETA_URL || 'https://api.binance.com/api/v3',
  IOTA: process.env.SOURCE_IOTA_URL || 'https://api.kraken.com/0/public',
  KAPPA: process.env.SOURCE_KAPPA_URL || 'https://api.bybit.com/v5',
  
  // Sentiment
  LAMBDA: process.env.SOURCE_LAMBDA_URL || 'https://api.alternative.me',
  
  // =========================================================================
  // NEW FREE DATA SOURCES (2026 additions)
  // =========================================================================
  
  // Historical OHLCV & Social Data
  MU: process.env.SOURCE_MU_URL || 'https://min-api.cryptocompare.com/data',
  
  // Ethereum On-chain (free tier: 5 calls/sec)
  NU: process.env.SOURCE_NU_URL || 'https://api.etherscan.io/api',
  
  // Blockchain.com Stats
  XI: process.env.SOURCE_XI_URL || 'https://api.blockchain.info',
  
  // Research Data (Messari free tier)
  OMICRON: process.env.SOURCE_OMICRON_URL || 'https://data.messari.io/api/v1',
  
  // Futures & Funding Rates
  PI: process.env.SOURCE_PI_URL || 'https://open-api.coinglass.com/public/v2',
  
  // NFT Data (free)
  RHO: process.env.SOURCE_RHO_URL || 'https://api.opensea.io/api/v2',
  
  // Gas Prices (Ethereum)
  SIGMA: process.env.SOURCE_SIGMA_URL || 'https://api.etherscan.io/api',
  
  // Staking Data
  TAU: process.env.SOURCE_TAU_URL || 'https://staking-api.everstake.one/v1',
  
  // Token Unlocks/Vesting
  UPSILON: process.env.SOURCE_UPSILON_URL || 'https://api.unlocks.app/api',
  
  // Whale Alerts (via public websocket)
  PHI: process.env.SOURCE_PHI_URL || 'https://api.whale-alert.io/v1',
  
  // Exchange Reserves (via DefiLlama)
  CHI: process.env.SOURCE_CHI_URL || 'https://api.llama.fi/bridges',
  
  // Crypto News Aggregation (backup)
  PSI: process.env.SOURCE_PSI_URL || 'https://cryptopanic.com/api/v1',
  
  // Token Security/Audit Data
  OMEGA: process.env.SOURCE_OMEGA_URL || 'https://api.gopluslabs.io/api/v1',
} as const;

type SourceKey = keyof typeof SOURCES;

// =============================================================================
// REQUEST CONFIGURATION
// =============================================================================

const DEFAULT_HEADERS = {
  'Accept': 'application/json',
  'Accept-Encoding': 'gzip, deflate',
  // Rotate user agents to prevent fingerprinting
  'User-Agent': getRandomUserAgent(),
};

function getRandomUserAgent(): string {
  const agents = [
    'Mozilla/5.0 (compatible; DataAggregator/2.0)',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

// =============================================================================
// FETCH WITH OBFUSCATION
// =============================================================================

interface FetchOptions {
  source: SourceKey;
  path: string;
  params?: Record<string, string | number | boolean>;
  cacheTTL?: number;
  timeout?: number;
  fallbackSources?: SourceKey[];
}

interface FetchResult<T> {
  data: T;
  cached: boolean;
  latency: number;
}

/**
 * Fetch data from an upstream source with obfuscation
 * Never exposes source information in errors or responses
 */
export async function fetchFromSource<T>(options: FetchOptions): Promise<FetchResult<T>> {
  const { source, path, params = {}, cacheTTL = 60, timeout = 10000, fallbackSources = [] } = options;
  
  // Build cache key (hashed to prevent reverse engineering)
  const cacheKey = buildCacheKey(source, path, params);
  
  // Check cache first
  const cached = await cache.get<T>(cacheKey);
  if (cached) {
    return { data: cached, cached: true, latency: 0 };
  }
  
  const startTime = Date.now();
  
  // Try primary source
  try {
    const data = await fetchWithTimeout<T>(source, path, params, timeout);
    await cache.set(cacheKey, data, cacheTTL);
    return { data, cached: false, latency: Date.now() - startTime };
  } catch (primaryError) {
    // Try fallback sources
    for (const fallback of fallbackSources) {
      try {
        const data = await fetchWithTimeout<T>(fallback, path, params, timeout);
        await cache.set(cacheKey, data, cacheTTL);
        return { data, cached: false, latency: Date.now() - startTime };
      } catch {
        continue;
      }
    }
    
    // All sources failed - throw generic error (no source info)
    throw new DataSourceError('Data temporarily unavailable', 'SERVICE_UNAVAILABLE');
  }
}

async function fetchWithTimeout<T>(
  source: SourceKey,
  path: string,
  params: Record<string, string | number | boolean>,
  timeout: number
): Promise<T> {
  const baseUrl = SOURCES[source];
  const url = new URL(path, baseUrl);
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url.toString(), {
      headers: {
        ...DEFAULT_HEADERS,
        'User-Agent': getRandomUserAgent(), // Fresh UA per request
      },
      signal: controller.signal,
      next: { revalidate: 60 },
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function buildCacheKey(source: SourceKey, path: string, params: Record<string, string | number | boolean>): string {
  // Use hash to prevent cache key analysis
  const raw = `${source}:${path}:${JSON.stringify(params)}`;
  return `ds:${simpleHash(raw)}`;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

// =============================================================================
// CUSTOM ERROR CLASS (No source information leaked)
// =============================================================================

export class DataSourceError extends Error {
  code: string;
  
  constructor(message: string, code: string) {
    super(message);
    this.name = 'DataSourceError';
    this.code = code;
  }
}

// =============================================================================
// UNIFIED DATA FETCHERS
// =============================================================================

export interface CoinMarketData {
  id: string;
  symbol: string;
  name: string;
  price: number;
  marketCap: number;
  rank: number;
  volume24h: number;
  priceChange24h: number;
  priceChangePercent24h: number;
  priceChangePercent7d?: number;
  priceChangePercent30d?: number;
  circulatingSupply: number;
  totalSupply: number | null;
  maxSupply: number | null;
  ath: number;
  athChangePercent: number;
  image?: string;
  sparkline?: number[];
  lastUpdated: string;
}

export interface GlobalMarketData {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
  markets: number;
  marketCapChange24h: number;
  lastUpdated: string;
}

export interface FearGreedIndex {
  value: number;
  classification: string;
  timestamp: string;
  previousClose?: number;
  weekAgo?: number;
  monthAgo?: number;
}

/**
 * Get coin market data - aggregates from multiple sources
 */
export async function getCoinMarkets(options: {
  page?: number;
  perPage?: number;
  order?: string;
  ids?: string[];
  sparkline?: boolean;
}): Promise<CoinMarketData[]> {
  const { page = 1, perPage = 100, order = 'market_cap_desc', ids, sparkline = false } = options;
  
  const params: Record<string, string | number | boolean> = {
    vs_currency: 'usd',
    order,
    per_page: perPage,
    page,
    sparkline,
    price_change_percentage: '24h,7d,30d',
  };
  
  if (ids?.length) {
    params.ids = ids.join(',');
  }
  
  const result = await fetchFromSource<any[]>({
    source: 'ALPHA',
    path: '/coins/markets',
    params,
    cacheTTL: 60,
    fallbackSources: ['BETA', 'GAMMA'],
  });
  
  // Normalize response to our unified format
  return result.data.map(normalizeMarketData);
}

/**
 * Get global market statistics
 */
export async function getGlobalData(): Promise<GlobalMarketData> {
  const result = await fetchFromSource<{ data: any }>({
    source: 'ALPHA',
    path: '/global',
    cacheTTL: 300,
    fallbackSources: ['BETA'],
  });
  
  const d = result.data.data;
  return {
    totalMarketCap: d.total_market_cap?.usd || 0,
    totalVolume24h: d.total_volume?.usd || 0,
    btcDominance: d.market_cap_percentage?.btc || 0,
    ethDominance: d.market_cap_percentage?.eth || 0,
    activeCryptocurrencies: d.active_cryptocurrencies || 0,
    markets: d.markets || 0,
    marketCapChange24h: d.market_cap_change_percentage_24h_usd || 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Get Fear & Greed Index
 */
export async function getFearGreedIndex(): Promise<FearGreedIndex> {
  const result = await fetchFromSource<{ data: any[] }>({
    source: 'LAMBDA',
    path: '/fng/',
    params: { limit: 30 },
    cacheTTL: 300,
  });
  
  const data = result.data.data;
  const current = data[0];
  
  return {
    value: parseInt(current.value),
    classification: current.value_classification,
    timestamp: new Date(parseInt(current.timestamp) * 1000).toISOString(),
    previousClose: data[1] ? parseInt(data[1].value) : undefined,
    weekAgo: data[7] ? parseInt(data[7].value) : undefined,
    monthAgo: data[29] ? parseInt(data[29].value) : undefined,
  };
}

/**
 * Get DeFi TVL data
 */
export async function getDefiTVL(): Promise<{ protocols: any[]; totalTVL: number }> {
  const result = await fetchFromSource<any[]>({
    source: 'DELTA',
    path: '/protocols',
    cacheTTL: 300,
  });
  
  const protocols = result.data.slice(0, 100).map((p: any) => ({
    id: p.slug,
    name: p.name,
    symbol: p.symbol,
    tvl: p.tvl,
    change24h: p.change_1d,
    change7d: p.change_7d,
    category: p.category,
    chains: p.chains,
  }));
  
  const totalTVL = result.data.reduce((sum: number, p: any) => sum + (p.tvl || 0), 0);
  
  return { protocols, totalTVL };
}

/**
 * Get gas prices (Ethereum & Bitcoin)
 */
export async function getGasPrices(): Promise<{
  ethereum: { slow: number; standard: number; fast: number };
  bitcoin: { slow: number; standard: number; fast: number };
}> {
  // Fetch Bitcoin fees
  const btcResult = await fetchFromSource<{ fastestFee: number; halfHourFee: number; hourFee: number }>({
    source: 'ZETA',
    path: '/v1/fees/recommended',
    cacheTTL: 30,
    fallbackSources: ['ETA'],
  });
  
  return {
    ethereum: {
      slow: 20, // Would fetch from ETH gas tracker
      standard: 25,
      fast: 35,
    },
    bitcoin: {
      slow: btcResult.data.hourFee,
      standard: btcResult.data.halfHourFee,
      fast: btcResult.data.fastestFee,
    },
  };
}

/**
 * Get exchange ticker data
 */
export async function getExchangeTicker(symbol: string): Promise<{
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  high24h: number;
  low24h: number;
  change24h: number;
}> {
  const result = await fetchFromSource<any>({
    source: 'THETA',
    path: '/ticker/24hr',
    params: { symbol: `${symbol.toUpperCase()}USDT` },
    cacheTTL: 10,
    fallbackSources: ['IOTA', 'KAPPA'],
  });
  
  const d = result.data;
  return {
    symbol: d.symbol,
    price: parseFloat(d.lastPrice),
    bid: parseFloat(d.bidPrice),
    ask: parseFloat(d.askPrice),
    volume: parseFloat(d.volume),
    high24h: parseFloat(d.highPrice),
    low24h: parseFloat(d.lowPrice),
    change24h: parseFloat(d.priceChangePercent),
  };
}

// =============================================================================
// ADDITIONAL DATA FETCHERS
// =============================================================================

export interface CoinDetails extends CoinMarketData {
  description: string;
  homepage: string;
  github: string[];
  twitter: string;
  reddit: string;
  categories: string[];
  genesisDate: string | null;
  hashingAlgorithm: string | null;
  blockTime: number | null;
  developerScore: number;
  communityScore: number;
  liquidityScore: number;
  sentimentUp: number;
  sentimentDown: number;
}

export interface HistoricalPrice {
  timestamp: number;
  price: number;
  marketCap: number;
  volume: number;
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  thumb: string;
  priceBtc: number;
  score: number;
}

export interface SearchResult {
  id: string;
  name: string;
  symbol: string;
  rank: number | null;
  thumb: string;
  type: 'coin' | 'exchange' | 'nft';
}

export interface VolatilityMetrics {
  id: string;
  symbol: string;
  name: string;
  volatility24h: number;
  volatility7d: number;
  volatility30d: number;
  maxDrawdown30d: number;
  sharpeRatio: number;
  beta: number;
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
}

/**
 * Get detailed coin data
 */
export async function getCoinDetails(coinId: string): Promise<CoinDetails> {
  const result = await fetchFromSource<any>({
    source: 'ALPHA',
    path: `/coins/${coinId}`,
    params: {
      localization: false,
      tickers: false,
      market_data: true,
      community_data: true,
      developer_data: true,
      sparkline: true,
    },
    cacheTTL: 120,
    fallbackSources: ['GAMMA'],
  });

  const d = result.data;
  const market = d.market_data || {};

  return {
    id: d.id,
    symbol: d.symbol?.toUpperCase() || '',
    name: d.name || '',
    price: market.current_price?.usd || 0,
    marketCap: market.market_cap?.usd || 0,
    rank: market.market_cap_rank || 0,
    volume24h: market.total_volume?.usd || 0,
    priceChange24h: market.price_change_24h || 0,
    priceChangePercent24h: market.price_change_percentage_24h || 0,
    priceChangePercent7d: market.price_change_percentage_7d,
    priceChangePercent30d: market.price_change_percentage_30d,
    circulatingSupply: market.circulating_supply || 0,
    totalSupply: market.total_supply,
    maxSupply: market.max_supply,
    ath: market.ath?.usd || 0,
    athChangePercent: market.ath_change_percentage?.usd || 0,
    image: d.image?.large,
    sparkline: market.sparkline_7d?.price,
    lastUpdated: market.last_updated || new Date().toISOString(),
    // Extended details
    description: d.description?.en?.slice(0, 500) || '',
    homepage: d.links?.homepage?.[0] || '',
    github: d.links?.repos_url?.github || [],
    twitter: d.links?.twitter_screen_name || '',
    reddit: d.links?.subreddit_url || '',
    categories: d.categories || [],
    genesisDate: d.genesis_date,
    hashingAlgorithm: d.hashing_algorithm,
    blockTime: d.block_time_in_minutes,
    developerScore: d.developer_score || 0,
    communityScore: d.community_score || 0,
    liquidityScore: d.liquidity_score || 0,
    sentimentUp: d.sentiment_votes_up_percentage || 0,
    sentimentDown: d.sentiment_votes_down_percentage || 0,
  };
}

/**
 * Get historical price data
 */
export async function getHistoricalPrices(
  coinId: string,
  days: number = 30
): Promise<HistoricalPrice[]> {
  const params: Record<string, string | number | boolean> = {
    vs_currency: 'usd',
    days,
  };
  
  if (days > 90) {
    params.interval = 'daily';
  }
  
  const result = await fetchFromSource<{ prices: number[][]; market_caps: number[][]; total_volumes: number[][] }>({
    source: 'ALPHA',
    path: `/coins/${coinId}/market_chart`,
    params,
    cacheTTL: days <= 1 ? 60 : days <= 7 ? 300 : 900,
    fallbackSources: ['BETA'],
  });

  const { prices, market_caps, total_volumes } = result.data;
  
  return prices.map((p, i) => ({
    timestamp: p[0],
    price: p[1],
    marketCap: market_caps[i]?.[1] || 0,
    volume: total_volumes[i]?.[1] || 0,
  }));
}

/**
 * Get trending cryptocurrencies
 */
export async function getTrendingCoins(): Promise<TrendingCoin[]> {
  const result = await fetchFromSource<{ coins: { item: any }[] }>({
    source: 'ALPHA',
    path: '/search/trending',
    cacheTTL: 300,
  });

  return result.data.coins.map((c, i) => ({
    id: c.item.id,
    name: c.item.name,
    symbol: c.item.symbol?.toUpperCase() || '',
    rank: c.item.market_cap_rank || null,
    thumb: c.item.thumb || '',
    priceBtc: c.item.price_btc || 0,
    score: i + 1,
  }));
}

/**
 * Search for cryptocurrencies
 */
export async function searchCoins(query: string): Promise<SearchResult[]> {
  const result = await fetchFromSource<{ coins: any[]; exchanges: any[]; nfts: any[] }>({
    source: 'ALPHA',
    path: '/search',
    params: { query },
    cacheTTL: 300,
  });

  const coins = result.data.coins.slice(0, 20).map((c: any) => ({
    id: c.id,
    name: c.name,
    symbol: c.symbol?.toUpperCase() || '',
    rank: c.market_cap_rank,
    thumb: c.thumb || '',
    type: 'coin' as const,
  }));

  const exchanges = result.data.exchanges.slice(0, 5).map((e: any) => ({
    id: e.id,
    name: e.name,
    symbol: '',
    rank: null,
    thumb: e.thumb || '',
    type: 'exchange' as const,
  }));

  return [...coins, ...exchanges];
}

/**
 * Calculate volatility metrics for coins
 */
export async function getVolatilityMetrics(coinIds: string[]): Promise<VolatilityMetrics[]> {
  // Fetch historical data for volatility calculation
  const results = await Promise.all(
    coinIds.slice(0, 10).map(async (id) => {
      try {
        const [details, history] = await Promise.all([
          getCoinDetails(id),
          getHistoricalPrices(id, 30),
        ]);

        const prices = history.map(h => h.price);
        const returns = calculateReturns(prices);
        
        const volatility30d = calculateVolatility(returns) * Math.sqrt(365) * 100;
        const volatility7d = calculateVolatility(returns.slice(-7)) * Math.sqrt(365) * 100;
        const volatility24h = calculateVolatility(returns.slice(-1)) * Math.sqrt(365) * 100;
        const maxDrawdown = calculateMaxDrawdown(prices);
        
        // Simplified Sharpe ratio (assuming risk-free rate of 5%)
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const sharpeRatio = ((avgReturn * 365) - 0.05) / (volatility30d / 100);
        
        // Beta relative to BTC (simplified - would need BTC data)
        const beta = volatility30d / 45; // Assume BTC volatility ~45%

        return {
          id,
          symbol: details.symbol,
          name: details.name,
          volatility24h: Math.round(volatility24h * 10) / 10,
          volatility7d: Math.round(volatility7d * 10) / 10,
          volatility30d: Math.round(volatility30d * 10) / 10,
          maxDrawdown30d: Math.round(maxDrawdown * 10) / 10,
          sharpeRatio: Math.round(sharpeRatio * 100) / 100,
          beta: Math.round(beta * 100) / 100,
          riskLevel: getRiskLevel(volatility30d),
        };
      } catch {
        return null;
      }
    })
  );

  return results.filter((r): r is VolatilityMetrics => r !== null);
}

function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

function calculateVolatility(returns: number[]): number {
  if (returns.length === 0) return 0;
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const squaredDiffs = returns.map(r => Math.pow(r - mean, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / returns.length);
}

function calculateMaxDrawdown(prices: number[]): number {
  let maxDrawdown = 0;
  let peak = prices[0];
  
  for (const price of prices) {
    if (price > peak) peak = price;
    const drawdown = ((peak - price) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  return -maxDrawdown;
}

function getRiskLevel(volatility: number): 'low' | 'medium' | 'high' | 'extreme' {
  if (volatility < 40) return 'low';
  if (volatility < 60) return 'medium';
  if (volatility < 80) return 'high';
  return 'extreme';
}

// =============================================================================
// DATA NORMALIZATION
// =============================================================================

function normalizeMarketData(raw: any): CoinMarketData {
  return {
    id: raw.id,
    symbol: raw.symbol?.toUpperCase() || '',
    name: raw.name || '',
    price: raw.current_price || 0,
    marketCap: raw.market_cap || 0,
    rank: raw.market_cap_rank || 0,
    volume24h: raw.total_volume || 0,
    priceChange24h: raw.price_change_24h || 0,
    priceChangePercent24h: raw.price_change_percentage_24h || 0,
    priceChangePercent7d: raw.price_change_percentage_7d_in_currency,
    priceChangePercent30d: raw.price_change_percentage_30d_in_currency,
    circulatingSupply: raw.circulating_supply || 0,
    totalSupply: raw.total_supply,
    maxSupply: raw.max_supply,
    ath: raw.ath || 0,
    athChangePercent: raw.ath_change_percentage || 0,
    image: raw.image,
    sparkline: raw.sparkline_in_7d?.price,
    lastUpdated: raw.last_updated || new Date().toISOString(),
  };
}

// =============================================================================
// HEALTH CHECK (Internal only - never expose details)
// =============================================================================

export async function checkSourceHealth(): Promise<{
  healthy: boolean;
  availableSources: number;
  totalSources: number;
}> {
  const sources = Object.keys(SOURCES) as SourceKey[];
  let healthyCount = 0;
  
  await Promise.all(
    sources.map(async (source) => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(SOURCES[source], {
          method: 'HEAD',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        if (response.ok) healthyCount++;
      } catch {
        // Source unavailable
      }
    })
  );
  
  return {
    healthy: healthyCount > sources.length / 2,
    availableSources: healthyCount,
    totalSources: sources.length,
  };
}
