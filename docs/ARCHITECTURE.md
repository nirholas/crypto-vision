# Architecture

> System architecture for the `crypto-vision` monorepo — a comprehensive cryptocurrency intelligence platform.

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Monorepo Structure](#monorepo-structure)
4. [Core API Service](#core-api-service)
5. [Data Pipeline](#data-pipeline)
6. [AI & Intelligence Layer](#ai--intelligence-layer)
7. [Agent System](#agent-system)
8. [Pump Agent Swarm](#pump-agent-swarm)
9. [Frontend Applications](#frontend-applications)
10. [Infrastructure](#infrastructure)
11. [Inter-Service Communication](#inter-service-communication)
12. [Security Architecture](#security-architecture)

---

## System Overview

Crypto Vision is a multi-layered cryptocurrency intelligence platform comprising:

- **Core API** — Hono-based REST API aggregating data from 37+ upstream sources
- **Data Pipeline** — ingestion workers that normalize and warehouse market/DeFi/news data into BigQuery
- **AI Layer** — multi-provider LLM integration (Groq, Gemini, OpenAI, Anthropic, OpenRouter) with RAG, embeddings, and fine-tuned models
- **Agent System** — 43 specialized DeFi AI agents accessible via REST API
- **Pump Agent Swarm** — autonomous multi-agent swarm for Solana Pump.fun token lifecycle
- **MCP Servers** — Model Context Protocol servers exposing Binance, BNB Chain, and crypto intelligence tools to AI assistants
- **Frontend Apps** — Next.js dashboard, news aggregator, and Remotion video renderer
- **Infrastructure** — Terraform, Kubernetes, Cloud Run, BigQuery, Pub/Sub on GCP (portable to self-hosted)

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│  Dashboard (Next.js)  │  News App  │  Telegram Bot  │  MCP AI   │
└──────────┬────────────┴─────┬──────┴───────┬────────┴─────┬─────┘
           │                  │              │              │
           ▼                  ▼              ▼              ▼
┌──────────────────────────────────────────────────────────────────┐
│                     CORE API (Hono)                              │
│  ┌─────────┐ ┌──────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌────────┐  │
│  │ Market  │ │ DeFi │ │ News │ │OnChain │ │  AI  │ │ Agents │  │
│  │ Routes  │ │Routes│ │Routes│ │ Routes │ │Routes│ │ Routes │  │
│  └────┬────┘ └──┬───┘ └──┬───┘ └───┬────┘ └──┬───┘ └───┬────┘  │
│       │         │        │         │         │         │        │
│  ┌────▼─────────▼────────▼─────────▼────┐ ┌──▼───┐ ┌───▼────┐  │
│  │          Source Adapters (37+)        │ │ LLM  │ │ Agent  │  │
│  │  CoinGecko, DeFiLlama, GeckoTerminal │ │Chain │ │Runtime │  │
│  │  Binance, OKX, Bybit, Hyperliquid    │ │      │ │        │  │
│  │  mempool.space, Snapshot, GoPlus...   │ │      │ │        │  │
│  └────────────────┬─────────────────────┘ └──┬───┘ └───┬────┘  │
│                   │                          │         │        │
│  ┌────────────────▼──────────────────────────▼─────────▼────┐   │
│  │                  MIDDLEWARE LAYER                          │   │
│  │  Rate Limiter │ Auth │ Cache │ Metrics │ Circuit Breaker  │   │
│  └────────────────┬──────────────────────────────────────────┘   │
└───────────────────┼──────────────────────────────────────────────┘
                    │
    ┌───────────────┼───────────────────────┐
    ▼               ▼                       ▼
┌────────┐   ┌───────────┐          ┌────────────┐
│ Redis  │   │ BigQuery  │          │ Vector DB  │
│ Cache  │   │ Warehouse │          │ Embeddings │
└────────┘   └───────────┘          └────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                    INGESTION WORKERS                              │
│  market │ defi │ news │ dex │ derivatives │ onchain │ governance │
│  └──────►  Pub/Sub  ──────►  BigQuery (22 tables)                │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│                  PUMP AGENT SWARM (Solana)                        │
│  Creator │ Trader │ Scanner │ Sniper │ Market Maker │ Volume     │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Bundle Engine (Jito) │ Intelligence │ Coordination      │    │
│  │  Dashboard (WebSocket) │ x402 Payments │ Anti-Detection  │    │
│  └──────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## Monorepo Structure

```
crypto-vision/
├── src/                         # Core API service
│   ├── index.ts                 # Hono app entry — middleware + 37 route modules
│   ├── routes/                  # 38 route modules (market, defi, news, ai, etc.)
│   ├── sources/                 # 37 upstream data source adapters
│   ├── lib/                     # Shared infrastructure (cache, auth, fetcher, etc.)
│   ├── bot/                     # Crypto Vision Telegram bot
│   └── workers/                 # 8 ingestion + 4 indexing workers
├── apps/
│   ├── dashboard/               # Next.js crypto dashboard
│   ├── news/                    # Next.js news aggregator
│   └── video/                   # Remotion video renderer
├── packages/
│   ├── pump-agent-swarm/        # Autonomous Pump.fun agent swarm (62k LOC)
│   ├── agent-runtime/           # ERC-8004 agent runtime + A2A + x402
│   ├── binance-mcp/             # Binance MCP server
│   ├── bnbchain-mcp/            # BNB Chain MCP server
│   ├── market-data/             # Market data SDK (CoinGecko, DeFiLlama)
│   ├── mcp-server/              # Crypto intelligence MCP server
│   ├── sweep/                   # Multi-chain dust sweeper
│   └── ucai/                    # Universal Crypto AI (Python + TypeScript)
├── agents/                      # 43 DeFi AI agent definitions + i18n
├── infra/                       # Terraform, K8s, Pub/Sub, BigQuery, Scheduler
├── prompts/                     # Implementation prompt library
├── scripts/                     # Export, import, training, inference scripts
├── tests/                       # Unit, integration, E2E, fuzz, load, benchmark
└── docs/                        # Architecture, deployment, testing, guides
```

---

## Core API Service

### Entry Point

`src/index.ts` initializes the Hono application with a comprehensive middleware stack applied in order:

1. **Request ID** — unique `x-request-id` header per request
2. **Timing** — `x-response-time` server timing header
3. **Security Headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
4. **Compression** — gzip/brotli response compression
5. **CORS** — configurable origin allowlist
6. **API Key Auth** — optional `x-api-key` header authentication
7. **Rate Limiting** — 200 req/min per IP on `/api/*`
8. **Request Timeout** — 30s API / 60s AI endpoints
9. **ETag Caching** — conditional GET support
10. **Response Envelope** — standardized `{ data, meta, error }` format
11. **Structured Logging** — pino JSON logs with request context
12. **Prometheus Metrics** — request count, latency histograms, error rates

### Route Architecture

Routes are organized by domain (`/api/{domain}/`) with each route module handling:

- Request validation (Zod schemas)
- Source adapter calls with circuit breaker protection
- Cache-first strategy (Redis or in-memory LRU)
- Standardized error responses

| Domain | Routes | Sources |
|--------|--------|---------|
| Market | coins, price, trending, global, chart, OHLC, exchanges, categories, fear-greed | CoinGecko, Alternative.me |
| DeFi | protocols, yields, stablecoins, DEX volumes, fees, bridges, raises | DeFiLlama |
| News | articles, search, bitcoin, defi, breaking, trending, sources | RSS (130+ feeds) |
| On-Chain | gas, bitcoin fees/stats, token lookup, prices | mempool.space, Etherscan, DeFiLlama |
| AI | sentiment, digest, signals, ask | Groq, Gemini, OpenAI, Anthropic, OpenRouter |
| Agents | list, detail, chat, multi-agent | 43 agent definitions + LLM |
| Bitcoin | price, stats, mempool, difficulty, lightning, miners | mempool.space, Blockchain.info |
| CEX | Binance, Bybit, OKX tickers, orderbooks, klines | Direct exchange APIs |
| DEX | GeckoTerminal pools, trending, new pools, search | GeckoTerminal |
| Perps | funding rates, open interest, liquidations | Bybit, OKX, Hyperliquid, dYdX, Deribit |
| Derivatives | aggregate funding, OI, long/short ratios | Multi-exchange |
| Security | token audit, honeypot check, phishing detection | GoPlus |
| Solana | tokens, DEX, validators, staking, NFTs, memecoins | Jupiter, Solana RPC |
| Staking | ETH validators, liquid staking, yields | Rated.network, DeFiLlama |
| Governance | proposals, votes, spaces | Snapshot |
| Macro | indices, commodities, bonds, VIX, DXY | Yahoo Finance |
| ETF | BTC/ETH spot ETF data, flows, premiums | Yahoo Finance |
| NFT | collections, marketplace volume | Reservoir, CoinGecko |
| Whales | rich lists, large transfers | Blockchair, Blockchain.info |
| Social | LunarCrush, CryptoCompare, Fear & Greed | LunarCrush, CryptoCompare |
| Analytics | correlation, volatility, L2 comparison, revenue | Multi-source aggregate |
| Anomaly | SSE streaming, stats, config | Internal detection engine |
| Search | semantic search, NL query, autocomplete | Embeddings + LLM |

### Source Adapters

Each source adapter in `src/sources/` follows a consistent pattern:

```typescript
// Cached fetch with circuit breaker
const data = await fetchWithCache('cache-key', () => 
  safeFetch('https://api.external.com/endpoint'),
  { ttl: 300 }
);
```

Key properties:
- **Circuit breaker** — opens after 5 consecutive failures, half-opens after 30s
- **Retry with exponential backoff** — 3 attempts, 1s/2s/4s delays
- **TTL caching** — source-specific cache durations (30s to 1h)
- **Graceful degradation** — stale cache served when upstream fails

### WebSocket Feeds

Three WebSocket endpoints provide real-time data:

| Endpoint | Source | Throttle |
|----------|--------|----------|
| `/ws/prices` | CoinCap | 5 Hz (200ms batches) |
| `/ws/bitcoin` | mempool.space | Pass-through |
| `/ws/trades` | Exchange streams | 5 Hz |

---

## Data Pipeline

### Ingestion Architecture

```
Cloud Scheduler (7 jobs)
    │
    ▼
Pub/Sub Topics (8)
    │
    ├──► ingest-market     ──► market_snapshots table
    ├──► ingest-defi       ──► defi_protocols, yield_pools
    ├──► ingest-news       ──► news_articles
    ├──► ingest-dex        ──► dex_pairs
    ├──► ingest-derivatives ──► derivatives_snapshots
    ├──► ingest-onchain    ──► gas_prices, bitcoin_network
    ├──► ingest-governance ──► governance_proposals
    └──► ingest-macro      ──► macro_indicators
```

### BigQuery Schema (22 tables)

| Category | Tables |
|----------|--------|
| Market | market_snapshots, ohlc_candles, exchange_snapshots |
| DeFi | defi_protocols, yield_pools, chain_tvl, stablecoin_supply, funding_rounds |
| News | news_articles |
| On-Chain | gas_prices, bitcoin_network |
| Derivatives | derivatives_snapshots |
| Governance | governance_proposals |
| Whale | whale_movements |
| AI/ML | embeddings, training_pairs, eval_results, agent_interactions |
| Analytics | anomaly_events, search_analytics |

### Embedding Pipeline

```
Source Data ──► Chunk ──► Embed (text-embedding-004) ──► Vector Store
                                                           │
                                    Semantic Search ◄──────┘
                                    RAG Retrieval   ◄──────┘
```

---

## AI & Intelligence Layer

### Multi-Provider LLM Chain

Providers are tried in priority order with automatic failover:

```
Request ──► Groq (fastest) ──► Gemini ──► OpenAI ──► Anthropic ──► OpenRouter
```

Each provider call includes:
- Token budget management
- Response validation
- Latency tracking
- Automatic retry on rate limits

### AI Capabilities

| Feature | Implementation |
|---------|---------------|
| Sentiment Analysis | Market data context + LLM classification |
| Daily Digest | Multi-source aggregation + LLM summarization |
| Trading Signals | Technical indicators + LLM interpretation |
| Free-form Q&A | RAG retrieval + live market enrichment + LLM |
| Agent Chat | System prompts + domain context + LLM |
| Anomaly Detection | Statistical analysis + LLM explanation |

### Fine-Tuned Models

- **Gemini** — fine-tuned on crypto Q&A pairs via Vertex AI
- **Open-source** — LoRA adapters trained on domain data (Mistral/Llama base)
- **Quantized** — GPTQ 4-bit models for self-hosted inference

---

## Agent System

### 43 DeFi AI Agents

Each agent is defined as a JSON specification in `agents/src/` with:

- System prompt with domain expertise
- Supported commands/capabilities
- Model preferences
- Internationalization (43 locale directories)

Agent categories:
- **Yield & DeFi**: yield-farmer, yield-dashboard-builder, yield-sustainability-analyst, apy-vs-apr-educator
- **Risk & Security**: smart-contract-auditor, bridge-security-analyst, liquidation-risk-manager, wallet-security-advisor, mev-protection-advisor
- **Analysis**: crypto-news-analyst, narrative-trend-analyst, protocol-revenue-analyst, protocol-treasury-analyst
- **Portfolio**: portfolio-rebalancing-advisor, impermanent-loss-calculator, crypto-tax-strategist
- **Infrastructure**: gas-optimization-expert, layer2-comparison-guide, governance-proposal-analyst
- **Sperax-specific**: 9 agents for the Sperax ecosystem
- **Trading**: whale-watcher, airdrop-hunter, alpha-leak-detector, token-unlock-tracker

### Agent Runtime

The `packages/agent-runtime` implements:
- **ERC-8004** compliant agent identification
- **A2A Protocol** — agent-to-agent JSON-RPC messaging
- **x402 Micropayments** — HTTP 402 payment middleware for paid agent capabilities
- **Discovery** — agent registry and capability advertisement

---

## Pump Agent Swarm

The `packages/pump-agent-swarm` is a 62,000+ LOC autonomous trading system for Solana's Pump.fun platform.

### Architecture

```
┌─────────────────────────────────────────────────┐
│              SWARM ORCHESTRATOR                  │
│  State Machine │ Phase Controller │ EventBus    │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ Creator  │ │ Scanner  │ │ Narrative Agent  │ │
│  │  Agent   │ │  Agent   │ │ (AI branding)    │ │
│  └────┬─────┘ └────┬─────┘ └────────┬─────────┘ │
│       │            │                │            │
│  ┌────▼────────────▼────────────────▼─────────┐ │
│  │           BUNDLE ENGINE (Jito)              │ │
│  │  Coordinator │ Validator │ Anti-Detection   │ │
│  │  Launch Sequencer │ Supply Distributor      │ │
│  └────────────────────┬───────────────────────┘ │
│                       │                          │
│  ┌────────────────────▼───────────────────────┐ │
│  │            TRADING ENGINE                   │ │
│  │  ┌────────┐ ┌─────────┐ ┌───────────────┐  │ │
│  │  │ Trader │ │ Sniper  │ │ Market Maker  │  │ │
│  │  │ Agent  │ │ Agent   │ │    Agent      │  │ │
│  │  └────┬───┘ └────┬────┘ └───────┬───────┘  │ │
│  │       │          │              │           │ │
│  │  Volume │ Accumulator │ Exit │ Wash Engine  │ │
│  │  P&L Tracker │ Position Manager │ Gas Opt   │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │           INTELLIGENCE LAYER                │ │
│  │  Strategy Brain │ Risk Manager │ Signals    │ │
│  │  Sentiment │ Trend │ Market Regime │ Alpha  │ │
│  │  Token Evaluator │ Narrative Gen │ Portfolio│ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │           COORDINATION LAYER                │ │
│  │  Messenger │ Consensus │ Tasks │ Lifecycle  │ │
│  │  Health │ Phase │ Rollback │ Audit │ Config  │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │       DASHBOARD (Hono + WebSocket)          │ │
│  │  Agent Monitor │ P&L │ Trades │ Supply     │ │
│  │  Timeline │ Alerts │ Export │ API Routes    │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Agent Types (10)

| Agent | Role |
|-------|------|
| Creator | Mints new tokens on Pump.fun bonding curve |
| Scanner | Scans for token launch opportunities |
| Trader | Executes buy/sell strategies |
| Sniper | Fast-entry on new token listings |
| Market Maker | Maintains spreads and inventory |
| Volume | Generates organic-looking trading volume |
| Accumulator | Gradual position accumulation |
| Exit | Strategic position unwinding |
| Sentinel | Threat monitoring and safety checks |
| Narrative | AI-driven token branding and marketing |

### Key Subsystems

- **Bundle Engine** — Jito block engine integration for atomic multi-wallet transactions
- **Anti-Detection** — wallet fingerprint diversity, timing randomization, amount obfuscation
- **Intelligence** — 10 modules: sentiment analysis, risk scoring, market regime classification, signal generation, portfolio optimization
- **x402 Payments** — inter-agent micropayments via HTTP 402
- **Real-time Dashboard** — WebSocket-based monitoring with P&L, trade visualization, supply charts

---

## Frontend Applications

### Dashboard (`apps/dashboard`)

- **Framework**: Next.js with TypeScript
- **Features**: Real-time market data, DeFi analytics, portfolio tracking, watchlists
- **API**: Consumes the Core API REST endpoints
- **Docs**: `apps/dashboard/docs/` (architecture, design system, development, security, x402 integration)

### News (`apps/news`)

- **Framework**: Next.js with TypeScript
- **Features**: 130+ RSS feed aggregation, AI analysis, sentiment tracking, i18n
- **Tooling**: Playwright E2E, Storybook, accessibility auditing, RAG ingest pipeline
- **Docs**: `apps/news/docs/` (contributing, security, MCP server, API reference)

### Video (`apps/video`)

- **Framework**: Remotion
- **Purpose**: Programmatic video rendering for x402/agent explainer content
- **Outputs**: MP4 and GIF

---

## Infrastructure

### Compute

| Component | Runtime | Scaling |
|-----------|---------|---------|
| Core API | Cloud Run | 2–500 instances, 2Gi RAM, 4 CPU |
| Ingestion Workers | Cloud Run Jobs | 8 workers, scheduled by Cloud Scheduler |
| Telegram Bot | Embedded in API process | — |
| Pump Swarm | Standalone Node.js / Docker | Manual |

### Storage

| System | Usage | Self-Hosted Alternative |
|--------|-------|------------------------|
| BigQuery | Data warehouse (22 tables) | PostgreSQL / DuckDB / ClickHouse |
| Redis 7 | Cache + shared state (256MB LRU + AOF) | Redis / KeyDB |
| PostgreSQL 16 | Bot database (Drizzle ORM) | Any PostgreSQL |
| Cloud Storage | Export artifacts | MinIO / S3 |

### CI/CD

Cloud Build pipeline (`cloudbuild.yaml`):

```
Install ──► Typecheck + Lint + Test (parallel) ──► Build ──► Push Image
    ──► Canary Deploy (5%) ──► Health Check ──► Promote to 100%
```

### Observability

| Layer | Tool |
|-------|------|
| Logging | Pino (structured JSON) → stdout → Cloud Logging |
| Metrics | prom-client → `/metrics` → Prometheus/Grafana |
| Health | `/health` endpoint with source-level degradation |
| Tracing | Request ID propagation via `x-request-id` |
| Alerts | Cloud Monitoring (GCP) or Grafana Alertmanager |

---

## Inter-Service Communication

### Internal EventBus

The pump-agent-swarm uses `eventemitter3` for typed pub/sub:

```typescript
eventBus.emit('trade:executed', { agent, tx, pnl });
eventBus.emit('phase:changed', { from, to });
eventBus.emit('risk:alert', { level, message });
```

### A2A Protocol

Agent-to-agent communication via JSON-RPC over HTTP:

```
Agent A ──► POST /a2a ──► Agent B
             │
             ├── method: "task/send"
             ├── params: { task, input }
             └── result: { output, artifacts }
```

### x402 Micropayments

HTTP 402-based payment flow:

```
Client ──► Request ──► 402 Payment Required (price, payTo, network)
       ──► Pay on-chain ──► Retry with payment proof header
       ──► 200 OK (service rendered)
```

---

## Security Architecture

See [Security Guide](SECURITY_GUIDE.md) for the full security deep-dive.

Key security measures:

- **API Authentication** — API key validation on all `/api/*` routes (see [API Authentication](API_AUTHENTICATION.md))
- **Rate Limiting** — Sliding-window, tier-based (30-10,000 rpm), Redis Lua script + in-memory fallback
- **Input Validation** — Zod schema validation on all request parameters
- **Security Headers** — CSP, HSTS, X-Frame-Options, X-Content-Type-Options
- **Secret Management** — environment variables, GCP Secret Manager in production
- **No Secret Logging** — structured logs exclude sensitive fields
- **Error Redaction** — upstream provider names and internal details never leak to clients
- **Token Security** — GoPlus integration for honeypot/phishing detection
- **Wallet Security** — encrypted key storage, role-based wallet isolation (pump-agent-swarm)
- **Anti-Detection** — wallet fingerprint diversity to prevent Sybil detection (pump-agent-swarm)

---

## Further Reading

| Topic | Document |
|---|---|
| API endpoints and response formats | [API Reference](API_REFERENCE.md) |
| Authentication and rate limits | [API Authentication](API_AUTHENTICATION.md) |
| Anomaly detection engine | [Anomaly Detection](ANOMALY_DETECTION.md) |
| WebSocket real-time feeds | [WebSocket](WEBSOCKET.md) |
| Prometheus metrics and logging | [Monitoring](MONITORING.md) |
| Security architecture | [Security Guide](SECURITY_GUIDE.md) |
| Data sources and adapters | [Data Sources](DATA_SOURCES.md) |
| Background workers | [Data Pipeline](DATA_PIPELINE.md) |
| BigQuery warehouse | [Database](DATABASE.md) |
| Package documentation | [Packages](PACKAGES.md) |
| ML training pipeline | [ML Training](ML_TRAINING.md) |
| Infrastructure setup | [Infrastructure](INFRASTRUCTURE.md) |
| Deployment guide | [Deployment](DEPLOYMENT.md) |
| Configuration reference | [Configuration](CONFIGURATION.md) |
| Testing guide | [Testing](TESTING.md) |
| Telegram bot | [Telegram Bot](TELEGRAM_BOT.md) |
| Self-hosting | [Self Hosting](SELF_HOSTING.md) |
| Performance tuning | [Performance](PERFORMANCE.md) |
| Troubleshooting | [Troubleshooting](TROUBLESHOOTING.md) |
