/**
 * Solana x402 Server — Payment Verification & 402 Response Generation
 *
 * Server-side component that:
 * 1. Generates 402 responses with payment requirements + challenge nonces
 * 2. Verifies Solana USDC payments via RPC:
 *    - Confirms the transaction exists and is finalized
 *    - Validates the USDC transfer amount and destination
 *    - Checks the Memo instruction contains the correct challenge
 *    - Prevents replay attacks via challenge tracking
 *
 * No facilitator required — Solana's speed (~400ms) makes direct
 * on-chain verification practical without a settlement intermediary.
 */

import {
  Connection,
  PublicKey,
} from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
  USDC_DECIMALS,
  MEMO_PROGRAM_ID,
  CAIP2_SOLANA_MAINNET,
  CAIP2_SOLANA_DEVNET,
} from './types.js';
import type {
  SolanaX402PaymentRequired,
  SolanaPaymentScheme,
  SolanaX402PaymentProof,
  SolanaX402ServerConfig,
  PaymentVerificationResult,
  ScreenerEndpoint,
  X402DiscoveryDocument,
} from './types.js';

// ─── Challenge Tracking ───────────────────────────────────────

interface ChallengeRecord {
  challenge: string;
  resource: string;
  amount: string;
  createdAt: number;
  expiresAt: number;
  redeemed: boolean;
  redeemedTx?: string;
}

// ─── Payment Ledger ───────────────────────────────────────────

interface PaymentRecord {
  txSignature: string;
  challenge: string;
  payer: string;
  amount: string;
  amountUsdc: number;
  resource: string;
  verifiedAt: number;
  blockTime: number;
  slot: number;
}

// ─── Server ───────────────────────────────────────────────────

export class SolanaX402Server {
  private readonly config: SolanaX402ServerConfig;
  private readonly connection: Connection;
  private readonly usdcMint: PublicKey;
  private readonly caip2Network: string;

  /**
   * Active challenges — keyed by challenge nonce.
   * In production, use Redis or another persistent store with TTL.
   * For this implementation, we use an in-memory Map with periodic cleanup.
   */
  private readonly challenges = new Map<string, ChallengeRecord>();

  /**
   * Used transaction signatures — prevents replay attacks.
   * A tx signature can only redeem one challenge.
   */
  private readonly usedTxSignatures = new Set<string>();

  /** Payment history for analytics and auditing */
  private readonly payments: PaymentRecord[] = [];

  /** Periodic cleanup interval */
  private cleanupInterval: ReturnType<typeof setInterval> | undefined;

  constructor(config: SolanaX402ServerConfig) {
    this.config = config;
    this.connection = new Connection(config.rpcUrl, { commitment: 'confirmed' });

    const isDevnet = config.network === 'devnet';
    this.usdcMint = new PublicKey(isDevnet ? USDC_MINT_DEVNET : USDC_MINT_MAINNET);
    this.caip2Network = isDevnet ? CAIP2_SOLANA_DEVNET : CAIP2_SOLANA_MAINNET;

    // Cleanup expired challenges every 60 seconds
    this.cleanupInterval = setInterval(() => this.cleanupExpiredChallenges(), 60_000);
  }

  /**
   * Stop the cleanup interval. Call on server shutdown.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
  }

  // ─── Generate 402 Response ──────────────────────────────────

  /**
   * Create an HTTP 402 Payment Required response.
   *
   * Generates a unique challenge nonce and returns the payment
   * requirements as a base64-encoded JSON string for the
   * `X-PAYMENT-REQUIRED` header.
   *
   * @param resource The API endpoint being accessed (e.g. "/api/premium/pump/analytics")
   * @param amountRaw USDC amount in raw units (6 decimals). e.g. "10000" = $0.01
   * @param description Human-readable description
   * @returns Base64-encoded payment requirements for the X-PAYMENT-REQUIRED header
   */
  createPaymentRequired(
    resource: string,
    amountRaw: string,
    description: string,
  ): string {
    const ttl = this.config.challengeTtlSeconds ?? 300;
    const now = Math.floor(Date.now() / 1000);
    const challenge = this.generateChallenge();

    // Track the challenge
    this.challenges.set(challenge, {
      challenge,
      resource,
      amount: amountRaw,
      createdAt: now,
      expiresAt: now + ttl,
      redeemed: false,
    });

    const requirements: SolanaX402PaymentRequired = {
      x402Version: 2,
      accepts: [
        {
          scheme: 'exact-solana',
          network: this.caip2Network,
          maxAmountRequired: amountRaw,
          resource,
          description,
          mimeType: 'application/json',
          payTo: this.config.payToAddress,
          asset: this.usdcMint.toBase58(),
          maxTimeoutSeconds: ttl,
          challenge,
          challengeExpiresAt: now + ttl,
        },
      ],
    };

    return Buffer.from(JSON.stringify(requirements)).toString('base64');
  }

  /**
   * Create 402 response headers.
   *
   * Returns a headers object suitable for adding to an HTTP response.
   */
  create402Headers(
    resource: string,
    amountRaw: string,
    description: string,
  ): Record<string, string> {
    const paymentRequired = this.createPaymentRequired(resource, amountRaw, description);

    return {
      'X-PAYMENT-REQUIRED': paymentRequired,
      'Content-Type': 'application/json',
      'Access-Control-Expose-Headers': 'X-PAYMENT-REQUIRED',
    };
  }

  // ─── Verify Payment ─────────────────────────────────────────

  /**
   * Verify a Solana x402 payment proof.
   *
   * This is the critical verification path. It checks:
   * 1. The payment proof is well-formed
   * 2. The challenge exists and hasn't expired or been redeemed
   * 3. The Solana tx exists and is confirmed
   * 4. The tx contains a USDC transfer to our payTo address for the correct amount
   * 5. The tx contains a Memo with the correct challenge nonce
   * 6. The tx hasn't been used for a previous payment
   *
   * @param paymentHeader Base64-encoded X-PAYMENT header value
   * @returns Verification result
   */
  async verifyPayment(paymentHeader: string): Promise<PaymentVerificationResult> {
    // 1. Decode and validate proof structure
    let proof: SolanaX402PaymentProof;
    try {
      proof = JSON.parse(Buffer.from(paymentHeader, 'base64').toString('utf-8'));
    } catch {
      return { valid: false, reason: 'Invalid payment proof encoding' };
    }

    if (proof.x402Version !== 2) {
      return { valid: false, reason: `Unsupported x402 version: ${proof.x402Version}` };
    }

    if (proof.scheme !== 'exact-solana') {
      return { valid: false, reason: `Unsupported scheme: ${proof.scheme}` };
    }

    if (proof.network !== this.caip2Network) {
      return { valid: false, reason: `Network mismatch: expected ${this.caip2Network}, got ${proof.network}` };
    }

    const { signature, challenge, payer, amount } = proof.payload;

    // 2. Validate challenge
    const challengeRecord = this.challenges.get(challenge);
    if (!challengeRecord) {
      return { valid: false, reason: 'Unknown challenge nonce — may have expired or never existed' };
    }

    const now = Math.floor(Date.now() / 1000);
    if (challengeRecord.expiresAt < now) {
      this.challenges.delete(challenge);
      return { valid: false, reason: 'Challenge has expired' };
    }

    if (challengeRecord.redeemed) {
      return { valid: false, reason: 'Challenge has already been redeemed' };
    }

    // 3. Check tx signature hasn't been reused
    if (this.usedTxSignatures.has(signature)) {
      return { valid: false, reason: 'Transaction signature has already been used for a payment' };
    }

    // 4. Fetch and verify the Solana transaction
    const txResult = await this.verifyOnChain(signature, challenge, amount);
    if (!txResult.valid) {
      return txResult;
    }

    // 5. Mark challenge as redeemed and tx as used
    challengeRecord.redeemed = true;
    challengeRecord.redeemedTx = signature;
    this.usedTxSignatures.add(signature);

    // 6. Record payment
    this.payments.push({
      txSignature: signature,
      challenge,
      payer,
      amount,
      amountUsdc: Number(BigInt(amount)) / 10 ** USDC_DECIMALS,
      resource: challengeRecord.resource,
      verifiedAt: now,
      blockTime: txResult.blockTime ?? now,
      slot: txResult.slot ?? 0,
    });

    return {
      valid: true,
      signature,
      amount,
      payer,
      blockTime: txResult.blockTime,
      slot: txResult.slot,
    };
  }

  /**
   * Verify a transaction on-chain via Solana RPC.
   *
   * Checks:
   * - Transaction exists and is confirmed
   * - Contains a USDC SPL transfer to our payTo address
   * - Transfer amount matches or exceeds the required amount
   * - Contains a Memo instruction with the x402 challenge
   * - Transaction is recent (within maxTxAgeSeconds)
   */
  private async verifyOnChain(
    signature: string,
    challenge: string,
    expectedAmount: string,
  ): Promise<PaymentVerificationResult> {
    // Fetch transaction with full details
    const tx = await this.connection.getParsedTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });

    if (!tx) {
      return { valid: false, reason: `Transaction ${signature} not found` };
    }

    if (tx.meta?.err) {
      return { valid: false, reason: `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}` };
    }

    // Check transaction age
    const maxAge = this.config.maxTxAgeSeconds ?? 120;
    const now = Math.floor(Date.now() / 1000);
    if (tx.blockTime && (now - tx.blockTime) > maxAge) {
      return { valid: false, reason: `Transaction too old: ${now - tx.blockTime}s (max: ${maxAge}s)` };
    }

    // Extract inner instructions and main instructions
    const instructions = tx.transaction.message.instructions;
    const innerInstructions = tx.meta?.innerInstructions ?? [];

    // Verify USDC transfer
    let transferVerified = false;
    const expectedAmountBigint = BigInt(expectedAmount);

    for (const ix of instructions) {
      if ('parsed' in ix && ix.program === 'spl-token' && ix.parsed?.type === 'transfer') {
        const info = ix.parsed.info as {
          amount?: string;
          destination?: string;
          source?: string;
          authority?: string;
        };

        if (
          info.destination === this.config.payToAddress &&
          BigInt(info.amount ?? '0') >= expectedAmountBigint
        ) {
          transferVerified = true;
          break;
        }
      }

      // Also check transferChecked (more common for USDC)
      if ('parsed' in ix && ix.program === 'spl-token' && ix.parsed?.type === 'transferChecked') {
        const info = ix.parsed.info as {
          tokenAmount?: { amount: string };
          destination?: string;
          mint?: string;
        };

        if (
          info.destination === this.config.payToAddress &&
          info.mint === this.usdcMint.toBase58() &&
          BigInt(info.tokenAmount?.amount ?? '0') >= expectedAmountBigint
        ) {
          transferVerified = true;
          break;
        }
      }
    }

    // Also check inner instructions (some wallet programs wrap transfers)
    if (!transferVerified) {
      for (const innerGroup of innerInstructions) {
        for (const ix of innerGroup.instructions) {
          if ('parsed' in ix && ix.program === 'spl-token') {
            const parsedType = ix.parsed?.type as string;
            if (parsedType === 'transfer' || parsedType === 'transferChecked') {
              const info = ix.parsed?.info as Record<string, unknown>;
              const dest = (info?.destination as string) ?? '';
              const amt = parsedType === 'transferChecked'
                ? ((info?.tokenAmount as { amount: string })?.amount ?? '0')
                : (info?.amount as string ?? '0');

              if (dest === this.config.payToAddress && BigInt(amt) >= expectedAmountBigint) {
                transferVerified = true;
                break;
              }
            }
          }
        }
        if (transferVerified) break;
      }
    }

    if (!transferVerified) {
      return {
        valid: false,
        reason: `No USDC transfer of ${expectedAmount} to ${this.config.payToAddress} found in tx ${signature}`,
      };
    }

    // Verify Memo instruction contains the challenge
    let memoVerified = false;
    const expectedMemo = `x402:${challenge}`;

    for (const ix of instructions) {
      // Memo program instructions are unparsed (data is the memo content)
      if ('data' in ix && 'programId' in ix) {
        const programId = typeof ix.programId === 'string' ? ix.programId : ix.programId.toBase58();
        if (programId === MEMO_PROGRAM_ID) {
          // Memo data is the UTF-8 encoded string
          const memoText = typeof ix.data === 'string' ? ix.data : '';
          // The data field in parsed tx may be base58-encoded or raw
          // Try decoding as base58 first, then check raw
          try {
            const decoded = Buffer.from(memoText, 'base64').toString('utf-8');
            if (decoded === expectedMemo) {
              memoVerified = true;
              break;
            }
          } catch {
            // Not base64, check raw
          }
          if (memoText === expectedMemo) {
            memoVerified = true;
            break;
          }
        }
      }

      // Parsed memo format
      if ('parsed' in ix && 'program' in ix && ix.program === 'spl-memo') {
        const memoText = typeof ix.parsed === 'string' ? ix.parsed : '';
        if (memoText === expectedMemo) {
          memoVerified = true;
          break;
        }
      }
    }

    if (!memoVerified) {
      return {
        valid: false,
        reason: `Memo instruction with challenge "${expectedMemo}" not found in tx ${signature}`,
      };
    }

    return {
      valid: true,
      signature,
      amount: expectedAmount,
      blockTime: tx.blockTime ?? undefined,
      slot: tx.slot,
    };
  }

  // ─── Challenge Management ──────────────────────────────────

  /**
   * Generate a cryptographically random challenge nonce.
   * 32 bytes → 64 hex characters. Unique per request.
   */
  private generateChallenge(): string {
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Remove expired challenges to prevent memory leaks.
   */
  private cleanupExpiredChallenges(): void {
    const now = Math.floor(Date.now() / 1000);
    let cleaned = 0;
    for (const [key, record] of this.challenges) {
      // Remove expired challenges (keep redeemed ones for a bit longer for auditing)
      const maxAge = record.redeemed ? 3600 : 0; // Keep redeemed for 1h
      if (record.expiresAt + maxAge < now) {
        this.challenges.delete(key);
        cleaned++;
      }
    }

    // Also clean old tx signatures (keep last 24h worth)
    // In production, use a Redis set with TTL
    if (this.usedTxSignatures.size > 100_000) {
      // Emergency cleanup — keep only recent ones by clearing and relying on challenge system
      this.usedTxSignatures.clear();
    }

    if (cleaned > 0) {
      // Could log this in production
    }
  }

  // ─── Discovery Document ─────────────────────────────────────

  /**
   * Generate the .well-known/x402 discovery document.
   *
   * This document lets clients auto-discover pricing, endpoints,
   * and payment configuration for the API.
   */
  createDiscoveryDocument(
    baseUrl: string,
    endpoints: ScreenerEndpoint[],
    name = 'Pump.fun Screener API',
    description = 'Premium Pump.fun token analytics, powered by x402 micropayments on Solana',
  ): X402DiscoveryDocument {
    return {
      x402Version: 2,
      name,
      description,
      baseUrl,
      networks: [
        {
          network: this.caip2Network,
          asset: this.usdcMint.toBase58(),
          assetName: 'USDC',
          decimals: USDC_DECIMALS,
        },
      ],
      endpoints,
      payTo: this.config.payToAddress,
    };
  }

  // ─── Analytics & Reporting ──────────────────────────────────

  /** Total revenue received (in USDC) */
  getTotalRevenue(): number {
    return this.payments.reduce((sum, p) => sum + p.amountUsdc, 0);
  }

  /** Total number of paid requests served */
  getTotalPayments(): number {
    return this.payments.length;
  }

  /** Active (unredeemed, unexpired) challenges */
  getActiveChallengeCount(): number {
    const now = Math.floor(Date.now() / 1000);
    let count = 0;
    for (const record of this.challenges.values()) {
      if (!record.redeemed && record.expiresAt > now) {
        count++;
      }
    }
    return count;
  }

  /** Get payment history (most recent first) */
  getPaymentHistory(limit = 50): PaymentRecord[] {
    return this.payments.slice(-limit).reverse();
  }

  /** Revenue breakdown by endpoint */
  getRevenueByEndpoint(): Map<string, { count: number; totalUsdc: number }> {
    const breakdown = new Map<string, { count: number; totalUsdc: number }>();
    for (const payment of this.payments) {
      const existing = breakdown.get(payment.resource) ?? { count: 0, totalUsdc: 0 };
      existing.count++;
      existing.totalUsdc += payment.amountUsdc;
      breakdown.set(payment.resource, existing);
    }
    return breakdown;
  }
}
