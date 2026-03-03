/**
 * Search Analytics
 * @description Track search queries, clicks, and conversions for discovery optimization
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import crypto from "crypto"
import type {
  SearchQueryRecord,
  ClickRecord,
  ConversionRecord,
  ZeroResultQuery,
  SearchAnalyticsSummary,
} from "./types.js"

/**
 * Generate hash for anonymization
 */
function hashString(str: string): string {
  return crypto.createHash("sha256").update(str).digest("hex").slice(0, 16)
}

/**
 * Generate unique ID
 */
function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Period durations in milliseconds
 */
type AnalyticsPeriod = "1h" | "24h" | "7d" | "30d"

const PERIOD_MS: Record<AnalyticsPeriod, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
}

/**
 * Search Analytics Engine
 */
export class SearchAnalytics {
  private queryRecords: SearchQueryRecord[] = []
  private clickRecords: ClickRecord[] = []
  private conversionRecords: ConversionRecord[] = []
  private zeroResultQueries: Map<string, ZeroResultQuery> = new Map()
  
  // Configuration
  private maxRecords: number = 100_000
  private retentionDays: number = 90

  constructor(options: {
    maxRecords?: number
    retentionDays?: number
  } = {}) {
    this.maxRecords = options.maxRecords || 100_000
    this.retentionDays = options.retentionDays || 90
  }

  // ============================================================================
  // Recording Events
  // ============================================================================

  /**
   * Record a search query
   */
  recordQuery(params: {
    query: string
    resultsCount: number
    searchType: "fulltext" | "semantic" | "hybrid"
    filtersApplied?: string[]
    searchTimeMs: number
    userAddress?: string
  }): string {
    const queryId = generateId("q")

    const record: SearchQueryRecord = {
      queryId,
      query: params.query,
      queryHash: hashString(params.query.toLowerCase()),
      timestamp: Date.now(),
      userHash: params.userAddress ? hashString(params.userAddress.toLowerCase()) : undefined,
      resultsCount: params.resultsCount,
      searchType: params.searchType,
      filtersApplied: params.filtersApplied || [],
      searchTimeMs: params.searchTimeMs,
    }

    this.queryRecords.push(record)

    // Track zero-result queries
    if (params.resultsCount === 0) {
      this.trackZeroResultQuery(params.query)
    }

    // Cleanup if over limit
    this.cleanupIfNeeded()

    return queryId
  }

  /**
   * Record a click on a search result
   */
  recordClick(params: {
    queryId: string
    toolId: string
    position: number
  }): string {
    const clickId = generateId("c")

    const record: ClickRecord = {
      clickId,
      queryId: params.queryId,
      toolId: params.toolId,
      position: params.position,
      timestamp: Date.now(),
    }

    this.clickRecords.push(record)
    return clickId
  }

  /**
   * Record a conversion (search -> usage)
   */
  recordConversion(params: {
    queryId: string
    clickId: string
    toolId: string
    amountSpent: string
  }): string {
    const conversionId = generateId("cv")

    const record: ConversionRecord = {
      conversionId,
      queryId: params.queryId,
      clickId: params.clickId,
      toolId: params.toolId,
      timestamp: Date.now(),
      amountSpent: params.amountSpent,
    }

    this.conversionRecords.push(record)
    return conversionId
  }

  /**
   * Track zero-result query
   */
  private trackZeroResultQuery(query: string): void {
    const normalizedQuery = query.toLowerCase().trim()
    const existing = this.zeroResultQueries.get(normalizedQuery)

    if (existing) {
      existing.count++
      existing.lastSearchedAt = Date.now()
    } else {
      this.zeroResultQueries.set(normalizedQuery, {
        query: normalizedQuery,
        count: 1,
        firstSearchedAt: Date.now(),
        lastSearchedAt: Date.now(),
      })
    }
  }

  // ============================================================================
  // Analytics Queries
  // ============================================================================

  /**
   * Get analytics summary for a period
   */
  getSummary(period: "1h" | "24h" | "7d" | "30d"): SearchAnalyticsSummary {
    const cutoff = Date.now() - PERIOD_MS[period]

    // Filter records by period
    const queries = this.queryRecords.filter(q => q.timestamp >= cutoff)
    const clicks = this.clickRecords.filter(c => c.timestamp >= cutoff)
    const conversions = this.conversionRecords.filter(c => c.timestamp >= cutoff)

    // Calculate metrics
    const totalSearches = queries.length
    const uniqueQueries = new Set(queries.map(q => q.queryHash)).size
    const zeroResultCount = queries.filter(q => q.resultsCount === 0).length
    const zeroResultRate = totalSearches > 0 ? zeroResultCount / totalSearches : 0

    // Average results per search
    const avgResultsPerSearch = totalSearches > 0
      ? queries.reduce((sum, q) => sum + q.resultsCount, 0) / totalSearches
      : 0

    // Click-through rate (queries with at least one click)
    const queriesWithClicks = new Set(clicks.map(c => c.queryId)).size
    const clickThroughRate = totalSearches > 0 ? queriesWithClicks / totalSearches : 0

    // Conversion rate (clicks that led to conversions)
    const clicksWithConversions = new Set(conversions.map(c => c.clickId)).size
    const conversionRate = clicks.length > 0 ? clicksWithConversions / clicks.length : 0

    // Top queries
    const queryCount = new Map<string, { query: string; count: number }>()
    for (const q of queries) {
      const existing = queryCount.get(q.queryHash)
      if (existing) {
        existing.count++
      } else {
        queryCount.set(q.queryHash, { query: q.query, count: 1 })
      }
    }
    const topQueries = Array.from(queryCount.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Top zero-result queries
    const topZeroResultQueries = Array.from(this.zeroResultQueries.values())
      .filter(q => q.lastSearchedAt >= cutoff)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Popular categories searched
    const categoryCount = new Map<string, number>()
    for (const q of queries) {
      for (const filter of q.filtersApplied) {
        if (filter.startsWith("category:")) {
          const category = filter.replace("category:", "")
          categoryCount.set(category, (categoryCount.get(category) || 0) + 1)
        }
      }
    }
    const popularCategories = Array.from(categoryCount.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)

    // Average search time
    const avgSearchTimeMs = totalSearches > 0
      ? queries.reduce((sum, q) => sum + q.searchTimeMs, 0) / totalSearches
      : 0

    return {
      period,
      totalSearches,
      uniqueQueries,
      zeroResultRate,
      avgResultsPerSearch,
      clickThroughRate,
      conversionRate,
      topQueries,
      topZeroResultQueries,
      popularCategories,
      avgSearchTimeMs,
    }
  }

  /**
   * Get search funnel metrics
   */
  getSearchFunnel(period: "1h" | "24h" | "7d" | "30d"): {
    searches: number
    resultsShown: number
    clicks: number
    conversions: number
    totalRevenue: string
    conversionValue: string
  } {
    const cutoff = Date.now() - PERIOD_MS[period]

    const queries = this.queryRecords.filter(q => q.timestamp >= cutoff)
    const clicks = this.clickRecords.filter(c => c.timestamp >= cutoff)
    const conversions = this.conversionRecords.filter(c => c.timestamp >= cutoff)

    const searches = queries.length
    const resultsShown = queries.filter(q => q.resultsCount > 0).length

    const totalRevenue = conversions.reduce((sum, c) => sum + parseFloat(c.amountSpent || "0"), 0)
    const conversionValue = conversions.length > 0 ? totalRevenue / conversions.length : 0

    return {
      searches,
      resultsShown,
      clicks: clicks.length,
      conversions: conversions.length,
      totalRevenue: totalRevenue.toFixed(4),
      conversionValue: conversionValue.toFixed(4),
    }
  }

  /**
   * Get tool click analytics
   */
  getToolClickAnalytics(toolId: string, period: "1h" | "24h" | "7d" | "30d"): {
    totalClicks: number
    uniqueSearches: number
    avgPosition: number
    conversions: number
    conversionRate: number
  } {
    const cutoff = Date.now() - PERIOD_MS[period]

    const clicks = this.clickRecords.filter(
      c => c.toolId === toolId && c.timestamp >= cutoff
    )
    const conversions = this.conversionRecords.filter(
      c => c.toolId === toolId && c.timestamp >= cutoff
    )

    const uniqueSearches = new Set(clicks.map(c => c.queryId)).size
    const avgPosition = clicks.length > 0
      ? clicks.reduce((sum, c) => sum + c.position, 0) / clicks.length
      : 0

    return {
      totalClicks: clicks.length,
      uniqueSearches,
      avgPosition,
      conversions: conversions.length,
      conversionRate: clicks.length > 0 ? conversions.length / clicks.length : 0,
    }
  }

  /**
   * Get query patterns (common search terms)
   */
  getQueryPatterns(options: {
    period?: "1h" | "24h" | "7d" | "30d"
    minCount?: number
    limit?: number
  } = {}): { term: string; count: number; avgResults: number }[] {
    const { period = "7d", minCount = 3, limit = 50 } = options
    const cutoff = Date.now() - PERIOD_MS[period]

    const queries = this.queryRecords.filter(q => q.timestamp >= cutoff)

    // Extract and count terms
    const termStats = new Map<string, { count: number; totalResults: number }>()

    for (const query of queries) {
      const terms = query.query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
      for (const term of terms) {
        const existing = termStats.get(term) || { count: 0, totalResults: 0 }
        existing.count++
        existing.totalResults += query.resultsCount
        termStats.set(term, existing)
      }
    }

    return Array.from(termStats.entries())
      .filter(([_, stats]) => stats.count >= minCount)
      .map(([term, stats]) => ({
        term,
        count: stats.count,
        avgResults: stats.totalResults / stats.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /**
   * Get search quality indicators
   */
  getSearchQualityIndicators(period: "1h" | "24h" | "7d" | "30d"): {
    meanReciprocalRank: number
    precisionAt5: number
    meanClickPosition: number
    abandonmentRate: number
  } {
    const cutoff = Date.now() - PERIOD_MS[period]

    const queries = this.queryRecords.filter(q => q.timestamp >= cutoff)
    const clicks = this.clickRecords.filter(c => c.timestamp >= cutoff)

    // Group clicks by query
    const clicksByQuery = new Map<string, ClickRecord[]>()
    for (const click of clicks) {
      const existing = clicksByQuery.get(click.queryId) || []
      existing.push(click)
      clicksByQuery.set(click.queryId, existing)
    }

    // Mean Reciprocal Rank (MRR) - average of 1/position of first click
    let mrrSum = 0
    let mrrCount = 0
    for (const [queryId, queryClicks] of clicksByQuery) {
      if (queryClicks.length > 0) {
        const firstClick = queryClicks.sort((a, b) => a.timestamp - b.timestamp)[0]
        if (firstClick) {
          mrrSum += 1 / firstClick.position
          mrrCount++
        }
      }
    }
    const meanReciprocalRank = mrrCount > 0 ? mrrSum / mrrCount : 0

    // Precision@5 - percentage of queries with clicks in top 5
    let clicksInTop5 = 0
    for (const queryClicks of clicksByQuery.values()) {
      if (queryClicks.some(c => c.position <= 5)) {
        clicksInTop5++
      }
    }
    const precisionAt5 = clicksByQuery.size > 0 ? clicksInTop5 / clicksByQuery.size : 0

    // Mean click position
    const meanClickPosition = clicks.length > 0
      ? clicks.reduce((sum, c) => sum + c.position, 0) / clicks.length
      : 0

    // Abandonment rate - searches with results but no clicks
    const searchesWithResults = queries.filter(q => q.resultsCount > 0).length
    const searchesWithClicks = clicksByQuery.size
    const abandonmentRate = searchesWithResults > 0
      ? 1 - (searchesWithClicks / searchesWithResults)
      : 0

    return {
      meanReciprocalRank,
      precisionAt5,
      meanClickPosition,
      abandonmentRate,
    }
  }

  /**
   * Get suggested synonyms based on search patterns
   */
  getSuggestedSynonyms(): { term: string; suggestedSynonyms: string[]; reason: string }[] {
    // Find zero-result queries that are similar to successful queries
    const suggestions: { term: string; suggestedSynonyms: string[]; reason: string }[] = []

    const successfulTerms = new Set<string>()
    for (const query of this.queryRecords) {
      if (query.resultsCount > 0) {
        const terms = query.query.toLowerCase().split(/\s+/)
        terms.forEach(t => successfulTerms.add(t))
      }
    }

    for (const zeroResult of this.zeroResultQueries.values()) {
      if (zeroResult.count < 3) continue

      const terms = zeroResult.query.split(/\s+/)
      const potentialSynonyms: string[] = []

      for (const term of terms) {
        // Simple edit distance check for potential misspellings
        for (const successfulTerm of successfulTerms) {
          if (this.editDistance(term, successfulTerm) <= 2 && term !== successfulTerm) {
            potentialSynonyms.push(successfulTerm)
          }
        }
      }

      if (potentialSynonyms.length > 0) {
        suggestions.push({
          term: zeroResult.query,
          suggestedSynonyms: [...new Set(potentialSynonyms)].slice(0, 5),
          reason: `Searched ${zeroResult.count} times with 0 results`,
        })
      }
    }

    return suggestions.slice(0, 20)
  }

  /**
   * Simple edit distance calculation
   */
  private editDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0]![j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i]![j] = matrix[i - 1]![j - 1]!
        } else {
          matrix[i]![j] = Math.min(
            matrix[i - 1]![j - 1]! + 1,
            matrix[i]![j - 1]! + 1,
            matrix[i - 1]![j]! + 1
          )
        }
      }
    }

    return matrix[b.length]![a.length]!
  }

  // ============================================================================
  // Maintenance
  // ============================================================================

  /**
   * Cleanup old records
   */
  private cleanupIfNeeded(): void {
    // Remove excess records (keep most recent)
    if (this.queryRecords.length > this.maxRecords) {
      this.queryRecords = this.queryRecords.slice(-this.maxRecords)
    }
    if (this.clickRecords.length > this.maxRecords) {
      this.clickRecords = this.clickRecords.slice(-this.maxRecords)
    }
    if (this.conversionRecords.length > this.maxRecords) {
      this.conversionRecords = this.conversionRecords.slice(-this.maxRecords)
    }
  }

  /**
   * Remove records older than retention period
   */
  cleanup(): { queriesRemoved: number; clicksRemoved: number; conversionsRemoved: number } {
    const cutoff = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000

    const queriesBefore = this.queryRecords.length
    const clicksBefore = this.clickRecords.length
    const conversionsBefore = this.conversionRecords.length

    this.queryRecords = this.queryRecords.filter(q => q.timestamp >= cutoff)
    this.clickRecords = this.clickRecords.filter(c => c.timestamp >= cutoff)
    this.conversionRecords = this.conversionRecords.filter(c => c.timestamp >= cutoff)

    // Clean up zero-result queries
    for (const [key, query] of this.zeroResultQueries) {
      if (query.lastSearchedAt < cutoff) {
        this.zeroResultQueries.delete(key)
      }
    }

    const result = {
      queriesRemoved: queriesBefore - this.queryRecords.length,
      clicksRemoved: clicksBefore - this.clickRecords.length,
      conversionsRemoved: conversionsBefore - this.conversionRecords.length,
    }

    if (result.queriesRemoved > 0 || result.clicksRemoved > 0) {
      Logger.info(`Analytics cleanup: removed ${result.queriesRemoved} queries, ${result.clicksRemoved} clicks`)
    }

    return result
  }

  /**
   * Export analytics data
   */
  export(): {
    queryRecords: SearchQueryRecord[]
    clickRecords: ClickRecord[]
    conversionRecords: ConversionRecord[]
    zeroResultQueries: ZeroResultQuery[]
  } {
    return {
      queryRecords: [...this.queryRecords],
      clickRecords: [...this.clickRecords],
      conversionRecords: [...this.conversionRecords],
      zeroResultQueries: Array.from(this.zeroResultQueries.values()),
    }
  }

  /**
   * Import analytics data
   */
  import(data: {
    queryRecords?: SearchQueryRecord[]
    clickRecords?: ClickRecord[]
    conversionRecords?: ConversionRecord[]
    zeroResultQueries?: ZeroResultQuery[]
  }): void {
    if (data.queryRecords) {
      this.queryRecords.push(...data.queryRecords)
    }
    if (data.clickRecords) {
      this.clickRecords.push(...data.clickRecords)
    }
    if (data.conversionRecords) {
      this.conversionRecords.push(...data.conversionRecords)
    }
    if (data.zeroResultQueries) {
      for (const query of data.zeroResultQueries) {
        this.zeroResultQueries.set(query.query, query)
      }
    }
    Logger.info("Analytics data imported")
  }

  /**
   * Get record counts
   */
  getCounts(): {
    queries: number
    clicks: number
    conversions: number
    zeroResultQueries: number
  } {
    return {
      queries: this.queryRecords.length,
      clicks: this.clickRecords.length,
      conversions: this.conversionRecords.length,
      zeroResultQueries: this.zeroResultQueries.size,
    }
  }
}

/**
 * Singleton instance
 */
export const searchAnalytics = new SearchAnalytics()
