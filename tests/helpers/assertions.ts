/**
 * Custom Assertions — Vitest matchers for API response validation.
 *
 * Usage:
 *   import { assertValidJsonResponse, assertNoCrash, assertNeverReflects } from "./assertions.js";
 *
 *   assertValidJsonResponse(res, 200);
 *   assertNoCrash(status);
 *   assertNeverReflects(body, "<script>");
 */

import { expect } from "vitest";

/**
 * Assert the response has a valid JSON content-type and the expected status.
 * Returns the parsed JSON body.
 */
export async function assertValidJsonResponse(
  res: Response,
  expectedStatus?: number | number[],
): Promise<unknown> {
  if (expectedStatus !== undefined) {
    if (Array.isArray(expectedStatus)) {
      expect(expectedStatus).toContain(res.status);
    } else {
      expect(res.status).toBe(expectedStatus);
    }
  }

  const ct = res.headers.get("content-type") ?? "";
  expect(ct).toContain("application/json");

  return res.json();
}

/**
 * Assert the server did NOT crash (status !== 500).
 * 502/503/504 are acceptable upstream failures.
 */
export function assertNoCrash(status: number): void {
  expect(status).not.toBe(500);
}

/**
 * Assert that the response body does not contain raw dangerous payloads.
 * Used after fuzz testing to verify XSS payloads are not reflected.
 */
export function assertNeverReflects(body: string, ...payloads: string[]): void {
  for (const payload of payloads) {
    expect(body).not.toContain(payload);
  }
}

/**
 * Assert the response includes standard security headers.
 */
export function assertSecurityHeaders(res: Response): void {
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  expect(res.headers.get("x-request-id")).toBeTruthy();
}

/**
 * Assert the response includes CORS headers.
 */
export function assertCorsHeaders(res: Response): void {
  const origin = res.headers.get("access-control-allow-origin");
  expect(origin).toBeTruthy();
}

/**
 * Assert rate-limit headers are present and well-formed.
 */
export function assertRateLimitHeaders(res: Response): void {
  const limit = res.headers.get("x-ratelimit-limit");
  const remaining = res.headers.get("x-ratelimit-remaining");
  const reset = res.headers.get("x-ratelimit-reset");

  if (limit) {
    expect(Number(limit)).toBeGreaterThan(0);
  }
  if (remaining) {
    expect(Number(remaining)).toBeGreaterThanOrEqual(0);
  }
  if (reset) {
    expect(Number(reset)).toBeGreaterThan(0);
  }
}

/**
 * Assert rate-limited response (429) includes Retry-After header.
 */
export function assertRateLimited(res: Response): void {
  expect(res.status).toBe(429);
  const retryAfter = res.headers.get("retry-after");
  expect(retryAfter).toBeTruthy();
  expect(Number(retryAfter)).toBeGreaterThan(0);
}

/**
 * Assert the response has cache-control or etag headers.
 */
export function assertCacheHeaders(res: Response): void {
  const etag = res.headers.get("etag");
  const cacheControl = res.headers.get("cache-control");
  // At least one should be present
  expect(etag ?? cacheControl).toBeTruthy();
}

/**
 * Assert a response body contains expected properties.
 */
export function assertHasProperties(
  body: Record<string, unknown>,
  ...keys: string[]
): void {
  for (const key of keys) {
    expect(body).toHaveProperty(key);
  }
}

/** Timing result from measureLatency. */
export interface LatencyResult {
  durationMs: number;
  status: number;
}

/**
 * Measure request latency in milliseconds.
 */
export async function measureLatency(
  url: string,
  init?: RequestInit,
): Promise<LatencyResult> {
  const start = performance.now();
  const res = await fetch(url, init);
  const durationMs = performance.now() - start;
  // Consume body to avoid socket hang
  await res.text();
  return { durationMs, status: res.status };
}
