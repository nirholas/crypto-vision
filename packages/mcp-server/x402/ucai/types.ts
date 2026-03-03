/**
 * UCAI x402 Types
 * @description Type definitions for x402-powered smart contract AI payments
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address, Hash, Hex } from "viem"

// ============================================================================
// Pricing Constants
// ============================================================================

export const UCAI_PRICING = {
  /** Premium contract analysis - security audit, rug pull detection */
  CONTRACT_ANALYSIS: "0.05",
  /** Transaction simulation before execution */
  TRANSACTION_SIMULATION: "0.01",
  /** Historical contract data query */
  HISTORICAL_DATA: "0.02",
  /** Custom ABI generation from unverified contracts */
  ABI_GENERATION: "0.10",
  /** Gas sponsorship base fee (percentage of gas cost) */
  GAS_SPONSORSHIP_FEE: "0.10",
} as const

// ============================================================================
// Gas Sponsorship Types
// ============================================================================

export interface GasSponsorshipRequest {
  /** User's wallet address that needs gas */
  userAddress: Address
  /** Target contract address */
  contractAddress: Address
  /** Function to call */
  functionName: string
  /** Function arguments */
  args: unknown[]
  /** Contract ABI */
  abi: unknown[]
  /** Network to execute on */
  network: string
  /** Maximum gas amount in USD willing to sponsor */
  maxGasUsd?: string
}

export interface GasSponsorshipResult {
  /** Whether sponsorship was successful */
  success: boolean
  /** Transaction hash */
  transactionHash?: Hash
  /** Gas cost in native token */
  gasCostNative?: string
  /** Gas cost in USD */
  gasCostUsd?: string
  /** x402 payment amount */
  paymentAmount?: string
  /** User operation hash (for account abstraction) */
  userOpHash?: Hash
  /** Error message if failed */
  error?: string
}

export interface GasSponsorConfig {
  /** Maximum gas to sponsor per transaction in USD */
  maxGasPerTx: string
  /** Supported networks for sponsorship */
  supportedNetworks: string[]
  /** Paymaster contract addresses by network */
  paymasterAddresses: Record<string, Address>
  /** Entry point addresses for account abstraction */
  entryPointAddresses: Record<string, Address>
}

// ============================================================================
// Contract Analysis Types
// ============================================================================

export interface ContractAnalysisRequest {
  /** Contract address to analyze */
  contractAddress: Address
  /** Network the contract is on */
  network: string
  /** Type of analysis requested */
  analysisType: AnalysisType[]
}

export type AnalysisType = 
  | "security_audit"
  | "rug_pull_detection"
  | "contract_verification"
  | "ownership_analysis"
  | "proxy_detection"
  | "token_analysis"
  | "full_audit"

export interface SecurityAuditResult {
  /** Overall security score (0-100) */
  securityScore: number
  /** Risk level classification */
  riskLevel: "critical" | "high" | "medium" | "low" | "safe"
  /** List of vulnerabilities found */
  vulnerabilities: Vulnerability[]
  /** Ownership information */
  ownership: OwnershipInfo
  /** Whether contract is a proxy */
  isProxy: boolean
  /** Proxy implementation address if applicable */
  implementationAddress?: Address
  /** Contract verification status */
  verified: boolean
  /** Audit recommendations */
  recommendations: string[]
}

export interface Vulnerability {
  /** Vulnerability type */
  type: string
  /** Severity level */
  severity: "critical" | "high" | "medium" | "low" | "info"
  /** Description of the vulnerability */
  description: string
  /** Affected function or code location */
  location?: string
  /** Potential impact */
  impact: string
  /** Recommended fix */
  recommendation: string
}

export interface OwnershipInfo {
  /** Owner address */
  owner: Address
  /** Whether ownership is renounced */
  isRenounced: boolean
  /** Whether there's a timelock */
  hasTimelock: boolean
  /** Timelock duration in seconds */
  timelockDuration?: number
  /** Whether owner has dangerous permissions */
  hasDangerousPermissions: boolean
  /** List of owner permissions */
  permissions: string[]
}

export interface RugPullIndicators {
  /** Overall rug pull risk score (0-100) */
  riskScore: number
  /** Is this likely a honeypot? */
  isHoneypot: boolean
  /** Can owner mint unlimited tokens? */
  hasUnlimitedMint: boolean
  /** Can trading be paused? */
  canPauseTrading: boolean
  /** Are there blacklist functions? */
  hasBlacklist: boolean
  /** Is there a hidden owner? */
  hasHiddenOwner: boolean
  /** Buy/sell tax percentage */
  buyTax?: number
  sellTax?: number
  /** Is liquidity locked? */
  liquidityLocked: boolean
  /** Liquidity lock duration */
  lockDuration?: number
  /** Contract age in days */
  contractAgeDays: number
  /** Detailed indicators */
  indicators: RugIndicator[]
}

export interface RugIndicator {
  /** Indicator type */
  type: string
  /** Risk level */
  risk: "critical" | "high" | "medium" | "low"
  /** Description */
  description: string
  /** Evidence supporting this indicator */
  evidence?: string
}

// ============================================================================
// Transaction Simulation Types
// ============================================================================

export interface SimulationRequest {
  /** Contract address */
  contractAddress: Address
  /** Function to simulate */
  functionName: string
  /** Function arguments */
  args: unknown[]
  /** Contract ABI */
  abi: unknown[]
  /** Sender address */
  from: Address
  /** Value to send (in wei) */
  value?: bigint
  /** Network to simulate on */
  network: string
}

export interface SimulationResult {
  /** Whether the transaction would succeed */
  success: boolean
  /** Return value from the function */
  returnValue?: unknown
  /** Decoded return value */
  decodedReturn?: unknown
  /** Gas used */
  gasUsed: bigint
  /** Gas limit recommendation */
  gasLimit: bigint
  /** State changes that would occur */
  stateChanges: StateChange[]
  /** Events that would be emitted */
  events: SimulatedEvent[]
  /** Token transfers that would occur */
  tokenTransfers: TokenTransfer[]
  /** ETH/native transfers */
  nativeTransfers: NativeTransfer[]
  /** Error message if simulation fails */
  error?: string
  /** Error reason/revert message */
  revertReason?: string
  /** Warnings about the transaction */
  warnings: string[]
}

export interface StateChange {
  /** Contract address being modified */
  contract: Address
  /** Storage slot being modified */
  slot: Hex
  /** Previous value */
  previousValue: Hex
  /** New value */
  newValue: Hex
  /** Human-readable description */
  description?: string
}

export interface SimulatedEvent {
  /** Contract that emits the event */
  address: Address
  /** Event name */
  name: string
  /** Event signature */
  signature: string
  /** Event topics */
  topics: Hex[]
  /** Decoded event data */
  args: Record<string, unknown>
}

export interface TokenTransfer {
  /** Token contract address */
  token: Address
  /** Token symbol */
  symbol?: string
  /** Token decimals */
  decimals?: number
  /** Sender */
  from: Address
  /** Recipient */
  to: Address
  /** Amount transferred */
  amount: bigint
  /** Human-readable amount */
  formattedAmount?: string
}

export interface NativeTransfer {
  /** Sender */
  from: Address
  /** Recipient */
  to: Address
  /** Amount in wei */
  amount: bigint
  /** Human-readable amount */
  formattedAmount: string
}

// ============================================================================
// Historical Data Types
// ============================================================================

export interface HistoricalDataRequest {
  /** Contract address */
  contractAddress: Address
  /** Network */
  network: string
  /** Type of historical data */
  dataType: HistoricalDataType
  /** Start block or timestamp */
  fromBlock?: bigint | "earliest"
  /** End block or timestamp */
  toBlock?: bigint | "latest"
  /** Event filter (for event logs) */
  eventFilter?: {
    eventName?: string
    topics?: (Hex | null)[]
  }
  /** Maximum number of results */
  limit?: number
}

export type HistoricalDataType = 
  | "transactions"
  | "event_logs"
  | "state_changes"
  | "balance_history"
  | "function_calls"

export interface HistoricalTransaction {
  /** Transaction hash */
  hash: Hash
  /** Block number */
  blockNumber: bigint
  /** Timestamp */
  timestamp: number
  /** From address */
  from: Address
  /** To address */
  to: Address
  /** Value in wei */
  value: bigint
  /** Function called */
  functionName?: string
  /** Function arguments */
  args?: unknown[]
  /** Gas used */
  gasUsed: bigint
  /** Transaction status */
  status: "success" | "failed"
}

export interface HistoricalEventLog {
  /** Transaction hash */
  transactionHash: Hash
  /** Block number */
  blockNumber: bigint
  /** Log index */
  logIndex: number
  /** Timestamp */
  timestamp: number
  /** Event name */
  eventName: string
  /** Event signature */
  signature: string
  /** Decoded event data */
  args: Record<string, unknown>
  /** Raw topics */
  topics: Hex[]
  /** Raw data */
  data: Hex
}

export interface HistoricalStateChange {
  /** Block number */
  blockNumber: bigint
  /** Transaction hash that caused the change */
  transactionHash: Hash
  /** Timestamp */
  timestamp: number
  /** Storage slot */
  slot: Hex
  /** Previous value */
  previousValue: Hex
  /** New value */
  newValue: Hex
  /** Decoded meaning if available */
  meaning?: string
}

export interface HistoricalDataResult {
  /** Contract address */
  contractAddress: Address
  /** Network */
  network: string
  /** Data type */
  dataType: HistoricalDataType
  /** Block range queried */
  blockRange: {
    from: bigint
    to: bigint
  }
  /** Transactions if requested */
  transactions?: HistoricalTransaction[]
  /** Events if requested */
  events?: HistoricalEventLog[]
  /** State changes if requested */
  stateChanges?: HistoricalStateChange[]
  /** Total count */
  totalCount: number
  /** Whether more results exist */
  hasMore: boolean
}

// ============================================================================
// ABI Generation Types
// ============================================================================

export interface ABIGenerationRequest {
  /** Contract address */
  contractAddress: Address
  /** Network */
  network: string
  /** Include AI-enhanced descriptions */
  includeDescriptions?: boolean
  /** Attempt to detect known patterns (ERC20, ERC721, etc.) */
  detectStandards?: boolean
}

export interface ABIGenerationResult {
  /** Generated ABI */
  abi: ABIItem[]
  /** Contract bytecode */
  bytecode: Hex
  /** Detected standards */
  detectedStandards: ContractStandard[]
  /** Contract type guess */
  contractType?: string
  /** Decompiled source (if possible) */
  decompiledSource?: string
  /** Confidence score (0-100) */
  confidence: number
  /** Generation method used */
  method: "verified" | "decompiled" | "pattern_matching" | "ai_enhanced"
  /** Warnings about the generation */
  warnings: string[]
}

export interface ABIItem {
  /** Function/event type */
  type: "function" | "event" | "constructor" | "fallback" | "receive"
  /** Name of the function/event */
  name?: string
  /** Input parameters */
  inputs?: ABIParameter[]
  /** Output parameters */
  outputs?: ABIParameter[]
  /** State mutability */
  stateMutability?: "pure" | "view" | "nonpayable" | "payable"
  /** Whether anonymous (for events) */
  anonymous?: boolean
  /** AI-generated description */
  description?: string
}

export interface ABIParameter {
  /** Parameter name */
  name: string
  /** Parameter type */
  type: string
  /** Indexed (for events) */
  indexed?: boolean
  /** Nested components for tuples */
  components?: ABIParameter[]
  /** AI-generated description */
  description?: string
}

export type ContractStandard = 
  | "ERC20"
  | "ERC721"
  | "ERC1155"
  | "ERC777"
  | "ERC4626"
  | "Ownable"
  | "Pausable"
  | "AccessControl"
  | "Upgradeable"
  | "Proxy"
  | "Timelock"
  | "Governor"
  | "Unknown"

// ============================================================================
// Payment & Subscription Types
// ============================================================================

export interface UCAPPaymentConfig {
  /** X402 payment channel address */
  paymentChannelAddress: Address
  /** X402 subscription contract address */
  subscriptionAddress: Address
  /** Tool registry address */
  toolRegistryAddress: Address
  /** Accepted tokens for payment */
  acceptedTokens: Address[]
  /** Default token for payments */
  defaultToken: Address
  /** Network for payments */
  paymentNetwork: string
}

export interface UCAPSubscription {
  /** Subscription ID */
  id: string
  /** Subscriber address */
  subscriber: Address
  /** Subscription tier */
  tier: SubscriptionTier
  /** Monthly price in USD */
  priceUsd: string
  /** Start timestamp */
  startedAt: number
  /** Expiry timestamp */
  expiresAt: number
  /** Features included */
  features: string[]
  /** Usage limits */
  limits: SubscriptionLimits
}

export type SubscriptionTier = "free" | "basic" | "pro" | "enterprise"

export interface SubscriptionLimits {
  /** Max contract analyses per month */
  contractAnalyses: number
  /** Max simulations per month */
  simulations: number
  /** Max historical queries per month */
  historicalQueries: number
  /** Max ABI generations per month */
  abiGenerations: number
  /** Max gas sponsorship USD per month */
  gasSponsorshipUsd: string
}

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, SubscriptionLimits> = {
  free: {
    contractAnalyses: 5,
    simulations: 10,
    historicalQueries: 20,
    abiGenerations: 2,
    gasSponsorshipUsd: "0",
  },
  basic: {
    contractAnalyses: 50,
    simulations: 100,
    historicalQueries: 500,
    abiGenerations: 20,
    gasSponsorshipUsd: "10",
  },
  pro: {
    contractAnalyses: 500,
    simulations: 1000,
    historicalQueries: 5000,
    abiGenerations: 100,
    gasSponsorshipUsd: "100",
  },
  enterprise: {
    contractAnalyses: -1, // unlimited
    simulations: -1,
    historicalQueries: -1,
    abiGenerations: -1,
    gasSponsorshipUsd: "1000",
  },
}

// ============================================================================
// Tool Registry Types
// ============================================================================

export interface UCAPTool {
  /** Tool ID */
  id: string
  /** Tool name */
  name: string
  /** Tool description */
  description: string
  /** Price per use in USD */
  priceUsd: string
  /** Required subscription tier (null = pay-per-use) */
  requiredTier: SubscriptionTier | null
  /** Whether tool is enabled */
  enabled: boolean
  /** Tool category */
  category: ToolCategory
}

export type ToolCategory = 
  | "gas_sponsorship"
  | "security_analysis"
  | "simulation"
  | "historical_data"
  | "abi_tools"
  | "contract_interaction"

export const UCAP_TOOLS: UCAPTool[] = [
  {
    id: "gas_sponsor",
    name: "Gas Sponsorship",
    description: "Pay for user's gas using x402 payment",
    priceUsd: UCAI_PRICING.GAS_SPONSORSHIP_FEE,
    requiredTier: null,
    enabled: true,
    category: "gas_sponsorship",
  },
  {
    id: "contract_analysis",
    name: "Premium Contract Analysis",
    description: "Security audit, rug pull detection, contract verification",
    priceUsd: UCAI_PRICING.CONTRACT_ANALYSIS,
    requiredTier: null,
    enabled: true,
    category: "security_analysis",
  },
  {
    id: "tx_simulation",
    name: "Transaction Simulation",
    description: "Simulate transactions before executing",
    priceUsd: UCAI_PRICING.TRANSACTION_SIMULATION,
    requiredTier: null,
    enabled: true,
    category: "simulation",
  },
  {
    id: "historical_data",
    name: "Historical Contract Data",
    description: "Query past transactions, events, and state changes",
    priceUsd: UCAI_PRICING.HISTORICAL_DATA,
    requiredTier: null,
    enabled: true,
    category: "historical_data",
  },
  {
    id: "abi_generation",
    name: "Custom ABI Generation",
    description: "Generate ABIs from unverified contracts",
    priceUsd: UCAI_PRICING.ABI_GENERATION,
    requiredTier: null,
    enabled: true,
    category: "abi_tools",
  },
]
