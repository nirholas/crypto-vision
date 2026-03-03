/**
 * Token Holder Distribution Analysis
 * Checks for concentration risk in token holders
 */

import { type SupportedChain } from "../../../config/chains.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import type { HolderDistribution, TokenHolder, PRICE_VALIDATION_CONFIG } from "../types.js";

const CONFIG = {
  MAX_TOP_HOLDER_CONCENTRATION: 0.80, // Top 10 shouldn't hold >80%
  CACHE_TTL: 3600, // 1 hour
};

// Block explorer API endpoints
const EXPLORER_APIS: Partial<Record<SupportedChain, string>> = {
  ethereum: "https://api.etherscan.io/api",
  base: "https://api.basescan.org/api",
  arbitrum: "https://api.arbiscan.io/api",
  polygon: "https://api.polygonscan.com/api",
  bsc: "https://api.bscscan.com/api",
  linea: "https://api.lineascan.build/api",
  optimism: "https://api-optimistic.etherscan.io/api",
};

// Environment variable keys for API keys
const EXPLORER_API_KEYS: Partial<Record<SupportedChain, string>> = {
  ethereum: "ETHERSCAN_API_KEY",
  base: "BASESCAN_API_KEY",
  arbitrum: "ARBISCAN_API_KEY",
  polygon: "POLYGONSCAN_API_KEY",
  bsc: "BSCSCAN_API_KEY",
  linea: "LINEASCAN_API_KEY",
  optimism: "OPTIMISTIC_ETHERSCAN_API_KEY",
};

/**
 * Fetch token holders from block explorer API
 */
async function fetchTokenHolders(
  tokenAddress: string,
  chain: SupportedChain
): Promise<TokenHolder[]> {
  // Solana requires different approach
  if (chain === "solana") {
    return fetchSolanaTokenHolders(tokenAddress);
  }
  
  const apiBase = EXPLORER_APIS[chain];
  const apiKeyEnv = EXPLORER_API_KEYS[chain];
  
  if (!apiBase) {
    console.warn(`No explorer API configured for ${chain}`);
    return [];
  }
  
  const apiKey = apiKeyEnv ? process.env[apiKeyEnv] : "";
  
  try {
    // Note: Most block explorer APIs don't have a direct "top holders" endpoint
    // We'll use token transfers to estimate holder distribution
    const url = `${apiBase}?module=token&action=tokenholderlist&contractaddress=${tokenAddress}&page=1&offset=100&apikey=${apiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Explorer API error: ${response.status}`);
    }
    
    const data = (await response.json()) as {
      status: string;
      result?: Array<{
        TokenHolderAddress: string;
        TokenHolderQuantity?: string;
        TokenHolderPercentage?: string;
      }>;
    };
    
    if (data.status !== "1" || !Array.isArray(data.result)) {
      // Fallback: try to get holder info from alternative source
      return await fetchHoldersFromAlternativeSource(tokenAddress, chain);
    }
    
    return data.result.map((holder: any): TokenHolder => ({
      address: holder.TokenHolderAddress,
      balance: BigInt(holder.TokenHolderQuantity || "0"),
      percentage: parseFloat(holder.TokenHolderPercentage || "0"),
    }));
  } catch (error) {
    console.error(`Failed to fetch holders for ${tokenAddress}:`, error);
    return await fetchHoldersFromAlternativeSource(tokenAddress, chain);
  }
}

/**
 * Fetch Solana token holders using Solana APIs
 */
async function fetchSolanaTokenHolders(tokenAddress: string): Promise<TokenHolder[]> {
  try {
    // Use Helius or similar API for Solana token holders
    const heliusApiKey = process.env.HELIUS_API_KEY;
    
    if (!heliusApiKey) {
      console.warn("No Helius API key configured for Solana holder analysis");
      return [];
    }
    
    const url = `https://api.helius.xyz/v0/addresses/${tokenAddress}/balances?api-key=${heliusApiKey}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return [];
    }
    
    const data = (await response.json()) as {
      tokens?: Array<{ owner?: string; amount?: string }>;
    };
    
    // This is a simplified implementation - actual Helius response format may differ
    if (!data.tokens || !Array.isArray(data.tokens)) {
      return [];
    }
    
    return data.tokens.map((holder: any): TokenHolder => ({
      address: holder.owner || "",
      balance: BigInt(holder.amount || "0"),
      percentage: 0, // Calculate later
    }));
  } catch (error) {
    console.error(`Failed to fetch Solana holders for ${tokenAddress}:`, error);
    return [];
  }
}

/**
 * Fetch holders from alternative source (e.g., GoPlus, Moralis)
 */
async function fetchHoldersFromAlternativeSource(
  tokenAddress: string,
  chain: SupportedChain
): Promise<TokenHolder[]> {
  try {
    // Try GoPlus token security API which includes holder info
    const chainIds: Record<SupportedChain, string> = {
      ethereum: "1",
      base: "8453",
      arbitrum: "42161",
      polygon: "137",
      bsc: "56",
      linea: "59144",
      optimism: "10",
      solana: "solana",
    };
    
    const chainId = chainIds[chain];
    if (chain === "solana") return [];
    
    const url = `https://api.gopluslabs.io/api/v1/token_security/${chainId}?contract_addresses=${tokenAddress}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      return [];
    }
    
    const data = (await response.json()) as {
      result?: Record<string, {
        holders?: unknown;
        holder_count?: string;
        lp_holders?: Array<{ address: string; percent?: string }>;
      }>;
    };
    const tokenData = data.result?.[tokenAddress.toLowerCase()];
    
    if (!tokenData || !tokenData.holders) {
      return [];
    }
    
    // GoPlus provides holder count and concentration
    // We'll create synthetic holder data based on available info
    const holderCount = parseInt(tokenData.holder_count || "0");
    const topHolders: TokenHolder[] = [];
    
    // If we have LP holder info
    if (tokenData.lp_holders && Array.isArray(tokenData.lp_holders)) {
      for (const lp of tokenData.lp_holders.slice(0, 10)) {
        topHolders.push({
          address: lp.address,
          balance: BigInt(0), // Not available from GoPlus
          percentage: parseFloat(lp.percent || "0") * 100,
        });
      }
    }
    
    return topHolders;
  } catch {
    return [];
  }
}

/**
 * Analyze holder distribution
 */
export async function analyzeHolderDistribution(
  tokenAddress: string,
  chain: SupportedChain
): Promise<HolderDistribution> {
  const cacheKey = `holders:distribution:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      const holders = await fetchTokenHolders(tokenAddress, chain);
      
      if (holders.length === 0) {
        // Can't determine - return unknown status
        return {
          isConcentrated: false, // Assume not concentrated if we can't check
          top10Percentage: 0,
          holderCount: 0,
          topHolders: [],
        };
      }
      
      // Sort by percentage/balance
      const sortedHolders = [...holders].sort((a, b) => {
        if (a.percentage !== b.percentage) {
          return b.percentage - a.percentage;
        }
        return Number(b.balance - a.balance);
      });
      
      // Get top 10
      const top10 = sortedHolders.slice(0, 10);
      
      // Calculate top 10 percentage
      let top10Percentage: number;
      
      if (top10[0]?.percentage > 0) {
        // Use percentage if available
        top10Percentage = top10.reduce((sum, h) => sum + h.percentage, 0);
      } else {
        // Calculate from balances
        const totalBalance = holders.reduce((sum, h) => sum + h.balance, 0n);
        const top10Balance = top10.reduce((sum, h) => sum + h.balance, 0n);
        top10Percentage = totalBalance > 0n 
          ? Number((top10Balance * 10000n) / totalBalance) / 100 
          : 0;
      }
      
      return {
        isConcentrated: top10Percentage > CONFIG.MAX_TOP_HOLDER_CONCENTRATION * 100,
        top10Percentage,
        holderCount: holders.length,
        topHolders: top10,
      };
    },
    CONFIG.CACHE_TTL
  );
}

/**
 * Check for whale concentration risk
 */
export async function checkWhaleRisk(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  hasWhaleRisk: boolean;
  largestHolderPercentage: number;
  whaleCount: number; // Holders with >5%
  risk: "low" | "medium" | "high";
  reason?: string;
}> {
  const distribution = await analyzeHolderDistribution(tokenAddress, chain);
  
  if (distribution.holderCount === 0) {
    return {
      hasWhaleRisk: false,
      largestHolderPercentage: 0,
      whaleCount: 0,
      risk: "low",
      reason: "Unable to analyze holder distribution",
    };
  }
  
  // Count whales (>5% holders)
  const whaleThreshold = 5;
  const whales = distribution.topHolders.filter(h => h.percentage > whaleThreshold);
  
  const largestHolderPercentage = distribution.topHolders[0]?.percentage || 0;
  
  // Determine risk level
  let risk: "low" | "medium" | "high" = "low";
  let reason: string | undefined;
  
  if (largestHolderPercentage > 50) {
    risk = "high";
    reason = `Single holder owns ${largestHolderPercentage.toFixed(1)}% of supply`;
  } else if (largestHolderPercentage > 20 || whales.length > 5) {
    risk = "medium";
    reason = `${whales.length} whale(s) with significant holdings`;
  } else if (distribution.isConcentrated) {
    risk = "medium";
    reason = `Top 10 holders control ${distribution.top10Percentage.toFixed(1)}% of supply`;
  }
  
  return {
    hasWhaleRisk: risk !== "low",
    largestHolderPercentage,
    whaleCount: whales.length,
    risk,
    reason,
  };
}

/**
 * Check if token has healthy distribution
 */
export function isHealthyDistribution(distribution: HolderDistribution): {
  healthy: boolean;
  score: number; // 0-100
  issues: string[];
} {
  const issues: string[] = [];
  let score = 100;
  
  // Check concentration
  if (distribution.isConcentrated) {
    score -= 40;
    issues.push(`High concentration: top 10 hold ${distribution.top10Percentage.toFixed(1)}%`);
  }
  
  // Check holder count
  if (distribution.holderCount < 100) {
    score -= 30;
    issues.push(`Low holder count: ${distribution.holderCount}`);
  } else if (distribution.holderCount < 500) {
    score -= 15;
    issues.push(`Moderate holder count: ${distribution.holderCount}`);
  }
  
  // Check largest holder
  const largestHolder = distribution.topHolders[0];
  if (largestHolder) {
    if (largestHolder.percentage > 30) {
      score -= 30;
      issues.push(`Single holder owns ${largestHolder.percentage.toFixed(1)}%`);
    } else if (largestHolder.percentage > 15) {
      score -= 15;
      issues.push(`Largest holder owns ${largestHolder.percentage.toFixed(1)}%`);
    }
  }
  
  score = Math.max(0, score);
  
  return {
    healthy: score >= 60,
    score,
    issues,
  };
}

/**
 * Should we sweep this token based on holder analysis?
 */
export async function shouldSweepBasedOnHolders(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  sweep: boolean;
  requiresApproval: boolean;
  holderDistribution: HolderDistribution;
  reason?: string;
}> {
  const distribution = await analyzeHolderDistribution(tokenAddress, chain);
  
  // Can't analyze - allow but require approval
  if (distribution.holderCount === 0) {
    return {
      sweep: true,
      requiresApproval: true,
      holderDistribution: distribution,
      reason: "Unable to analyze holder distribution",
    };
  }
  
  const whaleRisk = await checkWhaleRisk(tokenAddress, chain);
  const healthCheck = isHealthyDistribution(distribution);
  
  // High risk - require approval
  if (whaleRisk.risk === "high") {
    return {
      sweep: true,
      requiresApproval: true,
      holderDistribution: distribution,
      reason: whaleRisk.reason,
    };
  }
  
  // Unhealthy distribution - require approval
  if (!healthCheck.healthy) {
    return {
      sweep: true,
      requiresApproval: true,
      holderDistribution: distribution,
      reason: healthCheck.issues.join("; "),
    };
  }
  
  // Healthy distribution
  return {
    sweep: true,
    requiresApproval: false,
    holderDistribution: distribution,
  };
}

export default {
  analyzeHolderDistribution,
  checkWhaleRisk,
  isHealthyDistribution,
  shouldSweepBasedOnHolders,
};
