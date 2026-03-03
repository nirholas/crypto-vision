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
import { FetchError } from "./fetcher.js";

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

// ─── Request Timeout ─────────────────────────────────────────

/**
 * Middleware that aborts requests exceeding a time limit.
 * Sends a 504 Gateway Timeout with structured ApiError body.
 *
 * @param ms — timeout in milliseconds (default: 30 000)
 */
export function requestTimeout(ms = 30_000): MiddlewareHandler {
  return async (c, next) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);

    // Expose the signal so downstream handlers & fetches can honour it
    c.set("abortSignal", controller.signal);

    try {
      // Race: either the handler completes or the timeout fires
      await Promise.race([
        next(),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener(
            "abort",
            () => reject(new AppError("REQUEST_TIMEOUT" as ErrorCode, "Request timed out", 504)),
            { once: true },
          );
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}

// ─── Global Error Handler ────────────────────────────────────

/**
 * Detects whether an error originates from an upstream fetch.
 * Returns the upstream service identifier if so, else undefined.
 */
function detectUpstreamSource(err: Error): string | undefined {
  // Explicit FetchError from our fetcher.ts
  if (err instanceof FetchError) return err.source;

  // AbortError from fetch timeout
  if (err.name === "AbortError") return "upstream (timeout)";

  // TypeError from failed fetch (DNS, network, etc.)
  if (err.name === "TypeError" && err.message.includes("fetch")) return "upstream (network)";

  // Nested cause chain (Node 18+ error.cause)
  if (err.cause instanceof Error) return detectUpstreamSource(err.cause);

  return undefined;
}

/**
 * Global `app.onError` handler.
 * Converts thrown errors into structured ApiErrorResponse objects.
 *
 * Priority:
 *   1. AppError instances → mapped to their code & status
 *   2. FetchError / upstream failures → UPSTREAM_ERROR 502
 *   3. SyntaxError (bad JSON body) → INVALID_JSON 400
 *   4. Everything else → INTERNAL_ERROR 500
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

  // Upstream fetch failure — convert to 502 UPSTREAM_ERROR
  const upstreamSource = detectUpstreamSource(err);
  if (upstreamSource) {
    const status = err instanceof FetchError ? err.status : undefined;
    logger.warn(
      { source: upstreamSource, status, path: c.req.path, err: err.message },
      `Upstream error: ${upstreamSource}`,
    );
    // Never expose upstream provider hostnames to clients
    const safeMessage = status === 429
      ? "Upstream rate limited — please retry later"
      : "An upstream data source is temporarily unavailable";
    return apiError(c, {
      code: "UPSTREAM_ERROR",
      message: safeMessage,
      details: process.env.NODE_ENV !== "production" ? `${upstreamSource}: ${err.message}` : undefined,
      retryAfter: status === 429 ? 30 : 5,
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
