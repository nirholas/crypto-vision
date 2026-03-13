/**
 * Crypto Vision — GMGN Smart Money Routes
 *
 * Serves processed wallet intelligence from bscwallets.json + solwallets.json.
 *
 * GET /api/gmgn/wallets           — Wallet leaderboard (sorted, filtered)
 * GET /api/gmgn/trades            — Simulated trade events from holdings data
 * GET /api/gmgn/categories        — Category summary with PnL + winrates
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import {
  getGmgnWallets,
  getGmgnTradeEvents,
  getGmgnCategorySummary,
} from "../sources/gmgn.js";
import type { WalletCategory } from "../sources/gmgn.js";

export const gmgnRoutes = new Hono();

const VALID_CATEGORIES = new Set<string>([
  "smart_degen",
  "launchpad_smart",
  "fresh_wallet",
  "snipe_bot",
  "live",
  "top_dev",
  "top_followed",
  "top_renamed",
  "kol",
]);

const VALID_SORT_KEYS = new Set([
  "pnl7d",
  "pnl30d",
  "winrate7d",
  "realizedProfit7d",
  "txs7d",
]);

// ─── Wallet Leaderboard ─────────────────────────────────────

gmgnRoutes.get("/wallets", async (c) => {
  const chainParam = c.req.query("chain");
  const categoryParam = c.req.query("category");
  const sortParam = c.req.query("sort") || "realizedProfit7d";
  const limitParam = Math.min(Number(c.req.query("limit") || 50), 200);

  const chain = chainParam === "bsc" || chainParam === "sol" ? chainParam : undefined;
  const category = categoryParam && VALID_CATEGORIES.has(categoryParam)
    ? (categoryParam as WalletCategory)
    : undefined;
  const sortBy = VALID_SORT_KEYS.has(sortParam)
    ? (sortParam as "pnl7d" | "pnl30d" | "winrate7d" | "realizedProfit7d" | "txs7d")
    : "realizedProfit7d";

  const result = await getGmgnWallets(chain, category, sortBy, limitParam);

  return c.json({
    data: result,
    timestamp: new Date().toISOString(),
  });
});

// ─── Trade Events ───────────────────────────────────────────

gmgnRoutes.get("/trades", async (c) => {
  const chainParam = c.req.query("chain");
  const limitParam = Math.min(Number(c.req.query("limit") || 200), 1000);

  const chain = chainParam === "bsc" || chainParam === "sol" ? chainParam : undefined;

  const events = await getGmgnTradeEvents(chain, limitParam);

  return c.json({
    data: { events, total: events.length },
    timestamp: new Date().toISOString(),
  });
});

// ─── Category Summary ───────────────────────────────────────

gmgnRoutes.get("/categories", async (c) => {
  const summary = await getGmgnCategorySummary();

  return c.json({
    data: summary,
    timestamp: new Date().toISOString(),
  });
});
