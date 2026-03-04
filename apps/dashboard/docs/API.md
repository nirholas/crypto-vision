# API Reference

Complete API documentation for Crypto Data Aggregator.

All endpoints are prefixed with `/api/` and return JSON responses.

> **📖 Interactive Documentation**: Try the [Swagger UI](/docs/swagger) for interactive API exploration with "Try it out" functionality.

> **📥 OpenAPI Spec**: Download the [OpenAPI 3.1 specification](/api/v2/openapi.json) for code generation.

---

## Table of Contents

- [Quick Start](#quick-start)
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [API v2 (Recommended)](#api-v2-recommended)
  - [Coins](#v2-coins)
  - [Global Market](#v2-global)
  - [DeFi](#v2-defi)
  - [Gas Prices](#v2-gas)
  - [Trending](#v2-trending)
  - [Search](#v2-search)
  - [Volatility](#v2-volatility)
  - [Ticker](#v2-ticker)
- [Legacy API v1](#legacy-api-v1)
- [Market Data](#market-data)
  - [Get Coins](#get-coins)
  - [Get Coin Snapshot](#get-coin-snapshot)
  - [Get Historical Prices](#get-historical-prices)
  - [Get OHLC Data](#get-ohlc-data)
  - [Search Coins](#search-coins)
  - [Compare Coins](#compare-coins)
  - [Get Tickers](#get-tickers)
  - [Get Social Data](#get-social-data)
- [Categories](#categories)
  - [List Categories](#list-categories)
  - [Get Category Coins](#get-category-coins)
- [Exchanges](#exchanges)
  - [List Exchanges](#list-exchanges)
  - [Get Exchange Details](#get-exchange-details)
- [DeFi](#defi)
  - [Get Protocols](#get-protocols)
  - [Get DeFi Market](#get-defi-market)
- [Trending & Sentiment](#trending--sentiment)
  - [Get Trending](#get-trending)
  - [Get Sentiment](#get-sentiment)
- [Charts](#charts)
  - [Get Chart Data](#get-chart-data)
- [Portfolio](#portfolio)
  - [Get Portfolio](#get-portfolio)
  - [Add Holding](#add-holding)
  - [Remove Holding](#remove-holding)
- [Premium API (x402)](#premium-api-x402)
  - [AI Analysis](#ai-analysis)
  - [Whale Tracking](#whale-tracking)
  - [Advanced Screener](#advanced-screener)
  - [Access Passes](#access-passes)
- [Response Formats](#response-formats)
- [Error Handling](#error-handling)

---

## Quick Start

```bash
# Get top coins - no API key needed!
curl https://crypto-data-aggregator.vercel.app/api/v2/coins

# Get Bitcoin price
curl https://crypto-data-aggregator.vercel.app/api/v2/coin/bitcoin

# Get global market data
curl https://crypto-data-aggregator.vercel.app/api/v2/global

# Search for coins
curl "https://crypto-data-aggregator.vercel.app/api/v2/search?query=eth"
```

---

## Authentication

The API supports two authentication methods for premium endpoints.

### Free Endpoints

Public endpoints like `/api/news`, `/api/market/*`, and `/api/trending` require **no
authentication**.

### Premium Endpoints

Premium endpoints (`/api/v1/*` and `/api/premium/*`) require authentication:

#### Method 1: API Key

Get a free API key at [/developers](https://free-crypto-news.vercel.app/developers).

```bash
# Header (recommended)
curl -H "X-API-Key: cda_free_xxxxx" \
  https://free-crypto-news.vercel.app/api/v1/coins

# Query parameter
curl "https://free-crypto-news.vercel.app/api/v1/coins?api_key=cda_free_xxxxx"
```

#### Method 2: x402 Micropayments

Pay-per-request using USDC on Base network. No subscription required.

```bash
# Request returns 402 with payment requirements
curl -i https://free-crypto-news.vercel.app/api/v1/coins
# Response: 402 Payment Required
# Header: X-PAYMENT-REQUIRED: <base64-encoded-requirements>

# Send payment header
curl -H "X-PAYMENT: <base64-encoded-payment>" \
  https://free-crypto-news.vercel.app/api/v1/coins
```

See [AUTHENTICATION.md](AUTHENTICATION.md) for detailed documentation.

---

## Rate Limiting

All API v2 endpoints include rate limiting with informative headers.

### Rate Limit Headers

Every response includes:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1706054400000
```

### Rate Limit Tiers

| Tier       | Requests/Min | Requests/Day | Price     |
| ---------- | ------------ | ------------ | --------- |
| Free       | 30           | 1,000        | $0        |
| API Key    | 60           | 10,000       | Free      |
| Pro        | 300          | Unlimited    | $29/month |
| x402       | Unlimited    | Unlimited    | Per-call  |

### Rate Limit Response

When rate limited, you'll receive:

```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60
}
```

---

## API v2 (Recommended)

The v2 API is our latest, most stable API with consistent response formats, rate limiting, and OpenAPI documentation.

**Base URL**: `https://crypto-data-aggregator.vercel.app/api/v2`

### V2 Endpoints Overview

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| `GET /api/v2/coins` | List coins with market data | 30/min |
| `GET /api/v2/coin/:id` | Single coin details | 30/min |
| `GET /api/v2/global` | Global market statistics | 30/min |
| `GET /api/v2/defi` | DeFi protocol rankings | 30/min |
| `GET /api/v2/gas` | Multi-chain gas prices | 60/min |
| `GET /api/v2/trending` | Trending cryptocurrencies | 30/min |
| `GET /api/v2/search` | Search coins | 30/min |
| `GET /api/v2/volatility` | Volatility metrics | 30/min |
| `GET /api/v2/ticker` | Real-time ticker data | 60/min |
| `GET /api/v2/historical/:id` | Historical OHLCV data | 30/min |

### V2 Coins

Get list of coins with market data.

```bash
GET /api/v2/coins?limit=50&order=market_cap_desc
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Results per page (max 250) |
| `order` | string | `market_cap_desc` | Sort order |
| `category` | string | - | Filter by category |

**Response:**

```json
{
  "success": true,
  "data": {
    "coins": [
      {
        "id": "bitcoin",
        "symbol": "btc",
        "name": "Bitcoin",
        "current_price": 95000,
        "market_cap": 1850000000000,
        "market_cap_rank": 1,
        "price_change_24h": 2.5
      }
    ],
    "total": 100
  },
  "meta": {
    "endpoint": "/api/v2/coins",
    "timestamp": "2026-01-24T12:00:00Z"
  }
}
```

### V2 Global Market

Get global cryptocurrency market statistics.

```bash
GET /api/v2/global
```

**Response:**

```json
{
  "success": true,
  "data": {
    "market": {
      "total_market_cap": 3500000000000,
      "total_volume_24h": 150000000000,
      "btc_dominance": 52.5,
      "active_cryptocurrencies": 15000,
      "market_cap_change_24h": 1.2
    },
    "sentiment": {
      "value": 45,
      "classification": "Fear",
      "timestamp": "2026-01-24T12:00:00Z"
    }
  }
}
```

### V2 DeFi

Get DeFi protocol rankings by TVL.

```bash
GET /api/v2/defi?limit=50&category=lending
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 50 | Results (max 100) |
| `category` | string | - | Filter by category |

### V2 Gas Prices

Get multi-chain gas prices.

```bash
GET /api/v2/gas?network=all
```

**Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `network` | string | `all` | `ethereum`, `bitcoin`, or `all` |

**Response:**

```json
{
  "success": true,
  "data": {
    "ethereum": {
      "slow": 15,
      "standard": 20,
      "fast": 30
    },
    "bitcoin": {
      "slow": 5,
      "standard": 10,
      "fast": 20
    },
    "units": {
      "ethereum": "gwei",
      "bitcoin": "sat/vB"
    }
  }
}
```

### V2 Search

Search for cryptocurrencies.

```bash
GET /api/v2/search?query=ethereum
```

### V2 Volatility

Get volatility and risk metrics.

```bash
GET /api/v2/volatility?ids=bitcoin,ethereum,solana
```

**Response:**

```json
{
  "success": true,
  "data": {
    "metrics": [
      {
        "id": "bitcoin",
        "volatility30d": 45.2,
        "sharpeRatio": 1.2,
        "maxDrawdown": -15.3,
        "beta": 1.0,
        "riskLevel": "medium"
      }
    ],
    "summary": {
      "averageVolatility30d": 55.3,
      "highRiskAssets": 1
    }
  }
}
```

---

## Rate Limits by Tier

| Tier       | Requests/Day    | Price     |
| ---------- | --------------- | --------- |
| Free       | 100             | $0        |
| Pro        | 10,000          | $29/month |
| Enterprise | Unlimited       | $99/month |
| x402       | Pay-per-request | $0.001+   |

### Rate Limit Headers

All authenticated requests include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1706054400000
```

---

## Market Data

### Get Coins

Get list of coins with market data.

```
GET /api/market/coins
```

#### Query Parameters

| Parameter | Type   | Default | Description                                        |
| --------- | ------ | ------- | -------------------------------------------------- |
| `type`    | string | `top`   | `list` for all coins, `top` for market cap ranking |
| `limit`   | number | `100`   | Number of results (max 250)                        |

#### Examples

```bash
# Get top 100 coins by market cap
curl "http://localhost:3000/api/market/coins"

# Get top 10 coins
curl "http://localhost:3000/api/market/coins?type=top&limit=10"

# Get all coins for autocomplete
curl "http://localhost:3000/api/market/coins?type=list"
```

#### Response

```json
{
  "coins": [
    {
      "id": "bitcoin",
      "symbol": "btc",
      "name": "Bitcoin",
      "current_price": 45000,
      "market_cap": 850000000000,
      "market_cap_rank": 1,
      "total_volume": 25000000000,
      "price_change_percentage_24h": 2.5,
      "price_change_percentage_7d_in_currency": 5.2,
      "circulating_supply": 19000000,
      "image": "https://..."
    }
  ],
  "total": 100
}
```

---

### Get Coin Snapshot

Get detailed data for a single coin.

```
GET /api/market/snapshot/[coinId]
```

#### Path Parameters

| Parameter | Type   | Description                                     |
| --------- | ------ | ----------------------------------------------- |
| `coinId`  | string | CoinGecko coin ID (e.g., `bitcoin`, `ethereum`) |

#### Examples

```bash
# Get Bitcoin details
curl "http://localhost:3000/api/market/snapshot/bitcoin"

# Get Ethereum details
curl "http://localhost:3000/api/market/snapshot/ethereum"
```

#### Response

```json
{
  "id": "bitcoin",
  "symbol": "btc",
  "name": "Bitcoin",
  "description": "Bitcoin is the first...",
  "image": {
    "thumb": "https://...",
    "small": "https://...",
    "large": "https://..."
  },
  "market_data": {
    "current_price": { "usd": 45000 },
    "market_cap": { "usd": 850000000000 },
    "total_volume": { "usd": 25000000000 },
    "high_24h": { "usd": 46000 },
    "low_24h": { "usd": 44000 },
    "price_change_24h": 1200,
    "price_change_percentage_24h": 2.5,
    "circulating_supply": 19000000,
    "total_supply": 21000000,
    "ath": { "usd": 69000 },
    "atl": { "usd": 67 }
  },
  "links": {
    "homepage": ["https://bitcoin.org"],
    "blockchain_site": ["https://blockchain.com"],
    "twitter_screen_name": "bitcoin"
  }
}
```

---

### Get Historical Prices

Get historical price, market cap, and volume data.

```
GET /api/market/history/[coinId]
```

#### Path Parameters

| Parameter | Type   | Description       |
| --------- | ------ | ----------------- |
| `coinId`  | string | CoinGecko coin ID |

#### Query Parameters

| Parameter  | Type   | Default | Description                                        |
| ---------- | ------ | ------- | -------------------------------------------------- |
| `days`     | number | `7`     | Historical range (1, 7, 14, 30, 90, 180, 365, max) |
| `interval` | string | auto    | Data granularity: `minutely`, `hourly`, `daily`    |

#### Examples

```bash
# Get 7-day history for Bitcoin
curl "http://localhost:3000/api/market/history/bitcoin?days=7"

# Get 30-day daily history
curl "http://localhost:3000/api/market/history/ethereum?days=30&interval=daily"

# Get 1-day minutely data
curl "http://localhost:3000/api/market/history/bitcoin?days=1&interval=minutely"
```

#### Response

```json
{
  "prices": [
    [1705881600000, 42500.25],
    [1705885200000, 42650.5]
  ],
  "market_caps": [
    [1705881600000, 832000000000],
    [1705885200000, 835000000000]
  ],
  "total_volumes": [
    [1705881600000, 24500000000],
    [1705885200000, 25100000000]
  ]
}
```

---

### Get OHLC Data

Get candlestick (OHLC) data for charts.

```
GET /api/market/ohlc/[coinId]
```

#### Query Parameters

| Parameter | Type   | Default | Description                       |
| --------- | ------ | ------- | --------------------------------- |
| `days`    | number | `7`     | Range: 1, 7, 14, 30, 90, 180, 365 |

#### Examples

```bash
# Get 7-day OHLC for Bitcoin
curl "http://localhost:3000/api/market/ohlc/bitcoin?days=7"

# Get 30-day OHLC for Ethereum
curl "http://localhost:3000/api/market/ohlc/ethereum?days=30"
```

#### Response

```json
{
  "ohlc": [
    {
      "timestamp": 1705881600000,
      "open": 42500,
      "high": 43200,
      "low": 42300,
      "close": 43100
    }
  ]
}
```

---

### Search Coins

Search for coins, exchanges, and categories.

```
GET /api/market/search
```

#### Query Parameters

| Parameter | Type   | Description                     |
| --------- | ------ | ------------------------------- |
| `q`       | string | Search query (min 2 characters) |

#### Examples

```bash
# Search for "ethereum"
curl "http://localhost:3000/api/market/search?q=ethereum"

# Search for "sol"
curl "http://localhost:3000/api/market/search?q=sol"
```

#### Response

```json
{
  "coins": [
    {
      "id": "ethereum",
      "name": "Ethereum",
      "symbol": "eth",
      "market_cap_rank": 2,
      "thumb": "https://...",
      "large": "https://..."
    }
  ],
  "exchanges": [],
  "categories": []
}
```

---

### Compare Coins

Compare multiple coins side by side.

```
GET /api/market/compare
```

#### Query Parameters

| Parameter | Type   | Description                       |
| --------- | ------ | --------------------------------- |
| `ids`     | string | Comma-separated coin IDs (max 25) |

#### Examples

```bash
# Compare Bitcoin, Ethereum, and Solana
curl "http://localhost:3000/api/market/compare?ids=bitcoin,ethereum,solana"
```

#### Response

```json
{
  "coins": [
    {
      "id": "bitcoin",
      "symbol": "btc",
      "name": "Bitcoin",
      "current_price": 45000,
      "market_cap": 850000000000,
      "price_change_percentage_24h": 2.5,
      "price_change_percentage_7d": 5.2,
      "price_change_percentage_30d": 12.5
    }
  ],
  "comparison_date": "2024-01-22T12:00:00.000Z"
}
```

---

### Get Tickers

Get trading pairs for a coin.

```
GET /api/market/tickers/[coinId]
```

#### Query Parameters

| Parameter | Type   | Default | Description                |
| --------- | ------ | ------- | -------------------------- |
| `page`    | number | `1`     | Page number for pagination |

#### Examples

```bash
# Get Bitcoin trading pairs
curl "http://localhost:3000/api/market/tickers/bitcoin"
```

#### Response

```json
{
  "name": "Bitcoin",
  "tickers": [
    {
      "base": "BTC",
      "target": "USDT",
      "market": {
        "name": "Binance",
        "identifier": "binance",
        "logo": "https://..."
      },
      "last": 45000,
      "volume": 15000,
      "trust_score": "green",
      "trade_url": "https://..."
    }
  ]
}
```

---

### Get Social Data

Get community and developer statistics.

```
GET /api/market/social/[coinId]
```

#### Examples

```bash
# Get Bitcoin social stats
curl "http://localhost:3000/api/market/social/bitcoin"
```

#### Response

```json
{
  "community": {
    "twitter_followers": 5500000,
    "reddit_subscribers": 4500000,
    "telegram_channel_user_count": 350000
  },
  "developer": {
    "forks": 35000,
    "stars": 72000,
    "commit_count_4_weeks": 250
  }
}
```

---

## Categories

### List Categories

Get all coin categories.

```
GET /api/market/categories
```

#### Examples

```bash
curl "http://localhost:3000/api/market/categories"
```

#### Response

```json
{
  "categories": [
    {
      "category_id": "decentralized-finance-defi",
      "name": "DeFi",
      "market_cap": 85000000000,
      "market_cap_change_24h": 3.5,
      "volume_24h": 8500000000
    }
  ]
}
```

---

### Get Category Coins

Get coins in a specific category.

```
GET /api/market/categories/[categoryId]
```

#### Query Parameters

| Parameter  | Type   | Default | Description      |
| ---------- | ------ | ------- | ---------------- |
| `per_page` | number | `100`   | Results per page |
| `page`     | number | `1`     | Page number      |

#### Examples

```bash
# Get DeFi coins
curl "http://localhost:3000/api/market/categories/decentralized-finance-defi"
```

---

## Exchanges

### List Exchanges

Get exchange rankings by volume.

```
GET /api/market/exchanges
```

#### Query Parameters

| Parameter  | Type   | Default | Description                |
| ---------- | ------ | ------- | -------------------------- |
| `per_page` | number | `100`   | Results per page (max 250) |
| `page`     | number | `1`     | Page number                |

#### Examples

```bash
# Get top 100 exchanges
curl "http://localhost:3000/api/market/exchanges"

# Get top 10 exchanges
curl "http://localhost:3000/api/market/exchanges?per_page=10"
```

#### Response

```json
{
  "exchanges": [
    {
      "id": "binance",
      "name": "Binance",
      "year_established": 2017,
      "country": "Cayman Islands",
      "trust_score": 10,
      "trust_score_rank": 1,
      "trade_volume_24h_btc": 500000
    }
  ]
}
```

---

### Get Exchange Details

Get detailed information about an exchange.

```
GET /api/market/exchanges/[exchangeId]
```

#### Examples

```bash
# Get Binance details
curl "http://localhost:3000/api/market/exchanges/binance"
```

---

## DeFi

### Get Protocols

Get DeFi protocols ranked by TVL.

```
GET /api/defi
```

#### Query Parameters

| Parameter | Type   | Default | Description         |
| --------- | ------ | ------- | ------------------- |
| `limit`   | number | `100`   | Number of protocols |

#### Examples

```bash
# Get top 100 DeFi protocols
curl "http://localhost:3000/api/defi"

# Get top 20 protocols
curl "http://localhost:3000/api/defi?limit=20"
```

#### Response

```json
{
  "protocols": [
    {
      "id": "lido",
      "name": "Lido",
      "symbol": "LDO",
      "chain": "Ethereum",
      "chains": ["Ethereum", "Polygon", "Solana"],
      "tvl": 25000000000,
      "change_1h": 0.1,
      "change_1d": 1.5,
      "change_7d": 3.2,
      "category": "Liquid Staking",
      "logo": "https://..."
    }
  ],
  "total": 100
}
```

---

### Get DeFi Market

Get global DeFi market statistics.

```
GET /api/market/defi
```

#### Examples

```bash
curl "http://localhost:3000/api/market/defi"
```

#### Response

```json
{
  "defi_market_cap": "85000000000",
  "defi_dominance": "4.5",
  "top_coin_name": "Lido",
  "top_coin_defi_dominance": 15.2
}
```

---

## Trending & Sentiment

### Get Trending

Get trending coins.

```
GET /api/trending
```

#### Examples

```bash
curl "http://localhost:3000/api/trending"
```

#### Response

```json
{
  "coins": [
    {
      "id": "pepe",
      "name": "Pepe",
      "symbol": "pepe",
      "market_cap_rank": 45,
      "thumb": "https://...",
      "price_btc": 0.00000001,
      "score": 0
    }
  ]
}
```

---

### Get Sentiment

Get Fear & Greed Index.

```
GET /api/sentiment
```

#### Examples

```bash
curl "http://localhost:3000/api/sentiment"
```

#### Response

```json
{
  "value": 72,
  "value_classification": "Greed",
  "timestamp": "2024-01-22T00:00:00.000Z",
  "time_until_update": "8 hours"
}
```

---

## Charts

### Get Chart Data

Get formatted chart data for a coin.

```
GET /api/charts
```

#### Query Parameters

| Parameter | Type   | Default  | Description       |
| --------- | ------ | -------- | ----------------- |
| `coinId`  | string | required | CoinGecko coin ID |
| `days`    | number | `7`      | Historical range  |

#### Examples

```bash
# Get 7-day chart data for Bitcoin
curl "http://localhost:3000/api/charts?coinId=bitcoin&days=7"
```

---

## Portfolio

### Get Portfolio

Get portfolio with calculated values.

```
GET /api/portfolio
```

#### Query Parameters

| Parameter     | Type   | Description  |
| ------------- | ------ | ------------ |
| `portfolioId` | string | Portfolio ID |

#### Examples

```bash
curl "http://localhost:3000/api/portfolio?portfolioId=pf_123"
```

---

### Add Holding

Add a coin to portfolio.

```
POST /api/portfolio/holding
```

#### Request Body

```json
{
  "portfolioId": "pf_123",
  "coinId": "bitcoin",
  "symbol": "btc",
  "name": "Bitcoin",
  "amount": 0.5,
  "averageBuyPrice": 40000
}
```

#### Examples

```bash
curl -X POST "http://localhost:3000/api/portfolio/holding" \
  -H "Content-Type: application/json" \
  -d '{
    "portfolioId": "pf_123",
    "coinId": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin",
    "amount": 0.5,
    "averageBuyPrice": 40000
  }'
```

---

### Remove Holding

Remove a coin from portfolio.

```
DELETE /api/portfolio/holding
```

#### Query Parameters

| Parameter     | Type   | Description       |
| ------------- | ------ | ----------------- |
| `portfolioId` | string | Portfolio ID      |
| `coinId`      | string | Coin ID to remove |

#### Examples

```bash
curl -X DELETE "http://localhost:3000/api/portfolio/holding?portfolioId=pf_123&coinId=bitcoin"
```

---

## Premium API v1

Premium v1 endpoints require authentication via API key or x402 payment.

Base path: `/api/v1/`

### Get Coins (Premium)

Get paginated list of coins with enhanced market data.

```
GET /api/v1/coins
```

**Authentication:** API key or x402 payment required

**Price:** $0.001 per request

#### Query Parameters

| Parameter   | Type    | Default         | Description                  |
| ----------- | ------- | --------------- | ---------------------------- |
| `page`      | number  | 1               | Page number                  |
| `per_page`  | number  | 100             | Results per page (max 250)   |
| `order`     | string  | market_cap_desc | Sort order                   |
| `ids`       | string  | -               | Comma-separated coin IDs     |
| `sparkline` | boolean | false           | Include 7-day sparkline data |

#### Examples

```bash
# With API key
curl -H "X-API-Key: cda_free_xxxxx" \
  "https://free-crypto-news.vercel.app/api/v1/coins?per_page=10"

# With x402 payment
curl -H "X-PAYMENT: <payment-header>" \
  "https://free-crypto-news.vercel.app/api/v1/coins"
```

#### Response

```json
{
  "success": true,
  "data": [
    {
      "id": "bitcoin",
      "symbol": "btc",
      "name": "Bitcoin",
      "current_price": 45000,
      "market_cap": 850000000000,
      "price_change_percentage_24h": 2.5
    }
  ],
  "meta": {
    "endpoint": "/api/v1/coins",
    "page": 1,
    "perPage": 100,
    "count": 100,
    "hasMore": true,
    "timestamp": "2026-01-23T12:00:00.000Z"
  }
}
```

---

### Get Historical Data

Get historical price data for a coin.

```
GET /api/v1/historical/:coinId
```

**Authentication:** API key or x402 payment required

**Price:** $0.02 per year of data requested

#### Path Parameters

| Parameter | Type   | Description       |
| --------- | ------ | ----------------- |
| `coinId`  | string | CoinGecko coin ID |

#### Query Parameters

| Parameter  | Type   | Default | Description                      |
| ---------- | ------ | ------- | -------------------------------- |
| `days`     | number | 30      | Days of history (1-365 or 'max') |
| `interval` | string | auto    | Data interval: daily, hourly     |

#### Examples

```bash
curl -H "X-API-Key: cda_free_xxxxx" \
  "https://free-crypto-news.vercel.app/api/v1/historical/bitcoin?days=30"
```

---

### Export Data

Export historical data in various formats.

```
GET /api/v1/export
```

**Authentication:** API key or x402 payment required

**Price:** $0.10 per export

#### Query Parameters

| Parameter | Type   | Default | Description              |
| --------- | ------ | ------- | ------------------------ |
| `coin`    | string | -       | Coin ID (required)       |
| `format`  | string | json    | Output format: json, csv |
| `days`    | number | 30      | Days of data             |

#### Examples

```bash
curl -H "X-API-Key: cda_free_xxxxx" \
  "https://free-crypto-news.vercel.app/api/v1/export?coin=bitcoin&format=csv&days=90"
```

---

### Gas Prices

Get current gas prices for major networks.

```
GET /api/v1/gas
```

**Authentication:** API key or x402 payment required

**Price:** $0.001 per request

#### Examples

```bash
curl -H "X-API-Key: cda_free_xxxxx" \
  "https://free-crypto-news.vercel.app/api/v1/gas"
```

#### Response

```json
{
  "success": true,
  "data": {
    "ethereum": {
      "slow": 15,
      "standard": 20,
      "fast": 30,
      "unit": "gwei"
    },
    "polygon": {
      "slow": 30,
      "standard": 50,
      "fast": 100,
      "unit": "gwei"
    }
  }
}
```

---

### DeFi Analytics

Get DeFi protocol analytics and TVL data.

```
GET /api/v1/defi
```

**Authentication:** API key or x402 payment required

**Price:** $0.001 per request

#### Query Parameters

| Parameter | Type   | Default | Description         |
| --------- | ------ | ------- | ------------------- |
| `limit`   | number | 20      | Number of protocols |
| `chain`   | string | -       | Filter by chain     |

#### Examples

```bash
curl -H "X-API-Key: cda_free_xxxxx" \
  "https://free-crypto-news.vercel.app/api/v1/defi?limit=10"
```

---

### API Usage

Check your API key usage and rate limits.

```
GET /api/v1/usage
```

**Authentication:** API key required

#### Examples

```bash
curl -H "X-API-Key: cda_free_xxxxx" \
  "https://free-crypto-news.vercel.app/api/v1/usage"
```

#### Response

```json
{
  "tier": "free",
  "usageToday": 45,
  "usageMonth": 1250,
  "limit": 100,
  "remaining": 55,
  "resetAt": "2026-01-24T00:00:00.000Z"
}
```

---

## Premium API (x402)

Premium endpoints require payment via the x402 protocol. Pay with USDC on Base - no API keys needed.

### Premium Overview

```
GET /api/premium
```

Returns complete documentation of all premium endpoints, pricing, and payment information.

#### Response

```json
{
  "name": "Crypto Data Aggregator Premium API",
  "version": "2.0.0",
  "payment": {
    "network": "Base Mainnet",
    "token": "USDC",
    "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  },
  "categories": [
    {
      "category": "ai",
      "name": "AI Analysis",
      "icon": "🧠",
      "endpoints": [...]
    }
  ]
}
```

### How to Pay

1. **Make a request** to any premium endpoint
2. **Receive 402** with payment requirements in response
3. **Sign payment** using any x402-compatible wallet
4. **Resend request** with `X-Payment` header containing signed payment
5. **Receive data** - payment settles automatically

```bash
# Step 1: Initial request returns 402
curl https://api.example.com/api/premium/ai/sentiment
# Response: 402 Payment Required + payment details

# Step 2: Resend with payment
curl -H "X-Payment: <base64-signed-payment>" \
  https://api.example.com/api/premium/ai/sentiment
# Response: 200 OK + data
```

---

### AI Analysis

#### AI Sentiment Analysis

Analyze crypto news for market sentiment using AI.

```
GET /api/premium/ai/sentiment
```

**Price:** $0.02 per request

| Parameter | Type   | Default | Description                            |
| --------- | ------ | ------- | -------------------------------------- |
| `limit`   | number | `20`    | Number of articles to analyze (max 50) |
| `asset`   | string | -       | Filter by asset (e.g., `BTC`, `ETH`)   |

#### Response

```json
{
  "articles": [
    {
      "title": "Bitcoin Breaks $100K Resistance",
      "sentiment": "very_bullish",
      "confidence": 92,
      "reasoning": "Major price milestone with institutional backing",
      "impact": "high",
      "affectedCoins": ["BTC", "ETH"]
    }
  ],
  "overall": {
    "sentiment": "bullish",
    "score": 65,
    "summary": "Market sentiment is bullish driven by BTC price action",
    "keyDrivers": ["BTC breaking ATH", "ETF inflows", "Institutional adoption"]
  },
  "meta": {
    "analyzedAt": "2026-01-23T12:00:00Z",
    "articlesAnalyzed": 20,
    "model": "llama-3.3-70b-versatile",
    "price": 0.02
  }
}
```

---

#### AI Trading Signals

Get AI-generated buy/sell signals based on market data.

```
GET /api/premium/ai/signals
```

**Price:** $0.05 per request

| Parameter | Type   | Default                   | Description              |
| --------- | ------ | ------------------------- | ------------------------ |
| `coins`   | string | `bitcoin,ethereum,solana` | Comma-separated coin IDs |

#### Response

```json
{
  "signals": [
    {
      "coin": "BTC",
      "coinId": "bitcoin",
      "signal": "buy",
      "confidence": 78,
      "reasoning": "Bullish momentum with volume confirmation",
      "keyLevels": {
        "support": 95000,
        "resistance": 105000,
        "stopLoss": 92000,
        "takeProfit": 110000
      },
      "indicators": {
        "rsi": "neutral",
        "trend": "up",
        "momentum": "increasing"
      },
      "timeframe": "medium"
    }
  ],
  "marketContext": {
    "btcTrend": "up",
    "marketPhase": "markup",
    "riskLevel": "medium"
  },
  "meta": {
    "disclaimer": "Not financial advice. Do your own research."
  }
}
```

---

#### AI Market Summary

Get an AI-generated market summary for any cryptocurrency.

```
GET /api/premium/ai/summary
```

**Price:** $0.01 per request

| Parameter | Type   | Description                |
| --------- | ------ | -------------------------- |
| `coin`    | string | Optional coin ID for focus |

#### Response

```json
{
  "summary": {
    "headline": "Crypto markets rally as BTC tests new highs",
    "overview": "The cryptocurrency market is experiencing strong momentum...",
    "keyEvents": [
      "Bitcoin approaches $100K milestone",
      "Ethereum Layer 2 activity surging",
      "DeFi TVL reaches new record"
    ],
    "topMovers": {
      "gainers": ["SOL +15%", "AVAX +12%"],
      "losers": ["DOGE -5%", "SHIB -8%"]
    },
    "outlook": {
      "shortTerm": "bullish",
      "reasoning": "Strong momentum and positive sentiment"
    }
  },
  "coinHighlight": {
    "coin": "BTC",
    "analysis": "Bitcoin is showing strong buying pressure...",
    "priceAction": "Consolidating near ATH with bullish structure"
  }
}
```

---

#### AI Coin Comparison

Compare multiple cryptocurrencies using AI analysis.

```
GET /api/premium/ai/compare
```

**Price:** $0.03 per request

| Parameter | Type   | Required | Description                          |
| --------- | ------ | -------- | ------------------------------------ |
| `coins`   | string | Yes      | Comma-separated coin IDs (2-5 coins) |

#### Example

```bash
curl "https://api.example.com/api/premium/ai/compare?coins=bitcoin,ethereum,solana"
```

#### Response

```json
{
  "comparison": {
    "coins": ["BTC", "ETH", "SOL"],
    "verdict": "BTC for store of value, ETH for DeFi, SOL for speed",
    "table": {
      "technology": {
        "BTC": "8/10",
        "ETH": "9/10",
        "SOL": "8/10",
        "analysis": "ETH leads with smart contract capabilities"
      },
      "adoption": {
        "BTC": "10/10",
        "ETH": "9/10",
        "SOL": "7/10",
        "analysis": "BTC has highest brand recognition"
      }
    }
  },
  "recommendation": {
    "forTrading": "SOL - highest volatility for short-term trades",
    "forHolding": "BTC - best risk-adjusted long-term returns",
    "forBeginner": "BTC - most established and understood"
  },
  "risks": [
    "Market correlation - all assets may move together",
    "Regulatory uncertainty",
    "Technical vulnerabilities"
  ]
}
```

---

### Whale Tracking

#### Whale Transactions

Track large cryptocurrency transactions ($1M+).

```
GET /api/premium/whales/transactions
```

**Price:** $0.05 per request

| Parameter   | Type   | Default   | Description                                       |
| ----------- | ------ | --------- | ------------------------------------------------- |
| `limit`     | number | `50`      | Number of transactions (max 100)                  |
| `minAmount` | number | `1000000` | Minimum USD value                                 |
| `token`     | string | -         | Filter by token (e.g., `BTC`)                     |
| `chain`     | string | -         | Filter by blockchain                              |
| `type`      | string | -         | `transfer`, `exchange_inflow`, `exchange_outflow` |

#### Response

```json
{
  "transactions": [
    {
      "id": "whale_1706012400_0",
      "hash": "0x...",
      "blockchain": "ethereum",
      "timestamp": "2026-01-23T11:30:00Z",
      "from": {
        "address": "0x...",
        "label": "Binance",
        "isExchange": true
      },
      "to": {
        "address": "0x...",
        "label": null,
        "isExchange": false
      },
      "amount": 500,
      "amountUsd": 50000000,
      "token": {
        "symbol": "ETH",
        "name": "Ethereum"
      },
      "type": "exchange_outflow",
      "significance": "high"
    }
  ],
  "aggregates": {
    "totalVolume": 250000000,
    "exchangeInflow": 80000000,
    "exchangeOutflow": 170000000,
    "netFlow": 90000000,
    "topTokens": {
      "BTC": 150000000,
      "ETH": 100000000
    }
  }
}
```

---

#### Smart Money Flow

Track institutional and smart money movements.

```
GET /api/premium/smart-money
```

**Price:** $0.05 per request

| Parameter   | Type   | Default | Description              |
| ----------- | ------ | ------- | ------------------------ |
| `token`     | string | -       | Filter by token          |
| `timeframe` | string | `24h`   | Time period for analysis |

#### Response

```json
{
  "institutions": {
    "netBuying": true,
    "volume24h": 85000000,
    "topBuys": [
      { "token": "ETH", "amount": 5000, "usd": 20000000 },
      { "token": "SOL", "amount": 100000, "usd": 15000000 }
    ],
    "topSells": []
  },
  "whaleActivity": {
    "accumulationPhase": true,
    "distribution": {
      "accumulating": ["ETH", "SOL", "AVAX"],
      "distributing": ["DOGE", "SHIB"],
      "neutral": ["BTC"]
    }
  },
  "exchangeFlow": {
    "btc": { "inflow": 500, "outflow": 800, "net": 300 },
    "eth": { "inflow": 10000, "outflow": 15000, "net": 5000 }
  },
  "signals": {
    "overallSentiment": "accumulation",
    "confidence": 72,
    "keyInsights": [
      "Large ETH accumulation by institutional wallets",
      "Exchange reserves declining for BTC",
      "Smart money rotating into L2 tokens"
    ]
  }
}
```

---

#### Whale Alerts (Webhook)

Subscribe to real-time whale alerts via webhook.

```
POST /api/premium/whales/alerts
```

**Price:** $0.05 per subscription (24h)

#### Request Body

```json
{
  "minAmount": 5000000,
  "tokens": ["BTC", "ETH"],
  "types": ["exchange_inflow", "exchange_outflow"],
  "chains": ["ethereum", "bitcoin"],
  "webhookUrl": "https://your-server.com/webhook",
  "durationHours": 24
}
```

#### Response

```json
{
  "success": true,
  "alert": {
    "id": "alert_1706012400_abc123",
    "conditions": {
      "minAmount": 5000000,
      "tokens": ["BTC", "ETH"],
      "types": ["exchange_inflow", "exchange_outflow"]
    },
    "webhookUrl": "https://your-server.com/webhook",
    "expiresAt": "2026-01-24T12:00:00Z",
    "createdAt": "2026-01-23T12:00:00Z"
  }
}
```

---

### Advanced Screener

#### Advanced Crypto Screener

Powerful screening with unlimited filter combinations.

```
GET /api/premium/screener/advanced
```

**Price:** $0.02 per request

| Parameter         | Type   | Description                                                                                                                                                                  |
| ----------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `preset`          | string | Use preset filter: `hot-gainers`, `momentum-leaders`, `oversold-bounce`, `undervalued-gems`, `near-ath`, `large-caps`, `mid-caps`, `small-caps`, `micro-caps`, `high-volume` |
| `minMarketCap`    | number | Minimum market cap (USD)                                                                                                                                                     |
| `maxMarketCap`    | number | Maximum market cap (USD)                                                                                                                                                     |
| `minVolume`       | number | Minimum 24h volume (USD)                                                                                                                                                     |
| `maxVolume`       | number | Maximum 24h volume (USD)                                                                                                                                                     |
| `minChange24h`    | number | Minimum 24h price change (%)                                                                                                                                                 |
| `maxChange24h`    | number | Maximum 24h price change (%)                                                                                                                                                 |
| `minChange7d`     | number | Minimum 7d price change (%)                                                                                                                                                  |
| `maxChange7d`     | number | Maximum 7d price change (%)                                                                                                                                                  |
| `minAthDistance`  | number | Minimum distance from ATH (%)                                                                                                                                                |
| `maxAthDistance`  | number | Maximum distance from ATH (%)                                                                                                                                                |
| `minVolumeToMcap` | number | Minimum volume/market cap ratio                                                                                                                                              |
| `sort`            | string | Sort field                                                                                                                                                                   |
| `order`           | string | `asc` or `desc`                                                                                                                                                              |
| `limit`           | number | Results per page (max 500)                                                                                                                                                   |
| `offset`          | number | Pagination offset                                                                                                                                                            |

#### Example: Find Hot Gainers

```bash
curl "https://api.example.com/api/premium/screener/advanced?preset=hot-gainers"
# OR with custom filters:
curl "https://api.example.com/api/premium/screener/advanced?minChange24h=10&minVolume=10000000"
```

#### Example: Find Undervalued Gems

```bash
curl "https://api.example.com/api/premium/screener/advanced?maxAthDistance=-70&minMarketCap=10000000&minVolume=1000000"
```

#### Response

```json
{
  "coins": [
    {
      "id": "solana",
      "symbol": "sol",
      "name": "Solana",
      "current_price": 150.25,
      "market_cap": 65000000000,
      "market_cap_rank": 5,
      "total_volume": 3500000000,
      "price_change_percentage_24h": 12.5,
      "price_change_percentage_7d": 25.3,
      "ath": 260,
      "ath_change_percentage": -42.2,
      "volume_to_mcap": 0.054,
      "supply_ratio": 0.85
    }
  ],
  "aggregates": {
    "totalMatching": 45,
    "avgChange24h": 8.5,
    "totalMarketCap": 450000000000,
    "totalVolume": 25000000000,
    "topGainer": { "id": "solana", "symbol": "sol", "change": 12.5 },
    "topLoser": { "id": "cardano", "symbol": "ada", "change": -2.1 }
  },
  "pagination": {
    "limit": 100,
    "offset": 0,
    "total": 45,
    "hasMore": false
  },
  "availablePresets": [
    "hot-gainers",
    "momentum-leaders",
    "oversold-bounce",
    "undervalued-gems",
    "near-ath",
    "large-caps",
    "mid-caps",
    "small-caps",
    "micro-caps",
    "high-volume"
  ]
}
```

---

### Access Passes

For power users, purchase unlimited access for a fixed price.

#### 1 Hour Pass

```
GET /api/premium/pass/hour
```

**Price:** $0.25

Returns a token valid for 1 hour of unlimited premium API access.

---

#### 24 Hour Pass

```
GET /api/premium/pass/day
```

**Price:** $2.00

Returns a token valid for 24 hours of unlimited premium API access.

---

#### 7 Day Pass

```
GET /api/premium/pass/week
```

**Price:** $10.00

Returns a token valid for 7 days of unlimited premium API access.

---

### Premium Error Responses

#### 402 Payment Required

When payment is required:

```json
{
  "error": "Payment Required",
  "code": "PAYMENT_REQUIRED",
  "message": "AI-powered sentiment analysis of crypto news",
  "price": {
    "usd": 0.02,
    "usdc": "20000"
  },
  "features": [
    "Real-time news sentiment scoring",
    "Bullish/bearish classification",
    "Impact assessment"
  ],
  "freeAlternative": "/api/sentiment?limit=5",
  "documentation": "https://docs.x402.org",
  "x402Version": 2,
  "accepts": [
    {
      "scheme": "exact",
      "network": "eip155:8453",
      "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      "payTo": "0x...",
      "maxAmountRequired": "20000"
    }
  ]
}
```

#### 429 Rate Limited

When rate limit is exceeded:

```json
{
  "error": "Rate limit exceeded",
  "message": "You have exceeded the rate limit for this endpoint",
  "resetAt": "2026-01-23T12:01:00Z",
  "suggestion": "Consider purchasing an access pass for higher limits"
}
```

---

## Response Formats

### Success Response

All successful responses return JSON with appropriate HTTP status codes:

- `200 OK` - Request succeeded
- `201 Created` - Resource created
- `304 Not Modified` - Cached response (ETag match)

### Error Response

```json
{
  "error": "Error message",
  "details": "Additional context",
  "timestamp": "2024-01-22T12:00:00.000Z"
}
```

---

## Error Handling

| Status | Description                        |
| ------ | ---------------------------------- |
| `400`  | Bad Request - Invalid parameters   |
| `404`  | Not Found - Resource doesn't exist |
| `429`  | Too Many Requests - Rate limited   |
| `500`  | Internal Server Error              |

---

## Rate Limits

### CoinGecko API

| Tier | Limit         | Notes                      |
| ---- | ------------- | -------------------------- |
| Free | 10-30 req/min | Sufficient for development |
| Pro  | 500 req/min   | Recommended for production |

### Internal Rate Limiting

The API implements client-side rate limiting:

- Max 25 requests per minute window
- Automatic backoff on 429 responses
- Stale-while-revalidate caching

### Cache TTLs

| Data Type            | TTL   |
| -------------------- | ----- |
| Live prices          | 30s   |
| 1-day historical     | 60s   |
| 7-day historical     | 5min  |
| 30-day historical    | 15min |
| Exchange/Ticker data | 2min  |
| Static data          | 1hr   |

---

## Headers

### Request Headers

| Header          | Value              | Description              |
| --------------- | ------------------ | ------------------------ |
| `Accept`        | `application/json` | Expected response format |
| `If-None-Match` | ETag value         | For conditional requests |

### Response Headers

| Header                        | Description            |
| ----------------------------- | ---------------------- |
| `Cache-Control`               | Caching directives     |
| `ETag`                        | Entity tag for caching |
| `Access-Control-Allow-Origin` | CORS header (`*`)      |

---

## SDK Usage

### Using SWR (Recommended)

```typescript
import useSWR from 'swr';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function useTopCoins(limit = 10) {
  return useSWR(`/api/market/coins?type=top&limit=${limit}`, fetcher, {
    refreshInterval: 30000, // Refresh every 30s
  });
}

// Usage in component
const { data, error, isLoading } = useTopCoins(10);
```

### Using Fetch

```typescript
async function getTopCoins(limit = 10) {
  const res = await fetch(`/api/market/coins?type=top&limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
}
```
