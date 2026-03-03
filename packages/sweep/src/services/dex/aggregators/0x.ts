import type { SupportedChain } from "../../../config/chains.js";
import {
  type DexQuote,
  type QuoteRequest,
  type IDexAggregator,
  CHAIN_IDS,
  NATIVE_TOKEN_ADDRESS,
  DEFAULT_SLIPPAGE,
  DEFAULT_QUOTE_EXPIRY_SECONDS,
  isNativeToken,
} from "../types.js";

// 0x API endpoints per chain
const ZEROX_API_ENDPOINTS: Record<number, string> = {
  1: "https://api.0x.org",
  8453: "https://base.api.0x.org",
  42161: "https://arbitrum.api.0x.org",
  137: "https://polygon.api.0x.org",
  56: "https://bsc.api.0x.org",
  10: "https://optimism.api.0x.org",
  59144: "https://linea.api.0x.org",
};

interface ZeroXQuoteResponse {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  grossBuyAmount: string;
  estimatedGas: string;
  gas: string;
  gasPrice: string;
  protocolFee: string;
  minimumProtocolFee: string;
  allowanceTarget: string;
  price: string;
  guaranteedPrice: string;
  to: string;
  data: string;
  value: string;
  sources: Array<{
    name: string;
    proportion: string;
  }>;
  orders: Array<{
    type: number;
    source: string;
    makerToken: string;
    takerToken: string;
    makerAmount: string;
    takerAmount: string;
    fillData: any;
    fill: {
      input: string;
      output: string;
      adjustedOutput: string;
      gas: number;
    };
  }>;
  estimatedPriceImpact?: string;
}

interface ZeroXPriceResponse {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  grossBuyAmount: string;
  estimatedGas: string;
  gas: string;
  gasPrice: string;
  allowanceTarget: string;
  price: string;
  sources: Array<{
    name: string;
    proportion: string;
  }>;
  estimatedPriceImpact?: string;
}

export class ZeroXAggregator implements IDexAggregator {
  name: "0x" = "0x";
  supportedChains: SupportedChain[] = [
    "ethereum",
    "base",
    "arbitrum",
    "polygon",
    "bsc",
    "optimism",
    "linea",
  ];

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ZEROX_API_KEY || "";
    if (!this.apiKey) {
      console.warn("ZEROX_API_KEY not set - 0x quotes will fail");
    }
  }

  isAvailable(chain: SupportedChain): boolean {
    return this.supportedChains.includes(chain);
  }

  private getApiEndpoint(chainId: number): string | null {
    return ZEROX_API_ENDPOINTS[chainId] || null;
  }

  async getQuote(request: QuoteRequest): Promise<DexQuote | null> {
    if (!this.isAvailable(request.chain)) {
      return null;
    }

    const chainId = CHAIN_IDS[request.chain];
    const apiEndpoint = this.getApiEndpoint(chainId);

    if (!apiEndpoint) {
      return null;
    }

    const slippage = request.slippage ?? DEFAULT_SLIPPAGE;

    try {
      // Handle native token address
      const sellToken = isNativeToken(request.inputToken)
        ? NATIVE_TOKEN_ADDRESS
        : request.inputToken;
      const buyToken = isNativeToken(request.outputToken)
        ? NATIVE_TOKEN_ADDRESS
        : request.outputToken;

      if (request.includeCalldata) {
        return await this.getSwapQuote(
          apiEndpoint,
          sellToken,
          buyToken,
          request.inputAmount,
          request.userAddress,
          slippage
        );
      } else {
        return await this.getPriceQuote(
          apiEndpoint,
          sellToken,
          buyToken,
          request.inputAmount,
          slippage
        );
      }
    } catch (error) {
      console.error("0x quote error:", error);
      return null;
    }
  }

  private async getPriceQuote(
    apiEndpoint: string,
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    slippage: number
  ): Promise<DexQuote | null> {
    const params = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      slippagePercentage: (slippage / 100).toString(),
    });

    const response = await fetch(`${apiEndpoint}/swap/v1/price?${params}`, {
      headers: {
        "0x-api-key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("0x price API error:", error);
      return null;
    }

    const data = (await response.json()) as ZeroXPriceResponse;

    return {
      aggregator: "0x",
      inputToken: {
        address: data.sellToken,
        symbol: "UNKNOWN",
        decimals: 18, // 0x doesn't return decimals
      },
      outputToken: {
        address: data.buyToken,
        symbol: "UNKNOWN",
        decimals: 18,
      },
      inputAmount: data.sellAmount,
      outputAmount: data.buyAmount,
      priceImpact: data.estimatedPriceImpact
        ? parseFloat(data.estimatedPriceImpact) * 100
        : 0,
      estimatedGas: data.estimatedGas || data.gas,
      estimatedGasUsd: 0, // Will be calculated by optimizer
      allowanceTarget: data.allowanceTarget,
      slippage,
      expiresAt: Math.floor(Date.now() / 1000) + DEFAULT_QUOTE_EXPIRY_SECONDS,
      route: data.sources.filter((s) => parseFloat(s.proportion) > 0),
    };
  }

  private async getSwapQuote(
    apiEndpoint: string,
    sellToken: string,
    buyToken: string,
    sellAmount: string,
    takerAddress: string,
    slippage: number
  ): Promise<DexQuote | null> {
    const params = new URLSearchParams({
      sellToken,
      buyToken,
      sellAmount,
      takerAddress,
      slippagePercentage: (slippage / 100).toString(),
      skipValidation: "true", // Skip on-chain validation for speed
    });

    const response = await fetch(`${apiEndpoint}/swap/v1/quote?${params}`, {
      headers: {
        "0x-api-key": this.apiKey,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("0x quote API error:", error);
      return null;
    }

    const data = (await response.json()) as ZeroXQuoteResponse;

    return {
      aggregator: "0x",
      inputToken: {
        address: data.sellToken,
        symbol: "UNKNOWN",
        decimals: 18,
      },
      outputToken: {
        address: data.buyToken,
        symbol: "UNKNOWN",
        decimals: 18,
      },
      inputAmount: data.sellAmount,
      outputAmount: data.buyAmount,
      priceImpact: data.estimatedPriceImpact
        ? parseFloat(data.estimatedPriceImpact) * 100
        : 0,
      estimatedGas: data.estimatedGas || data.gas,
      estimatedGasUsd: 0,
      calldata: data.data,
      to: data.to,
      value: data.value,
      allowanceTarget: data.allowanceTarget,
      slippage,
      expiresAt: Math.floor(Date.now() / 1000) + DEFAULT_QUOTE_EXPIRY_SECONDS,
      route: data.sources.filter((s) => parseFloat(s.proportion) > 0),
      metadata: {
        orders: data.orders,
        guaranteedPrice: data.guaranteedPrice,
      },
    };
  }

  async buildCalldata(quote: DexQuote): Promise<string> {
    if (quote.calldata) {
      return quote.calldata;
    }
    throw new Error(
      "Calldata not available - request quote with includeCalldata: true"
    );
  }
}

export const zeroXAggregator = new ZeroXAggregator();
