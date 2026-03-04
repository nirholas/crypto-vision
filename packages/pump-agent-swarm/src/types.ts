/**
 * Pump Agent Swarm — Core Types
 *
 * Shared type definitions for the creator agent, trader agents,
 * analytics service, and swarm coordinator.
 */

import type { Keypair } from '@solana/web3.js';
// PublicKey and TransactionInstruction used transitively by pump-sdk types
import type BN from 'bn.js';

// ─── Wallet Types ─────────────────────────────────────────────

export interface AgentWallet {
  /** Solana keypair for signing transactions */
  keypair: Keypair;
  /** Base58-encoded public key */
  address: string;
  /** Human-readable label */
  label: string;
  /** SOL balance in lamports (updated by wallet manager) */
  balanceLamports: BN;
}

export interface WalletPool {
  /** The creator wallet (funds the initial dev buy) */
  creator: AgentWallet;
  /** Trader wallets (buy/sell the token) */
  traders: AgentWallet[];
  /** Optional fee recipient wallet */
  feeRecipient?: AgentWallet;
}

// ─── Token Types ──────────────────────────────────────────────

export interface TokenConfig {
  /** Token name (e.g. "AI Agent Coin") */
  name: string;
  /** Token symbol (e.g. "AIAC") */
  symbol: string;
  /** Arweave/IPFS URI for metadata JSON */
  metadataUri: string;
  /** Optional: vanity mint address prefix */
  vanityPrefix?: string;
}

export interface MintResult {
  /** The mint address (base58) */
  mint: string;
  /** The mint keypair (needed for first signature) */
  mintKeypair: Keypair;
  /** Transaction signature */
  signature: string;
  /** Bonding curve PDA */
  bondingCurve: string;
  /** Creator's token account */
  creatorTokenAccount: string;
  /** Tokens received from dev buy (if any) */
  devBuyTokens?: BN;
  /** SOL spent on dev buy (if any) */
  devBuySol?: BN;
  /** Timestamp */
  createdAt: number;
}

export interface BundleBuyConfig {
  /** SOL amount for the creator's dev buy (in lamports) */
  devBuyLamports: BN;
  /** Additional wallets that buy atomically with creation */
  bundleWallets: Array<{
    wallet: AgentWallet;
    /** SOL to spend (in lamports) */
    amountLamports: BN;
  }>;
  /** Max slippage BPS (e.g. 500 = 5%) */
  slippageBps: number;
}

// ─── Trading Types ────────────────────────────────────────────

export type TradeDirection = 'buy' | 'sell';

export interface TradeOrder {
  /** Unique order ID */
  id: string;
  /** Which trader agent is executing */
  traderId: string;
  /** Token mint address */
  mint: string;
  /** Buy or sell */
  direction: TradeDirection;
  /** SOL amount for buys (lamports) / Token amount for sells */
  amount: BN;
  /** Max slippage BPS */
  slippageBps: number;
  /** Priority fee in microlamports */
  priorityFeeMicroLamports?: number;
  /** Jito tip in lamports (for MEV protection) */
  jitoTipLamports?: number;
}

export interface TradeResult {
  /** The order that was executed */
  order: TradeOrder;
  /** Transaction signature */
  signature: string;
  /** Tokens received (for buys) or SOL received (for sells) */
  amountOut: BN;
  /** Price at execution (SOL per token) */
  executionPrice: BN;
  /** Fees paid */
  feesPaid: BN;
  /** Whether the trade succeeded */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Timestamp */
  executedAt: number;
}

// ─── Bonding Curve State ──────────────────────────────────────

export interface BondingCurveState {
  /** Token mint address */
  mint: string;
  /** Current virtual SOL reserves */
  virtualSolReserves: BN;
  /** Current virtual token reserves */
  virtualTokenReserves: BN;
  /** Real SOL reserves (actual SOL in the curve) */
  realSolReserves: BN;
  /** Real token reserves */
  realTokenReserves: BN;
  /** Whether the curve has graduated to AMM */
  complete: boolean;
  /** Current token price in SOL (derived) */
  currentPriceSol: number;
  /** Market cap in SOL (derived) */
  marketCapSol: number;
  /** Progress toward graduation (0-100%) */
  graduationProgress: number;
}

// ─── Strategy Types ───────────────────────────────────────────

export interface TradingStrategy {
  /** Strategy identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Min seconds between trades for each trader */
  minIntervalSeconds: number;
  /** Max seconds between trades */
  maxIntervalSeconds: number;
  /** Min SOL per trade (lamports) */
  minTradeSizeLamports: BN;
  /** Max SOL per trade (lamports) */
  maxTradeSizeLamports: BN;
  /** Target buy/sell ratio (1.0 = balanced, >1 = net buyer, <1 = net seller) */
  buySellRatio: number;
  /** Stop if market cap exceeds this SOL amount */
  maxMarketCapSol?: number;
  /** Stop if market cap drops below this SOL amount */
  minMarketCapSol?: number;
  /** Max total SOL to spend across all traders */
  maxTotalBudgetLamports: BN;
  /** Whether to use Jito bundles for MEV protection */
  useJitoBundles: boolean;
  /** Priority fee in microlamports */
  priorityFeeMicroLamports: number;
  /** Max number of trades before stopping */
  maxTrades?: number;
  /** Max duration in seconds before stopping */
  maxDurationSeconds?: number;
}

// ─── Swarm Configuration ──────────────────────────────────────

export interface SwarmConfig {
  /** Solana RPC endpoint */
  rpcUrl: string;
  /** Solana WebSocket endpoint (for subscriptions) */
  wsUrl?: string;
  /** Number of trader agents to spawn */
  traderCount: number;
  /** Token to create */
  token: TokenConfig;
  /** Dev buy / bundle config */
  bundle: BundleBuyConfig;
  /** Trading strategy */
  strategy: TradingStrategy;
  /** x402 analytics API base URL (if using paid analytics) */
  analyticsApiUrl?: string;
  /** Solana private key for x402 USDC payments (base58) */
  solanaPrivateKey?: string;
  /** Whether to skip x402 payments (dev mode) */
  devMode?: boolean;
  /** Log level */
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// ─── Analytics Types (x402-gated) ─────────────────────────────

export interface TokenAnalytics {
  /** Token mint address */
  mint: string;
  /** Current bonding curve state */
  bondingCurve: BondingCurveState;
  /** Holder count */
  holderCount: number;
  /** Top holders with percentage */
  topHolders: Array<{
    address: string;
    balance: BN;
    percentage: number;
  }>;
  /** Trade volume in last N minutes */
  recentVolumeSol: number;
  /** Number of trades in last N minutes */
  recentTradeCount: number;
  /** Buy/sell ratio in recent trades */
  recentBuySellRatio: number;
  /** Rug risk score (0-100, higher = riskier) */
  rugScore: number;
  /** Whether creator still holds tokens */
  creatorHolding: boolean;
  /** Creator's token percentage */
  creatorPercentage: number;
  /** Timestamp of analysis */
  analyzedAt: number;
}

export interface SwarmStatus {
  /** Current phase */
  phase: 'initializing' | 'minting' | 'trading' | 'graduating' | 'completed' | 'stopped' | 'error';
  /** Token mint (once created) */
  mint?: string;
  /** Total trades executed */
  totalTrades: number;
  /** Successful trades */
  successfulTrades: number;
  /** Failed trades */
  failedTrades: number;
  /** Total SOL spent */
  totalSolSpent: BN;
  /** Total SOL received */
  totalSolReceived: BN;
  /** Net P&L in SOL */
  netPnlSol: BN;
  /** Current market cap in SOL */
  currentMarketCapSol?: number;
  /** Graduation progress */
  graduationProgress?: number;
  /** Active trader count */
  activeTraders: number;
  /** Uptime in seconds */
  uptimeSeconds: number;
  /** Per-trader stats */
  traderStats: Map<string, TraderStats>;
  /** x402 payments made for analytics */
  x402PaymentsMade: number;
  /** Total USDC spent on x402 */
  x402TotalSpentUsdc: number;
}

export interface TraderStats {
  traderId: string;
  address: string;
  totalBuys: number;
  totalSells: number;
  solSpent: BN;
  solReceived: BN;
  tokensHeld: BN;
  lastTradeAt?: number;
}

// ─── Events ───────────────────────────────────────────────────

export interface SwarmEvents {
  'phase:change': (phase: SwarmStatus['phase']) => void;
  'token:created': (result: MintResult) => void;
  'trade:executed': (result: TradeResult) => void;
  'trade:failed': (order: TradeOrder, error: Error) => void;
  'analytics:fetched': (analytics: TokenAnalytics) => void;
  'analytics:x402-payment': (amount: string, endpoint: string) => void;
  'curve:graduated': (mint: string) => void;
  'budget:exhausted': (traderId: string) => void;
  'swarm:stopped': (status: SwarmStatus) => void;
  'error': (error: Error) => void;
}

// ─── RPC Pool Types ───────────────────────────────────────────

export interface RpcEndpoint {
  /** RPC URL */
  url: string;
  /** WebSocket URL (derived or explicit) */
  wsUrl?: string;
  /** Weight for load balancing (higher = more traffic) */
  weight: number;
  /** Max requests per second */
  rateLimit: number;
  /** Whether this endpoint supports Jito bundles */
  supportsJito: boolean;
  /** Current health status */
  healthy?: boolean;
  /** Average latency in ms (rolling) */
  avgLatencyMs?: number;
  /** Rolling latency in ms (alias for avgLatencyMs) */
  latencyMs?: number;
  /** Error count in current window */
  errorCount?: number;
  /** Consecutive health check failures */
  consecutiveFailures?: number;
  /** Last successful request timestamp */
  lastSuccessAt?: number;
  /** Timestamp of last successful health check */
  lastHealthCheck?: number;
  /** Provider name for logging */
  provider: string;
}

export interface RpcPoolConfig {
  /** List of RPC endpoints to load-balance across */
  endpoints: RpcEndpoint[];
  /** Health check interval in ms (default: 30000) */
  healthCheckIntervalMs?: number;
  /** Max consecutive failures before marking unhealthy */
  maxConsecutiveFailures?: number;
  /** Request timeout in ms */
  requestTimeoutMs?: number;
  /** Retry count per request */
  maxRetries?: number;
  /** Whether to prefer lowest-latency endpoint */
  preferLowLatency?: boolean;
  /** Connection commitment level (default: 'confirmed') */
  commitment?: 'processed' | 'confirmed' | 'finalized';
  /** Base delay for exponential backoff in ms (default: 500) */
  retryBaseDelayMs?: number;
}

// ─── Event Bus Types ──────────────────────────────────────────

export type SwarmEventCategory =
  | 'lifecycle'
  | 'trading'
  | 'analytics'
  | 'bundle'
  | 'intelligence'
  | 'coordination'
  | 'system'
  | 'wallet'
  | 'error'
  | 'metrics';

export interface SwarmEvent {
  /** Unique event ID */
  id: string;
  /** Event type (e.g., 'trade:executed', 'agent:started') */
  type: string;
  /** Event category for filtering */
  category: SwarmEventCategory;
  /** Source agent ID */
  source: string;
  /** Event payload */
  payload: Record<string, unknown>;
  /** Timestamp */
  timestamp: number;
  /** Correlation ID for tracing across agents */
  correlationId?: string;
}

export interface EventSubscription {
  /** Subscription ID */
  id: string;
  /** Event type pattern (supports wildcards: 'trade:*') */
  pattern: string;
  /** Callback function */
  handler: (event: SwarmEvent) => void | Promise<void>;
  /** Whether to receive historical events on subscribe */
  replay?: boolean;
  /** Filter function */
  filter?: (event: SwarmEvent) => boolean;
  /** Source identifier that created this subscription (for bulk unsubscribe) */
  source?: string;
}

// ─── State Machine Types ──────────────────────────────────────

export type SwarmPhase =
  | 'idle'
  | 'initializing'
  | 'funding'
  | 'scanning'
  | 'evaluating'
  | 'creating_narrative'
  | 'minting'
  | 'bundling'
  | 'distributing'
  | 'trading'
  | 'market_making'
  | 'accumulating'
  | 'graduating'
  | 'exiting'
  | 'reclaiming'
  | 'completed'
  | 'paused'
  | 'error'
  | 'emergency_exit';

export interface PhaseTransition {
  /** Phase to transition from */
  from: SwarmPhase;
  /** Phase to transition to */
  to: SwarmPhase;
  /** Condition that must be true to transition */
  guard?: () => boolean | Promise<boolean>;
  /** Action to execute during transition */
  action?: () => void | Promise<void>;
  /** Timeout for this phase in ms (0 = no timeout) */
  timeoutMs?: number;
  /** Whether this transition can be triggered manually */
  manual?: boolean;
}

export interface StateMachineConfig {
  /** Initial phase */
  initialPhase: SwarmPhase;
  /** Valid transitions */
  transitions: PhaseTransition[];
  /** Global error handler */
  onError: (error: Error, currentPhase: SwarmPhase) => SwarmPhase;
  /** Phase timeout handler */
  onTimeout: (phase: SwarmPhase) => SwarmPhase;
}

// ─── Agent Identity Types ─────────────────────────────────────

export type AgentRole =
  | 'creator'
  | 'trader'
  | 'analyst'
  | 'sniper'
  | 'market_maker'
  | 'volume_bot'
  | 'accumulator'
  | 'exit_manager'
  | 'sentinel'
  | 'scanner'
  | 'narrator';

export interface AgentIdentity {
  /** Unique agent ID within the swarm */
  id: string;
  /** Human-readable name */
  name: string;
  /** Agent role */
  role: AgentRole;
  /** Solana wallet */
  wallet: AgentWallet;
  /** Agent-specific configuration */
  config: Record<string, unknown>;
  /** Whether this agent is currently active */
  active: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Last heartbeat */
  lastHeartbeat: number;
}

// ─── Wallet Vault Types ───────────────────────────────────────

export interface WalletVaultConfig {
  /** Number of wallets to generate in the pool */
  poolSize: number;
  /** BIP-39 mnemonic for HD derivation (if not provided, random wallets are generated) */
  mnemonic?: string;
  /** Minimum SOL balance in lamports before triggering low-balance alert */
  minBalanceLamports: BN;
  /** Maximum concurrent lock duration in milliseconds (default: 60000) */
  lockTimeoutMs?: number;
  /** Encryption password for key storage */
  encryptionPassword?: string;
  /** Auto-refund from funder when balance drops below minimum */
  autoRefund?: boolean;
  /** Auto-refund amount in lamports when triggered */
  autoRefundAmountLamports?: BN;
}

export interface WalletAssignment {
  /** The assigned wallet */
  wallet: AgentWallet;
  /** Agent ID that owns this assignment */
  agentId: string;
  /** Role of the assigned agent */
  role: AgentRole;
  /** Timestamp when the wallet was assigned */
  assignedAt: number;
  /** Whether the wallet is currently locked for a transaction */
  locked: boolean;
  /** Transaction signature that caused the lock (if locked) */
  lockTxSignature?: string;
  /** Timestamp when the wallet was locked */
  lockedAt?: number;
}

// ─── Configuration Types ──────────────────────────────────────

export interface SwarmMasterConfig {
  /** Solana network */
  network: 'mainnet-beta' | 'devnet';
  /** RPC configuration */
  rpc: RpcPoolConfig;
  /** Wallet configuration */
  wallets: WalletVaultConfig;
  /** Number of each agent type to spawn */
  agentCounts: Record<AgentRole, number>;
  /** Global trading strategy */
  strategy: TradingStrategy;
  /** Token to create/trade (mutually exclusive with scannerConfig) */
  token?: TokenConfig;
  /** Scanner config for finding existing tokens */
  scannerConfig?: ScannerConfig;
  /** Bundle configuration */
  bundle: BundleBuyConfig;
  /** Intelligence configuration */
  intelligence: IntelligenceConfig;
  /** Dashboard configuration */
  dashboard?: DashboardConfig;
  /** x402 analytics configuration */
  analytics?: AnalyticsConfig;
  /** Logging level */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Whether to enable metrics collection */
  enableMetrics: boolean;
  /** Emergency exit conditions */
  emergencyExit: EmergencyExitConfig;
}

export interface ScannerConfig {
  /** Scan interval in ms */
  intervalMs: number;
  /** Minimum market cap in SOL to consider */
  minMarketCapSol: number;
  /** Maximum market cap in SOL */
  maxMarketCapSol: number;
  /** Maximum token age in seconds */
  maxAgeSeconds: number;
  /** Keywords to look for in token name/symbol */
  keywords: string[];
  /** Categories of tokens to target */
  categories: ('tech' | 'ai' | 'meme' | 'defi' | 'gaming' | 'nft')[];
  /** Minimum holder count */
  minHolders: number;
  /** Maximum dev holdings percentage */
  maxDevHoldingsPercent: number;
  /** Whether to check for rug risk */
  checkRugRisk: boolean;
}

export interface IntelligenceConfig {
  /** LLM provider for narrative generation */
  llmProvider: 'openai' | 'anthropic' | 'openrouter';
  /** LLM API key */
  llmApiKey: string;
  /** LLM model to use */
  llmModel: string;
  /** Whether to enable AI-driven trade signals */
  enableSignals: boolean;
  /** Whether to enable sentiment analysis */
  enableSentiment: boolean;
  /** Risk tolerance (0-1, higher = more aggressive) */
  riskTolerance: number;
  /** Maximum portfolio allocation per token (0-1) */
  maxAllocationPerToken: number;
}

export interface DashboardConfig {
  /** Dashboard server port */
  port: number;
  /** Whether to enable WebSocket updates */
  enableWebSocket: boolean;
  /** Update interval for dashboard in ms */
  updateIntervalMs: number;
  /** Whether to enable public access (vs localhost only) */
  publicAccess: boolean;
  /** Authentication token for dashboard */
  authToken?: string;
}

export interface AnalyticsConfig {
  /** x402 analytics API base URL */
  apiBaseUrl: string;
  /** Solana private key for x402 USDC payments (base58) */
  solanaPrivateKey?: string;
  /** Max USDC per request */
  maxPaymentPerRequest: string;
  /** Total USDC budget */
  totalBudget: string;
  /** Poll interval in ms */
  pollIntervalMs: number;
  /** Solana network */
  network?: 'mainnet-beta' | 'devnet';
}

export interface EmergencyExitConfig {
  /** Max total SOL loss before emergency exit */
  maxLossLamports: BN;
  /** Max percentage loss before emergency exit (0-100) */
  maxLossPercent: number;
  /** Max time without successful trade before exit (ms) */
  maxSilenceMs: number;
  /** Whether to sell all tokens on emergency exit */
  sellAllOnExit: boolean;
  /** Whether to reclaim all SOL on emergency exit */
  reclaimOnExit: boolean;
}

// ─── Narrative Types ──────────────────────────────────────────

export interface TokenNarrative {
  /** Generated token name */
  name: string;
  /** Generated ticker symbol */
  symbol: string;
  /** Token description/pitch */
  description: string;
  /** Category/theme */
  category: string;
  /** Keywords for SEO/discovery */
  keywords: string[];
  /** Generated image prompt for AI art */
  imagePrompt: string;
  /** Image URL (after generation) */
  imageUrl?: string;
  /** Metadata URI (after upload) */
  metadataUri?: string;
  /** Social media hooks */
  socialHooks: string[];
  /** Why this narrative will work (AI reasoning) */
  reasoning: string;
  /** Confidence score (0-1) */
  confidence: number;
  /** Trending topics this relates to */
  trendConnections: string[];
  /** Target audience */
  targetAudience: string;
  /** Generated at */
  generatedAt: number;
}

// ─── Bundle Types ─────────────────────────────────────────────

export interface JitoBundleConfig {
  /** Jito block engine URL */
  blockEngineUrl: string;
  /** Jito authentication keypair */
  authKeypair?: Keypair;
  /** Tip amount in lamports */
  tipLamports: number;
  /** Maximum bundle size (transactions) */
  maxBundleSize: number;
  /** Whether to use Jito's on-chain tip distribution */
  useOnChainTip: boolean;
}

export interface BundlePlan {
  /** Unique bundle ID */
  id: string;
  /** Token mint (set after creation) */
  mint?: string;
  /** Creator wallet */
  creator: AgentWallet;
  /** Wallets participating in the bundle */
  participants: BundleParticipant[];
  /** Total SOL allocated */
  totalSolAllocated: BN;
  /** Target supply percentage to acquire */
  targetSupplyPercent: number;
  /** Whether to use Jito for atomicity */
  useJito: boolean;
  /** Jito configuration (if using Jito) */
  jitoConfig?: JitoBundleConfig;
  /** Creation timestamp */
  createdAt: number;
  /** Execution timestamp */
  executedAt?: number;
  /** Status */
  status: 'planned' | 'executing' | 'completed' | 'failed' | 'partial';
}

export interface BundleParticipant {
  /** Wallet to buy with */
  wallet: AgentWallet;
  /** SOL amount to spend (lamports) */
  amountLamports: BN;
  /** Delay from bundle start in ms (for anti-detection) */
  delayMs: number;
  /** Priority fee multiplier */
  priorityMultiplier: number;
  /** Status */
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  /** Transaction signature */
  signature?: string;
  /** Tokens received */
  tokensReceived?: BN;
}

// ─── Market Making Types ──────────────────────────────────────

export interface MarketMakingConfig {
  /** Target spread (percentage) */
  targetSpreadPercent: number;
  /** Whether to trail price up over time */
  trailPriceUp: boolean;
  /** Price increment per cycle (percentage) */
  priceIncrementPercent: number;
  /** Cycle duration in ms */
  cycleDurationMs: number;
  /** Number of cycles before reevaluation */
  cyclesPerEvaluation: number;
  /** Volume target per cycle in SOL */
  volumeTargetSol: number;
  /** Buy/sell imbalance target (-1 to 1, positive = net buying) */
  imbalanceTarget: number;
  /** Whether to use wallet rotation */
  useWalletRotation: boolean;
  /** Minimum wallets for rotation */
  minRotationWallets: number;
  /** Max trades per wallet per cycle */
  maxTradesPerWalletPerCycle: number;
}

export interface WashTradeRoute {
  /** Source wallet */
  from: AgentWallet;
  /** Destination wallet */
  to: AgentWallet;
  /** Direction (SOL → token or token → SOL) */
  direction: TradeDirection;
  /** Amount */
  amount: BN;
  /** Delay before execution (ms) */
  delayMs: number;
  /** Priority */
  priority: number;
}

export interface TradeCycle {
  /** Cycle ID */
  id: string;
  /** Trades in this cycle */
  routes: WashTradeRoute[];
  /** Expected net SOL change */
  expectedNetSol: BN;
  /** Expected price impact */
  expectedPriceImpact: number;
  /** Execution start time */
  startedAt?: number;
  /** Execution end time */
  completedAt?: number;
  /** Status */
  status: 'planned' | 'executing' | 'completed' | 'failed';
}

// ─── Dashboard Types ──────────────────────────────────────────

export interface DashboardState {
  /** Current swarm phase */
  phase: SwarmPhase;
  /** Token information */
  token?: {
    name: string;
    symbol: string;
    mint: string;
    bondingCurve: string;
    createdAt: number;
  };
  /** All agent statuses */
  agents: AgentIdentity[];
  /** Recent trades (last 100) */
  recentTrades: TradeResult[];
  /** Supply distribution */
  supplyDistribution: Map<string, { address: string; balance: BN; percentage: number }>;
  /** P&L by agent */
  pnlByAgent: Map<string, { solSpent: BN; solReceived: BN; netPnl: BN }>;
  /** Bonding curve state */
  bondingCurve?: BondingCurveState;
  /** Total metrics */
  metrics: SwarmMetrics;
  /** Event log (last 500) */
  eventLog: SwarmEvent[];
  /** Timestamp */
  updatedAt: number;
}

export interface SwarmMetrics {
  /** Total SOL spent across all agents */
  totalSolSpent: BN;
  /** Total SOL received across all agents */
  totalSolReceived: BN;
  /** Net P&L */
  netPnl: BN;
  /** Total trades executed */
  totalTrades: number;
  /** Successful trades */
  successfulTrades: number;
  /** Failed trades */
  failedTrades: number;
  /** Trades per minute (rolling average) */
  tradesPerMinute: number;
  /** Average trade size in SOL */
  avgTradeSizeSol: number;
  /** Uptime in seconds */
  uptimeSeconds: number;
  /** x402 payments made */
  x402Payments: number;
  /** x402 total spent USDC */
  x402SpentUsdc: number;
  /** Current token price in SOL */
  currentPriceSol?: number;
  /** Current market cap in SOL */
  currentMarketCapSol?: number;
  /** Graduation progress (0-100) */
  graduationProgress?: number;
  /** Total wallets active */
  activeWallets: number;
  /** Total SOL locked in wallets */
  totalSolLocked: BN;
}
