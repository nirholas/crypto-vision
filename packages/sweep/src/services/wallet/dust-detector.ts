import type { ChainBalance, WalletToken } from "./types.js";
import { DUST_THRESHOLD_USD } from "./types.js";

// ============================================================
// Dust Detection Types
// ============================================================

export interface DustAnalysis {
  totalDustTokens: number;
  totalDustValueUsd: number;
  dustByChain: DustChainSummary[];
  allDustTokens: DustTokenInfo[];
  recommendedSweepOrder: DustTokenInfo[];
}

export interface DustChainSummary {
  chain: string;
  dustTokenCount: number;
  dustValueUsd: number;
  estimatedGasCost: number;
  netValueAfterGas: number;
  profitable: boolean;
}

export interface DustTokenInfo {
  chain: string;
  token: WalletToken;
  sweepPriority: number; // Higher = sweep first
  estimatedGasCost: number;
  netValue: number;
  profitable: boolean;
}

// ============================================================
// Gas Cost Estimates (USD) by Chain
// ============================================================

const ESTIMATED_SWAP_GAS_USD: Record<string, number> = {
  ethereum: 15.0, // L1 is expensive, avoid for dust
  base: 0.02,
  arbitrum: 0.05,
  polygon: 0.01,
  bsc: 0.03,
  linea: 0.03,
  optimism: 0.02,
  solana: 0.001,
};

// ============================================================
// Dust Detection Functions
// ============================================================

/**
 * Determine if a token qualifies as dust
 */
export function isDustToken(valueUsd: number, thresholdUsd: number = DUST_THRESHOLD_USD): boolean {
  return valueUsd > 0 && valueUsd < thresholdUsd;
}

/**
 * Get dust tokens from a single chain balance
 */
export function getDustTokensFromChain(chainBalance: ChainBalance): DustTokenInfo[] {
  const gasCost = ESTIMATED_SWAP_GAS_USD[chainBalance.chain] || 0.10;

  return chainBalance.tokens
    .filter((token) => token.isDust)
    .map((token) => {
      const netValue = token.valueUsd - gasCost;
      const profitable = netValue > 0;

      // Calculate sweep priority:
      // - Higher value = higher priority
      // - Profitable tokens get a boost
      // - L2s get a boost over L1
      let priority = token.valueUsd;
      if (profitable) priority += 50;
      if (chainBalance.chain !== "ethereum") priority += 25;
      if (token.valueUsd > 10) priority += 10;

      return {
        chain: chainBalance.chain,
        token,
        sweepPriority: priority,
        estimatedGasCost: gasCost,
        netValue,
        profitable,
      };
    });
}

/**
 * Analyze dust across multiple chains
 */
export function analyzeDust(chainBalances: ChainBalance[]): DustAnalysis {
  const allDustTokens: DustTokenInfo[] = [];
  const dustByChain: DustChainSummary[] = [];

  for (const chainBalance of chainBalances) {
    const chainDust = getDustTokensFromChain(chainBalance);
    allDustTokens.push(...chainDust);

    const dustValueUsd = chainDust.reduce((sum, d) => sum + d.token.valueUsd, 0);
    const estimatedGasCost = ESTIMATED_SWAP_GAS_USD[chainBalance.chain] || 0.10;
    const totalGasCost = estimatedGasCost * chainDust.length;
    const netValueAfterGas = dustValueUsd - totalGasCost;

    dustByChain.push({
      chain: chainBalance.chain,
      dustTokenCount: chainDust.length,
      dustValueUsd,
      estimatedGasCost: totalGasCost,
      netValueAfterGas,
      profitable: netValueAfterGas > 0,
    });
  }

  // Sort dust tokens by sweep priority (descending)
  const recommendedSweepOrder = [...allDustTokens]
    .filter((d) => d.profitable) // Only include profitable sweeps
    .sort((a, b) => b.sweepPriority - a.sweepPriority);

  const totalDustTokens = allDustTokens.length;
  const totalDustValueUsd = allDustTokens.reduce((sum, d) => sum + d.token.valueUsd, 0);

  return {
    totalDustTokens,
    totalDustValueUsd,
    dustByChain,
    allDustTokens,
    recommendedSweepOrder,
  };
}

/**
 * Filter dust tokens by minimum value threshold
 * Useful for only sweeping tokens above a certain value
 */
export function filterDustByMinValue(
  dustTokens: DustTokenInfo[],
  minValueUsd: number
): DustTokenInfo[] {
  return dustTokens.filter((d) => d.token.valueUsd >= minValueUsd);
}

/**
 * Group dust tokens by chain for batch processing
 */
export function groupDustByChain(dustTokens: DustTokenInfo[]): Map<string, DustTokenInfo[]> {
  const grouped = new Map<string, DustTokenInfo[]>();

  for (const dust of dustTokens) {
    const existing = grouped.get(dust.chain) || [];
    existing.push(dust);
    grouped.set(dust.chain, existing);
  }

  return grouped;
}

/**
 * Calculate potential value from sweeping all dust
 */
export function calculateSweepPotential(dustAnalysis: DustAnalysis): {
  grossValue: number;
  totalGasCost: number;
  netValue: number;
  profitableTokenCount: number;
  unprofitableTokenCount: number;
} {
  const profitableTokens = dustAnalysis.allDustTokens.filter((d) => d.profitable);
  const unprofitableTokens = dustAnalysis.allDustTokens.filter((d) => !d.profitable);

  const grossValue = profitableTokens.reduce((sum, d) => sum + d.token.valueUsd, 0);
  const totalGasCost = profitableTokens.reduce((sum, d) => sum + d.estimatedGasCost, 0);

  return {
    grossValue,
    totalGasCost,
    netValue: grossValue - totalGasCost,
    profitableTokenCount: profitableTokens.length,
    unprofitableTokenCount: unprofitableTokens.length,
  };
}

/**
 * Get chains with profitable dust to sweep
 */
export function getProfitableChains(dustAnalysis: DustAnalysis): string[] {
  return dustAnalysis.dustByChain
    .filter((chain) => chain.profitable && chain.dustTokenCount > 0)
    .sort((a, b) => b.netValueAfterGas - a.netValueAfterGas)
    .map((chain) => chain.chain);
}
