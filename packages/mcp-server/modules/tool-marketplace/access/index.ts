/**
 * Access Control Module Exports
 * @description Barrel exports for API key management, rate limiting, and access control
 * @author nirholas
 * @license Apache-2.0
 */

// Types
export type {
  // Core types
  PermissionScope,
  Permission,
  RatePeriod,
  RateLimit,
  RateLimitStatus,
  RateLimitHeaders,
  
  // API Key types
  CreateKeyOptions,
  APIKey,
  APIKeyWithSecret,
  KeyValidationResult,
  KeyRotationResult,
  
  // Access Tier types
  AccessTierName,
  AccessTier,
  
  // Quota types
  OverageStrategy,
  QuotaConfig,
  QuotaStatus,
  
  // List types
  ListEntryType,
  ListEntry,
  AllowlistEntry,
  BlocklistEntry,
  GeoRestriction,
  
  // Subscription types
  SubscriptionState,
  Subscription,
  CreateSubscriptionInput,
  ChangeSubscriptionInput,
  
  // Event types
  AccessEventType,
  AccessEvent,
  AccessWebhook,
  
  // Audit types
  AuditLogEntry,
  
  // Storage types
  AccessStorageAdapter,
} from "./types.js"

// Key Manager
export {
  KeyManager,
  keyManager,
} from "./key-manager.js"

// Rate Limiter
export {
  RateLimiter,
  rateLimiter,
  TokenBucketRateLimiter,
  tokenBucketLimiter,
  GLOBAL_RATE_LIMITS,
  type RateLimitScope,
  type RateLimitCheckOptions,
} from "./rate-limiter.js"

// Quotas
export {
  QuotaManager,
  quotaManager,
  checkQuota,
  DEFAULT_QUOTA_CONFIG,
  type QuotaCheckResult,
} from "./quotas.js"

// Access Tiers
export {
  DEFAULT_TIERS,
  TIER_ORDER,
  getTier,
  getAllTiers,
  isTierHigher,
  isTierLower,
  getNextTier,
  getPreviousTier,
  periodToMs,
  periodToSeconds,
  calculateRps,
  isValidTierName,
  getTierPriceNumber,
  calculateProratedPrice,
  getTierFeaturesDiff,
  mergeCustomTiers,
  type CustomTierConfig,
} from "./tiers.js"

// Access Lists
export {
  AccessListManager,
  accessListManager,
  StrikeManager,
  strikeManager,
} from "./lists.js"

// Subscriptions
export {
  SubscriptionManager,
  subscriptionManager,
  SubscriptionRenewalScheduler,
  type PaymentProcessor,
} from "./subscriptions.js"

// Storage
export {
  InMemoryStorageAdapter,
  defaultStorage,
} from "./storage.js"

// MCP Tools
export {
  registerAccessControlTools,
} from "./tools.js"
