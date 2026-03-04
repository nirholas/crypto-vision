/**
 * @nirholas/pump-agent-swarm
 *
 * Autonomous memecoin agent swarm for Pump.fun/Solana.
 * Creator agents mint tokens, trader agents trade on the bonding curve,
 * coordinated via AI strategy brain with optional x402-paid analytics.
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
 *   token: { name: 'AI Agent Coin', symbol: 'AIAC', metadataUri: '...' },
 *   bundle: { devBuyLamports: new BN(0.5 * LAMPORTS_PER_SOL), bundleWallets: [], slippageBps: 500 },
 *   strategy: STRATEGY_ORGANIC,
 * });
 * const status = await swarm.run();
 * ```
 */

// ─── Main ─────────────────────────────────────────────────────
export { SwarmCoordinator } from './swarm.js';

// ─── Infrastructure ──────────────────────────────────────────
export * from './infra/index.js';

// ─── Agents ───────────────────────────────────────────────────
export * from './agents/index.js';

// ─── Trading Engine ──────────────────────────────────────────
export * from './trading/index.js';

// ─── Bundle System ────────────────────────────────────────────
export * from './bundle/index.js';

// ─── Intelligence Layer ──────────────────────────────────────
export * from './intelligence/index.js';

// ─── Coordination ─────────────────────────────────────────────
export * from './coordination/index.js';

// ─── Dashboard ────────────────────────────────────────────────
export * from './dashboard/index.js';

// ─── Demo & CLI ───────────────────────────────────────────────
export * from './demo/index.js';

// ─── Analytics (x402 — Solana-native USDC micropayments) ─────
export {
  SolanaX402Client,
  SolanaX402Server,
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
  MEMO_PROGRAM_ID,
  USDC_DECIMALS,
  CAIP2_SOLANA_MAINNET,
  CAIP2_SOLANA_DEVNET,
} from './x402/index.js';
export type {
  SolanaX402PaymentRequired,
  SolanaPaymentScheme,
  SolanaX402PaymentProof,
  SolanaPaymentPayload,
  PaymentVerificationResult,
  SolanaX402ClientConfig,
  SolanaX402ServerConfig,
  SolanaX402ClientEvents,
  ScreenerEndpoint,
  X402DiscoveryDocument,
  TradingSignalResponse,
  WhaleAnalysisResponse,
  GraduationOddsResponse,
  X402ClientStats,
} from './x402/index.js';

// ─── Strategies ───────────────────────────────────────────────
export {
  STRATEGY_ORGANIC,
  STRATEGY_VOLUME,
  STRATEGY_GRADUATION,
  STRATEGY_EXIT,
  PRESET_STRATEGIES,
} from './strategies.js';

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
