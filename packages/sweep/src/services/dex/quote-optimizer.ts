import type { SupportedChain } from "../../config/chains.js";
import {
  type DexQuote,
  type QuoteRequest,
  type QuoteComparison,
  type DexAggregator,
  type IDexAggregator,
  CHAIN_IDS,
} from "./types.js";
import { oneInchAggregator } from "./aggregators/1inch.js";
import { paraswapAggregator } from "./aggregators/paraswap.js";
import { zeroXAggregator } from "./aggregators/0x.js";
import { cowswapAggregator } from "./aggregators/cowswap.js";
import { jupiterAggregator } from "./aggregators/jupiter.js";
import { lifiAggregator } from "./aggregators/lifi.js";

// All available aggregators
const aggregators: IDexAggregator[] = [
  oneInchAggregator,
  paraswapAggregator,
  zeroXAggregator,
  cowswapAggregator,
  jupiterAggregator,
  lifiAggregator,
];

// Get gas price in USD for a chain (simple implementation)
async function getGasPriceUsd(chain: SupportedChain): Promise<number> {
  // Approximate gas prices in gwei and native token prices
  const gasPrices: Record<string, { gwei: number; nativeUsd: number }> = {
    ethereum: { gwei: 30, nativeUsd: 2500 },
    base: { gwei: 0.01, nativeUsd: 2500 },
    arbitrum: { gwei: 0.1, nativeUsd: 2500 },
    polygon: { gwei: 50, nativeUsd: 0.8 },
    bsc: { gwei: 3, nativeUsd: 300 },
    linea: { gwei: 0.5, nativeUsd: 2500 },
    optimism: { gwei: 0.01, nativeUsd: 2500 },
    solana: { gwei: 0, nativeUsd: 100 }, // Solana uses different model
  };

  const config = gasPrices[chain] || { gwei: 20, nativeUsd: 2500 };

  // Gas price in ETH = gwei * 1e-9
  // Gas price in USD = gas price in ETH * native token USD price
  return config.gwei * 1e-9 * config.nativeUsd;
}

// Calculate gas cost in USD for a quote
async function calculateGasCostUsd(
  quote: DexQuote,
  chain: SupportedChain
): Promise<number> {
  // If already calculated, return it
  if (quote.estimatedGasUsd > 0) {
    return quote.estimatedGasUsd;
  }

  // CoW Protocol is gasless for users
  if (quote.aggregator === "cowswap") {
    return 0;
  }

  // Solana has fixed low fees
  if (chain === "solana") {
    return 0.001; // ~0.1 cents
  }

  const gasPriceUsd = await getGasPriceUsd(chain);
  const gasUnits = BigInt(quote.estimatedGas || "200000");

  return Number(gasUnits) * gasPriceUsd;
}

// Calculate net output value (output amount - gas cost)
function calculateNetValue(
  quote: DexQuote,
  outputTokenPriceUsd: number
): number {
  const outputAmount = BigInt(quote.outputAmount);
  const decimals = quote.outputToken.decimals || 18;

  // Convert output amount to USD
  const outputUsd =
    (Number(outputAmount) / Math.pow(10, decimals)) * outputTokenPriceUsd;

  // Subtract gas cost
  return outputUsd - quote.estimatedGasUsd;
}

export interface QuoteOptimizerOptions {
  // Output token price in USD (for comparing value)
  outputTokenPriceUsd?: number;
  // Minimum acceptable output (in smallest unit)
  minOutput?: string;
  // Maximum acceptable price impact (percentage)
  maxPriceImpact?: number;
  // Prefer specific aggregators
  preferredAggregators?: DexAggregator[];
  // Timeout for each quote request (ms)
  timeout?: number;
}

export class QuoteOptimizer {
  private defaultOptions: QuoteOptimizerOptions = {
    outputTokenPriceUsd: 1, // Assume stablecoin by default
    maxPriceImpact: 5, // 5% max price impact
    timeout: 10000, // 10 second timeout
  };

  /**
   * Get the best quote from all available aggregators
   */
  async getBestQuote(
    request: QuoteRequest,
    options: QuoteOptimizerOptions = {}
  ): Promise<QuoteComparison | null> {
    const opts = { ...this.defaultOptions, ...options };

    // Get available aggregators for this chain
    const availableAggregators = this.getAvailableAggregators(
      request.chain,
      request.excludeAggregators
    );

    if (availableAggregators.length === 0) {
      console.error(`No aggregators available for chain: ${request.chain}`);
      return null;
    }

    // Query all aggregators in parallel with timeout
    const quotePromises = availableAggregators.map((aggregator) =>
      this.getQuoteWithTimeout(aggregator, request, opts.timeout!)
    );

    const results = await Promise.allSettled(quotePromises);

    // Collect successful quotes
    const quotes: DexQuote[] = [];
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        quotes.push(result.value);
      }
    }

    if (quotes.length === 0) {
      console.error("No quotes received from any aggregator");
      return null;
    }

    // Calculate gas costs for all quotes
    await Promise.all(
      quotes.map(async (quote) => {
        quote.estimatedGasUsd = await calculateGasCostUsd(quote, request.chain);
      })
    );

    // Filter quotes by criteria
    const validQuotes = quotes.filter((quote) => {
      // Check minimum output
      if (opts.minOutput && BigInt(quote.outputAmount) < BigInt(opts.minOutput)) {
        return false;
      }

      // Check price impact
      if (opts.maxPriceImpact && quote.priceImpact > opts.maxPriceImpact) {
        return false;
      }

      return true;
    });

    if (validQuotes.length === 0) {
      console.warn("No quotes passed validation criteria");
      // Fall back to all quotes if none pass criteria
      if (quotes.length > 0) {
        validQuotes.push(...quotes);
      } else {
        return null;
      }
    }

    // Sort by net value (output - gas)
    const sortedQuotes = validQuotes.sort((a, b) => {
      const netA = calculateNetValue(a, opts.outputTokenPriceUsd!);
      const netB = calculateNetValue(b, opts.outputTokenPriceUsd!);
      return netB - netA; // Higher is better
    });

    const best = sortedQuotes[0];
    const worst = sortedQuotes[sortedQuotes.length - 1];

    // Calculate savings
    const bestNet = calculateNetValue(best, opts.outputTokenPriceUsd!);
    const worstNet = calculateNetValue(worst, opts.outputTokenPriceUsd!);
    const avgNet =
      sortedQuotes.reduce(
        (sum, q) => sum + calculateNetValue(q, opts.outputTokenPriceUsd!),
        0
      ) / sortedQuotes.length;

    return {
      best,
      all: sortedQuotes,
      savings: {
        vsWorst: bestNet - worstNet,
        vsAverage: bestNet - avgNet,
      },
    };
  }

  /**
   * Get quotes from specific aggregators only
   */
  async getQuotesFromAggregators(
    request: QuoteRequest,
    aggregatorNames: DexAggregator[]
  ): Promise<DexQuote[]> {
    const selectedAggregators = aggregators.filter(
      (a) => aggregatorNames.includes(a.name) && a.isAvailable(request.chain)
    );

    const quotePromises = selectedAggregators.map((aggregator) =>
      aggregator.getQuote(request).catch(() => null)
    );

    const results = await Promise.all(quotePromises);
    return results.filter((q): q is DexQuote => q !== null);
  }

  /**
   * Get a quote from the optimal aggregator for dust sweeping
   * Small amounts benefit from gasless solutions like CoW Protocol
   */
  async getDustQuote(
    request: QuoteRequest,
    amountUsd: number
  ): Promise<DexQuote | null> {
    // For very small amounts (<$5), prefer CoW Protocol (gasless)
    if (amountUsd < 5 && cowswapAggregator.isAvailable(request.chain)) {
      const cowQuote = await cowswapAggregator.getQuote(request);
      if (cowQuote) {
        return cowQuote;
      }
    }

    // For small amounts (<$20), prefer 1inch Fusion (gasless intent-based)
    if (amountUsd < 20 && oneInchAggregator.isAvailable(request.chain)) {
      const oneInchQuote = await oneInchAggregator.getQuote(request);
      if (oneInchQuote) {
        return oneInchQuote;
      }
    }

    // Fall back to best quote comparison
    const comparison = await this.getBestQuote(request);
    return comparison?.best || null;
  }

  private getAvailableAggregators(
    chain: SupportedChain,
    exclude?: DexAggregator[]
  ): IDexAggregator[] {
    return aggregators.filter((aggregator) => {
      if (!aggregator.isAvailable(chain)) {
        return false;
      }
      if (exclude?.includes(aggregator.name)) {
        return false;
      }
      return true;
    });
  }

  private async getQuoteWithTimeout(
    aggregator: IDexAggregator,
    request: QuoteRequest,
    timeoutMs: number
  ): Promise<DexQuote | null> {
    const timeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), timeoutMs)
    );

    const quotePromise = aggregator.getQuote(request).catch((error) => {
      console.error(`${aggregator.name} quote error:`, error);
      return null;
    });

    return Promise.race([quotePromise, timeoutPromise]);
  }
}

export const quoteOptimizer = new QuoteOptimizer();
