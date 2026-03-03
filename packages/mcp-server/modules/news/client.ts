/**
 * Crypto News Client SDK
 * @description Unified client for free and premium crypto news features
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 *
 * @example
 * ```typescript
 * import { createNewsClient } from "@nirholas/universal-crypto-mcp/news"
 *
 * // Free usage
 * const news = createNewsClient()
 * const articles = await news.getLatest()
 *
 * // Premium usage (auto-pays with x402)
 * const premiumNews = createNewsClient({ privateKey: "0x..." })
 * const firehose = await premiumNews.subscribe("firehose")  // $0.10/day
 * const summary = await premiumNews.summarize(articleId)    // $0.001
 * ```
 */

import { X402Client } from "@/x402/sdk/client.js"
import { fetchWith402Handling } from "@/x402/sdk/http/handler.js"
import type { X402Chain } from "@/x402/sdk/types.js"

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Default API base URL */
const DEFAULT_API_BASE = "https://free-crypto-news.vercel.app"

/** Client configuration options */
export interface NewsClientConfig {
  /** API base URL (defaults to free-crypto-news.vercel.app) */
  apiUrl?: string
  /** EVM private key for x402 payments (enables premium features) */
  privateKey?: `0x${string}`
  /** Chain for payments (defaults to base-sepolia for safety) */
  chain?: X402Chain
  /** RPC URL override */
  rpcUrl?: string
  /** Maximum payment per request in USD */
  maxPaymentPerRequest?: string
  /** Enable gasless payments via EIP-3009 */
  enableGasless?: boolean
  /** Request timeout in milliseconds */
  timeout?: number
}

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

/** News article from the API */
export interface NewsArticle {
  id: string
  title: string
  link: string
  description?: string
  pubDate: string
  source: string
  sourceKey: string
  category: string
  timeAgo: string
}

/** News response structure */
export interface NewsResponse {
  articles: NewsArticle[]
  totalCount: number
  sources: string[]
  fetchedAt: string
}

/** AI-generated article summary */
export interface ArticleSummary {
  articleId: string
  title: string
  summary: string
  keyPoints: string[]
  sentiment: {
    score: number
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

/** Firehose subscription details */
export interface FirehoseSubscription {
  subscriptionId: string
  status: "active" | "pending" | "expired"
  websocketUrl: string
  expiresAt: string
  sources: string[]
}

/** Alert configuration */
export interface AlertConfig {
  keywords?: string[]
  coins?: string[]
  sources?: string[]
  channels: {
    discord?: string
    telegram?: string
    sms?: string
    webhook?: string
  }
}

/** Alert subscription */
export interface AlertSubscription {
  alertId: string
  status: "active" | "paused"
  expiresAt: string
  config: AlertConfig
}

/** Custom feed configuration */
export interface CustomFeedConfig {
  name: string
  keywords: string[]
  sources?: string[]
  excludeKeywords?: string[]
  minRelevanceScore?: number
  deduplicate?: boolean
  [key: string]: unknown // Index signature for compatibility
}

/** Custom feed response */
export interface CustomFeed {
  feedId: string
  endpoint: string
  rssUrl: string
  atomUrl: string
  jsonUrl: string
  expiresAt: string
  config: CustomFeedConfig
}

/** Historical search options */
export interface HistoricalSearchOptions {
  keywords?: string
  startDate?: string
  endDate?: string
  sources?: string[]
  coins?: string[]
  sentiment?: "bullish" | "bearish" | "neutral" | "all"
  sortBy?: "relevance" | "date_desc" | "date_asc" | "sentiment"
  page?: number
  perPage?: number
}

/** Historical search result */
export interface HistoricalSearchResult {
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
  pagination: {
    page: number
    perPage: number
    totalPages: number
  }
}

/** Premium status */
export interface PremiumStatus {
  isPremium: boolean
  activeSubscriptions: Array<{
    type: string
    expiresAt: string
    usage?: number
  }>
  walletBalance?: string
  totalSpent?: string
}

// =============================================================================
// NEWS CLIENT CLASS
// =============================================================================

/**
 * Unified crypto news client with free and premium features
 */
export class NewsClient {
  private readonly apiUrl: string
  private readonly x402Client: X402Client | null
  private readonly maxPayment: string
  private readonly timeout: number

  constructor(config: NewsClientConfig = {}) {
    this.apiUrl = config.apiUrl || DEFAULT_API_BASE
    this.maxPayment = config.maxPaymentPerRequest || "1.00"
    this.timeout = config.timeout || 30000

    // Initialize x402 client if private key provided
    if (config.privateKey) {
      this.x402Client = new X402Client({
        chain: config.chain || "base-sepolia",
        privateKey: config.privateKey,
        rpcUrl: config.rpcUrl,
        enableGasless: config.enableGasless ?? true,
        debug: false,
      })
    } else {
      this.x402Client = null
    }
  }

  // ===========================================================================
  // INTERNAL HELPERS
  // ===========================================================================

  private async fetch<T>(
    endpoint: string,
    options: {
      method?: "GET" | "POST" | "PUT" | "DELETE"
      body?: Record<string, unknown>
      maxPayment?: string
      requirePayment?: boolean
    } = {}
  ): Promise<T> {
    const url = `${this.apiUrl}${endpoint}`
    const { method = "GET", body, maxPayment = this.maxPayment, requirePayment = false } = options
    const maxPaymentFloat = parseFloat(maxPayment)

    const fetchOptions: RequestInit = {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    }

    // Use x402 fetch for premium endpoints
    if (this.x402Client && (requirePayment || endpoint.includes("/premium/"))) {
      const client = this.x402Client
      const response = await fetchWith402Handling(url, {
        ...fetchOptions,
        onPaymentRequired: async (paymentRequest) => {
          const amount = parseFloat(paymentRequest.amount)
          if (amount > maxPaymentFloat) {
            throw new Error(
              `Payment of ${paymentRequest.amount} ${paymentRequest.token} exceeds maximum (${maxPayment})`
            )
          }
          const result = await client.pay(
            paymentRequest.recipient,
            paymentRequest.amount,
            paymentRequest.token
          )
          return result.transaction.hash
        },
      })

      if (!response.ok) {
        const error = await response.text().catch(() => "Request failed")
        throw new Error(`API Error ${response.status}: ${error}`)
      }

      return response.json() as Promise<T>
    }

    // Regular fetch for free endpoints
    const response = await fetch(url, fetchOptions)

    if (response.status === 402) {
      throw new Error(
        "This endpoint requires payment. Initialize NewsClient with a privateKey to enable premium features."
      )
    }

    if (!response.ok) {
      const error = await response.text().catch(() => "Request failed")
      throw new Error(`API Error ${response.status}: ${error}`)
    }

    return response.json() as Promise<T>
  }

  // ===========================================================================
  // FREE ENDPOINTS
  // ===========================================================================

  /**
   * Get latest crypto news (FREE)
   * @param options - Filter options
   */
  async getLatest(
    options: {
      limit?: number
      source?: string
    } = {}
  ): Promise<NewsResponse> {
    const params = new URLSearchParams()
    if (options.limit) params.set("limit", options.limit.toString())
    if (options.source) params.set("source", options.source)

    const query = params.toString()
    return this.fetch(`/api/news${query ? `?${query}` : ""}`)
  }

  /**
   * Search news by keywords (FREE)
   * @param keywords - Search keywords (comma-separated)
   * @param limit - Max results
   */
  async search(keywords: string, limit = 10): Promise<NewsResponse> {
    return this.fetch(`/api/search?q=${encodeURIComponent(keywords)}&limit=${limit}`)
  }

  /**
   * Get DeFi-specific news (FREE)
   */
  async getDeFiNews(limit = 10): Promise<NewsResponse> {
    return this.fetch(`/api/defi?limit=${limit}`)
  }

  /**
   * Get Bitcoin-specific news (FREE)
   */
  async getBitcoinNews(limit = 10): Promise<NewsResponse> {
    return this.fetch(`/api/bitcoin?limit=${limit}`)
  }

  /**
   * Get breaking news from last 2 hours (FREE)
   */
  async getBreaking(limit = 5): Promise<NewsResponse> {
    return this.fetch(`/api/breaking?limit=${limit}`)
  }

  /**
   * Get list of news sources (FREE)
   */
  async getSources(): Promise<{
    sources: Array<{
      key: string
      name: string
      url: string
      category: string
      status: "active" | "unavailable"
    }>
  }> {
    return this.fetch("/api/sources")
  }

  // ===========================================================================
  // PREMIUM ENDPOINTS (require x402 payment)
  // ===========================================================================

  /**
   * Check if premium features are enabled
   */
  get isPremiumEnabled(): boolean {
    return this.x402Client !== null
  }

  /**
   * Subscribe to real-time news firehose ($0.10/day)
   * @param options - Subscription options
   */
  async subscribe(
    type: "firehose",
    options: {
      sources?: string[]
      duration?: "1day" | "7days" | "30days"
    } = {}
  ): Promise<FirehoseSubscription> {
    this.requirePremium()

    const maxPayment =
      options.duration === "30days" ? "3.00" : options.duration === "7days" ? "0.70" : "0.10"

    return this.fetch("/api/premium/firehose/subscribe", {
      method: "POST",
      body: {
        sources: options.sources,
        duration: options.duration || "1day",
      },
      maxPayment,
      requirePayment: true,
    })
  }

  /**
   * Get AI summary of an article ($0.001/request)
   * @param articleIdOrUrl - Article ID or URL
   */
  async summarize(articleIdOrUrl: string): Promise<ArticleSummary> {
    this.requirePremium()

    const isUrl = articleIdOrUrl.startsWith("http")
    return this.fetch("/api/premium/ai/summarize", {
      method: "POST",
      body: isUrl ? { articleUrl: articleIdOrUrl } : { articleId: articleIdOrUrl },
      maxPayment: "0.01",
      requirePayment: true,
    })
  }

  /**
   * Batch summarize multiple articles ($0.001/article)
   * @param articleIds - Array of article IDs
   */
  async batchSummarize(articleIds: string[]): Promise<{ summaries: ArticleSummary[] }> {
    this.requirePremium()

    return this.fetch("/api/premium/ai/batch-summarize", {
      method: "POST",
      body: { articleIds },
      maxPayment: (articleIds.length * 0.001 + 0.001).toFixed(3),
      requirePayment: true,
    })
  }

  /**
   * Configure breaking news alerts ($0.05/day)
   * @param config - Alert configuration
   * @param duration - Alert duration
   */
  async configureAlerts(
    config: AlertConfig,
    duration: "1day" | "7days" | "30days" = "1day"
  ): Promise<AlertSubscription> {
    this.requirePremium()

    const maxPayment = duration === "30days" ? "1.50" : duration === "7days" ? "0.35" : "0.05"

    return this.fetch("/api/premium/alerts/configure", {
      method: "POST",
      body: { config, duration },
      maxPayment,
      requirePayment: true,
    })
  }

  /**
   * Search historical news archive ($0.01/query)
   * @param options - Search options
   */
  async searchHistorical(options: HistoricalSearchOptions = {}): Promise<HistoricalSearchResult> {
    this.requirePremium()

    const params = new URLSearchParams()
    if (options.keywords) params.set("q", options.keywords)
    if (options.startDate) params.set("startDate", options.startDate)
    if (options.endDate) params.set("endDate", options.endDate)
    if (options.sources?.length) params.set("sources", options.sources.join(","))
    if (options.coins?.length) params.set("coins", options.coins.join(","))
    if (options.sentiment && options.sentiment !== "all") params.set("sentiment", options.sentiment)
    if (options.sortBy) params.set("sortBy", options.sortBy)
    if (options.page) params.set("page", options.page.toString())
    if (options.perPage) params.set("perPage", options.perPage.toString())

    const query = params.toString()
    return this.fetch(`/api/premium/news/historical${query ? `?${query}` : ""}`, {
      maxPayment: "0.05",
      requirePayment: true,
    })
  }

  /**
   * Export news data ($0.02/request)
   * @param options - Export options
   */
  async export(options: {
    format: "csv" | "json"
    startDate: string
    endDate: string
    sources?: string[]
    keywords?: string
    maxRecords?: number
  }): Promise<{
    downloadUrl: string
    recordCount: number
    expiresAt: string
  }> {
    this.requirePremium()

    return this.fetch("/api/premium/news/export", {
      method: "POST",
      body: options,
      maxPayment: "0.10",
      requirePayment: true,
    })
  }

  /**
   * Create a custom feed ($0.50/month)
   * @param config - Feed configuration
   */
  async createCustomFeed(config: CustomFeedConfig): Promise<CustomFeed> {
    this.requirePremium()

    return this.fetch("/api/premium/feeds/create", {
      method: "POST",
      body: config,
      maxPayment: "0.50",
      requirePayment: true,
    })
  }

  /**
   * Get premium status and active subscriptions
   */
  async getStatus(): Promise<PremiumStatus> {
    if (!this.x402Client) {
      return {
        isPremium: false,
        activeSubscriptions: [],
      }
    }

    try {
      const status = await this.fetch<{
        activeSubscriptions: Array<{
          type: string
          expiresAt: string
          usage?: number
        }>
        walletBalance: string
        totalSpent: string
      }>("/api/premium/status", { maxPayment: "0" })

      return {
        isPremium: true,
        ...status,
      }
    } catch {
      return {
        isPremium: true,
        activeSubscriptions: [],
      }
    }
  }

  /**
   * Analyze news impact on prices ($0.001/request)
   * @param articleIdOrUrl - Article ID or URL
   * @param targetCoins - Optional specific coins to analyze
   */
  async analyzeImpact(
    articleIdOrUrl: string,
    targetCoins?: string[]
  ): Promise<{
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
  }> {
    this.requirePremium()

    const isUrl = articleIdOrUrl.startsWith("http")
    return this.fetch("/api/premium/ai/impact", {
      method: "POST",
      body: {
        ...(isUrl ? { articleUrl: articleIdOrUrl } : { articleId: articleIdOrUrl }),
        targetCoins,
      },
      maxPayment: "0.01",
      requirePayment: true,
    })
  }

  // ===========================================================================
  // UTILITIES
  // ===========================================================================

  private requirePremium(): void {
    if (!this.x402Client) {
      throw new Error(
        "Premium features require x402 payment. Initialize NewsClient with a privateKey."
      )
    }
  }
}

// =============================================================================
// FACTORY FUNCTION
// =============================================================================

/**
 * Create a news client instance
 *
 * @example
 * ```typescript
 * // Free usage
 * const news = createNewsClient()
 * const latest = await news.getLatest()
 *
 * // Premium usage (auto-pays with x402)
 * const premiumNews = createNewsClient({
 *   privateKey: process.env.EVM_PRIVATE_KEY as `0x${string}`,
 *   chain: "base", // Use mainnet
 * })
 * const summary = await premiumNews.summarize(articleId) // $0.001
 * ```
 */
export function createNewsClient(config?: NewsClientConfig): NewsClient {
  return new NewsClient(config)
}

// =============================================================================
// EXPORTS
// =============================================================================

export { DEFAULT_API_BASE }
