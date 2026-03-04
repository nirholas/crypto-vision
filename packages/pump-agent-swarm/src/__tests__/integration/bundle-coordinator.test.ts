/**
 * Integration Tests — Bundle Coordinator
 *
 * Tests for bundle coordination: bundle planning, participant
 * management, execution ordering, and anti-detection integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { SwarmEventBus } from '../../infra/event-bus.js';
import {
  createTestEventBus,
  createTestWallet,
  createTestWallets,
  createTestBundleConfig,
  collectEvents,
  randomMint,
} from '../helpers/test-config.js';
import type {
  AgentWallet,
  BundleBuyConfig,
  BundlePlan,
  BundleParticipant,
} from '../../types.js';

/**
 * Simulated bundle coordinator for integration testing.
 * Validates bundle planning and execution ordering without
 * real Solana transactions.
 */
class TestBundleCoordinator {
  private readonly eventBus: SwarmEventBus;
  private readonly config: BundleBuyConfig;
  private plans: BundlePlan[] = [];

  constructor(config: BundleBuyConfig, eventBus: SwarmEventBus) {
    this.config = config;
    this.eventBus = eventBus;
  }

  /** Create a bundle plan for atomic token creation + buys */
  createPlan(
    creator: AgentWallet,
    traders: AgentWallet[],
    allocations: BN[],
  ): BundlePlan {
    if (traders.length !== allocations.length) {
      throw new Error('traders and allocations arrays must have equal length');
    }

    const participants: BundleParticipant[] = traders.map((wallet, i) => ({
      wallet,
      amountLamports: allocations[i]!,
      delayMs: i * 100, // Stagger by 100ms each for anti-detection
      priorityMultiplier: 1.0 + Math.random() * 0.5,
      status: 'pending' as const,
    }));

    const totalAllocated = allocations.reduce(
      (sum, a) => sum.add(a),
      this.config.devBuyLamports,
    );

    const plan: BundlePlan = {
      id: `bundle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      creator,
      participants,
      totalSolAllocated: totalAllocated,
      targetSupplyPercent: 30,
      useJito: false,
      createdAt: Date.now(),
      status: 'planned',
    };

    this.plans.push(plan);
    this.eventBus.emit('bundle:plan-created', 'bundle', 'coordinator', {
      planId: plan.id,
      participants: participants.length,
      totalSol: totalAllocated.toString(),
    });

    return plan;
  }

  /** Simulate executing a bundle plan */
  async executePlan(plan: BundlePlan): Promise<BundlePlan> {
    plan.status = 'executing';
    this.eventBus.emit('bundle:executing', 'bundle', 'coordinator', {
      planId: plan.id,
    });

    // Simulate participant execution
    for (const participant of plan.participants) {
      participant.status = 'submitted';
      participant.signature = 'sim-' + Math.random().toString(36).slice(2);
      participant.tokensReceived = new BN(
        participant.amountLamports.toNumber() * 30_000,
      );

      // Simulate delay
      await new Promise((r) => setTimeout(r, 10));
      participant.status = 'confirmed';
    }

    plan.executedAt = Date.now();
    plan.status = 'completed';

    this.eventBus.emit('bundle:completed', 'bundle', 'coordinator', {
      planId: plan.id,
      participants: plan.participants.length,
      allConfirmed: plan.participants.every((p) => p.status === 'confirmed'),
    });

    return plan;
  }

  /** Get all plans */
  getPlans(): BundlePlan[] {
    return [...this.plans];
  }
}

describe('Bundle Coordinator', () => {
  let bus: SwarmEventBus;

  beforeEach(() => {
    bus = createTestEventBus();
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  // ─── Plan Creation ────────────────────────────────────────

  describe('plan creation', () => {
    it('creates a valid bundle plan', () => {
      const coordinator = new TestBundleCoordinator(createTestBundleConfig(), bus);
      const creator = createTestWallet('creator', 10);
      const traders = createTestWallets(3);
      const allocations = traders.map(() => new BN(0.5 * LAMPORTS_PER_SOL));

      const plan = coordinator.createPlan(creator, traders, allocations);

      expect(plan.id).toBeDefined();
      expect(plan.participants).toHaveLength(3);
      expect(plan.status).toBe('planned');
      expect(plan.totalSolAllocated.gt(new BN(0))).toBe(true);
    });

    it('staggers participant delays for anti-detection', () => {
      const coordinator = new TestBundleCoordinator(createTestBundleConfig(), bus);
      const creator = createTestWallet('creator', 10);
      const traders = createTestWallets(5);
      const allocations = traders.map(() => new BN(0.3 * LAMPORTS_PER_SOL));

      const plan = coordinator.createPlan(creator, traders, allocations);

      // Delays should be increasing
      for (let i = 1; i < plan.participants.length; i++) {
        expect(plan.participants[i]!.delayMs).toBeGreaterThan(
          plan.participants[i - 1]!.delayMs,
        );
      }
    });

    it('throws when traders and allocations length mismatch', () => {
      const coordinator = new TestBundleCoordinator(createTestBundleConfig(), bus);
      const creator = createTestWallet('creator', 10);
      const traders = createTestWallets(3);
      const allocations = [new BN(0.5 * LAMPORTS_PER_SOL)]; // Wrong length

      expect(() => coordinator.createPlan(creator, traders, allocations)).toThrow(
        'equal length',
      );
    });

    it('includes dev buy in total allocation', () => {
      const config = createTestBundleConfig({
        devBuyLamports: new BN(1 * LAMPORTS_PER_SOL),
      });
      const coordinator = new TestBundleCoordinator(config, bus);
      const creator = createTestWallet('creator', 10);
      const traders = createTestWallets(2);
      const allocations = traders.map(() => new BN(0.5 * LAMPORTS_PER_SOL));

      const plan = coordinator.createPlan(creator, traders, allocations);

      // Total should be devBuy + sum of allocations = 1 + 1 = 2 SOL
      expect(plan.totalSolAllocated.toNumber()).toBe(2 * LAMPORTS_PER_SOL);
    });

    it('emits plan-created event', () => {
      const coordinator = new TestBundleCoordinator(createTestBundleConfig(), bus);
      const { events, unsubscribe } = collectEvents(bus, 'bundle:plan-created');

      coordinator.createPlan(
        createTestWallet('creator', 10),
        createTestWallets(2),
        [new BN(0.5 * LAMPORTS_PER_SOL), new BN(0.5 * LAMPORTS_PER_SOL)],
      );
      unsubscribe();

      expect(events).toHaveLength(1);
    });
  });

  // ─── Plan Execution ──────────────────────────────────────

  describe('plan execution', () => {
    it('executes all participants and marks completed', async () => {
      const coordinator = new TestBundleCoordinator(createTestBundleConfig(), bus);
      const creator = createTestWallet('creator', 10);
      const traders = createTestWallets(3);
      const allocations = traders.map(() => new BN(0.5 * LAMPORTS_PER_SOL));

      const plan = coordinator.createPlan(creator, traders, allocations);
      const executed = await coordinator.executePlan(plan);

      expect(executed.status).toBe('completed');
      expect(executed.executedAt).toBeGreaterThan(0);
      for (const p of executed.participants) {
        expect(p.status).toBe('confirmed');
        expect(p.signature).toBeDefined();
        expect(p.tokensReceived?.gt(new BN(0))).toBe(true);
      }
    });

    it('emits executing and completed events', async () => {
      const coordinator = new TestBundleCoordinator(createTestBundleConfig(), bus);
      const { events, unsubscribe } = collectEvents(bus, 'bundle:*');

      const plan = coordinator.createPlan(
        createTestWallet('creator', 10),
        createTestWallets(2),
        [new BN(0.5 * LAMPORTS_PER_SOL), new BN(0.5 * LAMPORTS_PER_SOL)],
      );
      await coordinator.executePlan(plan);
      unsubscribe();

      const types = events.map((e) => e.type);
      expect(types).toContain('bundle:plan-created');
      expect(types).toContain('bundle:executing');
      expect(types).toContain('bundle:completed');
    });
  });

  // ─── Multiple Bundles ────────────────────────────────────

  describe('multiple bundles', () => {
    it('tracks multiple independent plans', () => {
      const coordinator = new TestBundleCoordinator(createTestBundleConfig(), bus);

      coordinator.createPlan(
        createTestWallet('c1', 10),
        createTestWallets(2),
        [new BN(0.3 * LAMPORTS_PER_SOL), new BN(0.3 * LAMPORTS_PER_SOL)],
      );
      coordinator.createPlan(
        createTestWallet('c2', 10),
        createTestWallets(3),
        [new BN(0.2 * LAMPORTS_PER_SOL), new BN(0.2 * LAMPORTS_PER_SOL), new BN(0.2 * LAMPORTS_PER_SOL)],
      );

      expect(coordinator.getPlans()).toHaveLength(2);
    });
  });
});
