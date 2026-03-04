/**
 * Unit Tests — P&L Tracker
 *
 * Tests for PnLTracker: trade recording, FIFO cost basis,
 * realized/unrealized P&L, drawdown, Sharpe ratio, and snapshots.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BN from 'bn.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { PnLTracker } from '../../trading/pnl-tracker.js';
import type { TradeRecord } from '../../trading/pnl-tracker.js';
import { SwarmEventBus } from '../../infra/event-bus.js';
import { createTestEventBus, collectEvents, randomMint } from '../helpers/test-config.js';

describe('PnLTracker', () => {
  let bus: SwarmEventBus;
  let tracker: PnLTracker;

  beforeEach(() => {
    bus = createTestEventBus();
    tracker = new PnLTracker(bus);
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  const lamports = (sol: number): BN => new BN(Math.round(sol * LAMPORTS_PER_SOL));
  const tokens = (n: number): BN => new BN(n * 1_000_000); // 6 decimals

  function recordBuy(
    agentId: string,
    mint: string,
    solAmount: number,
    tokenAmount: number,
    price: number,
  ): void {
    tracker.recordTrade({
      id: `buy-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      agentId,
      mint,
      direction: 'buy',
      solAmount: lamports(solAmount),
      tokenAmount: tokens(tokenAmount),
      price,
      fee: new BN(10_000), // 0.00001 SOL fee
      signature: 'sig-' + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      slippage: 0.5,
    });
  }

  function recordSell(
    agentId: string,
    mint: string,
    solAmount: number,
    tokenAmount: number,
    price: number,
  ): void {
    tracker.recordTrade({
      id: `sell-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      agentId,
      mint,
      direction: 'sell',
      solAmount: lamports(solAmount),
      tokenAmount: tokens(tokenAmount),
      price,
      fee: new BN(10_000),
      signature: 'sig-' + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      slippage: 0.3,
    });
  }

  // ─── Basic Trade Recording ──────────────────────────────────

  describe('trade recording', () => {
    it('records a buy trade and updates agent state', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);

      const agentPnl = tracker.getAgentPnL('agent-1');
      expect(agentPnl).toBeDefined();
      expect(agentPnl!.tradesCount).toBe(1);
      expect(agentPnl!.solSpent.gt(new BN(0))).toBe(true);
    });

    it('records a sell trade', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);
      recordSell('agent-1', mint, 1.2, 100_000, 0.000012);

      const agentPnl = tracker.getAgentPnL('agent-1');
      expect(agentPnl).toBeDefined();
      expect(agentPnl!.tradesCount).toBe(2);
    });

    it('handles multiple agents independently', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);
      recordBuy('agent-2', mint, 2.0, 200_000, 0.00001);

      const pnl1 = tracker.getAgentPnL('agent-1');
      const pnl2 = tracker.getAgentPnL('agent-2');
      expect(pnl1).toBeDefined();
      expect(pnl2).toBeDefined();
      expect(pnl2!.solSpent.gt(pnl1!.solSpent)).toBe(true);
    });
  });

  // ─── FIFO Cost Basis ───────────────────────────────────────

  describe('FIFO cost basis', () => {
    it('uses first-in-first-out for cost basis on sells', () => {
      const mint = randomMint();
      // Buy 100k tokens at 0.00001 SOL each
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);
      // Buy another 100k at 0.00002
      recordBuy('agent-1', mint, 2.0, 100_000, 0.00002);
      // Sell 100k — should use the first lot's cost basis
      recordSell('agent-1', mint, 1.5, 100_000, 0.000015);

      const agentPnl = tracker.getAgentPnL('agent-1');
      expect(agentPnl).toBeDefined();
      // Realized P&L = sold higher than first lot cost
      expect(agentPnl!.realizedPnl.gt(new BN(0))).toBe(true);
    });
  });

  // ─── Realized & Unrealized P&L ─────────────────────────────

  describe('realized & unrealized P&L', () => {
    it('calculates realized P&L on profitable round-trip', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);
      recordSell('agent-1', mint, 1.5, 100_000, 0.000015);

      const pnl = tracker.getAgentPnL('agent-1');
      expect(pnl).toBeDefined();
      // Realized should be positive
      expect(pnl!.realizedPnl.gt(new BN(0))).toBe(true);
    });

    it('calculates negative realized P&L on losing round-trip', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);
      recordSell('agent-1', mint, 0.5, 100_000, 0.000005);

      const pnl = tracker.getAgentPnL('agent-1');
      expect(pnl).toBeDefined();
      expect(pnl!.realizedPnl.isNeg()).toBe(true);
    });

    it('tracks unrealized P&L with price updates', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);

      // Update price to 2x
      tracker.updatePrice(mint, 0.00002);
      const pnl = tracker.getAgentPnL('agent-1');
      expect(pnl).toBeDefined();
      expect(pnl!.unrealizedPnl.gt(new BN(0))).toBe(true);
    });
  });

  // ─── Swarm P&L ─────────────────────────────────────────────

  describe('swarm P&L', () => {
    it('aggregates all agents into a swarm-wide P&L', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);
      recordBuy('agent-2', mint, 2.0, 200_000, 0.00001);

      const swarmPnl = tracker.getSwarmPnL();
      expect(swarmPnl.agentBreakdown).toHaveLength(2);
      expect(swarmPnl.totalTrades).toBe(2);
      expect(swarmPnl.totalSolDeployed.gt(new BN(0))).toBe(true);
    });

    it('includes volume across all agents', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);
      recordSell('agent-1', mint, 1.2, 50_000, 0.000015);
      recordBuy('agent-2', mint, 0.5, 50_000, 0.00001);

      const swarmPnl = tracker.getSwarmPnL();
      expect(swarmPnl.totalTrades).toBe(3);
    });
  });

  // ─── Drawdown ──────────────────────────────────────────────

  describe('drawdown', () => {
    it('tracks maximum drawdown', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 2.0, 200_000, 0.00001);
      // Update price up to establish peak
      tracker.updatePrice(mint, 0.00002);
      // Then down to create drawdown
      tracker.updatePrice(mint, 0.000005);

      const drawdown = tracker.getDrawdown();
      expect(drawdown.maxDrawdownPercent).toBeGreaterThan(0);
    });
  });

  // ─── Snapshot ──────────────────────────────────────────────

  describe('snapshot', () => {
    it('creates a full P&L snapshot', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);

      const snapshot = tracker.getSnapshot();
      expect(snapshot.timestamp).toBeGreaterThan(0);
      expect(snapshot.swarmPnL).toBeDefined();
      expect(snapshot.drawdown).toBeDefined();
      expect(snapshot.trades).toBeDefined();
      expect(snapshot.trades).toHaveLength(1);
    });
  });

  // ─── Win/Loss Tracking ─────────────────────────────────────

  describe('win/loss tracking', () => {
    it('tracks win count and loss count', () => {
      const mint1 = randomMint();
      const mint2 = randomMint();

      // Winning trade
      recordBuy('agent-1', mint1, 1.0, 100_000, 0.00001);
      recordSell('agent-1', mint1, 1.5, 100_000, 0.000015);

      // Losing trade
      recordBuy('agent-1', mint2, 1.0, 100_000, 0.00001);
      recordSell('agent-1', mint2, 0.5, 100_000, 0.000005);

      const pnl = tracker.getAgentPnL('agent-1');
      expect(pnl).toBeDefined();
      expect(pnl!.winCount).toBe(1);
      expect(pnl!.lossCount).toBe(1);
      expect(pnl!.winRate).toBeCloseTo(0.5, 1);
    });
  });

  // ─── Event Emission ────────────────────────────────────────

  describe('events', () => {
    it('emits pnl:trade-recorded on buy', () => {
      const { events, unsubscribe } = collectEvents(bus, 'pnl:*');
      recordBuy('agent-1', randomMint(), 1.0, 100_000, 0.00001);
      unsubscribe();

      expect(events.length).toBeGreaterThan(0);
      expect(events.some((e) => e.type.includes('pnl'))).toBe(true);
    });
  });

  // ─── Time Series ───────────────────────────────────────────

  describe('time series', () => {
    it('records time-series data points', () => {
      const mint = randomMint();
      recordBuy('agent-1', mint, 1.0, 100_000, 0.00001);

      // Take a snapshot to populate time series
      tracker.recordSnapshot();

      const snapshot = tracker.getSnapshot();
      expect(snapshot.timeSeries.length).toBeGreaterThanOrEqual(1);
    });
  });
});
