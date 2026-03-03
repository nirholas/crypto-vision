/**
 * x402 Security Module
 * @description Security utilities for x402 payment protocol
 * @author nirholas
 * @license Apache-2.0
 *
 * SECURITY PRINCIPLES:
 * 1. Private keys ONLY from environment variables
 * 2. Never log, expose, or transmit private keys
 * 3. Validate all inputs before processing
 * 4. Default to most restrictive settings
 * 5. Explicit opt-in for dangerous operations
 */

import { getAddress, isAddress } from "viem"
import Logger from "@/utils/logger.js"

// ============================================================================
// Private Key Security
// ============================================================================

/**
 * Regex for validating private key format
 * Must be exactly 66 characters: 0x + 64 hex chars
 */
const PRIVATE_KEY_REGEX = /^0x[a-fA-F0-9]{64}$/

/**
 * Validate private key format without exposing it
 * @returns Validation result with sanitized error messages
 */
export function validatePrivateKeyFormat(key: string | undefined): {
  valid: boolean
  error?: string
} {
  if (!key) {
    return { valid: false, error: "Private key not provided" }
  }

  if (typeof key !== "string") {
    return { valid: false, error: "Private key must be a string" }
  }

  if (!key.startsWith("0x")) {
    return { valid: false, error: "Private key must start with 0x" }
  }

  if (key.length !== 66) {
    return {
      valid: false,
      error: `Private key must be 66 characters (got ${key.length})`,
    }
  }

  if (!PRIVATE_KEY_REGEX.test(key)) {
    return { valid: false, error: "Private key contains invalid characters" }
  }

  return { valid: true }
}

/**
 * Securely load private key from environment
 * Never logs or exposes the actual key value
 */
export function loadPrivateKeySecure(): `0x${string}` | null {
  const key = process.env.X402_PRIVATE_KEY

  const validation = validatePrivateKeyFormat(key)
  if (!validation.valid) {
    Logger.warn(`x402 Security: ${validation.error}`)
    return null
  }

  // Log only that a key was loaded, never the key itself
  Logger.debug("x402 Security: Private key loaded from environment")

  return key as `0x${string}`
}

/**
 * Check if the private key source is secure
 */
export function isKeySourceSecure(): {
  secure: boolean
  warnings: string[]
} {
  const warnings: string[] = []

  // Check that key is from environment, not hardcoded
  const keyFromEnv = !!process.env.X402_PRIVATE_KEY

  if (!keyFromEnv) {
    warnings.push("No private key found in environment variables")
  }

  // Check for common insecure patterns in the environment
  const envKeys = Object.keys(process.env)
  const suspiciousPatterns = [
    "PRIVATE_KEY_BACKUP",
    "KEY_PLAINTEXT",
    "UNENCRYPTED_KEY",
  ]

  for (const pattern of suspiciousPatterns) {
    if (envKeys.some((k) => k.includes(pattern))) {
      warnings.push(`Potentially insecure environment variable pattern: ${pattern}`)
    }
  }

  return {
    secure: warnings.length === 0,
    warnings,
  }
}

// ============================================================================
// Address Validation
// ============================================================================

/**
 * Validate and checksum an EVM address
 * @param address - Address to validate
 * @returns Checksummed address or null if invalid
 */
export function validateAndChecksumAddress(
  address: string
): `0x${string}` | null {
  try {
    // Check basic format
    if (!isAddress(address)) {
      return null
    }

    // Return checksummed version
    return getAddress(address) as `0x${string}`
  } catch {
    return null
  }
}

/**
 * Check if an address matches its checksum
 */
export function isChecksumValid(address: string): boolean {
  try {
    if (!isAddress(address)) {
      return false
    }
    const checksummed = getAddress(address)
    return address === checksummed
  } catch {
    return false
  }
}

// ============================================================================
// Payment Security
// ============================================================================

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: string, visibleChars = 4): string {
  if (data.length <= visibleChars * 2) {
    return "***"
  }
  const start = data.slice(0, visibleChars)
  const end = data.slice(-visibleChars)
  return `${start}...${end}`
}

/**
 * Sanitize data before logging
 * Removes or masks private keys and other sensitive information
 */
export function sanitizeForLogging(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveKeys = [
    "privateKey",
    "private_key",
    "secretKey",
    "secret_key",
    "apiKey",
    "api_key",
    "password",
    "mnemonic",
    "seed",
    "signature",
  ]

  const sanitized: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk.toLowerCase()))) {
      sanitized[key] = "[REDACTED]"
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForLogging(value as Record<string, unknown>)
    } else if (
      typeof value === "string" &&
      value.startsWith("0x") &&
      value.length === 66
    ) {
      // Looks like a private key, mask it
      sanitized[key] = maskSensitiveData(value)
    } else {
      sanitized[key] = value
    }
  }

  return sanitized
}

// ============================================================================
// Security Audit Trail
// ============================================================================

export interface SecurityEvent {
  timestamp: Date
  event: SecurityEventType
  details: Record<string, unknown>
  severity: "info" | "warning" | "critical"
}

export type SecurityEventType =
  | "key_loaded"
  | "key_validation_failed"
  | "payment_limit_exceeded"
  | "daily_limit_exceeded"
  | "untrusted_service"
  | "invalid_address"
  | "invalid_url"
  | "replay_detected"
  | "mainnet_access"
  | "large_payment_warning"
  | "config_changed"

const securityEvents: SecurityEvent[] = []
const MAX_SECURITY_EVENTS = 1000

/**
 * Log a security event
 */
export function logSecurityEvent(
  event: SecurityEventType,
  details: Record<string, unknown>,
  severity: SecurityEvent["severity"] = "info"
): void {
  const securityEvent: SecurityEvent = {
    timestamp: new Date(),
    event,
    details: sanitizeForLogging(details),
    severity,
  }

  securityEvents.push(securityEvent)

  // Limit stored events
  if (securityEvents.length > MAX_SECURITY_EVENTS) {
    securityEvents.shift()
  }

  // Also log to standard logger based on severity
  const logMessage = `[Security] ${event}: ${JSON.stringify(securityEvent.details)}`
  switch (severity) {
    case "critical":
      Logger.error(logMessage)
      break
    case "warning":
      Logger.warn(logMessage)
      break
    default:
      Logger.debug(logMessage)
  }
}

/**
 * Get recent security events
 */
export function getSecurityEvents(
  limit = 100,
  filterSeverity?: SecurityEvent["severity"]
): SecurityEvent[] {
  let events = [...securityEvents].reverse()

  if (filterSeverity) {
    events = events.filter((e) => e.severity === filterSeverity)
  }

  return events.slice(0, limit)
}

/**
 * Clear security events (for testing only)
 */
export function clearSecurityEvents(): void {
  if (process.env.NODE_ENV !== "test") {
    Logger.warn("clearSecurityEvents called in non-test environment")
  }
  securityEvents.length = 0
}

// ============================================================================
// Security Checks
// ============================================================================

/**
 * Check if current environment is production
 */
export function isProductionEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.X402_ENV === "production"
  )
}

/**
 * Require explicit mainnet opt-in
 */
export function requireMainnetOptIn(): boolean {
  const optIn = process.env.X402_MAINNET_ENABLED === "true"
  if (!optIn) {
    logSecurityEvent(
      "mainnet_access",
      { reason: "Mainnet access attempted without explicit opt-in" },
      "warning"
    )
  }
  return optIn
}

/**
 * Check if running in testnet-only mode
 */
export function isTestnetOnly(): boolean {
  return process.env.X402_TESTNET_ONLY === "true" || !requireMainnetOptIn()
}

// ============================================================================
// Hardware Wallet / External Signer Support
// ============================================================================

export interface ExternalSigner {
  getAddress(): Promise<`0x${string}`>
  signMessage(message: string): Promise<`0x${string}`>
  signTransaction(tx: Record<string, unknown>): Promise<`0x${string}`>
}

let externalSigner: ExternalSigner | null = null

/**
 * Register an external signer (hardware wallet, etc.)
 */
export function registerExternalSigner(signer: ExternalSigner): void {
  externalSigner = signer
  logSecurityEvent("config_changed", { type: "external_signer_registered" }, "info")
  Logger.info("x402 Security: External signer registered")
}

/**
 * Check if external signer is available
 */
export function hasExternalSigner(): boolean {
  return externalSigner !== null
}

/**
 * Get the external signer
 */
export function getExternalSigner(): ExternalSigner | null {
  return externalSigner
}

/**
 * Clear external signer (for testing)
 */
export function clearExternalSigner(): void {
  externalSigner = null
}

// ============================================================================
// Entropy / Randomness
// ============================================================================

/**
 * Generate cryptographically secure random bytes
 */
export function secureRandomBytes(length: number): Uint8Array {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return array
  }
  // Fallback for Node.js
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto")
  return new Uint8Array(nodeCrypto.randomBytes(length))
}

/**
 * Generate a secure random nonce
 */
export function generateSecureNonce(): string {
  const bytes = secureRandomBytes(32)
  return "0x" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")
}
