# Anomaly Detection

> Real-time statistical anomaly detection across 16 event types using Modified Z-Score, EWMA, and rate-of-change algorithms.

---

## Table of Contents

- [Overview](#overview)
- [Algorithms](#algorithms)
- [Anomaly Types](#anomaly-types)
- [Configuration](#configuration)
- [Data Flow](#data-flow)
- [Processors](#processors)
- [API Endpoints](#api-endpoints)
- [WebSocket Alerts](#websocket-alerts)
- [State Persistence](#state-persistence)
- [Extending the Engine](#extending-the-engine)

---

## Overview

The anomaly detection engine continuously monitors incoming data from all 37 data sources and detects statistically significant deviations from normal patterns. When an anomaly is detected, it is:

1. **Broadcast** to WebSocket clients on the `alerts` topic in real-time
2. **Logged** to BigQuery (`anomaly_events` table) for historical analysis
3. **Stored** in an in-memory ring buffer (500 most recent) for the REST API
4. **Streamed** via Server-Sent Events for real-time dashboard integration

**Source files:**
- `src/lib/anomaly.ts` — Core engine, SlidingWindow, detector configs
- `src/lib/anomaly-processors.ts` — Data feed processors and handler registration
- `src/routes/anomaly.ts` — REST API and SSE endpoints

---

## Algorithms

### Modified Z-Score (MAD)

The primary detection algorithm uses the **Median Absolute Deviation (MAD)** instead of standard deviation, making it robust to outliers that would skew standard z-scores.

$$Z_{modified} = \frac{0.6745 \times (x - \tilde{x})}{MAD}$$

Where:
- $x$ = current value
- $\tilde{x}$ = median of the sliding window
- $MAD$ = median of absolute deviations from the median
- $0.6745$ = 75th percentile of the standard normal distribution (makes the score comparable to regular z-scores)

**Why MAD over standard deviation?** Crypto markets have fat-tailed distributions with extreme outliers. Standard deviation is heavily influenced by these outliers, making the z-score unreliable. MAD ignores outliers by construction, providing more stable anomaly thresholds.

### Exponentially Weighted Moving Average (EWMA)

Tracks the moving trend of the time series with an exponential decay factor:

$$EWMA_t = \alpha \cdot x_t + (1 - \alpha) \cdot EWMA_{t-1}$$

Default $\alpha = 0.1$, giving higher weight to recent data while retaining historical context.

### Rate of Change

Simple period-over-period percentage change:

$$ROC = \frac{x_t - x_{t-n}}{x_{t-n}} \times 100$$

Used for detecting sudden directional shifts.

---

## Anomaly Types

### 16 Monitored Event Types

| Type | Direction | Z-Score Threshold | Min Data Points | Cooldown | Description |
|---|---|---|---|---|---|
| `price_spike` | Positive only | 3.0 | 50 | 5 min | Abnormal upward price movement |
| `price_crash` | Negative only | -3.0 | 50 | 5 min | Abnormal downward price movement |
| `volume_surge` | Positive only | 3.5 | 30 | 15 min | Unusual volume increase |
| `volume_drop` | Negative only | -3.0 | 30 | 30 min | Unusual volume decrease |
| `tvl_drain` | Negative only | -2.5 | 20 | 30 min | TVL removal (potential rug/exploit) |
| `tvl_surge` | Positive only | 3.0 | 20 | 30 min | TVL influx to protocol |
| `gas_spike` | Positive only | 3.0 | 30 | 10 min | Ethereum gas price spike |
| `whale_movement` | Positive only | 3.0 | 10 | 5 min | Large wallet transfer detected |
| `stablecoin_depeg` | Both | 2.0 | 10 | 1 min | Stablecoin price deviation from peg |
| `liquidity_removal` | Negative only | -3.0 | 10 | 10 min | DEX liquidity withdrawn |
| `funding_rate_extreme` | Both | 3.0 | 20 | 30 min | Extreme perpetual funding rate |
| `open_interest_surge` | Positive only | 3.0 | 20 | 15 min | Sudden open interest increase |
| `exchange_outflow` | Positive only | 3.0 | 10 | 15 min | Large exchange withdrawal |
| `exchange_inflow` | Positive only | 3.0 | 10 | 15 min | Large exchange deposit |
| `correlation_break` | Both | 2.5 | 100 | 60 min | Cross-asset correlation breakdown |
| `volatility_spike` | Positive only | 3.0 | 30 | 15 min | Abnormal volatility increase |

### Severity Levels

Each anomaly type has a severity function that maps the z-score deviation to a severity level:

| Severity | Typical Condition | Example |
|---|---|---|
| `critical` | \|Z\| > 5× threshold | BTC price crashes 40% in 10 minutes |
| `warning` | \|Z\| > 3.5× threshold | Gas price spikes 5× above normal |
| `info` | \|Z\| > threshold | Volume increases 3× from average |

Special cases:
- `stablecoin_depeg` uses a lower threshold (2.0) because any depeg is always significant
- `correlation_break` requires 100 data points (more data needed for reliable correlation analysis) and always produces `warning` severity
- `tvl_drain` starts at 2.5× because protocol TVL exits warrant earlier alerting

### Directional Filtering

Anomaly types are classified into directional sets to prevent false positives:

- **Positive-only types**: `price_spike`, `volume_surge`, `tvl_surge`, `gas_spike`, `whale_movement`, `open_interest_surge`, `exchange_outflow`, `exchange_inflow`, `volatility_spike` — only fire when z-score is positive
- **Negative-only types**: `price_crash`, `volume_drop`, `tvl_drain`, `liquidity_removal` — only fire when z-score is negative
- **Both directions**: `stablecoin_depeg`, `funding_rate_extreme`, `correlation_break` — fire on any significant deviation

---

## Configuration

### Sliding Window

Each `(type, asset, metric)` triple maintains its own sliding window:

| Parameter | Default | Description |
|---|---|---|
| Window size | 1,000 | Maximum data points retained per metric |
| Min data points | 10-100 | Minimum before detection activates (per type) |

### Cooldowns

Each `(type, asset)` pair has an independent cooldown timer. After an anomaly fires, the same type for the same asset cannot fire again until the cooldown expires. This prevents alert fatigue during sustained unusual conditions.

### Adjusting Sensitivity

To make the engine more or less sensitive, adjust the z-score threshold in `DETECTOR_CONFIGS`:

- **Lower threshold** (e.g., 2.0) → more sensitive, more alerts, more false positives
- **Higher threshold** (e.g., 5.0) → less sensitive, fewer alerts, fewer false positives
- Default of 3.0 means the value must be ~3 standard deviations from the median to trigger

---

## Data Flow

```
┌──────────────┐    ┌──────────────────┐    ┌───────────────────┐
│ Data Sources │───→│ anomaly-         │───→│ Anomaly Engine    │
│ (CoinGecko,  │    │ processors.ts    │    │ (anomaly.ts)      │
│  DeFiLlama,  │    │                  │    │                   │
│  Binance...) │    │ processPrice()   │    │ sliding windows   │
│              │    │ processTVL()     │    │ modified z-score  │
│              │    │ processGas()     │    │ cooldown check    │
│              │    │ processWhale()   │    │ direction filter  │
│              │    │ processFunding() │    │                   │
│              │    │ processOI()      │    │ → AnomalyEvent    │
│              │    │ processStable()  │    │                   │
└──────────────┘    └──────────────────┘    └────────┬──────────┘
                                                     │
                                            dispatch to handlers
                                                     │
                              ┌───────────────────────┼───────────────────────┐
                              │                       │                       │
                    ┌─────────▼────────┐   ┌─────────▼────────┐   ┌─────────▼────────┐
                    │ WebSocket        │   │ BigQuery          │   │ Ring Buffer       │
                    │ Broadcast        │   │ Insert            │   │ (500 events)      │
                    │ (alerts topic)   │   │ (anomaly_events)  │   │ (REST API)        │
                    └──────────────────┘   └──────────────────┘   └──────────────────┘
```

---

## Processors

The `anomaly-processors.ts` module provides typed functions that bridge data source adapters to the anomaly engine:

### `processPrice(coinId, price, volume24h?)`
Feeds price data for both `price_spike` and `price_crash` detection. If volume is provided, also checks for `volume_surge` and `volume_drop`.

### `processTVL(protocol, tvlUsd)`
Monitors DeFi protocol TVL for sudden drains (potential rug pulls or exploits) and surges.

### `processGas(chain, gasPriceGwei)`
Tracks gas prices across chains. Ethereum gas spikes often coincide with NFT mints, DeFi attacks, or network congestion events.

### `processWhale(asset, amountUsd)`
Detects unusually large wallet transfers that deviate from the asset's normal transaction size distribution.

### `processFundingRate(symbol, rate)`
Monitors perpetual futures funding rates for extreme values that often precede liquidation cascades.

### `processOpenInterest(symbol, oiUsd)`
Tracks open interest surges that indicate imminent large price moves.

### `processStablecoin(stablecoin, price)`
Monitors stablecoin prices for depegging events. Uses a lower threshold (2.0) than other types because any meaningful depeg is critical.

---

## API Endpoints

### `GET /api/anomalies`

Retrieve recent anomaly events from the ring buffer.

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `severity` | string | — | Filter by severity: `info`, `warning`, `critical` |
| `type` | string | — | Filter by anomaly type (e.g., `price_spike`) |
| `asset` | string | — | Filter by asset (e.g., `bitcoin`) |
| `limit` | number | 50 | Max results (max: 200) |

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "price_spike-bitcoin-1709568000000",
      "type": "price_spike",
      "severity": "warning",
      "asset": "bitcoin",
      "metric": "price_usd",
      "currentValue": 72450.12,
      "expectedRange": { "low": 66800.50, "high": 70200.30 },
      "deviation": 3.8,
      "message": "Price Spike: bitcoin price_usd = 72450.12 (+3.8σ from mean 68500.40)",
      "context": {},
      "detectedAt": "2026-03-04T12:00:00.000Z",
      "detector": "statistical-mzs"
    }
  ]
}
```

### `GET /api/anomalies/stats`

Engine statistics including window count, total data points, and detection count.

### `GET /api/anomalies/stream`

Server-Sent Events endpoint for real-time anomaly streaming. Connect with `EventSource`:

```javascript
const source = new EventSource('/api/anomalies/stream');
source.onmessage = (event) => {
  const anomaly = JSON.parse(event.data);
  console.log(`${anomaly.severity}: ${anomaly.message}`);
};
```

---

## WebSocket Alerts

Anomalies are automatically broadcast to all WebSocket clients subscribed to the `alerts` topic:

```javascript
const ws = new WebSocket('ws://localhost:8080/ws/alerts');
ws.onmessage = (event) => {
  const { type, data, timestamp } = JSON.parse(event.data);
  // type === "anomaly"
  // data is an AnomalyEvent
};
```

This is wired up in `anomaly-processors.ts` via the `onAnomaly` handler registry:

```typescript
anomalyEngine.onAnomaly((event) => {
  broadcastToTopic("alerts", JSON.stringify({
    type: "anomaly",
    data: event,
    timestamp: event.detectedAt,
  }));
});
```

---

## State Persistence

The engine supports saving and restoring sliding window state for crash recovery:

- **`saveState()`** — Serializes all sliding windows to the cache layer (24-hour TTL)
- **`loadState()`** — Restores sliding windows from cache on startup

This prevents the cold-start problem where all windows are empty after a restart, which would cause a period where no anomalies can be detected until enough data points accumulate.

---

## Extending the Engine

### Adding a Custom Anomaly Type

1. Add the type to `AnomalyType` union in `anomaly.ts`
2. Add configuration to `DETECTOR_CONFIGS`
3. Add to `POSITIVE_TYPES` or `NEGATIVE_TYPES` set (or neither for bidirectional)
4. Add a processor function in `anomaly-processors.ts`
5. Feed data from the appropriate source adapter

### Adding a Custom Handler

Register a handler to react to anomaly events:

```typescript
import { anomalyEngine } from '@/lib/anomaly';

// Slack notification handler
anomalyEngine.onAnomaly((event) => {
  if (event.severity === 'critical') {
    sendSlackAlert(`⚠️ ${event.message}`);
  }
});
```

Handlers are called synchronously in registration order. Errors in handlers are caught and logged without affecting other handlers.

### Removing a Handler

```typescript
const handler = (event) => { /* ... */ };
anomalyEngine.onAnomaly(handler);

// Later:
anomalyEngine.removeHandler(handler);
```
