# Prompt 03 — Dashboard Trading Terminal & Swarm Control

## Context

You are working on `crypto-vision`, a cryptocurrency intelligence platform. The dashboard is in `apps/dashboard/` (Next.js 15, Tailwind CSS). The backend has a full **Pump.fun Agent Swarm** in `packages/pump-agent-swarm/` with:

- 10 autonomous agent types (creator, trader, sniper, market maker, volume, accumulator, exit, narrative, scanner, sentinel)
- Jito bundle system (coordinator, validator, launch sequencer, anti-detection)
- Trading engine (order router, position manager, PnL tracker, wash engine, volume generator)
- Intelligence layer (strategy brain, signal generator, risk manager, sentiment analyzer)
- Dashboard API at port 3847 with REST + WebSocket
- 4 preset strategies: organic, volume, graduation, exit

The swarm's dashboard API exposes:
- `GET /api/status` — Phase, uptime, agents, trades, PnL
- `GET /api/agents` — All agents with stats
- `GET /api/agents/:id` — Agent detail + history
- `GET /api/trades` — Paginated trade history
- `GET /api/trades/flow` — Sankey flow data
- `GET /api/pnl` — PnL time series
- `GET /api/supply` — Token supply distribution
- `GET /api/events` — Filtered event timeline
- `GET /api/config` — Current config
- `PUT /api/config` — Update config
- `POST /api/actions/pause|resume|exit|emergency-stop` — Control actions
- `WS /ws` — Real-time event stream

The existing `apps/dashboard/src/app/swarm/page.tsx` has a basic swarm page. There are also existing components: `SwarmMonitor`, `SwarmStarter`.

## Task

### 1. Build the Trading Terminal Page (`/trading`)

Create a full-screen trading terminal at `/trading` with a multi-panel layout:

**Layout (resizable panels):**
```
┌──────────────────────────────────────────────────────────┐
│  Token: AIAC/SOL  │  Strategy: Organic  │  Phase: TRADING│
├────────────────────┬─────────────────────────────────────┤
│                    │                                     │
│   PRICE CHART      │   ORDER BOOK / BONDING CURVE        │
│   (large, left)    │   (right panel)                     │
│                    │                                     │
├────────────────────┼───────────────┬─────────────────────┤
│   RECENT TRADES    │  AGENT STATUS │  PNL SUMMARY        │
│   (scrolling)      │  (grid)       │  (chart + numbers)  │
│                    │               │                     │
└────────────────────┴───────────────┴─────────────────────┘
```

**Price Chart Panel:**
- Bonding curve price over time (data from `/api/pnl`)
- Volume bars below price
- Trade markers overlaid (buy = green dots, sell = red dots)
- Time range selector: 5m, 15m, 1h, 4h, All
- Current price with animated updates via WebSocket

**Bonding Curve Panel:**
- Visual bonding curve (SOL reserves vs token reserves)
- Current position marker on the curve
- Graduation progress bar (0-100%)
- Key levels: current price, entry price, graduation price
- Market cap in SOL

**Recent Trades Panel:**
- Auto-scrolling trade feed
- Columns: Time, Agent, Direction (BUY/SELL with color), Amount (SOL), Price, Tx link
- Filter by agent, direction
- Highlight own swarm's trades vs external

**Agent Status Panel:**
- Grid of agent cards, each showing:
  - Agent name + role icon
  - Status (active/idle/paused/error) with pulsing dot
  - SOL balance, Token balance
  - Trade count, Win rate
  - Last action timestamp
- Click to expand with full history

**PnL Summary Panel:**
- Total PnL (large number, green/red)
- PnL chart (time series)
- ROI %, Max drawdown
- Per-agent PnL breakdown bars

### 2. Build Swarm Control Page (`/swarm`)

Replace the existing basic swarm page with a full control center:

**Swarm Launcher (when no swarm is running):**
- Token configuration form: Name, Symbol, Metadata URI
- Strategy selector (4 presets as cards with descriptions)
- Advanced config accordion: trader count, RPC URL, bundle settings, Jito tips
- Wallet setup: master wallet import, trader wallet count
- "Launch Swarm" button with confirmation modal
- Network selector: mainnet-beta / devnet

**Swarm Dashboard (when running):**
- Phase indicator (18-state progress bar with current phase highlighted)
- Live metrics strip: Trades/min, Volume, Active agents, Budget remaining
- Agent grid with real-time status
- Event timeline (filterable by category, severity)
- Alert panel (risk events, health warnings)

**Control Panel:**
- Pause / Resume buttons
- Trigger Exit button
- Emergency Stop (red, with confirmation)
- Config editor (JSON or form-based)

**Supply Distribution:**
- Pie chart: Dev wallet vs Trader wallets vs Bonding curve vs External
- Gini coefficient display
- Holder table with percentages

### 3. Build Bundle Manager Page (`/trading/bundles`)

- Active bundle status
- Bundle history table: timestamp, wallets, total SOL, tx signatures, success/fail
- Anti-detection score
- Supply distribution visualization
- Dev buy optimizer stats

### 4. Create API Client

Create `apps/dashboard/src/lib/swarm-api.ts`:
```typescript
// Client for the pump-agent-swarm dashboard API
// Base URL configurable via env: NEXT_PUBLIC_SWARM_API_URL (default: http://localhost:3847)
// 
// Functions:
//   getSwarmStatus(): Promise<StatusResponse>
//   getAgents(): Promise<AgentSummary[]>
//   getAgentDetail(id: string): Promise<AgentDetail>
//   getTrades(params?: TradeQuery): Promise<PaginatedTrades>
//   getTradeFlow(): Promise<SankeyFlowData>
//   getPnl(): Promise<PnlSnapshot>
//   getSupply(): Promise<SupplyDistribution>
//   getEvents(params?: EventQuery): Promise<PaginatedEvents>
//   getConfig(): Promise<SwarmConfig>
//   updateConfig(config: Partial<SwarmConfig>): Promise<void>
//   pauseSwarm(): Promise<void>
//   resumeSwarm(): Promise<void>
//   triggerExit(): Promise<void>
//   emergencyStop(): Promise<void>
```

### 5. Create WebSocket Hook

Create `apps/dashboard/src/hooks/useSwarmWebSocket.ts`:
```typescript
// Connects to ws://localhost:3847/ws
// Auto-reconnect with exponential backoff
// Event types: trade:executed, agent:status, pnl:updated, phase:changed, health:report
// Returns: { connected, events, lastTrade, swarmStatus, subscribe, unsubscribe }
```

### 6. Create TypeScript Types

Create `apps/dashboard/src/types/swarm.ts` with all the types needed for the UI, mirroring the backend types from `packages/pump-agent-swarm/src/types.ts`.

## Technical Requirements

- All panels should have loading skeletons
- WebSocket connection status indicator in top bar
- All monetary values formatted consistently (SOL with 4 decimals, USD with 2)
- Trade signatures should link to Solscan
- Responsive: on mobile, panels stack vertically
- Keyboard shortcuts: Ctrl+P (pause), Ctrl+E (emergency stop with confirmation)
- No `any` types

## Files to Create

- `apps/dashboard/src/app/trading/page.tsx`
- `apps/dashboard/src/app/trading/layout.tsx`
- `apps/dashboard/src/app/trading/bundles/page.tsx`
- `apps/dashboard/src/app/swarm/page.tsx` (replace existing)
- `apps/dashboard/src/lib/swarm-api.ts`
- `apps/dashboard/src/hooks/useSwarmWebSocket.ts`
- `apps/dashboard/src/types/swarm.ts`
- `apps/dashboard/src/components/trading/*.tsx` (panel components)
- `apps/dashboard/src/components/swarm/*.tsx` (control components)

## Verification

1. `/trading` renders the multi-panel layout with placeholder data if swarm isn't running
2. `/swarm` shows the launcher form when no swarm is active
3. WebSocket hook connects and receives events when swarm API is running
4. All control actions (pause, resume, exit) call the correct API endpoints
5. No TypeScript errors
