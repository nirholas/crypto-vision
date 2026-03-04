/**
 * Trade Visualizer — Formats raw trade data into visualization-ready structures
 *
 * Features:
 * - Sankey flow diagrams (agent → agent trade flows)
 * - NxN agent interaction matrices (volume & count)
 * - Chronological trade timelines with filtering
 * - Price chart data with trade markers overlaid
 * - Volume bar charts with configurable intervals
 * - Aggregate trade statistics (mean, median, totals)
 * - Auto-ingestion from event bus (trade:executed)
 * - FIFO eviction at 50,000 trades to bound memory
 */

import { v4 as uuidv4 } from 'uuid';

import type { SwarmEventBus } from '../infra/event-bus.js';
import type { SwarmEvent } from '../types.js';
import { SwarmLogger } from '../infra/logger.js';
import type { TradeRecord as BaseTradeRecord, TradeVisualizerAdapter } from './export-manager.js';

// ─── Constants ────────────────────────────────────────────────

const MAX_TRADES = 50_000;
const DEFAULT_VOLUME_INTERVAL_MS = 60_000;

/** Palette for agent nodes in Sankey diagrams */
const AGENT_COLORS: readonly string[] = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2',
  '#59a14f', '#edc948', '#b07aa1', '#ff9da7',
  '#9c755f', '#bab0ac', '#af7aa1', '#86bcb6',
];

// ─── Interfaces ───────────────────────────────────────────────

export interface TradeRecord extends BaseTradeRecord {
  /** Agent wallet address */
  walletAddress: string;
  /** Priority fee paid (lamports) */
  priorityFee: number;
  /** Counterparty agent ID if internal trade */
  counterpartyAgentId?: string;
}

export interface TimeRange {
  /** Start timestamp (inclusive) */
  start: number;
  /** End timestamp (inclusive) */
  end: number;
}

// ─── Sankey Flow ──────────────────────────────────────────────

export interface TradeFlowNode {
  /** Agent identifier */
  id: string;
  /** Display label */
  label: string;
  /** Agent role/type */
  type: string;
  /** Total SOL volume through this node */
  totalVolume: number;
  /** Total trade count */
  tradeCount: number;
  /** Palette color */
  color: string;
}

export interface TradeFlowLink {
  /** Source agent ID */
  source: string;
  /** Target agent ID */
  target: string;
  /** SOL volume across the link */
  value: number;
  /** Number of trades across the link */
  tradeCount: number;
  /** Dominant direction */
  direction: 'buy' | 'sell';
}

export interface TradeFlowData {
  /** Nodes represent agents */
  nodes: TradeFlowNode[];
  /** Links represent trades between agents */
  links: TradeFlowLink[];
  /** Total volume in SOL */
  totalVolume: number;
  /** Time range covered */
  timeRange: TimeRange;
}

// ─── Interaction Matrix ───────────────────────────────────────

export interface AgentInteractionMatrix {
  /** Agent IDs in row/column order */
  agents: string[];
  /** NxN matrix of SOL volume between agents */
  volumeMatrix: number[][];
  /** NxN matrix of trade counts between agents */
  countMatrix: number[][];
}

// ─── Timeline ─────────────────────────────────────────────────

export interface TradeTimelineEntry {
  /** Trade ID */
  id: string;
  /** Execution timestamp */
  timestamp: number;
  /** Agent that executed */
  agentId: string;
  /** Buy or sell */
  direction: 'buy' | 'sell';
  /** SOL amount */
  solAmount: number;
  /** Token amount */
  tokenAmount: number;
  /** Execution price */
  price: number;
  /** Slippage from expected */
  slippage: number;
  /** Transaction signature */
  signature: string;
  /** Whether trade succeeded */
  success: boolean;
  /** Counterparty (if internal) */
  counterpartyAgentId?: string;
}

// ─── Price Chart ──────────────────────────────────────────────

export interface PriceChartData {
  /** Price points over time */
  prices: Array<{ timestamp: number; price: number }>;
  /** Trade markers overlaid on price chart */
  tradeMarkers: Array<{
    timestamp: number;
    price: number;
    direction: 'buy' | 'sell';
    agentId: string;
    solAmount: number;
  }>;
  /** Current price */
  currentPrice: number;
  /** Price high */
  high: number;
  /** Price low */
  low: number;
}

// ─── Volume Chart ─────────────────────────────────────────────

export interface VolumeChartData {
  /** Volume bars aggregated by interval */
  bars: Array<{
    timestamp: number;
    buyVolume: number;
    sellVolume: number;
    netVolume: number;
    tradeCount: number;
  }>;
  /** Bar interval in ms */
  intervalMs: number;
}

// ─── Statistics ───────────────────────────────────────────────

export interface TradeStatistics {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalBuyVolumeSol: number;
  totalSellVolumeSol: number;
  averageTradeSize: number;
  medianTradeSize: number;
  largestTrade: number;
  averageSlippage: number;
  totalFeesLamports: number;
  uniqueAgents: number;
  tradesPerMinute: number;
  firstTradeAt: number;
  lastTradeAt: number;
}

// ─── Config ───────────────────────────────────────────────────

export interface TradeVisualizerConfig {
  /** Maximum trades retained in memory (default: 50,000) */
  maxTrades: number;
  /** Volume bar interval in ms (default: 60,000) */
  volumeIntervalMs: number;
}

// ─── Internal helpers ─────────────────────────────────────────

/** Incrementally maintained interaction index for O(1) matrix updates */
interface InteractionCell {
  volume: number;
  count: number;
}

// ─── Trade Visualizer ─────────────────────────────────────────

/**
 * Formats raw trade data into visualization-ready structures for the dashboard.
 *
 * Subscribes to `trade:executed` on the {@link SwarmEventBus} and auto-ingests
 * trades into an in-memory ring buffer (FIFO eviction at {@link MAX_TRADES}).
 *
 * Implements {@link TradeVisualizerAdapter} so the export manager can pull
 * trade records for CSV/JSON/Markdown exports.
 */
export class TradeVisualizer implements TradeVisualizerAdapter {
  private readonly logger: SwarmLogger;
  private readonly trades: TradeRecord[] = [];
  private readonly subscriptionIds: string[] = [];

  /** agent pair key → interaction cell (incrementally maintained) */
  private readonly interactions = new Map<string, InteractionCell>();
  /** ordered set of agent IDs seen so far */
  private readonly agentIndex = new Map<string, number>();

  private readonly maxTrades: number;
  private readonly volumeIntervalMs: number;

  // ── Constructor ───────────────────────────────────────────

  constructor(
    private readonly eventBus: SwarmEventBus,
    config?: Partial<TradeVisualizerConfig>,
  ) {
    this.maxTrades = config?.maxTrades ?? MAX_TRADES;
    this.volumeIntervalMs = config?.volumeIntervalMs ?? DEFAULT_VOLUME_INTERVAL_MS;
    this.logger = SwarmLogger.create('trade-visualizer', 'trading');

    this.subscribeToEvents();
    this.logger.info('Trade visualizer initialised', {
      maxTrades: this.maxTrades,
      volumeIntervalMs: this.volumeIntervalMs,
    });
  }

  // ── Event Bus Wiring ──────────────────────────────────────

  private subscribeToEvents(): void {
    const tradeSubId = this.eventBus.subscribe(
      'trade:executed',
      (event: SwarmEvent) => {
        this.ingestFromEvent(event);
      },
    );
    this.subscriptionIds.push(tradeSubId);
  }

  /**
   * Map a `trade:executed` SwarmEvent payload into a {@link TradeRecord}
   * and feed it into {@link recordTrade}.
   */
  private ingestFromEvent(event: SwarmEvent): void {
    const p = event.payload as Record<string, unknown>;

    const trade: TradeRecord = {
      id: (p['id'] as string | undefined) ?? uuidv4(),
      signature: (p['signature'] as string | undefined) ?? '',
      timestamp: (p['timestamp'] as number | undefined) ?? event.timestamp,
      agentId: (p['agentId'] as string | undefined) ?? event.source,
      walletAddress: (p['walletAddress'] as string | undefined) ?? '',
      direction: (p['direction'] as 'buy' | 'sell' | undefined) ?? 'buy',
      solAmount: (p['solAmount'] as number | undefined) ?? 0,
      tokenAmount: (p['tokenAmount'] as number | undefined) ?? 0,
      price: (p['price'] as number | undefined) ?? 0,
      slippage: (p['slippage'] as number | undefined) ?? 0,
      priorityFee: (p['priorityFee'] as number | undefined) ?? 0,
      success: (p['success'] as boolean | undefined) ?? true,
      counterpartyAgentId: p['counterpartyAgentId'] as string | undefined,
    };

    this.recordTrade(trade);
  }

  // ── Public API ────────────────────────────────────────────

  /**
   * Ingest a new trade. Maintains the FIFO buffer, interaction matrix,
   * and agent index.
   */
  recordTrade(trade: TradeRecord): void {
    // Evict oldest trade if at capacity
    if (this.trades.length >= this.maxTrades) {
      const evicted = this.trades.shift();
      if (evicted) {
        this.removeFromInteractionMatrix(evicted);
      }
    }

    this.trades.push(trade);
    this.ensureAgentIndexed(trade.agentId);
    if (trade.counterpartyAgentId) {
      this.ensureAgentIndexed(trade.counterpartyAgentId);
    }
    this.addToInteractionMatrix(trade);
  }

  /**
   * Return trades formatted for the export-manager adapter contract.
   */
  getTrades(): TradeRecord[] {
    return this.trades.slice();
  }

  // ── Sankey Flow Diagram ───────────────────────────────────

  /**
   * Build Sankey flow diagram data from trades in the given time range.
   * Nodes are agents; links are aggregate directional flows between them.
   */
  getTradeFlow(timeRange?: TimeRange): TradeFlowData {
    const filtered = timeRange ? this.filterByTime(timeRange) : this.trades;

    const nodeMap = new Map<string, TradeFlowNode>();
    const linkKey = (src: string, tgt: string): string => `${src}→${tgt}`;
    const linkMap = new Map<string, TradeFlowLink>();
    let totalVolume = 0;

    for (const t of filtered) {
      if (!t.success) continue;

      // Source node (the agent)
      this.upsertFlowNode(nodeMap, t.agentId, t.solAmount);

      // If there's a counterparty, create a link
      if (t.counterpartyAgentId) {
        this.upsertFlowNode(nodeMap, t.counterpartyAgentId, t.solAmount);

        const src = t.direction === 'buy' ? t.counterpartyAgentId : t.agentId;
        const tgt = t.direction === 'buy' ? t.agentId : t.counterpartyAgentId;
        const key = linkKey(src, tgt);

        const existing = linkMap.get(key);
        if (existing) {
          existing.value += t.solAmount;
          existing.tradeCount += 1;
        } else {
          linkMap.set(key, {
            source: src,
            target: tgt,
            value: t.solAmount,
            tradeCount: 1,
            direction: t.direction,
          });
        }
      }

      totalVolume += t.solAmount;
    }

    const timeRangeResult = this.computeTimeRange(filtered);

    return {
      nodes: [...nodeMap.values()],
      links: [...linkMap.values()],
      totalVolume,
      timeRange: timeRangeResult,
    };
  }

  // ── Interaction Matrix ────────────────────────────────────

  /**
   * Return the NxN agent interaction matrix built from all recorded trades.
   * Row/column order follows agent discovery order.
   */
  getAgentInteractions(): AgentInteractionMatrix {
    const agents = [...this.agentIndex.keys()];
    const n = agents.length;
    const volumeMatrix: number[][] = Array.from({ length: n }, () =>
      new Array<number>(n).fill(0),
    );
    const countMatrix: number[][] = Array.from({ length: n }, () =>
      new Array<number>(n).fill(0),
    );

    for (const [key, cell] of this.interactions) {
      const [a, b] = key.split('↔');
      const i = this.agentIndex.get(a);
      const j = this.agentIndex.get(b);
      if (i === undefined || j === undefined) continue;
      volumeMatrix[i][j] = cell.volume;
      volumeMatrix[j][i] = cell.volume;
      countMatrix[i][j] = cell.count;
      countMatrix[j][i] = cell.count;
    }

    return { agents, volumeMatrix, countMatrix };
  }

  // ── Trade Timeline ────────────────────────────────────────

  /**
   * Return the most recent trades as timeline entries, newest first.
   */
  getTradeTimeline(limit: number): TradeTimelineEntry[] {
    const start = Math.max(0, this.trades.length - limit);
    const slice = this.trades.slice(start);
    const entries: TradeTimelineEntry[] = [];

    for (let i = slice.length - 1; i >= 0; i--) {
      const t = slice[i];
      entries.push({
        id: t.id,
        timestamp: t.timestamp,
        agentId: t.agentId,
        direction: t.direction as 'buy' | 'sell',
        solAmount: t.solAmount,
        tokenAmount: t.tokenAmount,
        price: t.price,
        slippage: t.slippage ?? 0,
        signature: t.signature,
        success: t.success,
        counterpartyAgentId: t.counterpartyAgentId,
      });
    }

    return entries;
  }

  // ── Price Chart ───────────────────────────────────────────

  /**
   * Build price time-series with trade markers overlaid.
   * Each successful trade contributes a price point and a marker.
   */
  getPriceChart(): PriceChartData {
    const prices: PriceChartData['prices'] = [];
    const tradeMarkers: PriceChartData['tradeMarkers'] = [];

    let high = -Infinity;
    let low = Infinity;
    let currentPrice = 0;

    for (const t of this.trades) {
      if (!t.success || t.price <= 0) continue;

      prices.push({ timestamp: t.timestamp, price: t.price });
      tradeMarkers.push({
        timestamp: t.timestamp,
        price: t.price,
        direction: t.direction as 'buy' | 'sell',
        agentId: t.agentId,
        solAmount: t.solAmount,
      });

      if (t.price > high) high = t.price;
      if (t.price < low) low = t.price;
      currentPrice = t.price;
    }

    // Handle empty/no-price edge case
    if (high === -Infinity) high = 0;
    if (low === Infinity) low = 0;

    return { prices, tradeMarkers, currentPrice, high, low };
  }

  // ── Volume Chart ──────────────────────────────────────────

  /**
   * Aggregate trade volume into fixed-interval bars.
   * Each bar contains buy volume, sell volume, net volume, and trade count.
   */
  getVolumeChart(): VolumeChartData {
    if (this.trades.length === 0) {
      return { bars: [], intervalMs: this.volumeIntervalMs };
    }

    const successfulTrades = this.trades.filter((t) => t.success);
    if (successfulTrades.length === 0) {
      return { bars: [], intervalMs: this.volumeIntervalMs };
    }

    const first = successfulTrades[0].timestamp;
    const last = successfulTrades[successfulTrades.length - 1].timestamp;

    // Snap to interval boundaries
    const startBucket = Math.floor(first / this.volumeIntervalMs) * this.volumeIntervalMs;
    const endBucket = Math.floor(last / this.volumeIntervalMs) * this.volumeIntervalMs;

    // Pre-allocate bar map
    const barMap = new Map<
      number,
      { buyVolume: number; sellVolume: number; tradeCount: number }
    >();
    for (let ts = startBucket; ts <= endBucket; ts += this.volumeIntervalMs) {
      barMap.set(ts, { buyVolume: 0, sellVolume: 0, tradeCount: 0 });
    }

    for (const t of successfulTrades) {
      const bucket =
        Math.floor(t.timestamp / this.volumeIntervalMs) * this.volumeIntervalMs;
      const bar = barMap.get(bucket);
      if (!bar) continue;

      if (t.direction === 'buy') {
        bar.buyVolume += t.solAmount;
      } else {
        bar.sellVolume += t.solAmount;
      }
      bar.tradeCount += 1;
    }

    const bars: VolumeChartData['bars'] = [];
    for (const [timestamp, bar] of barMap) {
      bars.push({
        timestamp,
        buyVolume: bar.buyVolume,
        sellVolume: bar.sellVolume,
        netVolume: bar.buyVolume - bar.sellVolume,
        tradeCount: bar.tradeCount,
      });
    }

    // Already ordered by timestamp because Map insertion is ordered
    return { bars, intervalMs: this.volumeIntervalMs };
  }

  // ── Trade Statistics ──────────────────────────────────────

  /**
   * Compute aggregate statistics across all recorded trades.
   */
  getTradeStats(): TradeStatistics {
    const total = this.trades.length;
    if (total === 0) {
      return this.emptyStats();
    }

    let successfulTrades = 0;
    let failedTrades = 0;
    let totalBuyVolumeSol = 0;
    let totalSellVolumeSol = 0;
    let totalSlippage = 0;
    let slippageCount = 0;
    let totalFeesLamports = 0;
    let largestTrade = 0;
    const tradeSizes: number[] = [];
    const agentSet = new Set<string>();

    const firstTradeAt = this.trades[0].timestamp;
    const lastTradeAt = this.trades[total - 1].timestamp;

    for (const t of this.trades) {
      if (t.success) {
        successfulTrades++;
      } else {
        failedTrades++;
      }

      if (t.direction === 'buy') {
        totalBuyVolumeSol += t.solAmount;
      } else {
        totalSellVolumeSol += t.solAmount;
      }

      if (t.slippage !== undefined && t.slippage !== 0) {
        totalSlippage += Math.abs(t.slippage);
        slippageCount++;
      }

      totalFeesLamports += t.priorityFee;
      tradeSizes.push(t.solAmount);
      if (t.solAmount > largestTrade) largestTrade = t.solAmount;
      agentSet.add(t.agentId);
    }

    const averageTradeSize =
      tradeSizes.length > 0
        ? tradeSizes.reduce((a, b) => a + b, 0) / tradeSizes.length
        : 0;

    const medianTradeSize = this.median(tradeSizes);

    const averageSlippage = slippageCount > 0 ? totalSlippage / slippageCount : 0;

    const durationMinutes = (lastTradeAt - firstTradeAt) / 60_000;
    const tradesPerMinute = durationMinutes > 0 ? total / durationMinutes : total;

    return {
      totalTrades: total,
      successfulTrades,
      failedTrades,
      totalBuyVolumeSol,
      totalSellVolumeSol,
      averageTradeSize,
      medianTradeSize,
      largestTrade,
      averageSlippage,
      totalFeesLamports,
      uniqueAgents: agentSet.size,
      tradesPerMinute,
      firstTradeAt,
      lastTradeAt,
    };
  }

  // ── Reset ─────────────────────────────────────────────────

  /**
   * Clear all stored trades, interaction state, and agent index.
   */
  clear(): void {
    this.trades.length = 0;
    this.interactions.clear();
    this.agentIndex.clear();
    this.logger.info('Trade visualizer cleared');
  }

  // ── Cleanup ───────────────────────────────────────────────

  /**
   * Unsubscribe from event bus and release resources.
   */
  destroy(): void {
    for (const id of this.subscriptionIds) {
      this.eventBus.unsubscribe(id);
    }
    this.subscriptionIds.length = 0;
    this.clear();
    this.logger.info('Trade visualizer destroyed');
  }

  // ── Private Helpers ───────────────────────────────────────

  private filterByTime(range: TimeRange): TradeRecord[] {
    return this.trades.filter(
      (t) => t.timestamp >= range.start && t.timestamp <= range.end,
    );
  }

  private computeTimeRange(trades: TradeRecord[]): TimeRange {
    if (trades.length === 0) {
      const now = Date.now();
      return { start: now, end: now };
    }
    return {
      start: trades[0].timestamp,
      end: trades[trades.length - 1].timestamp,
    };
  }

  /** Ensure an agent is registered in the ordered index. */
  private ensureAgentIndexed(agentId: string): void {
    if (!this.agentIndex.has(agentId)) {
      this.agentIndex.set(agentId, this.agentIndex.size);
    }
  }

  /** Canonical key for an unordered agent pair. */
  private pairKey(a: string, b: string): string {
    return a < b ? `${a}↔${b}` : `${b}↔${a}`;
  }

  /** Increment the interaction matrix for a trade with a counterparty. */
  private addToInteractionMatrix(trade: TradeRecord): void {
    if (!trade.counterpartyAgentId) return;
    const key = this.pairKey(trade.agentId, trade.counterpartyAgentId);
    const cell = this.interactions.get(key) ?? { volume: 0, count: 0 };
    cell.volume += trade.solAmount;
    cell.count += 1;
    this.interactions.set(key, cell);
  }

  /** Decrement the interaction matrix when evicting a trade. */
  private removeFromInteractionMatrix(trade: TradeRecord): void {
    if (!trade.counterpartyAgentId) return;
    const key = this.pairKey(trade.agentId, trade.counterpartyAgentId);
    const cell = this.interactions.get(key);
    if (!cell) return;
    cell.volume -= trade.solAmount;
    cell.count -= 1;
    if (cell.count <= 0) {
      this.interactions.delete(key);
    }
  }

  /** Upsert a flow node in the Sankey node map. */
  private upsertFlowNode(
    map: Map<string, TradeFlowNode>,
    agentId: string,
    volume: number,
  ): void {
    const existing = map.get(agentId);
    if (existing) {
      existing.totalVolume += volume;
      existing.tradeCount += 1;
    } else {
      const idx = this.agentIndex.get(agentId) ?? map.size;
      map.set(agentId, {
        id: agentId,
        label: agentId,
        type: 'agent',
        totalVolume: volume,
        tradeCount: 1,
        color: AGENT_COLORS[idx % AGENT_COLORS.length],
      });
    }
  }

  /** Compute median of a numeric array (sorts a copy). */
  private median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /** Return zeroed-out statistics for empty datasets. */
  private emptyStats(): TradeStatistics {
    return {
      totalTrades: 0,
      successfulTrades: 0,
      failedTrades: 0,
      totalBuyVolumeSol: 0,
      totalSellVolumeSol: 0,
      averageTradeSize: 0,
      medianTradeSize: 0,
      largestTrade: 0,
      averageSlippage: 0,
      totalFeesLamports: 0,
      uniqueAgents: 0,
      tradesPerMinute: 0,
      firstTradeAt: 0,
      lastTradeAt: 0,
    };
  }
}
