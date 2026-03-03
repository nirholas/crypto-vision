/**
 * Access Control & API Key Management Types
 * @description Type definitions for access control, API keys, rate limiting, and subscriptions
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"

// ============================================================================
// Permission Types
// ============================================================================

/**
 * Permission scope for API keys
 */
export type PermissionScope = "read" | "write" | "admin"

/**
 * Permission for a specific tool operation
 */
export interface Permission {
  /** Tool ID this permission applies to (or "*" for all tools) */
  toolId: string
  /** Permission scope */
  scope: PermissionScope
  /** Specific actions allowed (optional, defaults to all within scope) */
  actions?: string[]
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

/**
 * Time period for rate limiting
 */
export type RatePeriod = "second" | "minute" | "hour" | "day"

/**
 * Rate limit configuration
 */
export interface RateLimit {
  /** Maximum requests allowed */
  requests: number
  /** Time period for the limit */
  period: RatePeriod
}

/**
 * Rate limit status for a key or user
 */
export interface RateLimitStatus {
  /** Whether the rate limit is exceeded */
  limited: boolean
  /** Remaining requests in current window */
  remaining: number
  /** Total requests allowed */
  limit: number
  /** Time until reset (in seconds) */
  resetIn: number
  /** Timestamp when limit resets (Unix ms) */
  resetAt: number
}

/**
 * Rate limit headers for HTTP responses
 */
export interface RateLimitHeaders {
  "X-RateLimit-Limit": string
  "X-RateLimit-Remaining": string
  "X-RateLimit-Reset": string
  "Retry-After"?: string
}

// ============================================================================
// API Key Types
// ============================================================================

/**
 * API key creation options
 */
export interface CreateKeyOptions {
  /** Human-readable name for the key */
  name: string
  /** Permissions for this key */
  permissions?: Permission[]
  /** Custom rate limit (overrides tier default) */
  rateLimit?: RateLimit
  /** Key expiration timestamp (Unix ms) */
  expiresAt?: number
  /** Metadata for the key */
  metadata?: Record<string, unknown>
}

/**
 * API key record
 */
export interface APIKey {
  /** Unique key identifier */
  id: string
  /** Tool ID this key is for */
  toolId: string
  /** User who owns this key */
  userId: Address
  /** Hashed key value (bcrypt) */
  keyHash: string
  /** Key prefix for identification (e.g., "mk_abc...xyz") */
  keyPrefix: string
  /** Human-readable name */
  name: string
  /** Permissions granted */
  permissions: Permission[]
  /** Rate limit for this key */
  rateLimit: RateLimit
  /** Access tier */
  tier: AccessTierName
  /** Expiration timestamp (Unix ms), undefined = never */
  expiresAt?: number
  /** Creation timestamp (Unix ms) */
  createdAt: number
  /** Last used timestamp (Unix ms) */
  lastUsedAt?: number
  /** Total usage count */
  usageCount: number
  /** Is the key active */
  isActive: boolean
  /** Revocation timestamp if revoked */
  revokedAt?: number
  /** Reason for revocation */
  revocationReason?: string
  /** Key metadata */
  metadata?: Record<string, unknown>
}

/**
 * Full API key (returned only at creation)
 */
export interface APIKeyWithSecret extends Omit<APIKey, "keyHash"> {
  /** The full API key (only shown once) */
  key: string
}

/**
 * Key validation result
 */
export interface KeyValidationResult {
  /** Whether the key is valid */
  valid: boolean
  /** The key record if valid */
  key?: APIKey
  /** Error message if invalid */
  error?: string
  /** Error code for programmatic handling */
  errorCode?: "INVALID_KEY" | "EXPIRED" | "REVOKED" | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "BLOCKED"
  /** Rate limit status */
  rateLimitStatus?: RateLimitStatus
}

/**
 * Key rotation result
 */
export interface KeyRotationResult {
  /** New API key */
  newKey: APIKeyWithSecret
  /** Old key ID (will expire in 24h) */
  oldKeyId: string
  /** When old key expires */
  oldKeyExpiresAt: number
}

// ============================================================================
// Access Tier Types
// ============================================================================

/**
 * Access tier names
 */
export type AccessTierName = "free" | "basic" | "pro" | "enterprise"

/**
 * Access tier configuration
 */
export interface AccessTier {
  /** Tier name */
  name: AccessTierName
  /** Rate limit configuration */
  rateLimit: RateLimit
  /** Monthly quota (-1 for unlimited) */
  monthlyQuota: number
  /** Features included in this tier */
  features: string[]
  /** Monthly price in USD */
  price: string
  /** Description */
  description?: string
  /** Priority support */
  prioritySupport?: boolean
  /** Custom branding allowed */
  customBranding?: boolean
}

// ============================================================================
// Quota Types
// ============================================================================

/**
 * Overage handling strategy
 */
export type OverageStrategy = "block" | "allow_premium" | "notify" | "throttle"

/**
 * Usage quota configuration
 */
export interface QuotaConfig {
  /** Monthly quota limit */
  monthlyLimit: number
  /** Daily quota limit (optional) */
  dailyLimit?: number
  /** Overage handling strategy */
  overageStrategy: OverageStrategy
  /** Premium rate for overage (if allow_premium) */
  overageRate?: string
  /** Notification threshold (percentage) */
  notifyThreshold?: number
  /** Throttle rate when exceeded (if throttle) */
  throttleRate?: number
}

/**
 * Quota status
 */
export interface QuotaStatus {
  /** Key or user ID */
  id: string
  /** Tool ID */
  toolId: string
  /** Current period (month) */
  period: string
  /** Calls used this period */
  used: number
  /** Quota limit */
  limit: number
  /** Remaining calls */
  remaining: number
  /** Percentage used */
  percentUsed: number
  /** Is quota exceeded */
  exceeded: boolean
  /** When quota resets (Unix ms) */
  resetsAt: number
  /** Overage calls (if any) */
  overage?: number
  /** Overage charges (if any) */
  overageCharges?: string
}

// ============================================================================
// Allowlist/Blocklist Types
// ============================================================================

/**
 * List entry type
 */
export type ListEntryType = "address" | "ip" | "cidr"

/**
 * List entry
 */
export interface ListEntry {
  /** Entry ID */
  id: string
  /** Tool ID this entry applies to */
  toolId: string
  /** Entry type */
  type: ListEntryType
  /** Value (address, IP, or CIDR) */
  value: string
  /** Reason for listing */
  reason?: string
  /** Created by (address) */
  createdBy: Address
  /** Creation timestamp */
  createdAt: number
  /** Expiration timestamp (undefined = permanent) */
  expiresAt?: number
}

/**
 * Allowlist entry
 */
export interface AllowlistEntry extends ListEntry {
  /** Special permissions for allowlisted users */
  permissions?: Permission[]
  /** Custom rate limit for allowlisted users */
  customRateLimit?: RateLimit
}

/**
 * Blocklist entry
 */
export interface BlocklistEntry extends ListEntry {
  /** Severity level */
  severity: "low" | "medium" | "high" | "critical"
  /** Number of strikes before this block */
  strikes?: number
}

/**
 * Geographic restriction
 */
export interface GeoRestriction {
  /** Tool ID */
  toolId: string
  /** Restriction mode */
  mode: "allow" | "block"
  /** Country codes (ISO 3166-1 alpha-2) */
  countries: string[]
  /** Created by */
  createdBy: Address
  /** Creation timestamp */
  createdAt: number
}

// ============================================================================
// Subscription Types
// ============================================================================

/**
 * Subscription status
 */
export type SubscriptionState = 
  | "active"
  | "past_due"
  | "canceled"
  | "expired"
  | "paused"
  | "trialing"

/**
 * Subscription record
 */
export interface Subscription {
  /** Subscription ID */
  id: string
  /** User address */
  userId: Address
  /** Tool ID */
  toolId: string
  /** Access tier */
  tier: AccessTierName
  /** Subscription state */
  state: SubscriptionState
  /** Start timestamp */
  startedAt: number
  /** Current period start */
  currentPeriodStart: number
  /** Current period end */
  currentPeriodEnd: number
  /** Auto-renew enabled */
  autoRenew: boolean
  /** Calls used this period */
  callsUsed: number
  /** Payment token */
  paymentToken: "USDs" | "USDC"
  /** Payment chain */
  paymentChain: string
  /** Last payment timestamp */
  lastPaymentAt?: number
  /** Last payment amount */
  lastPaymentAmount?: string
  /** Last payment tx hash */
  lastPaymentTxHash?: string
  /** Failed payment count */
  failedPayments: number
  /** Grace period end (if past_due) */
  gracePeriodEnd?: number
  /** Cancellation timestamp */
  canceledAt?: number
  /** Cancellation reason */
  cancellationReason?: string
  /** Created timestamp */
  createdAt: number
  /** Updated timestamp */
  updatedAt: number
}

/**
 * Subscription creation input
 */
export interface CreateSubscriptionInput {
  /** User address */
  userId: Address
  /** Tool ID */
  toolId: string
  /** Access tier */
  tier: AccessTierName
  /** Payment token */
  paymentToken: "USDs" | "USDC"
  /** Payment chain */
  paymentChain: string
  /** Auto-renew enabled */
  autoRenew?: boolean
}

/**
 * Subscription upgrade/downgrade input
 */
export interface ChangeSubscriptionInput {
  /** Subscription ID */
  subscriptionId: string
  /** New tier */
  newTier: AccessTierName
  /** Prorate charges/credits */
  prorate?: boolean
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Access control event types
 */
export type AccessEventType =
  | "key_created"
  | "key_revoked"
  | "key_rotated"
  | "key_expired"
  | "rate_limit_hit"
  | "quota_exceeded"
  | "quota_warning"
  | "user_blocked"
  | "user_unblocked"
  | "subscription_created"
  | "subscription_renewed"
  | "subscription_canceled"
  | "subscription_upgraded"
  | "subscription_downgraded"
  | "payment_failed"

/**
 * Access control event
 */
export interface AccessEvent {
  /** Event type */
  type: AccessEventType
  /** Event timestamp */
  timestamp: number
  /** Key ID (if applicable) */
  keyId?: string
  /** User address (if applicable) */
  userId?: Address
  /** Tool ID (if applicable) */
  toolId?: string
  /** Additional event data */
  data?: Record<string, unknown>
}

/**
 * Webhook configuration for access events
 */
export interface AccessWebhook {
  /** Webhook ID */
  id: string
  /** Tool ID */
  toolId: string
  /** Webhook URL */
  url: string
  /** Events to subscribe to */
  events: AccessEventType[]
  /** Secret for signature verification */
  secret: string
  /** Is webhook active */
  isActive: boolean
  /** Created timestamp */
  createdAt: number
}

// ============================================================================
// Audit Types
// ============================================================================

/**
 * Audit log entry
 */
export interface AuditLogEntry {
  /** Entry ID */
  id: string
  /** Timestamp */
  timestamp: number
  /** Action type */
  action: AccessEventType
  /** Actor address */
  actor: Address
  /** Target (key ID, subscription ID, etc.) */
  target: string
  /** Target type */
  targetType: "key" | "subscription" | "user" | "tool"
  /** IP address of actor */
  ipAddress?: string
  /** User agent */
  userAgent?: string
  /** Additional details */
  details?: Record<string, unknown>
  /** Was action successful */
  success: boolean
  /** Error message if failed */
  error?: string
}

// ============================================================================
// Storage Interface
// ============================================================================

/**
 * Storage adapter interface for access control data
 */
export interface AccessStorageAdapter {
  // Keys
  saveKey(key: APIKey): Promise<void>
  getKey(keyId: string): Promise<APIKey | null>
  getKeyByHash(keyHash: string): Promise<APIKey | null>
  getKeysByUser(userId: Address): Promise<APIKey[]>
  getKeysByTool(toolId: string): Promise<APIKey[]>
  updateKey(keyId: string, updates: Partial<APIKey>): Promise<void>
  deleteKey(keyId: string): Promise<void>

  // Subscriptions
  saveSubscription(subscription: Subscription): Promise<void>
  getSubscription(subscriptionId: string): Promise<Subscription | null>
  getSubscriptionByUserAndTool(userId: Address, toolId: string): Promise<Subscription | null>
  getSubscriptionsByUser(userId: Address): Promise<Subscription[]>
  getSubscriptionsByTool(toolId: string): Promise<Subscription[]>
  updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<void>

  // Lists
  saveAllowlistEntry(entry: AllowlistEntry): Promise<void>
  getallowlist(toolId: string): Promise<AllowlistEntry[]>
  removeAllowlistEntry(entryId: string): Promise<void>
  saveBlocklistEntry(entry: BlocklistEntry): Promise<void>
  getBlocklist(toolId: string): Promise<BlocklistEntry[]>
  removeBlocklistEntry(entryId: string): Promise<void>
  saveGeoRestriction(restriction: GeoRestriction): Promise<void>
  getGeoRestriction(toolId: string): Promise<GeoRestriction | null>

  // Rate limiting (Redis-like operations)
  getRateCount(key: string): Promise<number>
  incrementRateCount(key: string, ttlSeconds: number): Promise<number>
  
  // Quota tracking
  getQuotaUsage(key: string, period: string): Promise<number>
  incrementQuotaUsage(key: string, period: string, amount?: number): Promise<number>

  // Audit
  saveAuditLog(entry: AuditLogEntry): Promise<void>
  getAuditLogs(filter: { toolId?: string; userId?: Address; action?: AccessEventType; limit?: number }): Promise<AuditLogEntry[]>

  // Webhooks
  saveWebhook(webhook: AccessWebhook): Promise<void>
  getWebhooks(toolId: string): Promise<AccessWebhook[]>
  updateWebhook(webhookId: string, updates: Partial<AccessWebhook>): Promise<void>
  deleteWebhook(webhookId: string): Promise<void>
}
