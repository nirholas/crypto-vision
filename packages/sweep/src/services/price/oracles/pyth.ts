/**
 * Pyth Network On-Chain Price Oracle
 * Fetches prices from Pyth Network price feeds
 */

import { type SupportedChain } from "../../../config/chains.js";
import { getViemClient } from "../../../utils/viem.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import type { OraclePrice, PythPriceId } from "../types.js";

// Pyth Network contract addresses
const PYTH_CONTRACT_ADDRESSES: Partial<Record<Exclude<SupportedChain, "solana">, `0x${string}`>> = {
  ethereum: "0x4305FB66699C3B2702D4d05CF36551390A4c69C6",
  base: "0x8250f4aF4B972684F7b336503E2D6dFeDeB1487a",
  arbitrum: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  polygon: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
  bsc: "0x4D7E825f80bDf85e913E0DD2A2D54927e9dE1594",
  linea: "0xA2aa501b19aff244D90cc15a4Cf739D2725B5729",
  optimism: "0xff1a0f4744e8582DF1aE09D5611b887B6a12925C",
};

// Pyth Hermes API for off-chain price updates
const PYTH_HERMES_API = "https://hermes.pyth.network/api";

// Pyth price IDs for common tokens
// Format: bytes32 price feed ID
const PYTH_PRICE_IDS: Record<string, PythPriceId> = {
  // ETH
  ETH: { priceId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
  WETH: { priceId: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" },
  
  // BTC
  BTC: { priceId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
  WBTC: { priceId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43" },
  
  // Stablecoins
  USDC: { priceId: "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a" },
  USDT: { priceId: "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b" },
  DAI: { priceId: "0xb0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd" },
  
  // Other major tokens
  BNB: { priceId: "0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f" },
  MATIC: { priceId: "0x5de33440a167ff7d0f9bb65fb8e08fa8d5d6f5c0f1a5f5f5f5f5f5f5f5f5f5f5" },
  SOL: { priceId: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" },
  ARB: { priceId: "0x3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5" },
  OP: { priceId: "0x385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf" },
  
  // Liquid staking
  stETH: { priceId: "0x846ae1bdb6300b817cee5fdee2a6da192775030db5615b94a465f53bd40850b5" },
  wstETH: { priceId: "0x6df640f3b8963d8f8358f791f352b8364513f6ab1cca5ed3f1f7b5448980e784" },
  rETH: { priceId: "0xa0255134973f4fdf2f8f7f7f0e00b9e2c2e9e2e2f2f2f2f2f2f2f2f2f2f2f2f" },
  cbETH: { priceId: "0x15ecddd26d49e1a8f1de9376ebebc03916ede873447c1255d2d5891b92ce5717" },
};

// Token address to symbol mapping for major tokens
const TOKEN_SYMBOLS: Partial<Record<Exclude<SupportedChain, "solana">, Record<string, string>>> = {
  ethereum: {
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": "WETH",
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": "USDC",
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": "USDT",
    "0x6B175474E89094C44Da98b954EesfdKAD3eF3eBF": "DAI",
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": "WBTC",
    "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0": "wstETH",
    "0xae78736Cd615f374D3085123A210448E74Fc6393": "rETH",
  },
  base: {
    "0x4200000000000000000000000000000000000006": "WETH",
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": "USDC",
    "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22": "cbETH",
  },
  arbitrum: {
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1": "WETH",
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": "USDC",
    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9": "USDT",
    "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f": "WBTC",
    "0x912CE59144191C1204E64559FE8253a0e49E6548": "ARB",
  },
  polygon: {
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619": "WETH",
    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359": "USDC",
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F": "USDT",
    "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6": "WBTC",
    "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270": "MATIC",
  },
  bsc: {
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c": "BNB",
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d": "USDC",
    "0x55d398326f99059fF775485246999027B3197955": "USDT",
    "0x2170Ed0880ac9A755fd29B2688956BD959F933F8": "ETH",
  },
};

// Pyth contract ABI (minimal)
const PYTH_ABI = [
  {
    inputs: [{ name: "id", type: "bytes32" }],
    name: "getPrice",
    outputs: [
      {
        components: [
          { name: "price", type: "int64" },
          { name: "conf", type: "uint64" },
          { name: "expo", type: "int32" },
          { name: "publishTime", type: "uint256" },
        ],
        name: "price",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "id", type: "bytes32" }],
    name: "getPriceUnsafe",
    outputs: [
      {
        components: [
          { name: "price", type: "int64" },
          { name: "conf", type: "uint64" },
          { name: "expo", type: "int32" },
          { name: "publishTime", type: "uint256" },
        ],
        name: "price",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

/**
 * Get Pyth price ID for a token
 */
function getPythPriceId(
  tokenAddress: string,
  chain: Exclude<SupportedChain, "solana">
): string | null {
  const chainSymbols = TOKEN_SYMBOLS[chain];
  if (!chainSymbols) return null;
  
  const symbol = chainSymbols[tokenAddress];
  if (!symbol) return null;
  
  return PYTH_PRICE_IDS[symbol]?.priceId || null;
}

/**
 * Fetch price from Pyth on-chain contract
 */
export async function fetchPythPrice(
  tokenAddress: string,
  chain: Exclude<SupportedChain, "solana">
): Promise<OraclePrice | null> {
  const cacheKey = `pyth:price:${chain}:${tokenAddress.toLowerCase()}`;
  
  try {
    return await cacheGetOrFetch(
      cacheKey,
      async () => {
        const priceId = getPythPriceId(tokenAddress, chain);
        if (!priceId) return null;
        
        const contractAddress = PYTH_CONTRACT_ADDRESSES[chain];
        if (!contractAddress) return null;
        
        const client = getViemClient(chain);
        
        // Use getPriceUnsafe for latest price (getPrice requires fresh update)
        const priceData = await client.readContract({
          address: contractAddress,
          abi: PYTH_ABI,
          functionName: "getPriceUnsafe",
          args: [priceId as `0x${string}`],
        });
        
        const { price, expo, publishTime } = priceData;
        
        // Convert price considering exponent (usually negative, e.g., -8)
        const normalizedPrice = Number(price) * Math.pow(10, expo);
        
        // Check if price is stale (older than 1 hour)
        const now = Math.floor(Date.now() / 1000);
        if (now - Number(publishTime) > 3600) {
          console.warn(`Pyth price for ${tokenAddress} is stale`);
        }
        
        return {
          price: normalizedPrice,
          decimals: Math.abs(expo),
          timestamp: Number(publishTime) * 1000,
          source: "pyth",
        };
      },
      60 // 60 second TTL
    );
  } catch (error) {
    console.error(`Pyth price fetch error for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Fetch price from Pyth Hermes API (off-chain, more up-to-date)
 */
export async function fetchPythHermesPrice(
  tokenAddress: string,
  chain: Exclude<SupportedChain, "solana">
): Promise<OraclePrice | null> {
  try {
    const priceId = getPythPriceId(tokenAddress, chain);
    if (!priceId) return null;
    
    // Remove 0x prefix for API call
    const cleanPriceId = priceId.slice(2);
    const url = `${PYTH_HERMES_API}/latest_price_feeds?ids[]=${cleanPriceId}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Pyth Hermes API error: ${response.status}`);
    }
    
    const data = await response.json() as Array<{ id: string; price?: { price?: string; expo?: number; publish_time?: number } }>;
    
    if (!data || data.length === 0) {
      return null;
    }
    
    const priceFeed = data[0];
    const price = priceFeed.price?.price;
    const expo = priceFeed.price?.expo;
    const publishTime = priceFeed.price?.publish_time;
    
    if (!price || expo === undefined || publishTime === undefined) {
      return null;
    }
    
    const normalizedPrice = Number(price) * Math.pow(10, expo);
    
    return {
      price: normalizedPrice,
      decimals: Math.abs(expo),
      timestamp: publishTime * 1000,
      source: "pyth-hermes",
    };
  } catch (error) {
    console.error(`Pyth Hermes price fetch error:`, error);
    return null;
  }
}

/**
 * Check if a token has a Pyth price feed
 */
export function hasPythFeed(
  tokenAddress: string,
  chain: SupportedChain
): boolean {
  if (chain === "solana") return false;
  return getPythPriceId(tokenAddress, chain) !== null;
}

/**
 * Get all supported tokens with Pyth feeds for a chain
 */
export function getPythSupportedTokens(
  chain: Exclude<SupportedChain, "solana">
): string[] {
  const chainSymbols = TOKEN_SYMBOLS[chain];
  if (!chainSymbols) return [];
  
  return Object.entries(chainSymbols)
    .filter(([, symbol]) => PYTH_PRICE_IDS[symbol] !== undefined)
    .map(([address]) => address);
}

/**
 * Batch fetch Pyth prices for multiple tokens
 */
export async function fetchPythBatchPrices(
  tokens: Array<{ address: string; chain: Exclude<SupportedChain, "solana"> }>
): Promise<Map<string, OraclePrice>> {
  const results = new Map<string, OraclePrice>();
  
  // Collect all price IDs
  const priceIdToToken = new Map<string, { address: string; chain: Exclude<SupportedChain, "solana"> }>();
  
  for (const token of tokens) {
    const priceId = getPythPriceId(token.address, token.chain);
    if (priceId) {
      priceIdToToken.set(priceId.slice(2), token);
    }
  }
  
  if (priceIdToToken.size === 0) return results;
  
  try {
    // Fetch all prices in one API call
    const ids = Array.from(priceIdToToken.keys()).map(id => `ids[]=${id}`).join("&");
    const url = `${PYTH_HERMES_API}/latest_price_feeds?${ids}`;
    
    const response = await fetch(url);
    if (!response.ok) return results;
    
    const data = await response.json() as Array<{ id: string; price?: { price?: string; expo?: number; publish_time?: number } }>;
    
    for (const priceFeed of data) {
      const priceId = priceFeed.id;
      const token = priceIdToToken.get(priceId);
      
      if (token && priceFeed.price?.price && priceFeed.price.expo !== undefined && priceFeed.price.publish_time !== undefined) {
        const expo = priceFeed.price.expo;
        const normalizedPrice = Number(priceFeed.price.price) * Math.pow(10, expo);
        
        results.set(`${token.chain}:${token.address.toLowerCase()}`, {
          price: normalizedPrice,
          decimals: Math.abs(expo),
          timestamp: priceFeed.price.publish_time * 1000,
          source: "pyth-hermes",
        });
      }
    }
  } catch (error) {
    console.error("Pyth batch fetch error:", error);
  }
  
  return results;
}

export default {
  fetchPythPrice,
  fetchPythHermesPrice,
  hasPythFeed,
  getPythSupportedTokens,
  fetchPythBatchPrices,
};
