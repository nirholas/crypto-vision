/**
 * Competitor Analysis
 * @description Compare tools to similar offerings and benchmark performance
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { toolRegistry } from "../registry.js"
import type { RegisteredTool } from "../types.js"
import { metricsCollector } from "../analytics/collector.js"
import Logger from "@/utils/logger.js"

/**
 * Price benchmark data
 */
export interface PriceBenchmark {
  /** Your tool's price */
  yourPrice: string
  /** Category average price */
  categoryAvg: string
  /** Category median price */
  categoryMedian: string
  /** Minimum in category */
  categoryMin: string
  /** Maximum in category */
  categoryMax: string
  /** Percentile your price is at */
  percentile: number
  /** Recommendation */
  recommendation: "lower" | "competitive" | "premium" | "expensive"
}

/**
 * Feature comparison
 */
export interface FeatureComparison {
  /** Feature name */
  feature: string
  /** Your tool has this feature */
  yourTool: boolean
  /** Percentage of competitors with this feature */
  competitorPercent: number
  /** Importance score (1-5) */
  importance: number
}

/**
 * Competitor tool summary
 */
export interface CompetitorSummary {
  /** Tool ID */
  toolId: string
  /** Tool name */
  name: string
  /** Display name */
  displayName: string
  /** Price per call */
  price: string
  /** User rating */
  rating: number
  /** Total calls */
  totalCalls: number
  /** Response time */
  avgResponseTime: number
  /** Strengths relative to your tool */
  strengths: string[]
  /** Weaknesses relative to your tool */
  weaknesses: string[]
  /** Market share estimate */
  marketSharePercent: number
}

/**
 * Market share estimation
 */
export interface MarketShare {
  /** Your tool's market share */
  yourShare: number
  /** Total market size (calls) */
  totalMarketCalls: number
  /** Total market revenue */
  totalMarketRevenue: string
  /** Competitors' shares */
  competitors: Array<{
    toolId: string
    name: string
    sharePercent: number
    calls: number
    revenue: string
  }>
}

/**
 * Feature gap analysis result
 */
export interface FeatureGap {
  /** Missing feature */
  feature: string
  /** How many competitors have it */
  competitorCount: number
  /** Estimated impact */
  estimatedImpact: "low" | "medium" | "high"
  /** Suggested priority */
  priority: number
}

/**
 * Full competitor analysis report
 */
export interface CompetitorAnalysisReport {
  /** Your tool ID */
  yourToolId: string
  /** Your tool name */
  yourToolName: string
  /** Analysis timestamp */
  analyzedAt: number
  /** Category analyzed */
  category: string
  /** Number of competitors */
  competitorCount: number
  /** Price benchmarking */
  priceBenchmark: PriceBenchmark
  /** Market share */
  marketShare: MarketShare
  /** Top competitors */
  topCompetitors: CompetitorSummary[]
  /** Feature comparison */
  featureComparison: FeatureComparison[]
  /** Feature gaps */
  featureGaps: FeatureGap[]
  /** Performance comparison */
  performanceRanking: {
    metric: string
    yourValue: number
    categoryAvg: number
    rank: number
    totalInCategory: number
  }[]
  /** Strategic recommendations */
  recommendations: string[]
}

/**
 * Common features by category
 */
const CATEGORY_FEATURES: Record<string, string[]> = {
  data: [
    "real-time-updates",
    "historical-data",
    "bulk-queries",
    "webhook-support",
    "rate-limit-flexibility",
    "custom-formats",
    "caching",
    "filtering",
  ],
  ai: [
    "streaming-responses",
    "fine-tuning",
    "embeddings",
    "multi-modal",
    "context-window-large",
    "function-calling",
    "batch-processing",
    "model-selection",
  ],
  defi: [
    "multi-chain",
    "gas-estimation",
    "slippage-protection",
    "price-impact",
    "route-optimization",
    "limit-orders",
    "portfolio-tracking",
    "yield-farming",
  ],
  analytics: [
    "custom-dashboards",
    "export-formats",
    "real-time",
    "historical-comparison",
    "alerts",
    "api-access",
    "white-label",
    "team-sharing",
  ],
  social: [
    "sentiment-analysis",
    "trending-topics",
    "influencer-tracking",
    "cross-platform",
    "historical-data",
    "real-time-feed",
    "keyword-alerts",
    "engagement-metrics",
  ],
  utilities: [
    "batch-operations",
    "scheduling",
    "webhooks",
    "retry-logic",
    "rate-limiting",
    "logging",
    "monitoring",
    "documentation",
  ],
}

/**
 * Competitor Analysis Service
 */
export class CompetitorAnalysisService {
  /**
   * Get full competitor analysis
   */
  async analyzeCompetitors(toolId: string): Promise<CompetitorAnalysisReport> {
    const tool = await toolRegistry.getTool(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    // Get competitors in same category
    const competitors = await toolRegistry.discoverTools({
      category: tool.category,
      activeOnly: true,
      limit: 100,
    })

    // Filter out the tool itself
    const otherTools = competitors.filter(t => t.toolId !== toolId)

    // Analyze pricing
    const priceBenchmark = this.analyzePricing(tool, otherTools)

    // Analyze market share
    const marketShare = this.analyzeMarketShare(tool, otherTools)

    // Get top competitors
    const topCompetitors = this.getTopCompetitors(tool, otherTools)

    // Analyze features
    const featureComparison = this.analyzeFeatures(tool, otherTools)
    const featureGaps = this.identifyFeatureGaps(tool, otherTools)

    // Rank performance
    const performanceRanking = this.rankPerformance(tool, otherTools)

    // Generate recommendations
    const recommendations = this.generateStrategicRecommendations(
      tool,
      priceBenchmark,
      marketShare,
      featureGaps,
      performanceRanking
    )

    return {
      yourToolId: tool.toolId,
      yourToolName: tool.name,
      analyzedAt: Date.now(),
      category: tool.category,
      competitorCount: otherTools.length,
      priceBenchmark,
      marketShare,
      topCompetitors,
      featureComparison,
      featureGaps,
      performanceRanking,
      recommendations,
    }
  }

  /**
   * Analyze pricing relative to competitors
   */
  private analyzePricing(tool: RegisteredTool, competitors: RegisteredTool[]): PriceBenchmark {
    const yourPrice = parseFloat(tool.pricing.basePrice || "0")
    const prices = competitors
      .map(t => parseFloat(t.pricing.basePrice || "0"))
      .filter(p => p > 0)
      .sort((a, b) => a - b)

    if (prices.length === 0) {
      return {
        yourPrice: yourPrice.toFixed(6),
        categoryAvg: "0",
        categoryMedian: "0",
        categoryMin: "0",
        categoryMax: "0",
        percentile: 50,
        recommendation: "competitive",
      }
    }

    const avg = prices.reduce((a, b) => a + b, 0) / prices.length
    const median = prices[Math.floor(prices.length / 2)]
    const min = prices[0]
    const max = prices[prices.length - 1]

    // Calculate percentile
    const belowCount = prices.filter(p => p < yourPrice).length
    const percentile = Math.round((belowCount / prices.length) * 100)

    // Determine recommendation
    let recommendation: PriceBenchmark["recommendation"]
    if (percentile < 25) {
      recommendation = "lower"
    } else if (percentile < 75) {
      recommendation = "competitive"
    } else if (percentile < 90) {
      recommendation = "premium"
    } else {
      recommendation = "expensive"
    }

    return {
      yourPrice: yourPrice.toFixed(6),
      categoryAvg: avg.toFixed(6),
      categoryMedian: (median ?? 0).toFixed(6),
      categoryMin: (min ?? 0).toFixed(6),
      categoryMax: (max ?? 0).toFixed(6),
      percentile,
      recommendation,
    }
  }

  /**
   * Analyze market share
   */
  private analyzeMarketShare(tool: RegisteredTool, competitors: RegisteredTool[]): MarketShare {
    const allTools = [tool, ...competitors]
    
    // Calculate totals
    const totalCalls = allTools.reduce((sum, t) => sum + t.metadata.totalCalls, 0)
    const totalRevenue = allTools.reduce(
      (sum, t) => sum + parseFloat(t.metadata.totalRevenue),
      0
    )

    const yourShare = totalCalls > 0
      ? (tool.metadata.totalCalls / totalCalls) * 100
      : 0

    const competitorShares = competitors
      .map(t => ({
        toolId: t.toolId,
        name: t.name,
        sharePercent: totalCalls > 0 ? (t.metadata.totalCalls / totalCalls) * 100 : 0,
        calls: t.metadata.totalCalls,
        revenue: t.metadata.totalRevenue,
      }))
      .sort((a, b) => b.sharePercent - a.sharePercent)
      .slice(0, 10)

    return {
      yourShare,
      totalMarketCalls: totalCalls,
      totalMarketRevenue: totalRevenue.toFixed(6),
      competitors: competitorShares,
    }
  }

  /**
   * Get top competitors with strengths/weaknesses
   */
  private getTopCompetitors(
    tool: RegisteredTool,
    competitors: RegisteredTool[]
  ): CompetitorSummary[] {
    // Sort by calls (popularity)
    const sorted = [...competitors].sort(
      (a, b) => b.metadata.totalCalls - a.metadata.totalCalls
    )

    const totalCalls = competitors.reduce((sum, t) => sum + t.metadata.totalCalls, 0)

    return sorted.slice(0, 5).map(competitor => {
      const strengths: string[] = []
      const weaknesses: string[] = []

      // Compare metrics
      const yourPrice = parseFloat(tool.pricing.basePrice || "0")
      const theirPrice = parseFloat(competitor.pricing.basePrice || "0")

      if (theirPrice < yourPrice * 0.8) {
        strengths.push("Lower price")
      } else if (theirPrice > yourPrice * 1.2) {
        weaknesses.push("Higher price")
      }

      if (competitor.metadata.rating > tool.metadata.rating + 0.5) {
        strengths.push("Better rating")
      } else if (competitor.metadata.rating < tool.metadata.rating - 0.5) {
        weaknesses.push("Lower rating")
      }

      if (competitor.metadata.avgResponseTime < tool.metadata.avgResponseTime * 0.7) {
        strengths.push("Faster response time")
      } else if (competitor.metadata.avgResponseTime > tool.metadata.avgResponseTime * 1.3) {
        weaknesses.push("Slower response time")
      }

      if (competitor.metadata.totalCalls > tool.metadata.totalCalls * 2) {
        strengths.push("More popular")
      } else if (competitor.metadata.totalCalls < tool.metadata.totalCalls * 0.5) {
        weaknesses.push("Less established")
      }

      if (competitor.docsUrl && !tool.docsUrl) {
        strengths.push("Has documentation")
      } else if (!competitor.docsUrl && tool.docsUrl) {
        weaknesses.push("No documentation")
      }

      return {
        toolId: competitor.toolId,
        name: competitor.name,
        displayName: competitor.displayName,
        price: competitor.pricing.basePrice || "0",
        rating: competitor.metadata.rating,
        totalCalls: competitor.metadata.totalCalls,
        avgResponseTime: competitor.metadata.avgResponseTime,
        strengths,
        weaknesses,
        marketSharePercent: totalCalls > 0
          ? (competitor.metadata.totalCalls / totalCalls) * 100
          : 0,
      }
    })
  }

  /**
   * Analyze features compared to competitors
   */
  private analyzeFeatures(
    tool: RegisteredTool,
    competitors: RegisteredTool[]
  ): FeatureComparison[] {
    const categoryFeatures = CATEGORY_FEATURES[tool.category] ?? CATEGORY_FEATURES.utilities ?? []
    const comparisons: FeatureComparison[] = []

    for (const feature of categoryFeatures) {
      // Check if tool has feature (based on tags)
      const yourTool = tool.tags?.includes(feature) || false

      // Check how many competitors have it
      const competitorsWithFeature = competitors.filter(
        c => c.tags?.includes(feature)
      ).length

      const competitorPercent = competitors.length > 0
        ? (competitorsWithFeature / competitors.length) * 100
        : 0

      // Importance based on how common the feature is
      let importance: number
      if (competitorPercent > 80) importance = 5
      else if (competitorPercent > 60) importance = 4
      else if (competitorPercent > 40) importance = 3
      else if (competitorPercent > 20) importance = 2
      else importance = 1

      comparisons.push({
        feature,
        yourTool,
        competitorPercent,
        importance,
      })
    }

    return comparisons.sort((a, b) => b.importance - a.importance)
  }

  /**
   * Identify feature gaps
   */
  private identifyFeatureGaps(
    tool: RegisteredTool,
    competitors: RegisteredTool[]
  ): FeatureGap[] {
    const categoryFeatures = CATEGORY_FEATURES[tool.category] ?? CATEGORY_FEATURES.utilities ?? []
    const gaps: FeatureGap[] = []

    for (const feature of categoryFeatures) {
      const hasFeature = tool.tags?.includes(feature) || false
      if (hasFeature) continue

      const competitorCount = competitors.filter(
        c => c.tags?.includes(feature)
      ).length

      if (competitorCount === 0) continue

      const percentage = (competitorCount / competitors.length) * 100

      let estimatedImpact: FeatureGap["estimatedImpact"]
      let priority: number

      if (percentage > 70) {
        estimatedImpact = "high"
        priority = 1
      } else if (percentage > 40) {
        estimatedImpact = "medium"
        priority = 2
      } else {
        estimatedImpact = "low"
        priority = 3
      }

      gaps.push({
        feature,
        competitorCount,
        estimatedImpact,
        priority,
      })
    }

    return gaps.sort((a, b) => a.priority - b.priority)
  }

  /**
   * Rank performance metrics
   */
  private rankPerformance(
    tool: RegisteredTool,
    competitors: RegisteredTool[]
  ): CompetitorAnalysisReport["performanceRanking"] {
    const allTools = [tool, ...competitors]
    const rankings: CompetitorAnalysisReport["performanceRanking"] = []

    // Response time (lower is better)
    const sortedByResponseTime = [...allTools]
      .filter(t => t.metadata.avgResponseTime > 0)
      .sort((a, b) => a.metadata.avgResponseTime - b.metadata.avgResponseTime)
    const responseTimeRank = sortedByResponseTime.findIndex(t => t.toolId === tool.toolId) + 1
    const avgResponseTime = sortedByResponseTime.reduce(
      (sum, t) => sum + t.metadata.avgResponseTime, 0
    ) / sortedByResponseTime.length

    rankings.push({
      metric: "Response Time",
      yourValue: tool.metadata.avgResponseTime,
      categoryAvg: avgResponseTime,
      rank: responseTimeRank || sortedByResponseTime.length,
      totalInCategory: sortedByResponseTime.length,
    })

    // Rating (higher is better)
    const sortedByRating = [...allTools]
      .filter(t => t.metadata.rating > 0)
      .sort((a, b) => b.metadata.rating - a.metadata.rating)
    const ratingRank = sortedByRating.findIndex(t => t.toolId === tool.toolId) + 1
    const avgRating = sortedByRating.reduce(
      (sum, t) => sum + t.metadata.rating, 0
    ) / sortedByRating.length

    rankings.push({
      metric: "User Rating",
      yourValue: tool.metadata.rating,
      categoryAvg: avgRating,
      rank: ratingRank || sortedByRating.length,
      totalInCategory: sortedByRating.length,
    })

    // Uptime (higher is better)
    const sortedByUptime = [...allTools]
      .sort((a, b) => b.metadata.uptime - a.metadata.uptime)
    const uptimeRank = sortedByUptime.findIndex(t => t.toolId === tool.toolId) + 1
    const avgUptime = sortedByUptime.reduce(
      (sum, t) => sum + t.metadata.uptime, 0
    ) / sortedByUptime.length

    rankings.push({
      metric: "Uptime",
      yourValue: tool.metadata.uptime,
      categoryAvg: avgUptime,
      rank: uptimeRank,
      totalInCategory: sortedByUptime.length,
    })

    // Popularity (higher is better)
    const sortedByPopularity = [...allTools]
      .sort((a, b) => b.metadata.totalCalls - a.metadata.totalCalls)
    const popularityRank = sortedByPopularity.findIndex(t => t.toolId === tool.toolId) + 1
    const avgCalls = sortedByPopularity.reduce(
      (sum, t) => sum + t.metadata.totalCalls, 0
    ) / sortedByPopularity.length

    rankings.push({
      metric: "Popularity (Calls)",
      yourValue: tool.metadata.totalCalls,
      categoryAvg: avgCalls,
      rank: popularityRank,
      totalInCategory: sortedByPopularity.length,
    })

    return rankings
  }

  /**
   * Generate strategic recommendations
   */
  private generateStrategicRecommendations(
    tool: RegisteredTool,
    priceBenchmark: PriceBenchmark,
    marketShare: MarketShare,
    featureGaps: FeatureGap[],
    performanceRanking: CompetitorAnalysisReport["performanceRanking"]
  ): string[] {
    const recommendations: string[] = []

    // Pricing recommendations
    if (priceBenchmark.recommendation === "expensive") {
      recommendations.push(
        `Consider reducing price: Your tool is in the top 10% for pricing. ` +
        `The category median is ${priceBenchmark.categoryMedian}. A price reduction ` +
        `could significantly increase adoption.`
      )
    } else if (priceBenchmark.recommendation === "lower") {
      recommendations.push(
        `Consider a price increase: Your tool is priced below 75% of competitors. ` +
        `If your quality justifies it, raising prices could boost revenue without losing users.`
      )
    }

    // Market share recommendations
    if (marketShare.yourShare < 5 && marketShare.totalMarketCalls > 1000) {
      recommendations.push(
        `Focus on growth: Your market share is ${marketShare.yourShare.toFixed(1)}%. ` +
        `Consider promotional pricing, partnerships, or improved marketing to increase visibility.`
      )
    }

    // Feature gap recommendations
    const highImpactGaps = featureGaps.filter(g => g.estimatedImpact === "high")
    if (highImpactGaps.length > 0) {
      const features = highImpactGaps.slice(0, 3).map(g => g.feature).join(", ")
      recommendations.push(
        `Address feature gaps: Most competitors have these features that you're missing: ${features}. ` +
        `Adding these could significantly improve competitiveness.`
      )
    }

    // Performance recommendations
    const responseTimeRank = performanceRanking.find(r => r.metric === "Response Time")
    if (responseTimeRank && responseTimeRank.rank > responseTimeRank.totalInCategory * 0.5) {
      recommendations.push(
        `Improve response time: Your tool ranks #${responseTimeRank.rank} out of ` +
        `${responseTimeRank.totalInCategory} in response time. ` +
        `Consider optimization to improve user experience.`
      )
    }

    const ratingRank = performanceRanking.find(r => r.metric === "User Rating")
    if (ratingRank && ratingRank.yourValue < ratingRank.categoryAvg) {
      recommendations.push(
        `Improve user satisfaction: Your rating (${ratingRank.yourValue.toFixed(1)}) is below ` +
        `the category average (${ratingRank.categoryAvg.toFixed(1)}). ` +
        `Focus on reliability, documentation, and user feedback.`
      )
    }

    // Differentiation recommendations
    if (recommendations.length === 0) {
      recommendations.push(
        `Strong competitive position! Consider: adding unique features not offered by ` +
        `competitors, targeting underserved niches, or building partnerships for distribution.`
      )
    }

    return recommendations
  }

  /**
   * Quick comparison to a specific competitor
   */
  async compareToCompetitor(
    yourToolId: string,
    competitorToolId: string
  ): Promise<{
    comparison: Record<string, { yours: string | number; theirs: string | number; winner: "you" | "them" | "tie" }>
    summary: string
  }> {
    const yourTool = await toolRegistry.getTool(yourToolId)
    const theirTool = await toolRegistry.getTool(competitorToolId)

    if (!yourTool || !theirTool) {
      throw new Error("One or both tools not found")
    }

    const comparison: Record<string, { yours: string | number; theirs: string | number; winner: "you" | "them" | "tie" }> = {}

    // Price (lower is better for users, but higher revenue per call)
    const yourPrice = parseFloat(yourTool.pricing.basePrice || "0")
    const theirPrice = parseFloat(theirTool.pricing.basePrice || "0")
    comparison["Price"] = {
      yours: yourTool.pricing.basePrice || "0",
      theirs: theirTool.pricing.basePrice || "0",
      winner: yourPrice === theirPrice ? "tie" : yourPrice < theirPrice ? "you" : "them",
    }

    // Rating
    comparison["Rating"] = {
      yours: yourTool.metadata.rating,
      theirs: theirTool.metadata.rating,
      winner: yourTool.metadata.rating === theirTool.metadata.rating ? "tie" :
        yourTool.metadata.rating > theirTool.metadata.rating ? "you" : "them",
    }

    // Response time (lower is better)
    comparison["Response Time"] = {
      yours: yourTool.metadata.avgResponseTime,
      theirs: theirTool.metadata.avgResponseTime,
      winner: yourTool.metadata.avgResponseTime === theirTool.metadata.avgResponseTime ? "tie" :
        yourTool.metadata.avgResponseTime < theirTool.metadata.avgResponseTime ? "you" : "them",
    }

    // Uptime
    comparison["Uptime"] = {
      yours: yourTool.metadata.uptime,
      theirs: theirTool.metadata.uptime,
      winner: yourTool.metadata.uptime === theirTool.metadata.uptime ? "tie" :
        yourTool.metadata.uptime > theirTool.metadata.uptime ? "you" : "them",
    }

    // Total calls (popularity)
    comparison["Popularity"] = {
      yours: yourTool.metadata.totalCalls,
      theirs: theirTool.metadata.totalCalls,
      winner: yourTool.metadata.totalCalls === theirTool.metadata.totalCalls ? "tie" :
        yourTool.metadata.totalCalls > theirTool.metadata.totalCalls ? "you" : "them",
    }

    // Count wins
    let yourWins = 0
    let theirWins = 0
    for (const metric of Object.values(comparison)) {
      if (metric.winner === "you") yourWins++
      else if (metric.winner === "them") theirWins++
    }

    let summary: string
    if (yourWins > theirWins) {
      summary = `You're winning ${yourWins} to ${theirWins} in the comparison. ` +
        `Focus on maintaining your strengths while addressing weaker areas.`
    } else if (theirWins > yourWins) {
      summary = `Competitor is ahead ${theirWins} to ${yourWins}. ` +
        `Review areas where they excel and develop a strategy to improve.`
    } else {
      summary = `It's a tie! Both tools have similar overall performance. ` +
        `Differentiation through unique features or better marketing could give you an edge.`
    }

    return { comparison, summary }
  }
}

// Singleton instance
export const competitorAnalysis = new CompetitorAnalysisService()
