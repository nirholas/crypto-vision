/**
 * Token Whitelist/Blacklist/Graylist Management
 * Manages token safety status for the price service
 */

import { type SupportedChain } from "../../config/chains.js";
import { getRedis, cacheGetOrFetch } from "../../utils/redis.js";
import type { ListStatus, TokenListEntry } from "./types.js";

const CONFIG = {
  REDIS_KEY_PREFIX: "token:list",
  CACHE_TTL: 3600, // 1 hour
};

// ============================================================================
// Hardcoded Whitelisted Tokens (Major tokens with reliable pricing)
// ============================================================================

const WHITELISTED_TOKENS: Record<SupportedChain, Set<string>> = {
  ethereum: new Set([
    // Stablecoins
    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC
    "0xdAC17F958D2ee523a2206206994597C13D831ec7", // USDT
    "0x6B175474E89094C44Da98b954EesfdKAD3eF3eBF", // DAI
    "0x4Fabb145d64652a948d72533023f6E7A623C7C53", // BUSD
    // Major tokens
    "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
    "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", // WBTC
    "0x514910771AF9Ca656af840dff83E8264EcF986CA", // LINK
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", // UNI
    "0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9", // AAVE
    // Liquid staking
    "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0", // wstETH
    "0xae78736Cd615f374D3085123A210448E74Fc6393", // rETH
    "0xBe9895146f7AF43049ca1c1AE358B0541Ea49704", // cbETH
  ].map(a => a.toLowerCase())),
  
  base: new Set([
    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC
    "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // USDT
    "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", // DAI
    "0x4200000000000000000000000000000000000006", // WETH
    "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452", // wstETH
    "0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22", // cbETH
    "0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf", // cbBTC
  ].map(a => a.toLowerCase())),
  
  arbitrum: new Set([
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // USDC
    "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8", // USDC.e
    "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // USDT
    "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // DAI
    "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // WETH
    "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // WBTC
    "0x912CE59144191C1204E64559FE8253a0e49E6548", // ARB
    "0x5979D7b546E38E414F7E9822514be443A4800529", // wstETH
  ].map(a => a.toLowerCase())),
  
  polygon: new Set([
    "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", // USDC
    "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC.e
    "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
    "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", // DAI
    "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
    "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", // WBTC
    "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
    "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39", // LINK
  ].map(a => a.toLowerCase())),
  
  bsc: new Set([
    "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // USDC
    "0x55d398326f99059fF775485246999027B3197955", // USDT
    "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", // DAI
    "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
    "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", // ETH
    "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", // WBTC
    "0xF8A0BF9cF54Bb92F17374d9e9A321E6a111a51bD", // LINK
  ].map(a => a.toLowerCase())),
  
  linea: new Set([
    "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", // USDC
    "0xA219439258ca9da29E9Cc4cE5596924745e12B93", // USDT
    "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5", // DAI
    "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f", // WETH
    "0xB5beDd42000b71FddE22D3eE8a79Bd49A568fC8F", // wstETH
    "0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4", // WBTC
  ].map(a => a.toLowerCase())),
  
  optimism: new Set([
    "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // USDC
    "0x7F5c764cBc14f9669B88837ca1490cCa17c31607", // USDC.e
    "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // USDT
    "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", // DAI
    "0x4200000000000000000000000000000000000006", // WETH
    "0x68f180fcCe6836688e9084f035309E29Bf0A2095", // WBTC
    "0x4200000000000000000000000000000000000042", // OP
    "0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb", // wstETH
  ].map(a => a.toLowerCase())),
  
  solana: new Set([
    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    "So11111111111111111111111111111111111111112", // Wrapped SOL
    "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj", // stSOL
    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // mSOL
    "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn", // JitoSOL
    "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263", // BONK
  ]),
};

// ============================================================================
// Blacklisted Tokens (Known scams, honeypots, dangerous tokens)
// ============================================================================

const BLACKLISTED_TOKENS: Record<SupportedChain, Set<string>> = {
  ethereum: new Set([
    // Add known scam token addresses here
  ].map(a => a.toLowerCase())),
  base: new Set([]),
  arbitrum: new Set([]),
  polygon: new Set([]),
  bsc: new Set([]),
  linea: new Set([]),
  optimism: new Set([]),
  solana: new Set([]),
};

// ============================================================================
// Patterns that indicate graylist tokens (need review)
// ============================================================================

const GRAYLIST_PATTERNS = [
  /rebase/i,
  /elastic/i,
  /reflect/i,
  /safemoon/i,
  /moon/i,
  /shib/i,
  /doge/i,
  /pepe/i,
  /floki/i,
  /baby/i,
  /mini/i,
  /elon/i,
  /safe/i,
  /rocket/i,
  /gem/i,
  /100x/i,
  /1000x/i,
  /inu/i,
];

// ============================================================================
// Functions
// ============================================================================

/**
 * Check if token matches graylist patterns
 */
function matchesGraylistPattern(tokenSymbol: string, tokenName?: string): boolean {
  const textToCheck = `${tokenSymbol} ${tokenName || ""}`.toLowerCase();
  return GRAYLIST_PATTERNS.some(pattern => pattern.test(textToCheck));
}

/**
 * Get token list status from hardcoded lists
 */
function getHardcodedStatus(
  tokenAddress: string,
  chain: SupportedChain
): ListStatus | null {
  const normalizedAddress = chain === "solana" 
    ? tokenAddress 
    : tokenAddress.toLowerCase();
  
  if (BLACKLISTED_TOKENS[chain]?.has(normalizedAddress)) {
    return "BLACKLIST";
  }
  
  if (WHITELISTED_TOKENS[chain]?.has(normalizedAddress)) {
    return "WHITELIST";
  }
  
  return null;
}

/**
 * Get token list status from Redis
 */
async function getRedisStatus(
  tokenAddress: string,
  chain: SupportedChain
): Promise<ListStatus | null> {
  const redis = getRedis();
  const key = `${CONFIG.REDIS_KEY_PREFIX}:${chain}:${tokenAddress.toLowerCase()}`;
  
  const status = await redis.get(key);
  
  if (status === "WHITELIST" || status === "BLACKLIST" || status === "GRAYLIST") {
    return status as ListStatus;
  }
  
  return null;
}

/**
 * Get token sweep status
 */
export async function getTokenSweepStatus(
  tokenAddress: string,
  chain: SupportedChain,
  tokenSymbol?: string,
  tokenName?: string
): Promise<ListStatus> {
  // Check hardcoded lists first
  const hardcodedStatus = getHardcodedStatus(tokenAddress, chain);
  if (hardcodedStatus) {
    return hardcodedStatus;
  }
  
  // Check Redis for dynamic list
  const redisStatus = await getRedisStatus(tokenAddress, chain);
  if (redisStatus) {
    return redisStatus;
  }
  
  // Check graylist patterns
  if (tokenSymbol && matchesGraylistPattern(tokenSymbol, tokenName)) {
    return "GRAYLIST";
  }
  
  return "UNKNOWN";
}

/**
 * Add token to whitelist
 */
export async function whitelistToken(
  tokenAddress: string,
  chain: SupportedChain,
  reason?: string,
  addedBy?: string
): Promise<void> {
  const redis = getRedis();
  const key = `${CONFIG.REDIS_KEY_PREFIX}:${chain}:${tokenAddress.toLowerCase()}`;
  
  const entry: TokenListEntry = {
    address: tokenAddress,
    chain,
    status: "WHITELIST",
    reason,
    addedAt: new Date(),
    addedBy,
  };
  
  await redis.set(key, "WHITELIST");
  await redis.set(`${key}:meta`, JSON.stringify(entry));
}

/**
 * Add token to blacklist
 */
export async function blacklistToken(
  tokenAddress: string,
  chain: SupportedChain,
  reason?: string,
  addedBy?: string
): Promise<void> {
  const redis = getRedis();
  const key = `${CONFIG.REDIS_KEY_PREFIX}:${chain}:${tokenAddress.toLowerCase()}`;
  
  const entry: TokenListEntry = {
    address: tokenAddress,
    chain,
    status: "BLACKLIST",
    reason,
    addedAt: new Date(),
    addedBy,
  };
  
  await redis.set(key, "BLACKLIST");
  await redis.set(`${key}:meta`, JSON.stringify(entry));
}

/**
 * Add token to graylist
 */
export async function graylistToken(
  tokenAddress: string,
  chain: SupportedChain,
  reason?: string,
  addedBy?: string
): Promise<void> {
  const redis = getRedis();
  const key = `${CONFIG.REDIS_KEY_PREFIX}:${chain}:${tokenAddress.toLowerCase()}`;
  
  const entry: TokenListEntry = {
    address: tokenAddress,
    chain,
    status: "GRAYLIST",
    reason,
    addedAt: new Date(),
    addedBy,
  };
  
  await redis.set(key, "GRAYLIST");
  await redis.set(`${key}:meta`, JSON.stringify(entry));
}

/**
 * Remove token from all lists (reset to UNKNOWN)
 */
export async function removeFromList(
  tokenAddress: string,
  chain: SupportedChain
): Promise<void> {
  const redis = getRedis();
  const key = `${CONFIG.REDIS_KEY_PREFIX}:${chain}:${tokenAddress.toLowerCase()}`;
  
  await redis.del(key);
  await redis.del(`${key}:meta`);
}

/**
 * Get token list entry with metadata
 */
export async function getTokenListEntry(
  tokenAddress: string,
  chain: SupportedChain
): Promise<TokenListEntry | null> {
  const status = await getTokenSweepStatus(tokenAddress, chain);
  
  if (status === "UNKNOWN") {
    return null;
  }
  
  // Try to get metadata from Redis
  const redis = getRedis();
  const key = `${CONFIG.REDIS_KEY_PREFIX}:${chain}:${tokenAddress.toLowerCase()}:meta`;
  const meta = await redis.get(key);
  
  if (meta) {
    try {
      return JSON.parse(meta) as TokenListEntry;
    } catch {
      // Invalid JSON
    }
  }
  
  // Return basic entry
  return {
    address: tokenAddress,
    chain,
    status,
    addedAt: new Date(0), // Unknown
  };
}

/**
 * Check if token is safe to sweep automatically
 */
export async function isAutoSweepSafe(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  safe: boolean;
  status: ListStatus;
  reason?: string;
}> {
  const status = await getTokenSweepStatus(tokenAddress, chain);
  
  switch (status) {
    case "WHITELIST":
      return { safe: true, status };
    
    case "BLACKLIST":
      return { 
        safe: false, 
        status, 
        reason: "Token is blacklisted" 
      };
    
    case "GRAYLIST":
      return { 
        safe: false, 
        status, 
        reason: "Token requires manual review" 
      };
    
    case "UNKNOWN":
    default:
      return { 
        safe: false, 
        status, 
        reason: "Token is not on whitelist" 
      };
  }
}

/**
 * Get all whitelisted tokens for a chain
 */
export function getWhitelistedTokens(chain: SupportedChain): string[] {
  return Array.from(WHITELISTED_TOKENS[chain] || []);
}

/**
 * Get all blacklisted tokens for a chain
 */
export function getBlacklistedTokens(chain: SupportedChain): string[] {
  return Array.from(BLACKLISTED_TOKENS[chain] || []);
}

/**
 * Check if token is a known stablecoin
 */
export function isStablecoin(
  tokenAddress: string,
  chain: SupportedChain
): boolean {
  const stablecoins: Record<SupportedChain, Set<string>> = {
    ethereum: new Set([
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      "0x6B175474E89094C44Da98b954EesfdKAD3eF3eBF",
    ].map(a => a.toLowerCase())),
    base: new Set([
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb",
    ].map(a => a.toLowerCase())),
    arbitrum: new Set([
      "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
      "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
      "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    ].map(a => a.toLowerCase())),
    polygon: new Set([
      "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    ].map(a => a.toLowerCase())),
    bsc: new Set([
      "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      "0x55d398326f99059fF775485246999027B3197955",
      "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3",
    ].map(a => a.toLowerCase())),
    linea: new Set([
      "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
      "0xA219439258ca9da29E9Cc4cE5596924745e12B93",
      "0x4AF15ec2A0BD43Db75dd04E62FAA3B8EF36b00d5",
    ].map(a => a.toLowerCase())),
    optimism: new Set([
      "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
      "0x7F5c764cBc14f9669B88837ca1490cCa17c31607",
      "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
      "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    ].map(a => a.toLowerCase())),
    solana: new Set([
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    ]),
  };
  
  const normalizedAddress = chain === "solana" 
    ? tokenAddress 
    : tokenAddress.toLowerCase();
  
  return stablecoins[chain]?.has(normalizedAddress) || false;
}

export default {
  getTokenSweepStatus,
  whitelistToken,
  blacklistToken,
  graylistToken,
  removeFromList,
  getTokenListEntry,
  isAutoSweepSafe,
  getWhitelistedTokens,
  getBlacklistedTokens,
  isStablecoin,
};
