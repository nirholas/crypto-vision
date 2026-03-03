/**
 * Crypto Vision — API Key Management Routes
 *
 * POST /api/keys        — Generate a new API key (admin-only)
 * GET  /api/keys/usage  — Check usage stats for the current key
 */

import { Hono } from "hono";
import crypto from "node:crypto";
import {
  requireAdmin,
  lookupKey,
  addKey,
  getUsage,
  TIER_LIMITS,
  type ApiTier,
  type KeyEntry,
} from "@/lib/auth";

// ─── Router ──────────────────────────────────────────────────

export const keysRoutes = new Hono();

// ─── POST /api/keys — Generate new API key (admin) ──────────

keysRoutes.post("/api/keys", requireAdmin(), async (c) => {
  let tier: ApiTier = "basic";

  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const body = await c.req.json<{ tier?: string }>();
      if (body.tier === "pro" || body.tier === "basic") {
        tier = body.tier;
      }
    } catch {
      return c.json({ error: "INVALID_JSON", message: "Could not parse request body." }, 400);
    }
  }

  const newKey = `cv_${tier}_${crypto.randomBytes(24).toString("hex")}`;
  const entry: KeyEntry = {
    key: newKey,
    tier,
    createdAt: new Date().toISOString(),
  };

  addKey(entry);

  return c.json(
    {
      key: newKey,
      tier,
      rateLimit: TIER_LIMITS[tier],
      createdAt: entry.createdAt,
      message: "Store this key securely — it cannot be retrieved again.",
    },
    201,
  );
});

// ─── GET /api/keys/usage — Usage stats for current key ──────

keysRoutes.get("/api/keys/usage", async (c) => {
  const apiKey = c.get("apiKey") as string | undefined;
  const apiTier = (c.get("apiTier") as ApiTier | undefined) || "public";

  if (!apiKey || apiKey === "anonymous") {
    return c.json(
      {
        tier: "public",
        rateLimit: TIER_LIMITS.public,
        usage: null,
        message: "No API key provided. Using public tier.",
      },
      200,
    );
  }

  const entry = lookupKey(apiKey);
  if (!entry) {
    return c.json({ error: "INVALID_API_KEY", message: "Key not found." }, 401);
  }

  const usage = getUsage(apiKey);

  return c.json({
    tier: entry.tier,
    rateLimit: TIER_LIMITS[entry.tier],
    createdAt: entry.createdAt,
    usage: usage
      ? {
          requests: usage.requests,
          windowStart: new Date(usage.windowStart).toISOString(),
          remaining: Math.max(0, TIER_LIMITS[entry.tier].rateLimit - usage.requests),
        }
      : { requests: 0, windowStart: null, remaining: TIER_LIMITS[entry.tier].rateLimit },
  });
});
