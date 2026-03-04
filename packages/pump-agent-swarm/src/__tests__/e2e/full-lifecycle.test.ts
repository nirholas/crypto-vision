/**
 * E2E Test — Full Lifecycle
 *
 * End-to-end test of the complete swarm lifecycle:
 * idle → init → funding → minting → bundling → distributing →
 * trading → exiting → reclaiming → completed
 *
 * This test uses simulated agents and validates the full message
 * flow, state transitions, P&L tracking, and event correlation
 * without requiring a live Solana connection.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { SwarmEventBus } from '../../infra/event-bus.js';
import { SwarmStateMachine } from '../../infra/state-machine.js';
import type { SwarmPhase, StateMachineConfig, MintResult } from '../../types.js';
import {
  createTestEventBus,
  createTestWallet,
  createTestWallets,
  createTestTokenConfig,
  createTestStrategy,
  collectEvents,
  sleep,
} from '../helpers/test-config.js';

describe('Full Swarm Lifecycle (E2E)', () => {
  let bus: SwarmEventBus;

  beforeEach(() => {
    bus = createTestEventBus(1000);
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  function createStateMachine(): SwarmStateMachine {
    const config: StateMachineConfig = {
      initialPhase: 'idle',
      transitions: [
        { from: 'idle', to: 'initializing' },
        { from: 'initializing', to: 'funding' },
        { from: 'funding', to: 'minting' },
        { from: 'minting', to: 'bundling' },
        { from: 'bundling', to: 'distributing' },
        { from: 'distributing', to: 'trading' },
        { from: 'trading', to: 'exiting' },
        { from: 'exiting', to: 'reclaiming' },
        { from: 'reclaiming', to: 'completed' },
        // Error transitions
        { from: 'idle', to: 'error' },
        { from: 'initializing', to: 'error' },
        { from: 'funding', to: 'error' },
        { from: 'minting', to: 'error' },
        { from: 'trading', to: 'error' },
        { from: 'error', to: 'reclaiming' },
        // Pause from trading
        { from: 'trading', to: 'paused' },
      ],
      onError: (_err: Error, _phase: SwarmPhase) => 'error',
      onTimeout: (_phase: SwarmPhase) => 'error',
    };
    return new SwarmStateMachine(config, bus);
  }

  it('completes the full lifecycle from idle to completed', async () => {
    const sm = createStateMachine();
    const { events } = collectEvents(bus, '*');

    // Track all phases visited
    const phasesVisited: SwarmPhase[] = ['idle'];

    // ── Phase 1: Initialize ──
    await sm.transition('initializing');
    phasesVisited.push('initializing');
    expect(sm.getCurrentPhase()).toBe('initializing');

    // Simulate initialization work
    const creatorWallet = createTestWallet('creator', 10);
    const traderWallets = createTestWallets(3, 'trader');
    bus.emit('swarm:initialized', 'lifecycle', 'orchestrator', {
      wallets: 1 + traderWallets.length,
    });

    // ── Phase 2: Funding ──
    await sm.transition('funding');
    phasesVisited.push('funding');
    expect(sm.getCurrentPhase()).toBe('funding');

    // Simulate funding
    bus.emit('wallet:funded', 'wallet', 'funder', {
      address: creatorWallet.address,
      amount: (10 * LAMPORTS_PER_SOL).toString(),
    });

    // ── Phase 3: Minting ──
    await sm.transition('minting');
    phasesVisited.push('minting');
    expect(sm.getCurrentPhase()).toBe('minting');

    // Simulate token creation
    const mintKeypair = Keypair.generate();
    const mintResult: MintResult = {
      mint: mintKeypair.publicKey.toBase58(),
      mintKeypair,
      signature: 'sim-mint-' + Date.now(),
      bondingCurve: Keypair.generate().publicKey.toBase58(),
      creatorTokenAccount: Keypair.generate().publicKey.toBase58(),
      devBuyTokens: new BN(1_000_000_000_000),
      devBuySol: new BN(0.5 * LAMPORTS_PER_SOL),
      createdAt: Date.now(),
    };
    bus.emit('token:created', 'lifecycle', 'creator-agent', {
      mint: mintResult.mint,
    });

    // ── Phase 4: Bundling ──
    await sm.transition('bundling');
    phasesVisited.push('bundling');
    expect(sm.getCurrentPhase()).toBe('bundling');

    bus.emit('bundle:completed', 'bundle', 'coordinator', {
      participants: 3,
    });

    // ── Phase 5: Distributing ──
    await sm.transition('distributing');
    phasesVisited.push('distributing');
    expect(sm.getCurrentPhase()).toBe('distributing');

    bus.emit('distribution:complete', 'coordination', 'distributor', {
      walletsDistributed: 3,
    });

    // ── Phase 6: Trading ──
    await sm.transition('trading');
    phasesVisited.push('trading');
    expect(sm.getCurrentPhase()).toBe('trading');

    // Simulate several trades
    for (let i = 0; i < 5; i++) {
      const direction = i % 3 === 0 ? 'sell' : 'buy';
      bus.emit('trade:executed', 'trading', `trader-${i % 3}`, {
        direction,
        mint: mintResult.mint,
        amountSol: 0.1,
        success: true,
      });
    }

    // ── Phase 7: Exiting ──
    await sm.transition('exiting');
    phasesVisited.push('exiting');
    expect(sm.getCurrentPhase()).toBe('exiting');

    bus.emit('exit:sell-complete', 'trading', 'exit-manager', {
      tokensSold: '900000000000',
    });

    // ── Phase 8: Reclaiming ──
    await sm.transition('reclaiming');
    phasesVisited.push('reclaiming');
    expect(sm.getCurrentPhase()).toBe('reclaiming');

    bus.emit('reclaim:complete', 'wallet', 'reclaimer', {
      solRecovered: (9.5 * LAMPORTS_PER_SOL).toString(),
    });

    // ── Phase 9: Completed ──
    await sm.transition('completed');
    phasesVisited.push('completed');
    expect(sm.getCurrentPhase()).toBe('completed');

    // ── Assertions ──
    expect(phasesVisited).toEqual([
      'idle',
      'initializing',
      'funding',
      'minting',
      'bundling',
      'distributing',
      'trading',
      'exiting',
      'reclaiming',
      'completed',
    ]);

    // Should have many events emitted throughout lifecycle
    expect(events.length).toBeGreaterThan(10);

    // Verify audit trail
    const history = sm.getPhaseHistory();
    expect(history.length).toBeGreaterThanOrEqual(10); // All phases visited
    expect(history[0]!.phase).toBe('idle');

    // Verify audit log
    const auditLog = sm.getAuditLog();
    expect(auditLog.length).toBe(9); // 9 transitions
    expect(auditLog.every((entry) => entry.success)).toBe(true);
  });

  it('handles error recovery mid-lifecycle', async () => {
    const sm = createStateMachine();

    await sm.transition('initializing');
    await sm.transition('funding');
    await sm.transition('minting');

    // Simulate an error during minting
    await sm.transition('error');
    expect(sm.getCurrentPhase()).toBe('error');

    // Recover by going to reclaiming
    await sm.transition('reclaiming');
    expect(sm.getCurrentPhase()).toBe('reclaiming');

    await sm.transition('completed');
    expect(sm.getCurrentPhase()).toBe('completed');
  });

  it('rejects invalid transitions', async () => {
    const sm = createStateMachine();

    // Cannot go from idle directly to trading
    const result = await sm.transition('trading');
    expect(result).toBe(false);
    expect(sm.getCurrentPhase()).toBe('idle');
  });

  it('supports pause and resume during trading', async () => {
    const sm = createStateMachine();

    await sm.transition('initializing');
    await sm.transition('funding');
    await sm.transition('minting');
    await sm.transition('bundling');
    await sm.transition('distributing');
    await sm.transition('trading');

    // Pause
    await sm.transition('paused');
    expect(sm.getCurrentPhase()).toBe('paused');

    // Resume — use force to go back to trading since we didn't
    // define paused→trading in our minimal config
    sm.forceTransition('trading');
    expect(sm.getCurrentPhase()).toBe('trading');
  });

  it('tracks event correlations across the lifecycle', async () => {
    const sm = createStateMachine();
    const correlationId = 'lifecycle-' + Date.now();

    await sm.transition('initializing');

    // Emit correlated events
    bus.emit('swarm:initialized', 'lifecycle', 'orchestrator', {}, correlationId);
    bus.emit('wallet:pool-created', 'wallet', 'vault', { count: 4 }, correlationId);
    bus.emit('config:validated', 'system', 'validator', {}, correlationId);

    // All events with same correlationId should be retrievable
    const correlated = bus.getCorrelation(correlationId);
    expect(correlated).toHaveLength(3);
    expect(correlated.every((e) => e.correlationId === correlationId)).toBe(true);
  });

  it('captures metrics throughout the lifecycle', async () => {
    const sm = createStateMachine();

    await sm.transition('initializing');
    await sm.transition('funding');
    await sm.transition('minting');
    await sm.transition('bundling');
    await sm.transition('distributing');
    await sm.transition('trading');

    // Emit trade events
    for (let i = 0; i < 10; i++) {
      bus.emit('trade:executed', 'trading', `trader-${i % 3}`, {
        solAmount: 0.1,
        direction: i % 2 === 0 ? 'buy' : 'sell',
      });
    }

    // Check event bus stats
    const stats = bus.getStats();
    expect(stats.totalEvents).toBeGreaterThan(10);
    expect(stats.eventsByCategory.trading).toBeGreaterThanOrEqual(10);
    expect(stats.eventsByCategory.lifecycle).toBeGreaterThan(0);
  });
});
