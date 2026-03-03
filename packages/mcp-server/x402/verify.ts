/**
 * x402 On-Chain Payment Verification
 * @description Verifies USDC transfers on-chain and validates payments for tool calls
 * @author nirholas
 * @license Apache-2.0
 *
 * SECURITY:
 * - Verifies actual on-chain transactions
 * - Prevents replay attacks with verified payment cache
 * - Supports multiple chains: Base, Ethereum, Arbitrum
 */

import {
  createPublicClient,
  http,
  type Address,
  type Hash,
  parseAbi,
  decodeEventLog,
  formatUnits,
} from "viem"
import { mainnet, base, arbitrum } from "viem/chains"
import Logger from "@/utils/logger.js"
import { TOOL_PRICING, getToolPrice } from "./payments.js"
import { logSecurityEvent } from "./security.js"

// ============================================================================
// Type Definitions
// ============================================================================

export interface USDCTransferVerification {
  valid: boolean
  actualAmount: string
  actualAmountRaw: bigint
  sender: Address
  recipient: Address
  blockNumber: bigint
  transactionHash: Hash
  chainId: number
  error?: string
}

export interface PaymentVerification extends USDCTransferVerification {
  toolName: string
  expectedAmount: string
  cached: boolean
}

export type SupportedChainId = 1 | 8453 | 42161

// ============================================================================
// Chain Configuration
// ============================================================================

/**
 * USDC contract addresses per supported chain
 */
export const USDC_ADDRESSES: Record<SupportedChainId, Address> = {
  1: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // Ethereum Mainnet
  8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
  42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum One
}

/**
 * USDC decimals (6 for all supported chains)
 */
export const USDC_DECIMALS = 6

/**
 * Chain configurations for viem clients
 */
const CHAIN_CONFIGS = {
  1: { chain: mainnet, name: "Ethereum" },
  8453: { chain: base, name: "Base" },
  42161: { chain: arbitrum, name: "Arbitrum" },
} as const

/**
 * RPC endpoints (can be overridden via environment)
 */
const RPC_URLS: Record<SupportedChainId, string> = {
  1: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
  8453: process.env.BASE_RPC_URL || "https://base.llamarpc.com",
  42161: process.env.ARBITRUM_RPC_URL || "https://arbitrum.llamarpc.com",
}

// ============================================================================
// Verified Payment Cache (Replay Protection)
// ============================================================================

interface VerifiedPayment {
  txHash: Hash
  chainId: SupportedChainId
  toolName: string
  amount: string
  sender: Address
  recipient: Address
  verifiedAt: number
}

/**
 * Cache of verified payments to prevent replay attacks
 * In production, this should be persisted to a database
 */
const verifiedPayments: Map<string, VerifiedPayment> = new Map()
const CACHE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_CACHE_SIZE = 50000

/**
 * Generate cache key for a payment
 */
function getCacheKey(txHash: Hash, chainId: SupportedChainId): string {
  return `${chainId}:${txHash.toLowerCase()}`
}

/**
 * Check if a payment has already been verified and used
 */
export function isPaymentUsed(txHash: Hash, chainId: SupportedChainId): boolean {
  cleanExpiredPayments()
  return verifiedPayments.has(getCacheKey(txHash, chainId))
}

/**
 * Get a verified payment from cache
 */
export function getVerifiedPayment(
  txHash: Hash,
  chainId: SupportedChainId
): VerifiedPayment | undefined {
  cleanExpiredPayments()
  return verifiedPayments.get(getCacheKey(txHash, chainId))
}

/**
 * Mark a payment as verified and used
 */
function cacheVerifiedPayment(payment: VerifiedPayment): void {
  cleanExpiredPayments()
  const key = getCacheKey(payment.txHash, payment.chainId)
  
  if (verifiedPayments.has(key)) {
    logSecurityEvent("replay_detected", {
      txHash: payment.txHash,
      chainId: payment.chainId,
      toolName: payment.toolName,
      type: "payment_replay_attempt",
    }, "critical")
    throw new Error("Payment has already been used - replay attack detected")
  }
  
  verifiedPayments.set(key, {
    ...payment,
    verifiedAt: Date.now(),
  })
  
  Logger.debug(`x402 Verify: Cached payment ${payment.txHash.substring(0, 10)}...`)
}

/**
 * Clean expired payments from cache
 */
function cleanExpiredPayments(): void {
  const now = Date.now()
  let cleaned = 0
  
  for (const [key, payment] of verifiedPayments.entries()) {
    if (now - payment.verifiedAt > CACHE_EXPIRY_MS) {
      verifiedPayments.delete(key)
      cleaned++
    }
  }
  
  // If still over limit, remove oldest entries
  if (verifiedPayments.size > MAX_CACHE_SIZE) {
    const entries = Array.from(verifiedPayments.entries())
      .sort((a, b) => a[1].verifiedAt - b[1].verifiedAt)
    
    const toRemove = entries.slice(0, verifiedPayments.size - MAX_CACHE_SIZE)
    for (const [key] of toRemove) {
      verifiedPayments.delete(key)
      cleaned++
    }
  }
  
  if (cleaned > 0) {
    Logger.debug(`x402 Verify: Cleaned ${cleaned} expired payments from cache`)
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  count: number
  maxSize: number
  expiryHours: number
} {
  return {
    count: verifiedPayments.size,
    maxSize: MAX_CACHE_SIZE,
    expiryHours: CACHE_EXPIRY_MS / (60 * 60 * 1000),
  }
}

// ============================================================================
// Public Client Factory
// ============================================================================

/**
 * Create a viem public client for the specified chain
 */
function getPublicClient(chainId: SupportedChainId) {
  const config = CHAIN_CONFIGS[chainId]
  if (!config) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }
  
  return createPublicClient({
    chain: config.chain,
    transport: http(RPC_URLS[chainId]),
  })
}

// ============================================================================
// ERC20 Transfer Event ABI
// ============================================================================

const ERC20_TRANSFER_ABI = parseAbi([
  "event Transfer(address indexed from, address indexed to, uint256 value)",
])

// ============================================================================
// USDC Transfer Verification
// ============================================================================

/**
 * Verify a USDC transfer on-chain
 * 
 * @param txHash - Transaction hash to verify
 * @param expectedAmount - Expected amount in USD (e.g., "0.01" for 1 cent)
 * @param expectedRecipient - Expected recipient address
 * @param chainId - Chain ID (1 = Ethereum, 8453 = Base, 42161 = Arbitrum)
 * @returns Verification result with transaction details
 */
export async function verifyUSDCTransfer(
  txHash: Hash,
  expectedAmount: string,
  expectedRecipient: Address,
  chainId: SupportedChainId
): Promise<USDCTransferVerification> {
  const startTime = Date.now()
  
  try {
    // Validate chain ID
    if (!USDC_ADDRESSES[chainId]) {
      return {
        valid: false,
        actualAmount: "0",
        actualAmountRaw: 0n,
        sender: "0x0000000000000000000000000000000000000000" as Address,
        recipient: expectedRecipient,
        blockNumber: 0n,
        transactionHash: txHash,
        chainId,
        error: `Unsupported chain ID: ${chainId}. Supported: 1 (Ethereum), 8453 (Base), 42161 (Arbitrum)`,
      }
    }
    
    const client = getPublicClient(chainId)
    const usdcAddress = USDC_ADDRESSES[chainId]
    
    // Fetch transaction receipt
    const receipt = await client.getTransactionReceipt({ hash: txHash })
    
    if (!receipt) {
      return {
        valid: false,
        actualAmount: "0",
        actualAmountRaw: 0n,
        sender: "0x0000000000000000000000000000000000000000" as Address,
        recipient: expectedRecipient,
        blockNumber: 0n,
        transactionHash: txHash,
        chainId,
        error: "Transaction not found or not yet confirmed",
      }
    }
    
    if (receipt.status !== "success") {
      return {
        valid: false,
        actualAmount: "0",
        actualAmountRaw: 0n,
        sender: receipt.from,
        recipient: expectedRecipient,
        blockNumber: receipt.blockNumber,
        transactionHash: txHash,
        chainId,
        error: "Transaction reverted",
      }
    }
    
    // Find USDC Transfer event to the expected recipient
    let transferEvent: {
      from: Address
      to: Address
      value: bigint
    } | null = null
    
    for (const log of receipt.logs) {
      // Check if this is a log from the USDC contract
      if (log.address.toLowerCase() !== usdcAddress.toLowerCase()) {
        continue
      }
      
      try {
        const decoded = decodeEventLog({
          abi: ERC20_TRANSFER_ABI,
          data: log.data,
          topics: log.topics,
        })
        
        if (decoded.eventName === "Transfer") {
          const { from, to, value } = decoded.args as {
            from: Address
            to: Address
            value: bigint
          }
          
          // Check if recipient matches
          if (to.toLowerCase() === expectedRecipient.toLowerCase()) {
            transferEvent = { from, to, value }
            break
          }
        }
      } catch {
        // Not a Transfer event, skip
        continue
      }
    }
    
    if (!transferEvent) {
      return {
        valid: false,
        actualAmount: "0",
        actualAmountRaw: 0n,
        sender: receipt.from,
        recipient: expectedRecipient,
        blockNumber: receipt.blockNumber,
        transactionHash: txHash,
        chainId,
        error: `No USDC transfer to ${expectedRecipient} found in transaction`,
      }
    }
    
    // Convert amounts for comparison
    const actualAmount = formatUnits(transferEvent.value, USDC_DECIMALS)
    const expectedAmountNum = parseFloat(expectedAmount)
    const actualAmountNum = parseFloat(actualAmount)
    
    // Verify amount is sufficient (allow slight tolerance for rounding)
    const tolerance = 0.000001 // 0.0001 cents tolerance
    const isAmountSufficient = actualAmountNum >= expectedAmountNum - tolerance
    
    const elapsedMs = Date.now() - startTime
    Logger.debug(
      `x402 Verify: Verified USDC transfer on chain ${chainId} in ${elapsedMs}ms - ` +
      `Expected: ${expectedAmount}, Actual: ${actualAmount}, Valid: ${isAmountSufficient}`
    )
    
    return {
      valid: isAmountSufficient,
      actualAmount,
      actualAmountRaw: transferEvent.value,
      sender: transferEvent.from,
      recipient: transferEvent.to,
      blockNumber: receipt.blockNumber,
      transactionHash: txHash,
      chainId,
      error: isAmountSufficient
        ? undefined
        : `Insufficient amount: expected ${expectedAmount} USDC, got ${actualAmount} USDC`,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    Logger.error(`x402 Verify: Failed to verify USDC transfer: ${errorMessage}`)
    
    return {
      valid: false,
      actualAmount: "0",
      actualAmountRaw: 0n,
      sender: "0x0000000000000000000000000000000000000000" as Address,
      recipient: expectedRecipient,
      blockNumber: 0n,
      transactionHash: txHash,
      chainId,
      error: `Verification failed: ${errorMessage}`,
    }
  }
}

// ============================================================================
// Tool Payment Verification
// ============================================================================

/**
 * Verify a payment for a specific tool call
 * 
 * @param toolName - Name of the tool being called
 * @param txHash - Transaction hash of the payment
 * @param chainId - Chain ID where payment was made
 * @param recipient - Optional recipient address (defaults to FEE_RECIPIENT)
 * @returns Payment verification result
 */
export async function verifyPaymentForTool(
  toolName: string,
  txHash: Hash,
  chainId: SupportedChainId,
  recipient?: Address
): Promise<PaymentVerification> {
  const startTime = Date.now()
  
  // Get tool price
  const toolPrice = getToolPrice(toolName)
  
  // If tool is free, no verification needed
  if (toolPrice === 0) {
    return {
      valid: true,
      actualAmount: "0",
      actualAmountRaw: 0n,
      sender: "0x0000000000000000000000000000000000000000" as Address,
      recipient: recipient || ("0x0000000000000000000000000000000000000000" as Address),
      blockNumber: 0n,
      transactionHash: txHash,
      chainId,
      toolName,
      expectedAmount: "0",
      cached: false,
    }
  }
  
  // Check if payment has already been used (replay protection)
  const cachedPayment = getVerifiedPayment(txHash, chainId)
  if (cachedPayment) {
    // Payment was already verified for a different tool - potential replay
    if (cachedPayment.toolName !== toolName) {
      logSecurityEvent("replay_detected", {
        txHash,
        chainId,
        originalTool: cachedPayment.toolName,
        attemptedTool: toolName,
        type: "payment_reuse_attempt",
      }, "warning")
      
      return {
        valid: false,
        actualAmount: cachedPayment.amount,
        actualAmountRaw: 0n,
        sender: cachedPayment.sender,
        recipient: cachedPayment.recipient,
        blockNumber: 0n,
        transactionHash: txHash,
        chainId,
        toolName,
        expectedAmount: toolPrice.toFixed(USDC_DECIMALS),
        cached: true,
        error: `Payment already used for tool: ${cachedPayment.toolName}`,
      }
    }
    
    // Same tool - return cached verification
    Logger.debug(`x402 Verify: Using cached payment verification for ${toolName}`)
    return {
      valid: true,
      actualAmount: cachedPayment.amount,
      actualAmountRaw: 0n,
      sender: cachedPayment.sender,
      recipient: cachedPayment.recipient,
      blockNumber: 0n,
      transactionHash: txHash,
      chainId,
      toolName,
      expectedAmount: toolPrice.toFixed(USDC_DECIMALS),
      cached: true,
    }
  }
  
  // Get recipient address
  const paymentRecipient = recipient || (process.env.X402_FEE_RECIPIENT as Address)
  
  if (!paymentRecipient) {
    return {
      valid: false,
      actualAmount: "0",
      actualAmountRaw: 0n,
      sender: "0x0000000000000000000000000000000000000000" as Address,
      recipient: "0x0000000000000000000000000000000000000000" as Address,
      blockNumber: 0n,
      transactionHash: txHash,
      chainId,
      toolName,
      expectedAmount: toolPrice.toFixed(USDC_DECIMALS),
      cached: false,
      error: "No payment recipient configured. Set X402_FEE_RECIPIENT environment variable.",
    }
  }
  
  // Verify the USDC transfer on-chain
  const verification = await verifyUSDCTransfer(
    txHash,
    toolPrice.toFixed(USDC_DECIMALS),
    paymentRecipient,
    chainId
  )
  
  // If valid, cache the payment to prevent replay
  if (verification.valid) {
    cacheVerifiedPayment({
      txHash,
      chainId,
      toolName,
      amount: verification.actualAmount,
      sender: verification.sender,
      recipient: verification.recipient,
      verifiedAt: Date.now(),
    })
  }
  
  const elapsedMs = Date.now() - startTime
  Logger.info(
    `x402 Verify: Tool payment verification for "${toolName}" completed in ${elapsedMs}ms - ` +
    `Valid: ${verification.valid}, Chain: ${chainId}`
  )
  
  return {
    ...verification,
    toolName,
    expectedAmount: toolPrice.toFixed(USDC_DECIMALS),
    cached: false,
  }
}

// ============================================================================
// Batch Verification
// ============================================================================

export interface BatchVerificationResult {
  results: PaymentVerification[]
  totalValid: number
  totalInvalid: number
  totalAmount: string
}

/**
 * Verify multiple tool payments in batch
 */
export async function verifyBatchPayments(
  payments: Array<{
    toolName: string
    txHash: Hash
    chainId: SupportedChainId
  }>,
  recipient?: Address
): Promise<BatchVerificationResult> {
  const results = await Promise.all(
    payments.map((p) => verifyPaymentForTool(p.toolName, p.txHash, p.chainId, recipient))
  )
  
  let totalAmount = 0
  let totalValid = 0
  let totalInvalid = 0
  
  for (const result of results) {
    if (result.valid) {
      totalValid++
      totalAmount += parseFloat(result.actualAmount)
    } else {
      totalInvalid++
    }
  }
  
  return {
    results,
    totalValid,
    totalInvalid,
    totalAmount: totalAmount.toFixed(USDC_DECIMALS),
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if a chain ID is supported
 */
export function isSupportedChain(chainId: number): chainId is SupportedChainId {
  return chainId in USDC_ADDRESSES
}

/**
 * Get USDC address for a chain
 */
export function getUSDCAddress(chainId: SupportedChainId): Address {
  return USDC_ADDRESSES[chainId]
}

/**
 * Get chain name from chain ID
 */
export function getChainName(chainId: SupportedChainId): string {
  return CHAIN_CONFIGS[chainId]?.name || `Chain ${chainId}`
}

/**
 * List all supported chains
 */
export function getSupportedChains(): Array<{
  chainId: SupportedChainId
  name: string
  usdcAddress: Address
}> {
  return Object.entries(CHAIN_CONFIGS).map(([id, config]) => ({
    chainId: Number(id) as SupportedChainId,
    name: config.name,
    usdcAddress: USDC_ADDRESSES[Number(id) as SupportedChainId],
  }))
}

// ============================================================================
// Exports
// ============================================================================

export default {
  verifyUSDCTransfer,
  verifyPaymentForTool,
  verifyBatchPayments,
  isPaymentUsed,
  getVerifiedPayment,
  getCacheStats,
  isSupportedChain,
  getUSDCAddress,
  getChainName,
  getSupportedChains,
  USDC_ADDRESSES,
  USDC_DECIMALS,
}
