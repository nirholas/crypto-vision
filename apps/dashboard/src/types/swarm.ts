/**
 * Swarm Dashboard Types
 *
 * Frontend-safe type definitions mirroring the backend pump-agent-swarm types.
 * All BN values are serialized as numbers (SOL, already converted from lamports).
 */

// ─── Phases ───────────────────────────────────────────────────

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

export const SWARM_PHASES: SwarmPhase[] = [
  'idle',
  'initializing',
  'funding',
  'scanning',
  'evaluating',
  'creating_narrative',
  'minting',
  'bundling',
  'distributing',
  'trading',
  'market_making',
  'accumulating',
  'graduating',
  'exiting',
  'reclaiming',
  'completed',
  'paused',
  'error',
  'emergency_exit',
];

export const PHASE_LABELS: Record<SwarmPhase, string> = {
  idle: 'Idle',
  initializing: 'Initializing',
  funding: 'Funding',
  scanning: 'Scanning',
  evaluating: 'Evaluating',
  creating_narrative: 'Creating Narrative',
  minting: 'Minting',
  bundling: 'Bundling',
  distributing: 'Distributing',
  trading: 'Trading',
  market_making: 'Market Making',
  accumulating: 'Accumulating',
  graduating: 'Graduating',
  exiting: 'Exiting',
  reclaiming: 'Reclaiming',
  completed: 'Completed',
  paused: 'Paused',
  error: 'Error',
  emergency_exit: 'Emergency Exit',
};

// ─── Agent Types ──────────────────────────────────────────────

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

export type AgentStatus = 'active' | 'idle' | 'paused' | 'error' | 'stopped';

export const AGENT_ROLE_ICONS: Record<AgentRole, string> = {
  creator: '🏗️',
  trader: '📈',
  analyst: '🔬',
  sniper: '🎯',
  market_maker: '⚖️',
  volume_bot: '📊',
  accumulator: '🏦',
  exit_manager: '🚪',
  sentinel: '🛡️',
  scanner: '🔍',
  narrator: '🎙️',
};

export const AGENT_ROLE_LABELS: Record<AgentRole, string> = {
  creator: 'Creator',
  trader: 'Trader',
  analyst: 'Analyst',
  sniper: 'Sniper',
  market_maker: 'Market Maker',
  volume_bot: 'Volume Bot',
  accumulator: 'Accumulator',
  exit_manager: 'Exit Manager',
  sentinel: 'Sentinel',
  scanner: 'Scanner',
  narrator: 'Narrator',
};

// ─── API Response Envelope ────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: number;
  error?: string;
}

// ─── Status ───────────────────────────────────────────────────

export interface StatusResponse {
  phase: SwarmPhase;
  uptime: number;
  tokenMint: string | null;
  totalAgents: number;
  activeAgents: number;
  totalTrades: number;
  totalVolumeSol: number;
  currentPnl: number;
  startedAt: number | null;
}

// ─── Agents ───────────────────────────────────────────────────

export interface AgentSummary {
  id: string;
  type: AgentRole;
  status: AgentStatus;
  walletAddress: string;
  solBalance: number;
  tokenBalance: number;
  pnl: number;
  tradeCount: number;
  lastAction: string | null;
  uptime: number;
}

export interface AgentHistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  details: string;
  success: boolean;
  solAmount?: number;
  tokenAmount?: number;
  signature?: string;
}

export interface AgentPerformanceMetrics {
  totalTrades: number;
  successRate: number;
  avgTradeSize: number;
  winRate: number;
  totalPnl: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface AgentDetail {
  id: string;
  type: AgentRole;
  name: string;
  status: AgentStatus;
  walletAddress: string;
  solBalance: number;
  tokenBalance: number;
  totalBuys: number;
  totalSells: number;
  solSpent: number;
  solReceived: number;
  netPnl: number;
  createdAt: number;
  lastHeartbeat: number;
  config: Record<string, unknown>;
}

export interface AgentDetailResponse {
  detail: AgentDetail;
  history: AgentHistoryEntry[];
  performance: AgentPerformanceMetrics;
}

// ─── Trades ───────────────────────────────────────────────────

export type TradeDirection = 'buy' | 'sell';

export interface TradeEntry {
  id: string;
  timestamp: number;
  agentId: string;
  direction: TradeDirection;
  solAmount: number;
  tokenAmount: number;
  price: number;
  signature: string;
  success: boolean;
  slippage?: number;
}

export interface PaginatedTrades {
  trades: TradeEntry[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export interface TradeQuery {
  limit?: number;
  offset?: number;
  agent?: string;
  direction?: TradeDirection;
}

// ─── Trade Flow (Sankey) ──────────────────────────────────────

export interface SankeyNode {
  id: string;
  label: string;
  type: string;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  count: number;
}

export interface SankeyFlowData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

// ─── PnL ──────────────────────────────────────────────────────

export interface PnLDataPoint {
  timestamp: number;
  pnl: number;
  cumulativePnl: number;
  tradeCount: number;
}

export interface PnLTimeSeries {
  points: PnLDataPoint[];
  startTime: number;
  endTime: number;
}

export interface PnLSnapshot {
  totalPnl: number;
  roi: number;
  maxDrawdown: number;
  solSpent: number;
  solReceived: number;
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  winRate: number;
  avgTradeSize: number;
  bestTrade: number;
  worstTrade: number;
}

export interface PnLResponse {
  timeSeries: PnLTimeSeries;
  current: PnLSnapshot;
}

// ─── Supply Distribution ──────────────────────────────────────

export interface SupplyHolder {
  address: string;
  label: string;
  balance: number;
  percentage: number;
}

export interface SupplyDistribution {
  totalSupply: number;
  holders: SupplyHolder[];
  bondingCurveHeld: number;
  updatedAt: number;
}

// ─── Events ───────────────────────────────────────────────────

export type EventCategory =
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

export type EventSeverity = 'debug' | 'info' | 'warn' | 'error' | 'critical';

export interface TimelineEvent {
  id: string;
  type: string;
  category: EventCategory;
  severity: EventSeverity;
  source: string;
  message: string;
  payload: Record<string, unknown>;
  timestamp: number;
  correlationId?: string;
}

export interface EventQuery {
  limit?: number;
  offset?: number;
  categories?: EventCategory[];
  minSeverity?: EventSeverity;
  agent?: string;
  from?: number;
  to?: number;
  search?: string;
}

export interface PaginatedEvents {
  events: TimelineEvent[];
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

// ─── Config ───────────────────────────────────────────────────

export interface TokenConfig {
  name: string;
  symbol: string;
  metadataUri: string;
  vanityPrefix?: string;
}

export interface TradingStrategy {
  id: string;
  name: string;
  minIntervalSeconds: number;
  maxIntervalSeconds: number;
  minTradeSizeSol: number;
  maxTradeSizeSol: number;
  buySellRatio: number;
  maxMarketCapSol?: number;
  minMarketCapSol?: number;
  maxTotalBudgetSol: number;
  useJitoBundles: boolean;
  priorityFeeMicroLamports: number;
  maxTrades?: number;
  maxDurationSeconds?: number;
}

export interface SwarmConfig {
  rpcUrl: string;
  wsUrl?: string;
  traderCount: number;
  network: 'mainnet-beta' | 'devnet';
  token: TokenConfig;
  strategy: TradingStrategy;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  enableMetrics: boolean;
  dashboard?: {
    port: number;
    enableWebSocket: boolean;
    updateIntervalMs: number;
    publicAccess: boolean;
  };
}

export interface SwarmConfigResponse {
  config: SwarmConfig;
  schema: Record<string, unknown>;
}

// ─── Health ───────────────────────────────────────────────────

export interface HealthReport {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  agents: Array<{
    id: string;
    type: string;
    status: string;
    lastHeartbeat: number;
    errorCount: number;
  }>;
  metrics: {
    cpuUsage?: number;
    memoryUsage?: number;
    rpcLatency: number;
    eventBusBacklog: number;
  };
  checks: Array<{
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message: string;
  }>;
  timestamp: number;
}

// ─── Bonding Curve ────────────────────────────────────────────

export interface BondingCurveState {
  mint: string;
  virtualSolReserves: number;
  virtualTokenReserves: number;
  realSolReserves: number;
  realTokenReserves: number;
  complete: boolean;
  currentPriceSol: number;
  marketCapSol: number;
  graduationProgress: number;
}

// ─── Bundle ───────────────────────────────────────────────────

export type BundleStatus = 'planned' | 'executing' | 'completed' | 'failed' | 'partial';

export interface BundleParticipant {
  walletAddress: string;
  label: string;
  amountSol: number;
  delayMs: number;
  status: 'pending' | 'submitted' | 'confirmed' | 'failed';
  signature?: string;
  tokensReceived?: number;
}

export interface BundleRecord {
  id: string;
  mint?: string;
  creatorAddress: string;
  participants: BundleParticipant[];
  totalSolAllocated: number;
  targetSupplyPercent: number;
  useJito: boolean;
  status: BundleStatus;
  createdAt: number;
  executedAt?: number;
  antiDetectionScore?: number;
}

// ─── WebSocket Events ─────────────────────────────────────────

export type SwarmWSEventType =
  | 'trade:executed'
  | 'agent:status'
  | 'pnl:updated'
  | 'phase:changed'
  | 'health:report'
  | 'supply:updated'
  | 'bundle:status'
  | 'error';

export interface SwarmWSEvent<T = unknown> {
  type: SwarmWSEventType;
  data: T;
  timestamp: number;
}

export interface TradeExecutedEvent {
  id: string;
  agentId: string;
  direction: TradeDirection;
  solAmount: number;
  tokenAmount: number;
  price: number;
  signature: string;
  success: boolean;
}

export interface AgentStatusEvent {
  agentId: string;
  status: AgentStatus;
  solBalance: number;
  tokenBalance: number;
  tradeCount: number;
}

export interface PnLUpdatedEvent {
  totalPnl: number;
  roi: number;
  currentPrice: number;
  volume24h: number;
}

export interface PhaseChangedEvent {
  from: SwarmPhase;
  to: SwarmPhase;
  reason?: string;
}

// ─── Preset Strategies ────────────────────────────────────────

export type PresetStrategyId = 'organic' | 'volume' | 'graduation' | 'exit';

export interface PresetStrategy {
  id: PresetStrategyId;
  name: string;
  description: string;
  icon: string;
  strategy: Partial<TradingStrategy>;
}

export const PRESET_STRATEGIES: PresetStrategy[] = [
  {
    id: 'organic',
    name: 'Organic Growth',
    description: 'Slow, natural-looking trading pattern with varied intervals and sizes. Minimizes detection risk.',
    icon: '🌱',
    strategy: {
      minIntervalSeconds: 30,
      maxIntervalSeconds: 180,
      buySellRatio: 1.2,
      useJitoBundles: true,
    },
  },
  {
    id: 'volume',
    name: 'Volume Push',
    description: 'Aggressive volume generation to attract attention. Higher frequency with balanced buys/sells.',
    icon: '🚀',
    strategy: {
      minIntervalSeconds: 5,
      maxIntervalSeconds: 30,
      buySellRatio: 1.0,
      useJitoBundles: true,
    },
  },
  {
    id: 'graduation',
    name: 'Graduation Sprint',
    description: 'Focused on reaching bonding curve graduation. Heavy buy pressure with strategic sells.',
    icon: '🎓',
    strategy: {
      minIntervalSeconds: 10,
      maxIntervalSeconds: 60,
      buySellRatio: 2.0,
      useJitoBundles: true,
    },
  },
  {
    id: 'exit',
    name: 'Strategic Exit',
    description: 'Gradual position unwinding to minimize price impact. Slow sells with occasional buys.',
    icon: '🚪',
    strategy: {
      minIntervalSeconds: 60,
      maxIntervalSeconds: 300,
      buySellRatio: 0.3,
      useJitoBundles: false,
    },
  },
];

// ─── Formatting Helpers ───────────────────────────────────────

/** Format SOL with 4 decimal places */
export function formatSol(value: number): string {
  return `${value.toFixed(4)} SOL`;
}

/** Format USD with 2 decimal places */
export function formatUsd(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** Format percentage */
export function formatPct(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

/** Format timestamp to relative time */
export function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/** Format uptime seconds to human-readable */
export function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Build a Solscan transaction URL */
export function solscanTxUrl(signature: string, network: 'mainnet-beta' | 'devnet' = 'mainnet-beta'): string {
  const base = 'https://solscan.io/tx';
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `${base}/${signature}${cluster}`;
}

/** Build a Solscan address URL */
export function solscanAddressUrl(address: string, network: 'mainnet-beta' | 'devnet' = 'mainnet-beta'): string {
  const base = 'https://solscan.io/account';
  const cluster = network === 'devnet' ? '?cluster=devnet' : '';
  return `${base}/${address}${cluster}`;
}
