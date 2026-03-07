// ═══════════════════════════════════════════════════════════════
// WAVE 1 COMPACT REFERENCE — Types, Stores, Props, API Methods
// ═══════════════════════════════════════════════════════════════

// ─── Primitive aliases ───────────────────────────────────────
type LamportString = string;

// ─── Enums / Unions ──────────────────────────────────────────
type SwarmPhase = 'idle' | 'scouting' | 'creating' | 'bundling' | 'trading' | 'exiting' | 'paused' | 'done';
type AgentType = 'creator' | 'trader' | 'market-maker' | 'volume' | 'accumulator' | 'exit' | 'sentinel' | 'scanner' | 'narrative' | 'sniper' | 'stability';
type AgentStatus = 'active' | 'paused' | 'idle' | 'error' | 'stopped';
type AgentRole = 'creator' | 'trader' | 'market-maker' | 'volume' | 'accumulator' | 'sniper' | 'exit-only' | 'unassigned';
type ExitStrategy = 'gradual' | 'staged' | 'immediate' | 'trailing-stop';
type DistributionMode = 'even' | 'weighted' | 'random' | 'stagger';
type VolumePattern = 'balanced' | 'cascade' | 'burst' | 'natural';
type BurstTriggerType = 'at-launch' | 'mc-target' | 'time-delay' | 'manual';
type PresetStrategyName = 'organic' | 'volume' | 'graduation' | 'custom';
type DashboardEventType = 'trade:executed' | 'agent:status' | 'pnl:updated' | 'phase:changed' | 'health:report' | 'signal:generated' | 'alert:created' | 'config:changed' | 'swarm:status';
type EventCategory = 'trade' | 'agent' | 'phase' | 'system' | 'alert';
type EventSeverity = 'info' | 'warning' | 'critical';

// ─── Core Domain Interfaces ──────────────────────────────────

interface WalletInfo { address: string; label: string; role: AgentRole; balanceLamports: LamportString; tokenBalance: string; status: AgentStatus; assignedAgentId: string | null; createdAt: number; }
interface TraderPersonality { aggression: number; timingVariance: number; sizeVariance: number; trendFollowing: number; maxPositionPercent: number; naturalSizing: boolean; }
interface TradingStrategy { id: string; name: string; minIntervalSeconds: number; maxIntervalSeconds: number; minTradeSizeLamports: LamportString; maxTradeSizeLamports: LamportString; buySellRatio: number; maxMarketCapSol?: number; minMarketCapSol?: number; maxTotalBudgetLamports: LamportString; useJitoBundles: boolean; priorityFeeMicroLamports: number; maxTrades?: number; maxDurationSeconds?: number; }
interface VolumeConfig { targetVolumeSolPerHour: number; minTradeSize: LamportString; maxTradeSize: LamportString; minIntervalMs: number; maxIntervalMs: number; walletRotationEnabled: boolean; maxTradesPerWallet: number; balancedMode: boolean; naturalPatterns: boolean; volumePattern: VolumePattern; peakHoursUtc: number[]; }
interface MarketMakingConfig { spreadPercent: number; inventoryTarget: number; maxInventoryDeviation: number; cycleDurationMs: number; maxLossPerCycleSol: number; maxDrawdownPercent: number; volatilityAdjustedSpread: boolean; }
interface ExitStage { priceMultiplier: number; sellPercent: number; }
interface ExitConfig { strategy: ExitStrategy; exitDurationMs: number; stages: ExitStage[]; maxPriceImpactPercent: number; retainPercent: number; priorityFeeMicroLamports: number; slippageBps: number; takeProfitMultiplier?: number; stopLossPercent?: number; timeLimitSeconds?: number; exitOnGraduation: boolean; exitOnVolumeDrop?: number; trailingStopPercent?: number; trailingStopActivation?: number; }
interface TokenConfig { name: string; symbol: string; description: string; imageUri: string; metadataUri?: string; vanityPrefix?: string; mayhemMode: boolean; cashback: boolean; }
interface BundleWalletConfig { walletAddress: string; amountLamports: LamportString; delayMs: number; useJito: boolean; }
interface BundleBuyConfig { devBuyLamports: LamportString; bundleWallets: BundleWalletConfig[]; slippageBps: number; distributionMode: DistributionMode; }
interface BurstEvent { id: string; triggerType: BurstTriggerType; triggerValue: number; walletAddresses: string[]; amountPerWalletLamports: LamportString; simultaneous: boolean; }
interface LaunchMode { createToken: boolean; devBuy: boolean; devBuyAmountLamports: LamportString; bundleBuy: boolean; volumeGeneration: boolean; volumeStartCondition: 'immediately' | 'after-dev-buy' | 'after-bundle' | 'after-delay'; volumeStartDelaySeconds: number; volumeDurationSeconds: number; marketMaking: boolean; marketMakingStartCondition: 'immediately' | 'after-dev-buy' | 'after-bundle' | 'after-delay'; organicAccumulation: boolean; accumulationTargetPercent: number; graduationPush: boolean; graduationPushThreshold: number; snipeLaunch: boolean; giantBurstEvents: BurstEvent[]; autoExit: boolean; consolidateProfits: boolean; }
interface SwarmConfig { rpcUrl: string; wsUrl?: string; traderCount: number; token: TokenConfig; bundle: BundleBuyConfig; strategy: TradingStrategy; volume?: VolumeConfig; marketMaking?: MarketMakingConfig; exit?: ExitConfig; launchMode: LaunchMode; agentPersonalities: Record<string, TraderPersonality>; }

// ─── API Response / Data Interfaces ──────────────────────────

interface ApiResponse<T> { success: boolean; data: T; timestamp: number; error?: string; }
interface SwarmStatus { phase: SwarmPhase; uptime: number; tokenMint: string | null; totalAgents: number; activeAgents: number; totalTrades: number; totalVolumeSol: number; currentPnl: number; startedAt: number | null; }
interface Agent { id: string; type: AgentType; status: AgentStatus; walletAddress: string; solBalance: number; tokenBalance: number; pnl: number; tradeCount: number; lastAction: string | null; uptime: number; }
interface AgentHistoryEntry { timestamp: number; action: string; details: string; success: boolean; }
interface AgentPerformanceMetrics { totalTrades: number; winRate: number; avgTradeSize: number; totalVolume: number; profitFactor: number; maxDrawdown: number; sharpeRatio: number; }
interface AgentDetail extends Agent { personality: TraderPersonality; role: AgentRole; budgetLamports: LamportString; history: AgentHistoryEntry[]; performance: AgentPerformanceMetrics; }
interface TradeEntry { id: string; timestamp: number; agentId: string; direction: 'buy' | 'sell'; solAmount: number; tokenAmount: number; price: number; signature: string; success: boolean; slippage?: number; }
interface TradeResult { success: boolean; signature: string; solAmount: number; tokenAmount: number; price: number; error?: string; }
interface PnLDataPoint { timestamp: number; pnlSol: number; pnlUsd: number; cumulativeVolume: number; }
interface PnLSnapshot { totalPnlSol: number; totalPnlUsd: number; unrealizedPnlSol: number; realizedPnlSol: number; totalCostSol: number; totalRevenueSol: number; tokenValue: number; timestamp: number; }
interface PnLData { timeSeries: PnLDataPoint[]; current: PnLSnapshot; }
interface Analytics { totalTrades: number; totalVolumeSol: number; buyCount: number; sellCount: number; avgTradeSize: number; avgInterval: number; topAgentByVolume: string; topAgentByPnl: string; bondingCurveProgress: number; currentMarketCapSol: number; currentTokenPrice: number; estimatedUsdPrice: number; walletDistribution: Record<string, number>; }
interface HealthReport { status: 'healthy' | 'degraded' | 'unhealthy'; uptime: number; agents: { id: string; type: string; status: string; lastHeartbeat: number; errorCount: number; }[]; metrics: { cpuUsage?: number; memoryUsage?: number; rpcLatency: number; eventBusBacklog: number; }; checks: { name: string; status: 'pass' | 'warn' | 'fail'; message: string; }[]; timestamp: number; }
interface Template { id: string; name: string; description: string; createdAt: number; updatedAt: number; config: Partial<SwarmConfig>; }
interface PresetStrategy { name: PresetStrategyName; label: string; description: string; strategy: TradingStrategy; }
interface CostEstimate { devBuySol: number; bundleBuysSol: number; volumeBudgetSol: number; transactionFeesSol: number; jitoTipsSol: number; totalSol: number; totalUsd: number; expectedSupplyPercent: number; breakEvenMultiplier: number; }
interface SupplyHolder { address: string; label: string; balance: number; percentage: number; }
interface SupplyDistribution { totalSupply: number; holders: SupplyHolder[]; bondingCurveHeld: number; updatedAt: number; }
interface TimelineEvent { id: string; timestamp: number; category: EventCategory; severity: EventSeverity; message: string; agentId?: string; data?: Record<string, unknown>; }
interface Session { id: string; walletAddress: string; createdAt: number; lastActiveAt: number; }
interface FundingTarget { address: string; lamports: LamportString; }
interface WalletTransaction { signature: string; timestamp: number; direction: 'in' | 'out'; amountLamports: LamportString; counterparty: string; }

// ─── WebSocket Event Payloads ────────────────────────────────

interface DashboardEvent { type: DashboardEventType; timestamp: string; data: Record<string, unknown>; agentId?: string; }
interface TradeExecutedData { agentId: string; agentLabel: string; direction: 'buy' | 'sell'; solAmount: number; tokenAmount: number; price: number; signature: string; }
interface PhaseChangedData { previousPhase: SwarmPhase; newPhase: SwarmPhase; reason: string; }
interface PnLUpdatedData { totalPnlSol: number; unrealizedPnlSol: number; realizedPnlSol: number; }
interface AgentStatusData { agentId: string; type: AgentType; status: AgentStatus; walletAddress: string; solBalance: number; tokenBalance: number; }
interface AlertData { id: string; severity: 'info' | 'warning' | 'critical'; message: string; agentId?: string; }

// ─── Zustand Store Shapes ────────────────────────────────────

interface SwarmState {
  phase: SwarmPhase; isRunning: boolean; isPaused: boolean; mint: string | null;
  totalTrades: number; totalVolumeSol: number; currentPnlSol: number;
  activeAgentCount: number; totalAgentCount: number; uptime: number; startedAt: number | null;
  setStatus(s: SwarmStatus): void; setPhase(p: SwarmPhase): void; setMint(m: string | null): void;
  updatePnl(pnl: number): void; updateTrades(total: number, vol: number): void;
  updateAgentCounts(active: number, total: number): void; reset(): void;
}

interface WalletState {
  wallets: WalletInfo[]; connectedWalletAddress: string | null; connectedWalletBalanceLamports: string; selectedWalletAddress: string | null;
  setWallets(w: WalletInfo[]): void; addWallets(w: WalletInfo[]): void;
  updateWallet(addr: string, patch: Partial<WalletInfo>): void; removeWallet(addr: string): void;
  setConnectedWallet(addr: string | null, bal?: string): void; setConnectedBalance(bal: string): void;
  setSelectedWallet(addr: string | null): void;
  getWalletByAddress(addr: string): WalletInfo | undefined;
  getLowBalanceWallets(threshold?: number): WalletInfo[];
  reset(): void;
}

interface AgentState {
  agents: Agent[]; selectedAgentId: string | null; agentDetails: Record<string, AgentDetail>;
  setAgents(a: Agent[]): void; updateAgent(id: string, patch: Partial<Agent>): void;
  setAgentDetail(id: string, d: AgentDetail): void; setSelectedAgent(id: string | null): void;
  updatePersonality(id: string, p: Partial<TraderPersonality>): void;
  updateRole(id: string, r: AgentRole): void;
  getAgentById(id: string): Agent | undefined;
  getAgentsByType(t: string): Agent[];
  getActiveAgents(): Agent[];
  getErrorAgents(): Agent[];
  reset(): void;
}

// ─── Component Props ─────────────────────────────────────────

// Providers.tsx:        { children: ReactNode }
// Sidebar.tsx:          (no props)
// TopBar.tsx:           (no props)
// Hero.tsx:             (no props)
// WalletConnect.tsx:    (no props)
// WalletTable.tsx:      (no props — reads from useWalletStore)
// WalletCard.tsx:       { address: string }
// CreateWalletsModal:   { onClose: () => void }
// ImportWalletsModal:   { onClose: () => void }
// FundingPanel:         { onClose: () => void }

// ─── API Methods (src/lib/api.ts) ────────────────────────────

// Swarm Control
declare function getSwarmStatus(): Promise<SwarmStatus>;
declare function pauseSwarm(): Promise<void>;
declare function resumeSwarm(): Promise<void>;
declare function triggerExit(): Promise<void>;
declare function emergencyStop(): Promise<void>;
declare function startSwarm(config: Partial<SwarmConfig>): Promise<void>;
declare function updateSwarmStrategy(strategy: Partial<TradingStrategy>): Promise<void>;

// Agents
declare function getAgents(): Promise<Agent[]>;
declare function getAgent(id: string): Promise<AgentDetail>;
declare function updateAgent(id: string, patch: Partial<AgentDetail>): Promise<void>;
declare function pauseAgent(id: string): Promise<void>;
declare function resumeAgent(id: string): Promise<void>;
declare function stopAgent(id: string): Promise<void>;

// Wallets
declare function getWallets(): Promise<WalletInfo[]>;
declare function createWallets(count: number, opts?: { prefix?: string; randomNames?: boolean }): Promise<WalletInfo[]>;
declare function importWallets(keys: string[]): Promise<WalletInfo[]>;
declare function updateWalletLabel(address: string, label: string): Promise<void>;
declare function fundWallet(address: string, lamports: string): Promise<string>;
declare function splitFunding(source: string, totalLamports: string, targets: FundingTarget[]): Promise<string[]>;
declare function getWalletHistory(address: string): Promise<{ transactions: WalletTransaction[] }>;
declare function exportWallets(format: 'json' | 'csv' | 'csv-full'): Promise<Blob>;

// Trades
declare function getTrades(opts?: { limit?: number; offset?: number; agent?: string; direction?: 'buy' | 'sell' }): Promise<{ trades: TradeEntry[]; total: number; hasMore: boolean }>;
declare function manualTrade(wallet: string, direction: 'buy' | 'sell', lamports: string): Promise<TradeResult>;

// Analytics
declare function getAnalytics(): Promise<Analytics>;
declare function getPnL(): Promise<PnLData>;
declare function getSupplyDistribution(): Promise<SupplyDistribution>;
declare function getHealth(): Promise<HealthReport>;
declare function getEvents(opts?: { limit?: number; offset?: number; category?: string; severity?: string; agent?: string }): Promise<{ events: TimelineEvent[]; total: number }>;

// Config
declare function getConfig(): Promise<{ config: SwarmConfig; schema: unknown }>;
declare function updateConfig(config: Partial<SwarmConfig>): Promise<{ success: boolean; config: SwarmConfig; changes: string[]; warnings: string[]; errors: string[]; requiresRestart: boolean }>;

// Templates
declare function getTemplates(): Promise<Template[]>;
declare function saveTemplate(t: Omit<Template, 'id' | 'createdAt' | 'updatedAt'>): Promise<Template>;
declare function loadTemplate(id: string): Promise<Template>;
declare function deleteTemplate(id: string): Promise<void>;

// Session
declare function createSession(walletAddress: string): Promise<Session>;
declare function getSession(): Promise<Session | null>;

// Export & Metadata
declare function exportAll(): Promise<Blob>;
declare function uploadMetadataImage(file: File): Promise<{ uri: string }>;
declare function generateNarrative(name: string, symbol: string, description: string): Promise<{ narrative: string }>;

// ─── WebSocket Client (src/lib/ws-client.ts) ─────────────────

// class WSClient {
//   connect(): void;
//   disconnect(): void;
//   on(eventType: DashboardEventType | '*', handler: (e: DashboardEvent) => void): string;
//   off(subscriptionId: string): void;
//   onConnectionChange(listener: (connected: boolean) => void): () => void;
//   get isConnected(): boolean;
// }
// function getWSClient(): WSClient;

// ─── Hooks (src/hooks/) ──────────────────────────────────────

// useWebSocket():       { isConnected: boolean; subscribe(type, handler): () => void }
// useSwarmStatus():     UseQueryResult<SwarmStatus>  (1s polling, hydrates swarm store)
// useAgents():          UseQueryResult<Agent[]>      (2s polling, hydrates agent store)
// useWallets():         UseQueryResult<WalletInfo[]> (5s polling, hydrates wallet store)
// usePnL():             UseQueryResult<PnLData>      (2s polling)
// useChartData(opts?):  UseQueryResult<{ trades, total, hasMore }> (3s polling)

// ─── Formatters (src/lib/formatters.ts) ──────────────────────

// lamportsToSol(lamports: string | number): number
// solToLamports(sol: number): string
// formatSol(sol: number, decimals?: number): string
// formatLamportsAsSol(lamports: string | number, decimals?: number): string
// formatUsd(usd: number): string
// formatNumber(n: number): string
// formatCompact(n: number): string
// truncateAddress(address: string, chars?: number): string
// truncateAddressLong(address: string): string
// relativeTime(timestampMs: number): string
// formatElapsed(seconds: number): string
// formatDuration(ms: number): string
// formatPercent(value: number, decimals?: number): string
// formatPhase(phase: string): string
// phaseColor(phase: string): string
// phaseBgColor(phase: string): string
// statusColor(status: string): string
// formatRole(role: string): string

// ─── SOL Helpers (src/lib/sol.ts) ────────────────────────────

// estimateTokensFromSol(solAmount, virtualSolReserves?, virtualTokenReserves?): number
// estimateMarketCapSol(virtualSolReserves?, virtualTokenReserves?): number
// estimateTokenPrice(virtualSolReserves?, virtualTokenReserves?): number
// graduationProgress(currentVirtualSolReserves: number): number
// simulateSequentialBuys(buys: {label, solAmount}[]): {label, solAmount, tokensReceived, marketCapSolAfter, priceAfter, virtualSolAfter, virtualTokenAfter}[]
