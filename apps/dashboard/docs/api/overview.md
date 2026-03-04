# API Overview

The Crypto Data Aggregator API provides real-time cryptocurrency market data with flexible
authentication options.

## Base URL

```
https://your-domain.com/api
```

For local development:

```
http://localhost:3000/api
```

## Authentication

The API supports three authentication methods:

| Method           | Use Case            | Rate Limit    |
| ---------------- | ------------------- | ------------- |
| **API Key**      | Subscription access | Based on tier |
| **x402 Payment** | Pay-per-use         | Unlimited     |
| **No Auth**      | Free tier           | 100 req/day   |

See [Authentication](authentication.md) for details.

## Endpoints

### Free Endpoints

#### News & Content

| Method | Endpoint              | Description                        |
| ------ | --------------------- | ---------------------------------- |
| `GET`  | `/api/news`           | Latest news from all sources       |
| `GET`  | `/api/search?q=`      | Search news by keywords            |
| `GET`  | `/api/bitcoin`        | Bitcoin-specific news              |
| `GET`  | `/api/defi`           | DeFi news and updates              |
| `GET`  | `/api/breaking`       | Breaking news (last 2 hours)       |
| `GET`  | `/api/trending`       | Trending topics analysis           |
| `GET`  | `/api/sources`        | List of news sources               |
| `GET`  | `/api/article?url=`   | Fetch & summarize article by URL   |

#### AI & Intelligence

| Method | Endpoint            | Description                           |
| ------ | ------------------- | ------------------------------------- |
| `GET`  | `/api/sentiment`    | Market sentiment analysis             |
| `POST` | `/api/summarize`    | AI article summarization              |
| `GET`  | `/api/signals`      | AI-generated trading signals          |
| `GET`  | `/api/narratives`   | Dominant market narratives & themes   |
| `GET`  | `/api/entities`     | Named entity recognition              |
| `POST` | `/api/factcheck`    | Fact-check crypto claims              |
| `POST` | `/api/clickbait`    | Headline quality/clickbait scoring    |
| `GET`  | `/api/digest`       | AI-curated daily news digest          |
| `POST` | `/api/ask`          | Natural language Q&A about crypto     |
| `GET`  | `/api/classify`     | Topic classification & categorization |
| `POST` | `/api/analyze`      | Multi-function AI analysis            |

#### Market Data

| Method | Endpoint              | Description                    |
| ------ | --------------------- | ------------------------------ |
| `GET`  | `/api/market`         | Global market stats            |
| `GET`  | `/api/v2/coins`       | Top coins with market data     |
| `GET`  | `/api/v2/coin/:id`    | Detailed coin information      |
| `GET`  | `/api/v2/global`      | Global crypto market metrics   |
| `GET`  | `/api/v2/defi`        | DeFi TVL & top protocols       |
| `GET`  | `/api/v2/gas`         | Multi-chain gas prices         |
| `GET`  | `/api/v2/trending`    | Trending coins                 |
| `GET`  | `/api/v2/search`      | Search coins by name/symbol    |
| `GET`  | `/api/v2/volatility`  | Volatility metrics             |
| `GET`  | `/api/v2/ticker`      | Real-time ticker data          |
| `GET`  | `/api/exchanges`      | Exchange listings & volumes    |
| `GET`  | `/api/bitcoin/halving`| Bitcoin halving countdown      |

#### Analytics

| Method | Endpoint                   | Description                        |
| ------ | -------------------------- | ---------------------------------- |
| `GET`  | `/api/analytics/anomalies` | Unusual pattern detection          |
| `GET`  | `/api/analytics/sources`   | Source credibility scores          |
| `GET`  | `/api/analytics/headlines` | Track headline changes over time   |
| `GET`  | `/api/origins`             | Trace news to original sources     |
| `GET`  | `/api/stats`               | API usage & aggregation statistics |

#### Feeds & Integration

| Method | Endpoint    | Description                      |
| ------ | ----------- | -------------------------------- |
| `GET`  | `/api/rss`  | RSS feed output                  |
| `GET`  | `/api/atom` | Atom feed format                 |
| `GET`  | `/api/opml` | OPML export for RSS readers      |
| `GET`  | `/api/sse`  | Server-Sent Events live stream   |
| `WS`   | `/api/ws`   | WebSocket real-time connection   |

#### Developer Tools

| Method | Endpoint              | Description                    |
| ------ | --------------------- | ------------------------------ |
| `POST` | `/api/v2/graphql`     | Full GraphQL API               |
| `POST` | `/api/v2/batch`       | Batch multiple API calls       |
| `GET`  | `/api/webhooks`       | Manage webhook subscriptions   |
| `GET`  | `/api/health`         | API health check               |
| `GET`  | `/api/v2/openapi.json`| OpenAPI 3.1 specification      |
| `GET`  | `/docs/swagger`       | Interactive Swagger UI         |

### Premium Endpoints

| Method | Endpoint                          | Price  | Description              |
| ------ | --------------------------------- | ------ | ------------------------ |
| `GET`  | `/api/premium/market/coins`       | $0.001 | Extended coin data       |
| `GET`  | `/api/premium/market/history`     | $0.005 | Historical OHLCV data    |
| `POST` | `/api/premium/analytics/screener` | $0.01  | Advanced screener        |
| `GET`  | `/api/premium/export/portfolio`   | $0.10  | Portfolio CSV export     |
| `POST` | `/api/premium/ai/analyze`         | $0.05  | Deep AI analysis         |
| `POST` | `/api/premium/ai/compare`         | $0.03  | AI coin comparison       |
| `GET`  | `/api/premium/ai/signals`         | $0.05  | AI trading signals       |
| `GET`  | `/api/premium/ai/sentiment`       | $0.02  | Deep sentiment analysis  |
| `GET`  | `/api/premium/whales`             | $0.05  | Whale wallet tracking    |
| `GET`  | `/api/premium/smart-money`        | $0.05  | Institutional flows      |
| `GET`  | `/api/premium/portfolio/analytics`| $0.02  | Portfolio analytics      |
| `GET`  | `/api/premium/defi`               | $0.01  | Extended DeFi data       |
| `GET`  | `/api/premium/alerts`             | $0.10  | Custom price alerts      |

## Response Format

All responses follow a consistent format:

```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2026-01-23T12:00:00Z",
    "cached": false
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

## Status Codes

| Code  | Description             |
| ----- | ----------------------- |
| `200` | Success                 |
| `400` | Bad Request             |
| `401` | Unauthorized            |
| `402` | Payment Required (x402) |
| `429` | Rate Limit Exceeded     |
| `500` | Server Error            |

## Quick Example

```bash
# Get trending coins (free)
curl https://your-domain.com/api/trending

# Get premium data with API key
curl -H "X-API-Key: pro_xxxxx" \
  https://your-domain.com/api/premium/market/coins

# Get premium data with x402 payment
curl -H "X-PAYMENT: <base64-payment>" \
  https://your-domain.com/api/premium/market/coins
```

## Next Steps

- [Authentication](authentication.md) - Set up API access
- [Market Data](market-data.md) - Endpoint details
- [x402 Payments](x402.md) - Micropayment guide
