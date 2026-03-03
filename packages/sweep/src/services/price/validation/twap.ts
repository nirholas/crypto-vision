/**
 * TWAP (Time-Weighted Average Price) Validation
 * Compares spot price against TWAP to detect manipulation
 */

import { type SupportedChain } from "../../../config/chains.js";
import { cacheGetOrFetch, getRedis } from "../../../utils/redis.js";
import { fetchDexScreenerTokenData, fetchDexScreenerPools } from "../oracles/dexscreener.js";
import type { TWAPCheck, PRICE_VALIDATION_CONFIG } from "../types.js";

const CONFIG = {
  TWAP_DEVIATION_THRESHOLD: 0.20, // 20% max deviation from TWAP
  CACHE_TTL: 300, // 5 minutes
  PRICE_HISTORY_KEY: "price:twap:history",
};

/**
 * Get stored price history for TWAP calculation
 */
async function getPriceHistory(
  tokenAddress: string,
  chain: SupportedChain,
  durationMinutes: number
): Promise<Array<{ price: number; timestamp: number }>> {
  const redis = getRedis();
  const cacheKey = `${CONFIG.PRICE_HISTORY_KEY}:${chain}:${tokenAddress.toLowerCase()}`;
  
  const history = await redis.lrange(cacheKey, 0, -1);
  
  const cutoffTime = Date.now() - (durationMinutes * 60 * 1000);
  
  return history
    .map(h => {
      try {
        return JSON.parse(h) as { price: number; timestamp: number };
      } catch {
        return null;
      }
    })
    .filter((h): h is { price: number; timestamp: number } => 
      h !== null && h.timestamp >= cutoffTime
    );
}

/**
 * Store price point for TWAP calculation
 */
export async function storePriceForTWAP(
  tokenAddress: string,
  chain: SupportedChain,
  price: number
): Promise<void> {
  const redis = getRedis();
  const cacheKey = `${CONFIG.PRICE_HISTORY_KEY}:${chain}:${tokenAddress.toLowerCase()}`;
  
  const dataPoint = JSON.stringify({
    price,
    timestamp: Date.now(),
  });
  
  await redis.rpush(cacheKey, dataPoint);
  
  // Keep only last 24 hours of data
  const cutoffTime = Date.now() - (24 * 60 * 60 * 1000);
  const history = await redis.lrange(cacheKey, 0, -1);
  
  // Remove old entries
  const validEntries = history.filter(h => {
    try {
      const parsed = JSON.parse(h);
      return parsed.timestamp >= cutoffTime;
    } catch {
      return false;
    }
  });
  
  if (validEntries.length < history.length) {
    await redis.del(cacheKey);
    if (validEntries.length > 0) {
      await redis.rpush(cacheKey, ...validEntries);
    }
  }
  
  // Set expiry
  await redis.expire(cacheKey, 86400); // 24 hours
}

/**
 * Calculate TWAP from price history
 */
function calculateTWAP(
  history: Array<{ price: number; timestamp: number }>
): number {
  if (history.length === 0) return 0;
  if (history.length === 1) return history[0].price;
  
  // Sort by timestamp
  const sorted = [...history].sort((a, b) => a.timestamp - b.timestamp);
  
  // Calculate time-weighted average
  let totalWeightedPrice = 0;
  let totalTime = 0;
  
  for (let i = 1; i < sorted.length; i++) {
    const timeDelta = sorted[i].timestamp - sorted[i - 1].timestamp;
    const avgPrice = (sorted[i].price + sorted[i - 1].price) / 2;
    
    totalWeightedPrice += avgPrice * timeDelta;
    totalTime += timeDelta;
  }
  
  return totalTime > 0 ? totalWeightedPrice / totalTime : sorted[sorted.length - 1].price;
}

/**
 * Get TWAP for specified duration
 */
export async function getTWAP(
  tokenAddress: string,
  chain: SupportedChain,
  durationMinutes: number
): Promise<number> {
  const history = await getPriceHistory(tokenAddress, chain, durationMinutes);
  return calculateTWAP(history);
}

/**
 * Compare spot price against TWAP
 */
export async function compareTWAP(
  tokenAddress: string,
  chain: SupportedChain
): Promise<TWAPCheck> {
  const cacheKey = `twap:check:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      // Get current spot price from DEX
      let spotPrice = 0;
      
      try {
        const tokenData = await fetchDexScreenerTokenData(tokenAddress, chain);
        spotPrice = tokenData.price;
      } catch (error) {
        console.error(`Failed to get spot price for TWAP comparison:`, error);
      }
      
      if (spotPrice === 0) {
        return {
          valid: false,
          spotPrice: 0,
          twap1h: 0,
          twap24h: 0,
          deviation1h: 1,
          deviation24h: 1,
        };
      }
      
      // Get TWAPs
      const [twap1h, twap24h] = await Promise.all([
        getTWAP(tokenAddress, chain, 60), // 1 hour
        getTWAP(tokenAddress, chain, 1440), // 24 hours
      ]);
      
      // If no TWAP data, store current price and return
      if (twap1h === 0 && twap24h === 0) {
        await storePriceForTWAP(tokenAddress, chain, spotPrice);
        
        return {
          valid: true, // Can't validate without historical data
          spotPrice,
          twap1h: spotPrice,
          twap24h: spotPrice,
          deviation1h: 0,
          deviation24h: 0,
        };
      }
      
      // Calculate deviations
      const effectiveTwap1h = twap1h > 0 ? twap1h : spotPrice;
      const effectiveTwap24h = twap24h > 0 ? twap24h : spotPrice;
      
      const deviation1h = Math.abs(spotPrice - effectiveTwap1h) / effectiveTwap1h;
      const deviation24h = Math.abs(spotPrice - effectiveTwap24h) / effectiveTwap24h;
      
      // Store current price for future TWAP calculations
      await storePriceForTWAP(tokenAddress, chain, spotPrice);
      
      // Valid if both deviations are within threshold
      const valid = 
        deviation1h <= CONFIG.TWAP_DEVIATION_THRESHOLD && 
        deviation24h <= CONFIG.TWAP_DEVIATION_THRESHOLD;
      
      return {
        valid,
        spotPrice,
        twap1h: effectiveTwap1h,
        twap24h: effectiveTwap24h,
        deviation1h,
        deviation24h,
      };
    },
    CONFIG.CACHE_TTL
  );
}

/**
 * Check for potential price manipulation
 */
export async function detectPriceManipulation(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  isManipulated: boolean;
  manipulationType?: "pump" | "dump" | "unknown";
  severity: "low" | "medium" | "high";
  reason?: string;
}> {
  const twapCheck = await compareTWAP(tokenAddress, chain);
  
  if (twapCheck.spotPrice === 0) {
    return {
      isManipulated: false,
      severity: "low",
      reason: "No price data available",
    };
  }
  
  // If spot is significantly higher than TWAP, potential pump
  // If spot is significantly lower than TWAP, potential dump
  const maxDeviation = Math.max(twapCheck.deviation1h, twapCheck.deviation24h);
  
  if (maxDeviation <= CONFIG.TWAP_DEVIATION_THRESHOLD) {
    return {
      isManipulated: false,
      severity: "low",
    };
  }
  
  // Determine manipulation type
  let manipulationType: "pump" | "dump" | "unknown" = "unknown";
  const avgTwap = (twapCheck.twap1h + twapCheck.twap24h) / 2;
  
  if (twapCheck.spotPrice > avgTwap * 1.1) {
    manipulationType = "pump";
  } else if (twapCheck.spotPrice < avgTwap * 0.9) {
    manipulationType = "dump";
  }
  
  // Determine severity
  let severity: "low" | "medium" | "high" = "low";
  if (maxDeviation > 0.5) severity = "high"; // >50% deviation
  else if (maxDeviation > 0.3) severity = "medium"; // 30-50% deviation
  
  return {
    isManipulated: true,
    manipulationType,
    severity,
    reason: `Spot price deviates ${(maxDeviation * 100).toFixed(1)}% from TWAP`,
  };
}

/**
 * Get price stability metrics
 */
export async function getPriceStability(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  stability: "stable" | "moderate" | "volatile";
  volatility1h: number;
  volatility24h: number;
}> {
  const history1h = await getPriceHistory(tokenAddress, chain, 60);
  const history24h = await getPriceHistory(tokenAddress, chain, 1440);
  
  const calculateVolatility = (prices: number[]): number => {
    if (prices.length < 2) return 0;
    
    const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
    const variance = prices.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / prices.length;
    const stdDev = Math.sqrt(variance);
    
    return mean > 0 ? stdDev / mean : 0;
  };
  
  const volatility1h = calculateVolatility(history1h.map(h => h.price));
  const volatility24h = calculateVolatility(history24h.map(h => h.price));
  
  const maxVolatility = Math.max(volatility1h, volatility24h);
  
  let stability: "stable" | "moderate" | "volatile";
  if (maxVolatility < 0.05) stability = "stable";
  else if (maxVolatility < 0.15) stability = "moderate";
  else stability = "volatile";
  
  return {
    stability,
    volatility1h,
    volatility24h,
  };
}

/**
 * Should we trust the current price based on TWAP analysis?
 */
export async function shouldTrustPrice(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  trust: boolean;
  confidence: number; // 0-1
  twapCheck: TWAPCheck;
  reason?: string;
}> {
  const twapCheck = await compareTWAP(tokenAddress, chain);
  
  if (!twapCheck.valid) {
    // Calculate confidence based on deviation
    const maxDeviation = Math.max(twapCheck.deviation1h, twapCheck.deviation24h);
    const confidence = Math.max(0, 1 - maxDeviation);
    
    return {
      trust: false,
      confidence,
      twapCheck,
      reason: `Price deviates significantly from TWAP (1h: ${(twapCheck.deviation1h * 100).toFixed(1)}%, 24h: ${(twapCheck.deviation24h * 100).toFixed(1)}%)`,
    };
  }
  
  // Calculate confidence (higher when deviation is lower)
  const avgDeviation = (twapCheck.deviation1h + twapCheck.deviation24h) / 2;
  const confidence = Math.max(0, 1 - (avgDeviation / CONFIG.TWAP_DEVIATION_THRESHOLD));
  
  return {
    trust: true,
    confidence,
    twapCheck,
  };
}

export default {
  compareTWAP,
  getTWAP,
  storePriceForTWAP,
  detectPriceManipulation,
  getPriceStability,
  shouldTrustPrice,
};
