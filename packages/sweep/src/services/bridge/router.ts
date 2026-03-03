/**
 * Multi-Chain Sweep Router
 * Calculates optimal bridging strategy for multi-chain dust sweeps
 * Minimizes total fees (gas + bridge fees) while handling partial failures
 */

import { cacheGet, cacheSet } from "../../utils/redis.js";
import type { SupportedChain } from "../../config/chains.js";
import {
  BridgeProvider,
  BRIDGE_CONFIG,
  type BridgeQuote,
  type MultiChainSweepPlan,
  type ChainSweepSource,
  type PlannedBridge,
} from "./types.js";
import { createBridgeAggregator, type BridgeAggregator } from "./index.js";

/**
 * Token to sweep from a chain
 */
export interface SweepToken {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  amount: bigint;
  valueUsd: number;
}

/**
 * Multi-chain sweep request
 */
export interface MultiChainSweepRequest {
  userId: string;
  tokens: {
    chain: SupportedChain;
    tokens: SweepToken[];
  }[];
  destinationChain: SupportedChain;
  destinationToken: `0x${string}`; // Usually USDC or WETH
  recipient: `0x${string}`;
  sender: `0x${string}`;
  slippage?: number;
}

/**
 * Cost analysis for a sweep strategy
 */
export interface SweepCostAnalysis {
  totalInputValueUsd: number;
  swapFeesUsd: number;
  bridgeFeesUsd: number;
  gasFeesUsd: number;
  totalFeesUsd: number;
  expectedOutputValueUsd: number;
  feePercentage: number;
}

/**
 * Strategy comparison
 */
export interface StrategyComparison {
  strategies: {
    name: string;
    plan: MultiChainSweepPlan;
    costAnalysis: SweepCostAnalysis;
  }[];
  recommended: MultiChainSweepPlan;
  reason: string;
}

/**
 * Multi-Chain Sweep Router
 */
export class MultiChainSweepRouter {
  private readonly aggregator: BridgeAggregator;
  private readonly cachePrefix = "sweep:router";
  
  // Estimated gas costs per chain in USD (approximate)
  private readonly gasEstimates: Partial<Record<SupportedChain, number>> = {
    ethereum: 15,
    base: 0.05,
    arbitrum: 0.1,
    polygon: 0.01,
    optimism: 0.05,
    bsc: 0.2,
    linea: 0.1,
  };
  
  constructor(aggregator?: BridgeAggregator) {
    this.aggregator = aggregator || createBridgeAggregator();
  }
  
  /**
   * Calculate optimal sweep plan
   */
  async calculateSweepPlan(
    request: MultiChainSweepRequest
  ): Promise<MultiChainSweepPlan> {
    const planId = `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    console.log(
      `[SweepRouter] Calculating sweep plan for ${request.tokens.length} chains`
    );
    
    // Step 1: Group tokens by chain and calculate values
    const sources: ChainSweepSource[] = [];
    let totalInputValueUsd = 0;
    
    for (const chainTokens of request.tokens) {
      const chainValue = chainTokens.tokens.reduce(
        (sum, t) => sum + t.valueUsd,
        0
      );
      totalInputValueUsd += chainValue;
      
      // Determine best token to swap to for bridging
      const swapOutputToken = this.getBridgeableToken(
        chainTokens.chain,
        request.destinationToken
      );
      
      sources.push({
        chain: chainTokens.chain,
        tokens: chainTokens.tokens.map((t) => ({
          address: t.address,
          symbol: t.symbol,
          amount: t.amount,
          valueUsd: t.valueUsd,
        })),
        swapOutputToken,
        swapOutputAmount: 0n, // Will be calculated after swap quotes
      });
    }
    
    // Step 2: Filter out chains with too little value
    const minChainValue = 1; // Minimum $1 to be worth sweeping
    const viableSources = sources.filter(
      (s) => s.tokens.reduce((sum, t) => sum + t.valueUsd, 0) >= minChainValue
    );
    
    console.log(
      `[SweepRouter] ${viableSources.length}/${sources.length} chains have sufficient value`
    );
    
    // Step 3: Calculate bridging strategy
    const bridges: PlannedBridge[] = [];
    let totalFeesUsd = 0;
    let maxEstimatedTime = 0;
    
    for (const source of viableSources) {
      if (source.chain === request.destinationChain) {
        // No bridge needed, just swap on destination chain
        continue;
      }
      
      // Estimate swap output (assume 0.3% swap fee)
      const swapInput = source.tokens.reduce((sum, t) => sum + t.valueUsd, 0);
      const estimatedSwapOutput = swapInput * 0.997;
      
      // Convert to token amount (rough estimation)
      // This would need actual swap quotes in production
      const estimatedAmount = BigInt(
        Math.floor(estimatedSwapOutput * 10 ** 6) // Assuming 6 decimals (USDC)
      );
      source.swapOutputAmount = estimatedAmount;
      
      // Get bridge quote
      try {
        const bridgeQuote = await this.aggregator.getBestQuote({
          sourceChain: source.chain,
          destinationChain: request.destinationChain,
          sourceToken: source.swapOutputToken,
          destinationToken: request.destinationToken,
          amount: estimatedAmount,
          sender: request.sender,
          recipient: request.recipient,
          slippage: request.slippage,
        });
        
        if (bridgeQuote) {
          bridges.push({
            sourceChain: source.chain,
            destinationChain: request.destinationChain,
            token: source.swapOutputToken,
            amount: estimatedAmount,
            quote: bridgeQuote,
            priority: this.calculateBridgePriority(source.chain, bridgeQuote),
          });
          
          // Calculate fees
          const bridgeFeeUsd =
            Number(
              bridgeQuote.fees.bridgeFee +
                bridgeQuote.fees.gasFee +
                bridgeQuote.fees.relayerFee
            ) /
            10 ** 6; // Assuming 6 decimals
          totalFeesUsd += bridgeFeeUsd;
          
          // Add gas cost for swap + bridge on source chain
          totalFeesUsd += this.gasEstimates[source.chain] || 1;
          
          maxEstimatedTime = Math.max(
            maxEstimatedTime,
            bridgeQuote.estimatedTime
          );
        } else {
          console.warn(
            `[SweepRouter] No bridge quote available for ${source.chain} -> ${request.destinationChain}`
          );
        }
      } catch (error) {
        console.error(
          `[SweepRouter] Error getting bridge quote for ${source.chain}:`,
          error
        );
      }
    }
    
    // Step 4: Sort bridges by priority (highest first)
    bridges.sort((a, b) => b.priority - a.priority);
    
    // Step 5: Calculate expected output
    const totalBridgeOutput = bridges.reduce(
      (sum, b) => sum + Number(b.quote.outputAmount) / 10 ** 6,
      0
    );
    
    // Add value from destination chain (no bridge needed)
    const destinationChainValue = viableSources
      .filter((s) => s.chain === request.destinationChain)
      .reduce((sum, s) => s.tokens.reduce((tSum, t) => tSum + t.valueUsd, 0) + sum, 0);
    
    const expectedOutputValueUsd = totalBridgeOutput + destinationChainValue * 0.997; // 0.3% swap fee
    
    // Add gas cost for final swap on destination chain
    totalFeesUsd += this.gasEstimates[request.destinationChain] || 1;
    
    const plan: MultiChainSweepPlan = {
      id: planId,
      userId: request.userId,
      destinationChain: request.destinationChain,
      destinationToken: request.destinationToken,
      recipient: request.recipient,
      sources: viableSources,
      bridges,
      totalInputValueUsd,
      totalFeesUsd,
      expectedOutputValueUsd,
      estimatedTotalTime: maxEstimatedTime + 300, // Add 5 min buffer
      createdAt: Date.now(),
      expiresAt: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
    };
    
    // Cache the plan
    await cacheSet(
      `${this.cachePrefix}:plan:${planId}`,
      plan,
      BRIDGE_CONFIG.QUOTE_TTL_SECONDS
    );
    
    return plan;
  }
  
  /**
   * Compare different sweep strategies
   */
  async compareStrategies(
    request: MultiChainSweepRequest
  ): Promise<StrategyComparison> {
    const strategies: StrategyComparison["strategies"] = [];
    
    // Strategy 1: Bridge all to destination
    const directPlan = await this.calculateSweepPlan(request);
    strategies.push({
      name: "Direct Bridge",
      plan: directPlan,
      costAnalysis: this.analyzeCosts(directPlan),
    });
    
    // Strategy 2: Consolidate through Ethereum (if not destination)
    if (request.destinationChain !== "ethereum") {
      const ethereumFirstPlan = await this.calculateSweepPlan({
        ...request,
        destinationChain: "ethereum",
      });
      
      // Then bridge from Ethereum to final destination
      const ethToDestQuote = await this.aggregator.getBestQuote({
        sourceChain: "ethereum",
        destinationChain: request.destinationChain,
        sourceToken: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
        destinationToken: request.destinationToken,
        amount: BigInt(
          Math.floor(ethereumFirstPlan.expectedOutputValueUsd * 10 ** 6)
        ),
        sender: request.sender,
        recipient: request.recipient,
      });
      
      if (ethToDestQuote) {
        const modifiedPlan: MultiChainSweepPlan = {
          ...ethereumFirstPlan,
          id: `${ethereumFirstPlan.id}-eth-route`,
          destinationChain: request.destinationChain,
          bridges: [
            ...ethereumFirstPlan.bridges,
            {
              sourceChain: "ethereum",
              destinationChain: request.destinationChain,
              token: BRIDGE_CONFIG.USDC_ADDRESSES.ethereum as `0x${string}`,
              amount: BigInt(
                Math.floor(ethereumFirstPlan.expectedOutputValueUsd * 10 ** 6)
              ),
              quote: ethToDestQuote,
              priority: 0,
            },
          ],
          totalFeesUsd:
            ethereumFirstPlan.totalFeesUsd +
            Number(
              ethToDestQuote.fees.bridgeFee +
                ethToDestQuote.fees.gasFee +
                ethToDestQuote.fees.relayerFee
            ) /
              10 ** 6,
          expectedOutputValueUsd:
            Number(ethToDestQuote.outputAmount) / 10 ** 6,
          estimatedTotalTime:
            ethereumFirstPlan.estimatedTotalTime + ethToDestQuote.estimatedTime,
        };
        
        strategies.push({
          name: "Via Ethereum",
          plan: modifiedPlan,
          costAnalysis: this.analyzeCosts(modifiedPlan),
        });
      }
    }
    
    // Strategy 3: Consolidate through Arbitrum (fast & cheap)
    if (request.destinationChain !== "arbitrum") {
      const arbFirstPlan = await this.calculateSweepPlan({
        ...request,
        destinationChain: "arbitrum",
      });
      
      const arbToDestQuote = await this.aggregator.getBestQuote({
        sourceChain: "arbitrum",
        destinationChain: request.destinationChain,
        sourceToken: BRIDGE_CONFIG.USDC_ADDRESSES.arbitrum as `0x${string}`,
        destinationToken: request.destinationToken,
        amount: BigInt(
          Math.floor(arbFirstPlan.expectedOutputValueUsd * 10 ** 6)
        ),
        sender: request.sender,
        recipient: request.recipient,
      });
      
      if (arbToDestQuote) {
        const modifiedPlan: MultiChainSweepPlan = {
          ...arbFirstPlan,
          id: `${arbFirstPlan.id}-arb-route`,
          destinationChain: request.destinationChain,
          bridges: [
            ...arbFirstPlan.bridges,
            {
              sourceChain: "arbitrum",
              destinationChain: request.destinationChain,
              token: BRIDGE_CONFIG.USDC_ADDRESSES.arbitrum as `0x${string}`,
              amount: BigInt(
                Math.floor(arbFirstPlan.expectedOutputValueUsd * 10 ** 6)
              ),
              quote: arbToDestQuote,
              priority: 0,
            },
          ],
          totalFeesUsd:
            arbFirstPlan.totalFeesUsd +
            Number(
              arbToDestQuote.fees.bridgeFee +
                arbToDestQuote.fees.gasFee +
                arbToDestQuote.fees.relayerFee
            ) /
              10 ** 6,
          expectedOutputValueUsd:
            Number(arbToDestQuote.outputAmount) / 10 ** 6,
          estimatedTotalTime:
            arbFirstPlan.estimatedTotalTime + arbToDestQuote.estimatedTime,
        };
        
        strategies.push({
          name: "Via Arbitrum",
          plan: modifiedPlan,
          costAnalysis: this.analyzeCosts(modifiedPlan),
        });
      }
    }
    
    // Find recommended strategy (best output after fees)
    const sorted = strategies.sort(
      (a, b) =>
        b.costAnalysis.expectedOutputValueUsd -
        a.costAnalysis.expectedOutputValueUsd
    );
    
    const recommended = sorted[0]?.plan;
    const reason =
      sorted[0]?.name === "Direct Bridge"
        ? "Direct bridging provides the best output value"
        : `Routing via ${sorted[0]?.name.replace("Via ", "")} reduces total fees`;
    
    return {
      strategies,
      recommended: recommended || strategies[0].plan,
      reason,
    };
  }
  
  /**
   * Analyze costs for a sweep plan
   */
  private analyzeCosts(plan: MultiChainSweepPlan): SweepCostAnalysis {
    // Estimate swap fees (0.3% typical)
    const swapFeesUsd = plan.totalInputValueUsd * 0.003;
    
    // Sum bridge fees
    const bridgeFeesUsd = plan.bridges.reduce((sum, b) => {
      return (
        sum +
        Number(
          b.quote.fees.bridgeFee +
            b.quote.fees.relayerFee +
            (b.quote.fees.lpFee || 0n)
        ) /
          10 ** 6
      );
    }, 0);
    
    // Sum gas fees
    const gasFeesUsd = plan.sources.reduce((sum, s) => {
      return sum + (this.gasEstimates[s.chain] || 1);
    }, 0);
    
    const totalFeesUsd = swapFeesUsd + bridgeFeesUsd + gasFeesUsd;
    const feePercentage = (totalFeesUsd / plan.totalInputValueUsd) * 100;
    
    return {
      totalInputValueUsd: plan.totalInputValueUsd,
      swapFeesUsd,
      bridgeFeesUsd,
      gasFeesUsd,
      totalFeesUsd,
      expectedOutputValueUsd: plan.expectedOutputValueUsd,
      feePercentage,
    };
  }
  
  /**
   * Get a plan by ID
   */
  async getPlan(planId: string): Promise<MultiChainSweepPlan | null> {
    return cacheGet<MultiChainSweepPlan>(`${this.cachePrefix}:plan:${planId}`);
  }
  
  /**
   * Update plan status after partial execution
   */
  async updatePlanProgress(
    planId: string,
    completedBridges: { sourceChain: SupportedChain; txHash: string }[]
  ): Promise<MultiChainSweepPlan | null> {
    const plan = await this.getPlan(planId);
    if (!plan) return null;
    
    // Mark completed bridges
    for (const completed of completedBridges) {
      const bridge = plan.bridges.find(
        (b) => b.sourceChain === completed.sourceChain
      );
      if (bridge) {
        (bridge as any).completedTxHash = completed.txHash;
        (bridge as any).status = "completed";
      }
    }
    
    // Update cache
    await cacheSet(
      `${this.cachePrefix}:plan:${planId}`,
      plan,
      BRIDGE_CONFIG.QUOTE_TTL_SECONDS
    );
    
    return plan;
  }
  
  /**
   * Get the best bridgeable token for a chain
   */
  private getBridgeableToken(
    chain: SupportedChain,
    destinationToken: `0x${string}`
  ): `0x${string}` {
    // Check if destination token is available on source chain
    const usdcAddress = BRIDGE_CONFIG.USDC_ADDRESSES[chain];
    const wethAddress = BRIDGE_CONFIG.WETH_ADDRESSES[chain];
    
    // Prefer USDC for stability
    if (usdcAddress) {
      return usdcAddress as `0x${string}`;
    }
    
    // Fall back to WETH
    if (wethAddress) {
      return wethAddress as `0x${string}`;
    }
    
    // If neither, use destination token (might need swap on dest)
    return destinationToken;
  }
  
  /**
   * Calculate bridge priority (higher = execute first)
   */
  private calculateBridgePriority(
    chain: SupportedChain,
    quote: BridgeQuote
  ): number {
    let priority = 0;
    
    // Prefer faster bridges
    if (quote.isFastFill) {
      priority += 100;
    } else {
      priority += Math.max(0, 50 - quote.estimatedTime / 60);
    }
    
    // Prefer cheaper chains (lower gas = higher priority)
    const gasCost = this.gasEstimates[chain] || 1;
    priority += Math.max(0, 20 - gasCost * 2);
    
    // Prefer higher output ratio
    const outputRatio =
      Number(quote.outputAmount) / Number(quote.inputAmount);
    priority += outputRatio * 30;
    
    return priority;
  }
  
  /**
   * Handle partial failure - recalculate remaining bridges
   */
  async handlePartialFailure(
    planId: string,
    failedChain: SupportedChain,
    error: string
  ): Promise<{
    updatedPlan: MultiChainSweepPlan;
    recommendation: string;
  } | null> {
    const plan = await this.getPlan(planId);
    if (!plan) return null;
    
    console.log(
      `[SweepRouter] Handling failure for ${failedChain} in plan ${planId}: ${error}`
    );
    
    // Mark failed bridge
    const failedBridge = plan.bridges.find(
      (b) => b.sourceChain === failedChain
    );
    if (failedBridge) {
      (failedBridge as any).status = "failed";
      (failedBridge as any).error = error;
    }
    
    // Calculate remaining value
    const remainingBridges = plan.bridges.filter(
      (b) =>
        b.sourceChain !== failedChain &&
        (b as any).status !== "completed" &&
        (b as any).status !== "failed"
    );
    
    // Update plan
    const failedValue =
      plan.sources
        .find((s) => s.chain === failedChain)
        ?.tokens.reduce((sum, t) => sum + t.valueUsd, 0) || 0;
    
    plan.expectedOutputValueUsd -= failedValue * 0.997; // Remove failed chain value
    
    // Update cache
    await cacheSet(
      `${this.cachePrefix}:plan:${planId}`,
      plan,
      BRIDGE_CONFIG.QUOTE_TTL_SECONDS
    );
    
    // Generate recommendation
    let recommendation: string;
    if (remainingBridges.length === 0) {
      recommendation = "All bridges have failed or completed. Consider retrying manually.";
    } else if (error.includes("insufficient")) {
      recommendation = `Insufficient balance on ${failedChain}. The remaining ${remainingBridges.length} bridges can proceed.`;
    } else if (error.includes("timeout")) {
      recommendation = `Bridge from ${failedChain} timed out. Consider retrying with a different provider.`;
    } else {
      recommendation = `Bridge from ${failedChain} failed: ${error}. Continuing with remaining bridges.`;
    }
    
    return {
      updatedPlan: plan,
      recommendation,
    };
  }
}

/**
 * Create a multi-chain sweep router instance
 */
export function createSweepRouter(
  aggregator?: BridgeAggregator
): MultiChainSweepRouter {
  return new MultiChainSweepRouter(aggregator);
}

// Export default instance
export const sweepRouter = new MultiChainSweepRouter();
