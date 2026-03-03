/**
 * Tool Marketplace Discovery MCP Tools
 * @description MCP tools for search, recommendations, trending, and bundles
 * @author nirholas
 * @license Apache-2.0
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import type { Address } from "viem"
import Logger from "@/utils/logger.js"
import { toolRegistry } from "../registry.js"
import type { ToolCategory } from "../types.js"
import { fullTextSearch } from "./search.js"
import { semanticSearch } from "./semantic.js"
import { filterEngine, FilterEngine } from "./filters.js"
import { recommendationEngine } from "./recommendations.js"
import { trendingEngine } from "./trending.js"
import { bundleManager } from "./bundles.js"
import { searchAnalytics } from "./analytics.js"
import { UIFormatter } from "./ui.js"
import type {
  SearchResponse,
  AdvancedFilterOptions,
  UserProfile,
  ToolComparison,
  ToolAlternative,
} from "./types.js"

/**
 * Initialize discovery engines with current tools
 */
async function initializeEngines(): Promise<void> {
  const tools = await toolRegistry.discoverTools({ activeOnly: true, limit: 10000 })
  
  await fullTextSearch.indexTools(tools)
  await semanticSearch.indexTools(tools)
  recommendationEngine.loadTools(tools)
  trendingEngine.loadTools(tools)
  bundleManager.loadTools(tools)
}

/**
 * Perform hybrid search (full-text + semantic)
 */
async function performHybridSearch(
  query: string,
  filters: AdvancedFilterOptions,
  options: { limit: number; offset: number; semantic?: boolean }
): Promise<SearchResponse> {
  const startTime = Date.now()

  // Get all tools
  let tools = await toolRegistry.discoverTools({ activeOnly: true, limit: 10000 })

  // Apply filters
  tools = filterEngine.filter(tools, filters)

  // Index filtered tools for search
  await fullTextSearch.indexTools(tools)

  // Perform full-text search
  const fullTextResults = await fullTextSearch.search({
    query,
    limit: options.limit * 2, // Get more for merging
    offset: 0,
    fuzzy: true,
  })

  // Perform semantic search if enabled
  let semanticResults: typeof fullTextResults = []
  if (options.semantic && semanticSearch.ready) {
    await semanticSearch.indexTools(tools)
    semanticResults = await semanticSearch.search({
      query,
      limit: options.limit * 2,
      offset: 0,
    })
  }

  // Merge and deduplicate results
  const seen = new Set<string>()
  const mergedResults: Array<{ tool: typeof fullTextResults[0]["tool"]; score: number; matchReasons: string[]; highlights?: { field: string; snippet: string }[] }> = []

  // Interleave full-text and semantic results
  const maxLen = Math.max(fullTextResults.length, semanticResults.length)
  for (let i = 0; i < maxLen; i++) {
    const ftResult = fullTextResults[i]
    if (ftResult && !seen.has(ftResult.tool.toolId)) {
      seen.add(ftResult.tool.toolId)
      mergedResults.push({
        tool: ftResult.tool,
        score: ftResult.score * 1.2, // Boost full-text slightly
        matchReasons: ftResult.matchReasons || [],
        highlights: ftResult.highlights,
      })
    }
    const semResult = semanticResults[i]
    if (semResult && !seen.has(semResult.tool.toolId)) {
      seen.add(semResult.tool.toolId)
      mergedResults.push({
        tool: semResult.tool,
        score: semResult.score,
        matchReasons: semResult.matchReasons || [],
        highlights: semResult.highlights,
      })
    }
  }

  // Sort by score
  mergedResults.sort((a, b) => b.score - a.score)

  // Apply pagination
  const paginatedResults = mergedResults.slice(options.offset, options.offset + options.limit)
  const searchTimeMs = Date.now() - startTime

  // Get suggestions
  const suggestions = await fullTextSearch.getSuggestions(query, 3)

  // Get related categories
  const categoryCount = new Map<string, number>()
  for (const result of mergedResults.slice(0, 20)) {
    if (result?.tool) {
      const cat = result.tool.category
      categoryCount.set(cat, (categoryCount.get(cat) || 0) + 1)
    }
  }
  const relatedCategories = Array.from(categoryCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat]) => cat) as ToolCategory[]

  // Track analytics
  const queryId = searchAnalytics.recordQuery({
    query,
    resultsCount: mergedResults.length,
    searchType: options.semantic ? "hybrid" : "fulltext",
    filtersApplied: Object.keys(filters),
    searchTimeMs,
  })

  return {
    query,
    results: paginatedResults,
    totalResults: mergedResults.length,
    page: Math.floor(options.offset / options.limit) + 1,
    pageSize: options.limit,
    suggestions,
    relatedCategories,
    searchTimeMs,
    searchType: options.semantic ? "hybrid" : "fulltext",
  }
}

/**
 * Register discovery tools with MCP server
 */
export function registerDiscoveryTools(server: McpServer): void {
  // ============================================================================
  // Search Tools
  // ============================================================================

  server.tool(
    "marketplace_search",
    "Search the tool marketplace with full-text and optional semantic search. " +
    "Supports fuzzy matching, filters, and pagination.",
    {
      query: z.string().min(1).describe("Search query (natural language or keywords)"),
      semantic: z.boolean().default(false).describe("Enable semantic search for natural language queries"),
      category: z.enum(["data", "ai", "defi", "analytics", "social", "utilities", "notifications", "storage", "compute", "other"]).optional().describe("Filter by category"),
      minRating: z.number().min(0).max(5).optional().describe("Minimum rating filter"),
      maxPrice: z.string().optional().describe("Maximum price per call"),
      chain: z.string().optional().describe("Filter by supported blockchain"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      limit: z.number().default(10).describe("Results per page"),
      offset: z.number().default(0).describe("Pagination offset"),
    },
    async (params) => {
      try {
        // Ensure engines are initialized
        await initializeEngines()

        const filters: AdvancedFilterOptions = {}
        if (params.category) filters.categories = [params.category]
        if (params.minRating) filters.minRating = params.minRating
        if (params.maxPrice) filters.priceRange = { max: params.maxPrice }
        if (params.chain) filters.chains = [params.chain]
        if (params.tags) filters.tags = params.tags

        const response = await performHybridSearch(params.query, filters, {
          limit: params.limit,
          offset: params.offset,
          semantic: params.semantic,
        })

        const formatted = UIFormatter.formatSearchResults(response)

        return {
          content: [{
            type: "text",
            text: formatted + "\n\n```json\n" + JSON.stringify({
              totalResults: response.totalResults,
              page: response.page,
              pageSize: response.pageSize,
              searchTimeMs: response.searchTimeMs,
            }, null, 2) + "\n```",
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Search failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_similar_tools",
    "Find tools similar to a specific tool by ID. Uses content similarity and collaborative filtering.",
    {
      toolId: z.string().describe("The tool ID to find similar tools for"),
      limit: z.number().default(5).describe("Maximum number of similar tools to return"),
    },
    async (params) => {
      try {
        await initializeEngines()

        const tool = await toolRegistry.getTool(params.toolId)
        if (!tool) {
          throw new Error(`Tool not found: ${params.toolId}`)
        }

        // Get content-based recommendations
        const contentBased = recommendationEngine.getContentBasedRecommendations(params.toolId, {
          limit: params.limit,
        })

        // Get collaborative recommendations
        const collaborative = recommendationEngine.getCollaborativeRecommendations(params.toolId, {
          limit: params.limit,
        })

        // Merge and deduplicate
        const seen = new Set<string>()
        const similar = []

        for (const rec of [...contentBased, ...collaborative]) {
          if (!seen.has(rec.tool.toolId) && rec.tool.toolId !== params.toolId) {
            seen.add(rec.tool.toolId)
            similar.push(rec)
          }
          if (similar.length >= params.limit) break
        }

        const formatted = UIFormatter.formatRecommendations(similar, `Tools similar to ${tool.displayName}`)

        return {
          content: [{
            type: "text",
            text: formatted,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to find similar tools",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Recommendation Tools
  // ============================================================================

  server.tool(
    "marketplace_recommendations",
    "Get personalized tool recommendations based on user profile and usage history.",
    {
      userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).describe("User wallet address"),
      limit: z.number().default(10).describe("Maximum recommendations to return"),
    },
    async (params) => {
      try {
        await initializeEngines()

        // Build or get user profile
        const profile = recommendationEngine.buildUserProfileFromUsage(params.userAddress as Address)

        // Get personalized recommendations
        const recommendations = await recommendationEngine.getPersonalizedRecommendations(profile, {
          limit: params.limit,
        })

        if (recommendations.length === 0) {
          // Return new user recommendations
          const newUserRecs = recommendationEngine.getNewUserRecommendations({ limit: params.limit })
          const formatted = UIFormatter.formatRecommendations(newUserRecs, "Recommended for you")
          return {
            content: [{
              type: "text",
              text: formatted + "\n\n*These are popular tools for new users. Use more tools to get personalized recommendations.*",
            }],
          }
        }

        const formatted = UIFormatter.formatRecommendations(recommendations, "Personalized Recommendations")

        return {
          content: [{
            type: "text",
            text: formatted,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get recommendations",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Trending Tools
  // ============================================================================

  server.tool(
    "marketplace_trending",
    "Get trending, hot, new, and featured tools in the marketplace.",
    {
      type: z.enum(["trending", "hot", "new", "rising-stars", "featured", "all"]).default("all").describe("Type of trending list"),
      category: z.string().optional().describe("Filter by category"),
      period: z.enum(["1h", "24h", "7d", "30d"]).default("7d").describe("Time period for trending"),
      limit: z.number().default(10).describe("Maximum items to return"),
    },
    async (params) => {
      try {
        await initializeEngines()

        let output = ""

        switch (params.type) {
          case "trending":
            const trending = trendingEngine.getTrending({
              period: params.period,
              limit: params.limit,
              category: params.category,
            })
            output = UIFormatter.formatTrendingList(trending, params.period)
            break

          case "hot":
            const hot = trendingEngine.getHot({
              limit: params.limit,
              category: params.category,
            })
            output = UIFormatter.formatHotList(hot)
            break

          case "new":
            const newTools = trendingEngine.getNew({ limit: params.limit })
            output = UIFormatter.formatNewList(newTools)
            break

          case "rising-stars":
            const stars = trendingEngine.getRisingStars({ limit: params.limit })
            output = UIFormatter.formatRisingStars(stars)
            break

          case "featured":
            const featured = trendingEngine.getFeatured({
              limit: params.limit,
              category: params.category,
            })
            output = UIFormatter.formatFeaturedList(featured)
            break

          case "all":
          default:
            const feed = trendingEngine.getDiscoveryFeed({
              limit: params.limit,
              category: params.category,
            })
            output = UIFormatter.formatDiscoveryFeed(feed)
            break
        }

        return {
          content: [{
            type: "text",
            text: output,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to get trending",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Bundle Tools
  // ============================================================================

  server.tool(
    "marketplace_bundles",
    "Browse and manage tool bundles (pre-packaged tool combinations with discounts).",
    {
      action: z.enum(["list", "get", "suggest"]).default("list").describe("Action to perform"),
      bundleId: z.string().optional().describe("Bundle ID (for get action)"),
      userAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional().describe("User address (for suggest action)"),
      category: z.string().optional().describe("Filter by category"),
      curatedOnly: z.boolean().default(false).describe("Only show platform-curated bundles"),
      limit: z.number().default(10).describe("Maximum bundles to return"),
    },
    async (params) => {
      try {
        await initializeEngines()

        switch (params.action) {
          case "get":
            if (!params.bundleId) {
              throw new Error("bundleId is required for get action")
            }
            const bundle = bundleManager.getBundle(params.bundleId)
            if (!bundle) {
              throw new Error(`Bundle not found: ${params.bundleId}`)
            }
            return {
              content: [{
                type: "text",
                text: UIFormatter.formatBundleCard(bundle),
              }],
            }

          case "suggest":
            if (!params.userAddress) {
              throw new Error("userAddress is required for suggest action")
            }
            const profile = recommendationEngine.getUserProfile(params.userAddress as Address)
            const usedTools = profile?.usedTools || []
            const suggested = bundleManager.suggestBundleForUser(usedTools)
            if (!suggested) {
              return {
                content: [{
                  type: "text",
                  text: "No bundle suggestions available based on your usage history.",
                }],
              }
            }
            return {
              content: [{
                type: "text",
                text: "## Suggested Bundle for You\n\n" + UIFormatter.formatBundleCard(suggested),
              }],
            }

          case "list":
          default:
            const bundles = bundleManager.listBundles({
              category: params.category,
              curatedOnly: params.curatedOnly,
              limit: params.limit,
            })
            return {
              content: [{
                type: "text",
                text: UIFormatter.formatBundlesList(bundles),
              }],
            }
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Bundle operation failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Comparison Tools
  // ============================================================================

  server.tool(
    "marketplace_compare_tools",
    "Compare multiple tools side-by-side with key metrics.",
    {
      toolIds: z.array(z.string()).min(2).max(5).describe("Tool IDs to compare (2-5 tools)"),
    },
    async (params) => {
      try {
        await initializeEngines()

        const tools = []
        for (const toolId of params.toolIds) {
          const tool = await toolRegistry.getTool(toolId)
          if (!tool) {
            throw new Error(`Tool not found: ${toolId}`)
          }
          tools.push(tool)
        }

        // Determine winners by metric
        const winners: Record<string, string> = {}

        // Best price (lowest)
        const lowestPrice = tools.reduce((best, t) =>
          parseFloat(t.pricing.basePrice || "0") < parseFloat(best.pricing.basePrice || "0") ? t : best
        )
        winners["Best Price"] = lowestPrice.toolId

        // Best rating
        const highestRating = tools.reduce((best, t) =>
          t.metadata.rating > best.metadata.rating ? t : best
        )
        winners["Best Rating"] = highestRating.toolId

        // Most popular
        const mostPopular = tools.reduce((best, t) =>
          t.metadata.totalCalls > best.metadata.totalCalls ? t : best
        )
        winners["Most Popular"] = mostPopular.toolId

        // Best uptime
        const bestUptime = tools.reduce((best, t) =>
          t.metadata.uptime > best.metadata.uptime ? t : best
        )
        winners["Best Uptime"] = bestUptime.toolId

        // Fastest response
        const fastest = tools.reduce((best, t) =>
          t.metadata.avgResponseTime < best.metadata.avgResponseTime ? t : best
        )
        winners["Fastest Response"] = fastest.toolId

        const comparison: ToolComparison = {
          tools,
          metrics: [],
          winners,
          recommendation: {
            toolId: highestRating.toolId,
            reason: "Best overall rating and reliability",
          },
        }

        const formatted = UIFormatter.formatComparison(comparison)

        return {
          content: [{
            type: "text",
            text: "## Tool Comparison\n\n" + formatted,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Comparison failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  server.tool(
    "marketplace_tool_alternatives",
    "Find cheaper or better-rated alternatives to a specific tool.",
    {
      toolId: z.string().describe("The tool ID to find alternatives for"),
      type: z.enum(["cheaper", "better-rated", "similar", "all"]).default("all").describe("Type of alternatives"),
      limit: z.number().default(5).describe("Maximum alternatives to return"),
    },
    async (params) => {
      try {
        await initializeEngines()

        const tool = await toolRegistry.getTool(params.toolId)
        if (!tool) {
          throw new Error(`Tool not found: ${params.toolId}`)
        }

        // Get similar tools
        const similar = recommendationEngine.getContentBasedRecommendations(params.toolId, {
          limit: 20,
        })

        const alternatives: ToolAlternative[] = []
        const toolPrice = parseFloat(tool.pricing.basePrice || "0")
        const toolRating = tool.metadata.rating

        for (const rec of similar) {
          const altPrice = parseFloat(rec.tool.pricing.basePrice || "0")
          const altRating = rec.tool.metadata.rating

          const priceDiff = altPrice - toolPrice
          const priceDiffPercent = toolPrice > 0 ? (priceDiff / toolPrice) * 100 : 0
          const ratingDiff = altRating - toolRating

          let type: "cheaper" | "better-rated" | "similar" | "more-features" = "similar"
          const reasons: string[] = []

          if (altPrice < toolPrice * 0.8) {
            type = "cheaper"
            reasons.push(`${Math.abs(priceDiffPercent).toFixed(0)}% cheaper`)
          } else if (altRating > toolRating + 0.3) {
            type = "better-rated"
            reasons.push(`Higher rated (${altRating.toFixed(1)} vs ${toolRating.toFixed(1)})`)
          } else {
            reasons.push("Similar functionality")
          }

          if (rec.tool.category === tool.category) {
            reasons.push("Same category")
          }

          // Filter by requested type
          if (params.type !== "all" && type !== params.type) continue

          alternatives.push({
            tool: rec.tool,
            comparison: {
              priceDifference: priceDiff.toFixed(4),
              priceDifferencePercent: priceDiffPercent,
              ratingDifference: ratingDiff,
              featureOverlap: rec.score,
            },
            reasons,
            type,
          })

          if (alternatives.length >= params.limit) break
        }

        const formatted = UIFormatter.formatAlternatives(alternatives, tool)

        return {
          content: [{
            type: "text",
            text: formatted,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Failed to find alternatives",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  // ============================================================================
  // Analytics Tools
  // ============================================================================

  server.tool(
    "marketplace_search_analytics",
    "Get search analytics and insights for the marketplace (admin).",
    {
      period: z.enum(["1h", "24h", "7d", "30d"]).default("7d").describe("Analytics period"),
      type: z.enum(["summary", "funnel", "quality", "queries"]).default("summary").describe("Analytics type"),
    },
    async (params) => {
      try {
        let result: any

        switch (params.type) {
          case "summary":
            result = searchAnalytics.getSummary(params.period)
            break
          case "funnel":
            result = searchAnalytics.getSearchFunnel(params.period)
            break
          case "quality":
            result = searchAnalytics.getSearchQualityIndicators(params.period)
            break
          case "queries":
            result = searchAnalytics.getQueryPatterns({ period: params.period })
            break
        }

        return {
          content: [{
            type: "text",
            text: `## Search Analytics (${params.period})\n\n\`\`\`json\n${JSON.stringify(result, null, 2)}\n\`\`\``,
          }],
        }
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: false,
              error: error instanceof Error ? error.message : "Analytics failed",
            }, null, 2),
          }],
          isError: true,
        }
      }
    }
  )

  Logger.info("Registered marketplace discovery tools")
}
