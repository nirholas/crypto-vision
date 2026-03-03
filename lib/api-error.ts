/**
 * API Error System — Ported from free-crypto-news (src/lib/api-error.ts)
 * Adapted from NextResponse to Hono c.json() pattern
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 * @see https://github.com/nirholas/free-crypto-news
 */

import type { Context } from "hono";

// ─── Error Codes ─────────────────────────────────────────────

export const ERROR_CODES = {
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_JSON: "INVALID_JSON",
  MISSING_PARAMETER: "MISSING_PARAMETER",
  INVALID_PARAMETER: "INVALID_PARAMETER",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  METHOD_NOT_ALLOWED: "METHOD_NOT_ALLOWED",
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",
  REQUEST_TOO_LARGE: "REQUEST_TOO_LARGE",
  PAYMENT_REQUIRED: "PAYMENT_REQUIRED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
  UPSTREAM_ERROR: "UPSTREAM_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  TIMEOUT: "TIMEOUT",
  NOT_IMPLEMENTED: "NOT_IMPLEMENTED",
  INSUFFICIENT_CREDITS: "INSUFFICIENT_CREDITS",
  INVALID_API_KEY: "INVALID_API_KEY",
  EXPIRED_API_KEY: "EXPIRED_API_KEY",
  INVALID_PAYMENT: "INVALID_PAYMENT",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  AI_SERVICE_ERROR: "AI_SERVICE_ERROR",
  CACHE_ERROR: "CACHE_ERROR",
  STORAGE_ERROR: "STORAGE_ERROR",
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// ─── Error Status Map ────────────────────────────────────────

const ERROR_STATUS_MAP: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  INVALID_JSON: 400,
  MISSING_PARAMETER: 400,
  INVALID_PARAMETER: 400,
  VALIDATION_FAILED: 400,
  DUPLICATE_ENTRY: 400,
  UNAUTHORIZED: 401,
  INVALID_API_KEY: 401,
  EXPIRED_API_KEY: 401,
  PAYMENT_REQUIRED: 402,
  INVALID_PAYMENT: 402,
  INSUFFICIENT_CREDITS: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  REQUEST_TOO_LARGE: 413,
  RATE_LIMIT_EXCEEDED: 429,
  INTERNAL_ERROR: 500,
  UPSTREAM_ERROR: 502,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
  DATABASE_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  AI_SERVICE_ERROR: 500,
  CACHE_ERROR: 500,
  STORAGE_ERROR: 500,
};

// ─── Types ───────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  received?: unknown;
  expected?: string;
}

export interface ApiErrorResponse {
  error: string;
  code: ErrorCode;
  message?: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
  retryAfter?: number;
  validationErrors?: ValidationError[];
  suggestion?: string;
  docsUrl?: string;
}

export interface ApiErrorOptions {
  code: ErrorCode;
  message: string;
  details?: unknown;
  retryAfter?: number;
  validationErrors?: ValidationError[];
  suggestion?: string;
  docsUrl?: string;
}

// ─── Error Builder ───────────────────────────────────────────

function buildErrorResponse(options: ApiErrorOptions): {
  body: ApiErrorResponse;
  status: number;
} {
  const {
    code,
    message,
    details,
    retryAfter,
    validationErrors,
    suggestion,
    docsUrl,
  } = options;

  const body: ApiErrorResponse = {
    error: message,
    code,
    timestamp: new Date().toISOString(),
    ...(retryAfter && { retryAfter }),
    ...(validationErrors?.length && { validationErrors }),
    ...(suggestion && { suggestion }),
    ...(docsUrl && { docsUrl }),
  };

  if (process.env.NODE_ENV === "development" && details) {
    body.details = details;
  }

  return { body, status: ERROR_STATUS_MAP[code] || 500 };
}

/**
 * Return a Hono error response.
 * Usage: `return apiError(c, { code: "NOT_FOUND", message: "…" })`
 */
export function apiError(c: Context, options: ApiErrorOptions) {
  const { body, status } = buildErrorResponse(options);

  if (options.retryAfter) {
    c.header("Retry-After", String(options.retryAfter));
  }

  return c.json(body, status as any);
}

// ─── Convenience Factories ───────────────────────────────────

export const ApiError = {
  badRequest: (c: Context, message: string, details?: unknown) =>
    apiError(c, { code: "INVALID_REQUEST", message, details }),

  validation: (c: Context, message: string, errors: ValidationError[]) =>
    apiError(c, {
      code: "VALIDATION_FAILED",
      message,
      validationErrors: errors,
      suggestion: "Check the validationErrors array for specific field issues",
    }),

  missingParam: (c: Context, param: string) =>
    apiError(c, {
      code: "MISSING_PARAMETER",
      message: `Missing required parameter: ${param}`,
    }),

  unauthorized: (c: Context, message = "Authentication required") =>
    apiError(c, {
      code: "UNAUTHORIZED",
      message,
      suggestion: "Provide a valid API key",
      docsUrl: "/api/docs",
    }),

  forbidden: (c: Context, message = "Access forbidden") =>
    apiError(c, { code: "FORBIDDEN", message }),

  notFound: (c: Context, message = "Resource not found") =>
    apiError(c, { code: "NOT_FOUND", message }),

  rateLimit: (c: Context, retryAfter = 60) =>
    apiError(c, {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter,
    }),

  paymentRequired: (c: Context, message = "Payment required for this endpoint") =>
    apiError(c, { code: "PAYMENT_REQUIRED", message }),

  internal: (c: Context, message = "Internal server error", details?: unknown) =>
    apiError(c, { code: "INTERNAL_ERROR", message, details }),

  serviceUnavailable: (c: Context, message = "Service temporarily unavailable") =>
    apiError(c, { code: "SERVICE_UNAVAILABLE", message, retryAfter: 60 }),

  upstream: (c: Context, service: string, details?: unknown) =>
    apiError(c, {
      code: "UPSTREAM_ERROR",
      message: `Upstream service error: ${service}`,
      details,
    }),

  timeout: (c: Context, message = "Request timeout") =>
    apiError(c, { code: "TIMEOUT", message, retryAfter: 5 }),

  aiError: (c: Context, message: string, details?: unknown) =>
    apiError(c, { code: "AI_SERVICE_ERROR", message, details }),
};
