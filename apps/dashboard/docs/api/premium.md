# Premium API Endpoints

Advanced analytics and data export endpoints requiring authentication.

---

## Overview

Premium endpoints provide access to:

- **AI-powered analysis** - Sentiment, trends, and predictions
- **Whale tracking** - Large transaction monitoring
- **Advanced screener** - Custom filtering and alerts
- **Data export** - Bulk CSV/JSON downloads
- **Real-time feeds** - WebSocket streams

!!! warning "Authentication Required"
    All premium endpoints require either an [API key](authentication.md) or [x402 payment](x402.md).

---

## AI Analysis

Get AI-powered market analysis and insights.

```http
GET /api/premium/ai-analysis?type=market
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | `market` | `market`, `coin`, `sentiment`, `prediction` |
| `coinId` | string | - | Required for `coin` type |

### Response

```json
{
  "success": true,
  "data": {
    "type": "market",
    "analysis": {
      "summary": "The crypto market shows bullish momentum with Bitcoin leading...",
      "sentiment": "bullish",
      "confidence": 0.78,
      "keyPoints": [
        "Bitcoin breaking resistance at $95,000",
        "Institutional inflows increasing",
        "DeFi TVL at all-time high"
      ],
      "predictions": {
        "shortTerm": "Continued upward movement expected",
        "mediumTerm": "Consolidation likely before next leg up"
      }
    },
    "generatedAt": "2026-01-24T12:00:00Z"
  }
}
```

### Pricing

| Type | Price |
|------|-------|
| `market` | $0.005 |
| `coin` | $0.003 |
| `sentiment` | $0.002 |
| `prediction` | $0.01 |

---

## Whale Tracking

Monitor large cryptocurrency transactions.

```http
GET /api/premium/alerts/whales?minUSD=1000000
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `minUSD` | number | 1000000 | Minimum transaction value in USD |
| `asset` | string | - | Filter by asset (e.g., `bitcoin`, `ethereum`) |
| `limit` | number | 50 | Number of results |

### Response

```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "tx_abc123",
        "hash": "0x...",
        "blockchain": "ethereum",
        "asset": "ETH",
        "amount": 5000,
        "usdValue": 15000000,
        "from": {
          "address": "0x...",
          "label": "Binance"
        },
        "to": {
          "address": "0x...",
          "label": "Unknown Wallet"
        },
        "timestamp": "2026-01-24T12:00:00Z",
        "significance": "Large exchange outflow - potential accumulation"
      }
    ],
    "summary": {
      "total24h": 45,
      "totalVolume24h": 2500000000,
      "largestTransaction": 150000000
    }
  }
}
```

### Pricing

- Per request: $0.005
- WebSocket subscription: $0.01/hour

---

## Advanced Screener

Filter and rank cryptocurrencies with custom criteria.

```http
POST /api/premium/screener
```

### Request Body

```json
{
  "filters": {
    "market_cap": { "min": 1000000000 },
    "price_change_24h": { "min": 5 },
    "volume_24h": { "min": 100000000 },
    "category": ["defi", "layer-1"]
  },
  "sort": {
    "field": "price_change_24h",
    "order": "desc"
  },
  "limit": 50
}
```

### Available Filters

| Filter | Type | Description |
|--------|------|-------------|
| `market_cap` | range | Market cap in USD |
| `price_change_24h` | range | 24h price change % |
| `price_change_7d` | range | 7d price change % |
| `volume_24h` | range | 24h volume in USD |
| `category` | array | Category filters |
| `chain` | array | Blockchain filters |

### Response

```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "solana",
        "symbol": "SOL",
        "name": "Solana",
        "current_price": 180,
        "market_cap": 80000000000,
        "price_change_24h": 12.5,
        "volume_24h": 5000000000,
        "categories": ["layer-1", "smart-contracts"]
      }
    ],
    "total": 15,
    "appliedFilters": 4
  }
}
```

### Pricing

- $0.05 per query

---

## Data Export

Export bulk data in CSV or JSON format.

```http
GET /api/premium/export?type=market&format=csv
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `type` | string | required | `market`, `historical`, `portfolio` |
| `format` | string | `json` | `json` or `csv` |
| `limit` | number | 1000 | Max rows |
| `coinId` | string | - | For historical export |
| `days` | number | 30 | Days of history |

### Response

Returns file download with appropriate `Content-Type` header.

### Pricing

| Export Type | Price |
|-------------|-------|
| Market data (1000 coins) | $0.10 |
| Historical (per year) | $0.02 |
| Portfolio | $0.05 |

---

## WebSocket Streams

Real-time data streams for price updates and alerts.

### Connection

```javascript
const ws = new WebSocket('wss://cryptonews.direct/api/premium/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    apiKey: 'cda_pro_xxxxx'
  }));
  
  // Subscribe to channels
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['prices:bitcoin', 'whales', 'alerts']
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};
```

### Channels

| Channel | Description | Example |
|---------|-------------|---------|
| `prices:{coinId}` | Price updates | `prices:bitcoin` |
| `prices:top100` | Top 100 coins | `prices:top100` |
| `whales` | Whale transactions | `whales` |
| `alerts` | Your triggered alerts | `alerts` |
| `news` | Breaking news | `news` |

### Pricing

- $0.01 per hour of connection

---

## Access Passes

Purchase time-based access passes for unlimited API usage.

```http
POST /api/premium/access-pass
```

### Request Body

```json
{
  "duration": "24h",
  "tier": "pro"
}
```

### Available Passes

| Duration | Pro Tier | Enterprise Tier |
|----------|----------|-----------------|
| 1 hour | $0.50 | $1.00 |
| 24 hours | $5.00 | $10.00 |
| 7 days | $25.00 | $50.00 |
| 30 days | $29.00 | $99.00 |

### Response

```json
{
  "success": true,
  "data": {
    "passId": "pass_abc123",
    "tier": "pro",
    "expiresAt": "2026-01-25T12:00:00Z",
    "features": [
      "Unlimited API requests",
      "WebSocket access",
      "Priority support"
    ]
  }
}
```

---

## Error Responses

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "message": "Valid API key or x402 payment required"
}
```

### 402 Payment Required

```json
{
  "error": "Payment Required",
  "message": "This endpoint requires x402 payment",
  "price": "$0.005",
  "x402Version": 2
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden",
  "message": "Your API key tier does not have access to this endpoint"
}
```

---

## Next Steps

- [Authentication](authentication.md) - Set up API keys
- [x402 Integration](x402.md) - Pay-per-request access
- [Market Data](market-data.md) - Free endpoints
