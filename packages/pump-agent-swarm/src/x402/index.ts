/**
 * Solana x402 — Module Exports
 *
 * Pure Solana x402 payment infrastructure for Pump.fun premium APIs.
 * No EVM. No facilitator. Direct on-chain USDC settlement.
 */

// ─── Client (payer side) ──────────────────────────────────────
export { SolanaX402Client } from './client.js';
export type {
  TradingSignalResponse,
  WhaleAnalysisResponse,
  GraduationOddsResponse,
  X402ClientStats,
} from './client.js';

// ─── Server (receiver side) ──────────────────────────────────
export { SolanaX402Server } from './server.js';

// ─── Types ────────────────────────────────────────────────────
export {
  USDC_MINT_MAINNET,
  USDC_MINT_DEVNET,
  MEMO_PROGRAM_ID,
  USDC_DECIMALS,
  CAIP2_SOLANA_MAINNET,
  CAIP2_SOLANA_DEVNET,
} from './types.js';

export type {
  SolanaX402PaymentRequired,
  SolanaPaymentScheme,
  SolanaX402PaymentProof,
  SolanaPaymentPayload,
  PaymentVerificationResult,
  SolanaX402ClientConfig,
  SolanaX402ServerConfig,
  SolanaX402ClientEvents,
  ScreenerEndpoint,
  X402DiscoveryDocument,
} from './types.js';
