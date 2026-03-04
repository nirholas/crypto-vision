/**
 * @nirholas/pump-agent-swarm
 *
 * Pump.fun agent swarm — creator agents mint tokens,
 * trader agents trade them back and forth on the bonding curve,
 * all coordinated with optional x402-paid analytics.
 *
 * Quick start:
 * ```typescript
 * import { SwarmCoordinator, STRATEGY_ORGANIC } from '@nirholas/pump-agent-swarm';
 * import BN from 'bn.js';
 * import { LAMPORTS_PER_SOL } from '@solana/web3.js';
 *
 * const swarm = new SwarmCoordinator({
 *   rpcUrl: 'https://api.mainnet-beta.solana.com',
 *   traderCount: 3,
 *   token: {
 *     name: 'AI Agent Coin',
 *     symbol: 'AIAC',
 *     metadataUri: 'https://arweave.net/your-metadata.json',
 *   },
 *   bundle: {
 *     devBuyLamports: new BN(0.5 * LAMPORTS_PER_SOL),
 *     bundleWallets: [],
 *     slippageBps: 500,
 *   },
 *   strategy: STRATEGY_ORGANIC,
 *   // Optional: pay for premium analytics via x402
 *   analyticsApiUrl: 'https://api.cryptovision.dev',
 *   x402PrivateKey: process.env.X402_PRIVATE_KEY,
 * });
 *
 * // Listen to events
 * swarm.on('token:created', (result) => console.log('Minted:', result.mint));
 * swarm.on('trade:executed', (result) => console.log('Trade:', result.order.direction));
 * swarm.on('analytics:x402-payment', (amt) => console.log('Paid for analytics:', amt));
 *
 * // Run the full lifecycle
 * const status = await swarm.run();
 * console.log('Final P&L:', status.netPnlSol.toString(), 'lamports');
 * ```
 */

// ─── Main ─────────────────────────────────────────────────────
export { SwarmCoordinator } from './swarm.js';

// ─── Agents ───────────────────────────────────────────────────
export { CreatorAgent } from './agents/creator-agent.js';
export { TraderAgent } from './agents/trader-agent.js';
export { SniperAgent, DEFAULT_SNIPER_CONFIG } from './agents/sniper-agent.js';
export type { SniperConfig } from './agents/sniper-agent.js';
export { AccumulatorAgent } from './agents/accumulator-agent.js';
export type {
  AccumulatorConfig,
  AccumulationStrategy,
  AccumulationProgress,
} from './agents/accumulator-agent.js';
export { NarrativeAgent } from './agents/narrative-agent.js';
export type {
  NarrativeOptions,
  PumpFunMetadata,
  NarrativeEvaluation,
} from './agents/narrative-agent.js';
export { VolumeAgent } from './agents/volume-agent.js';
export type { VolumeConfig, VolumeStats } from './agents/volume-agent.js';
export { SentinelAgent } from './agents/sentinel-agent.js';
export type { SafetyRule, HealthReport, HealthCheck } from './agents/sentinel-agent.js';

// ─── Bundle / Jito ────────────────────────────────────────────
export { JitoClient } from './bundle/jito-client.js';
export type { JitoBundleResult, JitoBundleStatus } from './bundle/jito-client.js';

// ─── Infrastructure ──────────────────────────────────────────
export { RpcPool, DEFAULT_RPC_ENDPOINTS } from './infra/rpc-pool.js';
export { SwarmLogger } from './infra/logger.js';
export { MetricsCollector, Counter, Gauge, Histogram, Rate } from './infra/metrics.js';
export type { MetricSnapshot } from './infra/metrics.js';
export { SwarmErrorHandler, CircuitBreakerOpenError } from './infra/error-handler.js';
export type {
  ErrorSeverity,
  ErrorCategory,
  ClassifiedError,
  RetryOptions,
  CircuitBreakerConfig,
} from './infra/error-handler.js';
export type { LogEntry, LogLevel, LoggerOptions } from './infra/logger.js';

// ─── Trading ──────────────────────────────────────────────────
export { GasOptimizer, DEFAULT_GAS_CONFIG } from './trading/gas-optimizer.js';
export type {
  GasConfig,
  FeeUrgency,
  CongestionLevel,
  FeeDataPoint,
  TransactionCostEstimate,
} from './trading/gas-optimizer.js';

// ─── Analytics (x402) ─────────────────────────────────────────
export { AnalyticsClient } from './analytics/x402-client.js';

// ─── Trading ──────────────────────────────────────────────────
export { VolumeGenerator } from './trading/volume-generator.js';
export type {
  VolumeCurve,
  VolumeGeneratorConfig,
  VolumeBucket,
  VolumePlan,
} from './trading/volume-generator.js';

// ─── Bundle ───────────────────────────────────────────────────
export { DevBuyOptimizer } from './bundle/dev-buy-optimizer.js';
export type {
  PumpFunCurveParams,
  DevBuyParams,
  DevBuyRecommendation,
  DevBuySimulation,
  DevBuyOptimizerConfig,
} from './bundle/dev-buy-optimizer.js';
export { TradeScheduler } from './trading/trade-scheduler.js';
export type {
  ScheduledOrder,
  SchedulerConfig,
  SchedulerStats,
} from './trading/trade-scheduler.js';

// ─── Wallet Management ────────────────────────────────────────
export {
  createAgentWallet,
  restoreAgentWallet,
  generateWalletPool,
  refreshBalances,
  fundTraders,
  reclaimFunds,
  exportWalletKeys,
  getPoolSummary,
  WalletVault,
} from './wallet-manager.js';
export type { WalletVaultEvents } from './wallet-manager.js';

// ─── Wash Trading ─────────────────────────────────────────────
export { WashEngine } from './trading/wash-engine.js';
export type {
  WashEngineConfig,
  CycleResult,
  WashStats,
} from './trading/wash-engine.js';

// ─── Wallet Rotation ─────────────────────────────────────────
export { WalletRotation } from './trading/wallet-rotation.js';
export type { RotationConfig, WalletUsageStats } from './trading/wallet-rotation.js';

// ─── Configuration ────────────────────────────────────────────
export {
  createSwarmConfig,
  loadSwarmConfigFromEnv,
  validateSwarmConfig,
  DEFAULT_SWARM_CONFIG,
  DEFAULT_RPC_CONFIG,
  DEFAULT_WALLET_CONFIG,
  DEFAULT_BUNDLE_CONFIG,
  DEFAULT_INTELLIGENCE_CONFIG,
  DEFAULT_DASHBOARD_CONFIG,
  DEFAULT_ANALYTICS_CONFIG,
  DEFAULT_EMERGENCY_EXIT_CONFIG,
  DEFAULT_AGENT_COUNTS,
} from './config/index.js';
export type { ValidationResult } from './config/index.js';

// ─── Trading ──────────────────────────────────────────────────
export {
  PriceTrajectoryController,
  calculateBuyOutput,
  calculateSellOutput,
  calculateSolForPriceTarget,
  simulatePriceAfterTrade,
} from './trading/price-trajectory.js';
export type {
  TrajectoryCurve,
  PriceTrajectoryPlan,
  PriceCheckpoint,
  TrajectoryProgress,
} from './trading/price-trajectory.js';

// ─── Bundle / Distribution ────────────────────────────────
export { SupplyDistributor } from './bundle/supply-distributor.js';
export type {
  DistributionStrategy,
  DistributionConfig,
  DistributionPlan,
  DistributionResult,
  TokenDistribution,
  DistributionAnalysis,
} from './bundle/supply-distributor.js';

// ─── Position Management ──────────────────────────────────────
export { PositionManager } from './trading/position-manager.js';
export type {
  AggregatePosition,
  WalletPosition,
  RebalanceSuggestion,
} from './trading/position-manager.js';

// ─── Strategies ───────────────────────────────────────────────
export {
  STRATEGY_ORGANIC,
  STRATEGY_VOLUME,
  STRATEGY_GRADUATION,
  STRATEGY_EXIT,
  PRESET_STRATEGIES,
} from './strategies.js';

// ─── Profit Consolidation ─────────────────────────────────────
export { ProfitConsolidator } from './trading/profit-consolidator.js';
export type {
  ProfitConsolidatorConfig,
  WalletPnL,
  ConsolidationResult,
  WalletConsolidationEntry,
  ConsolidationError,
} from './trading/profit-consolidator.js';

// ─── Coordination ─────────────────────────────────────────────
export { AuditLogger } from './coordination/audit-logger.js';
export type {
  AuditCategory,
  AuditSeverity,
  AuditEntry,
  TradeAuditData,
  TradeAuditSummary,
  DecisionAuditData,
} from './coordination/audit-logger.js';
export { SwarmConfigManager } from './coordination/swarm-config-manager.js';

// ─── Intelligence ─────────────────────────────────────────────
export { PortfolioOptimizer } from './intelligence/portfolio-optimizer.js';

// ─── Event Bus ────────────────────────────────────────────────
export { SwarmEventBus } from './infra/event-bus.js';
export { SwarmStateMachine } from './infra/state-machine.js';

// ─── Telegram ─────────────────────────────────────────────────
export { TelegramBot } from './telegram/bot.js';
export { TelegramNotificationService } from './telegram/notifications.js';
export { routeCommand, COMMAND_HANDLERS } from './telegram/commands.js';
export type { SwarmAccessor, CommandHandler } from './telegram/commands.js';
export { formatter as telegramFormatter } from './telegram/formatter.js';
export type {
  TelegramBotConfig,
  TelegramNotification,
  NotificationLevel,
  CommandContext,
  SwarmStatusSnapshot,
  TradeNotification,
} from './telegram/types.js';

// ─── Types ────────────────────────────────────────────────────
export type {
  // Wallet Types
  AgentWallet,
  WalletPool,
  // Token Types
  TokenConfig,
  MintResult,
  BundleBuyConfig,
  // Trading Types
  TradeDirection,
  TradeOrder,
  TradeResult,
  // Bonding Curve
  BondingCurveState,
  // Strategy Types
  TradingStrategy,
  // Swarm Configuration
  SwarmConfig,
  // Analytics Types
  TokenAnalytics,
  SwarmStatus,
  TraderStats,
  // Events
  SwarmEvents,
  // RPC Pool Types
  RpcEndpoint,
  RpcPoolConfig,
  // Event Bus Types
  SwarmEventCategory,
  SwarmEvent,
  EventSubscription,
  // State Machine Types
  SwarmPhase,
  PhaseTransition,
  StateMachineConfig,
  // Agent Identity Types
  AgentRole,
  AgentIdentity,
  // Wallet Vault Types
  WalletVaultConfig,
  WalletAssignment,
  // Configuration Types
  SwarmMasterConfig,
  ScannerConfig,
  IntelligenceConfig,
  DashboardConfig,
  AnalyticsConfig,
  EmergencyExitConfig,
  // Narrative Types
  TokenNarrative,
  // Bundle Types
  JitoBundleConfig,
  BundlePlan,
  BundleParticipant,
  // Market Making Types
  MarketMakingConfig,
  WashTradeRoute,
  TradeCycle,
  // Dashboard Types
  DashboardState,
  SwarmMetrics,
} from './types.js';
