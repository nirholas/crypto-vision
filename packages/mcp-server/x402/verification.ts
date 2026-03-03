/**
 * x402 Payment Verification
 * @description Cryptographic verification and replay protection for x402 payments
 * @author nirholas
 * @license Apache-2.0
 *
 * SECURITY: This module provides critical security features:
 * 1. Cryptographic proof verification
 * 2. Replay attack protection
 * 3. Facilitator signature validation
 * 4. Payment receipt verification
 */

import { verifyMessage, recoverMessageAddress, type Address, keccak256, toBytes } from "viem"
import Logger from "@/utils/logger.js"
import { logSecurityEvent } from "./security.js"

// ============================================================================
// Replay Protection
// ============================================================================

/**
 * Nonce storage for replay protection
 * In production, this should be persisted to a database
 */
const usedNonces: Map<string, { timestamp: number; paymentId: string }> = new Map()
const NONCE_EXPIRY_MS = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Maximum nonces to store in memory
 */
const MAX_NONCES = 100000

/**
 * Check if a nonce has been used (replay attack detection)
 */
export function isNonceUsed(nonce: string): boolean {
  cleanExpiredNonces()
  return usedNonces.has(nonce)
}

/**
 * Mark a nonce as used
 */
export function markNonceUsed(nonce: string, paymentId: string): void {
  cleanExpiredNonces()

  if (usedNonces.has(nonce)) {
    logSecurityEvent("replay_detected", {
      nonce,
      existingPaymentId: usedNonces.get(nonce)?.paymentId,
      newPaymentId: paymentId,
    }, "critical")
    throw new Error("Nonce already used - possible replay attack")
  }

  usedNonces.set(nonce, {
    timestamp: Date.now(),
    paymentId,
  })

  Logger.debug(`x402 Verification: Nonce ${nonce.substring(0, 10)}... marked as used`)
}

/**
 * Clean expired nonces from memory
 */
function cleanExpiredNonces(): void {
  const now = Date.now()
  let cleaned = 0

  for (const [nonce, data] of usedNonces.entries()) {
    if (now - data.timestamp > NONCE_EXPIRY_MS) {
      usedNonces.delete(nonce)
      cleaned++
    }
  }

  // If still over limit, remove oldest entries
  if (usedNonces.size > MAX_NONCES) {
    const entries = Array.from(usedNonces.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp)

    const toRemove = entries.slice(0, usedNonces.size - MAX_NONCES)
    for (const [nonce] of toRemove) {
      usedNonces.delete(nonce)
      cleaned++
    }
  }

  if (cleaned > 0) {
    Logger.debug(`x402 Verification: Cleaned ${cleaned} expired nonces`)
  }
}

/**
 * Get nonce statistics
 */
export function getNonceStats(): {
  count: number
  oldestTimestamp: number | null
  newestTimestamp: number | null
} {
  const timestamps = Array.from(usedNonces.values()).map((v) => v.timestamp)
  return {
    count: usedNonces.size,
    oldestTimestamp: timestamps.length > 0 ? Math.min(...timestamps) : null,
    newestTimestamp: timestamps.length > 0 ? Math.max(...timestamps) : null,
  }
}

// ============================================================================
// Payment Proof Verification
// ============================================================================

export interface PaymentProof {
  /** Transaction hash */
  txHash: string
  /** Chain ID */
  chainId: number
  /** Payer address */
  from: Address
  /** Recipient address */
  to: Address
  /** Amount paid (in token's smallest unit) */
  amount: string
  /** Token address (or 0x0 for native) */
  token: Address
  /** Block number */
  blockNumber: number
  /** Block timestamp */
  timestamp: number
  /** Nonce to prevent replay */
  nonce: string
  /** Signature from facilitator */
  facilitatorSignature?: string
}

export interface ProofVerificationResult {
  valid: boolean
  verified: boolean
  errors: string[]
  warnings: string[]
  details?: {
    txExists: boolean
    amountMatches: boolean
    recipientMatches: boolean
    signatureValid: boolean
    notReplayed: boolean
  }
}

/**
 * Verify a payment proof
 */
export async function verifyPaymentProof(
  proof: PaymentProof,
  expectedRecipient: Address,
  expectedAmount: string,
  facilitatorAddress?: Address
): Promise<ProofVerificationResult> {
  const result: ProofVerificationResult = {
    valid: true,
    verified: false,
    errors: [],
    warnings: [],
    details: {
      txExists: false,
      amountMatches: false,
      recipientMatches: false,
      signatureValid: false,
      notReplayed: false,
    },
  }

  try {
    // Check replay protection
    if (isNonceUsed(proof.nonce)) {
      result.valid = false
      result.errors.push("Payment nonce already used - possible replay attack")
      logSecurityEvent("replay_detected", { nonce: proof.nonce, txHash: proof.txHash }, "critical")
      return result
    }
    result.details!.notReplayed = true

    // Check recipient matches
    if (proof.to.toLowerCase() !== expectedRecipient.toLowerCase()) {
      result.valid = false
      result.errors.push(`Recipient mismatch: expected ${expectedRecipient}, got ${proof.to}`)
      return result
    }
    result.details!.recipientMatches = true

    // Check amount matches
    if (proof.amount !== expectedAmount) {
      result.valid = false
      result.errors.push(`Amount mismatch: expected ${expectedAmount}, got ${proof.amount}`)
      return result
    }
    result.details!.amountMatches = true

    // Verify facilitator signature if provided
    if (proof.facilitatorSignature && facilitatorAddress) {
      const signatureValid = await verifyFacilitatorSignature(
        proof,
        proof.facilitatorSignature,
        facilitatorAddress
      )
      if (!signatureValid) {
        result.valid = false
        result.errors.push("Invalid facilitator signature")
        logSecurityEvent("invalid_signature", {
          type: "facilitator",
          txHash: proof.txHash,
        }, "warning")
        return result
      }
      result.details!.signatureValid = true
    } else if (!proof.facilitatorSignature) {
      result.warnings.push("No facilitator signature provided - verify transaction on-chain")
    }

    // Mark nonce as used
    markNonceUsed(proof.nonce, proof.txHash)

    result.verified = true
    Logger.debug(`x402 Verification: Payment proof verified for tx ${proof.txHash}`)

    return result
  } catch (error) {
    result.valid = false
    result.errors.push(error instanceof Error ? error.message : "Verification failed")
    return result
  }
}

// ============================================================================
// Facilitator Signature Verification
// ============================================================================

/**
 * Known facilitator addresses
 */
const knownFacilitators: Map<Address, { name: string; trusted: boolean }> = new Map()

/**
 * Register a known facilitator
 */
export function registerFacilitator(
  address: Address,
  name: string,
  trusted: boolean = true
): void {
  knownFacilitators.set(address.toLowerCase() as Address, { name, trusted })
  logSecurityEvent("config_changed", {
    type: "facilitator_registered",
    address,
    name,
    trusted,
  }, "info")
}

/**
 * Check if a facilitator is trusted
 */
export function isTrustedFacilitator(address: Address): boolean {
  const facilitator = knownFacilitators.get(address.toLowerCase() as Address)
  return facilitator?.trusted ?? false
}

/**
 * Get all registered facilitators
 */
export function getRegisteredFacilitators(): Array<{
  address: Address
  name: string
  trusted: boolean
}> {
  return Array.from(knownFacilitators.entries()).map(([address, info]) => ({
    address,
    ...info,
  }))
}

/**
 * Create a message to sign for payment proof
 */
function createProofMessage(proof: PaymentProof): string {
  return [
    "x402 Payment Proof",
    `Chain: ${proof.chainId}`,
    `Tx: ${proof.txHash}`,
    `From: ${proof.from}`,
    `To: ${proof.to}`,
    `Amount: ${proof.amount}`,
    `Token: ${proof.token}`,
    `Block: ${proof.blockNumber}`,
    `Timestamp: ${proof.timestamp}`,
    `Nonce: ${proof.nonce}`,
  ].join("\n")
}

/**
 * Verify a facilitator's signature on a payment proof
 */
export async function verifyFacilitatorSignature(
  proof: PaymentProof,
  signature: string,
  expectedSigner: Address
): Promise<boolean> {
  try {
    const message = createProofMessage(proof)

    // Recover signer from signature
    const recoveredAddress = await recoverMessageAddress({
      message,
      signature: signature as `0x${string}`,
    })

    const matches = recoveredAddress.toLowerCase() === expectedSigner.toLowerCase()

    if (!matches) {
      Logger.warn(
        `x402 Verification: Signature signer mismatch. Expected ${expectedSigner}, got ${recoveredAddress}`
      )
    }

    return matches
  } catch (error) {
    Logger.error(`x402 Verification: Signature verification failed: ${error}`)
    return false
  }
}

// ============================================================================
// EIP-3009 Authorization Verification
// ============================================================================

export interface EIP3009Authorization {
  /** Token holder address */
  from: Address
  /** Recipient address */
  to: Address
  /** Amount */
  value: string
  /** Valid after timestamp */
  validAfter: number
  /** Valid before timestamp */
  validBefore: number
  /** Unique nonce */
  nonce: string
  /** Signature v */
  v: number
  /** Signature r */
  r: string
  /** Signature s */
  s: string
}

/**
 * Verify an EIP-3009 authorization hasn't expired
 */
export function verifyAuthorizationTiming(auth: EIP3009Authorization): {
  valid: boolean
  error?: string
} {
  const now = Math.floor(Date.now() / 1000)

  if (auth.validAfter > now) {
    return {
      valid: false,
      error: `Authorization not yet valid. Valid after: ${new Date(auth.validAfter * 1000).toISOString()}`,
    }
  }

  if (auth.validBefore < now) {
    return {
      valid: false,
      error: `Authorization expired. Valid before: ${new Date(auth.validBefore * 1000).toISOString()}`,
    }
  }

  // Check nonce hasn't been used
  if (isNonceUsed(auth.nonce)) {
    logSecurityEvent("replay_detected", { nonce: auth.nonce, type: "eip3009" }, "critical")
    return {
      valid: false,
      error: "Authorization nonce already used",
    }
  }

  return { valid: true }
}

// ============================================================================
// Transaction Hash Verification
// ============================================================================

/**
 * Validate transaction hash format
 */
export function isValidTxHash(hash: string): boolean {
  if (!hash) return false
  if (!hash.startsWith("0x")) return false
  if (hash.length !== 66) return false
  if (!/^0x[a-fA-F0-9]{64}$/.test(hash)) return false
  return true
}

/**
 * Generate a deterministic payment ID from transaction details
 */
export function generatePaymentId(
  chainId: number,
  txHash: string,
  logIndex?: number
): string {
  const input = `${chainId}:${txHash}:${logIndex ?? 0}`
  const hash = keccak256(toBytes(input))
  return hash.substring(0, 18) // Short ID for easier reference
}

// ============================================================================
// Receipt Verification
// ============================================================================

export interface PaymentReceipt {
  paymentId: string
  proof: PaymentProof
  verifiedAt: Date
  facilitator?: {
    address: Address
    name: string
    signatureValid: boolean
  }
}

const verifiedReceipts: Map<string, PaymentReceipt> = new Map()
const MAX_RECEIPTS = 10000

/**
 * Store a verified payment receipt
 */
export function storeReceipt(receipt: PaymentReceipt): void {
  verifiedReceipts.set(receipt.paymentId, receipt)

  // Clean up old receipts
  if (verifiedReceipts.size > MAX_RECEIPTS) {
    const entries = Array.from(verifiedReceipts.entries())
      .sort((a, b) => a[1].verifiedAt.getTime() - b[1].verifiedAt.getTime())

    const toRemove = entries.slice(0, verifiedReceipts.size - MAX_RECEIPTS)
    for (const [id] of toRemove) {
      verifiedReceipts.delete(id)
    }
  }
}

/**
 * Get a stored receipt
 */
export function getReceipt(paymentId: string): PaymentReceipt | undefined {
  return verifiedReceipts.get(paymentId)
}

/**
 * Check if a payment has been verified
 */
export function isPaymentVerified(paymentId: string): boolean {
  return verifiedReceipts.has(paymentId)
}

// ============================================================================
// Clear functions for testing
// ============================================================================

export function clearAllVerificationData(): void {
  if (process.env.NODE_ENV !== "test") {
    Logger.warn("clearAllVerificationData called in non-test environment")
  }
  usedNonces.clear()
  verifiedReceipts.clear()
  knownFacilitators.clear()
}
