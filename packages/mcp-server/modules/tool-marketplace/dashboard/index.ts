/**
 * Dashboard Module Index
 * @description Exports all dashboard components for the tool marketplace
 * @author nirholas
 * @license Apache-2.0
 */

// Creator Insights Dashboard
export {
  CreatorInsightsService,
  creatorInsights,
  type ToolPerformance,
  type TimeSeriesData,
  type RetentionCohort,
  type CreatorDashboard,
  type ToolInsights,
  type UsageHeatmap,
} from "./creator.js"

// Competitor Analysis
export {
  CompetitorAnalysisService,
  competitorAnalysis,
  type PriceBenchmark,
  type FeatureComparison,
  type CompetitorSummary,
  type MarketShare,
  type FeatureGap,
  type CompetitorAnalysisReport,
} from "./competitor.js"
