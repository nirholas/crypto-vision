# Crypto Vision

> **The complete cryptocurrency intelligence API** — [cryptocurrency.cv](https://cryptocurrency.cv)

A unified, high-performance API that aggregates data from CoinGecko, DeFiLlama, DexScreener, Mempool.space, CoinPaprika, CoinCap, and more — with AI-powered analysis on top.

## Quick Start

```bash
# Install
npm install

# Copy env and configure API keys
cp .env.example .env

# Dev server (hot reload)
npm run dev

# Production build
npm run build && npm start
```

The server starts on `http://localhost:8080`. Hit `/api` for the full endpoint reference.

## API Endpoints

### Market Data
| Endpoint | Description |
|---|---|
| `GET /api/coins` | Top coins by market cap |
| `GET /api/coin/:id` | Coin detail |
| `GET /api/price?ids=bitcoin,ethereum&vs=usd` | Simple price lookup |
| `GET /api/trending` | Trending coins |
| `GET /api/global` | Global market stats |
| `GET /api/search?q=...` | Search coins |
| `GET /api/chart/:id?days=7` | Price chart data |
| `GET /api/ohlc/:id?days=7` | OHLC candles |
| `GET /api/exchanges` | Exchange rankings |
| `GET /api/categories` | Coin categories |
| `GET /api/fear-greed` | Fear & Greed Index |
| `GET /api/dex/search?q=...` | DEX token search |

### DeFi
| Endpoint | Description |
|---|---|
| `GET /api/defi/protocols` | Top DeFi protocols by TVL |
| `GET /api/defi/protocol/:slug` | Protocol detail + TVL history |
| `GET /api/defi/chains` | Chain TVL rankings |
| `GET /api/defi/chain/:name` | Chain TVL history |
| `GET /api/defi/yields` | Top yield opportunities |
| `GET /api/defi/stablecoins` | Stablecoin market data |
| `GET /api/defi/dex-volumes` | DEX volume rankings |
| `GET /api/defi/fees` | Protocol fee rankings |
| `GET /api/defi/bridges` | Bridge volume data |
| `GET /api/defi/raises` | Recent funding raises |

### News
| Endpoint | Description |
|---|---|
| `GET /api/news` | Latest crypto news |
| `GET /api/news/search?q=...` | Search news |
| `GET /api/news/bitcoin` | Bitcoin news |
| `GET /api/news/defi` | DeFi news |
| `GET /api/news/breaking` | Breaking news |
| `GET /api/news/trending` | Trending stories |
| `GET /api/news/sources` | News sources |

### On-Chain
| Endpoint | Description |
|---|---|
| `GET /api/onchain/gas` | Multi-chain gas prices |
| `GET /api/onchain/bitcoin/fees` | Bitcoin fee estimates |
| `GET /api/onchain/bitcoin/stats` | Bitcoin network stats |
| `GET /api/onchain/token/:address` | Token info by address |
| `GET /api/onchain/prices` | Multi-chain token prices |

### AI Intelligence
| Endpoint | Description |
|---|---|
| `GET /api/ai/sentiment/:coin` | AI sentiment analysis |
| `GET /api/ai/digest` | AI daily market digest |
| `GET /api/ai/signals` | AI trading signals |
| `POST /api/ai/ask` | Ask AI about crypto |

## Architecture

```
src/
├── index.ts            # Hono app entry point
├── lib/
│   ├── logger.ts       # Structured logging (pino)
│   ├── cache.ts        # Two-tier cache (memory LRU + Redis)
│   ├── fetcher.ts      # Hardened HTTP client with retries
│   ├── rate-limit.ts   # IP-based rate limiting middleware
│   ├── ai.ts           # AI/LLM abstraction (Gemini + OpenAI)
│   └── api-error.ts    # Standardized error responses
├── sources/
│   ├── coingecko.ts    # CoinGecko adapter
│   ├── defillama.ts    # DeFiLlama adapter
│   └── alternative.ts  # CoinPaprika, CoinCap, DexScreener, Mempool
├── routes/
│   ├── market.ts       # Market data endpoints
│   ├── defi.ts         # DeFi endpoints
│   ├── news.ts         # News proxy endpoints
│   ├── onchain.ts      # On-chain data endpoints
│   └── ai.ts           # AI intelligence endpoints
upstream/                # Code from existing repos for reference/integration
```

## Stack

- **Runtime**: Node.js 22+
- **Framework**: [Hono](https://hono.dev) — ultra-fast, edge-ready
- **Language**: TypeScript 5.7 (strict)
- **Cache**: In-memory LRU + Redis (GCP Memorystore)
- **Logging**: pino (structured JSON)
- **Infra**: Docker → GCP Cloud Run ($110k credits)
- **AI**: Google Gemini / OpenAI for market intelligence

## Deploy

```bash
# Docker
npm run docker:build
npm run docker:run

# GCP Cloud Run (via Cloud Build)
gcloud builds submit --config cloudbuild.yaml .
```

## Data Sources

All **free-tier** compatible — no paid API keys required for core functionality:

| Source | Data | Rate Limit |
|---|---|---|
| CoinGecko | Market data, prices, charts | 30 req/min (free) |
| DeFiLlama | TVL, yields, volumes, fees | Unlimited |
| CoinPaprika | Market data fallback | 20 req/min |
| CoinCap | Real-time prices | 200 req/min |
| DexScreener | DEX token data | 60 req/min |
| Mempool.space | Bitcoin on-chain | Generous |
| alternative.me | Fear & Greed Index | Unlimited |

## License

MIT
