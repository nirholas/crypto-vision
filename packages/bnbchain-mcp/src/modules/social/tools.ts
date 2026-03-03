/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import Logger from "@/utils/logger.js"

// API Configuration
const LUNARCRUSH_API_BASE = "https://lunarcrush.com/api4/public"
const LUNARCRUSH_API_KEY = process.env.LUNARCRUSH_API_KEY || ""
const CRYPTOCOMPARE_API_BASE = "https://min-api.cryptocompare.com/data"
const CRYPTOCOMPARE_API_KEY = process.env.CRYPTOCOMPARE_API_KEY || ""

/**
 * LunarCrush API request helper
 */
async function lunarCrushRequest<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T | null> {
  try {
    const queryParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value))
      }
    }
    
    // Add API key if available
    if (LUNARCRUSH_API_KEY) {
      queryParams.set("key", LUNARCRUSH_API_KEY)
    }
    
    const queryString = queryParams.toString()
    const url = `${LUNARCRUSH_API_BASE}${endpoint}${queryString ? `?${queryString}` : ""}`

    const response = await fetch(url)
    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("LunarCrush API key required. Set LUNARCRUSH_API_KEY environment variable.")
      }
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    Logger.error("LunarCrush API error:", error)
    return null
  }
}

/**
 * CryptoCompare API request helper (free alternative)
 */
async function cryptoCompareRequest<T>(endpoint: string, params: Record<string, unknown> = {}): Promise<T | null> {
  try {
    const queryParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        queryParams.set(key, String(value))
      }
    }
    
    if (CRYPTOCOMPARE_API_KEY) {
      queryParams.set("api_key", CRYPTOCOMPARE_API_KEY)
    }
    
    const queryString = queryParams.toString()
    const url = `${CRYPTOCOMPARE_API_BASE}${endpoint}${queryString ? `?${queryString}` : ""}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    return (await response.json()) as T
  } catch (error) {
    Logger.error("CryptoCompare API error:", error)
    return null
  }
}

export function registerSocialTools(server: McpServer) {
  // ==================== COIN SOCIAL METRICS ====================

  server.tool(
    "social_get_coin_metrics",
    "Get comprehensive social metrics for a cryptocurrency including Galaxy Score, AltRank, social volume, sentiment, and engagement.",
    {
      symbol: z.string().describe("Coin symbol (e.g., 'BTC', 'ETH')")
    },
    async ({ symbol }) => {
      // Try LunarCrush first
      const data = await lunarCrushRequest(`/coins/${symbol.toLowerCase()}`)
      if (data) {
        return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
      }
      
      // Fallback to CryptoCompare social stats
      const fallbackData = await cryptoCompareRequest("/social/coin/latest", { coinId: symbol.toUpperCase() })
      if (!fallbackData) {
        return { content: [{ type: "text" as const, text: `Failed to fetch social metrics for: ${symbol}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(fallbackData, null, 2) }] }
    }
  )

  server.tool(
    "social_get_coins_list",
    "Get social metrics for multiple cryptocurrencies. Includes Galaxy Score, AltRank, social volume for top coins.",
    {
      sort: z.enum(["galaxy_score", "alt_rank", "social_volume", "market_cap"]).optional().default("galaxy_score").describe("Sort by metric"),
      limit: z.number().optional().default(50).describe("Number of coins to return"),
      desc: z.boolean().optional().default(true).describe("Sort descending")
    },
    async ({ sort, limit, desc }) => {
      const data = await lunarCrushRequest("/coins/list", { sort, limit, desc })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch coins list" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "social_get_coin_time_series",
    "Get historical social metrics for a coin over time.",
    {
      symbol: z.string().describe("Coin symbol"),
      interval: z.enum(["hour", "day", "week"]).optional().default("day").describe("Data interval"),
      start: z.number().optional().describe("Start timestamp (Unix)"),
      end: z.number().optional().describe("End timestamp (Unix)")
    },
    async ({ symbol, interval, start, end }) => {
      const params: Record<string, unknown> = { interval }
      if (start) params.start = start
      if (end) params.end = end
      
      const data = await lunarCrushRequest(`/coins/${symbol.toLowerCase()}/time-series`, params)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch time series for: ${symbol}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== SOCIAL FEED ====================

  server.tool(
    "social_get_feed",
    "Get recent social posts about cryptocurrencies from Twitter, Reddit, and other platforms.",
    {
      symbol: z.string().optional().describe("Filter by coin symbol"),
      source: z.enum(["twitter", "reddit", "news", "all"]).optional().default("all").describe("Social platform"),
      limit: z.number().optional().default(50).describe("Number of posts")
    },
    async ({ symbol, source, limit }) => {
      const params: Record<string, unknown> = { limit }
      if (symbol) params.symbol = symbol.toLowerCase()
      if (source !== "all") params.source = source
      
      const data = await lunarCrushRequest("/feeds", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch social feed" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "social_get_trending_posts",
    "Get trending/viral social posts in the crypto space.",
    {
      type: z.enum(["rising", "hot", "top"]).optional().default("hot").describe("Trending type"),
      limit: z.number().optional().default(25).describe("Number of posts")
    },
    async ({ type, limit }) => {
      const data = await lunarCrushRequest("/feeds/trending", { type, limit })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch trending posts" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== INFLUENCERS ====================

  server.tool(
    "social_get_influencers",
    "Get top crypto influencers ranked by engagement and followers.",
    {
      symbol: z.string().optional().describe("Filter by coin they discuss"),
      sort: z.enum(["followers", "engagement", "influence_score"]).optional().default("influence_score").describe("Sort metric"),
      limit: z.number().optional().default(50).describe("Number of influencers")
    },
    async ({ symbol, sort, limit }) => {
      const params: Record<string, unknown> = { sort, limit }
      if (symbol) params.symbol = symbol.toLowerCase()
      
      const data = await lunarCrushRequest("/influencers", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch influencers" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "social_get_influencer",
    "Get detailed information about a specific influencer.",
    {
      handle: z.string().describe("Twitter/X handle of the influencer")
    },
    async ({ handle }) => {
      const data = await lunarCrushRequest(`/influencers/${handle}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch influencer: ${handle}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "social_get_influencer_posts",
    "Get recent posts from a specific influencer.",
    {
      handle: z.string().describe("Twitter/X handle"),
      limit: z.number().optional().default(25).describe("Number of posts")
    },
    async ({ handle, limit }) => {
      const data = await lunarCrushRequest(`/influencers/${handle}/posts`, { limit })
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch posts for: ${handle}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== TOPICS & CATEGORIES ====================

  server.tool(
    "social_get_topics",
    "Get trending topics/narratives in crypto social media.",
    {
      category: z.string().optional().describe("Filter by category (e.g., 'defi', 'nft', 'layer1')"),
      limit: z.number().optional().default(25).describe("Number of topics")
    },
    async ({ category, limit }) => {
      const params: Record<string, unknown> = { limit }
      if (category) params.category = category
      
      const data = await lunarCrushRequest("/topics", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch topics" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "social_get_topic",
    "Get detailed social metrics for a specific topic/narrative.",
    {
      topic: z.string().describe("Topic name (e.g., 'defi', 'memecoin', 'eth-etf')")
    },
    async ({ topic }) => {
      const data = await lunarCrushRequest(`/topics/${topic}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch topic: ${topic}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "social_get_categories",
    "Get list of coin categories with aggregate social metrics.",
    {},
    async () => {
      const data = await lunarCrushRequest("/categories")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch categories" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== NFT SOCIAL ====================

  server.tool(
    "social_get_nft_collections",
    "Get social metrics for NFT collections.",
    {
      sort: z.enum(["social_volume", "market_cap", "floor_price"]).optional().default("social_volume").describe("Sort metric"),
      limit: z.number().optional().default(50).describe("Number of collections")
    },
    async ({ sort, limit }) => {
      const data = await lunarCrushRequest("/nfts", { sort, limit })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch NFT collections" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "social_get_nft_collection",
    "Get detailed social metrics for a specific NFT collection.",
    {
      slug: z.string().describe("Collection slug/identifier")
    },
    async ({ slug }) => {
      const data = await lunarCrushRequest(`/nfts/${slug}`)
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch NFT collection: ${slug}` }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== MARKET SENTIMENT ====================

  server.tool(
    "social_get_market_sentiment",
    "Get overall crypto market sentiment aggregated from social data.",
    {},
    async () => {
      const data = await lunarCrushRequest("/market")
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch market sentiment" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  server.tool(
    "social_get_market_sentiment_history",
    "Get historical market sentiment data.",
    {
      interval: z.enum(["hour", "day"]).optional().default("day").describe("Data interval"),
      days: z.number().optional().default(30).describe("Number of days of history")
    },
    async ({ interval, days }) => {
      const data = await lunarCrushRequest("/market/time-series", { interval, days })
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch sentiment history" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )

  // ==================== CRYPTOCOMPARE FALLBACKS ====================

  server.tool(
    "social_get_reddit_stats",
    "Get Reddit statistics for a cryptocurrency (subscribers, active users, posts).",
    {
      symbol: z.string().describe("Coin symbol (e.g., 'BTC')")
    },
    async ({ symbol }) => {
      const data = await cryptoCompareRequest("/social/coin/latest", { coinId: symbol.toUpperCase() })
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch Reddit stats for: ${symbol}` }] }
      }
      
      // Extract Reddit-specific data
      const result = (data as any)?.Data?.Reddit || data
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    "social_get_twitter_stats",
    "Get Twitter/X statistics for a cryptocurrency (followers, tweets, engagement).",
    {
      symbol: z.string().describe("Coin symbol (e.g., 'BTC')")
    },
    async ({ symbol }) => {
      const data = await cryptoCompareRequest("/social/coin/latest", { coinId: symbol.toUpperCase() })
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch Twitter stats for: ${symbol}` }] }
      }
      
      // Extract Twitter-specific data
      const result = (data as any)?.Data?.Twitter || data
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  server.tool(
    "social_get_github_stats",
    "Get GitHub development activity for a cryptocurrency project.",
    {
      symbol: z.string().describe("Coin symbol (e.g., 'ETH')")
    },
    async ({ symbol }) => {
      const data = await cryptoCompareRequest("/social/coin/latest", { coinId: symbol.toUpperCase() })
      if (!data) {
        return { content: [{ type: "text" as const, text: `Failed to fetch GitHub stats for: ${symbol}` }] }
      }
      
      // Extract GitHub-specific data
      const result = (data as any)?.Data?.CodeRepository || data
      return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] }
    }
  )

  // ==================== SOCIAL DOMINANCE ====================

  server.tool(
    "social_get_dominance",
    "Get social dominance metrics - share of social mentions compared to total crypto mentions.",
    {
      symbols: z.array(z.string()).describe("Array of coin symbols to compare")
    },
    async ({ symbols }) => {
      const results: Record<string, unknown> = {}
      
      for (const symbol of symbols.slice(0, 10)) { // Limit to 10 to avoid rate limits
        const data = await lunarCrushRequest(`/coins/${symbol.toLowerCase()}`)
        if (data) {
          results[symbol] = {
            social_dominance: (data as any).social_dominance,
            social_volume: (data as any).social_volume,
            galaxy_score: (data as any).galaxy_score
          }
        }
      }
      
      if (Object.keys(results).length === 0) {
        return { content: [{ type: "text" as const, text: "Failed to fetch social dominance data" }] }
      }
      
      return { content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }] }
    }
  )

  // ==================== NEWS SENTIMENT ====================

  server.tool(
    "social_get_news_sentiment",
    "Get sentiment analysis of recent crypto news articles.",
    {
      symbol: z.string().optional().describe("Filter by coin symbol"),
      limit: z.number().optional().default(25).describe("Number of articles")
    },
    async ({ symbol, limit }) => {
      const params: Record<string, unknown> = { limit, source: "news" }
      if (symbol) params.symbol = symbol.toLowerCase()
      
      const data = await lunarCrushRequest("/feeds", params)
      if (!data) {
        return { content: [{ type: "text" as const, text: "Failed to fetch news sentiment" }] }
      }
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] }
    }
  )
}
