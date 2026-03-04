# Prompt 34 — Timing Engine

## Agent Identity & Rules

```
You are the TIMING-ENGINE builder.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- No mocks — real Solana slot timing via RPC
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add precision timing engine for coordinated agent actions"
```

## Objective

Create `packages/pump-agent-swarm/src/bundle/timing-engine.ts` — a precision timing engine that coordinates multi-agent actions relative to Solana slot boundaries. Critical for bundle buys where all agents must submit transactions within a narrow window.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/bundle/timing-engine.ts`

## Dependencies

- `@solana/web3.js` — `Connection`, slot subscriptions
- `infra/rpc-pool.ts` — `RPCConnectionPool`
- `infra/event-bus.ts` — `SwarmEventBus`
- `infra/logger.ts` — structured logging

## Deliverables

### Create `packages/pump-agent-swarm/src/bundle/timing-engine.ts`

1. **`TimingEngine` class**:
   - `constructor(connection: Connection, eventBus: SwarmEventBus)`
   - `getCurrentSlot(): Promise<number>` — fetch current slot
   - `getSlotTime(): Promise<number>` — average ms per slot
   - `estimateSlotArrival(targetSlot: number): number` — estimated ms until a target slot
   - `waitForSlot(targetSlot: number, timeoutMs?: number): Promise<number>` — await a specific slot
   - `waitForNextSlot(): Promise<number>` — await the next slot boundary
   - `createCountdown(executeAt: number, callback: () => Promise<void>): TimingCountdown` — schedule execution
   - `synchronizeAgents(agentIds: string[], readyTimeout: number): Promise<SyncResult>` — coordinate N agents to be ready simultaneously
   - `subscribeToSlots(callback: (slot: number) => void): () => void` — slot subscription with unsubscribe function
   - `measureLatency(): Promise<LatencyReport>` — measure RPC round-trip latency
   - `getOptimalSubmissionWindow(targetSlot: number): SubmissionWindow` — when to submit TX to land in target slot
   - `destroy(): void` — cleanup subscriptions

2. **Slot tracking**:
   ```typescript
   interface SlotTracker {
     currentSlot: number;
     slotHistory: Array<{ slot: number; timestamp: number }>;
     avgSlotTime: number;       // rolling average ms per slot (typically ~400ms)
     slotTimeVariance: number;  // how much slot times vary
     lastUpdate: number;
   }
   ```
   - Subscribe to slot updates via `connection.onSlotChange()`
   - Maintain rolling window of last 100 slot-timestamp pairs
   - Calculate average slot time dynamically (Solana target is 400ms but varies)
   - Handle slot skips (missed slots) gracefully

3. **Agent synchronization**:
   ```typescript
   interface SyncResult {
     synchronized: boolean;
     readyAgents: string[];
     notReadyAgents: string[];
     syncTime: number;         // How long synchronization took
     targetSlot: number;       // The slot all agents are synced to
   }
   ```
   - Each agent signals "ready" via event bus
   - TimingEngine waits for all agents OR timeout
   - On sync, emits `agents:synchronized` event with target slot
   - Agents should submit within the same 1-2 slots after sync signal

4. **Submission windows**:
   ```typescript
   interface SubmissionWindow {
     submitAt: number;         // When to call sendTransaction (ms timestamp)
     targetSlot: number;       // Which slot should include the TX
     latencyBuffer: number;    // Accounted RPC latency
     windowSize: number;       // How wide the valid submission window is (ms)
     confidence: number;       // 0-1 confidence the TX will land in target slot
   }
   ```
   - Account for measured RPC latency
   - Submit early enough that TX arrives before slot leader processes
   - Too early = might land in wrong slot; too late = might miss

5. **Latency measurement**:
   ```typescript
   interface LatencyReport {
     rpcLatency: number;       // Round-trip RPC call latency
     slotSubscriptionDelay: number; // Delay in slot notifications
     estimatedSubmissionOverhead: number; // TX submission overhead
     recommendedLeadTime: number; // How early to submit before target slot
   }
   ```
   - Measure via timed `getSlot()` calls
   - Compare slot notification timestamps to actual slot times
   - Run calibration on startup and periodically

6. **Countdown mechanism**:
   ```typescript
   interface TimingCountdown {
     id: string;
     targetSlot: number;
     executeAt: number;       // Timestamp
     status: 'waiting' | 'executing' | 'completed' | 'missed';
     cancel(): void;
     onExecute: () => Promise<void>;
   }
   ```
   - Uses `setTimeout` with drift correction
   - Checks actual slot vs target slot before executing
   - If slot already passed, marks as 'missed' and emits warning
   - Adjusts timing based on real-time slot speed measurements

### Success Criteria

- Correctly tracks Solana slot timing in real-time
- Agent synchronization coordinates multi-agent readiness within 1-2 slots
- Submission window calculations account for measured RPC latency
- Countdown mechanism handles slot time variance gracefully
- Slot subscription cleanup prevents memory leaks
- Compiles with `npx tsc --noEmit`
