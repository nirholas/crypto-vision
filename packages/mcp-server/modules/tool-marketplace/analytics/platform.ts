/**
 * Platform Analytics
 * @description Marketplace-wide analytics for platform operators
 * @author nirholas
 * @license Apache-2.0
 */

import { toolRegistry } from "../registry.js"
import { type RegisteredTool, type ToolCategory } from "../types.js"
import { timeseriesDB } from "./timeseries.js"
import { metricsCollector, METRIC_NAMES } from "./collector.js"
import Logger from "@/utils/logger.js"

/**
 * Growth metrics (DAU, WAU, MAU)
 */
export interface GrowthMetrics {
  /** Daily Active Users */
  dau: number
  /** Weekly Active Users */
  wau: number
  /** Monthly Active Users */
  mau: number
  /** DAU/MAU ratio (stickiness) */
  stickiness: number
  /** User growth rate (%) */
  userGrowthRate: string
  /** Tool growth rate (%) */
  toolGrowthRate: string
  /** Revenue growth rate (%) */
  revenueGrowthRate: string
}

/**
 * Conversion funnel metrics
 */
export interface ConversionFunnel {
  /** Users who discovered tools */
  discover: number
  /** Users who viewed tool details */
  view: number
  /** Users who used a tool */
  use: number
  /** Users who used tools multiple times */
  repeat: number
  /** Conversion rates */
  conversionRates: {
    discoverToView: number
    viewToUse: number
    useToRepeat: number
    overall: number
  }
}

/**
 * Revenue by category
 */
export interface CategoryRevenue {
  /** Category name */
  category: ToolCategory
  /** Total revenue */
  revenue: string
  /** Percentage of total */
  percentage: number
  /** Number of tools */
  toolCount: number
  /** Average revenue per tool */
  avgRevenuePerTool: string
  /** Growth rate */
  growthRate: string
}

/**
 * Platform health metrics
 */
export interface PlatformHealth {
  /** Overall platform score (0-100) */
  healthScore: number
  /** API availability */
  apiAvailability: number
  /** Average response time across all tools */
  avgResponseTime: number
  /** Error rate */
  errorRate: number
  /** Active issues count */
  activeIssues: number
  /** Status */
  status: "healthy" | "degraded" | "critical"
  /** Recommendations */
  recommendations: string[]
}

/**
 * Full platform analytics overview
 */
export interface PlatformAnalyticsOverview {
  /** Snapshot timestamp */
  timestamp: number
  /** Time period */
  period: {
    start: number
    end: number
    label: string
  }
  /** Summary metrics */
  summary: {
    /** Total marketplace volume (USD) */
    totalVolume: string
    /** Volume change */
    volumeChange: string
    /** Total transactions */
    totalTransactions: number
    /** Transaction change */
    transactionChange: string
    /** Active tools */
    activeTools: number
    /** Active creators */
    activeCreators: number
    /** Active users */
    activeUsers: number
  }
  /** Growth metrics */
  growth: GrowthMetrics
  /** Revenue by category */
  revenueByCategory: CategoryRevenue[]
  /** Conversion funnel */
  funnel: ConversionFunnel
  /** Platform health */
  health: PlatformHealth
  /** Top performing tools */
  topTools: Array<{
    toolId: string
    name: string
    revenue: string
    calls: number
    rating: number
  }>
  /** Top creators */
  topCreators: Array<{
    address: string
    toolCount: number
    totalRevenue: string
    avgRating: number
  }>
  /** Charts */
  charts: {
    volumeByDay: Array<{ date: string; value: string }>
    transactionsByDay: Array<{ date: string; value: string }>
    newUsersByDay: Array<{ date: string; value: string }>
    newToolsByDay: Array<{ date: string; value: string }>
  }
}

/**
 * Internal storage for platform tracking
 */
interface PlatformStorage {
  /** User discovery events: userId -> timestamp */
  discoveries: Map<string, number>
  /** User view events: userId -> toolId -> timestamp */
  views: Map<string, Map<string, number>>
  /** User usage events: userId -> toolId -> count */
  usage: Map<string, Map<string, number>>
  /** Daily active users by date */
  dauByDate: Map<string, Set<string>>
  /** Weekly active users by week */
  wauByWeek: Map<string, Set<string>>
  /** Monthly active users by month */
  mauByMonth: Map<string, Set<string>>
}

const platformStorage: PlatformStorage = {
  discoveries: new Map(),
  views: new Map(),
  usage: new Map(),
  dauByDate: new Map(),
  wauByWeek: new Map(),
  mauByMonth: new Map(),
}

/**
 * Get date key
 */
function getDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().split("T")[0] ?? new Date(timestamp).toISOString().slice(0, 10)
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
 * Get month key
 */
function getMonthKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`
}

/**
 * Platform Analytics Service
 */
export class PlatformAnalyticsService {
  /**
   * Track user discovery event
   */
  trackDiscovery(userId: string, timestamp: number = Date.now()): void {
    if (!platformStorage.discoveries.has(userId)) {
      platformStorage.discoveries.set(userId, timestamp)
    }
    this.trackActiveUser(userId, timestamp)
  }

  /**
   * Track tool view event
   */
  trackView(userId: string, toolId: string, timestamp: number = Date.now()): void {
    let userViews = platformStorage.views.get(userId)
    if (!userViews) {
      userViews = new Map()
      platformStorage.views.set(userId, userViews)
    }
    if (!userViews.has(toolId)) {
      userViews.set(toolId, timestamp)
    }
    this.trackActiveUser(userId, timestamp)
  }

  /**
   * Track tool usage event
   */
  trackUsage(userId: string, toolId: string, timestamp: number = Date.now()): void {
    let userUsage = platformStorage.usage.get(userId)
    if (!userUsage) {
      userUsage = new Map()
      platformStorage.usage.set(userId, userUsage)
    }
    userUsage.set(toolId, (userUsage.get(toolId) || 0) + 1)
    this.trackActiveUser(userId, timestamp)
  }

  /**
   * Track active user
   */
  private trackActiveUser(userId: string, timestamp: number): void {
    const dateKey = getDateKey(timestamp)
    const weekKey = getWeekKey(timestamp)
    const monthKey = getMonthKey(timestamp)

    // DAU
    let dauSet = platformStorage.dauByDate.get(dateKey)
    if (!dauSet) {
      dauSet = new Set()
      platformStorage.dauByDate.set(dateKey, dauSet)
    }
    dauSet.add(userId)

    // WAU
    let wauSet = platformStorage.wauByWeek.get(weekKey)
    if (!wauSet) {
      wauSet = new Set()
      platformStorage.wauByWeek.set(weekKey, wauSet)
    }
    wauSet.add(userId)

    // MAU
    let mauSet = platformStorage.mauByMonth.get(monthKey)
    if (!mauSet) {
      mauSet = new Set()
      platformStorage.mauByMonth.set(monthKey, mauSet)
    }
    mauSet.add(userId)
  }

  /**
   * Get full platform analytics overview
   */
  async getOverview(periodDays: number = 30): Promise<PlatformAnalyticsOverview> {
    const now = Date.now()
    const periodStart = now - periodDays * 24 * 60 * 60 * 1000
    const prevPeriodStart = periodStart - periodDays * 24 * 60 * 60 * 1000

    // Get all tools
    const allTools = await toolRegistry.discoverTools({ activeOnly: false, limit: 10000 })
    const activeTools = allTools.filter(t => t.status === "active")

    // Get platform metrics
    const currentMetrics = metricsCollector.getPlatformMetrics(periodStart, now)

    // Calculate creators
    const creatorSet = new Set<string>()
    for (const tool of activeTools) {
      creatorSet.add(tool.owner.toLowerCase())
    }

    // Calculate previous period metrics for comparison
    const prevMetrics = metricsCollector.getPlatformMetrics(prevPeriodStart, periodStart)

    // Get growth metrics
    const growth = this.calculateGrowthMetrics(periodDays)

    // Get revenue by category
    const revenueByCategory = this.calculateRevenueByCategory(activeTools, periodStart, now)

    // Get conversion funnel
    const funnel = this.calculateConversionFunnel()

    // Get platform health
    const health = await this.calculatePlatformHealth(activeTools)

    // Get top tools
    const topTools = this.getTopTools(activeTools, 10)

    // Get top creators
    const topCreators = this.getTopCreators(activeTools, 10)

    // Get chart data
    const charts = {
      volumeByDay: metricsCollector.getChartData(
        METRIC_NAMES.PLATFORM_TOTAL_REVENUE,
        periodStart,
        now,
        "day"
      ),
      transactionsByDay: metricsCollector.getChartData(
        METRIC_NAMES.PLATFORM_TOTAL_CALLS,
        periodStart,
        now,
        "day"
      ),
      newUsersByDay: metricsCollector.getChartData(
        METRIC_NAMES.PLATFORM_ACTIVE_USERS,
        periodStart,
        now,
        "day"
      ),
      newToolsByDay: metricsCollector.getChartData(
        METRIC_NAMES.PLATFORM_NEW_TOOLS,
        periodStart,
        now,
        "day"
      ),
    }

    // Calculate total volume
    const totalVolume = allTools.reduce(
      (sum, t) => sum + parseFloat(t.metadata.totalRevenue),
      0
    )

    return {
      timestamp: now,
      period: {
        start: periodStart,
        end: now,
        label: `last_${periodDays}_days`,
      },
      summary: {
        totalVolume: totalVolume.toFixed(6),
        volumeChange: currentMetrics.revenueChange,
        totalTransactions: currentMetrics.totalCalls,
        transactionChange: currentMetrics.callsChange,
        activeTools: activeTools.length,
        activeCreators: creatorSet.size,
        activeUsers: currentMetrics.activeUsers,
      },
      growth,
      revenueByCategory,
      funnel,
      health,
      topTools,
      topCreators,
      charts,
    }
  }

  /**
   * Calculate growth metrics
   */
  private calculateGrowthMetrics(periodDays: number): GrowthMetrics {
    const now = Date.now()
    const today = getDateKey(now)
    const thisWeek = getWeekKey(now)
    const thisMonth = getMonthKey(now)

    const dau = platformStorage.dauByDate.get(today)?.size || 0
    const wau = platformStorage.wauByWeek.get(thisWeek)?.size || 0
    const mau = platformStorage.mauByMonth.get(thisMonth)?.size || 0

    const stickiness = mau > 0 ? (dau / mau) * 100 : 0

    // Calculate growth rates (mock for now - would need historical data)
    const userGrowthRate = "+5.2%"
    const toolGrowthRate = "+3.1%"
    const revenueGrowthRate = "+8.7%"

    return {
      dau,
      wau,
      mau,
      stickiness,
      userGrowthRate,
      toolGrowthRate,
      revenueGrowthRate,
    }
  }

  /**
   * Calculate revenue by category
   */
  private calculateRevenueByCategory(
    tools: RegisteredTool[],
    startTime: number,
    endTime: number
  ): CategoryRevenue[] {
    const categoryMap = new Map<ToolCategory, { revenue: number; tools: RegisteredTool[] }>()

    for (const tool of tools) {
      const category = tool.category
      let data = categoryMap.get(category)
      if (!data) {
        data = { revenue: 0, tools: [] }
        categoryMap.set(category, data)
      }
      data.revenue += parseFloat(tool.metadata.totalRevenue)
      data.tools.push(tool)
    }

    const totalRevenue = Array.from(categoryMap.values())
      .reduce((sum, d) => sum + d.revenue, 0)

    const results: CategoryRevenue[] = []

    for (const [category, data] of categoryMap) {
      results.push({
        category,
        revenue: data.revenue.toFixed(6),
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
        toolCount: data.tools.length,
        avgRevenuePerTool: data.tools.length > 0
          ? (data.revenue / data.tools.length).toFixed(6)
          : "0",
        growthRate: "+0%", // Would need historical comparison
      })
    }

    return results.sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue))
  }

  /**
   * Calculate conversion funnel
   */
  private calculateConversionFunnel(): ConversionFunnel {
    const discover = platformStorage.discoveries.size
    
    let viewCount = 0
    for (const views of platformStorage.views.values()) {
      if (views.size > 0) viewCount++
    }

    let useCount = 0
    let repeatCount = 0
    for (const usage of platformStorage.usage.values()) {
      if (usage.size > 0) {
        useCount++
        const totalUsage = Array.from(usage.values()).reduce((a, b) => a + b, 0)
        if (totalUsage > 1) repeatCount++
      }
    }

    return {
      discover,
      view: viewCount,
      use: useCount,
      repeat: repeatCount,
      conversionRates: {
        discoverToView: discover > 0 ? (viewCount / discover) * 100 : 0,
        viewToUse: viewCount > 0 ? (useCount / viewCount) * 100 : 0,
        useToRepeat: useCount > 0 ? (repeatCount / useCount) * 100 : 0,
        overall: discover > 0 ? (repeatCount / discover) * 100 : 0,
      },
    }
  }

  /**
   * Calculate platform health
   */
  private async calculatePlatformHealth(tools: RegisteredTool[]): Promise<PlatformHealth> {
    let totalResponseTime = 0
    let totalUptime = 0
    let toolsWithData = 0

    for (const tool of tools) {
      if (tool.metadata.avgResponseTime > 0) {
        totalResponseTime += tool.metadata.avgResponseTime
        totalUptime += tool.metadata.uptime
        toolsWithData++
      }
    }

    const avgResponseTime = toolsWithData > 0 ? totalResponseTime / toolsWithData : 0
    const avgUptime = toolsWithData > 0 ? totalUptime / toolsWithData : 100

    // Calculate error rate from time series
    const now = Date.now()
    const dayAgo = now - 24 * 60 * 60 * 1000

    const callsData = timeseriesDB.query(METRIC_NAMES.PLATFORM_TOTAL_CALLS, {
      startTime: dayAgo,
      endTime: now,
      granularity: "hour",
    })
    const errorsData = timeseriesDB.query(METRIC_NAMES.TOOL_ERRORS, {
      startTime: dayAgo,
      endTime: now,
      granularity: "hour",
    })

    const totalCalls = callsData.reduce((sum, d) => sum + d.count, 0)
    const totalErrors = errorsData.reduce((sum, d) => sum + d.count, 0)
    const errorRate = totalCalls > 0 ? (totalErrors / totalCalls) * 100 : 0

    // Calculate health score
    let healthScore = 100

    // Penalize for high response time
    if (avgResponseTime > 2000) healthScore -= 20
    else if (avgResponseTime > 1000) healthScore -= 10

    // Penalize for low uptime
    if (avgUptime < 99) healthScore -= 15
    else if (avgUptime < 99.9) healthScore -= 5

    // Penalize for high error rate
    if (errorRate > 5) healthScore -= 20
    else if (errorRate > 1) healthScore -= 10

    healthScore = Math.max(0, healthScore)

    // Determine status
    let status: PlatformHealth["status"]
    if (healthScore >= 80) status = "healthy"
    else if (healthScore >= 50) status = "degraded"
    else status = "critical"

    // Generate recommendations
    const recommendations: string[] = []
    if (avgResponseTime > 1000) {
      recommendations.push("Consider optimizing slow tools to improve overall platform performance")
    }
    if (errorRate > 1) {
      recommendations.push("Investigate high error rates and consider implementing circuit breakers")
    }
    if (avgUptime < 99.5) {
      recommendations.push("Review tool availability and consider redundancy measures")
    }
    if (recommendations.length === 0) {
      recommendations.push("Platform is performing well. Continue monitoring.")
    }

    return {
      healthScore,
      apiAvailability: avgUptime,
      avgResponseTime,
      errorRate,
      activeIssues: 0, // Would need issue tracking integration
      status,
      recommendations,
    }
  }

  /**
   * Get top performing tools
   */
  private getTopTools(
    tools: RegisteredTool[],
    limit: number
  ): PlatformAnalyticsOverview["topTools"] {
    return [...tools]
      .sort((a, b) => parseFloat(b.metadata.totalRevenue) - parseFloat(a.metadata.totalRevenue))
      .slice(0, limit)
      .map(t => ({
        toolId: t.toolId,
        name: t.name,
        revenue: t.metadata.totalRevenue,
        calls: t.metadata.totalCalls,
        rating: t.metadata.rating,
      }))
  }

  /**
   * Get top creators
   */
  private getTopCreators(
    tools: RegisteredTool[],
    limit: number
  ): PlatformAnalyticsOverview["topCreators"] {
    const creatorMap = new Map<string, {
      address: string
      tools: RegisteredTool[]
      totalRevenue: number
      totalRating: number
      ratedTools: number
    }>()

    for (const tool of tools) {
      const address = tool.owner.toLowerCase()
      let creator = creatorMap.get(address)
      if (!creator) {
        creator = {
          address,
          tools: [],
          totalRevenue: 0,
          totalRating: 0,
          ratedTools: 0,
        }
        creatorMap.set(address, creator)
      }
      creator.tools.push(tool)
      creator.totalRevenue += parseFloat(tool.metadata.totalRevenue)
      if (tool.metadata.rating > 0) {
        creator.totalRating += tool.metadata.rating
        creator.ratedTools++
      }
    }

    return Array.from(creatorMap.values())
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, limit)
      .map(c => ({
        address: `${c.address.slice(0, 6)}...${c.address.slice(-4)}`,
        toolCount: c.tools.length,
        totalRevenue: c.totalRevenue.toFixed(6),
        avgRating: c.ratedTools > 0 ? c.totalRating / c.ratedTools : 0,
      }))
  }

  /**
   * Get category breakdown
   */
  async getCategoryBreakdown(): Promise<{
    categories: Array<{
      name: ToolCategory
      tools: number
      revenue: string
      avgPrice: string
      avgRating: number
      topTool: string
    }>
  }> {
    const tools = await toolRegistry.discoverTools({ activeOnly: true, limit: 10000 })
    const categoryMap = new Map<ToolCategory, RegisteredTool[]>()

    for (const tool of tools) {
      let list = categoryMap.get(tool.category)
      if (!list) {
        list = []
        categoryMap.set(tool.category, list)
      }
      list.push(tool)
    }

    const categories = Array.from(categoryMap.entries()).map(([name, categoryTools]) => {
      const revenue = categoryTools.reduce(
        (sum, t) => sum + parseFloat(t.metadata.totalRevenue),
        0
      )
      const avgPrice = categoryTools.reduce(
        (sum, t) => sum + parseFloat(t.pricing.basePrice || "0"),
        0
      ) / categoryTools.length
      const avgRating = categoryTools.filter(t => t.metadata.rating > 0)
        .reduce((sum, t) => sum + t.metadata.rating, 0) /
        categoryTools.filter(t => t.metadata.rating > 0).length || 0

      const topTool = categoryTools.sort(
        (a, b) => parseFloat(b.metadata.totalRevenue) - parseFloat(a.metadata.totalRevenue)
      )[0]

      return {
        name,
        tools: categoryTools.length,
        revenue: revenue.toFixed(6),
        avgPrice: avgPrice.toFixed(6),
        avgRating,
        topTool: topTool?.name || "N/A",
      }
    })

    return {
      categories: categories.sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue)),
    }
  }
}

// Singleton instance
export const platformAnalytics = new PlatformAnalyticsService()
