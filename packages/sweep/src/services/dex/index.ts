/**
 * DEX Aggregation Layer
 *
 * Unified interface to get swap quotes from multiple DEX aggregators.
 * Supports EVM chains (1inch, ParaSwap, 0x, CoW Protocol, Li.Fi)
 * and Solana (Jupiter).
 *
 * @example
 * ```typescript
 * import { dexService } from './services/dex';
 *
 * // Get the best quote across all aggregators
 * const bestQuote = await dexService.getBestQuote({
 *   chain: 'base',
 *   inputToken: '0x...', // Token to sell
 *   outputToken: '0x...', // Token to buy
 *   inputAmount: '1000000000000000000', // 1 token in wei
 *   userAddress: '0x...',
 *   slippage: 0.5, // 0.5%
 * });
 *
 * // Build transaction calldata
 * const calldata = await dexService.buildSwapCalldata(bestQuote.best);
 * ```
 */

import type { SupportedChain } from "../../config/chains.js";
import {
  type DexQuote,
  type QuoteRequest,
  type CrossChainQuoteRequest,
  type QuoteComparison,
  type DexAggregator,
  CHAIN_IDS,
  NATIVE_TOKEN_ADDRESS,
  WRAPPED_NATIVE_TOKEN,
  STABLECOINS,
  isNativeToken,
  DEFAULT_SLIPPAGE,
} from "./types.js";
import {
  quoteOptimizer,
  type QuoteOptimizerOptions,
} from "./quote-optimizer.js";
import {
  calldataBuilder,
  type SwapCalldata,
  type BatchSwapCalldata,
} from "./calldata-builder.js";

// Import individual aggregators for direct access
import { oneInchAggregator } from "./aggregators/1inch.js";
import { paraswapAggregator } from "./aggregators/paraswap.js";
import { zeroXAggregator } from "./aggregators/0x.js";
import { cowswapAggregator } from "./aggregators/cowswap.js";
import { jupiterAggregator } from "./aggregators/jupiter.js";
import { lifiAggregator } from "./aggregators/lifi.js";

export class DexAggregatorService {
  /**
   * Get the best quote from all available aggregators
   *
   * Queries all supported aggregators in parallel and returns the quote
   * with the best net output (output amount - gas cost).
   */
  async getBestQuote(
    request: QuoteRequest,
    options?: QuoteOptimizerOptions
  ): Promise<QuoteComparison | null> {
    return quoteOptimizer.getBestQuote(request, options);
  }

  /**
   * Get a quote optimized for dust sweeping (small amounts)
   *
   * For small amounts, prefers gasless solutions like CoW Protocol
   * and 1inch Fusion to maximize the value received.
   */
  async getDustQuote(
    request: QuoteRequest,
    amountUsd: number
  ): Promise<DexQuote | null> {
    return quoteOptimizer.getDustQuote(request, amountUsd);
  }

  /**
   * Get quotes from specific aggregators
   */
  async getQuotesFromAggregators(
    request: QuoteRequest,
    aggregators: DexAggregator[]
  ): Promise<DexQuote[]> {
    return quoteOptimizer.getQuotesFromAggregators(request, aggregators);
  }

  /**
   * Get a cross-chain swap quote (uses Li.Fi)
   */
  async getCrossChainQuote(
    request: CrossChainQuoteRequest
  ): Promise<DexQuote | null> {
    return lifiAggregator.getCrossChainQuote(request);
  }

  /**
   * Build swap transaction calldata
   */
  buildSwapCalldata(quote: DexQuote): SwapCalldata {
    return calldataBuilder.buildSwapCalldata(quote);
  }

  /**
   * Build complete swap calldata including approvals and wrapping
   */
  async buildCompleteSwapCalldata(
    quote: DexQuote,
    chain: SupportedChain,
    needsApproval: boolean,
    needsWrap?: boolean
  ): Promise<BatchSwapCalldata> {
    const shouldWrap = needsWrap ?? isNativeToken(quote.inputToken.address);
    return calldataBuilder.buildCompleteSwapCalldata(
      quote,
      chain,
      needsApproval,
      shouldWrap
    );
  }

  /**
   * Build batch swap calldata for multiple tokens (dust sweep)
   */
  async buildBatchSwapCalldata(
    quotes: DexQuote[],
    chain: SupportedChain,
    approvalStatus: Map<string, boolean>
  ): Promise<BatchSwapCalldata> {
    return calldataBuilder.buildBatchSwapCalldata(quotes, chain, approvalStatus);
  }

  /**
   * Get a swap quote to convert a token to the chain's stablecoin
   */
  async getSwapToStableQuote(
    chain: SupportedChain,
    inputToken: string,
    inputAmount: string,
    userAddress: string,
    slippage: number = DEFAULT_SLIPPAGE
  ): Promise<QuoteComparison | null> {
    const chainStables = STABLECOINS[chain];
    if (!chainStables) {
      console.error(`No stablecoins configured for chain: ${chain}`);
      return null;
    }

    // Prefer USDC, fall back to USDT
    const outputToken = chainStables.USDC || chainStables.USDT;
    if (!outputToken) {
      console.error(`No USDC or USDT on chain: ${chain}`);
      return null;
    }

    return this.getBestQuote({
      chain,
      inputToken,
      outputToken,
      inputAmount,
      userAddress,
      slippage,
      includeCalldata: true,
    });
  }

  /**
   * Get multiple quotes for a batch of tokens (dust sweep)
   */
  async getBatchQuotes(
    chain: SupportedChain,
    tokens: Array<{ address: string; amount: string }>,
    outputToken: string,
    userAddress: string,
    options?: QuoteOptimizerOptions
  ): Promise<Map<string, DexQuote>> {
    const results = new Map<string, DexQuote>();

    // Query quotes in parallel (max 5 concurrent)
    const batchSize = 5;
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);

      const quotePromises = batch.map(async (token) => {
        const comparison = await this.getBestQuote(
          {
            chain,
            inputToken: token.address,
            outputToken,
            inputAmount: token.amount,
            userAddress,
            includeCalldata: true,
          },
          options
        );

        if (comparison?.best) {
          results.set(token.address, comparison.best);
        }
      });

      await Promise.all(quotePromises);
    }

    return results;
  }

  /**
   * Create a CoW Protocol order (for gasless swaps)
   */
  async createCowOrder(
    quote: DexQuote,
    signature: string
  ): Promise<string | null> {
    if (quote.aggregator !== "cowswap") {
      throw new Error("Quote must be from CoW Protocol");
    }
    return cowswapAggregator.createOrder(quote, signature);
  }

  /**
   * Get CoW Protocol order status
   */
  async getCowOrderStatus(chain: SupportedChain, orderId: string) {
    return cowswapAggregator.getOrderStatus(chain, orderId);
  }

  /**
   * Get Li.Fi transaction status (for cross-chain swaps)
   */
  async getLiFiStatus(txHash: string, fromChain: number, toChain: number) {
    return lifiAggregator.getStatus(txHash, fromChain, toChain);
  }

  /**
   * Check if a chain is supported for swaps
   */
  isChainSupported(chain: SupportedChain): boolean {
    return chain in CHAIN_IDS;
  }

  /**
   * Get available aggregators for a chain
   */
  getAvailableAggregators(chain: SupportedChain): DexAggregator[] {
    const available: DexAggregator[] = [];

    if (oneInchAggregator.isAvailable(chain)) available.push("1inch");
    if (paraswapAggregator.isAvailable(chain)) available.push("paraswap");
    if (zeroXAggregator.isAvailable(chain)) available.push("0x");
    if (cowswapAggregator.isAvailable(chain)) available.push("cowswap");
    if (jupiterAggregator.isAvailable(chain)) available.push("jupiter");
    if (lifiAggregator.isAvailable(chain)) available.push("lifi");

    return available;
  }

  /**
   * Get the wrapped native token address for a chain
   */
  getWrappedNativeToken(chain: SupportedChain): string | undefined {
    return WRAPPED_NATIVE_TOKEN[chain];
  }

  /**
   * Get the native token address constant
   */
  getNativeTokenAddress(): string {
    return NATIVE_TOKEN_ADDRESS;
  }

  /**
   * Check if an address represents the native token
   */
  isNativeToken(address: string): boolean {
    return isNativeToken(address);
  }
}

// Singleton instance
export const dexService = new DexAggregatorService();

// Re-export types
export type {
  DexQuote,
  QuoteRequest,
  CrossChainQuoteRequest,
  QuoteComparison,
  DexAggregator,
  QuoteOptimizerOptions,
  SwapCalldata,
  BatchSwapCalldata,
} from "./types.js";

export { calldataBuilder } from "./calldata-builder.js";
export { quoteOptimizer } from "./quote-optimizer.js";

// Re-export individual aggregators for direct access
export { oneInchAggregator } from "./aggregators/1inch.js";
export { paraswapAggregator } from "./aggregators/paraswap.js";
export { zeroXAggregator } from "./aggregators/0x.js";
export { cowswapAggregator } from "./aggregators/cowswap.js";
export { jupiterAggregator } from "./aggregators/jupiter.js";
export { lifiAggregator } from "./aggregators/lifi.js";
