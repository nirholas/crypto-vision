/**
 * Stargate V2 Integration
 * Cross-chain bridging via LayerZero
 * https://stargate.finance/
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
 * Stargate V2 Router addresses
 */
const STARGATE_ROUTERS: Partial<Record<SupportedChain, `0x${string}`>> = {
  ethereum: "0x77b2043768d28E9C9aB44E1aBfC95944bcE57931",
  base: "0x45f1A95A4D3f3836523F5c83673c797f4d4d263B",
  arbitrum: "0x53Bf833A5d6c4ddA888F69c22C88C9f356a41614",
  polygon: "0x45A01E4e04F14f7A4a6702c74187c5F6222033cd",
  optimism: "0xB0D502E938ed5f4df2E681fE6E419ff29631d62b",
  bsc: "0x4a364f8c717cAAD9A442737Eb7b8A55cc6cf18D8",
  linea: "0x2F6F07CDcf3588944Bf4C42aC74ff24bF56e7590",
};

/**
 * Stargate Pool IDs per chain/token
 * Stargate uses pool IDs to identify tokens
 */
const STARGATE_POOL_IDS: Partial<
  Record<SupportedChain, Partial<Record<string, number>>>
> = {
  ethereum: {
    USDC: 1,
    USDT: 2,
    ETH: 13,
    WETH: 13,
  },
  base: {
    USDC: 1,
    ETH: 13,
  },
  arbitrum: {
    USDC: 1,
    USDT: 2,
    ETH: 13,
    WETH: 13,
  },
  polygon: {
    USDC: 1,
    USDT: 2,
  },
  optimism: {
    USDC: 1,
    ETH: 13,
  },
  bsc: {
    USDT: 2,
    BUSD: 5,
  },
};

/**
 * LayerZero Endpoint IDs
 */
const LZ_ENDPOINT_IDS: Partial<Record<SupportedChain, number>> = {
  ethereum: 101,
  base: 184,
  arbitrum: 110,
  polygon: 109,
  optimism: 111,
  bsc: 102,
  linea: 183,
};

/**
 * Stargate V2 Router ABI (partial)
 */
const STARGATE_ROUTER_ABI = parseAbi([
  "function swap(uint16 _dstChainId, uint256 _srcPoolId, uint256 _dstPoolId, address payable _refundAddress, uint256 _amountLD, uint256 _minAmountLD, (uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams, bytes _to, bytes _payload) payable",
  "function quoteLayerZeroFee(uint16 _dstChainId, uint8 _functionType, bytes _toAddress, bytes _transferAndCallPayload, (uint256 dstGasForCall, uint256 dstNativeAmount, bytes dstNativeAddr) _lzTxParams) view returns (uint256 nativeFee, uint256 zroFee)",
]);

/**
 * Stargate Pool ABI for fee calculation
 */
const STARGATE_POOL_ABI = parseAbi([
  "function getChainPath(uint16 _dstChainId) view returns (uint256 ready, uint256 balance, uint256 weight, uint256 credits)",
  "function convertRate() view returns (uint256)",
  "function totalLiquidity() view returns (uint256)",
]);

/**
 * Stargate API response types
 */
interface StargateQuoteResponse {
  srcPoolId: number;
  dstPoolId: number;
  dstChainId: number;
  amountSD: string;
  amountLD: string;
  eqFee: string;
  eqReward: string;
  lpFee: string;
  protocolFee: string;
  lzFee: string;
  minAmountLD: string;
  expectedTime: number;
}

/**
 * Stargate V2 bridge provider
 */
export class StargateBridgeProvider implements IBridgeProvider {
  readonly name = BridgeProvider.STARGATE;
  
  private readonly apiUrl: string;
  private readonly cachePrefix = "stargate";
  
  constructor(apiUrl: string = "https://api.stargate.finance") {
    this.apiUrl = apiUrl;
  }
  
  /**
   * Check if Stargate supports a route
   */
  async supportsRoute(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    token: `0x${string}`
  ): Promise<boolean> {
    // Check if both chains have routers
    if (!STARGATE_ROUTERS[sourceChain] || !STARGATE_ROUTERS[destinationChain]) {
      return false;
    }
    
    // Check if token has pool IDs on both chains
    const tokenSymbol = await this.getTokenSymbol(token, sourceChain);
    if (!tokenSymbol) {
      return false;
    }
    
    const srcPoolId = STARGATE_POOL_IDS[sourceChain]?.[tokenSymbol];
    const dstPoolId = STARGATE_POOL_IDS[destinationChain]?.[tokenSymbol];
    
    return srcPoolId !== undefined && dstPoolId !== undefined;
  }
  
  /**
   * Get quote for bridging
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote | null> {
    const router = STARGATE_ROUTERS[request.sourceChain];
    if (!router) {
      return null;
    }
    
    const dstChainId = LZ_ENDPOINT_IDS[request.destinationChain];
    if (!dstChainId) {
      return null;
    }
    
    // Get pool IDs
    const tokenSymbol = await this.getTokenSymbol(request.sourceToken, request.sourceChain);
    if (!tokenSymbol) {
      console.warn("[Stargate] Unknown token symbol");
      return null;
    }
    
    const srcPoolId = STARGATE_POOL_IDS[request.sourceChain]?.[tokenSymbol];
    const dstPoolId = STARGATE_POOL_IDS[request.destinationChain]?.[tokenSymbol];
    
    if (srcPoolId === undefined || dstPoolId === undefined) {
      console.warn("[Stargate] Pool not supported on route");
      return null;
    }
    
    try {
      // Try API first for accurate quote
      const apiQuote = await this.fetchApiQuote(request, srcPoolId, dstPoolId, dstChainId);
      
      if (apiQuote) {
        return apiQuote;
      }
      
      // Fallback to estimation
      return this.estimateQuote(request, srcPoolId, dstPoolId, dstChainId, router);
    } catch (error) {
      console.error("[Stargate] Error getting quote:", error);
      return null;
    }
  }
  
  /**
   * Fetch quote from Stargate API
   */
  private async fetchApiQuote(
    request: BridgeQuoteRequest,
    srcPoolId: number,
    dstPoolId: number,
    dstChainId: number
  ): Promise<BridgeQuote | null> {
    const cacheKey = `${this.cachePrefix}:quote:${request.sourceChain}:${request.destinationChain}:${srcPoolId}:${request.amount}`;
    const cached = await cacheGet<StargateQuoteResponse>(cacheKey);
    
    if (cached) {
      return this.buildQuoteFromApiResponse(cached, request);
    }
    
    try {
      const url = new URL(`${this.apiUrl}/v1/quote`);
      url.searchParams.set("srcChain", request.sourceChain);
      url.searchParams.set("dstChain", request.destinationChain);
      url.searchParams.set("srcPoolId", srcPoolId.toString());
      url.searchParams.set("dstPoolId", dstPoolId.toString());
      url.searchParams.set("amount", request.amount.toString());
      
      const response = await fetch(url.toString());
      if (!response.ok) {
        return null;
      }
      
      const data = (await response.json()) as StargateQuoteResponse;
      await cacheSet(cacheKey, data, 30); // Cache for 30 seconds
      
      return this.buildQuoteFromApiResponse(data, request);
    } catch {
      return null;
    }
  }
  
  /**
   * Build quote from API response
   */
  private buildQuoteFromApiResponse(
    data: StargateQuoteResponse,
    request: BridgeQuoteRequest
  ): BridgeQuote {
    const outputAmount = BigInt(data.minAmountLD);
    const slippage = request.slippage ?? BRIDGE_CONFIG.DEFAULT_SLIPPAGE;
    const minOutputAmount = outputAmount - (outputAmount * BigInt(Math.floor(slippage * 10000))) / 10000n;
    
    const quoteId = `stargate-${request.sourceChain}-${request.destinationChain}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const quote: BridgeQuote = {
      provider: BridgeProvider.STARGATE,
      sourceChain: request.sourceChain,
      destinationChain: request.destinationChain,
      sourceToken: {
        address: request.sourceToken,
        symbol: "TOKEN",
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
        bridgeFee: BigInt(data.protocolFee),
        gasFee: BigInt(data.lzFee),
        relayerFee: 0n,
        lpFee: BigInt(data.lpFee),
        totalFeeUsd: 0, // Would need price conversion
      },
      feeUsd: 0, // Would need price conversion
      estimatedTime: data.expectedTime || 300, // Default 5 minutes
      route: {
        steps: [
          {
            type: "bridge",
            chain: request.sourceChain,
            protocol: "Stargate V2",
            fromToken: request.sourceToken,
            toToken: request.destinationToken,
            fromAmount: request.amount.toString(),
            toAmount: outputAmount.toString(),
            amount: request.amount,
            expectedOutput: outputAmount,
          },
        ],
        totalGasEstimate: 300000n, // Stargate tends to use more gas
        requiresApproval: true,
        approvalAddress: STARGATE_ROUTERS[request.sourceChain],
      },
      expiresAt: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
      expiry: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
      quoteId,
      maxSlippage: slippage,
    };
    
    // Cache quote data
    cacheSet(`${this.cachePrefix}:quoteData:${quoteId}`, {
      quote,
      request,
      srcPoolId: data.srcPoolId,
      dstPoolId: data.dstPoolId,
      dstChainId: data.dstChainId,
    }, BRIDGE_CONFIG.QUOTE_TTL_SECONDS);
    
    return quote;
  }
  
  /**
   * Estimate quote when API unavailable
   */
  private async estimateQuote(
    request: BridgeQuoteRequest,
    srcPoolId: number,
    dstPoolId: number,
    dstChainId: number,
    router: `0x${string}`
  ): Promise<BridgeQuote> {
    // Estimate 0.06% fee (typical Stargate fee)
    const estimatedFee = (request.amount * 6n) / 10000n;
    const outputAmount = request.amount - estimatedFee;
    
    const slippage = request.slippage ?? BRIDGE_CONFIG.DEFAULT_SLIPPAGE;
    const minOutputAmount = outputAmount - (outputAmount * BigInt(Math.floor(slippage * 10000))) / 10000n;
    
    const quoteId = `stargate-${request.sourceChain}-${request.destinationChain}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    
    const quote: BridgeQuote = {
      provider: BridgeProvider.STARGATE,
      sourceChain: request.sourceChain,
      destinationChain: request.destinationChain,
      sourceToken: {
        address: request.sourceToken,
        symbol: "TOKEN",
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
        bridgeFee: estimatedFee / 2n,
        gasFee: estimatedFee / 4n,
        relayerFee: 0n,
        lpFee: estimatedFee / 4n,
        totalFeeUsd: 0,
      },
      feeUsd: 0,
      estimatedTime: 300, // 5 minutes typical
      route: {
        steps: [
          {
            type: "bridge",
            chain: request.sourceChain,
            protocol: "Stargate V2",
            fromToken: request.sourceToken,
            toToken: request.destinationToken,
            fromAmount: request.amount.toString(),
            toAmount: outputAmount.toString(),
            amount: request.amount,
            expectedOutput: outputAmount,
          },
        ],
        totalGasEstimate: 300000n,
        requiresApproval: true,
        approvalAddress: router,
      },
      expiresAt: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
      expiry: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
      quoteId,
      maxSlippage: slippage,
    };
    
    // Cache quote data
    await cacheSet(`${this.cachePrefix}:quoteData:${quoteId}`, {
      quote,
      request,
      srcPoolId,
      dstPoolId,
      dstChainId,
    }, BRIDGE_CONFIG.QUOTE_TTL_SECONDS);
    
    return quote;
  }
  
  /**
   * Build bridge transaction
   */
  async buildTransaction(quote: BridgeQuote): Promise<BridgeTransaction> {
    // Get cached quote data
    const cached = await cacheGet<{
      quote: BridgeQuote;
      request: BridgeQuoteRequest;
      srcPoolId: number;
      dstPoolId: number;
      dstChainId: number;
    }>(`${this.cachePrefix}:quoteData:${quote.quoteId}`);
    
    if (!cached) {
      throw new Error("Quote expired or not found");
    }
    
    const { request, srcPoolId, dstPoolId, dstChainId } = cached;
    const router = STARGATE_ROUTERS[quote.sourceChain];
    
    if (!router) {
      throw new Error(`No Stargate router for chain ${quote.sourceChain}`);
    }
    
    const lzEndpointId = LZ_ENDPOINT_IDS[quote.destinationChain];
    if (!lzEndpointId) {
      throw new Error(`Unsupported destination chain ${quote.destinationChain}`);
    }
    
    // LayerZero transaction params
    const lzTxParams = {
      dstGasForCall: 0n, // No additional gas for simple transfer
      dstNativeAmount: 0n, // No native token airdrop
      dstNativeAddr: "0x" as `0x${string}`,
    };
    
    // Encode recipient address
    const toAddress = `0x${request.recipient.slice(2).padStart(64, "0")}` as `0x${string}`;
    
    // Encode swap call
    const data = encodeFunctionData({
      abi: STARGATE_ROUTER_ABI,
      functionName: "swap",
      args: [
        lzEndpointId, // _dstChainId (LayerZero endpoint ID)
        BigInt(srcPoolId), // _srcPoolId
        BigInt(dstPoolId), // _dstPoolId
        request.sender, // _refundAddress
        quote.inputAmount, // _amountLD
        quote.minOutputAmount, // _minAmountLD
        lzTxParams, // _lzTxParams
        toAddress, // _to
        "0x", // _payload (empty for simple swap)
      ],
    });
    
    // Estimate LayerZero fee (native token for messaging)
    const estimatedLzFee = quote.fees.gasFee || 100000000000000n; // ~0.0001 ETH fallback
    
    return {
      id: `stargate-${quote.quoteId}`,
      provider: BridgeProvider.STARGATE,
      quoteId: quote.quoteId,
      quote,
      sourceChain: quote.sourceChain,
      destinationChain: quote.destinationChain,
      to: router,
      data,
      value: estimatedLzFee, // LayerZero fee paid in native token
      gasLimit: 400000n, // Conservative for Stargate
      sourceToken: quote.sourceToken,
      destinationToken: quote.destinationToken,
      inputAmount: quote.inputAmount,
      expectedOutput: quote.outputAmount,
      minOutput: quote.minOutputAmount,
      nonce: BigInt(Date.now()), // Use as tracking reference
      status: BridgeStatus.PENDING,
      createdAt: Date.now(),
      approval: {
        token: request.sourceToken,
        spender: router,
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
      // Query LayerZero scan for transaction status
      const lzScanUrl = `https://api-mainnet.layerzero-scan.com/tx/${sourceTxHash}`;
      
      const response = await fetch(lzScanUrl);
      
      if (!response.ok) {
        // Transaction may still be pending
        return {
          provider: BridgeProvider.STARGATE,
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
      
      const data = await response.json() as {
        status: string;
        srcTxHash: string;
        dstTxHash?: string;
        srcChainId: number;
        dstChainId: number;
        srcUaAddress: string;
        dstUaAddress: string;
        srcBlockNumber: number;
        dstBlockNumber?: number;
        nonce: number;
        status_name: string;
      };
      
      // Map LayerZero status to our status
      let status: BridgeStatus;
      switch (data.status_name?.toLowerCase()) {
        case "delivered":
          status = BridgeStatus.COMPLETED;
          break;
        case "inflight":
          status = BridgeStatus.BRIDGING;
          break;
        case "failed":
          status = BridgeStatus.FAILED;
          break;
        default:
          status = BridgeStatus.PENDING;
      }
      
      // Find destination chain
      const destinationChain = (Object.entries(LZ_ENDPOINT_IDS).find(
        ([_, id]) => id === data.dstChainId
      )?.[0] || "ethereum") as SupportedChain;
      
      return {
        provider: BridgeProvider.STARGATE,
        quoteId: "",
        status,
        sourceTxHash,
        sourceChain,
        sourceConfirmations: data.srcBlockNumber ? 12 : 0,
        destinationTxHash: data.dstTxHash as `0x${string}` | undefined,
        destinationChain,
        destinationConfirmations: data.dstBlockNumber ? 1 : undefined,
        inputAmount: 0n, // Would need to decode from tx
        nonce: BigInt(data.nonce),
        initiatedAt: Date.now(),
        completedAt: status === BridgeStatus.COMPLETED ? Date.now() : undefined,
      };
    } catch (error) {
      console.error("[Stargate] Error getting status:", error);
      
      return {
        provider: BridgeProvider.STARGATE,
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
    // Check USDC addresses
    const usdcAddress = BRIDGE_CONFIG.USDC_ADDRESSES[chain];
    if (usdcAddress && token.toLowerCase() === usdcAddress.toLowerCase()) {
      return "USDC";
    }
    
    // Check WETH addresses
    const wethAddress = BRIDGE_CONFIG.WETH_ADDRESSES[chain];
    if (wethAddress && token.toLowerCase() === wethAddress.toLowerCase()) {
      return "WETH";
    }
    
    // Native ETH
    if (token.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee") {
      return "ETH";
    }
    
    // Would need to fetch from chain for other tokens
    // For now, return null for unknown tokens
    return null;
  }
}

/**
 * Create Stargate provider instance
 */
export function createStargateProvider(apiUrl?: string): StargateBridgeProvider {
  return new StargateBridgeProvider(apiUrl);
}

/**
 * Get Stargate router address for a chain
 */
export function getStargateRouter(chain: SupportedChain): `0x${string}` | null {
  return STARGATE_ROUTERS[chain] || null;
}

/**
 * Get LayerZero endpoint ID for a chain
 */
export function getLzEndpointId(chain: SupportedChain): number | null {
  return LZ_ENDPOINT_IDS[chain] || null;
}
