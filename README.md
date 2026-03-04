# Crypto Vision 

> A production-grade crypto intelligence platform — 200+ API endpoints, 37 data sources, 58 AI agents, real-time WebSocket feeds, anomaly detection, RAG-powered semantic search, BigQuery data warehouse, and a complete AI model training pipeline.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-≥22-green)](https://nodejs.org/)
[![Hono](https://img.shields.io/badge/Hono-4.7-orange)](https://hono.dev/)
[![License](https://img.shields.io/badge/License-AGPL--3.0-red)](LICENSE)

---

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Architecture](#architecture)
- [API Reference](#api-reference)
- [Data Sources](#data-sources)
- [Packages](#packages)
- [Apps](#apps)
- [AI Agents](#ai-agents)
- [Workers & Ingestion](#workers--ingestion)
- [Telegram Bot (crypto vision)](#telegram-bot-sect-bot)
- [Infrastructure](#infrastructure)
- [Training & Fine-Tuning](#training--fine-tuning)
- [BigQuery Data Warehouse](#bigquery-data-warehouse)
- [Testing](#testing)
- [Monitoring & Observability](#monitoring--observability)
- [Self-Hosting](#self-hosting)
- [Performance](#performance)
- [Project Structure](#project-structure)
- [Documentation](#documentation)

---

## Overview

Crypto Vision is a comprehensive crypto data aggregation, intelligence, and AI platform built on TypeScript and the Hono framework. It provides:

- **200+ REST API endpoints** across 35+ route domains (market data, DeFi, on-chain analytics, derivatives, news, AI, governance, macroeconomics, and more)
- **37 data source adapters** (CoinGecko, DeFiLlama, Binance, Bybit, OKX, Deribit, dYdX, Hyperliquid, L2Beat, Messari, Token Terminal, GeckoTerminal, Jupiter, DePin Scan, etc.)
- **58 specialized AI agents** for DeFi strategy, trading, portfolio management, security analysis, and education
- **Real-time WebSocket feeds** for prices, Bitcoin mempool, and DEX trades
- **Anomaly detection engine** using Modified Z-Score and EWMA algorithms across 16 anomaly types
- **RAG-powered semantic search** with multi-provider embeddings (Vertex AI, OpenAI)
- **Multi-provider AI** with automatic fallback chain: Groq → Gemini → OpenAI → Anthropic → OpenRouter
- **Two-tier caching** (in-memory LRU + Redis) with stampede protection and stale-while-revalidate
- **Circuit breaker** pattern per upstream host with exponential backoff
- **BigQuery data warehouse** with 22+ tables and materialized views
- **Complete ML pipeline** for model training, fine-tuning (Gemini + open-source), evaluation, and inference serving
- **Full GCP infrastructure** as code (Terraform, Cloud Run, Pub/Sub, Scheduler, Kubernetes)

---

## Quick Start

### Prerequisites

- **Node.js ≥ 22** (ESM required)
- **PostgreSQL 16** (for crypto vision)
- **Redis 7** (optional, for distributed caching)
- **Google Cloud** credentials (optional, for BigQuery/Pub/Sub/Vertex AI)

### Local Development

```bash
# Clone the repository
git clone https://github.com/nirholas/crypto-vision.git
cd crypto-vision

# Install dependencies
npm install

# Copy and configure environment variables
cp .env.example .env  # Edit with your API keys

# Start development server (hot-reload via tsx)
npm run dev

# Server starts on http://localhost:8080
```

### Docker

```bash
# Build and run the main API server
docker build -t crypto-vision .
docker run -p 8080:8080 --env-file .env crypto-vision

# Or use Docker Compose for full stack (API + Redis)
docker compose up
```

### Docker Compose — Ingestion Workers

```bash
# Start ingestion workers (market, defi, news, dex, derivatives, governance, macro, onchain)
docker compose -f docker-compose.ingest.yml up
```

### NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with hot-reload (tsx) |
| `npm run build` | Compile TypeScript (`tsc -p tsconfig.build.json && tsc-alias`) |
| `npm start` | Run compiled build (`node dist/index.js`) |
| `npm test` | Run all tests (Vitest) |
| `npm run test:coverage` | Run tests with coverage |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |
| `npm run db:generate` | Generate Drizzle ORM migrations |
| `npm run db:migrate` | Apply database migrations |
| `npm run db:push` | Push schema changes |
| `npm run db:studio` | Open Drizzle Studio |
| `npm run export:all` | Export all data from BigQuery |
| `npm run export:embeddings` | Export embeddings |
| `npm run import:postgres` | Import exported data to PostgreSQL |

---

## Environment Variables

> 📖 See [docs/SECURITY_GUIDE.md](docs/SECURITY_GUIDE.md) for secrets management best practices.

### Core

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `8080` | Server port |
| `NODE_ENV` | No | `development` | Environment (development / production) |
| `LOG_LEVEL` | No | `info` | Pino log level |

### API Keys — Data Sources

| Variable | Required | Description |
|---|---|---|
| `COINGECKO_API_KEY` | No | CoinGecko Pro/Demo API key |
| `COINGECKO_API_TYPE` | No | `pro` or `demo` (default: `demo`) |
| `CRYPTOCOMPARE_API_KEY` | No | CryptoCompare API key |
| `ETHERSCAN_API_KEY` | No | Etherscan API key |
| `MESSARI_API_KEY` | No | Messari API key |
| `TOKENTERMINAL_API_KEY` | No | Token Terminal API key |
| `COINGLASS_API_KEY` | No | CoinGlass API key |
| `NEWSDATA_API_KEY` | No | NewsData.io API key |
| `CALENDARIFIC_API_KEY` | No | Calendarific API key |
| `GOPLUS_APP_KEY` | No | GoPlus security API key |
| `GOPLUS_APP_SECRET` | No | GoPlus security API secret |

### AI Providers

| Variable | Required | Description |
|---|---|---|
| `GROQ_API_KEY` | No | Groq API key (primary AI provider) |
| `GEMINI_API_KEY` | No | Google Gemini API key (fallback #1) |
| `OPENAI_API_KEY` | No | OpenAI API key (fallback #2) |
| `ANTHROPIC_API_KEY` | No | Anthropic API key (fallback #3) |
| `OPENROUTER_API_KEY` | No | OpenRouter API key (final fallback) |

### Database & Cache

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | For Bot | PostgreSQL connection string |
| `REDIS_URL` | No | Redis connection string |

### Google Cloud

| Variable | Required | Description |
|---|---|---|
| `GCP_PROJECT_ID` | For GCP features | Google Cloud project ID |
| `GCP_BIGQUERY_DATASET` | For BigQuery | BigQuery dataset name |
| `GCP_PUBSUB_ENABLED` | No | Enable Pub/Sub publishing (`true`/`false`) |
| `VERTEX_AI_LOCATION` | No | Vertex AI region (default: `us-central1`) |

### Authentication

| Variable | Required | Description |
|---|---|---|
| `API_KEY_PUBLIC` | No | Public tier key (30 rpm) |
| `API_KEY_BASIC` | No | Basic tier key (200 rpm) |
| `API_KEY_PRO` | No | Pro tier key (2000 rpm) |
| `API_KEY_ENTERPRISE` | No | Enterprise tier key (10000 rpm) |

### Telegram Bot

| Variable | Required | Description |
|---|---|---|
| `SECTBOT_ENABLED` | No | Enable crypto vision (`true`/`false`) |
| `BOT_TOKEN` | For Bot | Telegram bot token |

---

## Architecture

> 📖 See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full architecture deep-dive.

```
┌──────────────────────────────────────────────────────────────────┐
│                        Clients                                   │
│   REST API  │  WebSocket  │  Telegram Bot  │  Dashboard/Apps     │
└──────┬──────┴──────┬──────┴───────┬────────┴──────┬──────────────┘
       │             │              │               │
┌──────▼─────────────▼──────────────▼───────────────▼──────────────┐
│                     Hono HTTP Server (src/index.ts)               │
│  ┌────────────────────────────────────────────────────────────┐   │
│  │ Middleware: CORS │ Auth │ Rate-Limit │ Compression │ ETag  │   │
│  │            │ Metrics │ Response Envelope │ Request Timeout │   │
│  └────────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 35+ Route│  │ WebSocket│  │ Anomaly  │  │ AI + RAG Pipeline│ │
│  │ Modules  │  │ Manager  │  │ Engine   │  │ Multi-Provider   │ │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬──────────┘ │
└───────┼──────────────┼─────────────┼────────────────┼────────────┘
        │              │             │                │
┌───────▼──────────────▼─────────────▼────────────────▼────────────┐
│                        Core Libraries (src/lib/)                  │
│  ┌─────────┐  ┌────────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Fetcher │  │ Two-Tier   │  │ Bounded  │  │ Vector Store   │  │
│  │ Circuit │  │ Cache      │  │ Queue    │  │ (BigQuery /    │  │
│  │ Breaker │  │ LRU+Redis  │  │ AI:10/500│  │  In-Memory)    │  │
│  └────┬────┘  └─────┬──────┘  └────┬─────┘  └───────┬────────┘  │
└───────┼─────────────┼──────────────┼─────────────────┼───────────┘
        │             │              │                 │
┌───────▼─────────────▼──────────────▼─────────────────▼───────────┐
│               37 Data Source Adapters (src/sources/)              │
│  CoinGecko │ DeFiLlama │ Binance │ Bybit │ OKX │ L2Beat │ ...   │
└───────┬──────────────────────────────────────────────────────────┘
        │
┌───────▼──────────────────────────────────────────────────────────┐
│                    Storage & Messaging                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐   │
│  │PostgreSQL│  │  Redis   │  │ BigQuery │  │  Pub/Sub       │   │
│  │(Drizzle) │  │(ioredis) │  │ (22+ tbl)│  │ (5 tiers)     │   │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### Key Architectural Patterns

**Two-Tier Cache** — In-memory LRU (200,000 entries) with optional Redis L2. Features stampede protection (coalesced requests), stale-while-revalidate (serve stale data while refreshing), per-key TTL, and background refresh.

**Circuit Breaker** — Per-host circuit breakers with configurable failure thresholds. States: CLOSED → OPEN (after 5 failures) → HALF-OPEN (probe after 30s). Prevents cascade failures to upstream APIs.

**Bounded Concurrency Queue** — AI requests are bounded to 10 concurrent / 500 max queued. Prevents overloading AI providers and manages backpressure.

**Multi-Provider AI Fallback** — Automatic failover chain: Groq → Gemini → OpenAI → Anthropic → OpenRouter. If one provider is down, the next in chain handles the request transparently.

**4-Tier API Authentication** — Public (30 rpm), Basic (200 rpm), Pro (2,000 rpm), Enterprise (10,000 rpm). Header-based API key authentication with per-tier rate limiting.

**Response Envelope** — All responses wrapped in `{ success, data, meta: { timestamp, source, cached, latency_ms } }` for consistent client consumption.

---

## API Reference

> 📖 See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for endpoint details and [docs/API_AUTHENTICATION.md](docs/API_AUTHENTICATION.md) for auth tiers & rate limits.

The full OpenAPI 3.1 specification is available at [openapi.yaml](openapi.yaml).

### Health & Metrics

| Method | Path | Description |
|---|---|---|
| `GET` | `/health` | Health check with cache stats, circuit breaker status, queue stats, WebSocket stats, memory usage |
| `GET` | `/metrics` | Prometheus metrics endpoint |

### Market Data (`/api/market`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/market/prices` | Current prices for top cryptocurrencies |
| `GET` | `/api/market/prices/:id` | Price data for a specific coin |
| `GET` | `/api/market/trending` | Trending coins |
| `GET` | `/api/market/global` | Global market statistics |
| `GET` | `/api/market/dominance` | Market dominance breakdown |
| `GET` | `/api/market/fear-greed` | Fear & Greed Index |
| `GET` | `/api/market/history/:id` | Historical price data |
| `GET` | `/api/market/categories` | Market categories |
| `GET` | `/api/market/top-movers` | Top gainers and losers |
| `GET` | `/api/market/high-volume` | High volume coins |

### DeFi (`/api/defi`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/defi/protocols` | DeFi protocol rankings |
| `GET` | `/api/defi/tvl` | Total Value Locked across DeFi |
| `GET` | `/api/defi/yields` | Yield farming opportunities |
| `GET` | `/api/defi/stablecoins` | Stablecoin analytics |
| `GET` | `/api/defi/chains` | Chain-level DeFi metrics |
| `GET` | `/api/defi/dexes` | DEX volume data |
| `GET` | `/api/defi/bridges` | Bridge volume and TVL |
| `GET` | `/api/defi/liquidations` | Liquidation data |

### News (`/api/news`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/news` | Latest crypto news |
| `GET` | `/api/news/analysis` | AI-analyzed news with sentiment |

### On-Chain (`/api/onchain`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/onchain/gas` | Gas prices (Ethereum) |
| `GET` | `/api/onchain/whale-transactions` | Whale transaction alerts |
| `GET` | `/api/onchain/token-security/:address` | Token security audit |
| `GET` | `/api/onchain/contract-info/:address` | Smart contract information |

### AI & Intelligence (`/api/ai`)

22 AI-powered endpoints for market analysis, portfolio advice, DeFi strategy, risk assessment, and more.

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ai/analyze` | AI market analysis |
| `POST` | `/api/ai/portfolio-advice` | AI portfolio recommendations |
| `POST` | `/api/ai/defi-strategy` | DeFi strategy generation |
| `POST` | `/api/ai/risk-assess` | Risk assessment |
| `POST` | `/api/ai/trading-signals` | AI trading signal analysis |
| `POST` | `/api/ai/sentiment` | Sentiment analysis |
| `POST` | `/api/ai/compare` | Comparative token analysis |
| `POST` | `/api/ai/predict` | Price prediction analysis |
| `POST` | `/api/ai/explain` | Explain crypto concepts |
| `POST` | `/api/ai/news-impact` | News impact analysis |
| `POST` | `/api/ai/whale-analysis` | Whale behavior analysis |
| `POST` | `/api/ai/yield-optimize` | Yield optimization |
| `POST` | `/api/ai/security-audit` | Smart contract security audit |
| `POST` | `/api/ai/gas-optimize` | Gas optimization recommendations |
| `POST` | `/api/ai/narrative` | Market narrative detection |
| `POST` | `/api/ai/correlation` | Cross-asset correlation analysis |
| `POST` | `/api/ai/tokenomics` | Tokenomics analysis |
| `POST` | `/api/ai/chain-compare` | Multi-chain comparison |
| `POST` | `/api/ai/defi-risk-score` | DeFi protocol risk scoring |
| `POST` | `/api/ai/portfolio-rebalance` | Portfolio rebalancing suggestions |
| `POST` | `/api/ai/entry-exit` | Entry/exit point analysis |
| `POST` | `/api/ai/macro-impact` | Macro-economic impact on crypto |

### AI Agents (`/api/agents`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/agents` | List all 58 available agents |
| `GET` | `/api/agents/:agentId` | Get agent details |
| `POST` | `/api/agents/:agentId/invoke` | Invoke an agent with a query |
| `POST` | `/api/agents/multi` | Invoke multiple agents in parallel |
| `POST` | `/api/agents/orchestrate` | Multi-agent orchestration (planner → executor → synthesizer) |
| `GET` | `/api/agents/categories` | Agent categories |
| `GET` | `/api/agents/search` | Search agents |

### CEX Data (`/api/cex`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/cex/orderbook/:symbol` | Order book depth |
| `GET` | `/api/cex/trades/:symbol` | Recent trades |
| `GET` | `/api/cex/ticker/:symbol` | 24h ticker |
| `GET` | `/api/cex/klines/:symbol` | Candlestick data |
| `GET` | `/api/cex/funding/:symbol` | Funding rates |

### DEX Data (`/api/dex`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/dex/trending` | Trending pools |
| `GET` | `/api/dex/new-pairs` | Newly created pairs |
| `GET` | `/api/dex/pools/:network/:address` | Pool details |
| `GET` | `/api/dex/tokens/:network/:address` | Token info from DEXes |
| `GET` | `/api/dex/search` | Search DEX pools |

### Derivatives (`/api/derivatives`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/derivatives/options` | Options market data |
| `GET` | `/api/derivatives/futures` | Futures market data |
| `GET` | `/api/derivatives/open-interest` | Open interest aggregation |
| `GET` | `/api/derivatives/funding-rates` | Cross-exchange funding rates |
| `GET` | `/api/derivatives/liquidations` | Liquidation data |

### Perps (`/api/perps`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/perps/markets` | Perpetual markets overview |
| `GET` | `/api/perps/funding` | Perpetual funding rates |

### Bitcoin (`/api/bitcoin`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/bitcoin/stats` | Bitcoin network statistics |
| `GET` | `/api/bitcoin/mempool` | Mempool status |
| `GET` | `/api/bitcoin/hashrate` | Hash rate data |
| `GET` | `/api/bitcoin/fees` | Fee estimates |
| `GET` | `/api/bitcoin/lightning` | Lightning Network stats |

### Gas (`/api/gas`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/gas/ethereum` | Ethereum gas prices |
| `GET` | `/api/gas/multi-chain` | Multi-chain gas prices |
| `GET` | `/api/gas/history` | Gas price history |

### Governance (`/api/governance`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/governance/proposals` | Active DAO proposals |
| `GET` | `/api/governance/spaces` | Snapshot spaces |
| `GET` | `/api/governance/votes/:id` | Votes for a proposal |

### Macro (`/api/macro`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/macro/indicators` | Macroeconomic indicators (from Yahoo Finance) |
| `GET` | `/api/macro/correlation` | Crypto-macro correlation |

### Solana (`/api/solana`)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/solana/tokens` | Solana token data (via Jupiter) |
| `GET` | `/api/solana/defi` | Solana DeFi metrics |

### Additional Route Domains

| Domain | Path Prefix | Description |
|---|---|---|
| DePIN | `/api/depin` | Decentralized Physical Infrastructure Networks |
| Exchanges | `/api/exchanges` | Exchange rankings and details |
| NFT | `/api/nft` | NFT collections and marketplaces |
| Whales | `/api/whales` | Whale wallet tracking |
| Staking | `/api/staking` | Staking yields and validators |
| Calendar | `/api/calendar` | Crypto events calendar |
| Oracles | `/api/oracles` | Oracle network data |
| Unlocks | `/api/unlocks` | Token unlock schedules |
| ETF | `/api/etf` | Crypto ETF data |
| Portfolio | `/api/portfolio` | Portfolio tracking and analysis |
| Social | `/api/social` | Social metrics and sentiment |
| L2 | `/api/l2` | Layer 2 scaling data (L2Beat) |
| Security | `/api/security` | Token/contract security analysis (GoPlus) |
| Research | `/api/research` | Research reports and analysis |
| Analytics | `/api/analytics` | Platform analytics |
| Ecosystem | `/api/ecosystem` | Ecosystem mapping |
| Aggregate | `/api/aggregate` | Multi-source data aggregation |
| Export | `/api/export` | Data export (CSV, JSON, Parquet) |
| Search | `/api/search` | Semantic search across all data |
| Anomalies | `/api/anomalies` | Anomaly detection alerts |
| News Feed | `/api/news-feed` | Aggregated news feed (12+ sources) |

### WebSocket Endpoints

> 📖 See [docs/WEBSOCKET.md](docs/WEBSOCKET.md) for message schemas, throttling, and client examples.

| Path | Description |
|---|---|
| `/ws/prices` | Real-time price stream (CoinCap, 5Hz throttle) |
| `/ws/bitcoin` | Bitcoin mempool & block updates (Mempool.space) |
| `/ws/trades` | Live DEX trades (DexScreener) |
| `/ws/alerts` | Anomaly detection alerts (real-time) |

---

## Data Sources

> 📖 See [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md) for adapter configuration and rate limit details.

37 adapters in `src/sources/` connect to external APIs:

| Source | File | Data |
|---|---|---|
| **CoinGecko** | `coingecko.ts` | Prices, market data, trending, categories, history |
| **DeFiLlama** | `defillama.ts` | TVL, yields, stablecoins, DEX volumes, bridges |
| **Alternative.me** | `alternative.ts` | Fear & Greed Index |
| **Binance** | `binance.ts` | Order books, trades, klines, ticker, funding |
| **Bybit** | `bybit.ts` | Order books, trades, klines, funding rates |
| **OKX** | `okx.ts` | Order books, trades, klines, funding rates |
| **Deribit** | `deribit.ts` | Options, futures, volatility surface |
| **dYdX** | `dydx.ts` | Perpetual markets, funding rates |
| **Hyperliquid** | `hyperliquid.ts` | Perpetual markets, funding, open interest |
| **CoinCap** | `coincap.ts` | Real-time prices (WebSocket upstream) |
| **CoinGlass** | `coinglass.ts` | Open interest, liquidations, funding |
| **CoinLore** | `coinlore.ts` | Global market stats |
| **CryptoCompare** | `cryptocompare.ts` | Social stats, historical data |
| **GeckoTerminal** | `geckoterminal.ts` | DEX pools, trending pairs, OHLCV |
| **Jupiter** | `jupiter.ts` | Solana token prices, DEX aggregation |
| **L2Beat** | `l2beat.ts` | Layer 2 TVL and risk data |
| **Messari** | `messari.ts` | Fundamental metrics, profiles |
| **Token Terminal** | `tokenterminal.ts` | Revenue, earnings, P/E ratios |
| **Bitcoin/Blockchain** | `bitcoin.ts`, `blockchain.ts` | Network stats, mempool, hashrate |
| **EVM** | `evm.ts` | EVM chain RPC data |
| **GoPlus** | `goplus.ts` | Token security audits |
| **Snapshot** | `snapshot.ts` | Governance proposals, voting |
| **DePin Scan** | `depinscan.ts` | DePIN project data |
| **Yahoo Finance** | `macro.ts` | Macro indicators (DXY, S&P 500, VIX, bonds) |
| **NFT Sources** | `nft.ts` | NFT collections and marketplaces |
| **Oracles** | `oracles.ts` | Chainlink, Band, Pyth data |
| **Social** | `social.ts` | Social metrics |
| **Staking** | `staking.ts` | Staking yields, validators |
| **Unlocks** | `unlocks.ts` | Token unlock schedules |
| **Whales** | `whales.ts` | Whale transaction tracking |
| **Portfolio** | `portfolio.ts` | Portfolio analytics |
| **Calendar** | `calendar.ts`, `coinmarketcal.ts` | Crypto events |
| **News** | `crypto-news.ts`, `news-aggregator.ts` | News from 12+ outlets |
| **ETF** | `etf.ts` | Crypto ETF flow data |

---

## Packages

> 📖 See [docs/PACKAGES.md](docs/PACKAGES.md) for full package API documentation.

Eight packages in `packages/` provide standalone functionality:

### `@nirholas/erc8004-agent-runtime` — [packages/agent-runtime](packages/agent-runtime)

ERC-8004 compliant agent runtime for decentralized AI agents with A2A (Agent-to-Agent) messaging and x402 micropayments.

**Key exports:**
- `ERC8004Agent` — Base agent class with lifecycle management
- `A2AHandler` — Agent-to-Agent communication protocol handler
- `TaskManager` — Task queue management for agent workloads
- `x402Middleware` — HTTP 402 micropayment middleware
- `IdentityManager` — On-chain identity management
- `ReputationManager` — Agent reputation scoring
- `searchAgents`, `connectToAgent` — Agent discovery and connection
- Middleware: `authMiddleware`, `rateLimitMiddleware`, `loggingMiddleware`

**Stack:** TypeScript, Hono, ethers.js, EventEmitter3

### `@nirholas/binance-mcp-server` — [packages/binance-mcp](packages/binance-mcp)

MCP (Model Context Protocol) server for Binance exchange. Provides AI-accessible tools for spot trading, staking, wallet management, NFTs, Binance Pay, and mining.

**Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@binance/*` SDK packages

### `@nirholas/bnbchain-mcp` — [packages/bnbchain-mcp](packages/bnbchain-mcp)

MCP server for BNB Chain with dual support for BSC (EVM smart contracts) and Greenfield (decentralized storage).

**Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@bnb-chain/greenfield-js-sdk`, ethers.js

### `@nirholas/crypto-market-data` — [packages/market-data](packages/market-data)

Standalone crypto market data service, Edge Runtime compatible. Aggregates CoinGecko, DeFiLlama, and Fear & Greed data with built-in caching and rate limiting.

**Stack:** TypeScript, Edge Runtime compatible

### `@crypto-vision/mcp-server` — [packages/mcp-server](packages/mcp-server)

MCP server exposing Crypto Vision intelligence tools to AI models. Includes Solana integration.

**Stack:** TypeScript, `@modelcontextprotocol/sdk`, `@solana/web3.js`

### `@nirholas/pump-agent-swarm` — [packages/pump-agent-swarm](packages/pump-agent-swarm)

Pump.fun agent swarm system with creator agents (token minting), trader agents (automated trading), x402 micropayments, bundle coordination, intelligence gathering, a real-time dashboard, API, and Telegram bot.

**Stack:** TypeScript, Hono, ethers.js, grammy, bullmq, drizzle-orm

### `sweep` — [packages/sweep](packages/sweep)

Multi-chain dust sweeper with DeFi routing. Sweeps small token balances across chains, consolidating them via DEX routes.

**Stack:** TypeScript, Hono, ethers.js, `@solana/web3.js`, bullmq, drizzle-orm

### `abi-to-mcp` (UCAI) — [packages/ucai](packages/ucai)

Universal Contract AI Interface — Python tool that generates MCP servers from Ethereum ABI files. Published on PyPI as `abi-to-mcp`. Web builder at [mcp.ucai.tech](https://mcp.ucai.tech).

**Stack:** Python, `mcp`, web3.py

---

## Apps

Three frontend applications in `apps/`:

### Dashboard — [apps/dashboard](apps/dashboard)

**`crypto-data-aggregator`** — Next.js dashboard for real-time crypto market data visualization. Features DeFi analytics, portfolio tracking, and watchlists.

**Stack:** Next.js, React, TypeScript

### News — [apps/news](apps/news)

**`free-crypto-news`** — Next.js crypto news aggregator with AI-powered analysis. Aggregates 12+ sources with sentiment tracking. Includes MCP integration, mobile app, CLI tool, browser extension, and embeddable widget. README available in 50+ languages.

**Stack:** Next.js, React, TypeScript, MCP

### Video — [apps/video](apps/video)

**`@crypto-vision/video`** — Remotion project for generating x402 Gas Station promotional videos programmatically.

**Stack:** Remotion, React, TypeScript

---

## AI Agents

> 📖 See [docs/AI_AGENTS.md](docs/AI_AGENTS.md) for the full agent catalog and prompt engineering guide.

**58 specialized AI agents** in the `agents/` directory (`@nirholas/ai-agents-library` v1.42.0):

### Agent Categories

| Category | Count | Examples |
|---|---|---|
| **Trading** | 8 | Swing Trader, Position Sizer, MEV Shield, Leverage Calculator |
| **DeFi** | 12 | Yield Farmer, Protocol Comparator, Insurance Advisor, Risk Scoring Engine |
| **Portfolio** | 5 | Portfolio Optimizer, Tax Strategist, Dollar-Cost Averaging |
| **Security** | 4 | Bridge Security Analyst, Rug Pull Detector, Smart Contract Auditor |
| **Education** | 6 | DeFi Onboarding Mentor, APY vs APR Educator, Impermanent Loss Calculator |
| **Research** | 8 | Alpha Leak Detector, Whale Tracker, On-Chain Forensics, Governance Analyst |
| **Ecosystem** | 15 | Sperax-specific agents (SPA Staker, USDs Navigator, Demeter Farmer, etc.) |

### Agent Invocation

```bash
# List all agents
curl http://localhost:8080/api/agents

# Invoke a specific agent
curl -X POST http://localhost:8080/api/agents/defi-yield-farmer/invoke \
  -H "Content-Type: application/json" \
  -d '{"query": "Find the best stablecoin yields above 10% APY"}'

# Multi-agent orchestration
curl -X POST http://localhost:8080/api/agents/orchestrate \
  -H "Content-Type: application/json" \
  -d '{"query": "Analyze ETH risk and suggest a DeFi strategy", "agents": ["defi-risk-scoring-engine", "defi-yield-farmer"]}'
```

### Supported Languages

Agent prompts are translated into 18 languages: English, Spanish, French, German, Portuguese, Italian, Russian, Chinese (Simplified & Traditional), Japanese, Korean, Arabic, Turkish, Hindi, Vietnamese, Thai, Indonesian, Dutch.

---

## Workers & Ingestion

> 📖 See [docs/WORKERS.md](docs/WORKERS.md) for worker configuration, scheduling, and troubleshooting.

15 worker files in `src/workers/` provide background data ingestion:

### Worker Architecture

All workers extend `WorkerBase` which provides:
- **Periodic fetching** with configurable intervals
- **Dual-write** to BigQuery (streaming inserts) and Pub/Sub
- **Exponential backoff** on failures
- **Graceful shutdown** handling
- **Health reporting**

### Available Workers

| Worker | File | Interval | Description |
|---|---|---|---|
| Market Ingest | `ingest-market.ts` | 1-2 min | Prices, market cap, volume from CoinGecko |
| DeFi Ingest | `ingest-defi.ts` | 5 min | TVL, yields, protocol data from DeFiLlama |
| News Ingest | `ingest-news.ts` | 10 min | Crypto news from multiple outlets |
| DEX Ingest | `ingest-dex.ts` | 2 min | DEX trades, pools, trending pairs |
| Derivatives Ingest | `ingest-derivatives.ts` | 2 min | Options, futures, funding rates |
| Governance Ingest | `ingest-governance.ts` | 30 min | DAO proposals, votes |
| Macro Ingest | `ingest-macro.ts` | 1 hour | Macroeconomic indicators |
| On-Chain Ingest | `ingest-onchain.ts` | 5 min | On-chain metrics, gas prices |

### Indexing Workers

| Worker | File | Description |
|---|---|---|
| Agent Indexer | `index-agents.ts` | Indexes AI agents into vector store |
| Governance Indexer | `index-governance.ts` | Indexes governance proposals |
| News Indexer | `index-news.ts` | Indexes news articles for RAG |
| Protocol Indexer | `index-protocols.ts` | Indexes DeFi protocol data |
| Historical Backfill | `backfill-historical.ts` | Backfills historical data |

### Running Workers

```bash
# Via Docker Compose
docker compose -f docker-compose.ingest.yml up

# Individual workers
npm run worker:market
npm run worker:defi
npm run worker:news

# All workers
npm run workers
```

---

## Telegram Bot (crypto vision)

> 📖 See [docs/TELEGRAM_BOT.md](docs/TELEGRAM_BOT.md) for bot commands, configuration, and deployment.

A full-featured Telegram trading bot in `src/bot/` built on the grammy framework.

### Features

- **Trading Calls** — Post buy/sell calls with P&L tracking
- **Leaderboard** — Global and group leaderboards ranked by ROI
- **Hardcore Mode** — Gamified challenge mode with elimination and prizes
- **Portfolio Tracking** — Track positions across tokens
- **PNL Cards** — Visual profit/loss summary cards
- **Insider Alerts** — Smart money movement notifications
- **Premium Tiers** — Subscription-based premium features
- **Referral System** — User referral tracking and rewards
- **Multi-Group Support** — Works across multiple Telegram groups

### Database Schema

PostgreSQL schema at `src/bot/db/schema.ts` (Drizzle ORM) includes tables for:
- Users, groups, channels
- Trading calls with entry/exit prices
- Leaderboard snapshots
- Hardcore mode sessions and participants
- PNL history
- Premium subscriptions
- Referral tracking
- Insider alerts

### Enabling the Bot

```bash
# Set environment variables
SECTBOT_ENABLED=true
BOT_TOKEN=your-telegram-bot-token
DATABASE_URL=postgresql://user:pass@host:5432/sectbot

# The bot starts automatically with the main server
npm run dev
```

---

## Infrastructure

> 📖 See [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) for Terraform modules and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for CI/CD pipelines.

### Google Cloud Platform (GCP)

The primary deployment target is GCP Cloud Run with supporting services:

| Service | Purpose |
|---|---|
| **Cloud Run** | Main API + worker containers |
| **BigQuery** | Data warehouse (22+ tables) |
| **Pub/Sub** | Event messaging (5-tier topic architecture) |
| **Cloud Scheduler** | Cron jobs for workers, retraining |
| **Memorystore (Redis)** | Distributed cache |
| **Secret Manager** | API keys and credentials |
| **Vertex AI** | Embeddings and model training |
| **VPC** | Private networking |

### Terraform

17 Terraform files in `infra/terraform/` define the complete infrastructure:

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```

Key files: `main.tf`, `cloud_run.tf`, `redis.tf`, `bigquery.tf`, `pubsub.tf`, `scheduler.tf`, `secrets.tf`, `network.tf`, `iam.tf`, `monitoring.tf`, `vertex.tf`, `gke-gpu.tf`, `export.tf`, `apis.tf`

### Kubernetes

12 Kubernetes manifests in `infra/k8s/` for GKE deployment:

- `deployment.yaml` — Main API deployment
- `hpa.yaml` — Horizontal Pod Autoscaler
- `redis.yaml` — Redis StatefulSet
- `cronjobs.yaml` — Ingestion worker CronJobs
- `network-policy.yaml` — Network policies
- `training-job.yaml` — ML training Job
- `inference-deployment.yaml` — Model inference serving

### Pub/Sub Topic Architecture

5-tier messaging defined in `infra/pubsub/topics.yaml`:

| Tier | Latency | Topics |
|---|---|---|
| **Realtime** | < 1s | `market-prices-realtime`, `dex-trades-realtime` |
| **Frequent** | 1-2 min | `market-data-frequent`, `dex-pools-frequent` |
| **Standard** | 5-10 min | `defi-metrics-standard`, `news-articles-standard` |
| **Hourly** | 1 hour | `governance-hourly`, `macro-indicators-hourly` |
| **Daily** | 24 hours | `analytics-daily`, `embeddings-daily` |

### CI/CD

Google Cloud Build pipelines:
- `cloudbuild.yaml` — Main API build and deploy
- `cloudbuild-workers.yaml` — Worker containers build and deploy

### Quick Setup

```bash
# Full GCP setup (interactive)
bash infra/setup.sh

# Teardown
bash infra/teardown.sh
```

---

## Training & Fine-Tuning

> 📖 See [docs/TRAINING.md](docs/TRAINING.md) for the full training pipeline guide.

Complete ML pipeline in `scripts/training/`:

### Training Data Generation

```bash
# Generate training data from BigQuery
npx tsx scripts/training/generate-training-data.ts

# Validate generated data
npx tsx scripts/training/validate-data.ts
```

### Gemini Fine-Tuning

```bash
# Fine-tune Gemini via Vertex AI
npx tsx scripts/training/finetune-gemini.ts

# Evaluate fine-tuned models
npx tsx scripts/training/eval-models.ts
```

### Open-Source Model Training

```bash
# Prepare data in Alpaca format
npx tsx scripts/training/opensource/prepare-data.ts

# Train with LoRA (QLoRA 4-bit quantization)
python scripts/training/opensource/train.py

# Benchmark against baselines
python scripts/training/opensource/benchmark.py

# Export to GGUF/ONNX
python scripts/training/opensource/export.py
```

### Inference Serving

```bash
# Serve fine-tuned model with vLLM
python scripts/inference/serve.py

# Health check
python scripts/inference/healthcheck.py
```

Kubernetes resources: `infra/k8s/training-job.yaml`, `infra/k8s/inference-deployment.yaml`

---

## BigQuery Data Warehouse

> 📖 See [docs/BIGQUERY.md](docs/BIGQUERY.md) for schema details, partitioning, and query examples.

22+ tables defined in `infra/bigquery/tables.sql`:

### Table Categories

| Category | Tables |
|---|---|
| **Market** | `market_prices`, `market_global`, `fear_greed_index` |
| **DeFi** | `defi_protocols`, `defi_yields`, `defi_tvl_chains`, `defi_stablecoins`, `dex_pools` |
| **Derivatives** | `derivatives_options`, `derivatives_futures`, `derivatives_funding`, `derivatives_oi` |
| **Blockchain** | `onchain_gas`, `bitcoin_stats`, `bitcoin_mempool` |
| **Governance** | `governance_proposals`, `governance_votes` |
| **News** | `news_articles` |
| **Macro** | `macro_indicators` |
| **AI** | `embeddings`, `search_queries`, `ai_completions` |

### Materialized Views

Defined in `infra/bigquery/views.sql`:
- Hourly/daily price aggregations
- Protocol TVL rankings
- Cross-exchange funding rate comparisons
- Market anomaly summaries

### Data Export

```bash
# Export all BigQuery data
npm run export:all

# Export embeddings
npm run export:embeddings

# Import to PostgreSQL
npm run import:postgres
```

---

## Testing

> 📖 See [docs/TESTING.md](docs/TESTING.md) for test writing guidelines and CI integration.

Comprehensive test suite using Vitest:

### Test Categories

| Type | Location | Count | Description |
|---|---|---|---|
| **Unit** | `tests/lib/` | 33 files | Every core library module |
| **Route** | `tests/routes/` | 10 files | API route handlers |
| **Integration** | `tests/integration/` | 1 file | End-to-end API flows |
| **E2E** | `tests/e2e/` | 1 file | Smoke tests against running server |
| **Benchmarks** | `tests/benchmarks/` | 1 file | Performance benchmarks |
| **Fuzz** | `tests/fuzz/` | 1 file | Fuzz testing for API inputs |
| **Load** | `tests/load/` | 3 files | Load tests (smoke, soak, stress) |

### Running Tests

```bash
# All tests
npm test

# With coverage
npm run test:coverage

# E2E tests (requires running server)
npm run test:e2e

# Specific test file
npx vitest tests/lib/cache.test.ts

# Watch mode
npx vitest --watch
```

### Key Test Files

- `tests/lib/cache.test.ts` — Two-tier cache with stampede protection
- `tests/lib/fetcher.test.ts` — Circuit breaker and retry logic
- `tests/lib/anomaly.test.ts` — Anomaly detection algorithms
- `tests/lib/queue.test.ts` — Bounded concurrency queue
- `tests/lib/auth.test.ts` — API key authentication tiers
- `tests/lib/search.test.ts` — Semantic search and intent detection
- `tests/lib/embeddings.test.ts` — Multi-provider embedding generation
- `tests/lib/rag.test.ts` — RAG pipeline
- `tests/lib/orchestrator.test.ts` — Multi-agent orchestration

---

## Monitoring & Observability

> 📖 See [docs/MONITORING.md](docs/MONITORING.md) for Grafana dashboards, alerting rules, and [docs/ANOMALY_DETECTION.md](docs/ANOMALY_DETECTION.md) for the anomaly detection engine.

### Prometheus Metrics

Available at `/metrics`:

| Metric | Type | Description |
|---|---|---|
| `http_requests_total` | Counter | Total HTTP requests by method, path, status |
| `http_request_duration_seconds` | Histogram | Request latency distribution |
| `upstream_requests_total` | Counter | Upstream API calls by source, status |
| `upstream_request_duration_seconds` | Histogram | Upstream latency |
| `cache_hits_total` / `cache_misses_total` | Counter | Cache hit/miss rates |
| `cache_size` | Gauge | Current cache size |
| `websocket_connections` | Gauge | Active WebSocket connections |
| `queue_size` | Gauge | Current queue depth |
| `queue_concurrency` | Gauge | Active concurrent tasks |
| `circuit_breaker_state` | Gauge | Circuit breaker states per host |

### Structured Logging

Pino-based structured JSON logging with:
- Request ID tracking
- Latency measurement
- Error context
- Configurable log levels via `LOG_LEVEL`

### Health Check

`GET /health` returns:

```json
{
  "status": "healthy",
  "uptime": 3600,
  "cache": { "size": 1500, "hitRate": 0.85 },
  "circuitBreakers": { "coingecko": "CLOSED", "defillama": "CLOSED" },
  "queue": { "pending": 2, "active": 1 },
  "websocket": { "connections": 15 },
  "memory": { "heapUsed": "150MB", "rss": "250MB" }
}
```

---

## Self-Hosting

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md) for the complete self-hosting guide, including:

- Minimal setup (Node.js only, no cloud dependencies)
- Docker deployment
- Full GCP deployment with Terraform
- Scaling and production hardening
- Cost estimation

---

## Performance

See [docs/PERFORMANCE.md](docs/PERFORMANCE.md) for detailed benchmarks and optimization guide, including:

- Response time targets (< 200ms cached, < 2s upstream)
- Cache optimization strategies
- Connection pooling
- Memory management
- Load testing methodology

---

## Project Structure

```
crypto-vision/
├── src/                        # Main application source
│   ├── index.ts                # Entry point — Hono server, middleware, route mounting
│   ├── routes/                 # 40 route modules (market, defi, ai, agents, etc.)
│   ├── sources/                # 37 data source adapters
│   ├── lib/                    # Core libraries (cache, fetcher, queue, auth, anomaly, etc.)
│   ├── workers/                # 15 background ingestion & indexing workers
│   └── bot/                    # Telegram crypto vision (grammy)
│       └── db/schema.ts        # PostgreSQL schema (Drizzle ORM)
├── packages/                   # Standalone packages
│   ├── agent-runtime/          # ERC-8004 agent runtime (A2A + x402)
│   ├── binance-mcp/            # Binance MCP server
│   ├── bnbchain-mcp/           # BNB Chain MCP server
│   ├── market-data/            # Standalone market data service
│   ├── mcp-server/             # Crypto Vision MCP server
│   ├── pump-agent-swarm/       # Pump.fun agent swarm
│   ├── sweep/                  # Multi-chain dust sweeper
│   └── ucai/                   # ABI-to-MCP generator (Python)
├── apps/                       # Frontend applications
│   ├── dashboard/              # Next.js market dashboard
│   ├── news/                   # Next.js crypto news aggregator
│   └── video/                  # Remotion video project
├── agents/                     # 58 AI agents library
│   ├── prompts/                # Agent system prompts
│   ├── locales/                # 18 language translations
│   ├── schema/                 # Agent JSON schemas
│   └── docs/                   # Agent documentation
├── infra/                      # Infrastructure as Code
│   ├── terraform/              # 17 Terraform configs (GCP)
│   ├── k8s/                    # 12 Kubernetes manifests
│   ├── pubsub/                 # Pub/Sub topic definitions
│   ├── bigquery/               # BigQuery schema & views
│   └── scheduler/              # Cloud Scheduler jobs
├── scripts/                    # Operational scripts
│   ├── training/               # ML training pipeline
│   ├── inference/              # Model serving
│   ├── demo/                   # Demo scripts
│   ├── export-all.ts           # BigQuery data export
│   └── import-to-postgres.ts   # PostgreSQL import
├── tests/                      # Comprehensive test suite
│   ├── lib/                    # 33 unit test files
│   ├── routes/                 # 10 route test files
│   ├── e2e/                    # End-to-end smoke tests
│   ├── integration/            # API integration tests
│   ├── benchmarks/             # Performance benchmarks
│   ├── fuzz/                   # Fuzz testing
│   └── load/                   # Load tests (smoke, soak, stress)
├── docs/                       # Documentation
│   ├── AGENTS.md               # 58 AI agents guide
│   ├── API_REFERENCE.md        # Complete 300+ endpoint reference
│   ├── ARCHITECTURE.md         # System architecture & data flow
│   ├── COINGECKO_RATE_LIMITING.md # CoinGecko rate limiting strategy
│   ├── CONFIGURATION.md        # Environment variables reference
│   ├── DATABASE.md             # PostgreSQL & BigQuery schemas
│   ├── DATA_PIPELINE.md        # Workers, ingestion, Pub/Sub
│   ├── DATA_SOURCES.md         # 37+ upstream data sources
│   ├── DEPLOYMENT.md           # Docker, Cloud Run, K8s deployment
│   ├── DEVELOPER_WORKFLOW.md   # Day-to-day dev commands
│   ├── INFRASTRUCTURE.md       # Terraform, K8s, CI/CD
│   ├── ML_TRAINING.md          # Model training & fine-tuning
│   ├── PACKAGES.md             # All 8 packages deep-dive
│   ├── PERFORMANCE.md          # Performance & optimization
│   ├── REPOSITORY_GUIDE.md     # Full repo structure
│   ├── SELF_HOSTING.md         # Self-hosting guide
│   ├── TELEGRAM_BOT.md         # crypto vision documentation
│   ├── TESTING.md              # Test strategy & coverage
│   └── X402_PAYMENTS.md        # x402 micropayment system
├── prompts/                    # Engineering prompt guides
├── docker-compose.yml          # API + Redis stack
├── docker-compose.ingest.yml   # Ingestion workers
├── Dockerfile                  # Main API container
├── Dockerfile.worker           # Worker container
├── Dockerfile.train            # Training container
├── cloudbuild.yaml             # CI/CD — API
├── cloudbuild-workers.yaml     # CI/CD — Workers
├── drizzle.config.ts           # Drizzle ORM config
├── openapi.yaml                # OpenAPI 3.1 specification
├── vitest.config.ts            # Test configuration
└── tsconfig.json               # TypeScript configuration
```

---

## Documentation

Comprehensive documentation is available in the [`docs/`](docs/) directory:

| Document | Description |
|----------|-------------|
| [AGENTS.md](docs/AGENTS.md) | 58 AI agents — categories, architecture, orchestration, localization |
| [ANOMALY_DETECTION.md](docs/ANOMALY_DETECTION.md) | Real-time statistical anomaly detection — 16 event types, algorithms, processors |
| [API_AUTHENTICATION.md](docs/API_AUTHENTICATION.md) | 4-tier API key authentication, rate limiting, key management API |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | Complete 538+ endpoint reference across 40 route modules |
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System architecture, data flow, caching, circuit breakers |
| [COINGECKO_RATE_LIMITING.md](docs/COINGECKO_RATE_LIMITING.md) | CoinGecko API rate limiting strategy and optimization |
| [CONFIGURATION.md](docs/CONFIGURATION.md) | All environment variables, API keys, secrets management |
| [DATABASE.md](docs/DATABASE.md) | PostgreSQL schema (Drizzle ORM) and BigQuery table definitions |
| [DATA_PIPELINE.md](docs/DATA_PIPELINE.md) | Ingestion workers, Pub/Sub tiers, scheduling |
| [DATA_SOURCES.md](docs/DATA_SOURCES.md) | 37+ upstream data source adapters and their capabilities |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Docker, Cloud Run, Kubernetes deployment guides |
| [DEVELOPER_WORKFLOW.md](docs/DEVELOPER_WORKFLOW.md) | Day-to-day development commands and workflows |
| [INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md) | Terraform, GCP resources, K8s manifests, CI/CD pipelines |
| [ML_TRAINING.md](docs/ML_TRAINING.md) | Model fine-tuning (Gemini, Llama, Mistral), GPU training, vLLM inference |
| [MONITORING.md](docs/MONITORING.md) | Prometheus metrics, structured logging, health checks, alerting |
| [PACKAGES.md](docs/PACKAGES.md) | All 8 packages — agent-runtime, MCP servers, market-data, sweep, ucai |
| [PERFORMANCE.md](docs/PERFORMANCE.md) | Benchmarks, optimization techniques, caching strategies |
| [REPOSITORY_GUIDE.md](docs/REPOSITORY_GUIDE.md) | Full repository structure walkthrough |
| [SECURITY_GUIDE.md](docs/SECURITY_GUIDE.md) | Security architecture, threat mitigations, best practices |
| [SELF_HOSTING.md](docs/SELF_HOSTING.md) | Complete self-hosting guide with data migration |
| [TELEGRAM_BOT.md](docs/TELEGRAM_BOT.md) | crypto vision — Telegram bot commands, features, database |
| [TESTING.md](docs/TESTING.md) | Test strategy, coverage, unit/integration/e2e/fuzz/load tests |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues, diagnostics, and solutions |
| [WEBSOCKET.md](docs/WEBSOCKET.md) | Real-time WebSocket feeds — prices, Bitcoin, trades, alerts |
| [X402_PAYMENTS.md](docs/X402_PAYMENTS.md) | x402 micropayment protocol integration |

---

## License

[AGPL-3.0](LICENSE)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines and [SECURITY.md](SECURITY.md) for security policy.

---

*Built with TypeScript, Hono, and an unhealthy obsession with crypto data.*
