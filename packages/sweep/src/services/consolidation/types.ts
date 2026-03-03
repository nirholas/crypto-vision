/**
 * Cross-Chain Consolidation Types
 * Types for multi-chain dust consolidation into single destination
 */

import type { SupportedChain } from "../../config/chains.js";
import type {
  BridgeProvider,
  BridgeQuote,
  BridgeStatus,
} from "../bridge/types.js";

/**
 * Consolidation operation status
 */
export enum ConsolidationStatus {
  PENDING = "pending",
  QUOTING = "quoting",
  QUOTED = "quoted",
  EXECUTING = "executing",
  PARTIAL_SUCCESS = "partial_success",
  COMPLETED = "completed",
  FAILED = "failed",
  EXPIRED = "expired",
}

/**
 * Individual chain operation status within a consolidation
 */
export enum ChainOperationStatus {
  PENDING = "pending",
  SWAPPING = "swapping",
  SWAP_COMPLETE = "swap_complete",
  BRIDGING = "bridging",
  BRIDGE_COMPLETE = "bridge_complete",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
}

/**
 * Token to consolidate from a source chain
 */
export interface ConsolidationToken {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  amount: bigint;
  valueUsd: number;
}

/**
 * Source chain with tokens to consolidate
 */
export interface ConsolidationSource {
  chain: SupportedChain;
  tokens: ConsolidationToken[];
  totalValueUsd: number;
  estimatedOutputUsd: number;
  needsBridge: boolean;
}

/**
 * Request to get a consolidation quote
 */
export interface ConsolidationQuoteRequest {
  userId: string;
  userAddress: `0x${string}`;
  sources: {
    chain: SupportedChain;
    tokens: {
      address: `0x${string}`;
      symbol: string;
      decimals: number;
      amount: string; // String for API transport
      valueUsd: number;
    }[];
  }[];
  destinationChain: SupportedChain;
  destinationToken: `0x${string}`;
  slippage?: number;
  priority?: "speed" | "cost" | "reliability";
}

/**
 * Planned operation for a single chain in consolidation
 */
export interface ChainConsolidationPlan {
  chain: SupportedChain;
  tokens: ConsolidationToken[];
  
  // Swap details
  swapInputValueUsd: number;
  swapOutputToken: `0x${string}`;
  swapOutputAmount: bigint;
  swapOutputValueUsd: number;
  swapFeeUsd: number;
  swapGasEstimateUsd: number;
  
  // Bridge details (null if same chain as destination)
  bridge: {
    provider: BridgeProvider;
    quote: BridgeQuote;
    inputAmount: bigint;
    outputAmount: bigint;
    feeUsd: number;
    estimatedTimeSeconds: number;
  } | null;
  
  // Totals
  totalFeeUsd: number;
  expectedOutputUsd: number;
  priority: number; // Execution order (lower = first)
}

/**
 * Complete consolidation plan (quote response)
 */
export interface ConsolidationPlan {
  id: string;
  userId: string;
  userAddress: `0x${string}`;
  
  // Source chains
  sources: ConsolidationSource[];
  chainPlans: ChainConsolidationPlan[];
  
  // Destination
  destinationChain: SupportedChain;
  destinationToken: `0x${string}`;
  
  // Aggregated values
  totalInputValueUsd: number;
  totalSwapFeesUsd: number;
  totalBridgeFeesUsd: number;
  totalGasFeesUsd: number;
  totalFeesUsd: number;
  expectedOutputValueUsd: number;
  feePercentage: number;
  
  // Timing
  estimatedTotalTimeSeconds: number;
  createdAt: number;
  expiresAt: number;
  
  // Optimization info
  optimizationStrategy: "speed" | "cost" | "reliability";
  alternativeStrategies?: {
    strategy: "speed" | "cost" | "reliability";
    expectedOutputValueUsd: number;
    estimatedTimeSeconds: number;
  }[];
}

/**
 * Request to execute a consolidation
 */
export interface ConsolidationExecuteRequest {
  planId: string;
  userId: string;
  userAddress: `0x${string}`;
  signature?: string; // Optional for smart wallet
  permitSignatures?: Record<string, string>; // Chain -> Permit2 signature
}

/**
 * Status of a single chain operation
 */
export interface ChainOperationStatusDetail {
  chain: SupportedChain;
  status: ChainOperationStatus;
  
  // Swap status
  swapTxHash?: `0x${string}`;
  swapConfirmed?: boolean;
  swapError?: string;
  
  // Bridge status
  bridgeTxHash?: `0x${string}`;
  bridgeProvider?: BridgeProvider;
  bridgeStatus?: BridgeStatus;
  bridgeDestinationTxHash?: `0x${string}`;
  bridgeError?: string;
  
  // Amounts
  inputValueUsd?: number;
  outputAmount?: bigint;
  outputValueUsd?: number;
  
  // Timing
  startedAt?: number;
  completedAt?: number;
  
  // Errors
  error?: string;
  retryCount?: number;
}

/**
 * Complete consolidation status
 */
export interface ConsolidationStatusDetail {
  id: string;
  userId: string;
  status: ConsolidationStatus;
  
  // Chain operations
  chainOperations: ChainOperationStatusDetail[];
  completedChains: number;
  totalChains: number;
  
  // Progress
  progressPercent: number;
  
  // Amounts
  totalInputValueUsd: number;
  totalOutputValueUsd: number;
  actualFeesUsd: number;
  
  // Final destination
  destinationChain: SupportedChain;
  destinationToken: `0x${string}`;
  finalOutputAmount?: bigint;
  
  // Timing
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedCompletionAt?: number;
  
  // Errors for failed operations
  errors: {
    chain: SupportedChain;
    stage: "swap" | "bridge";
    error: string;
  }[];
}

/**
 * Event emitted during consolidation
 */
export interface ConsolidationEvent {
  type:
    | "consolidation_started"
    | "chain_swap_started"
    | "chain_swap_completed"
    | "chain_bridge_started"
    | "chain_bridge_completed"
    | "chain_failed"
    | "consolidation_completed"
    | "consolidation_failed";
  consolidationId: string;
  userId: string;
  chain?: SupportedChain;
  txHash?: string;
  error?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

/**
 * Consolidation job data for queue
 */
export interface ConsolidationJobData {
  consolidationId: string;
  planId: string;
  userId: string;
  userAddress: `0x${string}`;
  chainPlans: ChainConsolidationPlan[];
  destinationChain: SupportedChain;
  destinationToken: `0x${string}`;
  permitSignatures?: Record<string, string>;
}

/**
 * Bridge comparison for optimization
 */
export interface BridgeComparison {
  provider: BridgeProvider;
  quote: BridgeQuote;
  outputAmount: bigint;
  feeUsd: number;
  estimatedTimeSeconds: number;
  score: number; // Composite score for ranking
}

/**
 * Chain optimization result
 */
export interface ChainOptimizationResult {
  chain: SupportedChain;
  recommendedBridge: BridgeProvider | null;
  bridgeOptions: BridgeComparison[];
  executionPriority: number;
  skipReason?: string;
}

/**
 * Full optimization result
 */
export interface ConsolidationOptimizationResult {
  chainResults: ChainOptimizationResult[];
  executionOrder: SupportedChain[];
  estimatedTotalFeesUsd: number;
  estimatedTotalTimeSeconds: number;
  strategy: "speed" | "cost" | "reliability";
}
