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

const PARASWAP_API_BASE = "https://apiv5.paraswap.io";

interface ParaSwapPriceResponse {
  priceRoute: {
    srcToken: string;
    srcDecimals: number;
    destToken: string;
    destDecimals: number;
    srcAmount: string;
    destAmount: string;
    gasCost: string;
    gasCostUSD: string;
    side: string;
    tokenTransferProxy: string;
    contractAddress: string;
    bestRoute: Array<{
      percent: number;
      swaps: Array<{
        srcToken: string;
        destToken: string;
        swapExchanges: Array<{
          exchange: string;
          srcAmount: string;
          destAmount: string;
          percent: number;
        }>;
      }>;
    }>;
    priceImpact?: string;
  };
}

interface ParaSwapTransactionResponse {
  from: string;
  to: string;
  value: string;
  data: string;
  chainId: number;
  gas?: string;
}

export class ParaSwapAggregator implements IDexAggregator {
  name: "paraswap" = "paraswap";
  supportedChains: SupportedChain[] = [
    "ethereum",
    "base",
    "arbitrum",
    "polygon",
    "bsc",
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
      const srcToken = isNativeToken(request.inputToken)
        ? NATIVE_TOKEN_ADDRESS
        : request.inputToken;
      const destToken = isNativeToken(request.outputToken)
        ? NATIVE_TOKEN_ADDRESS
        : request.outputToken;

      // Get price quote
      const priceResponse = await this.getPriceQuote(
        chainId,
        srcToken,
        destToken,
        request.inputAmount
      );

      if (!priceResponse) {
        return null;
      }

      const quote: DexQuote = {
        aggregator: "paraswap",
        inputToken: {
          address: priceResponse.priceRoute.srcToken,
          symbol: "UNKNOWN", // ParaSwap doesn't return symbol in price
          decimals: priceResponse.priceRoute.srcDecimals,
        },
        outputToken: {
          address: priceResponse.priceRoute.destToken,
          symbol: "UNKNOWN",
          decimals: priceResponse.priceRoute.destDecimals,
        },
        inputAmount: priceResponse.priceRoute.srcAmount,
        outputAmount: priceResponse.priceRoute.destAmount,
        priceImpact: priceResponse.priceRoute.priceImpact
          ? parseFloat(priceResponse.priceRoute.priceImpact)
          : 0,
        estimatedGas: priceResponse.priceRoute.gasCost,
        estimatedGasUsd: parseFloat(priceResponse.priceRoute.gasCostUSD || "0"),
        allowanceTarget: priceResponse.priceRoute.tokenTransferProxy,
        slippage,
        expiresAt: Math.floor(Date.now() / 1000) + DEFAULT_QUOTE_EXPIRY_SECONDS,
        route: priceResponse.priceRoute.bestRoute,
        metadata: {
          priceRoute: priceResponse.priceRoute,
        },
      };

      // Get transaction data if requested
      if (request.includeCalldata) {
        const txData = await this.buildTransaction(
          chainId,
          priceResponse.priceRoute,
          request.userAddress,
          slippage,
          request.receiver
        );

        if (txData) {
          quote.calldata = txData.data;
          quote.to = txData.to;
          quote.value = txData.value;
          if (txData.gas) {
            quote.estimatedGas = txData.gas;
          }
        }
      }

      return quote;
    } catch (error) {
      console.error("ParaSwap quote error:", error);
      return null;
    }
  }

  private async getPriceQuote(
    chainId: number,
    srcToken: string,
    destToken: string,
    srcAmount: string
  ): Promise<ParaSwapPriceResponse | null> {
    const params = new URLSearchParams({
      srcToken,
      destToken,
      srcDecimals: "18", // Will be corrected by API
      destDecimals: "18",
      amount: srcAmount,
      side: "SELL",
      network: chainId.toString(),
      excludeDEXS: "", // Include all DEXs
    });

    const response = await fetch(`${PARASWAP_API_BASE}/prices?${params}`, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("ParaSwap price API error:", error);
      return null;
    }

    return (await response.json()) as ParaSwapPriceResponse;
  }

  private async buildTransaction(
    chainId: number,
    priceRoute: ParaSwapPriceResponse["priceRoute"],
    userAddress: string,
    slippage: number,
    receiver?: string
  ): Promise<ParaSwapTransactionResponse | null> {
    // Calculate minimum destination amount with slippage
    const destAmountBigInt = BigInt(priceRoute.destAmount);
    const slippageMultiplier = BigInt(Math.floor((100 - slippage) * 100));
    const minDestAmount = (destAmountBigInt * slippageMultiplier) / 10000n;

    const body = {
      srcToken: priceRoute.srcToken,
      destToken: priceRoute.destToken,
      srcAmount: priceRoute.srcAmount,
      destAmount: minDestAmount.toString(),
      priceRoute,
      userAddress,
      receiver: receiver || userAddress,
      partner: "sweep",
      srcDecimals: priceRoute.srcDecimals,
      destDecimals: priceRoute.destDecimals,
    };

    const response = await fetch(
      `${PARASWAP_API_BASE}/transactions/${chainId}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("ParaSwap transaction API error:", error);
      return null;
    }

    return (await response.json()) as ParaSwapTransactionResponse;
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

export const paraswapAggregator = new ParaSwapAggregator();
