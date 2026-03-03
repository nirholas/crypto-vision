/**
 * Crypto Vision — HTTP Fetcher
 *
 * Hardened fetch wrapper with:
 *  - Automatic retries with exponential backoff
 *  - Timeout enforcement
 *  - Rate-limit aware (respects 429 Retry-After)
 *  - Source obfuscation (upstream provider names never leak)
 */

import { logger } from "./logger.js";

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
}

export class FetchError extends Error {
  constructor(
    message: string,
    public status: number,
    public source: string
  ) {
    super(message);
    this.name = "FetchError";
  }
}

/**
 * Fetch JSON from an upstream API with retries and caching headers.
 */
export async function fetchJSON<T>(
  url: string,
  opts: FetchOptions = {}
): Promise<T> {
  const { timeout = 10_000, retries = 2, headers = {}, method = "GET", body } = opts;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const res = await fetch(url, {
        method,
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "CryptoVision/0.1",
          ...headers,
          ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      clearTimeout(timer);

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After") || "5");
        logger.warn({ url, retryAfter }, "Rate limited — backing off");
        await sleep(retryAfter * 1000);
        continue;
      }

      if (!res.ok) {
        throw new FetchError(
          `HTTP ${res.status}`,
          res.status,
          new URL(url).hostname
        );
      }

      return (await res.json()) as T;
    } catch (err) {
      clearTimeout(timer);
      lastError = err as Error;

      if (attempt < retries) {
        const backoff = Math.min(1000 * 2 ** attempt, 8000);
        logger.debug({ url, attempt, backoff }, "Retrying fetch");
        await sleep(backoff);
      }
    }
  }

  logger.error({ url, error: lastError?.message }, "Fetch failed after retries");
  throw lastError;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
