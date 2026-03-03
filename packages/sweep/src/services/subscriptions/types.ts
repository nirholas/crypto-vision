import { type Address, type Hex } from "viem";
import { z } from "zod";

// ============================================================================
// Core Subscription Types
// ============================================================================

export type TriggerType = "threshold" | "schedule";
export type SubscriptionStatus = "active" | "paused" | "cancelled" | "expired";

/**
 * Auto-sweep subscription configuration
 * Users grant permission for the protocol to sweep dust on their behalf
 */
export interface AutoSweepSubscription {
  id: string;
  userId: string;
  walletAddress: string;
  smartWalletAddress?: string;
  
  // Source configuration
  sourceChains: number[];               // Chain IDs to monitor
  
  // Destination configuration
  destinationChain: number;
  destinationAsset: string;             // 'USDC', 'ETH', etc.
  destinationProtocol?: string;         // 'aave', 'yearn', etc.
  destinationVault?: string;            // Specific vault address if applicable
  
  // Trigger configuration
  triggerType: TriggerType;
  thresholdUsd?: number;                // Sweep when dust > $X
  schedulePattern?: string;             // Cron pattern for scheduled sweeps
  
  // Cost limits
  minSweepValueUsd: number;             // Minimum dust value to trigger sweep
  maxSweepCostPercent: number;          // Max % of dust to spend on fees
  
  // Spend permission (Coinbase)
  spendPermissionSignature: string;     // Coinbase spend permission signature
  spendPermissionHash: string;          // Hash for verification
  spendPermissionExpiry: Date;
  spendPermissionMaxAmount: string;     // Max amount per sweep (wei)
  
  // Status
  status: SubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
  lastSweepAt?: Date;
  nextScheduledAt?: Date;
  
  // Audit
  totalSweeps: number;
  totalValueSwept: string;              // Total USD value swept
}

/**
 * Subscription sweep history record
 */
export interface SubscriptionSweep {
  id: string;
  subscriptionId: string;
  sweepId: string;                      // Reference to main sweeps table
  triggeredBy: "threshold" | "schedule" | "manual";
  dustValueUsd: number;
  sweepCostUsd: number;
  netValueUsd: number;
  tokensSwept: number;
  chains: number[];
  status: "pending" | "executing" | "completed" | "failed";
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

// ============================================================================
// Spend Permission Types (Coinbase)
// ============================================================================

/**
 * EIP-712 typed data for Coinbase Spend Permission
 */
export interface SpendPermission {
  account: Address;                     // Smart wallet address
  spender: Address;                     // Sweep contract/executor
  token: Address;                       // Token to spend (or ETH_ADDRESS)
  allowance: bigint;                    // Max amount per period
  period: number;                       // Period in seconds (e.g., 86400 for daily)
  start: number;                        // Unix timestamp start
  end: number;                          // Unix timestamp end
  salt: bigint;                         // Unique nonce
  extraData: Hex;                       // Additional data (e.g., chain IDs)
}

/**
 * Signed spend permission
 */
export interface SignedSpendPermission {
  permission: SpendPermission;
  signature: Hex;
}

/**
 * Spend permission allowance status
 */
export interface SpendPermissionStatus {
  isValid: boolean;
  remainingAllowance: bigint;
  usedInPeriod: bigint;
  periodStart: number;
  periodEnd: number;
  isExpired: boolean;
  isRevoked: boolean;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Create subscription request
 */
export interface CreateSubscriptionRequest {
  walletAddress: string;
  sourceChains: number[];
  destinationChain: number;
  destinationAsset: string;
  destinationProtocol?: string;
  destinationVault?: string;
  triggerType: TriggerType;
  thresholdUsd?: number;
  schedulePattern?: string;
  minSweepValueUsd?: number;
  maxSweepCostPercent?: number;
  spendPermissionSignature: string;
  spendPermissionExpiry: string;        // ISO date string
  spendPermissionMaxAmount: string;
}

/**
 * Update subscription request
 */
export interface UpdateSubscriptionRequest {
  sourceChains?: number[];
  destinationChain?: number;
  destinationAsset?: string;
  destinationProtocol?: string;
  destinationVault?: string;
  triggerType?: TriggerType;
  thresholdUsd?: number;
  schedulePattern?: string;
  minSweepValueUsd?: number;
  maxSweepCostPercent?: number;
}

/**
 * Subscription list response item
 */
export interface SubscriptionListItem {
  id: string;
  walletAddress: string;
  sourceChains: number[];
  destinationChain: number;
  destinationAsset: string;
  destinationProtocol?: string;
  triggerType: TriggerType;
  thresholdUsd?: number;
  schedulePattern?: string;
  status: SubscriptionStatus;
  lastSweepAt?: string;
  nextScheduledAt?: string;
  totalSweeps: number;
  createdAt: string;
}

/**
 * Subscription details response
 */
export interface SubscriptionDetails extends SubscriptionListItem {
  destinationVault?: string;
  minSweepValueUsd: number;
  maxSweepCostPercent: number;
  spendPermissionExpiry: string;
  totalValueSwept: string;
  updatedAt: string;
  recentSweeps: SubscriptionSweepSummary[];
}

/**
 * Sweep summary for subscription details
 */
export interface SubscriptionSweepSummary {
  id: string;
  triggeredBy: string;
  dustValueUsd: number;
  netValueUsd: number;
  tokensSwept: number;
  status: string;
  createdAt: string;
}

// ============================================================================
// Validation Schemas (Zod)
// ============================================================================

export const createSubscriptionSchema = z.object({
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid wallet address"),
  sourceChains: z.array(z.number().int().positive()).min(1, "At least one source chain required"),
  destinationChain: z.number().int().positive(),
  destinationAsset: z.string().min(1, "Destination asset required"),
  destinationProtocol: z.string().optional(),
  destinationVault: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
  triggerType: z.enum(["threshold", "schedule"]),
  thresholdUsd: z.number().positive().optional(),
  schedulePattern: z.string().optional(),
  minSweepValueUsd: z.number().positive().default(5),
  maxSweepCostPercent: z.number().min(1).max(50).default(10),
  spendPermissionSignature: z.string().min(1, "Spend permission signature required"),
  spendPermissionExpiry: z.string().datetime("Invalid expiry date"),
  spendPermissionMaxAmount: z.string().min(1, "Max amount required"),
}).refine(
  (data) => {
    if (data.triggerType === "threshold" && !data.thresholdUsd) {
      return false;
    }
    if (data.triggerType === "schedule" && !data.schedulePattern) {
      return false;
    }
    return true;
  },
  {
    message: "Threshold required for threshold trigger, schedule pattern required for schedule trigger",
  }
);

export const updateSubscriptionSchema = z.object({
  sourceChains: z.array(z.number().int().positive()).min(1).optional(),
  destinationChain: z.number().int().positive().optional(),
  destinationAsset: z.string().min(1).optional(),
  destinationProtocol: z.string().nullable().optional(),
  destinationVault: z.string().regex(/^0x[a-fA-F0-9]{40}$/).nullable().optional(),
  triggerType: z.enum(["threshold", "schedule"]).optional(),
  thresholdUsd: z.number().positive().nullable().optional(),
  schedulePattern: z.string().nullable().optional(),
  minSweepValueUsd: z.number().positive().optional(),
  maxSweepCostPercent: z.number().min(1).max(50).optional(),
});

// ============================================================================
// Constants
// ============================================================================

// Maximum subscription expiry (30 days)
export const MAX_SUBSCRIPTION_EXPIRY_DAYS = 30;

// Minimum sweep interval (6 hours)
export const MIN_SWEEP_INTERVAL_HOURS = 6;

// Default minimum sweep value ($5)
export const DEFAULT_MIN_SWEEP_VALUE_USD = 5;

// Default max sweep cost percentage (10%)
export const DEFAULT_MAX_SWEEP_COST_PERCENT = 10;

// Supported destination assets
export const SUPPORTED_DESTINATION_ASSETS = [
  "USDC",
  "USDT",
  "DAI",
  "ETH",
  "WETH",
] as const;

// Supported destination protocols
export const SUPPORTED_DESTINATION_PROTOCOLS = [
  "aave",
  "yearn",
  "beefy",
  "lido",
] as const;

// Supported chains for auto-sweep
export const SUPPORTED_AUTO_SWEEP_CHAINS: Record<number, string> = {
  1: "ethereum",
  8453: "base",
  42161: "arbitrum",
  137: "polygon",
  10: "optimism",
};

// Spend permission manager contract addresses per chain
export const SPEND_PERMISSION_MANAGER: Record<number, Address> = {
  1: "0x8F3F1F36e1E5F7aB5d4e5E4B5D3E2A1B0C9D8E7F" as Address,      // Ethereum (placeholder)
  8453: "0xB5C5F7aB5d4e5E4B5D3E2A1B0C9D8E7F1A2B3C4" as Address,    // Base
  42161: "0xC6D6F7aB5d4e5E4B5D3E2A1B0C9D8E7F1A2B3D5" as Address,   // Arbitrum
  137: "0xD7E7F7aB5d4e5E4B5D3E2A1B0C9D8E7F1A2B3E6" as Address,     // Polygon
  10: "0xE8F8F7aB5d4e5E4B5D3E2A1B0C9D8E7F1A2B3F7" as Address,      // Optimism
};

// Native token address for spend permissions
export const NATIVE_TOKEN_ADDRESS: Address = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

// Sweep executor address (the spender in spend permissions)
export const SWEEP_EXECUTOR_ADDRESS: Address = "0x1234567890123456789012345678901234567890" as Address;
