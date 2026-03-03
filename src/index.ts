/**
 * Crypto Vision — Main Entry Point
 *
 * The complete cryptocurrency intelligence API.
 * https://cryptocurrency.cv
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { compress } from "hono/compress";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { requestId } from "hono/request-id";
import { bodyLimit } from "hono/body-limit";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";

import { logger as log } from "@/lib/logger";
import { cache } from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api-error";
import { requestLogger, globalErrorHandler } from "@/lib/middleware";
import { apiKeyAuth } from "@/lib/auth";
import { circuitBreakerStats } from "@/lib/fetcher";
import { aiQueue, heavyFetchQueue } from "@/lib/queue";
import { cdnCacheHeaders } from "@/lib/cdn-cache";

import { marketRoutes } from "@/routes/market";
import { defiRoutes } from "@/routes/defi";
import { newsRoutes } from "@/routes/news";
import { onchainRoutes } from "@/routes/onchain";
import { aiRoutes } from "@/routes/ai";
import { dexRoutes } from "@/routes/dex";
import { securityRoutes } from "@/routes/security";
import { l2Routes } from "@/routes/l2";
import { derivativesRoutes } from "@/routes/derivatives";
import { bitcoinRoutes } from "@/routes/bitcoin";
import { gasRoutes } from "@/routes/gas";
import { researchRoutes } from "@/routes/research";
import { aggregateRoutes } from "@/routes/aggregate";
import { createWsRoutes } from "@/routes/ws";
import { startUpstreams, stopUpstreams, wsStats } from "@/lib/ws";
import { keysRoutes } from "@/routes/keys";
import { cexRoutes } from "@/routes/cex";
import { analyticsRoutes } from "@/routes/analytics";
import { agentsRoutes } from "@/routes/agents";
import { perpsRoutes } from "@/routes/perps";
import { governanceRoutes } from "@/routes/governance";
import { macroRoutes } from "@/routes/macro";
import { solanaRoutes } from "@/routes/solana";
import { depinRoutes } from "@/routes/depin";
import { exchangesRoutes } from "@/routes/exchanges";

// ─── App ─────────────────────────────────────────────────────

const app = new Hono();

const { upgradeWebSocket, injectWebSocket } = createNodeWebSocket({ app });

// ─── Global Middleware ───────────────────────────────────────

app.use("*", requestId());
app.use("*", timing());
app.use("*", secureHeaders());
app.use("*", compress());

// Body size limit — prevent abuse from oversized payloads (10M+ user protection)
app.use("/api/*", bodyLimit({ maxSize: 256 * 1024 })); // 256 KB

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

// API key auth — resolves tier (public / basic / pro) and attaches to context
app.use("/api/*", apiKeyAuth());

// Rate limit — dynamically uses tier from auth middleware
app.use("/api/*", rateLimit({ limit: 200, windowSeconds: 60 }));

// CDN Cache-Control headers — enables edge caching for read-heavy endpoints
app.use("/api/*", cdnCacheHeaders);

// Structured request logging (method, path, status, duration)
app.use("*", requestLogger);

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
  const cbs = circuitBreakerStats();
  const openCircuits = Object.values(cbs).filter((b) => b.state === "open").length;
  const degraded = !cacheStats.redisConnected && !!process.env.REDIS_URL;
  const healthy = !degraded && openCircuits === 0;

  return c.json(
    {
      status: healthy ? "ok" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      cache: cacheStats,
      circuitBreakers: cbs,
      queues: {
        ai: aiQueue.stats(),
        heavyFetch: heavyFetchQueue.stats(),
      },
      websockets: wsStats(),
      memory: {
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
        heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
      env: process.env.NODE_ENV || "development",
    },
    healthy ? 200 : 503,
  );
});

// ─── Readiness Probe ─────────────────────────────────────────

app.get("/api/ready", async (c) => {
  const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

  // Check in-memory cache layer (always healthy)
  checks.memory = { status: "ok" };

  // Check Redis connectivity (if configured)
  const cacheStats = cache.stats();
  if (cacheStats.redisConnected) {
    try {
      const start = Date.now();
      await cache.set("readiness:ping", "pong", 10);
      const val = await cache.get<string>("readiness:ping");
      const latencyMs = Date.now() - start;
      checks.redis = val === "pong"
        ? { status: "ok", latencyMs }
        : { status: "degraded", latencyMs, error: "read-back mismatch" };
    } catch (err: any) {
      checks.redis = { status: "fail", error: err.message };
    }
  } else if (process.env.REDIS_URL) {
    // Redis is configured but not connected
    checks.redis = { status: "fail", error: "Redis configured but not connected" };
  } else {
    checks.redis = { status: "skipped", error: "REDIS_URL not set — memory-only mode" };
  }

  const allOk = Object.values(checks).every(
    (ch) => ch.status === "ok" || ch.status === "skipped",
  );

  return c.json(
    {
      status: allOk ? "ready" : "not_ready",
      checks,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
    allOk ? 200 : 503,
  );
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
        "GET /api/exchanges": "Exchange rankings (CoinGecko)",
        "GET /api/categories": "Coin categories",
        "GET /api/fear-greed": "Fear & Greed Index",
        "GET /api/dex/search": "DEX token search (?q=...)",
        "GET /api/dex/token/:address": "DEX pairs for a token",
        "GET /api/gainers": "Top gainers (24h)",
        "GET /api/losers": "Top losers (24h)",
        "GET /api/high-volume": "Highest volume coins",
        "GET /api/ath-distance": "Distance from ATH",
        "GET /api/compare": "Compare multiple coins (?ids=bitcoin,ethereum)",
        "GET /api/dominance": "Market dominance breakdown",
        "GET /api/market-overview": "Full market overview (multi-source)",
        "GET /api/rates": "Exchange rates from CoinCap",
        "GET /api/markets": "CoinCap exchange markets",
        "GET /api/paprika/global": "Global stats (CoinPaprika)",
        "GET /api/paprika/tickers": "Top coins (CoinPaprika)",
        "GET /api/coincap/assets": "Top assets (CoinCap)",
        "GET /api/coincap/history/:id": "Price history (CoinCap)",
        "GET /api/coinlore/global": "Global stats (CoinLore)",
        "GET /api/coinlore/tickers": "Top coins (CoinLore)",
        "GET /api/coinlore/coin/:id": "Coin detail (CoinLore)",
        "GET /api/coinlore/exchanges": "Exchanges (CoinLore)",
        "GET /api/coinlore/coin/:id/markets": "Coin markets (CoinLore)",
        "GET /api/coinlore/coin/:id/social": "Social stats (CoinLore)",
        "GET /api/exchanges/coincap": "Exchange rankings (CoinCap)",
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
        "GET /api/defi/hacks": "DeFi hack history",
        "GET /api/defi/treasuries": "Protocol treasury balances",
        "GET /api/defi/tvl/history": "Historical total TVL",
        "GET /api/defi/revenue": "Protocol revenue rankings",
        "GET /api/defi/nft-marketplaces": "NFT marketplace volumes",
        "GET /api/defi/options-volume": "Options volume data (DeFiLlama)",
        "GET /api/defi/derivatives-volume": "Derivatives volume data (DeFiLlama)",
        "GET /api/defi/project-metrics/:slug": "Project metrics (TokenTerminal)",
        "GET /api/defi/protocol-fees": "Protocol fee rankings (TokenTerminal)",
        "GET /api/defi/active-users": "Protocol active users (TokenTerminal)",
        "GET /api/defi/market-metric": "Market metrics (?metric=market_cap)",
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
        "GET /api/onchain/bitcoin/overview": "Combined Bitcoin overview",
        "GET /api/onchain/bitcoin/mempool": "Bitcoin mempool stats",
        "GET /api/onchain/bitcoin/blocks": "Recent Bitcoin blocks",
        "GET /api/onchain/bitcoin/difficulty": "Difficulty adjustment info",
        "GET /api/onchain/bitcoin/lightning": "Lightning Network stats",
        "GET /api/onchain/bitcoin/miners": "Mining pool rankings",
        "GET /api/onchain/bitcoin/address/:addr": "Bitcoin address lookup",
        "GET /api/onchain/bitcoin/network": "Bitcoin network stats (blockchain.info)",
        "GET /api/onchain/token/:address": "Token info by address (DexScreener)",
        "GET /api/onchain/prices": "Multi-chain token prices (DeFiLlama)",
        "GET /api/onchain/tvl": "Cross-chain TVL summary",
        "GET /api/onchain/tvl/:chain": "Chain TVL history",
        "GET /api/onchain/stablecoins": "Stablecoin on-chain data",
        "GET /api/onchain/bridges": "Bridge volume data",
        "GET /api/onchain/dex-volume": "On-chain DEX volumes",
        "GET /api/onchain/eth/supply": "ETH total supply",
        "GET /api/onchain/eth/price": "ETH price (Etherscan)",
        "GET /api/onchain/erc20/holders/:address": "Top ERC-20 token holders",
      },
      cex: {
        "GET /api/cex/tickers": "All Binance 24h tickers (?quote=USDT)",
        "GET /api/cex/ticker/:symbol": "Single ticker (e.g. BTCUSDT)",
        "GET /api/cex/price/:symbol": "Current price for a symbol",
        "GET /api/cex/prices": "All Binance prices (?quote=USDT)",
        "GET /api/cex/orderbook/:symbol": "Order book depth",
        "GET /api/cex/trades/:symbol": "Recent trades",
        "GET /api/cex/klines/:symbol": "Candlestick data (?interval=1h)",
        "GET /api/cex/pairs": "Available trading pairs",
        "GET /api/cex/book-ticker": "Best bid/ask for all pairs",
        "GET /api/cex/mini-ticker": "Binance 24h mini ticker (lightweight)",
        "GET /api/cex/avg-price/:symbol": "5-min weighted average price",
        "GET /api/cex/bybit/spot": "Bybit spot tickers",
        "GET /api/cex/okx/spot": "OKX spot tickers",
        "GET /api/cex/okx/mark-price": "OKX mark prices (?instType=SWAP)",
      },
      dex: {
        "GET /api/dex/networks": "Supported DEX networks (100+)",
        "GET /api/dex/trending-pools": "Trending DEX pools (all chains)",
        "GET /api/dex/trending-pools/:network": "Trending pools on a chain",
        "GET /api/dex/new-pools": "Newly created pools (all chains)",
        "GET /api/dex/new-pools/:network": "New pools on a chain",
        "GET /api/dex/top-pools/:network": "Top pools by volume on a chain",
        "GET /api/dex/pool/:network/:address": "Pool OHLCV candle data",
        "GET /api/dex/token/:network/:address": "Token info + all pools",
        "GET /api/dex/pool-search": "Search pools (?q=...)",
      },
      security: {
        "GET /api/security/token/:chainId/:address": "Token security audit (honeypot, tax, holders)",
        "GET /api/security/address/:chainId/:address": "Address risk check (scam, phishing, sanctions)",
        "GET /api/security/approval/:chainId/:address": "Token approval security check",
        "GET /api/security/nft/:chainId/:address": "NFT contract security audit",
        "GET /api/security/dapp": "dApp phishing check (?url=...)",
        "GET /api/security/chains": "Supported security-check chains",
      },
      l2: {
        "GET /api/l2/summary": "All Layer 2 projects with TVL & stage",
        "GET /api/l2/tvl": "L2 TVL breakdown (canonical/external/native)",
        "GET /api/l2/activity": "L2 transaction activity / TPS",
      },
      derivatives: {
        "GET /api/derivatives/funding": "Funding rates across exchanges",
        "GET /api/derivatives/funding/:symbol": "Funding rate for a symbol",
        "GET /api/derivatives/oi": "Open interest overview",
        "GET /api/derivatives/oi/:symbol": "Open interest by exchange",
        "GET /api/derivatives/liquidations": "Liquidation data (long/short)",
        "GET /api/derivatives/long-short/:symbol": "Long/short ratio history",
        "GET /api/derivatives/perps": "Perpetual/futures volume rankings",
        "GET /api/derivatives/options": "Options volume rankings",
        "GET /api/derivatives/overview": "Combined derivatives overview",
      },
      bitcoin: {
        "GET /api/bitcoin/price": "BTC price ticker (multi-currency)",
        "GET /api/bitcoin/stats": "Network stats (hashrate, difficulty, etc.)",
        "GET /api/bitcoin/fees": "Fee estimates (sat/vB)",
        "GET /api/bitcoin/mempool": "Mempool stats (pending txns, fees)",
        "GET /api/bitcoin/difficulty": "Difficulty adjustment progress",
        "GET /api/bitcoin/lightning": "Lightning Network stats",
        "GET /api/bitcoin/address/:addr": "Address balance + tx count",
        "GET /api/bitcoin/tx/:txid": "Transaction details",
        "GET /api/bitcoin/block-height": "Latest block height",
        "GET /api/bitcoin/block/:hash": "Block details by hash",
        "GET /api/bitcoin/block-count": "Total block count (blockchain.info)",
        "GET /api/bitcoin/market-price": "BTC market price chart (blockchain.info)",
        "GET /api/bitcoin/hashrate-history": "Hashrate history (blockchain.info)",
        "GET /api/bitcoin/overview": "Comprehensive Bitcoin dashboard",
        "GET /api/bitcoin/blocks": "Recent blocks with details",
        "GET /api/bitcoin/hashrate": "Hashrate history (?period=1m)",
        "GET /api/bitcoin/miners": "Mining pool rankings",
        "GET /api/bitcoin/price-history": "30-day BTC price chart",
        "GET /api/bitcoin/exchange-rates": "BTC rates in 40+ currencies",
      },
      gas: {
        "GET /api/gas": "All-chain gas prices (ETH, BSC, Polygon, Arbitrum, etc.)",
        "GET /api/gas/:chain": "Gas price for a specific chain",
      },
      research: {
        "GET /api/research/assets": "Asset rankings with deep metrics (Messari)",
        "GET /api/research/asset/:slug": "Deep asset profile (on-chain, dev, risk)",
        "GET /api/research/asset/:slug/markets": "Exchange/pair data for asset",
        "GET /api/research/asset/:slug/market-data": "Messari market data for asset",
        "GET /api/research/search": "Search assets (Messari) (?q=...)",
        "GET /api/research/signals/:symbol": "Trading signals (IntoTheBlock via CryptoCompare)",
        "GET /api/research/social/:coinId": "Social metrics (Twitter, Reddit, GitHub)",
        "GET /api/research/compare": "Compare assets (?slugs=bitcoin,ethereum)",
        "GET /api/research/top-volume": "Top coins by 24h volume",
        "GET /api/research/top-market-cap": "Top coins by market cap (CryptoCompare)",
        "GET /api/research/news": "CryptoCompare news feed",
        "GET /api/research/news-categories": "CryptoCompare news categories",
        "GET /api/research/blockchains": "Available blockchains (CryptoCompare)",
        "GET /api/research/price-full/:symbol": "Full price data with 24h stats",
        "GET /api/research/histo-day/:symbol": "Daily OHLCV history",
        "GET /api/research/histo-hour/:symbol": "Hourly OHLCV history",
        "GET /api/research/exchanges/:symbol": "Exchange volume rankings per coin",
      },
      aggregate: {
        "GET /api/aggregate/prices/:ids": "Price from 3 sources (CoinGecko+Paprika+CoinCap)",
        "GET /api/aggregate/global": "Global stats cross-checked (3 sources)",
        "GET /api/aggregate/tickers": "CoinPaprika tickers",
        "GET /api/aggregate/assets": "CoinCap assets",
        "GET /api/aggregate/history/:id": "CoinCap price history",
        "GET /api/aggregate/top-movers": "Biggest 24h gainers/losers",
        "GET /api/aggregate/market-overview": "Full market dashboard (multi-source)",
      },
      ai: {
        "GET /api/ai/sentiment/:coin": "AI sentiment analysis",
        "GET /api/ai/digest": "AI daily market digest",
        "GET /api/ai/signals": "AI trading signals",
        "POST /api/ai/ask": "Ask AI about crypto",
      },
      agents: {
        "GET /api/agents": "List all 43 DeFi AI agents",
        "GET /api/agents/:id": "Agent detail & metadata",
        "POST /api/agents/:id/chat": "Chat with a specific agent",
        "GET /api/agents/categories": "Agent categories",
        "GET /api/agents/search": "Search agents",
        "POST /api/agents/multi": "Ask multiple agents at once",
      },
      analytics: {
        "GET /api/analytics/correlation": "Cross-asset correlation matrix",
        "GET /api/analytics/volatility": "Historical volatility rankings",
        "GET /api/analytics/l2": "Layer 2 comparison data",
        "GET /api/analytics/revenue": "Protocol revenue rankings",
      },
      perps: {
        "GET /api/perps/overview": "Cross-exchange perps overview (Bybit/OKX/Hyperliquid/dYdX)",
        "GET /api/perps/funding": "Cross-exchange funding rates (sorted by extremes)",
        "GET /api/perps/funding/:symbol": "Funding rate history for one asset across exchanges",
        "GET /api/perps/oi": "Open interest overview (multi-exchange)",
        "GET /api/perps/oi/:symbol": "Open interest for one asset across exchanges",
        "GET /api/perps/markets": "Hyperliquid perpetual markets",
        "GET /api/perps/markets/dydx": "dYdX v4 markets",
        "GET /api/perps/markets/bybit": "Bybit linear perpetual tickers",
        "GET /api/perps/markets/okx": "OKX swap tickers",
        "GET /api/perps/orderbook/:exchange/:symbol": "Orderbook (bybit/okx/dydx/deribit)",
        "GET /api/perps/trades/:exchange/:symbol": "Recent trades (bybit/dydx/hyperliquid)",
        "GET /api/perps/klines/:exchange/:symbol": "Klines/candles (bybit/okx/dydx)",
        "GET /api/perps/options/:currency": "Options chain summary (Deribit)",
        "GET /api/perps/volatility/:currency": "Implied + historical volatility (Deribit)",
        "GET /api/perps/dydx/sparklines": "dYdX sparkline charts",
        "GET /api/perps/hl/user/:address": "Hyperliquid user positions + open orders",
        "GET /api/perps/hl/mids": "Hyperliquid all mid prices",
        "GET /api/perps/hl/stats": "Hyperliquid L1 chain stats",
        "GET /api/perps/deribit/currencies": "Deribit supported currencies",
      },
      governance: {
        "GET /api/governance/proposals/:space": "DAO proposals (Snapshot)",
        "GET /api/governance/active": "Active proposals across 12 major DAOs",
        "GET /api/governance/spaces": "Popular DAO spaces",
        "GET /api/governance/top-spaces": "Top spaces by follower count",
        "GET /api/governance/space/:id": "Space detail",
        "GET /api/governance/votes/:proposalId": "Votes on a proposal",
        "GET /api/governance/search": "Search DAO spaces (?q=...)",
      },
      macro: {
        "GET /api/macro/overview": "Full macro dashboard (indices, commodities, bonds, VIX, DXY)",
        "GET /api/macro/indices": "Stock market indices (S&P500, NASDAQ, Dow, Russell)",
        "GET /api/macro/commodities": "Gold, silver, oil, natural gas prices",
        "GET /api/macro/bonds": "Treasury yields (2Y, 5Y, 10Y, 30Y)",
        "GET /api/macro/vix": "CBOE Volatility Index",
        "GET /api/macro/dxy": "US Dollar Index",
        "GET /api/macro/crypto": "BTC, ETH, SOL, BNB price benchmarks",
        "GET /api/macro/quote/:symbol": "Raw Yahoo Finance quote for any symbol",
      },
      solana: {
        "GET /api/solana/price/:token": "Jupiter price for a token mint/symbol",
        "GET /api/solana/prices": "Batch prices (?ids=mint1,mint2)",
        "GET /api/solana/price-vs/:token": "Price vs another token (?vs=SOL_MINT)",
        "GET /api/solana/quote": "Jupiter swap quote (?inputMint=&outputMint=&amount=)",
        "GET /api/solana/tokens": "Full Solana token list",
        "GET /api/solana/tokens/strict": "Jupiter strict/verified token list",
        "GET /api/solana/tokens/popular": "Popular tokens by volume",
        "GET /api/solana/popular/prices": "Prices for popular Solana tokens",
        "GET /api/solana/top-tokens": "Top tokens by market cap",
        "GET /api/solana/search": "Search tokens (?q=...)",
      },
      depin: {
        "GET /api/depin/projects": "All DePIN projects",
        "GET /api/depin/project/:slug": "Single DePIN project detail",
        "GET /api/depin/categories": "DePIN project categories",
        "GET /api/depin/category/:category": "DePIN projects by category",
        "GET /api/depin/metrics": "Aggregate DePIN metrics",
      },
      exchanges: {
        "GET /api/exchanges/list": "Ranked exchange list (CoinCap)",
        "GET /api/exchanges/:id": "Single exchange detail",
        "GET /api/exchanges/:id/markets": "Markets on an exchange",
        "GET /api/exchanges/rates": "Conversion rates (fiat + crypto)",
        "GET /api/exchanges/rates/:id": "Single conversion rate",
        "GET /api/exchanges/bybit/insurance": "Bybit insurance fund (?coin=BTC)",
        "GET /api/exchanges/bybit/risk-limit": "Bybit risk limits (?symbol=BTCUSDT)",
        "GET /api/exchanges/deribit/index": "Deribit index prices (?currency=BTC)",
        "GET /api/exchanges/coincap/candles": "Exchange candles (?exchange=binance&base=bitcoin&quote=tether)",
      },
      keys: {
        "POST /api/keys": "Generate new API key (admin)",
        "GET /api/keys/usage": "Usage stats for current key",
      },
      calendar: {
        "GET /api/calendar/events": "Upcoming hot crypto events (CoinMarketCal)",
        "GET /api/calendar/coin/:coinId": "Events for a specific coin",
        "GET /api/calendar/categories": "Event categories",
        "GET /api/calendar/category/:id": "Events by category",
        "GET /api/calendar/coins": "Coins with upcoming events",
      },
      oracles: {
        "GET /api/oracles/chainlink/feeds": "Chainlink mainnet price feeds",
        "GET /api/oracles/chainlink/all": "All Chainlink feed directories",
        "GET /api/oracles/dia/quote/:symbol": "DIA oracle price quote",
        "GET /api/oracles/dia/assets": "DIA asset list",
        "GET /api/oracles/dia/supply/:symbol": "DIA circulating supply",
        "GET /api/oracles/pyth/feeds": "Pyth Network feed IDs",
        "POST /api/oracles/pyth/prices": "Pyth latest prices (POST ids[])",
      },
      whales: {
        "GET /api/whales/btc/latest": "Recent large BTC transactions (>1 BTC)",
        "GET /api/whales/stats/bitcoin": "Blockchair BTC network stats",
        "GET /api/whales/stats/ethereum": "Blockchair ETH network stats",
        "GET /api/whales/stats/:chain": "Blockchair stats for any chain",
        "GET /api/whales/charts/price": "BTC market price chart (?timespan=1year)",
        "GET /api/whales/charts/hashrate": "BTC hashrate chart",
        "GET /api/whales/charts/difficulty": "BTC difficulty chart",
        "GET /api/whales/charts/transactions": "BTC transaction count chart",
        "GET /api/whales/charts/:name": "Any blockchain.info chart",
      },
      nft: {
        "GET /api/nft/top": "Top NFT collections by volume (Reservoir)",
        "GET /api/nft/collection/:id": "NFT collection stats",
        "GET /api/nft/activity/:id": "NFT collection activity feed",
        "GET /api/nft/overview": "NFT market overview (DeFi Llama)",
        "GET /api/nft/chains/:chain": "NFT collections by chain",
        "GET /api/nft/chart/:slug": "NFT collection floor/volume chart",
        "GET /api/nft/marketplaces": "NFT marketplace volume rankings",
      },
      staking: {
        "GET /api/staking/eth/validators": "ETH validator queue (beaconcha.in)",
        "GET /api/staking/eth/epoch": "Latest ETH epoch info",
        "GET /api/staking/eth/network": "ETH 2.0 network stats",
        "GET /api/staking/eth/rated": "Rated.network validator overview",
        "GET /api/staking/eth/operators": "Top staking operators (?window=30d)",
        "GET /api/staking/liquid": "Liquid staking protocols (DeFi Llama)",
      },
      websocket: {
        "WS /ws/prices": "Real-time price ticks (subscribe by coin IDs via ?coins=bitcoin,ethereum)",
        "WS /ws/bitcoin": "New blocks and large Bitcoin transactions",
        "WS /ws/trades": "DEX trade / boost feed (via DexScreener)",
        "GET /ws/status": "WebSocket connection status",
      },
    },
  })
);

// ─── Mount Routes ────────────────────────────────────────────

app.route("/api", marketRoutes);
app.route("/api/defi", defiRoutes);
app.route("/api/news", newsRoutes);
app.route("/api/onchain", onchainRoutes);
app.route("/api/ai", aiRoutes);
app.route("/api/cex", cexRoutes);
app.route("/api/derivatives", derivativesRoutes);
app.route("/api/bitcoin", bitcoinRoutes);
app.route("/api/analytics", analyticsRoutes);
app.route("/api/dex", dexRoutes);
app.route("/api/security", securityRoutes);
app.route("/api/l2", l2Routes);
app.route("/api/gas", gasRoutes);
app.route("/api/research", researchRoutes);
app.route("/api/aggregate", aggregateRoutes);
app.route("/api/agents", agentsRoutes);
app.route("/api/perps", perpsRoutes);
app.route("/api/governance", governanceRoutes);
app.route("/api/macro", macroRoutes);
app.route("/api/solana", solanaRoutes);
app.route("/api/depin", depinRoutes);
app.route("/api/exchanges", exchangesRoutes);
app.route("/", keysRoutes);

// ─── 404 Fallback ────────────────────────────────────────────

app.notFound((c) =>
  ApiError.notFound(c, `No route matches ${c.req.method} ${c.req.path}`)
);

// ─── Global Error Handler ────────────────────────────────────

app.onError(globalErrorHandler);

// ─── Start Server ────────────────────────────────────────────

const port = Number(process.env.PORT) || 8080;

const server = serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    injectWebSocket(server);
    void startUpstreams();
    log.info(
      `🚀 Crypto Vision API running on http://localhost:${info.port}`
    );
    log.info(
      `📖 API docs at http://localhost:${info.port}/api`
    );
    log.info(
      `🔌 WebSocket feeds at ws://localhost:${info.port}/ws/prices`
    );
  }
);

// ─── Graceful Shutdown ───────────────────────────────────────

const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS) || 15_000;

async function gracefulShutdown(signal: string) {
  log.info(`${signal} received — starting graceful shutdown`);

  // Allow in-flight requests to drain, then close
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      log.warn("Shutdown timeout reached, forcing exit");
      resolve();
    }, SHUTDOWN_TIMEOUT_MS);
    timer.unref();

    server.close(() => {
      clearTimeout(timer);
      log.info("HTTP server closed");
      resolve();
    });
  });

  // Stop WebSocket upstream connections
  await stopUpstreams();

  // Disconnect shared resources
  try {
    await cache.disconnect();
  } catch {
    /* best-effort */
  }

  log.info("Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default app;
