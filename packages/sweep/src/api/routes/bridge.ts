/**
 * Bridge API Routes
 * Cross-chain bridging endpoints
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  createBridgeAggregator,
  BridgeProvider,
  BridgeStatus,
  BRIDGE_CONFIG,
  BRIDGE_PROTOCOL_INFO,
  type BridgeQuote,
  type BridgeHistoryEntry,
  type BridgeSupportedInfo,
} from "../../services/bridge/index.js";
import { cacheGet, cacheSet } from "../../utils/redis.js";
import type { SupportedChain } from "../../config/chains.js";
import { addBridgeTrackJob } from "../../queue/index.js";

const bridgeRoutes = new Hono();

// Initialize bridge aggregator
const bridgeAggregator = createBridgeAggregator();

// ============================================================
// Validation Schemas
// ============================================================

const chainSchema = z.enum([
  "ethereum",
  "base",
  "arbitrum",
  "polygon",
  "bsc",
  "linea",
  "optimism",
]);

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address");
const txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash");

const quoteQuerySchema = z.object({
  sourceChain: chainSchema,
  destChain: chainSchema,
  sourceToken: addressSchema,
  destToken: addressSchema.optional(),
  amount: z.string().regex(/^\d+$/, "Amount must be a numeric string"),
  sender: addressSchema,
  recipient: addressSchema.optional(),
  slippage: z.string().transform(Number).optional(),
  priority: z.enum(["speed", "cost", "reliability"]).optional(),
});

const routesQuerySchema = z.object({
  sourceChain: chainSchema,
  destChain: chainSchema,
  token: addressSchema,
  amount: z.string().regex(/^\d+$/, "Amount must be a numeric string"),
  userAddress: addressSchema,
});

const executeBodySchema = z.object({
  quoteId: z.string(),
  userAddress: addressSchema,
  signature: z.string().optional(), // Optional if using smart wallet
});

const statusParamsSchema = z.object({
  txHash: txHashSchema,
});

const statusQuerySchema = z.object({
  sourceChain: chainSchema,
  provider: z.enum(["across", "stargate", "hop", "cbridge", "socket"]).optional(),
});

const historyQuerySchema = z.object({
  userAddress: addressSchema,
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
  status: z.enum(["pending", "completed", "failed", "all"]).optional(),
});

// ============================================================
// Routes
// ============================================================

/**
 * GET /bridge/routes
 * Get available routes for a bridge
 */
bridgeRoutes.get(
  "/routes",
  zValidator("query", routesQuerySchema),
  async (c) => {
    const { sourceChain, destChain, token, amount, userAddress } = c.req.valid("query");

    try {
      const quotes = await bridgeAggregator.getAllRoutes({
        sourceChain: sourceChain as SupportedChain,
        destChain: destChain as SupportedChain,
        token: token as `0x${string}`,
        amount,
        userAddress: userAddress as `0x${string}`,
      });

      // Sort by output amount (best first)
      const sortedQuotes = quotes.sort(
        (a, b) => Number(b.outputAmount - a.outputAmount)
      );

      // Add protocol info to each quote
      const enrichedQuotes = sortedQuotes.map((quote) => ({
        ...serializeQuote(quote),
        protocolInfo: BRIDGE_PROTOCOL_INFO[quote.provider],
      }));

      return c.json({
        routes: enrichedQuotes,
        count: enrichedQuotes.length,
        meta: {
          sourceChain,
          destChain,
          token,
          amount,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      console.error("[BridgeAPI] Error getting routes:", error);
      return c.json(
        {
          error: "Failed to get bridge routes",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

/**
 * GET /bridge/quote
 * Get the best quote for a bridge
 */
bridgeRoutes.get(
  "/quote",
  zValidator("query", quoteQuerySchema),
  async (c) => {
    const query = c.req.valid("query");

    try {
      const request = {
        sourceChain: query.sourceChain as SupportedChain,
        destinationChain: query.destChain as SupportedChain,
        sourceToken: query.sourceToken as `0x${string}`,
        destinationToken: (query.destToken || query.sourceToken) as `0x${string}`,
        amount: BigInt(query.amount),
        sender: query.sender as `0x${string}`,
        recipient: (query.recipient || query.sender) as `0x${string}`,
        slippage: query.slippage,
      };

      let quote: BridgeQuote | null;

      if (query.priority) {
        const quotes = await bridgeAggregator.findBestRoute({
          sourceChain: request.sourceChain,
          destChain: request.destinationChain,
          token: request.sourceToken,
          amount: query.amount,
          userAddress: request.sender,
          priority: query.priority,
        });
        quote = quotes[0] || null;
      } else {
        quote = await bridgeAggregator.getBestQuote(request);
      }

      if (!quote) {
        return c.json(
          {
            error: "No quote available",
            message: "No bridge providers support this route",
          },
          404
        );
      }

      return c.json({
        quote: serializeQuote(quote),
        protocolInfo: BRIDGE_PROTOCOL_INFO[quote.provider],
      });
    } catch (error) {
      console.error("[BridgeAPI] Error getting quote:", error);
      return c.json(
        {
          error: "Failed to get bridge quote",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

/**
 * POST /bridge/execute
 * Build transaction for bridge execution
 */
bridgeRoutes.post(
  "/execute",
  zValidator("json", executeBodySchema),
  async (c) => {
    const { quoteId, userAddress } = c.req.valid("json");

    try {
      // Get quote from cache
      const quoteKey = `bridge:quote:${quoteId}`;
      const cachedQuote = await cacheGet<{ quote: BridgeQuote }>(quoteKey);

      // Also check provider-specific caches
      let quote: BridgeQuote | null = cachedQuote?.quote || null;

      if (!quote) {
        // Try to find in provider-specific caches
        const providers = ["across", "stargate", "hop", "cbridge", "socket"];
        for (const provider of providers) {
          const providerQuote = await cacheGet<{ quote: BridgeQuote }>(
            `${provider}:quote:${quoteId}`
          );
          if (providerQuote) {
            quote = providerQuote.quote;
            break;
          }
        }
      }

      if (!quote) {
        return c.json(
          {
            error: "Quote not found or expired",
            message: "Please request a new quote",
          },
          404
        );
      }

      // Check if quote has expired
      if (quote.expiresAt < Date.now()) {
        return c.json(
          {
            error: "Quote expired",
            message: "Please request a new quote",
          },
          400
        );
      }

      // Build the transaction
      const transaction = await bridgeAggregator.executeBridge(quote);

      // Store transaction for tracking
      const txId = `bridge-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await cacheSet(
        `bridge:pending:${txId}`,
        {
          transaction,
          userAddress,
          createdAt: Date.now(),
        },
        3600 // 1 hour TTL
      );

      return c.json({
        transactionId: txId,
        transaction: {
          to: transaction.to,
          data: transaction.data,
          value: transaction.value.toString(),
          gasLimit: transaction.gasLimit.toString(),
          chainId: getChainId(transaction.sourceChain),
        },
        approval: transaction.approval
          ? {
              token: transaction.approval.token,
              spender: transaction.approval.spender,
              amount: transaction.approval.amount.toString(),
            }
          : null,
        quote: serializeQuote(quote),
      });
    } catch (error) {
      console.error("[BridgeAPI] Error executing bridge:", error);
      return c.json(
        {
          error: "Failed to execute bridge",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

/**
 * GET /bridge/status/:txHash
 * Get the status of a bridge transaction
 */
bridgeRoutes.get(
  "/status/:txHash",
  zValidator("param", statusParamsSchema),
  zValidator("query", statusQuerySchema),
  async (c) => {
    const { txHash } = c.req.valid("param");
    const { sourceChain, provider } = c.req.valid("query");

    try {
      const receipt = await bridgeAggregator.getBridgeStatus(
        txHash as `0x${string}`,
        sourceChain as SupportedChain,
        provider as BridgeProvider | undefined
      );

      return c.json({
        status: receipt.status,
        sourceTxHash: receipt.sourceTxHash,
        destinationTxHash: receipt.destinationTxHash,
        sourceChain: receipt.sourceChain,
        destinationChain: receipt.destinationChain,
        sourceConfirmations: receipt.sourceConfirmations,
        destinationConfirmations: receipt.destinationConfirmations,
        inputAmount: receipt.inputAmount.toString(),
        outputAmount: receipt.outputAmount?.toString(),
        provider: receipt.provider,
        initiatedAt: receipt.initiatedAt,
        completedAt: receipt.completedAt,
        error: receipt.error,
        statusDescription: getStatusDescription(receipt.status),
      });
    } catch (error) {
      console.error("[BridgeAPI] Error getting status:", error);
      return c.json(
        {
          error: "Failed to get bridge status",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

/**
 * GET /bridge/history
 * Get user's bridge history
 */
bridgeRoutes.get(
  "/history",
  zValidator("query", historyQuerySchema),
  async (c) => {
    const { userAddress, limit = 20, offset = 0, status = "all" } = c.req.valid("query");

    try {
      // Get history from cache/database
      const historyKey = `bridge:history:${userAddress.toLowerCase()}`;
      let history = await cacheGet<BridgeHistoryEntry[]>(historyKey) || [];

      // Filter by status
      if (status !== "all") {
        history = history.filter((entry) => {
          switch (status) {
            case "pending":
              return [
                BridgeStatus.PENDING,
                BridgeStatus.PENDING_SOURCE,
                BridgeStatus.SOURCE_CONFIRMED,
                BridgeStatus.BRIDGING,
                BridgeStatus.PENDING_DEST,
              ].includes(entry.status as BridgeStatus);
            case "completed":
              return entry.status === BridgeStatus.COMPLETED;
            case "failed":
              return [BridgeStatus.FAILED, BridgeStatus.REFUNDED].includes(
                entry.status as BridgeStatus
              );
            default:
              return true;
          }
        });
      }

      // Sort by createdAt descending
      history.sort((a, b) => b.createdAt - a.createdAt);

      // Paginate
      const paginatedHistory = history.slice(offset, offset + limit);

      return c.json({
        history: paginatedHistory,
        pagination: {
          total: history.length,
          limit,
          offset,
          hasMore: offset + limit < history.length,
        },
      });
    } catch (error) {
      console.error("[BridgeAPI] Error getting history:", error);
      return c.json(
        {
          error: "Failed to get bridge history",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

/**
 * GET /bridge/supported
 * Get supported chains and tokens
 */
bridgeRoutes.get("/supported", async (c) => {
  try {
    const supportedInfo: BridgeSupportedInfo = {
      chains: [
        { chain: "ethereum", chainId: 1, name: "Ethereum", nativeToken: "ETH" },
        { chain: "base", chainId: 8453, name: "Base", nativeToken: "ETH" },
        { chain: "arbitrum", chainId: 42161, name: "Arbitrum One", nativeToken: "ETH" },
        { chain: "polygon", chainId: 137, name: "Polygon", nativeToken: "MATIC" },
        { chain: "optimism", chainId: 10, name: "Optimism", nativeToken: "ETH" },
        { chain: "bsc", chainId: 56, name: "BNB Chain", nativeToken: "BNB" },
        { chain: "linea", chainId: 59144, name: "Linea", nativeToken: "ETH" },
      ],
      tokens: [
        {
          symbol: "USDC",
          name: "USD Coin",
          addresses: BRIDGE_CONFIG.USDC_ADDRESSES,
          decimals: 6,
        },
        {
          symbol: "USDT",
          name: "Tether USD",
          addresses: BRIDGE_CONFIG.USDT_ADDRESSES,
          decimals: 6,
        },
        {
          symbol: "WETH",
          name: "Wrapped Ether",
          addresses: BRIDGE_CONFIG.WETH_ADDRESSES,
          decimals: 18,
        },
        {
          symbol: "DAI",
          name: "Dai Stablecoin",
          addresses: BRIDGE_CONFIG.DAI_ADDRESSES,
          decimals: 18,
        },
      ],
      routes: generateSupportedRoutes(),
    };

    return c.json(supportedInfo);
  } catch (error) {
    console.error("[BridgeAPI] Error getting supported info:", error);
    return c.json(
      {
        error: "Failed to get supported info",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * GET /bridge/providers
 * Get information about available bridge providers
 */
bridgeRoutes.get("/providers", async (c) => {
  const enabledProviders = bridgeAggregator.getEnabledProviders();

  const providers = enabledProviders.map((provider) => ({
    ...BRIDGE_PROTOCOL_INFO[provider],
    enabled: true,
  }));

  return c.json({
    providers,
    count: providers.length,
  });
});

/**
 * POST /bridge/track
 * Add a bridge transaction to the tracking queue
 */
bridgeRoutes.post(
  "/track",
  zValidator(
    "json",
    z.object({
      planId: z.string(),
      bridgeId: z.string(),
      sourceTxHash: txHashSchema,
      sourceChain: chainSchema,
      destinationChain: chainSchema,
      provider: z.enum(["across", "stargate", "hop", "cbridge", "socket"]),
    })
  ),
  async (c) => {
    const body = c.req.valid("json");

    try {
      // Add to tracking queue
      await addBridgeTrackJob({
        planId: body.planId,
        bridgeId: body.bridgeId,
        sourceTxHash: body.sourceTxHash,
        sourceChain: body.sourceChain,
        destinationChain: body.destinationChain,
        provider: body.provider as BridgeProvider,
      });

      return c.json({
        success: true,
        message: "Bridge transaction added to tracking queue",
      });
    } catch (error) {
      console.error("[BridgeAPI] Error adding to track queue:", error);
      return c.json(
        {
          error: "Failed to track bridge",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

// ============================================================
// Helper Functions
// ============================================================

/**
 * Serialize a BridgeQuote for JSON response
 */
function serializeQuote(quote: BridgeQuote): Record<string, unknown> {
  return {
    provider: quote.provider,
    sourceChain: quote.sourceChain,
    destinationChain: quote.destinationChain,
    sourceToken: quote.sourceToken,
    destinationToken: quote.destinationToken,
    inputAmount: quote.inputAmount.toString(),
    outputAmount: quote.outputAmount.toString(),
    minOutputAmount: quote.minOutputAmount.toString(),
    fees: {
      bridgeFee: quote.fees.bridgeFee.toString(),
      gasFee: quote.fees.gasFee.toString(),
      relayerFee: quote.fees.relayerFee.toString(),
      totalFeeUsd: quote.fees.totalFeeUsd,
      lpFee: quote.fees.lpFee?.toString(),
    },
    feeUsd: quote.feeUsd,
    estimatedTime: quote.estimatedTime,
    estimatedTimeFormatted: formatTime(quote.estimatedTime),
    route: {
      steps: quote.route.steps.map((step) => ({
        type: step.type,
        chain: step.chain,
        protocol: step.protocol,
        fromToken: step.fromToken,
        toToken: step.toToken,
        amount: step.amount.toString(),
        expectedOutput: step.expectedOutput.toString(),
      })),
      totalGasEstimate: quote.route.totalGasEstimate.toString(),
      requiresApproval: quote.route.requiresApproval,
      approvalAddress: quote.route.approvalAddress,
    },
    expiresAt: quote.expiresAt,
    quoteId: quote.quoteId,
    isFastFill: quote.isFastFill,
    maxSlippage: quote.maxSlippage,
    tags: quote.tags,
  };
}

/**
 * Format seconds to human-readable time
 */
function formatTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }
}

/**
 * Get chain ID for a supported chain
 */
function getChainId(chain: SupportedChain): number {
  const chainIds: Record<string, number> = {
    ethereum: 1,
    base: 8453,
    arbitrum: 42161,
    polygon: 137,
    optimism: 10,
    bsc: 56,
    linea: 59144,
  };
  return chainIds[chain] || 1;
}

/**
 * Get human-readable status description
 */
function getStatusDescription(status: BridgeStatus): string {
  const descriptions: Record<BridgeStatus, string> = {
    [BridgeStatus.PENDING]: "Transaction pending",
    [BridgeStatus.PENDING_SOURCE]: "Waiting for source chain confirmation",
    [BridgeStatus.SOURCE_CONFIRMED]: "Source transaction confirmed",
    [BridgeStatus.BRIDGING]: "Bridging in progress",
    [BridgeStatus.DESTINATION_PENDING]: "Waiting for destination chain",
    [BridgeStatus.PENDING_DEST]: "Waiting for destination chain",
    [BridgeStatus.COMPLETED]: "Bridge completed successfully",
    [BridgeStatus.FAILED]: "Bridge failed",
    [BridgeStatus.REFUNDED]: "Transaction refunded",
    [BridgeStatus.EXPIRED]: "Bridge quote expired",
  };
  return descriptions[status] || "Unknown status";
}

/**
 * Generate supported routes based on provider capabilities
 */
function generateSupportedRoutes(): BridgeSupportedInfo["routes"] {
  const chains: SupportedChain[] = [
    "ethereum",
    "base",
    "arbitrum",
    "polygon",
    "optimism",
    "bsc",
    "linea",
  ];

  const routes: BridgeSupportedInfo["routes"] = [];

  for (const src of chains) {
    for (const dst of chains) {
      if (src === dst) continue;

      // Determine which providers support this route
      const providers: BridgeProvider[] = [];

      // Across supports most EVM chains
      if (
        ["ethereum", "base", "arbitrum", "polygon", "optimism", "linea"].includes(src) &&
        ["ethereum", "base", "arbitrum", "polygon", "optimism", "linea"].includes(dst)
      ) {
        providers.push(BridgeProvider.ACROSS);
      }

      // Stargate supports most chains
      if (
        ["ethereum", "base", "arbitrum", "polygon", "optimism", "bsc"].includes(src) &&
        ["ethereum", "base", "arbitrum", "polygon", "optimism", "bsc"].includes(dst)
      ) {
        providers.push(BridgeProvider.STARGATE);
      }

      // Hop supports Ethereum and L2s
      if (
        ["ethereum", "arbitrum", "optimism", "polygon"].includes(src) &&
        ["ethereum", "arbitrum", "optimism", "polygon"].includes(dst)
      ) {
        providers.push(BridgeProvider.HOP);
      }

      // cBridge supports most chains
      if (
        ["ethereum", "base", "arbitrum", "polygon", "optimism", "bsc"].includes(src) &&
        ["ethereum", "base", "arbitrum", "polygon", "optimism", "bsc"].includes(dst)
      ) {
        providers.push(BridgeProvider.CBRIDGE);
      }

      // Socket aggregates all, so supports all chain combinations
      providers.push(BridgeProvider.SOCKET);

      routes.push({
        sourceChain: src,
        destinationChain: dst,
        providers,
      });
    }
  }

  return routes;
}

export default bridgeRoutes;
