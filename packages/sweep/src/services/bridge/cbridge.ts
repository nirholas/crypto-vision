/**
 * Celer cBridge Integration
 * Multi-chain liquidity network
 * https://cbridge.celer.network/
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
 * cBridge API response types
 */
interface CbridgeEstimateResponse {
  err: null | { code: number; msg: string };
  estimated_receive_amt: string;
  base_fee: string;
  perc_fee: string;
  slippage_tolerance: number;
  max_slippage: number;
  bridge_rate: number;
  op_type: "liq_add" | "liq_withdraw" | "send";
}

interface CbridgeTransferStatusResponse {
  err: null | { code: number; msg: string };
  status: number; // 0: unknown, 1: submitting, 2: pending, 3: completed, 4: failed, 5: refunded
  wd_onchain: boolean;
  sorted_sigs: string[];
  signers: string[];
  powers: string[];
  refund_reason: number;
  block_delay: number;
  src_block_tx_link: string;
  dst_block_tx_link: string;
}

interface CbridgeTransferConfigResponse {
  err: null | { code: number; msg: string };
  chains: {
    id: number;
    name: string;
    icon: string;
    block_delay: number;
    gas_token_symbol: string;
    explore_url: string;
    contract_addr: string;
    drop_gas_amt: string;
  }[];
  chain_token: {
    [chainId: string]: {
      token: {
        address: string;
        symbol: string;
        decimal: number;
        xfer_disabled: boolean;
      }[];
    };
  };
  farming_reward_contract_addr: string;
  pegged_pair_configs: any[];
}

/**
 * cBridge contract addresses per chain
 */
const CBRIDGE_CONTRACT_ADDRESSES: Partial<Record<SupportedChain, `0x${string}`>> = {
  ethereum: "0x5427FEFA711Eff984124bFBB1AB6fbf5E3DA1820",
  base: "0x7d43AABC515C356145049227CeE54B608342c0ad",
  arbitrum: "0x1619DE6B6B20eD217a58d00f37B9d47C7663feca",
  polygon: "0x88DCDC47D2f83a99CF0000FDF667A468bB958a78",
  optimism: "0x9D39Fc627A6d9d9F8C831c16995b209548cc3401",
  bsc: "0xdd90E5E87A2081Dcf0391920868eBc2FFB81a1aF",
};

/**
 * Chain IDs for cBridge API
 */
const CBRIDGE_CHAIN_IDS: Partial<Record<SupportedChain, number>> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  optimism: 10,
  bsc: 56,
  linea: 59144,
};

/**
 * cBridge contract ABI (partial)
 */
const CBRIDGE_ABI = parseAbi([
  "function send(address _receiver, address _token, uint256 _amount, uint64 _dstChainId, uint64 _nonce, uint32 _maxSlippage) external",
  "function sendNative(address _receiver, uint256 _amount, uint64 _dstChainId, uint64 _nonce, uint32 _maxSlippage) external payable",
]);

/**
 * Celer cBridge provider
 */
export class CbridgeBridgeProvider implements IBridgeProvider {
  readonly name = BridgeProvider.CBRIDGE;

  private readonly apiUrl: string;
  private readonly cachePrefix = "cbridge";
  private transferConfig: CbridgeTransferConfigResponse | null = null;

  constructor(apiUrl: string = "https://cbridge-prod2.celer.app/v2") {
    this.apiUrl = apiUrl;
  }

  /**
   * Fetch transfer config from cBridge API
   */
  private async getTransferConfig(): Promise<CbridgeTransferConfigResponse | null> {
    if (this.transferConfig) {
      return this.transferConfig;
    }

    const cacheKey = `${this.cachePrefix}:config`;
    const cached = await cacheGet<CbridgeTransferConfigResponse>(cacheKey);
    if (cached) {
      this.transferConfig = cached;
      return cached;
    }

    try {
      const response = await fetch(`${this.apiUrl}/getTransferConfigs`);
      if (!response.ok) {
        return null;
      }

      const config = (await response.json()) as CbridgeTransferConfigResponse;
      if (config.err) {
        console.warn("[cBridge] Config error:", config.err);
        return null;
      }

      this.transferConfig = config;
      await cacheSet(cacheKey, config, 3600); // Cache for 1 hour

      return config;
    } catch (error) {
      console.error("[cBridge] Error fetching config:", error);
      return null;
    }
  }

  /**
   * Check if cBridge supports a route
   */
  async supportsRoute(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    token: `0x${string}`
  ): Promise<boolean> {
    // Check if both chains have contracts
    if (
      !CBRIDGE_CONTRACT_ADDRESSES[sourceChain] ||
      !CBRIDGE_CONTRACT_ADDRESSES[destinationChain]
    ) {
      return false;
    }

    const srcChainId = CBRIDGE_CHAIN_IDS[sourceChain];
    const dstChainId = CBRIDGE_CHAIN_IDS[destinationChain];

    if (!srcChainId || !dstChainId) {
      return false;
    }

    // Fetch transfer config to check token support
    const config = await this.getTransferConfig();
    if (!config) {
      return false;
    }

    // Check if token is supported on both chains
    const srcTokens = config.chain_token[srcChainId.toString()]?.token || [];
    const dstTokens = config.chain_token[dstChainId.toString()]?.token || [];

    const srcToken = srcTokens.find(
      (t) => t.address.toLowerCase() === token.toLowerCase() && !t.xfer_disabled
    );
    const dstToken = dstTokens.find(
      (t) => t.symbol === srcToken?.symbol && !t.xfer_disabled
    );

    return srcToken !== undefined && dstToken !== undefined;
  }

  /**
   * Get quote for bridging
   */
  async getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote | null> {
    const srcChainId = CBRIDGE_CHAIN_IDS[request.sourceChain];
    const dstChainId = CBRIDGE_CHAIN_IDS[request.destinationChain];

    if (!srcChainId || !dstChainId) {
      return null;
    }

    const bridgeAddress = CBRIDGE_CONTRACT_ADDRESSES[request.sourceChain];
    if (!bridgeAddress) {
      return null;
    }

    // Get token info from config
    const config = await this.getTransferConfig();
    if (!config) {
      return null;
    }

    const srcTokens = config.chain_token[srcChainId.toString()]?.token || [];
    const srcTokenInfo = srcTokens.find(
      (t) =>
        t.address.toLowerCase() === request.sourceToken.toLowerCase() &&
        !t.xfer_disabled
    );

    if (!srcTokenInfo) {
      console.warn("[cBridge] Token not supported on source chain");
      return null;
    }

    // Find destination token
    const dstTokens = config.chain_token[dstChainId.toString()]?.token || [];
    const dstTokenInfo = dstTokens.find(
      (t) => t.symbol === srcTokenInfo.symbol && !t.xfer_disabled
    );

    if (!dstTokenInfo) {
      console.warn("[cBridge] Token not supported on destination chain");
      return null;
    }

    try {
      // Fetch estimate from cBridge API
      const slippage = request.slippage ?? BRIDGE_CONFIG.DEFAULT_SLIPPAGE;
      const slippagePermil = Math.floor(slippage * 1000000); // cBridge uses permil (parts per million)

      const url = new URL(`${this.apiUrl}/estimateAmt`);
      url.searchParams.set("src_chain_id", srcChainId.toString());
      url.searchParams.set("dst_chain_id", dstChainId.toString());
      url.searchParams.set("token_symbol", srcTokenInfo.symbol);
      url.searchParams.set("amt", request.amount.toString());
      url.searchParams.set("usr_addr", request.sender);
      url.searchParams.set("slippage_tolerance", slippagePermil.toString());

      const response = await fetch(url.toString());
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[cBridge] Estimate request failed: ${response.status} - ${errorText}`);
        return null;
      }

      const estimate = (await response.json()) as CbridgeEstimateResponse;

      if (estimate.err) {
        console.warn("[cBridge] Estimate error:", estimate.err);
        return null;
      }

      const outputAmount = BigInt(estimate.estimated_receive_amt);
      const baseFee = BigInt(estimate.base_fee);
      const percFee = BigInt(estimate.perc_fee);
      const totalFee = baseFee + percFee;

      // Calculate minimum output with slippage
      const minOutputAmount =
        outputAmount - (outputAmount * BigInt(Math.floor(slippage * 10000))) / 10000n;

      // Generate quote ID
      const quoteId = `cbridge-${request.sourceChain}-${request.destinationChain}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const quote: BridgeQuote = {
        provider: BridgeProvider.CBRIDGE,
        sourceChain: request.sourceChain,
        destinationChain: request.destinationChain,
        sourceToken: {
          address: request.sourceToken,
          symbol: srcTokenInfo.symbol,
          decimals: srcTokenInfo.decimal,
          chain: request.sourceChain,
        },
        destinationToken: {
          address: dstTokenInfo.address as `0x${string}`,
          symbol: dstTokenInfo.symbol,
          decimals: dstTokenInfo.decimal,
          chain: request.destinationChain,
        },
        inputAmount: request.amount,
        outputAmount,
        minOutputAmount,
        fees: {
          bridgeFee: baseFee,
          gasFee: 0n, // Paid by user in native token
          relayerFee: percFee,
          totalFeeUsd: 0, // Would need price conversion
        },
        feeUsd: 0,
        estimatedTime: 240, // ~4 minutes typical for cBridge
        route: {
          steps: [
            {
              type: "bridge",
              chain: request.sourceChain,
              protocol: "Celer cBridge",
              fromToken: request.sourceToken,
              toToken: dstTokenInfo.address as `0x${string}`,
              fromAmount: request.amount.toString(),
              toAmount: outputAmount.toString(),
              amount: request.amount,
              expectedOutput: outputAmount,
            },
          ],
          totalGasEstimate: 200000n,
          requiresApproval: srcTokenInfo.symbol !== "ETH",
          approvalAddress: bridgeAddress,
        },
        expiresAt: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
        expiry: Date.now() + BRIDGE_CONFIG.QUOTE_TTL_SECONDS * 1000,
        quoteId,
        maxSlippage: estimate.max_slippage / 1000000, // Convert from permil
      };

      // Cache quote data
      await cacheSet(
        `${this.cachePrefix}:quote:${quoteId}`,
        {
          quote,
          estimate,
          request,
          srcTokenInfo,
          dstTokenInfo,
          bridgeAddress,
        },
        BRIDGE_CONFIG.QUOTE_TTL_SECONDS
      );

      return quote;
    } catch (error) {
      console.error("[cBridge] Error getting quote:", error);
      return null;
    }
  }

  /**
   * Build bridge transaction
   */
  async buildTransaction(quote: BridgeQuote): Promise<BridgeTransaction> {
    const cached = await cacheGet<{
      quote: BridgeQuote;
      estimate: CbridgeEstimateResponse;
      request: BridgeQuoteRequest;
      srcTokenInfo: { symbol: string; decimal: number; address: string };
      bridgeAddress: `0x${string}`;
    }>(`${this.cachePrefix}:quote:${quote.quoteId}`);

    if (!cached) {
      throw new Error("Quote expired or not found");
    }

    const { estimate, request, srcTokenInfo, bridgeAddress } = cached;

    const dstChainId = CBRIDGE_CHAIN_IDS[quote.destinationChain];
    if (!dstChainId) {
      throw new Error(`Unsupported destination chain ${quote.destinationChain}`);
    }

    // Generate unique nonce
    const nonce = BigInt(Date.now());

    // Max slippage in basis points (permil in cBridge)
    const maxSlippage = Math.floor(estimate.max_slippage);

    const isNativeToken = srcTokenInfo.symbol === "ETH";

    let data: `0x${string}`;
    let value: bigint;

    if (isNativeToken) {
      data = encodeFunctionData({
        abi: CBRIDGE_ABI,
        functionName: "sendNative",
        args: [
          request.recipient,
          quote.inputAmount,
          BigInt(dstChainId),
          nonce,
          maxSlippage,
        ],
      });
      value = quote.inputAmount;
    } else {
      data = encodeFunctionData({
        abi: CBRIDGE_ABI,
        functionName: "send",
        args: [
          request.recipient,
          request.sourceToken,
          quote.inputAmount,
          BigInt(dstChainId),
          nonce,
          maxSlippage,
        ],
      });
      value = 0n;
    }

    return {
      id: `cbridge-tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      provider: BridgeProvider.CBRIDGE,
      quoteId: quote.quoteId,
      quote,
      sourceChain: quote.sourceChain,
      destinationChain: quote.destinationChain,
      to: bridgeAddress,
      data,
      value,
      gasLimit: 250000n,
      sourceToken: quote.sourceToken,
      destinationToken: quote.destinationToken,
      inputAmount: quote.inputAmount,
      expectedOutput: quote.outputAmount,
      minOutput: quote.minOutputAmount,
      nonce,
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
      // Query cBridge API for transfer status
      const url = new URL(`${this.apiUrl}/getTransferStatus`);
      url.searchParams.set("transfer_id", sourceTxHash);

      const response = await fetch(url.toString());

      if (!response.ok) {
        return this.createPendingReceipt(sourceTxHash, sourceChain);
      }

      const data = (await response.json()) as CbridgeTransferStatusResponse;

      if (data.err) {
        return this.createPendingReceipt(sourceTxHash, sourceChain, data.err.msg);
      }

      // Map cBridge status to our status
      let status: BridgeStatus;
      switch (data.status) {
        case 3: // Completed
          status = BridgeStatus.COMPLETED;
          break;
        case 4: // Failed
          status = BridgeStatus.FAILED;
          break;
        case 5: // Refunded
          status = BridgeStatus.REFUNDED;
          break;
        case 1: // Submitting
        case 2: // Pending
          status = BridgeStatus.BRIDGING;
          break;
        default:
          status = BridgeStatus.PENDING;
      }

      // Extract destination tx hash from block link if available
      let destTxHash: `0x${string}` | undefined;
      if (data.dst_block_tx_link) {
        const match = data.dst_block_tx_link.match(/0x[a-fA-F0-9]{64}/);
        if (match) {
          destTxHash = match[0] as `0x${string}`;
        }
      }

      return {
        provider: BridgeProvider.CBRIDGE,
        quoteId: "",
        status,
        sourceTxHash,
        sourceChain,
        sourceConfirmations: status !== BridgeStatus.PENDING ? data.block_delay : 0,
        destinationTxHash: destTxHash,
        destinationChain: "ethereum" as SupportedChain, // Would need to track this
        destinationConfirmations: status === BridgeStatus.COMPLETED ? 1 : undefined,
        inputAmount: 0n, // Would need to decode from tx
        initiatedAt: Date.now(),
        completedAt: status === BridgeStatus.COMPLETED ? Date.now() : undefined,
      };
    } catch (error) {
      console.error("[cBridge] Error getting status:", error);
      return this.createPendingReceipt(
        sourceTxHash,
        sourceChain,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
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
      provider: BridgeProvider.CBRIDGE,
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
 * Create cBridge provider instance
 */
export function createCbridgeProvider(apiUrl?: string): CbridgeBridgeProvider {
  return new CbridgeBridgeProvider(apiUrl);
}

/**
 * Get cBridge contract address for a chain
 */
export function getCbridgeAddress(chain: SupportedChain): `0x${string}` | null {
  return CBRIDGE_CONTRACT_ADDRESSES[chain] || null;
}
