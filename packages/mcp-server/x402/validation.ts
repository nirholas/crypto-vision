/**
 * x402 Input Validation
 * @description Comprehensive input validation for x402 payment protocol
 * @author nirholas
 * @license Apache-2.0
 *
 * SECURITY: All user inputs MUST be validated before processing.
 * This module provides strict validation for:
 * - URLs (prevent SSRF, restrict to HTTPS)
 * - Amounts (positive, within limits)
 * - Addresses (valid format, checksummed)
 * - General inputs (sanitization, length limits)
 */

import { getAddress, isAddress } from "viem"
import { logSecurityEvent } from "./security.js"
import { getPaymentLimits, DEFAULT_LIMITS } from "./limits.js"

// ============================================================================
// URL Validation
// ============================================================================

/**
 * URL validation options
 */
export interface URLValidationOptions {
  /** Allow localhost URLs (default: false) */
  allowLocalhost?: boolean
  /** Allow private IP ranges (default: false) */
  allowPrivateIP?: boolean
  /** Allow HTTP (non-HTTPS) URLs (default: false for mainnet) */
  allowHttp?: boolean
  /** Allow specific protocols (default: ['https']) */
  allowedProtocols?: string[]
  /** Block specific domains */
  blockedDomains?: string[]
  /** Maximum URL length */
  maxLength?: number
}

const DEFAULT_URL_OPTIONS: URLValidationOptions = {
  allowLocalhost: false,
  allowPrivateIP: false,
  allowHttp: false,
  allowedProtocols: ["https:"],
  blockedDomains: [],
  maxLength: 2048,
}

/**
 * Private IP ranges (IPv4)
 */
const PRIVATE_IP_RANGES = [
  /^127\./,                       // Loopback
  /^10\./,                        // Class A private
  /^172\.(1[6-9]|2\d|3[01])\./,  // Class B private
  /^192\.168\./,                  // Class C private
  /^169\.254\./,                  // Link-local
  /^0\./,                         // Current network
]

/**
 * Check if hostname is a private IP
 */
function isPrivateIP(hostname: string): boolean {
  return PRIVATE_IP_RANGES.some((regex) => regex.test(hostname))
}

/**
 * Check if hostname is localhost
 */
function isLocalhost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  )
}

export interface URLValidationResult {
  valid: boolean
  url?: URL
  errors: string[]
  warnings: string[]
}

/**
 * Validate a URL for x402 requests
 */
export function validateURL(
  urlString: string,
  options: URLValidationOptions = {}
): URLValidationResult {
  const opts = { ...DEFAULT_URL_OPTIONS, ...options }
  const result: URLValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  }

  // Check length
  if (urlString.length > opts.maxLength!) {
    result.valid = false
    result.errors.push(`URL exceeds maximum length of ${opts.maxLength} characters`)
    logSecurityEvent("invalid_url", { reason: "too_long", length: urlString.length }, "warning")
    return result
  }

  // Try to parse URL
  let url: URL
  try {
    url = new URL(urlString)
    result.url = url
  } catch {
    result.valid = false
    result.errors.push("Invalid URL format")
    logSecurityEvent("invalid_url", { reason: "parse_failed", url: urlString.substring(0, 100) }, "warning")
    return result
  }

  // Check protocol
  if (!opts.allowedProtocols!.includes(url.protocol)) {
    result.valid = false
    result.errors.push(`Protocol "${url.protocol}" not allowed. Use: ${opts.allowedProtocols!.join(", ")}`)
    logSecurityEvent("invalid_url", { reason: "bad_protocol", protocol: url.protocol }, "warning")
    return result
  }

  // Check for localhost
  if (isLocalhost(url.hostname)) {
    if (!opts.allowLocalhost) {
      result.valid = false
      result.errors.push("Localhost URLs are not allowed")
      logSecurityEvent("invalid_url", { reason: "localhost", hostname: url.hostname }, "warning")
      return result
    }
    result.warnings.push("Using localhost URL - only for development")
  }

  // Check for private IPs
  if (isPrivateIP(url.hostname)) {
    if (!opts.allowPrivateIP) {
      result.valid = false
      result.errors.push("Private IP addresses are not allowed")
      logSecurityEvent("invalid_url", { reason: "private_ip", hostname: url.hostname }, "warning")
      return result
    }
    result.warnings.push("Using private IP - only for internal networks")
  }

  // Check blocked domains
  if (opts.blockedDomains && opts.blockedDomains.length > 0) {
    const hostname = url.hostname.toLowerCase()
    for (const blocked of opts.blockedDomains) {
      if (hostname === blocked || hostname.endsWith(`.${blocked}`)) {
        result.valid = false
        result.errors.push(`Domain "${blocked}" is blocked`)
        logSecurityEvent("invalid_url", { reason: "blocked_domain", domain: blocked }, "warning")
        return result
      }
    }
  }

  // Check for HTTP (non-HTTPS)
  if (url.protocol === "http:" && !opts.allowHttp) {
    result.valid = false
    result.errors.push("HTTP URLs are not allowed - use HTTPS")
    logSecurityEvent("invalid_url", { reason: "http_not_allowed" }, "warning")
    return result
  }

  return result
}

/**
 * Get URL validation options for testnet vs mainnet
 */
export function getURLValidationOptions(isTestnet: boolean): URLValidationOptions {
  if (isTestnet) {
    return {
      allowLocalhost: true,
      allowPrivateIP: true,
      allowHttp: true,
      allowedProtocols: ["https:", "http:"],
    }
  }
  return DEFAULT_URL_OPTIONS
}

// ============================================================================
// Amount Validation
// ============================================================================

export interface AmountValidationResult {
  valid: boolean
  amount?: number
  errors: string[]
  warnings: string[]
}

/**
 * Validate a payment amount
 */
export function validateAmount(
  amountString: string,
  options: {
    maxAmount?: number
    minAmount?: number
    allowZero?: boolean
    currency?: string
  } = {}
): AmountValidationResult {
  const result: AmountValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  }

  const limits = getPaymentLimits()
  const maxAmount = options.maxAmount ?? limits.maxSinglePayment
  const minAmount = options.minAmount ?? 0.0001
  const allowZero = options.allowZero ?? false

  // Try to parse amount
  const amount = parseFloat(amountString)

  if (isNaN(amount)) {
    result.valid = false
    result.errors.push("Amount must be a valid number")
    return result
  }

  result.amount = amount

  // Check for negative
  if (amount < 0) {
    result.valid = false
    result.errors.push("Amount cannot be negative")
    return result
  }

  // Check for zero
  if (amount === 0 && !allowZero) {
    result.valid = false
    result.errors.push("Amount cannot be zero")
    return result
  }

  // Check minimum
  if (amount > 0 && amount < minAmount) {
    result.valid = false
    result.errors.push(`Amount must be at least ${minAmount}`)
    return result
  }

  // Check maximum
  if (amount > maxAmount) {
    result.valid = false
    result.errors.push(`Amount exceeds maximum of ${maxAmount}`)
    logSecurityEvent("payment_limit_exceeded", {
      amount,
      maxAmount,
      currency: options.currency,
    }, "warning")
    return result
  }

  // Check hard cap
  if (amount > DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE) {
    result.valid = false
    result.errors.push(`Amount exceeds absolute maximum of $${DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE}`)
    logSecurityEvent("payment_limit_exceeded", {
      amount,
      maxAmount: DEFAULT_LIMITS.ABSOLUTE_MAX_SINGLE,
      type: "hard_cap",
    }, "critical")
    return result
  }

  // Warning for large payments
  if (amount >= limits.largePaymentWarning) {
    result.warnings.push(`Large payment: $${amount.toFixed(2)} - consider double-checking`)
    logSecurityEvent("large_payment_warning", { amount }, "info")
  }

  // Check for excessive precision
  const decimalPlaces = (amountString.split(".")[1] || "").length
  if (decimalPlaces > 18) {
    result.warnings.push("Amount has excessive decimal precision - may be truncated")
  }

  return result
}

// ============================================================================
// Address Validation
// ============================================================================

export interface AddressValidationResult {
  valid: boolean
  address?: `0x${string}`
  checksummed?: `0x${string}`
  errors: string[]
  warnings: string[]
}

/**
 * Validate an EVM address
 */
export function validateAddress(
  addressString: string,
  options: {
    requireChecksum?: boolean
    blockedAddresses?: string[]
  } = {}
): AddressValidationResult {
  const result: AddressValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  }

  // Check basic format
  if (!addressString) {
    result.valid = false
    result.errors.push("Address is required")
    return result
  }

  if (!addressString.startsWith("0x")) {
    result.valid = false
    result.errors.push("Address must start with 0x")
    logSecurityEvent("invalid_address", { reason: "no_0x_prefix" }, "warning")
    return result
  }

  if (addressString.length !== 42) {
    result.valid = false
    result.errors.push(`Address must be 42 characters (got ${addressString.length})`)
    logSecurityEvent("invalid_address", { reason: "wrong_length" }, "warning")
    return result
  }

  // Validate with viem
  if (!isAddress(addressString)) {
    result.valid = false
    result.errors.push("Invalid address format")
    logSecurityEvent("invalid_address", { reason: "invalid_format" }, "warning")
    return result
  }

  result.address = addressString as `0x${string}`

  // Get checksummed version
  try {
    const checksummed = getAddress(addressString) as `0x${string}`
    result.checksummed = checksummed

    // Check if original was checksummed
    if (addressString !== checksummed && addressString !== addressString.toLowerCase()) {
      if (options.requireChecksum) {
        result.valid = false
        result.errors.push("Address checksum is invalid")
        logSecurityEvent("invalid_address", { reason: "bad_checksum" }, "warning")
        return result
      }
      result.warnings.push("Address checksum is incorrect - using checksummed version")
    }
  } catch {
    result.valid = false
    result.errors.push("Failed to checksum address")
    return result
  }

  // Check blocked addresses
  if (options.blockedAddresses) {
    const normalized = addressString.toLowerCase()
    for (const blocked of options.blockedAddresses) {
      if (normalized === blocked.toLowerCase()) {
        result.valid = false
        result.errors.push("This address is blocked")
        logSecurityEvent("invalid_address", { reason: "blocked" }, "warning")
        return result
      }
    }
  }

  // Check for zero address
  if (addressString === "0x0000000000000000000000000000000000000000") {
    result.warnings.push("Zero address detected - this may be intentional but is unusual")
  }

  return result
}

// ============================================================================
// Token Validation
// ============================================================================

const SUPPORTED_TOKENS = ["USDs", "USDC", "USDT", "DAI", "ETH", "native"] as const
type SupportedToken = (typeof SUPPORTED_TOKENS)[number]

export function validateToken(token: string): {
  valid: boolean
  token?: SupportedToken
  error?: string
} {
  if (!token) {
    return { valid: false, error: "Token is required" }
  }

  if (SUPPORTED_TOKENS.includes(token as SupportedToken)) {
    return { valid: true, token: token as SupportedToken }
  }

  return {
    valid: false,
    error: `Unsupported token "${token}". Supported: ${SUPPORTED_TOKENS.join(", ")}`,
  }
}

// ============================================================================
// Chain Validation
// ============================================================================

const SUPPORTED_CHAINS = [
  "arbitrum",
  "arbitrum-sepolia",
  "base",
  "ethereum",
  "polygon",
  "optimism",
  "bsc",
] as const

type SupportedChain = (typeof SUPPORTED_CHAINS)[number]

const TESTNET_CHAINS: SupportedChain[] = ["arbitrum-sepolia"]
const MAINNET_CHAINS: SupportedChain[] = ["arbitrum", "base", "ethereum", "polygon", "optimism", "bsc"]

export function validateChain(
  chain: string,
  options: { requireTestnet?: boolean; requireMainnet?: boolean } = {}
): {
  valid: boolean
  chain?: SupportedChain
  isTestnet: boolean
  error?: string
} {
  if (!chain) {
    return { valid: false, isTestnet: false, error: "Chain is required" }
  }

  if (!SUPPORTED_CHAINS.includes(chain as SupportedChain)) {
    return {
      valid: false,
      isTestnet: false,
      error: `Unsupported chain "${chain}". Supported: ${SUPPORTED_CHAINS.join(", ")}`,
    }
  }

  const isTestnet = TESTNET_CHAINS.includes(chain as SupportedChain)

  if (options.requireTestnet && !isTestnet) {
    logSecurityEvent("mainnet_access", { chain, required: "testnet" }, "warning")
    return {
      valid: false,
      chain: chain as SupportedChain,
      isTestnet,
      error: "Testnet chain required but mainnet chain provided",
    }
  }

  if (options.requireMainnet && isTestnet) {
    return {
      valid: false,
      chain: chain as SupportedChain,
      isTestnet,
      error: "Mainnet chain required but testnet chain provided",
    }
  }

  return { valid: true, chain: chain as SupportedChain, isTestnet }
}

// ============================================================================
// General Input Sanitization
// ============================================================================

/**
 * Sanitize a string input
 */
export function sanitizeString(
  input: string,
  options: {
    maxLength?: number
    allowedPattern?: RegExp
    stripHtml?: boolean
    trim?: boolean
  } = {}
): { sanitized: string; modified: boolean } {
  const opts = {
    maxLength: 1000,
    stripHtml: true,
    trim: true,
    ...options,
  }

  let sanitized = input
  let modified = false

  // Trim
  if (opts.trim) {
    const trimmed = sanitized.trim()
    if (trimmed !== sanitized) {
      sanitized = trimmed
      modified = true
    }
  }

  // Strip HTML tags
  if (opts.stripHtml) {
    const noHtml = sanitized.replace(/<[^>]*>/g, "")
    if (noHtml !== sanitized) {
      sanitized = noHtml
      modified = true
    }
  }

  // Truncate to max length
  if (sanitized.length > opts.maxLength) {
    sanitized = sanitized.substring(0, opts.maxLength)
    modified = true
  }

  // Apply allowed pattern
  if (opts.allowedPattern) {
    const matches = sanitized.match(opts.allowedPattern)
    if (matches) {
      sanitized = matches.join("")
      modified = true
    }
  }

  return { sanitized, modified }
}

/**
 * Validate a memo/note field
 */
export function validateMemo(memo: string | undefined): {
  valid: boolean
  sanitized?: string
  error?: string
} {
  if (!memo) {
    return { valid: true }
  }

  const { sanitized, modified } = sanitizeString(memo, {
    maxLength: 256,
    stripHtml: true,
  })

  if (modified) {
    return {
      valid: true,
      sanitized,
    }
  }

  return { valid: true, sanitized: memo }
}
