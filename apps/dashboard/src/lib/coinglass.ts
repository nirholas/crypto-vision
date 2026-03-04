/**
 * Coinglass API Integration
 * Derivatives data: liquidations, open interest, funding rates, long/short ratios
 *
 * Base URL: https://open-api.coinglass.com/public/v2
 * Free public endpoints available
 *
 * @module coinglass
 */

import { CACHE_TTL } from './external-apis';
import { cache } from './cache';

const BASE_URL = 'https://open-api.coinglass.com/public/v2';

// =============================================================================
// Types
// =============================================================================

export interface CoinglassOpenInterest {
  symbol: string;
  openInterest: number;
  openInterestAmount: number;
  h1OIChangePercent: number;
  h4OIChangePercent: number;
  oiChangePercent: number;
  exchangeList: Array<{
    exchangeName: string;
    openInterest: number;
    openInterestAmount: number;
    oiChangePercent: number;
  }>;
}

export interface CoinglassOpenInterestHistory {
  t: number; // timestamp
  o: number; // open interest
  h: number; // high
  l: number; // low
  c: number; // close (current)
}

export interface CoinglassFundingRate {
  symbol: string;
  uMarginList: Array<{
    exchangeName: string;
    rate: number;
    nextFundingTime: number;
    predictedRate: number | null;
  }>;
  cMarginList: Array<{
    exchangeName: string;
    rate: number;
    nextFundingTime: number;
    predictedRate: number | null;
  }>;
}

export interface CoinglassFundingRateHistory {
  createTime: number;
  symbol: string;
  exchangeName: string;
  fundingRate: number;
}

export interface CoinglassLiquidation {
  symbol: string;
  longLiquidationUsd: number;
  shortLiquidationUsd: number;
  longLiquidationAmount: number;
  shortLiquidationAmount: number;
  h1LongLiquidationUsd: number;
  h1ShortLiquidationUsd: number;
  h4LongLiquidationUsd: number;
  h4ShortLiquidationUsd: number;
  h12LongLiquidationUsd: number;
  h12ShortLiquidationUsd: number;
  h24LongLiquidationUsd: number;
  h24ShortLiquidationUsd: number;
  exchangeList: Array<{
    exchangeName: string;
    longLiquidationUsd: number;
    shortLiquidationUsd: number;
    h1LongLiquidationUsd: number;
    h1ShortLiquidationUsd: number;
    h4LongLiquidationUsd: number;
    h4ShortLiquidationUsd: number;
    h12LongLiquidationUsd: number;
    h12ShortLiquidationUsd: number;
    h24LongLiquidationUsd: number;
    h24ShortLiquidationUsd: number;
  }>;
}

export interface CoinglassLiquidationHistory {
  t: number; // timestamp
  longLiquidationUsd: number;
  shortLiquidationUsd: number;
  longLiquidationAmount: number;
  shortLiquidationAmount: number;
}

export interface CoinglassLongShortRatio {
  symbol: string;
  longRate: number;
  shortRate: number;
  longShortRatio: number;
  exchangeList: Array<{
    exchangeName: string;
    longRate: number;
    shortRate: number;
    longShortRatio: number;
  }>;
}

export interface CoinglassLongShortHistory {
  createTime: number;
  symbol: string;
  exchangeName: string;
  longAccount: number;
  shortAccount: number;
  longShortRatio: number;
}

export interface CoinglassTopLongShort {
  symbol: string;
  topLongRate: number;
  topShortRate: number;
  topLongShortRatio: number;
  exchangeList: Array<{
    exchangeName: string;
    topLongRate: number;
    topShortRate: number;
    topLongShortRatio: number;
  }>;
}

export interface CoinglassGlobalLongShort {
  list: Array<{
    symbol: string;
    longRate: number;
    shortRate: number;
    longVolUsd: number;
    shortVolUsd: number;
  }>;
}

export interface CoinglassOIWeight {
  symbol: string;
  exchangeList: Array<{
    exchangeName: string;
    weight: number;
    openInterest: number;
  }>;
}

export interface CoinglassExchangeInfo {
  exchangeName: string;
  exchangeLogo: string;
  openInterest: number;
  openInterestChange24h: number;
  longLiquidation24h: number;
  shortLiquidation24h: number;
  volume24h: number;
}

export interface CoinglassOption {
  symbol: string;
  notionalValue: number;
  notionalValue24hChange: number;
  openInterest: number;
  openInterest24hChange: number;
  volume: number;
  volume24hChange: number;
  putCallRatio: number;
  maxPain: number;
}

export interface CoinglassAggregatedOI {
  symbol: string;
  price: number;
  priceChangePercent: number;
  openInterest: number;
  openInterestValue: number;
  oiChangePercent: number;
  volume24h: number;
  volumeChangePercent: number;
  longLiq24h: number;
  shortLiq24h: number;
  avgFundingRate: number;
}

// =============================================================================
// Helper Functions
// =============================================================================

function getApiKey(): string {
  return process.env.COINGLASS_API_KEY || '';
}

async function fetchWithAuth<T>(url: string): Promise<T> {
  const apiKey = getApiKey();
  const headers: HeadersInit = {
    Accept: 'application/json',
  };

  if (apiKey) {
    headers['CG-API-KEY'] = apiKey;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    throw new Error(`Coinglass API error: ${response.status}`);
  }

  const result = await response.json();

  if (result.code !== '0' && result.code !== 0) {
    throw new Error(`Coinglass API error: ${result.msg || 'Unknown error'}`);
  }

  return result.data;
}

// =============================================================================
// Open Interest API Functions
// =============================================================================

/**
 * Get open interest for all symbols
 */
export async function getOpenInterest(): Promise<CoinglassOpenInterest[]> {
  const cacheKey = 'coinglass:oi:all';
  const cached = cache.get<CoinglassOpenInterest[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassOpenInterest[]>(`${BASE_URL}/open_interest`);
  cache.set(cacheKey, data, CACHE_TTL.openInterest);

  return data;
}

/**
 * Get open interest for specific symbol
 */
export async function getOpenInterestBySymbol(symbol: string): Promise<CoinglassOpenInterest> {
  const cacheKey = `coinglass:oi:${symbol}`;
  const cached = cache.get<CoinglassOpenInterest>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassOpenInterest>(`${BASE_URL}/open_interest?symbol=${symbol}`);
  cache.set(cacheKey, data, CACHE_TTL.openInterest);

  return data;
}

/**
 * Get open interest history
 */
export async function getOpenInterestHistory(
  symbol: string,
  interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '1d' = '1h',
  limit: number = 100
): Promise<CoinglassOpenInterestHistory[]> {
  const cacheKey = `coinglass:oi:history:${symbol}-${interval}-${limit}`;
  const cached = cache.get<CoinglassOpenInterestHistory[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassOpenInterestHistory[]>(
    `${BASE_URL}/open_interest_history?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );

  cache.set(cacheKey, data, CACHE_TTL.historical_1d);
  return data;
}

/**
 * Get open interest weights by exchange
 */
export async function getOIWeights(): Promise<CoinglassOIWeight[]> {
  const cacheKey = 'coinglass:oi:weights';
  const cached = cache.get<CoinglassOIWeight[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassOIWeight[]>(`${BASE_URL}/open_interest_weight`);
  cache.set(cacheKey, data, CACHE_TTL.markets);

  return data;
}

/**
 * Get aggregated OI with market data
 */
export async function getAggregatedOpenInterest(): Promise<CoinglassAggregatedOI[]> {
  const cacheKey = 'coinglass:oi:aggregated';
  const cached = cache.get<CoinglassAggregatedOI[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassAggregatedOI[]>(`${BASE_URL}/open_interest_aggregated`);
  cache.set(cacheKey, data, CACHE_TTL.openInterest);

  return data;
}

// =============================================================================
// Funding Rate API Functions
// =============================================================================

/**
 * Get current funding rates for all symbols
 */
export async function getFundingRates(): Promise<CoinglassFundingRate[]> {
  const cacheKey = 'coinglass:funding:all';
  const cached = cache.get<CoinglassFundingRate[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassFundingRate[]>(`${BASE_URL}/funding`);
  cache.set(cacheKey, data, CACHE_TTL.funding);

  return data;
}

/**
 * Get funding rate for specific symbol
 */
export async function getFundingRateBySymbol(symbol: string): Promise<CoinglassFundingRate> {
  const cacheKey = `coinglass:funding:${symbol}`;
  const cached = cache.get<CoinglassFundingRate>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassFundingRate>(`${BASE_URL}/funding?symbol=${symbol}`);
  cache.set(cacheKey, data, CACHE_TTL.funding);

  return data;
}

/**
 * Get funding rate history
 */
export async function getFundingRateHistory(
  symbol: string,
  exchange: string = 'Binance',
  limit: number = 100
): Promise<CoinglassFundingRateHistory[]> {
  const cacheKey = `coinglass:funding:history:${symbol}-${exchange}-${limit}`;
  const cached = cache.get<CoinglassFundingRateHistory[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassFundingRateHistory[]>(
    `${BASE_URL}/funding_rate_history?symbol=${symbol}&exchange=${exchange}&limit=${limit}`
  );

  cache.set(cacheKey, data, CACHE_TTL.historical_1d);
  return data;
}

/**
 * Get average funding rate across exchanges
 */
export async function getAverageFundingRates(): Promise<
  Array<{ symbol: string; avgFundingRate: number; nextFundingTime: number }>
> {
  const fundingRates = await getFundingRates();

  return fundingRates.map((fr) => {
    const allRates = [
      ...fr.uMarginList.map((m) => m.rate),
      ...fr.cMarginList.map((m) => m.rate),
    ].filter((r) => r !== null && !isNaN(r));

    const avgRate = allRates.length > 0 ? allRates.reduce((a, b) => a + b, 0) / allRates.length : 0;

    const nextFunding = fr.uMarginList[0]?.nextFundingTime || fr.cMarginList[0]?.nextFundingTime || 0;

    return {
      symbol: fr.symbol,
      avgFundingRate: avgRate,
      nextFundingTime: nextFunding,
    };
  });
}

// =============================================================================
// Liquidation API Functions
// =============================================================================

/**
 * Get liquidation data for all symbols
 */
export async function getLiquidations(): Promise<CoinglassLiquidation[]> {
  const cacheKey = 'coinglass:liquidations:all';
  const cached = cache.get<CoinglassLiquidation[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassLiquidation[]>(`${BASE_URL}/liquidation`);
  cache.set(cacheKey, data, CACHE_TTL.liquidations);

  return data;
}

/**
 * Get liquidation data for specific symbol
 */
export async function getLiquidationBySymbol(symbol: string): Promise<CoinglassLiquidation> {
  const cacheKey = `coinglass:liquidations:${symbol}`;
  const cached = cache.get<CoinglassLiquidation>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassLiquidation>(`${BASE_URL}/liquidation?symbol=${symbol}`);
  cache.set(cacheKey, data, CACHE_TTL.liquidations);

  return data;
}

/**
 * Get liquidation history
 */
export async function getLiquidationHistory(
  symbol: string,
  interval: '1m' | '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '1d' = '1h',
  limit: number = 100
): Promise<CoinglassLiquidationHistory[]> {
  const cacheKey = `coinglass:liquidations:history:${symbol}-${interval}-${limit}`;
  const cached = cache.get<CoinglassLiquidationHistory[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassLiquidationHistory[]>(
    `${BASE_URL}/liquidation_history?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );

  cache.set(cacheKey, data, CACHE_TTL.historical_1d);
  return data;
}

/**
 * Get total liquidations summary
 */
export async function getLiquidationSummary(): Promise<{
  total24h: number;
  long24h: number;
  short24h: number;
  topLiquidations: Array<{ symbol: string; total: number; longPercent: number }>;
}> {
  const liquidations = await getLiquidations();

  const total24h = liquidations.reduce(
    (sum, l) => sum + l.h24LongLiquidationUsd + l.h24ShortLiquidationUsd,
    0
  );
  const long24h = liquidations.reduce((sum, l) => sum + l.h24LongLiquidationUsd, 0);
  const short24h = liquidations.reduce((sum, l) => sum + l.h24ShortLiquidationUsd, 0);

  const topLiquidations = liquidations
    .map((l) => ({
      symbol: l.symbol,
      total: l.h24LongLiquidationUsd + l.h24ShortLiquidationUsd,
      longPercent:
        l.h24LongLiquidationUsd + l.h24ShortLiquidationUsd > 0
          ? (l.h24LongLiquidationUsd / (l.h24LongLiquidationUsd + l.h24ShortLiquidationUsd)) * 100
          : 50,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  return { total24h, long24h, short24h, topLiquidations };
}

// =============================================================================
// Long/Short Ratio API Functions
// =============================================================================

/**
 * Get long/short ratio for all symbols
 */
export async function getLongShortRatio(): Promise<CoinglassLongShortRatio[]> {
  const cacheKey = 'coinglass:longshort:all';
  const cached = cache.get<CoinglassLongShortRatio[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassLongShortRatio[]>(`${BASE_URL}/long_short`);
  cache.set(cacheKey, data, CACHE_TTL.funding);

  return data;
}

/**
 * Get long/short ratio for specific symbol
 */
export async function getLongShortRatioBySymbol(symbol: string): Promise<CoinglassLongShortRatio> {
  const cacheKey = `coinglass:longshort:${symbol}`;
  const cached = cache.get<CoinglassLongShortRatio>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassLongShortRatio>(`${BASE_URL}/long_short?symbol=${symbol}`);
  cache.set(cacheKey, data, CACHE_TTL.funding);

  return data;
}

/**
 * Get long/short ratio history
 */
export async function getLongShortHistory(
  symbol: string,
  exchange: string = 'Binance',
  interval: '5m' | '15m' | '30m' | '1h' | '4h' | '12h' | '1d' = '1h',
  limit: number = 100
): Promise<CoinglassLongShortHistory[]> {
  const cacheKey = `coinglass:longshort:history:${symbol}-${exchange}-${interval}-${limit}`;
  const cached = cache.get<CoinglassLongShortHistory[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassLongShortHistory[]>(
    `${BASE_URL}/long_short_history?symbol=${symbol}&exchange=${exchange}&interval=${interval}&limit=${limit}`
  );

  cache.set(cacheKey, data, CACHE_TTL.historical_1d);
  return data;
}

/**
 * Get top traders long/short ratio
 */
export async function getTopLongShort(): Promise<CoinglassTopLongShort[]> {
  const cacheKey = 'coinglass:toplongshort:all';
  const cached = cache.get<CoinglassTopLongShort[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassTopLongShort[]>(`${BASE_URL}/top_long_short_account_ratio`);
  cache.set(cacheKey, data, CACHE_TTL.funding);

  return data;
}

/**
 * Get global long/short positions
 */
export async function getGlobalLongShort(): Promise<CoinglassGlobalLongShort> {
  const cacheKey = 'coinglass:globallongshort';
  const cached = cache.get<CoinglassGlobalLongShort>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassGlobalLongShort>(`${BASE_URL}/global_long_short`);
  cache.set(cacheKey, data, CACHE_TTL.funding);

  return data;
}

// =============================================================================
// Exchange API Functions
// =============================================================================

/**
 * Get exchange derivatives info
 */
export async function getExchangeInfo(): Promise<CoinglassExchangeInfo[]> {
  const cacheKey = 'coinglass:exchanges';
  const cached = cache.get<CoinglassExchangeInfo[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassExchangeInfo[]>(`${BASE_URL}/exchange_info`);
  cache.set(cacheKey, data, CACHE_TTL.markets);

  return data;
}

// =============================================================================
// Options API Functions
// =============================================================================

/**
 * Get options data
 */
export async function getOptions(): Promise<CoinglassOption[]> {
  const cacheKey = 'coinglass:options';
  const cached = cache.get<CoinglassOption[]>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassOption[]>(`${BASE_URL}/option`);
  cache.set(cacheKey, data, CACHE_TTL.markets);

  return data;
}

/**
 * Get options for specific symbol
 */
export async function getOptionsBySymbol(symbol: string): Promise<CoinglassOption> {
  const cacheKey = `coinglass:options:${symbol}`;
  const cached = cache.get<CoinglassOption>(cacheKey);
  if (cached) return cached;

  const data = await fetchWithAuth<CoinglassOption>(`${BASE_URL}/option?symbol=${symbol}`);
  cache.set(cacheKey, data, CACHE_TTL.markets);

  return data;
}

// =============================================================================
// Composite Data Functions
// =============================================================================

/**
 * Get comprehensive derivatives data for a symbol
 */
export async function getSymbolDerivatives(symbol: string): Promise<{
  openInterest: CoinglassOpenInterest | null;
  funding: CoinglassFundingRate | null;
  liquidations: CoinglassLiquidation | null;
  longShort: CoinglassLongShortRatio | null;
  options: CoinglassOption | null;
}> {
  const [oi, funding, liq, ls, opts] = await Promise.allSettled([
    getOpenInterestBySymbol(symbol),
    getFundingRateBySymbol(symbol),
    getLiquidationBySymbol(symbol),
    getLongShortRatioBySymbol(symbol),
    getOptionsBySymbol(symbol),
  ]);

  return {
    openInterest: oi.status === 'fulfilled' ? oi.value : null,
    funding: funding.status === 'fulfilled' ? funding.value : null,
    liquidations: liq.status === 'fulfilled' ? liq.value : null,
    longShort: ls.status === 'fulfilled' ? ls.value : null,
    options: opts.status === 'fulfilled' ? opts.value : null,
  };
}

/**
 * Get derivatives market overview
 */
export async function getDerivativesOverview(): Promise<{
  totalOpenInterest: number;
  totalLiquidations24h: number;
  avgFundingRate: number;
  marketSentiment: 'bullish' | 'bearish' | 'neutral';
  topByOI: Array<{ symbol: string; oi: number; oiChange: number }>;
  topByLiquidations: Array<{ symbol: string; liq: number; longPercent: number }>;
}> {
  const [oi, liq, funding, ls] = await Promise.allSettled([
    getAggregatedOpenInterest(),
    getLiquidationSummary(),
    getAverageFundingRates(),
    getGlobalLongShort(),
  ]);

  const oiData = oi.status === 'fulfilled' ? oi.value : [];
  const liqData = liq.status === 'fulfilled' ? liq.value : { total24h: 0, long24h: 0, short24h: 0, topLiquidations: [] };
  const fundingData = funding.status === 'fulfilled' ? funding.value : [];

  const totalOI = oiData.reduce((sum, d) => sum + (d.openInterestValue || 0), 0);
  const avgFunding =
    fundingData.length > 0
      ? fundingData.reduce((sum, f) => sum + f.avgFundingRate, 0) / fundingData.length
      : 0;

  // Determine sentiment based on funding rate and long/short
  let sentiment: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (avgFunding > 0.0001) {
    sentiment = 'bullish';
  } else if (avgFunding < -0.0001) {
    sentiment = 'bearish';
  }

  const topByOI = oiData
    .sort((a, b) => (b.openInterestValue || 0) - (a.openInterestValue || 0))
    .slice(0, 10)
    .map((d) => ({
      symbol: d.symbol,
      oi: d.openInterestValue || 0,
      oiChange: d.oiChangePercent || 0,
    }));

  return {
    totalOpenInterest: totalOI,
    totalLiquidations24h: liqData.total24h,
    avgFundingRate: avgFunding,
    marketSentiment: sentiment,
    topByOI,
    topByLiquidations: liqData.topLiquidations.map((item) => ({
      symbol: item.symbol,
      liq: item.total,
      longPercent: item.longPercent,
    })),
  };
}

/**
 * Get liquidation heatmap data (for chart visualization)
 */
export async function getLiquidationHeatmap(
  symbol: string = 'BTC',
  timeframe: '1h' | '4h' | '12h' | '24h' = '24h'
): Promise<{
  priceRanges: Array<{ price: number; longLiq: number; shortLiq: number }>;
  currentPrice: number;
}> {
  // Fetch real price data from CoinGecko
  const coinId = symbol.toLowerCase() === 'btc' ? 'bitcoin' : 
                 symbol.toLowerCase() === 'eth' ? 'ethereum' : 
                 symbol.toLowerCase();
  
  let currentPrice = 0;
  try {
    const priceRes = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`,
      { next: { revalidate: 60 } }
    );
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      currentPrice = priceData[coinId]?.usd || 0;
    }
  } catch (error) {
    console.error('Failed to fetch price for liquidation heatmap:', error);
  }
  
  // If we couldn't get a price, return empty data
  if (!currentPrice) {
    return { priceRanges: [], currentPrice: 0 };
  }
  
  // Fetch liquidation data from our API
  const liq = await getLiquidationBySymbol(symbol);
  
  // Build price ranges based on real current price
  const ranges = [];
  for (let i = -5; i <= 5; i++) {
    const priceLevel = currentPrice * (1 + i * 0.02);
    // Distribute liquidations across price levels based on distance from current price
    const distanceFactor = Math.abs(i) * 0.15;
    const longLiq = i < 0 ? liq.longLiquidationUsd * distanceFactor : 0;
    const shortLiq = i > 0 ? liq.shortLiquidationUsd * distanceFactor : 0;

    ranges.push({
      price: priceLevel,
      longLiq,
      shortLiq,
    });
  }

  return {
    priceRanges: ranges,
    currentPrice,
  };
}
