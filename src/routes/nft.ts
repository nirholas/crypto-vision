/**
 * Crypto Vision — NFT Routes
 *
 * Comprehensive NFT market data from Reservoir, DeFi Llama, and CoinGecko.
 *
 * GET /api/nft/top                   — Top NFT collections by volume
 * GET /api/nft/trending              — Trending collections
 * GET /api/nft/collection/:id        — Single collection stats
 * GET /api/nft/activity/:id          — Collection activity feed
 * GET /api/nft/bids/:id              — Top bids for a collection
 * GET /api/nft/listings/:id          — Top listings for a collection
 * GET /api/nft/search                — Search NFT collections
 * GET /api/nft/overview              — NFT market overview (DeFi Llama)
 * GET /api/nft/chains/:chain         — NFT collections by chain
 * GET /api/nft/chart/:slug           — NFT collection floor/volume chart
 * GET /api/nft/marketplaces          — NFT marketplace volume rankings
 * GET /api/nft/user/:address         — User NFT portfolio
 * GET /api/nft/list                  — CoinGecko NFT list
 * GET /api/nft/detail/:id            — CoinGecko NFT detail
 * GET /api/nft/market-chart/:id      — CoinGecko NFT market chart
 * GET /api/nft/trending-cg           — CoinGecko trending NFTs
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { Hono } from "hono";
import * as nft from "../sources/nft.js";

export const nftRoutes = new Hono();

// ─── Reservoir Endpoints ─────────────────────────────────────

nftRoutes.get("/top", async (c) => {
  const chain = c.req.query("chain") || "ethereum";
  const sortBy = c.req.query("sortBy") || "1DayVolume";
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const data = await nft.getTopCollections(chain, sortBy, limit);
  return c.json(data);
});

nftRoutes.get("/trending", async (c) => {
  const chain = c.req.query("chain") || "ethereum";
  const period = c.req.query("period") || "1d";
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const data = await nft.getTrendingCollections(chain, period, limit);
  return c.json(data);
});

nftRoutes.get("/collection/:id", async (c) => {
  const id = c.req.param("id");
  const chain = c.req.query("chain") || "ethereum";
  const data = await nft.getCollection(id, chain);
  return c.json(data);
});

nftRoutes.get("/activity/:id", async (c) => {
  const id = c.req.param("id");
  const chain = c.req.query("chain") || "ethereum";
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const types = c.req.query("types") || "sale,transfer,mint";
  const data = await nft.getCollectionActivity(id, chain, limit, types);
  return c.json(data);
});

nftRoutes.get("/bids/:id", async (c) => {
  const id = c.req.param("id");
  const chain = c.req.query("chain") || "ethereum";
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
  const data = await nft.getCollectionBids(id, chain, limit);
  return c.json(data);
});

nftRoutes.get("/listings/:id", async (c) => {
  const id = c.req.param("id");
  const chain = c.req.query("chain") || "ethereum";
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
  const data = await nft.getCollectionListings(id, chain, limit);
  return c.json(data);
});

nftRoutes.get("/search", async (c) => {
  const q = c.req.query("q") || "";
  if (!q) return c.json({ error: "Missing ?q= parameter" }, 400);
  const chain = c.req.query("chain") || "ethereum";
  const limit = Math.min(Number(c.req.query("limit")) || 20, 50);
  const data = await nft.searchCollections(q, chain, limit);
  return c.json(data);
});

nftRoutes.get("/user/:address", async (c) => {
  const address = c.req.param("address");
  const chain = c.req.query("chain") || "ethereum";
  const limit = Math.min(Number(c.req.query("limit")) || 50, 100);
  const data = await nft.getUserNFTs(address, chain, limit);
  return c.json(data);
});

// ─── DeFi Llama NFT Endpoints ────────────────────────────────

nftRoutes.get("/overview", async (c) => {
  const data = await nft.getNFTMarketplaces();
  return c.json(data);
});

nftRoutes.get("/chains/:chain", async (c) => {
  const data = await nft.getNFTChains();
  return c.json(data);
});

nftRoutes.get("/chart/:slug", async (c) => {
  const slug = c.req.param("slug");
  const data = await nft.getNFTCollectionChart(slug);
  return c.json(data);
});

nftRoutes.get("/marketplaces", async (c) => {
  const data = await nft.getNFTMarketplaces();
  return c.json(data);
});

// ─── CoinGecko NFT Endpoints ────────────────────────────────

nftRoutes.get("/list", async (c) => {
  const perPage = Math.min(Number(c.req.query("per_page")) || 100, 250);
  const page = Number(c.req.query("page")) || 1;
  const data = await nft.getNFTList(perPage, page);
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});

nftRoutes.get("/detail/:id", async (c) => {
  const id = c.req.param("id");
  const data = await nft.getNFTDetail(id);
  return c.json(data);
});

nftRoutes.get("/market-chart/:id", async (c) => {
  const id = c.req.param("id");
  const days = Number(c.req.query("days")) || 30;
  const data = await nft.getNFTMarketChart(id, days);
  return c.json(data);
});

nftRoutes.get("/trending-cg", async (c) => {
  const data = await nft.getTrendingNFTs();
  return c.json({ count: Array.isArray(data) ? data.length : 0, data });
});

// ─── Collection Stats (Reservoir) ────────────────────────────

nftRoutes.get("/stats/:id", async (c) => {
  const id = c.req.param("id");
  const chain = c.req.query("chain") || "ethereum";
  const data = await nft.getCollectionStats(id, chain);
  return c.json(data);
});
