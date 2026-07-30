# crypto-vision examples

The complete cryptocurrency intelligence API - https://nirholas.github.io/crypto-vision/

## Example 1

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

## Example 2

```bash
# Build and run the main API server
docker build -t crypto-vision .
docker run -p 8080:8080 --env-file .env crypto-vision

# Or use Docker Compose for full stack (API + Redis)
docker compose up
```

## Example 3

```bash
# Start ingestion workers (market, defi, news, dex, derivatives, governance, macro, onchain)
docker compose -f docker-compose.ingest.yml up
```

## Example 4

```text
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

## Example 5

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

## Example 6

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

## Example 7

```bash
# Set environment variables
SECTBOT_ENABLED=true
BOT_TOKEN=your-telegram-bot-token
DATABASE_URL=postgresql://user:pass@host:5432/sectbot

# The bot starts automatically with the main server
npm run dev
```

## Example 8

```bash
cd infra/terraform
terraform init
terraform plan
terraform apply
```


Every snippet above is taken from the [repository documentation](https://github.com/nirholas/crypto-vision#readme).
