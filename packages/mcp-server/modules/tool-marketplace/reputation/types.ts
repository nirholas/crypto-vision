/**
 * Reputation System Types
 * @description Type definitions for the tool reputation system
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"

/**
 * Trust tier levels
 */
export type TrustTier = "bronze" | "silver" | "gold" | "platinum"

/**
 * Rating value (1-5 stars)
 */
export type RatingValue = 1 | 2 | 3 | 4 | 5

/**
 * Individual rating
 */
export interface Rating {
  /** Unique rating ID */
  id: string
  /** Tool being rated */
  toolId: string
  /** User who submitted the rating */
  userAddress: Address
  /** Rating value (1-5) */
  value: RatingValue
  /** Optional review text */
  review?: string
  /** Timestamp of rating */
  timestamp: number
  /** Weight based on user's usage volume */
  weight: number
  /** Whether rating is verified (user actually used the tool) */
  verified: boolean
  /** Transaction hash proving usage */
  usageTxHash?: string
}

/**
 * Rating summary for a tool
 */
export interface RatingSummary {
  /** Tool ID */
  toolId: string
  /** Average rating (1-5) */
  averageRating: number
  /** Weighted average rating */
  weightedAverageRating: number
  /** Total number of ratings */
  totalRatings: number
  /** Number of verified ratings */
  verifiedRatings: number
  /** Distribution of ratings */
  distribution: {
    1: number
    2: number
    3: number
    4: number
    5: number
  }
  /** Last rating timestamp */
  lastRatingAt?: number
}

/**
 * Reputation score breakdown
 */
export interface ReputationScoreBreakdown {
  /** Uptime score component (0-100) */
  uptimeScore: number
  /** Rating score component (0-100) */
  ratingScore: number
  /** Volume score component (0-100) */
  volumeScore: number
  /** Age score component (0-100) */
  ageScore: number
  /** Weights used */
  weights: {
    uptime: number
    rating: number
    volume: number
    age: number
  }
}

/**
 * Full reputation score
 */
export interface ReputationScore {
  /** Tool ID */
  toolId: string
  /** Composite score (0-100) */
  score: number
  /** Trust tier */
  tier: TrustTier
  /** Score breakdown */
  breakdown: ReputationScoreBreakdown
  /** Earned badges */
  badges: ReputationBadge[]
  /** Last calculated */
  calculatedAt: number
  /** Score change from last calculation */
  change: number
  /** Trend direction */
  trend: "up" | "down" | "stable"
}

/**
 * Reputation badge types
 */
export type BadgeType =
  | "verified"
  | "high_volume"
  | "top_rated"
  | "new"
  | "trending"
  | "premium"
  | "security_audited"
  | "fast_response"
  | "reliable"

/**
 * Reputation badge
 */
export interface ReputationBadge {
  /** Badge type */
  type: BadgeType
  /** Display label */
  label: string
  /** Badge icon */
  icon: string
  /** When badge was earned */
  earnedAt: number
  /** When badge expires (optional) */
  expiresAt?: number
  /** Additional metadata */
  metadata?: Record<string, unknown>
}

/**
 * Rating rate limit record
 */
export interface RatingRateLimit {
  /** User address */
  userAddress: Address
  /** Tool ID */
  toolId: string
  /** Last rating timestamp */
  lastRatingAt: number
  /** Can rate again after */
  canRateAgainAt: number
}

/**
 * Rating report (for abuse detection)
 */
export interface RatingReport {
  /** Report ID */
  id: string
  /** Rating being reported */
  ratingId: string
  /** User reporting */
  reporterAddress: Address
  /** Reason for report */
  reason: "spam" | "fake" | "inappropriate" | "manipulation" | "other"
  /** Additional details */
  details?: string
  /** Timestamp */
  timestamp: number
  /** Status */
  status: "pending" | "reviewed" | "upheld" | "dismissed"
}

/**
 * Tool report (for malicious tools)
 */
export interface ToolReport {
  /** Report ID */
  id: string
  /** Tool being reported */
  toolId: string
  /** User reporting */
  reporterAddress: Address
  /** Report category */
  category: "malicious" | "scam" | "broken" | "misleading" | "privacy" | "other"
  /** Severity */
  severity: "low" | "medium" | "high" | "critical"
  /** Description */
  description: string
  /** Evidence (URLs, screenshots, etc.) */
  evidence?: string[]
  /** Timestamp */
  timestamp: number
  /** Status */
  status: "pending" | "investigating" | "confirmed" | "dismissed"
  /** Resolution notes */
  resolution?: string
}

/**
 * Reputation history entry
 */
export interface ReputationHistoryEntry {
  /** Timestamp */
  timestamp: number
  /** Score at this point */
  score: number
  /** Tier at this point */
  tier: TrustTier
  /** Event that caused change */
  event?: string
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  /** Rank position */
  rank: number
  /** Tool ID */
  toolId: string
  /** Tool display name */
  displayName: string
  /** Reputation score */
  score: number
  /** Trust tier */
  tier: TrustTier
  /** Badges */
  badges: ReputationBadge[]
  /** Total ratings */
  totalRatings: number
  /** Average rating */
  averageRating: number
}
