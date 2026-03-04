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

// ─── Infrastructure ──────────────────────────────────────────
export { RpcPool, DEFAULT_RPC_ENDPOINTS } from './infra/rpc-pool.js';

// ─── Analytics (x402) ─────────────────────────────────────────
export { AnalyticsClient } from './analytics/x402-client.js';

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

// ─── Strategies ───────────────────────────────────────────────
export {
  STRATEGY_ORGANIC,
  STRATEGY_VOLUME,
  STRATEGY_GRADUATION,
  STRATEGY_EXIT,
  PRESET_STRATEGIES,
} from './strategies.js';

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
