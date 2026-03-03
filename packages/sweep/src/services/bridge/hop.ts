/**
 * Hop Protocol Integration
 * Fast cross-chain bridging with bonder network
 * https://hop.exchange/
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
 * Hop Protocol API response types
 */
interface HopQuoteResponse {
  amountOut: string;
  amountOutMin: string;
  bonderFee: string;
  destinationTxFee: string;
  estimatedReceivedAtDestination: string;
  deadline: number;
  route: {
    path: string[];
    inputAmount: string;
    outputAmount: string;
  };
}

interface HopTransferStatusResponse {
  transferId: string;
  transactionHash: string;
  sourceChainId: number;
  destinationChainId: number;
  amount: string;
  bonderFee: string;
  bondTransactionHash?: string;
  bonded: boolean;
  bondedTimestamp?: number;
  receivedTimestamp?: number;
}

/**
 * Hop Bridge contract addresses per chain/token
 * L1 uses L1_Bridge, L2s use L2_AmmWrapper
 */
const HOP_BRIDGE_ADDRESSES: Partial<
  Record<SupportedChain, Partial<Record<string, `0x${string}`>>>
> = {
  ethereum: {
    ETH: "0xb8901acB165ed027E32754E0FFe830802919727f",
    USDC: "0x3666f603Cc164936C1b87e207F36BEBa4AC5f18a",
    USDT: "0x3E4a3a4796d16c0Cd582C382691998f7c06420B6",
    DAI: "0x3d4Cc8A61c7528Fd86C55cfe061a78dCBA48EDd1",
    MATIC: "0x22B1Cbb8D98a01a3B71D034BB899775A76Eb1cc2",
  },
  arbitrum: {
    ETH: "0x33ceb27b39d2Bb7D2e61F7564d3Df29344020417",
    USDC: "0xe22D2beDb3Eca35E6397e0C6D62857094aA26F52",
    USDT: "0xCB0a4177E0A60247C0ad18Be87f8eDfF6DD30283",
    DAI: "0x7aC115536FE3A185100B2c4DE4cb328bf3A58Ba6",
  },
  optimism: {
    ETH: "0x86cA30bEF97fB651b8d866D45503684b90cb3312",
    USDC: "0x2ad09850b0CA4c7c1B33f5AcD6cBAbCFB1dEa0d3",
    USDT: "0x46ae9BaB8CEA96610807a275EBD36f8e916b5C61",
    DAI: "0xb3C68a491608952Cb1257FC9909a537a0173b63B",
  },
  polygon: {
    ETH: "0xb98454270065A31D71Bf635F6F7Ee6A518dFb849",
    USDC: "0x76b22b8C1079A44F1211c807996254e9F1d0c1ea",
    USDT: "0x8741Ba6225A6BF91f9D73531A98A89807857a2B3",
    DAI: "0xEcf268Be00308980B5b3fcd0975D47C4C8e1382a",
    MATIC: "0x553bC791D746767166fA3888432038193cEED5E2",
  },
};

/**
 * Chain slugs used by Hop API
 */
const HOP_CHAIN_SLUGS: Partial<Record<SupportedChain, string>> = {
  ethereum: "ethereum",
  arbitrum: "arbitrum",
  optimism: "optimism",
  polygon: "polygon",
};

/**
 * Chain IDs for Hop
 */
const HOP_CHAIN_IDS: Partial<Record<SupportedChain, number>> = {
  ethereum: 1,
  arbitrum: 42161,
  optimism: 10,
  polygon: 137,
};

/**
 * Hop L2 AMM Wrapper ABI (partial)
 */
const HOP_L2_AMM_WRAPPER_ABI = parseAbi([
  "function swapAndSend(uint256 chainId, address recipient, uint256 amount, uint256 bonderFee, uint256 amountOutMin, uint256 deadline, uint256 destinationAmountOutMin, uint256 destinationDeadline) payable",
]);

/**
 * Hop L1 Bridge ABI (partial)
 */
const HOP_L1_BRIDGE_ABI = parseAbi([
  "function sendToL2(uint256 chainId, address recipient, uint256 amount, uint256 amountOutMin, uint256 deadline, address relayer, uint256 relayerFee) payable",
]);

/**
 * Hop Protocol bridge provider
 */
export class HopBridgeProvider implements IBridgeProvider {
  readonly name = BridgeProvider.HOP;

  private readonly apiUrl: string;
  private readonly cachePrefix = "hop";

  constructor(apiUrl: string = "https://api.hop.exchange/v1") {
    this.apiUrl = apiUrl;
  }

  /**
   * Check if Hop supports a route
   */
  async supportsRoute(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    token: `0x${string}`
  ): Promise<boolean> {
    // Check if both chains are supported
    if (!HOP_CHAIN_SLUGS[sourceChain] || !HOP_CHAIN_SLUGS[destinationChain]) {
      return false;
    }

    // Get token symbol and check if bridge exists
    const tokenSymbol = await this.getTokenSymbol(token, sourceChain);
    if (!tokenSymbol) {
      return false;
    }

    const srcBridge = HOP_BRIDGE_ADDRESSES[sourceChain]?.[tokenSymbol];
    const dstBridge = HOP_BRIDGE_ADDRESSES[destinationChain]?.[tokenSymbol];

    return srcBridge !== undefined && dstBridge !== undefined;
  }

  /**
   * Get quote for bridging
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote | null> {
    const sourceSlug = HOP_CHAIN_SLUGS[request.sourceChain];
    const destSlug = HOP_CHAIN_SLUGS[request.destinationChain];

    if (!sourceSlug || !destSlug) {
      return null;
    }

    const tokenSymbol = await this.getTokenSymbol(
      request.sourceToken,
      request.sourceChain
    );
    if (!tokenSymbol) {
      console.warn("[Hop] Unknown token symbol");
      return null;
    }

    // Check if bridge exists for this token
    const bridgeAddress = HOP_BRIDGE_ADDRESSES[request.sourceChain]?.[tokenSymbol];
    if (!bridgeAddress) {
      console.warn(`[Hop] No bridge for ${tokenSymbol} on ${request.sourceChain}`);
      return null;
    }

    try {
      // Fetch quote from Hop API
      const url = new URL(`${this.apiUrl}/quote`);
      url.searchParams.set("amount", request.amount.toString());
      url.searchParams.set("token", tokenSymbol);
      url.searchParams.set("fromChain", sourceSlug);
      url.searchParams.set("toChain", destSlug);
      url.searchParams.set("slippage", ((request.slippage ?? BRIDGE_CONFIG.DEFAULT_SLIPPAGE) * 100).toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Hop] Quote request failed: ${response.status} - ${errorText}`);
        return null;
      }

      const quoteData = (await response.json()) as HopQuoteResponse;

      // Calculate output amount
      const outputAmount = BigInt(quoteData.amountOut);
      const minOutputAmount = BigInt(quoteData.amountOutMin);
      const bonderFee = BigInt(quoteData.bonderFee);
      const destTxFee = BigInt(quoteData.destinationTxFee || "0");

      // Generate quote ID
      const quoteId = `hop-${request.sourceChain}-${request.destinationChain}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const slippage = request.slippage ?? BRIDGE_CONFIG.DEFAULT_SLIPPAGE;

      const quote: BridgeQuote = {
        provider: BridgeProvider.HOP,
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        sourceToken: {
          address: request.sourceToken,
          symbol: tokenSymbol,
          decimals: this.getTokenDecimals(tokenSymbol),
          chain: request.sourceChain,
        },
        destinationToken: {
          address: request.destinationToken,
          symbol: tokenSymbol,
          decimals: this.getTokenDecimals(tokenSymbol),
          chain: request.destinationChain,
        },
        inputAmount: request.amount,
        outputAmount,
        minOutputAmount,
        fees: {
          bridgeFee: bonderFee,
          gasFee: destTxFee,
          relayerFee: 0n,
          totalFeeUsd: 0, // Would need price conversion
        },
        feeUsd: 0,
        estimatedTime: 180, // ~3 minutes typical for Hop
        route: {
          steps: [
            {
              type: "bridge",
              chain: request.sourceChain,
              protocol: "Hop Protocol",
              fromToken: request.sourceToken,
              toToken: request.destinationToken,
              fromAmount: request.amount.toString(),
              toAmount: outputAmount.toString(),
              amount: request.amount,
              expectedOutput: outputAmount,
            },
          ],
          totalGasEstimate: 250000n,
          requiresApproval: tokenSymbol !== "ETH",
          approvalAddress: bridgeAddress,
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
          tokenSymbol,
          bridgeAddress,
        },
        BRIDGE_CONFIG.QUOTE_TTL_SECONDS
      );

      return quote;
    } catch (error) {
      console.error("[Hop] Error getting quote:", error);
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
      quoteData: HopQuoteResponse;
      request: BridgeQuoteRequest;
      tokenSymbol: string;
      bridgeAddress: `0x${string}`;
    }>(`${this.cachePrefix}:quote:${quote.quoteId}`);

    if (!cached) {
      throw new Error("Quote expired or not found");
    }

    const { quoteData, request, tokenSymbol, bridgeAddress } = cached;

    const destinationChainId = HOP_CHAIN_IDS[quote.destinationChain];
    if (!destinationChainId) {
      throw new Error(`Unsupported destination chain ${quote.destinationChain}`);
    }

    // Set deadlines (30 minutes from now)
    const deadline = Math.floor(Date.now() / 1000) + 1800;
    const destinationDeadline = deadline + 3600; // 1 hour buffer for destination

    let data: `0x${string}`;
    let value: bigint;

    const isL1Source = request.sourceChain === "ethereum";
    const isNativeToken = tokenSymbol === "ETH";

    if (isL1Source) {
      // L1 -> L2: Use L1_Bridge.sendToL2
      data = encodeFunctionData({
        abi: HOP_L1_BRIDGE_ABI,
        functionName: "sendToL2",
        args: [
          BigInt(destinationChainId),
          request.recipient,
          quote.inputAmount,
          quote.minOutputAmount,
          BigInt(deadline),
          "0x0000000000000000000000000000000000000000" as `0x${string}`, // No relayer
          0n, // No relayer fee
        ],
      });
      value = isNativeToken ? quote.inputAmount : 0n;
    } else {
      // L2 -> L1 or L2 -> L2: Use L2_AmmWrapper.swapAndSend
      const bonderFee = BigInt(quoteData.bonderFee);

      data = encodeFunctionData({
        abi: HOP_L2_AMM_WRAPPER_ABI,
        functionName: "swapAndSend",
        args: [
          BigInt(destinationChainId),
          request.recipient,
          quote.inputAmount,
          bonderFee,
          quote.minOutputAmount,
          BigInt(deadline),
          quote.minOutputAmount, // destinationAmountOutMin
          BigInt(destinationDeadline),
        ],
      });
      value = isNativeToken ? quote.inputAmount : 0n;
    }

    return {
      id: `hop-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      provider: BridgeProvider.HOP,
      quoteId: quote.quoteId,
      quote,
      sourceChain: quote.sourceChain,
      destinationChain: quote.destinationChain,
      to: bridgeAddress,
      data,
      value,
      gasLimit: 300000n,
      sourceToken: quote.sourceToken,
      destinationToken: quote.destinationToken,
      inputAmount: quote.inputAmount,
      expectedOutput: quote.outputAmount,
      minOutput: quote.minOutputAmount,
      status: BridgeStatus.PENDING,
      createdAt: Date.now(),
      approval: isNativeToken
        ? undefined
        : {
            token: request.sourceToken,
            spender: bridgeAddress,
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
    try {
      // Query Hop explorer API for transfer status
      const url = new URL(`${this.apiUrl}/transfer-status`);
      url.searchParams.set("transactionHash", sourceTxHash);

      const response = await fetch(url.toString());

      if (!response.ok) {
        return {
          provider: BridgeProvider.HOP,
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

      const data = (await response.json()) as HopTransferStatusResponse;

      // Determine status
      let status: BridgeStatus;
      if (data.bonded && data.bondTransactionHash) {
        status = BridgeStatus.COMPLETED;
      } else if (data.transactionHash) {
        status = BridgeStatus.BRIDGING;
      } else {
        status = BridgeStatus.PENDING;
      }

      // Find destination chain
      const destinationChain =
        (Object.entries(HOP_CHAIN_IDS).find(
          ([_, id]) => id === data.destinationChainId
        )?.[0] as SupportedChain) || "ethereum";

      return {
        provider: BridgeProvider.HOP,
        quoteId: "",
        status,
        sourceTxHash,
        sourceChain,
        sourceConfirmations: status !== BridgeStatus.PENDING ? 12 : 0,
        destinationTxHash: data.bondTransactionHash as `0x${string}` | undefined,
        destinationChain,
        destinationConfirmations: status === BridgeStatus.COMPLETED ? 1 : undefined,
        inputAmount: BigInt(data.amount || "0"),
        initiatedAt: Date.now(),
        completedAt:
          status === BridgeStatus.COMPLETED ? data.receivedTimestamp : undefined,
      };
    } catch (error) {
      console.error("[Hop] Error getting status:", error);

      return {
        provider: BridgeProvider.HOP,
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
   * Get token symbol from address
   */
  private async getTokenSymbol(
    token: `0x${string}`,
    chain: SupportedChain
  ): Promise<string | null> {
    // Check common token addresses
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
      return "ETH"; // Hop uses ETH for WETH
    }

    // Native ETH
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
      case "MATIC":
        return 18;
      default:
        return 18;
    }
  }
}

/**
 * Create Hop provider instance
 */
export function createHopProvider(apiUrl?: string): HopBridgeProvider {
  return new HopBridgeProvider(apiUrl);
}

/**
 * Get Hop bridge address for a chain/token
 */
export function getHopBridgeAddress(
  chain: SupportedChain,
  token: string
): `0x${string}` | null {
  return HOP_BRIDGE_ADDRESSES[chain]?.[token] || null;
}
