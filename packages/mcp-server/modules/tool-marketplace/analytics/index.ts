/**
 * Analytics Module Index
 * @description Exports all analytics components for the tool marketplace
 * @author nirholas
 * @license Apache-2.0
 */

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
} from "./timeseries.js"

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
} from "./collector.js"

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
} from "./anomaly.js"

// Platform Analytics
export {
  PlatformAnalyticsService,
  platformAnalytics,
  type GrowthMetrics,
  type ConversionFunnel,
  type CategoryRevenue,
  type PlatformHealth,
  type PlatformAnalyticsOverview,
} from "./platform.js"

// Predictive Analytics
export {
  PredictiveAnalyticsService,
  predictiveAnalytics,
  type RevenueForecast,
  type ChurnPrediction,
  type DemandPrediction,
  type PricingOptimization,
} from "./predictions.js"

// Export & Reporting
export {
  ExportReportingService,
  exportReporting,
  type ExportFormat,
  type ScheduledReportConfig,
  type WebhookConfig,
  type WebhookEventType,
  type WebhookEvent,
} from "./exports.js"

// MCP Tools
export { registerAnalyticsMCPTools } from "./tools.js"
