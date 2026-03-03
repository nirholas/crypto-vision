/**
 * Tool Marketplace Discovery Module
 * @description Exports all discovery and recommendation engine components
 * @author nirholas
 * @license Apache-2.0
 */

// Types
export * from "./types.js"

// Search engines
export { FullTextSearchEngine, fullTextSearch } from "./search.js"
export { SemanticSearchEngine, semanticSearch } from "./semantic.js"

// Filter engine
export { FilterEngine, filterEngine } from "./filters.js"

// Recommendation engine
export { RecommendationEngine, recommendationEngine } from "./recommendations.js"

// Trending engine
export { TrendingEngine, trendingEngine } from "./trending.js"

// Bundle manager
export { BundleManager, bundleManager, BUNDLE_TEMPLATES } from "./bundles.js"

// UI formatters
export { UIFormatter, formatToolCard, formatComparison, formatSearchResults } from "./ui.js"

// Analytics
export { SearchAnalytics, searchAnalytics } from "./analytics.js"

// MCP tools
export { registerDiscoveryTools } from "./tools.js"

/**
 * Initialize all discovery engines with tools
 */
export async function initializeDiscovery(tools: import("../types.js").RegisteredTool[]): Promise<void> {
  const { fullTextSearch } = await import("./search.js")
  const { semanticSearch } = await import("./semantic.js")
  const { recommendationEngine } = await import("./recommendations.js")
  const { trendingEngine } = await import("./trending.js")
  const { bundleManager } = await import("./bundles.js")

  await fullTextSearch.indexTools(tools)
  
  // Semantic search initialization is optional (requires API key)
  if (semanticSearch.ready) {
    await semanticSearch.indexTools(tools)
  }

  recommendationEngine.loadTools(tools)
  trendingEngine.loadTools(tools)
  bundleManager.loadTools(tools)
}

/**
 * Discovery module configuration
 */
export interface DiscoveryConfig {
  /** OpenAI API key for semantic search */
  openaiApiKey?: string
  /** Enable semantic search */
  enableSemantic?: boolean
  /** Full-text search configuration */
  searchConfig?: {
    fuzzy?: boolean
    fuzzyDistance?: number
    stemming?: boolean
  }
  /** Analytics configuration */
  analyticsConfig?: {
    maxRecords?: number
    retentionDays?: number
  }
}

/**
 * Configure discovery module
 */
export function configureDiscovery(config: DiscoveryConfig): void {
  const { fullTextSearch } = require("./search.js")
  const { semanticSearch } = require("./semantic.js")
  const { searchAnalytics } = require("./analytics.js")

  // Configure semantic search
  if (config.openaiApiKey && config.enableSemantic !== false) {
    semanticSearch.initialize(config.openaiApiKey)
  }

  // Configure full-text search
  if (config.searchConfig) {
    fullTextSearch.updateConfig({
      defaultFuzzy: config.searchConfig.fuzzy,
      defaultFuzzyDistance: config.searchConfig.fuzzyDistance,
      defaultStemming: config.searchConfig.stemming,
    })
  }

  // Analytics configuration is set at construction time
  // Would need to recreate instance for different config
}
