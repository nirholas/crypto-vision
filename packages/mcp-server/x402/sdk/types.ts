/**
 * @fileoverview X402 SDK Type Definitions
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { Address, Hash } from 'viem';

// ============================================================================
// Chain & Token Types
// ============================================================================

/**
 * Supported EVM blockchain networks
 */
export type X402Chain = 'arbitrum' | 'arbitrum-sepolia' | 'base' | 'base-sepolia' | 'ethereum' | 'polygon' | 'optimism' | 'bsc';

/**
 * Supported Solana (SVM) networks
 */
export type X402SvmChain = 'solana-mainnet' | 'solana-devnet';

/**
 * All supported networks (EVM + SVM)
 */
export type X402Network = X402Chain | X402SvmChain;

/**
 * Supported payment tokens
 */
export type X402Token = 'USDs' | 'USDC' | 'USDT' | 'DAI' | 'ETH' | 'SOL';

/**
 * Network configuration
 */
export interface NetworkConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerUrl: string;
  isTestnet: boolean;
}

// ============================================================================
// Client Configuration
// ============================================================================

/**
 * X402Client initialization options
 */
export interface X402ClientConfig {
  /** Blockchain network to use */
  chain: X402Chain;

  /** Private key for signing transactions (hex string with 0x prefix) */
  privateKey?: `0x${string}`;

  /** Custom RPC URL (optional, uses default if not provided) */
  rpcUrl?: string;

  /** Facilitator URL for payment verification */
  facilitatorUrl?: string;

  /** Enable gasless payments via EIP-3009 (default: true) */
  enableGasless?: boolean;

  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;

  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Payment Types
// ============================================================================

/**
 * Payment request from 402 response
 */
export interface PaymentRequest {
  /** Amount to pay (human-readable, e.g., "10.00") */
  amount: string;

  /** Payment token */
  token: X402Token;

  /** Blockchain network */
  chain: X402Chain;

  /** Recipient address */
  recipient: Address;

  /** Optional payment reference/nonce */
  reference?: string;

  /** Payment deadline (Unix timestamp) */
  deadline?: number;

  /** Tool/resource name being paid for */
  resource?: string;

  /** Human-readable description */
  description?: string;
}

/**
 * Completed payment transaction
 */
export interface PaymentTransaction {
  /** Transaction hash */
  hash: Hash;

  /** Chain ID */
  chainId: number;

  /** Sender address */
  from: Address;

  /** Recipient address */
  to: Address;

  /** Amount transferred (in token decimals) */
  amount: string;

  /** Human-readable amount */
  formattedAmount: string;

  /** Token symbol */
  token: X402Token;

  /** Token contract address (undefined for native token) */
  tokenAddress?: Address;

  /** Gas used */
  gasUsed?: string;

  /** Transaction status */
  status: 'pending' | 'confirmed' | 'failed';

  /** Block number (if confirmed) */
  blockNumber?: number;

  /** Transaction timestamp */
  timestamp?: number;
}

/**
 * Payment result with optional yield info
 */
export interface PaymentResult {
  /** The completed transaction */
  transaction: PaymentTransaction;

  /** Whether gasless payment was used */
  gasless: boolean;

  /** Estimated yield earned (for USDs) */
  estimatedYield?: YieldEstimate;
}

// ============================================================================
// EIP-3009 Gasless Authorization
// ============================================================================

/**
 * EIP-3009 Transfer Authorization for gasless payments
 */
export interface EIP3009Authorization {
  /** Sender address */
  from: Address;

  /** Recipient address */
  to: Address;

  /** Transfer amount (in token decimals) */
  value: bigint;

  /** Unix timestamp after which the authorization is valid */
  validAfter: bigint;

  /** Unix timestamp before which the authorization is valid */
  validBefore: bigint;

  /** Unique nonce (32 bytes) */
  nonce: `0x${string}`;

  /** ECDSA signature v component */
  v: number;

  /** ECDSA signature r component */
  r: `0x${string}`;

  /** ECDSA signature s component */
  s: `0x${string}`;
}

/**
 * Authorization options
 */
export interface AuthorizationOptions {
  /** Custom validity period in seconds (default: 300 = 5 minutes) */
  validityPeriod?: number;

  /** Custom nonce (auto-generated if not provided) */
  nonce?: `0x${string}`;
}

// ============================================================================
// Batch Payment Types
// ============================================================================

/**
 * Single payment in a batch
 */
export interface BatchPaymentItem {
  /** Recipient address */
  recipient: Address;

  /** Amount to pay */
  amount: string;

  /** Optional reference */
  reference?: string;
}

/**
 * Batch payment result
 */
export interface BatchPaymentResult {
  /** Successfully processed payments */
  successful: PaymentTransaction[];

  /** Failed payments with error details */
  failed: Array<{
    item: BatchPaymentItem;
    error: string;
  }>;

  /** Total amount transferred */
  totalAmount: string;

  /** Total gas used */
  totalGasUsed: string;
}

// ============================================================================
// HTTP 402 Types
// ============================================================================

/**
 * HTTP 402 Payment Required response structure
 */
export interface HTTP402Response {
  /** HTTP status code (402) */
  status: 402;

  /** Response headers containing payment info */
  headers: {
    'www-authenticate': string;
    'content-type'?: string;
    'x-payment-version'?: string;
  };

  /** Optional error message */
  message?: string;

  /** Response body */
  body?: unknown;
}

/**
 * HTTP 402 parsing result
 */
export interface HTTP402ParseResult {
  /** Whether the response is a valid 402 */
  isPaymentRequired: boolean;

  /** Parsed payment request (if valid) */
  paymentRequest?: PaymentRequest;

  /** Parsing error (if any) */
  error?: string;
}

/**
 * Options for handling 402 responses
 */
export interface Handle402Options {
  /** Automatically pay if under this amount */
  autoPayUnder?: string;

  /** Use gasless payment if available */
  preferGasless?: boolean;

  /** Custom approval callback */
  onApprovalRequired?: (request: PaymentRequest) => Promise<boolean>;
}

// ============================================================================
// Yield Tracking Types
// ============================================================================

/**
 * USDs yield information
 */
export interface YieldInfo {
  /** Current balance */
  balance: string;

  /** Formatted balance (human-readable) */
  formattedBalance: string;

  /** Total yield earned */
  totalYield: string;

  /** Current APY (as percentage, e.g., "5.25") */
  currentAPY: string;

  /** Is rebasing enabled for this address */
  rebasingEnabled: boolean;

  /** Last rebase timestamp */
  lastRebaseAt?: number;
}

/**
 * Estimated yield over time
 */
export interface YieldEstimate {
  /** Daily yield estimate */
  daily: string;

  /** Weekly yield estimate */
  weekly: string;

  /** Monthly yield estimate */
  monthly: string;

  /** Annual yield estimate */
  annual: string;

  /** Current APY used for calculation */
  apy: string;
}

/**
 * Yield history entry
 */
export interface YieldHistoryEntry {
  /** Timestamp */
  timestamp: number;

  /** Balance at time */
  balance: string;

  /** Yield earned since last entry */
  yieldEarned: string;

  /** Block number */
  blockNumber: number;
}

// ============================================================================
// Revenue Splitter Types
// ============================================================================

/**
 * Tool registration for revenue splitting
 */
export interface ToolRegistration {
  /** Unique tool name */
  name: string;

  /** Developer wallet address */
  developer: Address;

  /** Platform fee in basis points (e.g., 2000 = 20%) */
  platformFeeBps: number;

  /** Whether the tool is active */
  active: boolean;
}

/**
 * Revenue split configuration
 */
export interface RevenueSplit {
  /** Total payment amount */
  totalAmount: string;

  /** Developer share */
  developerAmount: string;

  /** Platform share */
  platformAmount: string;

  /** Developer percentage */
  developerPercentage: string;

  /** Platform percentage */
  platformPercentage: string;
}

/**
 * Tool revenue statistics
 */
export interface ToolRevenueStats {
  /** Tool name */
  toolName: string;

  /** Developer address */
  developer: Address;

  /** Total revenue earned */
  totalRevenue: string;

  /** Total number of calls */
  totalCalls: number;

  /** Platform fee basis points */
  platformFeeBps: number;

  /** Is active */
  active: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * X402 SDK error codes
 */
export enum X402ErrorCode {
  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_PRIVATE_KEY = 'MISSING_PRIVATE_KEY',

  // Network errors
  UNSUPPORTED_CHAIN = 'UNSUPPORTED_CHAIN',
  NETWORK_ERROR = 'NETWORK_ERROR',
  RPC_ERROR = 'RPC_ERROR',

  // Token errors
  UNSUPPORTED_TOKEN = 'UNSUPPORTED_TOKEN',
  INSUFFICIENT_BALANCE = 'INSUFFICIENT_BALANCE',
  INSUFFICIENT_ALLOWANCE = 'INSUFFICIENT_ALLOWANCE',

  // Payment errors
  INVALID_PAYMENT_REQUEST = 'INVALID_PAYMENT_REQUEST',
  PAYMENT_TIMEOUT = 'PAYMENT_TIMEOUT',
  TRANSACTION_FAILED = 'TRANSACTION_FAILED',
  TRANSACTION_REVERTED = 'TRANSACTION_REVERTED',

  // Authorization errors
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  AUTHORIZATION_EXPIRED = 'AUTHORIZATION_EXPIRED',
  AUTHORIZATION_NOT_YET_VALID = 'AUTHORIZATION_NOT_YET_VALID',
  NONCE_ALREADY_USED = 'NONCE_ALREADY_USED',

  // Verification errors
  VERIFICATION_FAILED = 'VERIFICATION_FAILED',
  TRANSACTION_NOT_FOUND = 'TRANSACTION_NOT_FOUND',

  // HTTP 402 errors
  INVALID_402_RESPONSE = 'INVALID_402_RESPONSE',
  MISSING_AUTH_HEADER = 'MISSING_AUTH_HEADER',

  // Contract errors
  CONTRACT_ERROR = 'CONTRACT_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
}

/**
 * X402 SDK Error class
 */
export class X402Error extends Error {
  constructor(
    message: string,
    public readonly code: X402ErrorCode,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'X402Error';
    Object.setPrototypeOf(this, X402Error.prototype);
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

// ============================================================================
// Event Types
// ============================================================================

/**
 * Payment event types
 */
export type PaymentEvent =
  | { type: 'payment:requested'; data: PaymentRequest }
  | { type: 'payment:approved'; data: PaymentTransaction }
  | { type: 'payment:confirmed'; data: PaymentTransaction }
  | { type: 'payment:failed'; data: { error: string; request?: PaymentRequest } }
  | { type: 'authorization:created'; data: EIP3009Authorization }
  | { type: 'authorization:settled'; data: PaymentTransaction };

/**
 * Payment event listener function
 */
export type PaymentEventListener = (event: PaymentEvent) => void | Promise<void>;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Token configuration
 */
export interface TokenConfig {
  address: Address;
  decimals: number;
  name: string;
  symbol: X402Token;
  supportsEIP3009: boolean;
}

/**
 * Balance information
 */
export interface BalanceInfo {
  /** Raw balance (in token decimals) */
  raw: bigint;

  /** Formatted balance (human-readable) */
  formatted: string;

  /** Token symbol */
  token: X402Token;
}
