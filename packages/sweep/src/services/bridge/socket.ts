/**
 * Socket (Bungee) Bridge Aggregator Integration
 * Aggregates multiple bridges for optimal routes
 * https://socket.tech/
 */

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
  type BridgeStep,
  type IBridgeProvider,
} from "./types.js";

/**
 * Socket API response types
 */
interface SocketQuoteResponse {
  success: boolean;
  result: {
    routes: SocketRoute[];
    fromChainId: number;
    toChainId: number;
    fromAsset: SocketAsset;
    toAsset: SocketAsset;
  };
}

interface SocketRoute {
  routeId: string;
  isOnlySwapRoute: boolean;
  fromAmount: string;
  toAmount: string;
  usedBridgeNames: string[];
  minimumGasBalances: Record<string, string>;
  totalUserTx: number;
  totalGasFeesInUsd: number;
  sender: string;
  recipient: string;
  userTxs: SocketUserTx[];
  serviceTime: number; // seconds
  maxServiceTime: number;
  integratorFee: {
    amount: string;
    asset: SocketAsset;
  };
}

interface SocketUserTx {
  userTxType: string;
  txType: string;
  chainId: number;
  toAmount: string;
  toAsset: SocketAsset;
  stepCount: number;
  routePath: string;
  protocol: {
    name: string;
    displayName: string;
    icon: string;
  };
  gasFees: {
    gasAmount: string;
    gasLimit: number;
    asset: SocketAsset;
    feesInUsd: number;
  };
  serviceTime: number;
  steps?: SocketStep[];
}

interface SocketStep {
  type: string;
  protocol: {
    name: string;
    displayName: string;
    icon: string;
  };
  fromChainId: number;
  fromAsset: SocketAsset;
  fromAmount: string;
  toChainId: number;
  toAsset: SocketAsset;
  toAmount: string;
  gasFees: {
    gasAmount: string;
    feesInUsd: number;
  };
}

interface SocketAsset {
  chainId: number;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
  logoURI: string;
  chainAgnosticId: string | null;
}

interface SocketBuildTxResponse {
  success: boolean;
  result: {
    userTxType: string;
    txType: string;
    txData: string;
    txTarget: string;
    chainId: number;
    value: string;
    approvalData: {
      minimumApprovalAmount: string;
      approvalTokenAddress: string;
      allowanceTarget: string;
      owner: string;
    } | null;
  };
}

interface SocketStatusResponse {
  success: boolean;
  result: {
    sourceTxStatus: string;
    destinationTxStatus: string;
    sourceTx: string;
    destinationTx?: string;
    fromChainId: number;
    toChainId: number;
    refuel?: {
      status: string;
      amount: string;
    };
  };
}

/**
 * Chain IDs for Socket API
 */
const SOCKET_CHAIN_IDS: Partial<Record<SupportedChain, number>> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  bsc: 56,
  linea: 59144,
};

/**
 * Reverse lookup for chain IDs
 */
const CHAIN_ID_TO_NAME: Record<number, SupportedChain> = Object.entries(
  SOCKET_CHAIN_IDS
).reduce(
  (acc, [name, id]) => {
    if (id) acc[id] = name as SupportedChain;
    return acc;
  },
  {} as Record<number, SupportedChain>
);

/**
 * Socket (Bungee) bridge aggregator provider
 */
export class SocketBridgeProvider implements IBridgeProvider {
  readonly name = BridgeProvider.SOCKET;

  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly cachePrefix = "socket";

  constructor(
    apiUrl: string = "https://api.socket.tech/v2",
    apiKey: string = process.env.SOCKET_API_KEY || ""
  ) {
    this.apiUrl = apiUrl;
    this.apiKey = apiKey;
  }

  /**
   * Check if Socket supports a route
   */
  async supportsRoute(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    _token: `0x${string}`
  ): Promise<boolean> {
    // Socket is an aggregator, so it supports most routes between supported chains
    const srcChainId = SOCKET_CHAIN_IDS[sourceChain];
    const dstChainId = SOCKET_CHAIN_IDS[destinationChain];

    return srcChainId !== undefined && dstChainId !== undefined;
  }

  /**
   * Get quote for bridging
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote | null> {
    const srcChainId = SOCKET_CHAIN_IDS[request.sourceChain];
    const dstChainId = SOCKET_CHAIN_IDS[request.destinationChain];

    if (!srcChainId || !dstChainId) {
      return null;
    }

    try {
      // Fetch quote from Socket API
      const url = new URL(`${this.apiUrl}/quote`);
      url.searchParams.set("fromChainId", srcChainId.toString());
      url.searchParams.set("toChainId", dstChainId.toString());
      url.searchParams.set("fromTokenAddress", request.sourceToken);
      url.searchParams.set("toTokenAddress", request.destinationToken);
      url.searchParams.set("fromAmount", request.amount.toString());
      url.searchParams.set("userAddress", request.sender);
      url.searchParams.set("recipient", request.recipient);
      url.searchParams.set("uniqueRoutesPerBridge", "true");
      url.searchParams.set("sort", "output"); // Sort by best output
      url.searchParams.set("singleTxOnly", "false");

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.apiKey) {
        headers["API-KEY"] = this.apiKey;
      }

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Socket] Quote request failed: ${response.status} - ${errorText}`);
        return null;
      }

      const quoteData = (await response.json()) as SocketQuoteResponse;

      if (!quoteData.success || !quoteData.result.routes.length) {
        console.warn("[Socket] No routes available");
        return null;
      }

      // Select the best route (highest output)
      const bestRoute = quoteData.result.routes[0];

      const outputAmount = BigInt(bestRoute.toAmount);
      const inputAmount = BigInt(bestRoute.fromAmount);

      // Calculate minimum output with slippage
      const slippage = request.slippage ?? BRIDGE_CONFIG.DEFAULT_SLIPPAGE;
      const minOutputAmount =
        outputAmount - (outputAmount * BigInt(Math.floor(slippage * 10000))) / 10000n;

      // Calculate total fees
      const totalFeesUsd = bestRoute.totalGasFeesInUsd;
      const gasFee = BigInt(
        Math.floor(totalFeesUsd * 10 ** quoteData.result.toAsset.decimals)
      );

      // Build route steps from Socket's user transactions
      const steps: BridgeStep[] = this.buildSteps(bestRoute, quoteData.result);

      // Generate quote ID
      const quoteId = `socket-${request.sourceChain}-${request.destinationChain}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const quote: BridgeQuote = {
        provider: BridgeProvider.SOCKET,
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        sourceToken: {
          address: quoteData.result.fromAsset.address as `0x${string}`,
          symbol: quoteData.result.fromAsset.symbol,
          decimals: quoteData.result.fromAsset.decimals,
          chain: request.sourceChain,
        },
        destinationToken: {
          address: quoteData.result.toAsset.address as `0x${string}`,
          symbol: quoteData.result.toAsset.symbol,
          decimals: quoteData.result.toAsset.decimals,
          chain: request.destinationChain,
        },
        inputAmount,
        outputAmount,
        minOutputAmount,
        fees: {
          bridgeFee: 0n, // Included in totalFeeUsd
          gasFee,
          relayerFee: 0n,
          totalFeeUsd: totalFeesUsd,
        },
        feeUsd: totalFeesUsd,
        estimatedTime: bestRoute.serviceTime,
        route: {
          steps,
          totalGasEstimate: BigInt(
            bestRoute.userTxs.reduce(
              (sum, tx) => sum + (tx.gasFees?.gasLimit || 0),
              0
            )
          ),
          requiresApproval: true, // Will check in buildTransaction
          estimatedGasUsd: totalFeesUsd,
        },
        expiresAt: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
        expiry: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
        quoteId,
        maxSlippage: slippage,
        tags: this.getRouteTags(bestRoute),
      };

      // Cache quote data including the route for building transaction
      await cacheSet(
        `${this.cachePrefix}:quote:${quoteId}`,
        {
          quote,
          route: bestRoute,
          request,
        },
        BRIDGE_CONFIG.QUOTE_TTL_SECONDS
      );

      return quote;
    } catch (error) {
      console.error("[Socket] Error getting quote:", error);
      return null;
    }
  }

  /**
   * Build bridge transaction
   */
  async buildTransaction(quote: BridgeQuote): Promise<BridgeTransaction> {
    const cached = await cacheGet<{
      quote: BridgeQuote;
      route: SocketRoute;
      request: BridgeQuoteRequest;
    }>(`${this.cachePrefix}:quote:${quote.quoteId}`);

    if (!cached) {
      throw new Error("Quote expired or not found");
    }

    const { route, request } = cached;

    try {
      // Build transaction using Socket's API
      const url = new URL(`${this.apiUrl}/build-tx`);

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.apiKey) {
        headers["API-KEY"] = this.apiKey;
      }

      const response = await fetch(url.toString(), {
        method: "POST",
        headers,
        body: JSON.stringify({
          route,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to build transaction: ${response.status} - ${errorText}`);
      }

      const buildData = (await response.json()) as SocketBuildTxResponse;

      if (!buildData.success) {
        throw new Error("Failed to build transaction");
      }

      const { result } = buildData;

      return {
        id: `socket-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        provider: BridgeProvider.SOCKET,
        quoteId: quote.quoteId,
        quote,
        sourceChain: quote.sourceChain,
        destinationChain: quote.destinationChain,
        to: result.txTarget as `0x${string}`,
        data: result.txData as `0x${string}`,
        value: BigInt(result.value),
        gasLimit: 500000n, // Conservative estimate
        sourceToken: quote.sourceToken,
        destinationToken: quote.destinationToken,
        inputAmount: quote.inputAmount,
        expectedOutput: quote.outputAmount,
        minOutput: quote.minOutputAmount,
        status: BridgeStatus.PENDING,
        createdAt: Date.now(),
        approval: result.approvalData
          ? {
              token: result.approvalData.approvalTokenAddress as `0x${string}`,
              spender: result.approvalData.allowanceTarget as `0x${string}`,
              amount: BigInt(result.approvalData.minimumApprovalAmount),
            }
          : undefined,
      };
    } catch (error) {
      console.error("[Socket] Error building transaction:", error);
      throw error;
    }
  }

  /**
   * Get status of a bridge transaction
   */
  async getStatus(
    sourceTxHash: `0x${string}`,
    sourceChain: SupportedChain
  ): Promise<BridgeReceipt> {
    const srcChainId = SOCKET_CHAIN_IDS[sourceChain];

    if (!srcChainId) {
      return this.createPendingReceipt(sourceTxHash, sourceChain);
    }

    try {
      const url = new URL(`${this.apiUrl}/bridge-status`);
      url.searchParams.set("transactionHash", sourceTxHash);
      url.searchParams.set("fromChainId", srcChainId.toString());
      // toChainId is optional but helps with accuracy
      // We don't have it here, so Socket will try to determine it

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (this.apiKey) {
        headers["API-KEY"] = this.apiKey;
      }

      const response = await fetch(url.toString(), { headers });

      if (!response.ok) {
        return this.createPendingReceipt(sourceTxHash, sourceChain);
      }

      const statusData = (await response.json()) as SocketStatusResponse;

      if (!statusData.success) {
        return this.createPendingReceipt(sourceTxHash, sourceChain);
      }

      const { result } = statusData;

      // Map Socket status to our status
      let status: BridgeStatus;
      const srcStatus = result.sourceTxStatus?.toUpperCase();
      const dstStatus = result.destinationTxStatus?.toUpperCase();

      if (dstStatus === "COMPLETED") {
        status = BridgeStatus.COMPLETED;
      } else if (srcStatus === "COMPLETED" && dstStatus === "PENDING") {
        status = BridgeStatus.BRIDGING;
      } else if (srcStatus === "PENDING") {
        status = BridgeStatus.PENDING_SOURCE;
      } else if (dstStatus === "FAILED" || srcStatus === "FAILED") {
        status = BridgeStatus.FAILED;
      } else {
        status = BridgeStatus.PENDING;
      }

      const destinationChain = CHAIN_ID_TO_NAME[result.toChainId] || "ethereum";

      return {
        provider: BridgeProvider.SOCKET,
        quoteId: "",
        status,
        sourceTxHash,
        sourceChain,
        sourceConfirmations: srcStatus === "COMPLETED" ? 12 : 0,
        destinationTxHash: result.destinationTx as `0x${string}` | undefined,
        destinationChain,
        destinationConfirmations:
          status === BridgeStatus.COMPLETED ? 1 : undefined,
        inputAmount: 0n, // Would need to decode from tx
        initiatedAt: Date.now(),
        completedAt: status === BridgeStatus.COMPLETED ? Date.now() : undefined,
      };
    } catch (error) {
      console.error("[Socket] Error getting status:", error);
      return this.createPendingReceipt(
        sourceTxHash,
        sourceChain,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  /**
   * Build route steps from Socket response
   */
  private buildSteps(
    route: SocketRoute,
    result: SocketQuoteResponse["result"]
  ): BridgeStep[] {
    const steps: BridgeStep[] = [];

    for (const userTx of route.userTxs) {
      if (userTx.steps) {
        for (const step of userTx.steps) {
          const fromChain = CHAIN_ID_TO_NAME[step.fromChainId] || "ethereum";
          const stepType = this.mapStepType(step.type);

          steps.push({
            type: stepType,
            chain: fromChain,
            protocol: step.protocol.displayName,
            protocolLogo: step.protocol.icon,
            fromToken: step.fromAsset.address as `0x${string}`,
            fromTokenSymbol: step.fromAsset.symbol,
            toToken: step.toAsset.address as `0x${string}`,
            toTokenSymbol: step.toAsset.symbol,
            fromAmount: step.fromAmount,
            toAmount: step.toAmount,
            amount: BigInt(step.fromAmount),
            expectedOutput: BigInt(step.toAmount),
          });
        }
      } else {
        // Single step transaction
        const fromChain = CHAIN_ID_TO_NAME[userTx.chainId] || "ethereum";

        steps.push({
          type: userTx.txType === "fund-movr" ? "bridge" : "swap",
          chain: fromChain,
          protocol: userTx.protocol?.displayName || "Socket",
          protocolLogo: userTx.protocol?.icon,
          fromToken: result.fromAsset.address as `0x${string}`,
          fromTokenSymbol: result.fromAsset.symbol,
          toToken: userTx.toAsset.address as `0x${string}`,
          toTokenSymbol: userTx.toAsset.symbol,
          fromAmount: route.fromAmount,
          toAmount: userTx.toAmount,
          amount: BigInt(route.fromAmount),
          expectedOutput: BigInt(userTx.toAmount),
        });
      }
    }

    return steps;
  }

  /**
   * Map Socket step type to our step type
   */
  private mapStepType(type: string): BridgeStep["type"] {
    switch (type.toLowerCase()) {
      case "swap":
      case "dex":
        return "swap";
      case "bridge":
      case "middleware":
        return "bridge";
      case "wrap":
        return "wrap";
      case "unwrap":
        return "unwrap";
      default:
        return "bridge";
    }
  }

  /**
   * Get tags for a route
   */
  private getRouteTags(route: SocketRoute): string[] {
    const tags: string[] = [];

    if (route.serviceTime < 120) {
      tags.push("fastest");
    }

    if (route.totalGasFeesInUsd < 1) {
      tags.push("cheapest");
    }

    if (route.usedBridgeNames.length === 1) {
      tags.push("direct");
    }

    return tags;
  }

  /**
   * Create a pending receipt
   */
  private createPendingReceipt(
    sourceTxHash: `0x${string}`,
    sourceChain: SupportedChain,
    error?: string
  ): BridgeReceipt {
    return {
      provider: BridgeProvider.SOCKET,
      quoteId: "",
      status: BridgeStatus.PENDING,
      sourceTxHash,
      sourceChain,
      sourceConfirmations: 0,
      destinationChain: "ethereum" as SupportedChain,
      inputAmount: 0n,
      initiatedAt: Date.now(),
      error,
    };
  }
}

/**
 * Create Socket provider instance
 */
export function createSocketProvider(
  apiUrl?: string,
  apiKey?: string
): SocketBridgeProvider {
  return new SocketBridgeProvider(apiUrl, apiKey);
}
