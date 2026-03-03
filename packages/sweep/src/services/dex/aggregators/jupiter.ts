import type { SupportedChain } from "../../../config/chains.js";
import {
  type DexQuote,
  type QuoteRequest,
  type IDexAggregator,
  SOL_NATIVE_MINT,
  DEFAULT_SLIPPAGE,
  DEFAULT_QUOTE_EXPIRY_SECONDS,
} from "../types.js";
import type { PriorityLevel } from "../../solana/priority-fees.js";

// ============================================================
// Jupiter API Configuration
// ============================================================

const JUPITER_API_BASE = "https://quote-api.jup.ag/v6";
const JUPITER_TOKENS_API = "https://tokens.jup.ag";
const JUPITER_PRICE_API = "https://price.jup.ag/v6";

// ============================================================
// Types
// ============================================================

interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  platformFee: null | {
    amount: string;
    feeBps: number;
  };
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  contextSlot: number;
  timeTaken: number;
}

interface JupiterSwapResponse {
  swapTransaction: string; // Base64 encoded versioned transaction
  lastValidBlockHeight: number;
  prioritizationFeeLamports?: number;
  computeUnitLimit?: number;
  prioritizationFeeLamportsEstimate?: {
    min: number;
    median: number;
    max: number;
  };
}

interface JupiterTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  daily_volume?: number;
}

export class JupiterAggregator implements IDexAggregator {
  name: "jupiter" = "jupiter";
  supportedChains: SupportedChain[] = ["solana"];

  // Cache for token info
  private tokenCache: Map<string, JupiterTokenInfo> = new Map();

  isAvailable(chain: SupportedChain): boolean {
    return chain === "solana";
  }

  async getQuote(request: QuoteRequest): Promise<DexQuote | null> {
    if (!this.isAvailable(request.chain)) {
      return null;
    }

    const slippage = request.slippage ?? DEFAULT_SLIPPAGE;
    const slippageBps = Math.floor(slippage * 100); // Convert percentage to basis points

    try {
      // Handle native SOL (use wrapped SOL mint)
      const inputMint = this.normalizeTokenAddress(request.inputToken);
      const outputMint = this.normalizeTokenAddress(request.outputToken);

      // Get quote from Jupiter
      const quoteResponse = await this.getJupiterQuote(
        inputMint,
        outputMint,
        request.inputAmount,
        slippageBps
      );

      if (!quoteResponse) {
        return null;
      }

      // Get token info for better response
      const [inputTokenInfo, outputTokenInfo] = await Promise.all([
        this.getTokenInfo(inputMint),
        this.getTokenInfo(outputMint),
      ]);

      const quote: DexQuote = {
        aggregator: "jupiter",
        inputToken: {
          address: quoteResponse.inputMint,
          symbol: inputTokenInfo?.symbol || "UNKNOWN",
          decimals: inputTokenInfo?.decimals || 9,
        },
        outputToken: {
          address: quoteResponse.outputMint,
          symbol: outputTokenInfo?.symbol || "UNKNOWN",
          decimals: outputTokenInfo?.decimals || 9,
        },
        inputAmount: quoteResponse.inAmount,
        outputAmount: quoteResponse.outAmount,
        priceImpact: parseFloat(quoteResponse.priceImpactPct) * 100, // Convert to percentage
        estimatedGas: "5000", // ~5000 lamports base fee on Solana
        estimatedGasUsd: 0.001, // Solana gas is very cheap
        slippage,
        expiresAt: Math.floor(Date.now() / 1000) + DEFAULT_QUOTE_EXPIRY_SECONDS,
        route: quoteResponse.routePlan,
        metadata: {
          quoteResponse,
          contextSlot: quoteResponse.contextSlot,
          otherAmountThreshold: quoteResponse.otherAmountThreshold,
        },
      };

      // Get swap transaction if requested
      if (request.includeCalldata) {
        const swapResponse = await this.getSwapTransaction(
          quoteResponse,
          request.userAddress
        );

        if (swapResponse) {
          quote.calldata = swapResponse.swapTransaction;
          quote.metadata = {
            ...quote.metadata,
            lastValidBlockHeight: swapResponse.lastValidBlockHeight,
            prioritizationFeeLamports: swapResponse.prioritizationFeeLamports,
            computeUnitLimit: swapResponse.computeUnitLimit,
          };
        }
      }

      return quote;
    } catch (error) {
      console.error("Jupiter quote error:", error);
      return null;
    }
  }

  private async getJupiterQuote(
    inputMint: string,
    outputMint: string,
    amount: string,
    slippageBps: number
  ): Promise<JupiterQuoteResponse | null> {
    const params = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps: slippageBps.toString(),
      onlyDirectRoutes: "false",
      asLegacyTransaction: "false",
      maxAccounts: "64", // Optimize for versioned transactions
    });

    const response = await fetch(`${JUPITER_API_BASE}/quote?${params}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Jupiter quote API error:", error);
      return null;
    }

    return (await response.json()) as JupiterQuoteResponse;
  }

  private async getSwapTransaction(
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string
  ): Promise<JupiterSwapResponse | null> {
    const response = await fetch(`${JUPITER_API_BASE}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true, // Auto wrap/unwrap SOL
        dynamicComputeUnitLimit: true, // Optimize compute units
        prioritizationFeeLamports: "auto", // Auto priority fee
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Jupiter swap API error:", error);
      return null;
    }

    return response.json();
  }

  private async getTokenInfo(mint: string): Promise<JupiterTokenInfo | null> {
    // Check cache first
    if (this.tokenCache.has(mint)) {
      return this.tokenCache.get(mint)!;
    }

    try {
      const response = await fetch(
        `https://tokens.jup.ag/token/${mint}`,
        {
          headers: {
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const tokenInfo = (await response.json()) as JupiterTokenInfo;
      this.tokenCache.set(mint, tokenInfo);
      return tokenInfo;
    } catch {
      return null;
    }
  }

  private normalizeTokenAddress(address: string): string {
    // Handle common Solana native token representations
    const lowerAddress = address.toLowerCase();
    if (
      lowerAddress === "sol" ||
      lowerAddress === "native" ||
      address === "11111111111111111111111111111111" // System program
    ) {
      return SOL_NATIVE_MINT;
    }
    return address;
  }

  async buildCalldata(quote: DexQuote): Promise<string> {
    if (quote.calldata) {
      return quote.calldata;
    }
    throw new Error(
      "Calldata not available - request quote with includeCalldata: true"
    );
  }

  // Helper to get all tradeable tokens on Jupiter
  async getTradableTokens(): Promise<JupiterTokenInfo[]> {
    try {
      const response = await fetch("https://tokens.jup.ag/tokens?tags=verified", {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        return [];
      }

      return (await response.json()) as JupiterTokenInfo[];
    } catch {
      return [];
    }
  }

  /**
   * Get quote with custom priority fee settings
   */
  async getQuoteWithPriority(
    request: QuoteRequest,
    priorityLevel: PriorityLevel = "medium"
  ): Promise<DexQuote | null> {
    const quote = await this.getQuote({
      ...request,
      includeCalldata: true,
    });

    if (!quote) return null;

    // Get swap transaction with priority fee
    const swapResponse = await this.getSwapTransactionWithPriority(
      quote.metadata?.quoteResponse,
      request.userAddress,
      priorityLevel
    );

    if (swapResponse) {
      quote.calldata = swapResponse.swapTransaction;
      quote.metadata = {
        ...quote.metadata,
        lastValidBlockHeight: swapResponse.lastValidBlockHeight,
        prioritizationFeeLamports: swapResponse.prioritizationFeeLamports,
        computeUnitLimit: swapResponse.computeUnitLimit,
        priorityLevel,
      };
    }

    return quote;
  }

  /**
   * Get swap transaction with custom priority fee
   */
  private async getSwapTransactionWithPriority(
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string,
    priorityLevel: PriorityLevel
  ): Promise<JupiterSwapResponse | null> {
    // Map priority level to Jupiter's priority settings
    const priorityConfig = this.getPriorityConfig(priorityLevel);

    const response = await fetch(`${JUPITER_API_BASE}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: priorityConfig,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Jupiter swap API error:", error);
      return null;
    }

    return (await response.json()) as JupiterSwapResponse;
  }

  /**
   * Get Jupiter priority fee configuration
   */
  private getPriorityConfig(level: PriorityLevel): object {
    const maxLamportsMap: Record<PriorityLevel, number> = {
      low: 100_000,       // 0.0001 SOL
      medium: 500_000,    // 0.0005 SOL
      high: 2_000_000,    // 0.002 SOL
      turbo: 10_000_000,  // 0.01 SOL
    };

    return {
      priorityLevelWithMaxLamports: {
        maxLamports: maxLamportsMap[level],
        priorityLevel: level === "turbo" ? "veryHigh" : level,
      },
    };
  }

  /**
   * Get swap instructions for custom transaction building
   */
  async getSwapInstructions(
    quoteResponse: JupiterQuoteResponse,
    userPublicKey: string,
    priorityLevel: PriorityLevel = "medium"
  ): Promise<JupiterSwapInstructionsResponse | null> {
    const priorityConfig = this.getPriorityConfig(priorityLevel);

    const response = await fetch(`${JUPITER_API_BASE}/swap-instructions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: priorityConfig,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Jupiter swap-instructions API error:", error);
      return null;
    }

    return (await response.json()) as JupiterSwapInstructionsResponse;
  }

  /**
   * Get token price from Jupiter Price API
   */
  async getTokenPrice(mint: string): Promise<number | null> {
    try {
      const response = await fetch(`${JUPITER_PRICE_API}/price?ids=${mint}`, {
        headers: { Accept: "application/json" },
      });

      if (!response.ok) return null;

      const data = await response.json() as {
        data: Record<string, { price: number }>;
      };

      return data.data[mint]?.price ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Get multiple token prices
   */
  async getTokenPrices(mints: string[]): Promise<Map<string, number>> {
    const prices = new Map<string, number>();

    try {
      // Batch in chunks of 100
      const chunkSize = 100;
      for (let i = 0; i < mints.length; i += chunkSize) {
        const chunk = mints.slice(i, i + chunkSize);
        const ids = chunk.join(",");

        const response = await fetch(`${JUPITER_PRICE_API}/price?ids=${ids}`, {
          headers: { Accept: "application/json" },
        });

        if (!response.ok) continue;

        const data = await response.json() as {
          data: Record<string, { price: number }>;
        };

        for (const [mint, info] of Object.entries(data.data)) {
          prices.set(mint, info.price);
        }
      }
    } catch (error) {
      console.error("Error fetching Jupiter prices:", error);
    }

    return prices;
  }

  /**
   * Check if a token is tradeable on Jupiter
   */
  async isTokenTradeable(mint: string): Promise<boolean> {
    try {
      const response = await fetch(`${JUPITER_TOKENS_API}/token/${mint}`, {
        headers: { Accept: "application/json" },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get best route for dust token swap
   */
  async getDustSwapQuote(
    inputMint: string,
    inputAmount: string,
    userAddress: string,
    outputMint: string = SOL_NATIVE_MINT
  ): Promise<DexQuote | null> {
    // Use higher slippage for dust swaps (small amounts)
    const slippage = 2.0; // 2% for dust

    return this.getQuoteWithPriority(
      {
        chain: "solana",
        inputToken: inputMint,
        outputToken: outputMint,
        inputAmount,
        slippage,
        userAddress,
        includeCalldata: true,
      },
      "medium"
    );
  }

  /**
   * Get quotes for multiple tokens (batch quotes)
   */
  async getBatchQuotes(
    tokens: Array<{ mint: string; amount: string }>,
    userAddress: string,
    outputMint: string = SOL_NATIVE_MINT
  ): Promise<Array<{ mint: string; quote: DexQuote | null; error?: string }>> {
    const results = await Promise.all(
      tokens.map(async ({ mint, amount }) => {
        try {
          const quote = await this.getDustSwapQuote(mint, amount, userAddress, outputMint);
          return { mint, quote };
        } catch (error) {
          return {
            mint,
            quote: null,
            error: error instanceof Error ? error.message : "Quote failed",
          };
        }
      })
    );

    return results;
  }
}

// ============================================================
// Types for swap instructions
// ============================================================

interface JupiterSwapInstructionsResponse {
  tokenLedgerInstruction?: JupiterInstruction;
  computeBudgetInstructions: JupiterInstruction[];
  setupInstructions: JupiterInstruction[];
  swapInstruction: JupiterInstruction;
  cleanupInstruction?: JupiterInstruction;
  otherInstructions: JupiterInstruction[];
  addressLookupTableAddresses: string[];
}

interface JupiterInstruction {
  programId: string;
  accounts: Array<{
    pubkey: string;
    isSigner: boolean;
    isWritable: boolean;
  }>;
  data: string;
}

export const jupiterAggregator = new JupiterAggregator();
