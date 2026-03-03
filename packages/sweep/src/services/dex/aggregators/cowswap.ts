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

// CoW Protocol API endpoints
const COW_API_ENDPOINTS: Record<number, string> = {
  1: "https://api.cow.fi/mainnet/api/v1",
  100: "https://api.cow.fi/xdai/api/v1", // Gnosis Chain
  42161: "https://api.cow.fi/arbitrum_one/api/v1",
  8453: "https://api.cow.fi/base/api/v1",
};

// CoW Protocol app data (identifies Sweep orders)
const SWEEP_APP_DATA =
  "0x0000000000000000000000000000000000000000000000000000007377656570"; // "swep" in hex

interface CowQuoteRequest {
  sellToken: string;
  buyToken: string;
  sellAmountBeforeFee?: string;
  buyAmountAfterFee?: string;
  kind: "sell" | "buy";
  receiver?: string;
  validTo?: number;
  appData?: string;
  partiallyFillable?: boolean;
  sellTokenBalance?: "erc20" | "internal" | "external";
  buyTokenBalance?: "erc20" | "internal";
  from: string;
  priceQuality?: "fast" | "optimal";
  signingScheme?: "eip712" | "ethsign" | "presign" | "eip1271";
  onchainOrder?: boolean;
}

interface CowQuoteResponse {
  quote: {
    sellToken: string;
    buyToken: string;
    receiver: string;
    sellAmount: string;
    buyAmount: string;
    validTo: number;
    appData: string;
    feeAmount: string;
    kind: string;
    partiallyFillable: boolean;
    sellTokenBalance: string;
    buyTokenBalance: string;
    signingScheme: string;
  };
  from: string;
  expiration: string;
  id: number;
  verified: boolean;
}

interface CowOrderCreation {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  buyAmount: string;
  validTo: number;
  appData: string;
  feeAmount: string;
  kind: string;
  partiallyFillable: boolean;
  receiver: string;
  signature: string;
  signingScheme: string;
}

export class CowSwapAggregator implements IDexAggregator {
  name: "cowswap" = "cowswap";
  supportedChains: SupportedChain[] = ["ethereum", "arbitrum", "base"];

  isAvailable(chain: SupportedChain): boolean {
    return this.supportedChains.includes(chain);
  }

  private getApiEndpoint(chainId: number): string | null {
    return COW_API_ENDPOINTS[chainId] || null;
  }

  async getQuote(request: QuoteRequest): Promise<DexQuote | null> {
    if (!this.isAvailable(request.chain)) {
      return null;
    }

    const chainId = CHAIN_IDS[request.chain];
    const apiEndpoint = this.getApiEndpoint(chainId);

    if (!apiEndpoint) {
      return null;
    }

    const slippage = request.slippage ?? DEFAULT_SLIPPAGE;

    try {
      // CoW Protocol doesn't support native ETH directly
      // Must use WETH
      let sellToken = request.inputToken;
      let buyToken = request.outputToken;

      if (isNativeToken(request.inputToken)) {
        sellToken = WRAPPED_NATIVE_TOKEN[request.chain];
      }
      if (isNativeToken(request.outputToken)) {
        buyToken = WRAPPED_NATIVE_TOKEN[request.chain];
      }

      const quoteRequest: CowQuoteRequest = {
        sellToken,
        buyToken,
        sellAmountBeforeFee: request.inputAmount,
        kind: "sell",
        from: request.userAddress,
        receiver: request.receiver || request.userAddress,
        validTo: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
        appData: SWEEP_APP_DATA,
        partiallyFillable: false,
        priceQuality: "optimal",
        signingScheme: "eip712",
      };

      const response = await fetch(`${apiEndpoint}/quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(quoteRequest),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("CoW Protocol quote API error:", error);
        return null;
      }

      const data = (await response.json()) as CowQuoteResponse;

      // Calculate effective output after fee
      const sellAmountAfterFee =
        BigInt(request.inputAmount) - BigInt(data.quote.feeAmount);

      return {
        aggregator: "cowswap",
        inputToken: {
          address: data.quote.sellToken,
          symbol: "UNKNOWN",
          decimals: 18,
        },
        outputToken: {
          address: data.quote.buyToken,
          symbol: "UNKNOWN",
          decimals: 18,
        },
        inputAmount: request.inputAmount,
        outputAmount: data.quote.buyAmount,
        priceImpact: 0, // CoW doesn't provide price impact directly
        estimatedGas: "0", // CoW orders are gasless for the user!
        estimatedGasUsd: 0,
        allowanceTarget: this.getVaultRelayer(chainId),
        slippage,
        expiresAt: data.quote.validTo,
        metadata: {
          quote: data.quote,
          quoteId: data.id,
          feeAmount: data.quote.feeAmount,
          verified: data.verified,
          sellAmountAfterFee: sellAmountAfterFee.toString(),
        },
      };
    } catch (error) {
      console.error("CoW Protocol quote error:", error);
      return null;
    }
  }

  // Get the GPv2VaultRelayer address for approvals
  private getVaultRelayer(chainId: number): string {
    // Same address on all supported chains
    return "0xC92E8bdf79f0507f65a392b0ab4667716BFE0110";
  }

  // Create and submit an order to CoW Protocol
  async createOrder(
    quote: DexQuote,
    signature: string
  ): Promise<string | null> {
    if (!quote.metadata?.quote) {
      throw new Error("Quote metadata missing - cannot create order");
    }

    const chainId = CHAIN_IDS[quote.inputToken.chainId as unknown as SupportedChain] || 1;
    const apiEndpoint = this.getApiEndpoint(chainId);

    if (!apiEndpoint) {
      return null;
    }

    const cowQuote = quote.metadata.quote as CowQuoteResponse["quote"];

    const order: CowOrderCreation = {
      sellToken: cowQuote.sellToken,
      buyToken: cowQuote.buyToken,
      sellAmount: cowQuote.sellAmount,
      buyAmount: this.applySlippage(cowQuote.buyAmount, quote.slippage),
      validTo: cowQuote.validTo,
      appData: cowQuote.appData,
      feeAmount: cowQuote.feeAmount,
      kind: cowQuote.kind,
      partiallyFillable: cowQuote.partiallyFillable,
      receiver: cowQuote.receiver,
      signature,
      signingScheme: "eip712",
    };

    const response = await fetch(`${apiEndpoint}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(order),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("CoW Protocol order creation error:", error);
      return null;
    }

    // Returns the order UID
    const orderId = await response.text();
    return orderId.replace(/"/g, "");
  }

  // Get order status
  async getOrderStatus(
    chain: SupportedChain,
    orderId: string
  ): Promise<{
    status: "pending" | "fulfilled" | "cancelled" | "expired";
    filledAmount?: string;
    txHash?: string;
  } | null> {
    const chainId = CHAIN_IDS[chain];
    const apiEndpoint = this.getApiEndpoint(chainId);

    if (!apiEndpoint) {
      return null;
    }

    const response = await fetch(`${apiEndpoint}/orders/${orderId}`);

    if (!response.ok) {
      return null;
    }

    const order = (await response.json()) as {
      status: string;
      executedSellAmount?: string;
      txHash?: string;
    };

    let status: "pending" | "fulfilled" | "cancelled" | "expired" = "pending";
    if (order.status === "fulfilled") {
      status = "fulfilled";
    } else if (order.status === "cancelled") {
      status = "cancelled";
    } else if (order.status === "expired") {
      status = "expired";
    }

    return {
      status,
      filledAmount: order.executedSellAmount,
      txHash: order.txHash,
    };
  }

  private applySlippage(amount: string, slippage: number): string {
    const amountBigInt = BigInt(amount);
    const slippageMultiplier = BigInt(Math.floor((100 - slippage) * 100));
    return ((amountBigInt * slippageMultiplier) / 10000n).toString();
  }

  async buildCalldata(_quote: DexQuote): Promise<string> {
    // CoW Protocol doesn't use calldata - orders are signed and submitted off-chain
    throw new Error(
      "CoW Protocol uses off-chain orders - use createOrder() instead of buildCalldata()"
    );
  }
}

export const cowswapAggregator = new CowSwapAggregator();
