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
  WRAPPED_NATIVE_TOKEN,
} from "../types.js";

const ONEINCH_API_BASE = "https://api.1inch.dev";
const ONEINCH_FUSION_API = "https://api.1inch.dev/fusion";

interface OneInchSwapResponse {
  toAmount: string;
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gas: number;
    gasPrice: string;
  };
  protocols: Array<Array<Array<{
    name: string;
    part: number;
    fromTokenAddress: string;
    toTokenAddress: string;
  }>>>;
}

interface OneInchQuoteResponse {
  toAmount: string;
  gas: number;
  protocols: Array<Array<Array<{
    name: string;
    part: number;
    fromTokenAddress: string;
    toTokenAddress: string;
  }>>>;
}

interface OneInchTokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
}

export class OneInchAggregator implements IDexAggregator {
  name: "1inch" = "1inch";
  supportedChains: SupportedChain[] = [
    "ethereum",
    "base",
    "arbitrum",
    "polygon",
    "bsc",
    "linea",
    "optimism",
  ];

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ONEINCH_API_KEY || "";
    if (!this.apiKey) {
      console.warn("ONEINCH_API_KEY not set - 1inch quotes will fail");
    }
  }

  isAvailable(chain: SupportedChain): boolean {
    return this.supportedChains.includes(chain);
  }

  async getQuote(request: QuoteRequest): Promise<DexQuote | null> {
    if (!this.isAvailable(request.chain)) {
      return null;
    }

    const chainId = CHAIN_IDS[request.chain];
    const slippage = request.slippage ?? DEFAULT_SLIPPAGE;

    try {
      // Handle native token address
      const srcToken = isNativeToken(request.inputToken)
        ? NATIVE_TOKEN_ADDRESS
        : request.inputToken;
      const dstToken = isNativeToken(request.outputToken)
        ? NATIVE_TOKEN_ADDRESS
        : request.outputToken;

      if (request.includeCalldata) {
        // Get full swap data with calldata
        return await this.getSwapQuote(
          chainId,
          srcToken,
          dstToken,
          request.inputAmount,
          request.userAddress,
          slippage,
          request.receiver
        );
      } else {
        // Get quote only (faster)
        return await this.getQuoteOnly(
          chainId,
          srcToken,
          dstToken,
          request.inputAmount,
          slippage
        );
      }
    } catch (error) {
      console.error("1inch quote error:", error);
      return null;
    }
  }

  private async getQuoteOnly(
    chainId: number,
    srcToken: string,
    dstToken: string,
    amount: string,
    slippage: number
  ): Promise<DexQuote | null> {
    const params = new URLSearchParams({
      src: srcToken,
      dst: dstToken,
      amount: amount,
      includeGas: "true",
    });

    const response = await fetch(
      `${ONEINCH_API_BASE}/swap/v6.0/${chainId}/quote?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("1inch quote API error:", error);
      return null;
    }

    const data = (await response.json()) as OneInchQuoteResponse;

    // Get token info for the response
    const [srcTokenInfo, dstTokenInfo] = await Promise.all([
      this.getTokenInfo(chainId, srcToken),
      this.getTokenInfo(chainId, dstToken),
    ]);

    return {
      aggregator: "1inch",
      inputToken: srcTokenInfo || {
        address: srcToken,
        symbol: "UNKNOWN",
        decimals: 18,
      },
      outputToken: dstTokenInfo || {
        address: dstToken,
        symbol: "UNKNOWN",
        decimals: 18,
      },
      inputAmount: amount,
      outputAmount: data.toAmount,
      priceImpact: 0, // 1inch doesn't return price impact in quote
      estimatedGas: data.gas.toString(),
      estimatedGasUsd: 0, // Will be calculated by optimizer
      slippage,
      expiresAt: Math.floor(Date.now() / 1000) + DEFAULT_QUOTE_EXPIRY_SECONDS,
      route: data.protocols,
    };
  }

  private async getSwapQuote(
    chainId: number,
    srcToken: string,
    dstToken: string,
    amount: string,
    fromAddress: string,
    slippage: number,
    receiver?: string
  ): Promise<DexQuote | null> {
    const params = new URLSearchParams({
      src: srcToken,
      dst: dstToken,
      amount: amount,
      from: fromAddress,
      slippage: slippage.toString(),
      includeGas: "true",
      disableEstimate: "true", // Skip estimation for speed
    });

    if (receiver && receiver !== fromAddress) {
      params.set("receiver", receiver);
    }

    const response = await fetch(
      `${ONEINCH_API_BASE}/swap/v6.0/${chainId}/swap?${params}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("1inch swap API error:", error);
      return null;
    }

    const data = (await response.json()) as OneInchSwapResponse;

    // Get token info
    const [srcTokenInfo, dstTokenInfo] = await Promise.all([
      this.getTokenInfo(chainId, srcToken),
      this.getTokenInfo(chainId, dstToken),
    ]);

    return {
      aggregator: "1inch",
      inputToken: srcTokenInfo || {
        address: srcToken,
        symbol: "UNKNOWN",
        decimals: 18,
      },
      outputToken: dstTokenInfo || {
        address: dstToken,
        symbol: "UNKNOWN",
        decimals: 18,
      },
      inputAmount: amount,
      outputAmount: data.toAmount,
      priceImpact: 0,
      estimatedGas: data.tx.gas.toString(),
      estimatedGasUsd: 0,
      calldata: data.tx.data,
      to: data.tx.to,
      value: data.tx.value,
      allowanceTarget: data.tx.to, // 1inch router
      slippage,
      expiresAt: Math.floor(Date.now() / 1000) + DEFAULT_QUOTE_EXPIRY_SECONDS,
      route: data.protocols,
    };
  }

  private async getTokenInfo(
    chainId: number,
    address: string
  ): Promise<{ address: string; symbol: string; decimals: number } | null> {
    try {
      // Handle native token
      if (isNativeToken(address)) {
        const nativeSymbols: Record<number, string> = {
          1: "ETH",
          8453: "ETH",
          42161: "ETH",
          137: "MATIC",
          56: "BNB",
          59144: "ETH",
          10: "ETH",
        };
        return {
          address: NATIVE_TOKEN_ADDRESS,
          symbol: nativeSymbols[chainId] || "ETH",
          decimals: 18,
        };
      }

      const response = await fetch(
        `${ONEINCH_API_BASE}/token/v1.2/${chainId}/custom/${address}`,
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OneInchTokenInfo;
      return {
        address: data.address,
        symbol: data.symbol,
        decimals: data.decimals,
      };
    } catch {
      return null;
    }
  }

  async buildCalldata(quote: DexQuote): Promise<string> {
    if (quote.calldata) {
      return quote.calldata;
    }
    throw new Error("Calldata not available - request quote with includeCalldata: true");
  }
}

export const oneInchAggregator = new OneInchAggregator();
