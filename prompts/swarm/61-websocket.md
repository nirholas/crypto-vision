# Prompt 61 — WebSocket Manager

## Agent Identity & Rules

```
You are the WEBSOCKET-MANAGER builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real WebSocket connections, real event streaming
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add real-time WebSocket manager for dashboard event streaming"
```

## Objective

Create `packages/pump-agent-swarm/src/dashboard/websocket.ts` — manages real-time WebSocket connections for the dashboard, subscribing to the SwarmEventBus and forwarding relevant events to all connected browser clients.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/dashboard/websocket.ts`

## Dependencies

- `../infra/event-bus` — SwarmEventBus (P04)
- `../infra/logging` — SwarmLogger (P07)
- `hono/ws` or `ws` package — WebSocket support

## Deliverables

### Create `packages/pump-agent-swarm/src/dashboard/websocket.ts`

1. **`DashboardWebSocket` class**:
   - `constructor(eventBus: SwarmEventBus, config?: WebSocketConfig)`
   - `handleUpgrade(ws: WebSocket): void` — handle new WebSocket connection
   - `broadcast(event: DashboardEvent): void` — send event to all connected clients
   - `broadcastToSubscribed(event: DashboardEvent): void` — send only to clients subscribed to event type
   - `getConnectedClients(): number` — return count of active connections
   - `getClientDetails(): ClientInfo[]` — details about each connected client
   - `disconnect(clientId: string): void` — force disconnect a client
   - `stop(): void` — close all connections and cleanup

2. **`WebSocketConfig` interface**:
   ```typescript
   interface WebSocketConfig {
     /** Heartbeat interval in ms (default: 30000) */
     heartbeatIntervalMs: number;
     /** Max clients allowed (default: 50) */
     maxClients: number;
     /** Message buffer size per client (default: 100) */
     bufferSize: number;
     /** Events to forward to clients */
     subscribedEvents: string[];
   }
   ```

3. **`DashboardEvent` interface**:
   ```typescript
   interface DashboardEvent {
     /** Event type identifier */
     type: 'trade:executed' | 'agent:status' | 'pnl:updated' | 'phase:changed' | 'health:report' | 'signal:generated' | 'alert:created' | 'config:changed' | 'swarm:status';
     /** ISO 8601 timestamp */
     timestamp: string;
     /** Event payload */
     data: Record<string, unknown>;
     /** Source agent ID if applicable */
     agentId?: string;
   }
   ```

4. **`ClientInfo` interface**:
   ```typescript
   interface ClientInfo {
     /** Unique client identifier */
     id: string;
     /** Connection timestamp */
     connectedAt: number;
     /** Last heartbeat received */
     lastPing: number;
     /** Events this client is subscribed to (empty = all) */
     subscriptions: string[];
     /** Number of messages sent to this client */
     messagesSent: number;
   }
   ```

5. **Core behavior**:
   - On connection: assign client ID, add to pool, send current swarm status as initial message
   - Heartbeat: server sends ping every `heartbeatIntervalMs`, expects pong. Remove stale clients after 2 missed pings
   - Event subscription: clients can send `{"type":"subscribe","events":["trade:executed","pnl:updated"]}` to filter events
   - Buffer: if client is slow, buffer up to `bufferSize` messages, drop oldest on overflow
   - Subscribe to SwarmEventBus events: `trade:*`, `agent:*`, `phase:*`, `health:*`, `signal:*`, `alert:*`, `config:*`
   - Transform internal SwarmEvent → DashboardEvent before sending (strip sensitive data like private keys)

### Success Criteria

- WebSocket connections accepted and maintained
- Events from SwarmEventBus forwarded to connected clients in real-time
- Stale connections detected and cleaned up via heartbeat
- Client subscription filtering works
- Message buffer prevents slow client backpressure
- Compiles with `npx tsc --noEmit`
