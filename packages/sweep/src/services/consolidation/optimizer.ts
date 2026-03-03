/**
 * Cross-Chain Consolidation Optimizer
 * Optimizes consolidation order and bridge selection
 */

import type { SupportedChain } from "../../config/chains.js";
import { CHAIN_CONFIG } from "../../config/chains.js";
import {
  type BridgeQuote,
  type BridgeProvider,
  type BridgePriority,
} from "../bridge/types.js";
import { type BridgeAggregator, createBridgeAggregator } from "../bridge/index.js";
import type {
  ConsolidationSource,
  ChainConsolidationPlan,
  BridgeComparison,
  ChainOptimizationResult,
  ConsolidationOptimizationResult,
} from "./types.js";

/**
 * Gas cost estimates per chain (in USD)
 * These are approximate and should be updated based on current gas prices
 */
const GAS_ESTIMATES: Partial<Record<SupportedChain, number>> = {
  ethereum: 15,
  base: 0.05,
  arbitrum: 0.1,
  polygon: 0.01,
  optimism: 0.05,
  bsc: 0.2,
  linea: 0.1,
};

/**
 * Swap fee estimates (as percentage)
 */
const SWAP_FEE_PERCENT = 0.003; // 0.3% typical DEX fee

/**
 * Minimum value to consider sweeping (in USD)
 */
const MIN_SWEEP_VALUE_USD = 1;

/**
 * Minimum profitable ratio (output/input)
 */
const MIN_PROFITABLE_RATIO = 0.8; // At least 80% of input value as output

/**
 * Bridge priority scores
 */
const BRIDGE_PRIORITY_SCORES: Record<BridgeProvider, { speed: number; cost: number; reliability: number }> = {
  across: { speed: 95, cost: 85, reliability: 90 },
  stargate: { speed: 70, cost: 90, reliability: 95 },
  hop: { speed: 80, cost: 80, reliability: 85 },
  cbridge: { speed: 75, cost: 85, reliability: 80 },
  socket: { speed: 85, cost: 80, reliability: 85 },
  synapse: { speed: 70, cost: 85, reliability: 80 },
};

/**
 * Consolidation Optimizer
 */
export class ConsolidationOptimizer {
  private readonly aggregator: BridgeAggregator;

  constructor(aggregator?: BridgeAggregator) {
    this.aggregator = aggregator || createBridgeAggregator();
  }

  /**
   * Optimize consolidation for given sources and destination
   */
  async optimize(
    sources: ConsolidationSource[],
    destinationChain: SupportedChain,
    destinationToken: `0x${string}`,
    userAddress: `0x${string}`,
    priority: BridgePriority = "cost"
  ): Promise<ConsolidationOptimizationResult> {
    console.log(
      `[Optimizer] Optimizing ${sources.length} chains to ${destinationChain} with priority: ${priority}`
    );

    const chainResults: ChainOptimizationResult[] = [];
    const validChains: SupportedChain[] = [];

    // Process each source chain
    for (const source of sources) {
      const result = await this.optimizeChain(
        source,
        destinationChain,
        destinationToken,
        userAddress,
        priority
      );
      chainResults.push(result);

      if (!result.skipReason) {
        validChains.push(source.chain);
      }
    }

    // Determine execution order based on priority
    const executionOrder = this.calculateExecutionOrder(
      chainResults.filter((r) => !r.skipReason),
      priority
    );

    // Calculate totals
    const estimatedTotalFeesUsd = chainResults.reduce((sum, r) => {
      if (r.skipReason) return sum;
      const bestBridge = r.bridgeOptions[0];
      return sum + (bestBridge?.feeUsd || 0) + (GAS_ESTIMATES[r.chain] || 1);
    }, 0);

    const estimatedTotalTimeSeconds = Math.max(
      ...chainResults
        .filter((r) => !r.skipReason)
        .map((r) => r.bridgeOptions[0]?.estimatedTimeSeconds || 0),
      0
    );

    return {
      chainResults,
      executionOrder,
      estimatedTotalFeesUsd,
      estimatedTotalTimeSeconds,
      strategy: priority,
    };
  }

  /**
   * Optimize a single chain's consolidation
   */
  private async optimizeChain(
    source: ConsolidationSource,
    destinationChain: SupportedChain,
    destinationToken: `0x${string}`,
    userAddress: `0x${string}`,
    priority: BridgePriority
  ): Promise<ChainOptimizationResult> {
    const chain = source.chain;

    // Check minimum value
    if (source.totalValueUsd < MIN_SWEEP_VALUE_USD) {
      return {
        chain,
        recommendedBridge: null,
        bridgeOptions: [],
        executionPriority: Infinity,
        skipReason: `Value too low: $${source.totalValueUsd.toFixed(2)} < $${MIN_SWEEP_VALUE_USD}`,
      };
    }

    // Check if it's same chain (no bridge needed)
    if (chain === destinationChain) {
      return {
        chain,
        recommendedBridge: null,
        bridgeOptions: [],
        executionPriority: -Infinity, // Same-chain always first (no bridge needed)
      };
    }

    // Get gas estimate for this chain
    const gasEstimate = GAS_ESTIMATES[chain] || 5;

    // Check if sweep is profitable after gas
    const estimatedNetValue = source.totalValueUsd - gasEstimate;
    if (estimatedNetValue < MIN_SWEEP_VALUE_USD) {
      return {
        chain,
        recommendedBridge: null,
        bridgeOptions: [],
        executionPriority: Infinity,
        skipReason: `Not profitable after gas: $${source.totalValueUsd.toFixed(2)} - $${gasEstimate.toFixed(2)} = $${estimatedNetValue.toFixed(2)}`,
      };
    }

    // Get bridge quotes from all providers
    const bridgeOptions = await this.getBridgeOptions(
      chain,
      destinationChain,
      destinationToken,
      source.estimatedOutputUsd,
      userAddress,
      priority
    );

    if (bridgeOptions.length === 0) {
      return {
        chain,
        recommendedBridge: null,
        bridgeOptions: [],
        executionPriority: Infinity,
        skipReason: `No bridge routes available from ${chain} to ${destinationChain}`,
      };
    }

    // Calculate execution priority
    const executionPriority = this.calculateChainPriority(
      chain,
      source.totalValueUsd,
      bridgeOptions[0],
      priority
    );

    return {
      chain,
      recommendedBridge: bridgeOptions[0].provider,
      bridgeOptions,
      executionPriority,
    };
  }

  /**
   * Get and score bridge options for a route
   */
  private async getBridgeOptions(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    destinationToken: `0x${string}`,
    estimatedOutputValueUsd: number,
    userAddress: `0x${string}`,
    priority: BridgePriority
  ): Promise<BridgeComparison[]> {
    // Get bridgeable token for source chain (usually USDC or WETH)
    const sourceToken = this.getBridgeableToken(sourceChain);

    // Estimate amount (assume USDC with 6 decimals)
    const estimatedAmount = BigInt(Math.floor(estimatedOutputValueUsd * 1e6));

    if (estimatedAmount <= 0n) {
      return [];
    }

    try {
      // Get quotes from aggregator
      const quotes = await this.aggregator.getAllRoutes({
        sourceChain,
        destChain: destinationChain,
        token: sourceToken,
        amount: estimatedAmount.toString(),
        userAddress,
      });

      if (!quotes || quotes.length === 0) {
        return [];
      }

      // Convert to BridgeComparison and score
      const comparisons: BridgeComparison[] = quotes.map((quote) => ({
        provider: quote.provider,
        quote,
        outputAmount: quote.outputAmount,
        feeUsd: quote.feeUsd,
        estimatedTimeSeconds: quote.estimatedTime,
        score: this.calculateBridgeScore(quote, priority),
      }));

      // Sort by score (highest first)
      comparisons.sort((a, b) => b.score - a.score);

      return comparisons;
    } catch (error) {
      console.error(
        `[Optimizer] Error getting bridge quotes for ${sourceChain} -> ${destinationChain}:`,
        error
      );
      return [];
    }
  }

  /**
   * Calculate a composite score for a bridge quote
   */
  private calculateBridgeScore(
    quote: BridgeQuote,
    priority: BridgePriority
  ): number {
    const baseScores = BRIDGE_PRIORITY_SCORES[quote.provider] || {
      speed: 50,
      cost: 50,
      reliability: 50,
    };

    // Weight factors based on priority
    const weights =
      priority === "speed"
        ? { speed: 0.6, cost: 0.2, reliability: 0.2 }
        : priority === "cost"
          ? { speed: 0.2, cost: 0.6, reliability: 0.2 }
          : { speed: 0.2, cost: 0.2, reliability: 0.6 };

    // Calculate weighted base score
    let score =
      baseScores.speed * weights.speed +
      baseScores.cost * weights.cost +
      baseScores.reliability * weights.reliability;

    // Adjust for actual quote metrics
    // Lower fees = higher score
    const feeAdjustment = Math.max(0, 20 - quote.feeUsd) * 2;
    score += feeAdjustment * weights.cost;

    // Faster time = higher score
    const timeMinutes = quote.estimatedTime / 60;
    const timeAdjustment = Math.max(0, 20 - timeMinutes) * 2;
    score += timeAdjustment * weights.speed;

    // Fast fills get bonus
    if (quote.isFastFill) {
      score += 10 * weights.speed;
    }

    return score;
  }

  /**
   * Calculate execution priority for a chain
   * Lower number = higher priority (execute first)
   */
  private calculateChainPriority(
    chain: SupportedChain,
    valueUsd: number,
    bestBridge: BridgeComparison,
    priority: BridgePriority
  ): number {
    // Base priority by gas efficiency
    const gasEstimate = GAS_ESTIMATES[chain] || 5;
    const gasEfficiency = gasEstimate / valueUsd;

    // Start with gas efficiency (lower is better)
    let priorityScore = gasEfficiency * 100;

    // Adjust based on priority preference
    if (priority === "speed") {
      // Faster bridges first
      priorityScore -= (100 - bestBridge.estimatedTimeSeconds / 60) * 0.5;
    } else if (priority === "cost") {
      // Cheaper chains first (already captured by gas efficiency)
    } else {
      // Reliability: prefer more reliable bridges
      const reliabilityBonus = BRIDGE_PRIORITY_SCORES[bestBridge.provider]?.reliability || 50;
      priorityScore -= reliabilityBonus * 0.5;
    }

    // Higher value chains get slight priority (more to gain)
    priorityScore -= Math.log10(valueUsd) * 5;

    return priorityScore;
  }

  /**
   * Calculate execution order across chains
   */
  private calculateExecutionOrder(
    results: ChainOptimizationResult[],
    priority: BridgePriority
  ): SupportedChain[] {
    // Sort by execution priority (lower = first)
    const sorted = [...results].sort(
      (a, b) => a.executionPriority - b.executionPriority
    );

    return sorted.map((r) => r.chain);
  }

  /**
   * Get the best bridgeable token for a chain
   */
  private getBridgeableToken(chain: SupportedChain): `0x${string}` {
    // Use USDC as the default bridgeable token
    const chainConfig = CHAIN_CONFIG[chain as keyof typeof CHAIN_CONFIG];
    if (chainConfig?.stablecoin) {
      return chainConfig.stablecoin;
    }

    // Fallback USDC addresses
    const usdcAddresses: Partial<Record<SupportedChain, `0x${string}`>> = {
      ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
      bsc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
      linea: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
      optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    };

    return usdcAddresses[chain] || "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
  }

  /**
   * Calculate swap output estimate
   */
  calculateSwapOutput(inputValueUsd: number, chain: SupportedChain): {
    outputValueUsd: number;
    feeUsd: number;
    gasEstimateUsd: number;
  } {
    const swapFee = inputValueUsd * SWAP_FEE_PERCENT;
    const gasEstimate = GAS_ESTIMATES[chain] || 5;
    const outputValueUsd = inputValueUsd - swapFee;

    return {
      outputValueUsd,
      feeUsd: swapFee,
      gasEstimateUsd: gasEstimate,
    };
  }

  /**
   * Check if consolidation is profitable
   */
  isProfitable(
    inputValueUsd: number,
    expectedOutputValueUsd: number,
    totalFeesUsd: number
  ): { profitable: boolean; netValueUsd: number; ratio: number } {
    const netValueUsd = expectedOutputValueUsd - totalFeesUsd;
    const ratio = inputValueUsd > 0 ? expectedOutputValueUsd / inputValueUsd : 0;

    return {
      profitable: ratio >= MIN_PROFITABLE_RATIO && netValueUsd > 0,
      netValueUsd,
      ratio,
    };
  }

  /**
   * Build chain consolidation plans from optimization results
   */
  async buildChainPlans(
    sources: ConsolidationSource[],
    optimizationResult: ConsolidationOptimizationResult,
    destinationChain: SupportedChain,
    destinationToken: `0x${string}`,
    userAddress: `0x${string}`
  ): Promise<ChainConsolidationPlan[]> {
    const plans: ChainConsolidationPlan[] = [];

    for (const result of optimizationResult.chainResults) {
      if (result.skipReason) {
        continue;
      }

      const source = sources.find((s) => s.chain === result.chain);
      if (!source) {
        continue;
      }

      // Calculate swap output
      const swapResult = this.calculateSwapOutput(source.totalValueUsd, result.chain);
      const swapOutputToken = this.getBridgeableToken(result.chain);
      const swapOutputAmount = BigInt(Math.floor(swapResult.outputValueUsd * 1e6));

      // Get bridge details if needed
      let bridge: ChainConsolidationPlan["bridge"] = null;
      if (result.chain !== destinationChain && result.bridgeOptions.length > 0) {
        const bestBridge = result.bridgeOptions[0];
        bridge = {
          provider: bestBridge.provider,
          quote: bestBridge.quote,
          inputAmount: swapOutputAmount,
          outputAmount: bestBridge.outputAmount,
          feeUsd: bestBridge.feeUsd,
          estimatedTimeSeconds: bestBridge.estimatedTimeSeconds,
        };
      }

      const totalFeeUsd =
        swapResult.feeUsd +
        swapResult.gasEstimateUsd +
        (bridge?.feeUsd || 0);

      const expectedOutputUsd = bridge
        ? Number(bridge.outputAmount) / 1e6
        : swapResult.outputValueUsd;

      plans.push({
        chain: result.chain,
        tokens: source.tokens.map((t) => ({
          address: t.address,
          symbol: t.symbol,
          decimals: t.decimals,
          amount: BigInt(t.amount.toString()),
          valueUsd: t.valueUsd,
        })),
        swapInputValueUsd: source.totalValueUsd,
        swapOutputToken,
        swapOutputAmount,
        swapOutputValueUsd: swapResult.outputValueUsd,
        swapFeeUsd: swapResult.feeUsd,
        swapGasEstimateUsd: swapResult.gasEstimateUsd,
        bridge,
        totalFeeUsd,
        expectedOutputUsd,
        priority: result.executionPriority,
      });
    }

    // Sort by priority (lower = first)
    plans.sort((a, b) => a.priority - b.priority);

    return plans;
  }
}

/**
 * Create a new optimizer instance
 */
export function createConsolidationOptimizer(
  aggregator?: BridgeAggregator
): ConsolidationOptimizer {
  return new ConsolidationOptimizer(aggregator);
}
