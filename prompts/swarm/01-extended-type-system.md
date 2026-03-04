# Prompt 01 — Extended Type System & Core Interfaces

## Agent Identity & Rules

```
You are the FOUNDATION-TYPES agent. Your sole responsibility is extending the pump-agent-swarm type system.

RULES:
- Work on current branch (main)
- Commit as nirholas: git config user.name "nirholas" && git config user.email "nirholas@users.noreply.github.com"
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks, no fakes, no stubs — real types for real systems
- TypeScript strict mode — no `any`, no `@ts-ignore`
- Run npx tsc --noEmit after changes
- Commit message: "feat(swarm): extend core type system with infrastructure types"
```

## Objective

Extend `packages/pump-agent-swarm/src/types.ts` with comprehensive types for all new subsystems. This is the foundation every other prompt depends on. Every type must be production-grade with JSDoc documentation.

## Current State

The existing `types.ts` has: `AgentWallet`, `WalletPool`, `TokenConfig`, `MintResult`, `BundleBuyConfig`, `TradeOrder`, `TradeResult`, `BondingCurveState`, `TradingStrategy`, `SwarmConfig`, `TokenAnalytics`, `SwarmStatus`, `TraderStats`, `SwarmEvents`. These must be preserved and extended.

## File Ownership

- **Modifies**: `packages/pump-agent-swarm/src/types.ts`

## Dependencies

- None — this is the foundation type file that all other prompts depend on
- Existing `types.ts` exports must be preserved

## Deliverables

### 1. Add Infrastructure Types

Add to `packages/pump-agent-swarm/src/types.ts`:

```typescript
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
  healthy: boolean;
  /** Average latency in ms (rolling) */
  avgLatencyMs: number;
  /** Error count in current window */
  errorCount: number;
  /** Last successful request timestamp */
  lastSuccessAt: number;
  /** Provider name for logging */
  provider: string;
}

export interface RpcPoolConfig {
  /** List of RPC endpoints to load-balance across */
  endpoints: RpcEndpoint[];
  /** Health check interval in ms (default: 30000) */
  healthCheckIntervalMs: number;
  /** Max consecutive failures before marking unhealthy */
  maxConsecutiveFailures: number;
  /** Request timeout in ms */
  requestTimeoutMs: number;
  /** Retry count per request */
  maxRetries: number;
  /** Whether to prefer lowest-latency endpoint */
  preferLowLatency: boolean;
}

// ─── Event Bus Types ──────────────────────────────────────────

export type SwarmEventCategory = 
  | 'lifecycle' 
  | 'trading' 
  | 'bundle' 
  | 'intelligence' 
  | 'coordination' 
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
  from: SwarmPhase;
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
  /** Master seed phrase (BIP-39) for deterministic derivation */
  masterSeed?: string;
  /** Number of wallets to pre-generate */
  poolSize: number;
  /** Minimum SOL balance to maintain per wallet */
  minBalanceLamports: BN;
  /** Auto-refund threshold — reclaim if balance exceeds this */
  maxBalanceLamports: BN;
  /** Whether to encrypt keys at rest */
  encryptAtRest: boolean;
  /** Encryption password (required if encryptAtRest is true) */
  encryptionPassword?: string;
}

export interface WalletAssignment {
  /** Agent ID this wallet is assigned to */
  agentId: string;
  /** Wallet */
  wallet: AgentWallet;
  /** When assigned */
  assignedAt: number;
  /** Whether currently locked (in-use for a transaction) */
  locked: boolean;
  /** Transaction currently using this wallet */
  activeTxSignature?: string;
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
  /** EVM private key for x402 payments */
  evmPrivateKey?: string;
  /** Max USDC per request */
  maxPaymentPerRequest: string;
  /** Total USDC budget */
  totalBudget: string;
  /** Poll interval in ms */
  pollIntervalMs: number;
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
```

Import `BN` and `Keypair` types at the top of the file (they should already be imported). Do NOT remove any existing types — only add new ones.

### 2. Update Barrel Exports

Update `packages/pump-agent-swarm/src/index.ts` to export all new types. Add export lines for every new type and interface.

### 3. Validate

```bash
cd packages/pump-agent-swarm && npx tsc --noEmit
```

## Success Criteria

- All existing types preserved, no breaking changes
- All new types fully documented with JSDoc
- Every type uses strict TypeScript (no `any`)
- File compiles without errors
- Exports updated in index.ts
