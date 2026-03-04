/**
 * Swarm Health Monitor — Aggregates health from all swarm components.
 *
 * Provides component-level health checks for agents, RPC, wallets, event bus,
 * and external dependencies. Offers periodic monitoring, custom check
 * registration, status-change events, and historical trend data for
 * dashboard-ready health reports.
 */

import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Types ────────────────────────────────────────────────────

export type HealthStatus = 'healthy' | 'degraded' | 'critical' | 'unknown';

export interface ComponentHealth {
  status: HealthStatus;
  message: string;
  lastCheck: number;
  details: Record<string, unknown>;
}

export interface HealthIssue {
  component: string;
  severity: 'warning' | 'critical';
  message: string;
  since: number;
  suggestion: string;
}

export interface HealthReport {
  overall: HealthStatus;
  uptime: number;
  timestamp: number;
  components: {
    agents: ComponentHealth;
    rpc: ComponentHealth;
    wallets: ComponentHealth;
    eventBus: ComponentHealth;
    external: ComponentHealth;
  };
  issues: HealthIssue[];
  metrics: {
    agentCount: {
      total: number;
      healthy: number;
      degraded: number;
      dead: number;
    };
    memoryUsage: {
      rss: number;
      heapUsed: number;
      heapTotal: number;
    };
    eventBusBacklog: number;
    lastTradeAge: number;
    errorRate: number;
  };
}

export type HealthCheckFn = () => Promise<ComponentHealth>;

export interface HealthMonitorConfig {
  /** Default monitoring interval (ms) */
  defaultInterval: number;
  /** Max history entries to keep */
  maxHistory: number;
  /** Thresholds for degraded/critical */
  thresholds: {
    /** Min healthy agents ratio (0-1) */
    minHealthyAgents: number;
    /** Max event bus lag (ms) */
    maxEventBusLag: number;
    /** Min wallet balance (SOL) to consider "funded" */
    minWalletBalance: number;
    /** Max consecutive health check failures */
    maxConsecutiveFailures: number;
  };
}

// ─── Defaults ─────────────────────────────────────────────────

const DEFAULT_CONFIG: HealthMonitorConfig = {
  defaultInterval: 30_000,
  maxHistory: 100,
  thresholds: {
    minHealthyAgents: 0.7,
    maxEventBusLag: 5_000,
    minWalletBalance: 0.001,
    maxConsecutiveFailures: 3,
  },
};

// Memory thresholds (bytes)
const MEMORY_WARN_HEAP = 512 * 1024 * 1024; // 512 MB
const MEMORY_CRITICAL_HEAP = 1024 * 1024 * 1024; // 1 GB

// ─── Helpers ──────────────────────────────────────────────────

function mergeConfig(
  base: HealthMonitorConfig,
  override?: Partial<HealthMonitorConfig>,
): HealthMonitorConfig {
  if (!override) return { ...base };
  return {
    defaultInterval: override.defaultInterval ?? base.defaultInterval,
    maxHistory: override.maxHistory ?? base.maxHistory,
    thresholds: {
      ...base.thresholds,
      ...(override.thresholds ?? {}),
    },
  };
}

function unknownComponent(name: string): ComponentHealth {
  return {
    status: 'unknown',
    message: `${name} health check not yet run`,
    lastCheck: 0,
    details: {},
  };
}

// ─── HealthMonitor ────────────────────────────────────────────

export class HealthMonitor {
  private readonly config: HealthMonitorConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;

  /** Custom-registered health checks keyed by component name */
  private readonly customChecks = new Map<string, HealthCheckFn>();

  /** Circular FIFO history of health reports */
  private readonly history: HealthReport[] = [];

  /** Monitoring interval handle */
  private monitoringTimer: ReturnType<typeof setInterval> | undefined;

  /** Previous overall status for change detection */
  private previousStatus: HealthStatus = 'unknown';

  /** Consecutive failure counter per component */
  private readonly consecutiveFailures = new Map<string, number>();

  /** Epoch when this monitor was constructed, for uptime calculation */
  private readonly startedAt = Date.now();

  /** Listeners for health-change callbacks */
  private readonly changeListeners = new Set<(report: HealthReport) => void>();

  /** Track last trade timestamp via event bus */
  private lastTradeTimestamp = 0;

  /** Track error timestamps for rate calculation (sliding 1-min window) */
  private readonly errorTimestamps: number[] = [];

  /** Event bus subscription IDs to clean up on stop */
  private readonly subscriptionIds: string[] = [];

  // ─── Constructor ──────────────────────────────────────────

  constructor(eventBus: SwarmEventBus, config?: Partial<HealthMonitorConfig>) {
    this.config = mergeConfig(DEFAULT_CONFIG, config);
    this.eventBus = eventBus;
    this.logger = SwarmLogger.create('health-monitor', 'coordination');

    // Listen for trades to track last trade age
    this.subscriptionIds.push(
      this.eventBus.subscribe(
        'trade:*',
        () => {
          this.lastTradeTimestamp = Date.now();
        },
        { source: 'health-monitor' },
      ),
    );

    // Listen for errors to track error rate
    this.subscriptionIds.push(
      this.eventBus.subscribe(
        '@error',
        () => {
          this.errorTimestamps.push(Date.now());
        },
        { source: 'health-monitor' },
      ),
    );

    this.logger.info('Health monitor initialised', {
      interval: this.config.defaultInterval,
      maxHistory: this.config.maxHistory,
    });
  }

  // ─── Public API ───────────────────────────────────────────

  /**
   * Register a custom health check that will be evaluated during each
   * monitoring cycle.  The check is stored under the provided name and
   * will appear in `HealthReport.components` once evaluated.
   */
  registerHealthCheck(name: string, check: HealthCheckFn): void {
    this.customChecks.set(name, check);
    this.logger.info('Custom health check registered', { name });
  }

  /**
   * Comprehensive health check — runs all registered checks and returns
   * a full report with component statuses, issues, and metrics.
   */
  async getHealthReport(): Promise<HealthReport> {
    const timestamp = Date.now();
    const uptime = timestamp - this.startedAt;

    // Run all component checks in parallel
    const [agents, rpc, wallets, eventBusHealth, external] =
      await Promise.all([
        this.runCheck('agents', this.checkAgents.bind(this)),
        this.runCheck('rpc', this.checkRpc.bind(this)),
        this.runCheck('wallets', this.checkWallets.bind(this)),
        this.runCheck('eventBus', this.checkEventBus.bind(this)),
        this.runCheck('external', this.checkExternal.bind(this)),
      ]);

    // Collect issues from component statuses
    const issues = this.collectIssues({
      agents,
      rpc,
      wallets,
      eventBus: eventBusHealth,
      external,
    });

    // Compute overall status
    const overall = this.computeOverallStatus({
      agents,
      rpc,
      wallets,
      eventBus: eventBusHealth,
      external,
    });

    // Build metrics
    const mem = process.memoryUsage();
    const agentCount = this.extractAgentCounts(agents);
    const errorRate = this.computeErrorRate();
    const eventBusBacklog = this.getEventBusBacklog();
    const lastTradeAge =
      this.lastTradeTimestamp > 0
        ? timestamp - this.lastTradeTimestamp
        : -1;

    const report: HealthReport = {
      overall,
      uptime,
      timestamp,
      components: {
        agents,
        rpc,
        wallets,
        eventBus: eventBusHealth,
        external,
      },
      issues,
      metrics: {
        agentCount,
        memoryUsage: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
        },
        eventBusBacklog,
        lastTradeAge,
        errorRate,
      },
    };

    // Persist to history (FIFO eviction)
    this.history.push(report);
    if (this.history.length > this.config.maxHistory) {
      this.history.shift();
    }

    // Detect status transitions and emit events
    this.handleStatusTransition(overall, report);
    this.previousStatus = overall;

    // Emit generic health:report event
    this.eventBus.emit('health:report', 'system', 'health-monitor', {
      overall,
      uptime,
      issueCount: issues.length,
    });

    // Notify change listeners
    for (const listener of this.changeListeners) {
      try {
        listener(report);
      } catch (err) {
        this.logger.warn('Health change listener threw', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return report;
  }

  /**
   * Quick boolean health check — returns true when overall status is
   * 'healthy' or 'unknown' (no reports yet).
   */
  isHealthy(): boolean {
    if (this.history.length === 0) return true; // no data yet
    const last = this.history[this.history.length - 1];
    return last.overall === 'healthy';
  }

  /**
   * Start periodic health monitoring at the given interval (or default).
   */
  startMonitoring(intervalMs?: number): void {
    if (this.monitoringTimer) {
      this.logger.warn('Monitoring already running — stopping first');
      this.stopMonitoring();
    }
    const interval = intervalMs ?? this.config.defaultInterval;
    this.logger.info('Starting periodic health monitoring', { intervalMs: interval });

    // Run an immediate check, then repeat
    void this.getHealthReport().catch((err) =>
      this.logger.error('Initial health check failed', err instanceof Error ? err : new Error(String(err))),
    );

    this.monitoringTimer = setInterval(() => {
      void this.getHealthReport().catch((err) =>
        this.logger.error('Periodic health check failed', err instanceof Error ? err : new Error(String(err))),
      );
    }, interval);
  }

  /**
   * Stop periodic health monitoring.
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearInterval(this.monitoringTimer);
      this.monitoringTimer = undefined;
      this.logger.info('Periodic health monitoring stopped');
    }
  }

  /**
   * Register a callback invoked with every health report.
   * Returns an unsubscribe function.
   */
  onHealthChange(callback: (report: HealthReport) => void): () => void {
    this.changeListeners.add(callback);
    return () => {
      this.changeListeners.delete(callback);
    };
  }

  /**
   * Returns all stored historical health reports (oldest first).
   */
  getHistory(): HealthReport[] {
    return [...this.history];
  }

  /**
   * Clean up all resources: timers, subscriptions, listeners.
   */
  destroy(): void {
    this.stopMonitoring();
    for (const subId of this.subscriptionIds) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptionIds.length = 0;
    this.changeListeners.clear();
    this.customChecks.clear();
    this.logger.info('Health monitor destroyed');
  }

  // ─── Built-in Health Checks ───────────────────────────────

  /**
   * Agents — checks custom-registered "agents" check first, then falls
   * back to event-bus stats as a proxy for agent liveness.
   */
  private async checkAgents(): Promise<ComponentHealth> {
    // Delegate to custom check if one was registered under "agents"
    const custom = this.customChecks.get('agents');
    if (custom) {
      return custom();
    }

    // Fallback: infer from event bus stats
    const stats = this.eventBus.getStats();
    const totalSubscriptions = stats.totalSubscriptions;

    if (totalSubscriptions === 0) {
      return {
        status: 'unknown',
        message: 'No agent subscriptions detected yet',
        lastCheck: Date.now(),
        details: { totalSubscriptions },
      };
    }

    return {
      status: 'healthy',
      message: `${totalSubscriptions} active subscriptions`,
      lastCheck: Date.now(),
      details: { totalSubscriptions, totalEvents: stats.totalEvents },
    };
  }

  /**
   * RPC — delegates to custom check if registered, else reports unknown.
   * When connected to real infrastructure the integrator should register
   * a check that calls `connection.getSlot()` with a 5s timeout.
   */
  private async checkRpc(): Promise<ComponentHealth> {
    const custom = this.customChecks.get('rpc');
    if (custom) {
      return custom();
    }

    return unknownComponent('RPC');
  }

  /**
   * Wallets — delegates to custom check if registered, else reports unknown.
   */
  private async checkWallets(): Promise<ComponentHealth> {
    const custom = this.customChecks.get('wallets');
    if (custom) {
      return custom();
    }

    return unknownComponent('Wallets');
  }

  /**
   * Event bus — measures bus stats and injects a latency test event.
   */
  private async checkEventBus(): Promise<ComponentHealth> {
    const custom = this.customChecks.get('eventBus');
    if (custom) {
      return custom();
    }

    const stats = this.eventBus.getStats();
    const lag = await this.measureEventBusLatency();

    if (lag > this.config.thresholds.maxEventBusLag) {
      return {
        status: 'critical',
        message: `Event bus latency ${lag}ms exceeds threshold ${this.config.thresholds.maxEventBusLag}ms`,
        lastCheck: Date.now(),
        details: { lag, totalEvents: stats.totalEvents, ...stats.eventsByCategory },
      };
    }

    if (lag > this.config.thresholds.maxEventBusLag * 0.7) {
      return {
        status: 'degraded',
        message: `Event bus latency ${lag}ms approaching threshold`,
        lastCheck: Date.now(),
        details: { lag, totalEvents: stats.totalEvents, ...stats.eventsByCategory },
      };
    }

    return {
      status: 'healthy',
      message: `Event bus responsive (${lag}ms latency)`,
      lastCheck: Date.now(),
      details: { lag, totalEvents: stats.totalEvents, ...stats.eventsByCategory },
    };
  }

  /**
   * External — delegates to custom check if registered, else reports unknown.
   */
  private async checkExternal(): Promise<ComponentHealth> {
    const custom = this.customChecks.get('external');
    if (custom) {
      return custom();
    }

    return unknownComponent('External');
  }

  /**
   * Memory — checked inline during report generation but also available
   * as a standalone check for custom registration.
   */
  private checkMemory(): ComponentHealth {
    const mem = process.memoryUsage();

    if (mem.heapUsed > MEMORY_CRITICAL_HEAP) {
      return {
        status: 'critical',
        message: `Heap usage ${(mem.heapUsed / 1024 / 1024).toFixed(0)}MB exceeds critical threshold`,
        lastCheck: Date.now(),
        details: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          external: mem.external,
        },
      };
    }

    if (mem.heapUsed > MEMORY_WARN_HEAP) {
      return {
        status: 'degraded',
        message: `Heap usage ${(mem.heapUsed / 1024 / 1024).toFixed(0)}MB above warning threshold`,
        lastCheck: Date.now(),
        details: {
          rss: mem.rss,
          heapUsed: mem.heapUsed,
          heapTotal: mem.heapTotal,
          external: mem.external,
        },
      };
    }

    return {
      status: 'healthy',
      message: `Heap usage ${(mem.heapUsed / 1024 / 1024).toFixed(0)}MB within limits`,
      lastCheck: Date.now(),
      details: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
    };
  }

  // ─── Internal Helpers ─────────────────────────────────────

  /**
   * Run a check with error isolation and consecutive-failure tracking.
   */
  private async runCheck(
    name: string,
    check: () => Promise<ComponentHealth>,
  ): Promise<ComponentHealth> {
    try {
      const result = await check();
      // Reset consecutive failures on success (non-critical)
      if (result.status === 'healthy') {
        this.consecutiveFailures.set(name, 0);
      } else {
        const current = this.consecutiveFailures.get(name) ?? 0;
        this.consecutiveFailures.set(name, current + 1);
      }

      // Escalate to critical if too many consecutive non-healthy
      const failures = this.consecutiveFailures.get(name) ?? 0;
      if (
        failures >= this.config.thresholds.maxConsecutiveFailures &&
        result.status !== 'critical'
      ) {
        return {
          ...result,
          status: 'critical',
          message: `${result.message} (${failures} consecutive failures)`,
        };
      }

      return result;
    } catch (err) {
      const current = this.consecutiveFailures.get(name) ?? 0;
      this.consecutiveFailures.set(name, current + 1);
      const errMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Health check '${name}' threw`, err instanceof Error ? err : new Error(errMsg));

      return {
        status: 'critical',
        message: `Health check failed: ${errMsg}`,
        lastCheck: Date.now(),
        details: { error: errMsg },
      };
    }
  }

  /**
   * Inject a test event into the bus and measure round-trip latency.
   */
  private async measureEventBusLatency(): Promise<number> {
    return new Promise<number>((resolve) => {
      const sent = Date.now();
      const subId = this.eventBus.subscribe(
        'health:ping-ack',
        () => {
          this.eventBus.unsubscribe(subId);
          resolve(Date.now() - sent);
        },
      );

      // Timeout after 5s
      const timeout = setTimeout(() => {
        this.eventBus.unsubscribe(subId);
        resolve(5_000);
      }, 5_000);

      // Emit the test event — handler fires synchronously or async
      this.eventBus.emit('health:ping-ack', 'system', 'health-monitor', {
        sentAt: sent,
      });

      // If the handler already resolved, clear the timeout
      // (Promise can only resolve once so the extra resolve is a no-op)
      clearTimeout(timeout);
    });
  }

  /**
   * Compute the overall health status from component statuses.
   *
   * - If ANY component is 'critical' → overall = 'critical'
   * - If ≥1 component is 'degraded' → overall = 'degraded'
   * - Otherwise → 'healthy'
   */
  private computeOverallStatus(components: Record<string, ComponentHealth>): HealthStatus {
    const statuses = Object.values(components).map((c) => c.status);

    if (statuses.includes('critical')) return 'critical';
    if (statuses.includes('degraded')) return 'degraded';
    if (statuses.every((s) => s === 'unknown')) return 'unknown';
    return 'healthy';
  }

  /**
   * Collect actionable issues from component statuses.
   */
  private collectIssues(
    components: Record<string, ComponentHealth>,
  ): HealthIssue[] {
    const issues: HealthIssue[] = [];
    const now = Date.now();

    for (const [name, health] of Object.entries(components)) {
      if (health.status === 'degraded') {
        issues.push({
          component: name,
          severity: 'warning',
          message: health.message,
          since: health.lastCheck || now,
          suggestion: this.getSuggestion(name, 'degraded'),
        });
      } else if (health.status === 'critical') {
        issues.push({
          component: name,
          severity: 'critical',
          message: health.message,
          since: health.lastCheck || now,
          suggestion: this.getSuggestion(name, 'critical'),
        });
      }
    }

    // Also check memory as a virtual component
    const memHealth = this.checkMemory();
    if (memHealth.status === 'degraded' || memHealth.status === 'critical') {
      issues.push({
        component: 'memory',
        severity: memHealth.status === 'critical' ? 'critical' : 'warning',
        message: memHealth.message,
        since: now,
        suggestion: 'Consider reducing agent count or restarting the swarm to reclaim memory.',
      });
    }

    return issues;
  }

  /**
   * Provide actionable suggestions per component and severity.
   */
  private getSuggestion(component: string, status: HealthStatus): string {
    const suggestions: Record<string, Record<string, string>> = {
      agents: {
        degraded: 'Some agents are unhealthy. Check agent logs for errors and consider restarting degraded agents.',
        critical: 'Most agents are down. Initiate swarm recovery or restart all agents.',
      },
      rpc: {
        degraded: 'RPC latency is elevated. Consider switching to a backup RPC endpoint.',
        critical: 'RPC endpoint is unreachable. Fail over to an alternative provider immediately.',
      },
      wallets: {
        degraded: 'Some wallets are low on funds. Top up trader wallets to maintain operations.',
        critical: 'Wallet balances critically low. Fund the master wallet and redistribute.',
      },
      eventBus: {
        degraded: 'Event bus latency is increasing. Check subscriber backlog and reduce noisy events.',
        critical: 'Event bus is unresponsive. This blocks all inter-agent communication — restart required.',
      },
      external: {
        degraded: 'External API response times are elevated. Check Pump.fun status page.',
        critical: 'External dependency unreachable. Swarm cannot trade until connectivity is restored.',
      },
    };

    return suggestions[component]?.[status] ?? `Check ${component} component for issues.`;
  }

  /**
   * Extract agent counts from the agents ComponentHealth details.
   */
  private extractAgentCounts(
    agents: ComponentHealth,
  ): HealthReport['metrics']['agentCount'] {
    const details = agents.details as Record<string, number | undefined>;
    return {
      total: (details['total'] as number) ?? 0,
      healthy: (details['healthy'] as number) ?? 0,
      degraded: (details['degraded'] as number) ?? 0,
      dead: (details['dead'] as number) ?? 0,
    };
  }

  /**
   * Compute errors-per-minute using a sliding 60-second window.
   */
  private computeErrorRate(): number {
    const oneMinuteAgo = Date.now() - 60_000;

    // Evict old entries
    while (
      this.errorTimestamps.length > 0 &&
      this.errorTimestamps[0] < oneMinuteAgo
    ) {
      this.errorTimestamps.shift();
    }

    return this.errorTimestamps.length;
  }

  /**
   * Estimate event bus backlog from stats.
   */
  private getEventBusBacklog(): number {
    const stats = this.eventBus.getStats();
    // Use total events as a rough proxy — real backlog would need
    // per-subscriber cursor tracking which the bus doesn't expose.
    return stats.totalEvents;
  }

  /**
   * Detect status transitions and emit appropriate events.
   */
  private handleStatusTransition(
    current: HealthStatus,
    report: HealthReport,
  ): void {
    if (current === this.previousStatus) return;

    this.logger.info('Health status changed', {
      from: this.previousStatus,
      to: current,
    });

    if (current === 'degraded') {
      this.eventBus.emit('health:degraded', 'system', 'health-monitor', {
        previous: this.previousStatus,
        issues: report.issues.map((i) => i.message),
      });
    } else if (current === 'critical') {
      this.eventBus.emit('health:critical', 'system', 'health-monitor', {
        previous: this.previousStatus,
        issues: report.issues.map((i) => i.message),
      });
    } else if (
      current === 'healthy' &&
      (this.previousStatus === 'degraded' || this.previousStatus === 'critical')
    ) {
      this.eventBus.emit('health:recovered', 'system', 'health-monitor', {
        previous: this.previousStatus,
        recoveredAt: Date.now(),
      });
    }
  }
}
