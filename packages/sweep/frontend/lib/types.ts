// Token types
export interface DustToken {
  id: string;
  chainId: number;
  chain: string;
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceFormatted: string;
  priceUsd: number;
  valueUsd: number;
  balanceUsd: number; // Alias for valueUsd for backwards compatibility
  isVerified: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  logoUrl?: string;
  isSpam?: boolean;
  riskScore?: number;
}

// DeFi Vault types
export interface DefiVault {
  id: string;
  protocol: string;
  name: string;
  asset: string;
  chainId: number;
  apy: number;
  tvl: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  description?: string;
  vaultAddress: string;
  logoUrl?: string;
}

// Chain types
export interface Chain {
  id: number;
  name: string;
  icon: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrl: string;
  rpcUrl: string;
}

// Quote types
export interface SweepQuote {
  id: string;
  inputTokens: SweepInputToken[];
  outputToken: OutputToken;
  totalInputUsd: number;
  estimatedOutput: string;
  estimatedOutputUsd: number;
  priceImpact: number;
  fees: SweepFees;
  routes: SwapRoute[];
  expiresAt: number;
  gasless: boolean;
}

export interface SweepInputToken {
  address: string;
  symbol: string;
  chainId: number;
  balance: string;
  balanceUsd: number;
  estimatedOutput: string;
}

export interface OutputToken {
  address: string;
  symbol: string;
  chainId: number;
  decimals: number;
  logoUrl?: string;
}

export interface SweepFees {
  protocol: number;
  gas: number;
  bridge?: number;
  total: number;
}

export interface SwapRoute {
  chainId: number;
  dex: string;
  path: string[];
  expectedOutput: string;
  priceImpact: number;
}

// Execution types
export interface ExecuteSweepRequest {
  quoteId: string;
  wallet: string;
  signature: string;
  message: string;
}

export interface ExecuteSweepResponse {
  success: boolean;
  sweepId: string;
  error?: string;
}

// Status types
export interface SweepStatus {
  id: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
  wallet?: string;
  tokensSwept?: number;
  outputToken?: string;
  outputAmount?: string;
  gasSaved?: number;
  transactions?: TransactionInfo[];
  chainStatuses?: Record<string, ChainStatus>;
  error?: string;
  createdAt: number;
  updatedAt: number;
}

export interface TransactionInfo {
  chainId: number;
  hash: string;
  status: "pending" | "submitted" | "confirmed" | "failed";
}

export interface ChainStatus {
  status: "pending" | "submitted" | "confirmed" | "failed";
  txHash?: string;
  tokensSwept?: number;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface WalletTokensResponse {
  tokens: DustToken[];
  totalValueUsd: number;
  chainBreakdown: Record<number, { count: number; valueUsd: number }>;
}

export interface QuoteResponse {
  quote: SweepQuote;
}

// Settings types
export interface SweepSettings {
  minDustValue: number;
  maxDustValue: number;
  outputToken: string;
  slippage: number;
  includeSpam: boolean;
}

export const DEFAULT_SETTINGS: SweepSettings = {
  minDustValue: 0.1,
  maxDustValue: 100,
  outputToken: "ETH",
  slippage: 0.5,
  includeSpam: false,
};

// Supported output tokens
export interface OutputTokenOption {
  address: string;
  symbol: string;
  name: string;
  chainId: number;
  logoUrl: string;
}

export const OUTPUT_TOKEN_OPTIONS: OutputTokenOption[] = [
  {
    address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    symbol: "ETH",
    name: "Ethereum",
    chainId: 1,
    logoUrl: "https://assets.coingecko.com/coins/images/279/small/ethereum.png",
  },
  {
    address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    symbol: "USDC",
    name: "USD Coin",
    chainId: 1,
    logoUrl: "https://assets.coingecko.com/coins/images/6319/small/USD_Coin_icon.png",
  },
  {
    address: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    symbol: "USDT",
    name: "Tether USD",
    chainId: 1,
    logoUrl: "https://assets.coingecko.com/coins/images/325/small/Tether.png",
  },
  {
    address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599",
    symbol: "WBTC",
    name: "Wrapped Bitcoin",
    chainId: 1,
    logoUrl: "https://assets.coingecko.com/coins/images/7598/small/wrapped_bitcoin_wbtc.png",
  },
];

// ============================================
// Consolidation Types
// ============================================

/** Request to consolidate assets from multiple chains to a single destination */
export interface ConsolidationRequest {
  wallet: string;
  sourceChains: number[];
  destinationChainId: number;
  destinationToken: string;
  minValueUsd?: number;
  slippage?: number;
}

/** A route for bridging assets from one chain to another */
export interface BridgeRoute {
  id: string;
  sourceChainId: number;
  destinationChainId: number;
  bridge: string;
  inputToken: string;
  inputAmount: string;
  outputToken: string;
  estimatedOutput: string;
  fee: number;
  estimatedTimeMinutes: number;
  steps: BridgeStep[];
}

/** A single step in a bridge route */
export interface BridgeStep {
  type: "swap" | "bridge" | "approve";
  chainId: number;
  protocol: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: string;
  estimatedAmountOut: string;
}

/** Quote for a consolidation operation */
export interface ConsolidationQuote {
  id: string;
  sourceChains: number[];
  destinationChainId: number;
  destinationToken: OutputTokenOption;
  routes: BridgeRoute[];
  totalInputUsd: number;
  estimatedOutputUsd: number;
  totalFees: ConsolidationFees;
  estimatedTimeMinutes: number;
  expiresAt: number;
}

/** Fee breakdown for consolidation */
export interface ConsolidationFees {
  bridgeFees: number;
  gasFees: number;
  protocolFees: number;
  total: number;
}

/** Status of an ongoing consolidation */
export interface ConsolidationStatus {
  id: string;
  status: "pending" | "bridging" | "swapping" | "completed" | "failed";
  routes: ConsolidationRouteStatus[];
  startedAt: number;
  completedAt?: number;
  error?: string;
}

/** Status of a single route in a consolidation */
export interface ConsolidationRouteStatus {
  routeId: string;
  sourceChainId: number;
  status: "pending" | "submitted" | "bridging" | "completed" | "failed";
  txHash?: string;
  bridgeTxHash?: string;
  progress: number; // 0-100
  estimatedTimeRemaining?: number;
}

// ============================================
// Subscription Types
// ============================================

/** Auto-sweep subscription configuration */
export interface Subscription {
  id: string;
  wallet: string;
  chainIds: number[];
  minDustValue: number;
  outputToken: string;
  outputChainId: number;
  frequency: SubscriptionFrequency;
  status: SubscriptionStatus;
  spendPermission?: SpendPermission;
  lastRun?: number;
  nextRun?: number;
  createdAt: number;
  stats: SubscriptionStats;
}

/** Subscription run frequency */
export type SubscriptionFrequency = "daily" | "weekly" | "monthly" | "on_threshold";

/** Subscription status */
export type SubscriptionStatus = "active" | "paused" | "expired" | "cancelled";

/** EIP-7715 spend permission for auto-sweeps */
export interface SpendPermission {
  token: string;
  allowance: string;
  period: number;
  start: number;
  end: number;
  salt: string;
  extraData: string;
  signature?: string;
}

/** Statistics for a subscription */
export interface SubscriptionStats {
  totalSweeps: number;
  totalTokensSwept: number;
  totalValueUsd: number;
  totalGasSaved: number;
}

/** Request to create a subscription */
export interface CreateSubscriptionRequest {
  chainIds: number[];
  minDustValue: number;
  outputToken: string;
  outputChainId: number;
  frequency: SubscriptionFrequency;
  thresholdValueUsd?: number; // For on_threshold frequency
}

/** Subscription run history entry */
export interface SubscriptionRun {
  id: string;
  subscriptionId: string;
  status: "success" | "failed" | "partial";
  tokensSwept: number;
  valueUsd: number;
  outputAmount: string;
  gasSaved: number;
  transactions: TransactionInfo[];
  executedAt: number;
  error?: string;
}

// ============================================
// WebSocket Event Types
// ============================================

/** WebSocket message types */
export type WebSocketMessageType =
  | "connected"
  | "transaction_update"
  | "price_update"
  | "subscription_trigger"
  | "consolidation_update"
  | "error";

/** Base WebSocket message */
export interface WebSocketMessage<T = unknown> {
  type: WebSocketMessageType;
  timestamp: number;
  data: T;
}

/** Transaction update event */
export interface TransactionUpdateEvent {
  sweepId: string;
  chainId: number;
  txHash: string;
  status: "submitted" | "confirmed" | "failed";
  confirmations?: number;
}

/** Price update event */
export interface PriceUpdateEvent {
  tokenAddress: string;
  chainId: number;
  priceUsd: number;
  change24h: number;
}

/** Subscription trigger event */
export interface SubscriptionTriggerEvent {
  subscriptionId: string;
  reason: "scheduled" | "threshold_reached";
  dustValueUsd: number;
}

/** Consolidation update event */
export interface ConsolidationUpdateEvent {
  consolidationId: string;
  routeId: string;
  status: ConsolidationRouteStatus["status"];
  progress: number;
  txHash?: string;
}

// ============================================
// Multi-Chain Balance Types
// ============================================

/** Aggregated balance across chains */
export interface MultiChainBalance {
  totalValueUsd: number;
  chainBreakdown: ChainBalance[];
  lastUpdated: number;
}

/** Balance for a single chain */
export interface ChainBalance {
  chainId: number;
  chainName: string;
  tokenCount: number;
  totalValueUsd: number;
  nativeBalance: string;
  nativeValueUsd: number;
}
