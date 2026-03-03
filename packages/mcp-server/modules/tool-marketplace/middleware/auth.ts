/**
 * Marketplace Authentication Middleware
 * @description Express/Fastify middleware for API key validation and access control
 * @author nirholas
 * @license Apache-2.0
 */

import type { Address } from "viem"
import { keyManager, KeyManager } from "../access/key-manager.js"
import { rateLimiter, RateLimiter, GLOBAL_RATE_LIMITS } from "../access/rate-limiter.js"
import { quotaManager, QuotaManager, DEFAULT_QUOTA_CONFIG } from "../access/quotas.js"
import { accessListManager, AccessListManager } from "../access/lists.js"
import type {
  APIKey,
  RateLimitStatus,
  RateLimitHeaders,
  QuotaStatus,
  KeyValidationResult,
} from "../access/types.js"
import Logger from "@/utils/logger.js"

// ============================================================================
// Types
// ============================================================================

/**
 * Marketplace auth options
 */
export interface MarketplaceAuthOptions {
  /** Validate API key */
  validateKey?: boolean
  /** Check rate limits */
  checkRateLimit?: boolean
  /** Check quotas */
  checkQuota?: boolean
  /** Require payment (x402 integration) */
  requirePayment?: boolean
  /** Check allowlist/blocklist */
  checkAccessLists?: boolean
  /** Custom key manager instance */
  keyManager?: KeyManager
  /** Custom rate limiter instance */
  rateLimiter?: RateLimiter
  /** Custom quota manager instance */
  quotaManager?: QuotaManager
  /** Custom access list manager instance */
  accessListManager?: AccessListManager
  /** Header name for API key (default: X-API-Key) */
  apiKeyHeader?: string
  /** Allow key in query parameter */
  allowQueryParam?: boolean
  /** Query parameter name (default: api_key) */
  queryParamName?: string
  /** Tool ID to check against (required if validateKey is true) */
  toolId?: string
  /** Skip validation for certain paths */
  skipPaths?: string[]
  /** Custom error handler */
  onError?: (error: AuthError, req: any, res: any) => void
  /** Callback after successful authentication */
  onSuccess?: (result: AuthResult, req: any, res: any) => void
}

/**
 * Authentication result
 */
export interface AuthResult {
  /** Whether authentication was successful */
  success: boolean
  /** Validated API key */
  key?: APIKey
  /** Rate limit status */
  rateLimitStatus?: RateLimitStatus
  /** Quota status */
  quotaStatus?: QuotaStatus
  /** User address from key */
  userId?: Address
  /** Tool ID */
  toolId?: string
}

/**
 * Authentication error
 */
export interface AuthError {
  /** Error code */
  code: "MISSING_KEY" | "INVALID_KEY" | "EXPIRED_KEY" | "REVOKED_KEY" | "RATE_LIMITED" | "QUOTA_EXCEEDED" | "BLOCKED" | "PAYMENT_REQUIRED"
  /** Error message */
  message: string
  /** HTTP status code */
  statusCode: number
  /** Rate limit headers (if applicable) */
  headers?: RateLimitHeaders
  /** Retry after (seconds) */
  retryAfter?: number
}

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Express request extension
 */
export interface MarketplaceRequest {
  marketplaceAuth?: AuthResult
  apiKey?: APIKey
  userId?: Address
}

/**
 * Create Express middleware for marketplace authentication
 */
export function createExpressMiddleware(options: MarketplaceAuthOptions = {}) {
  const {
    validateKey = true,
    checkRateLimit = true,
    checkQuota = true,
    requirePayment = false,
    checkAccessLists = true,
    apiKeyHeader = "X-API-Key",
    allowQueryParam = true,
    queryParamName = "api_key",
    skipPaths = [],
    onError,
    onSuccess,
  } = options

  const km = options.keyManager || keyManager
  const rl = options.rateLimiter || rateLimiter
  const qm = options.quotaManager || quotaManager
  const alm = options.accessListManager || accessListManager

  return async (req: any, res: any, next: any) => {
    // Skip validation for certain paths
    if (skipPaths.some((path) => req.path.startsWith(path))) {
      return next()
    }

    const result: AuthResult = { success: false }

    try {
      // Extract API key
      let apiKeyValue = req.headers[apiKeyHeader.toLowerCase()] as string
      if (!apiKeyValue && allowQueryParam) {
        apiKeyValue = req.query?.[queryParamName] as string
      }

      if (validateKey) {
        if (!apiKeyValue) {
          const error: AuthError = {
            code: "MISSING_KEY",
            message: "API key is required",
            statusCode: 401,
          }
          return handleError(error, req, res, onError)
        }

        // Validate key
        const validation = await km.validateKey(apiKeyValue)
        if (!validation.valid) {
          const errorCode = validation.errorCode || "INVALID_KEY"
          const error: AuthError = {
            code: errorCode as AuthError["code"],
            message: validation.error || "Invalid API key",
            statusCode: errorCode === "RATE_LIMITED" ? 429 : 401,
          }
          return handleError(error, req, res, onError)
        }

        result.key = validation.key
        result.userId = validation.key?.userId
        result.toolId = validation.key?.toolId

        // Check access lists
        if (checkAccessLists && result.key) {
          const ip = req.ip || req.connection?.remoteAddress
          const accessCheck = await alm.checkAccess(result.key.toolId, {
            address: result.key.userId,
            ip,
          })

          if (!accessCheck.allowed) {
            const error: AuthError = {
              code: "BLOCKED",
              message: accessCheck.reason || "Access denied",
              statusCode: 403,
            }
            return handleError(error, req, res, onError)
          }
        }

        // Check rate limits
        if (checkRateLimit && result.key) {
          const multiLimitResult = await rl.checkMultipleLimits(
            {
              keyId: result.key.id,
              userId: result.key.userId,
              toolId: result.key.toolId,
            },
            result.key.rateLimit,
            GLOBAL_RATE_LIMITS.user,
            GLOBAL_RATE_LIMITS.tool
          )

          if (!multiLimitResult.allowed) {
            const status = multiLimitResult.status.key || multiLimitResult.status.user || multiLimitResult.status.tool
            const headers = status ? rl.generateHeaders(status) : undefined
            const error: AuthError = {
              code: "RATE_LIMITED",
              message: `Rate limit exceeded (${multiLimitResult.limitedBy} limit)`,
              statusCode: 429,
              headers,
              retryAfter: status?.resetIn,
            }
            return handleError(error, req, res, onError)
          }

          result.rateLimitStatus = multiLimitResult.status.key

          // Add rate limit headers
          if (result.rateLimitStatus) {
            const headers = rl.generateHeaders(result.rateLimitStatus)
            for (const [key, value] of Object.entries(headers)) {
              res.setHeader(key, value)
            }
          }
        }

        // Check quotas
        if (checkQuota && result.key) {
          const quotaConfig = DEFAULT_QUOTA_CONFIG[result.key.tier]
          const quotaResult = await qm.checkAndConsumeQuota(
            result.key.id,
            result.key.toolId,
            quotaConfig
          )

          if (!quotaResult.allowed) {
            const error: AuthError = {
              code: "QUOTA_EXCEEDED",
              message: quotaResult.reason || "Monthly quota exceeded",
              statusCode: 429,
            }
            return handleError(error, req, res, onError)
          }

          result.quotaStatus = quotaResult.status

          // Add quota headers
          res.setHeader("X-Quota-Limit", quotaResult.status.limit.toString())
          res.setHeader("X-Quota-Remaining", quotaResult.status.remaining.toString())
          res.setHeader("X-Quota-Reset", quotaResult.status.resetsAt.toString())
        }
      }

      // Success
      result.success = true

      // Attach to request
      ;(req as MarketplaceRequest).marketplaceAuth = result
      ;(req as MarketplaceRequest).apiKey = result.key
      ;(req as MarketplaceRequest).userId = result.userId

      if (onSuccess) {
        onSuccess(result, req, res)
      }

      next()
    } catch (error) {
      Logger.error("Marketplace auth middleware error:", error)
      const authError: AuthError = {
        code: "INVALID_KEY",
        message: error instanceof Error ? error.message : "Authentication failed",
        statusCode: 500,
      }
      return handleError(authError, req, res, onError)
    }
  }
}

/**
 * Handle authentication error
 */
function handleError(
  error: AuthError,
  req: any,
  res: any,
  customHandler?: (error: AuthError, req: any, res: any) => void
): void {
  if (customHandler) {
    return customHandler(error, req, res)
  }

  // Set headers if available
  if (error.headers) {
    for (const [key, value] of Object.entries(error.headers)) {
      res.setHeader(key, value)
    }
  }

  res.status(error.statusCode).json({
    error: {
      code: error.code,
      message: error.message,
      retryAfter: error.retryAfter,
    },
  })
}

// ============================================================================
// Fastify Plugin
// ============================================================================

/**
 * Fastify plugin for marketplace authentication
 */
export async function fastifyMarketplaceAuth(
  fastify: any,
  options: MarketplaceAuthOptions = {}
) {
  const middleware = createExpressMiddleware(options)

  // Register as preHandler hook
  fastify.addHook("preHandler", async (request: any, reply: any) => {
    return new Promise<void>((resolve, reject) => {
      // Adapt Express middleware to Fastify
      const res = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        setHeader(key: string, value: string) {
          this.headers[key] = value
          reply.header(key, value)
        },
        status(code: number) {
          this.statusCode = code
          return this
        },
        json(data: any) {
          reply.code(this.statusCode).send(data)
          reject(new Error("AUTH_FAILED"))
        },
      }

      const req = {
        ...request,
        headers: request.headers,
        query: request.query,
        path: request.url,
        ip: request.ip,
        connection: request.connection,
      }

      middleware(req, res, () => {
        // Copy auth result to Fastify request
        request.marketplaceAuth = (req as any).marketplaceAuth
        request.apiKey = (req as any).apiKey
        request.userId = (req as any).userId
        resolve()
      })
    }).catch((err) => {
      if (err.message !== "AUTH_FAILED") {
        throw err
      }
    })
  })

  // Decorate request
  fastify.decorateRequest("marketplaceAuth", null)
  fastify.decorateRequest("apiKey", null)
  fastify.decorateRequest("userId", null)
}

// ============================================================================
// Generic Middleware Factory
// ============================================================================

/**
 * Generic middleware result for framework-agnostic usage
 */
export interface MiddlewareResult {
  success: boolean
  error?: AuthError
  result?: AuthResult
  headers: Record<string, string>
}

/**
 * Framework-agnostic authentication function
 */
export async function authenticateRequest(
  apiKey: string | undefined,
  options: {
    toolId?: string
    ip?: string
    checkRateLimit?: boolean
    checkQuota?: boolean
    checkAccessLists?: boolean
  } = {}
): Promise<MiddlewareResult> {
  const headers: Record<string, string> = {}

  // Validate key
  if (!apiKey) {
    return {
      success: false,
      error: {
        code: "MISSING_KEY",
        message: "API key is required",
        statusCode: 401,
      },
      headers,
    }
  }

  const validation = await keyManager.validateKey(apiKey)
  if (!validation.valid) {
    return {
      success: false,
      error: {
        code: (validation.errorCode as AuthError["code"]) || "INVALID_KEY",
        message: validation.error || "Invalid API key",
        statusCode: 401,
      },
      headers,
    }
  }

  const key = validation.key!
  const result: AuthResult = {
    success: true,
    key,
    userId: key.userId,
    toolId: key.toolId,
  }

  // Check access lists
  if (options.checkAccessLists !== false) {
    const accessCheck = await accessListManager.checkAccess(key.toolId, {
      address: key.userId,
      ip: options.ip,
    })

    if (!accessCheck.allowed) {
      return {
        success: false,
        error: {
          code: "BLOCKED",
          message: accessCheck.reason || "Access denied",
          statusCode: 403,
        },
        headers,
      }
    }
  }

  // Check rate limits
  if (options.checkRateLimit !== false) {
    const rateLimitResult = await rateLimiter.checkAndConsume(
      key.rateLimit,
      "key",
      key.id
    )

    result.rateLimitStatus = rateLimitResult

    const rateLimitHeaders = rateLimiter.generateHeaders(rateLimitResult)
    Object.assign(headers, rateLimitHeaders)

    if (rateLimitResult.limited) {
      return {
        success: false,
        error: {
          code: "RATE_LIMITED",
          message: "Rate limit exceeded",
          statusCode: 429,
          headers: rateLimitHeaders,
          retryAfter: rateLimitResult.resetIn,
        },
        headers,
      }
    }
  }

  // Check quotas
  if (options.checkQuota !== false) {
    const quotaConfig = DEFAULT_QUOTA_CONFIG[key.tier]
    const quotaResult = await quotaManager.checkAndConsumeQuota(
      key.id,
      key.toolId,
      quotaConfig
    )

    result.quotaStatus = quotaResult.status

    headers["X-Quota-Limit"] = quotaResult.status.limit.toString()
    headers["X-Quota-Remaining"] = quotaResult.status.remaining.toString()
    headers["X-Quota-Reset"] = quotaResult.status.resetsAt.toString()

    if (!quotaResult.allowed) {
      return {
        success: false,
        error: {
          code: "QUOTA_EXCEEDED",
          message: quotaResult.reason || "Monthly quota exceeded",
          statusCode: 429,
        },
        headers,
      }
    }
  }

  return {
    success: true,
    result,
    headers,
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Extract API key from various sources
 */
export function extractApiKey(
  headers: Record<string, string | string[] | undefined>,
  query?: Record<string, string | string[] | undefined>,
  options: {
    headerName?: string
    queryParamName?: string
  } = {}
): string | undefined {
  const headerName = (options.headerName || "x-api-key").toLowerCase()
  const queryParamName = options.queryParamName || "api_key"

  // Check header
  const headerValue = headers[headerName]
  if (headerValue) {
    return Array.isArray(headerValue) ? headerValue[0] : headerValue
  }

  // Check query parameter
  if (query) {
    const queryValue = query[queryParamName]
    if (queryValue) {
      return Array.isArray(queryValue) ? queryValue[0] : queryValue
    }
  }

  return undefined
}

/**
 * Create a simple API key validator function
 */
export function createKeyValidator(): (key: string) => Promise<KeyValidationResult> {
  return (key: string) => keyManager.validateKey(key)
}
