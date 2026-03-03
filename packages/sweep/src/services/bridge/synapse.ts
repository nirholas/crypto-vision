/**
 * Synapse Protocol Integration
 * Cross-chain bridging via Synapse's liquidity pools and messaging
 * https://synapseprotocol.com/
 */

import { encodeFunctionData, parseAbi } from "viem";
import { cacheGet, cacheSet } from "../../utils/redis.js";
import type { SupportedChain } from "../../config/chains.js";
import {
  BridgeProvider,
  BridgeStatus,
  BRIDGE_CONFIG,
  type BridgeQuote,
  type BridgeQuoteRequest,
  type BridgeTransaction,
  type BridgeReceipt,
  type IBridgeProvider,
} from "./types.js";

/**
 * Synapse API response types
 */
interface SynapseBridgeQuoteResponse {
  routerAddress: string;
  maxAmountOut: {
    type: string;
    hex: string;
  };
  originQuery: {
    swapAdapter: string;
    tokenOut: string;
    minAmountOut: string;
    deadline: string;
    rawParams: string;
  };
  destQuery: {
    swapAdapter: string;
    tokenOut: string;
    minAmountOut: string;
    deadline: string;
    rawParams: string;
  };
  estimatedTime: number;
  bridgeModuleName: string;
  gasDropAmount?: string;
}

interface SynapseTxStatusResponse {
  status: boolean;
  toInfo?: {
    chainID: number;
    address: string;
    txnHash: string;
    value: string;
    formattedValue: number;
    tokenAddress: string;
    tokenSymbol: string;
  };
  fromInfo?: {
    chainID: number;
    address: string;
    txnHash: string;
    value: string;
    formattedValue: number;
    tokenAddress: string;
    tokenSymbol: string;
  };
}

/**
 * Synapse Router addresses per chain
 */
const SYNAPSE_ROUTER_ADDRESSES: Partial<Record<SupportedChain, `0x${string}`>> = {
  ethereum: "0x2796317b0fF8538F253012862c06787Adfb8cEb6",
  arbitrum: "0x2796317b0fF8538F253012862c06787Adfb8cEb6",
  optimism: "0x2796317b0fF8538F253012862c06787Adfb8cEb6",
  polygon: "0x2796317b0fF8538F253012862c06787Adfb8cEb6",
  base: "0x2796317b0fF8538F253012862c06787Adfb8cEb6",
  bsc: "0x2796317b0fF8538F253012862c06787Adfb8cEb6",
};

/**
 * Chain IDs for Synapse
 */
const SYNAPSE_CHAIN_IDS: Partial<Record<SupportedChain, number>> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
  base: 8453,
  bsc: 56,
};

/**
 * Synapse Router ABI (partial)
 */
const SYNAPSE_ROUTER_ABI = parseAbi([
  "function bridge(address to, uint256 chainId, address token, uint256 amount, tuple(address swapAdapter, address tokenOut, uint256 minAmountOut, uint256 deadline, bytes rawParams) originQuery, tuple(address swapAdapter, address tokenOut, uint256 minAmountOut, uint256 deadline, bytes rawParams) destQuery) payable",
]);

/**
 * Synapse Protocol bridge provider
 */
export class SynapseBridgeProvider implements IBridgeProvider {
  readonly name = BridgeProvider.SYNAPSE;

  private readonly apiUrl: string;
  private readonly cachePrefix = "synapse";

  constructor(apiUrl: string = "https://api.synapseprotocol.com") {
    this.apiUrl = apiUrl;
  }

  /**
   * Check if Synapse supports a route
   */
  async supportsRoute(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    _token: `0x${string}`
  ): Promise<boolean> {
    // Check if both chains are supported
    if (!SYNAPSE_CHAIN_IDS[sourceChain] || !SYNAPSE_CHAIN_IDS[destinationChain]) {
      return false;
    }

    // Same chain bridging is not supported
    if (sourceChain === destinationChain) {
      return false;
    }

    // Check if router exists on both chains
    if (!SYNAPSE_ROUTER_ADDRESSES[sourceChain] || !SYNAPSE_ROUTER_ADDRESSES[destinationChain]) {
      return false;
    }

    return true;
  }

  /**
   * Get quote for bridging via Synapse
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote | null> {
    const sourceChainId = SYNAPSE_CHAIN_IDS[request.sourceChain];
    const destChainId = SYNAPSE_CHAIN_IDS[request.destinationChain];

    if (!sourceChainId || !destChainId) {
      return null;
    }

    const routerAddress = SYNAPSE_ROUTER_ADDRESSES[request.sourceChain];
    if (!routerAddress) {
      return null;
    }

    try {
      // Fetch quote from Synapse API
      const url = new URL(`${this.apiUrl}/bridge`);
      url.searchParams.set("fromChain", sourceChainId.toString());
      url.searchParams.set("toChain", destChainId.toString());
      url.searchParams.set("fromToken", request.sourceToken);
      url.searchParams.set("toToken", request.destinationToken);
      url.searchParams.set("amount", request.amount.toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Synapse] Quote request failed: ${response.status} - ${errorText}`);
        return null;
      }

      const quoteData = (await response.json()) as SynapseBridgeQuoteResponse;

      // Calculate output amount
      const outputAmount = BigInt(quoteData.maxAmountOut.hex);
      const slippage = request.slippage ?? BRIDGE_CONFIG.DEFAULT_SLIPPAGE;
      const minOutputAmount = outputAmount - (outputAmount * BigInt(Math.floor(slippage * 10000)) / 10000n);

      // Estimate fees (difference between input and output)
      const bridgeFee = request.amount > outputAmount ? request.amount - outputAmount : 0n;

      const quoteId = `synapse-${request.sourceChain}-${request.destinationChain}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const tokenSymbol = await this.getTokenSymbol(request.sourceToken, request.sourceChain);

      const quote: BridgeQuote = {
        provider: BridgeProvider.SYNAPSE,
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        sourceToken: {
          address: request.sourceToken,
          symbol: tokenSymbol || "UNKNOWN",
          decimals: this.getTokenDecimals(tokenSymbol || ""),
          chain: request.sourceChain,
        },
        destinationToken: {
          address: request.destinationToken,
          symbol: tokenSymbol || "UNKNOWN",
          decimals: this.getTokenDecimals(tokenSymbol || ""),
          chain: request.destinationChain,
        },
        inputAmount: request.amount,
        outputAmount,
        minOutputAmount,
        fees: {
          bridgeFee,
          gasFee: 0n,
          relayerFee: 0n,
          totalFeeUsd: 0, // Would need price conversion
        },
        feeUsd: 0,
        estimatedTime: quoteData.estimatedTime || 300, // ~5 minutes typical for Synapse
        route: {
          steps: [
            {
              type: "bridge",
              chain: request.sourceChain,
              protocol: "Synapse Protocol",
              fromToken: request.sourceToken,
              toToken: request.destinationToken,
              fromAmount: request.amount.toString(),
              toAmount: outputAmount.toString(),
              amount: request.amount,
              expectedOutput: outputAmount,
            },
          ],
          totalGasEstimate: 300000n,
          requiresApproval: !this.isNativeToken(request.sourceToken),
          approvalAddress: routerAddress,
        },
        expiresAt: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
        expiry: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
        quoteId,
        maxSlippage: slippage,
      };

      // Cache the quote data for transaction building
      await cacheSet(
        `${this.cachePrefix}:quote:${quoteId}`,
        {
          quote,
          quoteData,
          request,
          routerAddress,
        },
        BRIDGE_CONFIG.QUOTE_TTL_SECONDS
      );

      return quote;
    } catch (error) {
      console.error("[Synapse] Error getting quote:", error);
      return null;
    }
  }

  /**
   * Build bridge transaction
   */
  async buildTransaction(quote: BridgeQuote): Promise<BridgeTransaction> {
    // Get cached quote data
    const cached = await cacheGet<{
      quote: BridgeQuote;
      quoteData: SynapseBridgeQuoteResponse;
      request: BridgeQuoteRequest;
      routerAddress: `0x${string}`;
    }>(`${this.cachePrefix}:quote:${quote.quoteId}`);

    if (!cached) {
      throw new Error("Quote expired or not found");
    }

    const { quoteData, request, routerAddress } = cached;

    const destinationChainId = SYNAPSE_CHAIN_IDS[quote.destinationChain];
    if (!destinationChainId) {
      throw new Error(`Unsupported destination chain ${quote.destinationChain}`);
    }

    const isNative = this.isNativeToken(request.sourceToken);

    // Encode the bridge call using Synapse Router
    const originQuery = {
      swapAdapter: quoteData.originQuery.swapAdapter as `0x${string}`,
      tokenOut: quoteData.originQuery.tokenOut as `0x${string}`,
      minAmountOut: BigInt(quoteData.originQuery.minAmountOut),
      deadline: BigInt(quoteData.originQuery.deadline),
      rawParams: quoteData.originQuery.rawParams as `0x${string}`,
    };

    const destQuery = {
      swapAdapter: quoteData.destQuery.swapAdapter as `0x${string}`,
      tokenOut: quoteData.destQuery.tokenOut as `0x${string}`,
      minAmountOut: BigInt(quoteData.destQuery.minAmountOut),
      deadline: BigInt(quoteData.destQuery.deadline),
      rawParams: quoteData.destQuery.rawParams as `0x${string}`,
    };

    const data = encodeFunctionData({
      abi: SYNAPSE_ROUTER_ABI,
      functionName: "bridge",
      args: [
        request.recipient,
        BigInt(destinationChainId),
        request.sourceToken,
        quote.inputAmount,
        originQuery,
        destQuery,
      ],
    });

    return {
      id: `synapse-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      provider: BridgeProvider.SYNAPSE,
      quoteId: quote.quoteId,
      quote,
      sourceChain: quote.sourceChain,
      destinationChain: quote.destinationChain,
      to: routerAddress,
      data,
      value: isNative ? quote.inputAmount : 0n,
      gasLimit: 350000n,
      sourceToken: quote.sourceToken,
      destinationToken: quote.destinationToken,
      inputAmount: quote.inputAmount,
      expectedOutput: quote.outputAmount,
      minOutput: quote.minOutputAmount,
      status: BridgeStatus.PENDING,
      createdAt: Date.now(),
      approval: isNative
        ? undefined
        : {
            token: request.sourceToken,
            spender: routerAddress,
            amount: quote.inputAmount,
          },
    };
  }

  /**
   * Get status of a bridge transaction
   */
  async getStatus(
    sourceTxHash: `0x${string}`,
    sourceChain: SupportedChain
  ): Promise<BridgeReceipt> {
    const sourceChainId = SYNAPSE_CHAIN_IDS[sourceChain];

    try {
      // Query Synapse Explorer API for transaction status
      const url = new URL(`${this.apiUrl}/bridgeTxStatus`);
      url.searchParams.set("originChainId", String(sourceChainId));
      url.searchParams.set("txHash", sourceTxHash);

      const response = await fetch(url.toString());

      if (!response.ok) {
        return {
          provider: BridgeProvider.SYNAPSE,
          quoteId: "",
          status: BridgeStatus.PENDING,
          sourceTxHash,
          sourceChain,
          sourceConfirmations: 0,
          destinationChain: "ethereum" as SupportedChain,
          inputAmount: 0n,
          initiatedAt: Date.now(),
        };
      }

      const data = (await response.json()) as SynapseTxStatusResponse;

      // Determine status
      let status: BridgeStatus;
      if (data.status && data.toInfo?.txnHash) {
        status = BridgeStatus.COMPLETED;
      } else if (data.fromInfo?.txnHash) {
        status = BridgeStatus.BRIDGING;
      } else {
        status = BridgeStatus.PENDING;
      }

      // Determine destination chain from response
      const destinationChain =
        (Object.entries(SYNAPSE_CHAIN_IDS).find(
          ([_, id]) => id === data.toInfo?.chainID
        )?.[0] as SupportedChain) || "ethereum";

      return {
        provider: BridgeProvider.SYNAPSE,
        quoteId: "",
        status,
        sourceTxHash,
        sourceChain,
        sourceConfirmations: status !== BridgeStatus.PENDING ? 12 : 0,
        destinationTxHash: data.toInfo?.txnHash as `0x${string}` | undefined,
        destinationChain,
        destinationConfirmations: status === BridgeStatus.COMPLETED ? 1 : undefined,
        inputAmount: data.fromInfo ? BigInt(data.fromInfo.value || "0") : 0n,
        outputAmount: data.toInfo ? BigInt(data.toInfo.value || "0") : undefined,
        initiatedAt: Date.now(),
        completedAt: status === BridgeStatus.COMPLETED ? Date.now() : undefined,
      };
    } catch (error) {
      console.error("[Synapse] Error getting status:", error);

      return {
        provider: BridgeProvider.SYNAPSE,
        quoteId: "",
        status: BridgeStatus.PENDING,
        sourceTxHash,
        sourceChain,
        sourceConfirmations: 0,
        destinationChain: "ethereum" as SupportedChain,
        inputAmount: 0n,
        initiatedAt: Date.now(),
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check if token is native (ETH, BNB, etc.)
   */
  private isNativeToken(token: `0x${string}`): boolean {
    return token.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  }

  /**
   * Get token symbol from address
   */
  private async getTokenSymbol(
    token: `0x${string}`,
    chain: SupportedChain
  ): Promise<string | null> {
    const usdcAddress = BRIDGE_CONFIG.USDC_ADDRESSES[chain];
    if (usdcAddress && token.toLowerCase() === usdcAddress.toLowerCase()) {
      return "USDC";
    }

    const usdtAddress = BRIDGE_CONFIG.USDT_ADDRESSES[chain];
    if (usdtAddress && token.toLowerCase() === usdtAddress.toLowerCase()) {
      return "USDT";
    }

    const daiAddress = BRIDGE_CONFIG.DAI_ADDRESSES[chain];
    if (daiAddress && token.toLowerCase() === daiAddress.toLowerCase()) {
      return "DAI";
    }

    const wethAddress = BRIDGE_CONFIG.WETH_ADDRESSES[chain];
    if (wethAddress && token.toLowerCase() === wethAddress.toLowerCase()) {
      return "ETH";
    }

    if (token.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
      return "ETH";
    }

    return null;
  }

  /**
   * Get token decimals
   */
  private getTokenDecimals(symbol: string): number {
    switch (symbol) {
      case "USDC":
      case "USDT":
        return 6;
      case "ETH":
      case "WETH":
      case "DAI":
      case "BNB":
        return 18;
      default:
        return 18;
    }
  }
}

/**
 * Create Synapse provider instance
 */
export function createSynapseProvider(apiUrl?: string): SynapseBridgeProvider {
  return new SynapseBridgeProvider(apiUrl);
}
