/**
 * Rating Service
 * @description Manages tool ratings and reviews with anti-manipulation measures
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type { Address } from "viem"
import type {
  Rating,
  RatingSummary,
  RatingValue,
  RatingRateLimit,
  RatingReport,
} from "./types.js"

/**
 * Configuration for the rating service
 */
export interface RatingServiceConfig {
  /** Minimum time between ratings for same tool (ms) - default 7 days */
  rateLimitPeriod: number
  /** Rating decay half-life in days */
  decayHalfLifeDays: number
  /** Minimum usage count to be considered high-volume user */
  highVolumeThreshold: number
  /** Weight multiplier for verified ratings */
  verifiedMultiplier: number
  /** Weight multiplier for high-volume users */
  highVolumeMultiplier: number
}

const DEFAULT_CONFIG: RatingServiceConfig = {
  rateLimitPeriod: 7 * 24 * 60 * 60 * 1000, // 7 days
  decayHalfLifeDays: 90, // 90 days
  highVolumeThreshold: 50,
  verifiedMultiplier: 1.5,
  highVolumeMultiplier: 1.3,
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * In-memory storage for ratings
 */
interface RatingStorage {
  ratings: Map<string, Rating>
  ratingsByTool: Map<string, string[]>
  ratingsByUser: Map<string, string[]>
  rateLimits: Map<string, RatingRateLimit>
  reports: Map<string, RatingReport>
  userUsageCount: Map<string, Map<string, number>> // userAddress -> toolId -> usageCount
}

const storage: RatingStorage = {
  ratings: new Map(),
  ratingsByTool: new Map(),
  ratingsByUser: new Map(),
  rateLimits: new Map(),
  reports: new Map(),
  userUsageCount: new Map(),
}

/**
 * Rating Service
 * Manages tool ratings with weighting, decay, and anti-manipulation measures
 */
export class RatingService {
  private config: RatingServiceConfig

  constructor(config: Partial<RatingServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Submit a rating for a tool
   */
  async submitRating(
    toolId: string,
    userAddress: Address,
    value: RatingValue,
    review?: string,
    usageTxHash?: string
  ): Promise<Rating> {
    // Check rate limit
    const rateLimitKey = `${userAddress}:${toolId}`
    const rateLimit = storage.rateLimits.get(rateLimitKey)

    if (rateLimit && Date.now() < rateLimit.canRateAgainAt) {
      const waitTime = Math.ceil((rateLimit.canRateAgainAt - Date.now()) / (1000 * 60 * 60))
      throw new Error(
        `Rate limited: You can rate this tool again in ${waitTime} hours`
      )
    }

    // Calculate weight
    const weight = this.calculateRatingWeight(userAddress, toolId, !!usageTxHash)

    // Create rating
    const rating: Rating = {
      id: generateId("rating"),
      toolId,
      userAddress,
      value,
      review,
      timestamp: Date.now(),
      weight,
      verified: !!usageTxHash,
      usageTxHash,
    }

    // Store rating
    storage.ratings.set(rating.id, rating)

    // Update tool ratings index
    const toolRatings = storage.ratingsByTool.get(toolId) || []
    toolRatings.push(rating.id)
    storage.ratingsByTool.set(toolId, toolRatings)

    // Update user ratings index
    const userRatings = storage.ratingsByUser.get(userAddress) || []
    userRatings.push(rating.id)
    storage.ratingsByUser.set(userAddress, userRatings)

    // Update rate limit
    storage.rateLimits.set(rateLimitKey, {
      userAddress,
      toolId,
      lastRatingAt: Date.now(),
      canRateAgainAt: Date.now() + this.config.rateLimitPeriod,
    })

    Logger.info(`Rating submitted: ${rating.id} for tool ${toolId} by ${userAddress}`)

    return rating
  }

  /**
   * Calculate rating weight based on various factors
   */
  private calculateRatingWeight(
    userAddress: Address,
    toolId: string,
    verified: boolean
  ): number {
    let weight = 1.0

    // Boost for verified ratings (user actually used the tool)
    if (verified) {
      weight *= this.config.verifiedMultiplier
    }

    // Boost for high-volume users
    const userUsage = storage.userUsageCount.get(userAddress)
    if (userUsage) {
      const toolUsage = userUsage.get(toolId) || 0
      if (toolUsage >= this.config.highVolumeThreshold) {
        weight *= this.config.highVolumeMultiplier
      }
    }

    return weight
  }

  /**
   * Apply time decay to a rating weight
   */
  private applyDecay(rating: Rating): number {
    const ageInDays = (Date.now() - rating.timestamp) / (1000 * 60 * 60 * 24)
    const decayFactor = Math.pow(0.5, ageInDays / this.config.decayHalfLifeDays)
    return rating.weight * decayFactor
  }

  /**
   * Get rating by ID
   */
  getRating(ratingId: string): Rating | null {
    return storage.ratings.get(ratingId) || null
  }

  /**
   * Get all ratings for a tool
   */
  getToolRatings(toolId: string): Rating[] {
    const ratingIds = storage.ratingsByTool.get(toolId) || []
    return ratingIds
      .map((id) => storage.ratings.get(id))
      .filter((r): r is Rating => r !== undefined)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get rating summary for a tool
   */
  getRatingSummary(toolId: string): RatingSummary {
    const ratings = this.getToolRatings(toolId)

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    let totalValue = 0
    let totalWeight = 0
    let verifiedCount = 0

    for (const rating of ratings) {
      distribution[rating.value]++
      totalValue += rating.value

      // Apply decay to weight
      const decayedWeight = this.applyDecay(rating)
      totalWeight += decayedWeight

      if (rating.verified) {
        verifiedCount++
      }
    }

    // Calculate weighted average
    let weightedSum = 0
    let weightSum = 0
    for (const rating of ratings) {
      const decayedWeight = this.applyDecay(rating)
      weightedSum += rating.value * decayedWeight
      weightSum += decayedWeight
    }

    const averageRating = ratings.length > 0 ? totalValue / ratings.length : 0
    const weightedAverageRating = weightSum > 0 ? weightedSum / weightSum : 0

    return {
      toolId,
      averageRating: Math.round(averageRating * 100) / 100,
      weightedAverageRating: Math.round(weightedAverageRating * 100) / 100,
      totalRatings: ratings.length,
      verifiedRatings: verifiedCount,
      distribution,
      lastRatingAt: ratings.length > 0 ? ratings[0]?.timestamp : undefined,
    }
  }

  /**
   * Get user's rating for a tool
   */
  getUserRatingForTool(userAddress: Address, toolId: string): Rating | null {
    const userRatings = storage.ratingsByUser.get(userAddress) || []
    
    for (const ratingId of userRatings) {
      const rating = storage.ratings.get(ratingId)
      if (rating && rating.toolId === toolId) {
        return rating
      }
    }

    return null
  }

  /**
   * Update a rating
   */
  async updateRating(
    ratingId: string,
    userAddress: Address,
    value: RatingValue,
    review?: string
  ): Promise<Rating> {
    const rating = storage.ratings.get(ratingId)

    if (!rating) {
      throw new Error("Rating not found")
    }

    if (rating.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error("Only the rating owner can update it")
    }

    // Update rating
    rating.value = value
    if (review !== undefined) {
      rating.review = review
    }
    rating.timestamp = Date.now()

    storage.ratings.set(ratingId, rating)

    Logger.info(`Rating updated: ${ratingId}`)

    return rating
  }

  /**
   * Delete a rating
   */
  async deleteRating(ratingId: string, userAddress: Address): Promise<void> {
    const rating = storage.ratings.get(ratingId)

    if (!rating) {
      throw new Error("Rating not found")
    }

    if (rating.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      throw new Error("Only the rating owner can delete it")
    }

    // Remove from storage
    storage.ratings.delete(ratingId)

    // Remove from tool index
    const toolRatings = storage.ratingsByTool.get(rating.toolId) || []
    const toolIndex = toolRatings.indexOf(ratingId)
    if (toolIndex !== -1) {
      toolRatings.splice(toolIndex, 1)
      storage.ratingsByTool.set(rating.toolId, toolRatings)
    }

    // Remove from user index
    const userRatings = storage.ratingsByUser.get(rating.userAddress) || []
    const userIndex = userRatings.indexOf(ratingId)
    if (userIndex !== -1) {
      userRatings.splice(userIndex, 1)
      storage.ratingsByUser.set(rating.userAddress, userRatings)
    }

    Logger.info(`Rating deleted: ${ratingId}`)
  }

  /**
   * Report a rating for abuse
   */
  async reportRating(
    ratingId: string,
    reporterAddress: Address,
    reason: RatingReport["reason"],
    details?: string
  ): Promise<RatingReport> {
    const rating = storage.ratings.get(ratingId)

    if (!rating) {
      throw new Error("Rating not found")
    }

    const report: RatingReport = {
      id: generateId("report"),
      ratingId,
      reporterAddress,
      reason,
      details,
      timestamp: Date.now(),
      status: "pending",
    }

    storage.reports.set(report.id, report)

    Logger.warn(`Rating reported: ${ratingId} for ${reason}`)

    return report
  }

  /**
   * Check if user can rate a tool
   */
  canUserRate(userAddress: Address, toolId: string): {
    canRate: boolean
    reason?: string
    waitTime?: number
  } {
    const rateLimitKey = `${userAddress}:${toolId}`
    const rateLimit = storage.rateLimits.get(rateLimitKey)

    if (rateLimit && Date.now() < rateLimit.canRateAgainAt) {
      return {
        canRate: false,
        reason: "Rate limited",
        waitTime: rateLimit.canRateAgainAt - Date.now(),
      }
    }

    return { canRate: true }
  }

  /**
   * Record tool usage (for weighting)
   */
  recordUsage(userAddress: Address, toolId: string): void {
    let userUsage = storage.userUsageCount.get(userAddress)
    if (!userUsage) {
      userUsage = new Map()
      storage.userUsageCount.set(userAddress, userUsage)
    }

    const currentCount = userUsage.get(toolId) || 0
    userUsage.set(toolId, currentCount + 1)
  }

  /**
   * Get top rated tools
   */
  getTopRatedTools(limit: number = 10): Array<{
    toolId: string
    averageRating: number
    totalRatings: number
  }> {
    const summaries: Array<{
      toolId: string
      averageRating: number
      totalRatings: number
    }> = []

    for (const toolId of storage.ratingsByTool.keys()) {
      const summary = this.getRatingSummary(toolId)
      if (summary.totalRatings >= 5) {
        // Minimum 5 ratings to be considered
        summaries.push({
          toolId: summary.toolId,
          averageRating: summary.weightedAverageRating,
          totalRatings: summary.totalRatings,
        })
      }
    }

    return summaries
      .sort((a, b) => b.averageRating - a.averageRating)
      .slice(0, limit)
  }

  /**
   * Get recent ratings across all tools
   */
  getRecentRatings(limit: number = 20): Rating[] {
    const allRatings = Array.from(storage.ratings.values())
    return allRatings
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * Get reports pending review
   */
  getPendingReports(): RatingReport[] {
    return Array.from(storage.reports.values())
      .filter((r) => r.status === "pending")
      .sort((a, b) => a.timestamp - b.timestamp)
  }

  /**
   * Review a report
   */
  async reviewReport(
    reportId: string,
    status: "upheld" | "dismissed"
  ): Promise<RatingReport> {
    const report = storage.reports.get(reportId)

    if (!report) {
      throw new Error("Report not found")
    }

    report.status = status

    if (status === "upheld") {
      // If report is upheld, mark the rating as suspicious
      const rating = storage.ratings.get(report.ratingId)
      if (rating) {
        rating.weight = 0 // Zero out the weight
        storage.ratings.set(rating.id, rating)
      }
    }

    storage.reports.set(reportId, report)

    Logger.info(`Report ${reportId} reviewed: ${status}`)

    return report
  }
}

/**
 * Singleton instance
 */
export const ratingService = new RatingService()
