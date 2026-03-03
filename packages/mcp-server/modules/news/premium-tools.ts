/**
 * Premium News Tools with x402 Payment Integration
 * @description Premium crypto news features with automatic micropayment handling
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 *
 * Premium Tiers:
 * 1. Real-time Firehose - $0.10/day - WebSocket feed, <1s latency
 * 2. AI Summaries - $0.001/summary - GPT-powered article summaries
 * 3. Breaking News Alerts - $0.05/day - Push notifications
 * 4. Historical Deep Dive - $0.01/query - Full archive access
 * 5. Custom Feeds - $0.50/month - Personalized endpoints
 *
 * Revenue Split: 70% to content sources, 30% platform fee
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { z } from "zod"
import { mcpToolRes } from "@/utils/helper.js"
import { X402Client } from "@/x402/sdk/client.js"
import { fetchWith402Handling } from "@/x402/sdk/http/handler.js"
import { loadLegacyX402Config, isX402Configured } from "@/x402/config.js"
import Logger from "@/utils/logger.js"

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Premium News API base URL */
const PREMIUM_NEWS_API_BASE =
  process.env.PREMIUM_NEWS_API_URL || "https://free-crypto-news.vercel.app"

/** Premium pricing tiers (in USD) */
export const PREMIUM_PRICING = {
  firehose: {
    price: "$0.10",
    period: "day",
    description: "Real-time WebSocket feed with <1 second latency",
  },
  summary: {
    price: "$0.001",
    period: "request",
    description: "AI-powered article summary with key points and sentiment",
  },
  alerts: {
    price: "$0.05",
    period: "day",
    description: "Breaking news alerts via SMS/Discord/Telegram",
  },
  historical: {
    price: "$0.01",
    period: "query",
    description: "Full archive access with advanced search",
  },
  customFeed: {
    price: "$0.50",
    period: "month",
    description: "Custom feed with your keywords and source preferences",
  },
  bulkExport: {
    price: "$0.02",
    period: "request",
    description: "Export news data in CSV/JSON format",
  },
} as const

/** Revenue split configuration */
export const REVENUE_SPLIT = {
  contentSources: 0.7, // 70% to content sources
  platform: 0.3, // 30% platform fee
} as const

// =============================================================================
// INTERFACES
// =============================================================================

/** AI-generated article summary */
interface ArticleSummary {
  articleId: string
  title: string
  summary: string
  keyPoints: string[]
  sentiment: {
    score: number // -1 to 1
    label: "bearish" | "neutral" | "bullish"
    confidence: number
  }
  topics: string[]
  entities: {
    coins: string[]
    companies: string[]
    people: string[]
  }
  readingTime: string
  generatedAt: string
}

/** Breaking news alert configuration */
interface AlertConfig {
  keywords: string[]
  coins: string[]
  sources: string[]
  minSentiment?: number
  channels: {
    discord?: string
    telegram?: string
    sms?: string
    webhook?: string
  }
}

/** Custom feed configuration */
interface CustomFeedConfig {
  name: string
  keywords: string[]
  sources: string[]
  excludeKeywords?: string[]
  minRelevanceScore?: number
  deduplicate?: boolean
  [key: string]: unknown // Index signature for Record<string, unknown> compatibility
}

/** Historical query result */
interface HistoricalResult {
  articles: Array<{
    id: string
    title: string
    description: string
    source: string
    pubDate: string
    url: string
    sentiment?: number
  }>
  totalCount: number
  query: {
    keywords?: string
    startDate?: string
    endDate?: string
    sources?: string[]
  }
  pagination: {
    page: number
    perPage: number
    totalPages: number
  }
}

/** Firehose subscription status */
interface FirehoseSubscription {
  subscriptionId: string
  status: "active" | "pending" | "expired"
  expiresAt: string
  websocketUrl: string
  sources: string[]
  articlesReceived: number
  latencyMs: number
}

// =============================================================================
// X402 CLIENT SETUP
// =============================================================================

/** Singleton x402 client instance */
let x402Client: X402Client | null = null

/**
 * Get or create x402 client for premium features
 */
function getX402Client(): X402Client | null {
  if (!isX402Configured()) {
    return null
  }

  if (!x402Client) {
    const config = loadLegacyX402Config()
    if (config.privateKey) {
      x402Client = new X402Client({
        chain: config.chain,
        privateKey: config.privateKey,
        rpcUrl: config.rpcUrl,
        enableGasless: config.enableGasless,
        facilitatorUrl: config.facilitatorUrl,
        debug: config.debug,
      })
    }
  }
  return x402Client
}

/**
 * Make a premium API request with x402 payment handling
 */
async function premiumFetch<T>(
  endpoint: string,
  options: {
    method?: "GET" | "POST" | "PUT" | "DELETE"
    body?: Record<string, unknown>
    maxPayment?: string
  } = {}
): Promise<T> {
  const client = getX402Client()
  const url = `${PREMIUM_NEWS_API_BASE}${endpoint}`
  const { method = "GET", body, maxPayment = "1.00" } = options
  const maxPaymentFloat = parseFloat(maxPayment)

  if (!client) {
    // Fall back to regular fetch without payment capability
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })

    if (response.status === 402) {
      throw new Error(
        "This endpoint requires payment. Configure X402_PRIVATE_KEY to enable premium features."
      )
    }

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }

  // Use x402 fetch with automatic payment handling
  const response = await fetchWith402Handling(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    onPaymentRequired: async (paymentRequest) => {
      // Check if payment is within allowed limit
      const amount = parseFloat(paymentRequest.amount)
      if (amount > maxPaymentFloat) {
        throw new Error(
          `Payment of ${paymentRequest.amount} ${paymentRequest.token} exceeds maximum allowed (${maxPayment})`
        )
      }

      // Execute payment and return tx hash as proof
      const result = await client.pay(
        paymentRequest.recipient,
        paymentRequest.amount,
        paymentRequest.token
      )
      return result.transaction.hash
    },
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error")
    throw new Error(`Premium API request failed: ${response.status} - ${errorText}`)
  }

  return response.json() as Promise<T>
}

// =============================================================================
// TOOL REGISTRATION
// =============================================================================

/**
 * Register premium news tools with MCP server
 * These tools require x402 configuration for payment handling
 */
export function registerPremiumNewsTools(server: McpServer): void {
  const isConfigured = isX402Configured()

  // =========================================================================
  // Tool 1: Real-time Firehose ($0.10/day)
  // =========================================================================
  server.tool(
    "subscribe_news_firehose",
    `Subscribe to real-time crypto news firehose. ${PREMIUM_PRICING.firehose.price}/${PREMIUM_PRICING.firehose.period}. ` +
      "Provides WebSocket URL for <1 second latency news delivery from all sources.",
    {
      sources: z
        .array(z.string())
        .optional()
        .describe(
          "Filter by sources: coindesk, theblock, decrypt, cointelegraph, bitcoinmagazine, blockworks, defiant"
        ),
      duration: z
        .enum(["1day", "7days", "30days"])
        .default("1day")
        .describe("Subscription duration"),
    },
    async ({ sources, duration }) => {
      if (!isConfigured) {
        return mcpToolRes.error(
          new Error("x402 not configured"),
          "subscribing to firehose. Set X402_PRIVATE_KEY to enable premium features"
        )
      }

      try {
        const result = await premiumFetch<FirehoseSubscription>("/api/premium/firehose/subscribe", {
          method: "POST",
          body: { sources, duration },
          maxPayment: duration === "30days" ? "3.00" : duration === "7days" ? "0.70" : "0.10",
        })

        return mcpToolRes.success({
          message: "Successfully subscribed to news firehose",
          subscription: {
            id: result.subscriptionId,
            status: result.status,
            expiresAt: result.expiresAt,
            websocketUrl: result.websocketUrl,
          },
          pricing: PREMIUM_PRICING.firehose,
          usage: `Connect to WebSocket at ${result.websocketUrl} to receive real-time news`,
        })
      } catch (error) {
        return mcpToolRes.error(error, "subscribing to news firehose")
      }
    }
  )

  // =========================================================================
  // Tool 2: AI Article Summaries ($0.001/summary)
  // =========================================================================
  server.tool(
    "summarize_article",
    `Get AI-powered summary of a crypto news article. ${PREMIUM_PRICING.summary.price}/${PREMIUM_PRICING.summary.period}. ` +
      "Includes key points, sentiment analysis, and entity extraction.",
    {
      articleId: z.string().describe("The article ID to summarize"),
      articleUrl: z
        .string()
        .url()
        .optional()
        .describe("Alternative: provide the article URL directly"),
      includeTranslation: z
        .boolean()
        .default(false)
        .describe("Translate summary to specified language"),
      language: z.string().default("en").describe("Target language for translation (ISO 639-1)"),
    },
    async ({ articleId, articleUrl, includeTranslation, language }) => {
      if (!isConfigured) {
        return mcpToolRes.error(
          new Error("x402 not configured"),
          "summarizing article. Set X402_PRIVATE_KEY to enable premium features"
        )
      }

      try {
        const result = await premiumFetch<ArticleSummary>("/api/premium/ai/summarize", {
          method: "POST",
          body: {
            articleId,
            articleUrl,
            translate: includeTranslation,
            targetLanguage: language,
          },
          maxPayment: "0.01",
        })

        return mcpToolRes.success({
          title: result.title,
          summary: result.summary,
          keyPoints: result.keyPoints,
          sentiment: {
            score: result.sentiment.score,
            label: result.sentiment.label,
            confidence: `${(result.sentiment.confidence * 100).toFixed(0)}%`,
          },
          topics: result.topics,
          mentionedEntities: result.entities,
          readingTime: result.readingTime,
          pricing: PREMIUM_PRICING.summary,
        })
      } catch (error) {
        return mcpToolRes.error(error, "generating article summary")
      }
    }
  )

  // =========================================================================
  // Tool 3: Batch Summarize Multiple Articles
  // =========================================================================
  server.tool(
    "batch_summarize_articles",
    `Summarize multiple articles at once. ${PREMIUM_PRICING.summary.price} per article. ` +
      "More efficient for analyzing multiple articles.",
    {
      articleIds: z
        .array(z.string())
        .min(1)
        .max(20)
        .describe("Array of article IDs to summarize (max 20)"),
      concise: z
        .boolean()
        .default(false)
        .describe("Return shorter summaries for quick overview"),
    },
    async ({ articleIds, concise }) => {
      if (!isConfigured) {
        return mcpToolRes.error(
          new Error("x402 not configured"),
          "batch summarizing. Set X402_PRIVATE_KEY to enable premium features"
        )
      }

      try {
        const maxPayment = (articleIds.length * 0.001 + 0.001).toFixed(3) // Add small buffer
        const result = await premiumFetch<{ summaries: ArticleSummary[] }>(
          "/api/premium/ai/batch-summarize",
          {
            method: "POST",
            body: { articleIds, concise },
            maxPayment,
          }
        )

        return mcpToolRes.success({
          count: result.summaries.length,
          summaries: result.summaries.map((s) => ({
            articleId: s.articleId,
            title: s.title,
            summary: s.summary,
            sentiment: s.sentiment.label,
            keyPoints: concise ? s.keyPoints.slice(0, 2) : s.keyPoints,
          })),
          totalCost: `$${(result.summaries.length * 0.001).toFixed(4)}`,
        })
      } catch (error) {
        return mcpToolRes.error(error, "batch summarizing articles")
      }
    }
  )

  // =========================================================================
  // Tool 4: Breaking News Alerts ($0.05/day)
  // =========================================================================
  server.tool(
    "configure_breaking_alerts",
    `Set up breaking news alerts. ${PREMIUM_PRICING.alerts.price}/${PREMIUM_PRICING.alerts.period}. ` +
      "Receive push notifications via Discord, Telegram, SMS, or webhooks.",
    {
      keywords: z
        .array(z.string())
        .optional()
        .describe("Keywords to monitor (e.g., 'bitcoin', 'sec', 'etf')"),
      coins: z
        .array(z.string())
        .optional()
        .describe("Coin symbols to track (e.g., 'BTC', 'ETH', 'SOL')"),
      sources: z.array(z.string()).optional().describe("Limit to specific news sources"),
      discordWebhook: z.string().url().optional().describe("Discord webhook URL for notifications"),
      telegramChatId: z.string().optional().describe("Telegram chat ID for notifications"),
      webhookUrl: z.string().url().optional().describe("Custom webhook URL"),
      duration: z.enum(["1day", "7days", "30days"]).default("1day").describe("Alert duration"),
    },
    async ({
      keywords,
      coins,
      sources,
      discordWebhook,
      telegramChatId,
      webhookUrl,
      duration,
    }) => {
      if (!isConfigured) {
        return mcpToolRes.error(
          new Error("x402 not configured"),
          "configuring alerts. Set X402_PRIVATE_KEY to enable premium features"
        )
      }

      // Validate at least one channel is configured
      if (!discordWebhook && !telegramChatId && !webhookUrl) {
        return mcpToolRes.error(
          new Error("No notification channel configured"),
          "at least one of discordWebhook, telegramChatId, or webhookUrl is required"
        )
      }

      try {
        const alertConfig: AlertConfig = {
          keywords: keywords || [],
          coins: coins || [],
          sources: sources || [],
          channels: {
            discord: discordWebhook,
            telegram: telegramChatId,
            webhook: webhookUrl,
          },
        }

        const result = await premiumFetch<{
          alertId: string
          status: string
          expiresAt: string
          filters: AlertConfig
        }>("/api/premium/alerts/configure", {
          method: "POST",
          body: { config: alertConfig, duration },
          maxPayment: duration === "30days" ? "1.50" : duration === "7days" ? "0.35" : "0.05",
        })

        return mcpToolRes.success({
          message: "Breaking news alerts configured successfully",
          alertId: result.alertId,
          status: result.status,
          expiresAt: result.expiresAt,
          filters: {
            keywords: result.filters.keywords,
            coins: result.filters.coins,
            sources: result.filters.sources,
          },
          channels: Object.keys(alertConfig.channels).filter(
            (k) => alertConfig.channels[k as keyof typeof alertConfig.channels]
          ),
          pricing: PREMIUM_PRICING.alerts,
        })
      } catch (error) {
        return mcpToolRes.error(error, "configuring breaking news alerts")
      }
    }
  )

  // =========================================================================
  // Tool 5: Historical Deep Dive ($0.01/query)
  // =========================================================================
  server.tool(
    "search_historical_news",
    `Search full historical news archive. ${PREMIUM_PRICING.historical.price}/${PREMIUM_PRICING.historical.period}. ` +
      "Access years of crypto news with advanced filters and full-text search.",
    {
      keywords: z.string().optional().describe("Search keywords (supports AND, OR, NOT operators)"),
      startDate: z
        .string()
        .optional()
        .describe("Start date for search range (YYYY-MM-DD or ISO 8601)"),
      endDate: z.string().optional().describe("End date for search range (YYYY-MM-DD or ISO 8601)"),
      sources: z.array(z.string()).optional().describe("Filter by sources"),
      coins: z.array(z.string()).optional().describe("Filter by mentioned coins"),
      sentiment: z
        .enum(["bullish", "bearish", "neutral", "all"])
        .default("all")
        .describe("Filter by sentiment"),
      sortBy: z
        .enum(["relevance", "date_desc", "date_asc", "sentiment"])
        .default("relevance")
        .describe("Sort order"),
      page: z.number().min(1).default(1).describe("Page number for pagination"),
      perPage: z.number().min(1).max(100).default(20).describe("Results per page"),
    },
    async ({ keywords, startDate, endDate, sources, coins, sentiment, sortBy, page, perPage }) => {
      if (!isConfigured) {
        return mcpToolRes.error(
          new Error("x402 not configured"),
          "searching historical news. Set X402_PRIVATE_KEY to enable premium features"
        )
      }

      try {
        const queryParams = new URLSearchParams()
        if (keywords) queryParams.set("q", keywords)
        if (startDate) queryParams.set("startDate", startDate)
        if (endDate) queryParams.set("endDate", endDate)
        if (sources?.length) queryParams.set("sources", sources.join(","))
        if (coins?.length) queryParams.set("coins", coins.join(","))
        if (sentiment !== "all") queryParams.set("sentiment", sentiment)
        queryParams.set("sortBy", sortBy)
        queryParams.set("page", page.toString())
        queryParams.set("perPage", perPage.toString())

        const result = await premiumFetch<HistoricalResult>(
          `/api/premium/news/historical?${queryParams}`,
          { maxPayment: "0.05" }
        )

        return mcpToolRes.success({
          totalResults: result.totalCount,
          page: result.pagination.page,
          totalPages: result.pagination.totalPages,
          articles: result.articles.map((a) => ({
            id: a.id,
            title: a.title,
            source: a.source,
            date: a.pubDate,
            sentiment: a.sentiment
              ? a.sentiment > 0.3
                ? "bullish"
                : a.sentiment < -0.3
                  ? "bearish"
                  : "neutral"
              : "unknown",
            url: a.url,
          })),
          query: result.query,
          pricing: PREMIUM_PRICING.historical,
        })
      } catch (error) {
        return mcpToolRes.error(error, "searching historical news")
      }
    }
  )

  // =========================================================================
  // Tool 6: Export Historical Data to CSV
  // =========================================================================
  server.tool(
    "export_news_data",
    `Export news data to CSV or JSON. ${PREMIUM_PRICING.bulkExport.price}/${PREMIUM_PRICING.bulkExport.period}. ` +
      "Download bulk news data for analysis.",
    {
      format: z.enum(["csv", "json"]).default("csv").describe("Export format"),
      startDate: z.string().describe("Start date (YYYY-MM-DD)"),
      endDate: z.string().describe("End date (YYYY-MM-DD)"),
      sources: z.array(z.string()).optional().describe("Filter by sources"),
      keywords: z.string().optional().describe("Filter by keywords"),
      maxRecords: z.number().min(1).max(10000).default(1000).describe("Maximum records to export"),
    },
    async ({ format, startDate, endDate, sources, keywords, maxRecords }) => {
      if (!isConfigured) {
        return mcpToolRes.error(
          new Error("x402 not configured"),
          "exporting data. Set X402_PRIVATE_KEY to enable premium features"
        )
      }

      try {
        const result = await premiumFetch<{
          downloadUrl: string
          recordCount: number
          format: string
          expiresAt: string
        }>("/api/premium/news/export", {
          method: "POST",
          body: { format, startDate, endDate, sources, keywords, maxRecords },
          maxPayment: "0.10",
        })

        return mcpToolRes.success({
          message: `Exported ${result.recordCount} records to ${result.format.toUpperCase()}`,
          downloadUrl: result.downloadUrl,
          recordCount: result.recordCount,
          expiresAt: result.expiresAt,
          note: "Download link expires in 24 hours",
          pricing: PREMIUM_PRICING.bulkExport,
        })
      } catch (error) {
        return mcpToolRes.error(error, "exporting news data")
      }
    }
  )

  // =========================================================================
  // Tool 7: Custom Feed ($0.50/month)
  // =========================================================================
  server.tool(
    "create_custom_feed",
    `Create a custom news feed with your preferences. ${PREMIUM_PRICING.customFeed.price}/${PREMIUM_PRICING.customFeed.period}. ` +
      "Get a dedicated endpoint with your keywords and source preferences.",
    {
      name: z.string().min(3).max(50).describe("Name for your custom feed"),
      keywords: z.array(z.string()).min(1).describe("Keywords to track (at least one required)"),
      sources: z.array(z.string()).optional().describe("Preferred sources (empty = all)"),
      excludeKeywords: z.array(z.string()).optional().describe("Keywords to exclude from results"),
      minRelevanceScore: z
        .number()
        .min(0)
        .max(1)
        .default(0.5)
        .describe("Minimum relevance score (0-1)"),
      deduplicate: z
        .boolean()
        .default(true)
        .describe("Remove duplicate/similar articles across sources"),
    },
    async ({ name, keywords, sources, excludeKeywords, minRelevanceScore, deduplicate }) => {
      if (!isConfigured) {
        return mcpToolRes.error(
          new Error("x402 not configured"),
          "creating custom feed. Set X402_PRIVATE_KEY to enable premium features"
        )
      }

      try {
        const feedConfig: CustomFeedConfig = {
          name,
          keywords,
          sources: sources || [],
          excludeKeywords,
          minRelevanceScore,
          deduplicate,
        }

        const result = await premiumFetch<{
          feedId: string
          endpoint: string
          rssUrl: string
          atomUrl: string
          jsonUrl: string
          expiresAt: string
          config: CustomFeedConfig
        }>("/api/premium/feeds/create", {
          method: "POST",
          body: feedConfig,
          maxPayment: "0.50",
        })

        return mcpToolRes.success({
          message: "Custom feed created successfully",
          feedId: result.feedId,
          endpoints: {
            json: result.jsonUrl,
            rss: result.rssUrl,
            atom: result.atomUrl,
          },
          expiresAt: result.expiresAt,
          config: {
            name: result.config.name,
            keywords: result.config.keywords,
            sources: result.config.sources?.length ? result.config.sources : "all",
          },
          pricing: PREMIUM_PRICING.customFeed,
        })
      } catch (error) {
        return mcpToolRes.error(error, "creating custom feed")
      }
    }
  )

  // =========================================================================
  // Tool 8: Get Premium Status
  // =========================================================================
  server.tool(
    "get_premium_news_status",
    "Check your premium news subscription status and active features",
    {},
    async () => {
      if (!isConfigured) {
        return mcpToolRes.success({
          configured: false,
          message:
            "x402 payments not configured. Set X402_PRIVATE_KEY environment variable to enable premium features.",
          pricing: PREMIUM_PRICING,
          freeFeatures: [
            "get_crypto_news - Latest news from 7 sources",
            "search_crypto_news - Keyword search",
            "get_defi_news - DeFi-specific news",
            "get_bitcoin_news - Bitcoin news",
            "get_breaking_crypto_news - Last 2 hours",
          ],
        })
      }

      try {
        const result = await premiumFetch<{
          activeSubscriptions: Array<{
            type: string
            expiresAt: string
            usage: number
          }>
          walletBalance: string
          totalSpent: string
          lastPayment?: {
            amount: string
            date: string
            feature: string
          }
        }>("/api/premium/status", { maxPayment: "0" })

        return mcpToolRes.success({
          configured: true,
          activeSubscriptions: result.activeSubscriptions,
          walletBalance: result.walletBalance,
          totalSpent: result.totalSpent,
          lastPayment: result.lastPayment,
          pricing: PREMIUM_PRICING,
        })
      } catch (error) {
        // Status check failed but x402 is configured
        return mcpToolRes.success({
          configured: true,
          message: "Could not fetch subscription status. Premium features are available.",
          pricing: PREMIUM_PRICING,
        })
      }
    }
  )

  // =========================================================================
  // Tool 9: AI News Impact Analysis
  // =========================================================================
  server.tool(
    "analyze_news_impact",
    `Analyze potential market impact of a news article. ${PREMIUM_PRICING.summary.price}/${PREMIUM_PRICING.summary.period}. ` +
      "AI analysis of how news might affect crypto prices.",
    {
      articleId: z.string().optional().describe("Article ID to analyze"),
      articleUrl: z.string().url().optional().describe("Or provide article URL directly"),
      targetCoins: z
        .array(z.string())
        .optional()
        .describe("Specific coins to analyze impact for (e.g., BTC, ETH)"),
    },
    async ({ articleId, articleUrl, targetCoins }) => {
      if (!isConfigured) {
        return mcpToolRes.error(
          new Error("x402 not configured"),
          "analyzing news impact. Set X402_PRIVATE_KEY to enable premium features"
        )
      }

      if (!articleId && !articleUrl) {
        return mcpToolRes.error(
          new Error("Missing input"),
          "either articleId or articleUrl is required"
        )
      }

      try {
        const result = await premiumFetch<{
          article: { title: string; source: string }
          impactAnalysis: {
            overallImpact: "high" | "medium" | "low"
            sentiment: "bullish" | "bearish" | "neutral"
            confidence: number
            timeframe: string
            affectedCoins: Array<{
              symbol: string
              impact: "positive" | "negative" | "neutral"
              magnitude: number
              reasoning: string
            }>
            marketFactors: string[]
            riskFactors: string[]
          }
        }>("/api/premium/ai/impact", {
          method: "POST",
          body: { articleId, articleUrl, targetCoins },
          maxPayment: "0.01",
        })

        return mcpToolRes.success({
          article: result.article,
          impact: {
            level: result.impactAnalysis.overallImpact,
            sentiment: result.impactAnalysis.sentiment,
            confidence: `${(result.impactAnalysis.confidence * 100).toFixed(0)}%`,
            timeframe: result.impactAnalysis.timeframe,
          },
          affectedCoins: result.impactAnalysis.affectedCoins,
          factors: {
            market: result.impactAnalysis.marketFactors,
            risk: result.impactAnalysis.riskFactors,
          },
          pricing: PREMIUM_PRICING.summary,
        })
      } catch (error) {
        return mcpToolRes.error(error, "analyzing news impact")
      }
    }
  )

  Logger.info(
    `Premium news tools registered (x402 ${isConfigured ? "configured" : "not configured"})`
  )
}
