/**
 * Lyra Unified Client
 * @description Unified payment layer for the entire Lyra ecosystem
 * @author nirholas
 * @license Apache-2.0
 * 
 * One client for all Lyra services:
 * - lyra-intel (9⭐): Code analysis
 * - lyra-registry (9⭐): Tool catalog
 * - lyra-tool-discovery (6⭐): Auto-discovery
 * 
 * @example
 * ```typescript
 * const lyra = new LyraClient({
 *   x402Wallet: process.env.X402_PRIVATE_KEY
 * });
 * 
 * // All Lyra services, one payment layer
 * await lyra.intel.securityScan(repoUrl);    // $0.05
 * await lyra.registry.getToolDetails(id);     // $0.01  
 * await lyra.discovery.analyze(apiUrl);       // $0.02
 * ```
 */

import axios, { type AxiosInstance } from "axios";
import { createX402Client, type X402ClientWrapper } from "@/x402/client.js";
import { LyraIntel } from "./intel.js";
import { LyraRegistry } from "./registry.js";
import { LyraDiscovery } from "./discovery.js";
import type {
  LyraClientConfig,
  LyraPaymentResult,
  LyraUsageStats,
  LyraServiceName,
  ServiceUsage,
} from "./types.js";
import { 
  LYRA_DEFAULT_NETWORK, 
  LYRA_PRICES, 
  LYRA_NETWORKS,
  LYRA_RECOMMENDED_NETWORKS,
  SPERAX_CONTRACTS,
  USDS_BENEFITS,
  PAYMENT_TOKENS,
  DEFAULT_TOKEN_PER_CHAIN,
  type LyraNetworkId,
  type PaymentToken,
} from "./constants.js";
import Logger from "@/utils/logger.js";

/**
 * Unified Lyra Ecosystem Client
 * 
 * Provides a single entry point for all Lyra services with unified x402 payments.
 * 
 * @example Basic Usage
 * ```typescript
 * const lyra = new LyraClient({
 *   x402Wallet: process.env.X402_PRIVATE_KEY
 * });
 * 
 * // Intel: Security scan
 * const security = await lyra.intel.securityScan("https://github.com/user/repo");
 * 
 * // Registry: Get tool details
 * const tool = await lyra.registry.getToolDetails("mcp-server-filesystem");
 * 
 * // Discovery: Analyze API
 * const analysis = await lyra.discovery.analyze("https://api.example.com");
 * ```
 * 
 * @example With Usage Tracking
 * ```typescript
 * const lyra = new LyraClient({
 *   x402Wallet: process.env.X402_PRIVATE_KEY,
 *   maxDailySpend: "5.00" // Limit spending to $5/day
 * });
 * 
 * // Check usage
 * const stats = lyra.getUsageStats("day");
 * console.log(`Spent today: $${stats.totalSpent}`);
 * ```
 * 
 * @example Multi-Chain Support
 * ```typescript
 * const lyra = new LyraClient({
 *   wallets: {
 *     evmPrivateKey: process.env.EVM_PRIVATE_KEY,  // Base, Arbitrum, BSC
 *     svmPrivateKey: process.env.SOL_PRIVATE_KEY,  // Solana
 *   },
 *   network: "arbitrum", // Primary network
 *   chainPreference: {
 *     primary: "arbitrum",
 *     fallbacks: ["base", "bsc"],
 *     preferLowFees: true,
 *   },
 * });
 * ```
 */
export class LyraClient {
  /** Lyra Intel service (code analysis) */
  public readonly intel: LyraIntel;
  
  /** Lyra Registry service (tool catalog) */
  public readonly registry: LyraRegistry;
  
  /** Lyra Tool Discovery service (auto-discovery) */
  public readonly discovery: LyraDiscovery;

  private config: LyraClientConfig;
  private x402Client: X402ClientWrapper | null = null;
  private paymentApi: AxiosInstance;
  private payments: LyraPaymentResult[] = [];
  private dailySpendReset: number = this.getMidnightTimestamp();
  private activeNetwork: LyraNetworkId;

  constructor(config: LyraClientConfig = {}) {
    this.activeNetwork = (config.network ?? LYRA_DEFAULT_NETWORK) as LyraNetworkId;
    this.config = {
      network: this.activeNetwork,
      maxDailySpend: config.maxDailySpend ?? "100.00",
      autoPayEnabled: config.autoPayEnabled ?? true,
      preferredToken: config.preferredToken ?? "USDC",
      ...config,
    };

    // Create the payment-wrapped API instance
    this.paymentApi = this.createPaymentApi();

    // Initialize all services with the same payment callback
    const onPayment = this.handlePayment.bind(this);
    
    this.intel = new LyraIntel(this.paymentApi, config.intel, onPayment);
    this.registry = new LyraRegistry(this.paymentApi, config.registry, onPayment);
    this.discovery = new LyraDiscovery(this.paymentApi, config.discovery, onPayment);

    Logger.info("[LyraClient] Initialized unified Lyra ecosystem client");
  }

  // ==========================================================================
  // Factory Methods
  // ==========================================================================

  /**
   * Create a LyraClient from environment variables
   * 
   * Environment variables:
   * - X402_EVM_PRIVATE_KEY or X402_PRIVATE_KEY: EVM wallet private key (Base, Arbitrum, BSC, etc.)
   * - X402_SVM_PRIVATE_KEY: Solana wallet private key
   * - LYRA_NETWORK: Primary payment network (default: "base")
   * - LYRA_MAX_DAILY_SPEND: Maximum daily spending limit in USD
   * - LYRA_PREFERRED_TOKEN: Preferred stablecoin (USDC, USDT, USDs)
   */
  static fromEnv(): LyraClient {
    return new LyraClient({
      wallets: {
        evmPrivateKey: (process.env.X402_EVM_PRIVATE_KEY ?? process.env.X402_PRIVATE_KEY) as `0x${string}`,
        svmPrivateKey: process.env.X402_SVM_PRIVATE_KEY,
      },
      network: process.env.LYRA_NETWORK ?? "base",
      maxDailySpend: process.env.LYRA_MAX_DAILY_SPEND,
      preferredToken: (process.env.LYRA_PREFERRED_TOKEN as "USDC" | "USDT" | "USDs") ?? "USDC",
    });
  }

  /**
   * Create a client optimized for low fees
   * Uses Base, Arbitrum, or BSC depending on availability
   */
  static lowCost(privateKey: `0x${string}`): LyraClient {
    return new LyraClient({
      wallets: { evmPrivateKey: privateKey },
      network: "base",
      chainPreference: {
        primary: "base",
        fallbacks: ["arbitrum", "bsc"],
        preferLowFees: true,
      },
    });
  }

  /**
   * Create a Solana-only client
   */
  static solana(privateKey: string): LyraClient {
    return new LyraClient({
      wallets: { svmPrivateKey: privateKey },
      network: "solana-mainnet",
    });
  }

  /**
   * Create a read-only client (no payments, free tier only)
   */
  static readOnly(): LyraClient {
    return new LyraClient({
      autoPayEnabled: false,
    });
  }

  /**
   * Create a testnet-only client for development
   */
  static testnet(evmKey?: `0x${string}`, svmKey?: string): LyraClient {
    return new LyraClient({
      wallets: { evmPrivateKey: evmKey, svmPrivateKey: svmKey },
      network: "base-sepolia",
      chainPreference: {
        primary: "base-sepolia",
        fallbacks: ["arbitrum-sepolia", "solana-devnet"],
        testnetOnly: true,
      },
    });
  }

  // ==========================================================================
  // Network Management
  // ==========================================================================

  /**
   * Get current active network
   */
  getActiveNetwork(): LyraNetworkId {
    return this.activeNetwork;
  }

  /**
   * Get network configuration
   */
  getNetworkConfig(network?: LyraNetworkId) {
    const net = network ?? this.activeNetwork;
    return LYRA_NETWORKS[net];
  }

  /**
   * Switch to a different payment network
   */
  async switchNetwork(network: LyraNetworkId): Promise<void> {
    const networkConfig = LYRA_NETWORKS[network];
    if (!networkConfig) {
      throw new Error(`Unknown network: ${network}. Available: ${Object.keys(LYRA_NETWORKS).join(", ")}`);
    }

    // Check if we have the right wallet type
    const wallets = this.config.wallets;
    if (networkConfig.type === "svm" && !wallets?.svmPrivateKey) {
      throw new Error(`Solana private key required for ${network}`);
    }
    if (networkConfig.type === "evm" && !wallets?.evmPrivateKey && !this.config.x402Wallet) {
      throw new Error(`EVM private key required for ${network}`);
    }

    this.activeNetwork = network;
    Logger.info(`[LyraClient] Switched to network: ${networkConfig.name} (${networkConfig.caip2})`);

    // Re-initialize payments if already initialized
    if (this.x402Client) {
      await this.initializePayments();
    }
  }

  /**
   * Get all supported networks
   */
  getSupportedNetworks(): Array<{ id: LyraNetworkId; name: string; type: "evm" | "svm"; testnet: boolean }> {
    return Object.entries(LYRA_NETWORKS).map(([id, config]) => ({
      id: id as LyraNetworkId,
      name: config.name,
      type: config.type,
      testnet: config.testnet,
    }));
  }

  /**
   * Get recommended networks by use case
   */
  getRecommendedNetworks() {
    return LYRA_RECOMMENDED_NETWORKS;
  }

  // ==========================================================================
  // Payment Management
  // ==========================================================================

  /**
   * Initialize the x402 payment client
   * Call this before making paid requests
   */
  async initializePayments(): Promise<void> {
    const wallets = this.config.wallets;
    const legacyKey = this.config.x402Wallet ?? this.config.x402PrivateKey;
    
    if (!wallets?.evmPrivateKey && !wallets?.svmPrivateKey && !legacyKey) {
      Logger.warn("[LyraClient] No wallet configured - paid features will be unavailable");
      return;
    }

    try {
      const networkConfig = LYRA_NETWORKS[this.activeNetwork];
      const networksToRegister: string[] = [];

      // Determine which networks to register based on available keys
      if (wallets?.evmPrivateKey || legacyKey) {
        // Register all EVM networks
        networksToRegister.push("base", "arbitrum", "bsc", "ethereum", "polygon", "optimism");
        if (this.config.chainPreference?.testnetOnly) {
          networksToRegister.push("base-sepolia", "arbitrum-sepolia", "bsc-testnet");
        }
      }
      if (wallets?.svmPrivateKey) {
        // Register Solana networks
        networksToRegister.push("solana-mainnet");
        if (this.config.chainPreference?.testnetOnly) {
          networksToRegister.push("solana-devnet");
        }
      }

      this.x402Client = await createX402Client({
        config: {
          evmPrivateKey: (wallets?.evmPrivateKey ?? legacyKey) as `0x${string}`,
          svmPrivateKey: wallets?.svmPrivateKey,
        },
        networks: networksToRegister as Array<"base" | "arbitrum" | "solana-mainnet">,
      });

      // Wrap the API with payment handling
      this.paymentApi = this.x402Client.wrapAxios(this.paymentApi);
      
      // Re-initialize services with payment-wrapped API
      (this.intel as unknown as { api: AxiosInstance }).api = this.paymentApi;
      (this.registry as unknown as { api: AxiosInstance }).api = this.paymentApi;
      (this.discovery as unknown as { api: AxiosInstance }).api = this.paymentApi;

      Logger.info(`[LyraClient] x402 payments initialized on ${networkConfig.name}`);
      Logger.info(`[LyraClient] Registered networks: ${networksToRegister.join(", ")}`);
    } catch (error) {
      Logger.error("[LyraClient] Failed to initialize x402 payments:", error);
      throw error;
    }
  }

  /**
   * Check if payments are enabled
   */
  isPaymentEnabled(): boolean {
    return this.x402Client !== null && this.config.autoPayEnabled === true;
  }

  /**
   * Get remaining daily spend allowance
   */
  getRemainingDailyAllowance(): string {
    this.resetDailySpendIfNeeded();
    const spent = this.getTodaysSpending();
    const max = parseFloat(this.config.maxDailySpend ?? "100.00");
    const remaining = Math.max(0, max - spent);
    return remaining.toFixed(2);
  }

  /**
   * Check if a payment amount is within the daily limit
   */
  canSpend(amount: string): boolean {
    const remaining = parseFloat(this.getRemainingDailyAllowance());
    return remaining >= parseFloat(amount);
  }

  // ==========================================================================
  // Usage Statistics
  // ==========================================================================

  /**
   * Get usage statistics for a time period
   */
  getUsageStats(period: "day" | "week" | "month" | "all" = "day"): LyraUsageStats {
    const now = Date.now();
    const cutoff = this.getPeriodCutoff(period, now);
    
    const relevantPayments = period === "all" 
      ? this.payments 
      : this.payments.filter(p => p.timestamp >= cutoff);

    const byService: Record<LyraServiceName, ServiceUsage> = {
      intel: { spent: "0.00", requests: 0 },
      registry: { spent: "0.00", requests: 0 },
      discovery: { spent: "0.00", requests: 0 },
    };

    let totalSpent = 0;
    for (const payment of relevantPayments) {
      const amount = parseFloat(payment.amount);
      totalSpent += amount;
      
      const service = byService[payment.service];
      service.spent = (parseFloat(service.spent) + amount).toFixed(2);
      service.requests++;
      service.lastUsed = Math.max(service.lastUsed ?? 0, payment.timestamp);
    }

    return {
      totalSpent: totalSpent.toFixed(2),
      requestCount: relevantPayments.length,
      byService,
      period,
    };
  }

  /**
   * Get payment history
   */
  getPaymentHistory(limit?: number): LyraPaymentResult[] {
    const sorted = [...this.payments].sort((a, b) => b.timestamp - a.timestamp);
    return limit ? sorted.slice(0, limit) : sorted;
  }

  /**
   * Clear payment history
   */
  clearPaymentHistory(): void {
    this.payments = [];
  }

  // ==========================================================================
  // Pricing Information
  // ==========================================================================

  /**
   * Get pricing for all Lyra services
   */
  getPricing(): typeof LYRA_PRICES {
    return LYRA_PRICES;
  }

  /**
   * Estimate total cost for a set of operations
   */
  estimateTotalCost(operations: Array<{
    service: LyraServiceName;
    operation: string;
    count?: number;
  }>): string {
    let total = 0;
    
    for (const op of operations) {
      const servicePricing = LYRA_PRICES[op.service] as Record<string, string>;
      const price = parseFloat(servicePricing[op.operation] ?? "0");
      total += price * (op.count ?? 1);
    }
    
    return total.toFixed(2);
  }

  // ==========================================================================
  // Convenience Methods
  // ==========================================================================

  /**
   * Quick security scan (Intel)
   */
  async securityScan(repoUrl: string) {
    return this.intel.securityScan(repoUrl);
  }

  /**
   * Quick tool search (Registry)
   */
  async searchTools(query: string) {
    return this.registry.search(query);
  }

  /**
   * Quick API discovery (Discovery)
   */
  async discoverApi(apiUrl: string) {
    return this.discovery.discover(apiUrl);
  }

  // ==========================================================================
  // USDs / Sperax Integration (Yield-Bearing Payments)
  // ==========================================================================

  /**
   * Check if using USDs (yield-bearing stablecoin)
   * USDs automatically earns ~5-10% APY while sitting in your wallet
   */
  isUsingUSDs(): boolean {
    return this.activeNetwork === "arbitrum" && 
           (this.config.preferredToken === "USDs" || DEFAULT_TOKEN_PER_CHAIN[this.activeNetwork] === "USDs");
  }

  /**
   * Get Sperax contract addresses for current network
   */
  getSperaxContracts() {
    if (this.activeNetwork === "arbitrum") {
      return SPERAX_CONTRACTS.arbitrum;
    }
    if (this.activeNetwork === "ethereum") {
      return SPERAX_CONTRACTS.ethereum;
    }
    if (this.activeNetwork === "bsc") {
      return SPERAX_CONTRACTS.bsc;
    }
    return null;
  }

  /**
   * Get USDs benefits info
   */
  getUSDsBenefits() {
    return USDS_BENEFITS;
  }

  /**
   * Estimate yield earned on idle funds
   * 
   * @param balance - Current USDs balance in USD
   * @param days - Number of days to estimate
   * @returns Estimated yield in USD
   * 
   * @example
   * ```typescript
   * // $100 USDs for 30 days at ~7.5% APY
   * const yield = lyra.estimateUSdsYield(100, 30);
   * // → ~$0.62
   * ```
   */
  estimateUSdsYield(balance: number, days: number): {
    low: string;
    high: string;
    mid: string;
  } {
    const lowApy = 0.05; // 5%
    const highApy = 0.10; // 10%
    const midApy = 0.075; // 7.5%

    const dailyLow = (balance * lowApy) / 365;
    const dailyHigh = (balance * highApy) / 365;
    const dailyMid = (balance * midApy) / 365;

    return {
      low: (dailyLow * days).toFixed(2),
      high: (dailyHigh * days).toFixed(2),
      mid: (dailyMid * days).toFixed(2),
    };
  }

  /**
   * Get supported payment tokens for current network
   */
  getSupportedTokens(): PaymentToken[] {
    const network = this.activeNetwork;
    return (Object.entries(PAYMENT_TOKENS) as [PaymentToken, typeof PAYMENT_TOKENS[PaymentToken]][])
      .filter(([_, config]) => config.chains.includes(network))
      .map(([token]) => token);
  }

  /**
   * Get default token for current network
   */
  getDefaultToken(): PaymentToken {
    return DEFAULT_TOKEN_PER_CHAIN[this.activeNetwork];
  }

  /**
   * Check if a token is yield-bearing
   */
  isYieldBearing(token: PaymentToken): boolean {
    return PAYMENT_TOKENS[token]?.yieldBearing ?? false;
  }

  /**
   * Create a client optimized for yield-bearing payments (USDs on Arbitrum)
   */
  static yieldBearing(privateKey: `0x${string}`): LyraClient {
    return new LyraClient({
      wallets: { evmPrivateKey: privateKey },
      network: "arbitrum",
      preferredToken: "USDs",
    });
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private createPaymentApi(): AxiosInstance {
    return axios.create({
      timeout: 60000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LyraClient/1.0.0",
      },
    });
  }

  private handlePayment(result: LyraPaymentResult): void {
    this.payments.push(result);
    Logger.info(
      `[LyraClient] Payment: $${result.amount} to ${result.service}.${result.operation}`,
      result.transactionHash ? `(tx: ${result.transactionHash})` : ""
    );
  }

  private getTodaysSpending(): number {
    this.resetDailySpendIfNeeded();
    const midnight = this.getMidnightTimestamp();
    
    return this.payments
      .filter(p => p.timestamp >= midnight)
      .reduce((sum, p) => sum + parseFloat(p.amount), 0);
  }

  private resetDailySpendIfNeeded(): void {
    const currentMidnight = this.getMidnightTimestamp();
    if (currentMidnight > this.dailySpendReset) {
      this.dailySpendReset = currentMidnight;
    }
  }

  private getMidnightTimestamp(): number {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now.getTime();
  }

  private getPeriodCutoff(period: "day" | "week" | "month" | "all", now: number): number {
    switch (period) {
      case "day":
        return now - 24 * 60 * 60 * 1000;
      case "week":
        return now - 7 * 24 * 60 * 60 * 1000;
      case "month":
        return now - 30 * 24 * 60 * 60 * 1000;
      case "all":
        return 0;
    }
  }
}

// ==========================================================================
// Module-level convenience functions
// ==========================================================================

let defaultClient: LyraClient | null = null;

/**
 * Get or create the default Lyra client
 */
export function getLyraClient(): LyraClient {
  if (!defaultClient) {
    defaultClient = LyraClient.fromEnv();
  }
  return defaultClient;
}

/**
 * Set the default Lyra client
 */
export function setLyraClient(client: LyraClient): void {
  defaultClient = client;
}

/**
 * Reset the default client
 */
export function resetLyraClient(): void {
  defaultClient = null;
}
