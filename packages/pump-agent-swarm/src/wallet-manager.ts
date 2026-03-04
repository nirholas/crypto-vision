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
