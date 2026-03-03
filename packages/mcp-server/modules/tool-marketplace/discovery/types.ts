/**
 * Tool Discovery & Recommendations Types
 * @description Type definitions for the discovery and recommendation engine
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import type { RegisteredTool, ToolCategory, ToolStatus } from "../types.js"

// ============================================================================
// Search Types
// ============================================================================

/**
 * Search result item with match metadata
 */
export interface SearchResult {
  /** The matched tool */
  tool: RegisteredTool
  /** Match score (0-1) */
  score: number
  /** Reasons for the match */
  matchReasons: string[]
  /** Highlighted snippets */
  highlights?: {
    field: string
    snippet: string
  }[]
}

/**
 * Full-text search options
 */
export interface FullTextSearchOptions {
  /** Search query */
  query: string
  /** Enable fuzzy matching */
  fuzzy?: boolean
  /** Fuzzy distance (default: 2) */
  fuzzyDistance?: number
  /** Enable stemming */
  stemming?: boolean
  /** Fields to search */
  fields?: ("name" | "displayName" | "description" | "tags")[]
  /** Field boosts */
  boosts?: {
    name?: number
    displayName?: number
    description?: number
    tags?: number
  }
  /** Maximum results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Semantic search options
 */
export interface SemanticSearchOptions {
  /** Natural language query */
  query: string
  /** Find tools similar to this tool ID */
  similarTo?: string
  /** Minimum similarity score (0-1) */
  minSimilarity?: number
  /** Maximum results */
  limit?: number
  /** Offset for pagination */
  offset?: number
}

/**
 * Combined search response
 */
export interface SearchResponse {
  /** Original query */
  query: string
  /** Search results */
  results: SearchResult[]
  /** Total matching results (before pagination) */
  totalResults: number
  /** Current page */
  page: number
  /** Page size */
  pageSize: number
  /** Search suggestions */
  suggestions: string[]
  /** Related categories */
  relatedCategories: ToolCategory[]
  /** Search took (ms) */
  searchTimeMs: number
  /** Search type used */
  searchType: "fulltext" | "semantic" | "hybrid"
}

// ============================================================================
// Filter Types
// ============================================================================

/**
 * Price range filter
 */
export interface PriceRangeFilter {
  /** Minimum price */
  min?: string
  /** Maximum price */
  max?: string
}

/**
 * Filter operators for combining conditions
 */
export type FilterOperator = "AND" | "OR"

/**
 * Filter condition
 */
export interface FilterCondition {
  /** Field to filter on */
  field: string
  /** Operator */
  operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte" | "in" | "contains"
  /** Value to compare */
  value: unknown
}

/**
 * Combined filter configuration
 */
export interface CombinedFilter {
  /** Logical operator for combining conditions */
  operator: FilterOperator
  /** Individual filter conditions */
  conditions: FilterCondition[]
  /** Nested filter groups */
  groups?: CombinedFilter[]
}

/**
 * Advanced filter options
 */
export interface AdvancedFilterOptions {
  /** Price range */
  priceRange?: PriceRangeFilter
  /** Categories to include */
  categories?: ToolCategory[]
  /** Minimum rating */
  minRating?: number
  /** Maximum rating */
  maxRating?: number
  /** Supported chains */
  chains?: string[]
  /** Verification status */
  verified?: boolean
  /** Tool status */
  status?: ToolStatus[]
  /** Maximum response time in ms */
  maxResponseTime?: number
  /** Minimum uptime percentage */
  minUptime?: number
  /** Tags to match */
  tags?: string[]
  /** Tag match mode */
  tagMatchMode?: "any" | "all"
  /** Pricing models */
  pricingModels?: string[]
  /** Owner address */
  owner?: Address
  /** Registration date range */
  registeredAfter?: number
  registeredBefore?: number
  /** Combined filter logic */
  customFilter?: CombinedFilter
}

// ============================================================================
// Recommendation Types
// ============================================================================

/**
 * User profile for personalized recommendations
 */
export interface UserProfile {
  /** User wallet address */
  address: Address
  /** Previously used tool IDs */
  usedTools: string[]
  /** Category preferences (category -> usage count) */
  categories: Record<string, number>
  /** Average spend per call in USD */
  avgSpendPerCall: string
  /** Preferred blockchain networks */
  preferredChains: string[]
  /** Tags the user frequently interacts with */
  preferredTags?: string[]
  /** Price sensitivity (0-1, 1 = very price sensitive) */
  priceSensitivity?: number
  /** Last active timestamp */
  lastActiveAt?: number
}

/**
 * Recommended tool with recommendation metadata
 */
export interface RecommendedTool {
  /** The recommended tool */
  tool: RegisteredTool
  /** Recommendation score (0-1) */
  score: number
  /** Recommendation reasons */
  reasons: string[]
  /** Recommendation type */
  type: "collaborative" | "content-based" | "personalized" | "trending" | "featured"
}

/**
 * Co-usage pattern for collaborative filtering
 */
export interface CoUsagePattern {
  /** Tool ID A */
  toolIdA: string
  /** Tool ID B */
  toolIdB: string
  /** Number of users who used both */
  coUsageCount: number
  /** Recency-weighted score */
  recencyScore: number
  /** Confidence score */
  confidence: number
}

/**
 * Content similarity data
 */
export interface ContentSimilarity {
  /** Tool ID A */
  toolIdA: string
  /** Tool ID B */
  toolIdB: string
  /** Description similarity (0-1) */
  descriptionSimilarity: number
  /** Tag overlap percentage */
  tagOverlap: number
  /** Category match */
  sameCategory: boolean
  /** Price tier match */
  samePriceTier: boolean
  /** Overall similarity score */
  overallSimilarity: number
}

// ============================================================================
// Trending Types
// ============================================================================

/**
 * Trending period
 */
export type TrendingPeriod = "1h" | "24h" | "7d" | "30d"

/**
 * Trending tool data
 */
export interface TrendingTool {
  /** The tool */
  tool: RegisteredTool
  /** Trending score */
  score: number
  /** Growth percentage */
  growthPercent: number
  /** Calls in the period */
  callsInPeriod: number
  /** Revenue in the period */
  revenueInPeriod: string
  /** Trend direction */
  trend: "up" | "down" | "stable"
  /** Rank in trending list */
  rank: number
}

/**
 * Hot tool (most active in short period)
 */
export interface HotTool {
  /** The tool */
  tool: RegisteredTool
  /** Calls in last 24 hours */
  calls24h: number
  /** Active users in last 24 hours */
  activeUsers24h: number
  /** Hotness score */
  hotnessScore: number
}

/**
 * New tool (recently registered)
 */
export interface NewTool {
  /** The tool */
  tool: RegisteredTool
  /** Registration date */
  registeredAt: number
  /** Is verified */
  isVerified: boolean
  /** Initial traction metrics */
  initialCalls: number
  /** Initial rating */
  initialRating: number
}

/**
 * Rising star (underrated high-quality tools)
 */
export interface RisingStarTool {
  /** The tool */
  tool: RegisteredTool
  /** Rating */
  rating: number
  /** Rating count */
  ratingCount: number
  /** Total calls (relatively low) */
  totalCalls: number
  /** Potential score */
  potentialScore: number
  /** Why it's a rising star */
  reasons: string[]
}

/**
 * Featured tool (curated by platform)
 */
export interface FeaturedTool {
  /** The tool */
  tool: RegisteredTool
  /** Featured reason */
  reason: string
  /** Featured period start */
  featuredFrom: number
  /** Featured period end */
  featuredUntil: number
  /** Stake amount (if staked for featuring) */
  stakeAmount?: string
  /** Editor's pick */
  editorsPick?: boolean
}

// ============================================================================
// Bundle Types
// ============================================================================

/**
 * Tool bundle
 */
export interface ToolBundle {
  /** Bundle ID */
  bundleId: string
  /** Bundle name */
  name: string
  /** Bundle description */
  description: string
  /** Bundle category */
  category: string
  /** Tools in the bundle */
  tools: RegisteredTool[]
  /** Tool IDs in the bundle */
  toolIds: string[]
  /** Individual prices total */
  individualPriceTotal: string
  /** Bundle price */
  bundlePrice: string
  /** Discount percentage */
  discountPercent: number
  /** Savings amount */
  savings: string
  /** Bundle creator address */
  creatorAddress: Address
  /** Is curated by platform */
  isCurated: boolean
  /** Bundle tags */
  tags: string[]
  /** Total subscribers */
  subscribers: number
  /** Average bundle rating */
  rating: number
  /** Created timestamp */
  createdAt: number
}

/**
 * Bundle subscription
 */
export interface BundleSubscription {
  /** Subscription ID */
  subscriptionId: string
  /** Bundle ID */
  bundleId: string
  /** User address */
  userAddress: Address
  /** Start date */
  startDate: number
  /** End date */
  endDate: number
  /** Monthly price */
  monthlyPrice: string
  /** Auto-renew enabled */
  autoRenew: boolean
  /** Status */
  status: "active" | "cancelled" | "expired"
}

/**
 * Bundle creation input
 */
export interface CreateBundleInput {
  /** Bundle name */
  name: string
  /** Bundle description */
  description: string
  /** Category */
  category: string
  /** Tool IDs to include */
  toolIds: string[]
  /** Discount percentage */
  discountPercent: number
  /** Creator address */
  creatorAddress: Address
  /** Tags */
  tags?: string[]
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Search query record
 */
export interface SearchQueryRecord {
  /** Query ID */
  queryId: string
  /** Search query */
  query: string
  /** Query hash (for anonymization) */
  queryHash: string
  /** Timestamp */
  timestamp: number
  /** User address hash (anonymized) */
  userHash?: string
  /** Results count */
  resultsCount: number
  /** Search type */
  searchType: "fulltext" | "semantic" | "hybrid"
  /** Filters applied */
  filtersApplied: string[]
  /** Search time in ms */
  searchTimeMs: number
}

/**
 * Click record
 */
export interface ClickRecord {
  /** Click ID */
  clickId: string
  /** Query ID that led to this click */
  queryId: string
  /** Tool ID clicked */
  toolId: string
  /** Position in results */
  position: number
  /** Timestamp */
  timestamp: number
}

/**
 * Conversion record (search -> tool usage)
 */
export interface ConversionRecord {
  /** Conversion ID */
  conversionId: string
  /** Query ID */
  queryId: string
  /** Click ID */
  clickId: string
  /** Tool ID */
  toolId: string
  /** Timestamp */
  timestamp: number
  /** Amount spent */
  amountSpent: string
}

/**
 * Zero result query
 */
export interface ZeroResultQuery {
  /** Query */
  query: string
  /** Count of times searched */
  count: number
  /** First searched */
  firstSearchedAt: number
  /** Last searched */
  lastSearchedAt: number
  /** Suggested alternatives */
  suggestedAlternatives?: string[]
}

/**
 * Search analytics summary
 */
export interface SearchAnalyticsSummary {
  /** Time period */
  period: "1h" | "24h" | "7d" | "30d"
  /** Total searches */
  totalSearches: number
  /** Unique queries */
  uniqueQueries: number
  /** Zero result rate */
  zeroResultRate: number
  /** Average results per search */
  avgResultsPerSearch: number
  /** Click-through rate */
  clickThroughRate: number
  /** Conversion rate */
  conversionRate: number
  /** Top queries */
  topQueries: { query: string; count: number }[]
  /** Top zero-result queries */
  topZeroResultQueries: ZeroResultQuery[]
  /** Popular categories searched */
  popularCategories: { category: string; count: number }[]
  /** Average search time */
  avgSearchTimeMs: number
}

// ============================================================================
// Embedding Types
// ============================================================================

/**
 * Tool embedding for semantic search
 */
export interface ToolEmbedding {
  /** Tool ID */
  toolId: string
  /** Embedding vector */
  embedding: number[]
  /** Text that was embedded */
  embeddedText: string
  /** Embedding model used */
  model: string
  /** Created timestamp */
  createdAt: number
  /** Last updated timestamp */
  updatedAt: number
}

/**
 * Synonym mapping
 */
export interface SynonymMap {
  /** Primary term */
  term: string
  /** Synonyms */
  synonyms: string[]
}

/**
 * Search configuration
 */
export interface SearchConfig {
  /** Enable fuzzy matching by default */
  defaultFuzzy: boolean
  /** Default fuzzy distance */
  defaultFuzzyDistance: number
  /** Enable stemming by default */
  defaultStemming: boolean
  /** Default field boosts */
  defaultBoosts: {
    name: number
    displayName: number
    description: number
    tags: number
  }
  /** Synonym mappings */
  synonyms: SynonymMap[]
  /** Stop words to ignore */
  stopWords: string[]
  /** Minimum query length */
  minQueryLength: number
  /** Maximum results */
  maxResults: number
  /** Embedding model to use */
  embeddingModel: string
  /** Minimum semantic similarity */
  minSemanticSimilarity: number
}

// ============================================================================
// Comparison Types
// ============================================================================

/**
 * Tool comparison result
 */
export interface ToolComparison {
  /** Tools being compared */
  tools: RegisteredTool[]
  /** Comparison metrics */
  metrics: {
    category: string
    values: Record<string, string | number | boolean>
  }[]
  /** Winner by metric */
  winners: Record<string, string>
  /** Overall recommendation */
  recommendation?: {
    toolId: string
    reason: string
  }
}

/**
 * Tool alternative
 */
export interface ToolAlternative {
  /** Alternative tool */
  tool: RegisteredTool
  /** Comparison to original */
  comparison: {
    priceDifference: string
    priceDifferencePercent: number
    ratingDifference: number
    featureOverlap: number
  }
  /** Why it's an alternative */
  reasons: string[]
  /** Alternative type */
  type: "cheaper" | "better-rated" | "more-features" | "similar"
}
