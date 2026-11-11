---
name: crypto-vision-api
description: Run the Crypto Vision REST API locally and query its market, DeFi, news, gas and on-chain endpoints with curl. Use when an agent needs aggregated crypto prices, protocol TVL, headlines or chain data from a server the user controls.
---

# Crypto Vision API (self-hosted)

Crypto Vision is a TypeScript (Hono) server that aggregates CoinGecko, DeFiLlama, DexScreener, RSS news and other free sources behind one REST API. There is no MCP server in this repo's root and no published npm package: you run the API from a clone. The public site `cryptocurrency.cv` is a separate deployment with a different route set, so do not assume these paths exist there.

## Run it

Requires Node.js 22 or newer.

```bash
git clone https://github.com/nirholas/crypto-vision && cd crypto-vision
npm install
cp .env.example .env     # every key is optional
npm run dev              # http://localhost:8080
```

Production build: `npm run build && npm start`. Check it with `curl -s localhost:8080/health`. `PORT` changes the port. Optional upstream keys include `COINGECKO_API_KEY`, `ETHERSCAN_API_KEY`, `CRYPTOCOMPARE_API_KEY`; the AI routes need at least one of `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY`. Keep keys in `.env`, never in chat.

## Auth

Requests with no key run on the `public` tier. Send `X-API-Key: <key>` or `Authorization: Bearer <key>` for a configured key (`API_KEYS` in `.env`).

## Endpoints (from `src/routes`)

Market (under `/api`): `/coins` (`page`, `per_page`, `order`, `ids`, `category`, `sparkline`), `/coin/:id`, `/price?ids=bitcoin,ethereum&vs_currencies=usd`, `/trending`, `/global`, `/search?q=`, `/chart/:id`, `/ohlc/:id`, `/categories`, `/fear-greed`, `/gainers`, `/losers`, `/high-volume`, `/compare`, `/dominance`, `/market-overview`, `/dex/search`.

DeFi: `/api/defi/protocols`, `/api/defi/protocol/{slug}`, `/api/defi/chains`, `/api/defi/yields`, `/api/defi/stablecoins`, `/api/defi/dex-volumes`, `/api/defi/fees`, `/api/defi/bridges`, `/api/defi/raises`.

News: `/api/news` (`limit` up to 100, `source`, `category`, `page`), `/api/news/search?q=`, `/api/news/breaking`, `/api/news/trending`, `/api/news/bitcoin`, `/api/news/defi`, `/api/news/sources`.

On-chain and gas: `/api/gas` (multi-chain), `/api/gas/:chain`, `/api/onchain/gas`, `/api/onchain/bitcoin/fees`, `/api/onchain/bitcoin/stats`, `/api/onchain/token/:address`, `/api/onchain/tvl`.

AI (needs an LLM key): `/api/ai/sentiment/{coin}`, `/api/ai/digest`, `/api/ai/signals`, `/api/ai/ask`.

Other route groups mounted in `src/index.ts`: `/api/cex`, `/api/derivatives`, `/api/solana`, `/api/dex`, `/api/security`, `/api/whales`, `/api/governance`, `/api/macro`, `/api/etf`, `/api/unlocks`, `/api/search`, `/api/anomalies`. The machine-readable spec is `openapi.yaml`; WebSocket feeds are under `/ws`.

## Worked example

```bash
curl -s "localhost:8080/api/price?ids=bitcoin,solana&vs_currencies=usd"
curl -s "localhost:8080/api/defi/protocols" | head -c 500
curl -s "localhost:8080/api/news/search?q=etf&limit=5"
```

Responses are JSON with a `data` field and a `timestamp`. Upstream free APIs rate-limit, so cache results and say when data is stale or an upstream failed. This API is read-only market data: it does not trade or move funds.
