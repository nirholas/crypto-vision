/**
 * Devnet Fixtures
 *
 * Test fixtures and helpers for tests that interact with Solana devnet.
 * These are used by integration and E2E tests only.
 *
 * Note: Integration tests should set SOLANA_RPC_URL=https://api.devnet.solana.com
 * and may need `solana airdrop` for SOL balances.
 */

import { Connection, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { AgentWallet } from '../../types.js';
import BN from 'bn.js';

// ─── Constants ────────────────────────────────────────────────

const DEVNET_RPC = 'https://api.devnet.solana.com';
const AIRDROP_SOL = 1; // 1 SOL per airdrop
const AIRDROP_RETRY_DELAY_MS = 2_000;
const MAX_AIRDROP_RETRIES = 3;
const CONFIRMATION_TIMEOUT_MS = 60_000;

// ─── Connection ───────────────────────────────────────────────

let _devnetConnection: Connection | undefined;

/**
 * Get a shared devnet connection. Re-uses a single instance across tests
 * to avoid excess WebSocket connections.
 */
export function getDevnetConnection(): Connection {
  if (!_devnetConnection) {
    _devnetConnection = new Connection(DEVNET_RPC, {
      commitment: 'confirmed',
      confirmTransactionInitialTimeout: CONFIRMATION_TIMEOUT_MS,
    });
  }
  return _devnetConnection;
}

// ─── Airdrop ──────────────────────────────────────────────────

/**
 * Airdrop SOL to a wallet on devnet. Handles rate limiting with retries.
 *
 * @param connection - Solana connection
 * @param publicKey  - Base58 public key
 * @param solAmount  - SOL to airdrop (default: 1)
 */
export async function airdropToWallet(
  connection: Connection,
  publicKey: string,
  solAmount = AIRDROP_SOL,
): Promise<string> {
  const pk = new (await import('@solana/web3.js')).PublicKey(publicKey);

  for (let attempt = 1; attempt <= MAX_AIRDROP_RETRIES; attempt++) {
    try {
      const signature = await connection.requestAirdrop(
        pk,
        solAmount * LAMPORTS_PER_SOL,
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      await connection.confirmTransaction(
        { signature, ...latestBlockhash },
        'confirmed',
      );

      return signature;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === MAX_AIRDROP_RETRIES) {
        throw new Error(
          `Airdrop failed after ${MAX_AIRDROP_RETRIES} attempts: ${message}`,
        );
      }
      // Rate limiting — wait and retry
      await new Promise((r) => setTimeout(r, AIRDROP_RETRY_DELAY_MS * attempt));
    }
  }

  throw new Error('Airdrop unreachable');
}

// ─── Wallet Pool ──────────────────────────────────────────────

/**
 * Create a pool of funded devnet wallets for integration testing.
 * Each wallet receives an airdrop before being returned.
 *
 * WARNING: Devnet airdrops are rate-limited. For large pools, use
 * a pre-funded funder wallet and transfer instead.
 */
export async function createTestWalletPool(
  count: number,
  solPerWallet = AIRDROP_SOL,
): Promise<AgentWallet[]> {
  const connection = getDevnetConnection();
  const wallets: AgentWallet[] = [];

  for (let i = 0; i < count; i++) {
    const keypair = Keypair.generate();
    const wallet: AgentWallet = {
      keypair,
      address: keypair.publicKey.toBase58(),
      label: `devnet-test-${i}`,
      balanceLamports: new BN(0),
    };

    try {
      await airdropToWallet(connection, wallet.address, solPerWallet);
      wallet.balanceLamports = new BN(solPerWallet * LAMPORTS_PER_SOL);
    } catch {
      // Log but don't fail — some tests can proceed with 0 balance
      console.warn(`[devnet-fixtures] airdrop to wallet ${i} failed — continuing with 0 balance`);
    }

    wallets.push(wallet);
  }

  return wallets;
}

// ─── Cleanup ──────────────────────────────────────────────────

/**
 * Placeholder for wallet cleanup. In devnet, we don't need to reclaim —
 * the SOL will expire on devnet reset. For mainnet tests, implement
 * actual SOL reclamation here.
 */
export async function cleanupWallets(_wallets: AgentWallet[]): Promise<void> {
  // No-op on devnet; wallets are ephemeral
}

// ─── Fixtures ─────────────────────────────────────────────────

/**
 * Well-known pump.fun program ID (mainnet). Used for PDA derivation tests.
 */
export const PUMP_FUN_PROGRAM_ID = '6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P';

/**
 * Example bonding curve state for testing slippage calculations.
 * Represents a token early in its bonding curve lifecycle.
 */
export function createTestBondingCurveState() {
  return {
    mint: Keypair.generate().publicKey.toBase58(),
    virtualSolReserves: new BN(30 * LAMPORTS_PER_SOL),    // 30 SOL
    virtualTokenReserves: new BN(1_000_000_000_000),       // 1M tokens (6 decimals)
    realSolReserves: new BN(0),
    realTokenReserves: new BN(793_100_000_000),            // ~793K tokens remaining
    complete: false,
    currentPriceSol: 0.00003,
    marketCapSol: 30,
    graduationProgress: 0,
  };
}

/**
 * Example bonding curve state near graduation (~85 SOL raised).
 */
export function createNearGraduationCurveState() {
  return {
    mint: Keypair.generate().publicKey.toBase58(),
    virtualSolReserves: new BN(85 * LAMPORTS_PER_SOL),
    virtualTokenReserves: new BN(200_000_000_000),         // 200K tokens
    realSolReserves: new BN(55 * LAMPORTS_PER_SOL),
    realTokenReserves: new BN(200_000_000_000),
    complete: false,
    currentPriceSol: 0.000425,
    marketCapSol: 85,
    graduationProgress: 91.4,
  };
}
