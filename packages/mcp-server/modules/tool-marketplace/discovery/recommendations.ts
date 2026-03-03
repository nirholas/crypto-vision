/**
 * Recommendation Engine
 * @description Collaborative filtering, content-based, and personalized recommendations
 * @author nirholas
 * @license Apache-2.0
 */

import Logger from "@/utils/logger.js"
import type { Address } from "viem"
import type { RegisteredTool, ToolCategory, ToolUsageRecord } from "../types.js"
import type {
  UserProfile,
  RecommendedTool,
  CoUsagePattern,
  ContentSimilarity,
} from "./types.js"
import { semanticSearch } from "./semantic.js"

/**
 * Price tier classification
 */
type PriceTier = "free" | "low" | "medium" | "high" | "premium"

/**
 * Get price tier from price string
 */
function getPriceTier(price: string): PriceTier {
  const priceNum = parseFloat(price || "0")

  if (priceNum === 0) return "free"
  if (priceNum <= 0.001) return "low"
  if (priceNum <= 0.01) return "medium"
  if (priceNum <= 0.1) return "high"
  return "premium"
}

/**
 * Calculate Jaccard similarity for tag overlap
 */
function jaccardSimilarity(a: string[], b: string[]): number {
  const setA = new Set(a.map(t => t.toLowerCase()))
  const setB = new Set(b.map(t => t.toLowerCase()))

  const intersection = new Set([...setA].filter(x => setB.has(x)))
  const union = new Set([...setA, ...setB])

  return union.size === 0 ? 0 : intersection.size / union.size
}

/**
 * Decay function for recency weighting
 */
function recencyWeight(timestamp: number, halfLifeDays: number = 7): number {
  const ageMs = Date.now() - timestamp
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  return Math.pow(0.5, ageDays / halfLifeDays)
}

/**
 * Recommendation Engine
 */
export class RecommendationEngine {
  private tools: Map<string, RegisteredTool> = new Map()
  private usageRecords: Map<string, ToolUsageRecord[]> = new Map()
  private coUsageCache: Map<string, CoUsagePattern[]> = new Map()
  private contentSimilarityCache: Map<string, ContentSimilarity[]> = new Map()
  private userProfiles: Map<string, UserProfile> = new Map()

  /**
   * Load tools for recommendations
   */
  loadTools(tools: RegisteredTool[]): void {
    this.tools.clear()
    for (const tool of tools) {
      this.tools.set(tool.toolId, tool)
    }
    // Invalidate caches
    this.contentSimilarityCache.clear()
    Logger.info(`Loaded ${tools.length} tools for recommendations`)
  }

  /**
   * Load usage records for collaborative filtering
   */
  loadUsageRecords(records: ToolUsageRecord[]): void {
    this.usageRecords.clear()

    // Group by user
    for (const record of records) {
      const userKey = record.userAddress.toLowerCase()
      if (!this.usageRecords.has(userKey)) {
        this.usageRecords.set(userKey, [])
      }
      this.usageRecords.get(userKey)!.push(record)
    }

    // Invalidate co-usage cache
    this.coUsageCache.clear()
    Logger.info(`Loaded ${records.length} usage records for ${this.usageRecords.size} users`)
  }

  /**
   * Update or create user profile
   */
  updateUserProfile(address: Address, updates: Partial<UserProfile>): UserProfile {
    const existing = this.userProfiles.get(address.toLowerCase()) || {
      address,
      usedTools: [],
      categories: {},
      avgSpendPerCall: "0",
      preferredChains: [],
    }

    const profile: UserProfile = {
      ...existing,
      ...updates,
      address,
      lastActiveAt: Date.now(),
    }

    this.userProfiles.set(address.toLowerCase(), profile)
    return profile
  }

  /**
   * Build user profile from usage records
   */
  buildUserProfileFromUsage(address: Address): UserProfile {
    const records = this.usageRecords.get(address.toLowerCase()) || []
    
    const usedTools = [...new Set(records.map(r => r.toolId))]
    const categories: Record<string, number> = {}
    let totalSpend = 0
    const chains = new Set<string>()

    for (const toolId of usedTools) {
      const tool = this.tools.get(toolId)
      if (tool) {
        categories[tool.category] = (categories[tool.category] || 0) + 1
        tool.pricing.supportedChains.forEach(c => chains.add(c))
      }
    }

    for (const record of records) {
      totalSpend += parseFloat(record.amountPaid || "0")
    }

    const avgSpend = records.length > 0 ? (totalSpend / records.length).toFixed(6) : "0"

    return this.updateUserProfile(address, {
      usedTools,
      categories,
      avgSpendPerCall: avgSpend,
      preferredChains: Array.from(chains),
    })
  }

  // ============================================================================
  // Collaborative Filtering
  // ============================================================================

  /**
   * Build co-usage patterns from usage records
   */
  private buildCoUsagePatterns(): void {
    this.coUsageCache.clear()

    // Get tools used by each user
    const userTools = new Map<string, Set<string>>()

    for (const [userKey, records] of this.usageRecords) {
      const toolSet = new Set(records.map(r => r.toolId))
      userTools.set(userKey, toolSet)
    }

    // Count co-usage for each tool pair
    const coUsageCounts = new Map<string, Map<string, { count: number; timestamps: number[] }>>()

    for (const [userKey, tools] of userTools) {
      const toolArray = Array.from(tools)
      const records = this.usageRecords.get(userKey) || []
      
      // Create map of tool -> most recent usage
      const toolTimestamps = new Map<string, number>()
      for (const record of records) {
        const existing = toolTimestamps.get(record.toolId) || 0
        toolTimestamps.set(record.toolId, Math.max(existing, record.timestamp))
      }

      for (let i = 0; i < toolArray.length; i++) {
        for (let j = i + 1; j < toolArray.length; j++) {
          const toolA = toolArray[i]
          const toolB = toolArray[j]
          if (!toolA || !toolB) continue
          
          const pairKey = [toolA, toolB].sort().join("|")

          if (!coUsageCounts.has(toolA)) {
            coUsageCounts.set(toolA, new Map())
          }
          if (!coUsageCounts.has(toolB)) {
            coUsageCounts.set(toolB, new Map())
          }

          // Update A -> B
          const existingAB = coUsageCounts.get(toolA)!.get(toolB) || { count: 0, timestamps: [] }
          existingAB.count++
          existingAB.timestamps.push(Math.max(
            toolTimestamps.get(toolA) || 0,
            toolTimestamps.get(toolB) || 0
          ))
          coUsageCounts.get(toolA)!.set(toolB, existingAB)

          // Update B -> A
          const existingBA = coUsageCounts.get(toolB)!.get(toolA) || { count: 0, timestamps: [] }
          existingBA.count++
          existingBA.timestamps.push(Math.max(
            toolTimestamps.get(toolA) || 0,
            toolTimestamps.get(toolB) || 0
          ))
          coUsageCounts.get(toolB)!.set(toolA, existingBA)
        }
      }
    }

    // Convert to CoUsagePattern format
    for (const [toolIdA, coUsers] of coUsageCounts) {
      const patterns: CoUsagePattern[] = []

      for (const [toolIdB, data] of coUsers) {
        // Calculate recency score
        const recentTimestamps = data.timestamps.slice(-10)
        const recencyScore = recentTimestamps.reduce((sum, ts) => sum + recencyWeight(ts), 0) / recentTimestamps.length

        // Calculate confidence (based on total users and co-usage count)
        const totalUsersA = this.getToolUserCount(toolIdA)
        const confidence = totalUsersA > 0 ? data.count / totalUsersA : 0

        patterns.push({
          toolIdA,
          toolIdB,
          coUsageCount: data.count,
          recencyScore,
          confidence: Math.min(1, confidence),
        })
      }

      // Sort by weighted score
      patterns.sort((a, b) => {
        const scoreA = a.coUsageCount * a.recencyScore * a.confidence
        const scoreB = b.coUsageCount * b.recencyScore * b.confidence
        return scoreB - scoreA
      })

      this.coUsageCache.set(toolIdA, patterns)
    }
  }

  /**
   * Get number of unique users for a tool
   */
  private getToolUserCount(toolId: string): number {
    let count = 0
    for (const records of this.usageRecords.values()) {
      if (records.some(r => r.toolId === toolId)) {
        count++
      }
    }
    return count
  }

  /**
   * Get collaborative filtering recommendations for a tool
   * "Users who used X also used Y"
   */
  getCollaborativeRecommendations(
    toolId: string,
    options: { limit?: number; minCoUsage?: number } = {}
  ): RecommendedTool[] {
    const { limit = 10, minCoUsage = 2 } = options

    // Rebuild cache if empty
    if (this.coUsageCache.size === 0) {
      this.buildCoUsagePatterns()
    }

    const patterns = this.coUsageCache.get(toolId) || []
    const recommendations: RecommendedTool[] = []

    for (const pattern of patterns) {
      if (pattern.coUsageCount < minCoUsage) continue

      const tool = this.tools.get(pattern.toolIdB)
      if (!tool || tool.status !== "active") continue

      const score = (pattern.coUsageCount * pattern.recencyScore * pattern.confidence)
      const normalizedScore = Math.min(1, score / 10) // Normalize to 0-1

      recommendations.push({
        tool,
        score: normalizedScore,
        reasons: [
          `${pattern.coUsageCount} users also use this tool`,
          `Confidence: ${(pattern.confidence * 100).toFixed(0)}%`,
          "collaborative filtering",
        ],
        type: "collaborative",
      })

      if (recommendations.length >= limit) break
    }

    return recommendations
  }

  // ============================================================================
  // Content-Based Filtering
  // ============================================================================

  /**
   * Calculate content similarity between two tools
   */
  private calculateContentSimilarity(toolA: RegisteredTool, toolB: RegisteredTool): ContentSimilarity {
    // Tag overlap
    const tagsA = toolA.tags || []
    const tagsB = toolB.tags || []
    const tagOverlap = jaccardSimilarity(tagsA, tagsB)

    // Category match
    const sameCategory = toolA.category === toolB.category

    // Price tier match
    const priceA = getPriceTier(toolA.pricing.basePrice || "0")
    const priceB = getPriceTier(toolB.pricing.basePrice || "0")
    const samePriceTier = priceA === priceB

    // Description similarity (simple word overlap)
    const wordsA = toolA.description.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const wordsB = toolB.description.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    const descriptionSimilarity = jaccardSimilarity(wordsA, wordsB)

    // Overall similarity
    const overallSimilarity =
      tagOverlap * 0.3 +
      (sameCategory ? 0.3 : 0) +
      (samePriceTier ? 0.1 : 0) +
      descriptionSimilarity * 0.3

    return {
      toolIdA: toolA.toolId,
      toolIdB: toolB.toolId,
      descriptionSimilarity,
      tagOverlap,
      sameCategory,
      samePriceTier,
      overallSimilarity,
    }
  }

  /**
   * Build content similarity cache for a tool
   */
  private buildContentSimilarity(toolId: string): ContentSimilarity[] {
    const tool = this.tools.get(toolId)
    if (!tool) return []

    const similarities: ContentSimilarity[] = []

    for (const [otherId, otherTool] of this.tools) {
      if (otherId === toolId) continue
      if (otherTool.status !== "active") continue

      const similarity = this.calculateContentSimilarity(tool, otherTool)
      similarities.push(similarity)
    }

    // Sort by overall similarity
    similarities.sort((a, b) => b.overallSimilarity - a.overallSimilarity)

    this.contentSimilarityCache.set(toolId, similarities)
    return similarities
  }

  /**
   * Get content-based recommendations for a tool
   */
  getContentBasedRecommendations(
    toolId: string,
    options: { limit?: number; minSimilarity?: number } = {}
  ): RecommendedTool[] {
    const { limit = 10, minSimilarity = 0.2 } = options

    // Get or build similarity data
    let similarities = this.contentSimilarityCache.get(toolId)
    if (!similarities) {
      similarities = this.buildContentSimilarity(toolId)
    }

    const recommendations: RecommendedTool[] = []

    for (const sim of similarities) {
      if (sim.overallSimilarity < minSimilarity) continue

      const tool = this.tools.get(sim.toolIdB)
      if (!tool) continue

      const reasons: string[] = []
      if (sim.sameCategory) reasons.push(`Same category: ${tool.category}`)
      if (sim.tagOverlap > 0.3) reasons.push(`Similar tags`)
      if (sim.descriptionSimilarity > 0.2) reasons.push(`Similar functionality`)
      if (sim.samePriceTier) reasons.push(`Similar price tier`)
      reasons.push("content-based filtering")

      recommendations.push({
        tool,
        score: sim.overallSimilarity,
        reasons,
        type: "content-based",
      })

      if (recommendations.length >= limit) break
    }

    return recommendations
  }

  /**
   * Get same-category recommendations
   */
  getSameCategoryRecommendations(
    category: ToolCategory,
    options: { limit?: number; excludeToolIds?: string[] } = {}
  ): RecommendedTool[] {
    const { limit = 10, excludeToolIds = [] } = options
    const excludeSet = new Set(excludeToolIds)

    const tools = Array.from(this.tools.values())
      .filter(t => t.category === category && t.status === "active" && !excludeSet.has(t.toolId))
      .sort((a, b) => {
        // Sort by rating * log(calls + 1)
        const scoreA = a.metadata.rating * Math.log(a.metadata.totalCalls + 1)
        const scoreB = b.metadata.rating * Math.log(b.metadata.totalCalls + 1)
        return scoreB - scoreA
      })
      .slice(0, limit)

    return tools.map((tool, index) => ({
      tool,
      score: 1 - index / limit,
      reasons: [`Top tool in ${category} category`, "category-based"],
      type: "content-based" as const,
    }))
  }

  // ============================================================================
  // Personalized Recommendations
  // ============================================================================

  /**
   * Get personalized recommendations for a user
   */
  async getPersonalizedRecommendations(
    userProfile: UserProfile,
    options: { limit?: number } = {}
  ): Promise<RecommendedTool[]> {
    const { limit = 20 } = options
    const recommendations: RecommendedTool[] = []
    const usedToolSet = new Set(userProfile.usedTools)

    // 1. Get collaborative recommendations from used tools
    const collaborativeRecs: RecommendedTool[] = []
    for (const toolId of userProfile.usedTools.slice(-5)) {
      const recs = this.getCollaborativeRecommendations(toolId, { limit: 5 })
      collaborativeRecs.push(...recs)
    }

    // 2. Get category-based recommendations from preferences
    const categoryRecs: RecommendedTool[] = []
    const sortedCategories = Object.entries(userProfile.categories)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    for (const [category] of sortedCategories) {
      const recs = this.getSameCategoryRecommendations(category as ToolCategory, {
        limit: 5,
        excludeToolIds: userProfile.usedTools,
      })
      categoryRecs.push(...recs)
    }

    // 3. Get price-tier appropriate recommendations
    const avgSpend = parseFloat(userProfile.avgSpendPerCall || "0")
    const userPriceTier = getPriceTier(userProfile.avgSpendPerCall)

    // 4. Chain-filtered recommendations
    const chainFilteredTools = Array.from(this.tools.values()).filter(tool =>
      tool.status === "active" &&
      !usedToolSet.has(tool.toolId) &&
      tool.pricing.supportedChains.some(c => userProfile.preferredChains.includes(c))
    )

    // Combine and deduplicate
    const seen = new Set<string>()
    const allRecs = [...collaborativeRecs, ...categoryRecs]

    // Add chain-filtered tools as additional recs
    for (const tool of chainFilteredTools.slice(0, 10)) {
      allRecs.push({
        tool,
        score: 0.5,
        reasons: [`Supports your preferred chains`, "chain-matching"],
        type: "personalized",
      })
    }

    // Deduplicate and filter
    for (const rec of allRecs) {
      if (seen.has(rec.tool.toolId)) continue
      if (usedToolSet.has(rec.tool.toolId)) continue

      seen.add(rec.tool.toolId)

      // Adjust score based on price sensitivity
      let adjustedScore = rec.score
      const toolPriceTier = getPriceTier(rec.tool.pricing.basePrice || "0")

      if (userProfile.priceSensitivity && userProfile.priceSensitivity > 0.7) {
        // Price-sensitive user: boost cheaper tools
        if (toolPriceTier === "free") adjustedScore *= 1.5
        else if (toolPriceTier === "low") adjustedScore *= 1.2
        else if (toolPriceTier === "premium") adjustedScore *= 0.5
      }

      // Boost if same price tier
      if (toolPriceTier === userPriceTier) {
        adjustedScore *= 1.1
      }

      recommendations.push({
        ...rec,
        score: Math.min(1, adjustedScore),
        type: "personalized",
      })
    }

    // Sort by adjusted score
    recommendations.sort((a, b) => b.score - a.score)

    return recommendations.slice(0, limit)
  }

  /**
   * Get "because you used X" recommendations
   */
  getBecauseYouUsedRecommendations(
    toolId: string,
    options: { limit?: number } = {}
  ): RecommendedTool[] {
    const { limit = 5 } = options
    const tool = this.tools.get(toolId)
    if (!tool) return []

    // Combine collaborative and content-based
    const collaborative = this.getCollaborativeRecommendations(toolId, { limit: limit * 2 })
    const contentBased = this.getContentBasedRecommendations(toolId, { limit: limit * 2 })

    // Merge with deduplication
    const seen = new Set<string>()
    const merged: RecommendedTool[] = []

    // Interleave results
    const maxLen = Math.max(collaborative.length, contentBased.length)
    for (let i = 0; i < maxLen && merged.length < limit; i++) {
      const collabItem = collaborative[i]
      if (collabItem && !seen.has(collabItem.tool.toolId)) {
        seen.add(collabItem.tool.toolId)
        merged.push({
          ...collabItem,
          reasons: [`Because you used ${tool.displayName}`, ...collabItem.reasons],
        })
      }
      const contentItem = contentBased[i]
      if (contentItem && !seen.has(contentItem.tool.toolId) && merged.length < limit) {
        seen.add(contentItem.tool.toolId)
        merged.push({
          ...contentItem,
          reasons: [`Similar to ${tool.displayName}`, ...contentItem.reasons],
        })
      }
    }

    return merged.slice(0, limit)
  }

  /**
   * Get discovery recommendations for new users
   */
  getNewUserRecommendations(options: { limit?: number } = {}): RecommendedTool[] {
    const { limit = 10 } = options

    // Get popular and highly-rated tools across categories
    const tools = Array.from(this.tools.values())
      .filter(t => t.status === "active")
      .map(tool => ({
        tool,
        // Score: rating * log(totalCalls + 1) * (uptime / 100)
        score: tool.metadata.rating * Math.log(tool.metadata.totalCalls + 1) * (tool.metadata.uptime / 100),
      }))
      .sort((a, b) => b.score - a.score)

    // Ensure category diversity
    const categoryCount = new Map<string, number>()
    const diverse: { tool: RegisteredTool; score: number }[] = []

    for (const item of tools) {
      const cat = item.tool.category
      const count = categoryCount.get(cat) || 0
      
      if (count < 2) {
        diverse.push(item)
        categoryCount.set(cat, count + 1)
      }

      if (diverse.length >= limit) break
    }

    return diverse.map((item, index) => ({
      tool: item.tool,
      score: Math.min(1, item.score / (diverse[0]?.score || 1)),
      reasons: [
        `Popular in ${item.tool.category}`,
        `${item.tool.metadata.rating.toFixed(1)} rating`,
        "recommended for new users",
      ],
      type: "personalized" as const,
    }))
  }

  /**
   * Get user profile
   */
  getUserProfile(address: Address): UserProfile | undefined {
    return this.userProfiles.get(address.toLowerCase())
  }

  /**
   * Refresh all caches
   */
  refreshCaches(): void {
    this.coUsageCache.clear()
    this.contentSimilarityCache.clear()
    this.buildCoUsagePatterns()
    Logger.info("Recommendation caches refreshed")
  }
}

/**
 * Singleton instance
 */
export const recommendationEngine = new RecommendationEngine()
