# Configuration

> Complete environment variable reference for the Crypto Vision monorepo.

## Quick Start

```bash
cp .env.example .env
# Edit .env with your API keys
```

Only `PORT` has a default — everything else is optional. The API works with zero configuration (fetches directly from free upstream APIs).

---

## Server & Runtime

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `PORT` | `8080` | No | HTTP server listen port |
| `NODE_ENV` | `development` | No | Runtime environment (`development` / `production`) |
| `LOG_LEVEL` | `info` | No | Pino log level: `trace` / `debug` / `info` / `warn` / `error` / `fatal` |
| `CORS_ORIGINS` | `""` (all) | No | Comma-separated allowed CORS origins |
| `SHUTDOWN_TIMEOUT_MS` | `15000` | No | Graceful shutdown timeout in milliseconds |
| `SECTBOT_ENABLED` | `false` | No | Enable Telegram bot on startup |
| `CRYPTO_VISION_ENABLED` | — | No | Alternative flag to enable bot on startup |

---

## Cache & Database

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `REDIS_URL` | — | No | Redis connection URL. Falls back to in-memory LRU cache |
| `CACHE_MAX_ENTRIES` | `200000` | No | Max in-memory LRU cache entries |
| `DATABASE_URL` | — | Bot only | PostgreSQL connection string for Telegram bot |
| `UPSTASH_REDIS_REST_URL` | — | No | Upstash KV REST URL (dashboard) |
| `UPSTASH_REDIS_REST_TOKEN` | — | No | Upstash KV REST token (dashboard) |
| `KV_REST_API_URL` | — | No | Vercel KV REST URL (news app) |
| `KV_REST_API_TOKEN` | — | No | Vercel KV REST token (news app) |

---

## Authentication & Rate Limiting

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `API_KEYS` | `""` | No | Comma-separated API keys with optional tier: `key1:basic,key2:pro` |
| `ADMIN_API_KEYS` | `""` | No | Comma-separated admin keys for privileged endpoints |
| `ADMIN_API_KEY` | — | No | Single admin key (dashboard/news apps) |
| `RATE_LIMIT_RPM` | `200` | No | Requests per minute per IP on `/api/*` routes |
| `INTERNAL_API_KEY` | — | No | Internal service-to-service authentication |
| `CRON_SECRET` | — | No | Secret for cron endpoint authentication |

### Tier System

API keys can have tiers appended with `:` separator:

```env
API_KEYS=abc123:basic,def456:pro,ghi789:enterprise
```

| Tier | Rate Limit | Features |
|------|-----------|----------|
| `public` | 200 req/min | Basic endpoints only |
| `basic` | 500 req/min | All standard endpoints |
| `pro` | 2000 req/min | All endpoints + AI + premium |
| `enterprise` | Unlimited | All endpoints + priority |

---

## Circuit Breaker & Concurrency

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `CB_FAILURE_THRESHOLD` | `5` | No | Consecutive failures to open circuit breaker |
| `CB_RESET_MS` | `30000` | No | Milliseconds before half-open probe |
| `FETCH_CONCURRENCY_PER_HOST` | `10` | No | Max concurrent HTTP requests per upstream host |
| `AI_CONCURRENCY` | `50` | No | Max concurrent AI inference requests |
| `AI_MAX_QUEUE` | `2000` | No | Max queued AI requests before rejecting |
| `HEAVY_FETCH_CONCURRENCY` | `40` | No | Max concurrent heavy fetch operations |

---

## Market Data API Keys

All optional — the API functions without them using free-tier endpoints, but API keys provide higher rate limits and additional data.

| Variable | Source | Purpose |
|----------|--------|---------|
| `COINGECKO_API_KEY` | [CoinGecko](https://www.coingecko.com/en/api) | Market data, coin details, charts, trending |
| `COINGECKO_PRO` | — | Set `true` to use Pro base URL (`pro-api.coingecko.com`) |
| `COINCAP_API_KEY` | [CoinCap](https://docs.coincap.io/) | Real-time WebSocket price feed |
| `COINGLASS_API_KEY` | [CoinGlass](https://coinglass.com/pricing) | Derivatives, open interest, liquidations, ETF flows |
| `CRYPTOCOMPARE_API_KEY` | [CryptoCompare](https://min-api.cryptocompare.com/) | Social metrics, historical data |
| `CRYPTOPANIC_API_KEY` | [CryptoPanic](https://cryptopanic.com/developers/api/) | Sentiment-tagged news feed |
| `MESSARI_API_KEY` | [Messari](https://messari.io/api) | Research, protocol metrics |
| `TOKENTERMINAL_API_KEY` | [Token Terminal](https://tokenterminal.com/api) | Protocol revenue and earnings |
| `COINMARKETCAL_API_KEY` | [CoinMarketCal](https://coinmarketcal.com/en/api) | Crypto calendar events |
| `ETHERSCAN_API_KEY` | [Etherscan](https://etherscan.io/apis) | Ethereum on-chain data, contract verification |
| `OWLRACLE_API_KEY` | [Owlracle](https://owlracle.info/docs) | Multi-chain gas fee oracle |
| `RESERVOIR_API_KEY` | [Reservoir](https://docs.reservoir.tools/) | NFT marketplace data |
| `BLOCKCHAIR_API_KEY` | [Blockchair](https://blockchair.com/api) | Multi-chain whale tracking |
| `BEACONCHAIN_API_KEY` | [beaconcha.in](https://beaconcha.in/api/v1/docs/) | ETH beacon chain staking data |
| `RATED_API_KEY` | [Rated.network](https://docs.rated.network/) | Validator staking analytics |
| `LUNARCRUSH_API_KEY` | [LunarCrush](https://lunarcrush.com/developers) | Social analytics (Galaxy Score) |
| `WHALE_ALERT_API_KEY` | [Whale Alert](https://whale-alert.io/) | Large transaction tracking |
| `CRYPTOQUANT_API_KEY` | [CryptoQuant](https://cryptoquant.com/) | On-chain analytics |
| `GLASSNODE_API_KEY` | [Glassnode](https://glassnode.com/) | On-chain metrics |
| `SANTIMENT_API_KEY` | [Santiment](https://santiment.net/) | Social/on-chain analytics |
| `SOLANA_RPC_URL` | — | Custom Solana RPC endpoint (default: mainnet-beta) |

---

## AI / LLM Providers

The AI engine uses a multi-provider fallback chain. Configure at least one provider for AI features:

```
Groq (fastest) → Gemini → OpenAI → Anthropic → OpenRouter (last resort)
```

| Variable | Provider | Default Model | Purpose |
|----------|----------|---------------|---------|
| `GROQ_API_KEY` | [Groq](https://console.groq.com/) | `llama-3.3-70b-versatile` | Fastest inference (tried first) |
| `GROQ_MODEL` | — | `llama-3.3-70b-versatile` | Model override |
| `GEMINI_API_KEY` | [Google AI](https://ai.google.dev/) | `gemini-2.0-flash` | Google's multimodal model |
| `OPENAI_API_KEY` | [OpenAI](https://platform.openai.com/) | `gpt-4o-mini` | OpenAI inference + embeddings |
| `OPENAI_MODEL` | — | `gpt-4o-mini` | Model override |
| `OPENAI_PROXY_URL` | — | — | Custom API base URL (proxy) |
| `ANTHROPIC_API_KEY` | [Anthropic](https://console.anthropic.com/) | `claude-3-haiku-20240307` | Anthropic inference |
| `ANTHROPIC_MODEL` | — | `claude-3-haiku-20240307` | Model override |
| `OPENROUTER_API_KEY` | [OpenRouter](https://openrouter.ai/) | `meta-llama/llama-3-8b-instruct` | Multi-model gateway (last resort) |
| `OPENROUTER_MODEL` | — | `meta-llama/llama-3-8b-instruct` | Model override |
| `AI_PROVIDER` | — | `groq` | Force specific provider: `groq` / `openai` / `anthropic` |
| `AI_MODEL` | — | — | Force specific model name |

### Self-Hosted Models

| Variable | Default | Description |
|----------|---------|-------------|
| `SELF_HOSTED_URL` | — | vLLM inference server URL (e.g., `http://gpu-node:8000/v1`) |
| `VERTEX_FINETUNED_MODEL` | `crypto-vision-v1` | Vertex AI fine-tuned model name |
| `VERTEX_ACCESS_TOKEN` | — | Vertex AI access token |

---

## GCP Infrastructure

Required only for BigQuery data pipeline and Cloud Run deployment.

| Variable | Default | Description |
|----------|---------|-------------|
| `GCP_PROJECT_ID` | — | Google Cloud project ID |
| `GOOGLE_CLOUD_PROJECT` | — | GCP project ID (fallback) |
| `GCP_REGION` | `us-central1` | GCP region for services |
| `BQ_DATASET` | `crypto_vision` | BigQuery dataset name |
| `BQ_MAX_BYTES` | `1000000000` | BigQuery max bytes billed per query (safety limit, 1 GB) |
| `EXPORT_BUCKET` | `{project}-exports` | GCS bucket for data exports |
| `PUBSUB_EMULATOR_HOST` | — | Pub/Sub emulator host for local dev |

---

## Telegram Bot

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | — | Yes (for bot) | Bot token from [@BotFather](https://t.me/BotFather) |
| `DATABASE_URL` | — | Yes (for bot) | PostgreSQL connection string |
| `SECTBOT_ENABLED` | `false` | No | Enable bot on server startup |
| `TELEGRAM_CHAT_ID` | — | No | Target chat for notifications |
| `TELEGRAM_CHAT_IDS` | — | No | Comma-separated chat IDs (news) |
| `TELEGRAM_ALLOWED_CHAT_IDS` | — | No | Comma-separated permitted chat IDs (pump swarm) |

---

## x402 Micropayments

| Variable | Default | Description |
|----------|---------|-------------|
| `X402_NETWORK` | `eip155:84532` | EIP-155 chain identifier |
| `X402_PAY_TO_ADDRESS` | — | Wallet address to receive payments |
| `X402_PAYMENT_ADDRESS` | — | Payment address (news health check) |
| `X402_FACILITATOR_URL` | `https://x402.org/facilitator` | Facilitator service URL |
| `X402_PRIVATE_KEY` | — | Private key for x402 signing (agents) |

---

## Email & Notifications

| Variable | Default | Description |
|----------|---------|-------------|
| `RESEND_API_KEY` | — | [Resend](https://resend.com/) email service |
| `VAPID_PUBLIC_KEY` | — | VAPID public key for web push notifications |
| `VAPID_PRIVATE_KEY` | — | VAPID private key for web push notifications |
| `DISCORD_BOT_TOKEN` | — | Discord bot token |
| `DISCORD_WEBHOOK_URL` | — | Discord webhook URL for alerts |
| `SLACK_WEBHOOK_URL` | — | Slack webhook URL for alerts |

---

## Stripe Billing (News App)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature secret |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Pro monthly plan price ID |
| `STRIPE_PRO_YEARLY_PRICE_ID` | Pro yearly plan price ID |
| `STRIPE_ENTERPRISE_MONTHLY_PRICE_ID` | Enterprise monthly plan price ID |
| `STRIPE_ENTERPRISE_YEARLY_PRICE_ID` | Enterprise yearly plan price ID |
| `STRIPE_API_USAGE_METER_ID` | Metered billing: API usage |
| `STRIPE_AI_USAGE_METER_ID` | Metered billing: AI inference |
| `STRIPE_WEBHOOK_USAGE_METER_ID` | Metered billing: webhooks |
| `STRIPE_EXPORT_USAGE_METER_ID` | Metered billing: data exports |

---

## Newsletter Integrations (News App)

| Variable | Description |
|----------|-------------|
| `BUTTONDOWN_API_KEY` | Buttondown newsletter API key |
| `CONVERTKIT_API_KEY` | ConvertKit API key |
| `CONVERTKIT_FORM_ID` | ConvertKit form ID |
| `MAILCHIMP_API_KEY` | Mailchimp API key |
| `MAILCHIMP_LIST_ID` | Mailchimp list/audience ID |

---

## Pump Agent Swarm

| Variable | Default | Description |
|----------|---------|-------------|
| `SOLANA_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `SOLANA_WS_URL` | — | Solana WebSocket URL |
| `MASTER_WALLET_KEY` | — | Swarm master wallet (base58 / mnemonic) |
| `NFT_STORAGE_API_KEY` | — | NFT.Storage API key (token metadata) |
| `WEB3_STORAGE_API_KEY` | — | Web3.Storage API key |
| `STABILITY_API_KEY` | — | Stability AI for image generation |
| `ANALYTICS_API_URL` | — | Analytics data source URL |
| `TRADER_COUNT` | `3` | Number of trader agents to spawn |
| `STRATEGY` | `organic` | Swarm strategy: `organic` / `volume` / `graduation` / `exit` |
| `DEV_BUY_SOL` | `0.5` | Dev buy amount in SOL |

---

## ML Training

| Variable | Default | Description |
|----------|---------|-------------|
| `HUGGING_FACE_HUB_TOKEN` | — | HuggingFace token for gated models (Llama) |
| `GCS_BUCKET` | — | GCS bucket for model weight storage |
| `WANDB_API_KEY` | — | Weights & Biases experiment tracking |
| `CUDA_VISIBLE_DEVICES` | *(all)* | GPU selection for training/inference |

---

## Social Signals (Archive Scripts)

| Variable | Default | Description |
|----------|---------|-------------|
| `REDDIT_CLIENT_ID` | — | Reddit OAuth client ID |
| `REDDIT_CLIENT_SECRET` | — | Reddit OAuth client secret |
| `X_AUTH_TOKEN` | — | X (Twitter) authentication token |
| `FEATURE_MARKET` | `true` | Enable market data collection |
| `FEATURE_ONCHAIN` | `true` | Enable on-chain data collection |
| `FEATURE_SOCIAL` | `true` | Enable social data collection |
| `FEATURE_PREDICTIONS` | `true` | Enable prediction collection |

---

## Frontend / Next.js

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_APP_URL` | `https://cryptocurrency.cv` | Public-facing app URL |
| `NEXT_PUBLIC_BASE_URL` | `https://cryptocurrency.cv` | Base URL for API calls |
| `NEXT_PUBLIC_API_URL` | — | API URL for proxy/fetch calls |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | — | WalletConnect project ID (sweep frontend) |
| `EXCHANGE_ENCRYPTION_KEY` | — | Encryption key for exchange API secrets |
| `WS_ENDPOINT` | — | WebSocket server endpoint URL |
| `GOOGLE_SITE_VERIFICATION` | — | Google Search Console verification token |

---

## Minimal `.env` for Development

```env
PORT=8080
LOG_LEVEL=debug

# At least one AI provider for AI features
GROQ_API_KEY=your-groq-key

# Optional but recommended
COINGECKO_API_KEY=your-coingecko-key
REDIS_URL=redis://localhost:6379
```

## Full `.env` for Production

See `.env.example` at the repository root for the complete template, or use Secret Manager via Terraform (`infra/terraform/secrets.tf`).
