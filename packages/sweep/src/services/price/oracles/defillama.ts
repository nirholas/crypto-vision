/**
 * DefiLlama Price Oracle
 * Fetches token prices from DefiLlama API
 */

import { CHAIN_CONFIG, type SupportedChain } from "../../../config/chains.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import type { PriceSource, DefiLlamaResponse } from "../types.js";

const DEFILLAMA_API_BASE = "https://coins.llama.fi";

// Chain to DefiLlama chain prefix mapping
const CHAIN_PREFIXES: Record<SupportedChain, string> = {
  ethereum: "ethereum",
  base: "base",
  arbitrum: "arbitrum",
  polygon: "polygon",
  bsc: "bsc",
  linea: "linea",
  optimism: "optimism",
  solana: "solana",
};

/**
 * Build DefiLlama coin ID from chain and address
 */
function buildCoinId(chain: SupportedChain, tokenAddress: string): string {
  const prefix = CHAIN_PREFIXES[chain];
  return `${prefix}:${tokenAddress}`;
}

/**
 * Fetch token price from DefiLlama
 */
export async function fetchDefiLlamaPrice(
  tokenAddress: string,
  chain: SupportedChain
): Promise<PriceSource> {
  const cacheKey = `defillama:price:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const coinId = buildCoinId(chain, tokenAddress);
      const url = `${DEFILLAMA_API_BASE}/prices/current/${coinId}`;
      
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error(`DefiLlama API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as DefiLlamaResponse;
      const coinData = data.coins[coinId];
      
      if (!coinData || coinData.price === undefined) {
        throw new Error(`No price data for token ${tokenAddress} on ${chain}`);
      }
      
      // DefiLlama provides confidence score
      const confidence = coinData.confidence !== undefined ? coinData.confidence : 0.85;
      
      return {
        name: "defillama",
        price: coinData.price,
        confidence: Math.min(confidence, 1),
        timestamp: coinData.timestamp * 1000 || Date.now(),
      };
    },
    60 // 60 second TTL
  );
}

/**
 * Fetch historical prices from DefiLlama
 */
export async function fetchDefiLlamaHistoricalPrices(
  tokenAddress: string,
  chain: SupportedChain,
  timestamps: number[]
): Promise<Array<{ timestamp: number; price: number }>> {
  const cacheKey = `defillama:history:${chain}:${tokenAddress.toLowerCase()}:${timestamps.length}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const coinId = buildCoinId(chain, tokenAddress);
      const results: Array<{ timestamp: number; price: number }> = [];
      
      // DefiLlama supports historical prices at specific timestamps
      for (const timestamp of timestamps) {
        try {
          const url = `${DEFILLAMA_API_BASE}/prices/historical/${timestamp}/${coinId}`;
          const response = await fetch(url);
          
          if (response.ok) {
            const data = await response.json() as DefiLlamaResponse;
            const coinData = data.coins[coinId];
            
            if (coinData?.price) {
              results.push({ timestamp, price: coinData.price });
            }
          }
        } catch {
          // Skip failed timestamp
        }
      }
      
      return results;
    },
    300 // 5 minute TTL
  );
}

/**
 * Fetch first recorded price (for age/reliability check)
 */
export async function fetchDefiLlamaFirstPrice(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{ timestamp: number; price: number } | null> {
  try {
    const coinId = buildCoinId(chain, tokenAddress);
    const url = `${DEFILLAMA_API_BASE}/chart/${coinId}?span=all&period=1d`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as { coins?: Record<string, { prices?: Array<{ timestamp: number; price: number }> }> };
    
    if (data.coins?.[coinId]?.prices?.length && data.coins[coinId].prices!.length > 0) {
      const firstPrice = data.coins[coinId].prices![0];
      return {
        timestamp: firstPrice.timestamp,
        price: firstPrice.price,
      };
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Batch fetch prices for multiple tokens
 */
export async function fetchDefiLlamaBatchPrices(
  tokens: Array<{ address: string; chain: SupportedChain }>
): Promise<Map<string, PriceSource>> {
  const results = new Map<string, PriceSource>();
  
  if (tokens.length === 0) return results;
  
  try {
    // Build coin IDs
    const coinIds = tokens.map(t => buildCoinId(t.chain, t.address));
    const url = `${DEFILLAMA_API_BASE}/prices/current/${coinIds.join(",")}`;
    
    const response = await fetch(url, {
      headers: { "Content-Type": "application/json" },
    });
    
    if (!response.ok) {
      throw new Error(`DefiLlama batch API error: ${response.status}`);
    }
    
    const data = await response.json() as DefiLlamaResponse;
    
    for (const token of tokens) {
      const coinId = buildCoinId(token.chain, token.address);
      const coinData = data.coins[coinId];
      
      if (coinData?.price) {
        const key = `${token.chain}:${token.address.toLowerCase()}`;
        results.set(key, {
          name: "defillama",
          price: coinData.price,
          confidence: coinData.confidence !== undefined ? Math.min(coinData.confidence, 1) : 0.85,
          timestamp: coinData.timestamp * 1000 || Date.now(),
        });
      }
    }
  } catch (error) {
    console.error("DefiLlama batch fetch error:", error);
  }
  
  return results;
}

/**
 * Get price change percentage over time period
 */
export async function fetchDefiLlamaPriceChange(
  tokenAddress: string,
  chain: SupportedChain,
  period: "1h" | "24h" | "7d"
): Promise<number> {
  try {
    const coinId = buildCoinId(chain, tokenAddress);
    const now = Math.floor(Date.now() / 1000);
    
    const periodSeconds = {
      "1h": 3600,
      "24h": 86400,
      "7d": 604800,
    }[period];
    
    const historicalTimestamp = now - periodSeconds;
    
    // Get current and historical prices
    const [currentResponse, historicalResponse] = await Promise.all([
      fetch(`${DEFILLAMA_API_BASE}/prices/current/${coinId}`),
      fetch(`${DEFILLAMA_API_BASE}/prices/historical/${historicalTimestamp}/${coinId}`),
    ]);
    
    if (!currentResponse.ok || !historicalResponse.ok) {
      return 0;
    }
    
    const currentData = await currentResponse.json() as DefiLlamaResponse;
    const historicalData = await historicalResponse.json() as DefiLlamaResponse;
    
    const currentPrice = currentData.coins[coinId]?.price;
    const historicalPrice = historicalData.coins[coinId]?.price;
    
    if (!currentPrice || !historicalPrice) {
      return 0;
    }
    
    return ((currentPrice - historicalPrice) / historicalPrice) * 100;
  } catch {
    return 0;
  }
}

export default {
  fetchDefiLlamaPrice,
  fetchDefiLlamaHistoricalPrices,
  fetchDefiLlamaFirstPrice,
  fetchDefiLlamaBatchPrices,
  fetchDefiLlamaPriceChange,
};
