/**
 * @x402/sdk - X402 Payment Protocol SDK
 *
 * Full-featured SDK for X402 payments with Sperax USDs on Arbitrum.
 * Supports standard payments, gasless (EIP-3009) payments, batch payments,
 * HTTP 402 handling, and yield tracking.
 *
 * @example
 * ```typescript
 * import { X402Client } from '@x402/sdk';
 *
 * const client = new X402Client({
 *   chain: 'arbitrum',
 *   privateKey: process.env.PRIVATE_KEY as `0x${string}`,
 * });
 *
 * // Simple payment
 * await client.pay('0x...', '10.00', 'USDs');
 *
 * // Gasless payment
 * const auth = await client.createAuthorization('0x...', '1.00', 'USDs');
 * await client.settleGasless(auth);
 *
 * // Handle 402 response
 * const result = await client.handlePaymentRequired(response);
 *
 * // Track yield
 * const yieldInfo = await client.getYield('0x...');
 * ```
 *
 * @packageDocumentation
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

// Main client
export { X402Client } from './client';

// Types
export type {
  // Configuration
  X402ClientConfig,
  NetworkConfig,

  // Chain & Token
  X402Chain,
  X402Token,
  TokenConfig,

  // Payment
  PaymentRequest,
  PaymentTransaction,
  PaymentResult,
  BatchPaymentItem,
  BatchPaymentResult,

  // Gasless (EIP-3009)
  EIP3009Authorization,
  AuthorizationOptions,

  // HTTP 402
  HTTP402Response,
  HTTP402ParseResult,
  Handle402Options,

  // Yield
  YieldInfo,
  YieldEstimate,
  YieldHistoryEntry,

  // Revenue Splitter
  ToolRegistration,
  RevenueSplit,
  ToolRevenueStats,

  // Events
  PaymentEvent,
  PaymentEventListener,

  // Utility
  BalanceInfo,
} from './types';

// Error types
export { X402Error, X402ErrorCode } from './types';

// Constants
export {
  NETWORKS,
  TOKENS,
  DEFAULT_TOKEN,
  SPERAX_USD_ADDRESS,
  ERC20_ABI,
  EIP3009_ABI,
  USDS_ABI,
  REVENUE_SPLITTER_ABI,
  DEFAULTS,
  X402_VERSION,
  SDK_VERSION,
} from './constants';

// Payment handlers (for advanced use)
export { StandardPayment } from './payments/standard';
export { GaslessPayment } from './payments/gasless';
export { BatchPayment } from './payments/batch';

// HTTP 402 utilities
export { HTTP402Handler, fetchWith402Handling } from './http/handler';
export {
  createPaymentGate,
  createDynamicPaymentGate,
  extractPaymentInfo,
  type PaymentGateConfig,
} from './http/middleware';

// Yield tracking
export { YieldTracker } from './yield/tracker';

// YieldingWallet - Auto-converting wallet for maximum yield
export { 
  YieldingWallet,
  type YieldingWalletConfig,
  type YieldProjection,
  type MonthlyYieldReport,
  type WalletBalances,
  type ConversionResult,
  type YieldReportEntry,
} from './wallet/yielding-wallet';

// Contract bindings
export { USDs } from './contracts/usds';
export { RevenueSplitter } from './contracts/revenue-splitter';
