/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"

import { mcpToolRes } from "@/utils/helper.js"

// Free Crypto News API base URL
const CRYPTO_NEWS_API_BASE = "https://free-crypto-news.vercel.app"

// News article interface
interface NewsArticle {
  title: string
  link: string
  description?: string
  pubDate: string
  source: string
  sourceKey: string
  category: string
  timeAgo: string
}

// News response interface
interface NewsResponse {
  articles: NewsArticle[]
  totalCount: number
  sources: string[]
  fetchedAt: string
}

// Source info interface
interface SourceInfo {
  key: string
  name: string
  url: string
  category: string
  status: "active" | "unavailable"
}

// Fetch helper function
async function fetchNews(endpoint: string): Promise<any> {
  const response = await fetch(`${CRYPTO_NEWS_API_BASE}${endpoint}`)
  if (!response.ok) {
    throw new Error(`Failed to fetch from ${endpoint}: ${response.statusText}`)
  }
  return response.json()
}

export function registerNewsTools(server: McpServer) {
  // Get latest crypto news
  server.tool(
    "get_crypto_news",
    "Get latest cryptocurrency news from 7 major sources (CoinDesk, The Block, Decrypt, CoinTelegraph, Bitcoin Magazine, Blockworks, The Defiant)",
    {
      limit: z
        .number()
        .default(10)
        .describe("Maximum number of articles to return (1-50, default: 10)"),
      source: z
        .string()
        .optional()
        .describe(
          "Filter by source: coindesk, theblock, decrypt, cointelegraph, bitcoinmagazine, blockworks, defiant"
        )
    },
    async ({ limit, source }) => {
      try {
        let endpoint = `/api/news?limit=${limit}`
        if (source) {
          endpoint += `&source=${source}`
        }
        const data: NewsResponse = await fetchNews(endpoint)

        return mcpToolRes.success({
          articles: data.articles,
          totalCount: data.totalCount,
          sources: data.sources,
          fetchedAt: data.fetchedAt
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching crypto news")
      }
    }
  )

  // Search crypto news by keywords
  server.tool(
    "search_crypto_news",
    "Search cryptocurrency news by keywords across all 7 sources",
    {
      keywords: z
        .string()
        .describe("Comma-separated keywords to search for (e.g., 'bitcoin,etf' or 'ethereum,defi')"),
      limit: z
        .number()
        .default(10)
        .describe("Maximum number of results (1-30, default: 10)")
    },
    async ({ keywords, limit }) => {
      try {
        const encodedKeywords = encodeURIComponent(keywords)
        const data: NewsResponse = await fetchNews(
          `/api/search?q=${encodedKeywords}&limit=${limit}`
        )

        return mcpToolRes.success({
          articles: data.articles,
          totalCount: data.totalCount,
          searchQuery: keywords,
          fetchedAt: data.fetchedAt
        })
      } catch (error) {
        return mcpToolRes.error(error, "searching crypto news")
      }
    }
  )

  // Get DeFi-specific news
  server.tool(
    "get_defi_news",
    "Get DeFi-specific news about yield farming, DEXs, lending protocols, and more",
    {
      limit: z
        .number()
        .default(10)
        .describe("Maximum number of articles (1-30, default: 10)")
    },
    async ({ limit }) => {
      try {
        const data: NewsResponse = await fetchNews(`/api/defi?limit=${limit}`)

        return mcpToolRes.success({
          articles: data.articles,
          totalCount: data.totalCount,
          category: "defi",
          fetchedAt: data.fetchedAt
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching DeFi news")
      }
    }
  )

  // Get Bitcoin-specific news
  server.tool(
    "get_bitcoin_news",
    "Get Bitcoin-specific news about BTC, Lightning Network, miners, ordinals, and more",
    {
      limit: z
        .number()
        .default(10)
        .describe("Maximum number of articles (1-30, default: 10)")
    },
    async ({ limit }) => {
      try {
        const data: NewsResponse = await fetchNews(`/api/bitcoin?limit=${limit}`)

        return mcpToolRes.success({
          articles: data.articles,
          totalCount: data.totalCount,
          category: "bitcoin",
          fetchedAt: data.fetchedAt
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching Bitcoin news")
      }
    }
  )

  // Get breaking news (last 2 hours)
  server.tool(
    "get_breaking_crypto_news",
    "Get breaking cryptocurrency news from the last 2 hours",
    {
      limit: z
        .number()
        .default(5)
        .describe("Maximum number of articles (1-20, default: 5)")
    },
    async ({ limit }) => {
      try {
        const data: NewsResponse = await fetchNews(`/api/breaking?limit=${limit}`)

        return mcpToolRes.success({
          articles: data.articles,
          totalCount: data.totalCount,
          timeframe: "last 2 hours",
          fetchedAt: data.fetchedAt
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching breaking crypto news")
      }
    }
  )

  // Get list of news sources
  server.tool(
    "get_crypto_news_sources",
    "Get list of all available cryptocurrency news sources",
    {},
    async () => {
      try {
        const data: { sources: SourceInfo[] } = await fetchNews("/api/sources")

        return mcpToolRes.success({
          sources: data.sources,
          totalSources: data.sources.length
        })
      } catch (error) {
        return mcpToolRes.error(error, "fetching news sources")
      }
    }
  )
}
