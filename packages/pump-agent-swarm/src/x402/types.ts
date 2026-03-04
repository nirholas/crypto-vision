/**
 * Solana-native x402 type definitions
 *
 * The x402 protocol uses HTTP 402 to gate API endpoints behind micropayments.
 * This file defines the Solana-specific types: SPL USDC transfers verified
 * via Solana RPC, using the Memo program for challenge-response verification.
 *
 * Payment chain: Agent → USDC SPL transfer + Memo → Solana → Server verifies via RPC
 * No EVM. No facilitator. Direct on-chain settlement in ~400ms.
 */

import type { TransactionSignature } from '@solana/web3.js';

// ─── Network Constants ────────────────────────────────────────

/** USDC SPL token mint on Solana Mainnet */
export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';

/** USDC SPL token mint on Solana Devnet */
export const USDC_MINT_DEVNET = '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU';

/** Solana Memo Program v2 */
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

/** CAIP-2 identifiers */
export const CAIP2_SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
export const CAIP2_SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

/** USDC has 6 decimal places */
export const USDC_DECIMALS = 6;

// ─── Payment Requirements (Server → Client) ──────────────────

/**
 * x402 payment requirements returned in the HTTP 402 response.
 *
 * Encoded as base64 JSON in the `X-PAYMENT-REQUIRED` header.
 * The client reads this to construct a Solana payment transaction.
 */
export interface SolanaX402PaymentRequired {
  /** Protocol version — always 2 */
  x402Version: 2;

  /** Accepted payment schemes. For Solana, we use 'exact-solana'. */
  accepts: SolanaPaymentScheme[];
}

export interface SolanaPaymentScheme {
  /** Payment scheme identifier */
  scheme: 'exact-solana';

  /** CAIP-2 network identifier */
  network: typeof CAIP2_SOLANA_MAINNET | typeof CAIP2_SOLANA_DEVNET | string;

  /** USDC amount in raw units (6 decimals). e.g. "10000" = $0.01 */
  maxAmountRequired: string;

  /** The API resource being purchased */
  resource: string;

  /** Human-readable description of what you're paying for */
  description: string;

  /** Response content type */
  mimeType: string;

  /** Server's USDC token account (ATA) to receive payment */
  payTo: string;

  /** USDC SPL token mint address */
  asset: string;

  /** Maximum seconds the server will wait for payment confirmation */
  maxTimeoutSeconds: number;

  /**
   * Unique challenge nonce — must be included in the Memo instruction.
   * Prevents replay attacks: each 402 response has a unique challenge.
   */
  challenge: string;

  /** Challenge expiry timestamp (Unix seconds) */
  challengeExpiresAt: number;
}

// ─── Payment Proof (Client → Server) ─────────────────────────

/**
 * Payment proof sent by the client in the `X-PAYMENT` header.
 *
 * After sending the USDC transfer + Memo tx on Solana, the client
 * encodes this as base64 JSON and includes it in the retry request.
 */
export interface SolanaX402PaymentProof {
  /** Protocol version */
  x402Version: 2;

  /** Scheme — matches the accepted scheme */
  scheme: 'exact-solana';

  /** CAIP-2 network */
  network: string;

  /** Proof payload */
  payload: SolanaPaymentPayload;
}

export interface SolanaPaymentPayload {
  /** Solana transaction signature (base58) */
  signature: TransactionSignature;

  /** The challenge nonce from the 402 response */
  challenge: string;

  /** Payer's public key (base58) — the wallet that signed the tx */
  payer: string;

  /** Amount paid in raw USDC units */
  amount: string;

  /** Unix timestamp when the payment was made */
  paidAt: number;
}

// ─── Payment Verification (Server-side) ──────────────────────

export interface PaymentVerificationResult {
  /** Whether the payment was valid */
  valid: boolean;

  /** Reason for rejection (if invalid) */
  reason?: string;

  /** Verified transaction signature */
  signature?: TransactionSignature;

  /** Verified amount in raw USDC units */
  amount?: string;

  /** Payer's public key */
  payer?: string;

  /** Block time of the transaction */
  blockTime?: number;

  /** Slot of the transaction */
  slot?: number;
}

// ─── Client Configuration ─────────────────────────────────────

export interface SolanaX402ClientConfig {
  /** Base URL of the x402-gated API */
  apiBaseUrl: string;

  /** Solana RPC endpoint for sending transactions */
  rpcUrl: string;

  /** Solana WebSocket endpoint (optional, for faster confirmation) */
  wsUrl?: string;

  /** Base58-encoded private key of the payer wallet */
  solanaPrivateKey?: string;

  /** Maximum USDC to spend per request (human-readable, e.g. "0.05") */
  maxPaymentPerRequest?: string;

  /** Maximum total USDC budget for the session (e.g. "10.00") */
  maxTotalBudget?: string;

  /** Skip payments — API must also be in dev mode */
  devMode?: boolean;

  /** Solana network: 'mainnet-beta' | 'devnet' */
  network?: 'mainnet-beta' | 'devnet';

  /** Transaction confirmation commitment level */
  commitment?: 'processed' | 'confirmed' | 'finalized';

  /** Priority fee in microlamports (default: 50000 = 0.00005 SOL) */
  priorityFeeMicroLamports?: number;
}

// ─── Server Configuration ─────────────────────────────────────

export interface SolanaX402ServerConfig {
  /** Solana RPC endpoint for verifying transactions */
  rpcUrl: string;

  /** Server's USDC token account (ATA) — where payments are received */
  payToAddress: string;

  /** Server wallet's public key (owner of the ATA) */
  serverWalletAddress: string;

  /** Solana network: 'mainnet-beta' | 'devnet' */
  network: 'mainnet-beta' | 'devnet';

  /** Challenge validity duration in seconds (default: 300 = 5 min) */
  challengeTtlSeconds?: number;

  /** Minimum confirmations required (default: 1 for 'confirmed') */
  minConfirmations?: number;

  /** Maximum age of a transaction to accept in seconds (default: 120) */
  maxTxAgeSeconds?: number;
}

// ─── Screener API Types ───────────────────────────────────────

export interface ScreenerEndpoint {
  /** HTTP method */
  method: 'GET' | 'POST';

  /** Route path */
  path: string;

  /** Human-readable description */
  description: string;

  /** Price in USDC (human-readable, e.g. "0.01") */
  priceUsdc: string;

  /** Price in raw USDC units (6 decimals) */
  priceRaw: string;

  /** Response content type */
  mimeType: string;

  /** Whether this endpoint is free (no x402) */
  free: boolean;
}

export interface X402DiscoveryDocument {
  /** Protocol version */
  x402Version: 2;

  /** API name */
  name: string;

  /** API description */
  description: string;

  /** Base URL */
  baseUrl: string;

  /** Supported payment networks */
  networks: Array<{
    network: string;
    asset: string;
    assetName: string;
    decimals: number;
  }>;

  /** Available endpoints with pricing */
  endpoints: ScreenerEndpoint[];

  /** Server's payment address */
  payTo: string;

  /** Contact/support */
  contact?: string;
}

// ─── Event Types ──────────────────────────────────────────────

export interface SolanaX402ClientEvents {
  'payment:required': (requirements: SolanaX402PaymentRequired) => void;
  'payment:sending': (challenge: string, amount: string) => void;
  'payment:confirmed': (signature: string, amount: string, latencyMs: number) => void;
  'payment:failed': (error: Error) => void;
  'request:success': (endpoint: string, latencyMs: number, paid: boolean) => void;
  'budget:warning': (spent: number, remaining: number) => void;
  'budget:exhausted': (spent: number, limit: number) => void;
}
