/**
 * P&L Dashboard — Real-time profit & loss tracking with time-series data
 *
 * Features:
 * - FIFO cost basis tracking per agent
 * - Realized + unrealized P&L calculation
 * - Time-series sampling for charting
 * - Per-agent breakdown with trade-level granularity
 * - Peak/trough/drawdown tracking
 * - Event bus integration (trade:executed, price:updated)
 */

import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Interfaces ───────────────────────────────────────────────

export interface PnLConfig {
  /** Sampling interval for time series (default: 10000ms) */
  samplingIntervalMs: number;
  /** Max data points to retain (default: 8640 — 24h at 10s) */
  maxDataPoints: number;
  /** Initial investment in SOL for ROI calculation */
  initialInvestment: number;
}

export interface PnLTrade {
  direction: 'buy' | 'sell';
  solAmount: number;
  tokenAmount: number;
  price: number;
  timestamp: number;
  fee: number;
}

export interface PnLDataPoint {
  timestamp: number;
  /** Realized P&L (SOL from completed sells minus cost basis) */
  realized: number;
  /** Unrealized P&L (current value of held tokens minus cost basis) */
  unrealized: number;
  /** Total P&L (realized + unrealized) */
  total: number;
  /** Cumulative invested */
  invested: number;
  /** Cumulative returned */
  returned: number;
  /** ROI percentage */
  roi: number;
}

export interface PnLTimeSeries {
  /** Time series data points */
  points: PnLDataPoint[];
  /** Current snapshot */
  current: PnLDataPoint;
  /** Peak P&L */
  peak: number;
  /** Trough P&L */
  trough: number;
  /** Max drawdown from peak */
  maxDrawdown: number;
  /** Max drawdown percentage */
  maxDrawdownPercent: number;
}

export interface PnLSnapshot {
  timestamp: number;
  totalRealized: number;
  totalUnrealized: number;
  totalPnl: number;
  roi: number;
  totalInvested: number;
  totalReturned: number;
  tokensHeld: number;
  currentPrice: number;
  costBasis: number;
  maxDrawdown: number;
  agentBreakdown: Array<{
    agentId: string;
    realized: number;
    unrealized: number;
    total: number;
    tradeCount: number;
  }>;
}

// ─── Internal Types ───────────────────────────────────────────

/** FIFO lot used for cost basis tracking */
interface CostBasisLot {
  tokenAmount: number;
  costPerToken: number;
  timestamp: number;
}

/** Per-agent P&L state */
interface AgentPnLState {
  /** FIFO queue of open lots (oldest first) */
  lots: CostBasisLot[];
  /** Cumulative realized P&L in SOL */
  realized: number;
  /** Total SOL spent on buys (including fees) */
  totalInvested: number;
  /** Total SOL received from sells (net of fees) */
  totalReturned: number;
  /** Total tokens currently held across all lots */
  tokensHeld: number;
  /** Total cost basis of held tokens */
  costBasisHeld: number;
  /** Number of trades executed */
  tradeCount: number;
}

// ─── Default Config ───────────────────────────────────────────

const DEFAULT_CONFIG: PnLConfig = {
  samplingIntervalMs: 10_000,
  maxDataPoints: 8_640,
  initialInvestment: 0,
};

// ─── PnLDashboard ─────────────────────────────────────────────

export class PnLDashboard {
  private readonly config: PnLConfig;
  private readonly logger: SwarmLogger;
  private readonly eventBus: SwarmEventBus;

  /** Per-agent P&L state */
  private readonly agents = new Map<string, AgentPnLState>();

  /** Time-series data points (ring buffer) */
  private readonly timeSeriesPoints: PnLDataPoint[] = [];

  /** Current token price in SOL */
  private currentPrice = 0;

  /** Peak total P&L ever observed */
  private peakPnL = 0;

  /** Trough total P&L ever observed */
  private troughPnL = 0;

  /** Max drawdown from peak (absolute SOL) */
  private maxDrawdownAbs = 0;

  /** Max drawdown from peak (percentage) */
  private maxDrawdownPct = 0;

  /** Sampling timer handle */
  private samplingTimer: ReturnType<typeof setInterval> | null = null;

  /** Event bus subscription IDs for cleanup */
  private subscriptionIds: string[] = [];

  constructor(eventBus: SwarmEventBus, config?: Partial<PnLConfig>) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = SwarmLogger.create('pnl-dashboard', 'analytics');

    this.subscribeToEvents();
    this.logger.info('PnL Dashboard initialized', {
      samplingIntervalMs: this.config.samplingIntervalMs,
      maxDataPoints: this.config.maxDataPoints,
      initialInvestment: this.config.initialInvestment,
    });
  }

  // ─── Public API ───────────────────────────────────────────

  /** Ingest a trade for P&L tracking */
  recordTrade(agentId: string, trade: PnLTrade): void {
    const state = this.getOrCreateAgentState(agentId);
    state.tradeCount++;

    if (trade.direction === 'buy') {
      this.recordBuy(state, trade);
    } else {
      this.recordSell(state, trade);
    }

    this.updateDrawdown();
    this.logger.debug('Trade recorded', {
      agentId,
      direction: trade.direction,
      solAmount: trade.solAmount,
      tokenAmount: trade.tokenAmount,
      price: trade.price,
    });
  }

  /** Update current token price for unrealized P&L calculations */
  updatePrice(currentPrice: number): void {
    this.currentPrice = currentPrice;
    this.updateDrawdown();
  }

  /** Get aggregate portfolio P&L time series */
  getAggregatePnL(): PnLTimeSeries {
    return {
      points: [...this.timeSeriesPoints],
      current: this.buildCurrentDataPoint(),
      peak: this.peakPnL,
      trough: this.troughPnL,
      maxDrawdown: this.maxDrawdownAbs,
      maxDrawdownPercent: this.maxDrawdownPct,
    };
  }

  /** Get P&L time series per agent */
  getPerAgentPnL(): Map<string, PnLTimeSeries> {
    const result = new Map<string, PnLTimeSeries>();

    for (const [agentId, state] of this.agents) {
      const unrealized = this.calculateUnrealized(state);
      const total = state.realized + unrealized;
      const invested = state.totalInvested;
      const returned = state.totalReturned;
      const roi = this.calculateROI(total, invested);

      const current: PnLDataPoint = {
        timestamp: Date.now(),
        realized: state.realized,
        unrealized,
        total,
        invested,
        returned,
        roi,
      };

      // Per-agent series: we track aggregate time series, not per-agent,
      // so return current snapshot only (per-agent historical data would
      // require separate ring buffers — can be added if needed).
      result.set(agentId, {
        points: [current],
        current,
        peak: total,
        trough: total,
        maxDrawdown: 0,
        maxDrawdownPercent: 0,
      });
    }

    return result;
  }

  /** Get total realized P&L in SOL */
  getRealized(): number {
    let total = 0;
    for (const state of this.agents.values()) {
      total += state.realized;
    }
    return total;
  }

  /** Get total unrealized P&L in SOL */
  getUnrealized(): number {
    let total = 0;
    for (const state of this.agents.values()) {
      total += this.calculateUnrealized(state);
    }
    return total;
  }

  /** Get current return on investment as percentage */
  getCurrentROI(): number {
    const totalPnl = this.getRealized() + this.getUnrealized();
    const invested = this.getTotalInvested();
    return this.calculateROI(totalPnl, invested);
  }

  /** Get a full snapshot of current P&L state */
  getSnapshot(): PnLSnapshot {
    const realized = this.getRealized();
    const unrealized = this.getUnrealized();
    const totalPnl = realized + unrealized;
    const invested = this.getTotalInvested();
    const returned = this.getTotalReturned();
    const tokensHeld = this.getTotalTokensHeld();
    const costBasis = this.getTotalCostBasis();

    const agentBreakdown: PnLSnapshot['agentBreakdown'] = [];
    for (const [agentId, state] of this.agents) {
      const agentUnrealized = this.calculateUnrealized(state);
      agentBreakdown.push({
        agentId,
        realized: state.realized,
        unrealized: agentUnrealized,
        total: state.realized + agentUnrealized,
        tradeCount: state.tradeCount,
      });
    }

    return {
      timestamp: Date.now(),
      totalRealized: realized,
      totalUnrealized: unrealized,
      totalPnl,
      roi: this.calculateROI(totalPnl, invested),
      totalInvested: invested,
      totalReturned: returned,
      tokensHeld,
      currentPrice: this.currentPrice,
      costBasis,
      maxDrawdown: this.maxDrawdownAbs,
      agentBreakdown,
    };
  }

  /** Get total SOL spent on buys across all agents */
  getTotalInvested(): number {
    let total = 0;
    for (const state of this.agents.values()) {
      total += state.totalInvested;
    }
    return total;
  }

  /** Get total SOL received from sells across all agents */
  getTotalReturned(): number {
    let total = 0;
    for (const state of this.agents.values()) {
      total += state.totalReturned;
    }
    return total;
  }

  /** Start periodic P&L sampling for time-series data */
  startSampling(intervalMs?: number): void {
    if (this.samplingTimer !== null) {
      this.logger.warn('Sampling already active — stopping previous timer');
      this.stopSampling();
    }

    const interval = intervalMs ?? this.config.samplingIntervalMs;

    this.samplingTimer = setInterval(() => {
      this.sampleDataPoint();
    }, interval);

    // Take an immediate sample
    this.sampleDataPoint();

    this.logger.info('P&L sampling started', { intervalMs: interval });
  }

  /** Stop periodic P&L sampling */
  stopSampling(): void {
    if (this.samplingTimer !== null) {
      clearInterval(this.samplingTimer);
      this.samplingTimer = null;
      this.logger.info('P&L sampling stopped');
    }
  }

  /** Unsubscribe from event bus and stop sampling — clean shutdown */
  destroy(): void {
    this.stopSampling();
    for (const subId of this.subscriptionIds) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptionIds = [];
    this.logger.info('PnL Dashboard destroyed');
  }

  // ─── Event Bus Integration ────────────────────────────────

  private subscribeToEvents(): void {
    // Subscribe to trade execution events
    const tradeSub = this.eventBus.subscribe(
      'trade:executed',
      (event) => {
        const payload = event.payload as Record<string, unknown>;
        const agentId = event.source ?? 'unknown';

        // Extract trade data from event payload
        const direction = payload['direction'] as 'buy' | 'sell' | undefined;
        const solAmount = this.toNumber(payload['solAmount']);
        const tokensReceived = this.toNumber(payload['tokensReceived']);
        const tokensSold = this.toNumber(payload['tokensSold']);
        const price = this.toNumber(payload['price']);
        const fee = this.toNumber(payload['fee']);

        if (direction && solAmount > 0) {
          const trade: PnLTrade = {
            direction,
            solAmount,
            tokenAmount: direction === 'buy' ? tokensReceived : tokensSold,
            price: price > 0 ? price : (solAmount / (direction === 'buy' ? tokensReceived : tokensSold)) || 0,
            timestamp: event.timestamp,
            fee,
          };
          this.recordTrade(agentId, trade);
        }
      },
    );
    this.subscriptionIds.push(tradeSub);

    // Subscribe to price update events
    const priceSub = this.eventBus.subscribe(
      'price:updated',
      (event) => {
        const payload = event.payload as Record<string, unknown>;
        const price = this.toNumber(payload['price'] ?? payload['currentPriceSol']);
        if (price > 0) {
          this.updatePrice(price);
        }
      },
    );
    this.subscriptionIds.push(priceSub);
  }

  // ─── Trade Recording ─────────────────────────────────────

  /** Record a buy: add a new FIFO lot */
  private recordBuy(state: AgentPnLState, trade: PnLTrade): void {
    const totalCost = trade.solAmount + trade.fee;
    const costPerToken = trade.tokenAmount > 0 ? totalCost / trade.tokenAmount : 0;

    state.lots.push({
      tokenAmount: trade.tokenAmount,
      costPerToken,
      timestamp: trade.timestamp,
    });

    state.totalInvested += totalCost;
    state.tokensHeld += trade.tokenAmount;
    state.costBasisHeld += totalCost;
  }

  /** Record a sell: consume FIFO lots and compute realized P&L */
  private recordSell(state: AgentPnLState, trade: PnLTrade): void {
    let tokensToSell = trade.tokenAmount;
    let costBasisSold = 0;

    // Consume lots FIFO (oldest first)
    while (tokensToSell > 0 && state.lots.length > 0) {
      const lot = state.lots[0];

      if (lot.tokenAmount <= tokensToSell) {
        // Consume entire lot
        costBasisSold += lot.tokenAmount * lot.costPerToken;
        tokensToSell -= lot.tokenAmount;
        state.lots.shift();
      } else {
        // Partially consume lot
        costBasisSold += tokensToSell * lot.costPerToken;
        lot.tokenAmount -= tokensToSell;
        tokensToSell = 0;
      }
    }

    // If we sold more than tracked (edge case), remaining cost is 0
    const netProceeds = trade.solAmount - trade.fee;
    const realizedPnL = netProceeds - costBasisSold;

    state.realized += realizedPnL;
    state.totalReturned += netProceeds;
    state.tokensHeld -= (trade.tokenAmount - tokensToSell);
    state.costBasisHeld -= costBasisSold;

    // Clamp to avoid floating point drift below zero
    if (state.tokensHeld < 1e-12) state.tokensHeld = 0;
    if (state.costBasisHeld < 1e-12) state.costBasisHeld = 0;
  }

  // ─── P&L Calculations ────────────────────────────────────

  /** Calculate unrealized P&L for an agent's held tokens */
  private calculateUnrealized(state: AgentPnLState): number {
    if (state.tokensHeld <= 0 || this.currentPrice <= 0) return 0;
    const currentValue = state.tokensHeld * this.currentPrice;
    return currentValue - state.costBasisHeld;
  }

  /** Calculate ROI percentage */
  private calculateROI(totalPnl: number, invested: number): number {
    const basis = this.config.initialInvestment > 0
      ? this.config.initialInvestment
      : invested;
    if (basis <= 0) return 0;
    return (totalPnl / basis) * 100;
  }

  /** Get total tokens held across all agents */
  private getTotalTokensHeld(): number {
    let total = 0;
    for (const state of this.agents.values()) {
      total += state.tokensHeld;
    }
    return total;
  }

  /** Get aggregate cost basis of held tokens */
  private getTotalCostBasis(): number {
    let total = 0;
    for (const state of this.agents.values()) {
      total += state.costBasisHeld;
    }
    return total;
  }

  // ─── Drawdown Tracking ────────────────────────────────────

  /** Update peak/trough/drawdown after any state change */
  private updateDrawdown(): void {
    const totalPnl = this.getRealized() + this.getUnrealized();

    if (totalPnl > this.peakPnL) {
      this.peakPnL = totalPnl;
    }
    if (totalPnl < this.troughPnL) {
      this.troughPnL = totalPnl;
    }

    // Drawdown = distance from peak
    const drawdown = this.peakPnL - totalPnl;
    if (drawdown > this.maxDrawdownAbs) {
      this.maxDrawdownAbs = drawdown;
      // Drawdown % relative to peak portfolio value (invested + peak P&L)
      const peakPortfolioValue = this.getTotalInvested() + this.peakPnL;
      this.maxDrawdownPct = peakPortfolioValue > 0
        ? (drawdown / peakPortfolioValue) * 100
        : 0;
    }
  }

  // ─── Time Series Sampling ────────────────────────────────

  /** Take a snapshot of current P&L and add to time series */
  private sampleDataPoint(): void {
    const point = this.buildCurrentDataPoint();
    this.timeSeriesPoints.push(point);

    // Enforce max data points (ring buffer behavior)
    while (this.timeSeriesPoints.length > this.config.maxDataPoints) {
      this.timeSeriesPoints.shift();
    }
  }

  /** Build a PnLDataPoint from current state */
  private buildCurrentDataPoint(): PnLDataPoint {
    const realized = this.getRealized();
    const unrealized = this.getUnrealized();
    const total = realized + unrealized;
    const invested = this.getTotalInvested();
    const returned = this.getTotalReturned();

    return {
      timestamp: Date.now(),
      realized,
      unrealized,
      total,
      invested,
      returned,
      roi: this.calculateROI(total, invested),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────

  /** Get or create per-agent state */
  private getOrCreateAgentState(agentId: string): AgentPnLState {
    let state = this.agents.get(agentId);
    if (!state) {
      state = {
        lots: [],
        realized: 0,
        totalInvested: 0,
        totalReturned: 0,
        tokensHeld: 0,
        costBasisHeld: 0,
        tradeCount: 0,
      };
      this.agents.set(agentId, state);
    }
    return state;
  }

  /** Safely convert a payload value to number */
  private toNumber(value: unknown): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const n = Number(value);
      return Number.isNaN(n) ? 0 : n;
    }
    if (value !== null && value !== undefined && typeof value === 'object' && 'toNumber' in value) {
      return (value as { toNumber(): number }).toNumber();
    }
    return 0;
  }
}
