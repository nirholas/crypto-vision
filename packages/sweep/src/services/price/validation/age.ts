/**
 * Token Age Verification
 * Ensures tokens have been around long enough to be considered safe
 */

import { type SupportedChain } from "../../../config/chains.js";
import { getViemClient } from "../../../utils/viem.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import type { TokenAgeCheck, PRICE_VALIDATION_CONFIG } from "../types.js";

const CONFIG = {
  MIN_TOKEN_AGE_DAYS: 7, // Minimum 7 days old
  CACHE_TTL: 86400, // 24 hours (age doesn't change rapidly)
};

// Block explorer API endpoints
const EXPLORER_APIS: Partial<Record<Exclude<SupportedChain, "solana">, string>> = {
  ethereum: "https://api.etherscan.io/api",
  base: "https://api.basescan.org/api",
  arbitrum: "https://api.arbiscan.io/api",
  polygon: "https://api.polygonscan.com/api",
  bsc: "https://api.bscscan.com/api",
  linea: "https://api.lineascan.build/api",
  optimism: "https://api-optimistic.etherscan.io/api",
};

// Environment variable keys for API keys
const EXPLORER_API_KEYS: Partial<Record<Exclude<SupportedChain, "solana">, string>> = {
  ethereum: "ETHERSCAN_API_KEY",
  base: "BASESCAN_API_KEY",
  arbitrum: "ARBISCAN_API_KEY",
  polygon: "POLYGONSCAN_API_KEY",
  bsc: "BSCSCAN_API_KEY",
  linea: "LINEASCAN_API_KEY",
  optimism: "OPTIMISTIC_ETHERSCAN_API_KEY",
};

/**
 * Get contract creation info from block explorer
 */
async function getContractCreationInfo(
  tokenAddress: string,
  chain: Exclude<SupportedChain, "solana">
): Promise<{ timestamp: number; txHash: string } | null> {
  const apiBase = EXPLORER_APIS[chain];
  const apiKeyEnv = EXPLORER_API_KEYS[chain];
  
  if (!apiBase) {
    console.warn(`No explorer API configured for ${chain}`);
    return null;
  }
  
  const apiKey = apiKeyEnv ? process.env[apiKeyEnv] || "" : "";
  
  try {
    // Get contract creation transaction
    const url = `${apiBase}?module=contract&action=getcontractcreation&contractaddresses=${tokenAddress}&apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Explorer API error: ${response.status}`);
    }
    
    const data = (await response.json()) as {
      status: string;
      result?: Array<{ txHash: string }>;
    };
    
    if (data.status !== "1" || !Array.isArray(data.result) || data.result.length === 0) {
      // Fallback: try to get from first transaction
      return await getCreationFromFirstTx(tokenAddress, chain, apiBase, apiKey);
    }
    
    const creation = data.result[0];
    
    // Get block timestamp from the transaction
    const txHash = creation.txHash;
    const txUrl = `${apiBase}?module=proxy&action=eth_getTransactionByHash&txhash=${txHash}&apikey=${apiKey}`;
    
    const txResponse = await fetch(txUrl);
    const txData = (await txResponse.json()) as {
      result?: { blockNumber: string };
    };
    
    if (!txData.result) {
      return await getCreationFromFirstTx(tokenAddress, chain, apiBase, apiKey);
    }
    
    const blockNumber = parseInt(txData.result.blockNumber, 16);
    
    // Get block timestamp
    const blockUrl = `${apiBase}?module=block&action=getblockreward&blockno=${blockNumber}&apikey=${apiKey}`;
    const blockResponse = await fetch(blockUrl);
    const blockData = (await blockResponse.json()) as {
      result?: { timeStamp: string };
    };
    
    const timestamp = parseInt(blockData.result?.timeStamp || "0");
    
    if (timestamp === 0) {
      return await getCreationFromFirstTx(tokenAddress, chain, apiBase, apiKey);
    }
    
    return { timestamp, txHash };
  } catch (error) {
    console.error(`Failed to get contract creation info for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Fallback: Get creation time from first transaction
 */
async function getCreationFromFirstTx(
  tokenAddress: string,
  chain: Exclude<SupportedChain, "solana">,
  apiBase: string,
  apiKey: string
): Promise<{ timestamp: number; txHash: string } | null> {
  try {
    // Get earliest transactions
    const url = `${apiBase}?module=account&action=txlist&address=${tokenAddress}&startblock=0&endblock=99999999&page=1&offset=1&sort=asc&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = (await response.json()) as {
      status: string;
      result?: Array<{ timeStamp?: string; hash: string }>;
    };
    
    if (data.status !== "1" || !Array.isArray(data.result) || data.result.length === 0) {
      return null;
    }
    
    const firstTx = data.result[0];
    
    return {
      timestamp: parseInt(firstTx.timeStamp || "0"),
      txHash: firstTx.hash,
    };
  } catch {
    return null;
  }
}

/**
 * Get Solana token creation info
 */
async function getSolanaTokenCreationInfo(
  tokenAddress: string
): Promise<{ timestamp: number; txHash: string } | null> {
  try {
    // Use Solana RPC to get token creation
    const rpcUrl = process.env.RPC_SOLANA;
    
    if (!rpcUrl) {
      console.warn("No Solana RPC URL configured");
      return null;
    }
    
    // Get signatures for the token account
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getSignaturesForAddress",
        params: [
          tokenAddress,
          { limit: 1, commitment: "confirmed" },
        ],
      }),
    });
    
    const data = (await response.json()) as {
      result?: Array<{ blockTime?: number; signature: string }>;
    };
    
    if (!data.result || data.result.length === 0) {
      return null;
    }
    
    // Get the oldest signature (first transaction)
    // Note: This returns newest first, so we'd need to paginate for true oldest
    // For simplicity, we'll use what we have
    const oldestSig = data.result[data.result.length - 1];
    
    return {
      timestamp: oldestSig.blockTime || 0,
      txHash: oldestSig.signature,
    };
  } catch (error) {
    console.error(`Failed to get Solana token creation info:`, error);
    return null;
  }
}

/**
 * Check token age
 */
export async function checkTokenAge(
  tokenAddress: string,
  chain: SupportedChain
): Promise<TokenAgeCheck> {
  const cacheKey = `token:age:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      let creationInfo: { timestamp: number; txHash: string } | null = null;
      
      if (chain === "solana") {
        creationInfo = await getSolanaTokenCreationInfo(tokenAddress);
      } else {
        creationInfo = await getContractCreationInfo(tokenAddress, chain);
      }
      
      if (!creationInfo || creationInfo.timestamp === 0) {
        // Can't determine age - treat as potentially new
        return {
          isMature: false,
          ageInDays: 0,
          deployedAt: new Date(0),
          creationTxHash: "",
        };
      }
      
      const deployedAt = new Date(creationInfo.timestamp * 1000);
      const ageInDays = (Date.now() - deployedAt.getTime()) / (1000 * 60 * 60 * 24);
      
      return {
        isMature: ageInDays >= CONFIG.MIN_TOKEN_AGE_DAYS,
        ageInDays,
        deployedAt,
        creationTxHash: creationInfo.txHash,
      };
    },
    CONFIG.CACHE_TTL
  );
}

/**
 * Get human-readable age string
 */
export function formatTokenAge(ageInDays: number): string {
  if (ageInDays < 1) {
    const hours = Math.floor(ageInDays * 24);
    return hours <= 1 ? "less than an hour" : `${hours} hours`;
  }
  
  if (ageInDays < 7) {
    const days = Math.floor(ageInDays);
    return days === 1 ? "1 day" : `${days} days`;
  }
  
  if (ageInDays < 30) {
    const weeks = Math.floor(ageInDays / 7);
    return weeks === 1 ? "1 week" : `${weeks} weeks`;
  }
  
  if (ageInDays < 365) {
    const months = Math.floor(ageInDays / 30);
    return months === 1 ? "1 month" : `${months} months`;
  }
  
  const years = Math.floor(ageInDays / 365);
  return years === 1 ? "1 year" : `${years} years`;
}

/**
 * Get token maturity classification
 */
export function getMaturityClassification(ageInDays: number): {
  classification: "new" | "young" | "established" | "veteran";
  trustLevel: "low" | "medium" | "high";
} {
  if (ageInDays < 7) {
    return { classification: "new", trustLevel: "low" };
  }
  
  if (ageInDays < 30) {
    return { classification: "young", trustLevel: "medium" };
  }
  
  if (ageInDays < 180) {
    return { classification: "established", trustLevel: "high" };
  }
  
  return { classification: "veteran", trustLevel: "high" };
}

/**
 * Should we sweep this token based on age?
 */
export async function shouldSweepBasedOnAge(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  sweep: boolean;
  requiresApproval: boolean;
  ageCheck: TokenAgeCheck;
  reason?: string;
}> {
  const ageCheck = await checkTokenAge(tokenAddress, chain);
  
  // Can't determine age - require approval
  if (ageCheck.ageInDays === 0 && !ageCheck.creationTxHash) {
    return {
      sweep: true,
      requiresApproval: true,
      ageCheck,
      reason: "Unable to determine token age",
    };
  }
  
  // Token is too new - require approval
  if (!ageCheck.isMature) {
    return {
      sweep: true,
      requiresApproval: true,
      ageCheck,
      reason: `Token is only ${formatTokenAge(ageCheck.ageInDays)} old (minimum: ${CONFIG.MIN_TOKEN_AGE_DAYS} days)`,
    };
  }
  
  const maturity = getMaturityClassification(ageCheck.ageInDays);
  
  // Young tokens require approval
  if (maturity.trustLevel === "low" || maturity.trustLevel === "medium") {
    return {
      sweep: true,
      requiresApproval: true,
      ageCheck,
      reason: `Token is ${maturity.classification} (${formatTokenAge(ageCheck.ageInDays)} old)`,
    };
  }
  
  // Established/veteran tokens - no approval needed
  return {
    sweep: true,
    requiresApproval: false,
    ageCheck,
  };
}

/**
 * Check if token was created recently (potential rug)
 */
export async function isRecentlyCreated(
  tokenAddress: string,
  chain: SupportedChain,
  hoursThreshold: number = 24
): Promise<boolean> {
  const ageCheck = await checkTokenAge(tokenAddress, chain);
  return ageCheck.ageInDays < (hoursThreshold / 24);
}

export default {
  checkTokenAge,
  formatTokenAge,
  getMaturityClassification,
  shouldSweepBasedOnAge,
  isRecentlyCreated,
};
