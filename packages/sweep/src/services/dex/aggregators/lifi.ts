import type { SupportedChain } from "../../../config/chains.js";
import {
  type DexQuote,
  type QuoteRequest,
  type CrossChainQuoteRequest,
  type IDexAggregator,
  CHAIN_IDS,
  NATIVE_TOKEN_ADDRESS,
  DEFAULT_SLIPPAGE,
  DEFAULT_QUOTE_EXPIRY_SECONDS,
  isNativeToken,
} from "../types.js";

const LIFI_API_BASE = "https://li.quest/v1";

interface LiFiQuoteResponse {
  id: string;
  type: string;
  tool: string;
  toolDetails: {
    key: string;
    name: string;
    logoURI: string;
  };
  action: {
    fromToken: LiFiToken;
    fromAmount: string;
    toToken: LiFiToken;
    fromChainId: number;
    toChainId: number;
    slippage: number;
    fromAddress: string;
    toAddress: string;
  };
  estimate: {
    tool: string;
    approvalAddress: string;
    toAmountMin: string;
    toAmount: string;
    fromAmount: string;
    feeCosts: Array<{
      name: string;
      description: string;
      token: LiFiToken;
      amount: string;
      amountUSD: string;
      percentage: string;
      included: boolean;
    }>;
    gasCosts: Array<{
      type: string;
      price: string;
      estimate: string;
      limit: string;
      amount: string;
      amountUSD: string;
      token: LiFiToken;
    }>;
    executionDuration: number;
    fromAmountUSD: string;
    toAmountUSD: string;
  };
  includedSteps: Array<{
    id: string;
    type: string;
    action: {
      fromChainId: number;
      fromAmount: string;
      fromToken: LiFiToken;
      toChainId: number;
      toToken: LiFiToken;
      slippage: number;
    };
    estimate: {
      tool: string;
      fromAmount: string;
      toAmount: string;
      toAmountMin: string;
      approvalAddress: string;
      executionDuration: number;
    };
  }>;
  transactionRequest?: {
    from: string;
    to: string;
    chainId: number;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice: string;
  };
}

interface LiFiToken {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  name: string;
  priceUSD: string;
  logoURI?: string;
}

interface LiFiRoutesResponse {
  routes: LiFiQuoteResponse[];
}

export class LiFiAggregator implements IDexAggregator {
  name: "lifi" = "lifi";
  supportedChains: SupportedChain[] = [
    "ethereum",
    "base",
    "arbitrum",
    "polygon",
    "bsc",
    "linea",
    "optimism",
  ];

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
      const fromToken = isNativeToken(request.inputToken)
        ? NATIVE_TOKEN_ADDRESS
        : request.inputToken;
      const toToken = isNativeToken(request.outputToken)
        ? NATIVE_TOKEN_ADDRESS
        : request.outputToken;

      // For same-chain swaps, use the quote endpoint
      const quoteResponse = await this.getLiFiQuote({
        fromChain: chainId,
        toChain: chainId, // Same chain
        fromToken,
        toToken,
        fromAmount: request.inputAmount,
        fromAddress: request.userAddress,
        toAddress: request.receiver || request.userAddress,
        slippage,
        includeCalldata: request.includeCalldata,
      });

      return quoteResponse;
    } catch (error) {
      console.error("Li.Fi quote error:", error);
      return null;
    }
  }

  // Cross-chain quote
  async getCrossChainQuote(
    request: CrossChainQuoteRequest
  ): Promise<DexQuote | null> {
    if (!this.isAvailable(request.chain)) {
      return null;
    }

    const fromChainId = CHAIN_IDS[request.chain];
    const toChainId = CHAIN_IDS[request.destinationChain];
    const slippage = request.slippage ?? DEFAULT_SLIPPAGE;

    try {
      const fromToken = isNativeToken(request.inputToken)
        ? NATIVE_TOKEN_ADDRESS
        : request.inputToken;
      const toToken = request.destinationToken
        ? isNativeToken(request.destinationToken)
          ? NATIVE_TOKEN_ADDRESS
          : request.destinationToken
        : isNativeToken(request.outputToken)
          ? NATIVE_TOKEN_ADDRESS
          : request.outputToken;

      return await this.getLiFiQuote({
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken,
        toToken,
        fromAmount: request.inputAmount,
        fromAddress: request.userAddress,
        toAddress: request.receiver || request.userAddress,
        slippage,
        includeCalldata: request.includeCalldata,
      });
    } catch (error) {
      console.error("Li.Fi cross-chain quote error:", error);
      return null;
    }
  }

  private async getLiFiQuote(params: {
    fromChain: number;
    toChain: number;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    fromAddress: string;
    toAddress: string;
    slippage: number;
    includeCalldata?: boolean;
  }): Promise<DexQuote | null> {
    const queryParams = new URLSearchParams({
      fromChain: params.fromChain.toString(),
      toChain: params.toChain.toString(),
      fromToken: params.fromToken,
      toToken: params.toToken,
      fromAmount: params.fromAmount,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      slippage: (params.slippage / 100).toString(), // Li.Fi expects decimal (0.005 = 0.5%)
      integrator: "sweep",
      order: "RECOMMENDED", // or FASTEST, CHEAPEST
      allowBridges: "across,stargate,hop,cbridge,hyphen",
    });

    const response = await fetch(`${LIFI_API_BASE}/quote?${queryParams}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Li.Fi quote API error:", error);
      return null;
    }

    const data = (await response.json()) as LiFiQuoteResponse;

    // Calculate total gas cost in USD
    const totalGasUsd = data.estimate.gasCosts.reduce(
      (sum, cost) => sum + parseFloat(cost.amountUSD),
      0
    );

    // Calculate total fee cost
    const totalFeeUsd = data.estimate.feeCosts.reduce(
      (sum, cost) => sum + parseFloat(cost.amountUSD),
      0
    );

    // Calculate price impact from USD values
    const fromAmountUsd = parseFloat(data.estimate.fromAmountUSD);
    const toAmountUsd = parseFloat(data.estimate.toAmountUSD);
    const priceImpact =
      fromAmountUsd > 0
        ? ((fromAmountUsd - toAmountUsd - totalGasUsd - totalFeeUsd) /
            fromAmountUsd) *
          100
        : 0;

    const quote: DexQuote = {
      aggregator: "lifi",
      inputToken: {
        address: data.action.fromToken.address,
        symbol: data.action.fromToken.symbol,
        decimals: data.action.fromToken.decimals,
        chainId: data.action.fromToken.chainId,
      },
      outputToken: {
        address: data.action.toToken.address,
        symbol: data.action.toToken.symbol,
        decimals: data.action.toToken.decimals,
        chainId: data.action.toToken.chainId,
      },
      inputAmount: data.action.fromAmount,
      outputAmount: data.estimate.toAmount,
      priceImpact: Math.max(0, priceImpact),
      estimatedGas: data.estimate.gasCosts[0]?.estimate || "0",
      estimatedGasUsd: totalGasUsd,
      allowanceTarget: data.estimate.approvalAddress,
      slippage: params.slippage,
      expiresAt: Math.floor(Date.now() / 1000) + DEFAULT_QUOTE_EXPIRY_SECONDS,
      route: data.includedSteps,
      metadata: {
        quoteId: data.id,
        tool: data.tool,
        toolDetails: data.toolDetails,
        executionDuration: data.estimate.executionDuration,
        toAmountMin: data.estimate.toAmountMin,
        feeCosts: data.estimate.feeCosts,
        fromAmountUSD: data.estimate.fromAmountUSD,
        toAmountUSD: data.estimate.toAmountUSD,
        isCrossChain: params.fromChain !== params.toChain,
      },
    };

    // Add transaction data if available
    if (data.transactionRequest) {
      quote.calldata = data.transactionRequest.data;
      quote.to = data.transactionRequest.to;
      quote.value = data.transactionRequest.value;
    }

    return quote;
  }

  // Get available routes (for showing options to user)
  async getRoutes(params: {
    fromChain: number;
    toChain: number;
    fromToken: string;
    toToken: string;
    fromAmount: string;
    fromAddress: string;
    toAddress: string;
  }): Promise<LiFiQuoteResponse[]> {
    const queryParams = new URLSearchParams({
      fromChainId: params.fromChain.toString(),
      toChainId: params.toChain.toString(),
      fromTokenAddress: params.fromToken,
      toTokenAddress: params.toToken,
      fromAmount: params.fromAmount,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      options: JSON.stringify({
        slippage: 0.005,
        integrator: "sweep",
        order: "RECOMMENDED",
      }),
    });

    const response = await fetch(`${LIFI_API_BASE}/routes?${queryParams}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return [];
    }

    const data = (await response.json()) as LiFiRoutesResponse;
    return data.routes;
  }

  // Get transaction status
  async getStatus(
    txHash: string,
    fromChain: number,
    toChain: number
  ): Promise<{
    status: "PENDING" | "DONE" | "FAILED" | "NOT_FOUND";
    substatus?: string;
    receiving?: {
      txHash?: string;
      amount?: string;
    };
  }> {
    const params = new URLSearchParams({
      txHash,
      fromChain: fromChain.toString(),
      toChain: toChain.toString(),
    });

    const response = await fetch(`${LIFI_API_BASE}/status?${params}`);

    if (!response.ok) {
      return { status: "NOT_FOUND" };
    }

    return (await response.json()) as {
      status: "PENDING" | "DONE" | "FAILED" | "NOT_FOUND";
      substatus?: string;
      receiving?: {
        txHash?: string;
        amount?: string;
      };
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

export const lifiAggregator = new LiFiAggregator();
