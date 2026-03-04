/**
 * CryptoCompare API Integration
 * Historical data, social stats, and on-chain metrics
 *
 * Base URL: https://min-api.cryptocompare.com
 * Free tier: 250,000 calls/month
 * Rate Limit: 50 requests/second
 *
 * @module cryptocompare
 */

import { CACHE_TTL } from './external-apis';
import { cache } from './cache';

const BASE_URL = 'https://min-api.cryptocompare.com';
const DATA_API = 'https://data-api.cryptocompare.com';

// =============================================================================
// Types
// =============================================================================

export interface CryptoComparePrice {
  [symbol: string]: {
    [currency: string]: number;
  };
}

export interface CryptoComparePriceFull {
  RAW: {
    [symbol: string]: {
      [currency: string]: {
        TYPE: string;
        MARKET: string;
        FROMSYMBOL: string;
        TOSYMBOL: string;
        FLAGS: string;
        PRICE: number;
        LASTUPDATE: number;
        MEDIAN: number;
        LASTVOLUME: number;
        LASTVOLUMETO: number;
        LASTTRADEID: string;
        VOLUMEDAY: number;
        VOLUMEDAYTO: number;
        VOLUME24HOUR: number;
        VOLUME24HOURTO: number;
        OPENDAY: number;
        HIGHDAY: number;
        LOWDAY: number;
        OPEN24HOUR: number;
        HIGH24HOUR: number;
        LOW24HOUR: number;
        LASTMARKET: string;
        VOLUMEHOUR: number;
        VOLUMEHOURTO: number;
        OPENHOUR: number;
        HIGHHOUR: number;
        LOWHOUR: number;
        TOPTIERVOLUME24HOUR: number;
        TOPTIERVOLUME24HOURTO: number;
        CHANGE24HOUR: number;
        CHANGEPCT24HOUR: number;
        CHANGEDAY: number;
        CHANGEPCTDAY: number;
        CHANGEHOUR: number;
        CHANGEPCTHOUR: number;
        CONVERSIONTYPE: string;
        CONVERSIONSYMBOL: string;
        SUPPLY: number;
        MKTCAP: number;
        MKTCAPPENALTY: number;
        CIRCULATINGSUPPLY: number;
        CIRCULATINGSUPPLYMKTCAP: number;
        TOTALVOLUME24H: number;
        TOTALVOLUME24HTO: number;
        TOTALTOPTIERVOLUME24H: number;
        TOTALTOPTIERVOLUME24HTO: number;
        IMAGEURL: string;
      };
    };
  };
  DISPLAY: {
    [symbol: string]: {
      [currency: string]: {
        FROMSYMBOL: string;
        TOSYMBOL: string;
        MARKET: string;
        PRICE: string;
        LASTUPDATE: string;
        LASTVOLUME: string;
        LASTVOLUMETO: string;
        VOLUME24HOUR: string;
        VOLUME24HOURTO: string;
        OPEN24HOUR: string;
        HIGH24HOUR: string;
        LOW24HOUR: string;
        CHANGE24HOUR: string;
        CHANGEPCT24HOUR: string;
        MKTCAP: string;
        SUPPLY: string;
        CIRCULATINGSUPPLY: string;
        TOTALVOLUME24H: string;
        IMAGEURL: string;
      };
    };
  };
}

export interface CryptoCompareOHLCV {
  time: number;
  high: number;
  low: number;
  open: number;
  close: number;
  volumefrom: number;
  volumeto: number;
  conversionType: string;
  conversionSymbol: string;
}

export interface CryptoCompareHistoricalResponse {
  Response: string;
  Message: string;
  HasWarning: boolean;
  Type: number;
  Data: {
    Aggregated: boolean;
    TimeFrom: number;
    TimeTo: number;
    Data: CryptoCompareOHLCV[];
  };
}

export interface CryptoCompareTopCoin {
  CoinInfo: {
    Id: string;
    Name: string;
    FullName: string;
    Internal: string;
    ImageUrl: string;
    Url: string;
    Algorithm: string;
    ProofType: string;
    Rating: {
      Weiss: {
        Rating: string;
        TechnologyAdoptionRating: string;
        MarketPerformanceRating: string;
      };
    };
    NetHashesPerSecond: number;
    BlockNumber: number;
    BlockTime: number;
    BlockReward: number;
    AssetLaunchDate: string;
    MaxSupply: number;
    Type: number;
    DocumentType: string;
  };
  RAW?: {
    USD: {
      PRICE: number;
      VOLUME24HOUR: number;
      VOLUME24HOURTO: number;
      CHANGEPCT24HOUR: number;
      MKTCAP: number;
      SUPPLY: number;
      CIRCULATINGSUPPLY: number;
      HIGH24HOUR: number;
      LOW24HOUR: number;
    };
  };
  DISPLAY?: {
    USD: {
      PRICE: string;
      VOLUME24HOUR: string;
      CHANGEPCT24HOUR: string;
      MKTCAP: string;
    };
  };
}

export interface CryptoCompareSocialStats {
  Response: string;
  Data: {
    General: {
      Name: string;
      CoinName: string;
      Type: string;
      Points: number;
    };
    CryptoCompare: {
      SimilarItems: Array<{
        Id: number;
        Name: string;
        FullName: string;
        ImageUrl: string;
        Url: string;
        FollowingType: number;
      }>;
      CryptopianFollowers: number;
      Points: number;
      Followers: number;
      Posts: number;
      Comments: number;
      PageViewsSplit: Record<string, number>;
      PageViews: number;
    };
    Twitter: {
      following: number;
      account_creation: string;
      name: string;
      lists: number;
      statuses: number;
      favourites: number;
      followers: number;
      link: string;
      Points: number;
    };
    Reddit: {
      subscribers: number;
      active_users: number;
      community_creation: string;
      posts_per_hour: number;
      posts_per_day: number;
      comments_per_hour: number;
      comments_per_day: number;
      link: string;
      name: string;
      Points: number;
    };
    CodeRepository: {
      List: Array<{
        created_at: number;
        open_total_issues: number;
        parent: {
          Name: string;
          Url: string;
          InternalId: number;
        };
        size: number;
        closed_total_issues: number;
        stars: number;
        last_update: number;
        forks: number;
        url: string;
        closed_issues: number;
        closed_pull_issues: number;
        fork: boolean;
        last_push: number;
        source: {
          Name: string;
          Url: string;
          InternalId: number;
        };
        open_pull_issues: number;
        language: string;
        subscribers: number;
        open_issues: number;
      }>;
      Points: number;
    };
    Facebook: {
      likes: number;
      link: string;
      is_closed: boolean;
      talking_about: number;
      name: string;
      Points: number;
    };
  };
}

export interface CryptoCompareNews {
  id: string;
  guid: string;
  published_on: number;
  imageurl: string;
  title: string;
  url: string;
  body: string;
  tags: string;
  categories: string;
  upvotes: string;
  downvotes: string;
  lang: string;
  source_info: {
    name: string;
    img: string;
    lang: string;
  };
}

export interface CryptoCompareBlockchainData {
  time: number;
  zero_balance_addresses_all_time: number;
  unique_addresses_all_time: number;
  new_addresses: number;
  active_addresses: number;
  transaction_count: number;
  transaction_count_all_time: number;
  large_transaction_count: number;
  average_transaction_value: number;
  block_height: number;
  hashrate: number;
  difficulty: number;
  block_time: number;
  block_size: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getApiKey(): string {
  return process.env.CRYPTOCOMPARE_API_KEY || '';
}

async function fetchWithAuth<T>(url: string): Promise<T> {
  const apiKey = getApiKey();
  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  if (apiKey) {
    headers['authorization'] = `Apikey ${apiKey}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`CryptoCompare API error: ${response.status}`);
  }

  return response.json();
}

// =============================================================================
// Price API Functions
// =============================================================================

/**
 * Get simple price for multiple symbols
 */
export async function getPrice(
  fsyms: string[],
  tsyms: string[] = ['USD']
): Promise<CryptoComparePrice> {
  const cacheKey = `cryptocompare:price:${fsyms.join(',')}-${tsyms.join(',')}`;
  const cached = cache.get<CryptoComparePrice>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/pricemulti?fsyms=${fsyms.join(',')}&tsyms=${tsyms.join(',')}`;
  const data = await fetchWithAuth<CryptoComparePrice>(url);

  cache.set(cacheKey, data, CACHE_TTL.prices);
  return data;
}

/**
 * Get full price data with 24h stats
 */
export async function getPriceFull(
  fsyms: string[],
  tsyms: string[] = ['USD']
): Promise<CryptoComparePriceFull> {
  const cacheKey = `cryptocompare:pricefull:${fsyms.join(',')}-${tsyms.join(',')}`;
  const cached = cache.get<CryptoComparePriceFull>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/pricemultifull?fsyms=${fsyms.join(',')}&tsyms=${tsyms.join(',')}`;
  const data = await fetchWithAuth<CryptoComparePriceFull>(url);

  cache.set(cacheKey, data, CACHE_TTL.prices);
  return data;
}

// =============================================================================
// Historical Data API Functions
// =============================================================================

/**
 * Get daily OHLCV data
 */
export async function getHistoricalDaily(
  fsym: string,
  tsym: string = 'USD',
  limit: number = 30,
  toTs?: number
): Promise<CryptoCompareOHLCV[]> {
  const cacheKey = `cryptocompare:histoday:${fsym}-${tsym}-${limit}-${toTs || 'latest'}`;
  const cached = cache.get<CryptoCompareOHLCV[]>(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/data/v2/histoday?fsym=${fsym}&tsym=${tsym}&limit=${limit}`;
  if (toTs) {
    url += `&toTs=${toTs}`;
  }

  const response = await fetchWithAuth<CryptoCompareHistoricalResponse>(url);

  if (response.Response !== 'Success') {
    throw new Error(`CryptoCompare error: ${response.Message}`);
  }

  const data = response.Data.Data;
  cache.set(cacheKey, data, CACHE_TTL.historical_30d);

  return data;
}

/**
 * Get hourly OHLCV data
 */
export async function getHistoricalHourly(
  fsym: string,
  tsym: string = 'USD',
  limit: number = 24,
  toTs?: number
): Promise<CryptoCompareOHLCV[]> {
  const cacheKey = `cryptocompare:histohour:${fsym}-${tsym}-${limit}-${toTs || 'latest'}`;
  const cached = cache.get<CryptoCompareOHLCV[]>(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/data/v2/histohour?fsym=${fsym}&tsym=${tsym}&limit=${limit}`;
  if (toTs) {
    url += `&toTs=${toTs}`;
  }

  const response = await fetchWithAuth<CryptoCompareHistoricalResponse>(url);

  if (response.Response !== 'Success') {
    throw new Error(`CryptoCompare error: ${response.Message}`);
  }

  const data = response.Data.Data;
  cache.set(cacheKey, data, CACHE_TTL.historical_1d);

  return data;
}

/**
 * Get minute OHLCV data
 */
export async function getHistoricalMinute(
  fsym: string,
  tsym: string = 'USD',
  limit: number = 60,
  toTs?: number
): Promise<CryptoCompareOHLCV[]> {
  const cacheKey = `cryptocompare:histominute:${fsym}-${tsym}-${limit}-${toTs || 'latest'}`;
  const cached = cache.get<CryptoCompareOHLCV[]>(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/data/v2/histominute?fsym=${fsym}&tsym=${tsym}&limit=${limit}`;
  if (toTs) {
    url += `&toTs=${toTs}`;
  }

  const response = await fetchWithAuth<CryptoCompareHistoricalResponse>(url);

  if (response.Response !== 'Success') {
    throw new Error(`CryptoCompare error: ${response.Message}`);
  }

  const data = response.Data.Data;
  cache.set(cacheKey, data, 60); // 1 minute cache

  return data;
}

// =============================================================================
// Top Coins API Functions
// =============================================================================

/**
 * Get top coins by 24h volume
 */
export async function getTopByVolume(
  tsym: string = 'USD',
  limit: number = 50
): Promise<CryptoCompareTopCoin[]> {
  const cacheKey = `cryptocompare:topvol:${tsym}-${limit}`;
  const cached = cache.get<CryptoCompareTopCoin[]>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/top/totalvolfull?limit=${limit}&tsym=${tsym}`;
  const response = await fetchWithAuth<{ Data: CryptoCompareTopCoin[] }>(url);

  cache.set(cacheKey, response.Data, CACHE_TTL.markets);
  return response.Data;
}

/**
 * Get top coins by market cap
 */
export async function getTopByMarketCap(
  tsym: string = 'USD',
  limit: number = 50
): Promise<CryptoCompareTopCoin[]> {
  const cacheKey = `cryptocompare:topmcap:${tsym}-${limit}`;
  const cached = cache.get<CryptoCompareTopCoin[]>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/top/mktcapfull?limit=${limit}&tsym=${tsym}`;
  const response = await fetchWithAuth<{ Data: CryptoCompareTopCoin[] }>(url);

  cache.set(cacheKey, response.Data, CACHE_TTL.markets);
  return response.Data;
}

/**
 * Get top gainers/losers
 */
export async function getTopGainersLosers(
  tsym: string = 'USD',
  limit: number = 10
): Promise<{ gainers: CryptoCompareTopCoin[]; losers: CryptoCompareTopCoin[] }> {
  const cacheKey = `cryptocompare:topgainers:${tsym}-${limit}`;
  const cached = cache.get<{ gainers: CryptoCompareTopCoin[]; losers: CryptoCompareTopCoin[] }>(
    cacheKey
  );
  if (cached) return cached;

  const topCoins = await getTopByVolume(tsym, 100);

  const withChange = topCoins.filter((coin) => coin.RAW?.USD?.CHANGEPCT24HOUR !== undefined);

  const sorted = [...withChange].sort(
    (a, b) => (b.RAW?.USD?.CHANGEPCT24HOUR || 0) - (a.RAW?.USD?.CHANGEPCT24HOUR || 0)
  );

  const result = {
    gainers: sorted.slice(0, limit),
    losers: sorted.slice(-limit).reverse(),
  };

  cache.set(cacheKey, result, CACHE_TTL.prices);
  return result;
}

// =============================================================================
// Social Stats API Functions
// =============================================================================

/**
 * Get social stats for a coin
 */
export async function getSocialStats(coinId: number): Promise<CryptoCompareSocialStats> {
  const cacheKey = `cryptocompare:social:${coinId}`;
  const cached = cache.get<CryptoCompareSocialStats>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/social/coin/latest?coinId=${coinId}`;
  const data = await fetchWithAuth<CryptoCompareSocialStats>(url);

  cache.set(cacheKey, data, CACHE_TTL.static);
  return data;
}

/**
 * Get coin list with IDs for social stats lookup
 */
export async function getCoinList(): Promise<
  Record<string, { Id: string; Name: string; Symbol: string; CoinName: string; FullName: string }>
> {
  const cacheKey = 'cryptocompare:coinlist';
  const cached = cache.get<
    Record<string, { Id: string; Name: string; Symbol: string; CoinName: string; FullName: string }>
  >(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/all/coinlist`;
  const response = await fetchWithAuth<{
    Data: Record<
      string,
      { Id: string; Name: string; Symbol: string; CoinName: string; FullName: string }
    >;
  }>(url);

  cache.set(cacheKey, response.Data, CACHE_TTL.static);
  return response.Data;
}

// =============================================================================
// News API Functions
// =============================================================================

/**
 * Get latest crypto news
 */
export async function getNews(
  categories?: string,
  lang: string = 'EN',
  sortOrder: 'latest' | 'popular' = 'latest'
): Promise<CryptoCompareNews[]> {
  const cacheKey = `cryptocompare:news:${categories || 'all'}-${lang}-${sortOrder}`;
  const cached = cache.get<CryptoCompareNews[]>(cacheKey);
  if (cached) return cached;

  let url = `${BASE_URL}/data/v2/news/?lang=${lang}&sortOrder=${sortOrder}`;
  if (categories) {
    url += `&categories=${categories}`;
  }

  const response = await fetchWithAuth<{ Data: CryptoCompareNews[] }>(url);

  cache.set(cacheKey, response.Data, CACHE_TTL.news);
  return response.Data;
}

/**
 * Get news categories
 */
export async function getNewsCategories(): Promise<
  Array<{ categoryName: string; wordsAssociatedWithCategory: string[] }>
> {
  const cacheKey = 'cryptocompare:newscategories';
  const cached =
    cache.get<Array<{ categoryName: string; wordsAssociatedWithCategory: string[] }>>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/news/categories`;
  const data = await fetchWithAuth<
    Array<{ categoryName: string; wordsAssociatedWithCategory: string[] }>
  >(url);

  cache.set(cacheKey, data, CACHE_TTL.static);
  return data;
}

// =============================================================================
// Blockchain Data API Functions
// =============================================================================

/**
 * Get blockchain historical data (on-chain metrics)
 */
export async function getBlockchainHistorical(
  fsym: string = 'BTC',
  limit: number = 30
): Promise<CryptoCompareBlockchainData[]> {
  const cacheKey = `cryptocompare:blockchain:${fsym}-${limit}`;
  const cached = cache.get<CryptoCompareBlockchainData[]>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/blockchain/histo/day?fsym=${fsym}&limit=${limit}`;
  const response = await fetchWithAuth<{
    Data: { Data: CryptoCompareBlockchainData[] };
  }>(url);

  const data = response.Data.Data;
  cache.set(cacheKey, data, CACHE_TTL.global);

  return data;
}

/**
 * Get latest blockchain data
 */
export async function getBlockchainLatest(
  fsym: string = 'BTC'
): Promise<CryptoCompareBlockchainData> {
  const cacheKey = `cryptocompare:blockchain:latest:${fsym}`;
  const cached = cache.get<CryptoCompareBlockchainData>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/blockchain/latest?fsym=${fsym}`;
  const response = await fetchWithAuth<{ Data: CryptoCompareBlockchainData }>(url);

  cache.set(cacheKey, response.Data, CACHE_TTL.blocks);
  return response.Data;
}

// =============================================================================
// Exchange API Functions
// =============================================================================

/**
 * Get exchanges info
 */
export async function getExchanges(): Promise<
  Record<
    string,
    {
      Id: string;
      Name: string;
      Url: string;
      LogoUrl: string;
      ItemType: string[];
      CentralizationType: string;
      InternalName: string;
      GradePoints: number;
      Grade: string;
      GradePointsSplit: Record<string, number>;
      AffiliateUrl: string;
      Country: string;
      OrderBook: boolean;
      Trades: boolean;
      Description: string;
      FullAddress: string;
      Fees: string;
      DepositMethods: string;
      WithdrawalMethods: string;
      Sponsored: boolean;
      Recommended: boolean;
      Rating: Record<string, number>;
      TotalVolume24H: Record<string, number>;
    }
  >
> {
  const cacheKey = 'cryptocompare:exchanges';
  const cached = cache.get<Awaited<ReturnType<typeof getExchanges>>>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/exchanges/general`;
  const response = await fetchWithAuth<{ Data: Awaited<ReturnType<typeof getExchanges>> }>(url);

  cache.set(cacheKey, response.Data, CACHE_TTL.static);
  return response.Data;
}

/**
 * Get exchange volume by pair
 */
export async function getExchangeVolume(
  tsym: string = 'USD'
): Promise<Record<string, Record<string, number>>> {
  const cacheKey = `cryptocompare:exchangevol:${tsym}`;
  const cached = cache.get<Record<string, Record<string, number>>>(cacheKey);
  if (cached) return cached;

  const url = `${BASE_URL}/data/exchange/top/volume?tsym=${tsym}`;
  const response = await fetchWithAuth<{ Data: Record<string, Record<string, number>> }>(url);

  cache.set(cacheKey, response.Data, CACHE_TTL.markets);
  return response.Data;
}

// =============================================================================
// Normalized Types for Aggregation
// =============================================================================

export interface NormalizedOHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Normalize OHLCV data to common format
 */
export function normalizeOHLCV(data: CryptoCompareOHLCV[]): NormalizedOHLCV[] {
  return data.map((d) => ({
    timestamp: d.time * 1000,
    open: d.open,
    high: d.high,
    low: d.low,
    close: d.close,
    volume: d.volumefrom,
  }));
}

/**
 * Get normalized historical data with automatic interval selection
 */
export async function getNormalizedHistory(
  symbol: string,
  days: number = 30
): Promise<NormalizedOHLCV[]> {
  let data: CryptoCompareOHLCV[];

  if (days <= 1) {
    // Use minute data for 1 day
    data = await getHistoricalMinute(symbol, 'USD', Math.min(days * 1440, 2000));
  } else if (days <= 7) {
    // Use hourly data for up to 7 days
    data = await getHistoricalHourly(symbol, 'USD', days * 24);
  } else {
    // Use daily data for longer periods
    data = await getHistoricalDaily(symbol, 'USD', days);
  }

  return normalizeOHLCV(data);
}
