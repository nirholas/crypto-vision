/**
 * Crypto Vision — API Key Authentication Middleware
 *
 * Three usage tiers:
 *  - public  (no key)  — 30 req/min
 *  - basic   (API key) — 200 req/min
 *  - pro     (API key) — 2 000 req/min
 *
 * Keys are loaded from the API_KEYS env var (comma-separated),
 * with an optional tier suffix: `<key>:pro` or `<key>:basic`.
 * Keys without a suffix default to `basic`.
 *
 * Admin operations require a key listed in ADMIN_API_KEYS.
 */

import type { Context, Next } from "hono";
import { logger } from "./logger.js";

// ─── Hono Context Augmentation ───────────────────────────────

declare module "hono" {
  interface ContextVariableMap {
    apiKey: string;
    apiTier: ApiTier;
  }
}

// ─── Tier Definitions ────────────────────────────────────────

export type ApiTier = "public" | "basic" | "pro";

export interface TierConfig {
  rateLimit: number;      // requests per window
  windowSeconds: number;  // window size
}

export const TIER_LIMITS: Record<ApiTier, TierConfig> = {
  public: { rateLimit: 30, windowSeconds: 60 },
  basic:  { rateLimit: 200, windowSeconds: 60 },
  pro:    { rateLimit: 2000, windowSeconds: 60 },
};

// ─── Key Store ───────────────────────────────────────────────

export interface KeyEntry {
  key: string;
  tier: ApiTier;
  createdAt: string;
}

/** In-memory key store — seeded from env, mutated by POST /api/keys */
const keyStore = new Map<string, KeyEntry>();

/** Admin key set (cannot be generated via API) */
const adminKeys = new Set<string>();

/** Load keys from environment on startup */
function loadKeysFromEnv(): void {
  const raw = process.env.API_KEYS || "";
  for (const entry of raw.split(",").map((s) => s.trim()).filter(Boolean)) {
    const [key, tierRaw] = entry.split(":");
    const tier: ApiTier = tierRaw === "pro" ? "pro" : "basic";
    keyStore.set(key, { key, tier, createdAt: new Date().toISOString() });
  }

  const adminRaw = process.env.ADMIN_API_KEYS || "";
  for (const key of adminRaw.split(",").map((s) => s.trim()).filter(Boolean)) {
    adminKeys.add(key);
    // Admin keys also get pro-tier access when used as regular keys
    if (!keyStore.has(key)) {
      keyStore.set(key, { key, tier: "pro", createdAt: new Date().toISOString() });
    }
  }

  logger.info(`Auth: loaded ${keyStore.size} API key(s), ${adminKeys.size} admin key(s)`);
}

loadKeysFromEnv();

// ─── Key helpers (used by routes/keys.ts) ────────────────────

export function lookupKey(apiKey: string): KeyEntry | undefined {
  return keyStore.get(apiKey);
}

export function addKey(entry: KeyEntry): void {
  keyStore.set(entry.key, entry);
}

export function isAdmin(apiKey: string): boolean {
  return adminKeys.has(apiKey);
}

// ─── Usage Tracking ──────────────────────────────────────────

export interface UsageRecord {
  requests: number;
  windowStart: number;
}

const usageMap = new Map<string, UsageRecord>();

export function trackUsage(apiKey: string): void {
  const now = Date.now();
  const windowMs = 60_000;
  let record = usageMap.get(apiKey);
  if (!record || now - record.windowStart > windowMs) {
    record = { requests: 0, windowStart: now };
    usageMap.set(apiKey, record);
  }
  record.requests++;
}

export function getUsage(apiKey: string): UsageRecord | undefined {
  return usageMap.get(apiKey);
}

// ─── Middleware ───────────────────────────────────────────────

/**
 * API key auth middleware.
 * Reads `X-API-Key` header, resolves tier, and stores it on `c.set()`.
 *
 * Variables attached to context:
 *  - `apiTier`  — "public" | "basic" | "pro"
 *  - `apiKey`   — the raw key string or "anonymous"
 */
export function apiKeyAuth() {
  return async (c: Context, next: Next) => {
    const header = c.req.header("X-API-Key");

    if (!header) {
      c.set("apiTier", "public" as ApiTier);
      c.set("apiKey", "anonymous");
      await next();
      return;
    }

    const entry = keyStore.get(header);
    if (!entry) {
      return c.json(
        { error: "INVALID_API_KEY", message: "The provided API key is not valid." },
        401,
      );
    }

    c.set("apiTier", entry.tier);
    c.set("apiKey", header);

    trackUsage(header);

    await next();
  };
}

/**
 * Guard that requires an admin API key.
 * Must be applied AFTER `apiKeyAuth()`.
 */
export function requireAdmin() {
  return async (c: Context, next: Next) => {
    const apiKey = c.get("apiKey") as string | undefined;
    if (!apiKey || !adminKeys.has(apiKey)) {
      return c.json(
        { error: "FORBIDDEN", message: "Admin access required." },
        403,
      );
    }
    await next();
  };
}
