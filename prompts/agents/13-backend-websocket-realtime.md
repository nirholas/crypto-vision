# Prompt 13 — Backend: WebSocket & Real-Time Feeds

## Context

You are working on the real-time data layer of crypto-vision. The API server (port 8080) has WebSocket support:

- `src/routes/ws.ts` — WebSocket route handler
- `src/lib/ws.ts` — WebSocket management utilities
- `@hono/node-ws` — Hono WebSocket adapter
- `ws` — Node.js WebSocket library

The dashboard at `apps/dashboard/` needs live data. The data workers in `src/workers/` periodically fetch fresh data. The connection between workers → WebSocket → dashboard clients needs to be solid.

## Task

### 1. Complete the WebSocket Server (`src/routes/ws.ts`)

Implement a production WebSocket server:

```typescript
// WebSocket endpoint: ws://localhost:8080/ws
//
// Client subscribes by sending:
//   { "type": "subscribe", "channels": ["prices", "trades", "news", "alerts", "gas"] }
//   { "type": "unsubscribe", "channels": ["news"] }
//   { "type": "ping" }
//
// Server sends:
//   { "type": "price", "data": { "bitcoin": { "usd": 65000, "change24h": 2.5 }, ... } }
//   { "type": "trade", "data": { "exchange": "binance", "pair": "BTC/USDT", "price": 65000, ... } }
//   { "type": "news", "data": { "title": "...", "source": "...", "url": "..." } }
//   { "type": "alert", "data": { "coinId": "bitcoin", "type": "price_above", "value": 65000 } }
//   { "type": "gas", "data": { "eth": { "slow": 10, "standard": 15, "fast": 25 } } }
//   { "type": "pong" }
//   { "type": "error", "message": "Unknown channel: foo" }
//
// Features:
//   - Per-client channel subscriptions
//   - Heartbeat: server sends ping every 30s, client must respond within 10s
//   - Auto-disconnect stale clients
//   - Connection auth: optional API key in query param or first message
//   - Rate limit: max 100 messages/min from client
//   - Backpressure: drop messages if client buffer is full
```

### 2. Create the Channel Manager (`src/lib/ws-channels.ts`)

```typescript
// ChannelManager manages WebSocket subscriptions and message routing
//
// Channels:
//   "prices" — Top 100 coin prices, broadcast every 30s
//   "prices:{coinId}" — Specific coin price, broadcast every 10s
//   "trades" — Large trades across exchanges, broadcast as they arrive
//   "trades:{exchange}" — Trades from specific exchange
//   "news" — Breaking news, broadcast as they arrive
//   "gas" — Multi-chain gas prices, broadcast every 30s
//   "alerts" — User-specific alerts (requires auth)
//   "market" — Market-wide events (new ATH, large liquidations)
//   "anomaly" — Anomaly detection alerts
//
// Methods:
//   subscribe(clientId, channel)
//   unsubscribe(clientId, channel)
//   broadcast(channel, data) — send to all subscribers
//   getSubscriberCount(channel) — for monitoring
//   disconnectClient(clientId)
```

### 3. Wire Workers to WebSocket

The data workers in `src/workers/` already fetch data periodically. Wire them to broadcast via WebSocket:

**`src/workers/ingest-market.ts`** (every 2 min):
- After fetching CoinGecko data → broadcast to "prices" channel
- Extract top movers → broadcast to "market" channel

**`src/workers/ingest-news.ts`** (every 5 min):
- After fetching news → broadcast new items to "news" channel

**`src/workers/ingest-dex.ts`** (every 2 min):
- After fetching DEX data → broadcast large trades to "trades" channel

**`src/workers/ingest-onchain.ts`** (every 5 min):
- After fetching gas prices → broadcast to "gas" channel

### 4. Create Binance WebSocket Feed (`src/sources/binance-ws.ts`)

Connect to Binance WebSocket for real-time trade data:

```typescript
// Binance WebSocket streams:
//   wss://stream.binance.com:9443/ws/btcusdt@trade
//   wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade
//
// Subscribe to top 20 pairs by volume
// Aggregate trades over 1-second windows to avoid message flooding
// Forward aggregated trades to WebSocket ChannelManager
// Reconnect on disconnect with exponential backoff
// Handle Binance-specific errors (ban detection, IP limit)
```

### 5. WebSocket Monitoring

Add WebSocket metrics to `src/lib/metrics.ts`:
- `ws_connections_total` — Total WebSocket connections (counter)
- `ws_connections_active` — Current active connections (gauge)
- `ws_messages_sent_total` — Messages sent (counter by channel)
- `ws_messages_received_total` — Messages received (counter by type)
- `ws_errors_total` — WebSocket errors (counter)
- `ws_message_latency_ms` — Message delivery latency (histogram)

### 6. Dashboard WebSocket Client

Create `apps/dashboard/src/lib/websocket.ts`:
```typescript
// WebSocket client for the dashboard
//
// Features:
//   - Auto-connect on app start
//   - Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
//   - Channel subscribe/unsubscribe
//   - Connection status events (connected, disconnected, reconnecting)
//   - Message parsing with type safety
//   - Heartbeat handling (respond to pings)
//   - Buffer messages during reconnection, replay after reconnect
//
// Usage:
//   const ws = createWebSocketClient('ws://localhost:8080/ws');
//   ws.subscribe('prices');
//   ws.on('price', (data) => { ... });
//   ws.on('connectionChange', (status) => { ... });
```

## Technical Requirements

- Use native Node.js `ws` library (already installed)
- WebSocket upgrades via `@hono/node-ws`
- Message serialization: JSON
- Max message size: 64KB
- Max connections: 1000 (configurable)
- Memory-efficient: use shared buffers for broadcast messages
- Graceful shutdown: close all connections on SIGTERM
- No `any` types

## Verification

1. WebSocket server starts with the API server
2. Client can connect, subscribe to "prices", receive price updates
3. Binance WS feed connects and relays aggregated trades
4. Workers broadcast to WebSocket after data refresh
5. Dashboard client auto-reconnects after disconnection
6. Metrics track connection count and message throughput
7. `npm run typecheck` passes
