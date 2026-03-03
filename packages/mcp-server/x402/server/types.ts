/**
 * @fileoverview X402 Server-Side Type Definitions
 * @description Types for x402 payment receiving infrastructure
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import type { Address, Hash } from 'viem';
import type { X402Chain, X402Token, PaymentRequest } from '../sdk/types.js';

// ============================================================================
// Middleware Types
// ============================================================================

/**
 * Generic request interface for framework-agnostic middleware
 */
export interface GenericRequest {
  headers: Record<string, string | string[] | undefined>;
  path?: string;
  url?: string;
  originalUrl?: string;
  method?: string;
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * Generic response interface for framework-agnostic middleware
 */
export interface GenericResponse {
  status(code: number): GenericResponse;
  set(headers: Record<string, string>): GenericResponse;
  setHeader?(name: string, value: string): GenericResponse;
  json(body: unknown): void;
  send?(body: unknown): void;
}

/**
 * Next function for middleware chaining
 */
export type NextFunction = (error?: unknown) => void;

/**
 * Generic middleware handler type
 */
export type MiddlewareHandler = (
  req: GenericRequest,
  res: GenericResponse,
  next: NextFunction
) => void | Promise<void>;

/**
 * Paywall configuration options
 */
export interface PaywallOptions {
  /** Price in token units (e.g., "0.001" for $0.001) */
  price: string;
  /** Payment token (default: USDs) */
  token: X402Token;
  /** Blockchain network */
  network: X402Chain;
  /** Human-readable description */
  description?: string;
  /** Recipient address (defaults to configured server wallet) */
  recipient?: Address;
  /** Custom resource identifier (defaults to request path) */
  resource?: string;
  /** Payment validity period in seconds (default: 300) */
  validitySeconds?: number;
  /** Custom verification function */
  customVerifier?: (proof: string, request: PaymentRequest) => Promise<boolean>;
}

// ============================================================================
// Facilitator Types
// ============================================================================

/**
 * Facilitator types supported
 */
export type FacilitatorType = 'coinbase' | 'self-hosted' | 'custom';

/**
 * Facilitator configuration
 */
export interface FacilitatorConfig {
  /** Facilitator type */
  type: FacilitatorType;
  /** Facilitator API URL */
  url: string;
  /** API key for authentication */
  apiKey?: string;
  /** API secret for authentication */
  apiSecret?: string;
  /** Webhook secret for verification */
  webhookSecret?: string;
  /** Custom headers to include */
  headers?: Record<string, string>;
  /** Request timeout in ms */
  timeout?: number;
}

/**
 * Payment settlement request
 */
export interface SettlementRequest {
  /** Transaction hash of the payment */
  txHash: Hash;
  /** Chain the payment was made on */
  chain: X402Chain;
  /** Payment amount */
  amount: string;
  /** Payment token */
  token: X402Token;
  /** Payer address */
  payer: Address;
  /** Recipient address */
  recipient: Address;
  /** Resource paid for */
  resource?: string;
  /** Original payment request reference */
  reference?: string;
}

/**
 * Settlement result from facilitator
 */
export interface SettlementResult {
  /** Settlement was successful */
  success: boolean;
  /** Settlement ID */
  settlementId?: string;
  /** Net amount after fees */
  netAmount?: string;
  /** Fee charged */
  fee?: string;
  /** Settlement status */
  status: 'pending' | 'confirmed' | 'settled' | 'failed';
  /** Error message if failed */
  error?: string;
  /** Timestamp of settlement */
  timestamp: number;
}

/**
 * Payment query options
 */
export interface PaymentQueryOptions {
  /** Filter by payer address */
  payer?: Address;
  /** Filter by start timestamp */
  startTime?: number;
  /** Filter by end timestamp */
  endTime?: number;
  /** Filter by resource */
  resource?: string;
  /** Filter by status */
  status?: SettlementResult['status'];
  /** Maximum results to return */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Facilitator balance info
 */
export interface FacilitatorBalance {
  /** Available balance (can withdraw) */
  available: string;
  /** Pending balance (settling) */
  pending: string;
  /** Total earned all time */
  totalEarned: string;
  /** Token symbol */
  token: X402Token;
  /** Chain */
  chain: X402Chain;
}

// ============================================================================
// Verifier Types
// ============================================================================

/**
 * Payment verification request
 */
export interface VerificationRequest {
  /** Payment proof (tx hash or signature) */
  proof: string;
  /** Expected payment details */
  expected: PaymentRequest;
  /** Allow replay (same proof used before)? */
  allowReplay?: boolean;
}

/**
 * Payment verification result
 */
export interface VerificationResult {
  /** Payment is valid */
  valid: boolean;
  /** Verification method used */
  method: 'on-chain' | 'signature' | 'facilitator' | 'cached';
  /** Actual amount paid (may be more than requested) */
  paidAmount?: string;
  /** Actual payer address */
  payer?: Address;
  /** Transaction hash */
  txHash?: Hash;
  /** Block number (if confirmed) */
  blockNumber?: number;
  /** Timestamp of payment */
  timestamp?: number;
  /** Error if invalid */
  error?: string;
  /** Is this a replay of a previous payment? */
  isReplay?: boolean;
}

/**
 * Nonce storage interface for replay protection
 */
export interface NonceStore {
  /** Check if nonce has been used */
  has(nonce: string): Promise<boolean>;
  /** Mark nonce as used */
  add(nonce: string, ttl?: number): Promise<void>;
  /** Remove expired nonces */
  cleanup?(): Promise<void>;
}

// ============================================================================
// Pricing Types
// ============================================================================

/**
 * Price calculation context
 */
export interface PricingContext {
  /** Request being priced */
  request: GenericRequest;
  /** Resource being accessed */
  resource: string;
  /** Client IP address */
  clientIp?: string;
  /** Client wallet address */
  clientAddress?: Address;
  /** Custom context data */
  metadata?: Record<string, unknown>;
}

/**
 * Dynamic pricing options
 */
export interface DynamicPricingOptions {
  /** Base price per request */
  base: string;
  /** Additional price per token (for AI endpoints) */
  perToken?: string;
  /** Additional price per KB of response */
  perKB?: string;
  /** Additional price per second of compute */
  perSecond?: string;
  /** Surge pricing multiplier function */
  surge?: (ctx: PricingContext) => number | Promise<number>;
  /** Discount function (returns multiplier 0-1) */
  discount?: (ctx: PricingContext) => number | Promise<number>;
  /** Minimum price */
  minPrice?: string;
  /** Maximum price */
  maxPrice?: string;
  /** Token for pricing */
  token: X402Token;
  /** Network */
  network: X402Chain;
}

/**
 * Price calculation result
 */
export interface PriceResult {
  /** Final price */
  price: string;
  /** Base price component */
  basePrice: string;
  /** Token-based price component */
  tokenPrice?: string;
  /** Size-based price component */
  sizePrice?: string;
  /** Compute-based price component */
  computePrice?: string;
  /** Surge multiplier applied */
  surgeMultiplier?: number;
  /** Discount multiplier applied */
  discountMultiplier?: number;
  /** Token symbol */
  token: X402Token;
  /** Network */
  network: X402Chain;
  /** Breakdown for transparency */
  breakdown: string;
}

/**
 * Price calculator interface
 */
export interface PriceCalculator {
  /** Calculate price for a request */
  calculate(ctx: PricingContext): Promise<PriceResult>;
  /** Get base configuration */
  getConfig(): DynamicPricingOptions;
}

// ============================================================================
// Analytics Types
// ============================================================================

/**
 * Payment record for analytics
 */
export interface PaymentRecord {
  /** Unique payment ID */
  id: string;
  /** Transaction hash */
  txHash: Hash;
  /** Chain */
  chain: X402Chain;
  /** Amount paid */
  amount: string;
  /** Token */
  token: X402Token;
  /** Payer address */
  payer: Address;
  /** Resource accessed */
  resource: string;
  /** HTTP method used */
  method?: string;
  /** Response status code */
  statusCode?: number;
  /** Timestamp */
  timestamp: number;
  /** Request metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Revenue summary
 */
export interface RevenueSummary {
  /** Total revenue in period */
  total: string;
  /** Number of payments */
  count: number;
  /** Average payment */
  average: string;
  /** Unique payers */
  uniquePayers: number;
  /** Token */
  token: X402Token;
  /** Period start */
  periodStart: number;
  /** Period end */
  periodEnd: number;
}

/**
 * Revenue by endpoint
 */
export interface EndpointRevenue {
  /** Resource/endpoint path */
  resource: string;
  /** Total revenue */
  total: string;
  /** Number of payments */
  count: number;
  /** Percentage of total revenue */
  percentage: number;
}

/**
 * Top payer info
 */
export interface TopPayer {
  /** Payer address */
  address: Address;
  /** Total paid */
  total: string;
  /** Number of payments */
  count: number;
  /** First payment timestamp */
  firstPayment: number;
  /** Last payment timestamp */
  lastPayment: number;
}

/**
 * Analytics query options
 */
export interface AnalyticsQueryOptions {
  /** Start timestamp */
  startTime?: number;
  /** End timestamp */
  endTime?: number;
  /** Group by period (hour, day, week, month) */
  groupBy?: 'hour' | 'day' | 'week' | 'month';
  /** Filter by resource */
  resource?: string;
  /** Filter by payer */
  payer?: Address;
  /** Filter by chain */
  chain?: X402Chain;
  /** Maximum results */
  limit?: number;
}

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv' | 'xlsx';

/**
 * Analytics export options
 */
export interface ExportOptions extends AnalyticsQueryOptions {
  /** Export format */
  format: ExportFormat;
  /** Include metadata columns */
  includeMetadata?: boolean;
}

// ============================================================================
// Server Configuration Types
// ============================================================================

/**
 * X402 Server configuration
 */
export interface X402ServerConfig {
  /** Server wallet address for receiving payments */
  walletAddress: Address;
  /** Server private key (for signing, optional) */
  privateKey?: `0x${string}`;
  /** Default chain for payments */
  defaultChain: X402Chain;
  /** Default token for payments */
  defaultToken: X402Token;
  /** Facilitator configuration */
  facilitator?: FacilitatorConfig;
  /** Custom RPC URLs */
  rpcUrls?: Partial<Record<X402Chain, string>>;
  /** Enable analytics tracking */
  enableAnalytics?: boolean;
  /** Analytics storage path */
  analyticsPath?: string;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Protected endpoint configuration
 */
export interface ProtectedEndpoint {
  /** Endpoint path pattern */
  path: string;
  /** HTTP methods (default: all) */
  methods?: string[];
  /** Pricing configuration */
  pricing: PaywallOptions | DynamicPricingOptions;
  /** Custom description */
  description?: string;
  /** Is endpoint enabled */
  enabled?: boolean;
  /** Rate limit per payer per hour */
  rateLimit?: number;
}

/**
 * Earnings info
 */
export interface EarningsInfo {
  /** Total earnings */
  total: string;
  /** Today's earnings */
  today: string;
  /** This week's earnings */
  thisWeek: string;
  /** This month's earnings */
  thisMonth: string;
  /** Pending settlements */
  pending: string;
  /** Available for withdrawal */
  available: string;
  /** Token */
  token: X402Token;
  /** Chain */
  chain: X402Chain;
}
