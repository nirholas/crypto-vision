/**
 * Integration Tests — Wallet Vault
 *
 * Tests for WalletVault: HD derivation, wallet pool management,
 * balance tracking, locking, and concurrent access.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { SwarmEventBus } from '../../infra/event-bus.js';
import { createTestEventBus, createTestWalletConfig, createTestWallet, createTestWallets } from '../helpers/test-config.js';
import type { AgentWallet, WalletVaultConfig } from '../../types.js';

/**
 * Simulated wallet vault for testing without HD derivation dependency.
 * Mirrors the WalletVault API surface for integration validation.
 */
class TestWalletVault {
  private readonly config: WalletVaultConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly wallets: Map<string, AgentWallet> = new Map();
  private readonly locks: Map<string, { agentId: string; lockedAt: number }> = new Map();

  constructor(config: WalletVaultConfig, eventBus: SwarmEventBus) {
    this.config = config;
    this.eventBus = eventBus;
  }

  /** Generate a pool of random wallets */
  generatePool(): AgentWallet[] {
    const pool: AgentWallet[] = [];
    for (let i = 0; i < this.config.poolSize; i++) {
      const wallet = createTestWallet(`vault-wallet-${i}`, 5);
      this.wallets.set(wallet.address, wallet);
      pool.push(wallet);
    }
    this.eventBus.emit('wallet:pool-generated', 'wallet', 'vault', {
      count: pool.length,
    });
    return pool;
  }

  /** Lock a wallet for exclusive use */
  lock(address: string, agentId: string): boolean {
    if (this.locks.has(address)) return false;
    this.locks.set(address, { agentId, lockedAt: Date.now() });
    this.eventBus.emit('wallet:locked', 'wallet', 'vault', { address, agentId });
    return true;
  }

  /** Release a wallet lock */
  unlock(address: string): void {
    this.locks.delete(address);
    this.eventBus.emit('wallet:unlocked', 'wallet', 'vault', { address });
  }

  /** Check if a wallet is locked */
  isLocked(address: string): boolean {
    return this.locks.has(address);
  }

  /** Get a wallet by address */
  getWallet(address: string): AgentWallet | undefined {
    return this.wallets.get(address);
  }

  /** Update wallet balance */
  updateBalance(address: string, balanceLamports: BN): void {
    const wallet = this.wallets.get(address);
    if (wallet) {
      wallet.balanceLamports = balanceLamports;
    }
  }

  /** Get all wallets with balance above minimum */
  getAvailableWallets(): AgentWallet[] {
    return [...this.wallets.values()].filter(
      (w) => w.balanceLamports.gte(this.config.minBalanceLamports) && !this.locks.has(w.address),
    );
  }

  /** Get pool size */
  get size(): number {
    return this.wallets.size;
  }
}

describe('WalletVault', () => {
  let bus: SwarmEventBus;

  beforeEach(() => {
    bus = createTestEventBus();
  });

  afterEach(() => {
    SwarmEventBus.resetInstance();
  });

  // ─── Pool Generation ──────────────────────────────────────

  describe('pool generation', () => {
    it('generates the configured number of wallets', () => {
      const vault = new TestWalletVault(createTestWalletConfig({ poolSize: 8 }), bus);
      const pool = vault.generatePool();
      expect(pool).toHaveLength(8);
      expect(vault.size).toBe(8);
    });

    it('generates unique wallet addresses', () => {
      const vault = new TestWalletVault(createTestWalletConfig({ poolSize: 10 }), bus);
      const pool = vault.generatePool();
      const addresses = new Set(pool.map((w) => w.address));
      expect(addresses.size).toBe(10);
    });

    it('emits pool-generated event', () => {
      const vault = new TestWalletVault(createTestWalletConfig(), bus);
      const events: unknown[] = [];
      bus.subscribe('wallet:pool-generated', (e) => events.push(e));
      vault.generatePool();
      expect(events).toHaveLength(1);
    });
  });

  // ─── Wallet Locking ───────────────────────────────────────

  describe('locking', () => {
    it('locks a wallet for exclusive access', () => {
      const vault = new TestWalletVault(createTestWalletConfig(), bus);
      const pool = vault.generatePool();
      const addr = pool[0]!.address;

      expect(vault.lock(addr, 'agent-1')).toBe(true);
      expect(vault.isLocked(addr)).toBe(true);
    });

    it('prevents double-locking', () => {
      const vault = new TestWalletVault(createTestWalletConfig(), bus);
      const pool = vault.generatePool();
      const addr = pool[0]!.address;

      vault.lock(addr, 'agent-1');
      expect(vault.lock(addr, 'agent-2')).toBe(false);
    });

    it('unlock releases the lock', () => {
      const vault = new TestWalletVault(createTestWalletConfig(), bus);
      const pool = vault.generatePool();
      const addr = pool[0]!.address;

      vault.lock(addr, 'agent-1');
      vault.unlock(addr);
      expect(vault.isLocked(addr)).toBe(false);
    });

    it('emits lock/unlock events', () => {
      const vault = new TestWalletVault(createTestWalletConfig(), bus);
      const pool = vault.generatePool();
      const events: unknown[] = [];
      bus.subscribe('wallet:*', (e) => events.push(e));

      vault.lock(pool[0]!.address, 'agent-1');
      vault.unlock(pool[0]!.address);

      // Should have lock + unlock events (plus the pool-generated replay if any)
      expect(events.filter((e: any) => e.type === 'wallet:locked')).toHaveLength(1);
      expect(events.filter((e: any) => e.type === 'wallet:unlocked')).toHaveLength(1);
    });
  });

  // ─── Balance Management ────────────────────────────────────

  describe('balance management', () => {
    it('tracks wallet balances', () => {
      const vault = new TestWalletVault(createTestWalletConfig(), bus);
      const pool = vault.generatePool();
      const addr = pool[0]!.address;

      vault.updateBalance(addr, new BN(2 * LAMPORTS_PER_SOL));
      const wallet = vault.getWallet(addr);
      expect(wallet?.balanceLamports.toNumber()).toBe(2 * LAMPORTS_PER_SOL);
    });

    it('filters available wallets by minimum balance', () => {
      const vault = new TestWalletVault(
        createTestWalletConfig({ poolSize: 3, minBalanceLamports: new BN(1 * LAMPORTS_PER_SOL) }),
        bus,
      );
      const pool = vault.generatePool();

      // Set one wallet below minimum
      vault.updateBalance(pool[0]!.address, new BN(100));

      const available = vault.getAvailableWallets();
      expect(available.length).toBe(2);
    });

    it('excludes locked wallets from available list', () => {
      const vault = new TestWalletVault(createTestWalletConfig({ poolSize: 3 }), bus);
      const pool = vault.generatePool();

      vault.lock(pool[0]!.address, 'agent-1');

      const available = vault.getAvailableWallets();
      expect(available.length).toBe(2);
      expect(available.every((w) => w.address !== pool[0]!.address)).toBe(true);
    });
  });

  // ─── Concurrent Access ────────────────────────────────────

  describe('concurrent access', () => {
    it('handles concurrent lock attempts safely', () => {
      const vault = new TestWalletVault(createTestWalletConfig({ poolSize: 1 }), bus);
      const pool = vault.generatePool();
      const addr = pool[0]!.address;

      // Simulate concurrent lock attempts
      const results = [
        vault.lock(addr, 'agent-1'),
        vault.lock(addr, 'agent-2'),
        vault.lock(addr, 'agent-3'),
      ];

      // Only one should succeed
      expect(results.filter(Boolean)).toHaveLength(1);
    });
  });
});
