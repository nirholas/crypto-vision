/**
 * Crypto Vision — Solana Route
 *
 * Solana ecosystem data: Jupiter prices, quotes, tokens, popular tokens.
 *
 * GET /api/solana/price/:token     — Price for a token mint or symbol
 * GET /api/solana/prices           — Batch prices  (?ids=mint1,mint2)
 * GET /api/solana/quote            — Jupiter swap quote
 * GET /api/solana/tokens           — Full token list
 * GET /api/solana/tokens/popular   — Popular tokens by volume
 * GET /api/solana/search           — Search tokens by name/symbol
 */

import { Hono } from "hono";
import * as jupiter from "../sources/jupiter.js";

export const solanaRoutes = new Hono();

solanaRoutes.get("/price/:token", async (c) => {
  const token = c.req.param("token");
  const vs = c.req.query("vs");
  const data = vs
    ? await jupiter.getPriceVs(token, vs)
    : await jupiter.getPrice(token);
  return c.json(data);
});

solanaRoutes.get("/prices", async (c) => {
  const ids = c.req.query("ids");
  if (!ids) return c.json({ error: "Missing ?ids= parameter (comma-separated mints or symbols)" }, 400);
  const vs = c.req.query("vs");
  const data = vs
    ? await jupiter.getPriceVs(ids, vs)
    : await jupiter.getPrice(ids);
  return c.json(data);
});

solanaRoutes.get("/quote", async (c) => {
  const inputMint = c.req.query("inputMint");
  const outputMint = c.req.query("outputMint");
  const amount = c.req.query("amount");
  const slippageBps = c.req.query("slippageBps") ? Number(c.req.query("slippageBps")) : undefined;

  if (!inputMint || !outputMint || !amount) {
    return c.json({ error: "Required: ?inputMint=&outputMint=&amount= (amount in smallest unit)" }, 400);
  }

  const data = await jupiter.getQuote(inputMint, outputMint, amount, slippageBps);
  return c.json(data);
});

solanaRoutes.get("/tokens", async (c) => {
  const data = await jupiter.getTokenList();
  return c.json({ count: data.length, data });
});

solanaRoutes.get("/tokens/popular", async (c) => {
  const data = await jupiter.getPopularPrices();
  return c.json(data);
});

solanaRoutes.get("/search", async (c) => {
  const q = c.req.query("q");
  if (!q) return c.json({ error: "Missing ?q= parameter" }, 400);
  const data = await jupiter.searchTokens(q);
  return c.json({ query: q, data });
});

// ─── Price vs Another Token ──────────────────────────────────

solanaRoutes.get("/price-vs/:token", async (c) => {
  const token = c.req.param("token");
  const vs = c.req.query("vs") || "So11111111111111111111111111111111111111112";
  const data = await jupiter.getPriceVs(token, vs);
  return c.json(data);
});

// ─── Strict Token List ───────────────────────────────────────

solanaRoutes.get("/tokens/strict", async (c) => {
  const data = await jupiter.getStrictTokenList();
  return c.json({ count: data.length, data });
});

// ─── Popular Token Prices ────────────────────────────────────

solanaRoutes.get("/popular/prices", async (c) => {
  const data = await jupiter.getPopularPrices();
  return c.json(data);
});

// ─── Top Tokens by Market Cap ────────────────────────────────

solanaRoutes.get("/top-tokens", async (c) => {
  const data = await jupiter.getTopTokensByMarketCap();
  return c.json(data);
});
