/**
 * External Data Sources Configuration
 * Free APIs that don't require authentication
 *
 * @module external-apis
 */

// =============================================================================
// BASE URLs for External APIs
// =============================================================================

export const EXTERNAL_APIS = {
  // Market Data
  COINCAP: 'https://api.coincap.io/v2',
  COINPAPRIKA: 'https://api.coinpaprika.com/v1',
  CRYPTOWATCH: 'https://api.cryptowat.ch',

  // Exchange Public APIs
  BINANCE: 'https://api.binance.com/api/v3',
  BINANCE_FUTURES: 'https://fapi.binance.com',
  KRAKEN: 'https://api.kraken.com/0/public',
  KUCOIN: 'https://api.kucoin.com/api/v1',
  OKX: 'https://www.okx.com/api/v5',
  BYBIT: 'https://api.bybit.com/v5',
  DYDX: 'https://api.dydx.exchange/v3',
  DERIBIT: 'https://www.deribit.com/api/v2/public',

  // On-Chain Data
  MEMPOOL: 'https://mempool.space/api',
  BLOCKSTREAM: 'https://blockstream.info/api',
  BLOCKCHAIN_INFO: 'https://blockchain.info',
  BLOCKCHAIR: 'https://api.blockchair.com',

  // DeFi
  LLAMA_YIELDS: 'https://yields.llama.fi',

  // Existing
  COINGECKO: 'https://api.coingecko.com/api/v3',
  DEFILLAMA: 'https://api.llama.fi',
  ALTERNATIVE_ME: 'https://api.alternative.me',
} as const;

// =============================================================================
// WebSocket URLs for Real-Time Data
// =============================================================================

export const WEBSOCKET_URLS = {
  COINCAP_PRICES: 'wss://ws.coincap.io/prices',
  BINANCE_STREAM: 'wss://stream.binance.com:9443/ws',
  BINANCE_FUTURES_STREAM: 'wss://fstream.binance.com/ws',
  BYBIT_STREAM: 'wss://stream.bybit.com/v5/public/linear',
  OKX_STREAM: 'wss://ws.okx.com:8443/ws/v5/public',
} as const;

// =============================================================================
// News RSS Feeds (No Auth Required)
// =============================================================================

export const NEWS_RSS_FEEDS = {
  coindesk: 'https://www.coindesk.com/arc/outboundfeeds/rss/',
  cointelegraph: 'https://cointelegraph.com/rss',
  bitcoinmagazine: 'https://bitcoinmagazine.com/feed',
  theblock: 'https://www.theblock.co/rss.xml',
  decrypt: 'https://decrypt.co/feed',
  bitcoinist: 'https://bitcoinist.com/feed/',
  newsbtc: 'https://www.newsbtc.com/feed/',
  cryptoslate: 'https://cryptoslate.com/feed/',
  ambcrypto: 'https://ambcrypto.com/feed/',
  utoday: 'https://u.today/rss',
} as const;

// =============================================================================
// Cache TTL Configuration (seconds)
// =============================================================================

export const CACHE_TTL = {
  // Real-time data
  ticker: 10,
  orderbook: 5,
  trades: 10,

  // Market data
  prices: 30,
  markets: 60,
  global: 300,

  // Historical
  historical_1d: 60,
  historical_7d: 300,
  historical_30d: 900,
  ohlc: 60,

  // On-chain
  gas: 15,
  fees: 30,
  blocks: 60,
  mempool: 10,

  // DeFi
  yields: 300,
  protocols: 300,

  // Derivatives
  funding: 60,
  openInterest: 60,
  liquidations: 10,

  // Static
  static: 3600,
  search: 300,

  // News
  news: 300,
} as const;

// =============================================================================
// Rate Limit Configuration
// =============================================================================

export const RATE_LIMITS = {
  coincap: { requests: 200, window: 60 },
  coinpaprika: { requests: 10, window: 1 },
  binance: { requests: 1200, window: 60 },
  kraken: { requests: 1, window: 1 },
  mempool: { requests: 100, window: 60 },
  blockchair: { requests: 30, window: 60 },
  cryptowatch: { requests: 100, window: 60 },
} as const;

// =============================================================================
// API Response Types
// =============================================================================

export interface CoinCapAsset {
  id: string;
  rank: string;
  symbol: string;
  name: string;
  supply: string;
  maxSupply: string | null;
  marketCapUsd: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  changePercent24Hr: string;
  vwap24Hr: string;
  explorer: string;
}

export interface CoinPaprikaTicker {
  id: string;
  name: string;
  symbol: string;
  rank: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  beta_value: number;
  first_data_at: string;
  last_updated: string;
  quotes: {
    USD: {
      price: number;
      volume_24h: number;
      market_cap: number;
      percent_change_1h: number;
      percent_change_24h: number;
      percent_change_7d: number;
      percent_change_30d: number;
      ath_price: number;
      ath_date: string;
      percent_from_price_ath: number;
    };
  };
}

export interface BinanceTicker {
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
  firstId: number;
  lastId: number;
  count: number;
}

export interface BinanceFundingRate {
  symbol: string;
  fundingRate: string;
  fundingTime: number;
  markPrice: string;
}

export interface BinanceOpenInterest {
  symbol: string;
  openInterest: string;
  time: number;
}

export interface MempoolFees {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

export interface MempoolBlock {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

export interface LlamaYieldPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  rewardTokens: string[] | null;
  pool: string;
  apyPct1D: number | null;
  apyPct7D: number | null;
  apyPct30D: number | null;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  predictions: {
    predictedClass: string;
    predictedProbability: number;
    binnedConfidence: number;
  };
  poolMeta: string | null;
  mu: number;
  sigma: number;
  count: number;
  outlier: boolean;
  underlyingTokens: string[] | null;
  il7d: number | null;
  apyBase7d: number | null;
  apyMean30d: number | null;
  volumeUsd1d: number | null;
  volumeUsd7d: number | null;
}

export interface DydxMarket {
  market: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
  stepSize: string;
  tickSize: string;
  indexPrice: string;
  oraclePrice: string;
  nextFundingRate: string;
  nextFundingAt: string;
  minOrderSize: string;
  type: string;
  initialMarginFraction: string;
  maintenanceMarginFraction: string;
  volume24H: string;
  trades24H: string;
  openInterest: string;
  incrementalInitialMarginFraction: string;
  incrementalPositionSize: string;
  maxPositionSize: string;
  baselinePositionSize: string;
  assetResolution: string;
  syntheticAssetId: string;
}

export interface DeribitInstrument {
  instrument_name: string;
  kind: string;
  tick_size: number;
  taker_commission: number;
  maker_commission: number;
  settlement_period: string;
  quote_currency: string;
  min_trade_amount: number;
  is_active: boolean;
  expiration_timestamp: number;
  creation_timestamp: number;
  contract_size: number;
  base_currency: string;
}

// =============================================================================
// Additional Types
// =============================================================================

export interface CoinPaprikaGlobal {
  market_cap_usd: number;
  volume_24h_usd: number;
  bitcoin_dominance_percentage: number;
  cryptocurrencies_number: number;
  market_cap_ath_value: number;
  market_cap_ath_date: string;
  volume_24h_ath_value: number;
  volume_24h_ath_date: string;
  market_cap_change_24h: number;
  volume_24h_change_24h: number;
  last_updated: number;
}

export interface CoinCapExchange {
  exchangeId: string;
  name: string;
  rank: string;
  percentTotalVolume: string;
  volumeUsd: string;
  tradingPairs: string;
  socket: boolean;
  exchangeUrl: string;
  updated: number;
}

export interface CoinCapHistory {
  priceUsd: string;
  time: number;
  date: string;
}

export interface CoinCapMarket {
  exchangeId: string;
  baseId: string;
  quoteId: string;
  baseSymbol: string;
  quoteSymbol: string;
  volumeUsd24Hr: string;
  priceUsd: string;
  volumePercent: string;
}

export interface CoinCapRate {
  id: string;
  symbol: string;
  currencySymbol: string;
  type: string;
  rateUsd: string;
}

export interface CoinLoreGlobal {
  coins_count: number;
  active_markets: number;
  total_mcap: number;
  total_volume: number;
  btc_d: string;
  eth_d: string;
  mcap_change: string;
  volume_change: string;
}

export interface CoinLoreTicker {
  id: string;
  symbol: string;
  name: string;
  nameid: string;
  rank: number;
  price_usd: string;
  percent_change_24h: string;
  percent_change_1h: string;
  percent_change_7d: string;
  market_cap_usd: string;
  volume24: number;
  csupply: string;
  tsupply: string;
  msupply: string;
}

export interface CoinLoreExchange {
  id: string;
  name: string;
  name_id: string;
  volume_usd: number;
  active_pairs: number;
  url: string;
  country: string;
}

export interface BlockchainStats {
  market_price_usd: number;
  hash_rate: number;
  total_fees_btc: number;
  n_btc_mined: number;
  n_tx: number;
  n_blocks_mined: number;
  minutes_between_blocks: number;
  totalbc: number;
  difficulty: number;
  timestamp: number;
}

export interface NormalizedAsset {
  id: string;
  symbol: string;
  name: string;
  rank: number;
  price: number;
  marketCap: number;
  volume24h: number;
  change1h: number | null;
  change24h: number;
  change7d: number | null;
  supply: number;
  maxSupply: number | null;
  lastUpdated: string;
  source: 'coingecko' | 'coinpaprika' | 'coincap' | 'coinlore';
}

export interface NormalizedGlobalData {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number | null;
  totalCoins: number;
  totalExchanges: number | null;
  marketCapChange24h: number;
  lastUpdated: string;
  sources: string[];
}

export interface NormalizedExchange {
  id: string;
  name: string;
  rank: number;
  volume24h: number;
  tradingPairs: number;
  country: string | null;
  url: string;
  trustScore: number | null;
  source: string;
}

// =============================================================================
// Cache Implementation
// =============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

const apiCache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const cached = apiCache.get(key) as CacheEntry<T> | undefined;
  if (!cached) return null;

  const isExpired = Date.now() - cached.timestamp > cached.ttl * 1000;
  if (isExpired) {
    apiCache.delete(key);
    return null;
  }

  return cached.data;
}

function setCache<T>(key: string, data: T, ttl: number): void {
  apiCache.set(key, { data, timestamp: Date.now(), ttl });
}

// =============================================================================
// Fetch Helpers
// =============================================================================

async function fetchJson<T>(url: string, timeout = 10000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'CryptoDataAggregator/1.0',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

// =============================================================================
// CoinCap API Functions
// =============================================================================

/**
 * Get assets from CoinCap (free, no API key)
 */
export async function getCoinCapAssets(limit = 100): Promise<CoinCapAsset[]> {
  const cacheKey = `coincap-assets-${limit}`;
  const cached = getCached<CoinCapAsset[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchJson<{ data: CoinCapAsset[] }>(
    `${EXTERNAL_APIS.COINCAP}/assets?limit=${limit}`
  );
  setCache(cacheKey, response.data, CACHE_TTL.prices);
  return response.data;
}

/**
 * Get single asset from CoinCap
 */
export async function getCoinCapAsset(assetId: string): Promise<CoinCapAsset> {
  const cacheKey = `coincap-asset-${assetId}`;
  const cached = getCached<CoinCapAsset>(cacheKey);
  if (cached) return cached;

  const response = await fetchJson<{ data: CoinCapAsset }>(
    `${EXTERNAL_APIS.COINCAP}/assets/${assetId}`
  );
  setCache(cacheKey, response.data, CACHE_TTL.prices);
  return response.data;
}

/**
 * Get asset price history from CoinCap
 */
export async function getCoinCapHistory(
  assetId: string,
  interval: 'm1' | 'm5' | 'm15' | 'm30' | 'h1' | 'h2' | 'h6' | 'h12' | 'd1' = 'h1'
): Promise<CoinCapHistory[]> {
  const cacheKey = `coincap-history-${assetId}-${interval}`;
  const cached = getCached<CoinCapHistory[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchJson<{ data: CoinCapHistory[] }>(
    `${EXTERNAL_APIS.COINCAP}/assets/${assetId}/history?interval=${interval}`
  );
  setCache(cacheKey, response.data, CACHE_TTL.historical_1d);
  return response.data;
}

/**
 * Get exchanges from CoinCap
 */
export async function getCoinCapExchanges(): Promise<CoinCapExchange[]> {
  const cacheKey = 'coincap-exchanges';
  const cached = getCached<CoinCapExchange[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchJson<{ data: CoinCapExchange[] }>(
    `${EXTERNAL_APIS.COINCAP}/exchanges`
  );
  setCache(cacheKey, response.data, CACHE_TTL.markets);
  return response.data;
}

/**
 * Get markets for an asset from CoinCap
 */
export async function getCoinCapMarkets(assetId: string): Promise<CoinCapMarket[]> {
  const cacheKey = `coincap-markets-${assetId}`;
  const cached = getCached<CoinCapMarket[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchJson<{ data: CoinCapMarket[] }>(
    `${EXTERNAL_APIS.COINCAP}/assets/${assetId}/markets?limit=50`
  );
  setCache(cacheKey, response.data, CACHE_TTL.markets);
  return response.data;
}

/**
 * Get fiat rates from CoinCap
 */
export async function getCoinCapRates(): Promise<CoinCapRate[]> {
  const cacheKey = 'coincap-rates';
  const cached = getCached<CoinCapRate[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchJson<{ data: CoinCapRate[] }>(`${EXTERNAL_APIS.COINCAP}/rates`);
  setCache(cacheKey, response.data, CACHE_TTL.global);
  return response.data;
}

// =============================================================================
// CoinPaprika API Functions
// =============================================================================

/**
 * Get global market data from CoinPaprika
 */
export async function getCoinPaprikaGlobal(): Promise<CoinPaprikaGlobal> {
  const cacheKey = 'coinpaprika-global';
  const cached = getCached<CoinPaprikaGlobal>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<CoinPaprikaGlobal>(`${EXTERNAL_APIS.COINPAPRIKA}/global`);
  setCache(cacheKey, data, CACHE_TTL.global);
  return data;
}

/**
 * Get tickers from CoinPaprika
 */
export async function getCoinPaprikaTickers(limit = 100): Promise<CoinPaprikaTicker[]> {
  const cacheKey = `coinpaprika-tickers-${limit}`;
  const cached = getCached<CoinPaprikaTicker[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<CoinPaprikaTicker[]>(`${EXTERNAL_APIS.COINPAPRIKA}/tickers`);
  const limited = data.slice(0, limit);
  setCache(cacheKey, limited, CACHE_TTL.prices);
  return limited;
}

/**
 * Get coin ticker from CoinPaprika
 */
export async function getCoinPaprikaCoin(coinId: string): Promise<CoinPaprikaTicker> {
  const cacheKey = `coinpaprika-coin-${coinId}`;
  const cached = getCached<CoinPaprikaTicker>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<CoinPaprikaTicker>(`${EXTERNAL_APIS.COINPAPRIKA}/tickers/${coinId}`);
  setCache(cacheKey, data, CACHE_TTL.prices);
  return data;
}

/**
 * Search coins on CoinPaprika
 */
export async function searchCoinPaprika(
  query: string
): Promise<{ currencies: { id: string; name: string; symbol: string; rank: number }[] }> {
  const cacheKey = `coinpaprika-search-${query}`;
  const cached = getCached<{
    currencies: { id: string; name: string; symbol: string; rank: number }[];
  }>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<{
    currencies: { id: string; name: string; symbol: string; rank: number }[];
  }>(`${EXTERNAL_APIS.COINPAPRIKA}/search?q=${encodeURIComponent(query)}&limit=20`);
  setCache(cacheKey, data, CACHE_TTL.search);
  return data;
}

// =============================================================================
// CoinLore API Functions (Additional free source)
// =============================================================================

const COINLORE_BASE = 'https://api.coinlore.net/api';

/**
 * Get global data from CoinLore
 */
export async function getCoinLoreGlobal(): Promise<CoinLoreGlobal[]> {
  const cacheKey = 'coinlore-global';
  const cached = getCached<CoinLoreGlobal[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<CoinLoreGlobal[]>(`${COINLORE_BASE}/global/`);
  setCache(cacheKey, data, CACHE_TTL.global);
  return data;
}

/**
 * Get tickers from CoinLore
 */
export async function getCoinLoreTickers(
  start = 0,
  limit = 100
): Promise<{ data: CoinLoreTicker[]; info: { coins_num: number; time: number } }> {
  const cacheKey = `coinlore-tickers-${start}-${limit}`;
  const cached = getCached<{ data: CoinLoreTicker[]; info: { coins_num: number; time: number } }>(
    cacheKey
  );
  if (cached) return cached;

  const data = await fetchJson<{
    data: CoinLoreTicker[];
    info: { coins_num: number; time: number };
  }>(`${COINLORE_BASE}/tickers/?start=${start}&limit=${limit}`);
  setCache(cacheKey, data, CACHE_TTL.prices);
  return data;
}

/**
 * Get exchanges from CoinLore
 */
export async function getCoinLoreExchanges(): Promise<CoinLoreExchange[]> {
  const cacheKey = 'coinlore-exchanges';
  const cached = getCached<CoinLoreExchange[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<CoinLoreExchange[]>(`${COINLORE_BASE}/exchanges/`);
  setCache(cacheKey, data, CACHE_TTL.markets);
  return data;
}

// =============================================================================
// Mempool.space API Functions (Bitcoin data)
// =============================================================================

/**
 * Get Bitcoin recommended fees from Mempool.space
 */
export async function getMempoolFees(): Promise<MempoolFees> {
  const cacheKey = 'mempool-fees';
  const cached = getCached<MempoolFees>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<MempoolFees>(`${EXTERNAL_APIS.MEMPOOL}/v1/fees/recommended`);
  setCache(cacheKey, data, CACHE_TTL.fees);
  return data;
}

/**
 * Get latest Bitcoin blocks from Mempool.space
 */
export async function getMempoolBlocks(): Promise<MempoolBlock[]> {
  const cacheKey = 'mempool-blocks';
  const cached = getCached<MempoolBlock[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<MempoolBlock[]>(`${EXTERNAL_APIS.MEMPOOL}/v1/blocks`);
  const limited = data.slice(0, 10);
  setCache(cacheKey, limited, CACHE_TTL.blocks);
  return limited;
}

/**
 * Get mempool statistics
 */
export async function getMempoolStats(): Promise<{
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram: number[][];
}> {
  const cacheKey = 'mempool-stats';
  const cached = getCached<{
    count: number;
    vsize: number;
    total_fee: number;
    fee_histogram: number[][];
  }>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<{
    count: number;
    vsize: number;
    total_fee: number;
    fee_histogram: number[][];
  }>(`${EXTERNAL_APIS.MEMPOOL}/mempool`);
  setCache(cacheKey, data, CACHE_TTL.mempool);
  return data;
}

// =============================================================================
// Blockchain.info API Functions
// =============================================================================

/**
 * Get Bitcoin network stats from Blockchain.info
 */
export async function getBlockchainStats(): Promise<BlockchainStats> {
  const cacheKey = 'blockchain-stats';
  const cached = getCached<BlockchainStats>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<BlockchainStats>(
    `${EXTERNAL_APIS.BLOCKCHAIN_INFO}/stats?format=json`
  );
  setCache(cacheKey, data, CACHE_TTL.global);
  return data;
}

// =============================================================================
// Binance Public API Functions (No API key required for public endpoints)
// =============================================================================

/**
 * Get 24h ticker from Binance
 */
export async function getBinance24hTicker(
  symbol?: string
): Promise<BinanceTicker | BinanceTicker[]> {
  const cacheKey = symbol ? `binance-ticker-${symbol}` : 'binance-tickers';
  const cached = getCached<BinanceTicker | BinanceTicker[]>(cacheKey);
  if (cached) return cached;

  const url = symbol
    ? `${EXTERNAL_APIS.BINANCE}/ticker/24hr?symbol=${symbol}`
    : `${EXTERNAL_APIS.BINANCE}/ticker/24hr`;

  const data = await fetchJson<BinanceTicker | BinanceTicker[]>(url);
  setCache(cacheKey, data, CACHE_TTL.ticker);
  return data;
}

/**
 * Get Binance futures funding rates
 */
export async function getBinanceFundingRates(): Promise<BinanceFundingRate[]> {
  const cacheKey = 'binance-funding-rates';
  const cached = getCached<BinanceFundingRate[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<BinanceFundingRate[]>(
    `${EXTERNAL_APIS.BINANCE_FUTURES}/fapi/v1/premiumIndex`
  );
  setCache(cacheKey, data, CACHE_TTL.funding);
  return data;
}

/**
 * Get Binance futures open interest
 */
export async function getBinanceOpenInterest(symbol: string): Promise<BinanceOpenInterest> {
  const cacheKey = `binance-oi-${symbol}`;
  const cached = getCached<BinanceOpenInterest>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<BinanceOpenInterest>(
    `${EXTERNAL_APIS.BINANCE_FUTURES}/fapi/v1/openInterest?symbol=${symbol}`
  );
  setCache(cacheKey, data, CACHE_TTL.openInterest);
  return data;
}

// =============================================================================
// DeFiLlama Yields API
// =============================================================================

/**
 * Get yield pools from DeFiLlama
 */
export async function getDefiLlamaYields(): Promise<{ data: LlamaYieldPool[] }> {
  const cacheKey = 'defillama-yields';
  const cached = getCached<{ data: LlamaYieldPool[] }>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<{ data: LlamaYieldPool[] }>(`${EXTERNAL_APIS.LLAMA_YIELDS}/pools`);
  setCache(cacheKey, data, CACHE_TTL.yields);
  return data;
}

// =============================================================================
// dYdX API Functions
// =============================================================================

/**
 * Get dYdX markets
 */
export async function getDydxMarkets(): Promise<{ markets: Record<string, DydxMarket> }> {
  const cacheKey = 'dydx-markets';
  const cached = getCached<{ markets: Record<string, DydxMarket> }>(cacheKey);
  if (cached) return cached;

  const data = await fetchJson<{ markets: Record<string, DydxMarket> }>(
    `${EXTERNAL_APIS.DYDX}/markets`
  );
  setCache(cacheKey, data, CACHE_TTL.markets);
  return data;
}

// =============================================================================
// Deribit API Functions
// =============================================================================

/**
 * Get Deribit instruments
 */
export async function getDeribitInstruments(
  currency: 'BTC' | 'ETH' = 'BTC',
  kind: 'future' | 'option' = 'future'
): Promise<DeribitInstrument[]> {
  const cacheKey = `deribit-instruments-${currency}-${kind}`;
  const cached = getCached<DeribitInstrument[]>(cacheKey);
  if (cached) return cached;

  const response = await fetchJson<{ result: DeribitInstrument[] }>(
    `${EXTERNAL_APIS.DERIBIT}/get_instruments?currency=${currency}&kind=${kind}`
  );
  setCache(cacheKey, response.result, CACHE_TTL.markets);
  return response.result;
}

// =============================================================================
// Normalization & Aggregation Functions
// =============================================================================

/**
 * Normalize CoinCap asset to common format
 */
function normalizeCoinCapAsset(asset: CoinCapAsset): NormalizedAsset {
  return {
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    rank: parseInt(asset.rank, 10),
    price: parseFloat(asset.priceUsd),
    marketCap: parseFloat(asset.marketCapUsd),
    volume24h: parseFloat(asset.volumeUsd24Hr),
    change1h: null,
    change24h: parseFloat(asset.changePercent24Hr),
    change7d: null,
    supply: parseFloat(asset.supply),
    maxSupply: asset.maxSupply ? parseFloat(asset.maxSupply) : null,
    lastUpdated: new Date().toISOString(),
    source: 'coincap',
  };
}

/**
 * Normalize CoinPaprika ticker to common format
 */
function normalizeCoinPaprikaTicker(ticker: CoinPaprikaTicker): NormalizedAsset {
  return {
    id: ticker.id,
    symbol: ticker.symbol,
    name: ticker.name,
    rank: ticker.rank,
    price: ticker.quotes.USD.price,
    marketCap: ticker.quotes.USD.market_cap,
    volume24h: ticker.quotes.USD.volume_24h,
    change1h: ticker.quotes.USD.percent_change_1h,
    change24h: ticker.quotes.USD.percent_change_24h,
    change7d: ticker.quotes.USD.percent_change_7d,
    supply: ticker.circulating_supply,
    maxSupply: ticker.max_supply || null,
    lastUpdated: ticker.last_updated,
    source: 'coinpaprika',
  };
}

/**
 * Normalize CoinLore ticker to common format
 */
function normalizeCoinLoreTicker(ticker: CoinLoreTicker): NormalizedAsset {
  return {
    id: ticker.id,
    symbol: ticker.symbol,
    name: ticker.name,
    rank: ticker.rank,
    price: parseFloat(ticker.price_usd),
    marketCap: parseFloat(ticker.market_cap_usd),
    volume24h: ticker.volume24,
    change1h: parseFloat(ticker.percent_change_1h),
    change24h: parseFloat(ticker.percent_change_24h),
    change7d: parseFloat(ticker.percent_change_7d),
    supply: parseFloat(ticker.csupply),
    maxSupply: ticker.msupply ? parseFloat(ticker.msupply) : null,
    lastUpdated: new Date().toISOString(),
    source: 'coinlore',
  };
}

/**
 * Get aggregated assets from multiple sources with fallback
 */
export async function getAggregatedAssets(limit = 100): Promise<NormalizedAsset[]> {
  const cacheKey = `aggregated-assets-${limit}`;
  const cached = getCached<NormalizedAsset[]>(cacheKey);
  if (cached) return cached;

  // Try CoinCap first (most reliable free API)
  try {
    const assets = await getCoinCapAssets(limit);
    const normalized = assets.map(normalizeCoinCapAsset);
    setCache(cacheKey, normalized, CACHE_TTL.prices);
    return normalized;
  } catch (error) {
    console.error('CoinCap failed, trying CoinPaprika:', error);
  }

  // Fallback to CoinPaprika
  try {
    const tickers = await getCoinPaprikaTickers(limit);
    const normalized = tickers.map(normalizeCoinPaprikaTicker);
    setCache(cacheKey, normalized, CACHE_TTL.prices);
    return normalized;
  } catch (error) {
    console.error('CoinPaprika failed, trying CoinLore:', error);
  }

  // Final fallback to CoinLore
  try {
    const response = await getCoinLoreTickers(0, limit);
    const normalized = response.data.map(normalizeCoinLoreTicker);
    setCache(cacheKey, normalized, CACHE_TTL.prices);
    return normalized;
  } catch (error) {
    console.error('All sources failed:', error);
    return [];
  }
}

/**
 * Get aggregated global market data from multiple sources
 */
export async function getAggregatedGlobalData(): Promise<NormalizedGlobalData> {
  const cacheKey = 'aggregated-global';
  const cached = getCached<NormalizedGlobalData>(cacheKey);
  if (cached) return cached;

  const sources: string[] = [];
  let totalMarketCap = 0;
  let totalVolume24h = 0;
  let btcDominance = 0;
  let ethDominance: number | null = null;
  let totalCoins = 0;
  let marketCapChange24h = 0;

  // Try multiple sources and use best available
  const results = await Promise.allSettled([getCoinPaprikaGlobal(), getCoinLoreGlobal()]);

  if (results[0].status === 'fulfilled') {
    const data = results[0].value;
    totalMarketCap = data.market_cap_usd;
    totalVolume24h = data.volume_24h_usd;
    btcDominance = data.bitcoin_dominance_percentage;
    totalCoins = data.cryptocurrencies_number;
    marketCapChange24h = data.market_cap_change_24h;
    sources.push('coinpaprika');
  }

  if (results[1].status === 'fulfilled' && results[1].value.length > 0) {
    const data = results[1].value[0];
    if (!totalMarketCap) {
      totalMarketCap = data.total_mcap;
      totalVolume24h = data.total_volume;
      btcDominance = parseFloat(data.btc_d);
      ethDominance = parseFloat(data.eth_d);
      totalCoins = data.coins_count;
      marketCapChange24h = parseFloat(data.mcap_change);
    } else {
      ethDominance = parseFloat(data.eth_d);
    }
    sources.push('coinlore');
  }

  const normalized: NormalizedGlobalData = {
    totalMarketCap,
    totalVolume24h,
    btcDominance,
    ethDominance,
    totalCoins,
    totalExchanges: null,
    marketCapChange24h,
    lastUpdated: new Date().toISOString(),
    sources,
  };

  setCache(cacheKey, normalized, CACHE_TTL.global);
  return normalized;
}

/**
 * Get aggregated exchange data from multiple sources
 */
export async function getAggregatedExchanges(): Promise<NormalizedExchange[]> {
  const cacheKey = 'aggregated-exchanges';
  const cached = getCached<NormalizedExchange[]>(cacheKey);
  if (cached) return cached;

  const normalized: NormalizedExchange[] = [];

  // Try CoinCap exchanges
  try {
    const exchanges = await getCoinCapExchanges();
    for (const ex of exchanges) {
      normalized.push({
        id: ex.exchangeId,
        name: ex.name,
        rank: parseInt(ex.rank, 10),
        volume24h: parseFloat(ex.volumeUsd),
        tradingPairs: parseInt(ex.tradingPairs, 10),
        country: null,
        url: ex.exchangeUrl,
        trustScore: parseFloat(ex.percentTotalVolume),
        source: 'coincap',
      });
    }
  } catch (error) {
    console.error('CoinCap exchanges failed:', error);
  }

  // Merge with CoinLore exchanges
  try {
    const exchanges = await getCoinLoreExchanges();
    for (const ex of exchanges) {
      const existing = normalized.find((e) => e.name.toLowerCase() === ex.name.toLowerCase());
      if (!existing) {
        normalized.push({
          id: ex.id,
          name: ex.name,
          rank: 0,
          volume24h: ex.volume_usd,
          tradingPairs: ex.active_pairs,
          country: ex.country,
          url: ex.url,
          trustScore: null,
          source: 'coinlore',
        });
      }
    }
  } catch (error) {
    console.error('CoinLore exchanges failed:', error);
  }

  // Sort by volume and re-rank
  normalized.sort((a, b) => b.volume24h - a.volume24h);
  normalized.forEach((ex, index) => {
    ex.rank = index + 1;
  });

  setCache(cacheKey, normalized, CACHE_TTL.markets);
  return normalized;
}

/**
 * Get Bitcoin network data (fees, blocks, stats)
 */
export async function getBitcoinNetworkData(): Promise<{
  fees: MempoolFees | null;
  latestBlocks: MempoolBlock[];
  stats: BlockchainStats | null;
}> {
  const [feesResult, blocksResult, statsResult] = await Promise.allSettled([
    getMempoolFees(),
    getMempoolBlocks(),
    getBlockchainStats(),
  ]);

  return {
    fees: feesResult.status === 'fulfilled' ? feesResult.value : null,
    latestBlocks: blocksResult.status === 'fulfilled' ? blocksResult.value : [],
    stats: statsResult.status === 'fulfilled' ? statsResult.value : null,
  };
}

/**
 * Get derivatives overview (funding rates, open interest)
 */
export async function getDerivativesOverview(): Promise<{
  fundingRates: BinanceFundingRate[];
  dydxMarkets: DydxMarket[];
}> {
  const [fundingResult, dydxResult] = await Promise.allSettled([
    getBinanceFundingRates(),
    getDydxMarkets(),
  ]);

  return {
    fundingRates: fundingResult.status === 'fulfilled' ? fundingResult.value : [],
    dydxMarkets: dydxResult.status === 'fulfilled' ? Object.values(dydxResult.value.markets) : [],
  };
}
