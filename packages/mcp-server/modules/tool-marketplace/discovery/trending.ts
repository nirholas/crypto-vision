/**
 * Trending & Featured Tools Engine
 * @description Track and surface trending, hot, new, featured, and rising star tools
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type { Address } from "viem"
import type { RegisteredTool, ToolUsageRecord } from "../types.js"
import type {
  TrendingTool,
  HotTool,
  NewTool,
  RisingStarTool,
  FeaturedTool,
  TrendingPeriod,
} from "./types.js"

/**
 * Period durations in milliseconds
 */
const PERIOD_MS: Record<TrendingPeriod, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
}

/**
 * Trending & Featured Tools Engine
 */
export class TrendingEngine {
  private tools: Map<string, RegisteredTool> = new Map()
  private usageRecords: ToolUsageRecord[] = []
  private featuredTools: Map<string, FeaturedTool> = new Map()
  private trendingCache: Map<string, TrendingTool[]> = new Map()
  private cacheExpiry: number = 5 * 60 * 1000 // 5 minutes
  private lastCacheUpdate: number = 0

  /**
   * Load tools
   */
  loadTools(tools: RegisteredTool[]): void {
    this.tools.clear()
    for (const tool of tools) {
      this.tools.set(tool.toolId, tool)
    }
    this.invalidateCache()
    Logger.info(`Loaded ${tools.length} tools for trending`)
  }

  /**
   * Load usage records
   */
  loadUsageRecords(records: ToolUsageRecord[]): void {
    this.usageRecords = records
    this.invalidateCache()
    Logger.info(`Loaded ${records.length} usage records for trending`)
  }

  /**
   * Invalidate cache
   */
  private invalidateCache(): void {
    this.trendingCache.clear()
    this.lastCacheUpdate = 0
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    return Date.now() - this.lastCacheUpdate < this.cacheExpiry
  }

  /**
   * Get usage stats for a period
   */
  private getUsageStats(
    toolId: string,
    period: TrendingPeriod
  ): { calls: number; revenue: string; users: Set<string> } {
    const cutoff = Date.now() - PERIOD_MS[period]
    const records = this.usageRecords.filter(
      r => r.toolId === toolId && r.timestamp >= cutoff
    )

    let revenue = 0
    const users = new Set<string>()

    for (const record of records) {
      revenue += parseFloat(record.amountPaid || "0")
      users.add(record.userAddress.toLowerCase())
    }

    return {
      calls: records.length,
      revenue: revenue.toFixed(6),
      users,
    }
  }

  /**
   * Get usage stats for previous period (for growth calculation)
   */
  private getPreviousPeriodStats(
    toolId: string,
    period: TrendingPeriod
  ): { calls: number } {
    const periodMs = PERIOD_MS[period]
    const startCutoff = Date.now() - periodMs * 2
    const endCutoff = Date.now() - periodMs

    const records = this.usageRecords.filter(
      r => r.toolId === toolId && r.timestamp >= startCutoff && r.timestamp < endCutoff
    )

    return { calls: records.length }
  }

  // ============================================================================
  // Trending Tools
  // ============================================================================

  /**
   * Get trending tools (high growth in last 7 days)
   */
  getTrending(options: {
    period?: TrendingPeriod
    limit?: number
    minGrowth?: number
    category?: string
  } = {}): TrendingTool[] {
    const {
      period = "7d",
      limit = 20,
      minGrowth = 10,
      category,
    } = options

    // Check cache
    const cacheKey = `trending:${period}:${category || "all"}`
    if (this.isCacheValid() && this.trendingCache.has(cacheKey)) {
      return this.trendingCache.get(cacheKey)!.slice(0, limit)
    }

    const trending: TrendingTool[] = []

    for (const tool of this.tools.values()) {
      if (tool.status !== "active") continue
      if (category && tool.category !== category) continue

      const currentStats = this.getUsageStats(tool.toolId, period)
      const previousStats = this.getPreviousPeriodStats(tool.toolId, period)

      // Calculate growth percentage
      let growthPercent = 0
      if (previousStats.calls > 0) {
        growthPercent = ((currentStats.calls - previousStats.calls) / previousStats.calls) * 100
      } else if (currentStats.calls > 0) {
        growthPercent = 100 // New tool with usage = 100% growth
      }

      // Skip if below minimum growth
      if (growthPercent < minGrowth) continue

      // Calculate trending score
      // Score = growth% * log(calls + 1) * (rating / 5)
      const score = growthPercent * Math.log(currentStats.calls + 1) * (tool.metadata.rating / 5)

      trending.push({
        tool,
        score,
        growthPercent,
        callsInPeriod: currentStats.calls,
        revenueInPeriod: currentStats.revenue,
        trend: growthPercent > 50 ? "up" : growthPercent > 0 ? "stable" : "down",
        rank: 0,
      })
    }

    // Sort by score
    trending.sort((a, b) => b.score - a.score)

    // Assign ranks
    trending.forEach((t, i) => t.rank = i + 1)

    // Cache results
    this.trendingCache.set(cacheKey, trending)
    this.lastCacheUpdate = Date.now()

    return trending.slice(0, limit)
  }

  // ============================================================================
  // Hot Tools
  // ============================================================================

  /**
   * Get hot tools (most used in last 24 hours)
   */
  getHot(options: {
    limit?: number
    minCalls?: number
    category?: string
  } = {}): HotTool[] {
    const {
      limit = 20,
      minCalls = 5,
      category,
    } = options

    const hot: HotTool[] = []

    for (const tool of this.tools.values()) {
      if (tool.status !== "active") continue
      if (category && tool.category !== category) continue

      const stats = this.getUsageStats(tool.toolId, "24h")

      if (stats.calls < minCalls) continue

      // Hotness score = calls * sqrt(unique users) * recency factor
      const hotnessScore = stats.calls * Math.sqrt(stats.users.size) * 1.0

      hot.push({
        tool,
        calls24h: stats.calls,
        activeUsers24h: stats.users.size,
        hotnessScore,
      })
    }

    // Sort by hotness score
    hot.sort((a, b) => b.hotnessScore - a.hotnessScore)

    return hot.slice(0, limit)
  }

  // ============================================================================
  // New Tools
  // ============================================================================

  /**
   * Get new tools (recently registered, verified)
   */
  getNew(options: {
    limit?: number
    maxAgeDays?: number
    verifiedOnly?: boolean
  } = {}): NewTool[] {
    const {
      limit = 20,
      maxAgeDays = 30,
      verifiedOnly = false,
    } = options

    const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000
    const newTools: NewTool[] = []

    for (const tool of this.tools.values()) {
      if (tool.status !== "active") continue
      if (tool.registeredAt < cutoff) continue

      // For now, assume all active tools are verified
      // In production, this would check verification status
      const isVerified = tool.status === "active"
      if (verifiedOnly && !isVerified) continue

      newTools.push({
        tool,
        registeredAt: tool.registeredAt,
        isVerified,
        initialCalls: tool.metadata.totalCalls,
        initialRating: tool.metadata.rating,
      })
    }

    // Sort by registration date (newest first)
    newTools.sort((a, b) => b.registeredAt - a.registeredAt)

    return newTools.slice(0, limit)
  }

  // ============================================================================
  // Rising Stars
  // ============================================================================

  /**
   * Get rising stars (high ratings, low volume - underrated gems)
   */
  getRisingStars(options: {
    limit?: number
    minRating?: number
    minRatingCount?: number
    maxCalls?: number
  } = {}): RisingStarTool[] {
    const {
      limit = 10,
      minRating = 4.0,
      minRatingCount = 3,
      maxCalls = 1000,
    } = options

    const stars: RisingStarTool[] = []

    for (const tool of this.tools.values()) {
      if (tool.status !== "active") continue

      const { rating, ratingCount, totalCalls } = tool.metadata

      // Must meet quality threshold
      if (rating < minRating) continue
      if (ratingCount < minRatingCount) continue
      
      // Must be low volume (underrated)
      if (totalCalls > maxCalls) continue

      // Calculate potential score
      // High rating + enough confidence + low volume = high potential
      const confidenceFactor = Math.min(1, ratingCount / 10)
      const volumeFactor = 1 - totalCalls / maxCalls
      const potentialScore = rating * confidenceFactor * volumeFactor

      const reasons: string[] = []
      if (rating >= 4.5) reasons.push("Exceptional rating")
      if (rating >= 4.0 && rating < 4.5) reasons.push("High rating")
      if (totalCalls < 100) reasons.push("Hidden gem - low discovery")
      if (ratingCount >= 5) reasons.push("Consistent quality")

      stars.push({
        tool,
        rating,
        ratingCount,
        totalCalls,
        potentialScore,
        reasons,
      })
    }

    // Sort by potential score
    stars.sort((a, b) => b.potentialScore - a.potentialScore)

    return stars.slice(0, limit)
  }

  // ============================================================================
  // Featured Tools
  // ============================================================================

  /**
   * Add a featured tool (platform curated or staked)
   */
  addFeatured(
    toolId: string,
    options: {
      reason: string
      durationDays?: number
      stakeAmount?: string
      editorsPick?: boolean
    }
  ): FeaturedTool | null {
    const tool = this.tools.get(toolId)
    if (!tool) return null

    const {
      reason,
      durationDays = 7,
      stakeAmount,
      editorsPick = false,
    } = options

    const featured: FeaturedTool = {
      tool,
      reason,
      featuredFrom: Date.now(),
      featuredUntil: Date.now() + durationDays * 24 * 60 * 60 * 1000,
      stakeAmount,
      editorsPick,
    }

    this.featuredTools.set(toolId, featured)
    return featured
  }

  /**
   * Remove featured status
   */
  removeFeatured(toolId: string): void {
    this.featuredTools.delete(toolId)
  }

  /**
   * Get featured tools
   */
  getFeatured(options: {
    limit?: number
    editorsPickOnly?: boolean
    category?: string
  } = {}): FeaturedTool[] {
    const {
      limit = 10,
      editorsPickOnly = false,
      category,
    } = options

    const now = Date.now()
    const featured: FeaturedTool[] = []

    for (const ft of this.featuredTools.values()) {
      // Skip expired
      if (ft.featuredUntil < now) continue

      // Skip if not editor's pick when required
      if (editorsPickOnly && !ft.editorsPick) continue

      // Skip if category doesn't match
      if (category && ft.tool.category !== category) continue

      featured.push(ft)
    }

    // Sort: editors picks first, then by stake amount, then by time remaining
    featured.sort((a, b) => {
      if (a.editorsPick && !b.editorsPick) return -1
      if (!a.editorsPick && b.editorsPick) return 1

      const stakeA = parseFloat(a.stakeAmount || "0")
      const stakeB = parseFloat(b.stakeAmount || "0")
      if (stakeA !== stakeB) return stakeB - stakeA

      return b.featuredUntil - a.featuredUntil
    })

    return featured.slice(0, limit)
  }

  /**
   * Clean up expired featured tools
   */
  cleanupExpiredFeatured(): number {
    const now = Date.now()
    let removed = 0

    for (const [toolId, featured] of this.featuredTools) {
      if (featured.featuredUntil < now) {
        this.featuredTools.delete(toolId)
        removed++
      }
    }

    if (removed > 0) {
      Logger.info(`Cleaned up ${removed} expired featured tools`)
    }

    return removed
  }

  // ============================================================================
  // Combined Discovery
  // ============================================================================

  /**
   * Get combined discovery feed
   */
  getDiscoveryFeed(options: {
    limit?: number
    category?: string
  } = {}): {
    trending: TrendingTool[]
    hot: HotTool[]
    new: NewTool[]
    risingStars: RisingStarTool[]
    featured: FeaturedTool[]
  } {
    const { limit = 5, category } = options

    return {
      trending: this.getTrending({ limit, category }),
      hot: this.getHot({ limit, category }),
      new: this.getNew({ limit }),
      risingStars: this.getRisingStars({ limit }),
      featured: this.getFeatured({ limit, category }),
    }
  }

  /**
   * Get trending by category
   */
  getTrendingByCategory(options: {
    limitPerCategory?: number
    period?: TrendingPeriod
  } = {}): Map<string, TrendingTool[]> {
    const { limitPerCategory = 5, period = "7d" } = options

    const categories = new Set<string>()
    for (const tool of this.tools.values()) {
      categories.add(tool.category)
    }

    const result = new Map<string, TrendingTool[]>()
    for (const category of categories) {
      result.set(category, this.getTrending({
        period,
        limit: limitPerCategory,
        category,
      }))
    }

    return result
  }

  /**
   * Get movers and shakers (biggest changes)
   */
  getMoversAndShakers(options: {
    limit?: number
    period?: TrendingPeriod
  } = {}): { gainers: TrendingTool[]; losers: TrendingTool[] } {
    const { limit = 5, period = "7d" } = options

    const all: TrendingTool[] = []

    for (const tool of this.tools.values()) {
      if (tool.status !== "active") continue

      const currentStats = this.getUsageStats(tool.toolId, period)
      const previousStats = this.getPreviousPeriodStats(tool.toolId, period)

      let growthPercent = 0
      if (previousStats.calls > 0) {
        growthPercent = ((currentStats.calls - previousStats.calls) / previousStats.calls) * 100
      } else if (currentStats.calls > 0) {
        growthPercent = 100
      }

      all.push({
        tool,
        score: Math.abs(growthPercent),
        growthPercent,
        callsInPeriod: currentStats.calls,
        revenueInPeriod: currentStats.revenue,
        trend: growthPercent > 0 ? "up" : growthPercent < 0 ? "down" : "stable",
        rank: 0,
      })
    }

    // Separate gainers and losers
    const gainers = all
      .filter(t => t.growthPercent > 0)
      .sort((a, b) => b.growthPercent - a.growthPercent)
      .slice(0, limit)

    const losers = all
      .filter(t => t.growthPercent < 0)
      .sort((a, b) => a.growthPercent - b.growthPercent)
      .slice(0, limit)

    return { gainers, losers }
  }

  /**
   * Set cache expiry time
   */
  setCacheExpiry(ms: number): void {
    this.cacheExpiry = ms
  }
}

/**
 * Singleton instance
 */
export const trendingEngine = new TrendingEngine()
