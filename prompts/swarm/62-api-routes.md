# Prompt 62 — API Routes

## Agent Identity & Rules

```
You are the API-ROUTES builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real data from orchestrator, real JSON responses
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add REST API routes for dashboard data access and swarm control"
```

## Objective

Create `packages/pump-agent-swarm/src/dashboard/api-routes.ts` — registers all REST API routes on the Hono app for the dashboard to consume. Provides read endpoints for monitoring and write endpoints for controlling the swarm.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/dashboard/api-routes.ts`

## Dependencies

- `hono` — Hono, Context types
- `../coordination/swarm-orchestrator` — SwarmOrchestrator (P50)
- `../coordination/swarm-config-manager` — SwarmConfigManager (P59)
- `../coordination/audit-logger` — AuditLogger (P58)
- `../coordination/health-monitor` — HealthMonitor (P55)
- `./trade-visualizer` — TradeVisualizer (P63)
- `./pnl-dashboard` — PnLDashboard (P65)
- `./agent-monitor` — AgentMonitor (P64)
- `./supply-chart` — SupplyChart (P66)
- `./event-timeline` — EventTimeline (P67)
- `./export-manager` — ExportManager (P69)

## Deliverables

### Create `packages/pump-agent-swarm/src/dashboard/api-routes.ts`

1. **`registerApiRoutes` function**:
   ```typescript
   function registerApiRoutes(
     app: Hono,
     context: DashboardContext
   ): void
   ```

2. **`DashboardContext` interface**:
   ```typescript
   interface DashboardContext {
     orchestrator: SwarmOrchestrator;
     configManager: SwarmConfigManager;
     auditLogger: AuditLogger;
     healthMonitor: HealthMonitor;
     tradeVisualizer: TradeVisualizer;
     pnlDashboard: PnLDashboard;
     agentMonitor: AgentMonitor;
     supplyChart: SupplyChart;
     eventTimeline: EventTimeline;
     exportManager: ExportManager;
   }
   ```

3. **Read endpoints** (GET):
   - `GET /api/status` — overall swarm status:
     ```typescript
     interface StatusResponse {
       phase: string;
       uptime: number;
       tokenMint: string | null;
       totalAgents: number;
       activeAgents: number;
       totalTrades: number;
       totalVolumeSol: number;
       currentPnl: number;
       startedAt: number | null;
     }
     ```
   - `GET /api/agents` — list all agents with summary:
     ```typescript
     interface AgentSummary {
       id: string;
       type: string;
       status: string;
       walletAddress: string;
       solBalance: number;
       tokenBalance: number;
       pnl: number;
       tradeCount: number;
       lastAction: string | null;
       uptime: number;
     }
     ```
   - `GET /api/agents/:id` — single agent detail with history
   - `GET /api/trades` — trade history with pagination (`?limit=50&offset=0&agent=&direction=`)
   - `GET /api/trades/flow` — agent-to-agent trade flow data for Sankey visualization
   - `GET /api/pnl` — aggregate P&L time series
   - `GET /api/pnl/agents` — per-agent P&L breakdown
   - `GET /api/supply` — token supply distribution across wallets
   - `GET /api/config` — current swarm configuration
   - `GET /api/health` — health report from HealthMonitor
   - `GET /api/events` — recent events with optional filter (`?category=&severity=&limit=100`)
   - `GET /api/audit` — audit trail with filter (`?type=&agent=&from=&to=`)
   - `GET /api/export/:format` — export session data (format: `json`, `csv`, `markdown`)

4. **Write endpoints** (PUT/POST):
   - `PUT /api/config` — update swarm configuration at runtime
     - Request body: `Partial<SwarmConfig>`
     - Response: `{ success: boolean, config: SwarmConfig, changes: string[] }`
   - `POST /api/actions/pause` — pause all trading
   - `POST /api/actions/resume` — resume trading
   - `POST /api/actions/exit` — trigger exit strategy
   - `POST /api/actions/emergency-stop` — halt everything immediately

5. **Response wrapper**:
   ```typescript
   interface ApiResponse<T> {
     success: boolean;
     data: T;
     timestamp: number;
     error?: string;
   }
   ```
   All endpoints wrap responses in this envelope.

6. **Error handling**: each route wrapped in try/catch, returns `{ success: false, error: message }` with appropriate HTTP status codes (400 for bad input, 404 for not found, 500 for internal errors).

### Success Criteria

- All 17+ routes registered and returning valid JSON
- Pagination works on trade history endpoint
- Write endpoints correctly update swarm state
- Error responses are consistent JSON envelopes
- Query parameter filtering works on events and audit endpoints
- Compiles with `npx tsc --noEmit`
