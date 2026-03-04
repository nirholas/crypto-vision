/**
 * Intelligence Layer — barrel exports
 */

// Strategy Brain
export { StrategyBrain, DEFAULT_STRATEGY_BRAIN_CONFIG } from './strategy-brain.js';
export type {
  StrategyBrainConfig,
  MarketContext,
  StrategyDecision,
  TokenAssessment,
  LaunchDecision,
  BuyDecision,
  SwarmMetricsInput,
  PerformanceMetrics,
} from './strategy-brain.js';

// Signal Generator
export { SignalGenerator } from './signal-generator.js';
export type {
  CurveSnapshot,
  MomentumSignal,
  VolumeSignal,
  PriceVelocitySignal,
  RSISignal,
  MACDSignal,
  BollingerBandsSignal,
  VWAPSignal,
  OBVSignal,
  WhaleSignal,
  GraduationSignal,
  TradingSignals,
  SignalSnapshot,
  SignalConfig,
  SignalAccuracyRecord,
  SignalAccuracyStats,
} from './signal-generator.js';

// Risk Manager
export { RiskManager } from './risk-manager.js';
export type {
  RiskLimits,
  ProposedTradeAction,
  RiskAssessment,
  RiskViolation,
  Position,
  PortfolioRiskReport,
  DrawdownInfo as RiskDrawdownInfo,
  CircuitBreakerStatus,
  StopLossAction,
  RiskMetrics,
  CorrelationRisk,
  LiquidityRisk,
  TimeRisk,
  RiskBreakdown,
} from './risk-manager.js';

// Sentiment Analyzer
export { SentimentAnalyzer } from './sentiment-analyzer.js';
export type {
  SentimentLabel,
  SentimentConfig,
  SourceSentiment,
  TrendsData,
  SentimentScore,
  SentimentReport,
  TokenSentiment,
  TrendingNarrative,
  AISentimentResult,
} from './sentiment-analyzer.js';

// Trend Detector
export { TrendDetector } from './trend-detector.js';
export type {
  TrendConfig,
  MarketTrends,
  CategoryTrend as TrendCategoryTrend,
  LaunchTimingAssessment,
  ActivityMetrics,
} from './trend-detector.js';

// Token Evaluator
export { TokenEvaluator } from './token-evaluator.js';
export type {
  EvaluatorConfig,
  CriterionScore,
  TokenRawData,
  TokenEvaluation,
  TokenComparison,
} from './token-evaluator.js';

// Narrative Generator
export { NarrativeGenerator } from './narrative-generator.js';
export type {
  NarrativeGeneratorConfig,
  NarrativeConstraints,
  GeneratorTokenNarrative,
  ViralityFactors,
  RankedNarrative,
  CategoryTrend,
} from './narrative-generator.js';

// Portfolio Optimizer
export { PortfolioOptimizer, sum } from './portfolio-optimizer.js';
export type {
  PortfolioOptimizerConfig,
  PricePoint,
  TokenHolding,
  PortfolioAllocation,
  PortfolioState,
  RebalanceAction,
  EfficientFrontierPoint,
  PortfolioMetrics,
} from './portfolio-optimizer.js';

// Market Regime Classifier
export { MarketRegime } from './market-regime.js';
export type {
  RegimeConfig,
  RegimeLabel,
  RegimeFactor,
  StrategyAdjustment,
  RegimeClassification,
  RegimeEntry,
  RegimeDataSources,
} from './market-regime.js';

// Alpha Scanner
export { AlphaScanner } from './alpha-scanner.js';
export type {
  AlphaScannerConfig,
  AlphaCategory,
  AlphaUrgency,
  AlphaRisk,
  AlphaOpportunity,
  ScanResult,
} from './alpha-scanner.js';
