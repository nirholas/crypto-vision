# Data Sources & Caching

Documentation for external APIs, data flow, and caching strategies.

---

## Table of Contents

- [Overview](#overview)
- [External APIs](#external-apis)
  - [CoinGecko](#coingecko)
  - [DeFiLlama](#defillama)
  - [Alternative.me](#alternativeme)
  - [CryptoCompare](#cryptocompare)
  - [Blockchain.com](#blockchaincom)
  - [Messari](#messari)
  - [CoinGlass](#coinglass)
  - [GoPlus Labs](#goplus-labs)
  - [Etherscan](#etherscan)
  - [Mempool.space](#mempoolspace)
  - [Blockstream](#blockstream)
- [Caching Strategy](#caching-strategy)
- [Data Models](#data-models)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)

---

## Overview

Crypto Data Aggregator fetches data from **13+ free, public APIs**:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   CoinGecko     │  │   DeFiLlama     │  │  Alternative.me │  │  CryptoCompare  │
│  (Market Data)  │  │  (DeFi TVL)     │  │ (Fear & Greed)  │  │ (OHLCV/Social)  │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │                    │
┌────────┴────────┐  ┌────────┴────────┐  ┌────────┴────────┐  ┌────────┴────────┐
│  Blockchain.com │  │    Messari      │  │   CoinGlass     │  │   GoPlus Labs   │
│  (BTC On-chain) │  │   (Research)    │  │ (Funding/OI)    │  │ (Token Security)│
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │                    │
┌────────┴────────┐  ┌────────┴────────┐  ┌────────┴────────┐  ┌────────┴────────┐
│   Etherscan     │  │  Mempool.space  │  │  Blockstream    │  │     Binance     │
│  (Gas Oracle)   │  │   (Mempool)     │  │  (Esplora API)  │  │ (Exchange Data) │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │                    │
         └────────────────────┴────────────────────┴────────────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │    Memory Cache (TTL)   │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │     API Routes (/api)   │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │     SWR Client Cache    │
                            └────────────┬────────────┘
                                         │
                            ┌────────────▼────────────┐
                            │      React Components   │
                            └─────────────────────────┘
```

---

## External APIs

### CoinGecko

**Base URL**: `https://api.coingecko.com/api/v3`

**Authentication**: None required (free tier)

**Rate Limits**: ~50 requests/minute

#### Endpoints Used

| Endpoint                       | Purpose                     | Cache TTL |
| ------------------------------ | --------------------------- | --------- |
| `GET /coins/markets`           | Top coins with market data  | 60s       |
| `GET /coins/{id}`              | Detailed coin information   | 120s      |
| `GET /coins/{id}/market_chart` | Historical price data       | 300s      |
| `GET /coins/{id}/ohlc`         | OHLC candlestick data       | 300s      |
| `GET /search/trending`         | Trending coins              | 300s      |
| `GET /coins/categories/list`   | Category list               | 3600s     |
| `GET /coins/categories`        | Categories with market data | 600s      |
| `GET /exchanges`               | Exchange list               | 600s      |
| `GET /exchanges/{id}`          | Exchange details            | 600s      |
| `GET /search`                  | Search coins                | 60s       |

#### Example Responses

**GET /coins/markets**

```json
[
  {
    "id": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin",
    "image": "https://assets.coingecko.com/coins/images/1/large/bitcoin.png",
    "current_price": 95000,
    "market_cap": 1870000000000,
    "market_cap_rank": 1,
    "fully_diluted_valuation": 1990000000000,
    "total_volume": 45000000000,
    "high_24h": 96500,
    "low_24h": 93200,
    "price_change_24h": 1500,
    "price_change_percentage_24h": 1.6,
    "price_change_percentage_7d_in_currency": 5.2,
    "price_change_percentage_30d_in_currency": 12.5,
    "circulating_supply": 19600000,
    "total_supply": 21000000,
    "max_supply": 21000000,
    "ath": 100000,
    "ath_change_percentage": -5,
    "ath_date": "2025-01-15T00:00:00.000Z",
    "atl": 67.81,
    "atl_change_percentage": 139900,
    "atl_date": "2013-07-06T00:00:00.000Z",
    "last_updated": "2026-01-22T10:00:00.000Z",
    "sparkline_in_7d": {
      "price": [91000, 92500, 93000, ...]
    }
  }
]
```

**GET /coins/{id}**

```json
{
  "id": "bitcoin",
  "symbol": "btc",
  "name": "Bitcoin",
  "description": {
    "en": "Bitcoin is the first successful..."
  },
  "links": {
    "homepage": ["https://bitcoin.org"],
    "blockchain_site": ["https://blockchair.com/bitcoin"],
    "repos_url": {
      "github": ["https://github.com/bitcoin/bitcoin"]
    }
  },
  "market_data": {
    "current_price": { "usd": 95000 },
    "market_cap": { "usd": 1870000000000 },
    "total_volume": { "usd": 45000000000 }
  },
  "community_data": {
    "twitter_followers": 6500000,
    "reddit_subscribers": 5000000
  },
  "developer_data": {
    "stars": 75000,
    "forks": 35000,
    "subscribers": 4000
  }
}
```

---

### DeFiLlama

**Base URL**: `https://api.llama.fi`

**Authentication**: None required

**Rate Limits**: Very generous (no documented limits)

#### Endpoints Used

| Endpoint               | Purpose                    | Cache TTL |
| ---------------------- | -------------------------- | --------- |
| `GET /protocols`       | All DeFi protocols         | 300s      |
| `GET /chains`          | All chains with TVL        | 300s      |
| `GET /protocol/{name}` | Protocol details & history | 300s      |
| `GET /tvl/{protocol}`  | Protocol TVL               | 300s      |

#### Example Responses

**GET /protocols**

```json
[
  {
    "id": "1",
    "name": "Lido",
    "symbol": "LDO",
    "url": "https://lido.fi",
    "description": "Liquid staking for Ethereum",
    "chain": "Multi-Chain",
    "logo": "https://defillama.com/icons/lido.png",
    "tvl": 35000000000,
    "chainTvls": {
      "Ethereum": 32000000000,
      "Polygon": 500000000,
      "Solana": 2500000000
    },
    "change_1h": 0.1,
    "change_1d": 1.5,
    "change_7d": 3.2,
    "category": "Liquid Staking"
  }
]
```

---

### Alternative.me

**Base URL**: `https://api.alternative.me`

**Authentication**: None required

**Rate Limits**: Unknown (generous)

#### Endpoints Used

| Endpoint             | Purpose                    | Cache TTL |
| -------------------- | -------------------------- | --------- |
| `GET /fng/`          | Current Fear & Greed Index | 3600s     |
| `GET /fng/?limit=30` | Historical Fear & Greed    | 3600s     |

#### Example Response

**GET /fng/**

```json
{
  "name": "Fear and Greed Index",
  "data": [
    {
      "value": "72",
      "value_classification": "Greed",
      "timestamp": "1737504000",
      "time_until_update": "43200"
    }
  ],
  "metadata": {
    "error": null
  }
}
```

---

### CryptoCompare

**Base URL**: `https://min-api.cryptocompare.com/data`

**Authentication**: None required for basic tier

**Rate Limits**: 100,000 calls/month (free tier)

#### Endpoints Used

| Endpoint                      | Purpose                    | Cache TTL |
| ----------------------------- | -------------------------- | --------- |
| `GET /histoday`               | Daily OHLCV data           | 300s      |
| `GET /histohour`              | Hourly OHLCV data          | 300s      |
| `GET /histominute`            | Minute OHLCV data          | 60s       |
| `GET /social/coin/latest`     | Social stats (Twitter, Reddit, GitHub) | 3600s |

#### Example Response

**GET /histoday?fsym=BTC&tsym=USD&limit=7**

```json
{
  "Response": "Success",
  "Data": [
    {
      "time": 1737417600,
      "open": 94500,
      "high": 96200,
      "low": 93800,
      "close": 95800,
      "volumefrom": 12500,
      "volumeto": 1187500000
    }
  ]
}
```

---

### Blockchain.com

**Base URL**: `https://api.blockchain.info`

**Authentication**: None required

**Rate Limits**: Unlimited

#### Endpoints Used

| Endpoint            | Purpose                    | Cache TTL |
| ------------------- | -------------------------- | --------- |
| `GET /stats`        | Bitcoin network statistics | 600s      |
| `GET /q/getblockcount` | Current block height    | 60s       |

#### Example Response

**GET /stats?format=json**

```json
{
  "market_price_usd": 95800,
  "hash_rate": 750000000000000000000,
  "difficulty": 110568893081062,
  "totalbc": 1960000000000000,
  "n_tx": 450000,
  "minutes_between_blocks": 9.5,
  "total_fees_btc": 2500000000
}
```

---

### Messari

**Base URL**: `https://data.messari.io/api/v1`

**Authentication**: None required for public endpoints

**Rate Limits**: 20 requests/minute (free tier)

#### Endpoints Used

| Endpoint                    | Purpose                    | Cache TTL |
| --------------------------- | -------------------------- | --------- |
| `GET /assets`               | List all assets            | 600s      |
| `GET /assets/{symbol}/metrics` | Asset metrics & research | 300s      |

#### Example Response

**GET /assets/btc/metrics**

```json
{
  "data": {
    "id": "1e31218a-e44e-4285-820c-8282ee222035",
    "symbol": "BTC",
    "name": "Bitcoin",
    "slug": "bitcoin",
    "market_data": {
      "price_usd": 95800,
      "volume_last_24_hours": 45000000000,
      "percent_change_usd_last_24_hours": 1.5
    },
    "marketcap": {
      "current_marketcap_usd": 1876000000000
    },
    "roi_data": {
      "percent_change_last_1_week": 5.2
    }
  }
}
```

---

### CoinGlass

**Base URL**: `https://open-api.coinglass.com/public/v2`

**Authentication**: None required for public endpoints

**Rate Limits**: Generous (undocumented)

#### Endpoints Used

| Endpoint                | Purpose                    | Cache TTL |
| ----------------------- | -------------------------- | --------- |
| `GET /funding`          | Funding rates by exchange  | 300s      |
| `GET /open_interest`    | Open interest aggregated   | 300s      |

#### Example Response

**GET /funding?symbol=BTC**

```json
{
  "code": "0",
  "data": [
    {
      "symbol": "BTC",
      "exchangeName": "Binance",
      "rate": 0.0001,
      "predictedRate": 0.00012,
      "nextFundingTime": 1737504000000
    },
    {
      "symbol": "BTC",
      "exchangeName": "Bybit",
      "rate": 0.00008,
      "predictedRate": 0.0001,
      "nextFundingTime": 1737504000000
    }
  ]
}
```

---

### GoPlus Labs

**Base URL**: `https://api.gopluslabs.io/api/v1`

**Authentication**: None required

**Rate Limits**: Unlimited

#### Endpoints Used

| Endpoint                          | Purpose                    | Cache TTL |
| --------------------------------- | -------------------------- | --------- |
| `GET /token_security/{chainId}`   | Token security analysis    | 3600s     |

#### Chain IDs

| Chain     | ID    |
| --------- | ----- |
| Ethereum  | `1`   |
| BSC       | `56`  |
| Polygon   | `137` |
| Arbitrum  | `42161` |
| Base      | `8453` |

#### Example Response

**GET /token_security/1?contract_addresses=0x....**

```json
{
  "code": 1,
  "result": {
    "0x....": {
      "is_open_source": "1",
      "is_proxy": "0",
      "is_mintable": "0",
      "is_honeypot": "0",
      "buy_tax": "0",
      "sell_tax": "0",
      "holder_count": "150000",
      "lp_holder_count": "25"
    }
  }
}
```

---

### Etherscan

**Base URL**: `https://api.etherscan.io/api`

**Authentication**: None required for basic endpoints

**Rate Limits**: 5 calls/second (free tier)

#### Endpoints Used

| Endpoint                           | Purpose                    | Cache TTL |
| ---------------------------------- | -------------------------- | --------- |
| `GET ?module=gastracker&action=gasoracle` | Current gas prices  | 15s       |
| `GET ?module=stats&action=ethsupply2`     | ETH supply stats    | 3600s     |

#### Example Response

**GET ?module=gastracker&action=gasoracle**

```json
{
  "status": "1",
  "result": {
    "LastBlock": "19500000",
    "SafeGasPrice": "15",
    "ProposeGasPrice": "18",
    "FastGasPrice": "22",
    "suggestBaseFee": "14.5",
    "gasUsedRatio": "0.45,0.52,0.48,0.55,0.50"
  }
}
```

---

### Mempool.space

**Base URL**: `https://mempool.space/api`

**Authentication**: None required

**Rate Limits**: Generous

#### Endpoints Used

| Endpoint                | Purpose                    | Cache TTL |
| ----------------------- | -------------------------- | --------- |
| `GET /v1/fees/recommended` | Recommended BTC fees    | 60s       |
| `GET /blocks/tip/height`   | Current block height     | 60s       |
| `GET /mempool`             | Mempool statistics       | 30s       |

---

### Blockstream

**Base URL**: `https://blockstream.info/api`

**Authentication**: None required

**Rate Limits**: Generous

#### Endpoints Used

| Endpoint                | Purpose                    | Cache TTL |
| ----------------------- | -------------------------- | --------- |
| `GET /blocks/tip/height` | Current block height      | 60s       |
| `GET /block/{hash}`      | Block details             | 3600s     |
| `GET /tx/{txid}`         | Transaction details       | 3600s     |

---

## Caching Strategy

### Multi-Layer Cache

```
┌──────────────────────────────────────────────────┐
│  Layer 1: SWR Client Cache (Browser)             │
│  - Stale-while-revalidate pattern                │
│  - Automatic revalidation on focus               │
│  - Deduplication of concurrent requests          │
├──────────────────────────────────────────────────┤
│  Layer 2: Memory Cache (Edge/Server)             │
│  - TTL-based expiration                          │
│  - LRU eviction when memory limit reached        │
│  - Shared across API route invocations           │
├──────────────────────────────────────────────────┤
│  Layer 3: HTTP Cache Headers                     │
│  - Cache-Control headers                         │
│  - ETag for conditional requests                 │
│  - CDN/browser caching                           │
└──────────────────────────────────────────────────┘
```

### Cache Implementation

**Location**: `src/lib/cache.ts`

```typescript
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number = 100;

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number): void {
    // LRU eviction if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }
}

export const cache = new MemoryCache();
```

### Cache TTL by Data Type

| Data Type         | TTL   | Reason                           |
| ----------------- | ----- | -------------------------------- |
| Coin prices       | 60s   | Balance freshness vs. API limits |
| Coin details      | 120s  | Less volatile data               |
| Historical charts | 300s  | Historical data doesn't change   |
| Trending          | 300s  | Updates hourly on source         |
| Categories list   | 3600s | Rarely changes                   |
| DeFi protocols    | 300s  | TVL updates frequently           |
| Fear & Greed      | 3600s | Updates daily                    |

### SWR Configuration

```typescript
// Global SWR config
<SWRConfig
  value={{
    fetcher: (url) => fetch(url).then((r) => r.json()),
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    errorRetryCount: 3,
  }}
>
  <App />
</SWRConfig>

// Per-hook config
const { data } = useSWR('/api/market/coins', fetcher, {
  refreshInterval: 30000,  // Refresh every 30s
  revalidateIfStale: true,
  revalidateOnMount: true,
});
```

---

## Data Models

### CoinData

```typescript
interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  circulating_supply: number;
  total_supply: number | null;
  max_supply: number | null;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  last_updated: string;
  sparkline_in_7d?: {
    price: number[];
  };
}
```

### DeFiProtocol

```typescript
interface DeFiProtocol {
  id: string;
  name: string;
  symbol: string;
  url: string;
  description: string;
  chain: string;
  chains: string[];
  logo: string;
  tvl: number;
  change_1h: number;
  change_1d: number;
  change_7d: number;
  category: string;
  chainTvls: Record<string, number>;
}
```

### PriceAlert

```typescript
interface PriceAlert {
  id: string;
  coinId: string;
  coinName: string;
  coinSymbol: string;
  type: 'above' | 'below';
  targetPrice: number;
  currentPrice: number;
  enabled: boolean;
  triggered: boolean;
  createdAt: string;
  triggeredAt?: string;
}
```

### PortfolioHolding

```typescript
interface PortfolioHolding {
  coinId: string;
  symbol: string;
  name: string;
  amount: number;
  averagePrice: number;
  notes?: string;
  addedAt: string;
}
```

---

## Error Handling

### API Error Response

```typescript
interface APIError {
  error: string;
  code: string;
  details?: unknown;
}

// Example error response
{
  "error": "Failed to fetch market data",
  "code": "UPSTREAM_ERROR",
  "details": {
    "status": 429,
    "message": "Rate limit exceeded"
  }
}
```

### Error Handling Pattern

```typescript
// In API route
export async function GET(request: Request) {
  try {
    const data = await fetchMarketData();
    return Response.json(data);
  } catch (error) {
    console.error('Market data fetch failed:', error);

    if (error instanceof RateLimitError) {
      return Response.json({ error: 'Rate limit exceeded', code: 'RATE_LIMIT' }, { status: 429 });
    }

    // Try to return cached data on error
    const cached = cache.get('market-data-fallback');
    if (cached) {
      return Response.json({
        ...cached,
        _stale: true,
        _cachedAt: cached._timestamp,
      });
    }

    return Response.json({ error: 'Service unavailable', code: 'SERVICE_ERROR' }, { status: 503 });
  }
}
```

### Client-Side Error Handling

```typescript
const { data, error, isLoading } = useSWR('/api/market/coins', fetcher, {
  onError: (err) => {
    console.error('Failed to fetch:', err);
    showToast({ type: 'error', message: 'Failed to load market data' });
  },
  errorRetryCount: 3,
  errorRetryInterval: 5000,
});

if (error) {
  return <ErrorState message="Unable to load data" onRetry={mutate} />;
}
```

---

## Rate Limiting

### Strategy

To stay within free tier limits, we:

1. **Cache aggressively** - Reduce duplicate requests
2. **Batch requests** - Combine multiple coin requests
3. **Debounce user actions** - Prevent rapid-fire requests
4. **Fallback to cached data** - Serve stale data on rate limit

### Implementation

```typescript
// Debounced search
const debouncedSearch = useMemo(
  () =>
    debounce((query: string) => {
      mutate(`/api/search?q=${query}`);
    }, 300),
  []
);

// Request batching for coin prices
async function getBatchedPrices(coinIds: string[]): Promise<PriceMap> {
  // CoinGecko allows up to 250 coins per request
  const batches = chunk(coinIds, 250);
  const results = await Promise.all(
    batches.map((batch) => fetch(`/api/market/coins?ids=${batch.join(',')}`))
  );
  return mergeResults(results);
}
```

### Rate Limit Headers

API routes return rate limit headers:

```http
X-RateLimit-Limit: 50
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1737550000
```

---

## Data Freshness Indicators

Components can show data freshness:

```tsx
interface DataWithMeta<T> {
  data: T;
  _cachedAt: number;
  _stale: boolean;
}

function PriceDisplay({ price, cachedAt, stale }: Props) {
  const age = Date.now() - cachedAt;

  return (
    <div>
      <span>${price}</span>
      {stale && <span className="text-yellow-500 text-xs">(cached {formatAge(age)} ago)</span>}
    </div>
  );
}
```

---

## Additional Data Sources (For Future Integration)

### 1. CryptoCompare

**Base URL:** `https://min-api.cryptocompare.com`

Free tier includes 250,000 calls/month. Excellent for historical data.

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| `/data/pricemultifull` | Multi-price with full data | 50 req/sec |
| `/data/v2/histoday` | Daily OHLCV history | 50 req/sec |
| `/data/v2/histohour` | Hourly OHLCV history | 50 req/sec |
| `/data/v2/histominute` | Minute OHLCV history | 50 req/sec |
| `/data/top/totalvolfull` | Top coins by volume | 50 req/sec |
| `/data/blockchain/histo/day` | On-chain metrics | 50 req/sec |

```bash
# Example: Multi-price request
curl "https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC,ETH&tsyms=USD"
```

**Use Cases:** Historical OHLCV data, social stats, on-chain metrics

---

### 2. Binance Public API

**Base URL:** `https://api.binance.com`

No authentication required for public endpoints. Very high rate limits.

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| `/api/v3/ticker/24hr` | 24h price change stats | 1200 req/min |
| `/api/v3/klines` | Candlestick/OHLCV data | 1200 req/min |
| `/api/v3/depth` | Order book depth | 1200 req/min |
| `/api/v3/trades` | Recent trades | 1200 req/min |
| `/api/v3/avgPrice` | Current average price | 1200 req/min |
| `/fapi/v1/openInterest` | Futures open interest | 500 req/min |
| `/fapi/v1/fundingRate` | Funding rate history | 500 req/min |

```bash
# Example: 24h ticker for BTCUSDT
curl "https://api.binance.com/api/v3/ticker/24hr?symbol=BTCUSDT"

# Example: Funding rates
curl "https://fapi.binance.com/fapi/v1/fundingRate?symbol=BTCUSDT&limit=10"
```

**Use Cases:** Real-time prices, order book data, funding rates, open interest

---

### 3. Etherscan API

**Base URL:** `https://api.etherscan.io/api`

Free tier: 5 calls/sec. Requires free API key.

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| `?module=gastracker&action=gasoracle` | Gas price oracle | 5 req/sec |
| `?module=stats&action=ethprice` | ETH price | 5 req/sec |
| `?module=stats&action=ethsupply2` | ETH total supply | 5 req/sec |
| `?module=account&action=balance` | Address balance | 5 req/sec |
| `?module=account&action=tokentx` | ERC-20 transfers | 5 req/sec |

```bash
# Example: Gas oracle
curl "https://api.etherscan.io/api?module=gastracker&action=gasoracle&apikey=YOUR_KEY"
```

**Use Cases:** Gas tracking (already using Alternative.me), whale watching, token transfers

---

### 4. CoinMarketCap (Free Tier)

**Base URL:** `https://pro-api.coinmarketcap.com`

Free tier: 10,000 credits/month (~330/day). Requires API key.

| Endpoint | Description | Credits |
|----------|-------------|---------|
| `/v1/cryptocurrency/listings/latest` | Top coins listing | 1 |
| `/v1/cryptocurrency/quotes/latest` | Price quotes | 1 per coin |
| `/v1/global-metrics/quotes/latest` | Global market stats | 1 |
| `/v1/cryptocurrency/categories` | Category list | 1 |
| `/v1/fear-and-greed/latest` | Fear & Greed index | 1 |

**Use Cases:** Alternative market data source, category rankings

---

### 5. Messari API

**Base URL:** `https://data.messari.io/api`

Free tier: 20 requests/minute, no key required for basic endpoints.

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| `/v1/assets` | All assets list | 20 req/min |
| `/v1/assets/{symbol}/profile` | Asset profile/fundamentals | 20 req/min |
| `/v1/assets/{symbol}/metrics` | Asset metrics | 20 req/min |
| `/v2/assets/{symbol}/timeseries/price` | Price timeseries | 20 req/min |
| `/v1/news` | News feed | 20 req/min |

```bash
# Example: Bitcoin profile
curl "https://data.messari.io/api/v1/assets/btc/profile"

# Example: Market metrics
curl "https://data.messari.io/api/v1/assets/btc/metrics"
```

**Use Cases:** Fundamental data, project profiles, on-chain metrics, news

---

### 6. Blockchain.com API

**Base URL:** `https://api.blockchain.info`

No authentication required. Bitcoin-specific data.

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| `/stats` | Bitcoin network stats | Generous |
| `/rawblock/{hash}` | Block data | Generous |
| `/rawtx/{hash}` | Transaction data | Generous |
| `/q/hashrate` | Network hashrate | Generous |
| `/q/getdifficulty` | Mining difficulty | Generous |
| `/q/24hrbtc` | BTC sent last 24h | Generous |

```bash
# Example: Bitcoin stats
curl "https://api.blockchain.info/stats"
```

**Use Cases:** Bitcoin on-chain data, network health, mining stats

---

### 7. GlassNode (Limited Free)

**Base URL:** `https://api.glassnode.com`

Limited free tier with API key. Premium for full access.

| Metric Category | Examples |
|-----------------|----------|
| Addresses | Active, new, with balance |
| Mining | Hashrate, difficulty, revenue |
| Market | MVRV, SOPR, NVT |
| Supply | Circulating, liquid, illiquid |

**Use Cases:** Advanced on-chain analytics (limited free data)

---

### 8. CoinPaprika API

**Base URL:** `https://api.coinpaprika.com/v1`

Free, no authentication required. 10 requests/second.

| Endpoint | Description | Rate Limit |
|----------|-------------|------------|
| `/coins` | All coins list | 10 req/sec |
| `/coins/{id}` | Coin details | 10 req/sec |
| `/coins/{id}/ohlcv/today` | Today's OHLCV | 10 req/sec |
| `/tickers` | All tickers | 10 req/sec |
| `/global` | Global market data | 10 req/sec |
| `/exchanges` | All exchanges | 10 req/sec |

```bash
# Example: Global market data
curl "https://api.coinpaprika.com/v1/global"

# Example: Bitcoin ticker
curl "https://api.coinpaprika.com/v1/tickers/btc-bitcoin"
```

**Use Cases:** Alternative to CoinGecko, exchange data

---

### 9. Coinglass API

**Base URL:** `https://open-api.coinglass.com/public/v2`

Free public endpoints for derivatives data.

| Endpoint | Description |
|----------|-------------|
| `/open_interest` | Open interest across exchanges |
| `/funding` | Funding rates |
| `/liquidation_history` | Liquidation history |
| `/long_short` | Long/short ratio |

```bash
# Example: Open interest
curl "https://open-api.coinglass.com/public/v2/open_interest?symbol=BTC"
```

**Use Cases:** Derivatives data, liquidations, funding rates, sentiment

---

### 10. NFT Data Sources

#### OpenSea API (Limited Free)
- Base URL: `https://api.opensea.io/api/v2`
- Requires API key, free tier available
- Collection stats, floor prices, sales

#### NFTPort (Free Tier)
- Base URL: `https://api.nftport.xyz`
- 50 requests/day free
- Multi-chain NFT data

---

## Integration Priority Matrix

| Source | Priority | Effort | Value Add |
|--------|----------|--------|-----------|
| Binance Public API | 🔴 High | Low | Real-time prices, derivatives |
| CryptoCompare | 🔴 High | Medium | Historical data, social |
| Messari | 🟡 Medium | Low | Fundamentals, news |
| CoinPaprika | 🟡 Medium | Low | Redundancy, exchange data |
| Coinglass | 🟡 Medium | Medium | Derivatives analytics |
| Blockchain.com | 🟢 Low | Low | BTC on-chain |
| Etherscan | 🟢 Low | Medium | ETH on-chain |
| NFT Sources | 🟢 Low | High | NFT markets |

---

## Recommended Integration Approach

1. **Start with Binance Public API** - No auth, high limits, real-time data
2. **Add CryptoCompare** - Fill historical data gaps
3. **Integrate Messari** - Add fundamental data layer
4. **Add Coinglass** - Enhance derivatives features
5. **Consider NFT sources** - If expanding to NFT market data
