/**
 * Liquidity Validation
 * Checks pool liquidity to ensure token can be safely swapped
 */

import { type SupportedChain } from "../../../config/chains.js";
import { cacheGetOrFetch } from "../../../utils/redis.js";
import { fetchDexScreenerPools, fetchDexScreenerLiquidity } from "../oracles/dexscreener.js";
import type { LiquidityCheck, DexPool, PRICE_VALIDATION_CONFIG } from "../types.js";

const CONFIG = {
  MIN_LIQUIDITY_USD: 10_000, // $10K minimum pool liquidity
  MIN_24H_VOLUME_USD: 5_000, // $5K minimum 24h volume
  CACHE_TTL: 300, // 5 minutes
};

/**
 * Check token liquidity across all pools
 */
export async function checkTokenLiquidity(
  tokenAddress: string,
  chain: SupportedChain
): Promise<LiquidityCheck> {
  const cacheKey = `liquidity:check:${chain}:${tokenAddress.toLowerCase()}`;
  
  return cacheGetOrFetch(
    cacheKey,
    async () => {
      try {
        const pools = await fetchDexScreenerPools(tokenAddress, chain);
        
        // Sort by liquidity
        const sortedPools = [...pools].sort((a, b) => b.liquidity - a.liquidity);
        
        // Calculate totals
        const totalLiquidity = pools.reduce((sum, p) => sum + p.liquidity, 0);
        const totalVolume = pools.reduce((sum, p) => sum + p.volume24h, 0);
        
        // Take top 5 pools
        const topPools = sortedPools.slice(0, 5);
        
        return {
          isLiquid: totalLiquidity >= CONFIG.MIN_LIQUIDITY_USD,
          liquidityUsd: totalLiquidity,
          topPools,
          volume24h: totalVolume,
        };
      } catch (error) {
        console.error(`Liquidity check error for ${tokenAddress}:`, error);
        
        // Return conservative result on error
        return {
          isLiquid: false,
          liquidityUsd: 0,
          topPools: [],
          volume24h: 0,
        };
      }
    },
    CONFIG.CACHE_TTL
  );
}

/**
 * Check if liquidity is sufficient for a specific swap amount
 */
export async function checkLiquidityForAmount(
  tokenAddress: string,
  chain: SupportedChain,
  swapAmountUsd: number
): Promise<{
  sufficient: boolean;
  liquidityRatio: number;
  estimatedSlippage: number;
  bestPool: DexPool | null;
}> {
  const liquidityCheck = await checkTokenLiquidity(tokenAddress, chain);
  
  if (liquidityCheck.liquidityUsd === 0) {
    return {
      sufficient: false,
      liquidityRatio: 0,
      estimatedSlippage: 1, // 100% slippage (can't swap)
      bestPool: null,
    };
  }
  
  // Calculate what percentage of liquidity this swap represents
  const liquidityRatio = swapAmountUsd / liquidityCheck.liquidityUsd;
  
  // Estimate slippage based on liquidity ratio
  // Simple model: slippage ≈ 2 * liquidityRatio (for small swaps)
  // This is a rough approximation; actual slippage depends on curve shape
  const estimatedSlippage = Math.min(liquidityRatio * 2, 1);
  
  // Swap should be less than 1% of liquidity for minimal slippage
  const sufficient = liquidityRatio < 0.01;
  
  return {
    sufficient,
    liquidityRatio,
    estimatedSlippage,
    bestPool: liquidityCheck.topPools[0] || null,
  };
}

/**
 * Check 24h trading volume
 */
export async function checkTradingVolume(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  sufficient: boolean;
  volume24h: number;
  volumeToLiquidityRatio: number;
}> {
  const liquidityCheck = await checkTokenLiquidity(tokenAddress, chain);
  
  // Volume should be at least some percentage of liquidity (healthy trading)
  const volumeToLiquidityRatio = liquidityCheck.liquidityUsd > 0
    ? liquidityCheck.volume24h / liquidityCheck.liquidityUsd
    : 0;
  
  return {
    sufficient: liquidityCheck.volume24h >= CONFIG.MIN_24H_VOLUME_USD,
    volume24h: liquidityCheck.volume24h,
    volumeToLiquidityRatio,
  };
}

/**
 * Get liquidity distribution across DEXes
 */
export async function getLiquidityDistribution(
  tokenAddress: string,
  chain: SupportedChain
): Promise<Record<string, { liquidity: number; percentage: number; poolCount: number }>> {
  const liquidityCheck = await checkTokenLiquidity(tokenAddress, chain);
  
  const distribution: Record<string, { liquidity: number; percentage: number; poolCount: number }> = {};
  
  for (const pool of liquidityCheck.topPools) {
    if (!distribution[pool.dex]) {
      distribution[pool.dex] = { liquidity: 0, percentage: 0, poolCount: 0 };
    }
    distribution[pool.dex].liquidity += pool.liquidity;
    distribution[pool.dex].poolCount += 1;
  }
  
  // Calculate percentages
  const total = liquidityCheck.liquidityUsd;
  for (const dex of Object.keys(distribution)) {
    distribution[dex].percentage = total > 0 
      ? (distribution[dex].liquidity / total) * 100 
      : 0;
  }
  
  return distribution;
}

/**
 * Check if token has concentrated liquidity risk
 * (most liquidity in a single pool that could be drained)
 */
export async function checkLiquidityConcentration(
  tokenAddress: string,
  chain: SupportedChain
): Promise<{
  isConcentrated: boolean;
  topPoolPercentage: number;
  recommendation: string;
}> {
  const liquidityCheck = await checkTokenLiquidity(tokenAddress, chain);
  
  if (liquidityCheck.topPools.length === 0 || liquidityCheck.liquidityUsd === 0) {
    return {
      isConcentrated: true,
      topPoolPercentage: 100,
      recommendation: "No liquidity pools found",
    };
  }
  
  const topPoolPercentage = (liquidityCheck.topPools[0].liquidity / liquidityCheck.liquidityUsd) * 100;
  
  // If top pool has more than 90% of liquidity, it's concentrated
  const isConcentrated = topPoolPercentage > 90;
  
  let recommendation = "";
  if (isConcentrated) {
    recommendation = "Liquidity is concentrated in a single pool - higher manipulation risk";
  } else if (topPoolPercentage > 70) {
    recommendation = "Liquidity is somewhat concentrated - moderate risk";
  } else {
    recommendation = "Liquidity is well distributed across pools";
  }
  
  return {
    isConcentrated,
    topPoolPercentage,
    recommendation,
  };
}

/**
 * Validate that we should sweep this token based on liquidity
 */
export async function shouldSweepBasedOnLiquidity(
  tokenAddress: string,
  chain: SupportedChain,
  swapAmountUsd?: number
): Promise<{
  sweep: boolean;
  reason?: string;
  liquidityCheck: LiquidityCheck;
}> {
  const liquidityCheck = await checkTokenLiquidity(tokenAddress, chain);
  
  // Check minimum liquidity
  if (!liquidityCheck.isLiquid) {
    return {
      sweep: false,
      reason: `Insufficient liquidity ($${liquidityCheck.liquidityUsd.toFixed(0)} < $${CONFIG.MIN_LIQUIDITY_USD})`,
      liquidityCheck,
    };
  }
  
  // Check minimum volume
  if (liquidityCheck.volume24h < CONFIG.MIN_24H_VOLUME_USD) {
    return {
      sweep: false,
      reason: `Insufficient 24h volume ($${liquidityCheck.volume24h.toFixed(0)} < $${CONFIG.MIN_24H_VOLUME_USD})`,
      liquidityCheck,
    };
  }
  
  // Check if swap amount is too large relative to liquidity
  if (swapAmountUsd) {
    const amountCheck = await checkLiquidityForAmount(tokenAddress, chain, swapAmountUsd);
    if (!amountCheck.sufficient) {
      return {
        sweep: false,
        reason: `Swap amount too large relative to liquidity (${(amountCheck.liquidityRatio * 100).toFixed(1)}% of pool)`,
        liquidityCheck,
      };
    }
  }
  
  return {
    sweep: true,
    liquidityCheck,
  };
}

export default {
  checkTokenLiquidity,
  checkLiquidityForAmount,
  checkTradingVolume,
  getLiquidityDistribution,
  checkLiquidityConcentration,
  shouldSweepBasedOnLiquidity,
};
