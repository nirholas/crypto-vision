# Prompt 60 — Dashboard Server

## Agent Identity & Rules

```
You are the DASHBOARD-SERVER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Hono server, real HTTP responses, real WebSocket connections
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add Hono-based dashboard server for live swarm monitoring"
```

## Objective

Create `packages/pump-agent-swarm/src/dashboard/server.ts` — a Hono-based HTTP server that serves the live dashboard for monitoring the agent swarm in real-time. Provides REST API endpoints, WebSocket upgrades, CORS support, and an inline HTML dashboard page.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/dashboard/server.ts`

## Dependencies

- `hono` — HTTP framework
- `../coordination/swarm-orchestrator` — SwarmOrchestrator
- `./api-routes` — registerApiRoutes (P62)
- `./websocket` — DashboardWebSocket (P61)
- `../infra/event-bus` — SwarmEventBus (P04)
- `../infra/logging` — SwarmLogger (P07)

## Deliverables

### Create `packages/pump-agent-swarm/src/dashboard/server.ts`

1. **`DashboardServer` class**:
   - `constructor(config: DashboardServerConfig)`
   - `attachOrchestrator(orchestrator: SwarmOrchestrator): void` — connects to the swarm for data
   - `start(): Promise<void>` — starts the HTTP server on configured port
   - `stop(): Promise<void>` — gracefully shuts down the server
   - `getApp(): Hono` — returns the Hono app instance for testing

2. **`DashboardServerConfig` interface**:
   ```typescript
   interface DashboardServerConfig {
     /** Port to listen on */
     port: number;
     /** Hostname to bind to (default: '0.0.0.0') */
     hostname?: string;
     /** Enable CORS for all origins (default: true for demo) */
     corsEnabled?: boolean;
     /** Enable WebSocket support (default: true) */
     websocketEnabled?: boolean;
     /** Static assets directory (optional) */
     staticDir?: string;
     /** API key for authenticated endpoints (optional) */
     apiKey?: string;
   }
   ```

3. **Inline HTML Dashboard** — GET `/` serves a single-page HTML dashboard:
   - No framework — vanilla HTML + CSS + JavaScript
   - Connects to WebSocket at `ws://host:port/ws`
   - Displays: swarm status, agent list, live trade feed, P&L counter, current phase
   - Auto-reconnects WebSocket on disconnect
   - Dark theme with green/red trade indicators
   - Responsive layout with CSS grid
   - ~200 lines of embedded HTML/CSS/JS returned as a string

4. **Middleware stack**:
   - CORS middleware (all origins when enabled)
   - Request logging middleware (log method, path, status, duration)
   - Optional API key middleware for write endpoints (PUT/POST)
   - Error handling middleware (catch-all, return JSON error responses)

5. **`createDashboardServer` factory function**:
   ```typescript
   function createDashboardServer(
     orchestrator: SwarmOrchestrator,
     config?: Partial<DashboardServerConfig>
   ): DashboardServer
   ```

### Success Criteria

- Hono app starts and responds to HTTP requests
- GET `/` returns inline HTML dashboard page
- All `/api/*` routes registered and returning JSON
- WebSocket endpoint at `/ws` accepts connections
- CORS headers present on all responses
- Compiles with `npx tsc --noEmit`
