/**
 * Wallet Manager — Solana Wallet Pool Management
 *
 * Generates, funds, and manages a pool of Solana wallets for the swarm.
 * The creator wallet mints the token; trader wallets trade it.
 *
 * Enhanced with HD wallet derivation, assignment tracking, concurrent
 * transaction safety, encrypted key storage, and fund distribution strategies.
 */

import {
  Keypair,
  Connection,
  SystemProgram,
  Transaction,
  PublicKey,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import BN from 'bn.js';
import bs58 from 'bs58';
import * as bip39 from 'bip39';
import { derivePath } from 'ed25519-hd-key';
import nacl from 'tweetnacl';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'node:crypto';
import { writeFile, readFile } from 'node:fs/promises';
import EventEmitter from 'eventemitter3';
import type { AgentWallet, WalletPool, WalletVaultConfig, WalletAssignment, AgentRole } from './types.js';

/** Minimum SOL balance to keep in each wallet for rent + fees */
const MIN_RENT_LAMPORTS = new BN(5_000_000); // 0.005 SOL

/**
 * Create a new agent wallet from a fresh keypair.
 */
export function createAgentWallet(label: string): AgentWallet {
  const keypair = Keypair.generate();
  return {
    keypair,
    address: keypair.publicKey.toBase58(),
    label,
    balanceLamports: new BN(0),
  };
}

/**
 * Restore an agent wallet from a base58-encoded secret key.
 */
export function restoreAgentWallet(secretKeyBase58: string, label: string): AgentWallet {
  const secretKey = bs58.decode(secretKeyBase58);
  const keypair = Keypair.fromSecretKey(secretKey);
  return {
    keypair,
    address: keypair.publicKey.toBase58(),
    label,
    balanceLamports: new BN(0),
  };
}

/**
 * Generate a complete wallet pool for the swarm.
 *
 * @param traderCount - Number of trader wallets to create
 * @param creatorSecretKey - Optional: restore a specific creator wallet
 * @param traderSecretKeys - Optional: restore specific trader wallets
 */
export function generateWalletPool(
  traderCount: number,
  creatorSecretKey?: string,
  traderSecretKeys?: string[],
): WalletPool {
  const creator = creatorSecretKey
    ? restoreAgentWallet(creatorSecretKey, 'creator')
    : createAgentWallet('creator');

  const traders: AgentWallet[] = [];
  for (let i = 0; i < traderCount; i++) {
    const existingKey = traderSecretKeys?.[i];
    const wallet = existingKey
      ? restoreAgentWallet(existingKey, `trader-${i}`)
      : createAgentWallet(`trader-${i}`);
    traders.push(wallet);
  }

  return { creator, traders };
}

/**
 * Refresh SOL balances for all wallets in the pool.
 */
export async function refreshBalances(
  connection: Connection,
  pool: WalletPool,
): Promise<void> {
  const allWallets = [pool.creator, ...pool.traders];
  if (pool.feeRecipient) allWallets.push(pool.feeRecipient);

  const publicKeys = allWallets.map((w) => w.keypair.publicKey);

  // Batch fetch balances using getMultipleAccountsInfo
  const accounts = await connection.getMultipleAccountsInfo(publicKeys);

  for (let i = 0; i < allWallets.length; i++) {
    const account = accounts[i];
    allWallets[i].balanceLamports = new BN(account?.lamports ?? 0);
  }
}

/**
 * Fund trader wallets from the creator wallet.
 * Distributes SOL evenly across all traders.
 *
 * @param connection - Solana RPC connection
 * @param pool - The wallet pool
 * @param totalLamports - Total SOL to distribute (in lamports)
 */
export async function fundTraders(
  connection: Connection,
  pool: WalletPool,
  totalLamports: BN,
): Promise<string[]> {
  const perTrader = totalLamports.div(new BN(pool.traders.length));
  const signatures: string[] = [];

  // Send in batches of 5 to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < pool.traders.length; i += batchSize) {
    const batch = pool.traders.slice(i, i + batchSize);
    const tx = new Transaction();

    for (const trader of batch) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: pool.creator.keypair.publicKey,
          toPubkey: trader.keypair.publicKey,
          lamports: perTrader.toNumber(),
        }),
      );
    }

    const sig = await sendAndConfirmTransaction(connection, tx, [pool.creator.keypair], {
      commitment: 'confirmed',
    });
    signatures.push(sig);
  }

  // Refresh balances after funding
  await refreshBalances(connection, pool);

  return signatures;
}

/**
 * Reclaim SOL from all trader wallets back to the creator.
 * Useful for cleanup after a swarm session.
 */
export async function reclaimFunds(
  connection: Connection,
  pool: WalletPool,
): Promise<string[]> {
  const signatures: string[] = [];

  for (const trader of pool.traders) {
    if (trader.balanceLamports.lte(MIN_RENT_LAMPORTS)) continue;

    const reclaimable = trader.balanceLamports.sub(MIN_RENT_LAMPORTS);
    if (reclaimable.lten(0)) continue;

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: trader.keypair.publicKey,
        toPubkey: pool.creator.keypair.publicKey,
        lamports: reclaimable.toNumber(),
      }),
    );

    try {
      const sig = await sendAndConfirmTransaction(connection, tx, [trader.keypair], {
        commitment: 'confirmed',
      });
      signatures.push(sig);
    } catch (error) {
      // Log but don't throw — reclaim is best-effort
      console.warn(`[wallet] Failed to reclaim from ${trader.label}:`, error);
    }
  }

  await refreshBalances(connection, pool);
  return signatures;
}

/**
 * Export wallet pool keys for backup (SENSITIVE — handle securely).
 */
export function exportWalletKeys(pool: WalletPool): {
  creator: string;
  traders: string[];
} {
  return {
    creator: bs58.encode(pool.creator.keypair.secretKey),
    traders: pool.traders.map((t) => bs58.encode(t.keypair.secretKey)),
  };
}

/**
 * Get a summary of the wallet pool for logging (no secret keys).
 */
export function getPoolSummary(pool: WalletPool): {
  creator: { address: string; balanceSol: number };
  traders: Array<{ label: string; address: string; balanceSol: number }>;
} {
  return {
    creator: {
      address: pool.creator.address,
      balanceSol: pool.creator.balanceLamports.toNumber() / LAMPORTS_PER_SOL,
    },
    traders: pool.traders.map((t) => ({
      label: t.label,
      address: t.address,
      balanceSol: t.balanceLamports.toNumber() / LAMPORTS_PER_SOL,
    })),
  };
}

// ─── Encryption Constants ─────────────────────────────────────

const ENCRYPTION_ALGO = 'aes-256-gcm';
const SCRYPT_KEY_LEN = 32;
const SCRYPT_SALT_LEN = 32;
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

// ─── Wallet Vault Events ─────────────────────────────────────

export interface WalletVaultEvents {
  'wallet:assigned': (assignment: WalletAssignment) => void;
  'wallet:released': (agentId: string, address: string) => void;
  'wallet:locked': (agentId: string, txSignature: string) => void;
  'wallet:unlocked': (agentId: string) => void;
  'wallet:low-balance': (wallet: AgentWallet, balanceLamports: BN) => void;
  'wallet:funded': (agentId: string, lamports: BN, signature: string) => void;
  'wallet:reclaimed': (address: string, lamports: BN, signature: string) => void;
  'vault:initialized': (poolSize: number) => void;
  'error': (error: Error) => void;
}

// ─── Solana HD Derivation Path ────────────────────────────────

const SOLANA_DERIVATION_BASE = "m/44'/501'";

/**
 * Derive a Solana keypair from a BIP-39 seed at a given index.
 */
function deriveKeypairFromSeed(seed: Buffer, index: number): Keypair {
  const path = `${SOLANA_DERIVATION_BASE}/${index}'/0'`;
  const derived = derivePath(path, seed.toString('hex'));
  const keyPair = nacl.sign.keyPair.fromSeed(derived.key);
  return Keypair.fromSecretKey(keyPair.secretKey);
}

/**
 * WalletVault — Enhanced wallet management with HD derivation,
 * assignment tracking, concurrent safety, and encrypted storage.
 *
 * Extends the existing wallet-manager functions with a class-based API
 * that supports deterministic wallet generation from a BIP-39 mnemonic,
 * per-agent wallet assignments, transaction locking, and multiple
 * fund distribution strategies.
 *
 * @example
 * ```typescript
 * const vault = new WalletVault(
 *   { poolSize: 5, minBalanceLamports: new BN(5_000_000) },
 *   connection,
 * );
 * await vault.initialize();
 * const wallet = vault.getWallet('trader', 'agent-1');
 * vault.lockWallet('agent-1', 'tx-sig-abc');
 * // ... perform transaction ...
 * vault.unlockWallet('agent-1');
 * vault.releaseWallet('agent-1');
 * ```
 */
export class WalletVault extends EventEmitter<WalletVaultEvents> {
  private readonly config: WalletVaultConfig;
  private readonly connection: Connection;
  private readonly wallets: AgentWallet[] = [];
  private readonly assignments: Map<string, WalletAssignment> = new Map();
  private readonly assignedAddresses: Set<string> = new Set();
  private readonly lockTimeouts: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private mnemonic: string | undefined;
  private initialized = false;

  constructor(config: WalletVaultConfig, connection: Connection) {
    super();
    this.config = {
      lockTimeoutMs: 60_000,
      ...config,
    };
    this.connection = connection;
  }

  // ─── Initialization ───────────────────────────────────────

  /**
   * Initialize the wallet pool. Generates wallets from mnemonic (HD derivation)
   * or creates random wallets if no mnemonic is configured.
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('[WalletVault] Already initialized');
    }

    if (this.config.mnemonic) {
      this.mnemonic = this.config.mnemonic;
      const derived = this.deriveFromMnemonic(this.mnemonic, this.config.poolSize);
      this.wallets.push(...derived);
    } else {
      for (let i = 0; i < this.config.poolSize; i++) {
        this.wallets.push(createAgentWallet(`vault-${i}`));
      }
    }

    this.initialized = true;
    this.emit('vault:initialized', this.wallets.length);
  }

  // ─── HD Derivation ────────────────────────────────────────

  /**
   * Generate a new 24-word BIP-39 mnemonic.
   */
  generateMnemonic(): string {
    return bip39.generateMnemonic(256);
  }

  /**
   * Derive `count` Solana keypairs from a BIP-39 mnemonic.
   *
   * Uses the standard Solana derivation path: m/44'/501'/{index}'/0'
   *
   * @param mnemonic - 24-word BIP-39 mnemonic
   * @param count - Number of wallets to derive
   * @returns Array of AgentWallet instances
   */
  deriveFromMnemonic(mnemonic: string, count: number): AgentWallet[] {
    if (!bip39.validateMnemonic(mnemonic)) {
      throw new Error('[WalletVault] Invalid BIP-39 mnemonic');
    }

    const seed = bip39.mnemonicToSeedSync(mnemonic);
    const derived: AgentWallet[] = [];

    for (let i = 0; i < count; i++) {
      const keypair = deriveKeypairFromSeed(Buffer.from(seed), i);
      derived.push({
        keypair,
        address: keypair.publicKey.toBase58(),
        label: `hd-${i}`,
        balanceLamports: new BN(0),
      });
    }

    return derived;
  }

  // ─── Assignment ───────────────────────────────────────────

  /**
   * Assign an available wallet to an agent.
   *
   * @param role - The agent's role
   * @param agentId - Unique agent identifier
   * @returns The assigned wallet
   * @throws If the agent already has a wallet or no unassigned wallets remain
   */
  getWallet(role: AgentRole, agentId: string): AgentWallet {
    this.ensureInitialized();

    const existing = this.assignments.get(agentId);
    if (existing) {
      return existing.wallet;
    }

    const available = this.wallets.find((w) => !this.assignedAddresses.has(w.address));
    if (!available) {
      throw new Error(`[WalletVault] No unassigned wallets available (pool size: ${this.wallets.length})`);
    }

    const assignment: WalletAssignment = {
      wallet: available,
      agentId,
      role,
      assignedAt: Date.now(),
      locked: false,
    };

    this.assignments.set(agentId, assignment);
    this.assignedAddresses.add(available.address);
    this.emit('wallet:assigned', assignment);

    return available;
  }

  /**
   * Release a wallet assignment, making it available for other agents.
   *
   * @param agentId - The agent to release the wallet from
   * @throws If the wallet is currently locked
   */
  releaseWallet(agentId: string): void {
    const assignment = this.assignments.get(agentId);
    if (!assignment) return;

    if (assignment.locked) {
      throw new Error(`[WalletVault] Cannot release locked wallet for agent ${agentId}`);
    }

    this.assignedAddresses.delete(assignment.wallet.address);
    this.assignments.delete(agentId);
    this.emit('wallet:released', agentId, assignment.wallet.address);
  }

  // ─── Locking ──────────────────────────────────────────────

  /**
   * Lock a wallet during a transaction to prevent concurrent usage.
   *
   * Automatically unlocks after `lockTimeoutMs` (default 60s) to prevent
   * permanent deadlocks from failed transactions.
   *
   * @param agentId - The agent whose wallet to lock
   * @param txSignature - Transaction signature that caused the lock
   * @throws If the wallet is already locked or not assigned
   */
  lockWallet(agentId: string, txSignature: string): void {
    const assignment = this.assignments.get(agentId);
    if (!assignment) {
      throw new Error(`[WalletVault] No wallet assigned to agent ${agentId}`);
    }
    if (assignment.locked) {
      throw new Error(
        `[WalletVault] Wallet for agent ${agentId} is already locked (tx: ${assignment.lockTxSignature})`,
      );
    }

    assignment.locked = true;
    assignment.lockTxSignature = txSignature;
    assignment.lockedAt = Date.now();

    // Auto-unlock after timeout to prevent permanent deadlocks
    const timeout = setTimeout(() => {
      if (assignment.locked) {
        console.warn(
          `[WalletVault] Auto-unlocking wallet for agent ${agentId} after ${this.config.lockTimeoutMs}ms timeout`,
        );
        this.unlockWallet(agentId);
      }
    }, this.config.lockTimeoutMs);

    this.lockTimeouts.set(agentId, timeout);
    this.emit('wallet:locked', agentId, txSignature);
  }

  /**
   * Unlock a wallet after a transaction completes.
   *
   * @param agentId - The agent whose wallet to unlock
   */
  unlockWallet(agentId: string): void {
    const assignment = this.assignments.get(agentId);
    if (!assignment) return;

    assignment.locked = false;
    assignment.lockTxSignature = undefined;
    assignment.lockedAt = undefined;

    const timeout = this.lockTimeouts.get(agentId);
    if (timeout) {
      clearTimeout(timeout);
      this.lockTimeouts.delete(agentId);
    }

    this.emit('wallet:unlocked', agentId);
  }

  /**
   * Check if an agent's wallet is currently locked.
   */
  isLocked(agentId: string): boolean {
    const assignment = this.assignments.get(agentId);
    return assignment?.locked ?? false;
  }

  // ─── Query ────────────────────────────────────────────────

  /**
   * Get the assignment for a specific agent.
   */
  getAssignment(agentId: string): WalletAssignment | undefined {
    return this.assignments.get(agentId);
  }

  /**
   * Get all current wallet assignments.
   */
  getAllAssignments(): WalletAssignment[] {
    return Array.from(this.assignments.values());
  }

  /**
   * Get all wallets that have not been assigned to any agent.
   */
  getUnassignedWallets(): AgentWallet[] {
    return this.wallets.filter((w) => !this.assignedAddresses.has(w.address));
  }

  // ─── Funding ──────────────────────────────────────────────

  /**
   * Fund a specific agent's wallet.
   *
   * @param agentId - Agent whose wallet to fund
   * @param lamports - Amount in lamports
   * @param funderKeypair - Keypair that provides the funds
   * @returns Transaction signature
   */
  async fundWallet(agentId: string, lamports: BN, funderKeypair: Keypair): Promise<string> {
    const assignment = this.assignments.get(agentId);
    if (!assignment) {
      throw new Error(`[WalletVault] No wallet assigned to agent ${agentId}`);
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: funderKeypair.publicKey,
        toPubkey: assignment.wallet.keypair.publicKey,
        lamports: lamports.toNumber(),
      }),
    );

    const sig = await sendAndConfirmTransaction(this.connection, tx, [funderKeypair], {
      commitment: 'confirmed',
    });

    assignment.wallet.balanceLamports = assignment.wallet.balanceLamports.add(lamports);
    this.emit('wallet:funded', agentId, lamports, sig);

    return sig;
  }

  /**
   * Fund all trader-assigned wallets using a distribution strategy.
   *
   * Strategies:
   * - `equal`: Split total evenly across all traders
   * - `weighted`: Creator gets 40%, traders split 60% by strategy aggressiveness
   * - `random`: Random distribution with min/max constraints (looks organic)
   *
   * @param funderKeypair - Keypair providing the funds
   * @param totalLamports - Total lamports to distribute
   * @param distribution - Distribution strategy
   * @returns Array of transaction signatures
   */
  async fundAllTraders(
    funderKeypair: Keypair,
    totalLamports: BN,
    distribution: 'equal' | 'weighted' | 'random',
  ): Promise<string[]> {
    const traderAssignments = this.getAllAssignments().filter((a) => a.role === 'trader');
    if (traderAssignments.length === 0) {
      throw new Error('[WalletVault] No trader wallets assigned');
    }

    const allocations = this.calculateDistribution(
      totalLamports,
      traderAssignments.length,
      distribution,
    );

    const signatures: string[] = [];
    const batchSize = 5;

    for (let i = 0; i < traderAssignments.length; i += batchSize) {
      const batch = traderAssignments.slice(i, i + batchSize);
      const tx = new Transaction();

      for (let j = 0; j < batch.length; j++) {
        const assignment = batch[j];
        const amount = allocations[i + j];
        tx.add(
          SystemProgram.transfer({
            fromPubkey: funderKeypair.publicKey,
            toPubkey: assignment.wallet.keypair.publicKey,
            lamports: amount.toNumber(),
          }),
        );
      }

      const sig = await sendAndConfirmTransaction(this.connection, tx, [funderKeypair], {
        commitment: 'confirmed',
      });
      signatures.push(sig);

      // Update balances for this batch
      for (let j = 0; j < batch.length; j++) {
        batch[j].wallet.balanceLamports = batch[j].wallet.balanceLamports.add(allocations[i + j]);
      }
    }

    return signatures;
  }

  /**
   * Calculate fund distribution amounts based on strategy.
   */
  private calculateDistribution(
    totalLamports: BN,
    traderCount: number,
    strategy: 'equal' | 'weighted' | 'random',
  ): BN[] {
    switch (strategy) {
      case 'equal':
        return this.distributeEqual(totalLamports, traderCount);
      case 'weighted':
        return this.distributeWeighted(totalLamports, traderCount);
      case 'random':
        return this.distributeRandom(totalLamports, traderCount);
    }
  }

  private distributeEqual(totalLamports: BN, count: number): BN[] {
    const perWallet = totalLamports.div(new BN(count));
    const remainder = totalLamports.mod(new BN(count));
    const allocations: BN[] = [];

    for (let i = 0; i < count; i++) {
      // Give the remainder to the first wallet
      allocations.push(i === 0 ? perWallet.add(remainder) : perWallet.clone());
    }

    return allocations;
  }

  private distributeWeighted(totalLamports: BN, count: number): BN[] {
    // Traders split 100% with weighting: first gets more (simulates aggressiveness)
    // Weight distribution: linearly decreasing weights
    const weights: number[] = [];
    let totalWeight = 0;

    for (let i = 0; i < count; i++) {
      const weight = count - i; // First trader gets highest weight
      weights.push(weight);
      totalWeight += weight;
    }

    const allocations: BN[] = [];
    let allocated = new BN(0);

    for (let i = 0; i < count; i++) {
      const share =
        i === count - 1
          ? totalLamports.sub(allocated) // Last one gets the remainder
          : totalLamports.mul(new BN(weights[i])).div(new BN(totalWeight));
      allocations.push(share);
      allocated = allocated.add(share);
    }

    return allocations;
  }

  private distributeRandom(totalLamports: BN, count: number): BN[] {
    // Random distribution with min 10% and max 30% of average per wallet
    const avgPerWallet = totalLamports.div(new BN(count));
    const minAmount = avgPerWallet.mul(new BN(10)).div(new BN(100)); // 10% of avg
    const maxAmount = avgPerWallet.mul(new BN(300)).div(new BN(100)); // 300% of avg

    const rawShares: number[] = [];
    let rawTotal = 0;

    for (let i = 0; i < count; i++) {
      const share = Math.random() * 0.8 + 0.2; // 0.2 – 1.0
      rawShares.push(share);
      rawTotal += share;
    }

    // Normalize shares to sum to totalLamports, clamped to min/max
    const allocations: BN[] = [];
    let allocated = new BN(0);

    for (let i = 0; i < count; i++) {
      if (i === count - 1) {
        // Last wallet gets the remainder to ensure exact total
        allocations.push(totalLamports.sub(allocated));
      } else {
        const rawAllocation = totalLamports
          .mul(new BN(Math.floor(rawShares[i] * 1_000_000)))
          .div(new BN(Math.floor(rawTotal * 1_000_000)));

        // Clamp between min and max
        const clamped = BN.max(minAmount, BN.min(maxAmount, rawAllocation));
        allocations.push(clamped);
        allocated = allocated.add(clamped);
      }
    }

    return allocations;
  }

  // ─── Reclaim ──────────────────────────────────────────────

  /**
   * Reclaim SOL from all wallets in the pool to a recipient address.
   *
   * @param recipientPubkey - Public key to send reclaimed SOL to
   * @returns Array of transaction signatures
   */
  async reclaimAll(recipientPubkey: PublicKey): Promise<string[]> {
    const signatures: string[] = [];

    for (const wallet of this.wallets) {
      if (wallet.balanceLamports.lte(MIN_RENT_LAMPORTS)) continue;

      const reclaimable = wallet.balanceLamports.sub(MIN_RENT_LAMPORTS);
      if (reclaimable.lten(0)) continue;

      try {
        const tx = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: wallet.keypair.publicKey,
            toPubkey: recipientPubkey,
            lamports: reclaimable.toNumber(),
          }),
        );

        const sig = await sendAndConfirmTransaction(this.connection, tx, [wallet.keypair], {
          commitment: 'confirmed',
        });
        signatures.push(sig);
        this.emit('wallet:reclaimed', wallet.address, reclaimable, sig);
      } catch (error) {
        console.warn(`[WalletVault] Failed to reclaim from ${wallet.label}:`, error);
      }
    }

    await this.refreshAllBalances();
    return signatures;
  }

  /**
   * Reclaim SOL from a specific agent's wallet.
   *
   * @param agentId - Agent whose wallet to reclaim from
   * @param recipientPubkey - Public key to send reclaimed SOL to
   * @returns Transaction signature
   */
  async reclaimFrom(agentId: string, recipientPubkey: PublicKey): Promise<string> {
    const assignment = this.assignments.get(agentId);
    if (!assignment) {
      throw new Error(`[WalletVault] No wallet assigned to agent ${agentId}`);
    }
    if (assignment.locked) {
      throw new Error(`[WalletVault] Cannot reclaim from locked wallet (agent: ${agentId})`);
    }

    const wallet = assignment.wallet;
    const reclaimable = wallet.balanceLamports.sub(MIN_RENT_LAMPORTS);
    if (reclaimable.lten(0)) {
      throw new Error(`[WalletVault] Insufficient balance to reclaim from ${wallet.label}`);
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.keypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: reclaimable.toNumber(),
      }),
    );

    const sig = await sendAndConfirmTransaction(this.connection, tx, [wallet.keypair], {
      commitment: 'confirmed',
    });

    wallet.balanceLamports = new BN(MIN_RENT_LAMPORTS.toNumber());
    this.emit('wallet:reclaimed', wallet.address, reclaimable, sig);

    return sig;
  }

  // ─── Balance Monitoring ───────────────────────────────────

  /**
   * Refresh balances for all wallets in the vault, emitting
   * low-balance events when thresholds are breached.
   */
  async refreshAllBalances(): Promise<void> {
    if (this.wallets.length === 0) return;

    const publicKeys = this.wallets.map((w) => w.keypair.publicKey);
    const accounts = await this.connection.getMultipleAccountsInfo(publicKeys);

    for (let i = 0; i < this.wallets.length; i++) {
      const account = accounts[i];
      const balance = new BN(account?.lamports ?? 0);
      this.wallets[i].balanceLamports = balance;

      if (balance.lt(this.config.minBalanceLamports)) {
        this.emit('wallet:low-balance', this.wallets[i], balance);
      }
    }
  }

  /**
   * Get the total SOL balance across all wallets in the pool.
   */
  getPoolBalance(): BN {
    let total = new BN(0);
    for (const wallet of this.wallets) {
      total = total.add(wallet.balanceLamports);
    }
    return total;
  }

  // ─── Key Export / Import ──────────────────────────────────

  /**
   * Export all wallet secret keys as base58-encoded strings.
   *
   * @returns Map of wallet label → base58-encoded secret key
   */
  exportKeys(): Record<string, string> {
    this.ensureInitialized();
    const keys: Record<string, string> = {};
    for (const wallet of this.wallets) {
      keys[wallet.label] = bs58.encode(wallet.keypair.secretKey);
    }
    return keys;
  }

  /**
   * Import wallets from base58-encoded secret keys.
   * Replaces the current wallet pool.
   *
   * @param keys - Map of wallet label → base58-encoded secret key
   */
  importKeys(keys: Record<string, string>): void {
    // Clear existing state
    this.wallets.length = 0;
    this.assignments.clear();
    this.assignedAddresses.clear();

    for (const [label, secretKeyBase58] of Object.entries(keys)) {
      this.wallets.push(restoreAgentWallet(secretKeyBase58, label));
    }

    this.initialized = true;
  }

  // ─── Encrypted Storage ────────────────────────────────────

  /**
   * Encrypt all wallet keys and save to a file.
   *
   * Uses AES-256-GCM with scrypt key derivation.
   *
   * @param filepath - Path to write the encrypted file
   * @throws If no encryption password is configured
   */
  async encryptAndSave(filepath: string): Promise<void> {
    const password = this.config.encryptionPassword;
    if (!password) {
      throw new Error('[WalletVault] No encryption password configured');
    }

    const keys = this.exportKeys();
    const plaintext = JSON.stringify(keys);

    const salt = randomBytes(SCRYPT_SALT_LEN);
    const key = scryptSync(password, salt, SCRYPT_KEY_LEN);
    const iv = randomBytes(IV_LEN);

    const cipher = createCipheriv(ENCRYPTION_ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // File format: [salt (32)] [iv (16)] [authTag (16)] [encrypted data]
    const output = Buffer.concat([salt, iv, authTag, encrypted]);

    // Add checksum
    const checksum = createHash('sha256').update(output).digest();
    const fileData = Buffer.concat([checksum, output]);

    await writeFile(filepath, fileData);
  }

  /**
   * Load and decrypt wallet keys from an encrypted file.
   *
   * @param filepath - Path to the encrypted file
   * @throws If decryption fails or file is corrupted
   */
  async loadAndDecrypt(filepath: string): Promise<void> {
    const password = this.config.encryptionPassword;
    if (!password) {
      throw new Error('[WalletVault] No encryption password configured');
    }

    const fileData = await readFile(filepath);

    // Verify checksum
    const storedChecksum = fileData.subarray(0, 32);
    const payload = fileData.subarray(32);
    const computedChecksum = createHash('sha256').update(payload).digest();

    if (!storedChecksum.equals(computedChecksum)) {
      throw new Error('[WalletVault] File checksum mismatch — file may be corrupted');
    }

    const salt = payload.subarray(0, SCRYPT_SALT_LEN);
    const iv = payload.subarray(SCRYPT_SALT_LEN, SCRYPT_SALT_LEN + IV_LEN);
    const authTag = payload.subarray(SCRYPT_SALT_LEN + IV_LEN, SCRYPT_SALT_LEN + IV_LEN + AUTH_TAG_LEN);
    const encrypted = payload.subarray(SCRYPT_SALT_LEN + IV_LEN + AUTH_TAG_LEN);

    const key = scryptSync(password, salt, SCRYPT_KEY_LEN);
    const decipher = createDecipheriv(ENCRYPTION_ALGO, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    const keys = JSON.parse(decrypted.toString('utf8')) as Record<string, string>;

    this.importKeys(keys);
  }

  // ─── Internal Helpers ─────────────────────────────────────

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('[WalletVault] Not initialized — call initialize() first');
    }
  }
}
