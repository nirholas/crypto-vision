/**
 * DexScreener Price Oracle
 * Fetches token prices and liquidity from DexScreener API
 */

import { type SupportedChain } from "../../../config/chains.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import type { PriceSource, DexScreenerResponse, DexScreenerPair, DexPool } from "../types.js";

const DEXSCREENER_API_BASE = "https://api.dexscreener.com/latest";

// Chain to DexScreener chain ID mapping
const CHAIN_IDS: Record<SupportedChain, string> = {
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
 * Fetch token price from DexScreener
 */
export async function fetchDexScreenerPrice(
  tokenAddress: string,
  chain: SupportedChain
): Promise<PriceSource> {
  const cacheKey = `dexscreener:price:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const chainId = CHAIN_IDS[chain];
      const url = `${DEXSCREENER_API_BASE}/dex/tokens/${tokenAddress}`;
      
      const response = await fetch(url, {
        headers: { "Content-Type": "application/json" },
      });
      
      if (!response.ok) {
        throw new Error(`DexScreener API error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json() as DexScreenerResponse;
      
      // Filter pairs for the specific chain
      const chainPairs = data.pairs?.filter(p => p.chainId === chainId) || [];
      
      if (chainPairs.length === 0) {
        throw new Error(`No pairs found for token ${tokenAddress} on ${chain}`);
      }
      
      // Get the pair with highest liquidity for price
      const sortedPairs = chainPairs.sort(
        (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      );
      
      const bestPair = sortedPairs[0];
      const price = parseFloat(bestPair.priceUsd);
      
      if (isNaN(price) || price <= 0) {
        throw new Error(`Invalid price for token ${tokenAddress}`);
      }
      
      // Calculate confidence based on liquidity
      const liquidity = bestPair.liquidity?.usd || 0;
      let confidence = 0.7; // Base confidence
      if (liquidity >= 1_000_000) confidence = 0.95;
      else if (liquidity >= 100_000) confidence = 0.9;
      else if (liquidity >= 10_000) confidence = 0.8;
      
      return {
        name: "dexscreener",
        price,
        confidence,
        timestamp: Date.now(),
      };
    },
    60 // 60 second TTL
  );
}

/**
 * Fetch all pools/pairs for a token
 */
export async function fetchDexScreenerPools(
  tokenAddress: string,
  chain: SupportedChain
): Promise<DexPool[]> {
  const cacheKey = `dexscreener:pools:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const chainId = CHAIN_IDS[chain];
      const url = `${DEXSCREENER_API_BASE}/dex/tokens/${tokenAddress}`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`DexScreener pools API error: ${response.status}`);
      }
      
      const data = await response.json() as DexScreenerResponse;
      
      // Filter pairs for the specific chain
      const chainPairs = data.pairs?.filter(p => p.chainId === chainId) || [];
      
      return chainPairs.map((pair): DexPool => ({
        dex: pair.dexId,
        pairAddress: pair.pairAddress,
        liquidity: pair.liquidity?.usd || 0,
        volume24h: pair.volume?.h24 || 0,
        priceUsd: parseFloat(pair.priceUsd) || 0,
      }));
    },
    300 // 5 minute TTL for pool data
  );
}

/**
 * Get total liquidity across all pools
 */
export async function fetchDexScreenerLiquidity(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{ totalLiquidity: number; totalVolume24h: number; poolCount: number }> {
  const pools = await fetchDexScreenerPools(tokenAddress, chain);
  
  return {
    totalLiquidity: pools.reduce((sum, p) => sum + p.liquidity, 0),
    totalVolume24h: pools.reduce((sum, p) => sum + p.volume24h, 0),
    poolCount: pools.length,
  };
}

/**
 * Fetch token data including OHLCV-like info
 */
export async function fetchDexScreenerTokenData(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  pairs: DexScreenerPair[];
}> {
  const chainId = CHAIN_IDS[chain];
  const url = `${DEXSCREENER_API_BASE}/dex/tokens/${tokenAddress}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`DexScreener token data error: ${response.status}`);
  }
  
  const data = await response.json() as DexScreenerResponse;
  const chainPairs = data.pairs?.filter(p => p.chainId === chainId) || [];
  
  if (chainPairs.length === 0) {
    return {
      price: 0,
      priceChange24h: 0,
      volume24h: 0,
      liquidity: 0,
      pairs: [],
    };
  }
  
  // Sort by liquidity to get best pair
  const sortedPairs = chainPairs.sort(
    (a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  );
  
  const bestPair = sortedPairs[0];
  
  return {
    price: parseFloat(bestPair.priceUsd) || 0,
    priceChange24h: bestPair.priceChange?.h24 || 0,
    volume24h: chainPairs.reduce((sum, p) => sum + (p.volume?.h24 || 0), 0),
    liquidity: chainPairs.reduce((sum, p) => sum + (p.liquidity?.usd || 0), 0),
    pairs: chainPairs,
  };
}

/**
 * Get prices from multiple DEXes for cross-DEX comparison
 */
export async function fetchDexScreenerCrossDexPrices(
  tokenAddress: string,
  chain: SupportedChain
): Promise<Record<string, number>> {
  const pools = await fetchDexScreenerPools(tokenAddress, chain);
  
  const pricesByDex: Record<string, { price: number; liquidity: number }[]> = {};
  
  for (const pool of pools) {
    if (pool.priceUsd > 0) {
      if (!pricesByDex[pool.dex]) {
        pricesByDex[pool.dex] = [];
      }
      pricesByDex[pool.dex].push({
        price: pool.priceUsd,
        liquidity: pool.liquidity,
      });
    }
  }
  
  // For each DEX, use the liquidity-weighted price
  const result: Record<string, number> = {};
  
  for (const [dex, prices] of Object.entries(pricesByDex)) {
    const totalLiquidity = prices.reduce((sum, p) => sum + p.liquidity, 0);
    if (totalLiquidity > 0) {
      result[dex] = prices.reduce(
        (sum, p) => sum + (p.price * p.liquidity) / totalLiquidity,
        0
      );
    }
  }
  
  return result;
}

/**
 * Search for tokens by query
 */
export async function searchDexScreenerTokens(
  query: string
): Promise<DexScreenerPair[]> {
  try {
    const url = `${DEXSCREENER_API_BASE}/dex/search?q=${encodeURIComponent(query)}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json() as DexScreenerResponse;
    return data.pairs || [];
  } catch {
    return [];
  }
}

/**
 * Get pairs by pair address
 */
export async function fetchDexScreenerPair(
  pairAddress: string,
  chain: SupportedChain
): Promise<DexScreenerPair | null> {
  try {
    const chainId = CHAIN_IDS[chain];
    const url = `${DEXSCREENER_API_BASE}/dex/pairs/${chainId}/${pairAddress}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json() as { pair?: DexScreenerPair };
    return data.pair || null;
  } catch {
    return null;
  }
}

export default {
  fetchDexScreenerPrice,
  fetchDexScreenerPools,
  fetchDexScreenerLiquidity,
  fetchDexScreenerTokenData,
  fetchDexScreenerCrossDexPrices,
  searchDexScreenerTokens,
  fetchDexScreenerPair,
};
