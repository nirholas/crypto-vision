/**
 * Historical Price Anomaly Detection
 * Detects unusual price movements compared to historical data
 */

import { type SupportedChain } from "../../../config/chains.js";
import { getRedis, cacheGetOrFetch } from "../../../utils/redis.js";
import { fetchCoinGeckoHistoricalPrices } from "../oracles/coingecko.js";
import { fetchDefiLlamaHistoricalPrices } from "../oracles/defillama.js";
import type { AnomalyCheck, PRICE_VALIDATION_CONFIG } from "../types.js";

const CONFIG = {
  ANOMALY_THRESHOLD: 0.50, // 50% deviation from 7d average = anomaly
  MIN_DATA_POINTS: 24, // Need at least 24 data points for analysis
  HISTORY_KEY_PREFIX: "price:history",
  CACHE_TTL: 300, // 5 minutes
};

/**
 * Get historical price data from cache or fetch from APIs
 */
async function getHistoricalPrices(
  tokenAddress: string,
  chain: SupportedChain,
  days: number = 7
): Promise<number[]> {
  const cacheKey = `${CONFIG.HISTORY_KEY_PREFIX}:${chain}:${tokenAddress.toLowerCase()}`;
  const redis = getRedis();
  
  // Try to get from cache first
  const cachedHistory = await redis.lrange(cacheKey, 0, -1);
  
  if (cachedHistory.length >= CONFIG.MIN_DATA_POINTS) {
    return cachedHistory.map(h => {
      try {
        const parsed = JSON.parse(h);
        return parsed.price || parsed;
      } catch {
        return parseFloat(h);
      }
    }).filter(p => !isNaN(p) && p > 0);
  }
  
  // Fetch from APIs
  try {
    const prices = await fetchCoinGeckoHistoricalPrices(tokenAddress, chain, days);
    
    if (prices.length > 0) {
      // Store in cache for future use (each price as JSON object)
      const pipeline = redis.pipeline();
      pipeline.del(cacheKey);
      
      for (const price of prices) {
        pipeline.rpush(cacheKey, JSON.stringify({ price, timestamp: Date.now() }));
      }
      
      pipeline.expire(cacheKey, 86400); // 24 hour expiry
      await pipeline.exec();
      
      return prices;
    }
  } catch (error) {
    console.error(`Failed to fetch historical prices for ${tokenAddress}:`, error);
  }
  
  // Fallback to DefiLlama
  try {
    const now = Math.floor(Date.now() / 1000);
    const timestamps: number[] = [];
    
    // Get hourly timestamps for the past N days
    for (let i = 0; i < days * 24; i += 4) { // Every 4 hours
      timestamps.push(now - (i * 3600));
    }
    
    const historicalPrices = await fetchDefiLlamaHistoricalPrices(tokenAddress, chain, timestamps);
    return historicalPrices.map(h => h.price);
  } catch {
    return [];
  }
}

/**
 * Calculate statistics from price history
 */
function calculatePriceStats(prices: number[]): {
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
} {
  if (prices.length === 0) {
    return { mean: 0, median: 0, stdDev: 0, min: 0, max: 0 };
  }
  
  const sorted = [...prices].sort((a, b) => a - b);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  
  const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(variance);
  
  return {
    mean,
    median,
    stdDev,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/**
 * Detect price anomaly based on historical data
 */
export async function detectPriceAnomaly(
  tokenAddress: string,
  chain: SupportedChain,
  currentPrice: number
): Promise<AnomalyCheck> {
  const cacheKey = `anomaly:check:${chain}:${tokenAddress.toLowerCase()}:${Math.floor(currentPrice * 100)}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const historicalPrices = await getHistoricalPrices(tokenAddress, chain, 7);
      
      // Not enough data - treat as potentially anomalous (conservative)
      if (historicalPrices.length < CONFIG.MIN_DATA_POINTS) {
        return {
          isAnomalous: true, // Conservative - treat new tokens as anomalous
          currentPrice,
          avg7d: 0,
          deviation: 1,
          dataPoints: historicalPrices.length,
        };
      }
      
      const stats = calculatePriceStats(historicalPrices);
      const deviation = stats.mean > 0 
        ? Math.abs(currentPrice - stats.mean) / stats.mean 
        : 1;
      
      // Check if price is outside normal range
      // Normal range: mean ± 2 * stdDev (covers ~95% of data)
      const upperBound = stats.mean + 2 * stats.stdDev;
      const lowerBound = Math.max(0, stats.mean - 2 * stats.stdDev);
      const isOutsideNormalRange = currentPrice > upperBound || currentPrice < lowerBound;
      
      // Price is anomalous if deviation exceeds threshold OR outside normal range
      const isAnomalous = deviation > CONFIG.ANOMALY_THRESHOLD || isOutsideNormalRange;
      
      return {
        isAnomalous,
        currentPrice,
        avg7d: stats.mean,
        deviation,
        dataPoints: historicalPrices.length,
      };
    },
    CONFIG.CACHE_TTL
  );
}

/**
 * Store current price in history
 */
export async function storePriceInHistory(
  tokenAddress: string,
  chain: SupportedChain,
  price: number
): Promise<void> {
  const cacheKey = `${CONFIG.HISTORY_KEY_PREFIX}:${chain}:${tokenAddress.toLowerCase()}`;
  const redis = getRedis();
  
  const dataPoint = JSON.stringify({
    price,
    timestamp: Date.now(),
  });
  
  // Add to the right of the list (newest at the end)
  await redis.rpush(cacheKey, dataPoint);
  
  // Keep only last 7 days of hourly data (168 data points max)
  await redis.ltrim(cacheKey, -168, -1);
  
  // Set expiry
  await redis.expire(cacheKey, 86400 * 7); // 7 days
}

/**
 * Detect sudden price spikes or drops
 */
export async function detectSuddenPriceChange(
  tokenAddress: string,
  chain: SupportedChain,
  currentPrice: number,
  lookbackMinutes: number = 60
): Promise<{
  hasSuddenChange: boolean;
  changePercentage: number;
  direction: "up" | "down" | "stable";
}> {
  const cacheKey = `${CONFIG.HISTORY_KEY_PREFIX}:${chain}:${tokenAddress.toLowerCase()}`;
  const redis = getRedis();
  
  // Get recent price history
  const recentHistory = await redis.lrange(cacheKey, -10, -1);
  
  if (recentHistory.length === 0) {
    return {
      hasSuddenChange: false,
      changePercentage: 0,
      direction: "stable",
    };
  }
  
  // Parse and find price from lookback period
  const lookbackTime = Date.now() - (lookbackMinutes * 60 * 1000);
  let oldestRelevantPrice = currentPrice;
  
  for (const entry of recentHistory) {
    try {
      const parsed = JSON.parse(entry);
      if (parsed.timestamp >= lookbackTime) {
        oldestRelevantPrice = parsed.price;
        break;
      }
    } catch {
      continue;
    }
  }
  
  const changePercentage = ((currentPrice - oldestRelevantPrice) / oldestRelevantPrice) * 100;
  
  // Consider >20% change in 1 hour as "sudden"
  const suddenThreshold = 20;
  const hasSuddenChange = Math.abs(changePercentage) > suddenThreshold;
  
  let direction: "up" | "down" | "stable" = "stable";
  if (changePercentage > 5) direction = "up";
  else if (changePercentage < -5) direction = "down";
  
  return {
    hasSuddenChange,
    changePercentage,
    direction,
  };
}

/**
 * Get price volatility metric
 */
export async function getPriceVolatility(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  volatility: number; // Standard deviation / mean
  classification: "low" | "medium" | "high" | "extreme";
}> {
  const historicalPrices = await getHistoricalPrices(tokenAddress, chain, 7);
  
  if (historicalPrices.length < CONFIG.MIN_DATA_POINTS) {
    return {
      volatility: 1, // Unknown = assume high
      classification: "extreme",
    };
  }
  
  const stats = calculatePriceStats(historicalPrices);
  
  // Coefficient of variation (CV) = stdDev / mean
  const volatility = stats.mean > 0 ? stats.stdDev / stats.mean : 1;
  
  // Classify volatility
  let classification: "low" | "medium" | "high" | "extreme";
  if (volatility < 0.05) classification = "low"; // <5%
  else if (volatility < 0.15) classification = "medium"; // 5-15%
  else if (volatility < 0.30) classification = "high"; // 15-30%
  else classification = "extreme"; // >30%
  
  return { volatility, classification };
}

/**
 * Validate price against historical trend
 */
export async function validateAgainstTrend(
  tokenAddress: string,
  chain: SupportedChain,
  currentPrice: number
): Promise<{
  valid: boolean;
  trend: "bullish" | "bearish" | "sideways";
  trendStrength: number; // 0-1
  priceVsTrend: "above" | "below" | "inline";
}> {
  const historicalPrices = await getHistoricalPrices(tokenAddress, chain, 7);
  
  if (historicalPrices.length < CONFIG.MIN_DATA_POINTS) {
    return {
      valid: true, // Can't validate without data
      trend: "sideways",
      trendStrength: 0,
      priceVsTrend: "inline",
    };
  }
  
  // Simple linear regression to determine trend
  const n = historicalPrices.length;
  const xMean = (n - 1) / 2;
  const yMean = historicalPrices.reduce((a, b) => a + b, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (historicalPrices[i] - yMean);
    denominator += (i - xMean) * (i - xMean);
  }
  
  const slope = denominator !== 0 ? numerator / denominator : 0;
  
  // Normalize slope relative to price
  const normalizedSlope = yMean > 0 ? slope / yMean : 0;
  
  // Determine trend
  let trend: "bullish" | "bearish" | "sideways";
  if (normalizedSlope > 0.01) trend = "bullish";
  else if (normalizedSlope < -0.01) trend = "bearish";
  else trend = "sideways";
  
  const trendStrength = Math.min(Math.abs(normalizedSlope) * 10, 1);
  
  // Check if current price is reasonable given trend
  const expectedPrice = yMean + (slope * (n / 2)); // Extrapolate to current
  const deviation = Math.abs(currentPrice - expectedPrice) / expectedPrice;
  
  let priceVsTrend: "above" | "below" | "inline";
  if (currentPrice > expectedPrice * 1.1) priceVsTrend = "above";
  else if (currentPrice < expectedPrice * 0.9) priceVsTrend = "below";
  else priceVsTrend = "inline";
  
  // Valid if current price isn't too far from expected
  const valid = deviation < 0.5; // Within 50% of expected
  
  return { valid, trend, trendStrength, priceVsTrend };
}

export default {
  detectPriceAnomaly,
  storePriceInHistory,
  detectSuddenPriceChange,
  getPriceVolatility,
  validateAgainstTrend,
};
