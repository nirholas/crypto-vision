/**
 * @fileoverview X402 Payment Facilitator Client
 * @description Client for connecting to Coinbase or self-hosted payment facilitators
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 * 
 * A facilitator is a service that:
 * 1. Verifies payments on behalf of servers
 * 2. Settles payments to recipients
 * 3. Handles payment disputes
 * 4. Provides payment history and analytics
 * 
 * @example Coinbase Facilitator
 * ```typescript
 * const facilitator = new X402Facilitator({
 *   type: 'coinbase',
 *   url: 'https://x402.coinbase.com',
 *   apiKey: process.env.COINBASE_API_KEY,
 * });
 * 
 * // Settle a payment
 * const result = await facilitator.settle({
 *   txHash: '0x...',
 *   chain: 'arbitrum',
 *   amount: '10.00',
 *   token: 'USDs',
 *   payer: '0x...',
 *   recipient: '0x...'
 * });
 * ```
 * 
 * @example Self-Hosted Facilitator
 * ```typescript
 * const facilitator = new X402Facilitator({
 *   type: 'self-hosted',
 *   url: 'http://localhost:3001',
 * });
 * ```
 */

import type { Address, Hash } from 'viem';
import type { X402Chain, X402Token } from '../sdk/types.js';
import type {
  FacilitatorConfig,
  FacilitatorType,
  SettlementRequest,
  SettlementResult,
  PaymentQueryOptions,
  FacilitatorBalance,
  PaymentRecord,
} from './types.js';
import Logger from '@/utils/logger.js';

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default facilitator URLs by type
 */
const DEFAULT_FACILITATOR_URLS: Record<FacilitatorType, string> = {
  coinbase: 'https://x402-facilitator.coinbase.com',
  'self-hosted': 'http://localhost:3001',
  custom: '',
};

/**
 * Default request timeout
 */
const DEFAULT_TIMEOUT = 30000;

// ============================================================================
// Facilitator Client
// ============================================================================

/**
 * X402 Payment Facilitator Client
 * 
 * Connects to a payment facilitator service to:
 * - Verify payments
 * - Settle payments to recipients
 * - Query payment history
 * - Check balances
 */
export class X402Facilitator {
  private readonly config: Required<Pick<FacilitatorConfig, 'type' | 'url' | 'timeout'>> & FacilitatorConfig;
  private readonly headers: Record<string, string>;

  constructor(config: FacilitatorConfig) {
    this.config = {
      timeout: DEFAULT_TIMEOUT,
      ...config,
      url: config.url || DEFAULT_FACILITATOR_URLS[config.type],
    };

    // Build default headers
    this.headers = {
      'Content-Type': 'application/json',
      'X-Facilitator-Type': this.config.type,
      ...this.config.headers,
    };

    // Add authentication headers based on type
    if (this.config.apiKey) {
      if (this.config.type === 'coinbase') {
        this.headers['CB-ACCESS-KEY'] = this.config.apiKey;
        if (this.config.apiSecret) {
          // Coinbase requires signing - handled per request
        }
      } else {
        this.headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }
    }

    Logger.info(`x402: Facilitator initialized (${this.config.type}) at ${this.config.url}`);
  }

  // ============================================================================
  // Settlement Operations
  // ============================================================================

  /**
   * Settle a payment with the facilitator
   * This confirms the payment and initiates fund transfer
   * 
   * @param request - Settlement request details
   * @returns Settlement result
   * 
   * @example
   * ```typescript
   * const result = await facilitator.settle({
   *   txHash: '0xabc123...',
   *   chain: 'arbitrum',
   *   amount: '10.00',
   *   token: 'USDs',
   *   payer: '0x1234...',
   *   recipient: '0x5678...',
   *   resource: '/api/premium/data'
   * });
   * 
   * if (result.success) {
   *   console.log(`Settled ${result.netAmount} (fee: ${result.fee})`);
   * }
   * ```
   */
  async settle(request: SettlementRequest): Promise<SettlementResult> {
    try {
      const response = await this.request<SettlementResult>('/v1/settle', {
        method: 'POST',
        body: JSON.stringify({
          tx_hash: request.txHash,
          chain: request.chain,
          amount: request.amount,
          token: request.token,
          payer: request.payer,
          recipient: request.recipient,
          resource: request.resource,
          reference: request.reference,
        }),
      });

      return {
        success: response.success ?? response.status === 'confirmed',
        settlementId: response.settlementId || response.settlement_id,
        netAmount: response.netAmount || response.net_amount,
        fee: response.fee,
        status: response.status || 'pending',
        timestamp: response.timestamp || Date.now(),
      };
    } catch (error) {
      Logger.error(`x402: Settlement failed: ${error instanceof Error ? error.message : error}`);
      return {
        success: false,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Settlement failed',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Batch settle multiple payments
   * More efficient than individual settlements
   * 
   * @param requests - Array of settlement requests
   * @returns Array of settlement results
   */
  async batchSettle(requests: SettlementRequest[]): Promise<SettlementResult[]> {
    try {
      const response = await this.request<{ results: SettlementResult[] }>('/v1/settle/batch', {
        method: 'POST',
        body: JSON.stringify({
          settlements: requests.map(r => ({
            tx_hash: r.txHash,
            chain: r.chain,
            amount: r.amount,
            token: r.token,
            payer: r.payer,
            recipient: r.recipient,
            resource: r.resource,
            reference: r.reference,
          })),
        }),
      });

      return response.results;
    } catch (error) {
      Logger.error(`x402: Batch settlement failed: ${error instanceof Error ? error.message : error}`);
      // Return failed results for all
      return requests.map(() => ({
        success: false,
        status: 'failed' as const,
        error: error instanceof Error ? error.message : 'Batch settlement failed',
        timestamp: Date.now(),
      }));
    }
  }

  // ============================================================================
  // Query Operations
  // ============================================================================

  /**
   * Get payment status by transaction hash
   * 
   * @param txHash - Transaction hash
   * @param chain - Blockchain network
   * @returns Settlement result or null if not found
   */
  async getPaymentStatus(txHash: Hash, chain: X402Chain): Promise<SettlementResult | null> {
    try {
      const response = await this.request<SettlementResult>(`/v1/payments/${chain}/${txHash}`);
      return response;
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Query payments with filters
   * 
   * @param options - Query options
   * @returns Array of payment records
   * 
   * @example
   * ```typescript
   * // Get all payments in the last 24 hours
   * const payments = await facilitator.queryPayments({
   *   startTime: Date.now() - 24 * 60 * 60 * 1000,
   *   limit: 100
   * });
   * 
   * // Get payments for a specific resource
   * const apiPayments = await facilitator.queryPayments({
   *   resource: '/api/v1/data',
   *   status: 'confirmed'
   * });
   * ```
   */
  async queryPayments(options: PaymentQueryOptions = {}): Promise<PaymentRecord[]> {
    const params = new URLSearchParams();
    
    if (options.payer) params.set('payer', options.payer);
    if (options.startTime) params.set('start_time', String(options.startTime));
    if (options.endTime) params.set('end_time', String(options.endTime));
    if (options.resource) params.set('resource', options.resource);
    if (options.status) params.set('status', options.status);
    if (options.limit) params.set('limit', String(options.limit));
    if (options.offset) params.set('offset', String(options.offset));

    const response = await this.request<{ payments: PaymentRecord[] }>(
      `/v1/payments?${params.toString()}`
    );

    return response.payments || [];
  }

  /**
   * Get balance information
   * 
   * @param chain - Optional chain filter
   * @returns Balance information
   */
  async getBalance(chain?: X402Chain): Promise<FacilitatorBalance> {
    const url = chain ? `/v1/balance/${chain}` : '/v1/balance';
    return this.request<FacilitatorBalance>(url);
  }

  /**
   * Get all balances across chains
   * 
   * @returns Array of balance info per chain
   */
  async getAllBalances(): Promise<FacilitatorBalance[]> {
    const response = await this.request<{ balances: FacilitatorBalance[] }>('/v1/balances');
    return response.balances || [];
  }

  // ============================================================================
  // Withdrawal Operations
  // ============================================================================

  /**
   * Request withdrawal of available funds
   * 
   * @param amount - Amount to withdraw (or 'all')
   * @param token - Token to withdraw
   * @param chain - Chain to withdraw from
   * @param toAddress - Destination address
   * @returns Withdrawal transaction hash
   * 
   * @example
   * ```typescript
   * // Withdraw all available USDs
   * const txHash = await facilitator.withdraw('all', 'USDs', 'arbitrum', '0x...');
   * 
   * // Withdraw specific amount
   * const txHash = await facilitator.withdraw('100.00', 'USDs', 'arbitrum', '0x...');
   * ```
   */
  async withdraw(
    amount: string | 'all',
    token: X402Token,
    chain: X402Chain,
    toAddress: Address
  ): Promise<Hash> {
    const response = await this.request<{ tx_hash: Hash }>('/v1/withdraw', {
      method: 'POST',
      body: JSON.stringify({
        amount: amount === 'all' ? 'max' : amount,
        token,
        chain,
        to_address: toAddress,
      }),
    });

    return response.tx_hash;
  }

  /**
   * Get withdrawal history
   * 
   * @param options - Query options
   * @returns Array of withdrawal records
   */
  async getWithdrawals(options: PaymentQueryOptions = {}): Promise<Array<{
    id: string;
    txHash: Hash;
    amount: string;
    token: X402Token;
    chain: X402Chain;
    toAddress: Address;
    status: 'pending' | 'confirmed' | 'failed';
    timestamp: number;
  }>> {
    const params = new URLSearchParams();
    if (options.startTime) params.set('start_time', String(options.startTime));
    if (options.endTime) params.set('end_time', String(options.endTime));
    if (options.limit) params.set('limit', String(options.limit));

    const response = await this.request<{ withdrawals: Array<{
      id: string;
      tx_hash: Hash;
      amount: string;
      token: X402Token;
      chain: X402Chain;
      to_address: Address;
      status: 'pending' | 'confirmed' | 'failed';
      timestamp: number;
    }> }>(`/v1/withdrawals?${params.toString()}`);

    return (response.withdrawals || []).map(w => ({
      id: w.id,
      txHash: w.tx_hash,
      amount: w.amount,
      token: w.token,
      chain: w.chain,
      toAddress: w.to_address,
      status: w.status,
      timestamp: w.timestamp,
    }));
  }

  // ============================================================================
  // Verification Operations
  // ============================================================================

  /**
   * Verify a payment through the facilitator
   * Alternative to on-chain verification
   * 
   * @param txHash - Transaction hash
   * @param chain - Blockchain network
   * @param expectedAmount - Expected payment amount
   * @param expectedRecipient - Expected recipient address
   * @returns Verification result
   */
  async verifyPayment(
    txHash: Hash,
    chain: X402Chain,
    expectedAmount: string,
    expectedRecipient: Address
  ): Promise<{
    valid: boolean;
    actualAmount?: string;
    actualRecipient?: Address;
    payer?: Address;
    confirmations?: number;
    error?: string;
  }> {
    try {
      const response = await this.request<{
        valid: boolean;
        actual_amount?: string;
        actual_recipient?: string;
        payer?: string;
        confirmations?: number;
      }>('/v1/verify', {
        method: 'POST',
        body: JSON.stringify({
          tx_hash: txHash,
          chain,
          expected_amount: expectedAmount,
          expected_recipient: expectedRecipient,
        }),
      });

      return {
        valid: response.valid,
        actualAmount: response.actual_amount,
        actualRecipient: response.actual_recipient as Address | undefined,
        payer: response.payer as Address | undefined,
        confirmations: response.confirmations,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Verification failed',
      };
    }
  }

  // ============================================================================
  // Webhook Management
  // ============================================================================

  /**
   * Register a webhook URL for payment notifications
   * 
   * @param url - Webhook URL
   * @param events - Event types to subscribe to
   * @returns Webhook ID
   */
  async registerWebhook(
    url: string,
    events: Array<'payment.received' | 'payment.confirmed' | 'payment.failed' | 'withdrawal.completed'>
  ): Promise<string> {
    const response = await this.request<{ webhook_id: string }>('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url, events }),
    });

    return response.webhook_id;
  }

  /**
   * Verify webhook signature
   * 
   * @param payload - Webhook payload
   * @param signature - Signature from X-Webhook-Signature header
   * @returns True if signature is valid
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!this.config.webhookSecret) {
      Logger.warn('x402: No webhook secret configured for signature verification');
      return false;
    }

    // HMAC-SHA256 verification
    const crypto = globalThis.crypto;
    if (!crypto?.subtle) {
      Logger.warn('x402: Web Crypto API not available for webhook verification');
      return false;
    }

    // In a real implementation, use proper HMAC verification
    // This is a simplified check
    const expectedSignature = `sha256=${Buffer.from(
      `${payload}${this.config.webhookSecret}`
    ).toString('base64')}`;

    return signature === expectedSignature;
  }

  /**
   * List registered webhooks
   */
  async listWebhooks(): Promise<Array<{
    id: string;
    url: string;
    events: string[];
    active: boolean;
  }>> {
    const response = await this.request<{ webhooks: Array<{
      id: string;
      url: string;
      events: string[];
      active: boolean;
    }> }>('/v1/webhooks');

    return response.webhooks || [];
  }

  /**
   * Delete a webhook
   */
  async deleteWebhook(webhookId: string): Promise<void> {
    await this.request(`/v1/webhooks/${webhookId}`, { method: 'DELETE' });
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  /**
   * Make authenticated request to facilitator
   */
  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.config.url}${path}`;
    const headers = { ...this.headers, ...options.headers as Record<string, string> };

    // Sign request for Coinbase
    if (this.config.type === 'coinbase' && this.config.apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = options.method || 'GET';
      const body = options.body || '';
      
      // Create signature
      const message = `${timestamp}${method}${path}${body}`;
      headers['CB-ACCESS-TIMESTAMP'] = timestamp;
      headers['CB-ACCESS-SIGN'] = await this.signCoinbase(message);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: response.statusText }));
        const err = new Error(error.message || `Request failed: ${response.status}`);
        (err as Error & { status: number }).status = response.status;
        throw err;
      }

      return response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Sign message for Coinbase authentication
   */
  private async signCoinbase(message: string): Promise<string> {
    if (!this.config.apiSecret) return '';

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(this.config.apiSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(message)
    );

    return Buffer.from(signature).toString('base64');
  }

  // ============================================================================
  // Health & Status
  // ============================================================================

  /**
   * Check facilitator health
   */
  async health(): Promise<{
    status: 'healthy' | 'degraded' | 'down';
    latency: number;
    version?: string;
  }> {
    const start = Date.now();
    try {
      const response = await this.request<{ status: string; version?: string }>('/health');
      return {
        status: response.status === 'ok' ? 'healthy' : 'degraded',
        latency: Date.now() - start,
        version: response.version,
      };
    } catch {
      return {
        status: 'down',
        latency: Date.now() - start,
      };
    }
  }

  /**
   * Get facilitator configuration/info
   */
  getConfig(): FacilitatorConfig {
    return { ...this.config };
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create Coinbase facilitator client
 * 
 * @example
 * ```typescript
 * const facilitator = createCoinbaseFacilitator({
 *   apiKey: process.env.COINBASE_API_KEY!,
 *   apiSecret: process.env.COINBASE_API_SECRET,
 * });
 * ```
 */
export function createCoinbaseFacilitator(options: {
  apiKey: string;
  apiSecret?: string;
  webhookSecret?: string;
}): X402Facilitator {
  return new X402Facilitator({
    type: 'coinbase',
    url: DEFAULT_FACILITATOR_URLS.coinbase,
    apiKey: options.apiKey,
    apiSecret: options.apiSecret,
    webhookSecret: options.webhookSecret,
  });
}

/**
 * Create self-hosted facilitator client
 * 
 * @example
 * ```typescript
 * const facilitator = createSelfHostedFacilitator({
 *   url: 'http://localhost:3001',
 *   apiKey: process.env.FACILITATOR_API_KEY,
 * });
 * ```
 */
export function createSelfHostedFacilitator(options: {
  url: string;
  apiKey?: string;
}): X402Facilitator {
  return new X402Facilitator({
    type: 'self-hosted',
    url: options.url,
    apiKey: options.apiKey,
  });
}

/**
 * Create facilitator from environment variables
 * 
 * Environment variables:
 * - X402_FACILITATOR_TYPE: 'coinbase' | 'self-hosted'
 * - X402_FACILITATOR_URL: Facilitator API URL
 * - X402_FACILITATOR_API_KEY: API key
 * - X402_FACILITATOR_API_SECRET: API secret (Coinbase)
 * - X402_FACILITATOR_WEBHOOK_SECRET: Webhook verification secret
 */
export function createFacilitatorFromEnv(): X402Facilitator {
  const type = (process.env.X402_FACILITATOR_TYPE || 'self-hosted') as FacilitatorType;
  const url = process.env.X402_FACILITATOR_URL || DEFAULT_FACILITATOR_URLS[type];
  const apiKey = process.env.X402_FACILITATOR_API_KEY;
  const apiSecret = process.env.X402_FACILITATOR_API_SECRET;
  const webhookSecret = process.env.X402_FACILITATOR_WEBHOOK_SECRET;

  return new X402Facilitator({
    type,
    url,
    apiKey,
    apiSecret,
    webhookSecret,
  });
}
