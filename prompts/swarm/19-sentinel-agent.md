# Prompt 19 — Sentinel Agent (Safety & Monitoring)

## Agent Identity & Rules

```
You are the SENTINEL-AGENT builder. Create the safety monitoring agent.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add sentinel agent for safety monitoring and emergency actions"
```

## Objective

Create `packages/pump-agent-swarm/src/agents/sentinel-agent.ts` — a watchdog agent that monitors the health of the swarm, detects anomalies, enforces safety limits, and triggers emergency actions when needed.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/agents/sentinel-agent.ts`

## Dependencies

- `../types.ts` — `AgentWallet`, `EmergencyExitConfig` (P01)
- `../infra/event-bus.ts` — `SwarmEventBus` (P04)
- `../infra/logger.ts` — `SwarmLogger` (P07)
- `../infra/metrics.ts` — `MetricsCollector` (P08)
- `../infra/error-handler.ts` — `SwarmErrorHandler` (P09)
- `@solana/web3.js` — `Connection`

## Deliverables

### Create `packages/pump-agent-swarm/src/agents/sentinel-agent.ts`

1. **`SentinelAgent` class**:
   - `constructor(config: EmergencyExitConfig, connection: Connection, eventBus: SwarmEventBus)`
   - `startMonitoring(mint: string, wallets: AgentWallet[]): void`
   - `stopMonitoring(): void`
   - `checkHealth(): HealthReport`
   - `triggerEmergencyExit(reason: string): Promise<void>`
   - `addSafetyRule(rule: SafetyRule): void`
   - `removeSafetyRule(ruleId: string): void`

2. **Monitoring targets**:
   - **Wallet balances**: Alert if any wallet drops below minimum
   - **P&L tracking**: Alert if total loss exceeds threshold
   - **Trade success rate**: Alert if failure rate exceeds 50%
   - **Bonding curve state**: Alert if curve is approaching graduation
   - **Holder changes**: Alert if suspicious whale buys appear
   - **Price movements**: Alert on extreme volatility
   - **RPC health**: Alert if RPC connections are degraded
   - **Agent health**: Alert if any agent stops responding

3. **Safety rules engine**:
   ```typescript
   interface SafetyRule {
     id: string;
     name: string;
     condition: () => boolean | Promise<boolean>;
     action: 'alert' | 'pause' | 'exit' | 'emergency_exit';
     cooldownMs: number; // don't re-trigger within this window
     enabled: boolean;
   }
   ```

4. **Default safety rules**:
   - `max-loss`: If total SOL loss exceeds config threshold → emergency exit
   - `max-loss-percent`: If percentage loss exceeds threshold → emergency exit
   - `silence-timeout`: If no successful trade in N minutes → pause
   - `rpc-degraded`: If >50% RPC endpoints unhealthy → pause
   - `budget-exhausted`: If all wallets below minimum balance → exit
   - `whale-detected`: If a single non-swarm wallet buys >10% supply → alert
   - `graduation-imminent`: If graduation progress >90% → alert

5. **HealthReport**:
   ```typescript
   interface HealthReport {
     healthy: boolean;
     timestamp: number;
     checks: Array<{
       name: string;
       status: 'ok' | 'warning' | 'critical';
       message: string;
       value?: number;
     }>;
     activeAlerts: string[];
     recommendedAction: 'continue' | 'pause' | 'exit' | 'emergency_exit';
   }
   ```

6. **Alert system**: When a safety rule triggers:
   - Emit event to event bus
   - Log with high priority
   - Execute the configured action (alert/pause/exit/emergency)
   - Track alert history for post-mortem

### Success Criteria

- Monitors all critical swarm health indicators
- Safety rules system is extensible
- Emergency exit triggers correctly and sells all positions
- Health reports are accurate and actionable
- Alert cooldown prevents spam
- Compiles with `npx tsc --noEmit`
