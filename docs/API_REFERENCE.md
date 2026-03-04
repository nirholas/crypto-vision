# API Reference

> Complete endpoint reference for the Crypto Vision API. OpenAPI 3.1 spec at [`openapi.yaml`](../openapi.yaml). Live directory at `GET /api`.

## Base URL

```
Production:  https://cryptocurrency.cv
Development: http://localhost:8080
```

## Authentication

Optional API key authentication via header or query parameter:

```
X-API-Key: your-key-here
# or
GET /api/coins?api_key=your-key-here
```

Admin endpoints require an admin key (set via `ADMIN_API_KEYS` env var).

## Response Format

All responses follow a standard envelope:

```json
{
  "data": { ... },
  "meta": {
    "requestId": "uuid",
    "timestamp": "2026-03-04T00:00:00.000Z",
    "cached": true,
    "source": "coingecko"
  },
  "error": null
}
```

Error responses:

```json
{
  "data": null,
  "meta": { "requestId": "uuid", "timestamp": "..." },
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests",
    "status": 429
  }
}
```

## Rate Limiting

**200 requests per minute per IP** on all `/api/*` routes. Redis-backed when available, in-memory otherwise.

Response headers:
```
X-RateLimit-Limit: 200
X-RateLimit-Remaining: 187
X-RateLimit-Reset: 1709510460
```

---

## Meta Endpoints

### `GET /`

API root with version info and links.

### `GET /health`

Health check with system diagnostics.

**Response:**
```json
{
  "status": "ok",
  "uptime": 123456,
  "cache": { "hits": 5000, "misses": 200, "size": 1500 },
  "circuitBreaker": { "state": "closed", "failures": 0 },
  "websocket": { "clients": 42, "messagesPerSecond": 15 },
  "memory": { "heapUsed": 128000000, "rss": 256000000 }
}
```

### `GET /api`

JSON directory of all available endpoints (300+).

### `GET /api/ready`

Kubernetes readiness probe. Returns 200 when ready, 503 when not.

### `GET /metrics`

Prometheus-format metrics (request counts, latencies, error rates, cache stats).

---

## Market Data

### `GET /api/coins`

Top coins ranked by market cap.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vs_currency` | string | `usd` | Target currency |
| `per_page` | number | `100` | Results per page (max 250) |
| `page` | number | `1` | Page number |
| `sparkline` | boolean | `false` | Include 7-day sparkline |
| `price_change_percentage` | string | — | Comma-separated: `1h,24h,7d,14d,30d,200d,1y` |

### `GET /api/coin/:id`

Detailed coin information.

| Parameter | Type | Description |
|---|---|---|
| `id` | path | CoinGecko coin ID (e.g., `bitcoin`, `ethereum`) |

**Response includes:** description, links, market data, developer stats, community data, tickers.

### `GET /api/price`

Quick price lookup for multiple coins.

| Parameter | Type | Description |
|---|---|---|
| `ids` | string | Comma-separated coin IDs: `bitcoin,ethereum,solana` |
| `vs_currencies` | string | Comma-separated currencies: `usd,eur,btc` |

### `GET /api/trending`

Currently trending coins on CoinGecko. No parameters.

### `GET /api/global`

Global cryptocurrency market statistics. No parameters.

**Response includes:** total market cap, 24h volume, BTC/ETH dominance, active coins count.

### `GET /api/chart/:id`

Price chart data for a coin.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `id` | path | — | Coin ID |
| `days` | number | `7` | Chart duration (1, 7, 14, 30, 90, 180, 365, max) |
| `interval` | string | — | `daily` or auto-selected |
| `vs_currency` | string | `usd` | Target currency |

### `GET /api/ohlc/:id`

OHLC candlestick data.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `id` | path | — | Coin ID |
| `days` | number | `7` | Options: 1, 7, 14, 30, 90, 180, 365 |
| `vs_currency` | string | `usd` | Target currency |

### `GET /api/exchanges`

Exchange rankings by trust score.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `per_page` | number | `100` | Results per page (max 250) |
| `page` | number | `1` | Page number |

### `GET /api/categories`

Coin categories with aggregated market data. No parameters.

### `GET /api/fear-greed`

Crypto Fear & Greed Index.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `1` | Number of data points (max 30) |

**Response:**
```json
{
  "value": 75,
  "value_classification": "Greed",
  "timestamp": "1709510400"
}
```

### `GET /api/dex/search`

DEX pair search via DexScreener.

| Parameter | Type | Description |
|---|---|---|
| `q` | string | Search query (token name, symbol, or address) |

---

## DeFi

### `GET /api/defi/protocols`

Top DeFi protocols ranked by TVL.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `100` | Max results |
| `chain` | string | — | Filter by chain (e.g., `Ethereum`, `Solana`) |
| `category` | string | — | Filter by category (e.g., `Dexes`, `Lending`) |

### `GET /api/defi/protocol/:slug`

Protocol detail with per-chain TVL breakdown and 90-day TVL history.

| Parameter | Type | Description |
|---|---|---|
| `slug` | path | Protocol slug (e.g., `aave`, `uniswap`) |

### `GET /api/defi/chains`

All chains ranked by TVL. No parameters.

### `GET /api/defi/chain/:name`

Chain TVL history (last 365 days).

| Parameter | Type | Description |
|---|---|---|
| `name` | path | Chain name (e.g., `Ethereum`, `Solana`) |

### `GET /api/defi/yields`

Yield pools sorted by APY.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `100` | Max results |
| `chain` | string | — | Filter by chain |
| `project` | string | — | Filter by project slug |
| `stablecoin` | boolean | — | Stablecoin pools only |
| `min_tvl` | number | — | Minimum TVL in USD |
| `min_apy` | number | — | Minimum APY percentage |

### `GET /api/defi/stablecoins`

Stablecoins sorted by circulating supply. No parameters.

### `GET /api/defi/dex-volumes`

Top 50 DEXs by volume. No parameters.

### `GET /api/defi/fees`

Top 50 protocols by fees/revenue. No parameters.

### `GET /api/defi/bridges`

Cross-chain bridge volumes. No parameters.

### `GET /api/defi/raises`

Recent crypto funding rounds.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `50` | Max results (max 200) |

---

## News

### `GET /api/news`

Latest crypto news from 12+ RSS sources.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `limit` | number | `20` | Results per page |
| `source` | string | — | Filter by source |
| `category` | string | — | Filter by category |
| `page` | number | `1` | Page number |

### `GET /api/news/search`

Full-text news search.

| Parameter | Type | Description |
|---|---|---|
| `q` | string | Search query |
| `limit` | number | Max results (default 20) |

### `GET /api/news/bitcoin`

Bitcoin-specific news. No parameters.

### `GET /api/news/defi`

DeFi-specific news. No parameters.

### `GET /api/news/breaking`

Breaking news from the last 2 hours. No parameters.

### `GET /api/news/trending`

Trending stories based on cross-source frequency. No parameters.

### `GET /api/news/sources`

Available RSS feed sources and their status. No parameters.

---

## On-Chain

### `GET /api/onchain/gas`

Multi-chain gas prices (Bitcoin, EVM chains).

### `GET /api/onchain/bitcoin/fees`

Bitcoin fee estimates in sat/vB for different confirmation targets.

### `GET /api/onchain/bitcoin/stats`

Bitcoin network statistics (hashrate, difficulty, block height, mempool).

### `GET /api/onchain/token/:address`

Token information by contract address with DEX pair data.

| Parameter | Type | Description |
|---|---|---|
| `address` | path | Token contract address |

### `GET /api/onchain/prices`

Multi-chain token prices via DeFiLlama.

| Parameter | Type | Description |
|---|---|---|
| `coins` | string | Comma-separated `chain:address` pairs (e.g., `ethereum:0x...`) |

---

## AI Intelligence

Requires at least one LLM API key configured. Providers tried in order: Groq → Gemini → OpenAI → Anthropic → OpenRouter.

### `GET /api/ai/sentiment/:coin`

AI-powered sentiment analysis for a specific coin. Cached 5 minutes.

| Parameter | Type | Description |
|---|---|---|
| `coin` | path | Coin name or symbol (e.g., `bitcoin`, `ETH`) |

**Response:**
```json
{
  "coin": "bitcoin",
  "sentiment": "bullish",
  "confidence": 0.82,
  "summary": "...",
  "factors": ["...", "..."],
  "recommendation": "hold",
  "analyzedAt": "2026-03-04T00:00:00.000Z"
}
```

### `GET /api/ai/digest`

Daily market digest. Cached 15 minutes.

### `GET /api/ai/signals`

AI trading signals. Cached 10 minutes.

### `POST /api/ai/ask`

Free-form crypto Q&A with live market context enrichment.

**Request body:**
```json
{
  "question": "Should I buy Solana right now?",
  "context": "optional additional context"
}
```

---

## Search

### `GET /api/search`

Basic search across coins, protocols, and news.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | — | Search query |
| `limit` | number | `10` | Max results |
| `type` | string[] | — | Filter by type: `coin`, `protocol`, `news` |

### `GET /api/search/smart`

AI-powered semantic search with intent classification.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `q` | string | — | Natural language query |
| `limit` | number | `10` | Max results |
| `threshold` | number | `0.7` | Similarity threshold (0-1) |

### `GET /api/search/nlq`

Natural language query with RAG retrieval. Uses embeddings + LLM to answer complex questions.

| Parameter | Type | Description |
|---|---|---|
| `q` | string | Natural language question |

### `GET /api/search/suggest`

Autocomplete suggestions.

| Parameter | Type | Description |
|---|---|---|
| `q` | string | Partial query (min 2 chars) |

---

## Bitcoin

### `GET /api/bitcoin/price`

Bitcoin price from multiple sources.

### `GET /api/bitcoin/stats`

Network statistics: difficulty, hashrate, block height, mempool size.

### `GET /api/bitcoin/mempool`

Mempool analysis: transaction count, fee distribution, size.

### `GET /api/bitcoin/difficulty`

Difficulty adjustment history and next estimated adjustment.

### `GET /api/bitcoin/lightning`

Lightning Network statistics: capacity, nodes, channels.

---

## CEX (Centralized Exchanges)

### `GET /api/cex/tickers`

Aggregated ticker data from Binance, Bybit, OKX.

### `GET /api/cex/orderbook/:symbol`

Order book depth for a trading pair.

### `GET /api/cex/klines/:symbol`

Candlestick data from CEX sources.

---

## Derivatives

### `GET /api/derivatives/funding`

Funding rates across perpetual futures exchanges.

### `GET /api/derivatives/open-interest`

Open interest data across exchanges and pairs.

### `GET /api/derivatives/liquidations`

Recent liquidation events.

### `GET /api/derivatives/long-short`

Long/short ratio analysis.

---

## Perpetuals

### `GET /api/perps/funding-rates`

Cross-exchange perpetual funding rates.

### `GET /api/perps/oi`

Perpetual open interest breakdown.

---

## DEX

### `GET /api/dex/trending`

Trending DEX pairs from GeckoTerminal.

### `GET /api/dex/new`

Recently created DEX pools.

### `GET /api/dex/pools/:chain`

Top pools on a specific chain.

---

## Solana

### `GET /api/solana/tokens`

Top Solana tokens by market cap/volume.

### `GET /api/solana/dex`

Solana DEX statistics and top pairs.

### `GET /api/solana/validators`

Validator statistics and staking yields.

### `GET /api/solana/memecoins`

Solana memecoin data from Jupiter and Pump.fun.

---

## Analytics

### `GET /api/analytics/correlation`

Price correlation matrix between top assets.

### `GET /api/analytics/volatility`

Volatility analysis for major cryptocurrencies.

### `GET /api/analytics/cycles`

Market cycle analysis with historical comparisons.

### `GET /api/analytics/revenue`

Protocol revenue comparison.

---

## Whales

### `GET /api/whales/transactions`

Large transactions across chains.

### `GET /api/whales/accumulation`

Whale accumulation patterns and holdings.

### `GET /api/whales/richlist`

Top holders (Bitcoin, Ethereum).

---

## Staking

### `GET /api/staking/yields`

Staking yields across chains and protocols.

### `GET /api/staking/validators`

Validator performance and rankings (Ethereum, Solana).

### `GET /api/staking/liquid`

Liquid staking protocol comparison (Lido, Rocket Pool, etc.).

---

## Governance

### `GET /api/governance/proposals`

Active and recent governance proposals from Snapshot.

### `GET /api/governance/spaces`

DAO spaces with member counts and voting activity.

---

## NFT

### `GET /api/nft/collections`

Top NFT collections by volume/floor price.

### `GET /api/nft/sales`

Recent notable NFT sales.

---

## Macro

### `GET /api/macro/indices`

Traditional market indices (S&P 500, NASDAQ, DXY) for correlation analysis.

### `GET /api/macro/commodities`

Gold, oil, and commodity prices.

### `GET /api/macro/bonds`

Treasury yield data (10Y, 2Y, spread).

---

## ETF

### `GET /api/etf/bitcoin`

Bitcoin spot ETF data (flows, AUM, premiums).

### `GET /api/etf/ethereum`

Ethereum spot ETF data.

---

## Gas

### `GET /api/gas/ethereum`

Ethereum gas prices (slow, standard, fast).

### `GET /api/gas/multi`

Multi-chain gas price comparison.

---

## Security

### `GET /api/security/token/:address`

Token security audit via GoPlus (honeypot check, ownership, taxes).

### `GET /api/security/phishing`

Known phishing site detection.

---

## Layer 2

### `GET /api/l2/overview`

Layer 2 comparison (TVL, TPS, fees).

### `GET /api/l2/chain/:name`

Specific L2 chain metrics and history.

---

## Portfolio

### `GET /api/portfolio/analysis`

Portfolio risk/return analysis.

### `GET /api/portfolio/allocation`

Optimal allocation suggestions.

---

## Agents

### `GET /api/agents`

List all available AI agents with capabilities.

### `GET /api/agents/:id`

Agent detail with system prompt and supported commands.

### `POST /api/agents/:id/chat`

Chat with a specific AI agent.

**Request body:**
```json
{
  "message": "What are the best yield farms on Solana right now?",
  "history": []
}
```

### `POST /api/agents/orchestrate`

Multi-agent orchestration — routes requests to the best-suited agent.

---

## Calendar

### `GET /api/calendar/events`

Upcoming crypto events (launches, unlocks, upgrades).

---

## Oracles

### `GET /api/oracles/prices`

Oracle price feeds comparison (Chainlink, Pyth, etc.).

---

## Unlocks

### `GET /api/unlocks/upcoming`

Upcoming token unlock schedules.

### `GET /api/unlocks/token/:id`

Token-specific unlock timeline.

---

## Social

### `GET /api/social/trending`

Trending crypto topics across social platforms.

### `GET /api/social/sentiment`

Social media sentiment analysis.

---

## DePIN

### `GET /api/depin/protocols`

DePIN protocol data and metrics.

---

## Anomaly Detection

### `GET /api/anomalies/stream`

Server-Sent Events stream of real-time anomalies.

### `GET /api/anomalies/stats`

Anomaly detection statistics.

---

## Export

### `GET /api/admin/export`

Data export endpoints (requires admin API key).

---

## WebSocket Endpoints

### `ws://host/ws/prices`

Real-time price updates at 5 Hz.

**Subscribe:**
```json
{ "type": "subscribe", "coins": ["bitcoin", "ethereum", "solana"] }
```

**Message:**
```json
{
  "type": "prices",
  "data": {
    "bitcoin": { "price": 95000, "change24h": 2.5 },
    "ethereum": { "price": 3200, "change24h": -0.8 }
  },
  "timestamp": 1709510400000
}
```

### `ws://host/ws/bitcoin`

Bitcoin-specific real-time events (new blocks, fee changes, mempool updates).

### `ws://host/ws/trades`

Live trade stream from connected exchanges.

### `ws://host/ws/status`

System health updates with 10s heartbeat.

---

## Error Codes

| Code | HTTP | Description |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `UPSTREAM_ERROR` | 502 | Upstream API failure (stale cache may be served) |
| `QUEUE_FULL` | 503 | AI request queue at capacity |
| `TIMEOUT` | 504 | Request processing exceeded timeout |
