/**
 * Tool Marketplace Types
 * @description Type definitions for the decentralized AI tool marketplace
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"

/**
 * Revenue split configuration for a tool
 */
export interface RevenueSplit {
  /** Recipient address */
  address: Address
  /** Percentage of revenue (0-100) */
  percent: number
  /** Optional label (e.g., "creator", "platform", "referrer") */
  label?: string
}

/**
 * Pricing model for a tool
 */
export type PricingModel = "per-call" | "subscription" | "tiered" | "freemium"

/**
 * Subscription tier configuration
 */
export interface SubscriptionTier {
  /** Tier name */
  name: string
  /** Monthly price in USD */
  monthlyPrice: string
  /** Calls included per month */
  callsIncluded: number
  /** Price per call after limit (optional) */
  overagePrice?: string
  /** Features included in this tier */
  features: string[]
}

/**
 * Tiered pricing configuration
 */
export interface TieredPricing {
  /** Usage tiers */
  tiers: {
    /** Minimum calls for this tier */
    minCalls: number
    /** Maximum calls for this tier */
    maxCalls: number
    /** Price per call in this tier */
    pricePerCall: string
  }[]
}

/**
 * Full pricing configuration
 */
export interface ToolPricing {
  /** Pricing model type */
  model: PricingModel
  /** Base price per call (for per-call and freemium models) */
  basePrice?: string
  /** Free calls per day (for freemium model) */
  freeCallsPerDay?: number
  /** Subscription tiers (for subscription model) */
  subscriptionTiers?: SubscriptionTier[]
  /** Tiered pricing config (for tiered model) */
  tieredPricing?: TieredPricing
  /** Accepted tokens */
  acceptedTokens: ("USDs" | "USDC" | "ETH")[]
  /** Supported chains */
  supportedChains: string[]
}

/**
 * Tool category classification
 */
export type ToolCategory =
  | "data"
  | "ai"
  | "defi"
  | "analytics"
  | "social"
  | "utilities"
  | "notifications"
  | "storage"
  | "compute"
  | "other"

/**
 * Tool status
 */
export type ToolStatus = "active" | "paused" | "deprecated" | "pending-review"

/**
 * Tool metadata
 */
export interface ToolMetadata {
  /** Tool version */
  version: string
  /** Last updated timestamp */
  updatedAt: number
  /** Total calls made */
  totalCalls: number
  /** Total revenue generated in USD */
  totalRevenue: string
  /** Average response time in ms */
  avgResponseTime: number
  /** Uptime percentage (0-100) */
  uptime: number
  /** User rating (1-5) */
  rating: number
  /** Number of ratings */
  ratingCount: number
}

/**
 * Tool registration input
 */
export interface RegisterToolInput {
  /** Tool name (unique identifier) */
  name: string
  /** Human-readable display name */
  displayName: string
  /** Tool description */
  description: string
  /** API endpoint URL */
  endpoint: string
  /** Tool category */
  category: ToolCategory
  /** Pricing configuration */
  pricing: ToolPricing
  /** Revenue split configuration */
  revenueSplit: RevenueSplit[]
  /** Tool owner address */
  owner: Address
  /** Documentation URL */
  docsUrl?: string
  /** Icon URL */
  iconUrl?: string
  /** Tags for discovery */
  tags?: string[]
  /** Required authentication headers */
  requiredHeaders?: string[]
}

/**
 * Registered tool (full record)
 */
export interface RegisteredTool extends RegisterToolInput {
  /** On-chain tool ID */
  toolId: string
  /** Registration timestamp */
  registeredAt: number
  /** Current status */
  status: ToolStatus
  /** Metadata stats */
  metadata: ToolMetadata
}

/**
 * Tool discovery filters
 */
export interface ToolDiscoveryFilter {
  /** Maximum price per call */
  maxPrice?: string
  /** Category filter */
  category?: ToolCategory
  /** Pricing model filter */
  pricingModel?: PricingModel
  /** Minimum rating */
  minRating?: number
  /** Search query */
  query?: string
  /** Tags to match */
  tags?: string[]
  /** Only active tools */
  activeOnly?: boolean
  /** Supported chain */
  chain?: string
  /** Sort by field */
  sortBy?: "price" | "rating" | "popularity" | "newest"
  /** Sort direction */
  sortOrder?: "asc" | "desc"
  /** Pagination limit */
  limit?: number
  /** Pagination offset */
  offset?: number
}

/**
 * Tool usage record
 */
export interface ToolUsageRecord {
  /** Usage ID */
  id: string
  /** Tool ID */
  toolId: string
  /** User address */
  userAddress: Address
  /** Timestamp */
  timestamp: number
  /** Amount paid */
  amountPaid: string
  /** Token used */
  token: string
  /** Transaction hash */
  txHash: string
  /** Response time in ms */
  responseTime: number
  /** Success flag */
  success: boolean
  /** Error message if failed */
  error?: string
}

/**
 * Revenue tracking for a tool
 */
export interface ToolRevenue {
  /** Tool ID */
  toolId: string
  /** Total revenue all time */
  totalRevenue: string
  /** Revenue this week */
  weeklyRevenue: string
  /** Revenue this month */
  monthlyRevenue: string
  /** Pending payouts by recipient */
  pendingPayouts: {
    address: Address
    amount: string
  }[]
  /** Last payout timestamp */
  lastPayoutAt?: number
}

/**
 * Creator analytics
 */
export interface CreatorAnalytics {
  /** Creator address */
  creatorAddress: Address
  /** Tools owned */
  toolsOwned: number
  /** Total revenue earned */
  totalRevenue: string
  /** Total calls across all tools */
  totalCalls: number
  /** Average rating across all tools */
  avgRating: number
  /** Revenue by tool */
  revenueByTool: {
    toolId: string
    toolName: string
    revenue: string
    calls: number
  }[]
  /** Weekly revenue history */
  weeklyRevenueHistory: {
    week: string
    revenue: string
  }[]
}

/**
 * Subscription status
 */
export interface SubscriptionStatus {
  /** Subscription ID */
  subscriptionId: string
  /** User address */
  userAddress: Address
  /** Tool ID */
  toolId: string
  /** Tier name */
  tierName: string
  /** Start date */
  startDate: number
  /** End date */
  endDate: number
  /** Calls used this period */
  callsUsed: number
  /** Calls remaining */
  callsRemaining: number
  /** Auto-renew enabled */
  autoRenew: boolean
  /** Last payment timestamp */
  lastPayment: number
  /** Next payment due */
  nextPaymentDue: number
}

/**
 * Marketplace statistics
 */
export interface MarketplaceStats {
  /** Total tools registered */
  totalTools: number
  /** Active tools */
  activeTools: number
  /** Total creators */
  totalCreators: number
  /** Total volume (all time) */
  totalVolume: string
  /** Volume last 24h */
  volume24h: string
  /** Volume last 7 days */
  volume7d: string
  /** Total calls (all time) */
  totalCalls: number
  /** Average tool price */
  avgToolPrice: string
  /** Most popular category */
  topCategory: ToolCategory
  /** Top tools by revenue */
  topToolsByRevenue: {
    toolId: string
    name: string
    revenue: string
  }[]
}

/**
 * Event types for marketplace
 */
export type MarketplaceEventType =
  | "tool-registered"
  | "tool-updated"
  | "tool-paused"
  | "tool-activated"
  | "tool-called"
  | "payment-received"
  | "payout-executed"
  | "subscription-created"
  | "subscription-renewed"
  | "subscription-cancelled"

/**
 * Marketplace event
 */
export interface MarketplaceEvent {
  /** Event type */
  type: MarketplaceEventType
  /** Event timestamp */
  timestamp: number
  /** Tool ID (if applicable) */
  toolId?: string
  /** User address (if applicable) */
  userAddress?: Address
  /** Amount (if applicable) */
  amount?: string
  /** Transaction hash (if applicable) */
  txHash?: string
  /** Additional data */
  data?: Record<string, unknown>
}

/**
 * Payout configuration
 */
export interface PayoutConfig {
  /** Minimum amount for payout */
  minPayoutAmount: string
  /** Payout frequency in days */
  payoutFrequencyDays: number
  /** Auto-payout enabled */
  autoPayoutEnabled: boolean
  /** Payout token */
  payoutToken: "USDs" | "USDC"
}
