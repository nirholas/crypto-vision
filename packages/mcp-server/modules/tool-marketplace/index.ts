/**
 * Tool Marketplace Module
 * @description Decentralized marketplace for paid AI tools using x402 payments
 * @author nirholas
 * @license Apache-2.0
 * 
 * This module provides:
 * - Tool registration with pricing and revenue splits
 * - Tool discovery with filters (price, category, rating)
 * - Usage tracking and analytics
 * - Creator earnings dashboard
 * - Subscription management
 * 
 * @example
 * ```typescript
 * import { registerToolMarketplace } from "@/modules/tool-marketplace"
 * 
 * // Register with MCP server
 * registerToolMarketplace(server)
 * 
 * // Or use the registry directly
 * import { toolRegistry } from "@/modules/tool-marketplace"
 * 
 * const tool = await toolRegistry.registerTool({
 *   name: "weather-premium",
 *   displayName: "Premium Weather API",
 *   description: "Real-time weather with hourly forecasts",
 *   endpoint: "https://weather.example.com/api",
 *   category: "data",
 *   pricing: {
 *     model: "per-call",
 *     basePrice: "0.001",
 *     acceptedTokens: ["USDs"],
 *     supportedChains: ["arbitrum"],
 *   },
 *   owner: "0x...",
 *   revenueSplit: [
 *     { address: "0x...", percent: 80, label: "creator" },
 *     { address: "0x...", percent: 20, label: "platform" },
 *   ],
 * })
 * ```
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { registerToolMarketplaceTools } from "./tools.js"
import { registerToolMarketplacePrompts } from "./prompts.js"
import { registerAccessControlTools } from "./access/tools.js"
import { registerDiscoveryTools } from "./discovery/tools.js"
import { registerAnalyticsMCPTools } from "./analytics/tools.js"
import { workerManager } from "./workers.js"
import Logger from "@/utils/logger.js"

// Export types
export type {
  RevenueSplit,
  PricingModel,
  SubscriptionTier,
  TieredPricing,
  ToolPricing,
  ToolCategory,
  ToolStatus,
  ToolMetadata,
  RegisterToolInput,
  RegisteredTool,
  ToolDiscoveryFilter,
  ToolUsageRecord,
  ToolRevenue,
  CreatorAnalytics,
  SubscriptionStatus,
  MarketplaceStats,
  MarketplaceEventType,
  MarketplaceEvent,
  PayoutConfig,
} from "./types.js"

// Export registry
export { toolRegistry, ToolRegistryService } from "./registry.js"

// Export client
export {
  MarketplaceClient,
  createMarketplaceClient,
  type CallToolOptions,
  type CallToolResult,
} from "./client.js"

// Export revenue splitter
export {
  revenueSplitter,
  RevenueSplitterService,
  type PayoutRecord,
  type PendingPayout,
  type RevenueDistribution,
} from "./revenue.js"

// Export on-chain registry integration
export {
  OnChainRegistry,
  createOnChainRegistry,
  getContractAddresses,
  isTestnet,
  getChainName,
  TOOL_REGISTRY_ABI,
  REVENUE_ROUTER_ABI,
  TOOL_STAKING_ABI,
  type ChainId,
  type ContractAddresses,
  type OnChainTool,
  type RevenueSplit as OnChainRevenueSplit,
  type StakeInfo,
  type RegisterToolParams,
  type ToolRegistryEvents,
} from "./contracts/index.js"

// Export access control module
export {
  // Key Manager
  KeyManager,
  keyManager,
  // Rate Limiter
  RateLimiter,
  rateLimiter,
  GLOBAL_RATE_LIMITS,
  // Quota Manager
  QuotaManager,
  quotaManager,
  DEFAULT_QUOTA_CONFIG,
  // Tiers
  DEFAULT_TIERS,
  getTier,
  getAllTiers,
  isValidTierName,
  // Access Lists
  AccessListManager,
  accessListManager,
  StrikeManager,
  strikeManager,
  // Subscriptions
  SubscriptionManager,
  subscriptionManager,
  SubscriptionRenewalScheduler,
  // Storage
  InMemoryStorageAdapter,
  defaultStorage,
  // Tools registration
  registerAccessControlTools,
  // Types
  type APIKey,
  type APIKeyWithSecret,
  type KeyValidationResult,
  type Permission,
  type PermissionScope,
  type RateLimit,
  type RatePeriod,
  type RateLimitStatus,
  type AccessTier,
  type AccessTierName,
  type QuotaConfig,
  type QuotaStatus,
  type Subscription,
  type SubscriptionState,
  type AllowlistEntry,
  type BlocklistEntry,
  type GeoRestriction,
  type AccessStorageAdapter,
} from "./access/index.js"

// Export middleware
export {
  createExpressMiddleware,
  fastifyMarketplaceAuth,
  authenticateRequest,
  extractApiKey,
  createKeyValidator,
  type MarketplaceAuthOptions,
  type AuthResult,
  type AuthError,
  type MarketplaceRequest,
  type MiddlewareResult,
} from "./middleware/index.js"

// ============================================================================
// Trust & Verification Exports
// ============================================================================

// Verification services
export {
  endpointVerifier,
  EndpointVerifier,
  type EndpointVerifierConfig,
} from "./verification/endpoint-verifier.js"

export {
  schemaValidator,
  SchemaValidator,
} from "./verification/schema-validator.js"

export {
  securityScanner,
  SecurityScanner,
  type SecurityScannerConfig,
} from "./verification/security-scanner.js"

// Verification types
export type {
  VerificationStatus,
  EndpointHealthStatus,
  SSLCertificateInfo,
  EndpointCheckResult,
  UptimeRecord,
  SchemaValidationResult,
  SchemaError,
  SchemaWarning,
  ToolSchema,
  SecuritySeverity,
  SecurityFinding,
  SecurityScanResult,
  DomainInfo,
  CORSPolicy,
  RedirectInfo,
  VerificationRecord,
  VerificationHistoryEntry,
  VerificationBadge,
  ToolBadges,
  VerificationRequest,
  VerificationJob,
  VerificationWebhook,
  VerificationEventType,
} from "./verification/types.js"

// ============================================================================
// Reputation System Exports
// ============================================================================

export {
  ratingService,
  RatingService,
  type RatingServiceConfig,
} from "./reputation/rating.js"

export {
  reputationScorer,
  ReputationScorer,
  type ReputationScorerConfig,
} from "./reputation/score.js"

// Reputation types
export type {
  TrustTier,
  RatingValue,
  Rating,
  RatingSummary,
  ReputationScoreBreakdown,
  ReputationScore,
  BadgeType,
  ReputationBadge,
  RatingRateLimit,
  RatingReport,
  ToolReport,
  ReputationHistoryEntry,
  LeaderboardEntry,
} from "./reputation/types.js"

// ============================================================================
// Dispute Resolution Exports
// ============================================================================

export {
  disputeManager,
  DisputeManager,
  type DisputeManagerConfig,
} from "./disputes/manager.js"

export {
  autoResolver,
  AutoResolver,
  type AutoResolverConfig,
} from "./disputes/auto-resolver.js"

export {
  arbitrationDAO,
  ArbitrationDAO,
  type ArbitrationConfig,
} from "./disputes/arbitration.js"

// Dispute types
export type {
  DisputeState,
  DisputeOutcome,
  EvidenceType,
  DisputeEvidence,
  Dispute,
  DisputeReason,
  EscalationDetails,
  CreateDisputeInput,
  DisputeFilter,
  AutoResolutionRule,
  ArbitrationVote,
  ArbitrationCase,
  Arbitrator,
  DisputeStats,
  UserDisputeLimits,
} from "./disputes/types.js"

// ============================================================================
// Background Workers
// ============================================================================

export {
  workerManager,
  VerificationWorkerManager,
  type WorkerConfig,
} from "./workers.js"

// ============================================================================
// Analytics & Insights Module
// ============================================================================

// Time Series Database
export {
  TimeSeriesDB,
  timeseriesDB,
  type Granularity,
  type RetentionPolicy,
  type DataPoint,
  type AggregatedDataPoint,
  type TimeSeriesQueryOptions,
  type MetricDefinition,
} from "./analytics/timeseries.js"

// Metrics Collector
export {
  MetricsCollectorService,
  metricsCollector,
  METRIC_NAMES,
  type GeoData,
  type CallMetrics,
  type RevenueMetrics,
  type ResponseTimeMetrics,
  type UserMetrics,
  type GeoDistribution,
} from "./analytics/collector.js"

// Anomaly Detection
export {
  AnomalyDetectorService,
  anomalyDetector,
  type AnomalySeverity,
  type AnomalyType,
  type Anomaly,
  type AlertConfig,
  type BotDetectionResult,
  type AbusePatternResult,
} from "./analytics/anomaly.js"

// Platform Analytics
export {
  PlatformAnalyticsService,
  platformAnalytics,
  type GrowthMetrics,
  type ConversionFunnel,
  type CategoryRevenue,
  type PlatformHealth,
  type PlatformAnalyticsOverview,
} from "./analytics/platform.js"

// Predictive Analytics
export {
  PredictiveAnalyticsService,
  predictiveAnalytics,
  type RevenueForecast,
  type ChurnPrediction,
  type DemandPrediction,
  type PricingOptimization,
} from "./analytics/predictions.js"

// Export & Reporting
export {
  ExportReportingService,
  exportReporting,
  type ExportFormat,
  type ScheduledReportConfig,
  type WebhookConfig,
  type WebhookEventType,
  type WebhookEvent,
} from "./analytics/exports.js"

// Analytics MCP Tools
export { registerAnalyticsMCPTools } from "./analytics/tools.js"

// Dashboard Components
export {
  CreatorInsightsService,
  creatorInsights,
  type CreatorDashboard,
  type ToolInsights,
  type UsageHeatmap,
} from "./dashboard/creator.js"

export {
  CompetitorAnalysisService,
  competitorAnalysis,
  type CompetitorAnalysisReport,
  type PriceBenchmark,
  type MarketShare,
  type CompetitorSummary,
  type FeatureGap,
  type FeatureComparison,
} from "./dashboard/competitor.js"

// ============================================================================
// Discovery & Recommendations Exports
// ============================================================================

export {
  // Search engines
  fullTextSearch,
  FullTextSearchEngine,
  semanticSearch,
  SemanticSearchEngine,
  // Filter engine
  filterEngine,
  FilterEngine,
  // Recommendation engine
  recommendationEngine,
  RecommendationEngine,
  // Trending engine
  trendingEngine,
  TrendingEngine,
  // Bundle manager
  bundleManager,
  BundleManager,
  BUNDLE_TEMPLATES,
  // UI formatters
  UIFormatter,
  formatToolCard,
  formatComparison,
  formatSearchResults,
  // Analytics
  searchAnalytics,
  SearchAnalytics,
  // Tools registration
  registerDiscoveryTools,
  // Initialization
  initializeDiscovery,
  configureDiscovery,
} from "./discovery/index.js"

// Discovery types
export type {
  // Search types
  SearchResult,
  FullTextSearchOptions,
  SemanticSearchOptions,
  SearchResponse,
  SearchConfig,
  SynonymMap,
  ToolEmbedding,
  // Filter types
  PriceRangeFilter,
  FilterOperator,
  FilterCondition,
  CombinedFilter,
  AdvancedFilterOptions,
  // Recommendation types
  UserProfile,
  RecommendedTool,
  CoUsagePattern,
  ContentSimilarity,
  // Trending types
  TrendingPeriod,
  TrendingTool,
  HotTool,
  NewTool,
  RisingStarTool,
  FeaturedTool,
  // Bundle types
  ToolBundle,
  BundleSubscription,
  CreateBundleInput,
  // Analytics types
  SearchQueryRecord,
  ClickRecord,
  ConversionRecord,
  ZeroResultQuery,
  SearchAnalyticsSummary,
  // Comparison types
  ToolComparison,
  ToolAlternative,
} from "./discovery/types.js"

/**
 * Register tool marketplace module with the MCP server
 * Provides tools for discovering, registering, and using paid AI tools
 */
export function registerToolMarketplace(server: McpServer): void {
  registerToolMarketplaceTools(server)
  registerToolMarketplacePrompts(server)
  registerAccessControlTools(server)
  registerAnalyticsMCPTools(server)
  registerDiscoveryTools(server)
  Logger.info("Tool Marketplace module registered (with access control, trust system, analytics & discovery)")
}

/**
 * Start the trust & verification background workers
 * Should be called once when the server starts
 */
export function startVerificationWorkers(): void {
  workerManager.start()
  Logger.info("Verification workers started")
}

/**
 * Stop the trust & verification background workers
 * Should be called when the server shuts down
 */
export function stopVerificationWorkers(): void {
  workerManager.stop()
  Logger.info("Verification workers stopped")
}

// EOF - nirholas | ucm:n1ch-marketplace
