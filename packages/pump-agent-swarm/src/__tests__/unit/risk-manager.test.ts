/**
 * Unit Tests — Risk Manager
 *
 * Tests for RiskManager: risk assessment, position tracking,
 * circuit breaker, stop-loss, drawdown, Kelly criterion, and
 * consecutive loss tracking.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RiskManager } from '../../intelligence/risk-manager.js';
import type { ProposedTradeAction, RiskLimits } from '../../intelligence/risk-manager.js';
import { SwarmEventBus } from '../../infra/event-bus.js';
import { createTestEventBus, createTestRiskLimits, collectEvents, randomMint } from '../helpers/test-config.js';

describe('RiskManager', () => {
  let bus: SwarmEventBus;
  let limits: RiskLimits;

  beforeEach(() => {
    bus = createTestEventBus();
    limits = createTestRiskLimits();
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  function createManager(overrides?: Partial<RiskLimits>): RiskManager {
    return new RiskManager({ ...limits, ...overrides }, bus);
  }

  function buyAction(amountSOL: number, mint?: string): ProposedTradeAction {
    return {
      type: 'buy',
      mint: mint ?? randomMint(),
      amountSOL,
      walletAddress: 'test-wallet-' + Math.random().toString(36).slice(2, 8),
      reason: 'test buy',
    };
  }

  function sellAction(amountSOL: number, mint?: string): ProposedTradeAction {
    return {
      type: 'sell',
      mint: mint ?? randomMint(),
      amountSOL,
      walletAddress: 'test-wallet-' + Math.random().toString(36).slice(2, 8),
      reason: 'test sell',
    };
  }

  // ─── Basic Assessment ───────────────────────────────────────

  describe('assessRisk', () => {
    it('approves a buy within all limits', () => {
      const rm = createManager();
      const result = rm.assessRisk(buyAction(0.5));
      expect(result.approved).toBe(true);
      expect(result.violations).toHaveLength(0);
      expect(result.riskScore).toBeLessThan(50);
    });

    it('always approves sell orders (risk-reducing)', () => {
      const rm = createManager();
      const result = rm.assessRisk(sellAction(10));
      expect(result.approved).toBe(true);
      expect(result.reasoning).toContain('risk-reducing');
    });

    it('rejects or modifies a buy exceeding max position size', () => {
      const rm = createManager({ maxPositionSize: 0.5 });
      const result = rm.assessRisk(buyAction(2.0));
      // Should either reject or modify to max position size
      expect(
        !result.approved ||
          result.action === 'modify' ||
          result.violations.some((v) => v.rule === 'max-position-size'),
      ).toBe(true);
    });

    it('rejects when total deployment would exceed max', () => {
      const rm = createManager({ maxTotalDeployed: 2.0, maxPositionSize: 1.5 });
      const mint = randomMint();
      // Record a position first
      rm.recordEntry(mint, 1.5, 0.001, 1_500_000_000n, 'wallet-1');
      // Try to buy more
      const result = rm.assessRisk(buyAction(1.0));
      expect(
        !result.approved ||
          result.violations.some((v) => v.rule === 'max-total-deployed'),
      ).toBe(true);
    });

    it('rejects when max concurrent positions exceeded', () => {
      const rm = createManager({ maxConcurrentPositions: 2, maxPositionSize: 5.0, maxTotalDeployed: 20.0 });
      // Add 2 positions
      rm.recordEntry(randomMint(), 1.0, 0.001, 1_000_000_000n, 'w1');
      rm.recordEntry(randomMint(), 1.0, 0.002, 1_000_000_000n, 'w2');
      // Third should be rejected
      const result = rm.assessRisk(buyAction(0.5));
      expect(
        !result.approved ||
          result.violations.some((v) => v.rule === 'max-concurrent-positions'),
      ).toBe(true);
    });
  });

  // ─── Circuit Breaker ────────────────────────────────────────

  describe('circuit breaker', () => {
    it('trips on excessive consecutive losses', () => {
      const rm = createManager({ maxConsecutiveLosses: 3 });
      const mint = randomMint();

      // Record 3 consecutive losses
      for (let i = 0; i < 3; i++) {
        rm.recordEntry(mint, 0.5, 0.001, 500_000_000n, `w-${i}`);
        rm.recordExit(mint, 0.2, `w-${i}`); // loss
      }

      const result = rm.assessRisk(buyAction(0.5));
      expect(result.approved).toBe(false);
      expect(result.violations.some((v) => v.rule === 'circuit-breaker')).toBe(true);
    });

    it('rejects all buys while circuit breaker is active', () => {
      const rm = createManager({ maxConsecutiveLosses: 1 });
      const mint = randomMint();
      rm.recordEntry(mint, 0.5, 0.001, 500_000_000n, 'w1');
      rm.recordExit(mint, 0.1, 'w1');

      const result = rm.assessRisk(buyAction(0.1));
      expect(result.approved).toBe(false);
    });
  });

  // ─── Position Tracking ──────────────────────────────────────

  describe('position tracking', () => {
    it('tracks an entry correctly', () => {
      const rm = createManager();
      const mint = randomMint();
      rm.recordEntry(mint, 1.0, 0.001, 1_000_000_000n, 'w1');

      const report = rm.getPortfolioReport();
      expect(report.positionCount).toBe(1);
      expect(report.totalDeployed).toBeCloseTo(1.0, 1);
    });

    it('removes position on full exit', () => {
      const rm = createManager();
      const mint = randomMint();
      rm.recordEntry(mint, 1.0, 0.001, 1_000_000_000n, 'w1');
      rm.recordExit(mint, 1.2, 'w1');

      const report = rm.getPortfolioReport();
      expect(report.positionCount).toBe(0);
    });

    it('calculates drawdown correctly', () => {
      const rm = createManager();
      const mint = randomMint();
      // Portfolio peaks at 2.0 SOL deployed
      rm.recordEntry(mint, 2.0, 0.001, 2_000_000_000n, 'w1');
      // Price drops — update price
      rm.updatePrice(mint, 0.0005);

      const report = rm.getPortfolioReport();
      expect(report.drawdown.drawdownPercent).toBeGreaterThan(0);
    });
  });

  // ─── Stop Loss ──────────────────────────────────────────────

  describe('stop-loss', () => {
    it('triggers stop-loss when price drops below threshold', () => {
      const rm = createManager({ stopLossPercent: 0.5 }); // 50% stop
      const mint = randomMint();
      rm.recordEntry(mint, 1.0, 0.01, 1_000_000_000n, 'w1');
      rm.updatePrice(mint, 0.003); // 70% drop

      const actions = rm.checkStopLosses();
      expect(actions.length).toBeGreaterThan(0);
      expect(actions[0]!.action).not.toBe('hold');
    });

    it('does not trigger stop-loss for positions above threshold', () => {
      const rm = createManager({ stopLossPercent: 0.5 });
      const mint = randomMint();
      rm.recordEntry(mint, 1.0, 0.01, 1_000_000_000n, 'w1');
      rm.updatePrice(mint, 0.009); // 10% drop, within threshold

      const actions = rm.checkStopLosses();
      const triggers = actions.filter((a) => a.action !== 'hold');
      expect(triggers).toHaveLength(0);
    });
  });

  // ─── Risk Score ─────────────────────────────────────────────

  describe('risk score', () => {
    it('returns 0 risk score with no positions', () => {
      const rm = createManager();
      const report = rm.getPortfolioReport();
      expect(report.riskScore).toBe(0);
    });

    it('increases risk score as deployment grows', () => {
      const rm = createManager({ maxTotalDeployed: 5.0, maxPositionSize: 5.0 });
      rm.recordEntry(randomMint(), 1.0, 0.001, 1_000_000_000n, 'w1');
      const r1 = rm.getPortfolioReport().riskScore;

      rm.recordEntry(randomMint(), 2.0, 0.002, 2_000_000_000n, 'w2');
      const r2 = rm.getPortfolioReport().riskScore;

      expect(r2).toBeGreaterThan(r1);
    });
  });

  // ─── Risk Metrics ──────────────────────────────────────────

  describe('risk metrics', () => {
    it('returns valid metrics snapshot', () => {
      const rm = createManager();
      const metrics = rm.getRiskMetrics();

      expect(metrics.totalDeployed).toBe(0);
      expect(metrics.positionCount).toBe(0);
      expect(metrics.circuitBreaker.tripped).toBe(false);
      expect(metrics.consecutiveLosses).toBe(0);
      expect(typeof metrics.timestamp).toBe('number');
    });
  });

  // ─── Event Emission ────────────────────────────────────────

  describe('events', () => {
    it('emits events on position entry', () => {
      const rm = createManager();
      const { events, unsubscribe } = collectEvents(bus, 'risk:*');

      rm.recordEntry(randomMint(), 1.0, 0.001, 1_000_000_000n, 'w1');
      unsubscribe();

      expect(events.length).toBeGreaterThan(0);
    });
  });
});
