# WebSocket Real-Time Feeds

> Real-time streaming data via WebSocket connections — prices, Bitcoin network events, DEX trades, and anomaly alerts.

---

## Table of Contents

- [Overview](#overview)
- [Connection](#connection)
- [Topics](#topics)
  - [Prices](#prices)
  - [Bitcoin](#bitcoin)
  - [Trades](#trades)
  - [Alerts](#alerts)
- [Message Formats](#message-formats)
- [Architecture](#architecture)
  - [Price Throttling](#price-throttling)
  - [Multi-Instance Fan-Out](#multi-instance-fan-out)
  - [Reconnection](#reconnection)
- [Client Examples](#client-examples)
- [Configuration](#configuration)

---

## Overview

Crypto Vision provides four WebSocket topics for real-time data streaming:

| Topic | Endpoint | Upstream Source | Description |
|---|---|---|---|
| **Prices** | `/ws/prices` | CoinCap | Real-time crypto prices (5 Hz throttled) |
| **Bitcoin** | `/ws/bitcoin` | Mempool.space | Bitcoin blocks, transactions, mempool |
| **Trades** | `/ws/trades` | DexScreener | Live DEX trade events |
| **Alerts** | `/ws/alerts` | Internal | Anomaly detection alerts |

**Source file:** `src/lib/ws.ts` (860 lines)

---

## Connection

### Endpoint Format

```
ws://localhost:8080/ws/{topic}
wss://cryptocurrency.cv/ws/{topic}
```

### Example Connection

```javascript
const ws = new WebSocket('ws://localhost:8080/ws/prices');

ws.onopen = () => console.log('Connected');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(data);
};
ws.onclose = () => console.log('Disconnected');
ws.onerror = (err) => console.error('Error:', err);
```

### Connection Lifecycle

1. Client connects to a topic endpoint
2. Server registers the client in the topic subscription set
3. If this is the first subscriber for the topic, the upstream WebSocket connection is established
4. Data flows from upstream → server → all subscribed clients
5. When the last client disconnects from a topic, the upstream connection is closed

---

## Topics

### Prices

**Endpoint:** `/ws/prices`
**Upstream:** CoinCap WebSocket API (`wss://ws.coincap.io/prices?assets=ALL`)
**Throttle:** 5 Hz (200ms intervals)

Streams real-time cryptocurrency price updates. CoinCap can emit hundreds of ticks per second; the server throttles these to 5 Hz per-coin batches to prevent overwhelming clients (especially mobile devices).

**Message format:**

```json
{
  "type": "price",
  "data": {
    "bitcoin": "68452.31",
    "ethereum": "3521.44",
    "solana": "142.87"
  },
  "timestamp": "2026-03-04T12:00:00.200Z"
}
```

The `data` field contains a batch of the latest prices accumulated during the 200ms throttle window. Only coins with price changes are included.

---

### Bitcoin

**Endpoint:** `/ws/bitcoin`
**Upstream:** Mempool.space WebSocket API (`wss://mempool.space/api/v1/ws`)

Streams Bitcoin network events including new blocks, large transactions, and mempool statistics.

**Block message:**

```json
{
  "type": "block",
  "data": {
    "height": 890123,
    "hash": "00000000000000000002a3b8...",
    "timestamp": 1709568000,
    "size": 1234567,
    "txCount": 2847
  },
  "timestamp": "2026-03-04T12:00:00.000Z"
}
```

**Transaction message (large transactions only):**

```json
{
  "type": "transaction",
  "data": {
    "txid": "a1b2c3d4e5f6...",
    "value": 50.25,
    "fee": 0.00012
  },
  "timestamp": "2026-03-04T12:00:01.000Z"
}
```

**Mempool update:**

```json
{
  "type": "mempool",
  "data": {
    "count": 45000,
    "vsize": 120000000,
    "fees": {
      "fastest": 25,
      "halfHour": 18,
      "hour": 12,
      "economy": 6,
      "minimum": 2
    }
  },
  "timestamp": "2026-03-04T12:00:02.000Z"
}
```

---

### Trades

**Endpoint:** `/ws/trades`
**Upstream:** DexScreener WebSocket

Streams live DEX trade events across multiple chains and DEXes.

**Message format:**

```json
{
  "type": "trade",
  "data": {
    "pair": "SOL/USDC",
    "price": "142.87",
    "volume": "5000.00",
    "side": "buy"
  },
  "timestamp": "2026-03-04T12:00:00.500Z"
}
```

---

### Alerts

**Endpoint:** `/ws/alerts`
**Source:** Internal anomaly detection engine

Streams real-time anomaly detection alerts from the statistical anomaly engine (see [Anomaly Detection](ANOMALY_DETECTION.md)).

**Message format:**

```json
{
  "type": "anomaly",
  "data": {
    "id": "price_spike-bitcoin-1709568000000",
    "type": "price_spike",
    "severity": "warning",
    "asset": "bitcoin",
    "metric": "price_usd",
    "currentValue": 72450.12,
    "expectedRange": { "low": 66800.50, "high": 70200.30 },
    "deviation": 3.8,
    "message": "Price Spike: bitcoin price_usd = 72450.12 (+3.8σ from mean 68500.40)",
    "detectedAt": "2026-03-04T12:00:00.000Z",
    "detector": "statistical-mzs"
  },
  "timestamp": "2026-03-04T12:00:00.000Z"
}
```

---

## Message Formats

### TypeScript Interfaces

```typescript
interface PriceTick {
  type: 'price';
  data: Record<string, string>;  // coin → price as string
  timestamp: string;              // ISO 8601
}

interface BitcoinBlock {
  type: 'block';
  data: {
    height: number;
    hash: string;
    timestamp: number;
    size: number;
    txCount: number;
  };
  timestamp: string;
}

interface BitcoinTx {
  type: 'transaction';
  data: {
    txid: string;
    value: number;    // BTC
    fee: number;      // BTC
  };
  timestamp: string;
}

interface DexTrade {
  type: 'trade';
  data: {
    pair: string;
    price: string;
    volume: string;
    side: string;     // 'buy' | 'sell'
  };
  timestamp: string;
}

interface AnomalyAlert {
  type: 'anomaly';
  data: AnomalyEvent;
  timestamp: string;
}
```

---

## Architecture

### Price Throttling

CoinCap can emit hundreds of price updates per second across thousands of coins. Broadcasting all of these to clients (especially mobile) would waste bandwidth and CPU. The server implements per-coin throttling at 5 Hz (200ms intervals):

```
CoinCap WS ──→ pendingPrices Map ──→ flush timer (200ms) ──→ batch broadcast
               │                                               │
               │ BTC: 68452                                    │ { "bitcoin": "68452",
               │ ETH: 3521                                     │   "ethereum": "3521" }
               │ SOL: 142                                      │
               └───────────────────────────────────────────────┘
```

1. Incoming price ticks update a `Map<coin, latestPrice>` — only the most recent price is kept
2. Every 200ms, the map is drained and all accumulated prices are broadcast as a single batch
3. Clients receive at most 5 updates per second, each containing the latest prices for all coins that changed

This approach is inspired by [Pump.fun's React Native optimization](https://medium.com/@pumpfun) that achieved 10× startup improvement by throttling WebSocket updates.

### Multi-Instance Fan-Out

In production with multiple server instances behind a load balancer, WebSocket clients may connect to different instances. Redis Pub/Sub ensures all instances receive all updates:

```
Instance A ──→ Redis Pub/Sub ──→ Instance A (broadcast to local clients)
     ↑              │
     │              └──→ Instance B (broadcast to local clients)
     │              │
     │              └──→ Instance C (broadcast to local clients)
     │
Upstream WS
(CoinCap)
```

Only one instance maintains the upstream connection. When data arrives, the instance publishes to a Redis channel. All instances subscribe to that channel and broadcast to their local clients.

### Reconnection

Upstream WebSocket connections (CoinCap, Mempool.space, DexScreener) implement automatic reconnection with exponential backoff:

| Attempt | Delay |
|---|---|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5+ | 16s (max) |

A heartbeat/ping-pong mechanism detects stale connections and triggers reconnection proactively.

---

## Client Examples

### Browser (JavaScript)

```javascript
class CryptoWebSocket {
  constructor(topic) {
    this.url = `ws://localhost:8080/ws/${topic}`;
    this.connect();
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    this.ws.onclose = () => setTimeout(() => this.connect(), 3000);
  }

  onMessage(data) {
    console.log(data.type, data.data);
  }
}

// Usage
const prices = new CryptoWebSocket('prices');
const alerts = new CryptoWebSocket('alerts');
```

### Node.js

```typescript
import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:8080/ws/bitcoin');

ws.on('message', (raw: Buffer) => {
  const msg = JSON.parse(raw.toString());
  if (msg.type === 'block') {
    console.log(`New block #${msg.data.height} with ${msg.data.txCount} txs`);
  }
});
```

### React Hook

```tsx
function useCryptoPrices() {
  const [prices, setPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8080/ws/prices');
    ws.onmessage = (e) => {
      const tick = JSON.parse(e.data);
      if (tick.type === 'price') {
        setPrices(prev => ({ ...prev, ...tick.data }));
      }
    };
    return () => ws.close();
  }, []);

  return prices;
}
```

---

## Configuration

| Parameter | Location | Default | Description |
|---|---|---|---|
| Throttle frequency | `ws.ts` | 5 Hz | Price update throttle |
| Redis URL | `REDIS_URL` env var | — | Required for multi-instance fan-out |
| Reconnect max delay | `ws.ts` | 16s | Max backoff for upstream reconnection |

### Monitoring

The WebSocket system exposes metrics via:

- **Prometheus:** `active_websocket_connections` gauge
- **Health endpoint:** `/health` includes WebSocket stats (connection count per topic)
- **`wsStats()`** function returns detailed connection statistics
