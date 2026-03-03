# Binance.US API Client Architecture

Technical documentation for the Binance.US MCP server's API client implementation.

## Overview

The API client (`src/config/binanceUsClient.ts`) provides a unified interface for all Binance.US API interactions with built-in authentication, error handling, and type safety.

## Configuration

### Environment Variables

```bash
BINANCE_US_API_KEY=your_api_key_here
BINANCE_US_API_SECRET=your_api_secret_here
```

### Constants

```typescript
const BASE_URL = "https://api.binance.us";
const WS_BASE_URL = "wss://stream.binance.us:9443";
const DEFAULT_RECV_WINDOW = 5000;  // 5 seconds
const MAX_RECV_WINDOW = 60000;     // 60 seconds
```

## Core Functions

### `binanceUsRequest(method, path, params, signed)`

Unified request function for all API calls.

```typescript
async function binanceUsRequest<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params: Record<string, any> = {},
  signed: boolean = false
): Promise<T>
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `method` | string | HTTP method (GET, POST, DELETE) |
| `path` | string | API endpoint path |
| `params` | object | Request parameters |
| `signed` | boolean | Whether request requires HMAC signature |

**Behavior:**
1. For signed requests, adds `timestamp` and `signature`
2. For GET requests, appends params to query string
3. For POST/DELETE, sends params in request body
4. Includes `X-MBX-APIKEY` header for authenticated requests
5. Parses rate limit headers
6. Handles errors with appropriate error classes

### `generateSignature(queryString)`

Generates HMAC SHA256 signature for signed requests.

```typescript
function generateSignature(queryString: string): string
```

Uses the `BINANCE_US_API_SECRET` environment variable to create the signature.

## Type Definitions

### Kline Data

```typescript
// Raw API response (array format)
type KlineRaw = [
  number,  // Open time
  string,  // Open price
  string,  // High price
  string,  // Low price
  string,  // Close price
  string,  // Volume
  number,  // Close time
  string,  // Quote asset volume
  number,  // Number of trades
  string,  // Taker buy base asset volume
  string,  // Taker buy quote asset volume
  string   // Ignore
];

// Formatted for readability
interface FormattedKline {
  openTime: number;
  openTimeISO: string;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  closeTimeISO: string;
  quoteVolume: string;
  trades: number;
  takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string;
}
```

### Aggregate Trade

```typescript
// Raw API response
interface AggTradeResponse {
  a: number;   // Aggregate trade ID
  p: string;   // Price
  q: string;   // Quantity
  f: number;   // First trade ID
  l: number;   // Last trade ID
  T: number;   // Timestamp
  m: boolean;  // Was the buyer the maker?
  M: boolean;  // Was the trade the best price match?
}

// Formatted
interface FormattedAggTrade {
  aggTradeId: number;
  price: string;
  quantity: string;
  firstTradeId: number;
  lastTradeId: number;
  timestamp: number;
  timestampISO: string;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}
```

### Trade Response

```typescript
interface TradeResponse {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}
```

### Order Book

```typescript
interface OrderBookResponse {
  lastUpdateId: number;
  bids: [string, string][];  // [price, quantity][]
  asks: [string, string][];  // [price, quantity][]
}
```

### 24hr Ticker

```typescript
interface Ticker24hrResponse {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}
```

## Error Classes

### BinanceUsApiError

Base error class for API errors.

```typescript
class BinanceUsApiError extends Error {
  constructor(
    public code: number,
    message: string,
    public response?: any
  ) {
    super(message);
    this.name = "BinanceUsApiError";
  }
}
```

**Usage:**
```typescript
throw new BinanceUsApiError(-1121, "Invalid symbol.", response);
```

### RateLimitError

Thrown when rate limit is exceeded (HTTP 429).

```typescript
class RateLimitError extends BinanceUsApiError {
  constructor(
    message: string,
    public retryAfter?: number,
    response?: any
  ) {
    super(-1003, message, response);
    this.name = "RateLimitError";
  }
}
```

**Properties:**
- `retryAfter` - Seconds until rate limit resets (from `Retry-After` header)

### IpBanError

Thrown when IP is banned for excessive requests (HTTP 418).

```typescript
class IpBanError extends BinanceUsApiError {
  constructor(
    message: string,
    public banDuration?: number,
    response?: any
  ) {
    super(-1015, message, response);
    this.name = "IpBanError";
  }
}
```

## Formatter Functions

### `formatKline(kline)`

Converts raw kline array to readable object.

```typescript
function formatKline(kline: KlineRaw): FormattedKline
```

**Example:**
```typescript
const raw = [1737300000000, "42000", "42500", "41800", "42300", "123.45", ...];
const formatted = formatKline(raw);
// {
//   openTime: 1737300000000,
//   openTimeISO: "2026-01-19T12:00:00.000Z",
//   open: "42000",
//   high: "42500",
//   ...
// }
```

### `formatAggTrade(trade)`

Converts raw aggregate trade to readable object.

```typescript
function formatAggTrade(trade: AggTradeResponse): FormattedAggTrade
```

## Validation Constants

### Order Book Limits

```typescript
const ORDER_BOOK_VALID_LIMITS = [5, 10, 20, 50, 100, 500, 1000, 5000];
```

### Kline Intervals

```typescript
const KLINE_INTERVALS = [
  "1s", "1m", "3m", "5m", "15m", "30m",
  "1h", "2h", "4h", "6h", "8h", "12h",
  "1d", "3d", "1w", "1M"
];
```

### Rolling Window Sizes

```typescript
const ROLLING_WINDOW_SIZES = [
  "1m", "2m", "3m", "4m", "5m", "15m", "30m",
  "1h", "2h", "4h", "6h", "8h", "12h",
  "1d", "3d", "7d"
];
```

### Limits

```typescript
const MAX_TRADES_LIMIT = 1000;
const MAX_KLINES_LIMIT = 1000;
```

## Request Flow

```
┌─────────────────┐
│   MCP Tool      │
│   (market.ts)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│binanceUsRequest │
│   - Add params  │
│   - Sign if req │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   fetch()       │
│  api.binance.us │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parse Response  │
│ - Check errors  │
│ - Handle limits │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return Data    │
│  (typed)        │
└─────────────────┘
```

## Signature Generation

For signed endpoints:

```
1. Create query string from params
2. Add timestamp=<current_ms>
3. Add recvWindow=5000
4. Generate HMAC SHA256 of query string using secret
5. Append signature=<hash> to params
```

**Example:**
```
Query:  symbol=BTCUSD&timestamp=1737387000000&recvWindow=5000
Secret: your_api_secret_here
Result: signature=abc123def456...
```

## HTTP Headers

### Request Headers

```
Content-Type: application/x-www-form-urlencoded
X-MBX-APIKEY: <api_key>  (for authenticated requests)
```

### Response Headers Tracked

```
X-MBX-USED-WEIGHT-1M: <used_weight>
Retry-After: <seconds>  (on 429)
```

## Best Practices

1. **Always use typed responses** - Import types from binanceUsClient
2. **Handle all error classes** - Check for RateLimitError and IpBanError specifically
3. **Validate inputs** - Use constants for valid intervals and limits
4. **Use formatters** - Transform raw data for better readability
5. **Monitor weight** - Track X-MBX-USED-WEIGHT-1M header
6. **Implement retry logic** - Use retryAfter from RateLimitError
