/**
 * Metrics Collector
 * @description Collects and aggregates metrics from tool marketplace activities
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { timeseriesDB, type DataPoint, type AggregatedDataPoint } from "./timeseries.js"
import Logger from "@/utils/logger.js"

/**
 * Geographic data for analytics
 */
export interface GeoData {
  /** Country code (ISO 3166-1 alpha-2) */
  country: string
  /** Region/state */
  region?: string
  /** City */
  city?: string
}

/**
 * Call metrics for a tool
 */
export interface CallMetrics {
  /** Total call count */
  totalCalls: number
  /** Successful calls */
  successfulCalls: number
  /** Failed calls */
  failedCalls: number
  /** Success rate (0-100) */
  successRate: number
  /** Calls change percentage from previous period */
  changePercent: string
}

/**
 * Revenue metrics
 */
export interface RevenueMetrics {
  /** Total revenue in USD */
  totalRevenue: string
  /** Revenue change percentage */
  changePercent: string
  /** Revenue by token */
  byToken: Record<string, string>
  /** Revenue by chain */
  byChain: Record<string, string>
}

/**
 * Response time metrics
 */
export interface ResponseTimeMetrics {
  /** Average response time (ms) */
  avg: number
  /** Median response time (ms) */
  p50: number
  /** 95th percentile (ms) */
  p95: number
  /** 99th percentile (ms) */
  p99: number
  /** Minimum response time (ms) */
  min: number
  /** Maximum response time (ms) */
  max: number
}

/**
 * User metrics
 */
export interface UserMetrics {
  /** Unique users */
  uniqueUsers: number
  /** New users */
  newUsers: number
  /** Returning users */
  returningUsers: number
  /** Average calls per user */
  avgCallsPerUser: number
}

/**
 * Geographic distribution
 */
export interface GeoDistribution {
  /** Country breakdown */
  countries: Array<{
    code: string
    name: string
    count: number
    percentage: number
  }>
  /** Top regions */
  topRegions: Array<{
    region: string
    country: string
    count: number
  }>
}

/**
 * Metric names for the marketplace
 */
export const METRIC_NAMES = {
  // Tool metrics
  TOOL_CALLS: "marketplace.tool.calls",
  TOOL_REVENUE: "marketplace.tool.revenue",
  TOOL_RESPONSE_TIME: "marketplace.tool.response_time",
  TOOL_ERRORS: "marketplace.tool.errors",
  
  // Platform metrics
  PLATFORM_TOTAL_CALLS: "marketplace.platform.total_calls",
  PLATFORM_TOTAL_REVENUE: "marketplace.platform.total_revenue",
  PLATFORM_ACTIVE_USERS: "marketplace.platform.active_users",
  PLATFORM_NEW_TOOLS: "marketplace.platform.new_tools",
  
  // Creator metrics
  CREATOR_REVENUE: "marketplace.creator.revenue",
  CREATOR_TOOLS: "marketplace.creator.tools",
} as const

/**
 * Internal storage for detailed tracking
 */
interface DetailedStorage {
  /** User activity by tool: toolId -> Set of user addresses */
  usersByTool: Map<string, Set<string>>
  /** All-time users by tool */
  allTimeUsersByTool: Map<string, Set<string>>
  /** First seen timestamp for users */
  userFirstSeen: Map<string, number>
  /** Geographic data by user (anonymized) */
  geoByUser: Map<string, GeoData>
  /** Revenue by token for each tool */
  revenueByToken: Map<string, Map<string, number>>
  /** Revenue by chain for each tool */
  revenueByChain: Map<string, Map<string, number>>
  /** Call success/failure counts */
  callResults: Map<string, { success: number; failure: number }>
}

const detailedStorage: DetailedStorage = {
  usersByTool: new Map(),
  allTimeUsersByTool: new Map(),
  userFirstSeen: new Map(),
  geoByUser: new Map(),
  revenueByToken: new Map(),
  revenueByChain: new Map(),
  callResults: new Map(),
}

/**
 * Initialize metrics in the time series database
 */
function initializeMetrics(): void {
  // Tool metrics
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.TOOL_CALLS,
    description: "Number of tool calls",
    unit: "count",
  })
  
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.TOOL_REVENUE,
    description: "Revenue from tool usage",
    unit: "USD",
  })
  
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.TOOL_RESPONSE_TIME,
    description: "Tool response time",
    unit: "ms",
  })
  
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.TOOL_ERRORS,
    description: "Tool error count",
    unit: "count",
  })
  
  // Platform metrics
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.PLATFORM_TOTAL_CALLS,
    description: "Total platform calls",
    unit: "count",
  })
  
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.PLATFORM_TOTAL_REVENUE,
    description: "Total platform revenue",
    unit: "USD",
  })
  
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.PLATFORM_ACTIVE_USERS,
    description: "Active users count",
    unit: "count",
  })
  
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.PLATFORM_NEW_TOOLS,
    description: "New tools registered",
    unit: "count",
  })
  
  // Creator metrics
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.CREATOR_REVENUE,
    description: "Creator revenue",
    unit: "USD",
  })
  
  timeseriesDB.registerMetric({
    name: METRIC_NAMES.CREATOR_TOOLS,
    description: "Creator tool count",
    unit: "count",
  })
}

// Initialize on module load
initializeMetrics()

/**
 * Metrics Collector Service
 * Collects and provides access to marketplace metrics
 */
export class MetricsCollectorService {
  private periodStart: number
  
  constructor() {
    // Start of current period (used for tracking period-specific data)
    this.periodStart = this.getDayStart(Date.now())
  }

  /**
   * Get start of day timestamp
   */
  private getDayStart(timestamp: number): number {
    const date = new Date(timestamp)
    date.setHours(0, 0, 0, 0)
    return date.getTime()
  }

  /**
   * Record a tool call
   */
  recordCall(params: {
    toolId: string
    creatorAddress: Address
    userAddress: Address
    amount: string
    token: string
    chain: string
    responseTime: number
    success: boolean
    geo?: GeoData
  }): void {
    const { toolId, creatorAddress, userAddress, amount, token, chain, responseTime, success, geo } = params
    const now = Date.now()
    const amountNum = parseFloat(amount) || 0

    // Record in time series
    timeseriesDB.record(METRIC_NAMES.TOOL_CALLS, 1, { toolId, success })
    timeseriesDB.record(METRIC_NAMES.TOOL_REVENUE, amountNum, { toolId, token, chain })
    timeseriesDB.record(METRIC_NAMES.TOOL_RESPONSE_TIME, responseTime, { toolId })
    timeseriesDB.record(METRIC_NAMES.PLATFORM_TOTAL_CALLS, 1)
    timeseriesDB.record(METRIC_NAMES.PLATFORM_TOTAL_REVENUE, amountNum)
    timeseriesDB.record(METRIC_NAMES.CREATOR_REVENUE, amountNum, { creatorAddress })

    if (!success) {
      timeseriesDB.record(METRIC_NAMES.TOOL_ERRORS, 1, { toolId })
    }

    // Track unique users
    let toolUsers = detailedStorage.usersByTool.get(toolId)
    if (!toolUsers) {
      toolUsers = new Set()
      detailedStorage.usersByTool.set(toolId, toolUsers)
    }
    
    const userKey = userAddress.toLowerCase()
    const isNewUser = !toolUsers.has(userKey)
    toolUsers.add(userKey)

    // All-time users
    let allTimeUsers = detailedStorage.allTimeUsersByTool.get(toolId)
    if (!allTimeUsers) {
      allTimeUsers = new Set()
      detailedStorage.allTimeUsersByTool.set(toolId, allTimeUsers)
    }
    
    const isFirstTimeUser = !allTimeUsers.has(userKey)
    allTimeUsers.add(userKey)

    // Track first seen
    if (isFirstTimeUser) {
      detailedStorage.userFirstSeen.set(`${toolId}:${userKey}`, now)
    }

    // Track geographic data (anonymized)
    if (geo) {
      detailedStorage.geoByUser.set(userKey, geo)
    }

    // Track revenue by token
    let tokenRevenue = detailedStorage.revenueByToken.get(toolId)
    if (!tokenRevenue) {
      tokenRevenue = new Map()
      detailedStorage.revenueByToken.set(toolId, tokenRevenue)
    }
    tokenRevenue.set(token, (tokenRevenue.get(token) || 0) + amountNum)

    // Track revenue by chain
    let chainRevenue = detailedStorage.revenueByChain.get(toolId)
    if (!chainRevenue) {
      chainRevenue = new Map()
      detailedStorage.revenueByChain.set(toolId, chainRevenue)
    }
    chainRevenue.set(chain, (chainRevenue.get(chain) || 0) + amountNum)

    // Track call results
    let results = detailedStorage.callResults.get(toolId)
    if (!results) {
      results = { success: 0, failure: 0 }
      detailedStorage.callResults.set(toolId, results)
    }
    if (success) {
      results.success++
    } else {
      results.failure++
    }

    Logger.debug(`MetricsCollector: Recorded call for ${toolId}`)
  }

  /**
   * Record a new tool registration
   */
  recordToolRegistration(params: {
    toolId: string
    creatorAddress: Address
    category: string
  }): void {
    timeseriesDB.record(METRIC_NAMES.PLATFORM_NEW_TOOLS, 1, {
      toolId: params.toolId,
      creatorAddress: params.creatorAddress,
      category: params.category,
    })
    timeseriesDB.record(METRIC_NAMES.CREATOR_TOOLS, 1, {
      creatorAddress: params.creatorAddress,
    })
  }

  /**
   * Get call metrics for a tool
   */
  getCallMetrics(toolId: string, startTime: number, endTime: number): CallMetrics {
    const results = detailedStorage.callResults.get(toolId) || { success: 0, failure: 0 }
    const totalCalls = results.success + results.failure
    
    // Get time series data for the period
    const data = timeseriesDB.query(METRIC_NAMES.TOOL_CALLS, {
      startTime,
      endTime,
      granularity: "hour",
    })

    const periodCalls = data.reduce((sum, d) => sum + d.count, 0)

    // Get previous period for comparison
    const periodDuration = endTime - startTime
    const prevData = timeseriesDB.query(METRIC_NAMES.TOOL_CALLS, {
      startTime: startTime - periodDuration,
      endTime: startTime,
      granularity: "hour",
    })
    const prevPeriodCalls = prevData.reduce((sum, d) => sum + d.count, 0)

    const changePercent = prevPeriodCalls > 0
      ? (((periodCalls - prevPeriodCalls) / prevPeriodCalls) * 100).toFixed(1)
      : "0.0"

    return {
      totalCalls,
      successfulCalls: results.success,
      failedCalls: results.failure,
      successRate: totalCalls > 0 ? (results.success / totalCalls) * 100 : 0,
      changePercent: (parseFloat(changePercent) >= 0 ? "+" : "") + changePercent + "%",
    }
  }

  /**
   * Get revenue metrics for a tool
   */
  getRevenueMetrics(toolId: string, startTime: number, endTime: number): RevenueMetrics {
    const data = timeseriesDB.query(METRIC_NAMES.TOOL_REVENUE, {
      startTime,
      endTime,
      granularity: "hour",
    })

    const totalRevenue = data.reduce((sum, d) => sum + d.sum, 0)

    // Get previous period
    const periodDuration = endTime - startTime
    const prevData = timeseriesDB.query(METRIC_NAMES.TOOL_REVENUE, {
      startTime: startTime - periodDuration,
      endTime: startTime,
      granularity: "hour",
    })
    const prevRevenue = prevData.reduce((sum, d) => sum + d.sum, 0)

    const changePercent = prevRevenue > 0
      ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : "0.0"

    // Get breakdown by token
    const tokenRevenue = detailedStorage.revenueByToken.get(toolId) || new Map()
    const byToken: Record<string, string> = {}
    for (const [token, amount] of tokenRevenue) {
      byToken[token] = amount.toFixed(6)
    }

    // Get breakdown by chain
    const chainRevenue = detailedStorage.revenueByChain.get(toolId) || new Map()
    const byChain: Record<string, string> = {}
    for (const [chain, amount] of chainRevenue) {
      byChain[chain] = amount.toFixed(6)
    }

    return {
      totalRevenue: totalRevenue.toFixed(6),
      changePercent: (parseFloat(changePercent) >= 0 ? "+" : "") + changePercent + "%",
      byToken,
      byChain,
    }
  }

  /**
   * Get response time metrics for a tool
   */
  getResponseTimeMetrics(toolId: string, startTime: number, endTime: number): ResponseTimeMetrics {
    const data = timeseriesDB.query(METRIC_NAMES.TOOL_RESPONSE_TIME, {
      startTime,
      endTime,
      granularity: "hour",
    })

    if (data.length === 0) {
      return { avg: 0, p50: 0, p95: 0, p99: 0, min: 0, max: 0 }
    }

    // Combine all aggregated data
    const totalCount = data.reduce((sum, d) => sum + d.count, 0)
    const weightedAvg = data.reduce((sum, d) => sum + d.avg * d.count, 0) / totalCount

    // Use the percentiles from the aggregated data (approximation)
    const latestWithData = data.find(d => d.count > 0) ?? data[0]!

    return {
      avg: Math.round(weightedAvg),
      p50: Math.round(latestWithData.percentiles.p50),
      p95: Math.round(latestWithData.percentiles.p95),
      p99: Math.round(latestWithData.percentiles.p99),
      min: Math.round(Math.min(...data.map(d => d.min))),
      max: Math.round(Math.max(...data.map(d => d.max))),
    }
  }

  /**
   * Get user metrics for a tool
   */
  getUserMetrics(toolId: string, startTime: number, endTime: number): UserMetrics {
    const periodUsers = detailedStorage.usersByTool.get(toolId) || new Set()
    const allTimeUsers = detailedStorage.allTimeUsersByTool.get(toolId) || new Set()

    // Count new users in period
    let newUsers = 0
    for (const user of periodUsers) {
      const firstSeen = detailedStorage.userFirstSeen.get(`${toolId}:${user}`)
      if (firstSeen && firstSeen >= startTime && firstSeen <= endTime) {
        newUsers++
      }
    }

    const uniqueUsers = periodUsers.size
    const returningUsers = uniqueUsers - newUsers

    // Get total calls for avg calculation
    const results = detailedStorage.callResults.get(toolId) || { success: 0, failure: 0 }
    const totalCalls = results.success + results.failure

    return {
      uniqueUsers,
      newUsers,
      returningUsers,
      avgCallsPerUser: uniqueUsers > 0 ? Math.round(totalCalls / uniqueUsers) : 0,
    }
  }

  /**
   * Get geographic distribution for a tool
   */
  getGeoDistribution(toolId: string): GeoDistribution {
    const toolUsers = detailedStorage.usersByTool.get(toolId) || new Set()
    const countryCount = new Map<string, number>()
    const regionCount = new Map<string, number>()

    for (const user of toolUsers) {
      const geo = detailedStorage.geoByUser.get(user)
      if (geo) {
        countryCount.set(geo.country, (countryCount.get(geo.country) || 0) + 1)
        if (geo.region) {
          const key = `${geo.region}, ${geo.country}`
          regionCount.set(key, (regionCount.get(key) || 0) + 1)
        }
      }
    }

    const totalUsers = toolUsers.size

    // Country names mapping (partial)
    const countryNames: Record<string, string> = {
      US: "United States",
      GB: "United Kingdom",
      DE: "Germany",
      FR: "France",
      JP: "Japan",
      CN: "China",
      IN: "India",
      BR: "Brazil",
      CA: "Canada",
      AU: "Australia",
    }

    const countries = Array.from(countryCount.entries())
      .map(([code, count]) => ({
        code,
        name: countryNames[code] || code,
        count,
        percentage: totalUsers > 0 ? (count / totalUsers) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const topRegions = Array.from(regionCount.entries())
      .map(([key, count]) => {
        const [region = "Unknown", country = "Unknown"] = key.split(", ")
        return { region, country, count }
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    return { countries, topRegions }
  }

  /**
   * Get platform-wide metrics
   */
  getPlatformMetrics(startTime: number, endTime: number): {
    totalCalls: number
    totalRevenue: string
    activeUsers: number
    newTools: number
    callsChange: string
    revenueChange: string
  } {
    const callsData = timeseriesDB.query(METRIC_NAMES.PLATFORM_TOTAL_CALLS, {
      startTime,
      endTime,
      granularity: "hour",
    })
    const totalCalls = callsData.reduce((sum, d) => sum + d.count, 0)

    const revenueData = timeseriesDB.query(METRIC_NAMES.PLATFORM_TOTAL_REVENUE, {
      startTime,
      endTime,
      granularity: "hour",
    })
    const totalRevenue = revenueData.reduce((sum, d) => sum + d.sum, 0)

    const toolsData = timeseriesDB.query(METRIC_NAMES.PLATFORM_NEW_TOOLS, {
      startTime,
      endTime,
      granularity: "hour",
    })
    const newTools = toolsData.reduce((sum, d) => sum + d.count, 0)

    // Count active users across all tools
    let activeUsers = 0
    for (const users of detailedStorage.usersByTool.values()) {
      activeUsers += users.size
    }

    // Calculate changes
    const periodDuration = endTime - startTime
    const prevCallsData = timeseriesDB.query(METRIC_NAMES.PLATFORM_TOTAL_CALLS, {
      startTime: startTime - periodDuration,
      endTime: startTime,
      granularity: "hour",
    })
    const prevCalls = prevCallsData.reduce((sum, d) => sum + d.count, 0)

    const prevRevenueData = timeseriesDB.query(METRIC_NAMES.PLATFORM_TOTAL_REVENUE, {
      startTime: startTime - periodDuration,
      endTime: startTime,
      granularity: "hour",
    })
    const prevRevenue = prevRevenueData.reduce((sum, d) => sum + d.sum, 0)

    const callsChange = prevCalls > 0
      ? (((totalCalls - prevCalls) / prevCalls) * 100).toFixed(1)
      : "0.0"
    
    const revenueChange = prevRevenue > 0
      ? (((totalRevenue - prevRevenue) / prevRevenue) * 100).toFixed(1)
      : "0.0"

    return {
      totalCalls,
      totalRevenue: totalRevenue.toFixed(6),
      activeUsers,
      newTools,
      callsChange: (parseFloat(callsChange) >= 0 ? "+" : "") + callsChange + "%",
      revenueChange: (parseFloat(revenueChange) >= 0 ? "+" : "") + revenueChange + "%",
    }
  }

  /**
   * Get time series chart data
   */
  getChartData(
    metricName: string,
    startTime: number,
    endTime: number,
    granularity: "hour" | "day" | "week" = "day"
  ): Array<{ date: string; value: string }> {
    const data = timeseriesDB.query(metricName, {
      startTime,
      endTime,
      granularity,
    })

    return data.map(point => ({
      date: new Date(point.timestamp).toISOString().split("T")[0] ?? new Date(point.timestamp).toISOString(),
      value: point.sum.toFixed(6),
    }))
  }

  /**
   * Get peak usage hours
   */
  getPeakUsageHours(toolId: string, days: number = 7): number[] {
    const now = Date.now()
    const startTime = now - days * 24 * 60 * 60 * 1000

    const data = timeseriesDB.query(METRIC_NAMES.TOOL_CALLS, {
      startTime,
      endTime: now,
      granularity: "hour",
    })

    // Aggregate by hour of day
    const hourCounts = new Map<number, number>()
    for (const point of data) {
      const hour = new Date(point.timestamp).getUTCHours()
      hourCounts.set(hour, (hourCounts.get(hour) || 0) + point.count)
    }

    // Get top 3 hours
    return Array.from(hourCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour]) => hour)
  }

  /**
   * Reset period tracking (call at start of new day)
   */
  resetPeriod(): void {
    detailedStorage.usersByTool.clear()
    this.periodStart = this.getDayStart(Date.now())
    Logger.info("MetricsCollector: Period reset")
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollectorService()
