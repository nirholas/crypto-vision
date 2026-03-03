/**
 * Chainlink On-Chain Price Oracle
 * Fetches prices directly from Chainlink price feeds on-chain
 */

import { type SupportedChain } from "../../../config/chains.js";
import { getViemClient } from "../../../utils/viem.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import type { OraclePrice, ChainlinkFeedConfig } from "../types.js";

// Chainlink Aggregator V3 ABI (minimal)
const CHAINLINK_AGGREGATOR_ABI = [
  {
    inputs: [],
    name: "latestRoundData",
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "description",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Chainlink Feed Registry ABI
const FEED_REGISTRY_ABI = [
  {
    inputs: [
      { name: "base", type: "address" },
      { name: "quote", type: "address" },
    ],
    name: "getFeed",
    outputs: [{ name: "aggregator", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "base", type: "address" },
      { name: "quote", type: "address" },
    ],
    name: "latestRoundData",
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;

// Chainlink Feed Registry (Ethereum mainnet only)
const FEED_REGISTRY_ADDRESS = "0x47Fb2585D2C56Fe188D0E6ec628a38b74fCeeeDf" as const;

// USD quote address (for Feed Registry)
const USD_QUOTE = "0x0000000000000000000000000000000000000348" as const;

// Known Chainlink price feeds per chain
// These are direct feeds, not via registry
const CHAINLINK_FEEDS: Partial<Record<Exclude<SupportedChain, "solana">, Record<string, ChainlinkFeedConfig>>> = {
  ethereum: {
    // Major tokens on Ethereum
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2": { feedAddress: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419", decimals: 8 }, // WETH/USD
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48": { feedAddress: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6", decimals: 8 }, // USDC/USD
    "0xdAC17F958D2ee523a2206206994597C13D831ec7": { feedAddress: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D", decimals: 8 }, // USDT/USD
    "0x6B175474E89094C44Da98b954EesfdKAD3eF3eBF": { feedAddress: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9", decimals: 8 }, // DAI/USD
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599": { feedAddress: "0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c", decimals: 8 }, // WBTC/USD
    "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0": { feedAddress: "0x164b276057258d81941e97B0a900D4C7B358bCe0", decimals: 8 }, // wstETH/USD
    "0xae78736Cd615f374D3085123A210448E74Fc6393": { feedAddress: "0x536218f9E9Eb48863970252233c8F271f554C2d0", decimals: 8 }, // rETH/USD
  },
  base: {
    "0x4200000000000000000000000000000000000006": { feedAddress: "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70", decimals: 8 }, // WETH/USD
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": { feedAddress: "0x7e860098F58bBFC8648a4311b374B1D669a2bc6B", decimals: 8 }, // USDC/USD
    "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22": { feedAddress: "0xd7818272B9e248357d13057AAb0B417aF31E817d", decimals: 8 }, // cbETH/USD
  },
  arbitrum: {
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1": { feedAddress: "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612", decimals: 8 }, // WETH/USD
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": { feedAddress: "0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3", decimals: 8 }, // USDC/USD
    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9": { feedAddress: "0x3f3f5dF88dC9F13eac63DF89EC16ef6e7E25DdE7", decimals: 8 }, // USDT/USD
    "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f": { feedAddress: "0xd0C7101eACbB49F3deCcCc166d238410D6D46d57", decimals: 8 }, // WBTC/USD
    "0x912CE59144191C1204E64559FE8253a0e49E6548": { feedAddress: "0xb2A824043730FE05F3DA2efaFa1CBbe83fa548D6", decimals: 8 }, // ARB/USD
  },
  polygon: {
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619": { feedAddress: "0xF9680D99D6C9589e2a93a78A04A279e509205945", decimals: 8 }, // WETH/USD
    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359": { feedAddress: "0xfE4A8cc5b5B2366C1B58Bea3858e81843581b2F7", decimals: 8 }, // USDC/USD
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F": { feedAddress: "0x0A6513e40db6EB1b165753AD52E80663aeA50545", decimals: 8 }, // USDT/USD
    "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6": { feedAddress: "0xDE31F8bFBD8c84b5360CFACCa3539B938dd78ae6", decimals: 8 }, // WBTC/USD
    "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270": { feedAddress: "0xAB594600376Ec9fD91F8e885dADF0CE036862dE0", decimals: 8 }, // WMATIC/USD
  },
  bsc: {
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c": { feedAddress: "0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE", decimals: 8 }, // WBNB/USD
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d": { feedAddress: "0x51597f405303C4377E36123cBc172b13269EA163", decimals: 8 }, // USDC/USD
    "0x55d398326f99059fF775485246999027B3197955": { feedAddress: "0xB97Ad0E74fa7d920791E90258A6E2085088b4320", decimals: 8 }, // USDT/USD
    "0x2170Ed0880ac9A755fd29B2688956BD959F933F8": { feedAddress: "0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e", decimals: 8 }, // ETH/USD
  },
  linea: {
    "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f": { feedAddress: "0x3c6Cd9Cc7c7a4c2Cf5a82734CD249D7D593354dA", decimals: 8 }, // WETH/USD
  },
  optimism: {
    "0x4200000000000000000000000000000000000006": { feedAddress: "0x13e3Ee699D1909E989722E753853AE30b17e08c5", decimals: 8 }, // WETH/USD
    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85": { feedAddress: "0x16a9FA2FDa030272Ce99B29CF780dFA30361E0f3", decimals: 8 }, // USDC/USD
    "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58": { feedAddress: "0xECef79E109e997bCA29c1c0897ec9d7678E1cC8C", decimals: 8 }, // USDT/USD
  },
};

/**
 * Get Chainlink price feed address for a token
 */
export function getChainlinkFeedAddress(
  tokenAddress: string,
  chain: Exclude<SupportedChain, "solana">
): ChainlinkFeedConfig | null {
  const chainFeeds = CHAINLINK_FEEDS[chain];
  if (!chainFeeds) return null;
  
  return chainFeeds[tokenAddress] || null;
}

/**
 * Fetch price directly from Chainlink feed
 */
export async function fetchChainlinkPrice(
  tokenAddress: string,
  chain: Exclude<SupportedChain, "solana">
): Promise<OraclePrice | null> {
  const cacheKey = `chainlink:price:${chain}:${tokenAddress.toLowerCase()}`;
  
  try {
    return await cacheGetOrFetch(
      cacheKey,
      async () => {
        const feedConfig = getChainlinkFeedAddress(tokenAddress, chain);
        
        if (!feedConfig) {
          // Try Feed Registry on Ethereum
          if (chain === "ethereum") {
            return await fetchFromRegistry(tokenAddress);
          }
          return null;
        }
        
        const client = getViemClient(chain);
        
        const [roundData, decimals] = await Promise.all([
          client.readContract({
            address: feedConfig.feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "latestRoundData",
          }),
          client.readContract({
            address: feedConfig.feedAddress,
            abi: CHAINLINK_AGGREGATOR_ABI,
            functionName: "decimals",
          }),
        ]);
        
        const [, answer, , updatedAt] = roundData;
        
        // Check if the price is stale (older than 1 hour)
        const now = Math.floor(Date.now() / 1000);
        if (now - Number(updatedAt) > 3600) {
          console.warn(`Chainlink price for ${tokenAddress} is stale`);
        }
        
        const price = Number(answer) / Math.pow(10, decimals);
        
        return {
          price,
          decimals,
          timestamp: Number(updatedAt) * 1000,
          source: "chainlink",
        };
      },
      60 // 60 second TTL
    );
  } catch (error) {
    console.error(`Chainlink price fetch error for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Fetch price from Chainlink Feed Registry (Ethereum only)
 */
async function fetchFromRegistry(
  tokenAddress: string
): Promise<OraclePrice | null> {
  try {
    const client = getViemClient("ethereum");
    
    const roundData = await client.readContract({
      address: FEED_REGISTRY_ADDRESS,
      abi: FEED_REGISTRY_ABI,
      functionName: "latestRoundData",
      args: [tokenAddress as `0x${string}`, USD_QUOTE],
    });
    
    const [, answer, , updatedAt] = roundData;
    
    // Feed Registry always uses 8 decimals for USD quotes
    const price = Number(answer) / 1e8;
    
    return {
      price,
      decimals: 8,
      timestamp: Number(updatedAt) * 1000,
      source: "chainlink-registry",
    };
  } catch {
    // Token not found in registry
    return null;
  }
}

/**
 * Check if a token has a Chainlink price feed
 */
export function hasChainlinkFeed(
  tokenAddress: string,
  chain: SupportedChain
): boolean {
  if (chain === "solana") return false;
  return getChainlinkFeedAddress(tokenAddress, chain) !== null;
}

/**
 * Get all supported tokens with Chainlink feeds for a chain
 */
export function getChainlinkSupportedTokens(
  chain: Exclude<SupportedChain, "solana">
): string[] {
  const chainFeeds = CHAINLINK_FEEDS[chain];
  if (!chainFeeds) return [];
  return Object.keys(chainFeeds);
}

/**
 * Batch fetch Chainlink prices for multiple tokens
 */
export async function fetchChainlinkBatchPrices(
  tokens: Array<{ address: string; chain: Exclude<SupportedChain, "solana"> }>
): Promise<Map<string, OraclePrice>> {
  const results = new Map<string, OraclePrice>();
  
  await Promise.all(
    tokens.map(async ({ address, chain }) => {
      const price = await fetchChainlinkPrice(address, chain);
      if (price) {
        results.set(`${chain}:${address.toLowerCase()}`, price);
      }
    })
  );
  
  return results;
}

export default {
  fetchChainlinkPrice,
  getChainlinkFeedAddress,
  hasChainlinkFeed,
  getChainlinkSupportedTokens,
  fetchChainlinkBatchPrices,
};
