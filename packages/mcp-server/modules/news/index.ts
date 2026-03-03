/**
 * Crypto News Module
 * @description Free and premium crypto news features with x402 payment support
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 *
 * Free Features:
 * - Latest news from 7 major sources
 * - Keyword search
 * - DeFi, Bitcoin, and breaking news filters
 *
 * Premium Features (x402 micropayments):
 * - Real-time Firehose: $0.10/day
 * - AI Summaries: $0.001/summary
 * - Breaking Alerts: $0.05/day
 * - Historical Search: $0.01/query
 * - Custom Feeds: $0.50/month
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerNewsPrompts } from "./prompts.js"
import { registerNewsTools } from "./tools.js"
import { registerPremiumNewsTools, PREMIUM_PRICING, REVENUE_SPLIT } from "./premium-tools.js"
import { registerPremiumNewsPrompts } from "./premium-prompts.js"

// Re-export client SDK
export { createNewsClient, NewsClient } from "./client.js"
export type {
  NewsClientConfig,
  NewsArticle,
  NewsResponse,
  ArticleSummary,
  FirehoseSubscription,
  AlertConfig,
  AlertSubscription,
  CustomFeedConfig,
  CustomFeed,
  HistoricalSearchOptions,
  HistoricalSearchResult,
  PremiumStatus,
} from "./client.js"

// Re-export x402scan discovery
export {
  generateDiscoveryDocument,
  getDiscoveryDocumentJSON,
  createX402DiscoveryHandler,
  x402DiscoveryMiddleware,
  validateResource,
  validateDiscoveryDocument,
  PREMIUM_NEWS_RESOURCES,
} from "./x402-discovery.js"
export type {
  X402Accepts,
  X402Resource,
  X402Response,
  X402DiscoveryDocument,
  BazaarExtension,
} from "./x402-discovery.js"

// Re-export premium pricing
export { PREMIUM_PRICING, REVENUE_SPLIT }

/**
 * Register all news features (free + premium) with MCP server
 */
export function registerNews(server: McpServer) {
  // Free features
  registerNewsTools(server)
  registerNewsPrompts(server)

  // Premium features (x402-enabled)
  registerPremiumNewsTools(server)
  registerPremiumNewsPrompts(server)
}

/**
 * Register only free news features (no x402 dependency)
 */
export function registerFreeNewsOnly(server: McpServer) {
  registerNewsTools(server)
  registerNewsPrompts(server)
}
