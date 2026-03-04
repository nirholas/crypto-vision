/**
 * Risk Manager — Portfolio risk enforcement, stop-losses & circuit breaker
 *
 * Prevents the swarm from taking excessive risk by enforcing:
 * - Position size limits (single & total)
 * - Stop-loss (fixed + trailing)
 * - Max drawdown with circuit breaker
 * - Kelly criterion position sizing
 * - Consecutive loss detection
 * - Per-window loss limits
 *
 * All calculations use real position data — no mocks, no stubs.
 */

import type { TradeResult } from '../types.js';
import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Interfaces ────────────────────────────────────────────────

export interface RiskLimits {
  /** Max SOL in any single position */
  maxPositionSize: number;
  /** Max total SOL deployed across all positions */
  maxTotalDeployed: number;
  /** Max % of budget in any single token (0-1) */
  maxPositionPercent: number;
  /** Stop-loss: exit if position drops below this fraction of entry (e.g., 0.7 = −30%) */
  stopLossPercent: number;
  /** Max drawdown from peak before circuit breaker trips (e.g., 0.25 = −25%) */
  maxDrawdownPercent: number;
  /** Max drawdown in absolute SOL terms */
  maxDrawdownSOL: number;
  /** Max number of simultaneous token positions */
  maxConcurrentPositions: number;
  /** Max loss in a single time window before pause */
  maxLossPerWindow: number;
  /** Time window for maxLossPerWindow (ms) */
  lossWindowMs: number;
  /** Circuit breaker cooldown period (ms) */
  circuitBreakerCooldown: number;
  /** Max consecutive losing trades before pause */
  maxConsecutiveLosses: number;
  /** Minimum time between trades per wallet (ms) */
  minTradeCooldown: number;
}

export interface ProposedTradeAction {
  type: 'buy' | 'sell';
  mint: string;
  amountSOL: number;
  walletId: string;
  agentId: string;
  reason: string;
}

export interface RiskAssessment {
  approved: boolean;
  action: 'approve' | 'reject' | 'modify';
  /** If modified, the adjusted parameters */
  modifiedAction?: Partial<ProposedTradeAction>;
  reasoning: string;
  /** 0–100 (higher = riskier) */
  riskScore: number;
  violations: RiskViolation[];
  checkedAt: number;
}

export interface RiskViolation {
  rule: string;
  current: number;
  limit: number;
  severity: 'warning' | 'critical';
  message: string;
}

export interface Position {
  mint: string;
  /** Average entry price in SOL per token */
  entryPrice: number;
  /** Current price */
  currentPrice: number;
  tokenAmount: bigint;
  solInvested: number;
  currentValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  /** Highest value reached */
  highWaterMark: number;
  /** Current drawdown from high water mark */
  drawdownFromPeak: number;
  entryTimestamp: number;
  lastUpdate: number;
  tradeCount: number;
}

export interface PortfolioRiskReport {
  /** Total SOL in positions */
  totalDeployed: number;
  /** Current market value */
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  positions: Position[];
  positionCount: number;
  largestPosition: { mint: string; percent: number };
  drawdown: DrawdownInfo;
  circuitBreaker: CircuitBreakerStatus;
  /** Aggregate portfolio risk 0–100 */
  riskScore: number;
  /** Detailed risk breakdown by category */
  riskBreakdown: RiskBreakdown;
  /** Correlation risk assessment */
  correlationRisk: CorrelationRisk;
  /** Liquidity risk assessment */
  liquidityRisk: LiquidityRisk;
  /** Time risk assessment */
  timeRisk: TimeRisk;
  warnings: string[];
  timestamp: number;
}

export interface DrawdownInfo {
  peakValue: number;
  currentValue: number;
  drawdownSOL: number;
  drawdownPercent: number;
  peakTimestamp: number;
  /** How long in drawdown (ms) */
  duration: number;
}

export interface CircuitBreakerStatus {
  tripped: boolean;
  reason?: string;
  trippedAt?: number;
  cooldownRemaining?: number;
  autoResetAt?: number;
}

export interface StopLossAction {
  mint: string;
  currentPrice: number;
  entryPrice: number;
  lossPercent: number;
  action: 'exit-immediately' | 'trailing-stop-triggered' | 'hold';
  urgency: 'critical' | 'warning';
}

export interface CorrelationRisk {
  /** Average price correlation between held positions (0–1) */
  avgCorrelation: number;
  /** Highest pairwise correlation */
  maxCorrelation: number;
  /** Pairs with correlation > 0.7 */
  highlyCorrelatedPairs: Array<{ mint1: string; mint2: string; correlation: number }>;
  /** Risk score contribution (0–100) */
  score: number;
}

export interface LiquidityRisk {
  /** Positions with very low trading volume */
  illiquidPositions: Array<{ mint: string; volumeSOL: number; holdingPercent: number }>;
  /** Average volume across all positions */
  avgVolumeSOL: number;
  /** Risk score contribution (0–100) */
  score: number;
}

export interface TimeRisk {
  /** Positions held longer than the target hold period */
  overduePositions: Array<{ mint: string; holdDuration: number; maxHold: number }>;
  /** Average hold duration across all positions (ms) */
  avgHoldDuration: number;
  /** Longest-held position duration (ms) */
  maxHoldDuration: number;
  /** Risk score contribution (0–100) */
  score: number;
}

export interface RiskBreakdown {
  /** Drawdown risk (0–100) */
  drawdown: number;
  /** Concentration / Herfindahl risk (0–100) */
  concentration: number;
  /** Deployment utilization risk (0–100) */
  deployment: number;
  /** Unrealized loss risk (0–100) */
  unrealizedLoss: number;
  /** Consecutive loss risk (0–100) */
  consecutiveLoss: number;
  /** Window loss risk (0–100) */
  windowLoss: number;
  /** Correlation risk (0–100) */
  correlation: number;
  /** Liquidity risk (0–100) */
  liquidity: number;
  /** Time risk (0–100) */
  time: number;
}

export interface RiskMetrics {
  totalDeployed: number;
  totalValue: number;
  totalPnL: number;
  positionCount: number;
  drawdown: DrawdownInfo;
  circuitBreaker: CircuitBreakerStatus;
  consecutiveLosses: number;
  windowLoss: number;
  riskScore: number;
  riskBreakdown: RiskBreakdown;
  correlationRisk: CorrelationRisk;
  liquidityRisk: LiquidityRisk;
  timeRisk: TimeRisk;
  timestamp: number;
}

// ─── Internal Types ────────────────────────────────────────────

interface TrailingStop {
  mint: string;
  /** Highest price observed since entry */
  highPrice: number;
  /** Stop price — trails up, never down */
  stopPrice: number;
}

interface LossRecord {
  amountSOL: number;
  timestamp: number;
}

// ─── Defaults ──────────────────────────────────────────────────

const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSize: 1.0,
  maxTotalDeployed: 5.0,
  maxPositionPercent: 0.25,
  stopLossPercent: 0.7,
  maxDrawdownPercent: 0.25,
  maxDrawdownSOL: 2.0,
  maxConcurrentPositions: 10,
  maxLossPerWindow: 1.0,
  lossWindowMs: 60 * 60 * 1000, // 1 hour
  circuitBreakerCooldown: 30 * 60 * 1000, // 30 minutes
  maxConsecutiveLosses: 5,
  minTradeCooldown: 5_000, // 5s
};

// ─── RiskManager ───────────────────────────────────────────────

/**
 * Central risk engine for the swarm. Every proposed trade passes through
 * `assessRisk()` before execution. Tracks positions, enforces limits,
 * and trips the circuit breaker when drawdown exceeds thresholds.
 */
export class RiskManager {
  private readonly config: RiskLimits;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;

  /** Active positions keyed by mint address */
  private readonly positions = new Map<string, Position>();

  /** Trailing stop data keyed by mint */
  private readonly trailingStops = new Map<string, TrailingStop>();

  /** Realized losses within the rolling window */
  private readonly recentLosses: LossRecord[] = [];

  /** Consecutive losing trades counter */
  private consecutiveLosses = 0;

  /** Portfolio peak value for drawdown tracking */
  private peakValue = 0;
  private peakTimestamp = Date.now();
  private drawdownStartTimestamp = 0;

  /** Circuit breaker state */
  private circuitBreakerTripped = false;
  private circuitBreakerReason: string | undefined;
  private circuitBreakerTrippedAt: number | undefined;
  private circuitBreakerAutoResetAt: number | undefined;

  /** Last trade timestamp per wallet (for cooldown enforcement) */
  private readonly lastTradeByWallet = new Map<string, number>();

  /** Total realized P&L */
  private realizedPnL = 0;

  constructor(config: Partial<RiskLimits>, eventBus: SwarmEventBus) {
    this.config = { ...DEFAULT_RISK_LIMITS, ...config };
    this.eventBus = eventBus;
    this.logger = SwarmLogger.create('risk-manager', 'intelligence');
    this.logger.info('Risk manager initialized', {
      limits: this.config,
    });
  }

  // ─── Risk Assessment ──────────────────────────────────────

  /**
   * Evaluate a proposed trade against all risk rules.
   * Returns approval, rejection, or modification with reasoning.
   */
  assessRisk(proposedAction: ProposedTradeAction): RiskAssessment {
    const violations: RiskViolation[] = [];
    const now = Date.now();
    let adjustedAmount = proposedAction.amountSOL;

    // 1) Circuit breaker — reject everything if tripped
    const cbStatus = this.checkCircuitBreaker();
    if (cbStatus.tripped) {
      this.logger.warn('Trade rejected: circuit breaker tripped', {
        mint: proposedAction.mint,
        reason: cbStatus.reason,
      });
      return {
        approved: false,
        action: 'reject',
        reasoning: `Circuit breaker active: ${cbStatus.reason}`,
        riskScore: 100,
        violations: [{
          rule: 'circuit-breaker',
          current: 1,
          limit: 0,
          severity: 'critical',
          message: `Circuit breaker tripped: ${cbStatus.reason}`,
        }],
        checkedAt: now,
      };
    }

    // Sells are generally allowed (risk-reducing)
    if (proposedAction.type === 'sell') {
      return {
        approved: true,
        action: 'approve',
        reasoning: 'Sell orders are risk-reducing and always permitted',
        riskScore: 0,
        violations: [],
        checkedAt: now,
      };
    }

    // ── Buy-side risk checks ──────────────────────────────

    // 2) Single position size
    if (proposedAction.amountSOL > this.config.maxPositionSize) {
      violations.push({
        rule: 'max-position-size',
        current: proposedAction.amountSOL,
        limit: this.config.maxPositionSize,
        severity: 'critical',
        message: `Trade size ${proposedAction.amountSOL} SOL exceeds max position size ${this.config.maxPositionSize} SOL`,
      });
      adjustedAmount = this.config.maxPositionSize;
    }

    // 3) Total deployment
    const totalDeployed = this.getTotalDeployed();
    const newTotal = totalDeployed + proposedAction.amountSOL;
    if (newTotal > this.config.maxTotalDeployed) {
      const remaining = Math.max(0, this.config.maxTotalDeployed - totalDeployed);
      violations.push({
        rule: 'max-total-deployed',
        current: newTotal,
        limit: this.config.maxTotalDeployed,
        severity: remaining > 0 ? 'warning' : 'critical',
        message: `Total deployed would be ${newTotal.toFixed(4)} SOL, max is ${this.config.maxTotalDeployed} SOL`,
      });
      if (remaining <= 0) {
        return this.buildRejection(violations, 'Total deployment limit reached', now);
      }
      adjustedAmount = Math.min(adjustedAmount, remaining);
    }

    // 4) Position concentration
    const totalValue = this.getTotalValue();
    const budget = Math.max(totalValue, this.config.maxTotalDeployed);
    const existingPosition = this.positions.get(proposedAction.mint);
    const positionValue = (existingPosition?.solInvested ?? 0) + proposedAction.amountSOL;
    const positionPercent = budget > 0 ? positionValue / budget : 1;
    if (positionPercent > this.config.maxPositionPercent) {
      violations.push({
        rule: 'max-position-percent',
        current: positionPercent,
        limit: this.config.maxPositionPercent,
        severity: 'warning',
        message: `Position would be ${(positionPercent * 100).toFixed(1)}% of portfolio, max is ${(this.config.maxPositionPercent * 100).toFixed(1)}%`,
      });
      const maxAllowedSOL = budget * this.config.maxPositionPercent - (existingPosition?.solInvested ?? 0);
      adjustedAmount = Math.min(adjustedAmount, Math.max(0, maxAllowedSOL));
    }

    // 5) Concurrent positions
    if (!existingPosition && this.positions.size >= this.config.maxConcurrentPositions) {
      violations.push({
        rule: 'max-concurrent-positions',
        current: this.positions.size,
        limit: this.config.maxConcurrentPositions,
        severity: 'critical',
        message: `Already at max ${this.config.maxConcurrentPositions} concurrent positions`,
      });
      return this.buildRejection(violations, 'Max concurrent positions reached', now);
    }

    // 6) Wallet cooldown
    const lastTrade = this.lastTradeByWallet.get(proposedAction.walletId);
    if (lastTrade !== undefined) {
      const elapsed = now - lastTrade;
      if (elapsed < this.config.minTradeCooldown) {
        violations.push({
          rule: 'min-trade-cooldown',
          current: elapsed,
          limit: this.config.minTradeCooldown,
          severity: 'warning',
          message: `Wallet ${proposedAction.walletId} traded ${elapsed}ms ago, cooldown is ${this.config.minTradeCooldown}ms`,
        });
        return this.buildRejection(violations, 'Wallet trade cooldown active', now);
      }
    }

    // 7) Window loss limit
    const windowLoss = this.getWindowLoss();
    if (windowLoss >= this.config.maxLossPerWindow) {
      violations.push({
        rule: 'max-loss-per-window',
        current: windowLoss,
        limit: this.config.maxLossPerWindow,
        severity: 'critical',
        message: `Window loss ${windowLoss.toFixed(4)} SOL exceeds max ${this.config.maxLossPerWindow} SOL`,
      });
      return this.buildRejection(violations, 'Rolling window loss limit breached', now);
    }

    // 8) Consecutive losses
    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
      violations.push({
        rule: 'max-consecutive-losses',
        current: this.consecutiveLosses,
        limit: this.config.maxConsecutiveLosses,
        severity: 'critical',
        message: `${this.consecutiveLosses} consecutive losses, max is ${this.config.maxConsecutiveLosses}`,
      });
      return this.buildRejection(violations, 'Max consecutive losses reached', now);
    }

    // ── Build result ──────────────────────────────────────

    const riskScore = this.computeTradeRiskScore(proposedAction, violations);

    if (adjustedAmount <= 0) {
      return this.buildRejection(violations, 'Adjusted trade size reduced to zero', now);
    }

    if (adjustedAmount < proposedAction.amountSOL) {
      this.logger.info('Trade modified by risk manager', {
        mint: proposedAction.mint,
        original: proposedAction.amountSOL,
        adjusted: adjustedAmount,
        violations: violations.length,
      });
      return {
        approved: true,
        action: 'modify',
        modifiedAction: { amountSOL: adjustedAmount },
        reasoning: `Trade size reduced from ${proposedAction.amountSOL} to ${adjustedAmount.toFixed(4)} SOL due to risk limits`,
        riskScore,
        violations,
        checkedAt: now,
      };
    }

    if (violations.length > 0) {
      this.logger.info('Trade approved with warnings', {
        mint: proposedAction.mint,
        warnings: violations.length,
      });
    }

    return {
      approved: true,
      action: 'approve',
      reasoning: violations.length > 0
        ? `Approved with ${violations.length} warning(s)`
        : 'All risk checks passed',
      riskScore,
      violations,
      checkedAt: now,
    };
  }

  // ─── Stop-Loss Enforcement ────────────────────────────────

  /**
   * Check all positions against stop-loss thresholds.
   * Returns actions for each position that needs attention.
   */
  enforceStopLoss(positions: Position[]): StopLossAction[] {
    const actions: StopLossAction[] = [];

    for (const pos of positions) {
      // Update internal tracking
      this.syncPosition(pos);

      const priceRatio = pos.currentPrice / pos.entryPrice;
      const lossPercent = 1 - priceRatio;

      // Check trailing stop first
      const trailing = this.trailingStops.get(pos.mint);
      if (trailing) {
        // Update trailing high watermark
        if (pos.currentPrice > trailing.highPrice) {
          trailing.highPrice = pos.currentPrice;
          trailing.stopPrice = pos.currentPrice * this.config.stopLossPercent;
        }

        if (pos.currentPrice <= trailing.stopPrice) {
          const action: StopLossAction = {
            mint: pos.mint,
            currentPrice: pos.currentPrice,
            entryPrice: pos.entryPrice,
            lossPercent: 1 - (pos.currentPrice / trailing.highPrice),
            action: 'trailing-stop-triggered',
            urgency: 'critical',
          };
          actions.push(action);

          this.logger.warn('Trailing stop triggered', {
            mint: pos.mint,
            currentPrice: pos.currentPrice,
            highPrice: trailing.highPrice,
            stopPrice: trailing.stopPrice,
          });

          this.eventBus.emit(
            'risk:stop-loss-triggered',
            'intelligence',
            'risk-manager',
            {
              mint: pos.mint,
              type: 'trailing',
              currentPrice: pos.currentPrice,
              stopPrice: trailing.stopPrice,
              highPrice: trailing.highPrice,
            },
          );
          continue;
        }
      }

      // Fixed stop-loss check
      if (priceRatio <= this.config.stopLossPercent) {
        const action: StopLossAction = {
          mint: pos.mint,
          currentPrice: pos.currentPrice,
          entryPrice: pos.entryPrice,
          lossPercent,
          action: 'exit-immediately',
          urgency: 'critical',
        };
        actions.push(action);

        this.logger.warn('Fixed stop-loss triggered', {
          mint: pos.mint,
          priceRatio: priceRatio.toFixed(4),
          threshold: this.config.stopLossPercent,
        });

        this.eventBus.emit(
          'risk:stop-loss-triggered',
          'intelligence',
          'risk-manager',
          {
            mint: pos.mint,
            type: 'fixed',
            currentPrice: pos.currentPrice,
            entryPrice: pos.entryPrice,
            lossPercent,
          },
        );
        continue;
      }

      // Warning zone (within 10% of stop-loss)
      const warningThreshold = this.config.stopLossPercent + (1 - this.config.stopLossPercent) * 0.33;
      if (priceRatio <= warningThreshold) {
        actions.push({
          mint: pos.mint,
          currentPrice: pos.currentPrice,
          entryPrice: pos.entryPrice,
          lossPercent,
          action: 'hold',
          urgency: 'warning',
        });
      }
    }

    return actions;
  }

  // ─── Kelly Criterion Position Sizing ──────────────────────

  /**
   * Calculate optimal position size using a half-Kelly criterion.
   *
   * Kelly fraction: f* = (bp − q) / b
   *   b = odds ratio (expected win / expected loss)
   *   p = probability of win (derived from conviction)
   *   q = 1 − p
   *
   * We use half-Kelly for a smoother equity curve and lower variance.
   * Final size is clamped to [0, maxPositionSize] and remaining budget.
   */
  calculatePositionSize(
    budget: number,
    riskPercent: number,
    conviction: number,
  ): number {
    // Clamp inputs
    const p = Math.max(0.01, Math.min(0.99, conviction));
    const q = 1 - p;

    // Estimated odds ratio (higher conviction → better expected payoff)
    // For memecoins, average win is larger than average loss due to asymmetry
    const b = 1.5 + conviction; // Payoff ratio: 1.5× to 2.5×

    // Kelly fraction
    const kellyFull = (b * p - q) / b;

    // Half-Kelly for risk reduction
    const kellyHalf = kellyFull * 0.5;

    // Apply risk percentage as an additional scaling factor
    const riskFactor = Math.max(0, Math.min(1, riskPercent));
    const scaledKelly = kellyHalf * riskFactor;

    // If Kelly is negative, don't take the trade
    if (scaledKelly <= 0) {
      this.logger.debug('Kelly criterion suggests no trade', {
        conviction: p,
        kellyFull,
        kellyHalf,
      });
      return 0;
    }

    // Calculate position in SOL
    const remainingBudget = Math.max(0, this.config.maxTotalDeployed - this.getTotalDeployed());
    const kellySize = budget * scaledKelly;

    const finalSize = Math.min(
      kellySize,
      this.config.maxPositionSize,
      remainingBudget,
      budget * this.config.maxPositionPercent,
    );

    this.logger.debug('Kelly position sizing', {
      budget,
      conviction: p,
      kellyFull: kellyFull.toFixed(4),
      kellyHalf: kellyHalf.toFixed(4),
      scaledKelly: scaledKelly.toFixed(4),
      kellySize: kellySize.toFixed(4),
      finalSize: finalSize.toFixed(4),
    });

    return Math.max(0, finalSize);
  }

  // ─── Portfolio Risk Report ────────────────────────────────

  /**
   * Generate an aggregate risk report across all tracked positions.
   */
  getPortfolioRisk(): PortfolioRiskReport {
    const now = Date.now();
    const positionList = Array.from(this.positions.values());
    const totalDeployed = this.getTotalDeployed();
    const totalValue = this.getTotalValue();
    const totalPnL = totalValue - totalDeployed + this.realizedPnL;
    const totalPnLPercent = totalDeployed > 0 ? totalPnL / totalDeployed : 0;

    // Find largest position
    let largestMint = '';
    let largestPercent = 0;
    for (const pos of positionList) {
      const pct = totalValue > 0 ? pos.currentValue / totalValue : 0;
      if (pct > largestPercent) {
        largestPercent = pct;
        largestMint = pos.mint;
      }
    }

    const drawdown = this.getDrawdown();
    const circuitBreaker = this.checkCircuitBreaker();
    const correlationRisk = this.assessCorrelationRisk(positionList);
    const liquidityRisk = this.assessLiquidityRisk(positionList);
    const timeRisk = this.assessTimeRisk(positionList, now);
    const { riskScore, breakdown } = this.computePortfolioRiskScoreDetailed(
      positionList, drawdown, correlationRisk, liquidityRisk, timeRisk,
    );

    // Compile warnings
    const warnings: string[] = [];
    if (drawdown.drawdownPercent > this.config.maxDrawdownPercent * 0.5) {
      warnings.push(`Drawdown at ${(drawdown.drawdownPercent * 100).toFixed(1)}%, threshold is ${(this.config.maxDrawdownPercent * 100).toFixed(1)}%`);
    }
    if (largestPercent > this.config.maxPositionPercent * 0.8) {
      warnings.push(`Largest position (${largestMint.slice(0, 8)}…) at ${(largestPercent * 100).toFixed(1)}% of portfolio`);
    }
    if (this.consecutiveLosses >= this.config.maxConsecutiveLosses * 0.6) {
      warnings.push(`${this.consecutiveLosses} consecutive losses (max ${this.config.maxConsecutiveLosses})`);
    }
    const windowLoss = this.getWindowLoss();
    if (windowLoss >= this.config.maxLossPerWindow * 0.5) {
      warnings.push(`Window loss ${windowLoss.toFixed(4)} SOL (limit ${this.config.maxLossPerWindow} SOL)`);
    }
    if (correlationRisk.score > 50) {
      warnings.push(`High position correlation (${correlationRisk.avgCorrelation.toFixed(2)}) — portfolio not diversified`);
    }
    if (liquidityRisk.illiquidPositions.length > 0) {
      warnings.push(`${liquidityRisk.illiquidPositions.length} position(s) below minimum liquidity threshold`);
    }
    if (timeRisk.overduePositions.length > 0) {
      warnings.push(`${timeRisk.overduePositions.length} position(s) held beyond max hold duration`);
    }

    return {
      totalDeployed,
      totalValue,
      totalPnL,
      totalPnLPercent,
      positions: positionList,
      positionCount: positionList.length,
      largestPosition: { mint: largestMint, percent: largestPercent },
      drawdown,
      circuitBreaker,
      riskScore,
      riskBreakdown: breakdown,
      correlationRisk,
      liquidityRisk,
      timeRisk,
      warnings,
      timestamp: now,
    };
  }

  // ─── Position Tracking ───────────────────────────────────

  /**
   * Update internal position state after a trade executes.
   * Tracks entry prices, invested amounts, and trailing stops.
   */
  updatePosition(mint: string, trade: TradeResult): void {
    const now = Date.now();

    if (!trade.success) {
      this.logger.debug('Skipping failed trade for position update', {
        mint,
        error: trade.error,
      });
      return;
    }

    const direction = trade.order.direction;
    const walletId = trade.order.traderId;

    // Record trade timestamp for cooldown
    this.lastTradeByWallet.set(walletId, now);

    const existing = this.positions.get(mint);

    if (direction === 'buy') {
      const solSpent = Number(trade.order.amount.toString()) / 1e9; // lamports → SOL
      const tokensReceived = BigInt(trade.amountOut.toString());
      const executionPrice = Number(trade.executionPrice.toString()) / 1e9;

      if (existing) {
        // Average into existing position
        const totalSolInvested = existing.solInvested + solSpent;
        const totalTokens = existing.tokenAmount + tokensReceived;
        const avgEntry = totalSolInvested / Number(totalTokens);

        existing.solInvested = totalSolInvested;
        existing.tokenAmount = totalTokens;
        existing.entryPrice = avgEntry;
        existing.currentPrice = executionPrice;
        existing.currentValue = Number(totalTokens) * executionPrice;
        existing.unrealizedPnL = existing.currentValue - existing.solInvested;
        existing.unrealizedPnLPercent = existing.solInvested > 0
          ? existing.unrealizedPnL / existing.solInvested
          : 0;
        existing.highWaterMark = Math.max(existing.highWaterMark, existing.currentValue);
        existing.drawdownFromPeak = existing.highWaterMark > 0
          ? 1 - existing.currentValue / existing.highWaterMark
          : 0;
        existing.lastUpdate = now;
        existing.tradeCount++;
      } else {
        // New position
        const tokensBigInt = tokensReceived;
        const currentValue = Number(tokensBigInt) * executionPrice;
        const pos: Position = {
          mint,
          entryPrice: executionPrice,
          currentPrice: executionPrice,
          tokenAmount: tokensBigInt,
          solInvested: solSpent,
          currentValue,
          unrealizedPnL: 0,
          unrealizedPnLPercent: 0,
          highWaterMark: currentValue,
          drawdownFromPeak: 0,
          entryTimestamp: now,
          lastUpdate: now,
          tradeCount: 1,
        };
        this.positions.set(mint, pos);

        // Initialize trailing stop
        this.trailingStops.set(mint, {
          mint,
          highPrice: executionPrice,
          stopPrice: executionPrice * this.config.stopLossPercent,
        });
      }

      this.consecutiveLosses = 0; // buys reset consecutive loss counter
    } else {
      // Sell — calculate realized P&L
      const solReceived = Number(trade.amountOut.toString()) / 1e9;

      if (existing) {
        const tokensSold = BigInt(trade.order.amount.toString());
        const fractionSold = existing.tokenAmount > 0n
          ? Number(tokensSold) / Number(existing.tokenAmount)
          : 1;
        const costBasis = existing.solInvested * fractionSold;
        const pnl = solReceived - costBasis;

        this.realizedPnL += pnl;

        if (pnl < 0) {
          this.consecutiveLosses++;
          this.recentLosses.push({ amountSOL: Math.abs(pnl), timestamp: now });

          // Check if consecutive losses trip circuit breaker
          if (this.consecutiveLosses >= this.config.maxConsecutiveLosses) {
            this.tripCircuitBreaker(
              `${this.consecutiveLosses} consecutive losing trades`,
            );
          }

          // Check window loss
          const windowLoss = this.getWindowLoss();
          if (windowLoss >= this.config.maxLossPerWindow) {
            this.tripCircuitBreaker(
              `Window loss ${windowLoss.toFixed(4)} SOL exceeds limit ${this.config.maxLossPerWindow} SOL`,
            );
          }
        } else {
          this.consecutiveLosses = 0;
        }

        // Update or remove position
        const remainingTokens = existing.tokenAmount - tokensSold;
        if (remainingTokens <= 0n) {
          this.positions.delete(mint);
          this.trailingStops.delete(mint);
          this.logger.info('Position closed', {
            mint,
            realizedPnL: pnl.toFixed(4),
          });
        } else {
          existing.tokenAmount = remainingTokens;
          existing.solInvested = existing.solInvested * (1 - fractionSold);
          existing.currentValue = Number(remainingTokens) * existing.currentPrice;
          existing.unrealizedPnL = existing.currentValue - existing.solInvested;
          existing.unrealizedPnLPercent = existing.solInvested > 0
            ? existing.unrealizedPnL / existing.solInvested
            : 0;
          existing.lastUpdate = now;
          existing.tradeCount++;
        }

        this.eventBus.emit(
          'risk:trade-pnl',
          'intelligence',
          'risk-manager',
          { mint, pnl, isLoss: pnl < 0, consecutiveLosses: this.consecutiveLosses },
        );
      }
    }

    // Update portfolio peak for drawdown tracking
    this.updatePeakValue();
  }

  // ─── Circuit Breaker ──────────────────────────────────────

  /**
   * Check whether the circuit breaker should be tripped or has auto-reset.
   */
  checkCircuitBreaker(): CircuitBreakerStatus {
    const now = Date.now();

    // Auto-reset after cooldown
    if (
      this.circuitBreakerTripped &&
      this.circuitBreakerAutoResetAt !== undefined &&
      now >= this.circuitBreakerAutoResetAt
    ) {
      this.logger.info('Circuit breaker auto-reset after cooldown', {
        reason: this.circuitBreakerReason,
        tripDuration: now - (this.circuitBreakerTrippedAt ?? now),
      });
      this.resetCircuitBreakerInternal();
    }

    // Check drawdown
    if (!this.circuitBreakerTripped) {
      const drawdown = this.getDrawdown();
      if (drawdown.drawdownPercent >= this.config.maxDrawdownPercent) {
        this.tripCircuitBreaker(
          `Portfolio drawdown ${(drawdown.drawdownPercent * 100).toFixed(1)}% exceeds max ${(this.config.maxDrawdownPercent * 100).toFixed(1)}%`,
        );
      } else if (drawdown.drawdownSOL >= this.config.maxDrawdownSOL) {
        this.tripCircuitBreaker(
          `Portfolio drawdown ${drawdown.drawdownSOL.toFixed(4)} SOL exceeds max ${this.config.maxDrawdownSOL} SOL`,
        );
      }
    }

    if (!this.circuitBreakerTripped) {
      return { tripped: false };
    }

    const cooldownRemaining = this.circuitBreakerAutoResetAt !== undefined
      ? Math.max(0, this.circuitBreakerAutoResetAt - now)
      : undefined;

    return {
      tripped: true,
      reason: this.circuitBreakerReason,
      trippedAt: this.circuitBreakerTrippedAt,
      cooldownRemaining,
      autoResetAt: this.circuitBreakerAutoResetAt,
    };
  }

  /**
   * Manually trip the circuit breaker. All new trades will be rejected
   * until the cooldown expires or `resetCircuitBreaker()` is called.
   */
  tripCircuitBreaker(reason: string): void {
    if (this.circuitBreakerTripped) {
      this.logger.debug('Circuit breaker already tripped, ignoring re-trip', {
        existingReason: this.circuitBreakerReason,
        newReason: reason,
      });
      return;
    }

    const now = Date.now();
    this.circuitBreakerTripped = true;
    this.circuitBreakerReason = reason;
    this.circuitBreakerTrippedAt = now;
    this.circuitBreakerAutoResetAt = now + this.config.circuitBreakerCooldown;

    this.logger.error(`CIRCUIT BREAKER TRIPPED — all new trades halted: ${reason} (cooldown=${this.config.circuitBreakerCooldown}ms, resetAt=${new Date(this.circuitBreakerAutoResetAt).toISOString()})`);

    this.eventBus.emit(
      'risk:circuit-breaker-tripped',
      'intelligence',
      'risk-manager',
      {
        reason,
        trippedAt: now,
        cooldownMs: this.config.circuitBreakerCooldown,
        autoResetAt: this.circuitBreakerAutoResetAt,
      },
    );
  }

  /**
   * Manually reset the circuit breaker after human review.
   */
  resetCircuitBreaker(): void {
    if (!this.circuitBreakerTripped) {
      this.logger.debug('Circuit breaker not tripped, nothing to reset');
      return;
    }

    this.logger.info('Circuit breaker manually reset', {
      reason: this.circuitBreakerReason,
      duration: Date.now() - (this.circuitBreakerTrippedAt ?? Date.now()),
    });

    this.resetCircuitBreakerInternal();

    this.eventBus.emit(
      'risk:circuit-breaker-reset',
      'intelligence',
      'risk-manager',
      { resetAt: Date.now(), manual: true },
    );
  }

  // ─── Drawdown ─────────────────────────────────────────────

  /**
   * Calculate current drawdown from the portfolio's peak value.
   */
  getDrawdown(): DrawdownInfo {
    const currentValue = this.getTotalValue();
    const now = Date.now();

    // Ensure peak is up to date
    if (currentValue > this.peakValue) {
      this.peakValue = currentValue;
      this.peakTimestamp = now;
      this.drawdownStartTimestamp = 0;
    }

    const drawdownSOL = Math.max(0, this.peakValue - currentValue);
    const drawdownPercent = this.peakValue > 0 ? drawdownSOL / this.peakValue : 0;

    // Track when drawdown started
    if (drawdownSOL > 0 && this.drawdownStartTimestamp === 0) {
      this.drawdownStartTimestamp = now;
    }

    const duration = this.drawdownStartTimestamp > 0
      ? now - this.drawdownStartTimestamp
      : 0;

    return {
      peakValue: this.peakValue,
      currentValue,
      drawdownSOL,
      drawdownPercent,
      peakTimestamp: this.peakTimestamp,
      duration,
    };
  }

  // ─── Risk Metrics Snapshot ────────────────────────────────

  /**
   * Return a snapshot of current risk metrics.
   */
  getRiskMetrics(): RiskMetrics {
    const totalDeployed = this.getTotalDeployed();
    const totalValue = this.getTotalValue();
    const drawdown = this.getDrawdown();
    const positions = Array.from(this.positions.values());
    const riskScore = this.computePortfolioRiskScore(positions, drawdown);

    return {
      totalDeployed,
      totalValue,
      totalPnL: totalValue - totalDeployed + this.realizedPnL,
      positionCount: this.positions.size,
      drawdown,
      circuitBreaker: this.checkCircuitBreaker(),
      consecutiveLosses: this.consecutiveLosses,
      windowLoss: this.getWindowLoss(),
      riskScore,
      timestamp: Date.now(),
    };
  }

  // ─── Helpers (Private) ───────────────────────────────────

  /** Sum of SOL invested in all open positions */
  private getTotalDeployed(): number {
    let total = 0;
    for (const pos of this.positions.values()) {
      total += pos.solInvested;
    }
    return total;
  }

  /** Sum of current market value of all open positions */
  private getTotalValue(): number {
    let total = 0;
    for (const pos of this.positions.values()) {
      total += pos.currentValue;
    }
    return total;
  }

  /** Calculate total losses within the rolling window */
  private getWindowLoss(): number {
    const now = Date.now();
    const windowStart = now - this.config.lossWindowMs;

    // Prune old entries
    while (
      this.recentLosses.length > 0 &&
      this.recentLosses[0].timestamp < windowStart
    ) {
      this.recentLosses.shift();
    }

    let total = 0;
    for (const loss of this.recentLosses) {
      total += loss.amountSOL;
    }
    return total;
  }

  /** Update the portfolio peak value for drawdown tracking */
  private updatePeakValue(): void {
    const currentValue = this.getTotalValue();
    if (currentValue > this.peakValue) {
      this.peakValue = currentValue;
      this.peakTimestamp = Date.now();
      this.drawdownStartTimestamp = 0;
    }
  }

  /** Sync an externally-supplied position snapshot into internal state */
  private syncPosition(pos: Position): void {
    const existing = this.positions.get(pos.mint);
    if (existing) {
      existing.currentPrice = pos.currentPrice;
      existing.currentValue = pos.currentValue;
      existing.unrealizedPnL = pos.unrealizedPnL;
      existing.unrealizedPnLPercent = pos.unrealizedPnLPercent;
      existing.highWaterMark = Math.max(existing.highWaterMark, pos.currentValue);
      existing.drawdownFromPeak = existing.highWaterMark > 0
        ? 1 - pos.currentValue / existing.highWaterMark
        : 0;
      existing.lastUpdate = Date.now();
    } else {
      // First time seeing this position — adopt it
      this.positions.set(pos.mint, { ...pos });
      this.trailingStops.set(pos.mint, {
        mint: pos.mint,
        highPrice: Math.max(pos.entryPrice, pos.currentPrice),
        stopPrice: Math.max(pos.entryPrice, pos.currentPrice) * this.config.stopLossPercent,
      });
    }

    // Update trailing stop
    const trailing = this.trailingStops.get(pos.mint);
    if (trailing && pos.currentPrice > trailing.highPrice) {
      trailing.highPrice = pos.currentPrice;
      trailing.stopPrice = pos.currentPrice * this.config.stopLossPercent;
    }

    this.updatePeakValue();
  }

  /** Compute a risk score (0–100) for a proposed trade */
  private computeTradeRiskScore(
    action: ProposedTradeAction,
    violations: RiskViolation[],
  ): number {
    let score = 0;

    // Base score from amount relative to max
    score += (action.amountSOL / this.config.maxPositionSize) * 20;

    // Concentration risk
    const totalValue = this.getTotalValue();
    const budget = Math.max(totalValue, this.config.maxTotalDeployed);
    if (budget > 0) {
      const existing = this.positions.get(action.mint);
      const posValue = (existing?.solInvested ?? 0) + action.amountSOL;
      score += (posValue / budget) * 20;
    }

    // Capacity utilization
    score += (this.getTotalDeployed() / this.config.maxTotalDeployed) * 15;

    // Position count utilization
    score += (this.positions.size / this.config.maxConcurrentPositions) * 10;

    // Drawdown contribution
    const drawdown = this.getDrawdown();
    score += (drawdown.drawdownPercent / this.config.maxDrawdownPercent) * 20;

    // Consecutive losses
    score += (this.consecutiveLosses / this.config.maxConsecutiveLosses) * 10;

    // Violations add to risk
    for (const v of violations) {
      score += v.severity === 'critical' ? 10 : 5;
    }

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /** Compute aggregate portfolio risk score */
  private computePortfolioRiskScore(
    positions: Position[],
    drawdown: DrawdownInfo,
  ): number {
    let score = 0;

    // Drawdown severity (0–30)
    score += Math.min(30, (drawdown.drawdownPercent / this.config.maxDrawdownPercent) * 30);

    // Concentration risk (0–20) — Herfindahl index
    const totalValue = this.getTotalValue();
    if (totalValue > 0 && positions.length > 0) {
      let herfindahl = 0;
      for (const pos of positions) {
        const weight = pos.currentValue / totalValue;
        herfindahl += weight * weight;
      }
      // HHI is 1/n for equal weights, 1.0 for single position
      const maxHHI = 1.0;
      score += Math.min(20, (herfindahl / maxHHI) * 20);
    }

    // Deployment utilization (0–15)
    score += Math.min(15, (this.getTotalDeployed() / this.config.maxTotalDeployed) * 15);

    // Unrealized loss severity (0–15)
    let totalUnrealizedLoss = 0;
    for (const pos of positions) {
      if (pos.unrealizedPnL < 0) {
        totalUnrealizedLoss += Math.abs(pos.unrealizedPnL);
      }
    }
    if (this.config.maxDrawdownSOL > 0) {
      score += Math.min(15, (totalUnrealizedLoss / this.config.maxDrawdownSOL) * 15);
    }

    // Consecutive losses (0–10)
    score += Math.min(10, (this.consecutiveLosses / this.config.maxConsecutiveLosses) * 10);

    // Window loss (0–10)
    const windowLoss = this.getWindowLoss();
    score += Math.min(10, (windowLoss / this.config.maxLossPerWindow) * 10);

    return Math.min(100, Math.max(0, Math.round(score)));
  }

  /** Build a rejection RiskAssessment */
  private buildRejection(
    violations: RiskViolation[],
    reasoning: string,
    checkedAt: number,
  ): RiskAssessment {
    this.logger.warn('Trade rejected', {
      reasoning,
      violationCount: violations.length,
    });

    return {
      approved: false,
      action: 'reject',
      reasoning,
      riskScore: this.computeTradeRiskScore(
        { type: 'buy', mint: '', amountSOL: 0, walletId: '', agentId: '', reason: '' },
        violations,
      ),
      violations,
      checkedAt,
    };
  }

  /** Internal reset without event emission */
  private resetCircuitBreakerInternal(): void {
    this.circuitBreakerTripped = false;
    this.circuitBreakerReason = undefined;
    this.circuitBreakerTrippedAt = undefined;
    this.circuitBreakerAutoResetAt = undefined;
    this.consecutiveLosses = 0;
  }
}
