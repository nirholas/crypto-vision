# Prompt 07 — Structured Logging System

## Agent Identity & Rules

```
You are the LOGGER agent. Build the structured logging system for the swarm.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add structured logging with agent context and log levels"
```

## Objective

Create `packages/pump-agent-swarm/src/infra/logger.ts` — a structured logging system that tags every log with agent ID, phase, and correlation ID. Supports JSON output, log levels, and optional file output.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/infra/logger.ts`

## Dependencies

- `../types.ts` — `SwarmPhase` (P01)
- Node.js `util` and `process.stdout` for console output

## Deliverables

### Create `packages/pump-agent-swarm/src/infra/logger.ts`

1. **`SwarmLogger` class**:
   - `constructor(options: { level: 'debug' | 'info' | 'warn' | 'error'; jsonOutput?: boolean; agentId?: string; category?: string })`
   - `debug(message: string, data?: Record<string, unknown>): void`
   - `info(message: string, data?: Record<string, unknown>): void`
   - `warn(message: string, data?: Record<string, unknown>): void`
   - `error(message: string, error?: Error, data?: Record<string, unknown>): void`
   - `child(context: { agentId?: string; category?: string; correlationId?: string }): SwarmLogger` — create a child logger with additional context
   - `setLevel(level: string): void`
   - `setPhase(phase: SwarmPhase): void` — automatically included in all logs
   - Static `SwarmLogger.create(agentId: string, category?: string): SwarmLogger`

2. **Log format** (JSON mode):
   ```json
   {
     "timestamp": "2026-03-04T12:00:00.000Z",
     "level": "info",
     "agentId": "trader-0",
     "category": "trading",
     "phase": "trading",
     "correlationId": "abc-123",
     "message": "Buy order executed",
     "data": { "mint": "...", "solAmount": 0.05, "signature": "..." }
   }
   ```

3. **Log format** (console mode — default):
   ```
   12:00:00.000 [INFO] [trader-0/trading] Buy order executed mint=... sol=0.05
   ```

4. **Color coding** for console mode:
   - DEBUG: gray
   - INFO: cyan
   - WARN: yellow
   - ERROR: red
   - Agent ID: green
   - Phase: magenta

5. **Global log sink**: `SwarmLogger.setGlobalSink((entry: LogEntry) => void)` for forwarding logs to dashboard/event bus

6. **Log entry type**:
   ```typescript
   interface LogEntry {
     timestamp: number;
     level: 'debug' | 'info' | 'warn' | 'error';
     agentId?: string;
     category?: string;
     phase?: SwarmPhase;
     correlationId?: string;
     message: string;
     data?: Record<string, unknown>;
     error?: { message: string; stack?: string };
   }
   ```

### Success Criteria

- Every agent can create its own logger with context
- Child loggers inherit parent context
- JSON mode produces valid JSON per line
- Console mode is human-readable with colors
- Global sink has access to all logs in the swarm
- Performance: logging should not block agent operations
- Compiles with `npx tsc --noEmit`
