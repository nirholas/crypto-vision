/**
 * Input validation utilities for security hardening
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { z } from "zod"

/**
 * Ethereum address validation schema
 */
export const ethereumAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address format")
  .transform((val) => val.toLowerCase() as `0x${string}`)

/**
 * Transaction hash validation schema
 */
export const transactionHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid transaction hash format")
  .transform((val) => val.toLowerCase() as `0x${string}`)

/**
 * Private key validation schema (hex format)
 * Note: Does NOT validate that it's a valid EC key, just format
 */
export const privateKeySchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Invalid private key format")
  .transform((val) => val as `0x${string}`)

/**
 * ENS name validation schema
 */
export const ensNameSchema = z
  .string()
  .regex(/^[a-zA-Z0-9-]+\.eth$/, "Invalid ENS name format")
  .transform((val) => val.toLowerCase())

/**
 * Positive number validation
 */
export const positiveNumberSchema = z
  .number()
  .positive("Value must be positive")

/**
 * Token amount validation (string to handle large numbers)
 */
export const tokenAmountSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Invalid token amount format")

/**
 * Chain ID validation
 */
export const chainIdSchema = z
  .number()
  .int()
  .positive()
  .max(999999999, "Chain ID too large")

/**
 * URL validation schema
 */
export const urlSchema = z
  .string()
  .url("Invalid URL format")
  .refine(
    (url) => url.startsWith("https://") || url.startsWith("http://localhost"),
    "URL must use HTTPS (except localhost)"
  )

/**
 * Slippage validation (0-100%)
 */
export const slippageSchema = z
  .number()
  .min(0, "Slippage cannot be negative")
  .max(100, "Slippage cannot exceed 100%")
  .default(0.5)

/**
 * Gas limit validation
 */
export const gasLimitSchema = z
  .number()
  .int()
  .min(21000, "Gas limit too low")
  .max(30000000, "Gas limit too high")

/**
 * Sanitize user input to prevent injection
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/[<>]/g, "") // Remove potential HTML tags
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .trim()
}

/**
 * Validate and normalize network name
 */
export function normalizeNetworkName(network: string): string {
  const normalized = network.toLowerCase().trim()
  
  // Map common aliases
  const aliases: Record<string, string> = {
    eth: "ethereum",
    mainnet: "ethereum",
    matic: "polygon",
    arb: "arbitrum",
    op: "optimism",
    binance: "bsc",
    bnb: "bsc"
  }
  
  return aliases[normalized] || normalized
}

/**
 * Validate address is not a known dangerous address
 */
const BLOCKED_ADDRESSES = new Set([
  "0x0000000000000000000000000000000000000000", // Zero address
  "0x000000000000000000000000000000000000dead", // Burn address
])

export function validateNotBlockedAddress(address: string): boolean {
  return !BLOCKED_ADDRESSES.has(address.toLowerCase())
}

/**
 * Rate limiting helper
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  
  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number
  ) {}
  
  isAllowed(key: string): boolean {
    const now = Date.now()
    const timestamps = this.requests.get(key) || []
    
    // Remove old timestamps
    const validTimestamps = timestamps.filter(t => now - t < this.windowMs)
    
    if (validTimestamps.length >= this.maxRequests) {
      return false
    }
    
    validTimestamps.push(now)
    this.requests.set(key, validTimestamps)
    return true
  }
  
  reset(key: string): void {
    this.requests.delete(key)
  }
}
