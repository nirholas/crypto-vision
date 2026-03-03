/**
 * @nirholas/crypto-market-data
 * 
 * Comprehensive cryptocurrency market data service with CoinGecko, 
 * DeFiLlama, and Fear & Greed Index integration.
 * 
 * Features:
 * - Built-in caching with stale-while-revalidate
 * - Intelligent rate limiting for CoinGecko free tier
 * - Edge Runtime compatible (Cloudflare Workers, Vercel Edge, etc.)
 * - Full TypeScript support
 * - Zero dependencies
 * 
 * @module @nirholas/crypto-market-data
 * @author nirholas
 * @license MIT
 */

// =============================================================================
// API ENDPOINTS
// =============================================================================

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const DEFILLAMA_BASE = 'https://api.llama.fi';
const ALTERNATIVE_ME = 'https://api.alternative.me';

// =============================================================================
// CONFIGURATION
// =============================================================================

/**
 * Cache duration settings based on data volatility (in seconds)
 */
export const CACHE_TTL = {
  /** Live prices - 30 seconds */
  prices: 30,
  /** 24h historical data - 1 minute */
  historical_1d: 60,
  /** Weekly historical data - 5 minutes */
  historical_7d: 300,
  /** Monthly historical data - 15 minutes */
  historical_30d: 900,
  /** 90+ day historical data - 30 minutes */
  historical_90d: 1800,
  /** Exchange/ticker data - 2 minutes */
  tickers: 120,
  /** Static data (categories, coin list) - 1 hour */
  static: 3600,
  /** Search results - 5 minutes */
  search: 300,
  /** Developer/community data - 30 minutes */
  social: 1800,
  /** Global data - 5 minutes */
  global: 300,
} as const;

/**
 * Configuration options for the market data client
 */
export interface MarketDataConfig {
  /** Rate limit window in milliseconds (default: 60000) */
  rateLimitWindow?: number;
  /** Maximum requests per window (default: 25) */
  maxRequestsPerWindow?: number;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Custom User-Agent header */
  userAgent?: string;
  /** Custom fetch implementation (for testing or polyfills) */
  customFetch?: typeof fetch;
}

// =============================================================================
// TYPES - BASIC
// =============================================================================

export interface TokenPrice {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  last_updated: string;
  image?: string;
  sparkline_in_7d?: { price: number[] };
}

export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number;
  thumb: string;
  small: string;
  large: string;
  price_btc: number;
  score: number;
}

export interface GlobalMarketData {
  active_cryptocurrencies: number;
  markets: number;
  total_market_cap: Record<string, number>;
  total_volume: Record<string, number>;
  market_cap_percentage: Record<string, number>;
  market_cap_change_percentage_24h_usd: number;
  updated_at: number;
}

export interface FearGreedIndex {
  value: number;
  value_classification: string;
  timestamp: string;
  time_until_update: string;
}

export interface ProtocolTVL {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  chains: string[];
  tvl: number;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  category: string;
  logo: string;
  url: string;
}

export interface ChainTVL {
  name: string;
  tvl: number;
  tokenSymbol: string;
  gecko_id: string;
  chainId: number;
}

export interface MarketOverview {
  global: GlobalMarketData;
  fearGreed: FearGreedIndex | null;
  topCoins: TokenPrice[];
  trending: TrendingCoin[];
  btcPrice: number;
  ethPrice: number;
  btcChange24h: number;
  ethChange24h: number;
}

export interface SimplePrices {
  bitcoin: { usd: number; usd_24h_change: number };
  ethereum: { usd: number; usd_24h_change: number };
  solana: { usd: number; usd_24h_change: number };
}

// =============================================================================
// TYPES - HISTORICAL DATA
// =============================================================================

export interface HistoricalData {
  prices: [number, number][];
  market_caps: [number, number][];
  total_volumes: [number, number][];
}

export interface OHLCData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface HistoricalSnapshot {
  id: string;
  symbol: string;
  name: string;
  image: {
    thumb: string;
    small: string;
  };
  market_data: {
    current_price: Record<string, number>;
    market_cap: Record<string, number>;
    total_volume: Record<string, number>;
  };
}

// =============================================================================
// TYPES - EXCHANGE & TICKER DATA
// =============================================================================

export interface Ticker {
  base: string;
  target: string;
  market: {
    identifier: string;
    name: string;
    logo: string;
    has_trading_incentive: boolean;
  };
  last: number;
  volume: number;
  trust_score: 'green' | 'yellow' | 'red' | null;
  bid_ask_spread_percentage: number;
  trade_url: string;
  converted_last: {
    usd: number;
    btc: number;
    eth: number;
  };
  converted_volume: {
    usd: number;
    btc: number;
    eth: number;
  };
  timestamp: string;
  last_fetch_at: string;
  is_anomaly: boolean;
  is_stale: boolean;
}

export interface TickerData {
  name: string;
  tickers: Ticker[];
}

export interface Exchange {
  id: string;
  name: string;
  year_established: number | null;
  country: string | null;
  description: string;
  url: string;
  image: string;
  has_trading_incentive: boolean;
  trust_score: number;
  trust_score_rank: number;
  trade_volume_24h_btc: number;
  trade_volume_24h_btc_normalized: number;
}

export interface ExchangeDetails extends Exchange {
  facebook_url: string;
  reddit_url: string;
  telegram_url: string;
  slack_url: string;
  other_url_1: string;
  other_url_2: string;
  twitter_handle: string;
  centralized: boolean;
  public_notice: string;
  alert_notice: string;
  tickers: Ticker[];
}

// =============================================================================
// TYPES - CATEGORIES
// =============================================================================

export interface Category {
  category_id: string;
  name: string;
  market_cap: number;
  market_cap_change_24h: number;
  content: string;
  top_3_coins: string[];
  volume_24h: number;
  updated_at: string;
}

// =============================================================================
// TYPES - SEARCH
// =============================================================================

export interface SearchResult {
  coins: SearchCoin[];
  exchanges: SearchExchange[];
  categories: SearchCategory[];
  nfts: SearchNFT[];
}

export interface SearchCoin {
  id: string;
  name: string;
  api_symbol: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string;
  large: string;
}

export interface SearchExchange {
  id: string;
  name: string;
  market_type: string;
  thumb: string;
  large: string;
}

export interface SearchCategory {
  id: number;
  name: string;
}

export interface SearchNFT {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
}

// =============================================================================
// TYPES - COMPARE
// =============================================================================

export interface CompareData {
  coins: CompareCoin[];
  comparison_date: string;
}

export interface CompareCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d: number;
  price_change_percentage_30d: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
}

// =============================================================================
// TYPES - COIN LIST
// =============================================================================

export interface CoinListItem {
  id: string;
  symbol: string;
  name: string;
}

// =============================================================================
// TYPES - DEVELOPER & COMMUNITY DATA
// =============================================================================

export interface DeveloperData {
  forks: number;
  stars: number;
  subscribers: number;
  total_issues: number;
  closed_issues: number;
  pull_requests_merged: number;
  pull_request_contributors: number;
  commit_count_4_weeks: number;
  last_4_weeks_commit_activity_series: number[];
  code_additions_deletions_4_weeks: {
    additions: number | null;
    deletions: number | null;
  };
}

export interface CommunityData {
  twitter_followers: number | null;
  reddit_subscribers: number | null;
  reddit_average_posts_48h: number;
  reddit_average_comments_48h: number;
  reddit_accounts_active_48h: number;
  telegram_channel_user_count: number | null;
  facebook_likes: number | null;
}

// =============================================================================
// TYPES - GLOBAL DEFI
// =============================================================================

export interface GlobalDeFi {
  defi_market_cap: string;
  eth_market_cap: string;
  defi_to_eth_ratio: string;
  trading_volume_24h: string;
  defi_dominance: string;
  top_coin_name: string;
  top_coin_defi_dominance: number;
}

// =============================================================================
// TYPES - DERIVATIVES
// =============================================================================

export interface DerivativeTicker {
  market: string;
  symbol: string;
  index_id: string;
  price: string;
  price_percentage_change_24h: number;
  contract_type: string;
  index: number | null;
  basis: number;
  spread: number | null;
  funding_rate: number;
  open_interest: number | null;
  volume_24h: number;
  last_traded_at: number;
  expired_at: string | null;
}

// =============================================================================
// ERROR HANDLING
// =============================================================================

export class MarketDataError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isRateLimited: boolean = false
  ) {
    super(message);
    this.name = 'MarketDataError';
  }
}

// =============================================================================
// MARKET DATA CLIENT
// =============================================================================

/**
 * Market Data Client
 * 
 * A comprehensive cryptocurrency market data service with built-in
 * caching and rate limiting.
 * 
 * @example
 * ```typescript
 * import { MarketDataClient } from '@nirholas/crypto-market-data';
 * 
 * const client = new MarketDataClient();
 * 
 * // Get market overview
 * const overview = await client.getMarketOverview();
 * console.log(`BTC: $${overview.btcPrice}`);
 * 
 * // Get top coins
 * const coins = await client.getTopCoins(10);
 * coins.forEach(coin => console.log(`${coin.name}: $${coin.current_price}`));
 * ```
 */
export class MarketDataClient {
  private cache = new Map<string, CacheEntry<unknown>>();
  private rateLimitState: RateLimitState;
  private config: Required<MarketDataConfig>;

  constructor(config: MarketDataConfig = {}) {
    this.config = {
      rateLimitWindow: config.rateLimitWindow ?? 60000,
      maxRequestsPerWindow: config.maxRequestsPerWindow ?? 25,
      timeout: config.timeout ?? 10000,
      userAgent: config.userAgent ?? 'CryptoMarketData/1.0',
      customFetch: config.customFetch ?? fetch,
    };

    this.rateLimitState = {
      requestCount: 0,
      windowStart: Date.now(),
      retryAfter: 0,
    };
  }

  // ===========================================================================
  // CACHE METHODS
  // ===========================================================================

  private getCached<T>(key: string): { data: T; isStale: boolean } | null {
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!cached) {
      return null;
    }

    const now = Date.now();
    const isExpired = now - cached.timestamp > cached.ttl * 1000;

    if (isExpired && now - cached.timestamp > cached.ttl * 2 * 1000) {
      this.cache.delete(key);
      return null;
    }

    const isStale = now - cached.timestamp > cached.staleTimestamp * 1000;
    return { data: cached.data, isStale };
  }

  private setCache<T>(key: string, data: T, ttlSeconds: number = CACHE_TTL.prices): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds,
      staleTimestamp: ttlSeconds * 0.8,
    });
  }

  private getHistoricalCacheTTL(days: number): number {
    if (days <= 1) return CACHE_TTL.historical_1d;
    if (days <= 7) return CACHE_TTL.historical_7d;
    if (days <= 30) return CACHE_TTL.historical_30d;
    return CACHE_TTL.historical_90d;
  }

  /**
   * Clear all cached data
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }

  // ===========================================================================
  // RATE LIMITING
  // ===========================================================================

  private canMakeRequest(): boolean {
    const now = Date.now();

    if (this.rateLimitState.retryAfter > now) {
      return false;
    }

    if (now - this.rateLimitState.windowStart > this.config.rateLimitWindow) {
      this.rateLimitState.requestCount = 0;
      this.rateLimitState.windowStart = now;
    }

    return this.rateLimitState.requestCount < this.config.maxRequestsPerWindow;
  }

  private recordRequest(): void {
    this.rateLimitState.requestCount++;
  }

  private handleRateLimitError(retryAfterHeader?: string): void {
    const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 60;
    const backoffMs = Math.min(retryAfterSeconds * 1000, 120000);
    this.rateLimitState.retryAfter = Date.now() + backoffMs;
  }

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): { remaining: number; windowResetAt: number; isBlocked: boolean } {
    const now = Date.now();
    return {
      remaining: Math.max(0, this.config.maxRequestsPerWindow - this.rateLimitState.requestCount),
      windowResetAt: this.rateLimitState.windowStart + this.config.rateLimitWindow,
      isBlocked: this.rateLimitState.retryAfter > now,
    };
  }

  // ===========================================================================
  // FETCH HELPERS
  // ===========================================================================

  private async fetchWithTimeout(url: string): Promise<Response> {
    if (!this.canMakeRequest()) {
      throw new MarketDataError('Rate limit exceeded. Please try again later.', 429, true);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      this.recordRequest();

      const response = await this.config.customFetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': this.config.userAgent,
        },
      });

      if (response.status === 429) {
        this.handleRateLimitError(response.headers.get('retry-after') ?? undefined);
        throw new MarketDataError('Rate limited by API', 429, true);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private async fetchAndCache<T>(
    url: string,
    cacheKey: string,
    ttl: number,
    fallbackValue?: T
  ): Promise<T> {
    try {
      const response = await this.fetchWithTimeout(url);

      if (!response.ok) {
        throw new MarketDataError(`API request failed: ${response.statusText}`, response.status);
      }

      const data = (await response.json()) as T;
      this.setCache(cacheKey, data, ttl);
      return data;
    } catch (error) {
      const cached = this.getCached<T>(cacheKey);
      if (cached) {
        return cached.data;
      }

      if (fallbackValue !== undefined) {
        return fallbackValue;
      }

      throw error;
    }
  }

  // ===========================================================================
  // COINGECKO API - PRICES
  // ===========================================================================

  /**
   * Get simple prices for major coins (BTC, ETH, SOL)
   */
  async getSimplePrices(): Promise<SimplePrices> {
    const cacheKey = 'simple-prices';
    const cached = this.getCached<SimplePrices>(cacheKey);
    if (cached) return cached.data;

    const fallback: SimplePrices = {
      bitcoin: { usd: 0, usd_24h_change: 0 },
      ethereum: { usd: 0, usd_24h_change: 0 },
      solana: { usd: 0, usd_24h_change: 0 },
    };

    return this.fetchAndCache(
      `${COINGECKO_BASE}/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd&include_24hr_change=true`,
      cacheKey,
      CACHE_TTL.prices,
      fallback
    );
  }

  /**
   * Get top coins by market cap
   * @param limit - Number of coins to fetch (max 250)
   */
  async getTopCoins(limit = 50): Promise<TokenPrice[]> {
    const cacheKey = `top-coins-${limit}`;
    const cached = this.getCached<TokenPrice[]>(cacheKey);
    if (cached) return cached.data;

    return this.fetchAndCache(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=7d`,
      cacheKey,
      CACHE_TTL.prices,
      []
    );
  }

  /**
   * Get trending coins
   */
  async getTrending(): Promise<TrendingCoin[]> {
    const cacheKey = 'trending';
    const cached = this.getCached<TrendingCoin[]>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(`${COINGECKO_BASE}/search/trending`);

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch trending', response.status);
      }

      const data = await response.json();
      const trending = data.coins.map((c: { item: TrendingCoin }) => c.item);
      this.setCache(cacheKey, trending, CACHE_TTL.global);
      return trending;
    } catch {
      return [];
    }
  }

  /**
   * Get global market data
   */
  async getGlobalMarketData(): Promise<GlobalMarketData | null> {
    const cacheKey = 'global';
    const cached = this.getCached<GlobalMarketData>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(`${COINGECKO_BASE}/global`);

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch global data', response.status);
      }

      const data = await response.json();
      this.setCache(cacheKey, data.data, CACHE_TTL.global);
      return data.data;
    } catch {
      return null;
    }
  }

  /**
   * Get detailed coin information
   * @param coinId - CoinGecko coin ID (e.g., "bitcoin", "ethereum")
   */
  async getCoinDetails(coinId: string): Promise<Record<string, unknown> | null> {
    const cacheKey = `coin-${coinId}`;
    const cached = this.getCached<Record<string, unknown>>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(
        `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`
      );

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch coin details', response.status);
      }

      const data = await response.json();
      this.setCache(cacheKey, data, CACHE_TTL.global);
      return data;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // FEAR & GREED INDEX (Alternative.me)
  // ===========================================================================

  /**
   * Get Fear & Greed Index
   */
  async getFearGreedIndex(): Promise<FearGreedIndex | null> {
    const cacheKey = 'fear-greed';
    const cached = this.getCached<FearGreedIndex>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(`${ALTERNATIVE_ME}/fng/`);

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch fear & greed index', response.status);
      }

      const data = await response.json();
      const fng = data.data?.[0];
      if (fng) {
        this.setCache(cacheKey, fng, CACHE_TTL.global);
      }
      return fng || null;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // DEFILLAMA API
  // ===========================================================================

  /**
   * Get top DeFi protocols by TVL
   * @param limit - Number of protocols to return
   */
  async getTopProtocols(limit = 20): Promise<ProtocolTVL[]> {
    const cacheKey = `protocols-${limit}`;
    const cached = this.getCached<ProtocolTVL[]>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(`${DEFILLAMA_BASE}/protocols`);

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch protocols', response.status);
      }

      const data = await response.json();
      const top = data
        .filter((p: ProtocolTVL) => p.tvl > 0)
        .sort((a: ProtocolTVL, b: ProtocolTVL) => b.tvl - a.tvl)
        .slice(0, limit);

      this.setCache(cacheKey, top, CACHE_TTL.global);
      return top;
    } catch {
      return [];
    }
  }

  /**
   * Get top chains by TVL
   * @param limit - Number of chains to return
   */
  async getTopChains(limit = 20): Promise<ChainTVL[]> {
    const cacheKey = `chains-${limit}`;
    const cached = this.getCached<ChainTVL[]>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(`${DEFILLAMA_BASE}/v2/chains`);

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch chains', response.status);
      }

      const data = await response.json();
      const top = data
        .sort((a: ChainTVL, b: ChainTVL) => (b.tvl || 0) - (a.tvl || 0))
        .slice(0, limit);

      this.setCache(cacheKey, top, CACHE_TTL.global);
      return top;
    } catch {
      return [];
    }
  }

  // ===========================================================================
  // COMBINED ENDPOINTS
  // ===========================================================================

  /**
   * Get comprehensive market overview (combines multiple endpoints)
   */
  async getMarketOverview(): Promise<MarketOverview> {
    const [prices, global, fearGreed, topCoins, trending] = await Promise.all([
      this.getSimplePrices(),
      this.getGlobalMarketData(),
      this.getFearGreedIndex(),
      this.getTopCoins(10),
      this.getTrending(),
    ]);

    return {
      global: global || {
        active_cryptocurrencies: 0,
        markets: 0,
        total_market_cap: {},
        total_volume: {},
        market_cap_percentage: {},
        market_cap_change_percentage_24h_usd: 0,
        updated_at: Date.now(),
      },
      fearGreed,
      topCoins,
      trending,
      btcPrice: prices.bitcoin?.usd || 0,
      ethPrice: prices.ethereum?.usd || 0,
      btcChange24h: prices.bitcoin?.usd_24h_change || 0,
      ethChange24h: prices.ethereum?.usd_24h_change || 0,
    };
  }

  // ===========================================================================
  // HISTORICAL DATA
  // ===========================================================================

  /**
   * Get historical price data for a coin
   * @param coinId - CoinGecko coin ID
   * @param days - Number of days (1, 7, 14, 30, 90, 180, 365, or 'max')
   * @param interval - Data interval: 'minutely' (1d), 'hourly' (1-90d), 'daily' (90d+)
   */
  async getHistoricalPrices(
    coinId: string,
    days: number | 'max',
    interval?: 'minutely' | 'hourly' | 'daily'
  ): Promise<HistoricalData> {
    const daysParam = days === 'max' ? 'max' : days.toString();
    const intervalParam = interval ? `&interval=${interval}` : '';
    const cacheKey = `historical-${coinId}-${daysParam}-${interval || 'auto'}`;
    const cacheTTL = typeof days === 'number' ? this.getHistoricalCacheTTL(days) : CACHE_TTL.historical_90d;

    const cached = this.getCached<HistoricalData>(cacheKey);
    if (cached) return cached.data;

    return this.fetchAndCache(
      `${COINGECKO_BASE}/coins/${coinId}/market_chart?vs_currency=usd&days=${daysParam}${intervalParam}`,
      cacheKey,
      cacheTTL,
      { prices: [], market_caps: [], total_volumes: [] }
    );
  }

  /**
   * Get OHLC candlestick data for a coin
   * @param coinId - CoinGecko coin ID
   * @param days - Number of days (1, 7, 14, 30, 90, 180, 365)
   */
  async getOHLC(coinId: string, days: number): Promise<OHLCData[]> {
    const validDays = [1, 7, 14, 30, 90, 180, 365];
    const normalizedDays = validDays.reduce((prev, curr) =>
      Math.abs(curr - days) < Math.abs(prev - days) ? curr : prev
    );

    const cacheKey = `ohlc-${coinId}-${normalizedDays}`;
    const cacheTTL = this.getHistoricalCacheTTL(normalizedDays);

    const cached = this.getCached<OHLCData[]>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(
        `${COINGECKO_BASE}/coins/${coinId}/ohlc?vs_currency=usd&days=${normalizedDays}`
      );

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch OHLC data', response.status);
      }

      const rawData: [number, number, number, number, number][] = await response.json();
      const ohlcData: OHLCData[] = rawData.map(([timestamp, open, high, low, close]) => ({
        timestamp,
        open,
        high,
        low,
        close,
      }));

      this.setCache(cacheKey, ohlcData, cacheTTL);
      return ohlcData;
    } catch {
      return [];
    }
  }

  /**
   * Get historical price at a specific date
   * @param coinId - CoinGecko coin ID
   * @param date - Date in DD-MM-YYYY format
   */
  async getHistoricalPrice(coinId: string, date: string): Promise<HistoricalSnapshot | null> {
    const cacheKey = `historical-snapshot-${coinId}-${date}`;

    const cached = this.getCached<HistoricalSnapshot>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(
        `${COINGECKO_BASE}/coins/${coinId}/history?date=${date}&localization=false`
      );

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch historical price', response.status);
      }

      const data: HistoricalSnapshot = await response.json();
      this.setCache(cacheKey, data, CACHE_TTL.static);
      return data;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // EXCHANGES & TICKERS
  // ===========================================================================

  /**
   * Get trading pairs/tickers for a coin
   * @param coinId - CoinGecko coin ID
   * @param page - Page number for pagination
   */
  async getCoinTickers(coinId: string, page: number = 1): Promise<TickerData> {
    const cacheKey = `tickers-${coinId}-${page}`;

    const cached = this.getCached<TickerData>(cacheKey);
    if (cached) return cached.data;

    return this.fetchAndCache(
      `${COINGECKO_BASE}/coins/${coinId}/tickers?page=${page}&include_exchange_logo=true&order=volume_desc`,
      cacheKey,
      CACHE_TTL.tickers,
      { name: coinId, tickers: [] }
    );
  }

  /**
   * Get list of all exchanges
   * @param perPage - Number of exchanges per page (max 250)
   * @param page - Page number
   */
  async getExchanges(perPage: number = 100, page: number = 1): Promise<Exchange[]> {
    const cacheKey = `exchanges-${perPage}-${page}`;

    const cached = this.getCached<Exchange[]>(cacheKey);
    if (cached) return cached.data;

    return this.fetchAndCache(
      `${COINGECKO_BASE}/exchanges?per_page=${perPage}&page=${page}`,
      cacheKey,
      CACHE_TTL.static,
      []
    );
  }

  /**
   * Get detailed exchange information
   * @param exchangeId - CoinGecko exchange ID
   */
  async getExchangeDetails(exchangeId: string): Promise<ExchangeDetails | null> {
    const cacheKey = `exchange-${exchangeId}`;

    const cached = this.getCached<ExchangeDetails>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(`${COINGECKO_BASE}/exchanges/${exchangeId}`);

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch exchange details', response.status);
      }

      const data: ExchangeDetails = await response.json();
      this.setCache(cacheKey, data, CACHE_TTL.tickers);
      return data;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // CATEGORIES
  // ===========================================================================

  /**
   * Get list of all coin categories (DeFi, Gaming, L1, L2, etc.)
   */
  async getCategories(): Promise<Category[]> {
    const cacheKey = 'categories';

    const cached = this.getCached<Category[]>(cacheKey);
    if (cached) return cached.data;

    return this.fetchAndCache(`${COINGECKO_BASE}/coins/categories`, cacheKey, CACHE_TTL.static, []);
  }

  /**
   * Get coins in a specific category
   * @param categoryId - Category ID from getCategories()
   * @param perPage - Number of coins per page
   * @param page - Page number
   */
  async getCategoryCoins(categoryId: string, perPage: number = 100, page: number = 1): Promise<TokenPrice[]> {
    const cacheKey = `category-coins-${categoryId}-${perPage}-${page}`;

    const cached = this.getCached<TokenPrice[]>(cacheKey);
    if (cached) return cached.data;

    return this.fetchAndCache(
      `${COINGECKO_BASE}/coins/markets?vs_currency=usd&category=${encodeURIComponent(categoryId)}&order=market_cap_desc&per_page=${perPage}&page=${page}&sparkline=false`,
      cacheKey,
      CACHE_TTL.global,
      []
    );
  }

  // ===========================================================================
  // SEARCH
  // ===========================================================================

  /**
   * Search for coins, exchanges, and categories
   * @param query - Search query string
   */
  async searchCoins(query: string): Promise<SearchResult> {
    if (!query || query.length < 2) {
      return { coins: [], exchanges: [], categories: [], nfts: [] };
    }

    const cacheKey = `search-${query.toLowerCase()}`;

    const cached = this.getCached<SearchResult>(cacheKey);
    if (cached) return cached.data;

    return this.fetchAndCache(
      `${COINGECKO_BASE}/search?query=${encodeURIComponent(query)}`,
      cacheKey,
      CACHE_TTL.search,
      { coins: [], exchanges: [], categories: [], nfts: [] }
    );
  }

  /**
   * Compare multiple coins side by side
   * @param coinIds - Array of CoinGecko coin IDs (max 25)
   */
  async compareCoins(coinIds: string[]): Promise<CompareData> {
    if (coinIds.length === 0) {
      return { coins: [], comparison_date: new Date().toISOString() };
    }

    const limitedIds = coinIds.slice(0, 25);
    const cacheKey = `compare-${limitedIds.sort().join(',')}`;

    const cached = this.getCached<CompareData>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(
        `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${limitedIds.join(',')}&order=market_cap_desc&per_page=25&page=1&sparkline=false&price_change_percentage=7d,30d`
      );

      if (!response.ok) {
        throw new MarketDataError('Failed to compare coins', response.status);
      }

      const rawData = await response.json();
      const coins: CompareCoin[] = rawData.map((coin: Record<string, unknown>) => ({
        id: coin.id as string,
        symbol: coin.symbol as string,
        name: coin.name as string,
        image: coin.image as string,
        current_price: coin.current_price as number,
        market_cap: coin.market_cap as number,
        market_cap_rank: coin.market_cap_rank as number,
        total_volume: coin.total_volume as number,
        price_change_percentage_24h: coin.price_change_percentage_24h as number,
        price_change_percentage_7d: (coin.price_change_percentage_7d_in_currency as number) || 0,
        price_change_percentage_30d: (coin.price_change_percentage_30d_in_currency as number) || 0,
        circulating_supply: coin.circulating_supply as number,
        total_supply: coin.total_supply as number | null,
        max_supply: coin.max_supply as number | null,
        ath: coin.ath as number,
        ath_change_percentage: coin.ath_change_percentage as number,
        ath_date: coin.ath_date as string,
        atl: coin.atl as number,
        atl_change_percentage: coin.atl_change_percentage as number,
        atl_date: coin.atl_date as string,
      }));

      const result: CompareData = {
        coins,
        comparison_date: new Date().toISOString(),
      };

      this.setCache(cacheKey, result, CACHE_TTL.prices);
      return result;
    } catch {
      return { coins: [], comparison_date: new Date().toISOString() };
    }
  }

  /**
   * Get list of all coins (for autocomplete)
   */
  async getCoinsList(): Promise<CoinListItem[]> {
    const cacheKey = 'coins-list';

    const cached = this.getCached<CoinListItem[]>(cacheKey);
    if (cached) return cached.data;

    return this.fetchAndCache(`${COINGECKO_BASE}/coins/list`, cacheKey, CACHE_TTL.static, []);
  }

  // ===========================================================================
  // DEVELOPER & COMMUNITY
  // ===========================================================================

  /**
   * Get developer/GitHub statistics for a coin
   * @param coinId - CoinGecko coin ID
   */
  async getCoinDeveloperData(coinId: string): Promise<DeveloperData | null> {
    const cacheKey = `developer-${coinId}`;

    const cached = this.getCached<DeveloperData>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(
        `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=false&developer_data=true&sparkline=false`
      );

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch developer data', response.status);
      }

      const data = await response.json();
      const developerData: DeveloperData = data.developer_data || {
        forks: 0,
        stars: 0,
        subscribers: 0,
        total_issues: 0,
        closed_issues: 0,
        pull_requests_merged: 0,
        pull_request_contributors: 0,
        commit_count_4_weeks: 0,
        last_4_weeks_commit_activity_series: [],
        code_additions_deletions_4_weeks: { additions: null, deletions: null },
      };

      this.setCache(cacheKey, developerData, CACHE_TTL.social);
      return developerData;
    } catch {
      return null;
    }
  }

  /**
   * Get community/social statistics for a coin
   * @param coinId - CoinGecko coin ID
   */
  async getCoinCommunityData(coinId: string): Promise<CommunityData | null> {
    const cacheKey = `community-${coinId}`;

    const cached = this.getCached<CommunityData>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(
        `${COINGECKO_BASE}/coins/${coinId}?localization=false&tickers=false&market_data=false&community_data=true&developer_data=false&sparkline=false`
      );

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch community data', response.status);
      }

      const data = await response.json();
      const communityData: CommunityData = data.community_data || {
        twitter_followers: null,
        reddit_subscribers: null,
        reddit_average_posts_48h: 0,
        reddit_average_comments_48h: 0,
        reddit_accounts_active_48h: 0,
        telegram_channel_user_count: null,
        facebook_likes: null,
      };

      this.setCache(cacheKey, communityData, CACHE_TTL.social);
      return communityData;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // GLOBAL DEFI
  // ===========================================================================

  /**
   * Get global DeFi market statistics
   */
  async getGlobalDeFiData(): Promise<GlobalDeFi | null> {
    const cacheKey = 'global-defi';

    const cached = this.getCached<GlobalDeFi>(cacheKey);
    if (cached) return cached.data;

    try {
      const response = await this.fetchWithTimeout(`${COINGECKO_BASE}/global/decentralized_finance_defi`);

      if (!response.ok) {
        throw new MarketDataError('Failed to fetch global DeFi data', response.status);
      }

      const { data }: { data: GlobalDeFi } = await response.json();
      this.setCache(cacheKey, data, CACHE_TTL.global);
      return data;
    } catch {
      return null;
    }
  }

  // ===========================================================================
  // DERIVATIVES
  // ===========================================================================

  /**
   * Get derivatives market tickers (futures, perpetuals)
   */
  async getDerivativesTickers(): Promise<DerivativeTicker[]> {
    const cacheKey = 'derivatives-tickers';

    const cached = this.getCached<DerivativeTicker[]>(cacheKey);
    if (cached) return cached.data;

    return this.fetchAndCache(`${COINGECKO_BASE}/derivatives`, cacheKey, CACHE_TTL.tickers, []);
  }
}

// =============================================================================
// PRIVATE TYPES
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
  staleTimestamp: number;
}

interface RateLimitState {
  requestCount: number;
  windowStart: number;
  retryAfter: number;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format price for display
 * @param price - Price value
 * @returns Formatted price string
 */
export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '$0.00';
  if (price >= 1000) {
    return '$' + price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (price >= 1) {
    return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return '$' + price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
}

/**
 * Format large numbers with suffixes (K, M, B, T)
 * @param num - Number to format
 * @returns Formatted number string
 */
export function formatNumber(num: number | null | undefined): string {
  if (num == null) return '0';
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

/**
 * Format percentage for display
 * @param num - Percentage value
 * @returns Formatted percentage string with sign
 */
export function formatPercent(num: number | null | undefined): string {
  if (num == null) return '0.00%';
  const sign = num >= 0 ? '+' : '';
  return sign + num.toFixed(2) + '%';
}

/**
 * Get CSS color class for Fear & Greed value
 * @param value - Fear & Greed index value (0-100)
 * @returns Tailwind CSS color class
 */
export function getFearGreedColor(value: number): string {
  if (value <= 25) return 'text-red-500';
  if (value <= 45) return 'text-orange-500';
  if (value <= 55) return 'text-yellow-500';
  if (value <= 75) return 'text-lime-500';
  return 'text-green-500';
}

/**
 * Get CSS background color class for Fear & Greed value
 * @param value - Fear & Greed index value (0-100)
 * @returns Tailwind CSS background color class
 */
export function getFearGreedBgColor(value: number): string {
  if (value <= 25) return 'bg-red-500';
  if (value <= 45) return 'bg-orange-500';
  if (value <= 55) return 'bg-yellow-500';
  if (value <= 75) return 'bg-lime-500';
  return 'bg-green-500';
}

// =============================================================================
// DEFAULT INSTANCE
// =============================================================================

/**
 * Default client instance for convenience
 * 
 * @example
 * ```typescript
 * import { marketData } from '@nirholas/crypto-market-data';
 * 
 * const coins = await marketData.getTopCoins(10);
 * ```
 */
export const marketData = new MarketDataClient();

// =============================================================================
// LEGACY EXPORTS (for backwards compatibility)
// =============================================================================

// Re-export all methods from default instance for legacy usage
export const getSimplePrices = () => marketData.getSimplePrices();
export const getTopCoins = (limit?: number) => marketData.getTopCoins(limit);
export const getTrending = () => marketData.getTrending();
export const getGlobalMarketData = () => marketData.getGlobalMarketData();
export const getCoinDetails = (coinId: string) => marketData.getCoinDetails(coinId);
export const getFearGreedIndex = () => marketData.getFearGreedIndex();
export const getTopProtocols = (limit?: number) => marketData.getTopProtocols(limit);
export const getTopChains = (limit?: number) => marketData.getTopChains(limit);
export const getMarketOverview = () => marketData.getMarketOverview();
export const getHistoricalPrices = (coinId: string, days: number | 'max', interval?: 'minutely' | 'hourly' | 'daily') =>
  marketData.getHistoricalPrices(coinId, days, interval);
export const getOHLC = (coinId: string, days: number) => marketData.getOHLC(coinId, days);
export const getHistoricalPrice = (coinId: string, date: string) => marketData.getHistoricalPrice(coinId, date);
export const getCoinTickers = (coinId: string, page?: number) => marketData.getCoinTickers(coinId, page);
export const getExchanges = (perPage?: number, page?: number) => marketData.getExchanges(perPage, page);
export const getExchangeDetails = (exchangeId: string) => marketData.getExchangeDetails(exchangeId);
export const getCategories = () => marketData.getCategories();
export const getCategoryCoins = (categoryId: string, perPage?: number, page?: number) =>
  marketData.getCategoryCoins(categoryId, perPage, page);
export const searchCoins = (query: string) => marketData.searchCoins(query);
export const compareCoins = (coinIds: string[]) => marketData.compareCoins(coinIds);
export const getCoinsList = () => marketData.getCoinsList();
export const getCoinDeveloperData = (coinId: string) => marketData.getCoinDeveloperData(coinId);
export const getCoinCommunityData = (coinId: string) => marketData.getCoinCommunityData(coinId);
export const getGlobalDeFiData = () => marketData.getGlobalDeFiData();
export const getDerivativesTickers = () => marketData.getDerivativesTickers();
