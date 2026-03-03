/**
 * Access Tiers Configuration
 * @description Default access tier definitions for the marketplace
 * @author nirholas
 * @license Apache-2.0
 */

import type { AccessTier, AccessTierName, RateLimit, RatePeriod } from "./types.js"

/**
 * Default access tiers for the marketplace
 */
export const DEFAULT_TIERS: Record<AccessTierName, AccessTier> = {
  free: {
    name: "free",
    rateLimit: { requests: 10, period: "minute" },
    monthlyQuota: 1000,
    features: [
      "Basic API access",
      "Community support",
      "Standard response time",
    ],
    price: "0",
    description: "Free tier for getting started",
  },
  basic: {
    name: "basic",
    rateLimit: { requests: 60, period: "minute" },
    monthlyQuota: 10000,
    features: [
      "Higher rate limits",
      "Email support",
      "Usage analytics",
      "Webhook notifications",
    ],
    price: "9.99",
    description: "For individual developers and small projects",
  },
  pro: {
    name: "pro",
    rateLimit: { requests: 300, period: "minute" },
    monthlyQuota: 100000,
    features: [
      "High-volume rate limits",
      "Priority support",
      "Advanced analytics",
      "Custom webhooks",
      "Multiple API keys",
      "Team access",
    ],
    price: "49.99",
    description: "For professional developers and growing teams",
    prioritySupport: true,
  },
  enterprise: {
    name: "enterprise",
    rateLimit: { requests: 1000, period: "minute" },
    monthlyQuota: -1, // Unlimited
    features: [
      "Unlimited requests",
      "24/7 dedicated support",
      "Custom SLAs",
      "Advanced analytics & reporting",
      "Custom integrations",
      "Dedicated account manager",
      "Custom branding",
      "SSO/SAML support",
    ],
    price: "custom",
    description: "Custom solutions for large organizations",
    prioritySupport: true,
    customBranding: true,
  },
}

/**
 * Tier order for comparison (lower index = lower tier)
 */
export const TIER_ORDER: AccessTierName[] = ["free", "basic", "pro", "enterprise"]

/**
 * Get tier by name
 */
export function getTier(name: AccessTierName): AccessTier {
  return DEFAULT_TIERS[name]
}

/**
 * Get all tiers
 */
export function getAllTiers(): AccessTier[] {
  return Object.values(DEFAULT_TIERS)
}

/**
 * Check if a tier is higher than another
 */
export function isTierHigher(tier: AccessTierName, compareTo: AccessTierName): boolean {
  return TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(compareTo)
}

/**
 * Check if a tier is lower than another
 */
export function isTierLower(tier: AccessTierName, compareTo: AccessTierName): boolean {
  return TIER_ORDER.indexOf(tier) < TIER_ORDER.indexOf(compareTo)
}

/**
 * Get the next higher tier (returns undefined if already at highest)
 */
export function getNextTier(current: AccessTierName): AccessTierName | undefined {
  const currentIndex = TIER_ORDER.indexOf(current)
  if (currentIndex < TIER_ORDER.length - 1) {
    return TIER_ORDER[currentIndex + 1]
  }
  return undefined
}

/**
 * Get the previous lower tier (returns undefined if already at lowest)
 */
export function getPreviousTier(current: AccessTierName): AccessTierName | undefined {
  const currentIndex = TIER_ORDER.indexOf(current)
  if (currentIndex > 0) {
    return TIER_ORDER[currentIndex - 1]
  }
  return undefined
}

/**
 * Convert rate period to milliseconds
 */
export function periodToMs(period: RatePeriod): number {
  switch (period) {
    case "second":
      return 1000
    case "minute":
      return 60 * 1000
    case "hour":
      return 60 * 60 * 1000
    case "day":
      return 24 * 60 * 60 * 1000
  }
}

/**
 * Convert rate period to seconds
 */
export function periodToSeconds(period: RatePeriod): number {
  return periodToMs(period) / 1000
}

/**
 * Calculate requests per second for a rate limit
 */
export function calculateRps(rateLimit: RateLimit): number {
  const periodSeconds = periodToSeconds(rateLimit.period)
  return rateLimit.requests / periodSeconds
}

/**
 * Validate tier name
 */
export function isValidTierName(name: string): name is AccessTierName {
  return TIER_ORDER.includes(name as AccessTierName)
}

/**
 * Get tier price as a number (returns -1 for custom pricing)
 */
export function getTierPriceNumber(tier: AccessTierName): number {
  const price = DEFAULT_TIERS[tier].price
  if (price === "custom") {
    return -1
  }
  return parseFloat(price)
}

/**
 * Calculate prorated price for tier change
 */
export function calculateProratedPrice(
  currentTier: AccessTierName,
  newTier: AccessTierName,
  daysRemaining: number,
  totalDays: number = 30
): { amount: string; isCredit: boolean } {
  const currentPrice = getTierPriceNumber(currentTier)
  const newPrice = getTierPriceNumber(newTier)

  // Handle custom pricing
  if (currentPrice === -1 || newPrice === -1) {
    return { amount: "custom", isCredit: false }
  }

  const proratedCurrent = (currentPrice / totalDays) * daysRemaining
  const proratedNew = (newPrice / totalDays) * daysRemaining
  const difference = proratedNew - proratedCurrent

  return {
    amount: Math.abs(difference).toFixed(2),
    isCredit: difference < 0,
  }
}

/**
 * Get tier features diff (what's new in the higher tier)
 */
export function getTierFeaturesDiff(
  lowerTier: AccessTierName,
  higherTier: AccessTierName
): string[] {
  const lowerFeatures = new Set(DEFAULT_TIERS[lowerTier].features)
  return DEFAULT_TIERS[higherTier].features.filter((f) => !lowerFeatures.has(f))
}

/**
 * Custom tier configuration for tool creators
 */
export interface CustomTierConfig {
  /** Tool ID */
  toolId: string
  /** Custom tiers (overrides defaults) */
  tiers: Partial<Record<AccessTierName, Partial<AccessTier>>>
  /** Additional custom tiers */
  customTiers?: AccessTier[]
}

/**
 * Merge custom tier config with defaults
 */
export function mergeCustomTiers(
  config?: CustomTierConfig
): Record<AccessTierName, AccessTier> {
  if (!config) {
    return { ...DEFAULT_TIERS }
  }

  const merged = { ...DEFAULT_TIERS }

  for (const [tierName, customConfig] of Object.entries(config.tiers || {})) {
    if (isValidTierName(tierName)) {
      merged[tierName] = {
        ...merged[tierName],
        ...customConfig,
      } as AccessTier
    }
  }

  return merged
}
