/**
 * Crypto Vision — Middleware
 *
 * Reusable Hono middleware for request logging and error handling.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import type { Context, MiddlewareHandler } from "hono";
import { logger } from "./logger.js";
import { apiError, AppError } from "./api-error.js";
import type { ErrorCode } from "./api-error.js";

// ─── Request Logger ──────────────────────────────────────────

/**
 * Structured request logging middleware.
 * Logs method, path, status, and duration for every request.
 * Uses different log levels based on response status:
 *   2xx/3xx → info, 4xx → warn, 5xx → error
 */
export const requestLogger: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  const { method } = c.req;
  const path = c.req.path;

  await next();

  const status = c.res.status;
  const ms = Date.now() - start;
  const requestId = c.req.header("x-request-id") ?? c.get("requestId") ?? "-";

  const payload = { method, path, status, ms, requestId };
  const line = `${method} ${path} ${status} ${ms}ms`;

  if (status >= 500) {
    logger.error(payload, line);
  } else if (status >= 400) {
    logger.warn(payload, line);
  } else {
    logger.info(payload, line);
  }
};

// ─── Global Error Handler ────────────────────────────────────

/**
 * Global `app.onError` handler.
 * Converts thrown errors into structured ApiErrorResponse objects.
 *
 * - AppError instances → mapped to their code & status
 * - SyntaxError (bad JSON body) → INVALID_JSON 400
 * - Everything else → INTERNAL_ERROR 500
 */
export function globalErrorHandler(err: Error, c: Context) {
  // Thrown AppError — structured domain error
  if (err instanceof AppError) {
    logger.warn(
      { code: err.code, path: c.req.path, err: err.message },
      `AppError: ${err.message}`,
    );
    return apiError(c, {
      code: err.code,
      message: err.message,
      details: err.details,
      retryAfter: err.retryAfter,
    });
  }

  // JSON parse failure (bad request body)
  if (err instanceof SyntaxError && err.message.includes("JSON")) {
    logger.warn({ path: c.req.path, err: err.message }, "Invalid JSON body");
    return apiError(c, {
      code: "INVALID_JSON",
      message: "Request body contains invalid JSON",
    });
  }

  // Unknown / unexpected errors
  logger.error(
    { err, path: c.req.path, stack: err.stack },
    `Unhandled error: ${err.message}`,
  );
  return apiError(c, {
    code: "INTERNAL_ERROR",
    message:
      process.env.NODE_ENV === "production"
        ? "An unexpected error occurred"
        : err.message,
    details: process.env.NODE_ENV !== "production" ? err.stack : undefined,
  });
}
