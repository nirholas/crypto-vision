/**
 * Multi-Oracle Price Consensus
 * Aggregates prices from multiple oracles and determines consensus
 */

import { type SupportedChain } from "../../../config/chains.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import { fetchCoinGeckoPrice } from "../oracles/coingecko.js";
import { fetchDefiLlamaPrice } from "../oracles/defillama.js";
import { fetchDexScreenerPrice } from "../oracles/dexscreener.js";
import { fetchChainlinkPrice } from "../oracles/chainlink.js";
import { fetchPythPrice, fetchPythHermesPrice } from "../oracles/pyth.js";
import type { PriceSource, ValidatedPrice, PriceConfidence, PRICE_VALIDATION_CONFIG } from "../types.js";

const CONFIG = {
  PRICE_DEVIATION_THRESHOLD: 0.05, // 5% max deviation from median
  MIN_SOURCES_REQUIRED: 2,
  CACHE_TTL: 60, // seconds
};

/**
 * Fetch prices from all available oracles
 */
async function fetchAllPrices(
  tokenAddress: string,
  chain: SupportedChain
): Promise<PriceSource[]> {
  const isEVMChain = chain !== "solana";
  
  // Start all price fetches in parallel
  const pricePromises: Array<Promise<PriceSource | null>> = [
    // Off-chain APIs (work for all chains)
    fetchCoinGeckoPrice(tokenAddress, chain).catch(() => null),
    fetchDefiLlamaPrice(tokenAddress, chain).catch(() => null),
    fetchDexScreenerPrice(tokenAddress, chain).catch(() => null),
  ];
  
  // Add on-chain oracles for EVM chains
  if (isEVMChain) {
    const evmChain = chain as Exclude<SupportedChain, "solana">;
    pricePromises.push(
      fetchChainlinkPrice(tokenAddress, evmChain).then(result => 
        result ? { name: "chainlink", price: result.price, confidence: 0.95, timestamp: result.timestamp } : null
      ).catch(() => null),
      fetchPythHermesPrice(tokenAddress, evmChain).then(result =>
        result ? { name: "pyth", price: result.price, confidence: 0.92, timestamp: result.timestamp } : null
      ).catch(() => null),
    );
  }
  
  const results = await Promise.all(pricePromises);
  
  // Filter out null results and invalid prices
  return results.filter((r): r is PriceSource => 
    r !== null && 
    r.price > 0 && 
    !isNaN(r.price) && 
    isFinite(r.price)
  );
}

/**
 * Calculate median price from array of prices
 */
function calculateMedian(prices: number[]): number {
  if (prices.length === 0) return 0;
  
  const sorted = [...prices].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate weighted average price (weighted by confidence)
 */
function calculateWeightedAverage(sources: PriceSource[]): number {
  if (sources.length === 0) return 0;
  
  const totalWeight = sources.reduce((sum, s) => sum + s.confidence, 0);
  const weightedSum = sources.reduce((sum, s) => sum + s.price * s.confidence, 0);
  
  return weightedSum / totalWeight;
}

/**
 * Determine confidence level based on consensus
 */
function determineConfidence(
  consensusSources: PriceSource[],
  allSources: PriceSource[]
): PriceConfidence {
  // High confidence: 3+ sources within threshold, including at least one on-chain oracle
  if (consensusSources.length >= 3) {
    const hasOnChainOracle = consensusSources.some(s => 
      s.name === "chainlink" || s.name === "pyth"
    );
    if (hasOnChainOracle) {
      return "HIGH";
    }
    return "HIGH"; // Still high with 3+ off-chain sources
  }
  
  // Medium confidence: 2 sources within threshold
  if (consensusSources.length >= 2) {
    return "MEDIUM";
  }
  
  // Low confidence: only 1 source
  if (consensusSources.length === 1 || allSources.length === 1) {
    return "LOW";
  }
  
  // Untrusted: no consensus or no sources
  return "UNTRUSTED";
}

/**
 * Get validated price with multi-oracle consensus
 */
export async function getValidatedPrice(
  tokenAddress: string,
  chain: SupportedChain
): Promise<ValidatedPrice> {
  const cacheKey = `validated:price:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const sources = await fetchAllPrices(tokenAddress, chain);
      
      // No price data available
      if (sources.length === 0) {
        return {
          price: 0,
          confidence: "UNTRUSTED" as PriceConfidence,
          sources: [],
          requiresApproval: true,
          timestamp: Date.now(),
        };
      }
      
      // Calculate median price
      const prices = sources.map(s => s.price);
      const median = calculateMedian(prices);
      
      // Find sources within acceptable deviation from median
      const consensusSources = sources.filter(s => {
        const deviation = Math.abs(s.price - median) / median;
        return deviation <= CONFIG.PRICE_DEVIATION_THRESHOLD;
      });
      
      // Determine confidence
      const confidence = determineConfidence(consensusSources, sources);
      
      // Use weighted average of consensus sources for final price
      const finalPrice = consensusSources.length > 0
        ? calculateWeightedAverage(consensusSources)
        : median;
      
      // Determine if approval is required
      const requiresApproval = 
        confidence === "LOW" || 
        confidence === "UNTRUSTED" ||
        consensusSources.length < CONFIG.MIN_SOURCES_REQUIRED;
      
      return {
        price: finalPrice,
        confidence,
        sources,
        requiresApproval,
        timestamp: Date.now(),
      };
    },
    CONFIG.CACHE_TTL
  );
}

/**
 * Check if prices are in consensus (within deviation threshold)
 */
export function arePricesInConsensus(
  prices: number[],
  threshold: number = CONFIG.PRICE_DEVIATION_THRESHOLD
): boolean {
  if (prices.length < 2) return true;
  
  const median = calculateMedian(prices);
  
  return prices.every(price => {
    const deviation = Math.abs(price - median) / median;
    return deviation <= threshold;
  });
}

/**
 * Get price deviation statistics
 */
export function getPriceDeviationStats(
  sources: PriceSource[]
): { median: number; mean: number; stdDev: number; maxDeviation: number } {
  if (sources.length === 0) {
    return { median: 0, mean: 0, stdDev: 0, maxDeviation: 0 };
  }
  
  const prices = sources.map(s => s.price);
  const median = calculateMedian(prices);
  const mean = prices.reduce((a, b) => a + b, 0) / prices.length;
  
  // Standard deviation
  const squaredDiffs = prices.map(p => Math.pow(p - mean, 2));
  const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / prices.length;
  const stdDev = Math.sqrt(avgSquaredDiff);
  
  // Max deviation from median
  const maxDeviation = Math.max(...prices.map(p => Math.abs(p - median) / median));
  
  return { median, mean, stdDev, maxDeviation };
}

/**
 * Validate price against a reference price
 */
export function validatePriceAgainstReference(
  price: number,
  referencePrice: number,
  maxDeviation: number = 0.10
): { valid: boolean; deviation: number } {
  if (referencePrice === 0) {
    return { valid: false, deviation: 1 };
  }
  
  const deviation = Math.abs(price - referencePrice) / referencePrice;
  return {
    valid: deviation <= maxDeviation,
    deviation,
  };
}

export default {
  getValidatedPrice,
  arePricesInConsensus,
  getPriceDeviationStats,
  validatePriceAgainstReference,
};
