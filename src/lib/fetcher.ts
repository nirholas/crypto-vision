/**
 * Crypto Vision — HTTP Fetcher
 *
 * Hardened fetch wrapper with:
 *  - Circuit breaker per upstream host (prevents cascading failures)
 *  - Automatic retries with exponential backoff + jitter
 *  - Timeout enforcement
 *  - Rate-limit aware (respects 429 Retry-After)
 *  - Per-host concurrency limiting
 *  - Source obfuscation (upstream provider names never leak)
 */

import { logger } from "./logger.js";
import {
  upstreamRequestsTotal,
  upstreamRequestDurationSeconds,
  circuitBreakerState as circuitBreakerGauge,
} from "./metrics.js";

// ─── Fetch Metrics ───────────────────────────────────────────

interface HostMetrics {
  totalRequests: number;
  totalFailures: number;
  total429s: number;
  totalLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
}

const hostMetrics = new Map<string, HostMetrics>();

function getHostMetrics(host: string): HostMetrics {
  let m = hostMetrics.get(host);
  if (!m) {
    m = { totalRequests: 0, totalFailures: 0, total429s: 0, totalLatencyMs: 0, minLatencyMs: Infinity, maxLatencyMs: 0 };
    hostMetrics.set(host, m);
  }
  return m;
}

function recordLatency(host: string, ms: number) {
  const m = getHostMetrics(host);
  m.totalLatencyMs += ms;
  if (ms < m.minLatencyMs) m.minLatencyMs = ms;
  if (ms > m.maxLatencyMs) m.maxLatencyMs = ms;
}

// ─── Circuit Breaker ─────────────────────────────────────────

type CBState = "closed" | "open" | "half-open";

interface CircuitBreaker {
  state: CBState;
  failures: number;
  lastFailure: number;
  successesSinceHalfOpen: number;
}

const CB_THRESHOLD = Number(process.env.CB_FAILURE_THRESHOLD || 5);
const CB_RESET_MS = Number(process.env.CB_RESET_MS || 30_000);
const CB_HALF_OPEN_SUCCESSES = 2;

const breakers = new Map<string, CircuitBreaker>();

function getBreaker(host: string): CircuitBreaker {
  let cb = breakers.get(host);
  if (!cb) {
    cb = { state: "closed", failures: 0, lastFailure: 0, successesSinceHalfOpen: 0 };
    breakers.set(host, cb);
  }
  if (cb.state === "open" && Date.now() - cb.lastFailure > CB_RESET_MS) {
    cb.state = "half-open";
    cb.successesSinceHalfOpen = 0;
    circuitBreakerGauge.set({ host }, 0.5);
    logger.info({ host }, "Circuit breaker → half-open");
  }
  return cb;
}

function recordSuccess(host: string) {
  const cb = getBreaker(host);
  if (cb.state === "half-open") {
    cb.successesSinceHalfOpen++;
    if (cb.successesSinceHalfOpen >= CB_HALF_OPEN_SUCCESSES) {
      cb.state = "closed";
      cb.failures = 0;
      circuitBreakerGauge.set({ host }, 0);
      logger.info({ host }, "Circuit breaker → closed");
    }
  } else {
    cb.failures = Math.max(0, cb.failures - 1);
  }
}

function recordFailure(host: string) {
  const cb = getBreaker(host);
  cb.failures++;
  cb.lastFailure = Date.now();
  if (cb.failures >= CB_THRESHOLD) {
    cb.state = "open";
    circuitBreakerGauge.set({ host }, 1);
    logger.warn({ host, failures: cb.failures }, "Circuit breaker → OPEN");
  }
}

// ─── Per-Host Concurrency Limiter ────────────────────────────

const MAX_CONCURRENT = Number(process.env.FETCH_CONCURRENCY_PER_HOST || 10);
const hostInflight = new Map<string, number>();
const hostQueue = new Map<string, Array<() => void>>();

async function acquireSlot(host: string): Promise<void> {
  const current = hostInflight.get(host) || 0;
  if (current < MAX_CONCURRENT) {
    hostInflight.set(host, current + 1);
    return;
  }
  return new Promise<void>((resolve) => {
    let queue = hostQueue.get(host);
    if (!queue) { queue = []; hostQueue.set(host, queue); }
    queue.push(resolve);
  });
}

function releaseSlot(host: string) {
  const queue = hostQueue.get(host);
  if (queue && queue.length > 0) {
    queue.shift()!();
  } else {
    const current = hostInflight.get(host) || 1;
    hostInflight.set(host, Math.max(0, current - 1));
  }
}

// ─── Types ───────────────────────────────────────────────────

export interface FetchOptions {
  /** Timeout in ms (default: 10 000) */
  timeout?: number;
  /** Max retries (default: 2) */
  retries?: number;
  /** Custom headers */
  headers?: Record<string, string>;
  /** HTTP method */
  method?: "GET" | "POST";
  /** JSON body for POST */
  body?: unknown;
  /** Skip circuit breaker (e.g. health probes) */
  skipCircuitBreaker?: boolean;
}

export class FetchError extends Error {
  constructor(
    message: string,
    public status: number,
    public source: string,
  ) {
    super(message);
    this.name = "FetchError";
  }
}

// ─── Core Fetch ──────────────────────────────────────────────

/**
 * Fetch JSON from an upstream API with circuit breaker, retries,
 * concurrency limiting, and timeout enforcement.
 */
export async function fetchJSON<T>(
  url: string,
  opts: FetchOptions = {},
): Promise<T> {
  const { timeout = 10_000, retries = 2, headers = {}, method = "GET", body, skipCircuitBreaker } = opts;
  const host = new URL(url).hostname;

  // Circuit breaker check
  if (!skipCircuitBreaker) {
    const cb = getBreaker(host);
    if (cb.state === "open") {
      getHostMetrics(host).totalFailures++;
      throw new FetchError(`Circuit open for ${host}`, 503, host);
    }
  }

  let lastError: Error | null = null;
  const m = getHostMetrics(host);
  m.totalRequests++;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await acquireSlot(host);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const fetchStart = Date.now();

    try {
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "CryptoVision/1.0",
          ...headers,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      clearTimeout(timer);
      releaseSlot(host);
      recordLatency(host, Date.now() - fetchStart);

      if (res.status === 429) {
        m.total429s++;
        upstreamRequestsTotal.inc({ source: host, status: "429" });
        upstreamRequestDurationSeconds.observe({ source: host }, (Date.now() - fetchStart) / 1000);
        
        // Notify CoinGecko rate limiter of rate limit events
        if (host === "api.coingecko.com" || host === "pro-api.coingecko.com") {
          try {
            const { updateRateLimitInfo } = await import("./coingecko-rate-limit.js");
            updateRateLimitInfo(res.headers);
          } catch {
            // Silently ignore if rate limiter module isn't available
          }
        }
        
        const retryAfter = Number(res.headers.get("Retry-After") || "5");
        logger.warn({ host, retryAfter }, "Rate limited — backing off");;
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!res.ok) {
        m.totalFailures++;
        upstreamRequestsTotal.inc({ source: host, status: String(res.status) });
        upstreamRequestDurationSeconds.observe({ source: host }, (Date.now() - fetchStart) / 1000);
        recordFailure(host);
        throw new FetchError(`HTTP ${res.status}`, res.status, host);
      }

      upstreamRequestsTotal.inc({ source: host, status: String(res.status) });
      upstreamRequestDurationSeconds.observe({ source: host }, (Date.now() - fetchStart) / 1000);
      
      // Notify CoinGecko rate limiter of successful requests
      if (host === "api.coingecko.com" || host === "pro-api.coingecko.com") {
        try {
          const { updateRateLimitInfo, recordCoinGeckoSuccess } = await import("./coingecko-rate-limit.js");
          updateRateLimitInfo(res.headers);
          recordCoinGeckoSuccess();
        } catch {
          // Silently ignore if rate limiter module isn't available
        }
      }
      
      recordSuccess(host);
      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      releaseSlot(host);
      recordLatency(host, Date.now() - fetchStart);
      lastError = err as Error;
      if ((err as FetchError).status === 503 && (err as FetchError).name === "FetchError") {
        upstreamRequestsTotal.inc({ source: host, status: "503" });
        throw err;
      }
      upstreamRequestsTotal.inc({ source: host, status: "error" });
      upstreamRequestDurationSeconds.observe({ source: host }, (Date.now() - fetchStart) / 1000);
      recordFailure(host);

      if (attempt < retries) {
        const base = Math.min(1000 * 2 ** attempt, 8000);
        const jitter = Math.random() * base * 0.3;
        logger.debug({ host, attempt, backoff: Math.round(base + jitter) }, "Retrying fetch");
        await sleep(base + jitter);
      }
    }
  }

  logger.error({ host, error: lastError?.message }, "Fetch failed after retries");
  m.totalFailures++;
  throw lastError;
}

/** Check if a given host's circuit breaker is currently open. */
export function isCircuitOpen(host: string): boolean {
  const cb = getBreaker(host);
  return cb.state === "open";
}

/** Circuit breaker stats for /health */
export function circuitBreakerStats(): Record<string, { state: CBState; failures: number }> {
  const out: Record<string, { state: CBState; failures: number }> = {};
  for (const [host, cb] of breakers) out[host] = { state: cb.state, failures: cb.failures };
  return out;
}

/** Per-host fetch metrics for monitoring/debugging */
export function fetchMetrics(): Record<string, HostMetrics & { avgLatencyMs: number }> {
  const out: Record<string, HostMetrics & { avgLatencyMs: number }> = {};
  for (const [host, m] of hostMetrics) {
    out[host] = {
      ...m,
      minLatencyMs: m.minLatencyMs === Infinity ? 0 : m.minLatencyMs,
      avgLatencyMs: m.totalRequests > 0 ? Math.round(m.totalLatencyMs / m.totalRequests) : 0,
    };
  }
  return out;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
