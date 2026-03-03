# Binance.US MCP Server - Tools Reference

Complete reference for all MCP tools provided by the Binance.US server.

## Table of Contents

- [General Tools](#general-tools)
- [Market Data Tools](#market-data-tools)
- [Error Handling](#error-handling)
- [Rate Limits](#rate-limits)

---

## General Tools

System connectivity and exchange information endpoints.

### `binance_us_ping`

Test connectivity to the Binance.US API.

**Parameters:** None

**Returns:** Empty object `{}` if successful

**Example Response:**
```
Binance.US API connection successful. Response: {}
```

---

### `binance_us_server_time`

Get the current server time from Binance.US exchange.

**Parameters:** None

**Returns:** Server timestamp in milliseconds and ISO format

**Example Response:**
```
Binance.US server time: 2026-01-20T15:30:00.000Z (1737387000000)
```

---

### `binance_us_system_status`

Check if Binance.US system is under maintenance.

**Authentication:** SIGNED (requires API key and secret)

**Parameters:** None

**Returns:**
- `status: 0` = Normal operation
- `status: 1` = System maintenance

**Example Response:**
```
Binance.US system status: Normal (0)
```

---

### `binance_us_exchange_info`

Get current exchange trading rules and trading pair information.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | No | Single trading pair (e.g., "BTCUSD") |
| `symbols` | string[] | No | Array of trading pairs |
| `permissions` | string[] | No | Filter by permissions (default: ["SPOT"]) |

> **Note:** `symbol` and `symbols` are mutually exclusive.

**Example Usage:**
```json
{
  "symbol": "BTCUSD"
}
```

**Returns:** Exchange info including timezone, server time, rate limits, and symbol details.

---

## Market Data Tools

Real-time market data endpoints. All market data tools are public (no authentication required).

### `binance_us_order_book`

Get order book depth for a trading pair.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✅ Yes | Trading pair symbol (e.g., "BTCUSD") |
| `limit` | number | No | Depth limit. Valid: 5, 10, 20, 50, 100, 500, 1000, 5000 (default: 100) |

**Example Usage:**
```json
{
  "symbol": "BTCUSD",
  "limit": 20
}
```

**Response Summary Includes:**
- Total bid/ask levels
- Best bid price and quantity
- Best ask price and quantity
- Bid-ask spread

---

### `binance_us_recent_trades`

Get recent trades for a trading pair.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✅ Yes | Trading pair symbol |
| `limit` | number | No | Number of trades (1-1000, default: 500) |

**Example Usage:**
```json
{
  "symbol": "ETHUSD",
  "limit": 100
}
```

**Response Includes:**
- Trade ID, price, quantity
- Quote quantity
- Timestamp
- Buyer/seller maker indicator

---

### `binance_us_historical_trades`

Get older trades for a trading pair.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✅ Yes | Trading pair symbol |
| `limit` | number | No | Number of trades (1-1000, default: 500) |
| `fromId` | number | No | Trade ID to fetch from |

**Example Usage:**
```json
{
  "symbol": "BTCUSD",
  "fromId": 123456789,
  "limit": 100
}
```

---

### `binance_us_agg_trades`

Get compressed/aggregate trades. Trades that fill at the same time, from the same order, at the same price will be aggregated.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✅ Yes | Trading pair symbol |
| `fromId` | number | No | Aggregate trade ID to fetch from |
| `startTime` | number | No | Start timestamp in ms |
| `endTime` | number | No | End timestamp in ms |
| `limit` | number | No | Number of trades (1-1000, default: 500) |

**Example Usage:**
```json
{
  "symbol": "BTCUSD",
  "startTime": 1737300000000,
  "endTime": 1737386400000,
  "limit": 500
}
```

**Response Summary Includes:**
- Aggregate ID range (first to last)
- Time range (ISO format)
- Latest trade price

---

### `binance_us_klines`

Get candlestick/kline data for technical analysis.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✅ Yes | Trading pair symbol |
| `interval` | string | ✅ Yes | Kline interval (see below) |
| `startTime` | number | No | Start timestamp in ms |
| `endTime` | number | No | End timestamp in ms |
| `timeZone` | string | No | Timezone offset (default: "0", UTC) |
| `limit` | number | No | Number of klines (1-1000, default: 500) |

**Valid Intervals:**
```
1s, 1m, 3m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 1w, 1M
```

**Example Usage:**
```json
{
  "symbol": "BTCUSD",
  "interval": "1h",
  "limit": 24
}
```

**Response Includes Formatted Klines:**
```json
{
  "openTime": 1737300000000,
  "openTimeISO": "2026-01-19T12:00:00.000Z",
  "open": "42000.00",
  "high": "42500.00",
  "low": "41800.00",
  "close": "42300.00",
  "volume": "123.45678",
  "closeTime": 1737303599999,
  "closeTimeISO": "2026-01-19T12:59:59.999Z",
  "quoteVolume": "5189012.34",
  "trades": 1234,
  "takerBuyBaseVolume": "67.89012",
  "takerBuyQuoteVolume": "2856789.12"
}
```

**Summary Statistics:**
- Period high/low
- Total volume
- Latest OHLC values

---

### `binance_us_avg_price`

Get current 5-minute rolling weighted average price.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | ✅ Yes | Trading pair symbol |

**Example Response:**
```
Average Price for BTCUSD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Minutes: 5
Price: 42150.12345678
```

---

### `binance_us_ticker_24hr`

Get 24-hour price change statistics.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | No | Single trading pair |
| `symbols` | string[] | No | Array of trading pairs |
| `type` | string | No | "FULL" (default) or "MINI" |

> **Note:** If no symbol specified, returns all tickers (high weight).

**Example Usage:**
```json
{
  "symbol": "BTCUSD",
  "type": "FULL"
}
```

**Full Response Includes:**
- Price change (absolute and percent)
- Weighted average price
- Previous close price
- Last price and quantity
- Bid/ask prices and quantities
- Open, high, low, close prices
- Volume (base and quote)
- Open/close times
- First/last trade IDs
- Trade count

---

### `binance_us_ticker_price`

Get current price for symbol(s).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | No | Single trading pair |
| `symbols` | string[] | No | Array of trading pairs |

**Example Usage:**
```json
{
  "symbols": ["BTCUSD", "ETHUSD", "SOLUSD"]
}
```

**Response:**
```json
[
  { "symbol": "BTCUSD", "price": "42150.00" },
  { "symbol": "ETHUSD", "price": "2850.00" },
  { "symbol": "SOLUSD", "price": "98.50" }
]
```

---

### `binance_us_ticker_book`

Get best bid/ask prices and quantities (order book ticker).

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | No | Single trading pair |
| `symbols` | string[] | No | Array of trading pairs |

**Example Response:**
```json
{
  "symbol": "BTCUSD",
  "bidPrice": "42148.00",
  "bidQty": "1.25000000",
  "askPrice": "42152.00",
  "askQty": "0.87500000"
}
```

**Summary Includes:**
- Spread calculation (ask - bid)

---

### `binance_us_rolling_window`

Get rolling window price change statistics with customizable window size.

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `symbol` | string | No | Single trading pair |
| `symbols` | string[] | No | Array of trading pairs |
| `windowSize` | string | No | Window size (default: "1d") |
| `type` | string | No | "FULL" (default) or "MINI" |

**Valid Window Sizes:**
```
1m, 2m, 3m, 4m, 5m, 15m, 30m, 1h, 2h, 4h, 6h, 8h, 12h, 1d, 3d, 7d
```

**Example Usage:**
```json
{
  "symbol": "BTCUSD",
  "windowSize": "4h",
  "type": "FULL"
}
```

---

## Error Handling

All tools implement comprehensive error handling:

### Error Types

| Error Class | Description |
|-------------|-------------|
| `BinanceUsApiError` | Standard API errors with code and message |
| `RateLimitError` | Rate limit exceeded (HTTP 429) |
| `IpBanError` | IP banned for excessive requests (HTTP 418) |

### Error Response Format

```json
{
  "content": [{
    "type": "text",
    "text": "Binance.US API Error (Code -1121): Invalid symbol."
  }],
  "isError": true
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| -1000 | Unknown error |
| -1001 | Disconnected |
| -1002 | Unauthorized |
| -1003 | Too many requests |
| -1015 | Too many orders |
| -1021 | Timestamp outside recvWindow |
| -1022 | Invalid signature |
| -1100 | Illegal characters in parameter |
| -1101 | Too many parameters |
| -1102 | Mandatory parameter missing |
| -1103 | Unknown parameter |
| -1121 | Invalid symbol |
| -2010 | New order rejected |
| -2011 | Cancel rejected |
| -2013 | Order does not exist |
| -2014 | Bad API key format |
| -2015 | Rejected MBX key |

---

## Rate Limits

Binance.US API has several rate limit types:

### Request Limits

| Type | Limit | Window |
|------|-------|--------|
| REQUEST_WEIGHT | 1200 | 1 minute |
| ORDERS | 10 | 1 second |
| ORDERS | 100,000 | 1 day |

### Endpoint Weights

| Endpoint | Weight |
|----------|--------|
| `/api/v3/ping` | 1 |
| `/api/v3/time` | 1 |
| `/api/v3/exchangeInfo` | 20 |
| `/api/v3/depth` (limit ≤100) | 5 |
| `/api/v3/depth` (limit 500) | 10 |
| `/api/v3/depth` (limit 1000) | 20 |
| `/api/v3/depth` (limit 5000) | 50 |
| `/api/v3/trades` | 10 |
| `/api/v3/historicalTrades` | 10 |
| `/api/v3/aggTrades` | 2 |
| `/api/v3/klines` | 2 |
| `/api/v3/avgPrice` | 2 |
| `/api/v3/ticker/24hr` (single) | 2 |
| `/api/v3/ticker/24hr` (all) | 80 |
| `/api/v3/ticker/price` (single) | 2 |
| `/api/v3/ticker/price` (all) | 4 |
| `/api/v3/ticker/bookTicker` (single) | 2 |
| `/api/v3/ticker/bookTicker` (all) | 4 |

### Rate Limit Headers

The server tracks and handles rate limit headers:

- `X-MBX-USED-WEIGHT-1M` - Used weight in current minute
- `Retry-After` - Seconds until rate limit resets (on 429)

---

## Authentication

### Public Endpoints (No Auth)
- All General tools except `system_status`
- All Market Data tools

### Signed Endpoints (HMAC SHA256)
- `binance_us_system_status`
- Trading tools (not documented here)
- Account tools (not documented here)

### Signature Generation

For signed requests, the server automatically:
1. Adds `timestamp` parameter
2. Applies `recvWindow` (default: 5000ms)
3. Generates HMAC SHA256 signature
4. Includes `X-MBX-APIKEY` header

---

## Best Practices

1. **Use specific symbols** instead of fetching all tickers to reduce weight
2. **Cache exchange info** - it changes infrequently
3. **Use appropriate intervals** for klines based on your analysis timeframe
4. **Implement exponential backoff** for rate limit errors
5. **Monitor weight usage** via response headers
6. **Use aggregate trades** for compressed trade history
7. **Prefer rolling window** over 24hr ticker for custom timeframes
