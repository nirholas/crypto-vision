/**
 * Cross-Chain Consolidation Engine
 * Orchestrates multi-chain dust sweeps into a single destination
 */

import { cacheGet, cacheSet } from "../../utils/redis.js";
import type { SupportedChain } from "../../config/chains.js";
import { CHAIN_CONFIG } from "../../config/chains.js";
import {
  BridgeProvider,
  BRIDGE_CONFIG,
  type BridgeQuote,
  type BridgePriority,
} from "../bridge/types.js";
import { createBridgeAggregator, type BridgeAggregator } from "../bridge/index.js";
import {
  createConsolidationOptimizer,
  type ConsolidationOptimizer,
} from "./optimizer.js";
import {
  createStatusTracker,
  getStatusTracker,
  type ConsolidationStatusTracker,
} from "./status-tracker.js";
import {
  ConsolidationStatus,
  type ConsolidationQuoteRequest,
  type ConsolidationPlan,
  type ConsolidationSource,
  type ChainConsolidationPlan,
  type ConsolidationExecuteRequest,
  type ConsolidationStatusDetail,
  type ConsolidationJobData,
} from "./types.js";

/**
 * Cache keys and TTLs
 */
const CACHE_PREFIX = "consolidation";
const PLAN_TTL = 30 * 60; // 30 minutes
const QUOTE_TTL = 5 * 60; // 5 minutes

/**
 * Default slippage tolerance
 */
const DEFAULT_SLIPPAGE = 0.005; // 0.5%

/**
 * Configuration for consolidation engine
 */
export interface ConsolidationEngineConfig {
  minValueUsd: number;
  maxChainsPerConsolidation: number;
  defaultSlippage: number;
  defaultPriority: BridgePriority;
  quoteTtlSeconds: number;
  planTtlSeconds: number;
}

const DEFAULT_CONFIG: ConsolidationEngineConfig = {
  minValueUsd: 1,
  maxChainsPerConsolidation: 10,
  defaultSlippage: DEFAULT_SLIPPAGE,
  defaultPriority: "cost",
  quoteTtlSeconds: QUOTE_TTL,
  planTtlSeconds: PLAN_TTL,
};

/**
 * Result of quote generation
 */
export interface ConsolidationQuoteResult {
  success: boolean;
  plan?: ConsolidationPlan;
  error?: string;
  warnings?: string[];
}

/**
 * Result of execution initiation
 */
export interface ConsolidationExecuteResult {
  success: boolean;
  consolidationId?: string;
  status?: ConsolidationStatusDetail;
  error?: string;
}

/**
 * Cross-Chain Consolidation Engine
 */
export class ConsolidationEngine {
  private readonly config: ConsolidationEngineConfig;
  private readonly aggregator: BridgeAggregator;
  private readonly optimizer: ConsolidationOptimizer;
  private readonly statusTracker: ConsolidationStatusTracker;

  constructor(
    config: Partial<ConsolidationEngineConfig> = {},
    aggregator?: BridgeAggregator
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.aggregator = aggregator || createBridgeAggregator();
    this.optimizer = createConsolidationOptimizer(this.aggregator);
    this.statusTracker = createStatusTracker();
  }

  /**
   * Generate a consolidation quote/plan
   */
  async getQuote(
    request: ConsolidationQuoteRequest
  ): Promise<ConsolidationQuoteResult> {
    const planId = this.generatePlanId();
    const warnings: string[] = [];

    console.log(
      `[ConsolidationEngine] Generating quote ${planId} for ${request.sources.length} chains`
    );

    try {
      // Validate request
      const validationResult = this.validateRequest(request);
      if (!validationResult.valid) {
        return {
          success: false,
          error: validationResult.error,
        };
      }

      // Convert request sources to ConsolidationSource format
      const sources = this.parseRequestSources(request);

      // Filter out chains with insufficient value
      const viableSources = sources.filter(
        (s) => s.totalValueUsd >= this.config.minValueUsd
      );

      if (viableSources.length === 0) {
        return {
          success: false,
          error: `No chains have sufficient value (minimum $${this.config.minValueUsd})`,
        };
      }

      // Add warnings for skipped chains
      const skippedChains = sources.filter(
        (s) => s.totalValueUsd < this.config.minValueUsd
      );
      if (skippedChains.length > 0) {
        warnings.push(
          `Skipped ${skippedChains.length} chains with value below $${this.config.minValueUsd}: ${skippedChains.map((s) => s.chain).join(", ")}`
        );
      }

      // Determine optimization priority
      const priority = request.priority || this.config.defaultPriority;

      // Run optimization
      const optimizationResult = await this.optimizer.optimize(
        viableSources,
        request.destinationChain,
        request.destinationToken,
        request.userAddress,
        priority
      );

      // Build chain plans
      const chainPlans = await this.optimizer.buildChainPlans(
        viableSources,
        optimizationResult,
        request.destinationChain,
        request.destinationToken,
        request.userAddress
      );

      if (chainPlans.length === 0) {
        return {
          success: false,
          error: "No viable consolidation routes found",
          warnings,
        };
      }

      // Calculate totals
      const totalInputValueUsd = viableSources.reduce(
        (sum, s) => sum + s.totalValueUsd,
        0
      );

      const totalSwapFeesUsd = chainPlans.reduce(
        (sum, cp) => sum + cp.swapFeeUsd,
        0
      );

      const totalBridgeFeesUsd = chainPlans.reduce(
        (sum, cp) => sum + (cp.bridge?.feeUsd || 0),
        0
      );

      const totalGasFeesUsd = chainPlans.reduce(
        (sum, cp) => sum + cp.swapGasEstimateUsd,
        0
      );

      const totalFeesUsd = totalSwapFeesUsd + totalBridgeFeesUsd + totalGasFeesUsd;

      const expectedOutputValueUsd = chainPlans.reduce(
        (sum, cp) => sum + cp.expectedOutputUsd,
        0
      );

      const feePercentage =
        totalInputValueUsd > 0
          ? (totalFeesUsd / totalInputValueUsd) * 100
          : 0;

      // Calculate estimated time (max of all bridges + buffer)
      const estimatedTotalTimeSeconds = Math.max(
        ...chainPlans
          .filter((cp) => cp.bridge)
          .map((cp) => cp.bridge!.estimatedTimeSeconds),
        0
      ) + 300; // Add 5 minute buffer

      // Build the plan
      const plan: ConsolidationPlan = {
        id: planId,
        userId: request.userId,
        userAddress: request.userAddress,
        sources: viableSources,
        chainPlans,
        destinationChain: request.destinationChain,
        destinationToken: request.destinationToken,
        totalInputValueUsd,
        totalSwapFeesUsd,
        totalBridgeFeesUsd,
        totalGasFeesUsd,
        totalFeesUsd,
        expectedOutputValueUsd,
        feePercentage,
        estimatedTotalTimeSeconds,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.planTtlSeconds * 1000,
        optimizationStrategy: priority,
      };

      // Store the plan
      await this.statusTracker.storePlan(plan);

      // Check profitability
      const profitability = this.optimizer.isProfitable(
        totalInputValueUsd,
        expectedOutputValueUsd,
        totalFeesUsd
      );

      if (!profitability.profitable) {
        warnings.push(
          `Low profitability: only ${(profitability.ratio * 100).toFixed(1)}% of input value expected as output`
        );
      }

      console.log(
        `[ConsolidationEngine] Quote ${planId} generated: $${totalInputValueUsd.toFixed(2)} -> $${expectedOutputValueUsd.toFixed(2)} (${feePercentage.toFixed(1)}% fees)`
      );

      return {
        success: true,
        plan,
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    } catch (error) {
      console.error(`[ConsolidationEngine] Quote generation failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        warnings: warnings.length > 0 ? warnings : undefined,
      };
    }
  }

  /**
   * Execute a consolidation plan
   */
  async execute(
    request: ConsolidationExecuteRequest
  ): Promise<ConsolidationExecuteResult> {
    console.log(
      `[ConsolidationEngine] Executing consolidation plan ${request.planId}`
    );

    try {
      // Get the plan
      const plan = await this.statusTracker.getPlan(request.planId);
      if (!plan) {
        return {
          success: false,
          error: "Consolidation plan not found or expired",
        };
      }

      // Validate plan hasn't expired
      if (plan.expiresAt < Date.now()) {
        return {
          success: false,
          error: "Consolidation plan has expired. Please get a new quote.",
        };
      }

      // Validate user matches
      if (plan.userId !== request.userId) {
        return {
          success: false,
          error: "User ID mismatch",
        };
      }

      // Generate consolidation ID
      const consolidationId = this.generateConsolidationId();

      // Initialize status tracking
      const status = await this.statusTracker.initializeStatus({
        ...plan,
        id: consolidationId,
      });

      // Extend plan TTL since execution is starting
      await this.statusTracker.extendPlanTtl(request.planId, 3600); // 1 hour

      // Queue the consolidation job
      const jobData: ConsolidationJobData = {
        consolidationId,
        planId: request.planId,
        userId: request.userId,
        userAddress: request.userAddress,
        chainPlans: plan.chainPlans,
        destinationChain: plan.destinationChain,
        destinationToken: plan.destinationToken,
        permitSignatures: request.permitSignatures,
      };

      // Store job data for the worker
      await cacheSet(
        `${CACHE_PREFIX}:job:${consolidationId}`,
        jobData,
        3600 // 1 hour
      );

      console.log(
        `[ConsolidationEngine] Consolidation ${consolidationId} initialized with ${plan.chainPlans.length} chains`
      );

      return {
        success: true,
        consolidationId,
        status,
      };
    } catch (error) {
      console.error(`[ConsolidationEngine] Execution failed:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get consolidation status
   */
  async getStatus(
    consolidationId: string
  ): Promise<ConsolidationStatusDetail | null> {
    return this.statusTracker.getStatus(consolidationId);
  }

  /**
   * Get user's consolidation history
   */
  async getUserHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<ConsolidationStatusDetail[]> {
    return this.statusTracker.getUserHistory(userId, limit, offset);
  }

  /**
   * Get a stored plan
   */
  async getPlan(planId: string): Promise<ConsolidationPlan | null> {
    return this.statusTracker.getPlan(planId);
  }

  /**
   * Get job data for a consolidation
   */
  async getJobData(consolidationId: string): Promise<ConsolidationJobData | null> {
    return cacheGet<ConsolidationJobData>(
      `${CACHE_PREFIX}:job:${consolidationId}`
    );
  }

  /**
   * Validate a consolidation request
   */
  private validateRequest(
    request: ConsolidationQuoteRequest
  ): { valid: boolean; error?: string } {
    if (!request.sources || request.sources.length === 0) {
      return { valid: false, error: "No source chains provided" };
    }

    if (request.sources.length > this.config.maxChainsPerConsolidation) {
      return {
        valid: false,
        error: `Too many source chains: ${request.sources.length} > ${this.config.maxChainsPerConsolidation}`,
      };
    }

    if (!request.destinationChain) {
      return { valid: false, error: "Destination chain is required" };
    }

    if (!request.destinationToken) {
      return { valid: false, error: "Destination token is required" };
    }

    if (!request.userAddress) {
      return { valid: false, error: "User address is required" };
    }

    // Validate each source has tokens
    for (const source of request.sources) {
      if (!source.tokens || source.tokens.length === 0) {
        return {
          valid: false,
          error: `No tokens provided for chain ${source.chain}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Parse request sources into ConsolidationSource format
   */
  private parseRequestSources(
    request: ConsolidationQuoteRequest
  ): ConsolidationSource[] {
    return request.sources.map((source) => {
      const tokens = source.tokens.map((t) => ({
        address: t.address,
        symbol: t.symbol,
        decimals: t.decimals,
        amount: BigInt(t.amount),
        valueUsd: t.valueUsd,
      }));

      const totalValueUsd = tokens.reduce((sum, t) => sum + t.valueUsd, 0);

      // Estimate output after swap (assume 0.3% fee)
      const estimatedOutputUsd = totalValueUsd * 0.997;

      return {
        chain: source.chain,
        tokens,
        totalValueUsd,
        estimatedOutputUsd,
        needsBridge: source.chain !== request.destinationChain,
      };
    });
  }

  /**
   * Generate a unique plan ID
   */
  private generatePlanId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `plan-${timestamp}-${random}`;
  }

  /**
   * Generate a unique consolidation ID
   */
  private generateConsolidationId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `cons-${timestamp}-${random}`;
  }

  /**
   * Simulate a consolidation (for preview/testing)
   */
  async simulate(
    request: ConsolidationQuoteRequest
  ): Promise<{
    success: boolean;
    simulation?: {
      chains: {
        chain: SupportedChain;
        canSwap: boolean;
        canBridge: boolean;
        estimatedOutputUsd: number;
        errors: string[];
      }[];
      totalExpectedOutput: number;
      allRoutesAvailable: boolean;
    };
    error?: string;
  }> {
    try {
      const quoteResult = await this.getQuote(request);

      if (!quoteResult.success || !quoteResult.plan) {
        return {
          success: false,
          error: quoteResult.error,
        };
      }

      const plan = quoteResult.plan;

      const chainSimulations = plan.chainPlans.map((cp) => ({
        chain: cp.chain,
        canSwap: true, // If we got here, swap is possible
        canBridge: cp.bridge !== null || cp.chain === plan.destinationChain,
        estimatedOutputUsd: cp.expectedOutputUsd,
        errors: [],
      }));

      return {
        success: true,
        simulation: {
          chains: chainSimulations,
          totalExpectedOutput: plan.expectedOutputValueUsd,
          allRoutesAvailable: chainSimulations.every(
            (s) => s.canSwap && s.canBridge
          ),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Simulation failed",
      };
    }
  }
}

/**
 * Create a new consolidation engine instance
 */
export function createConsolidationEngine(
  config?: Partial<ConsolidationEngineConfig>,
  aggregator?: BridgeAggregator
): ConsolidationEngine {
  return new ConsolidationEngine(config, aggregator);
}

// Export singleton for convenience
let _engine: ConsolidationEngine | null = null;

export function getConsolidationEngine(): ConsolidationEngine {
  if (!_engine) {
    _engine = createConsolidationEngine();
  }
  return _engine;
}

// Re-export types for convenience
export * from "./types.js";
export { createStatusTracker, getStatusTracker } from "./status-tracker.js";
export { createConsolidationOptimizer } from "./optimizer.js";
