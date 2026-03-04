/**
 * Unit Tests — Types
 *
 * Compile-time type checks and runtime validation of core
 * type constructors, ensuring interfaces are correctly shaped.
 */

import { describe, it, expect } from 'vitest';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import type {
  AgentWallet,
  TokenConfig,
  MintResult,
  TradeOrder,
  TradeResult,
  BondingCurveState,
  SwarmPhase,
  SwarmEvent,
  SwarmEventCategory,
  SwarmMasterConfig,
  AgentRole,
  PhaseTransition,
  StateMachineConfig,
  WalletAssignment,
  SwarmStatus,
} from '../../types.js';

describe('Core Types', () => {
  // ─── AgentWallet ────────────────────────────────────────────

  describe('AgentWallet', () => {
    it('constructs a valid AgentWallet', () => {
      const kp = Keypair.generate();
      const wallet: AgentWallet = {
        keypair: kp,
        address: kp.publicKey.toBase58(),
        label: 'creator-0',
        balanceLamports: new BN(5 * LAMPORTS_PER_SOL),
      };

      expect(wallet.address).toHaveLength(44); // Solana base58 addresses are ~44 chars
      expect(wallet.balanceLamports.toNumber()).toBe(5 * LAMPORTS_PER_SOL);
      expect(wallet.label).toBe('creator-0');
    });
  });

  // ─── TokenConfig ────────────────────────────────────────────

  describe('TokenConfig', () => {
    it('accepts valid token config', () => {
      const token: TokenConfig = {
        name: 'Agent Coin',
        symbol: 'AGENT',
        metadataUri: 'https://arweave.net/abc123',
      };
      expect(token.name).toBe('Agent Coin');
      expect(token.symbol).toBe('AGENT');
    });

    it('accepts optional vanityPrefix', () => {
      const token: TokenConfig = {
        name: 'Vanity',
        symbol: 'VAN',
        metadataUri: 'https://arweave.net/xyz',
        vanityPrefix: 'pump',
      };
      expect(token.vanityPrefix).toBe('pump');
    });
  });

  // ─── TradeOrder ─────────────────────────────────────────────

  describe('TradeOrder', () => {
    it('creates a valid buy order', () => {
      const order: TradeOrder = {
        id: 'order-1',
        traderId: 'trader-0',
        mint: 'So11111111111111111111111111111111111111112',
        direction: 'buy',
        amount: new BN(0.05 * LAMPORTS_PER_SOL),
        slippageBps: 300,
      };
      expect(order.direction).toBe('buy');
      expect(order.slippageBps).toBe(300);
    });

    it('creates a valid sell order with priority fee', () => {
      const order: TradeOrder = {
        id: 'order-2',
        traderId: 'trader-1',
        mint: 'TokenMint123',
        direction: 'sell',
        amount: new BN(1_000_000),
        slippageBps: 500,
        priorityFeeMicroLamports: 10_000,
        jitoTipLamports: 5_000,
      };
      expect(order.direction).toBe('sell');
      expect(order.priorityFeeMicroLamports).toBe(10_000);
    });
  });

  // ─── BondingCurveState ──────────────────────────────────────

  describe('BondingCurveState', () => {
    it('represents a fresh bonding curve', () => {
      const curve: BondingCurveState = {
        mint: 'FreshMint123',
        virtualSolReserves: new BN(30 * LAMPORTS_PER_SOL),
        virtualTokenReserves: new BN(1_000_000_000_000),
        realSolReserves: new BN(0),
        realTokenReserves: new BN(793_100_000_000),
        complete: false,
        currentPriceSol: 0.00003,
        marketCapSol: 30,
        graduationProgress: 0,
      };

      expect(curve.complete).toBe(false);
      expect(curve.graduationProgress).toBe(0);
      expect(curve.virtualSolReserves.toNumber()).toBe(30 * LAMPORTS_PER_SOL);
    });

    it('represents a graduated curve', () => {
      const curve: BondingCurveState = {
        mint: 'GraduatedMint',
        virtualSolReserves: new BN(93 * LAMPORTS_PER_SOL),
        virtualTokenReserves: new BN(100_000_000),
        realSolReserves: new BN(63 * LAMPORTS_PER_SOL),
        realTokenReserves: new BN(100_000_000),
        complete: true,
        currentPriceSol: 0.001,
        marketCapSol: 93,
        graduationProgress: 100,
      };

      expect(curve.complete).toBe(true);
      expect(curve.graduationProgress).toBe(100);
    });
  });

  // ─── SwarmPhase ─────────────────────────────────────────────

  describe('SwarmPhase', () => {
    it('includes all expected phases', () => {
      const phases: SwarmPhase[] = [
        'idle', 'initializing', 'funding', 'scanning',
        'evaluating', 'creating_narrative', 'minting', 'bundling',
        'distributing', 'trading', 'market_making', 'accumulating',
        'graduating', 'exiting', 'reclaiming', 'completed',
        'paused', 'error', 'emergency_exit',
      ];

      // This is a compile-time check — if any phase is wrong, TS will error.
      // At runtime, just verify the array is the expected length.
      expect(phases).toHaveLength(19);
    });
  });

  // ─── SwarmEvent ─────────────────────────────────────────────

  describe('SwarmEvent', () => {
    it('constructs a properly shaped event', () => {
      const event: SwarmEvent = {
        id: 'evt-1',
        type: 'trade:executed',
        category: 'trading',
        source: 'trader-0',
        payload: { price: 0.001, amount: 50_000_000 },
        timestamp: Date.now(),
        correlationId: 'corr-1',
      };

      expect(event.category).toBe('trading');
      expect(event.correlationId).toBe('corr-1');
    });

    it('allows all valid categories', () => {
      const categories: SwarmEventCategory[] = [
        'lifecycle', 'trading', 'analytics', 'bundle',
        'intelligence', 'coordination', 'system', 'wallet',
        'error', 'metrics',
      ];
      expect(categories).toHaveLength(10);
    });
  });

  // ─── AgentRole ──────────────────────────────────────────────

  describe('AgentRole', () => {
    it('includes all defined roles', () => {
      const roles: AgentRole[] = [
        'creator', 'trader', 'analyst', 'sniper',
        'market_maker', 'volume_bot', 'accumulator',
        'exit_manager', 'sentinel', 'scanner', 'narrator',
      ];
      expect(roles).toHaveLength(11);
    });
  });

  // ─── PhaseTransition ───────────────────────────────────────

  describe('PhaseTransition', () => {
    it('defines a valid transition', () => {
      const t: PhaseTransition = {
        from: 'idle',
        to: 'initializing',
        timeoutMs: 30_000,
      };
      expect(t.from).toBe('idle');
      expect(t.to).toBe('initializing');
    });

    it('supports optional guard and action', () => {
      const t: PhaseTransition = {
        from: 'minting',
        to: 'bundling',
        guard: () => true,
        action: () => { /* setup bundling */ },
        timeoutMs: 60_000,
      };
      expect(t.guard).toBeDefined();
      expect(t.action).toBeDefined();
    });
  });

  // ─── WalletAssignment ──────────────────────────────────────

  describe('WalletAssignment', () => {
    it('tracks wallet-to-agent mapping', () => {
      const kp = Keypair.generate();
      const assignment: WalletAssignment = {
        wallet: {
          keypair: kp,
          address: kp.publicKey.toBase58(),
          label: 'trader-0',
          balanceLamports: new BN(LAMPORTS_PER_SOL),
        },
        agentId: 'agent-trader-0',
        role: 'trader',
        assignedAt: Date.now(),
        locked: false,
      };

      expect(assignment.locked).toBe(false);
      expect(assignment.role).toBe('trader');
    });
  });
});
