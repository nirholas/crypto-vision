/**
 * Predictive Analytics
 * @description Revenue forecasting, churn prediction, and demand prediction
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { timeseriesDB, type AggregatedDataPoint } from "./timeseries.js"
import { METRIC_NAMES } from "./collector.js"
import { toolRegistry } from "../registry.js"
import type { RegisteredTool } from "../types.js"
import Logger from "@/utils/logger.js"

/**
 * Revenue forecast result
 */
export interface RevenueForecast {
  /** Forecast period */
  period: {
    start: number
    end: number
    days: number
  }
  /** Current revenue run rate */
  currentRunRate: string
  /** Forecasted revenue */
  forecast: {
    low: string    // Conservative estimate (25th percentile)
    mid: string    // Expected value (median)
    high: string   // Optimistic estimate (75th percentile)
  }
  /** Confidence level (0-100) */
  confidence: number
  /** Trend direction */
  trend: "growing" | "stable" | "declining"
  /** Trend strength (-100 to 100) */
  trendStrength: number
  /** Daily forecasts */
  dailyForecast: Array<{
    date: string
    low: string
    mid: string
    high: string
  }>
  /** Factors affecting forecast */
  factors: string[]
}

/**
 * Churn prediction for a user
 */
export interface ChurnPrediction {
  /** User address */
  userAddress: Address
  /** Churn probability (0-100) */
  churnProbability: number
  /** Risk level */
  riskLevel: "low" | "medium" | "high" | "critical"
  /** Days since last activity */
  daysSinceLastActivity: number
  /** Activity trend */
  activityTrend: "increasing" | "stable" | "decreasing"
  /** Signals indicating churn risk */
  riskSignals: string[]
  /** Recommended retention actions */
  recommendedActions: string[]
  /** Estimated revenue at risk */
  revenueAtRisk: string
}

/**
 * Demand prediction for a tool
 */
export interface DemandPrediction {
  /** Tool ID */
  toolId: string
  /** Tool name */
  toolName: string
  /** Growth probability (0-100) */
  growthProbability: number
  /** Predicted growth rate */
  predictedGrowthRate: string
  /** Current weekly calls */
  currentWeeklyCalls: number
  /** Predicted weekly calls (next week) */
  predictedWeeklyCalls: number
  /** Growth signals */
  growthSignals: string[]
  /** Potential blockers */
  blockers: string[]
  /** Market opportunity score (0-100) */
  opportunityScore: number
}

/**
 * Pricing optimization suggestion
 */
export interface PricingOptimization {
  /** Tool ID */
  toolId: string
  /** Current price */
  currentPrice: string
  /** Suggested price */
  suggestedPrice: string
  /** Expected revenue change */
  expectedRevenueChange: string
  /** Price elasticity estimate */
  priceElasticity: number
  /** Confidence */
  confidence: number
  /** Rationale */
  rationale: string[]
  /** Competitor context */
  competitorContext: {
    avgPrice: string
    minPrice: string
    maxPrice: string
  }
}

/**
 * User activity record for churn analysis
 */
interface UserActivity {
  lastActive: number
  totalCalls: number
  totalSpent: number
  callsByWeek: Map<string, number>
  toolsUsed: Set<string>
}

/**
 * Internal storage for predictions
 */
interface PredictionStorage {
  /** User activity: userId -> activity */
  userActivity: Map<string, UserActivity>
  /** Historical forecasts for validation */
  historicalForecasts: Array<{
    timestamp: number
    predicted: number
    actual?: number
  }>
}

const storage: PredictionStorage = {
  userActivity: new Map(),
  historicalForecasts: [],
}

/**
 * Simple linear regression
 */
function linearRegression(data: number[]): { slope: number; intercept: number; r2: number } {
  const n = data.length
  if (n < 2) return { slope: 0, intercept: data[0] ?? 0, r2: 0 }

  const xMean = (n - 1) / 2
  const yMean = data.reduce((a, b) => a + b, 0) / n

  let ssXY = 0
  let ssXX = 0
  let ssYY = 0

  for (let i = 0; i < n; i++) {
    const xDiff = i - xMean
    const yVal = data[i]
    if (yVal === undefined) continue
    const yDiff = yVal - yMean
    ssXY += xDiff * yDiff
    ssXX += xDiff * xDiff
    ssYY += yDiff * yDiff
  }

  const slope = ssXX !== 0 ? ssXY / ssXX : 0
  const intercept = yMean - slope * xMean
  const r2 = ssYY !== 0 ? Math.pow(ssXY, 2) / (ssXX * ssYY) : 0

  return { slope, intercept, r2 }
}

/**
 * Calculate moving average
 */
function movingAverage(data: number[], window: number): number[] {
  const result: number[] = []
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - window + 1)
    const slice = data.slice(start, i + 1)
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length)
  }
  return result
}

/**
 * Exponential smoothing forecast
 */
function exponentialSmoothing(
  data: number[],
  alpha: number = 0.3,
  periods: number = 7
): number[] {
  if (data.length === 0) return Array(periods).fill(0)

  const firstVal = data[0]
  if (firstVal === undefined) return Array(periods).fill(0)
  
  const smoothed: number[] = [firstVal]
  for (let i = 1; i < data.length; i++) {
    const currVal = data[i]
    const prevSmooth = smoothed[i - 1]
    if (currVal !== undefined && prevSmooth !== undefined) {
      smoothed.push(alpha * currVal + (1 - alpha) * prevSmooth)
    }
  }

  const lastValue = smoothed[smoothed.length - 1]
  if (lastValue === undefined) return Array(periods).fill(0)
  
  const forecast: number[] = []
  
  // Simple trend-adjusted forecast
  const last = data[data.length - 1]
  const secondLast = data[data.length - 2]
  const recentTrend = (data.length > 1 && last !== undefined && secondLast !== undefined && last !== 0)
    ? (last - secondLast) / last
    : 0

  for (let i = 0; i < periods; i++) {
    const forecasted = lastValue * (1 + recentTrend * (i + 1) * 0.1)
    forecast.push(Math.max(0, forecasted))
  }

  return forecast
}

/**
 * Get week key
 */
function getWeekKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const weekNum = Math.ceil(
    (date.getTime() - new Date(year, 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000)
  )
  return `${year}-W${weekNum.toString().padStart(2, "0")}`
}

/**
 * Predictive Analytics Service
 */
export class PredictiveAnalyticsService {
  /**
   * Track user activity for churn prediction
   */
  trackUserActivity(
    userAddress: Address,
    toolId: string,
    amount: number,
    timestamp: number = Date.now()
  ): void {
    const userId = userAddress.toLowerCase()
    let activity = storage.userActivity.get(userId)

    if (!activity) {
      activity = {
        lastActive: timestamp,
        totalCalls: 0,
        totalSpent: 0,
        callsByWeek: new Map(),
        toolsUsed: new Set(),
      }
      storage.userActivity.set(userId, activity)
    }

    activity.lastActive = Math.max(activity.lastActive, timestamp)
    activity.totalCalls++
    activity.totalSpent += amount
    activity.toolsUsed.add(toolId)

    const weekKey = getWeekKey(timestamp)
    activity.callsByWeek.set(
      weekKey,
      (activity.callsByWeek.get(weekKey) || 0) + 1
    )
  }

  /**
   * Forecast revenue for a tool or the entire platform
   */
  async forecastRevenue(
    toolId?: string,
    days: number = 30
  ): Promise<RevenueForecast> {
    const now = Date.now()
    const historyDays = Math.max(90, days * 2) // Use at least 90 days of history
    const historyStart = now - historyDays * 24 * 60 * 60 * 1000

    // Get historical data
    const metricName = toolId ? METRIC_NAMES.TOOL_REVENUE : METRIC_NAMES.PLATFORM_TOTAL_REVENUE
    const data = timeseriesDB.query(metricName, {
      startTime: historyStart,
      endTime: now,
      granularity: "day",
    })

    const dailyValues = data.map(d => d.sum)
    
    if (dailyValues.length < 7) {
      // Not enough data
      return this.createEmptyForecast(now, days)
    }

    // Calculate current run rate
    const recentDays = dailyValues.slice(-7)
    const currentRunRate = recentDays.reduce((a, b) => a + b, 0) / 7

    // Analyze trend
    const regression = linearRegression(dailyValues)
    const trendStrength = regression.slope * dailyValues.length / 
      (Math.max(...dailyValues) - Math.min(...dailyValues) || 1) * 100

    let trend: RevenueForecast["trend"]
    if (trendStrength > 5) trend = "growing"
    else if (trendStrength < -5) trend = "declining"
    else trend = "stable"

    // Generate forecast using exponential smoothing
    const forecast = exponentialSmoothing(dailyValues, 0.3, days)

    // Calculate confidence intervals
    const volatility = this.calculateVolatility(dailyValues)
    const confidenceMultiplier = 1.96 * volatility // 95% confidence

    // Generate daily forecasts
    const dailyForecast: RevenueForecast["dailyForecast"] = []
    let totalLow = 0
    let totalMid = 0
    let totalHigh = 0

    for (let i = 0; i < days; i++) {
      const date = new Date(now + (i + 1) * 24 * 60 * 60 * 1000)
      const mid = forecast[i] || currentRunRate
      const low = Math.max(0, mid * (1 - confidenceMultiplier))
      const high = mid * (1 + confidenceMultiplier)

      dailyForecast.push({
        date: date.toISOString().split("T")[0] ?? date.toISOString().slice(0, 10),
        low: low.toFixed(6),
        mid: mid.toFixed(6),
        high: high.toFixed(6),
      })

      totalLow += low
      totalMid += mid
      totalHigh += high
    }

    // Calculate confidence based on data quality
    const confidence = Math.min(95, 50 + regression.r2 * 30 + Math.min(dailyValues.length, 30))

    // Identify factors
    const factors: string[] = []
    if (trend === "growing") {
      factors.push("Positive growth trend detected")
    } else if (trend === "declining") {
      factors.push("Declining trend may continue")
    }
    if (volatility > 0.3) {
      factors.push("High volatility adds uncertainty")
    }
    if (dailyValues.length < 30) {
      factors.push("Limited historical data affects accuracy")
    }

    return {
      period: {
        start: now,
        end: now + days * 24 * 60 * 60 * 1000,
        days,
      },
      currentRunRate: currentRunRate.toFixed(6),
      forecast: {
        low: totalLow.toFixed(6),
        mid: totalMid.toFixed(6),
        high: totalHigh.toFixed(6),
      },
      confidence,
      trend,
      trendStrength: Math.round(trendStrength),
      dailyForecast,
      factors,
    }
  }

  /**
   * Predict churn risk for users
   */
  async predictChurn(
    toolId?: string,
    limit: number = 50
  ): Promise<ChurnPrediction[]> {
    const now = Date.now()
    const predictions: ChurnPrediction[] = []

    for (const [userId, activity] of storage.userActivity) {
      // Skip if tool specified and user hasn't used it
      if (toolId && !activity.toolsUsed.has(toolId)) continue

      const daysSinceLastActivity = Math.floor(
        (now - activity.lastActive) / (24 * 60 * 60 * 1000)
      )

      // Calculate activity trend
      const weeklyActivity = this.getWeeklyActivityTrend(activity)
      
      let activityTrend: ChurnPrediction["activityTrend"]
      if (weeklyActivity.trend > 0.1) activityTrend = "increasing"
      else if (weeklyActivity.trend < -0.1) activityTrend = "decreasing"
      else activityTrend = "stable"

      // Calculate churn probability
      let churnProbability = 0
      const riskSignals: string[] = []
      const recommendedActions: string[] = []

      // Factor: Days since last activity
      if (daysSinceLastActivity > 30) {
        churnProbability += 40
        riskSignals.push(`Inactive for ${daysSinceLastActivity} days`)
        recommendedActions.push("Send re-engagement email with special offer")
      } else if (daysSinceLastActivity > 14) {
        churnProbability += 25
        riskSignals.push(`${daysSinceLastActivity} days since last activity`)
        recommendedActions.push("Send activity reminder notification")
      } else if (daysSinceLastActivity > 7) {
        churnProbability += 10
      }

      // Factor: Activity trend
      if (activityTrend === "decreasing") {
        churnProbability += 20
        riskSignals.push("Activity has been declining")
        recommendedActions.push("Survey user for feedback on experience")
      }

      // Factor: Usage diversity
      if (activity.toolsUsed.size === 1) {
        churnProbability += 10
        riskSignals.push("Only uses one tool (low engagement)")
        recommendedActions.push("Recommend related tools to increase stickiness")
      }

      // Factor: Low total usage
      if (activity.totalCalls < 10) {
        churnProbability += 15
        riskSignals.push("Low total usage (may not have found value)")
        recommendedActions.push("Provide onboarding guidance and tutorials")
      }

      churnProbability = Math.min(100, churnProbability)

      // Determine risk level
      let riskLevel: ChurnPrediction["riskLevel"]
      if (churnProbability >= 70) riskLevel = "critical"
      else if (churnProbability >= 50) riskLevel = "high"
      else if (churnProbability >= 30) riskLevel = "medium"
      else riskLevel = "low"

      // Calculate revenue at risk
      const avgRevenuePerCall = activity.totalSpent / activity.totalCalls
      const expectedFutureValue = avgRevenuePerCall * 50 // Assume 50 more calls
      const revenueAtRisk = expectedFutureValue * (churnProbability / 100)

      predictions.push({
        userAddress: userId as Address,
        churnProbability,
        riskLevel,
        daysSinceLastActivity,
        activityTrend,
        riskSignals,
        recommendedActions: recommendedActions.slice(0, 3),
        revenueAtRisk: revenueAtRisk.toFixed(6),
      })
    }

    // Sort by churn probability (highest first)
    return predictions
      .sort((a, b) => b.churnProbability - a.churnProbability)
      .slice(0, limit)
  }

  /**
   * Predict demand growth for tools
   */
  async predictDemand(limit: number = 20): Promise<DemandPrediction[]> {
    const tools = await toolRegistry.discoverTools({ activeOnly: true, limit: 100 })
    const now = Date.now()
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000
    const twoWeeksAgo = now - 14 * 24 * 60 * 60 * 1000

    const predictions: DemandPrediction[] = []

    for (const tool of tools) {
      // Get recent call data
      const recentData = timeseriesDB.query(METRIC_NAMES.TOOL_CALLS, {
        startTime: twoWeeksAgo,
        endTime: now,
        granularity: "day",
      })

      const dailyCalls = recentData.map(d => d.count)
      const thisWeekCalls = dailyCalls.slice(-7).reduce((a, b) => a + b, 0)
      const lastWeekCalls = dailyCalls.slice(0, 7).reduce((a, b) => a + b, 0)

      // Calculate growth rate
      const growthRate = lastWeekCalls > 0
        ? ((thisWeekCalls - lastWeekCalls) / lastWeekCalls) * 100
        : thisWeekCalls > 0 ? 100 : 0

      // Predict next week
      const regression = linearRegression(dailyCalls)
      const predictedDaily = regression.intercept + regression.slope * (dailyCalls.length + 3)
      const predictedWeeklyCalls = Math.round(Math.max(0, predictedDaily * 7))

      // Calculate growth probability
      let growthProbability = 50 // Base probability

      const growthSignals: string[] = []
      const blockers: string[] = []

      if (growthRate > 20) {
        growthProbability += 25
        growthSignals.push(`Strong growth momentum (${growthRate.toFixed(1)}% last week)`)
      } else if (growthRate > 0) {
        growthProbability += 10
        growthSignals.push("Positive growth trend")
      } else if (growthRate < -10) {
        growthProbability -= 20
        blockers.push("Declining usage trend")
      }

      if (tool.metadata.rating >= 4.5) {
        growthProbability += 15
        growthSignals.push("Excellent user rating")
      } else if (tool.metadata.rating < 3.5 && tool.metadata.ratingCount > 5) {
        growthProbability -= 15
        blockers.push("Below-average user rating")
      }

      if (tool.metadata.avgResponseTime > 2000) {
        growthProbability -= 10
        blockers.push("High latency may limit growth")
      }

      if (!tool.docsUrl) {
        blockers.push("Missing documentation")
      }

      // Calculate opportunity score based on market potential
      const categoryTools = tools.filter(t => t.category === tool.category)
      const marketLeader = Math.max(...categoryTools.map(t => t.metadata.totalCalls))
      const marketShare = marketLeader > 0 ? (tool.metadata.totalCalls / marketLeader) * 100 : 0
      const opportunityScore = Math.round(100 - marketShare) // More room to grow = higher opportunity

      growthProbability = Math.max(0, Math.min(100, growthProbability))

      predictions.push({
        toolId: tool.toolId,
        toolName: tool.name,
        growthProbability,
        predictedGrowthRate: (growthRate >= 0 ? "+" : "") + growthRate.toFixed(1) + "%",
        currentWeeklyCalls: thisWeekCalls,
        predictedWeeklyCalls,
        growthSignals,
        blockers,
        opportunityScore,
      })
    }

    // Sort by growth probability
    return predictions
      .sort((a, b) => b.growthProbability - a.growthProbability)
      .slice(0, limit)
  }

  /**
   * Get pricing optimization suggestions
   */
  async suggestPricing(toolId: string): Promise<PricingOptimization> {
    const tool = await toolRegistry.getTool(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    // Get competitors in same category
    const competitors = await toolRegistry.discoverTools({
      category: tool.category,
      activeOnly: true,
    })

    const competitorPrices = competitors
      .filter(t => t.toolId !== toolId && parseFloat(t.pricing.basePrice || "0") > 0)
      .map(t => parseFloat(t.pricing.basePrice || "0"))

    const currentPrice = parseFloat(tool.pricing.basePrice || "0")
    const avgPrice = competitorPrices.length > 0
      ? competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length
      : currentPrice

    // Estimate price elasticity based on rating and performance
    let elasticity = -1.5 // Default: 10% price increase = 15% demand decrease

    if (tool.metadata.rating >= 4.5) {
      elasticity = -0.8 // High rating = less price sensitive
    } else if (tool.metadata.rating < 3.5) {
      elasticity = -2.0 // Low rating = more price sensitive
    }

    // Determine suggested price
    let suggestedPrice = currentPrice
    const rationale: string[] = []
    let expectedRevenueChange = "0%"
    let confidence = 50

    if (currentPrice < avgPrice * 0.5) {
      // Significantly underpriced
      suggestedPrice = avgPrice * 0.7
      rationale.push("Current price is significantly below market average")
      rationale.push("Increasing price may signal higher quality")
      const priceIncrease = (suggestedPrice - currentPrice) / currentPrice
      const demandChange = priceIncrease * elasticity * 100
      const revenueChange = priceIncrease * 100 + demandChange
      expectedRevenueChange = (revenueChange >= 0 ? "+" : "") + revenueChange.toFixed(1) + "%"
      confidence = 65
    } else if (currentPrice > avgPrice * 1.5 && tool.metadata.rating < 4.0) {
      // Overpriced for quality
      suggestedPrice = avgPrice * 1.1
      rationale.push("Price is premium but rating doesn't justify it")
      rationale.push("Reducing price may increase adoption")
      const priceDecrease = (currentPrice - suggestedPrice) / currentPrice
      const demandChange = priceDecrease * Math.abs(elasticity) * 100
      expectedRevenueChange = "+" + (demandChange - priceDecrease * 100).toFixed(1) + "%"
      confidence = 60
    } else if (tool.metadata.rating >= 4.5 && currentPrice < avgPrice) {
      // High quality at below-average price
      suggestedPrice = avgPrice * 1.1
      rationale.push("High rating indicates room for premium pricing")
      const priceIncrease = (suggestedPrice - currentPrice) / currentPrice
      const demandChange = priceIncrease * elasticity * 100
      const revenueChange = priceIncrease * 100 + demandChange
      expectedRevenueChange = (revenueChange >= 0 ? "+" : "") + revenueChange.toFixed(1) + "%"
      confidence = 70
    } else {
      rationale.push("Current pricing appears well-optimized")
      rationale.push("Consider A/B testing small adjustments")
      confidence = 40
    }

    return {
      toolId,
      currentPrice: currentPrice.toFixed(6),
      suggestedPrice: suggestedPrice.toFixed(6),
      expectedRevenueChange,
      priceElasticity: elasticity,
      confidence,
      rationale,
      competitorContext: {
        avgPrice: avgPrice.toFixed(6),
        minPrice: competitorPrices.length > 0
          ? Math.min(...competitorPrices).toFixed(6)
          : "0",
        maxPrice: competitorPrices.length > 0
          ? Math.max(...competitorPrices).toFixed(6)
          : "0",
      },
    }
  }

  /**
   * Calculate volatility of values
   */
  private calculateVolatility(values: number[]): number {
    if (values.length < 2) return 0

    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length
    const stddev = Math.sqrt(variance)

    return mean > 0 ? stddev / mean : 0
  }

  /**
   * Get weekly activity trend for a user
   */
  private getWeeklyActivityTrend(activity: UserActivity): { trend: number } {
    const weeks = Array.from(activity.callsByWeek.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8) // Last 8 weeks

    if (weeks.length < 3) return { trend: 0 }

    const values = weeks.map(([, count]) => count)
    const regression = linearRegression(values)

    // Normalize trend by average
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const normalizedTrend = avg > 0 ? regression.slope / avg : 0

    return { trend: normalizedTrend }
  }

  /**
   * Create empty forecast when not enough data
   */
  private createEmptyForecast(now: number, days: number): RevenueForecast {
    return {
      period: {
        start: now,
        end: now + days * 24 * 60 * 60 * 1000,
        days,
      },
      currentRunRate: "0",
      forecast: { low: "0", mid: "0", high: "0" },
      confidence: 0,
      trend: "stable",
      trendStrength: 0,
      dailyForecast: [],
      factors: ["Insufficient historical data for forecasting"],
    }
  }
}

// Singleton instance
export const predictiveAnalytics = new PredictiveAnalyticsService()
