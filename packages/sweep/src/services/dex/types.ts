import { z } from "zod";
import type { SupportedChain } from "../../config/chains.js";

// Supported DEX aggregators
export type DexAggregator =
  | "1inch"
  | "paraswap"
  | "0x"
  | "cowswap"
  | "jupiter"
  | "lifi";

// Token info for quotes
export const QuoteTokenSchema = z.object({
  address: z.string(),
  symbol: z.string(),
  decimals: z.number(),
  chainId: z.number().optional(),
});
export type QuoteToken = z.infer<typeof QuoteTokenSchema>;

// Unified quote interface
export const DexQuoteSchema = z.object({
  aggregator: z.enum(["1inch", "paraswap", "0x", "cowswap", "jupiter", "lifi"]),
  inputToken: QuoteTokenSchema,
  outputToken: QuoteTokenSchema,
  inputAmount: z.string(), // bigint as string
  outputAmount: z.string(), // bigint as string
  priceImpact: z.number(), // percentage (e.g., 0.5 = 0.5%)
  estimatedGas: z.string(), // gas units
  estimatedGasUsd: z.number(),
  calldata: z.string().optional(),
  to: z.string().optional(), // contract to call
  value: z.string().optional(), // ETH value to send
  allowanceTarget: z.string().optional(), // address to approve
  slippage: z.number(), // slippage used for quote
  expiresAt: z.number(), // unix timestamp
  route: z.array(z.any()).optional(), // aggregator-specific route info
  metadata: z.record(z.any()).optional(), // aggregator-specific metadata
});
export type DexQuote = z.infer<typeof DexQuoteSchema>;

// Quote request parameters
export interface QuoteRequest {
  chain: SupportedChain;
  inputToken: string; // address or mint
  outputToken: string; // address or mint
  inputAmount: string; // bigint as string
  slippage?: number; // percentage, default 0.5
  userAddress: string;
  receiver?: string; // defaults to userAddress
  excludeAggregators?: DexAggregator[];
  includeCalldata?: boolean;
}

// Cross-chain quote request
export interface CrossChainQuoteRequest extends QuoteRequest {
  destinationChain: SupportedChain;
  destinationToken?: string;
}

// Quote comparison result
export interface QuoteComparison {
  best: DexQuote;
  all: DexQuote[];
  savings: {
    vsWorst: number; // USD saved vs worst quote
    vsAverage: number; // USD saved vs average
  };
}

// Aggregator interface that all implementations must follow
export interface IDexAggregator {
  name: DexAggregator;
  supportedChains: SupportedChain[];

  getQuote(request: QuoteRequest): Promise<DexQuote | null>;
  buildCalldata?(quote: DexQuote): Promise<string>;
  isAvailable(chain: SupportedChain): boolean;
}

// Native token addresses (special handling needed)
export const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
export const NATIVE_TOKEN_ADDRESS_ALT = "0x0000000000000000000000000000000000000000";

// WETH addresses per chain
export const WRAPPED_NATIVE_TOKEN: Record<string, string> = {
  ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
  base: "0x4200000000000000000000000000000000000006",
  arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
  polygon: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
  bsc: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // WBNB
  linea: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
  optimism: "0x4200000000000000000000000000000000000006",
};

// Chain IDs for API calls
export const CHAIN_IDS: Record<SupportedChain, number> = {
  ethereum: 1,
  base: 8453,
  arbitrum: 42161,
  polygon: 137,
  bsc: 56,
  linea: 59144,
  optimism: 10,
  solana: 0, // Solana doesn't use EVM chain IDs
};

// Solana native token mint
export const SOL_NATIVE_MINT = "So11111111111111111111111111111111111111112";

// Common stablecoins for output
export const STABLECOINS: Record<string, Record<string, string>> = {
  ethereum: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  },
  arbitrum: {
    USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
  },
  polygon: {
    USDC: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  },
  bsc: {
    USDC: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    USDT: "0x55d398326f99059fF775485246999027B3197955",
  },
  linea: {
    USDC: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
  },
  optimism: {
    USDC: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
  },
  solana: {
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  },
};

// Helper to check if address is native token
export function isNativeToken(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === NATIVE_TOKEN_ADDRESS.toLowerCase() ||
    normalized === NATIVE_TOKEN_ADDRESS_ALT ||
    normalized === "eth" ||
    normalized === "matic" ||
    normalized === "bnb"
  );
}

// Default quote expiry (5 minutes)
export const DEFAULT_QUOTE_EXPIRY_SECONDS = 300;

// Default slippage (0.5%)
export const DEFAULT_SLIPPAGE = 0.5;

// Quote optimizer options
export interface QuoteOptimizerOptions {
  maxSlippage?: number;
  excludeAggregators?: DexAggregator[];
  preferFastExecution?: boolean;
  minOutputAmount?: string;
}

// Swap calldata result
export interface SwapCalldata {
  to: string;
  data: string;
  value: string;
  gasLimit?: string;
  aggregator: DexAggregator;
}

// Batch swap calldata result
export interface BatchSwapCalldata {
  swaps: SwapCalldata[];
  totalGasEstimate: string;
  approvals: {
    token: string;
    spender: string;
    amount: string;
  }[];
}
