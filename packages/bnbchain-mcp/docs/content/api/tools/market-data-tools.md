# Market Data Tools

Tools for cryptocurrency market data, prices, OHLCV charts, and market analytics via CoinGecko and CoinStats APIs.

---

## market_get_coins

Get comprehensive data about cryptocurrencies including price, market cap, volume, and price changes.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `name` | string | No | - | Search coins by name |
| `symbol` | string | No | - | Filter by symbol |
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Results per page (max 100) |
| `currency` | string | No | `USD` | Currency for price data |
| `blockchains` | string | No | - | Blockchain filters (comma-separated) |
| `categories` | string | No | - | Category filters (comma-separated) |
| `sortBy` | string | No | - | Sort field |
| `sortDir` | enum | No | `desc` | Sort direction: `asc` or `desc` |
| `marketCapGreaterThan` | number | No | - | Min market cap filter |
| `marketCapLessThan` | number | No | - | Max market cap filter |
| `volumeGreaterThan` | number | No | - | Min 24h volume filter |
| `volumeLessThan` | number | No | - | Max 24h volume filter |
| `priceGreaterThan` | number | No | - | Min price filter |
| `priceLessThan` | number | No | - | Max price filter |

### Response Schema

```typescript
{
  coins: Array<{
    id: string;
    name: string;
    symbol: string;
    rank: number;
    price: number;
    priceChange1h: number;
    priceChange24h: number;
    priceChange7d: number;
    marketCap: number;
    volume24h: number;
    circulatingSupply: number;
    totalSupply: number;
    maxSupply: number | null;
    fullyDilutedValuation: number;
    icon: string;
    websiteUrl: string;
    twitterUrl: string;
  }>;
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}
```

### Example Usage

```typescript
// Get top DeFi coins by market cap
const result = await client.callTool('market_get_coins', {
  categories: 'defi',
  sortBy: 'marketCap',
  sortDir: 'desc',
  limit: 10
});

// Response
{
  "coins": [
    {
      "id": "uniswap",
      "name": "Uniswap",
      "symbol": "UNI",
      "rank": 18,
      "price": 7.85,
      "priceChange1h": 0.12,
      "priceChange24h": 2.45,
      "priceChange7d": -5.23,
      "marketCap": 5900000000,
      "volume24h": 234000000,
      "circulatingSupply": 751880000,
      "totalSupply": 1000000000,
      "maxSupply": 1000000000,
      "fullyDilutedValuation": 7850000000,
      "icon": "https://...",
      "websiteUrl": "https://uniswap.org",
      "twitterUrl": "https://twitter.com/Uniswap"
    }
    // ... more coins
  ],
  "meta": {
    "page": 1,
    "limit": 10,
    "totalCount": 245,
    "totalPages": 25
  }
}
```

---

## market_get_coin_by_id

Get detailed information about a specific cryptocurrency.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `coinId` | string | Yes | - | The coin identifier |
| `currency` | string | No | `USD` | Currency for price data |

### Response Schema

```typescript
{
  id: string;
  name: string;
  symbol: string;
  rank: number;
  price: number;
  priceChange1h: number;
  priceChange24h: number;
  priceChange7d: number;
  priceChange30d: number;
  priceChange1y: number;
  marketCap: number;
  volume24h: number;
  volumeMarketCapRatio: number;
  circulatingSupply: number;
  totalSupply: number;
  maxSupply: number | null;
  fullyDilutedValuation: number;
  ath: number;                    // All-time high
  athDate: string;
  athChangePercent: number;
  atl: number;                    // All-time low
  atlDate: string;
  atlChangePercent: number;
  description: string;
  contractAddress: string;
  blockchain: string;
  links: {
    website: string;
    whitepaper: string;
    twitter: string;
    telegram: string;
    discord: string;
    github: string;
  };
}
```

### Example Usage

```typescript
const result = await client.callTool('market_get_coin_by_id', {
  coinId: 'bitcoin',
  currency: 'USD'
});

// Response
{
  "id": "bitcoin",
  "name": "Bitcoin",
  "symbol": "BTC",
  "rank": 1,
  "price": 43250.00,
  "priceChange1h": 0.15,
  "priceChange24h": 1.85,
  "priceChange7d": 5.42,
  "priceChange30d": 12.34,
  "priceChange1y": 85.67,
  "marketCap": 848000000000,
  "volume24h": 28500000000,
  "volumeMarketCapRatio": 0.0336,
  "circulatingSupply": 19600000,
  "totalSupply": 19600000,
  "maxSupply": 21000000,
  "fullyDilutedValuation": 908250000000,
  "ath": 69000,
  "athDate": "2021-11-10T00:00:00Z",
  "athChangePercent": -37.32,
  "atl": 67.81,
  "atlDate": "2013-07-06T00:00:00Z",
  "atlChangePercent": 63673.45,
  "description": "Bitcoin is the first decentralized cryptocurrency...",
  "links": {
    "website": "https://bitcoin.org",
    "whitepaper": "https://bitcoin.org/bitcoin.pdf",
    "twitter": "https://twitter.com/bitcoin",
    "github": "https://github.com/bitcoin/bitcoin"
  }
}
```

---

## market_get_coin_chart

Get historical chart data for a cryptocurrency.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `coinId` | string | Yes | - | The coin identifier |
| `period` | enum | Yes | - | Time period: `24h`, `1w`, `1m`, `3m`, `6m`, `1y`, `all` |

### Response Schema

```typescript
{
  coinId: string;
  period: string;
  data: Array<{
    timestamp: number;
    price: number;
    volume: number;
    marketCap: number;
  }>;
  priceChange: {
    absolute: number;
    percent: number;
  };
  high: number;
  low: number;
}
```

### Example Usage

```typescript
const result = await client.callTool('market_get_coin_chart', {
  coinId: 'ethereum',
  period: '7d'
});

// Response
{
  "coinId": "ethereum",
  "period": "7d",
  "data": [
    {
      "timestamp": 1706198400000,
      "price": 2250.50,
      "volume": 15000000000,
      "marketCap": 270000000000
    },
    // ... more data points
  ],
  "priceChange": {
    "absolute": 125.50,
    "percent": 5.42
  },
  "high": 2450.00,
  "low": 2180.00
}
```

---

## market_get_trending

Get trending cryptocurrencies.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `limit` | number | No | `10` | Number of results |

### Response Schema

```typescript
{
  trending: Array<{
    id: string;
    name: string;
    symbol: string;
    rank: number;
    price: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
    trendingScore: number;
    icon: string;
  }>;
  updatedAt: string;
}
```

### Example Usage

```typescript
const result = await client.callTool('market_get_trending', {
  limit: 5
});

// Response
{
  "trending": [
    {
      "id": "pepe",
      "name": "Pepe",
      "symbol": "PEPE",
      "rank": 45,
      "price": 0.00001234,
      "priceChange24h": 45.67,
      "volume24h": 890000000,
      "marketCap": 5200000000,
      "trendingScore": 95.5,
      "icon": "https://..."
    }
    // ... more trending coins
  ],
  "updatedAt": "2024-01-26T12:00:00Z"
}
```

---

## market_get_fear_greed_index

Get the Fear & Greed Index for crypto market sentiment.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `limit` | number | No | `1` | Number of historical data points |

### Response Schema

```typescript
{
  current: {
    value: number;              // 0-100
    classification: string;     // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
    timestamp: number;
  };
  history?: Array<{
    value: number;
    classification: string;
    timestamp: number;
  }>;
  interpretation: string;
}
```

### Example Usage

```typescript
const result = await client.callTool('market_get_fear_greed_index', {
  limit: 7
});

// Response
{
  "current": {
    "value": 72,
    "classification": "Greed",
    "timestamp": 1706284800
  },
  "history": [
    { "value": 72, "classification": "Greed", "timestamp": 1706284800 },
    { "value": 68, "classification": "Greed", "timestamp": 1706198400 },
    { "value": 65, "classification": "Greed", "timestamp": 1706112000 },
    { "value": 58, "classification": "Neutral", "timestamp": 1706025600 },
    { "value": 55, "classification": "Neutral", "timestamp": 1705939200 },
    { "value": 62, "classification": "Greed", "timestamp": 1705852800 },
    { "value": 60, "classification": "Greed", "timestamp": 1705766400 }
  ],
  "interpretation": "Market sentiment is in 'Greed' territory. Historically, this suggests potential for correction. Exercise caution with new positions."
}
```

---

## market_get_global

Get global cryptocurrency market statistics.

### Parameters

None

### Response Schema

```typescript
{
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  ethDominance: number;
  activeCryptocurrencies: number;
  markets: number;
  defiMarketCap: number;
  defiVolume24h: number;
  stablecoinMarketCap: number;
  marketCapChange24h: number;
  volumeChange24h: number;
}
```

### Example Usage

```typescript
const result = await client.callTool('market_get_global', {});

// Response
{
  "totalMarketCap": 1750000000000,
  "totalVolume24h": 85000000000,
  "btcDominance": 48.5,
  "ethDominance": 18.2,
  "activeCryptocurrencies": 12500,
  "markets": 850,
  "defiMarketCap": 85000000000,
  "defiVolume24h": 8500000000,
  "stablecoinMarketCap": 145000000000,
  "marketCapChange24h": 2.45,
  "volumeChange24h": 15.67
}
```

---

## market_get_categories

Get cryptocurrency categories with market data.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `sortBy` | string | No | `market_cap` | Sort field |
| `sortDir` | enum | No | `desc` | Sort direction |

### Response Schema

```typescript
{
  categories: Array<{
    id: string;
    name: string;
    marketCap: number;
    marketCapChange24h: number;
    volume24h: number;
    volumeChange24h: number;
    top3Coins: string[];
    coinsCount: number;
  }>;
}
```

### Example Usage

```typescript
const result = await client.callTool('market_get_categories', {
  sortBy: 'market_cap',
  sortDir: 'desc'
});

// Response
{
  "categories": [
    {
      "id": "layer-1",
      "name": "Layer 1 (L1)",
      "marketCap": 950000000000,
      "marketCapChange24h": 2.34,
      "volume24h": 45000000000,
      "volumeChange24h": 12.5,
      "top3Coins": ["bitcoin", "ethereum", "solana"],
      "coinsCount": 125
    },
    {
      "id": "defi",
      "name": "Decentralized Finance (DeFi)",
      "marketCap": 85000000000,
      "marketCapChange24h": 3.12,
      "volume24h": 8500000000,
      "volumeChange24h": 18.3,
      "top3Coins": ["uniswap", "aave", "maker"],
      "coinsCount": 245
    }
    // ... more categories
  ]
}
```

---

## market_get_exchanges

Get cryptocurrency exchanges ranked by trust score and volume.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `page` | number | No | `1` | Page number |
| `limit` | number | No | `20` | Results per page |

### Response Schema

```typescript
{
  exchanges: Array<{
    id: string;
    name: string;
    trustScore: number;
    trustScoreRank: number;
    volume24hBtc: number;
    volume24hUsd: number;
    yearEstablished: number;
    country: string;
    url: string;
    image: string;
    hasTradingIncentive: boolean;
  }>;
}
```

---

## market_get_coin_by_contract

Get coin data by contract address.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `platform` | string | Yes | - | Blockchain platform (e.g., `ethereum`, `binance-smart-chain`) |
| `contractAddress` | string | Yes | - | Token contract address |

### Response Schema

Same as `market_get_coin_by_id`

### Example Usage

```typescript
const result = await client.callTool('market_get_coin_by_contract', {
  platform: 'ethereum',
  contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
});

// Response: USDC data
{
  "id": "usd-coin",
  "name": "USD Coin",
  "symbol": "USDC",
  "price": 1.00,
  // ... full coin data
}
```

---

## market_get_ohlcv

Get OHLCV (Open, High, Low, Close, Volume) candlestick data.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `coinId` | string | Yes | - | The coin identifier |
| `vsCurrency` | string | No | `usd` | Quote currency |
| `days` | number | No | `7` | Number of days |
| `interval` | string | No | `daily` | Interval: `hourly`, `daily` |

### Response Schema

```typescript
{
  coinId: string;
  candles: Array<{
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
  interval: string;
}
```

### Example Usage

```typescript
const result = await client.callTool('market_get_ohlcv', {
  coinId: 'bitcoin',
  days: 30,
  interval: 'daily'
});

// Response
{
  "coinId": "bitcoin",
  "candles": [
    {
      "timestamp": 1706284800000,
      "open": 42500.00,
      "high": 43800.00,
      "low": 42100.00,
      "close": 43250.00,
      "volume": 28500000000
    }
    // ... more candles
  ],
  "interval": "daily"
}
```

---

## market_get_company_holdings

Get public company Bitcoin/Ethereum holdings.

### Parameters

| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `coinId` | enum | Yes | - | `bitcoin` or `ethereum` |

### Response Schema

```typescript
{
  totalHoldings: number;
  totalValueUsd: number;
  marketCapDominance: string;
  companies: Array<{
    name: string;
    symbol: string;
    country: string;
    totalHoldings: number;
    totalEntryValueUsd: number;
    totalCurrentValueUsd: number;
    percentOfTotalSupply: number;
  }>;
}
```

---

## Rate Limits & API Keys

### CoinGecko

| Tier | Rate Limit | Features |
|------|------------|----------|
| Free | 10-30 req/min | Basic data, limited history |
| Pro | 500 req/min | Full history, real-time data |

Set API key: `COINGECKO_API_KEY=your_key`

### CoinStats

| Tier | Rate Limit | Features |
|------|------------|----------|
| Free | 100 req/day | Basic coin data |
| Pro | 10,000 req/day | Full portfolio tracking |

Set API key: `COINSTATS_API_KEY=your_key`

---

## Best Practices

1. **Cache price data** - Prices don't need real-time updates for most use cases
2. **Use batch requests** - Get multiple coins in one request when possible
3. **Monitor rate limits** - Track API usage to avoid hitting limits
4. **Handle stale data** - Check timestamps and refresh when needed
5. **Use appropriate intervals** - Match data granularity to your needs
