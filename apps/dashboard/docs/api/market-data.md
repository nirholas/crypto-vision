# Market Data API

Real-time cryptocurrency market data endpoints.

---

## Base URL

```
https://cryptonews.direct/api/v2
```

---

## Endpoints Overview

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| `GET /coins` | List coins with market data | 30/min |
| `GET /coin/:id` | Single coin details | 30/min |
| `GET /global` | Global market statistics | 30/min |
| `GET /trending` | Trending cryptocurrencies | 30/min |
| `GET /search` | Search coins | 30/min |
| `GET /volatility` | Volatility metrics | 30/min |
| `GET /ticker` | Real-time ticker data | 60/min |
| `GET /historical/:id` | Historical OHLCV data | 30/min |

---

## List Coins

Get list of coins with market data.

```http
GET /api/v2/coins?limit=50&order=market_cap_desc
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | number | 100 | Results per page (max 250) |
| `order` | string | `market_cap_desc` | Sort order |
| `category` | string | - | Filter by category |

### Response

```json
{
  "success": true,
  "data": {
    "coins": [
      {
        "id": "bitcoin",
        "symbol": "btc",
        "name": "Bitcoin",
        "image": "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
        "current_price": 95000,
        "market_cap": 1870000000000,
        "market_cap_rank": 1,
        "price_change_24h": 2.5,
        "price_change_percentage_7d": 5.2,
        "sparkline_in_7d": [91000, 92500, 93000, ...]
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

---

## Get Coin Details

Get detailed information for a specific coin.

```http
GET /api/v2/coin/bitcoin
```

### Response

```json
{
  "success": true,
  "data": {
    "id": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin",
    "description": "Bitcoin is the first decentralized cryptocurrency...",
    "market_data": {
      "current_price": 95000,
      "market_cap": 1870000000000,
      "total_volume": 45000000000,
      "high_24h": 96500,
      "low_24h": 93200,
      "price_change_24h": 1500,
      "price_change_percentage_24h": 1.6,
      "ath": 100000,
      "atl": 67.81
    },
    "community_data": {
      "twitter_followers": 6500000,
      "reddit_subscribers": 5000000
    },
    "developer_data": {
      "stars": 75000,
      "forks": 35000
    }
  }
}
```

---

## Global Market Data

Get global cryptocurrency market statistics.

```http
GET /api/v2/global
```

### Response

```json
{
  "success": true,
  "data": {
    "market": {
      "total_market_cap": 3500000000000,
      "total_volume_24h": 150000000000,
      "btc_dominance": 52.5,
      "eth_dominance": 17.2,
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

---

## Trending Coins

Get trending cryptocurrencies.

```http
GET /api/v2/trending
```

### Response

```json
{
  "success": true,
  "data": {
    "coins": [
      {
        "id": "bitcoin",
        "name": "Bitcoin",
        "symbol": "BTC",
        "market_cap_rank": 1,
        "thumb": "https://assets.coingecko.com/coins/images/1/thumb/bitcoin.png",
        "score": 0
      }
    ]
  }
}
```

---

## Search Coins

Search for cryptocurrencies by name or symbol.

```http
GET /api/v2/search?query=ethereum
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `query` | string | required | Search query |

### Response

```json
{
  "success": true,
  "data": {
    "coins": [
      {
        "id": "ethereum",
        "name": "Ethereum",
        "symbol": "ETH",
        "market_cap_rank": 2,
        "thumb": "https://assets.coingecko.com/coins/images/279/thumb/ethereum.png"
      }
    ]
  }
}
```

---

## Gas Prices

Get multi-chain gas prices.

```http
GET /api/v2/gas?network=all
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `network` | string | `all` | `ethereum`, `bitcoin`, or `all` |

### Response

```json
{
  "success": true,
  "data": {
    "ethereum": {
      "slow": 15,
      "standard": 20,
      "fast": 30,
      "baseFee": 12
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

---

## Volatility Metrics

Get volatility and risk metrics for cryptocurrencies.

```http
GET /api/v2/volatility?ids=bitcoin,ethereum,solana
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `ids` | string | required | Comma-separated coin IDs |

### Response

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

## Historical Data

Get historical OHLCV data for a coin.

```http
GET /api/v2/historical/bitcoin?days=30
```

### Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `days` | number | 30 | Number of days (max 365) |
| `interval` | string | `daily` | `hourly` or `daily` |

### Response

```json
{
  "success": true,
  "data": {
    "id": "bitcoin",
    "prices": [
      [1706054400000, 95000],
      [1706140800000, 96500]
    ],
    "market_caps": [
      [1706054400000, 1870000000000],
      [1706140800000, 1900000000000]
    ],
    "volumes": [
      [1706054400000, 45000000000],
      [1706140800000, 48000000000]
    ]
  }
}
```

---

## Code Examples

=== "curl"

    ```bash
    # Get top coins
    curl https://cryptonews.direct/api/v2/coins

    # Get Bitcoin details
    curl https://cryptonews.direct/api/v2/coin/bitcoin

    # Search for coins
    curl "https://cryptonews.direct/api/v2/search?query=eth"
    ```

=== "JavaScript"

    ```javascript
    // Using fetch
    const response = await fetch('https://cryptonews.direct/api/v2/coins');
    const data = await response.json();
    console.log(data.data.coins);

    // Using SDK
    import { CryptoNews } from '@nirholas/crypto-news';
    const client = new CryptoNews();
    const coins = await client.getCoins({ limit: 50 });
    ```

=== "Python"

    ```python
    import requests
    
    response = requests.get('https://cryptonews.direct/api/v2/coins')
    data = response.json()
    print(data['data']['coins'])
    ```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad request - invalid parameters |
| 404 | Coin not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 502 | Upstream API error |

---

## Next Steps

- [Authentication](authentication.md) - API key and x402 setup
- [Premium Endpoints](premium.md) - Advanced analytics
- [DeFi Data](overview.md#defi) - TVL and protocol data
