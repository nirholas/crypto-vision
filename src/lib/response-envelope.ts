/**
 * Crypto Vision — Response Envelope Middleware
 *
 * Enriches /api/* JSON responses with a `meta` block containing:
 *   - cached:    whether the response was served from cache
 *   - latencyMs: handler execution time in milliseconds
 *   - source:    upstream data provider identifier
 *
 * Non-JSON responses, error responses, and meta/health routes are
 * passed through unchanged.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import type { Context, MiddlewareHandler, Next } from "hono";

// ─── Source Mapping ──────────────────────────────────────────

/**
 * Maps the first path segment after /api/ to the upstream data source.
 * Used to populate `meta.source` in the response envelope.
 */
const SOURCE_MAP: Readonly<Record<string, string>> = {
  coins: "coingecko",
  coin: "coingecko",
  price: "coingecko",
  trending: "coingecko",
  global: "coingecko",
  search: "coingecko",
  chart: "coingecko",
  ohlc: "coingecko",
  categories: "coingecko",
  exchanges: "coincap",
  "fear-greed": "alternative.me",
  gainers: "coingecko",
  losers: "coingecko",
  "high-volume": "coingecko",
  "ath-distance": "coingecko",
  compare: "coingecko",
  dominance: "coingecko",
  "market-overview": "multi-source",
  rates: "coincap",
  markets: "coincap",
  paprika: "coinpaprika",
  coincap: "coincap",
  coinlore: "coinlore",
  defi: "defillama",
  news: "cryptopanic",
  "news-feed": "rss-aggregator",
  onchain: "multi-source",
  ai: "vertex-ai",
  agents: "vertex-ai",
  cex: "binance",
  dex: "geckoterminal",
  security: "gopluslabs",
  l2: "l2beat",
  derivatives: "coinglass",
  bitcoin: "mempool.space",
  gas: "multi-source",
  research: "messari",
  aggregate: "multi-source",
  analytics: "computed",
  perps: "multi-source",
  governance: "snapshot",
  macro: "yahoo-finance",
  solana: "jupiter",
  depin: "depin.ninja",
  nft: "reservoir",
  whales: "blockchair",
  staking: "beaconcha.in",
  calendar: "coinmarketcal",
  oracles: "multi-source",
  unlocks: "token-unlocks",
  etf: "yahoo-finance",
  portfolio: "computed",
  social: "multi-source",
  anomalies: "computed",
  keys: "internal",
  ready: "internal",
};

/** Paths that should NOT receive the response envelope. */
const SKIP_PATHS = new Set(["/api", "/api/ready"]);

/**
 * Extract the upstream source identifier from a request path.
 *
 * @example getSource("/api/defi/protocols") → "defillama"
 * @example getSource("/api/coins")          → "coingecko"
 */
export function getSource(path: string): string {
  const stripped = path.replace(/^\/api\//, "");
  const segment = stripped.split("/")[0];
  return SOURCE_MAP[segment] ?? "api";
}

// ─── Response Envelope Middleware ────────────────────────────

/**
 * Hono middleware that injects a `meta` object into successful
 * JSON API responses. If the response body already has a `data` key,
 * `meta` is added alongside it. Otherwise the original body is
 * wrapped as `{ data: <original>, meta: {...} }`.
 *
 * Skips non-JSON responses, error statuses (4xx/5xx), and
 * meta-level routes (/api docs listing, /api/ready).
 */
export const responseEnvelope: MiddlewareHandler = async (c: Context, next: Next) => {
  const start = Date.now();
  await next();

  // Skip non-JSON, non-GET/POST, errors, and excluded paths
  if (c.res.status >= 400) return;

  const contentType = c.res.headers.get("Content-Type");
  if (!contentType?.includes("application/json")) return;

  if (SKIP_PATHS.has(c.req.path)) return;

  // Read and parse the response body
  const text = await c.res.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not valid JSON — pass through unchanged
    c.res = new Response(text, {
      status: c.res.status,
      headers: c.res.headers,
    });
    return;
  }

  const latencyMs = Date.now() - start;
  const source = getSource(c.req.path);
  const cached = c.res.headers.get("X-Cache") === "HIT";

  const meta = { cached, latencyMs, source };

  // If the response is an object with a `data` key, merge meta alongside
  // Otherwise wrap the entire body under `data`
  let envelope: Record<string, unknown>;
  if (
    parsed !== null &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "data" in (parsed as Record<string, unknown>)
  ) {
    envelope = { ...(parsed as Record<string, unknown>), meta };
  } else {
    envelope = { data: parsed, meta };
  }

  const newBody = JSON.stringify(envelope);
  const headers = new Headers(c.res.headers);
  headers.set("Content-Length", new TextEncoder().encode(newBody).byteLength.toString());

  c.res = new Response(newBody, {
    status: c.res.status,
    headers,
  });
};
