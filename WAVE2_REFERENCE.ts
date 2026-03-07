// ═══════════════════════════════════════════════════════════════
// WAVE 2 COMPACT REFERENCE — All new types, API methods, components
// ═══════════════════════════════════════════════════════════════

// ─── New Types Added in Wave 2 ───────────────────────────────

interface ManualTradeOptions { slippageBps?: number; priorityFeeMicroLamports?: number; useJito?: boolean; }
interface MultiTradeRequest { wallets: string[]; direction: 'buy' | 'sell'; amounts: LamportString[]; useJito: boolean; staggerMs?: number; }
interface MultiTradeResult { results: Array<{ walletAddress: string; success: boolean; signature?: string; error?: string }>; }
interface OHLCVCandle { time: number; open: number; high: number; low: number; close: number; volume: number; trades: number; }
interface ChartTradeMarker { time: number; direction: 'buy' | 'sell'; agentLabel: string; amountSol: number; price: number; signature: string; source: 'agent' | 'tracked'; }
interface TrackedWallet { id: string; address: string; label: string; color: string; source: 'gmgn' | 'manual'; addedAt: number; lastTrade?: { direction: 'buy' | 'sell'; amountSol: number; timestamp: number }; }
interface GmgnWallet { address: string; score: number; lastDirection: 'buy' | 'sell'; lastAmountSol: number; lastTimestamp: number; }
type PriceAlertType = 'above' | 'below' | 'change';
interface PriceAlert { id: string; alertType: PriceAlertType; value: number; triggered: boolean; triggeredAt?: number; createdAt: number; }
interface PnLTimeSeriesPoint { timestamp: number; realizedSol: number; unrealizedSol: number; totalSol: number; }
interface AgentPnLRow { agentId: string; role: string; solSpent: number; solReceived: number; realizedPnl: number; unrealizedPnl: number; totalPnl: number; winRate: number; tradeCount: number; }
interface VolumeHourly { hour: string; buyVolume: number; sellVolume: number; totalVolume: number; tradeCount: number; }
interface AgentVolumeShare { agentId: string; label: string; volume: number; percent: number; }
interface CostBreakdown { gasFeesSol: number; jitoTipsSol: number; totalExposureSol: number; projectedGas1hr: number; projectedJito1hr: number; projectedCapital1hr: number; }
interface WalletHolding { address: string; label: string; solBalance: number; tokensHeld: number; supplyPercent: number; currentValueSol: number; entryCostSol: number; unrealizedPnl: number; }
interface PhaseEvent { phase: string; startedAt: number; endedAt?: number; eventCount: number; }
interface BurstEventRuntime { id: string; triggerType: string; triggerValue: number; walletAddresses: string[]; amountPerWalletLamports: LamportString; simultaneous: boolean; executedAt: number | null; createdAt: number; }

// ─── Updated API Method (manualTrade) ────────────────────────

declare function manualTrade(wallet: string, direction: 'buy' | 'sell', lamports: string, opts?: ManualTradeOptions): Promise<TradeResult>;

// ─── New API Methods ─────────────────────────────────────────

// Multi-trade
declare function multiTrade(req: MultiTradeRequest): Promise<MultiTradeResult>;

// Chart
declare function getChartHistory(opts: { mint: string; resolution: number; from?: number; to?: number }): Promise<OHLCVCandle[]>;
declare function getChartLatest(mint: string): Promise<{ price: number; marketCapSol: number; volume24h: number }>;

// GMGN
declare function getGmgnWallets(mint: string): Promise<GmgnWallet[]>;

// Wallet tracking
declare function trackWallet(address: string, label: string): Promise<{ id: string }>;
declare function untrackWallet(address: string): Promise<void>;
declare function getTrackedWallets(): Promise<TrackedWallet[]>;

// Burst events
declare function getBurstEvents(): Promise<BurstEventRuntime[]>;
declare function createBurstEvent(event: { triggerType: string; triggerValue: number; walletAddresses: string[]; amountPerWalletLamports: string; simultaneous: boolean }): Promise<{ id: string }>;
declare function triggerBurstEvent(id: string): Promise<void>;

// Analytics extended
declare function getPnLTimeSeries(opts?: { from?: number; to?: number; interval?: number }): Promise<PnLTimeSeriesPoint[]>;
declare function getAgentAnalytics(): Promise<AgentPnLRow[]>;
declare function getVolumeHourly(): Promise<VolumeHourly[]>;
declare function getCostBreakdown(): Promise<CostBreakdown>;
declare function getTradesPaginated(opts: { page: number; limit: number; direction?: string; role?: string; agent?: string }): Promise<{ trades: TradeEntry[]; total: number; page: number; totalPages: number }>;
declare function getWalletHoldings(): Promise<WalletHolding[]>;

// Session extended
declare function saveCurrentSession(name: string): Promise<{ sessionId: string }>;
declare function listSessions(): Promise<Array<{ id: string; name: string; createdAt: number; phase: string; mint: string | null; totalTrades: number; pnlSol: number }>>;
declare function resumeSession(id: string): Promise<void>;

// ─── New Components (Wave 2) ─────────────────────────────────

// Swarm Control (Prompt 5)
// SwarmControlBar:     (no props) — reads from useSwarmStore
// AgentCard:           { agent: Agent; onEdit: (id: string) => void; onManualTrade: (walletAddress: string) => void; recentTrades?: Array<{direction, timestamp}> }
// AgentGrid:           { onEditAgent: (id: string) => void; onManualTrade: (walletAddress: string) => void; agentTradeMap: Record<string, Array<{direction, timestamp}>> }
// AgentEditModal:      { agentId: string; onClose: () => void }
// ManualTradePanel:    { preselectedWallet?: string }
// SwarmVisualizer:     { agents: Agent[] } — ref: SwarmVisualizerHandle { triggerPulse(agentId, direction) }
// PhaseTimeline:       (no props) — reads from useSwarmStore

// Charts (Prompt 6)
// PriceChart:          { resolution: number; showAgentMarkers: boolean; showGraduationLine: boolean }
// DexScreenerEmbed:    (no props) — reads mint from useSwarmStore
// WalletTracker:       { onToggleChartOverlay?: (address: string, enabled: boolean) => void }

// Analytics (Prompt 7)
// PnLCard:             (no props) — fetches data internally
// VolumeChart:         (no props) — fetches data internally
// WalletBalances:      (no props) — fetches data internally
// TradeHistory:        (no props) — fetches data internally with pagination
// CostVsProfit:        (no props) — fetches data internally

// ─── Backend (Prompt 8) ─────────────────────────────────────

// db.ts exports:
// getDb(): Database
// uuid(): string
// now(): number
// createSession(db, walletPubkey, name, configJson): string
// getActiveSession(db, walletPubkey): Session | undefined
// listSessions(db, walletPubkey): Session[]
// updateSession(db, id, updates): void
// insertTrade(db, trade): string
// getTradesPaginated(db, sessionId, page, limit, filters?): { trades, total, page, totalPages }
// upsertCandle(db, sessionId, resolution, priceSol, volumeSol): void
// getCandles(db, sessionId, resolution, from?, to?): Candle[]
// updateCandlesFromTrade(db, sessionId, priceSol, volumeSol): void
// getTemplates(db, walletPubkey): Template[]
// createTemplate(db, walletPubkey, name, description, configJson): string
// deleteTemplate(db, id): void
// getBurstEvents(db, sessionId): BurstEvent[]
// createBurstEvent(db, sessionId, event): string
// markBurstTriggered(db, id): void
// getTrackedWallets(db, sessionId): TrackedWallet[]
// addTrackedWallet(db, sessionId, address, label, source): string
// removeTrackedWallet(db, address): void

// api-routes-extended.ts:
// registerExtendedRoutes(app: Hono): void

// balance-monitor.ts:
// class BalanceMonitor { setWalletProvider(fn); onLowBalance(handler); start(); stop(); }

// ─── SQLite Tables ───────────────────────────────────────────
// sessions, wallets, trades, candles, templates, burst_events, tracked_wallets, price_alerts

// ─── File Count Summary ──────────────────────────────────────
// Total TS/TSX files: 54
// Wave 1 (Prompts 1-4): 42 files
// Wave 2 (Prompts 5-8): 12 new files + 3 modified files (types/index.ts, lib/api.ts, swarm/page.tsx, analytics/page.tsx, charts/page.tsx)
