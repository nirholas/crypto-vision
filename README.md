# Crypto Vision

> **The complete cryptocurrency intelligence API** — [cryptocurrency.cv](https://cryptocurrency.cv)

Hono-based TypeScript API aggregating data from CoinGecko, DeFiLlama, CoinPaprika, DexScreener, RSS feeds, and LLM providers into a single, high-performance endpoint.

## Quick Start

```bash
npm install
cp .env.example .env   # configure API keys
npm run dev             # start dev server with hot reload
```

The server starts on `http://localhost:8080`.

## API Routes

| Prefix | Area | Examples |
|---|---|---|
| `/api/` | Market data | coins, prices, trending, charts, OHLC, exchanges |
| `/api/defi/` | DeFi | protocols, yields, stablecoins, DEX volumes, fees, bridges |
| `/api/news/` | News | crypto news aggregation from RSS feeds |
| `/api/onchain/` | On-chain | gas prices, Bitcoin stats, token info |
| `/api/ai/` | AI intelligence | sentiment, digests, signals, Q&A |

## Environment Variables

See [.env.example](.env.example) for the full list of required and optional environment variables.

## Tech Stack

- [Hono](https://hono.dev) — ultra-fast HTTP framework
- TypeScript (strict)
- ioredis — Redis caching
- pino — structured JSON logging
- zod — runtime validation
- undici — HTTP client

## Upstream References

This project was ported from and informed by the following repositories. They are **reference material used during development, no longer vendored**:

- <https://github.com/agentix-labs/agenti>
- <https://github.com/nicholasgriffintn/free-crypto-news>

## License

MIT
