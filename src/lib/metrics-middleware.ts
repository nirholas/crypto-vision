/**
 * Crypto Vision — Metrics Middleware
 *
 * Hono middleware that automatically instruments every HTTP request
 * with Prometheus metrics: request count, duration histogram.
 *
 * Placed early in the middleware chain so it captures the full
 * request lifecycle including downstream middleware latency.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import type { MiddlewareHandler } from "hono";
import {
  httpRequestsTotal,
  httpRequestDurationSeconds,
  normalizePath,
} from "./metrics.js";

/**
 * Metrics middleware — instruments every request with:
 *  - http_requests_total{method, path, status}
 *  - http_request_duration_seconds{method, path}
 *
 * Path labels are normalized to prevent high-cardinality explosion
 * (e.g. /api/coin/bitcoin → /api/coin/:id).
 */
export const metricsMiddleware: MiddlewareHandler = async (c, next) => {
  const method = c.req.method;
  const path = normalizePath(c.req.path);
  const end = httpRequestDurationSeconds.startTimer({ method, path });

  await next();

  const status = String(c.res.status);
  end();
  httpRequestsTotal.inc({ method, path, status });
};
