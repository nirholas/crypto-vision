/**
 * @fileoverview X402 SDK Main Client
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type PublicClient,
  type WalletClient,
  type Hash,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { arbitrum, arbitrumSepolia, base, mainnet, polygon, optimism, bsc } from 'viem/chains';
import type {
  X402ClientConfig,
  X402Chain,
  X402Token,
  PaymentRequest,
  PaymentTransaction,
  PaymentResult,
  EIP3009Authorization,
  AuthorizationOptions,
  BatchPaymentItem,
  BatchPaymentResult,
  HTTP402Response,
  HTTP402ParseResult,
  Handle402Options,
  YieldInfo,
  YieldEstimate,
  BalanceInfo,
  PaymentEvent,
  PaymentEventListener,
} from './types';
import { X402Error, X402ErrorCode } from './types';
import { NETWORKS, TOKENS, DEFAULT_TOKEN, DEFAULTS } from './constants';
import { StandardPayment } from './payments/standard';
import { GaslessPayment } from './payments/gasless';
import { BatchPayment } from './payments/batch';
import { HTTP402Handler } from './http/handler';
import { YieldTracker } from './yield/tracker';
import { USDs } from './contracts/usds';
import { RevenueSplitter } from './contracts/revenue-splitter';

/**
 * Chain configuration mapping
 */
const VIEM_CHAINS = {
  arbitrum,
  'arbitrum-sepolia': arbitrumSepolia,
  base,
  ethereum: mainnet,
  polygon,
  optimism,
  bsc,
};

/**
 * X402 Payment Protocol SDK Client
 *
 * Full-featured client for X402 payments with Sperax USDs on Arbitrum.
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
 * const result = await client.pay('0x...', '10.00', 'USDs');
 *
 * // Gasless payment
 * const auth = await client.createAuthorization('0x...', '1.00', 'USDs');
 * const tx = await client.settleGasless(auth);
 *
 * // Handle 402 response
 * const parsed = await client.handlePaymentRequired(response);
 *
 * // Track yield
 * const yieldInfo = await client.getYield('0x...');
 * ```
 */
export class X402Client {
  private readonly publicClient: PublicClient;
  private readonly walletClient?: WalletClient;
  private readonly chain: X402Chain;
  private readonly privateKey?: `0x${string}`;
  private readonly config: Required<
    Pick<X402ClientConfig, 'enableGasless' | 'timeout' | 'facilitatorUrl' | 'debug'>
  >;

  // Payment handlers
  private readonly standardPayment: StandardPayment;
  private readonly gaslessPayment: GaslessPayment;
  private readonly batchPayment: BatchPayment;

  // Contract interfaces
  private yieldTracker?: YieldTracker;
  private usds?: USDs;

  // Event listeners
  private readonly listeners: Set<PaymentEventListener> = new Set();

  constructor(options: X402ClientConfig) {
    this.chain = options.chain;
    this.privateKey = options.privateKey;

    // Validate chain
    const viemChain = VIEM_CHAINS[this.chain];
    if (!viemChain) {
      throw new X402Error(
        `Chain "${this.chain}" is not supported`,
        X402ErrorCode.UNSUPPORTED_CHAIN
      );
    }

    // Set defaults
    this.config = {
      enableGasless: options.enableGasless ?? true,
      timeout: options.timeout ?? DEFAULTS.TIMEOUT,
      facilitatorUrl: options.facilitatorUrl ?? DEFAULTS.FACILITATOR_URL,
      debug: options.debug ?? false,
    };

    // Create public client
    const rpcUrl = options.rpcUrl ?? NETWORKS[this.chain].rpcUrl;
    this.publicClient = createPublicClient({
      chain: viemChain,
      transport: http(rpcUrl, { timeout: this.config.timeout }),
    }) as PublicClient;

    // Create wallet client if private key provided
    if (options.privateKey) {
      const account = privateKeyToAccount(options.privateKey);
      this.walletClient = createWalletClient({
        account,
        chain: viemChain,
        transport: http(rpcUrl),
      });
    }

    // Initialize payment handlers
    this.standardPayment = new StandardPayment(
      this.publicClient,
      this.walletClient,
      this.chain
    );
    this.gaslessPayment = new GaslessPayment(
      this.publicClient,
      this.walletClient,
      this.chain,
      this.privateKey
    );
    this.batchPayment = new BatchPayment(
      this.publicClient,
      this.walletClient,
      this.chain
    );
  }

  // ============================================================================
  // Simple Payment API
  // ============================================================================

  /**
   * Execute a simple payment
   *
   * @param recipient - Recipient address
   * @param amount - Amount to pay (human-readable, e.g., "10.00")
   * @param token - Token to use (default: chain default token)
   * @returns Payment result with transaction details
   *
   * @example
   * ```typescript
   * const result = await client.pay('0x...', '10.00', 'USDs');
   * console.log('Tx:', result.transaction.hash);
   * ```
   */
  async pay(
    recipient: Address,
    amount: string,
    token?: X402Token
  ): Promise<PaymentResult> {
    const paymentToken = token ?? DEFAULT_TOKEN[this.chain];

    const request: PaymentRequest = {
      amount,
      token: paymentToken,
      chain: this.chain,
      recipient,
    };

    await this.emitEvent({ type: 'payment:requested', data: request });

    // Try gasless if enabled and supported
    if (this.config.enableGasless && this.gaslessPayment.supportsGasless(paymentToken)) {
      try {
        const transaction = await this.gaslessPayment.executeGasless(request);
        await this.emitEvent({ type: 'payment:confirmed', data: transaction });

        return {
          transaction,
          gasless: true,
          estimatedYield: this.isUSDs(paymentToken)
            ? await this.estimateYield(recipient)
            : undefined,
        };
      } catch (error) {
        this.log('Gasless payment failed, falling back to standard:', error);
      }
    }

    // Standard payment
    const transaction = await this.standardPayment.execute(request);
    await this.emitEvent({ type: 'payment:confirmed', data: transaction });

    return {
      transaction,
      gasless: false,
      estimatedYield: this.isUSDs(paymentToken)
        ? await this.estimateYield(recipient)
        : undefined,
    };
  }

  // ============================================================================
  // Gasless Payment API (EIP-3009)
  // ============================================================================

  /**
   * Create a gasless payment authorization
   * The recipient or a relayer can submit this to execute the transfer
   *
   * @param recipient - Recipient address
   * @param amount - Amount to transfer
   * @param token - Token to use
   * @param options - Authorization options
   * @returns EIP-3009 authorization
   *
   * @example
   * ```typescript
   * const auth = await client.createAuthorization('0x...', '1.00', 'USDs');
   * // Send auth to recipient/relayer...
   * const tx = await client.settleGasless(auth);
   * ```
   */
  async createAuthorization(
    recipient: Address,
    amount: string,
    token?: X402Token,
    options?: AuthorizationOptions
  ): Promise<EIP3009Authorization> {
    const paymentToken = token ?? DEFAULT_TOKEN[this.chain];

    if (!this.gaslessPayment.supportsGasless(paymentToken)) {
      throw new X402Error(
        `Token ${paymentToken} does not support gasless transfers on ${this.chain}`,
        X402ErrorCode.UNSUPPORTED_TOKEN
      );
    }

    const authorization = await this.gaslessPayment.createAuthorization(
      recipient,
      amount,
      paymentToken,
      options
    );

    await this.emitEvent({ type: 'authorization:created', data: authorization });

    return authorization;
  }

  /**
   * Settle a gasless payment authorization on-chain
   *
   * @param authorization - EIP-3009 authorization
   * @param token - Token (must match authorization)
   * @returns Completed transaction
   */
  async settleGasless(
    authorization: EIP3009Authorization,
    token?: X402Token
  ): Promise<PaymentTransaction> {
    const paymentToken = token ?? DEFAULT_TOKEN[this.chain];

    const transaction = await this.gaslessPayment.settleAuthorization(authorization, paymentToken);
    await this.emitEvent({ type: 'authorization:settled', data: transaction });

    return transaction;
  }

  /**
   * Check if gasless payments are supported for a token
   */
  supportsGasless(token?: X402Token): boolean {
    const paymentToken = token ?? DEFAULT_TOKEN[this.chain];
    return this.gaslessPayment.supportsGasless(paymentToken);
  }

  // ============================================================================
  // Batch Payment API
  // ============================================================================

  /**
   * Execute multiple payments
   *
   * @param items - Array of payment items
   * @param token - Token to use for all payments
   * @param options - Batch options
   * @returns Batch payment result
   */
  async payBatch(
    items: BatchPaymentItem[],
    token?: X402Token,
    options?: { continueOnError?: boolean }
  ): Promise<BatchPaymentResult> {
    const paymentToken = token ?? DEFAULT_TOKEN[this.chain];
    return this.batchPayment.executeMultiple(items, paymentToken, options);
  }

  // ============================================================================
  // HTTP 402 Handling
  // ============================================================================

  /**
   * Handle an HTTP 402 Payment Required response
   *
   * @param response - HTTP 402 response or fetch Response
   * @param options - Handling options
   * @returns Parsed payment request
   */
  async handlePaymentRequired(
    response: HTTP402Response | Response,
    options?: Handle402Options
  ): Promise<HTTP402ParseResult & { transaction?: PaymentTransaction }> {
    let parseResult: HTTP402ParseResult;

    if ('ok' in response) {
      // Fetch Response
      parseResult = await HTTP402Handler.fromFetchResponse(response);
    } else {
      // HTTP402Response
      parseResult = HTTP402Handler.parse(response);
    }

    if (!parseResult.isPaymentRequired || !parseResult.paymentRequest) {
      return parseResult;
    }

    const request = parseResult.paymentRequest;

    // Check auto-pay threshold
    if (options?.autoPayUnder) {
      const autoPayLimit = parseFloat(options.autoPayUnder);
      const requestAmount = parseFloat(request.amount);

      if (requestAmount <= autoPayLimit) {
        const result = await this.pay(request.recipient, request.amount, request.token);
        return { ...parseResult, transaction: result.transaction };
      }
    }

    // Call approval callback if provided
    if (options?.onApprovalRequired) {
      const approved = await options.onApprovalRequired(request);

      if (approved) {
        const result = await this.pay(request.recipient, request.amount, request.token);
        return { ...parseResult, transaction: result.transaction };
      }
    }

    return parseResult;
  }

  /**
   * Create a 402 response for servers
   */
  create402Response(
    request: PaymentRequest,
    message?: string
  ): ReturnType<typeof HTTP402Handler.createResponse> {
    return HTTP402Handler.createResponse(request, message);
  }

  // ============================================================================
  // Yield Tracking
  // ============================================================================

  /**
   * Get yield information for an address
   * Only available for USDs on Arbitrum
   *
   * @param address - Address to check
   * @returns Yield information
   */
  async getYield(address: Address): Promise<YieldInfo> {
    const tracker = this.getYieldTracker();
    return tracker.getYieldInfo(address);
  }

  /**
   * Estimate yield over time
   *
   * @param address - Address to estimate for
   * @returns Yield estimates
   */
  async estimateYield(address: Address): Promise<YieldEstimate> {
    const tracker = this.getYieldTracker();
    return tracker.estimateYield(address);
  }

  /**
   * Get current USDs APY
   */
  async getCurrentAPY(): Promise<number> {
    const tracker = this.getYieldTracker();
    return tracker.getCurrentAPY();
  }

  // ============================================================================
  // Balance & Token Operations
  // ============================================================================

  /**
   * Get token balance
   *
   * @param address - Address to check
   * @param token - Token to check
   * @returns Balance info
   */
  async getBalance(address: Address, token?: X402Token): Promise<BalanceInfo> {
    const paymentToken = token ?? DEFAULT_TOKEN[this.chain];
    return this.standardPayment.getBalance(address, paymentToken);
  }

  /**
   * Get own wallet address
   */
  getAddress(): Address | undefined {
    return this.walletClient?.account?.address;
  }

  /**
   * Get the underlying public client (for advanced use)
   */
  getPublicClient(): PublicClient {
    return this.publicClient;
  }

  /**
   * Get the underlying wallet client (for advanced use)
   */
  getWalletClient(): WalletClient | undefined {
    return this.walletClient;
  }

  /**
   * Approve token spending
   */
  async approve(spender: Address, amount: string, token?: X402Token): Promise<Hash> {
    const paymentToken = token ?? DEFAULT_TOKEN[this.chain];
    return this.standardPayment.approve(spender, amount, paymentToken);
  }

  // ============================================================================
  // Contract Interfaces
  // ============================================================================

  /**
   * Get USDs contract interface
   */
  getUSDs(): USDs {
    if (!this.usds) {
      this.usds = new USDs(this.publicClient, this.walletClient);
    }
    return this.usds;
  }

  /**
   * Get Revenue Splitter contract interface
   *
   * @param address - Revenue splitter contract address
   */
  getRevenueSplitter(address: Address): RevenueSplitter {
    return new RevenueSplitter(address, this.publicClient, this.walletClient);
  }

  // ============================================================================
  // Event Handling
  // ============================================================================

  /**
   * Add payment event listener
   */
  on(listener: PaymentEventListener): void {
    this.listeners.add(listener);
  }

  /**
   * Remove payment event listener
   */
  off(listener: PaymentEventListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Emit event to all listeners
   */
  private async emitEvent(event: PaymentEvent): Promise<void> {
    for (const listener of this.listeners) {
      try {
        await listener(event);
      } catch (error) {
        this.log('Event listener error:', error);
      }
    }
  }

  // ============================================================================
  // Network Info
  // ============================================================================

  /**
   * Get current chain info
   */
  getChainInfo() {
    return {
      chain: this.chain,
      chainId: NETWORKS[this.chain].chainId,
      name: NETWORKS[this.chain].name,
      rpcUrl: NETWORKS[this.chain].rpcUrl,
      explorerUrl: NETWORKS[this.chain].explorerUrl,
      isTestnet: NETWORKS[this.chain].isTestnet,
    };
  }

  /**
   * Get available tokens on current chain
   */
  getAvailableTokens(): X402Token[] {
    const tokens = TOKENS[this.chain];
    return Object.keys(tokens) as X402Token[];
  }

  // ============================================================================
  // Internal Helpers
  // ============================================================================

  private getYieldTracker(): YieldTracker {
    if (!this.yieldTracker) {
      this.yieldTracker = new YieldTracker(this.publicClient, this.chain);
    }
    return this.yieldTracker;
  }

  private isUSDs(token: X402Token): boolean {
    return token === 'USDs' && (this.chain === 'arbitrum' || this.chain === 'arbitrum-sepolia');
  }

  private log(...args: unknown[]): void {
    if (this.config.debug) {
      console.log('[X402]', ...args);
    }
  }
}
