/**
 * Across Protocol V3 Integration
 * Fast cross-chain bridging with relayer network
 * https://docs.across.to/
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
  type BridgeToken,
  type IBridgeProvider,
} from "./types.js";

/**
 * Across API response types
 */
interface AcrossQuoteResponse {
  totalRelayFee: {
    total: string;
    pct: string;
  };
  relayerCapitalFee: {
    total: string;
    pct: string;
  };
  relayerGasFee: {
    total: string;
    pct: string;
  };
  lpFee: {
    total: string;
    pct: string;
  };
  timestamp: string;
  isAmountTooLow: boolean;
  quoteBlock: string;
  exclusiveRelayer: string;
  exclusivityDeadline: string;
  spokePoolAddress: string;
  expectedFillTime: number;
  expectedFillTimeSec: number;
}

interface AcrossLimitsResponse {
  minDeposit: string;
  maxDeposit: string;
  maxDepositInstant: string;
  maxDepositShortDelay: string;
  recommendedDepositInstant: string;
}

interface AcrossStatusResponse {
  status: "pending" | "filled" | "expired";
  fillTx?: string;
  depositTxHash: string;
  depositId: number;
  originChainId: number;
  destinationChainId: number;
  amount: string;
  outputAmount?: string;
  fillDeadline: number;
}

/**
 * Across V3 SpokePool contract addresses
 */
const ACROSS_SPOKE_POOLS: Partial<Record<SupportedChain, `0x${string}`>> = {
  ethereum: "0x5c7BCd6E7De5423a257D81B442095A1a6ced35C5",
  base: "0x09aea4b2242abC8bb4BB78D537A67a245A7bEC64",
  arbitrum: "0xe35e9842fceaCA96570B734083f4a58e8F7C5f2A",
  polygon: "0x9295ee1d8C5b022Be115A2AD3c30C72E34e7F096",
  optimism: "0x6f26Bf09B1C792e3228e5467807a900A503c0281",
  linea: "0x7E63A5f1a8F0B4d0934B2f2327DAED3F6bb2ee75",
};

/**
 * Chain IDs for Across API
 */
const CHAIN_IDS: Partial<Record<SupportedChain, number>> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  linea: 59144,
  bsc: 56,
};

/**
 * Across SpokePool V3 ABI (partial)
 */
const SPOKE_POOL_ABI = parseAbi([
  "function depositV3(address depositor, address recipient, address inputToken, address outputToken, uint256 inputAmount, uint256 outputAmount, uint256 destinationChainId, address exclusiveRelayer, uint32 quoteTimestamp, uint32 fillDeadline, uint32 exclusivityDeadline, bytes message) payable",
  "function fillDeadlineBuffer() view returns (uint32)",
  "function getCurrentTime() view returns (uint32)",
]);

/**
 * Across Protocol bridge provider
 */
export class AcrossBridgeProvider implements IBridgeProvider {
  readonly name = BridgeProvider.ACROSS;
  
  private readonly apiUrl: string;
  private readonly cachePrefix = "across";
  
  constructor(apiUrl: string = "https://app.across.to/api") {
    this.apiUrl = apiUrl;
  }
  
  /**
   * Check if Across supports a route
   */
  async supportsRoute(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    token: `0x${string}`
  ): Promise<boolean> {
    // Check if both chains have spoke pools
    if (!ACROSS_SPOKE_POOLS[sourceChain] || !ACROSS_SPOKE_POOLS[destinationChain]) {
      return false;
    }
    
    // Check supported routes cache
    const cacheKey = `${this.cachePrefix}:routes:${sourceChain}:${destinationChain}`;
    const cached = await cacheGet<boolean>(cacheKey);
    if (cached !== null) {
      return cached;
    }
    
    try {
      // Try to get limits - if it works, route is supported
      const limits = await this.getLimits(sourceChain, destinationChain, token);
      const supported = limits !== null && BigInt(limits.maxDeposit) > 0n;
      
      await cacheSet(cacheKey, supported, 3600); // Cache for 1 hour
      return supported;
    } catch {
      await cacheSet(cacheKey, false, 300); // Cache failure for 5 minutes
      return false;
    }
  }
  
  /**
   * Get limits for a route
   */
  async getLimits(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    token: `0x${string}`
  ): Promise<AcrossLimitsResponse | null> {
    const originChainId = CHAIN_IDS[sourceChain];
    const destinationChainId = CHAIN_IDS[destinationChain];
    
    if (!originChainId || !destinationChainId) {
      return null;
    }
    
    const cacheKey = `${this.cachePrefix}:limits:${sourceChain}:${destinationChain}:${token}`;
    const cached = await cacheGet<AcrossLimitsResponse>(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const url = new URL(`${this.apiUrl}/limits`);
      url.searchParams.set("token", token);
      url.searchParams.set("originChainId", originChainId.toString());
      url.searchParams.set("destinationChainId", destinationChainId.toString());
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        console.warn(`[Across] Limits request failed: ${response.status}`);
        return null;
      }
      
      const limits = (await response.json()) as AcrossLimitsResponse;
      await cacheSet(cacheKey, limits, 300); // Cache for 5 minutes
      
      return limits;
    } catch (error) {
      console.error("[Across] Error fetching limits:", error);
      return null;
    }
  }
  
  /**
   * Get a quote for bridging
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote | null> {
    const originChainId = CHAIN_IDS[request.sourceChain];
    const destinationChainId = CHAIN_IDS[request.destinationChain];
    
    if (!originChainId || !destinationChainId) {
      return null;
    }
    
    const spokePool = ACROSS_SPOKE_POOLS[request.sourceChain];
    if (!spokePool) {
      return null;
    }
    
    try {
      // Fetch suggested fees from Across API
      const url = new URL(`${this.apiUrl}/suggested-fees`);
      url.searchParams.set("token", request.sourceToken);
      url.searchParams.set("inputToken", request.sourceToken);
      url.searchParams.set("outputToken", request.destinationToken);
      url.searchParams.set("originChainId", originChainId.toString());
      url.searchParams.set("destinationChainId", destinationChainId.toString());
      url.searchParams.set("amount", request.amount.toString());
      url.searchParams.set("recipient", request.recipient);
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Across] Quote request failed: ${response.status} - ${errorText}`);
        return null;
      }
      
      const quoteData = (await response.json()) as AcrossQuoteResponse;
      
      if (quoteData.isAmountTooLow) {
        console.warn("[Across] Amount too low for bridge");
        return null;
      }
      
      // Calculate output amount after fees
      const totalFee = BigInt(quoteData.totalRelayFee.total);
      const outputAmount = request.amount - totalFee;
      
      // Apply slippage for minimum output
      const slippage = request.slippage ?? BRIDGE_CONFIG.DEFAULT_SLIPPAGE;
      const minOutputAmount = outputAmount - (outputAmount * BigInt(Math.floor(slippage * 10000))) / 10000n;
      
      // Determine if fast fill is available
      const isFastFill = this.isFastFillEligible(request.sourceToken, outputAmount);
      
      // Generate quote ID
      const quoteId = `across-${request.sourceChain}-${request.destinationChain}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      const quote: BridgeQuote = {
        provider: BridgeProvider.ACROSS,
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        sourceToken: {
          address: request.sourceToken,
          symbol: "TOKEN", // Would need token metadata
          decimals: 18,
          chain: request.sourceChain,
        },
        destinationToken: {
          address: request.destinationToken,
          symbol: "TOKEN",
          decimals: 18,
          chain: request.destinationChain,
        },
        inputAmount: request.amount,
        outputAmount,
        minOutputAmount,
        fees: {
          bridgeFee: BigInt(quoteData.lpFee.total),
          gasFee: BigInt(quoteData.relayerGasFee.total),
          relayerFee: BigInt(quoteData.relayerCapitalFee.total),
          totalFeeUsd: 0, // Would need price conversion
        },
        feeUsd: 0, // Would need price conversion
        estimatedTime: isFastFill ? 60 : quoteData.expectedFillTimeSec, // Fast fills ~1 min
        route: {
          steps: [
            {
              type: "bridge",
              chain: request.sourceChain,
              protocol: "Across V3",
              fromToken: request.sourceToken,
              toToken: request.destinationToken,
              fromAmount: request.amount.toString(),
              toAmount: outputAmount.toString(),
              amount: request.amount,
              expectedOutput: outputAmount,
            },
          ],
          totalGasEstimate: 150000n, // Approximate gas for deposit
          requiresApproval: true, // ERC20 needs approval
          approvalAddress: spokePool,
        },
        expiresAt: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
        expiry: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
        quoteId,
        isFastFill,
        maxSlippage: slippage,
      };
      
      // Cache the quote with full data for building transaction
      await cacheSet(`${this.cachePrefix}:quote:${quoteId}`, {
        quote,
        quoteData,
        request,
      }, BRIDGE_CONFIG.QUOTE_TTL_SECONDS);
      
      return quote;
    } catch (error) {
      console.error("[Across] Error getting quote:", error);
      return null;
    }
  }
  
  /**
   * Build the bridge transaction
   */
  async buildTransaction(quote: BridgeQuote): Promise<BridgeTransaction> {
    // Get cached quote data
    const cached = await cacheGet<{
      quote: BridgeQuote;
      quoteData: AcrossQuoteResponse;
      request: BridgeQuoteRequest;
    }>(`${this.cachePrefix}:quote:${quote.quoteId}`);
    
    if (!cached) {
      throw new Error("Quote expired or not found");
    }
    
    const { quoteData, request } = cached;
    const spokePool = ACROSS_SPOKE_POOLS[quote.sourceChain];
    
    if (!spokePool) {
      throw new Error(`No SpokePool for chain ${quote.sourceChain}`);
    }
    
    const destinationChainId = CHAIN_IDS[quote.destinationChain];
    if (!destinationChainId) {
      throw new Error(`Unsupported destination chain ${quote.destinationChain}`);
    }
    
    // Calculate fill deadline (current time + buffer)
    const fillDeadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour deadline
    const exclusivityDeadline = parseInt(quoteData.exclusivityDeadline) || 0;
    const quoteTimestamp = parseInt(quoteData.timestamp);
    
    // Encode depositV3 call
    const data = encodeFunctionData({
      abi: SPOKE_POOL_ABI,
      functionName: "depositV3",
      args: [
        request.sender, // depositor
        request.recipient, // recipient
        request.sourceToken, // inputToken
        request.destinationToken, // outputToken
        quote.inputAmount, // inputAmount
        quote.minOutputAmount, // outputAmount (min)
        BigInt(destinationChainId), // destinationChainId
        quoteData.exclusiveRelayer as `0x${string}`, // exclusiveRelayer
        quoteTimestamp, // quoteTimestamp
        fillDeadline, // fillDeadline
        exclusivityDeadline, // exclusivityDeadline
        "0x", // message (empty for simple transfers)
      ],
    });
    
    // Determine if native token (value needed)
    const isNativeToken = request.sourceToken.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
    const value = isNativeToken ? quote.inputAmount : 0n;
    
    return {
      id: `across-${quote.quoteId}`,
      provider: BridgeProvider.ACROSS,
      quoteId: quote.quoteId,
      quote,
      sourceChain: quote.sourceChain,
      destinationChain: quote.destinationChain,
      to: spokePool,
      data,
      value,
      gasLimit: 200000n, // Conservative gas limit
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
            spender: spokePool,
            amount: quote.inputAmount,
          },
    };
  }
  
  /**
   * Get the status of a bridge transaction
   */
  async getStatus(
    sourceTxHash: `0x${string}`,
    sourceChain: SupportedChain
  ): Promise<BridgeReceipt> {
    const originChainId = CHAIN_IDS[sourceChain];
    
    if (!originChainId) {
      throw new Error(`Unsupported chain ${sourceChain}`);
    }
    
    try {
      // Query Across API for deposit status
      const url = new URL(`${this.apiUrl}/deposit/status`);
      url.searchParams.set("originChainId", originChainId.toString());
      url.searchParams.set("depositTxHash", sourceTxHash);
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        // If not found, might still be pending
        return {
          provider: BridgeProvider.ACROSS,
          quoteId: "",
          status: BridgeStatus.PENDING,
          sourceTxHash,
          sourceChain,
          sourceConfirmations: 0,
          destinationChain: "ethereum" as SupportedChain, // Unknown until we have more info
          inputAmount: 0n,
          initiatedAt: Date.now(),
        };
      }
      
      const statusData = (await response.json()) as AcrossStatusResponse;
      
      // Map Across status to our status
      let status: BridgeStatus;
      switch (statusData.status) {
        case "filled":
          status = BridgeStatus.COMPLETED;
          break;
        case "expired":
          status = BridgeStatus.FAILED;
          break;
        default:
          status = BridgeStatus.BRIDGING;
      }
      
      // Find destination chain from chain ID
      const destinationChain = (Object.entries(CHAIN_IDS).find(
        ([_, id]) => id === statusData.destinationChainId
      )?.[0] || "ethereum") as SupportedChain;
      
      return {
        provider: BridgeProvider.ACROSS,
        quoteId: "",
        status,
        sourceTxHash,
        sourceChain,
        sourceConfirmations: 12, // Assume confirmed if we got status
        destinationTxHash: statusData.fillTx as `0x${string}` | undefined,
        destinationChain,
        destinationConfirmations: status === BridgeStatus.COMPLETED ? 1 : undefined,
        inputAmount: BigInt(statusData.amount),
        outputAmount: statusData.outputAmount ? BigInt(statusData.outputAmount) : undefined,
        depositId: statusData.depositId.toString(),
        initiatedAt: Date.now(), // Would need to track this
        completedAt: status === BridgeStatus.COMPLETED ? Date.now() : undefined,
      };
    } catch (error) {
      console.error("[Across] Error getting status:", error);
      throw error;
    }
  }
  
  /**
   * Check if a token/amount is eligible for fast fills
   */
  private isFastFillEligible(token: `0x${string}`, amount: bigint): boolean {
    // Fast fills work best for USDC and WETH under certain thresholds
    const usdcAddresses = Object.values(BRIDGE_CONFIG.USDC_ADDRESSES).map((a) =>
      a?.toLowerCase()
    );
    const wethAddresses = Object.values(BRIDGE_CONFIG.WETH_ADDRESSES).map((a) =>
      a?.toLowerCase()
    );
    
    const tokenLower = token.toLowerCase();
    const isSupportedToken =
      usdcAddresses.includes(tokenLower) || wethAddresses.includes(tokenLower);
    
    // Fast fills typically available for amounts under certain thresholds
    // USDC: < 250k, WETH: < 100
    const isUSDC = usdcAddresses.includes(tokenLower);
    const maxAmount = isUSDC ? 250000n * 10n ** 6n : 100n * 10n ** 18n;
    
    return isSupportedToken && amount <= maxAmount;
  }
}

/**
 * Create Across provider instance
 */
export function createAcrossProvider(apiUrl?: string): AcrossBridgeProvider {
  return new AcrossBridgeProvider(apiUrl);
}

/**
 * Get Across SpokePool address for a chain
 */
export function getAcrossSpokePool(chain: SupportedChain): `0x${string}` | null {
  return ACROSS_SPOKE_POOLS[chain] || null;
}
