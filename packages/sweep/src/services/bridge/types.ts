/**
 * Cross-Chain Bridging Types
 * Types for multi-chain dust sweep bridging
 */

import type { SupportedChain } from "../../config/chains.js";

/**
 * Supported bridge providers
 */
export enum BridgeProvider {
  ACROSS = "across",
  STARGATE = "stargate",
  HOP = "hop",
  CBRIDGE = "cbridge",
  SOCKET = "socket",
  SYNAPSE = "synapse",
}

/**
 * Bridge protocol metadata for UI/selection
 */
export interface BridgeProtocolInfo {
  protocol: BridgeProvider;
  name: string;
  description: string;
  website: string;
  supportedChains: SupportedChain[];
  supportedTokens: string[]; // Token symbols
  averageTime: number; // seconds
  reliability: number; // 0-100 score
  isAggregator: boolean;
}

/**
 * Bridge transaction status
 */
export enum BridgeStatus {
  PENDING = "pending",
  PENDING_SOURCE = "pending_source",
  SOURCE_CONFIRMED = "source_confirmed",
  BRIDGING = "bridging",
  DESTINATION_PENDING = "destination_pending",
  PENDING_DEST = "pending_dest",
  COMPLETED = "completed",
  FAILED = "failed",
  REFUNDED = "refunded",
  EXPIRED = "expired",
}

/**
 * Bridge priority for route selection
 */
export type BridgePriority = "speed" | "cost" | "reliability";

/**
 * Token info for bridging
 */
export interface BridgeToken {
  address: `0x${string}`;
  symbol: string;
  decimals: number;
  chain: SupportedChain;
}

/**
 * Quote request for bridge
 */
export interface BridgeQuoteRequest {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  sourceToken: `0x${string}`;
  destinationToken: `0x${string}`;
  amount: bigint;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  slippage?: number; // Default 0.5%
  priority?: BridgePriority; // Route selection priority
  excludeProviders?: BridgeProvider[]; // Providers to exclude
}

/**
 * Fee breakdown for bridge quote
 */
export interface BridgeFees {
  bridgeFee: bigint; // Protocol fee
  gasFee: bigint; // Estimated gas cost
  relayerFee: bigint; // Relayer/solver fee
  totalFeeUsd: number; // Total in USD
  lpFee?: bigint; // LP fee (Stargate)
  messagingFee?: bigint; // Cross-chain messaging fee (LayerZero)
}

/**
 * Individual step in a bridge route
 */
export interface BridgeStep {
  type: "swap" | "bridge" | "approve" | "wrap" | "unwrap";
  chain: SupportedChain;
  protocol: string;
  protocolLogo?: string;
  fromToken: `0x${string}`;
  fromTokenSymbol?: string;
  toToken: `0x${string}`;
  toTokenSymbol?: string;
  fromAmount: string;
  toAmount: string;
  amount: bigint;
  expectedOutput: bigint;
  data?: `0x${string}`;
  to?: `0x${string}`;
  value?: bigint;
  estimatedGas?: bigint;
}

/**
 * Bridge quote from a provider
 */
export interface BridgeQuote {
  provider: BridgeProvider;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  sourceToken: BridgeToken;
  destinationToken: BridgeToken;
  inputAmount: bigint;
  outputAmount: bigint; // Expected amount after fees
  minOutputAmount: bigint; // Minimum with slippage
  fees: BridgeFees;
  feeUsd: number; // Total fees in USD
  estimatedTime: number; // Seconds
  route: BridgeRoute;
  expiresAt: number; // Unix timestamp
  expiry: number; // Unix timestamp (alias for compatibility)
  quoteId: string;
  isFastFill?: boolean; // Across fast fills
  maxSlippage: number; // Max slippage tolerance
  tags?: string[]; // e.g., ["fastest", "cheapest"]
}

/**
 * Bridge route details
 */
export interface BridgeRoute {
  steps: BridgeStep[];
  totalGasEstimate: bigint;
  requiresApproval: boolean;
  approvalAddress?: `0x${string}`;
  estimatedGasUsd?: number;
}

/**
 * Individual step in a bridge route (duplicate removed - see above)
 */

/**
 * Bridge transaction to execute
 */
export interface BridgeTransaction {
  id: string;
  provider: BridgeProvider;
  quoteId: string;
  quote: BridgeQuote;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  
  // Transaction details
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
  gasLimit: bigint;
  
  // Token info
  sourceToken: BridgeToken;
  destinationToken: BridgeToken;
  inputAmount: bigint;
  expectedOutput: bigint;
  minOutput: bigint;
  
  // Tracking
  sourceTxHash?: `0x${string}`;
  destTxHash?: `0x${string}`;
  depositId?: string; // Across deposit ID
  nonce?: bigint; // LayerZero nonce
  status: BridgeStatus;
  createdAt: number;
  completedAt?: number;
  
  // Approval if needed
  approval?: {
    token: `0x${string}`;
    spender: `0x${string}`;
    amount: bigint;
  };
}

/**
 * Bridge transaction receipt/status
 */
export interface BridgeReceipt {
  provider: BridgeProvider;
  quoteId: string;
  status: BridgeStatus;
  
  // Source transaction
  sourceTxHash: `0x${string}`;
  sourceChain: SupportedChain;
  sourceConfirmations: number;
  
  // Destination transaction (once completed)
  destinationTxHash?: `0x${string}`;
  destinationChain: SupportedChain;
  destinationConfirmations?: number;
  
  // Amounts
  inputAmount: bigint;
  outputAmount?: bigint; // Actual received amount
  
  // Tracking IDs
  depositId?: string; // Across
  nonce?: bigint; // LayerZero
  
  // Timing
  initiatedAt: number;
  completedAt?: number;
  estimatedCompletionTime?: number;
  
  // Error info
  error?: string;
  refundTxHash?: string;
}

/**
 * Multi-chain sweep plan
 */
export interface MultiChainSweepPlan {
  id: string;
  userId: string;
  destinationChain: SupportedChain;
  destinationToken: `0x${string}`;
  recipient: `0x${string}`;
  
  // Source chains with tokens to sweep
  sources: ChainSweepSource[];
  
  // Bridging strategy
  bridges: PlannedBridge[];
  
  // Cost analysis
  totalInputValueUsd: number;
  totalFeesUsd: number;
  expectedOutputValueUsd: number;
  
  // Timing
  estimatedTotalTime: number; // Seconds
  createdAt: number;
  expiresAt: number;
}

/**
 * Tokens to sweep from a single chain
 */
export interface ChainSweepSource {
  chain: SupportedChain;
  tokens: {
    address: `0x${string}`;
    symbol: string;
    amount: bigint;
    valueUsd: number;
  }[];
  swapOutputToken: `0x${string}`; // What to swap to before bridging (usually USDC/WETH)
  swapOutputAmount: bigint;
  swapQuote?: {
    aggregator: string;
    quoteId: string;
  };
}

/**
 * Planned bridge in sweep strategy
 */
export interface PlannedBridge {
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  token: `0x${string}`;
  amount: bigint;
  quote: BridgeQuote;
  priority: number; // Order of execution
}

/**
 * Bridge aggregator configuration
 */
export interface BridgeAggregatorConfig {
  enabledProviders: BridgeProvider[];
  maxSlippage: number; // Default 0.5%
  preferFastFills: boolean; // Across fast fills
  minOutputValueUsd: number; // Skip if output too small
  maxBridgeTimeSeconds: number; // Max acceptable bridge time
  
  // Provider-specific
  across: {
    apiUrl: string;
    spokePoolAddresses: Partial<Record<SupportedChain, `0x${string}`>>;
  };
  stargate: {
    apiUrl: string;
    routerAddresses: Partial<Record<SupportedChain, `0x${string}`>>;
  };
}

/**
 * Supported bridge routes (source -> destination)
 */
export interface BridgeRouteSupport {
  provider: BridgeProvider;
  sourceChains: SupportedChain[];
  destinationChains: SupportedChain[];
  tokens: `0x${string}`[]; // Canonical token addresses
  minAmount?: bigint;
  maxAmount?: bigint;
}

/**
 * Bridge provider interface
 */
export interface IBridgeProvider {
  name: BridgeProvider;
  
  /**
   * Check if a route is supported
   */
  supportsRoute(
    sourceChain: SupportedChain,
    destinationChain: SupportedChain,
    token: `0x${string}`
  ): Promise<boolean>;
  
  /**
   * Get a quote for bridging
   */
  getQuote(request: BridgeQuoteRequest): Promise<BridgeQuote | null>;
  
  /**
   * Build the bridge transaction
   */
  buildTransaction(quote: BridgeQuote): Promise<BridgeTransaction>;
  
  /**
   * Get the status of a bridge transaction
   */
  getStatus(
    sourceTxHash: `0x${string}`,
    sourceChain: SupportedChain
  ): Promise<BridgeReceipt>;
}

/**
 * Bridge history entry for user tracking
 */
export interface BridgeHistoryEntry {
  id: string;
  userId: string;
  provider: BridgeProvider;
  sourceChain: SupportedChain;
  destinationChain: SupportedChain;
  sourceToken: string;
  destinationToken: string;
  inputAmount: string;
  outputAmount?: string;
  feeUsd: number;
  status: BridgeStatus;
  sourceTxHash: string;
  destTxHash?: string;
  createdAt: number;
  completedAt?: number;
  error?: string;
}

/**
 * Supported chains/tokens response
 */
export interface BridgeSupportedInfo {
  chains: {
    chain: SupportedChain;
    chainId: number;
    name: string;
    nativeToken: string;
  }[];
  tokens: {
    symbol: string;
    name: string;
    addresses: Partial<Record<SupportedChain, `0x${string}`>>;
    decimals: number;
  }[];
  routes: {
    sourceChain: SupportedChain;
    destinationChain: SupportedChain;
    providers: BridgeProvider[];
  }[];
}

/**
 * Bridge protocol metadata
 */
export const BRIDGE_PROTOCOL_INFO: Record<BridgeProvider, BridgeProtocolInfo> = {
  [BridgeProvider.ACROSS]: {
    protocol: BridgeProvider.ACROSS,
    name: "Across Protocol",
    description: "Fast cross-chain bridging with intent-based architecture",
    website: "https://across.to",
    supportedChains: ["ethereum", "base", "arbitrum", "polygon", "optimism", "linea"],
    supportedTokens: ["ETH", "WETH", "USDC", "USDT", "DAI", "WBTC"],
    averageTime: 60, // ~1 minute for fast fills
    reliability: 95,
    isAggregator: false,
  },
  [BridgeProvider.STARGATE]: {
    protocol: BridgeProvider.STARGATE,
    name: "Stargate Finance",
    description: "Native asset bridge powered by LayerZero",
    website: "https://stargate.finance",
    supportedChains: ["ethereum", "base", "arbitrum", "polygon", "optimism", "bsc"],
    supportedTokens: ["USDC", "USDT", "ETH", "WETH"],
    averageTime: 300, // ~5 minutes
    reliability: 90,
    isAggregator: false,
  },
  [BridgeProvider.HOP]: {
    protocol: BridgeProvider.HOP,
    name: "Hop Protocol",
    description: "Fast bridging with bonder network",
    website: "https://hop.exchange",
    supportedChains: ["ethereum", "arbitrum", "optimism", "polygon"],
    supportedTokens: ["ETH", "USDC", "USDT", "DAI", "MATIC"],
    averageTime: 180, // ~3 minutes
    reliability: 92,
    isAggregator: false,
  },
  [BridgeProvider.CBRIDGE]: {
    protocol: BridgeProvider.CBRIDGE,
    name: "Celer cBridge",
    description: "Multi-chain liquidity network",
    website: "https://cbridge.celer.network",
    supportedChains: ["ethereum", "base", "arbitrum", "polygon", "optimism", "bsc"],
    supportedTokens: ["USDC", "USDT", "ETH", "WETH", "WBTC"],
    averageTime: 240, // ~4 minutes
    reliability: 88,
    isAggregator: false,
  },
  [BridgeProvider.SOCKET]: {
    protocol: BridgeProvider.SOCKET,
    name: "Socket (Bungee)",
    description: "Bridge aggregator for optimal routes",
    website: "https://socket.tech",
    supportedChains: ["ethereum", "base", "arbitrum", "polygon", "optimism", "bsc", "linea"],
    supportedTokens: ["ETH", "WETH", "USDC", "USDT", "DAI", "WBTC"],
    averageTime: 300, // Varies by underlying bridge
    reliability: 85,
    isAggregator: true,
  },
  [BridgeProvider.SYNAPSE]: {
    protocol: BridgeProvider.SYNAPSE,
    name: "Synapse Protocol",
    description: "Cross-chain bridge and DEX",
    website: "https://synapseprotocol.com",
    supportedChains: ["ethereum", "arbitrum", "optimism", "polygon", "bsc"],
    supportedTokens: ["USDC", "USDT", "ETH", "WETH", "DAI"],
    averageTime: 300,
    reliability: 85,
    isAggregator: false,
  },
};

/**
 * Constants for bridge configuration
 */
export const BRIDGE_CONFIG = {
  // Default slippage tolerance
  DEFAULT_SLIPPAGE: 0.005, // 0.5%
  
  // Minimum output value (skip tiny amounts)
  MIN_OUTPUT_VALUE_USD: 1,
  
  // Max time to wait for bridge
  MAX_BRIDGE_TIME_SECONDS: 3600, // 1 hour
  
  // Quote expiry
  QUOTE_TTL_SECONDS: 60,
  
  // Status check interval
  STATUS_CHECK_INTERVAL_MS: 10000, // 10 seconds
  
  // Max retries for status check
  MAX_STATUS_CHECKS: 360, // 1 hour at 10s intervals
  
  // Fast fill eligible tokens (Across)
  FAST_FILL_TOKENS: ["USDC", "WETH", "ETH", "USDT"],
  
  // Bridge token mappings (canonical addresses per chain)
  USDC_ADDRESSES: {
    ethereum: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    base: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    arbitrum: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    polygon: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    optimism: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
    bsc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    linea: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff",
  } as Partial<Record<SupportedChain, `0x${string}`>>,
  
  WETH_ADDRESSES: {
    ethereum: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    base: "0x4200000000000000000000000000000000000006",
    arbitrum: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
    polygon: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    optimism: "0x4200000000000000000000000000000000000006",
    linea: "0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f",
  } as Partial<Record<SupportedChain, `0x${string}`>>,
  
  // DAI addresses per chain
  DAI_ADDRESSES: {
    ethereum: "0x6B175474E89094C44Da98b954EesadFCd790415D",
    arbitrum: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    optimism: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1",
    polygon: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  } as Partial<Record<SupportedChain, `0x${string}`>>,
  
  // USDT addresses per chain
  USDT_ADDRESSES: {
    ethereum: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    arbitrum: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
    optimism: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
    polygon: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    bsc: "0x55d398326f99059fF775485246999027B3197955",
  } as Partial<Record<SupportedChain, `0x${string}`>>,
} as const;

