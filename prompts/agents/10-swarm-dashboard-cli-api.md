# Prompt 10 — Pump Agent Swarm: Dashboard, CLI, API & Telegram

## Context

You are working on `packages/pump-agent-swarm/` in the crypto-vision monorepo. The swarm has a built-in monitoring stack:

- `src/dashboard/` — Real-time dashboard with Hono API server + WebSocket
- `src/api/` — Screener API server (x402-gated analytics)
- `src/cli.ts` — Interactive CLI
- `src/telegram/` — Telegram bot integration
- `src/demo/` — Demo mode for presentations

## Task

### 1. Complete the Dashboard Server (`src/dashboard/server.ts`)

The dashboard server runs on port 3847 and provides REST + WebSocket:

```typescript
// Dashboard Server should:
// 1. Hono app with CORS enabled
// 2. Serve an inline HTML dashboard at GET / (dark-themed, single page)
// 3. REST endpoints (all prefixed /api):
//    GET /api/status — SwarmStatus
//    GET /api/agents — Agent summaries
//    GET /api/agents/:id — Agent detail + performance history
//    GET /api/trades — Paginated trades (query: limit, offset, agent, direction)
//    GET /api/trades/flow — Sankey trade flow data
//    GET /api/pnl — PnL time series + snapshot
//    GET /api/pnl/agents — Per-agent PnL
//    GET /api/supply — Supply distribution
//    GET /api/config — Current config + schema
//    GET /api/health — Full health report
//    GET /api/events — Filtered events (query: category, severity, agent, from, to, search)
//    GET /api/audit — Audit trail
//    GET /api/export/:format — Export (json/csv/markdown/full)
//    PUT /api/config — Update config (validated)
//    POST /api/actions/pause — Pause swarm
//    POST /api/actions/resume — Resume
//    POST /api/actions/exit — Trigger exit
//    POST /api/actions/emergency-stop — Emergency stop
// 4. Optional API key auth for write endpoints
// 5. WebSocket at /ws for real-time events
```

### 2. Complete the WebSocket Handler (`src/dashboard/websocket.ts`)

```typescript
// WebSocket handler should:
// 1. Accept WebSocket upgrades at /ws
// 2. Send periodic status updates every 2 seconds
// 3. Stream trade events as they happen
// 4. Stream phase changes
// 5. Support subscribe/unsubscribe messages from clients:
//    { "type": "subscribe", "events": ["trade:executed", "pnl:updated"] }
//    { "type": "unsubscribe", "events": ["trade:executed"] }
// 6. Handle client disconnection gracefully
// 7. Track connected client count in metrics
// 8. Heartbeat ping/pong every 30 seconds
```

### 3. Complete Dashboard Components

Each dashboard component tracks specific data:

**Agent Monitor (`agent-monitor.ts`):**
- Per-agent tracking: status, balances, trades, success rate, PnL
- Performance metrics: win rate, avg PnL/trade, Sharpe ratio, max drawdown
- History ring buffer (500 entries per agent)
- `getSnapshot()`, `getAgentDetail(id)`, `getAgentPerformance(id)`

**PnL Dashboard (`pnl-dashboard.ts`):**
- FIFO cost-basis tracking
- Time series sampling (10s interval, 8640 points = 24h)
- Peak, trough, drawdown, ROI calculation
- Per-agent and aggregate views
- `getSnapshot()`, `getTimeSeries()`, `getAgentBreakdown()`

**Trade Visualizer (`trade-visualizer.ts`):**
- Ring buffer of 50K trades
- Sankey flow diagrams (agent-to-agent flows)
- NxN interaction matrices
- Volume charts with configurable intervals
- `getTrades(params)`, `getFlowData()`, `getVolumeChart(interval)`

**Supply Chart (`supply-chart.ts`):**
- On-chain holder distribution
- Gini coefficient, HHI concentration
- Historical snapshots (1000-entry buffer)
- `getDistribution()`, `getMetrics()`, `getHistory()`

**Event Timeline (`event-timeline.ts`):**
- 10K event circular buffer
- Categories: trade, agent, phase, risk, system, bundle, intelligence, config
- Severity: debug, info, warning, error, critical
- Filtering and search
- `getEvents(filters)`, `addEvent(event)`

**Alert Manager (`alert-manager.ts`):**
- Auto-generated alerts from risk events
- Alert lifecycle: active → acknowledged → resolved
- Deduplication within time windows
- `getAlerts()`, `acknowledgeAlert(id)`, `resolveAlert(id)`

**Export Manager (`export-manager.ts`):**
- Export full session as JSON, CSV, Markdown, or combined
- Include: config, trades, PnL, agent stats, events
- `exportSession(format)`

### 4. Complete the CLI (`src/cli.ts`)

Interactive CLI for the swarm:

```
$ pump-swarm

┌─────────────────────────────────────────┐
│  🐝 Pump.fun Agent Swarm v0.1.0        │
│  Network: devnet                         │
│  Master Wallet: 5abc...xyz              │
└─────────────────────────────────────────┘

Commands:
  launch    — Launch new token with swarm
  scan      — Scan for opportunities
  trade     — Start trading on existing token
  status    — Show swarm status
  agents    — List agents and stats
  pnl       — Show P&L summary
  config    — View/edit configuration
  pause     — Pause all trading
  resume    — Resume trading
  exit      — Trigger exit strategy
  stop      — Emergency stop
  export    — Export session data
  help      — Show this help
  quit      — Exit CLI

Strategy Selection:
  1. 🌱 Organic Accumulation (conservative)
  2. 📊 Volume Generation (moderate)
  3. 🎓 Graduation Push (aggressive)
  4. 🎯 Sniper Exit (precision)
```

Use Node.js readline or a minimal CLI framework (no heavy deps).

### 5. Complete the Screener API (`src/api/`)

x402-gated analytics API on port 3402:

```typescript
// Free endpoints:
//   GET /healthz — health check
//   GET /metrics — revenue stats
//   GET /.well-known/x402 — pricing discovery

// Premium (x402 micropayments in USDC):
//   GET /api/pump/analytics/:mint ($0.02) — Full token analytics
//   GET /api/pump/curve/:mint ($0.005) — Bonding curve state
//   GET /api/pump/whales/:mint ($0.025) — Whale detection
//   GET /api/pump/graduation/:mint ($0.015) — Graduation probability
//   GET /api/pump/signals/:mint ($0.03) — AI trading signals
//   GET /api/pump/launches ($0.01) — Recent launches
```

### 6. Complete Telegram Bot (`src/telegram/`)

Telegram bot for remote swarm control:

```
/status — Swarm status summary
/agents — Agent list
/pnl — P&L report
/trades — Recent trades
/pause — Pause trading
/resume — Resume trading
/exit — Trigger exit
/stop — Emergency stop
/alerts — Active alerts
```

Use `grammy` (already in root package.json).

### 7. Complete Demo Mode (`src/demo/`)

Demo mode for presentations — simulates a swarm session with fake data:
- Generates realistic trade events
- Simulates bonding curve price movement
- Runs the dashboard with simulated data
- No real blockchain transactions
- `npm run demo` starts it

## Verification

1. `npm run build` succeeds
2. Dashboard server starts on port 3847 with `npx tsx src/dashboard/server.ts`
3. WebSocket connects at ws://localhost:3847/ws
4. CLI starts with `npm run cli`
5. All REST endpoints return valid JSON
6. Demo mode runs without Solana connection
7. Export produces valid JSON/CSV files
