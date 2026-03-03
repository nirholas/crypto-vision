/**
 * Bridge Aggregator
 * Aggregates quotes from multiple bridge providers and selects optimal route
 */

import { cacheGet, cacheSet } from "../../utils/redis.js";
import type { SupportedChain } from "../../config/chains.js";
import {
  BridgeProvider,
  BRIDGE_CONFIG,
  type BridgeQuote,
  type BridgeQuoteRequest,
  type BridgeTransaction,
  type BridgeReceipt,
  type IBridgeProvider,
  type BridgeAggregatorConfig,
  type BridgePriority,
} from "./types.js";
import { createAcrossProvider } from "./across.js";
import { createStargateProvider } from "./stargate.js";
import { createHopProvider } from "./hop.js";
import { createCbridgeProvider } from "./cbridge.js";
import { createSocketProvider } from "./socket.js";
import { createSynapseProvider } from "./synapse.js";

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BridgeAggregatorConfig = {
  enabledProviders: [
    BridgeProvider.ACROSS,
    BridgeProvider.STARGATE,
    BridgeProvider.HOP,
    BridgeProvider.CBRIDGE,
    BridgeProvider.SOCKET,
    BridgeProvider.SYNAPSE,
  ],
  maxSlippage: 0.005, // 0.5%
  preferFastFills: true,
  minOutputValueUsd: BRIDGE_CONFIG.MIN_OUTPUT_VALUE_USD,
  maxBridgeTimeSeconds: BRIDGE_CONFIG.MAX_BRIDGE_TIME_SECONDS,
  across: {
    apiUrl: "https://app.across.to/api",
    spokePoolAddresses: {},
  },
  stargate: {
    apiUrl: "https://api.stargate.finance",
    routerAddresses: {},
  },
};

/**
 * Quote comparison result
 */
export interface QuoteComparison {
  quotes: BridgeQuote[];
  bestQuote: BridgeQuote | null;
  comparison: {
    provider: BridgeProvider;
    outputAmount: bigint;
    totalFees: bigint;
    estimatedTime: number;
    score: number; // Higher is better
  }[];
}

/**
 * Bridge Aggregator class
 * Gets quotes from multiple providers and selects the best route
 */
export class BridgeAggregator {
  private readonly config: BridgeAggregatorConfig;
  private readonly providers: Map<BridgeProvider, IBridgeProvider>;
  private readonly cachePrefix = "bridge:aggregator";
  
  constructor(config: Partial<BridgeAggregatorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.providers = new Map();
    
    // Initialize enabled providers
    this.initializeProviders();
  }
  
  /**
   * Initialize bridge providers
   */
  private initializeProviders(): void {
    for (const provider of this.config.enabledProviders) {
      switch (provider) {
        case BridgeProvider.ACROSS:
          this.providers.set(
            BridgeProvider.ACROSS,
            createAcrossProvider(this.config.across.apiUrl)
          );
          break;
        case BridgeProvider.STARGATE:
          this.providers.set(
            BridgeProvider.STARGATE,
            createStargateProvider(this.config.stargate.apiUrl)
          );
          break;
        case BridgeProvider.HOP:
          this.providers.set(
            BridgeProvider.HOP,
            createHopProvider()
          );
          break;
        case BridgeProvider.CBRIDGE:
          this.providers.set(
            BridgeProvider.CBRIDGE,
            createCbridgeProvider()
          );
          break;
        case BridgeProvider.SOCKET:
          this.providers.set(
            BridgeProvider.SOCKET,
            createSocketProvider()
          );
          break;
        case BridgeProvider.SYNAPSE:
          this.providers.set(
            BridgeProvider.SYNAPSE,
            createSynapseProvider()
          );
          break;
      }
    }
  }
  
  /**
   * Get a provider by name
   */
  getProvider(name: BridgeProvider): IBridgeProvider | null {
    return this.providers.get(name) || null;
  }
  
  /**
   * Check which providers support a route
   */
  async getSupportedProviders(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    token: `0x${string}`
  ): Promise<BridgeProvider[]> {
    const cacheKey = `${this.cachePrefix}:supported:${sourceChain}:${destinationChain}:${token}`;
    const cached = await cacheGet<BridgeProvider[]>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const supported: BridgeProvider[] = [];
    
    // Check each provider in parallel
    const checks = await Promise.all(
      Array.from(this.providers.entries()).map(async ([name, provider]) => {
        try {
          const isSupported = await provider.supportsRoute(
            sourceChain,
            destinationChain,
            token
          );
          return { name, isSupported };
        } catch {
          return { name, isSupported: false };
        }
      })
    );
    
    for (const { name, isSupported } of checks) {
      if (isSupported) {
        supported.push(name);
      }
    }
    
    await cacheSet(cacheKey, supported, 300); // Cache for 5 minutes
    return supported;
  }
  
  /**
   * Get quotes from all providers
   */
  async getQuotes(request: BridgeQuoteRequest): Promise<BridgeQuote[]> {
    const quotes: BridgeQuote[] = [];
    
    // Get supported providers first
    const supportedProviders = await this.getSupportedProviders(
      request.sourceChain,
      request.destinationChain,
      request.sourceToken
    );
    
    if (supportedProviders.length === 0) {
      console.warn(
        `[BridgeAggregator] No providers support route ${request.sourceChain} -> ${request.destinationChain}`
      );
      return quotes;
    }
    
    // Get quotes in parallel
    const quotePromises = supportedProviders.map(async (providerName) => {
      const provider = this.providers.get(providerName);
      if (!provider) return null;
      
      try {
        const quote = await provider.getQuote(request);
        return quote;
      } catch (error) {
        console.error(`[BridgeAggregator] Error getting quote from ${providerName}:`, error);
        return null;
      }
    });
    
    const results = await Promise.all(quotePromises);
    
    for (const quote of results) {
      if (quote) {
        quotes.push(quote);
      }
    }
    
    return quotes;
  }
  
  /**
   * Get the best quote across all providers
   */
  async getBestQuote(request: BridgeQuoteRequest): Promise<BridgeQuote | null> {
    const comparison = await this.compareQuotes(request);
    return comparison.bestQuote;
  }
  
  /**
   * Compare quotes from all providers
   */
  async compareQuotes(request: BridgeQuoteRequest): Promise<QuoteComparison> {
    const quotes = await this.getQuotes(request);
    
    if (quotes.length === 0) {
      return {
        quotes: [],
        bestQuote: null,
        comparison: [],
      };
    }
    
    // Score each quote
    const comparison = quotes.map((quote) => {
      const score = this.calculateQuoteScore(quote);
      return {
        provider: quote.provider,
        outputAmount: quote.outputAmount,
        totalFees:
          quote.fees.bridgeFee + quote.fees.gasFee + quote.fees.relayerFee,
        estimatedTime: quote.estimatedTime,
        score,
      };
    });
    
    // Sort by score (highest first)
    comparison.sort((a, b) => b.score - a.score);
    
    // Find the best quote
    const bestProvider = comparison[0]?.provider;
    const bestQuote = quotes.find((q) => q.provider === bestProvider) || null;
    
    return {
      quotes,
      bestQuote,
      comparison,
    };
  }
  
  /**
   * Calculate score for a quote (higher is better)
   */
  private calculateQuoteScore(quote: BridgeQuote): number {
    let score = 0;
    
    // Output amount weight (most important)
    // Normalize to 0-100 based on output ratio
    const outputRatio = Number(quote.outputAmount) / Number(quote.inputAmount);
    score += outputRatio * 50; // Max 50 points for output
    
    // Speed weight
    // Fast fills get bonus
    if (quote.isFastFill && this.config.preferFastFills) {
      score += 20;
    } else {
      // Score based on time (faster is better)
      // Max 20 points for instant, decreasing to 0 for 1 hour
      const timeScore = Math.max(
        0,
        20 - (quote.estimatedTime / this.config.maxBridgeTimeSeconds) * 20
      );
      score += timeScore;
    }
    
    // Fee efficiency weight
    const totalFees =
      quote.fees.bridgeFee + quote.fees.gasFee + quote.fees.relayerFee;
    const feeRatio = Number(totalFees) / Number(quote.inputAmount);
    // Lower fees = higher score (max 15 points for 0% fees)
    score += Math.max(0, 15 - feeRatio * 100);
    
    // Provider reliability weight (subjective, based on historical performance)
    const reliabilityScores: Record<BridgeProvider, number> = {
      [BridgeProvider.ACROSS]: 15, // Fast, reliable
      [BridgeProvider.STARGATE]: 12, // Good but slower
      [BridgeProvider.HOP]: 10,
      [BridgeProvider.SYNAPSE]: 10,
      [BridgeProvider.CBRIDGE]: 10,
      [BridgeProvider.SOCKET]: 8,
    };
    score += reliabilityScores[quote.provider] || 5;
    
    return score;
  }
  
  /**
   * Build transaction for the best quote
   */
  async buildTransaction(quote: BridgeQuote): Promise<BridgeTransaction> {
    const provider = this.providers.get(quote.provider);
    if (!provider) {
      throw new Error(`Provider ${quote.provider} not available`);
    }
    
    return provider.buildTransaction(quote);
  }
  
  /**
   * Get transaction status
   */
  async getStatus(
    sourceTxHash: `0x${string}`,
    sourceChain: SupportedChain,
    provider?: BridgeProvider
  ): Promise<BridgeReceipt> {
    // If provider is specified, use it directly
    if (provider) {
      const bridgeProvider = this.providers.get(provider);
      if (!bridgeProvider) {
        throw new Error(`Provider ${provider} not available`);
      }
      return bridgeProvider.getStatus(sourceTxHash, sourceChain);
    }
    
    // Otherwise, try all providers
    for (const [name, bridgeProvider] of this.providers) {
      try {
        const status = await bridgeProvider.getStatus(sourceTxHash, sourceChain);
        if (status.status !== "pending") {
          return status;
        }
      } catch {
        // Try next provider
      }
    }
    
    // Return pending status if no provider has info
    return {
      provider: BridgeProvider.ACROSS, // Default
      quoteId: "",
      status: "pending" as any,
      sourceTxHash,
      sourceChain,
      sourceConfirmations: 0,
      destinationChain: "ethereum" as SupportedChain,
      inputAmount: 0n,
      initiatedAt: Date.now(),
    };
  }
  
  /**
   * Get optimal bridge route (direct vs multi-hop)
   */
  async getOptimalRoute(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    token: `0x${string}`,
    amount: bigint,
    sender: `0x${string}`,
    recipient: `0x${string}`
  ): Promise<{
    type: "direct" | "multi-hop";
    quotes: BridgeQuote[];
    totalOutput: bigint;
    totalFees: bigint;
    estimatedTime: number;
  }> {
    // Try direct route first
    const directRequest: BridgeQuoteRequest = {
      sourceChain,
      destinationChain,
      sourceToken: token,
      destinationToken: token, // Same token
      amount,
      sender,
      recipient,
      slippage: this.config.maxSlippage,
    };
    
    const directQuotes = await this.getQuotes(directRequest);
    
    if (directQuotes.length > 0) {
      const bestDirect = directQuotes.reduce((best, current) =>
        current.outputAmount > best.outputAmount ? current : best
      );
      
      return {
        type: "direct",
        quotes: [bestDirect],
        totalOutput: bestDirect.outputAmount,
        totalFees:
          bestDirect.fees.bridgeFee +
          bestDirect.fees.gasFee +
          bestDirect.fees.relayerFee,
        estimatedTime: bestDirect.estimatedTime,
      };
    }
    
    // Try multi-hop through an intermediate chain
    const intermediateChains: SupportedChain[] = ["ethereum", "arbitrum", "base"];
    let bestMultiHop: {
      quotes: BridgeQuote[];
      totalOutput: bigint;
      totalFees: bigint;
      estimatedTime: number;
    } | null = null;
    
    for (const intermediate of intermediateChains) {
      if (intermediate === sourceChain || intermediate === destinationChain) {
        continue;
      }
      
      // First hop: source -> intermediate
      const firstHopRequest: BridgeQuoteRequest = {
        sourceChain,
        destinationChain: intermediate,
        sourceToken: token,
        destinationToken: token,
        amount,
        sender,
        recipient: sender, // Self for intermediate
        slippage: this.config.maxSlippage,
      };
      
      const firstHopQuotes = await this.getQuotes(firstHopRequest);
      if (firstHopQuotes.length === 0) continue;
      
      const bestFirstHop = firstHopQuotes.reduce((best, current) =>
        current.outputAmount > best.outputAmount ? current : best
      );
      
      // Second hop: intermediate -> destination
      const secondHopRequest: BridgeQuoteRequest = {
        sourceChain: intermediate,
        destinationChain,
        sourceToken: token,
        destinationToken: token,
        amount: bestFirstHop.outputAmount,
        sender,
        recipient,
        slippage: this.config.maxSlippage,
      };
      
      const secondHopQuotes = await this.getQuotes(secondHopRequest);
      if (secondHopQuotes.length === 0) continue;
      
      const bestSecondHop = secondHopQuotes.reduce((best, current) =>
        current.outputAmount > best.outputAmount ? current : best
      );
      
      const totalOutput = bestSecondHop.outputAmount;
      const totalFees =
        bestFirstHop.fees.bridgeFee +
        bestFirstHop.fees.gasFee +
        bestFirstHop.fees.relayerFee +
        bestSecondHop.fees.bridgeFee +
        bestSecondHop.fees.gasFee +
        bestSecondHop.fees.relayerFee;
      const estimatedTime =
        bestFirstHop.estimatedTime + bestSecondHop.estimatedTime;
      
      if (!bestMultiHop || totalOutput > bestMultiHop.totalOutput) {
        bestMultiHop = {
          quotes: [bestFirstHop, bestSecondHop],
          totalOutput,
          totalFees,
          estimatedTime,
        };
      }
    }
    
    if (bestMultiHop) {
      return {
        type: "multi-hop",
        ...bestMultiHop,
      };
    }
    
    throw new Error(
      `No bridge route found from ${sourceChain} to ${destinationChain}`
    );
  }
  
  /**
   * Get enabled providers
   */
  getEnabledProviders(): BridgeProvider[] {
    return Array.from(this.providers.keys());
  }
  
  /**
   * Find best route based on priority
   */
  async findBestRoute(params: {
    sourceChain: SupportedChain;
    destChain: SupportedChain;
    token: `0x${string}`;
    amount: string;
    userAddress: `0x${string}`;
    priority: BridgePriority;
  }): Promise<BridgeQuote[]> {
    const request: BridgeQuoteRequest = {
      sourceChain: params.sourceChain,
      destinationChain: params.destChain,
      sourceToken: params.token,
      destinationToken: params.token, // Same token for bridging
      amount: BigInt(params.amount),
      sender: params.userAddress,
      recipient: params.userAddress,
      priority: params.priority,
    };
    
    const quotes = await this.getQuotes(request);
    
    // Sort based on priority
    switch (params.priority) {
      case "speed":
        return quotes.sort((a, b) => a.estimatedTime - b.estimatedTime);
      case "cost":
        return quotes.sort((a, b) => {
          const feeA = Number(a.fees.bridgeFee + a.fees.gasFee + a.fees.relayerFee);
          const feeB = Number(b.fees.bridgeFee + b.fees.gasFee + b.fees.relayerFee);
          return feeA - feeB;
        });
      case "reliability":
        // Sort by provider reliability scores
        const reliabilityOrder = [
          BridgeProvider.ACROSS,
          BridgeProvider.HOP,
          BridgeProvider.STARGATE,
          BridgeProvider.CBRIDGE,
          BridgeProvider.SOCKET,
        ];
        return quotes.sort((a, b) => {
          const indexA = reliabilityOrder.indexOf(a.provider);
          const indexB = reliabilityOrder.indexOf(b.provider);
          return indexA - indexB;
        });
      default:
        return quotes;
    }
  }
  
  /**
   * Get all available routes
   */
  async getAllRoutes(params: {
    sourceChain: SupportedChain;
    destChain: SupportedChain;
    token: `0x${string}`;
    amount: string;
    userAddress: `0x${string}`;
  }): Promise<BridgeQuote[]> {
    const request: BridgeQuoteRequest = {
      sourceChain: params.sourceChain,
      destinationChain: params.destChain,
      sourceToken: params.token,
      destinationToken: params.token,
      amount: BigInt(params.amount),
      sender: params.userAddress,
      recipient: params.userAddress,
    };
    
    return this.getQuotes(request);
  }
  
  /**
   * Execute a bridge transaction (builds and returns tx to sign)
   */
  async executeBridge(quote: BridgeQuote): Promise<BridgeTransaction> {
    return this.buildTransaction(quote);
  }
  
  /**
   * Get bridge status
   */
  async getBridgeStatus(
    txHash: `0x${string}`,
    sourceChain: SupportedChain,
    provider?: BridgeProvider
  ): Promise<BridgeReceipt> {
    return this.getStatus(txHash, sourceChain, provider);
  }
}

/**
 * Create a bridge aggregator instance
 */
export function createBridgeAggregator(
  config?: Partial<BridgeAggregatorConfig>
): BridgeAggregator {
  return new BridgeAggregator(config);
}

// Export default instance
export const bridgeAggregator = new BridgeAggregator();

// Re-export types and providers
export * from "./types.js";
export { createAcrossProvider, getAcrossSpokePool } from "./across.js";
export { createStargateProvider, getStargateRouter, getLzEndpointId } from "./stargate.js";
export { createHopProvider, getHopBridgeAddress } from "./hop.js";
export { createCbridgeProvider, getCbridgeAddress } from "./cbridge.js";
export { createSocketProvider } from "./socket.js";

