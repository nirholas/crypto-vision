/**
 * Centralized CoinGecko API fetch wrapper with rate limiting
 * 
 * Prevents 429 errors during SSR builds by serializing requests
 * and respecting CoinGecko's free-tier rate limits (~10-30 calls/min).
 * 
 * All CoinGecko fetch calls from page-level server components should
 * use `fetchCoinGecko()` instead of raw `fetch()`.
 */

// ---------------------------------------------------------------------------
// Rate-limit state (module-scoped singleton, per-process)
// ---------------------------------------------------------------------------
interface RateLimitState {
  /** Timestamps (ms) of recent requests inside the current window */
  timestamps: number[];
  /** Absolute ms timestamp – do not send requests before this */
  retryAfter: number;
}

const state: RateLimitState = {
  timestamps: [],
  retryAfter: 0,
};

/** Sliding window size in ms */
const WINDOW_MS = 60_000;

/**
 * Max requests per window.  CoinGecko free tier allows ~10-30/min.
 * During SSR builds many pages render in parallel so keep this conservative.
 */
const MAX_REQUESTS = 10;

/** Minimum delay between consecutive requests (ms) */
const MIN_DELAY_MS = 2_000;

/** Last request timestamp */
let lastRequestTime = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Remove expired timestamps from the sliding window */
function pruneWindow(): void {
  const cutoff = Date.now() - WINDOW_MS;
  state.timestamps = state.timestamps.filter((t) => t > cutoff);
}

/** Sleep helper */
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Serialization queue – ensures only one in-flight CG request at a time
let queue: Promise<void> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  // Chain onto the queue so requests are serialized
  const p = queue.then(fn, fn);
  // Update queue tail (swallow errors so the chain never breaks)
  queue = p.then(() => {}, () => {});
  return p;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface CoinGeckoFetchOptions {
  /** Next.js revalidate seconds (default 120) */
  revalidate?: number;
  /** Fetch timeout in ms (default 15 000) */
  timeout?: number;
}

/**
 * Rate-limited fetch for CoinGecko endpoints.
 * 
 * - Serializes requests so only one is in flight at a time
 * - Enforces a sliding-window rate limit
 * - Respects `retry-after` headers on 429 responses
 * - Returns `null` on failure so pages can render gracefully with empty data
 */
export async function fetchCoinGecko<T = unknown>(
  url: string,
  options: CoinGeckoFetchOptions = {},
): Promise<T | null> {
  const { revalidate = 120, timeout = 15_000 } = options;

  return enqueue(async () => {
    // ---- wait for retry-after window if set ----
    if (state.retryAfter > Date.now()) {
      const wait = state.retryAfter - Date.now();
      console.warn(`[CoinGecko] Waiting ${(wait / 1000).toFixed(1)}s for retry-after`);
      await sleep(wait);
    }

    // ---- sliding-window gate ----
    pruneWindow();
    if (state.timestamps.length >= MAX_REQUESTS) {
      const oldest = state.timestamps[0];
      const wait = oldest + WINDOW_MS - Date.now() + 500; // +500ms safety
      console.warn(`[CoinGecko] Rate limit window full – waiting ${(wait / 1000).toFixed(1)}s`);
      await sleep(Math.max(wait, 0));
      pruneWindow();
    }

    // ---- enforce minimum gap between requests ----
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < MIN_DELAY_MS) {
      await sleep(MIN_DELAY_MS - elapsed);
    }

    // ---- make request ----
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      state.timestamps.push(Date.now());
      lastRequestTime = Date.now();

      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'User-Agent': 'FreeCryptoNews/2.0',
        },
        next: { revalidate },
      });

      if (res.status === 429) {
        const retryAfterSec = parseInt(res.headers.get('retry-after') || '60', 10);
        state.retryAfter = Date.now() + retryAfterSec * 1000;
        console.warn(`[CoinGecko] 429 received – backing off ${retryAfterSec}s`);
        return null;
      }

      if (!res.ok) {
        console.warn(`[CoinGecko] ${res.status} from ${url}`);
        return null;
      }

      return (await res.json()) as T;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        console.warn(`[CoinGecko] Timeout after ${timeout}ms for ${url}`);
      } else {
        console.warn(`[CoinGecko] Fetch error:`, (err as Error).message);
      }
      return null;
    } finally {
      clearTimeout(timer);
    }
  });
}
