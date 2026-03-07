# Changelog

All notable changes to the Crypto Vision platform are documented in this file.

This project adheres to [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- **Comprehensive documentation suite** — 25+ documentation files covering architecture, API reference, security, monitoring, troubleshooting, and all subsystems

---

## [0.1.0] — 2025-12-01

### Core Platform
- **Hono HTTP server** with 14 middleware layers (security headers, compression, CORS, rate limiting, auth, timeouts, ETag, request logging, Prometheus metrics, body limits, request ID, timing, response envelope, global error handler)
- **39 route modules** covering 200+ endpoints across 35+ domains
- **37 data source adapters** — CoinGecko, DeFiLlama, Binance, Bybit, OKX, BitMEX, Mempool.space, L2Beat, DexScreener, CoinCap, CoinLore, GoPlusLabs, Etherscan, Alternative.me, and more
- **Two-tier cache** — LRU in-memory (200K entries) + Redis L2 with stampede protection, stale-while-revalidate, and batch eviction
- **Per-host circuit breakers** — 5-failure threshold, 30s reset, exponential backoff with jitter, per-host concurrency limiting
- **Bounded concurrency queues** — AI queue (10 concurrent / 500 max), heavy fetch queue (20 concurrent)
- **Multi-source fallback** with automatic circuit-broken source skipping and degraded route tracking
- **Response envelope** wrapping all API responses in `{ success, data, meta }` format with source attribution
- **26 structured error codes** with HTTP status mapping and production error redaction

### AI & Search
- **7-provider AI fallback chain** — Vertex AI (fine-tuned), Groq, self-hosted vLLM, Gemini, OpenAI, Anthropic, OpenRouter
- **RAG pipeline** — Retrieval-Augmented Generation with configurable top-K, context length, and similarity threshold
- **Embeddings** — Vertex AI (`text-embedding-005`, 768d) and OpenAI (`text-embedding-3-small`, 1536d) with 24h caching
- **Vector store** — BigQuery IVF index (production) and in-memory cosine similarity (development)
- **Unified search** — Intent detection → multi-source search → merge/deduplicate/rank → suggestions

### Real-Time
- **4 WebSocket topics** — Prices (CoinCap, 5Hz throttled), Bitcoin (Mempool.space), DEX trades (DexScreener), Anomaly alerts
- **Redis Pub/Sub** fan-out for multi-instance deployments
- **Automatic reconnection** with exponential backoff and heartbeat/ping-pong

### Anomaly Detection
- **16 anomaly types** — Price spikes/crashes, volume surges/drops, TVL drains, gas spikes, whale movements, stablecoin depegs, funding rates, open interest, exchange flows, correlation breaks, volatility
- **Modified Z-Score (MAD)** for outlier-robust detection
- **EWMA trending** with configurable decay factor
- **Per-type cooldowns** to prevent alert fatigue
- **SSE streaming** and WebSocket broadcast for real-time alerts
- **State persistence** for crash recovery

### Authentication & Security
- **4-tier API authentication** — Public (30 rpm), Basic (200 rpm), Pro (2K rpm), Enterprise (10K rpm)
- **Sliding-window rate limiting** with Redis Lua script + in-memory fallback
- **Dynamic key management** via admin API (create/delete/list)
- **Security headers** — HSTS, CSP, X-Frame-Options, X-Content-Type-Options
- **Timing-safe comparison** for API key validation
- **Input validation** via Zod schemas on all endpoints

### Telegram Bot
- **30+ commands** — `/price`, `/portfolio`, `/alert`, `/news`, `/defi`, `/ai`, etc.
- **Portfolio tracking** with P&L, allocation, and performance analytics
- **Price alerts** with configurable thresholds
- **AI-powered analysis** for any cryptocurrency
- **PostgreSQL persistence** via Drizzle ORM
- **Grammy framework** with session management

### Data Pipeline
- **Worker-based ingestion** — IngestionWorker base class with dual-write (BigQuery + Pub/Sub)
- **18 BigQuery tables** and **7 materialized views**
- **5-tier Pub/Sub** — real-time (30s), standard (5m), batch (1h), daily, weekly
- **Exponential backoff** on worker failures (up to 16× multiplier)
- **Graceful shutdown** with SIGTERM/SIGINT handling

### Observability
- **Prometheus metrics** — HTTP, upstream, cache, queue, circuit breaker, WebSocket metrics at `/metrics`
- **Structured JSON logging** via Pino with slow request warnings (>5s)
- **Health endpoint** with comprehensive system status at `/health`
- **Server-Timing header** on all responses

### Infrastructure
- **Docker** — Multi-stage builds for API, workers, and training
- **Docker Compose** — Full local development stack with Redis, PostgreSQL, workers
- **Kubernetes** — Production manifests for GKE deployment
- **Terraform** — GCP infrastructure as code (Cloud Run, BigQuery, Pub/Sub, Scheduler, Artifact Registry)
- **Cloud Build** — CI/CD pipelines for API and workers

### Packages

- **@nirholas/market-data** — Unified market data SDK
- **@nirholas/agent-runtime** — AI agent execution runtime
- **@nirholas/mcp-server** — Model Context Protocol server
- **@nirholas/binance-mcp** — Binance MCP integration
- **@nirholas/bnbchain-mcp** — BNB Chain MCP integration
- **@nirholas/sweep** — Code sweep utilities
- **@nirholas/ucai** — Universal Crypto AI interface

### Apps
- **Dashboard** — Next.js analytics dashboard
- **News** — Crypto news aggregator
- **Video** — Video content platform

### Agents
- **100+ AI agents** — Specialized crypto analysis agents with i18n support (9 languages)
- **Agent marketplace** — Registry with manifest, templates, and documentation
- **MCP integration** — Agents accessible via Model Context Protocol

### Testing
- **Vitest** unit and integration tests
- **E2E tests** with real API integration
- **Load tests** and benchmarks
- **Fuzz testing** for input validation
- **OpenAPI-driven route tests**
