/**
 * CoinGecko Price Oracle
 * Fetches token prices from CoinGecko API
 */

import { CHAIN_CONFIG, type SupportedChain } from "../../../config/chains.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import type { PriceSource, CoinGeckoResponse, PRICE_VALIDATION_CONFIG } from "../types.js";

const COINGECKO_API_BASE = "https://api.coingecko.com/api/v3";
const COINGECKO_PRO_API_BASE = "https://pro-api.coingecko.com/api/v3";

// Chain ID to CoinGecko platform mapping
const PLATFORM_IDS: Record<Exclude<SupportedChain, "solana">, string> = {
  ethereum: "ethereum",
  base: "base",
  arbitrum: "arbitrum-one",
  polygon: "polygon-pos",
  bsc: "binance-smart-chain",
  linea: "linea",
  optimism: "optimistic-ethereum",
};

const SOLANA_PLATFORM_ID = "solana";

/**
 * Get API base URL and headers based on whether API key is configured
 */
function getApiConfig(): { baseUrl: string; headers: Record<string, string> } {
  const apiKey = process.env.COINGECKO_API_KEY;
  
  if (apiKey) {
    return {
      baseUrl: COINGECKO_PRO_API_BASE,
      headers: {
        "x-cg-pro-api-key": apiKey,
        "Content-Type": "application/json",
      },
    };
  }
  
  return {
    baseUrl: COINGECKO_API_BASE,
    headers: {
      "Content-Type": "application/json",
    },
  };
}

/**
 * Fetch token price from CoinGecko
 */
export async function fetchCoinGeckoPrice(
  tokenAddress: string,
  chain: SupportedChain
): Promise<PriceSource> {
  const cacheKey = `coingecko:price:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const platformId = chain === "solana" ? SOLANA_PLATFORM_ID : PLATFORM_IDS[chain];
      const { baseUrl, headers } = getApiConfig();
      
      const url = `${baseUrl}/simple/token_price/${platformId}?contract_addresses=${tokenAddress}&vs_currencies=usd&include_24hr_change=true&include_24hr_vol=true`;
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status} ${response.statusText}`);
      }
      
      const data = (await response.json()) as CoinGeckoResponse;
      const tokenData = data[tokenAddress.toLowerCase()];
      
      if (!tokenData || tokenData.usd === undefined) {
        throw new Error(`No price data for token ${tokenAddress} on ${chain}`);
      }
      
      return {
        name: "coingecko",
        price: tokenData.usd,
        confidence: 0.9, // CoinGecko is generally reliable
        timestamp: Date.now(),
      };
    },
    60 // 60 second TTL
  );
}

/**
 * Fetch historical prices from CoinGecko (for anomaly detection)
 */
export async function fetchCoinGeckoHistoricalPrices(
  tokenAddress: string,
  chain: SupportedChain,
  days: number = 7
): Promise<number[]> {
  const cacheKey = `coingecko:history:${chain}:${tokenAddress.toLowerCase()}:${days}d`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const platformId = chain === "solana" ? SOLANA_PLATFORM_ID : PLATFORM_IDS[chain];
      const { baseUrl, headers } = getApiConfig();
      
      const url = `${baseUrl}/coins/${platformId}/contract/${tokenAddress}/market_chart?vs_currency=usd&days=${days}`;
      
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        throw new Error(`CoinGecko history API error: ${response.status}`);
      }
      
      const data = await response.json() as { prices?: [number, number][] };
      
      if (!data.prices || !Array.isArray(data.prices)) {
        throw new Error("Invalid price history data");
      }
      
      // Extract prices from [timestamp, price] tuples
      return data.prices.map((p: [number, number]) => p[1]);
    },
    300 // 5 minute TTL for historical data
  );
}

/**
 * Batch fetch prices for multiple tokens
 */
export async function fetchCoinGeckoBatchPrices(
  tokens: Array<{ address: string; chain: SupportedChain }>
): Promise<Map<string, PriceSource>> {
  const results = new Map<string, PriceSource>();
  
  // Group tokens by chain
  const byChain = new Map<SupportedChain, string[]>();
  for (const token of tokens) {
    const existing = byChain.get(token.chain) || [];
    existing.push(token.address);
    byChain.set(token.chain, existing);
  }
  
  // Fetch prices for each chain
  await Promise.all(
    Array.from(byChain.entries()).map(async ([chain, addresses]) => {
      try {
        const platformId = chain === "solana" ? SOLANA_PLATFORM_ID : PLATFORM_IDS[chain];
        const { baseUrl, headers } = getApiConfig();
        
        // CoinGecko supports up to 100 addresses per request
        const chunks = chunkArray(addresses, 100);
        
        for (const chunk of chunks) {
          const url = `${baseUrl}/simple/token_price/${platformId}?contract_addresses=${chunk.join(",")}&vs_currencies=usd`;
          
          const response = await fetch(url, { headers });
          
          if (!response.ok) continue;
          
          const data = await response.json() as CoinGeckoResponse;
          
          for (const address of chunk) {
            const tokenData = data[address.toLowerCase()];
            if (tokenData?.usd) {
              results.set(`${chain}:${address.toLowerCase()}`, {
                name: "coingecko",
                price: tokenData.usd,
                confidence: 0.9,
                timestamp: Date.now(),
              });
            }
          }
        }
      } catch (error) {
        console.error(`CoinGecko batch fetch error for ${chain}:`, error);
      }
    })
  );
  
  return results;
}

/**
 * Get coin data including market cap and volume
 */
export async function fetchCoinGeckoTokenInfo(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  price: number;
  marketCap: number;
  volume24h: number;
  priceChange24h: number;
}> {
  const platformId = chain === "solana" ? SOLANA_PLATFORM_ID : PLATFORM_IDS[chain];
  const { baseUrl, headers } = getApiConfig();
  
  const url = `${baseUrl}/coins/${platformId}/contract/${tokenAddress}`;
  
  const response = await fetch(url, { headers });
  
  if (!response.ok) {
    throw new Error(`CoinGecko token info error: ${response.status}`);
  }
  
  const data = await response.json() as { market_data?: { current_price?: { usd?: number }; market_cap?: { usd?: number }; total_volume?: { usd?: number }; price_change_percentage_24h?: number } };
  
  return {
    price: data.market_data?.current_price?.usd || 0,
    marketCap: data.market_data?.market_cap?.usd || 0,
    volume24h: data.market_data?.total_volume?.usd || 0,
    priceChange24h: data.market_data?.price_change_percentage_24h || 0,
  };
}

// Utility function to chunk arrays
function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export default {
  fetchCoinGeckoPrice,
  fetchCoinGeckoHistoricalPrices,
  fetchCoinGeckoBatchPrices,
  fetchCoinGeckoTokenInfo,
};
