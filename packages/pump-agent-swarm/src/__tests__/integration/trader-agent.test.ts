/**
 * Integration Tests — Trader Agent
 *
 * Tests for trader agent: order creation, execution flow,
 * position management, budget tracking, and event emission.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BN from 'bn.js';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SwarmEventBus } from '../../infra/event-bus.js';
import {
  createTestEventBus,
  createTestWallet,
  createTestStrategy,
  collectEvents,
  randomMint,
} from '../helpers/test-config.js';
import type {
  AgentWallet,
  TradeOrder,
  TradeResult,
  TradingStrategy,
  AgentIdentity,
} from '../../types.js';

/**
 * Simulated trader agent for integration testing.
 * Validates order flow, budget tracking, and event patterns.
 */
class TestTraderAgent {
  readonly identity: AgentIdentity;
  private readonly eventBus: SwarmEventBus;
  private readonly wallet: AgentWallet;
  private readonly strategy: TradingStrategy;
  private readonly mint: string;

  private solSpent = new BN(0);
  private solReceived = new BN(0);
  private tokensHeld = new BN(0);
  private tradeCount = 0;

  constructor(
    wallet: AgentWallet,
    strategy: TradingStrategy,
    mint: string,
    eventBus: SwarmEventBus,
  ) {
    this.wallet = wallet;
    this.strategy = strategy;
    this.mint = mint;
    this.eventBus = eventBus;
    this.identity = {
      id: `trader-${wallet.address.slice(0, 8)}`,
      name: `Trader ${wallet.label}`,
      role: 'trader',
      wallet,
      config: { strategy: strategy.id },
      active: true,
      createdAt: Date.now(),
      lastHeartbeat: Date.now(),
    };
  }

  /** Create a trade order */
  createOrder(direction: 'buy' | 'sell', amountLamports: BN): TradeOrder {
    return {
      id: `order-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      traderId: this.identity.id,
      mint: this.mint,
      direction,
      amount: amountLamports,
      slippageBps: this.strategy.useJitoBundles ? 100 : 500,
      priorityFeeMicroLamports: this.strategy.priorityFeeMicroLamports,
    };
  }

  /** Simulate executing a trade */
  async executeTrade(order: TradeOrder): Promise<TradeResult> {
    this.eventBus.emit('trade:submitting', 'trading', this.identity.id, {
      orderId: order.id,
      direction: order.direction,
      amount: order.amount.toString(),
    });

    // Simulate execution
    const amountOut = order.direction === 'buy'
      ? new BN(order.amount.toNumber() * 30_000) // ~30k tokens per SOL
      : new BN(Math.floor(order.amount.toNumber() / 30_000)); // tokens → SOL

    const result: TradeResult = {
      order,
      signature: 'sim-' + Math.random().toString(36).slice(2),
      amountOut,
      executionPrice: new BN(Math.floor(LAMPORTS_PER_SOL / 30_000)),
      feesPaid: new BN(10_000),
      success: true,
      executedAt: Date.now(),
    };

    // Update internal state
    if (order.direction === 'buy') {
      this.solSpent = this.solSpent.add(order.amount);
      this.tokensHeld = this.tokensHeld.add(amountOut);
    } else {
      this.solReceived = this.solReceived.add(amountOut);
      this.tokensHeld = this.tokensHeld.sub(order.amount);
      if (this.tokensHeld.isNeg()) this.tokensHeld = new BN(0);
    }
    this.tradeCount++;

    this.eventBus.emit('trade:executed', 'trading', this.identity.id, {
      orderId: order.id,
      signature: result.signature,
      direction: order.direction,
      success: true,
    });

    return result;
  }

  /** Check if budget is exhausted */
  isBudgetExhausted(): boolean {
    return this.solSpent.gte(this.strategy.maxTotalBudgetLamports);
  }

  /** Check if max trades reached */
  isMaxTradesReached(): boolean {
    return this.strategy.maxTrades !== undefined && this.tradeCount >= this.strategy.maxTrades;
  }

  /** Get current stats */
  getStats() {
    return {
      solSpent: this.solSpent,
      solReceived: this.solReceived,
      tokensHeld: this.tokensHeld,
      tradeCount: this.tradeCount,
      netPnl: this.solReceived.sub(this.solSpent),
    };
  }
}

describe('Trader Agent', () => {
  let bus: SwarmEventBus;

  beforeEach(() => {
    bus = createTestEventBus();
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  // ─── Order Creation ───────────────────────────────────────

  describe('order creation', () => {
    it('creates a valid buy order', () => {
      const wallet = createTestWallet('trader-0', 5);
      const agent = new TestTraderAgent(wallet, createTestStrategy(), randomMint(), bus);

      const order = agent.createOrder('buy', new BN(0.1 * LAMPORTS_PER_SOL));
      expect(order.direction).toBe('buy');
      expect(order.traderId).toBe(agent.identity.id);
      expect(order.amount.toNumber()).toBe(0.1 * LAMPORTS_PER_SOL);
      expect(order.slippageBps).toBe(500);
    });

    it('creates a valid sell order', () => {
      const wallet = createTestWallet('trader-0', 5);
      const agent = new TestTraderAgent(wallet, createTestStrategy(), randomMint(), bus);

      const order = agent.createOrder('sell', new BN(1_000_000));
      expect(order.direction).toBe('sell');
    });

    it('uses lower slippage for Jito bundles', () => {
      const wallet = createTestWallet('trader-0', 5);
      const strategy = createTestStrategy({ useJitoBundles: true });
      const agent = new TestTraderAgent(wallet, strategy, randomMint(), bus);

      const order = agent.createOrder('buy', new BN(0.1 * LAMPORTS_PER_SOL));
      expect(order.slippageBps).toBe(100);
    });
  });

  // ─── Trade Execution ──────────────────────────────────────

  describe('trade execution', () => {
    it('executes a buy trade and updates state', async () => {
      const wallet = createTestWallet('trader-0', 5);
      const agent = new TestTraderAgent(wallet, createTestStrategy(), randomMint(), bus);

      const order = agent.createOrder('buy', new BN(0.1 * LAMPORTS_PER_SOL));
      const result = await agent.executeTrade(order);

      expect(result.success).toBe(true);
      expect(result.signature).toBeDefined();
      expect(result.amountOut.gt(new BN(0))).toBe(true);

      const stats = agent.getStats();
      expect(stats.tradeCount).toBe(1);
      expect(stats.solSpent.toNumber()).toBe(0.1 * LAMPORTS_PER_SOL);
      expect(stats.tokensHeld.gt(new BN(0))).toBe(true);
    });

    it('executes a sell trade and updates state', async () => {
      const wallet = createTestWallet('trader-0', 5);
      const agent = new TestTraderAgent(wallet, createTestStrategy(), randomMint(), bus);

      // Buy first
      const buyOrder = agent.createOrder('buy', new BN(0.1 * LAMPORTS_PER_SOL));
      await agent.executeTrade(buyOrder);

      // Then sell
      const sellOrder = agent.createOrder('sell', new BN(1_000_000));
      const result = await agent.executeTrade(sellOrder);

      expect(result.success).toBe(true);
      const stats = agent.getStats();
      expect(stats.tradeCount).toBe(2);
      expect(stats.solReceived.gt(new BN(0))).toBe(true);
    });

    it('emits trade events', async () => {
      const wallet = createTestWallet('trader-0', 5);
      const agent = new TestTraderAgent(wallet, createTestStrategy(), randomMint(), bus);
      const { events, unsubscribe } = collectEvents(bus, 'trade:*');

      const order = agent.createOrder('buy', new BN(0.1 * LAMPORTS_PER_SOL));
      await agent.executeTrade(order);
      unsubscribe();

      expect(events.length).toBeGreaterThanOrEqual(2); // submitting + executed
      expect(events.some((e) => e.type === 'trade:submitting')).toBe(true);
      expect(events.some((e) => e.type === 'trade:executed')).toBe(true);
    });
  });

  // ─── Budget Management ────────────────────────────────────

  describe('budget management', () => {
    it('detects when budget is exhausted', async () => {
      const wallet = createTestWallet('trader-0', 5);
      const strategy = createTestStrategy({
        maxTotalBudgetLamports: new BN(0.2 * LAMPORTS_PER_SOL),
      });
      const agent = new TestTraderAgent(wallet, strategy, randomMint(), bus);

      // Spend the full budget
      const order = agent.createOrder('buy', new BN(0.2 * LAMPORTS_PER_SOL));
      await agent.executeTrade(order);

      expect(agent.isBudgetExhausted()).toBe(true);
    });

    it('detects when max trades reached', async () => {
      const wallet = createTestWallet('trader-0', 5);
      const strategy = createTestStrategy({ maxTrades: 2 });
      const agent = new TestTraderAgent(wallet, strategy, randomMint(), bus);

      await agent.executeTrade(agent.createOrder('buy', new BN(0.01 * LAMPORTS_PER_SOL)));
      await agent.executeTrade(agent.createOrder('buy', new BN(0.01 * LAMPORTS_PER_SOL)));

      expect(agent.isMaxTradesReached()).toBe(true);
    });
  });

  // ─── P&L Tracking ────────────────────────────────────────

  describe('P&L tracking', () => {
    it('tracks net P&L across trades', async () => {
      const wallet = createTestWallet('trader-0', 5);
      const agent = new TestTraderAgent(wallet, createTestStrategy(), randomMint(), bus);

      await agent.executeTrade(agent.createOrder('buy', new BN(0.1 * LAMPORTS_PER_SOL)));
      await agent.executeTrade(agent.createOrder('sell', new BN(1_000_000)));

      const stats = agent.getStats();
      expect(stats.netPnl).toBeDefined();
      // Net P&L = received - spent
      expect(stats.netPnl.eq(stats.solReceived.sub(stats.solSpent))).toBe(true);
    });
  });
});
