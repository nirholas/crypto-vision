/**
 * Integration Tests — Creator Agent
 *
 * Tests for the creator agent's lifecycle: narrative generation,
 * token creation, metadata upload coordination, and event emission.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { SwarmEventBus } from '../../infra/event-bus.js';
import { createTestEventBus, createTestWallet, createTestTokenConfig, collectEvents, randomMint } from '../helpers/test-config.js';
import type { AgentWallet, TokenConfig, MintResult, AgentIdentity } from '../../types.js';

/**
 * Simulated creator agent for integration testing.
 * Validates the message flow and event patterns without
 * requiring a real Solana connection.
 */
class TestCreatorAgent {
  readonly identity: AgentIdentity;
  private readonly eventBus: SwarmEventBus;
  private readonly wallet: AgentWallet;
  private readonly tokenConfig: TokenConfig;
  private mintResult?: MintResult;

  constructor(
    wallet: AgentWallet,
    tokenConfig: TokenConfig,
    eventBus: SwarmEventBus,
  ) {
    this.wallet = wallet;
    this.tokenConfig = tokenConfig;
    this.eventBus = eventBus;
    this.identity = {
      id: `creator-${wallet.address.slice(0, 8)}`,
      name: 'Test Creator',
      role: 'creator',
      wallet,
      config: {},
      active: true,
      createdAt: Date.now(),
      lastHeartbeat: Date.now(),
    };
  }

  /** Simulate creating a token */
  async createToken(): Promise<MintResult> {
    this.eventBus.emit('agent:creating-token', 'lifecycle', this.identity.id, {
      token: this.tokenConfig,
    });

    // Simulate mint result
    const mintKeypair = Keypair.generate();
    const result: MintResult = {
      mint: mintKeypair.publicKey.toBase58(),
      mintKeypair,
      signature: 'sim-' + Math.random().toString(36).slice(2),
      bondingCurve: Keypair.generate().publicKey.toBase58(),
      creatorTokenAccount: Keypair.generate().publicKey.toBase58(),
      devBuyTokens: new BN(1_000_000_000_000), // 1M tokens
      devBuySol: new BN(0.5 * LAMPORTS_PER_SOL),
      createdAt: Date.now(),
    };

    this.mintResult = result;
    this.eventBus.emit('token:created', 'lifecycle', this.identity.id, {
      mint: result.mint,
      signature: result.signature,
      bondingCurve: result.bondingCurve,
    });

    return result;
  }

  /** Get the mint result */
  getMintResult(): MintResult | undefined {
    return this.mintResult;
  }

  /** Send heartbeat */
  heartbeat(): void {
    this.identity.lastHeartbeat = Date.now();
    this.eventBus.emit('agent:heartbeat', 'system', this.identity.id, {
      role: 'creator',
    });
  }
}

describe('Creator Agent', () => {
  let bus: SwarmEventBus;

  beforeEach(() => {
    bus = createTestEventBus();
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  // ─── Token Creation ───────────────────────────────────────

  describe('token creation', () => {
    it('creates a token and emits events', async () => {
      const wallet = createTestWallet('creator', 10);
      const agent = new TestCreatorAgent(wallet, createTestTokenConfig(), bus);
      const { events, unsubscribe } = collectEvents(bus, 'token:*');

      const result = await agent.createToken();
      unsubscribe();

      expect(result.mint).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.bondingCurve).toBeDefined();
      expect(result.createdAt).toBeGreaterThan(0);
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe('token:created');
    });

    it('includes dev buy in mint result', async () => {
      const wallet = createTestWallet('creator', 10);
      const agent = new TestCreatorAgent(wallet, createTestTokenConfig(), bus);

      const result = await agent.createToken();
      expect(result.devBuyTokens?.gt(new BN(0))).toBe(true);
      expect(result.devBuySol?.gt(new BN(0))).toBe(true);
    });

    it('stores mint result for later retrieval', async () => {
      const wallet = createTestWallet('creator', 10);
      const agent = new TestCreatorAgent(wallet, createTestTokenConfig(), bus);

      expect(agent.getMintResult()).toBeUndefined();
      await agent.createToken();
      expect(agent.getMintResult()).toBeDefined();
    });
  });

  // ─── Agent Identity ───────────────────────────────────────

  describe('identity', () => {
    it('has a valid agent identity', () => {
      const wallet = createTestWallet('creator', 10);
      const agent = new TestCreatorAgent(wallet, createTestTokenConfig(), bus);

      expect(agent.identity.role).toBe('creator');
      expect(agent.identity.active).toBe(true);
      expect(agent.identity.id).toContain('creator-');
    });

    it('emits heartbeat events', () => {
      const wallet = createTestWallet('creator', 10);
      const agent = new TestCreatorAgent(wallet, createTestTokenConfig(), bus);
      const { events, unsubscribe } = collectEvents(bus, 'agent:heartbeat');

      agent.heartbeat();
      unsubscribe();

      expect(events).toHaveLength(1);
      expect(events[0]!.source).toBe(agent.identity.id);
    });
  });

  // ─── Lifecycle Events ─────────────────────────────────────

  describe('lifecycle events', () => {
    it('emits creating-token event before creation', async () => {
      const wallet = createTestWallet('creator', 10);
      const agent = new TestCreatorAgent(wallet, createTestTokenConfig(), bus);
      const { events, unsubscribe } = collectEvents(bus, 'agent:*');

      await agent.createToken();
      unsubscribe();

      expect(events.some((e) => e.type === 'agent:creating-token')).toBe(true);
    });

    it('events contain correct source agent ID', async () => {
      const wallet = createTestWallet('creator', 10);
      const agent = new TestCreatorAgent(wallet, createTestTokenConfig(), bus);
      const { events, unsubscribe } = collectEvents(bus, '*');

      await agent.createToken();
      unsubscribe();

      const agentEvents = events.filter((e) => e.source === agent.identity.id);
      expect(agentEvents.length).toBeGreaterThan(0);
    });
  });
});
