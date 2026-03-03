/**
 * Crypto Vision — Main Entry Point
 *
 * The complete cryptocurrency intelligence API.
 * https://cryptocurrency.cv
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { requestId } from "hono/request-id";
import { serve } from "@hono/node-server";

import { logger as log } from "@/lib/logger";
import { cache } from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";

import { marketRoutes } from "@/routes/market";
import { defiRoutes } from "@/routes/defi";
import { newsRoutes } from "@/routes/news";
import { onchainRoutes } from "@/routes/onchain";
import { aiRoutes } from "@/routes/ai";

// ─── App ─────────────────────────────────────────────────────

const app = new Hono();

// ─── Global Middleware ───────────────────────────────────────

app.use("*", requestId());
app.use("*", timing());
app.use("*", secureHeaders());

app.use(
  "*",
  cors({
    origin: (origin) => {
      // Allow all in dev, restrict in prod
      if (process.env.NODE_ENV !== "production") return origin;
      const allowed = (process.env.CORS_ORIGINS || "").split(",").map((s) => s.trim());
      if (allowed.includes("*") || allowed.includes(origin)) return origin;
      return "";
    },
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "X-API-Key"],
    maxAge: 86400,
  })
);

// Rate limit — 200 req/min per IP by default
app.use("/api/*", rateLimit({ limit: 200, windowSeconds: 60 }));

// Request logging
app.use("*", async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  log.info(
    {
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      ms,
    },
    `${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`
  );
});

// ─── Health / Meta ───────────────────────────────────────────

app.get("/", (c) =>
  c.json({
    name: "Crypto Vision",
    description: "The complete cryptocurrency intelligence API",
    version: "0.1.0",
    docs: "/api",
    health: "/health",
    website: "https://cryptocurrency.cv",
  })
);

app.get("/health", async (c) => {
  const cacheStats = cache.stats();
  return c.json({
    status: "ok",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cache: cacheStats,
    env: process.env.NODE_ENV || "development",
  });
});

app.get("/api", (c) =>
  c.json({
    name: "Crypto Vision API",
    version: "0.1.0",
    endpoints: {
      market: {
        "GET /api/coins": "Top coins by market cap",
        "GET /api/coin/:id": "Coin detail",
        "GET /api/price": "Simple price lookup (?ids=bitcoin,ethereum&vs=usd)",
        "GET /api/trending": "Trending coins",
        "GET /api/global": "Global market stats",
        "GET /api/search": "Search coins (?q=...)",
        "GET /api/chart/:id": "Price chart data (?days=7)",
        "GET /api/ohlc/:id": "OHLC candles (?days=7)",
        "GET /api/exchanges": "Exchange rankings",
        "GET /api/categories": "Coin categories",
        "GET /api/fear-greed": "Fear & Greed Index",
        "GET /api/dex/search": "DEX token search (?q=...)",
      },
      defi: {
        "GET /api/defi/protocols": "Top DeFi protocols by TVL",
        "GET /api/defi/protocol/:slug": "Protocol detail + TVL history",
        "GET /api/defi/chains": "Chain TVL rankings",
        "GET /api/defi/chain/:name": "Chain TVL history",
        "GET /api/defi/yields": "Top yield opportunities",
        "GET /api/defi/stablecoins": "Stablecoin market data",
        "GET /api/defi/dex-volumes": "DEX volume rankings",
        "GET /api/defi/fees": "Protocol fee rankings",
        "GET /api/defi/bridges": "Bridge volume data",
        "GET /api/defi/raises": "Recent funding raises",
      },
      news: {
        "GET /api/news": "Latest crypto news",
        "GET /api/news/search": "Search news (?q=...)",
        "GET /api/news/bitcoin": "Bitcoin news",
        "GET /api/news/defi": "DeFi news",
        "GET /api/news/breaking": "Breaking news",
        "GET /api/news/trending": "Trending stories",
        "GET /api/news/sources": "News sources",
      },
      onchain: {
        "GET /api/onchain/gas": "Multi-chain gas prices",
        "GET /api/onchain/bitcoin/fees": "Bitcoin fee estimates",
        "GET /api/onchain/bitcoin/stats": "Bitcoin network stats",
        "GET /api/onchain/token/:address": "Token info by address",
        "GET /api/onchain/prices": "Multi-chain token prices",
      },
      ai: {
        "GET /api/ai/sentiment/:coin": "AI sentiment analysis",
        "GET /api/ai/digest": "AI daily market digest",
        "GET /api/ai/signals": "AI trading signals",
        "POST /api/ai/ask": "Ask AI about crypto",
      },
    },
  })
);

// ─── Mount Routes ────────────────────────────────────────────

app.route("/", marketRoutes);
app.route("/", defiRoutes);
app.route("/", newsRoutes);
app.route("/", onchainRoutes);
app.route("/", aiRoutes);

// ─── 404 Fallback ────────────────────────────────────────────

app.notFound((c) =>
  c.json(
    {
      error: "Not Found",
      message: `No route matches ${c.req.method} ${c.req.path}`,
      docs: "/api",
    },
    404
  )
);

// ─── Global Error Handler ────────────────────────────────────

app.onError((err, c) => {
  log.error({ err, path: c.req.path }, "Unhandled error");
  return c.json(
    {
      error: "Internal Server Error",
      message:
        process.env.NODE_ENV === "production"
          ? "An unexpected error occurred"
          : err.message,
    },
    500
  );
});

// ─── Start Server ────────────────────────────────────────────

const port = Number(process.env.PORT) || 8080;

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    log.info(
      `🚀 Crypto Vision API running on http://localhost:${info.port}`
    );
    log.info(
      `📖 API docs at http://localhost:${info.port}/api`
    );
  }
);

export default app;
