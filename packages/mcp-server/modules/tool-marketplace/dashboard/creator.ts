/**
 * Creator Insights Dashboard
 * @description Comprehensive analytics dashboard for tool creators
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { timeseriesDB } from "../analytics/timeseries.js"
import {
  metricsCollector,
  METRIC_NAMES,
  type GeoDistribution,
  type ResponseTimeMetrics,
} from "../analytics/collector.js"
import { toolRegistry } from "../registry.js"
import Logger from "@/utils/logger.js"

/**
 * Tool performance summary
 */
export interface ToolPerformance {
  /** Tool ID */
  toolId: string
  /** Tool name */
  name: string
  /** Display name */
  displayName: string
  /** Total revenue */
  revenue: string
  /** Revenue change percentage */
  revenueChange: string
  /** Total calls */
  calls: number
  /** Calls change percentage */
  callsChange: string
  /** Unique users */
  uniqueUsers: number
  /** Success rate */
  successRate: number
  /** Average response time */
  avgResponseTime: number
  /** User rating */
  rating: number
}

/**
 * Time series data for charts
 */
export interface TimeSeriesData {
  /** Data points */
  data: Array<{
    date: string
    value: string
  }>
  /** Period label */
  period: string
  /** Granularity */
  granularity: "hour" | "day" | "week"
}

/**
 * User retention cohort
 */
export interface RetentionCohort {
  /** Cohort start date */
  cohortDate: string
  /** Users in cohort */
  cohortSize: number
  /** Retention by period */
  retention: {
    /** Period (week 1, week 2, etc.) */
    period: string
    /** Retained users */
    retained: number
    /** Retention percentage */
    percentage: number
  }[]
}

/**
 * Full creator dashboard
 */
export interface CreatorDashboard {
  /** Creator address */
  creatorAddress: Address
  /** Dashboard period */
  period: {
    start: number
    end: number
    label: string
  }
  /** Total revenue all time */
  totalRevenue: string
  /** Revenue in current period */
  periodRevenue: string
  /** Revenue change from previous period */
  revenueChange24h: string
  /** Total calls all time */
  totalCalls: number
  /** Calls in current period */
  periodCalls: number
  /** Unique users all time */
  uniqueUsers: number
  /** New users in period */
  newUsers: number
  /** Average rating across tools */
  avgRating: number
  /** Top performing tools */
  topTools: ToolPerformance[]
  /** Revenue chart data */
  revenueChart: TimeSeriesData
  /** Calls chart data */
  callsChart: TimeSeriesData
  /** Geographic breakdown */
  geographicBreakdown: GeoDistribution
  /** Peak usage hours (UTC) */
  peakUsageHours: number[]
  /** User retention cohorts */
  userRetention: RetentionCohort[]
  /** Response time metrics */
  performance: ResponseTimeMetrics
}

/**
 * Tool deep-dive insights
 */
export interface ToolInsights {
  /** Tool ID */
  toolId: string
  /** Tool name */
  name: string
  /** Display name */
  displayName: string
  /** Tool description */
  description: string
  /** Current status */
  status: string
  /** Registration date */
  registeredAt: string
  /** Period for metrics */
  period: {
    start: number
    end: number
    label: string
  }
  /** Revenue metrics */
  revenue: {
    total: string
    period: string
    change: string
    byDay: TimeSeriesData
    byToken: Record<string, string>
    byChain: Record<string, string>
  }
  /** Usage metrics */
  usage: {
    totalCalls: number
    periodCalls: number
    callsChange: string
    successRate: number
    byDay: TimeSeriesData
    byHour: Array<{ hour: number; count: number }>
  }
  /** User metrics */
  users: {
    unique: number
    new: number
    returning: number
    avgCallsPerUser: number
    topUsers: Array<{
      address: string
      calls: number
      revenue: string
    }>
  }
  /** Performance metrics */
  performance: {
    avgResponseTime: number
    p50: number
    p95: number
    p99: number
    uptime: number
  }
  /** Geographic distribution */
  geography: GeoDistribution
  /** User rating */
  rating: {
    average: number
    count: number
    distribution: Record<number, number>
  }
  /** Recommendations for improvement */
  recommendations: string[]
}

/**
 * Usage heatmap data
 */
export interface UsageHeatmap {
  /** Tool ID (or 'all' for platform) */
  toolId: string
  /** Period */
  period: string
  /** Heatmap data by day and hour */
  data: Array<{
    day: number  // 0-6 (Sunday-Saturday)
    hour: number // 0-23
    value: number
    percentage: number
  }>
  /** Peak times */
  peakTimes: Array<{
    day: string
    hour: number
    value: number
  }>
  /** Quiet times */
  quietTimes: Array<{
    day: string
    hour: number
    value: number
  }>
}

/**
 * Internal storage for retention tracking
 */
interface RetentionStorage {
  /** User cohorts by tool: toolId -> cohortDate -> Set of users */
  cohorts: Map<string, Map<string, Set<string>>>
  /** User activity by week: toolId -> weekKey -> Set of users */
  weeklyActivity: Map<string, Map<string, Set<string>>>
  /** Top users by tool: toolId -> Map<userAddress, { calls, revenue }> */
  topUsers: Map<string, Map<string, { calls: number; revenue: number }>>
}

const retentionStorage: RetentionStorage = {
  cohorts: new Map(),
  weeklyActivity: new Map(),
  topUsers: new Map(),
}

/**
 * Get week key from timestamp
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
 * Get day names
 */
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/**
 * Creator Insights Service
 */
export class CreatorInsightsService {
  /**
   * Track user activity for retention analysis
   */
  trackUserActivity(
    toolId: string,
    userAddress: Address,
    revenue: number,
    timestamp: number = Date.now()
  ): void {
    const userKey = userAddress.toLowerCase()
    const cohortDate = new Date(timestamp).toISOString().split("T")[0]
    const weekKey = getWeekKey(timestamp)

    // Track cohort
    let toolCohorts = retentionStorage.cohorts.get(toolId)
    if (!toolCohorts) {
      toolCohorts = new Map()
      retentionStorage.cohorts.set(toolId, toolCohorts)
    }
    
    // Find user's cohort (first time they used the tool)
    let userCohort: string | null = null
    for (const [date, users] of toolCohorts) {
      if (users.has(userKey)) {
        userCohort = date
        break
      }
    }
    
    if (!userCohort) {
      // New user, add to today's cohort
      let cohort = toolCohorts.get(cohortDate!)
      if (!cohort) {
        cohort = new Set()
        toolCohorts.set(cohortDate!, cohort)
      }
      cohort.add(userKey)
    }

    // Track weekly activity
    let toolWeekly = retentionStorage.weeklyActivity.get(toolId)
    if (!toolWeekly) {
      toolWeekly = new Map()
      retentionStorage.weeklyActivity.set(toolId, toolWeekly)
    }
    
    let weekUsers = toolWeekly.get(weekKey)
    if (!weekUsers) {
      weekUsers = new Set()
      toolWeekly.set(weekKey, weekUsers)
    }
    weekUsers.add(userKey)

    // Track top users
    let toolTopUsers = retentionStorage.topUsers.get(toolId)
    if (!toolTopUsers) {
      toolTopUsers = new Map()
      retentionStorage.topUsers.set(toolId, toolTopUsers)
    }
    
    const userData = toolTopUsers.get(userKey) || { calls: 0, revenue: 0 }
    userData.calls++
    userData.revenue += revenue
    toolTopUsers.set(userKey, userData)
  }

  /**
   * Get full creator dashboard
   */
  async getCreatorDashboard(
    creatorAddress: Address,
    periodDays: number = 30
  ): Promise<CreatorDashboard> {
    const now = Date.now()
    const periodStart = now - periodDays * 24 * 60 * 60 * 1000
    const prevPeriodStart = periodStart - periodDays * 24 * 60 * 60 * 1000

    // Get creator's tools
    const tools = await toolRegistry.getToolsByOwner(creatorAddress)
    
    let totalRevenue = 0
    let periodRevenue = 0
    let prevPeriodRevenue = 0
    let totalCalls = 0
    let periodCalls = 0
    let uniqueUsers = 0
    let newUsers = 0
    let totalRating = 0
    let ratedTools = 0

    const toolPerformances: ToolPerformance[] = []
    const revenueByDay = new Map<string, number>()
    const callsByDay = new Map<string, number>()
    const combinedGeo: GeoDistribution = { countries: [], topRegions: [] }
    const peakHours = new Map<number, number>()

    for (const tool of tools) {
      // Get metrics from collector
      const revenueMetrics = metricsCollector.getRevenueMetrics(tool.toolId, periodStart, now)
      const callMetrics = metricsCollector.getCallMetrics(tool.toolId, periodStart, now)
      const userMetrics = metricsCollector.getUserMetrics(tool.toolId, periodStart, now)
      const geoData = metricsCollector.getGeoDistribution(tool.toolId)
      const peakUsageHours = metricsCollector.getPeakUsageHours(tool.toolId, periodDays)

      // Aggregate totals
      totalRevenue += parseFloat(tool.metadata.totalRevenue)
      periodRevenue += parseFloat(revenueMetrics.totalRevenue)
      totalCalls += tool.metadata.totalCalls
      periodCalls += callMetrics.totalCalls
      uniqueUsers += userMetrics.uniqueUsers
      newUsers += userMetrics.newUsers

      if (tool.metadata.rating > 0) {
        totalRating += tool.metadata.rating
        ratedTools++
      }

      // Track peak hours
      for (const hour of peakUsageHours) {
        peakHours.set(hour, (peakHours.get(hour) || 0) + 1)
      }

      // Build tool performance
      toolPerformances.push({
        toolId: tool.toolId,
        name: tool.name,
        displayName: tool.displayName,
        revenue: revenueMetrics.totalRevenue,
        revenueChange: revenueMetrics.changePercent,
        calls: callMetrics.totalCalls,
        callsChange: callMetrics.changePercent,
        uniqueUsers: userMetrics.uniqueUsers,
        successRate: callMetrics.successRate,
        avgResponseTime: tool.metadata.avgResponseTime,
        rating: tool.metadata.rating,
      })

      // Get chart data
      const chartData = metricsCollector.getChartData(
        METRIC_NAMES.TOOL_REVENUE,
        periodStart,
        now,
        periodDays > 7 ? "day" : "hour"
      )
      
      for (const point of chartData) {
        const current = revenueByDay.get(point.date) || 0
        revenueByDay.set(point.date, current + parseFloat(point.value))
      }

      // Merge geo data
      for (const country of geoData.countries) {
        const existing = combinedGeo.countries.find((c: { code: string }) => c.code === country.code)
        if (existing) {
          existing.count += country.count
        } else {
          combinedGeo.countries.push({ ...country })
        }
      }
    }

    // Sort tools by revenue
    toolPerformances.sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))

    // Get top 3 peak hours
    const sortedPeakHours = Array.from(peakHours.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour)

    // Recalculate geo percentages
    const totalGeoUsers = combinedGeo.countries.reduce((sum: number, c: { count: number }) => sum + c.count, 0)
    for (const country of combinedGeo.countries) {
      country.percentage = totalGeoUsers > 0 ? (country.count / totalGeoUsers) * 100 : 0
    }
    combinedGeo.countries.sort((a: { count: number }, b: { count: number }) => b.count - a.count)

    // Build revenue chart data
    const revenueChartData: TimeSeriesData = {
      data: Array.from(revenueByDay.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, value]) => ({ date, value: value.toFixed(6) })),
      period: `Last ${periodDays} days`,
      granularity: periodDays > 7 ? "day" : "hour",
    }

    // Calculate revenue change
    const changePercent = prevPeriodRevenue > 0
      ? (((periodRevenue - prevPeriodRevenue) / prevPeriodRevenue) * 100).toFixed(1)
      : "0.0"

    // Get retention data
    const userRetention = this.getRetentionCohorts(tools[0]?.toolId || "", 4)

    // Get aggregate performance
    const performance = metricsCollector.getResponseTimeMetrics(
      tools[0]?.toolId || "",
      periodStart,
      now
    )

    return {
      creatorAddress,
      period: {
        start: periodStart,
        end: now,
        label: `last_${periodDays}_days`,
      },
      totalRevenue: totalRevenue.toFixed(6),
      periodRevenue: periodRevenue.toFixed(6),
      revenueChange24h: (parseFloat(changePercent) >= 0 ? "+" : "") + changePercent + "%",
      totalCalls,
      periodCalls,
      uniqueUsers,
      newUsers,
      avgRating: ratedTools > 0 ? totalRating / ratedTools : 0,
      topTools: toolPerformances.slice(0, 10),
      revenueChart: revenueChartData,
      callsChart: {
        data: Array.from(callsByDay.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, value]) => ({ date, value: value.toString() })),
        period: `Last ${periodDays} days`,
        granularity: "day",
      },
      geographicBreakdown: combinedGeo,
      peakUsageHours: sortedPeakHours,
      userRetention,
      performance,
    }
  }

  /**
   * Get deep insights for a specific tool
   */
  async getToolInsights(toolId: string, periodDays: number = 30): Promise<ToolInsights> {
    const tool = await toolRegistry.getTool(toolId)
    if (!tool) {
      throw new Error(`Tool not found: ${toolId}`)
    }

    const now = Date.now()
    const periodStart = now - periodDays * 24 * 60 * 60 * 1000

    // Get all metrics
    const revenueMetrics = metricsCollector.getRevenueMetrics(toolId, periodStart, now)
    const callMetrics = metricsCollector.getCallMetrics(toolId, periodStart, now)
    const userMetrics = metricsCollector.getUserMetrics(toolId, periodStart, now)
    const responseMetrics = metricsCollector.getResponseTimeMetrics(toolId, periodStart, now)
    const geoData = metricsCollector.getGeoDistribution(toolId)

    // Get chart data
    const revenueByDay = metricsCollector.getChartData(
      METRIC_NAMES.TOOL_REVENUE,
      periodStart,
      now,
      "day"
    )

    const callsByDay = metricsCollector.getChartData(
      METRIC_NAMES.TOOL_CALLS,
      periodStart,
      now,
      "day"
    )

    // Get hourly usage pattern
    const hourlyData = timeseriesDB.query(METRIC_NAMES.TOOL_CALLS, {
      startTime: periodStart,
      endTime: now,
      granularity: "hour",
    })

    const byHour: Array<{ hour: number; count: number }> = []
    const hourCounts = new Map<number, number>()
    for (const point of hourlyData) {
      const hour = new Date(point.timestamp).getUTCHours()
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + point.count)
    }
    for (let hour = 0; hour < 24; hour++) {
      byHour.push({ hour, count: hourCounts.get(hour) || 0 })
    }

    // Get top users
    const toolTopUsers = retentionStorage.topUsers.get(toolId) || new Map()
    const topUsers = Array.from(toolTopUsers.entries())
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 10)
      .map(([address, data]) => ({
        address: `${address.slice(0, 6)}...${address.slice(-4)}`,
        calls: data.calls,
        revenue: data.revenue.toFixed(6),
      }))

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      tool,
      callMetrics,
      revenueMetrics,
      responseMetrics
    )

    return {
      toolId: tool.toolId,
      name: tool.name,
      displayName: tool.displayName,
      description: tool.description,
      status: tool.status,
      registeredAt: new Date(tool.registeredAt).toISOString(),
      period: {
        start: periodStart,
        end: now,
        label: `last_${periodDays}_days`,
      },
      revenue: {
        total: tool.metadata.totalRevenue,
        period: revenueMetrics.totalRevenue,
        change: revenueMetrics.changePercent,
        byDay: {
          data: revenueByDay,
          period: `Last ${periodDays} days`,
          granularity: "day",
        },
        byToken: revenueMetrics.byToken,
        byChain: revenueMetrics.byChain,
      },
      usage: {
        totalCalls: tool.metadata.totalCalls,
        periodCalls: callMetrics.totalCalls,
        callsChange: callMetrics.changePercent,
        successRate: callMetrics.successRate,
        byDay: {
          data: callsByDay,
          period: `Last ${periodDays} days`,
          granularity: "day",
        },
        byHour,
      },
      users: {
        unique: userMetrics.uniqueUsers,
        new: userMetrics.newUsers,
        returning: userMetrics.returningUsers,
        avgCallsPerUser: userMetrics.avgCallsPerUser,
        topUsers,
      },
      performance: {
        avgResponseTime: responseMetrics.avg,
        p50: responseMetrics.p50,
        p95: responseMetrics.p95,
        p99: responseMetrics.p99,
        uptime: tool.metadata.uptime,
      },
      geography: geoData,
      rating: {
        average: tool.metadata.rating,
        count: tool.metadata.ratingCount,
        distribution: {}, // Would need additional tracking
      },
      recommendations,
    }
  }

  /**
   * Get usage heatmap
   */
  async getUsageHeatmap(toolId: string, days: number = 7): Promise<UsageHeatmap> {
    const now = Date.now()
    const startTime = now - days * 24 * 60 * 60 * 1000

    const data = timeseriesDB.query(METRIC_NAMES.TOOL_CALLS, {
      startTime,
      endTime: now,
      granularity: "hour",
    })

    // Build heatmap matrix
    const matrix = new Map<string, number>()
    let maxValue = 0

    for (const point of data) {
      const date = new Date(point.timestamp)
      const day = date.getUTCDay()
      const hour = date.getUTCHours()
      const key = `${day}-${hour}`
      
      const value = (matrix.get(key) || 0) + point.count
      matrix.set(key, value)
      maxValue = Math.max(maxValue, value)
    }

    // Convert to heatmap data
    const heatmapData: UsageHeatmap["data"] = []
    const peakTimes: UsageHeatmap["peakTimes"] = []
    const quietTimes: UsageHeatmap["quietTimes"] = []

    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const key = `${day}-${hour}`
        const value = matrix.get(key) || 0
        const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
        
        heatmapData.push({ day, hour, value, percentage })
      }
    }

    // Sort to find peaks and quiet times
    const sorted = [...heatmapData].sort((a, b) => b.value - a.value)
    
    for (const item of sorted.slice(0, 5)) {
      peakTimes.push({
        day: DAY_NAMES[item.day] ?? `Day ${item.day}`,
        hour: item.hour,
        value: item.value,
      })
    }

    for (const item of sorted.slice(-5).reverse()) {
      if (item.value > 0) {
        quietTimes.push({
          day: DAY_NAMES[item.day] ?? `Day ${item.day}`,
          hour: item.hour,
          value: item.value,
        })
      }
    }

    return {
      toolId,
      period: `last_${days}_days`,
      data: heatmapData,
      peakTimes,
      quietTimes,
    }
  }

  /**
   * Get retention cohorts
   */
  private getRetentionCohorts(toolId: string, weeks: number = 8): RetentionCohort[] {
    const cohorts: RetentionCohort[] = []
    const toolCohorts = retentionStorage.cohorts.get(toolId)
    const toolWeekly = retentionStorage.weeklyActivity.get(toolId)

    if (!toolCohorts || !toolWeekly) {
      return cohorts
    }

    // Get cohorts from last N weeks
    const now = Date.now()
    const sortedCohortDates = Array.from(toolCohorts.keys())
      .sort()
      .slice(-weeks)

    for (const cohortDate of sortedCohortDates) {
      const users = toolCohorts.get(cohortDate)!
      const cohortSize = users.size
      const retention: RetentionCohort["retention"] = []

      // Check retention for subsequent weeks
      for (let week = 1; week <= 4; week++) {
        const cohortTime = new Date(cohortDate).getTime()
        const weekStart = cohortTime + week * 7 * 24 * 60 * 60 * 1000
        const weekKey = getWeekKey(weekStart)
        
        const weekUsers = toolWeekly.get(weekKey)
        if (!weekUsers) continue

        let retained = 0
        for (const user of users) {
          if (weekUsers.has(user)) {
            retained++
          }
        }

        retention.push({
          period: `Week ${week}`,
          retained,
          percentage: cohortSize > 0 ? (retained / cohortSize) * 100 : 0,
        })
      }

      cohorts.push({
        cohortDate,
        cohortSize,
        retention,
      })
    }

    return cohorts
  }

  /**
   * Generate improvement recommendations
   */
  private generateRecommendations(
    tool: any,
    callMetrics: any,
    revenueMetrics: any,
    responseMetrics: any
  ): string[] {
    const recommendations: string[] = []

    // Check success rate
    if (callMetrics.successRate < 95) {
      recommendations.push(
        `Improve reliability: Success rate is ${callMetrics.successRate.toFixed(1)}%. ` +
        `Consider adding better error handling and monitoring.`
      )
    }

    // Check response time
    if (responseMetrics.p95 > 2000) {
      recommendations.push(
        `Optimize performance: p95 latency is ${responseMetrics.p95}ms. ` +
        `Consider caching, query optimization, or scaling resources.`
      )
    }

    // Check if revenue is declining
    const revenueChange = parseFloat(revenueMetrics.changePercent)
    if (revenueChange < -10) {
      recommendations.push(
        `Address revenue decline: Revenue dropped ${Math.abs(revenueChange).toFixed(1)}%. ` +
        `Consider promotional pricing, new features, or marketing efforts.`
      )
    }

    // Check pricing competitiveness
    if (tool.pricing && parseFloat(tool.pricing.basePrice || "0") > 0.01) {
      recommendations.push(
        `Review pricing: Consider A/B testing different price points to optimize revenue.`
      )
    }

    // Check documentation
    if (!tool.docsUrl) {
      recommendations.push(
        `Add documentation: Tools with documentation typically see 40% higher adoption.`
      )
    }

    // Check rating
    if (tool.metadata.rating > 0 && tool.metadata.rating < 4) {
      recommendations.push(
        `Improve user satisfaction: Current rating is ${tool.metadata.rating.toFixed(1)}/5. ` +
        `Review user feedback and address common complaints.`
      )
    }

    // Default recommendation if everything is good
    if (recommendations.length === 0) {
      recommendations.push(
        `Great performance! Consider expanding to more chains or adding premium features.`
      )
    }

    return recommendations
  }
}

// Singleton instance
export const creatorInsights = new CreatorInsightsService()
