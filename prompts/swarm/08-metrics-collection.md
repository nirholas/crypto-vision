# Prompt 08 — Metrics Collection & Reporting

## Agent Identity & Rules

```
You are the METRICS agent. Build the metrics collection system.

RULES:
- Work on current branch (main), commit as nirholas
- Always use isBackground: true for terminals, always kill_terminal after
- TypeScript strict mode, run npx tsc --noEmit after changes
- Commit message: "feat(swarm): add metrics collection with counters, gauges, and histograms"
```

## Objective

Create `packages/pump-agent-swarm/src/infra/metrics.ts` — an in-process metrics system that tracks counters, gauges, histograms, and rates for all swarm operations. Feeds into the dashboard.

## File Ownership

- **Creates**: `packages/pump-agent-swarm/src/infra/metrics.ts`

## Deliverables

### Create `packages/pump-agent-swarm/src/infra/metrics.ts`

1. **`MetricsCollector` class** (singleton):
   - `counter(name: string, labels?: Record<string, string>): Counter`
   - `gauge(name: string, labels?: Record<string, string>): Gauge`
   - `histogram(name: string, buckets?: number[], labels?: Record<string, string>): Histogram`
   - `rate(name: string, windowMs?: number): Rate`
   - `getAll(): MetricSnapshot[]` — dump all metrics
   - `getMetric(name: string): MetricSnapshot | undefined`
   - `reset(): void`
   - `toPrometheus(): string` — export in Prometheus text format
   - `toJSON(): Record<string, unknown>` — export as JSON

2. **Counter**: Monotonically increasing counter
   - `inc(value?: number): void`
   - `get(): number`

3. **Gauge**: Value that can go up or down
   - `set(value: number): void`
   - `inc(value?: number): void`
   - `dec(value?: number): void`
   - `get(): number`

4. **Histogram**: Distribution of values
   - `observe(value: number): void`
   - `get(): { count: number; sum: number; avg: number; min: number; max: number; p50: number; p95: number; p99: number }`

5. **Rate**: Events per time window
   - `mark(): void`
   - `get(): number` — events per second in the window

6. **Pre-defined metrics** (auto-registered):
   ```typescript
   // Trading
   'swarm.trades.total' (counter, labels: direction, status)
   'swarm.trades.latency_ms' (histogram)
   'swarm.trades.volume_sol' (counter, labels: direction)
   'swarm.trades.rate' (rate, 60s window)
   
   // Wallets
   'swarm.wallets.active' (gauge)
   'swarm.wallets.total_sol' (gauge)
   'swarm.wallets.balance_sol' (gauge, labels: wallet_id)
   
   // Bundle
   'swarm.bundle.total' (counter, labels: status)
   'swarm.bundle.latency_ms' (histogram)
   
   // RPC
   'swarm.rpc.requests' (counter, labels: endpoint, method)
   'swarm.rpc.latency_ms' (histogram, labels: endpoint)
   'swarm.rpc.errors' (counter, labels: endpoint)
   
   // Intelligence
   'swarm.intelligence.signals' (counter, labels: signal_type)
   'swarm.intelligence.llm_calls' (counter)
   'swarm.intelligence.llm_latency_ms' (histogram)
   
   // x402
   'swarm.x402.payments' (counter)
   'swarm.x402.spent_usdc' (counter)
   
   // System
   'swarm.uptime_seconds' (gauge)
   'swarm.phase' (gauge — encode as number)
   'swarm.agents.active' (gauge, labels: role)
   ```

7. **Snapshot type**:
   ```typescript
   interface MetricSnapshot {
     name: string;
     type: 'counter' | 'gauge' | 'histogram' | 'rate';
     labels: Record<string, string>;
     value: number | { count: number; sum: number; avg: number; min: number; max: number; p50: number; p95: number; p99: number };
     updatedAt: number;
   }
   ```

### Success Criteria

- All metric types work correctly
- Labels enable per-agent, per-endpoint breakdowns
- Histogram percentiles are accurate
- Rate calculation uses sliding window
- Prometheus export format is valid
- JSON export is comprehensive
- Compiles with `npx tsc --noEmit`
