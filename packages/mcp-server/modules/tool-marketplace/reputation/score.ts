/**
 * Reputation Score Service
 * @description Calculates composite reputation scores and manages badges
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type {
  ReputationScore,
  ReputationScoreBreakdown,
  TrustTier,
  ReputationBadge,
  BadgeType,
  ReputationHistoryEntry,
  LeaderboardEntry,
  ToolReport,
} from "./types.js"
import { ratingService } from "./rating.js"

/**
 * Configuration for reputation scoring
 */
export interface ReputationScorerConfig {
  weights: {
    uptime: number // Default: 0.30 (30%)
    rating: number // Default: 0.40 (40%)
    volume: number // Default: 0.20 (20%)
    age: number // Default: 0.10 (10%)
  }
  tierThresholds: {
    platinum: number // Score >= 90
    gold: number // Score >= 75
    silver: number // Score >= 50
    // Bronze is below 50
  }
  badges: {
    topRatedMinRating: number // 4.5 stars
    topRatedMinCount: number // 100 ratings
    highVolumeMinCalls: number // 10000 calls
    trendingGrowthPercent: number // 50% growth this week
    premiumMinStake: string // "1000" USDs
    fastResponseMaxMs: number // 500ms average
    reliableMinUptime: number // 99.5% uptime
  }
}

const DEFAULT_CONFIG: ReputationScorerConfig = {
  weights: {
    uptime: 0.30,
    rating: 0.40,
    volume: 0.20,
    age: 0.10,
  },
  tierThresholds: {
    platinum: 90,
    gold: 75,
    silver: 50,
  },
  badges: {
    topRatedMinRating: 4.5,
    topRatedMinCount: 100,
    highVolumeMinCalls: 10000,
    trendingGrowthPercent: 50,
    premiumMinStake: "1000",
    fastResponseMaxMs: 500,
    reliableMinUptime: 99.5,
  },
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * In-memory storage for reputation data
 */
interface ReputationStorage {
  scores: Map<string, ReputationScore>
  history: Map<string, ReputationHistoryEntry[]>
  badges: Map<string, ReputationBadge[]>
  reports: Map<string, ToolReport>
  reportsByTool: Map<string, string[]>
  toolMetrics: Map<string, ToolMetrics>
}

/**
 * Tool metrics used for scoring
 */
interface ToolMetrics {
  toolId: string
  totalCalls: number
  weeklyCallGrowth: number
  avgResponseTime: number
  uptimePercent: number
  registeredAt: number
  stakedAmount: string
  lastUpdated: number
}

const storage: ReputationStorage = {
  scores: new Map(),
  history: new Map(),
  badges: new Map(),
  reports: new Map(),
  reportsByTool: new Map(),
  toolMetrics: new Map(),
}

/**
 * Badge definitions with icons
 */
const BADGE_DEFINITIONS: Record<BadgeType, { label: string; icon: string }> = {
  verified: { label: "Verified Endpoint", icon: "✓" },
  security_audited: { label: "Security Audited", icon: "🛡️" },
  top_rated: { label: "Top Rated", icon: "⭐" },
  trending: { label: "Trending", icon: "🔥" },
  premium: { label: "Premium", icon: "💎" },
  new: { label: "New", icon: "🆕" },
  high_volume: { label: "High Volume", icon: "📈" },
  fast_response: { label: "Fast Response", icon: "⚡" },
  reliable: { label: "Highly Reliable", icon: "🏆" },
}

/**
 * Reputation Score Service
 * Calculates composite reputation scores and manages trust badges
 */
export class ReputationScorer {
  private config: ReputationScorerConfig

  constructor(config: Partial<ReputationScorerConfig> = {}) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      weights: { ...DEFAULT_CONFIG.weights, ...config.weights },
      tierThresholds: { ...DEFAULT_CONFIG.tierThresholds, ...config.tierThresholds },
      badges: { ...DEFAULT_CONFIG.badges, ...config.badges },
    }
  }

  /**
   * Calculate reputation score for a tool
   */
  async calculateScore(toolId: string): Promise<ReputationScore> {
    const metrics = storage.toolMetrics.get(toolId)
    const ratingSummary = ratingService.getRatingSummary(toolId)

    // Get previous score for comparison
    const previousScore = storage.scores.get(toolId)

    // Calculate component scores
    const breakdown = this.calculateBreakdown(metrics, ratingSummary)

    // Calculate composite score
    const score = Math.round(
      breakdown.uptimeScore * this.config.weights.uptime +
      breakdown.ratingScore * this.config.weights.rating +
      breakdown.volumeScore * this.config.weights.volume +
      breakdown.ageScore * this.config.weights.age
    )

    // Determine tier
    const tier = this.determineTier(score)

    // Calculate badges
    const badges = await this.calculateBadges(toolId, metrics, ratingSummary)

    // Determine trend
    const change = previousScore ? score - previousScore.score : 0
    const trend: "up" | "down" | "stable" =
      change > 2 ? "up" : change < -2 ? "down" : "stable"

    const reputationScore: ReputationScore = {
      toolId,
      score,
      tier,
      breakdown,
      badges,
      calculatedAt: Date.now(),
      change,
      trend,
    }

    // Store score
    storage.scores.set(toolId, reputationScore)

    // Record history
    this.recordHistory(toolId, reputationScore)

    Logger.debug(`Reputation calculated for ${toolId}: ${score} (${tier})`)

    return reputationScore
  }

  /**
   * Calculate score breakdown
   */
  private calculateBreakdown(
    metrics: ToolMetrics | undefined,
    ratingSummary: { averageRating: number; weightedAverageRating: number; totalRatings: number }
  ): ReputationScoreBreakdown {
    // Uptime score (0-100 based on uptime percentage)
    const uptimePercent = metrics?.uptimePercent ?? 0
    const uptimeScore = Math.min(100, uptimePercent)

    // Rating score (0-100 based on weighted average * 20)
    const ratingScore = Math.min(100, ratingSummary.weightedAverageRating * 20)

    // Volume score (logarithmic scale, maxes out at 1M calls)
    const totalCalls = metrics?.totalCalls ?? 0
    const volumeScore = Math.min(100, (Math.log10(totalCalls + 1) / 6) * 100)

    // Age score (linear for first year, max at 1 year)
    const ageInDays = metrics
      ? (Date.now() - metrics.registeredAt) / (1000 * 60 * 60 * 24)
      : 0
    const ageScore = Math.min(100, (ageInDays / 365) * 100)

    return {
      uptimeScore: Math.round(uptimeScore),
      ratingScore: Math.round(ratingScore),
      volumeScore: Math.round(volumeScore),
      ageScore: Math.round(ageScore),
      weights: this.config.weights,
    }
  }

  /**
   * Determine trust tier based on score
   */
  private determineTier(score: number): TrustTier {
    if (score >= this.config.tierThresholds.platinum) return "platinum"
    if (score >= this.config.tierThresholds.gold) return "gold"
    if (score >= this.config.tierThresholds.silver) return "silver"
    return "bronze"
  }

  /**
   * Calculate badges for a tool
   */
  private async calculateBadges(
    toolId: string,
    metrics: ToolMetrics | undefined,
    ratingSummary: { averageRating: number; weightedAverageRating: number; totalRatings: number }
  ): Promise<ReputationBadge[]> {
    const badges: ReputationBadge[] = []
    const now = Date.now()

    // Top Rated badge
    if (
      ratingSummary.averageRating >= this.config.badges.topRatedMinRating &&
      ratingSummary.totalRatings >= this.config.badges.topRatedMinCount
    ) {
      badges.push(this.createBadge("top_rated", now))
    }

    // High Volume badge
    if (metrics && metrics.totalCalls >= this.config.badges.highVolumeMinCalls) {
      badges.push(this.createBadge("high_volume", now))
    }

    // Trending badge
    if (metrics && metrics.weeklyCallGrowth >= this.config.badges.trendingGrowthPercent) {
      badges.push(this.createBadge("trending", now, now + 7 * 24 * 60 * 60 * 1000))
    }

    // Premium badge
    if (metrics && parseFloat(metrics.stakedAmount) >= parseFloat(this.config.badges.premiumMinStake)) {
      badges.push(this.createBadge("premium", now))
    }

    // New badge (within 30 days)
    if (metrics && now - metrics.registeredAt < 30 * 24 * 60 * 60 * 1000) {
      badges.push(this.createBadge("new", metrics.registeredAt, metrics.registeredAt + 30 * 24 * 60 * 60 * 1000))
    }

    // Fast Response badge
    if (metrics && metrics.avgResponseTime <= this.config.badges.fastResponseMaxMs) {
      badges.push(this.createBadge("fast_response", now))
    }

    // Reliable badge
    if (metrics && metrics.uptimePercent >= this.config.badges.reliableMinUptime) {
      badges.push(this.createBadge("reliable", now))
    }

    // Store badges
    storage.badges.set(toolId, badges)

    return badges
  }

  /**
   * Create a badge
   */
  private createBadge(
    type: BadgeType,
    earnedAt: number,
    expiresAt?: number
  ): ReputationBadge {
    const def = BADGE_DEFINITIONS[type]
    return {
      type,
      label: def.label,
      icon: def.icon,
      earnedAt,
      expiresAt,
    }
  }

  /**
   * Record score history
   */
  private recordHistory(toolId: string, score: ReputationScore): void {
    const history = storage.history.get(toolId) || []

    // Keep last 365 days of history
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000
    const filtered = history.filter((h) => h.timestamp > oneYearAgo)

    filtered.push({
      timestamp: score.calculatedAt,
      score: score.score,
      tier: score.tier,
    })

    storage.history.set(toolId, filtered)
  }

  /**
   * Get reputation score for a tool
   */
  getScore(toolId: string): ReputationScore | null {
    return storage.scores.get(toolId) || null
  }

  /**
   * Get score history for a tool
   */
  getScoreHistory(toolId: string): ReputationHistoryEntry[] {
    return storage.history.get(toolId) || []
  }

  /**
   * Get badges for a tool
   */
  getBadges(toolId: string): ReputationBadge[] {
    return storage.badges.get(toolId) || []
  }

  /**
   * Check if tool has a specific badge
   */
  hasBadge(toolId: string, badgeType: BadgeType): boolean {
    const badges = storage.badges.get(toolId) || []
    return badges.some((b) => b.type === badgeType && (!b.expiresAt || b.expiresAt > Date.now()))
  }

  /**
   * Award a badge manually (e.g., for verified endpoint, security audited)
   */
  awardBadge(toolId: string, badgeType: BadgeType, expiresAt?: number): ReputationBadge {
    const badges = storage.badges.get(toolId) || []

    // Check if badge already exists
    const existingIndex = badges.findIndex((b) => b.type === badgeType)
    if (existingIndex !== -1) {
      // Update existing badge
      badges[existingIndex] = this.createBadge(badgeType, Date.now(), expiresAt)
    } else {
      badges.push(this.createBadge(badgeType, Date.now(), expiresAt))
    }

    storage.badges.set(toolId, badges)
    Logger.info(`Badge awarded to ${toolId}: ${badgeType}`)

    // Return the badge - either existing or newly added
    const badge = badges[existingIndex !== -1 ? existingIndex : badges.length - 1]!
    return badge
  }

  /**
   * Revoke a badge
   */
  revokeBadge(toolId: string, badgeType: BadgeType): boolean {
    const badges = storage.badges.get(toolId) || []
    const index = badges.findIndex((b) => b.type === badgeType)

    if (index !== -1) {
      badges.splice(index, 1)
      storage.badges.set(toolId, badges)
      Logger.info(`Badge revoked from ${toolId}: ${badgeType}`)
      return true
    }

    return false
  }

  /**
   * Update tool metrics
   */
  updateMetrics(toolId: string, metrics: Partial<ToolMetrics>): void {
    const existing = storage.toolMetrics.get(toolId) || {
      toolId,
      totalCalls: 0,
      weeklyCallGrowth: 0,
      avgResponseTime: 0,
      uptimePercent: 100,
      registeredAt: Date.now(),
      stakedAmount: "0",
      lastUpdated: Date.now(),
    }

    const updated: ToolMetrics = {
      ...existing,
      ...metrics,
      lastUpdated: Date.now(),
    }

    storage.toolMetrics.set(toolId, updated)
  }

  /**
   * Get tool metrics
   */
  getMetrics(toolId: string): ToolMetrics | null {
    return storage.toolMetrics.get(toolId) || null
  }

  /**
   * Report a tool
   */
  async reportTool(
    toolId: string,
    reporterAddress: string,
    category: ToolReport["category"],
    severity: ToolReport["severity"],
    description: string,
    evidence?: string[]
  ): Promise<ToolReport> {
    const report: ToolReport = {
      id: generateId("tool_report"),
      toolId,
      reporterAddress: reporterAddress as `0x${string}`,
      category,
      severity,
      description,
      evidence,
      timestamp: Date.now(),
      status: "pending",
    }

    storage.reports.set(report.id, report)

    // Update tool reports index
    const toolReports = storage.reportsByTool.get(toolId) || []
    toolReports.push(report.id)
    storage.reportsByTool.set(toolId, toolReports)

    Logger.warn(`Tool reported: ${toolId} for ${category} (${severity})`)

    return report
  }

  /**
   * Get reports for a tool
   */
  getToolReports(toolId: string): ToolReport[] {
    const reportIds = storage.reportsByTool.get(toolId) || []
    return reportIds
      .map((id) => storage.reports.get(id))
      .filter((r): r is ToolReport => r !== undefined)
      .sort((a, b) => b.timestamp - a.timestamp)
  }

  /**
   * Get all pending reports
   */
  getPendingReports(): ToolReport[] {
    return Array.from(storage.reports.values())
      .filter((r) => r.status === "pending" || r.status === "investigating")
      .sort((a, b) => {
        // Sort by severity, then by timestamp
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity]
        if (severityDiff !== 0) return severityDiff
        return a.timestamp - b.timestamp
      })
  }

  /**
   * Review a tool report
   */
  async reviewReport(
    reportId: string,
    status: "confirmed" | "dismissed",
    resolution?: string
  ): Promise<ToolReport> {
    const report = storage.reports.get(reportId)

    if (!report) {
      throw new Error("Report not found")
    }

    report.status = status
    report.resolution = resolution

    storage.reports.set(reportId, report)

    // If confirmed, potentially revoke badges
    if (status === "confirmed" && report.severity === "critical") {
      this.revokeBadge(report.toolId, "verified")
      this.revokeBadge(report.toolId, "security_audited")
    }

    Logger.info(`Tool report ${reportId} reviewed: ${status}`)

    return report
  }

  /**
   * Get reputation leaderboard
   */
  getLeaderboard(limit: number = 50): LeaderboardEntry[] {
    const entries: LeaderboardEntry[] = []

    for (const [toolId, score] of storage.scores) {
      const ratingSummary = ratingService.getRatingSummary(toolId)

      entries.push({
        rank: 0, // Will be set after sorting
        toolId,
        displayName: toolId, // Would come from tool registry in production
        score: score.score,
        tier: score.tier,
        badges: score.badges,
        totalRatings: ratingSummary.totalRatings,
        averageRating: ratingSummary.averageRating,
      })
    }

    // Sort by score descending
    entries.sort((a, b) => b.score - a.score)

    // Set ranks
    entries.forEach((entry, index) => {
      entry.rank = index + 1
    })

    return entries.slice(0, limit)
  }

  /**
   * Get tier statistics
   */
  getTierStats(): Record<TrustTier, number> {
    const stats: Record<TrustTier, number> = {
      platinum: 0,
      gold: 0,
      silver: 0,
      bronze: 0,
    }

    for (const score of storage.scores.values()) {
      stats[score.tier]++
    }

    return stats
  }

  /**
   * Recalculate all scores (batch operation)
   */
  async recalculateAll(): Promise<void> {
    const toolIds = Array.from(storage.toolMetrics.keys())

    Logger.info(`Recalculating reputation for ${toolIds.length} tools`)

    for (const toolId of toolIds) {
      await this.calculateScore(toolId)
    }

    Logger.info("Reputation recalculation complete")
  }
}

/**
 * Singleton instance
 */
export const reputationScorer = new ReputationScorer()
