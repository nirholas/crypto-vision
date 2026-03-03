/**
 * Custom error classes for better error handling
 * @author nich
 * @github github.com/nirholas
 * @license Apache-2.0
 */

/**
 * Base error class for MCP errors
 */
export class McpError extends Error {
  public readonly code: string
  public readonly context?: Record<string, unknown>

  constructor(
    message: string,
    code: string,
    context?: Record<string, unknown>
  ) {
    super(message)
    this.name = "McpError"
    this.code = code
    this.context = context
    Error.captureStackTrace?.(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context
    }
  }
}

/**
 * Network-related errors
 */
export class NetworkError extends McpError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "NETWORK_ERROR", context)
    this.name = "NetworkError"
  }
}

/**
 * Validation errors
 */
export class ValidationError extends McpError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", context)
    this.name = "ValidationError"
  }
}

/**
 * Authentication/authorization errors
 */
export class AuthError extends McpError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "AUTH_ERROR", context)
    this.name = "AuthError"
  }
}

/**
 * Rate limiting errors
 */
export class RateLimitError extends McpError {
  public readonly retryAfter?: number

  constructor(
    message: string,
    retryAfter?: number,
    context?: Record<string, unknown>
  ) {
    super(message, "RATE_LIMIT_ERROR", context)
    this.name = "RateLimitError"
    this.retryAfter = retryAfter
  }
}

/**
 * Contract interaction errors
 */
export class ContractError extends McpError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, "CONTRACT_ERROR", context)
    this.name = "ContractError"
  }
}

/**
 * Transaction errors
 */
export class TransactionError extends McpError {
  public readonly txHash?: string

  constructor(
    message: string,
    txHash?: string,
    context?: Record<string, unknown>
  ) {
    super(message, "TRANSACTION_ERROR", context)
    this.name = "TransactionError"
    this.txHash = txHash
  }
}

/**
 * Insufficient funds errors
 */
export class InsufficientFundsError extends McpError {
  public readonly required: string
  public readonly available: string

  constructor(
    required: string,
    available: string,
    context?: Record<string, unknown>
  ) {
    super(
      `Insufficient funds: required ${required}, available ${available}`,
      "INSUFFICIENT_FUNDS",
      context
    )
    this.name = "InsufficientFundsError"
    this.required = required
    this.available = available
  }
}

/**
 * Chain not supported errors
 */
export class ChainNotSupportedError extends McpError {
  public readonly chainId: number

  constructor(chainId: number, context?: Record<string, unknown>) {
    super(`Chain ${chainId} is not supported`, "CHAIN_NOT_SUPPORTED", context)
    this.name = "ChainNotSupportedError"
    this.chainId = chainId
  }
}

/**
 * Helper to extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === "string") {
    return error
  }
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message)
  }
  return "An unknown error occurred"
}

/**
 * Helper to wrap unknown errors in McpError
 */
export function wrapError(
  error: unknown,
  defaultMessage: string
): McpError {
  if (error instanceof McpError) {
    return error
  }
  
  const message = getErrorMessage(error)
  return new McpError(
    message || defaultMessage,
    "UNKNOWN_ERROR",
    { originalError: error }
  )
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number
  baseDelayMs: number
  maxDelayMs: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  shouldRetry: (error) => {
    // Retry on network errors and rate limits
    if (error instanceof NetworkError) return true
    if (error instanceof RateLimitError) return true
    return false
  }
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const { maxRetries, baseDelayMs, maxDelayMs, shouldRetry } = {
    ...DEFAULT_RETRY_CONFIG,
    ...config
  }

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxRetries) {
        break
      }

      if (shouldRetry && !shouldRetry(error, attempt)) {
        break
      }

      // Exponential backoff with jitter
      const delay = Math.min(
        baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      )

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError
}
