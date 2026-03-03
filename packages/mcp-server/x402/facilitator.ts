/**
 * @fileoverview x402 Payment Facilitator Client
 * @description Connect to Coinbase's facilitator or self-hosted facilitator for payment settlement
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license Apache-2.0
 */

import type { Address, Hash } from 'viem';
import type { ChainConfig } from './chains/index.js';
import { getChainConfig, getChainType } from './chains/index.js';
import Logger from '@/utils/logger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Payment payload for facilitator
 */
export interface PaymentPayload {
  /** CAIP-2 chain identifier */
  chainId: string;
  /** Payment amount in human-readable format */
  amount: string;
  /** Payment token symbol */
  token: string;
  /** Token contract address */
  tokenAddress: string;
  /** Recipient address */
  recipient: string;
  /** Sender address */
  sender: string;
  /** Payment reference/nonce (for idempotency) */
  reference: string;
  /** Unix timestamp deadline for payment validity */
  deadline: number;
  /** EIP-712 typed data signature (for gasless payments) */
  signature?: string;
  /** Resource being paid for */
  resource?: string;
}

/**
 * Payment status from facilitator
 */
export type PaymentStatus = 
  | 'pending'      // Payment submitted, awaiting confirmation
  | 'processing'   // Facilitator is processing the payment
  | 'confirmed'    // Payment confirmed on-chain
  | 'settled'      // Payment fully settled
  | 'failed'       // Payment failed
  | 'expired';     // Payment deadline passed

/**
 * Payment result from facilitator
 */
export interface FacilitatorPaymentResult {
  /** Unique payment ID from facilitator */
  paymentId: string;
  /** Transaction hash (if on-chain) */
  transactionHash?: Hash;
  /** Payment status */
  status: PaymentStatus;
  /** Block number (if confirmed) */
  blockNumber?: number;
  /** Timestamp of status update */
  timestamp: number;
  /** Chain the payment was made on */
  chainId: string;
  /** Amount paid */
  amount: string;
  /** Error message (if failed) */
  error?: string;
  /** Explorer URL for transaction */
  explorerUrl?: string;
}

/**
 * Payment query parameters
 */
export interface PaymentQuery {
  /** Payment ID from facilitator */
  paymentId?: string;
  /** Transaction hash */
  transactionHash?: Hash;
  /** Payment reference */
  reference?: string;
}

/**
 * Facilitator health check response
 */
export interface FacilitatorHealth {
  /** Whether facilitator is healthy */
  healthy: boolean;
  /** Facilitator version */
  version: string;
  /** Supported chains */
  supportedChains: string[];
  /** Supported tokens */
  supportedTokens: string[];
  /** Current block numbers per chain */
  blockNumbers?: Record<string, number>;
}

/**
 * Facilitator client configuration
 */
export interface FacilitatorClientConfig {
  /** Base URL of the facilitator service */
  baseUrl: string;
  /** API key for authentication (optional) */
  apiKey?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
  /** Enable debug logging */
  debug?: boolean;
}

// ============================================================================
// Default Configuration
// ============================================================================

/** Default Coinbase facilitator URL */
export const DEFAULT_FACILITATOR_URL = 'https://x402.org/facilitator';

/** Default request timeout (30 seconds) */
export const DEFAULT_TIMEOUT = 30000;

// ============================================================================
// Facilitator Client
// ============================================================================

/**
 * x402 Payment Facilitator Client
 * 
 * Connects to a payment facilitator (Coinbase's or self-hosted) to:
 * - Submit gasless payments using EIP-3009 signatures
 * - Query payment status and history
 * - Verify payment settlement
 * 
 * @example
 * ```typescript
 * const client = new FacilitatorClient({
 *   baseUrl: 'https://x402.org/facilitator',
 * });
 * 
 * // Submit a payment
 * const result = await client.submitPayment({
 *   chainId: 'eip155:8453',
 *   amount: '1.00',
 *   token: 'USDC',
 *   tokenAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
 *   recipient: '0x...',
 *   sender: '0x...',
 *   reference: 'payment-123',
 *   deadline: Date.now() + 3600000,
 *   signature: '0x...',
 * });
 * 
 * // Check payment status
 * const status = await client.getPaymentStatus({ paymentId: result.paymentId });
 * ```
 */
export class FacilitatorClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeout: number;
  private readonly debug: boolean;

  constructor(config: FacilitatorClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? DEFAULT_TIMEOUT;
    this.debug = config.debug ?? false;
  }

  /**
   * Create default headers for requests
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    return headers;
  }

  /**
   * Make an HTTP request to the facilitator
   */
  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      if (this.debug) {
        Logger.debug(`Facilitator ${method} ${path}`, { body });
      }

      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData: { error?: string; message?: string } = {};
        try {
          errorData = JSON.parse(errorText);
        } catch {
          // Not JSON
        }
        throw new FacilitatorError(
          errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        );
      }

      const data = await response.json() as T;
      
      if (this.debug) {
        Logger.debug(`Facilitator response:`, data);
      }

      return data;
    } catch (error) {
      if (error instanceof FacilitatorError) {
        throw error;
      }
      if ((error as Error).name === 'AbortError') {
        throw new FacilitatorError('Request timed out', 408);
      }
      throw new FacilitatorError(
        `Network error: ${(error as Error).message}`,
        0
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Check if the facilitator is healthy and available
   */
  async healthCheck(): Promise<FacilitatorHealth> {
    return this.request<FacilitatorHealth>('GET', '/health');
  }

  /**
   * Submit a payment to the facilitator
   * 
   * @param payload - Payment details including signature for gasless payments
   * @returns Payment result with transaction hash and status
   */
  async submitPayment(payload: PaymentPayload): Promise<FacilitatorPaymentResult> {
    // Validate chain is supported
    const chain = getChainConfig(payload.chainId);
    if (!chain) {
      throw new FacilitatorError(`Unsupported chain: ${payload.chainId}`, 400);
    }

    return this.request<FacilitatorPaymentResult>('POST', '/payments', payload);
  }

  /**
   * Get the status of a payment
   * 
   * @param query - Query parameters (paymentId, transactionHash, or reference)
   * @returns Current payment status
   */
  async getPaymentStatus(query: PaymentQuery): Promise<FacilitatorPaymentResult> {
    const params = new URLSearchParams();
    
    if (query.paymentId) {
      params.set('paymentId', query.paymentId);
    }
    if (query.transactionHash) {
      params.set('txHash', query.transactionHash);
    }
    if (query.reference) {
      params.set('reference', query.reference);
    }

    if (params.toString() === '') {
      throw new FacilitatorError('At least one query parameter is required', 400);
    }

    return this.request<FacilitatorPaymentResult>('GET', `/payments?${params.toString()}`);
  }

  /**
   * Wait for a payment to reach a terminal status
   * 
   * @param query - Query parameters
   * @param options - Polling options
   * @returns Final payment status
   */
  async waitForSettlement(
    query: PaymentQuery,
    options: {
      /** Maximum time to wait in milliseconds */
      timeout?: number;
      /** Polling interval in milliseconds */
      pollInterval?: number;
    } = {}
  ): Promise<FacilitatorPaymentResult> {
    const timeout = options.timeout ?? 120000; // 2 minutes default
    const pollInterval = options.pollInterval ?? 2000; // 2 seconds default
    const startTime = Date.now();

    const terminalStatuses: PaymentStatus[] = ['confirmed', 'settled', 'failed', 'expired'];

    while (Date.now() - startTime < timeout) {
      const result = await this.getPaymentStatus(query);
      
      if (terminalStatuses.includes(result.status)) {
        return result;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new FacilitatorError('Payment settlement timed out', 408);
  }

  /**
   * Get supported chains from the facilitator
   */
  async getSupportedChains(): Promise<string[]> {
    const health = await this.healthCheck();
    return health.supportedChains;
  }

  /**
   * Verify a payment was successful
   * 
   * @param query - Query parameters
   * @returns True if payment is confirmed/settled
   */
  async verifyPayment(query: PaymentQuery): Promise<boolean> {
    try {
      const result = await this.getPaymentStatus(query);
      return result.status === 'confirmed' || result.status === 'settled';
    } catch {
      return false;
    }
  }
}

// ============================================================================
// Error Class
// ============================================================================

/**
 * Error from facilitator API
 */
export class FacilitatorError extends Error {
  /** HTTP status code */
  readonly statusCode: number;
  /** Additional error data */
  readonly data?: unknown;

  constructor(message: string, statusCode: number, data?: unknown) {
    super(message);
    this.name = 'FacilitatorError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a facilitator client for a specific chain
 * 
 * @param chain - Chain config or CAIP-2 identifier
 * @param options - Additional client options
 * @returns Configured FacilitatorClient
 */
export function createFacilitatorClient(
  chain?: ChainConfig | string,
  options: Partial<FacilitatorClientConfig> = {}
): FacilitatorClient {
  let facilitatorUrl = options.baseUrl ?? DEFAULT_FACILITATOR_URL;

  // Get facilitator URL from chain config if provided
  if (chain) {
    const chainConfig = typeof chain === 'string' ? getChainConfig(chain) : chain;
    if (chainConfig?.facilitatorUrl) {
      facilitatorUrl = chainConfig.facilitatorUrl;
    }
  }

  return new FacilitatorClient({
    ...options,
    baseUrl: facilitatorUrl,
  });
}

/**
 * Create a facilitator client from environment variables
 */
export function createFacilitatorClientFromEnv(): FacilitatorClient {
  return createFacilitatorClient(undefined, {
    baseUrl: process.env.X402_FACILITATOR_URL ?? DEFAULT_FACILITATOR_URL,
    apiKey: process.env.X402_FACILITATOR_API_KEY,
    debug: process.env.X402_DEBUG === 'true',
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique payment reference
 */
export function generatePaymentReference(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `x402-${timestamp}-${random}`;
}

/**
 * Calculate payment deadline (default: 1 hour from now)
 * 
 * @param durationMs - Duration in milliseconds (default: 3600000 = 1 hour)
 * @returns Unix timestamp in seconds
 */
export function calculateDeadline(durationMs: number = 3600000): number {
  return Math.floor((Date.now() + durationMs) / 1000);
}

/**
 * Validate a payment payload before submission
 */
export function validatePaymentPayload(payload: PaymentPayload): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Chain validation
  const chain = getChainConfig(payload.chainId);
  if (!chain) {
    errors.push(`Unsupported chain: ${payload.chainId}`);
  }

  // Amount validation
  const amount = parseFloat(payload.amount);
  if (isNaN(amount) || amount <= 0) {
    errors.push('Amount must be a positive number');
  }

  // Address validation
  const chainType = getChainType(payload.chainId);
  if (chainType === 'evm') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(payload.recipient)) {
      errors.push('Invalid EVM recipient address');
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(payload.sender)) {
      errors.push('Invalid EVM sender address');
    }
  } else if (chainType === 'solana') {
    // Basic Solana address validation
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payload.recipient)) {
      errors.push('Invalid Solana recipient address');
    }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(payload.sender)) {
      errors.push('Invalid Solana sender address');
    }
  }

  // Deadline validation
  const now = Math.floor(Date.now() / 1000);
  if (payload.deadline <= now) {
    errors.push('Payment deadline has already passed');
  }

  // Reference validation
  if (!payload.reference || payload.reference.length < 5) {
    errors.push('Payment reference is required (min 5 characters)');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
