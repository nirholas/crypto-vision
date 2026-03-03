import { type Address, type Hash, type Hex } from "viem";
import { z } from "zod";

// ============================================================================
// Core Types
// ============================================================================

export type SupportedGasToken = "USDC" | "USDT" | "DAI";

export interface GasTokenConfig {
  symbol: SupportedGasToken;
  address: Address;
  decimals: number;
  exchangeRate: bigint; // Token amount per ETH (scaled by 1e18)
}

// ============================================================================
// Smart Wallet Types
// ============================================================================

export interface SmartWalletConfig {
  ownerAddress: Address;
  chainId: number;
  salt?: bigint;
}

export interface SmartWallet {
  address: Address;
  ownerAddress: Address;
  chainId: number;
  isDeployed: boolean;
}

// ============================================================================
// Permit2 Types
// ============================================================================

export interface PermitTransferFrom {
  permitted: {
    token: Address;
    amount: bigint;
  };
  spender: Address;
  nonce: bigint;
  deadline: number;
}

export interface PermitBatch {
  permitted: Array<{
    token: Address;
    amount: bigint;
  }>;
  spender: Address;
  nonce: bigint;
  deadline: number;
}

export interface SignedPermit {
  permit: PermitTransferFrom;
  signature: Hex;
}

export interface SignedPermitBatch {
  permit: PermitBatch;
  signature: Hex;
}

// ============================================================================
// UserOperation Types (ERC-4337)
// ============================================================================

export interface UserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  callGasLimit: bigint;
  verificationGasLimit: bigint;
  preVerificationGas: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
  paymasterAndData: Hex;
  signature: Hex;
}

export interface PackedUserOperation {
  sender: Address;
  nonce: bigint;
  initCode: Hex;
  callData: Hex;
  accountGasLimits: Hex;
  preVerificationGas: bigint;
  gasFees: Hex;
  paymasterAndData: Hex;
  signature: Hex;
}

export interface UserOpReceipt {
  userOpHash: Hash;
  transactionHash: Hash;
  success: boolean;
  reason?: string;
  actualGasCost: bigint;
  actualGasUsed: bigint;
}

// ============================================================================
// Paymaster Types
// ============================================================================

export interface PaymasterData {
  validUntil: number;
  validAfter: number;
  gasToken: Address;
  exchangeRate: bigint;
  postOpGas: bigint;
}

export interface PaymasterResponse {
  paymasterAndData: Hex;
  preVerificationGas: bigint;
  verificationGasLimit: bigint;
  callGasLimit: bigint;
}

// ============================================================================
// Bundler Types
// ============================================================================

export type BundlerProvider = "pimlico" | "alchemy";

export interface BundlerConfig {
  provider: BundlerProvider;
  apiKey: string;
  chainId: number;
  priority: number;
}

export interface GasEstimate {
  preVerificationGas: bigint;
  verificationGasLimit: bigint;
  callGasLimit: bigint;
  maxFeePerGas: bigint;
  maxPriorityFeePerGas: bigint;
}

// ============================================================================
// Swap Types
// ============================================================================

export interface SwapCall {
  tokenIn: Address;
  tokenOut: Address;
  amountIn: bigint;
  minAmountOut: bigint;
  callData: Hex;
  to: Address;
  value: bigint;
}

export interface BatchSwapRequest {
  swaps: SwapCall[];
  owner: Address;
  recipient: Address;
  deadline: number;
}

// ============================================================================
// Execution Types
// ============================================================================

export interface ExecutionRequest {
  chainId: number;
  owner: Address;
  swaps: SwapCall[];
  gasToken: Address;
  recipient: Address;
  permitSignatures?: SignedPermitBatch;
}

export interface ExecutionResult {
  success: boolean;
  userOpHash?: Hash;
  transactionHash?: Hash;
  swapsExecuted: number;
  totalInputValue: bigint;
  totalOutputValue: bigint;
  gasCost: bigint;
  gasToken: Address;
  error?: string;
}

// ============================================================================
// Simulation Types
// ============================================================================

export interface SimulationRequest {
  chainId: number;
  from: Address;
  to: Address;
  data: Hex;
  value: bigint;
  gasLimit: bigint;
}

export interface SimulationResult {
  success: boolean;
  gasUsed: bigint;
  returnData: Hex;
  logs: SimulationLog[];
  balanceChanges: BalanceChange[];
  error?: string;
}

export interface SimulationLog {
  address: Address;
  topics: Hex[];
  data: Hex;
}

export interface BalanceChange {
  address: Address;
  token: Address;
  before: bigint;
  after: bigint;
  delta: bigint;
}

export interface UserOpSimulationResult {
  success: boolean;
  validationResult: {
    preOpGas: bigint;
    prefund: bigint;
    sigFailed: boolean;
    validAfter: number;
    validUntil: number;
  };
  executionResult: SimulationResult;
}

// ============================================================================
// Solana Types
// ============================================================================

export interface SolanaSwapRequest {
  inputMint: string;
  outputMint: string;
  amountIn: bigint;
  minAmountOut: bigint;
  slippageBps: number;
  userPublicKey: string;
}

export interface SolanaExecutionResult {
  success: boolean;
  signature?: string;
  slot?: number;
  inputAmount: bigint;
  outputAmount: bigint;
  error?: string;
}

export interface JitoTipConfig {
  tipLamports: bigint;
  tipAccount: string;
}

// ============================================================================
// Zod Schemas for Runtime Validation
// ============================================================================

export const ExecutionRequestSchema = z.object({
  chainId: z.number(),
  owner: z.string().startsWith("0x"),
  swaps: z.array(
    z.object({
      tokenIn: z.string().startsWith("0x"),
      tokenOut: z.string().startsWith("0x"),
      amountIn: z.bigint(),
      minAmountOut: z.bigint(),
      callData: z.string().startsWith("0x"),
      to: z.string().startsWith("0x"),
      value: z.bigint(),
    })
  ),
  gasToken: z.string().startsWith("0x"),
  recipient: z.string().startsWith("0x"),
});

export const SolanaSwapRequestSchema = z.object({
  inputMint: z.string(),
  outputMint: z.string(),
  amountIn: z.bigint(),
  minAmountOut: z.bigint(),
  slippageBps: z.number().min(0).max(5000),
  userPublicKey: z.string(),
});
