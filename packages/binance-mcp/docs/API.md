# API Reference

Technical reference for the Binance.US API client implementation.

## Base Configuration

```typescript
const BINANCE_US_CONFIG = {
  BASE_URL: "https://api.binance.us",
  WS_URL: "wss://stream.binance.us:9443",
  DEFAULT_RECV_WINDOW: 5000,
  MAX_RECV_WINDOW: 60000,
};
```

## Authentication

### API Key Types

| Type | Header | Signature Required | Use Case |
|------|--------|-------------------|----------|
| None | - | No | Public endpoints |
| API Key Only | X-MBX-APIKEY | No | MARKET_DATA, USER_STREAM |
| Signed | X-MBX-APIKEY | Yes (HMAC SHA256) | TRADE, USER_DATA |

### Signature Generation

Binance.US uses HMAC SHA256 signatures. The signature is generated from:

1. **Query string parameters** (for GET/DELETE)
2. **Request body** (for POST/PUT)
3. **Combined** (query + body for mixed requests)

```typescript
import crypto from "crypto";

function generateSignature(queryString: string, secret: string): string {
  return crypto
    .createHmac("sha256", secret)
    .update(queryString)
    .digest("hex");
}
```

### Timestamp Requirements

- All signed requests must include `timestamp` parameter
- Timestamp must be within `recvWindow` of server time
- Default `recvWindow`: 5000ms, max: 60000ms

```
if (timestamp < (serverTime + 1000) && 
    (serverTime - timestamp) <= recvWindow) {
  // Valid request
}
```

## Request Functions

### `binanceUsRequest(method, path, params, signed, apiKeyRequired)`

Main request helper that handles all endpoint types.

```typescript
async function binanceUsRequest(
  method: "GET" | "POST" | "DELETE",
  path: string,
  params?: Record<string, any>,
  signed?: boolean,
  apiKeyRequired?: boolean
): Promise<any>
```

### `makeSignedRequest(method, endpoint, params, recvWindow)`

For authenticated endpoints requiring signature.

```typescript
async function makeSignedRequest(
  method: "GET" | "POST" | "PUT" | "DELETE",
  endpoint: string,
  params?: Record<string, any>,
  recvWindow?: number
): Promise<any>
```

### `makePublicRequest(method, endpoint, params)`

For public endpoints (no authentication).

```typescript
async function makePublicRequest(
  method: "GET",
  endpoint: string,
  params?: Record<string, any>
): Promise<any>
```

### `makeMarketDataRequest(method, endpoint, params)`

For MARKET_DATA endpoints (API key, no signature).

## Error Handling

### Error Classes

```typescript
class BinanceUsApiError extends Error {
  code: number;
  httpStatus: number;
  rateLimitInfo?: RateLimitInfo;
}

class RateLimitError extends BinanceUsApiError {
  retryAfter: number;
}

class IpBanError extends BinanceUsApiError {
  retryAfter: number;
}
```

### HTTP Status Codes

| Status | Meaning | Action |
|--------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad Request | Check parameters |
| 403 | WAF Limit | Reduce request frequency |
| 409 | Partial Success | Check cancelReplace results |
| 418 | IP Banned | Wait for `Retry-After` |
| 429 | Rate Limited | Wait and retry |
| 5XX | Server Error | Retry with backoff |

### Common Error Codes

```typescript
const ERROR_CODES = {
  UNKNOWN: -1000,
  DISCONNECTED: -1001,
  UNAUTHORIZED: -1002,
  TOO_MANY_REQUESTS: -1003,
  TIMEOUT: -1007,
  INVALID_TIMESTAMP: -1021,
  INVALID_SIGNATURE: -1022,
  BAD_SYMBOL: -1121,
  NEW_ORDER_REJECTED: -2010,
  CANCEL_REJECTED: -2011,
  NO_SUCH_ORDER: -2013,
  BAD_API_KEY_FMT: -2014,
  REJECTED_MBX_KEY: -2015,
  ORDER_ARCHIVED: -2026,
};
```

## Rate Limits

### Limit Types

| Type | Limit | Window |
|------|-------|--------|
| REQUEST_WEIGHT | 1200 | 1 minute |
| ORDERS | 10 | 1 second |
| ORDERS | 100,000 | 1 day |
| RAW_REQUESTS | 5000 | 5 minutes |

### Weight by Endpoint

| Endpoint | Weight |
|----------|--------|
| GET /api/v3/ping | 1 |
| GET /api/v3/depth (limit 100) | 5 |
| GET /api/v3/depth (limit 5000) | 50 |
| GET /api/v3/trades | 1 |
| GET /api/v3/klines | 1 |
| GET /api/v3/ticker/24hr (all) | 40 |
| POST /api/v3/order | 1 |
| GET /api/v3/account | 10 |

### Rate Limit Headers

```
X-MBX-USED-WEIGHT-1M: 15
X-MBX-ORDER-COUNT-10S: 2
X-MBX-ORDER-COUNT-1D: 50
Retry-After: 60
```

## TypeScript Interfaces

### Order Types

```typescript
type OrderType = 
  | "LIMIT" 
  | "MARKET" 
  | "STOP_LOSS_LIMIT" 
  | "TAKE_PROFIT_LIMIT" 
  | "LIMIT_MAKER";

type OrderSide = "BUY" | "SELL";

type TimeInForce = "GTC" | "IOC" | "FOK";

type OrderStatus = 
  | "NEW" 
  | "PARTIALLY_FILLED" 
  | "FILLED" 
  | "CANCELED" 
  | "REJECTED" 
  | "EXPIRED" 
  | "EXPIRED_IN_MATCH";
```

### Response Types

```typescript
interface Order {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: OrderStatus;
  type: OrderType;
  side: OrderSide;
  time: number;
}

interface AccountInfo {
  balances: Balance[];
  canTrade: boolean;
  canWithdraw: boolean;
  canDeposit: boolean;
  makerCommission: number;
  takerCommission: number;
}

interface Balance {
  asset: string;
  free: string;
  locked: string;
}
```

### Kline Format

```typescript
type Kline = [
  number,   // Open time
  string,   // Open price
  string,   // High price
  string,   // Low price
  string,   // Close price
  string,   // Volume
  number,   // Close time
  string,   // Quote asset volume
  number,   // Number of trades
  string,   // Taker buy base volume
  string,   // Taker buy quote volume
  string    // Ignore
];
```

## WebSocket Streams

### Connection URLs

```
Single stream: wss://stream.binance.us:9443/ws/<streamName>
Multiple: wss://stream.binance.us:9443/stream?streams=<s1>/<s2>
User data: wss://stream.binance.us:9443/ws/<listenKey>
```

### Available Streams

| Stream | Format | Description |
|--------|--------|-------------|
| Trade | `<symbol>@trade` | Real-time trades |
| Kline | `<symbol>@kline_<interval>` | Candlestick updates |
| Ticker | `<symbol>@ticker` | 24hr ticker |
| Mini Ticker | `<symbol>@miniTicker` | Mini ticker |
| Book Ticker | `<symbol>@bookTicker` | Best bid/ask |
| Depth | `<symbol>@depth<levels>` | Order book (5/10/20) |
| Diff Depth | `<symbol>@depth` | Order book updates |

### User Data Stream Events

| Event | Description |
|-------|-------------|
| `outboundAccountPosition` | Balance changes |
| `balanceUpdate` | Deposits/withdrawals |
| `executionReport` | Order updates |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| BINANCE_US_API_KEY | For auth endpoints | Your API key |
| BINANCE_US_API_SECRET | For signed endpoints | Your API secret |

## Utility Functions

```typescript
// Check if credentials are configured
function hasApiCredentials(): boolean

// Get current timestamp
function getTimestamp(): number

// Build query string from params
function buildQueryString(params: Record<string, any>): string

// Format kline array to object
function formatKline(kline: KlineRaw): FormattedKline

// Format aggregate trade
function formatAggTrade(trade: AggTradeResponse): FormattedAggTrade
```
