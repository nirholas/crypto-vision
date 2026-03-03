/**
 * DeFi Protocol Integration Types
 * Unified interfaces for yield destinations across protocols
 */

import type { Address, Hex } from "viem";

// ============================================================
// Enums
// ============================================================

export enum DeFiProtocol {
  AAVE = "aave",
  YEARN = "yearn",
  BEEFY = "beefy",
  LIDO = "lido",
  JITO = "jito",
  COMPOUND = "compound",
  MORPHO = "morpho",
  SPARK = "spark",
}

export enum DeFiProductType {
  LENDING = "lending",
  VAULT = "vault",
  STAKING = "staking",
  LIQUIDITY = "liquidity",
  YIELD_AGGREGATOR = "yield_aggregator",
}

export enum RiskLevel {
  MINIMAL = "minimal", // Absolute lowest risk (staking to major protocols)
  LOW = "low", // Blue chip protocols, battle-tested
  MEDIUM = "medium", // Established but newer
  HIGH = "high", // Newer protocols, higher APY
  CRITICAL = "critical", // Experimental, use with caution
  DEGEN = "degen", // High risk, high reward
}

// ============================================================
// Chain Configuration
// ============================================================

export interface DeFiChainConfig {
  chainId: number;
  name: string;
  supported: boolean;
  gasToken: string;
  protocols: DeFiProtocol[];
}

export const DEFI_CHAIN_CONFIG: Record<string, DeFiChainConfig> = {
  ethereum: {
    chainId: 1,
    name: "Ethereum",
    supported: true,
    gasToken: "ETH",
    protocols: [
      DeFiProtocol.AAVE,
      DeFiProtocol.YEARN,
      DeFiProtocol.BEEFY,
      DeFiProtocol.LIDO,
      DeFiProtocol.COMPOUND,
      DeFiProtocol.MORPHO,
    ],
  },
  arbitrum: {
    chainId: 42161,
    name: "Arbitrum",
    supported: true,
    gasToken: "ETH",
    protocols: [DeFiProtocol.AAVE, DeFiProtocol.YEARN, DeFiProtocol.BEEFY],
  },
  polygon: {
    chainId: 137,
    name: "Polygon",
    supported: true,
    gasToken: "MATIC",
    protocols: [DeFiProtocol.AAVE, DeFiProtocol.YEARN, DeFiProtocol.BEEFY],
  },
  base: {
    chainId: 8453,
    name: "Base",
    supported: true,
    gasToken: "ETH",
    protocols: [DeFiProtocol.AAVE, DeFiProtocol.YEARN, DeFiProtocol.BEEFY, DeFiProtocol.MORPHO],
  },
  optimism: {
    chainId: 10,
    name: "Optimism",
    supported: true,
    gasToken: "ETH",
    protocols: [DeFiProtocol.AAVE, DeFiProtocol.YEARN, DeFiProtocol.BEEFY],
  },
  bsc: {
    chainId: 56,
    name: "BNB Chain",
    supported: true,
    gasToken: "BNB",
    protocols: [DeFiProtocol.BEEFY],
  },
  solana: {
    chainId: -1, // Solana doesn't use EVM chain IDs
    name: "Solana",
    supported: true,
    gasToken: "SOL",
    protocols: [DeFiProtocol.JITO],
  },
};

// ============================================================
// Asset Types
// ============================================================

export interface DeFiAsset {
  address: Address | string; // Address for EVM, pubkey for Solana
  symbol: string;
  name: string;
  decimals: number;
  logoUri?: string;
  priceUsd?: number;
  chain: string;
}

export interface DeFiReserve extends DeFiAsset {
  totalSupply: string;
  totalBorrow?: string;
  availableLiquidity: string;
  utilizationRate: number;
  supplyApy: number;
  borrowApy?: number;
  ltv?: number; // Loan-to-value ratio
  liquidationThreshold?: number;
}

// ============================================================
// Vault/Pool Interfaces
// ============================================================

export interface DeFiVault {
  id: string; // Unique identifier
  protocol: DeFiProtocol;
  productType: DeFiProductType;
  name: string;
  symbol: string;
  address: Address | string;
  chain: string;
  chainId: number;

  // Assets
  depositToken: DeFiAsset;
  receiptToken?: DeFiAsset; // aToken, yToken, etc.
  underlyingTokens?: DeFiAsset[]; // For LP vaults

  // Metrics
  apy: number; // Current APY as decimal (0.05 = 5%)
  apyBase?: number; // Base yield without rewards
  apyReward?: number; // Reward token yield
  tvlUsd: number;

  // Risk
  riskLevel: RiskLevel;
  audited: boolean;
  insuranceCovered?: boolean;

  // Status
  active: boolean;
  deprecated?: boolean;
  paused?: boolean;

  // Limits
  minDeposit?: string;
  maxDeposit?: string;
  depositCap?: string;
  userDepositCap?: string;

  // Metadata
  description?: string;
  website?: string;
  lastUpdated: number;
}

export interface LendingPool extends DeFiVault {
  productType: DeFiProductType.LENDING;
  reserves: DeFiReserve[];
  healthFactorThreshold?: number;
  eMode?: {
    id: number;
    label: string;
    ltv: number;
    liquidationThreshold: number;
  };
}

export interface YieldVault extends DeFiVault {
  productType: DeFiProductType.VAULT | DeFiProductType.YIELD_AGGREGATOR;
  strategy?: string;
  strategyAddress?: Address;
  harvestFrequency?: number; // seconds
  performanceFee?: number; // decimal
  managementFee?: number; // decimal
  withdrawalFee?: number; // decimal
}

export interface StakingPool extends DeFiVault {
  productType: DeFiProductType.STAKING;
  stakingToken: DeFiAsset;
  rewardToken: DeFiAsset;
  unbondingPeriod?: number; // seconds
  cooldownPeriod?: number; // seconds before unstaking
  minStake?: string;
  maxStake?: string;
  compounding?: boolean;
  validatorAddress?: string;
}

// ============================================================
// Quote & Transaction Types
// ============================================================

export interface DepositQuote {
  id: string;
  protocol: DeFiProtocol;
  vault: DeFiVault;
  chain: string;

  // Input
  depositToken: DeFiAsset;
  depositAmount: string;
  depositValueUsd: number;

  // Output
  receiptToken?: DeFiAsset;
  expectedReceiptAmount: string;
  expectedReceiptValueUsd: number;

  // Yield projection
  currentApy: number;
  projectedYield1d: number;
  projectedYield7d: number;
  projectedYield30d: number;
  projectedYield1y: number;

  // Costs
  estimatedGasUsd: number;
  protocolFeeUsd: number;
  slippageBps: number;

  // Transaction
  calldata?: Hex;
  to?: Address;
  value?: string;

  // Timing
  expiresAt: number;
  createdAt: number;
}

export interface WithdrawQuote {
  id: string;
  protocol: DeFiProtocol;
  vault: DeFiVault;
  chain: string;

  // Input
  receiptToken: DeFiAsset;
  receiptAmount: string;
  receiptValueUsd: number;

  // Output
  withdrawToken: DeFiAsset;
  expectedWithdrawAmount: string;
  expectedWithdrawValueUsd: number;

  // Costs
  estimatedGasUsd: number;
  protocolFeeUsd: number;
  slippageBps: number;

  // Unbonding
  unbondingPeriod?: number;
  withdrawalDelay?: number; // Estimated time for withdrawal
  instantWithdrawAvailable: boolean;
  instantWithdrawFee?: number;

  // Transaction
  calldata?: Hex;
  to?: Address;

  expiresAt: number;
  createdAt: number;
}

export interface DeFiTransaction {
  id: string;
  type: "deposit" | "withdraw" | "claim" | "stake" | "unstake";
  protocol: DeFiProtocol;
  vault: DeFiVault;
  chain: string;

  // Transaction details
  to: Address;
  data: Hex;
  value: string;

  // For ERC-4337
  userOpHash?: Hex;

  // Status
  status: "pending" | "submitted" | "confirmed" | "failed";
  txHash?: Hex;
  blockNumber?: number;
  gasUsed?: string;
  error?: string;

  // Timestamps
  createdAt: number;
  submittedAt?: number;
  confirmedAt?: number;
}

// ============================================================
// Position Tracking
// ============================================================

export interface DeFiPosition {
  id: string;
  userId: string;
  walletAddress: Address | string;
  protocol: DeFiProtocol;
  vault: DeFiVault;
  chain: string;

  // Position details
  depositToken: DeFiAsset;
  depositedAmount: string;
  depositedValueUsd: number;

  receiptToken?: DeFiAsset;
  receiptAmount: string;
  currentValueUsd: number;

  // Performance
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  realizedPnl: number;
  totalEarned: number;

  // Rewards
  pendingRewards?: {
    token: DeFiAsset;
    amount: string;
    valueUsd: number;
  }[];

  // For lending
  healthFactor?: number;
  borrowedAmount?: string;
  borrowedValueUsd?: number;
  collateralValueUsd?: number;

  // Timestamps
  enteredAt: number;
  lastUpdated: number;
}

export interface PositionHistory {
  positionId: string;
  action: "deposit" | "withdraw" | "claim" | "liquidation";
  amount: string;
  valueUsd: number;
  txHash: Hex;
  timestamp: number;
}

// ============================================================
// APY Data
// ============================================================

export interface ApyData {
  protocol: DeFiProtocol;
  vault: string;
  chain: string;
  asset: string;

  // Current rates
  apy: number;
  apyBase: number;
  apyReward: number;

  // Historical (for charts)
  apy7dAvg?: number;
  apy30dAvg?: number;
  apyHistory?: {
    timestamp: number;
    apy: number;
  }[];

  // Reward tokens
  rewardTokens?: {
    token: DeFiAsset;
    apy: number;
  }[];

  lastUpdated: number;
}

// ============================================================
// Protocol Provider Interface
// ============================================================

export interface DeFiProvider {
  protocol: DeFiProtocol;
  name: string;
  supportedChains: string[];

  // Discovery
  getVaults(chain: string): Promise<DeFiVault[]>;
  getVault(chain: string, vaultAddress: string): Promise<DeFiVault | null>;

  // APY
  getApy(chain: string, vaultAddress: string): Promise<ApyData>;

  // Quotes
  getDepositQuote(
    chain: string,
    vaultAddress: string,
    amount: string,
    userAddress: string
  ): Promise<DepositQuote>;

  getWithdrawQuote(
    chain: string,
    vaultAddress: string,
    amount: string,
    userAddress: string
  ): Promise<WithdrawQuote>;

  // Positions
  getPositions(chain: string, userAddress: string): Promise<DeFiPosition[]>;
  getPosition(
    chain: string,
    vaultAddress: string,
    userAddress: string
  ): Promise<DeFiPosition | null>;

  // Health (for lending)
  getHealthFactor?(chain: string, userAddress: string): Promise<number>;
}

// ============================================================
// Router Types
// ============================================================

export interface DeFiRouteStep {
  stepIndex?: number;
  type: "swap" | "bridge" | "deposit" | "approve" | "stake";
  protocol: string | DeFiProtocol;
  chain?: string;
  
  // Token info (for compatibility)
  tokenIn?: DeFiAsset;
  tokenOut?: DeFiAsset;
  token?: Address; // Shorthand for input token address
  targetToken?: Address; // For swaps
  
  // Amounts
  amountIn?: string;
  amountOut?: string;
  amount?: string; // Shorthand
  
  // Transaction
  to?: Address;
  vault?: Address; // For deposit/stake steps
  data?: Hex;
  value?: string;
}

export interface DeFiRoute {
  id: string;
  chain: string;
  steps: DeFiRouteStep[];
  totalSteps: number;
  requiresApproval: boolean;

  // Summary
  inputToken: DeFiAsset;
  inputAmount: string;
  inputValueUsd?: number;

  outputVault: DeFiVault;
  expectedReceiptAmount?: string;
  expectedApy: number;

  // Costs
  estimatedGasUsd: number;
  totalGasUsd?: number;
  totalFeesUsd?: number;
  netValueUsd?: number;

  // Risk
  riskLevel?: RiskLevel;
  riskFactors?: string[];

  expiresAt?: number;
}

export interface RoutePreference {
  maxRiskLevel: RiskLevel;
  minApy?: number;
  minTvl?: number;
  preferredProtocols?: DeFiProtocol[];
  excludedProtocols?: DeFiProtocol[];
  preferredChains?: string[];
  maxGasUsd?: number;
  maxGasPercent?: number; // Max gas as % of deposit value
  preferCompounding?: boolean;
  optimizeFor: "apy" | "safety" | "gas";
}

// ============================================================
// Error Types
// ============================================================

export class DeFiError extends Error {
  constructor(
    message: string,
    public protocol: DeFiProtocol,
    public code: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "DeFiError";
  }
}

export class InsufficientLiquidityError extends DeFiError {
  constructor(protocol: DeFiProtocol, available: string, requested: string) {
    super(
      `Insufficient liquidity: requested ${requested}, available ${available}`,
      protocol,
      "INSUFFICIENT_LIQUIDITY",
      { available, requested }
    );
    this.name = "InsufficientLiquidityError";
  }
}

export class VaultPausedError extends DeFiError {
  constructor(protocol: DeFiProtocol, vaultAddress: string) {
    super(`Vault is paused: ${vaultAddress}`, protocol, "VAULT_PAUSED", {
      vaultAddress,
    });
    this.name = "VaultPausedError";
  }
}

export class DepositCapReachedError extends DeFiError {
  constructor(protocol: DeFiProtocol, vaultAddress: string, cap: string) {
    super(
      `Deposit cap reached: ${cap}`,
      protocol,
      "DEPOSIT_CAP_REACHED",
      { vaultAddress, cap }
    );
    this.name = "DepositCapReachedError";
  }
}
