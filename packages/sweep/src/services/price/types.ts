/**
 * Price Service Types
 * All TypeScript interfaces for the price validation system
 */

import type { SupportedChain } from "../../config/chains.js";

// ============================================================================
// Price Sources & Oracles
// ============================================================================

export interface PriceSource {
  name: string;
  price: number;
  confidence: number; // 0-1 score
  timestamp: number;
}

export interface OraclePrice {
  price: number;
  decimals: number;
  timestamp: number;
  source: string;
}

export interface ChainlinkFeedConfig {
  feedAddress: `0x${string}`;
  decimals: number;
}

export interface PythPriceId {
  priceId: string;
}

// ============================================================================
// Validated Prices
// ============================================================================

export type PriceConfidence = "HIGH" | "MEDIUM" | "LOW" | "UNTRUSTED";

export interface ValidatedPrice {
  price: number;
  confidence: PriceConfidence;
  sources: PriceSource[];
  requiresApproval: boolean;
  timestamp: number;
}

// ============================================================================
// Liquidity Checks
// ============================================================================

export interface DexPool {
  dex: string;
  pairAddress: string;
  liquidity: number;
  volume24h: number;
  priceUsd: number;
}

export interface LiquidityCheck {
  isLiquid: boolean;
  liquidityUsd: number;
  topPools: DexPool[];
  volume24h: number;
}

// ============================================================================
// Anomaly Detection
// ============================================================================

export interface AnomalyCheck {
  isAnomalous: boolean;
  currentPrice: number;
  avg7d: number;
  deviation: number;
  dataPoints: number;
}

// ============================================================================
// TWAP Checks
// ============================================================================

export interface TWAPCheck {
  valid: boolean;
  spotPrice: number;
  twap1h: number;
  twap24h: number;
  deviation1h: number;
  deviation24h: number;
}

// ============================================================================
// Holder Distribution
// ============================================================================

export interface TokenHolder {
  address: string;
  balance: bigint;
  percentage: number;
}

export interface HolderDistribution {
  isConcentrated: boolean;
  top10Percentage: number;
  holderCount: number;
  topHolders: TokenHolder[];
}

// ============================================================================
// Honeypot & Security Checks
// ============================================================================

export interface HoneypotCheck {
  isHoneypot: boolean;
  buyTax: number;
  sellTax: number;
  isOpenSource: boolean;
  hasProxyContract: boolean;
  isMintable: boolean;
  canTakeOwnership: boolean;
}

export interface TransferTaxCheck {
  hiddenTax: number;
  actualReceived: bigint;
  expectedAmount: bigint;
}

// ============================================================================
// Token Age
// ============================================================================

export interface TokenAgeCheck {
  isMature: boolean;
  ageInDays: number;
  deployedAt: Date;
  creationTxHash: string;
}

// ============================================================================
// Cross-DEX Arbitrage
// ============================================================================

export interface CrossDexCheck {
  isManipulated: boolean;
  prices: Record<string, number>;
  maxDeviation: number;
  avgPrice: number;
}

// ============================================================================
// On-Chain Oracle Cross-Check
// ============================================================================

export interface OracleCrossCheck {
  valid: boolean;
  chainlinkPrice?: number;
  pythPrice?: number;
  deviation?: number;
}

// ============================================================================
// Transaction Simulation
// ============================================================================

export interface StateChange {
  address: string;
  key: string;
  before: string;
  after: string;
}

export interface SimulationResult {
  success: boolean;
  gasUsed: bigint;
  outputAmount: bigint;
  revertReason?: string;
  stateChanges: StateChange[];
}

// ============================================================================
// Execution Guards
// ============================================================================

export interface ExecutionGuard {
  canExecute: boolean;
  requiresApproval: boolean;
  reason?: string;
  expectedValue: number;
  minAcceptableValue: number;
  actualQuoteValue?: number;
  slippage?: number;
}

// ============================================================================
// Whitelist/Blacklist/Graylist
// ============================================================================

export type ListStatus = "WHITELIST" | "BLACKLIST" | "GRAYLIST" | "UNKNOWN";

export interface TokenListEntry {
  address: string;
  chain: SupportedChain;
  status: ListStatus;
  reason?: string;
  addedAt: Date;
  addedBy?: string;
}

// ============================================================================
// Complete Sweep Validation
// ============================================================================

export interface SweepValidation {
  canSweep: boolean;
  requiresApproval: boolean;
  validatedPrice: ValidatedPrice;
  liquidityCheck: LiquidityCheck;
  anomalyCheck: AnomalyCheck;
  executionGuard: ExecutionGuard;
  honeypotCheck?: HoneypotCheck;
  holderCheck?: HolderDistribution;
  ageCheck?: TokenAgeCheck;
  twapCheck?: TWAPCheck;
  crossDexCheck?: CrossDexCheck;
  oracleCheck?: OracleCrossCheck;
  simulationResult?: SimulationResult;
  listStatus: ListStatus;
  reasons: string[];
  validationTimestamp: number;
}

// ============================================================================
// Price Request/Response
// ============================================================================

export interface PriceRequest {
  tokenAddress: string;
  chain: SupportedChain;
  amount?: bigint;
  tokenSymbol?: string;
  tokenDecimals?: number;
}

export interface PriceResponse {
  success: boolean;
  price?: ValidatedPrice;
  error?: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface CoinGeckoResponse {
  [address: string]: {
    usd: number;
    usd_24h_change?: number;
    usd_24h_vol?: number;
  };
}

export interface DefiLlamaResponse {
  coins: {
    [key: string]: {
      price: number;
      symbol: string;
      timestamp: number;
      confidence: number;
    };
  };
}

export interface DexScreenerPair {
  chainId: string;
  dexId: string;
  pairAddress: string;
  baseToken: {
    address: string;
    symbol: string;
  };
  quoteToken: {
    address: string;
    symbol: string;
  };
  priceUsd: string;
  liquidity: {
    usd: number;
  };
  volume: {
    h24: number;
  };
  priceChange: {
    h24: number;
  };
}

export interface DexScreenerResponse {
  pairs: DexScreenerPair[];
}

export interface HoneypotIsResponse {
  honeypotResult: {
    isHoneypot: boolean;
  };
  simulationResult?: {
    buyTax: number;
    sellTax: number;
  };
  contractCode?: {
    openSource: boolean;
    isProxy: boolean;
  };
}

export interface GoPlusSecurityResponse {
  result: {
    [address: string]: {
      is_honeypot: string;
      buy_tax: string;
      sell_tax: string;
      is_open_source: string;
      is_proxy: string;
      is_mintable: string;
      can_take_back_ownership: string;
      holder_count: string;
      lp_holder_count: string;
      total_supply: string;
    };
  };
}

// ============================================================================
// Cache Keys
// ============================================================================

export const CACHE_KEYS = {
  price: (chain: string, token: string) => `price:${chain}:${token.toLowerCase()}`,
  priceHistory: (chain: string, token: string) => `price:history:${chain}:${token.toLowerCase()}`,
  liquidity: (chain: string, token: string) => `liquidity:${chain}:${token.toLowerCase()}`,
  honeypot: (chain: string, token: string) => `honeypot:${chain}:${token.toLowerCase()}`,
  holders: (chain: string, token: string) => `holders:${chain}:${token.toLowerCase()}`,
  tokenAge: (chain: string, token: string) => `age:${chain}:${token.toLowerCase()}`,
  validation: (chain: string, token: string) => `validation:${chain}:${token.toLowerCase()}`,
} as const;

// ============================================================================
// Constants
// ============================================================================

export const PRICE_VALIDATION_CONFIG = {
  // Price consensus
  PRICE_DEVIATION_THRESHOLD: 0.05, // 5% max deviation from median
  MIN_SOURCES_REQUIRED: 2,
  
  // On-chain oracle
  ORACLE_DEVIATION_THRESHOLD: 0.10, // 10% max from on-chain oracle
  
  // Liquidity
  MIN_LIQUIDITY_USD: 10_000,
  MIN_24H_VOLUME_USD: 5_000,
  
  // Execution
  MAX_SLIPPAGE: 0.03, // 3%
  AUTO_SWEEP_THRESHOLD_USD: 50,
  
  // Token safety
  MAX_HIDDEN_TAX: 0.05, // 5%
  MAX_TOP_HOLDER_CONCENTRATION: 0.80, // 80%
  MIN_TOKEN_AGE_DAYS: 7,
  MAX_CROSS_DEX_DEVIATION: 0.05, // 5%
  TWAP_DEVIATION_THRESHOLD: 0.20, // 20%
  ANOMALY_THRESHOLD: 0.50, // 50% from 7d avg
  
  // Cache TTLs (seconds)
  CACHE_TTL_PRICE: 60,
  CACHE_TTL_LIQUIDITY: 300,
  CACHE_TTL_HONEYPOT: 3600,
  CACHE_TTL_HOLDERS: 3600,
  CACHE_TTL_AGE: 86400,
} as const;
