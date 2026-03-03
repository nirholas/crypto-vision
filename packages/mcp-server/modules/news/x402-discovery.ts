/**
 * x402scan Discovery Document
 * @description Implements /.well-known/x402 for automatic resource discovery
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 *
 * @see https://x402scan.com - x402 resource explorer
 */

// =============================================================================
// V2 SCHEMA TYPES (x402scan compliant)
// =============================================================================

/** V2 Accepts schema for x402scan */
export interface X402Accepts {
  scheme: "exact"
  network: string // CAIP-2 format, e.g., "eip155:8453" for Base
  amount: string // Human-readable amount
  payTo: string // Recipient address
  maxTimeoutSeconds: number
  asset: string // Token address or symbol
  extra: Record<string, unknown> // Required in V2
}

/** Resource metadata */
export interface X402Resource {
  url: string
  description: string
  mimeType: string
}

/** Bazaar extension for UI discoverability */
export interface BazaarExtension {
  info?: {
    input: unknown // Example request data
    output?: unknown // Example response data
  }
  schema?: unknown // JSON Schema for input/output validation
}

/** V2 x402 Response */
export interface X402Response {
  x402Version: 2
  error?: string
  accepts?: X402Accepts[]
  resource?: X402Resource
  extensions?: {
    bazaar?: BazaarExtension
  }
}

/** Discovery document for /.well-known/x402 */
export interface X402DiscoveryDocument {
  name: string
  description: string
  version: string
  homepage?: string
  documentation?: string
  contact?: string
  resources: X402Response[]
}

// =============================================================================
// CONFIGURATION
// =============================================================================

/** Base URL for the API */
const BASE_URL = process.env.PREMIUM_NEWS_API_URL || "https://free-crypto-news.vercel.app"

/** Payment recipient address */
const PAY_TO_ADDRESS = process.env.X402_PAY_TO_ADDRESS || "0x0000000000000000000000000000000000000000"

/** Default network (Base Mainnet) */
const DEFAULT_NETWORK = "eip155:8453"

/** USDC token address on Base */
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

/** Default timeout for payments */
const DEFAULT_TIMEOUT_SECONDS = 300 // 5 minutes

// =============================================================================
// PREMIUM NEWS RESOURCES
// =============================================================================

/**
 * Premium News API resources with x402scan V2 schema compliance
 */
export const PREMIUM_NEWS_RESOURCES: X402Response[] = [
  // =========================================================================
  // Real-time Firehose - $0.10/day
  // =========================================================================
  {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.10",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          duration: "1day",
          renewable: true,
        },
      },
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.70",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          duration: "7days",
          renewable: true,
        },
      },
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "3.00",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          duration: "30days",
          renewable: true,
        },
      },
    ],
    resource: {
      url: `${BASE_URL}/api/premium/firehose/subscribe`,
      description:
        "Subscribe to real-time crypto news firehose. WebSocket feed with <1 second latency from all major sources.",
      mimeType: "application/json",
    },
    extensions: {
      bazaar: {
        info: {
          input: {
            sources: ["coindesk", "theblock", "decrypt"],
            duration: "1day",
          },
          output: {
            subscriptionId: "sub_abc123",
            status: "active",
            websocketUrl: "wss://news.example.com/firehose/sub_abc123",
            expiresAt: "2026-01-28T00:00:00Z",
          },
        },
        schema: {
          type: "object",
          properties: {
            sources: {
              type: "array",
              items: { type: "string" },
              description: "News sources to include",
            },
            duration: {
              type: "string",
              enum: ["1day", "7days", "30days"],
              description: "Subscription duration",
            },
          },
        },
      },
    },
  },

  // =========================================================================
  // AI Article Summary - $0.001/request
  // =========================================================================
  {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.001",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          category: "ai",
          rateLimit: "100/minute",
        },
      },
    ],
    resource: {
      url: `${BASE_URL}/api/premium/ai/summarize`,
      description:
        "AI-powered article summary with key points, sentiment analysis, and entity extraction.",
      mimeType: "application/json",
    },
    extensions: {
      bazaar: {
        info: {
          input: {
            articleId: "article_xyz789",
            // or articleUrl: "https://coindesk.com/article/..."
          },
          output: {
            articleId: "article_xyz789",
            title: "Bitcoin ETF Sees Record Inflows",
            summary: "The Bitcoin ETF experienced its largest single-day inflow...",
            keyPoints: [
              "Record $500M inflow in single day",
              "Institutional adoption accelerating",
              "Price impact expected within 48 hours",
            ],
            sentiment: {
              score: 0.75,
              label: "bullish",
              confidence: 0.89,
            },
            topics: ["bitcoin", "etf", "institutional"],
            entities: {
              coins: ["BTC"],
              companies: ["BlackRock", "Fidelity"],
              people: ["Larry Fink"],
            },
            readingTime: "3 min",
          },
        },
        schema: {
          type: "object",
          properties: {
            articleId: { type: "string" },
            articleUrl: { type: "string", format: "uri" },
          },
          oneOf: [{ required: ["articleId"] }, { required: ["articleUrl"] }],
        },
      },
    },
  },

  // =========================================================================
  // Batch AI Summary - $0.001/article
  // =========================================================================
  {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.001", // Per article, dynamically calculated
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          category: "ai",
          pricingModel: "per-item",
          maxItems: 20,
        },
      },
    ],
    resource: {
      url: `${BASE_URL}/api/premium/ai/batch-summarize`,
      description: "Batch summarize multiple articles efficiently. $0.001 per article.",
      mimeType: "application/json",
    },
    extensions: {
      bazaar: {
        info: {
          input: {
            articleIds: ["article_1", "article_2", "article_3"],
            concise: true,
          },
          output: {
            summaries: [
              {
                articleId: "article_1",
                title: "...",
                summary: "...",
                sentiment: { label: "bullish" },
              },
            ],
          },
        },
        schema: {
          type: "object",
          required: ["articleIds"],
          properties: {
            articleIds: {
              type: "array",
              items: { type: "string" },
              minItems: 1,
              maxItems: 20,
            },
            concise: { type: "boolean", default: false },
          },
        },
      },
    },
  },

  // =========================================================================
  // Breaking News Alerts - $0.05/day
  // =========================================================================
  {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.05",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          duration: "1day",
          channels: ["discord", "telegram", "webhook"],
        },
      },
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.35",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          duration: "7days",
        },
      },
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "1.50",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          duration: "30days",
        },
      },
    ],
    resource: {
      url: `${BASE_URL}/api/premium/alerts/configure`,
      description:
        "Configure breaking news alerts via Discord, Telegram, SMS, or webhooks with custom filters.",
      mimeType: "application/json",
    },
    extensions: {
      bazaar: {
        info: {
          input: {
            config: {
              keywords: ["sec", "regulation", "etf"],
              coins: ["BTC", "ETH"],
              channels: {
                discord: "https://discord.com/api/webhooks/...",
              },
            },
            duration: "7days",
          },
          output: {
            alertId: "alert_abc123",
            status: "active",
            expiresAt: "2026-02-03T00:00:00Z",
          },
        },
        schema: {
          type: "object",
          required: ["config"],
          properties: {
            config: {
              type: "object",
              properties: {
                keywords: { type: "array", items: { type: "string" } },
                coins: { type: "array", items: { type: "string" } },
                sources: { type: "array", items: { type: "string" } },
                channels: {
                  type: "object",
                  properties: {
                    discord: { type: "string", format: "uri" },
                    telegram: { type: "string" },
                    webhook: { type: "string", format: "uri" },
                  },
                },
              },
            },
            duration: { type: "string", enum: ["1day", "7days", "30days"] },
          },
        },
      },
    },
  },

  // =========================================================================
  // Historical News Search - $0.01/query
  // =========================================================================
  {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.01",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          category: "data",
          archiveYears: 5,
        },
      },
    ],
    resource: {
      url: `${BASE_URL}/api/premium/news/historical`,
      description:
        "Search full historical news archive with advanced filters, Boolean operators, and sentiment analysis.",
      mimeType: "application/json",
    },
    extensions: {
      bazaar: {
        info: {
          input: {
            q: "bitcoin AND (etf OR sec)",
            startDate: "2023-01-01",
            endDate: "2023-12-31",
            sentiment: "bullish",
            sortBy: "relevance",
            perPage: 20,
          },
          output: {
            articles: [
              {
                id: "article_1",
                title: "SEC Approves Bitcoin ETF",
                source: "coindesk",
                pubDate: "2024-01-10",
                sentiment: 0.8,
              },
            ],
            totalCount: 1250,
            pagination: { page: 1, perPage: 20, totalPages: 63 },
          },
        },
        schema: {
          type: "object",
          properties: {
            q: { type: "string", description: "Search query with AND/OR/NOT operators" },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            sources: { type: "array", items: { type: "string" } },
            coins: { type: "array", items: { type: "string" } },
            sentiment: { type: "string", enum: ["bullish", "bearish", "neutral", "all"] },
            sortBy: { type: "string", enum: ["relevance", "date_desc", "date_asc"] },
            page: { type: "integer", minimum: 1 },
            perPage: { type: "integer", minimum: 1, maximum: 100 },
          },
        },
      },
    },
  },

  // =========================================================================
  // Bulk Export - $0.02/request
  // =========================================================================
  {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.02",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          category: "export",
          formats: ["csv", "json"],
          maxRecords: 10000,
        },
      },
    ],
    resource: {
      url: `${BASE_URL}/api/premium/news/export`,
      description: "Export news data in CSV or JSON format for analysis and reporting.",
      mimeType: "application/json",
    },
    extensions: {
      bazaar: {
        info: {
          input: {
            format: "csv",
            startDate: "2024-01-01",
            endDate: "2024-01-31",
            maxRecords: 5000,
          },
          output: {
            downloadUrl: "https://storage.example.com/exports/export_abc123.csv",
            recordCount: 4832,
            expiresAt: "2026-01-28T00:00:00Z",
          },
        },
        schema: {
          type: "object",
          required: ["format", "startDate", "endDate"],
          properties: {
            format: { type: "string", enum: ["csv", "json"] },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
            sources: { type: "array", items: { type: "string" } },
            keywords: { type: "string" },
            maxRecords: { type: "integer", minimum: 1, maximum: 10000 },
          },
        },
      },
    },
  },

  // =========================================================================
  // Custom Feed - $0.50/month
  // =========================================================================
  {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.50",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          duration: "30days",
          renewable: true,
          outputFormats: ["json", "rss", "atom"],
        },
      },
    ],
    resource: {
      url: `${BASE_URL}/api/premium/feeds/create`,
      description:
        "Create a custom news feed with your keywords and source preferences. Dedicated JSON/RSS/Atom endpoints.",
      mimeType: "application/json",
    },
    extensions: {
      bazaar: {
        info: {
          input: {
            name: "DeFi Blue Chips",
            keywords: ["aave", "uniswap", "maker"],
            sources: ["defiant", "theblock"],
            excludeKeywords: ["hack"],
            deduplicate: true,
          },
          output: {
            feedId: "feed_abc123",
            jsonUrl: "https://api.example.com/feeds/feed_abc123.json",
            rssUrl: "https://api.example.com/feeds/feed_abc123.rss",
            atomUrl: "https://api.example.com/feeds/feed_abc123.atom",
            expiresAt: "2026-02-27T00:00:00Z",
          },
        },
        schema: {
          type: "object",
          required: ["name", "keywords"],
          properties: {
            name: { type: "string", minLength: 3, maxLength: 50 },
            keywords: { type: "array", items: { type: "string" }, minItems: 1 },
            sources: { type: "array", items: { type: "string" } },
            excludeKeywords: { type: "array", items: { type: "string" } },
            minRelevanceScore: { type: "number", minimum: 0, maximum: 1 },
            deduplicate: { type: "boolean" },
          },
        },
      },
    },
  },

  // =========================================================================
  // AI Impact Analysis - $0.001/request
  // =========================================================================
  {
    x402Version: 2,
    accepts: [
      {
        scheme: "exact",
        network: DEFAULT_NETWORK,
        amount: "0.001",
        payTo: PAY_TO_ADDRESS,
        maxTimeoutSeconds: DEFAULT_TIMEOUT_SECONDS,
        asset: USDC_BASE,
        extra: {
          category: "ai",
        },
      },
    ],
    resource: {
      url: `${BASE_URL}/api/premium/ai/impact`,
      description:
        "AI analysis of news impact on crypto prices. Includes affected coins, magnitude, and risk factors.",
      mimeType: "application/json",
    },
    extensions: {
      bazaar: {
        info: {
          input: {
            articleId: "article_xyz789",
            targetCoins: ["BTC", "ETH"],
          },
          output: {
            article: { title: "SEC Announces New Crypto Regulations", source: "coindesk" },
            impactAnalysis: {
              overallImpact: "high",
              sentiment: "bearish",
              confidence: 0.85,
              timeframe: "24-48 hours",
              affectedCoins: [
                {
                  symbol: "BTC",
                  impact: "negative",
                  magnitude: 0.7,
                  reasoning: "Regulatory uncertainty typically causes short-term selling pressure",
                },
              ],
              marketFactors: ["Regulatory news", "Institutional sentiment"],
              riskFactors: ["Further regulatory announcements", "Market volatility"],
            },
          },
        },
        schema: {
          type: "object",
          properties: {
            articleId: { type: "string" },
            articleUrl: { type: "string", format: "uri" },
            targetCoins: { type: "array", items: { type: "string" } },
          },
          oneOf: [{ required: ["articleId"] }, { required: ["articleUrl"] }],
        },
      },
    },
  },
]

// =============================================================================
// DISCOVERY DOCUMENT GENERATOR
// =============================================================================

/**
 * Generate the /.well-known/x402 discovery document
 */
export function generateDiscoveryDocument(): X402DiscoveryDocument {
  return {
    name: "Free Crypto News - Premium API",
    description:
      "Premium crypto news features powered by x402 micropayments. Real-time firehose, AI summaries, breaking alerts, historical archive, and custom feeds.",
    version: "2.0.0",
    homepage: "https://free-crypto-news.vercel.app",
    documentation: "https://github.com/nirholas/free-crypto-news",
    contact: "https://x.com/nichxbt",
    resources: PREMIUM_NEWS_RESOURCES,
  }
}

/**
 * Get discovery document as JSON string
 */
export function getDiscoveryDocumentJSON(): string {
  return JSON.stringify(generateDiscoveryDocument(), null, 2)
}

// =============================================================================
// NEXT.JS API ROUTE HANDLER
// =============================================================================

/**
 * Example Next.js API route handler for /.well-known/x402
 *
 * Usage in Next.js:
 * ```typescript
 * // app/.well-known/x402/route.ts
 * import { createX402DiscoveryHandler } from '@/modules/news/x402-discovery';
 * export const GET = createX402DiscoveryHandler();
 * ```
 */
export function createX402DiscoveryHandler() {
  return async function GET() {
    const document = generateDiscoveryDocument()

    return new Response(JSON.stringify(document), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
        "Access-Control-Allow-Origin": "*",
      },
    })
  }
}

// =============================================================================
// EXPRESS MIDDLEWARE
// =============================================================================

/**
 * Express middleware for /.well-known/x402
 *
 * Usage:
 * ```typescript
 * import express from 'express';
 * import { x402DiscoveryMiddleware } from '@/modules/news/x402-discovery';
 *
 * const app = express();
 * app.use('/.well-known/x402', x402DiscoveryMiddleware);
 * ```
 */
export function x402DiscoveryMiddleware(
  _req: unknown,
  res: { json: (data: unknown) => void; setHeader: (name: string, value: string) => void }
) {
  res.setHeader("Cache-Control", "public, max-age=3600")
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.json(generateDiscoveryDocument())
}

// =============================================================================
// RESOURCE VALIDATION
// =============================================================================

/**
 * Validate a resource against x402scan V2 schema
 */
export function validateResource(resource: X402Response): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (resource.x402Version !== 2) {
    errors.push("x402Version must be 2")
  }

  if (resource.accepts) {
    for (const accept of resource.accepts) {
      if (accept.scheme !== "exact") {
        errors.push(`Invalid scheme: ${accept.scheme}. Must be "exact"`)
      }
      if (!accept.network.match(/^eip155:\d+$|^solana:/)) {
        errors.push(`Invalid network format: ${accept.network}. Must be CAIP-2 format`)
      }
      if (!accept.extra || typeof accept.extra !== "object") {
        errors.push("extra field is required in V2 schema")
      }
    }
  }

  if (resource.resource) {
    if (!resource.resource.url) {
      errors.push("resource.url is required")
    }
    if (!resource.resource.mimeType) {
      errors.push("resource.mimeType is required")
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validate all resources in discovery document
 */
export function validateDiscoveryDocument(): { valid: boolean; errors: Record<string, string[]> } {
  const errors: Record<string, string[]> = {}

  for (const resource of PREMIUM_NEWS_RESOURCES) {
    const result = validateResource(resource)
    if (!result.valid && resource.resource?.url) {
      errors[resource.resource.url] = result.errors
    }
  }

  return { valid: Object.keys(errors).length === 0, errors }
}
