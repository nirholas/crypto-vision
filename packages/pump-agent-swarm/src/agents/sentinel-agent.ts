/**
 * Sentinel Agent — Safety monitoring and emergency action enforcement
 *
 * The sentinel is the swarm's watchdog. It continuously monitors:
 * 1. Wallet balances — alerts when any wallet drops below minimums
 * 2. P&L tracking — triggers emergency exit when losses exceed thresholds
 * 3. Trade success rate — pauses when failure rate is too high
 * 4. Bonding curve state — alerts on approaching graduation
 * 5. Holder changes — detects suspicious whale activity
 * 6. Price movements — alerts on extreme volatility
 * 7. RPC health — pauses when connectivity degrades
 * 8. Agent health — alerts when agents stop responding
 *
 * The safety rules engine is extensible: add custom rules with
 * configurable conditions, actions, and cooldown windows.
 */

import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import BN from 'bn.js';
import { EventEmitter } from 'eventemitter3';
import { v4 as uuid } from 'uuid';

import type {
  AgentWallet,
  BondingCurveState,
  EmergencyExitConfig,
  SwarmEvent,
  TradeResult,
} from '../types.js';
import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

// ─── Safety Rule Types ────────────────────────────────────────

export interface SafetyRule {
  /** Unique rule identifier */
  id: string;
  /** Human-readable rule name */
  name: string;
  /** Condition that triggers the rule (return true = triggered) */
  condition: () => boolean | Promise<boolean>;
  /** Action to take when triggered */
  action: 'alert' | 'pause' | 'exit' | 'emergency_exit';
  /** Minimum ms between consecutive triggers */
  cooldownMs: number;
  /** Whether this rule is active */
  enabled: boolean;
}

// ─── Health Report Types ──────────────────────────────────────

export interface HealthCheck {
  /** Check name */
  name: string;
  /** Check result */
  status: 'ok' | 'warning' | 'critical';
  /** Human-readable description */
  message: string;
  /** Optional metric value */
  value?: number;
}

export interface HealthReport {
  /** Overall health status */
  healthy: boolean;
  /** Report generation timestamp */
  timestamp: number;
  /** Individual check results */
  checks: HealthCheck[];
  /** Currently active alert IDs */
  activeAlerts: string[];
  /** Recommended action based on current state */
  recommendedAction: 'continue' | 'pause' | 'exit' | 'emergency_exit';
}

// ─── Alert Types ──────────────────────────────────────────────

interface AlertRecord {
  /** Alert ID */
  id: string;
  /** Rule that triggered this alert */
  ruleId: string;
  /** Rule name */
  ruleName: string;
  /** Action taken */
  action: SafetyRule['action'];
  /** When the alert was triggered */
  triggeredAt: number;
  /** Additional context message */
  message: string;
  /** Whether the alert has been resolved */
  resolved: boolean;
  /** When the alert was resolved */
  resolvedAt?: number;
}

// ─── Sentinel Events ─────────────────────────────────────────

interface SentinelAgentEvents {
  'alert:triggered': (alert: AlertRecord) => void;
  'alert:resolved': (alert: AlertRecord) => void;
  'health:report': (report: HealthReport) => void;
  'emergency:exit': (reason: string) => void;
  'monitoring:started': (mint: string) => void;
  'monitoring:stopped': () => void;
}

// ─── Monitoring State ─────────────────────────────────────────

interface MonitoringState {
  /** Token mint address being monitored */
  mint: string;
  /** Wallets under surveillance */
  wallets: AgentWallet[];
  /** Total SOL invested (lamports) — snapshot at monitoring start */
  initialTotalBalanceLamports: BN;
  /** Last successful trade timestamp */
  lastSuccessfulTradeAt: number;
  /** Total trades observed */
  totalTradesObserved: number;
  /** Failed trades observed */
  failedTradesObserved: number;
  /** Successful trades observed */
  successfulTradesObserved: number;
  /** Total SOL spent (lamports) */
  totalSolSpent: BN;
  /** Total SOL received (lamports) */
  totalSolReceived: BN;
  /** Last known bonding curve state */
  lastBondingCurveState?: BondingCurveState;
  /** Known holder addresses with their supply percentage */
  knownHolders: Map<string, number>;
  /** Price history for volatility detection */
  priceHistory: Array<{ price: number; timestamp: number }>;
  /** Agent heartbeats — last seen timestamp per agent ID */
  agentHeartbeats: Map<string, number>;
}

// ─── Constants ────────────────────────────────────────────────

/** How often to run the monitoring tick (ms) */
const MONITOR_TICK_INTERVAL_MS = 5_000;

/** Max price history entries to retain */
const MAX_PRICE_HISTORY = 200;

/** Volatility window in ms (5 minutes) */
const VOLATILITY_WINDOW_MS = 5 * 60 * 1_000;

/** Extreme volatility threshold — price move percentage in window */
const EXTREME_VOLATILITY_THRESHOLD_PERCENT = 50;

/** Whale detection threshold — single wallet holding percentage */
const WHALE_THRESHOLD_PERCENT = 10;

/** Agent heartbeat timeout — consider dead after this */
const AGENT_HEARTBEAT_TIMEOUT_MS = 60_000;

/** Trade failure rate threshold before alerting */
const FAILURE_RATE_THRESHOLD = 0.5;

/** Graduation nearness threshold (%) */
const GRADUATION_IMMINENT_THRESHOLD = 90;

/** RPC unhealthy ratio threshold before pausing */
const RPC_UNHEALTHY_RATIO_THRESHOLD = 0.5;

/** Minimum balance threshold in lamports (0.01 SOL) */
const MIN_WALLET_BALANCE_LAMPORTS = 0.01 * LAMPORTS_PER_SOL;

// ─── Sentinel Agent ──────────────────────────────────────────

export class SentinelAgent extends EventEmitter<SentinelAgentEvents> {
  readonly id: string;

  private readonly config: EmergencyExitConfig;
  private readonly eventBus: SwarmEventBus;
  private readonly logger: SwarmLogger;

  /** All registered safety rules */
  private readonly rules: Map<string, SafetyRule> = new Map();

  /** Last trigger time per rule for cooldown enforcement */
  private readonly ruleCooldowns: Map<string, number> = new Map();

  /** Alert history for post-mortem analysis */
  private readonly alertHistory: AlertRecord[] = [];

  /** Currently active (unresolved) alerts */
  private readonly activeAlerts: Map<string, AlertRecord> = new Map();

  /** Monitoring state — set when monitoring is active */
  private state: MonitoringState | null = null;

  /** Monitoring interval timer */
  private monitorTimer: ReturnType<typeof setInterval> | null = null;

  /** Event bus subscription IDs for cleanup */
  private subscriptionIds: string[] = [];

  /** Whether monitoring is running */
  private running = false;

  /** Whether an emergency exit is currently in progress */
  private emergencyInProgress = false;

  constructor(
    config: EmergencyExitConfig,
    _connection: Connection,
    eventBus: SwarmEventBus,
  ) {
    super();
    this.id = `sentinel-${uuid().slice(0, 8)}`;
    this.config = config;
    this.eventBus = eventBus;
    this.logger = SwarmLogger.create(this.id, 'sentinel');

    this.registerDefaultRules();
  }

  // ─── Public API ─────────────────────────────────────────────

  /**
   * Start monitoring a specific token and set of wallets.
   * Subscribes to relevant events on the event bus and begins
   * periodic health checks.
   */
  startMonitoring(mint: string, wallets: AgentWallet[]): void {
    if (this.running) {
      this.logger.warn('Monitoring already active, stopping previous session');
      this.stopMonitoring();
    }

    const totalBalance = wallets.reduce(
      (sum, w) => sum.add(w.balanceLamports),
      new BN(0),
    );

    this.state = {
      mint,
      wallets,
      initialTotalBalanceLamports: totalBalance,
      lastSuccessfulTradeAt: Date.now(),
      totalTradesObserved: 0,
      failedTradesObserved: 0,
      successfulTradesObserved: 0,
      totalSolSpent: new BN(0),
      totalSolReceived: new BN(0),
      knownHolders: new Map(),
      priceHistory: [],
      agentHeartbeats: new Map(),
    };

    // Subscribe to swarm events
    this.subscribeToEvents();

    // Start periodic monitoring tick
    this.monitorTimer = setInterval(() => {
      void this.monitorTick();
    }, MONITOR_TICK_INTERVAL_MS);

    this.running = true;

    this.logger.info('Monitoring started', {
      mint,
      walletCount: wallets.length,
      totalBalanceSol: totalBalance.toNumber() / LAMPORTS_PER_SOL,
    });

    this.eventBus.emit(
      'sentinel:monitoring_started',
      'system',
      this.id,
      { mint, walletCount: wallets.length },
    );

    this.emit('monitoring:started', mint);
  }

  /**
   * Stop all monitoring activities and clean up subscriptions.
   */
  stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }

    // Unsubscribe from event bus
    for (const subId of this.subscriptionIds) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptionIds = [];

    this.running = false;

    this.logger.info('Monitoring stopped', {
      totalAlerts: this.alertHistory.length,
      activeAlerts: this.activeAlerts.size,
    });

    this.eventBus.emit(
      'sentinel:monitoring_stopped',
      'system',
      this.id,
      {
        totalAlerts: this.alertHistory.length,
        activeAlerts: this.activeAlerts.size,
      },
    );

    this.emit('monitoring:stopped');
  }

  /**
   * Generate a comprehensive health report of the swarm.
   */
  checkHealth(): HealthReport {
    const checks: HealthCheck[] = [];
    const now = Date.now();

    if (!this.state) {
      return {
        healthy: false,
        timestamp: now,
        checks: [{ name: 'monitoring', status: 'critical', message: 'Monitoring not active' }],
        activeAlerts: [],
        recommendedAction: 'exit',
      };
    }

    // 1. Wallet balance check
    checks.push(this.checkWalletBalances());

    // 2. P&L check
    checks.push(this.checkPnL());

    // 3. Trade success rate check
    checks.push(this.checkTradeSuccessRate());

    // 4. Silence check (time since last successful trade)
    checks.push(this.checkSilence(now));

    // 5. Bonding curve / graduation check
    checks.push(this.checkBondingCurve());

    // 6. Price volatility check
    checks.push(this.checkPriceVolatility(now));

    // 7. Agent health check
    checks.push(this.checkAgentHealth(now));

    // 8. Overall budget check
    checks.push(this.checkBudget());

    // Determine overall health and recommended action
    const hasCritical = checks.some((c) => c.status === 'critical');
    const hasWarning = checks.some((c) => c.status === 'warning');
    const healthy = !hasCritical;

    let recommendedAction: HealthReport['recommendedAction'] = 'continue';
    if (hasCritical) {
      // Check if any critical issue warrants emergency exit
      const criticalChecks = checks.filter((c) => c.status === 'critical');
      const exitTriggers = ['pnl', 'budget', 'max_loss_percent'];
      if (criticalChecks.some((c) => exitTriggers.includes(c.name))) {
        recommendedAction = 'emergency_exit';
      } else {
        recommendedAction = 'exit';
      }
    } else if (hasWarning) {
      recommendedAction = 'pause';
    }

    const report: HealthReport = {
      healthy,
      timestamp: now,
      checks,
      activeAlerts: [...this.activeAlerts.keys()],
      recommendedAction,
    };

    this.emit('health:report', report);

    return report;
  }

  /**
   * Trigger an emergency exit — sell all positions and reclaim SOL.
   * This is the nuclear option; use only when safety is compromised.
   */
  async triggerEmergencyExit(reason: string): Promise<void> {
    if (this.emergencyInProgress) {
      this.logger.warn('Emergency exit already in progress, ignoring duplicate trigger');
      return;
    }

    this.emergencyInProgress = true;

    this.logger.error(`EMERGENCY EXIT TRIGGERED: ${reason}`, new Error(reason));

    // Create alert record
    const alert: AlertRecord = {
      id: uuid(),
      ruleId: 'emergency_exit_manual',
      ruleName: 'Manual Emergency Exit',
      action: 'emergency_exit',
      triggeredAt: Date.now(),
      message: reason,
      resolved: false,
    };
    this.alertHistory.push(alert);
    this.activeAlerts.set(alert.id, alert);
    this.emit('alert:triggered', alert);

    // Notify event bus
    this.eventBus.emit(
      'sentinel:emergency_exit',
      'system',
      this.id,
      { reason, alertId: alert.id },
    );

    this.emit('emergency:exit', reason);

    // Execute emergency sell-all if configured
    if (this.config.sellAllOnExit && this.state) {
      await this.executeEmergencySellAll();
    }

    // Stop monitoring — the swarm coordinator should handle state transition
    this.stopMonitoring();
    this.emergencyInProgress = false;
  }

  /**
   * Register a new safety rule in the rules engine.
   */
  addSafetyRule(rule: SafetyRule): void {
    if (this.rules.has(rule.id)) {
      this.logger.warn('Overwriting existing safety rule', { ruleId: rule.id, ruleName: rule.name });
    }
    this.rules.set(rule.id, rule);
    this.logger.info('Safety rule added', { ruleId: rule.id, ruleName: rule.name, action: rule.action });
  }

  /**
   * Remove a safety rule by ID.
   */
  removeSafetyRule(ruleId: string): void {
    const removed = this.rules.delete(ruleId);
    if (removed) {
      this.ruleCooldowns.delete(ruleId);
      this.logger.info('Safety rule removed', { ruleId });
    }
  }

  /**
   * Get the full alert history for post-mortem analysis.
   */
  getAlertHistory(): readonly AlertRecord[] {
    return this.alertHistory;
  }

  /**
   * Get the count of active (unresolved) alerts.
   */
  getActiveAlertCount(): number {
    return this.activeAlerts.size;
  }

  /**
   * Resolve an active alert by ID.
   */
  resolveAlert(alertId: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.activeAlerts.delete(alertId);
      this.emit('alert:resolved', alert);
      this.logger.info('Alert resolved', { alertId, ruleName: alert.ruleName });
    }
  }

  // ─── Event Bus Subscriptions ────────────────────────────────

  private subscribeToEvents(): void {
    // Listen for trade results
    const tradeSubId = this.eventBus.subscribe(
      'trade:*',
      (event: SwarmEvent) => this.handleTradeEvent(event),
      { source: this.id },
    );
    this.subscriptionIds.push(tradeSubId);

    // Listen for bonding curve updates
    const curveSubId = this.eventBus.subscribe(
      'curve:*',
      (event: SwarmEvent) => this.handleCurveEvent(event),
      { source: this.id },
    );
    this.subscriptionIds.push(curveSubId);

    // Listen for agent heartbeats
    const heartbeatSubId = this.eventBus.subscribe(
      'agent:heartbeat',
      (event: SwarmEvent) => this.handleHeartbeat(event),
      { source: this.id },
    );
    this.subscriptionIds.push(heartbeatSubId);

    // Listen for holder changes
    const holderSubId = this.eventBus.subscribe(
      'analytics:*',
      (event: SwarmEvent) => this.handleAnalyticsEvent(event),
      { source: this.id },
    );
    this.subscriptionIds.push(holderSubId);

    // Listen for wallet balance updates
    const walletSubId = this.eventBus.subscribe(
      'wallet:*',
      (event: SwarmEvent) => this.handleWalletEvent(event),
      { source: this.id },
    );
    this.subscriptionIds.push(walletSubId);
  }

  private handleTradeEvent(event: SwarmEvent): void {
    if (!this.state) return;

    this.state.totalTradesObserved++;

    if (event.type === 'trade:executed') {
      const result = event.payload as unknown as Partial<TradeResult>;
      if (result.success) {
        this.state.successfulTradesObserved++;
        this.state.lastSuccessfulTradeAt = Date.now();

        if (result.order?.direction === 'buy' && result.order?.amount) {
          this.state.totalSolSpent = this.state.totalSolSpent.add(
            new BN(result.order.amount.toString()),
          );
        } else if (result.order?.direction === 'sell' && result.amountOut) {
          this.state.totalSolReceived = this.state.totalSolReceived.add(
            new BN(result.amountOut.toString()),
          );
        }

        // Track price
        if (result.executionPrice) {
          this.state.priceHistory.push({
            price: new BN(result.executionPrice.toString()).toNumber(),
            timestamp: Date.now(),
          });
          if (this.state.priceHistory.length > MAX_PRICE_HISTORY) {
            this.state.priceHistory.shift();
          }
        }
      } else {
        this.state.failedTradesObserved++;
      }
    } else if (event.type === 'trade:failed') {
      this.state.failedTradesObserved++;
    }
  }

  private handleCurveEvent(event: SwarmEvent): void {
    if (!this.state) return;

    if (event.type === 'curve:updated' || event.type === 'curve:state') {
      const curveData = event.payload as unknown as Partial<BondingCurveState>;
      if (curveData.mint && curveData.graduationProgress !== undefined) {
        this.state.lastBondingCurveState = curveData as BondingCurveState;
      }
    }
  }

  private handleHeartbeat(event: SwarmEvent): void {
    if (!this.state) return;
    const agentId = event.payload['agentId'] as string | undefined;
    if (agentId) {
      this.state.agentHeartbeats.set(agentId, event.timestamp);
    }
  }

  private handleAnalyticsEvent(event: SwarmEvent): void {
    if (!this.state) return;

    if (event.type === 'analytics:holders_updated') {
      const holders = event.payload['topHolders'] as
        | Array<{ address: string; percentage: number }>
        | undefined;
      if (holders) {
        this.state.knownHolders.clear();
        for (const holder of holders) {
          this.state.knownHolders.set(holder.address, holder.percentage);
        }
      }
    }
  }

  private handleWalletEvent(event: SwarmEvent): void {
    if (!this.state) return;

    if (event.type === 'wallet:balance_updated') {
      const address = event.payload['address'] as string | undefined;
      const balanceLamports = event.payload['balanceLamports'] as string | undefined;
      if (address && balanceLamports) {
        const wallet = this.state.wallets.find((w) => w.address === address);
        if (wallet) {
          wallet.balanceLamports = new BN(balanceLamports);
        }
      }
    }
  }

  // ─── Monitoring Tick ────────────────────────────────────────

  /**
   * Core monitoring loop — runs every MONITOR_TICK_INTERVAL_MS.
   * Evaluates all enabled safety rules and triggers appropriate actions.
   */
  private async monitorTick(): Promise<void> {
    if (!this.running || !this.state) return;

    const now = Date.now();

    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      // Enforce cooldown — skip if rule triggered recently
      const lastTrigger = this.ruleCooldowns.get(rule.id);
      if (lastTrigger !== undefined && now - lastTrigger < rule.cooldownMs) {
        continue;
      }

      try {
        const triggered = await rule.condition();
        if (triggered) {
          await this.executeRuleAction(rule);
        }
      } catch (err) {
        this.logger.error(`Safety rule evaluation failed: ${rule.id}`, err instanceof Error ? err : new Error(String(err)));
      }
    }
  }

  // ─── Rule Execution ─────────────────────────────────────────

  private async executeRuleAction(rule: SafetyRule): Promise<void> {
    const now = Date.now();
    this.ruleCooldowns.set(rule.id, now);

    const alert: AlertRecord = {
      id: uuid(),
      ruleId: rule.id,
      ruleName: rule.name,
      action: rule.action,
      triggeredAt: now,
      message: `Safety rule "${rule.name}" triggered → action: ${rule.action}`,
      resolved: false,
    };

    this.alertHistory.push(alert);
    this.activeAlerts.set(alert.id, alert);
    this.emit('alert:triggered', alert);

    // Emit to event bus
    this.eventBus.emit(
      `sentinel:rule_triggered`,
      'system',
      this.id,
      {
        ruleId: rule.id,
        ruleName: rule.name,
        action: rule.action,
        alertId: alert.id,
      },
    );

    this.logger.warn(`Safety rule triggered: ${rule.name}`, {
      ruleId: rule.id,
      action: rule.action,
      alertId: alert.id,
    });

    switch (rule.action) {
      case 'alert':
        // Alert only — no automated action beyond logging and event emission
        break;

      case 'pause':
        this.eventBus.emit(
          'sentinel:request_pause',
          'coordination',
          this.id,
          { reason: rule.name, alertId: alert.id },
        );
        break;

      case 'exit':
        this.eventBus.emit(
          'sentinel:request_exit',
          'coordination',
          this.id,
          { reason: rule.name, alertId: alert.id },
        );
        break;

      case 'emergency_exit':
        await this.triggerEmergencyExit(
          `Safety rule "${rule.name}" triggered emergency exit`,
        );
        break;
    }
  }

  // ─── Default Safety Rules ──────────────────────────────────

  private registerDefaultRules(): void {
    // 1. Max absolute loss
    this.addSafetyRule({
      id: 'max-loss',
      name: 'Maximum SOL Loss',
      condition: () => {
        if (!this.state) return false;
        const netLoss = this.state.totalSolSpent.sub(this.state.totalSolReceived);
        return netLoss.gt(new BN(0)) && netLoss.gte(this.config.maxLossLamports);
      },
      action: 'emergency_exit',
      cooldownMs: 30_000,
      enabled: true,
    });

    // 2. Max percentage loss
    this.addSafetyRule({
      id: 'max-loss-percent',
      name: 'Maximum Percentage Loss',
      condition: () => {
        if (!this.state) return false;
        if (this.state.initialTotalBalanceLamports.isZero()) return false;
        const netLoss = this.state.totalSolSpent.sub(this.state.totalSolReceived);
        if (netLoss.lte(new BN(0))) return false;
        const lossBps = netLoss
          .mul(new BN(10_000))
          .div(this.state.initialTotalBalanceLamports);
        const lossPercent = lossBps.toNumber() / 100;
        return lossPercent >= this.config.maxLossPercent;
      },
      action: 'emergency_exit',
      cooldownMs: 30_000,
      enabled: true,
    });

    // 3. Silence timeout — no successful trade in N ms
    this.addSafetyRule({
      id: 'silence-timeout',
      name: 'Trading Silence Timeout',
      condition: () => {
        if (!this.state) return false;
        // Only check if at least one trade has been attempted
        if (this.state.totalTradesObserved === 0) return false;
        const silenceDuration = Date.now() - this.state.lastSuccessfulTradeAt;
        return silenceDuration >= this.config.maxSilenceMs;
      },
      action: 'pause',
      cooldownMs: this.config.maxSilenceMs,
      enabled: true,
    });

    // 4. RPC degraded — too many unhealthy endpoints
    this.addSafetyRule({
      id: 'rpc-degraded',
      name: 'RPC Connectivity Degraded',
      condition: () => {
        // Query the event bus for recent RPC health events
        const recentRpcEvents = this.eventBus.getHistory({
          type: 'rpc:health_check',
          since: Date.now() - 60_000,
          limit: 10,
        });

        if (recentRpcEvents.length === 0) return false;

        const latest = recentRpcEvents[recentRpcEvents.length - 1];
        if (!latest) return false;

        const totalEndpoints = (latest.payload['totalEndpoints'] as number) ?? 0;
        const healthyEndpoints = (latest.payload['healthyEndpoints'] as number) ?? 0;

        if (totalEndpoints === 0) return true;
        return healthyEndpoints / totalEndpoints < RPC_UNHEALTHY_RATIO_THRESHOLD;
      },
      action: 'pause',
      cooldownMs: 60_000,
      enabled: true,
    });

    // 5. Budget exhausted — all wallets below minimum
    this.addSafetyRule({
      id: 'budget-exhausted',
      name: 'Budget Exhausted',
      condition: () => {
        if (!this.state) return false;
        return this.state.wallets.every(
          (w) => w.balanceLamports.lt(new BN(MIN_WALLET_BALANCE_LAMPORTS)),
        );
      },
      action: 'exit',
      cooldownMs: 30_000,
      enabled: true,
    });

    // 6. Whale detected — single non-swarm wallet buys >10% supply
    this.addSafetyRule({
      id: 'whale-detected',
      name: 'Whale Buy Detected',
      condition: () => {
        if (!this.state) return false;
        const swarmAddresses = new Set(this.state.wallets.map((w) => w.address));
        for (const [address, percentage] of this.state.knownHolders) {
          if (!swarmAddresses.has(address) && percentage >= WHALE_THRESHOLD_PERCENT) {
            return true;
          }
        }
        return false;
      },
      action: 'alert',
      cooldownMs: 120_000,
      enabled: true,
    });

    // 7. Graduation imminent — bonding curve >90% toward graduation
    this.addSafetyRule({
      id: 'graduation-imminent',
      name: 'Graduation Imminent',
      condition: () => {
        if (!this.state?.lastBondingCurveState) return false;
        return (
          this.state.lastBondingCurveState.graduationProgress >=
          GRADUATION_IMMINENT_THRESHOLD
        );
      },
      action: 'alert',
      cooldownMs: 60_000,
      enabled: true,
    });

    // 8. High trade failure rate
    this.addSafetyRule({
      id: 'high-failure-rate',
      name: 'High Trade Failure Rate',
      condition: () => {
        if (!this.state) return false;
        if (this.state.totalTradesObserved < 5) return false; // Need minimum sample
        const failureRate =
          this.state.failedTradesObserved / this.state.totalTradesObserved;
        return failureRate >= FAILURE_RATE_THRESHOLD;
      },
      action: 'pause',
      cooldownMs: 120_000,
      enabled: true,
    });

    // 9. Agent unresponsive — agent heartbeat timeout
    this.addSafetyRule({
      id: 'agent-unresponsive',
      name: 'Agent Unresponsive',
      condition: () => {
        if (!this.state) return false;
        const now = Date.now();
        for (const [, lastSeen] of this.state.agentHeartbeats) {
          if (now - lastSeen > AGENT_HEARTBEAT_TIMEOUT_MS) {
            return true;
          }
        }
        return false;
      },
      action: 'alert',
      cooldownMs: 60_000,
      enabled: true,
    });

    // 10. Extreme price volatility
    this.addSafetyRule({
      id: 'extreme-volatility',
      name: 'Extreme Price Volatility',
      condition: () => {
        if (!this.state) return false;
        const now = Date.now();
        const recentPrices = this.state.priceHistory.filter(
          (p) => now - p.timestamp <= VOLATILITY_WINDOW_MS,
        );
        if (recentPrices.length < 2) return false;

        const prices = recentPrices.map((p) => p.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);

        if (minPrice === 0) return false;
        const changePercent = ((maxPrice - minPrice) / minPrice) * 100;
        return changePercent >= EXTREME_VOLATILITY_THRESHOLD_PERCENT;
      },
      action: 'alert',
      cooldownMs: 120_000,
      enabled: true,
    });
  }

  // ─── Health Check Implementations ──────────────────────────

  private checkWalletBalances(): HealthCheck {
    if (!this.state) {
      return { name: 'wallet_balances', status: 'critical', message: 'No monitoring state' };
    }

    const lowBalanceWallets = this.state.wallets.filter((w) =>
      w.balanceLamports.lt(new BN(MIN_WALLET_BALANCE_LAMPORTS)),
    );

    if (lowBalanceWallets.length === this.state.wallets.length) {
      return {
        name: 'wallet_balances',
        status: 'critical',
        message: `All ${this.state.wallets.length} wallets below minimum balance`,
        value: lowBalanceWallets.length,
      };
    }
    if (lowBalanceWallets.length > 0) {
      return {
        name: 'wallet_balances',
        status: 'warning',
        message: `${lowBalanceWallets.length}/${this.state.wallets.length} wallets below minimum balance`,
        value: lowBalanceWallets.length,
      };
    }
    return { name: 'wallet_balances', status: 'ok', message: 'All wallets funded' };
  }

  private checkPnL(): HealthCheck {
    if (!this.state) {
      return { name: 'pnl', status: 'critical', message: 'No monitoring state' };
    }

    const netLoss = this.state.totalSolSpent.sub(this.state.totalSolReceived);
    if (netLoss.lte(new BN(0))) {
      const profit = this.state.totalSolReceived.sub(this.state.totalSolSpent);
      return {
        name: 'pnl',
        status: 'ok',
        message: `Net profit: ${(profit.toNumber() / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
        value: profit.toNumber() / LAMPORTS_PER_SOL,
      };
    }

    const lossSol = netLoss.toNumber() / LAMPORTS_PER_SOL;
    const maxLossSol = this.config.maxLossLamports.toNumber() / LAMPORTS_PER_SOL;

    if (netLoss.gte(this.config.maxLossLamports)) {
      return {
        name: 'pnl',
        status: 'critical',
        message: `Net loss ${lossSol.toFixed(4)} SOL exceeds maximum ${maxLossSol.toFixed(4)} SOL`,
        value: -lossSol,
      };
    }

    const lossRatio = netLoss.toNumber() / this.config.maxLossLamports.toNumber();
    if (lossRatio >= 0.75) {
      return {
        name: 'pnl',
        status: 'warning',
        message: `Net loss ${lossSol.toFixed(4)} SOL approaching maximum ${maxLossSol.toFixed(4)} SOL (${(lossRatio * 100).toFixed(0)}%)`,
        value: -lossSol,
      };
    }

    return {
      name: 'pnl',
      status: 'ok',
      message: `Net loss ${lossSol.toFixed(4)} SOL within limits`,
      value: -lossSol,
    };
  }

  private checkTradeSuccessRate(): HealthCheck {
    if (!this.state || this.state.totalTradesObserved === 0) {
      return {
        name: 'trade_success_rate',
        status: 'ok',
        message: 'No trades observed yet',
        value: 1,
      };
    }

    const successRate =
      this.state.successfulTradesObserved / this.state.totalTradesObserved;

    if (successRate < FAILURE_RATE_THRESHOLD) {
      return {
        name: 'trade_success_rate',
        status: 'critical',
        message: `Success rate ${(successRate * 100).toFixed(1)}% is below ${(FAILURE_RATE_THRESHOLD * 100).toFixed(0)}% threshold`,
        value: successRate,
      };
    }
    if (successRate < 0.75) {
      return {
        name: 'trade_success_rate',
        status: 'warning',
        message: `Success rate ${(successRate * 100).toFixed(1)}% is degraded`,
        value: successRate,
      };
    }
    return {
      name: 'trade_success_rate',
      status: 'ok',
      message: `Success rate ${(successRate * 100).toFixed(1)}%`,
      value: successRate,
    };
  }

  private checkSilence(now: number): HealthCheck {
    if (!this.state) {
      return { name: 'silence', status: 'critical', message: 'No monitoring state' };
    }

    const silenceMs = now - this.state.lastSuccessfulTradeAt;
    const silenceMinutes = silenceMs / 60_000;
    const maxSilenceMinutes = this.config.maxSilenceMs / 60_000;

    if (silenceMs >= this.config.maxSilenceMs) {
      return {
        name: 'silence',
        status: 'critical',
        message: `No successful trade for ${silenceMinutes.toFixed(1)} minutes (max: ${maxSilenceMinutes.toFixed(1)})`,
        value: silenceMs,
      };
    }

    const silenceRatio = silenceMs / this.config.maxSilenceMs;
    if (silenceRatio >= 0.75) {
      return {
        name: 'silence',
        status: 'warning',
        message: `No successful trade for ${silenceMinutes.toFixed(1)} minutes (approaching limit)`,
        value: silenceMs,
      };
    }

    return {
      name: 'silence',
      status: 'ok',
      message: `Last successful trade ${silenceMinutes.toFixed(1)} minutes ago`,
      value: silenceMs,
    };
  }

  private checkBondingCurve(): HealthCheck {
    if (!this.state?.lastBondingCurveState) {
      return {
        name: 'bonding_curve',
        status: 'ok',
        message: 'No bonding curve data available',
      };
    }

    const state = this.state.lastBondingCurveState;

    if (state.complete) {
      return {
        name: 'bonding_curve',
        status: 'critical',
        message: 'Token has graduated to AMM',
        value: 100,
      };
    }

    if (state.graduationProgress >= GRADUATION_IMMINENT_THRESHOLD) {
      return {
        name: 'bonding_curve',
        status: 'warning',
        message: `Graduation imminent: ${state.graduationProgress.toFixed(1)}%`,
        value: state.graduationProgress,
      };
    }

    return {
      name: 'bonding_curve',
      status: 'ok',
      message: `Graduation progress: ${state.graduationProgress.toFixed(1)}%`,
      value: state.graduationProgress,
    };
  }

  private checkPriceVolatility(now: number): HealthCheck {
    if (!this.state) {
      return { name: 'price_volatility', status: 'ok', message: 'No monitoring state' };
    }

    const recentPrices = this.state.priceHistory.filter(
      (p) => now - p.timestamp <= VOLATILITY_WINDOW_MS,
    );

    if (recentPrices.length < 2) {
      return {
        name: 'price_volatility',
        status: 'ok',
        message: 'Insufficient price data for volatility analysis',
      };
    }

    const prices = recentPrices.map((p) => p.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === 0) {
      return { name: 'price_volatility', status: 'ok', message: 'Awaiting valid price data' };
    }

    const changePercent = ((maxPrice - minPrice) / minPrice) * 100;

    if (changePercent >= EXTREME_VOLATILITY_THRESHOLD_PERCENT) {
      return {
        name: 'price_volatility',
        status: 'critical',
        message: `Extreme volatility: ${changePercent.toFixed(1)}% price range in 5min window`,
        value: changePercent,
      };
    }
    if (changePercent >= EXTREME_VOLATILITY_THRESHOLD_PERCENT / 2) {
      return {
        name: 'price_volatility',
        status: 'warning',
        message: `Elevated volatility: ${changePercent.toFixed(1)}% price range in 5min window`,
        value: changePercent,
      };
    }

    return {
      name: 'price_volatility',
      status: 'ok',
      message: `Price volatility: ${changePercent.toFixed(1)}% in 5min window`,
      value: changePercent,
    };
  }

  private checkAgentHealth(now: number): HealthCheck {
    if (!this.state || this.state.agentHeartbeats.size === 0) {
      return {
        name: 'agent_health',
        status: 'ok',
        message: 'No agent heartbeat data',
      };
    }

    const unresponsive: string[] = [];
    for (const [agentId, lastSeen] of this.state.agentHeartbeats) {
      if (now - lastSeen > AGENT_HEARTBEAT_TIMEOUT_MS) {
        unresponsive.push(agentId);
      }
    }

    if (unresponsive.length > 0) {
      const total = this.state.agentHeartbeats.size;
      if (unresponsive.length === total) {
        return {
          name: 'agent_health',
          status: 'critical',
          message: `All ${total} agents unresponsive`,
          value: unresponsive.length,
        };
      }
      return {
        name: 'agent_health',
        status: 'warning',
        message: `${unresponsive.length}/${total} agents unresponsive: ${unresponsive.join(', ')}`,
        value: unresponsive.length,
      };
    }

    return {
      name: 'agent_health',
      status: 'ok',
      message: `All ${this.state.agentHeartbeats.size} agents responsive`,
      value: 0,
    };
  }

  private checkBudget(): HealthCheck {
    if (!this.state) {
      return { name: 'budget', status: 'critical', message: 'No monitoring state' };
    }

    const totalBalance = this.state.wallets.reduce(
      (sum, w) => sum.add(w.balanceLamports),
      new BN(0),
    );

    const totalBalanceSol = totalBalance.toNumber() / LAMPORTS_PER_SOL;
    const allBelowMinimum = this.state.wallets.every((w) =>
      w.balanceLamports.lt(new BN(MIN_WALLET_BALANCE_LAMPORTS)),
    );

    if (allBelowMinimum) {
      return {
        name: 'budget',
        status: 'critical',
        message: `Budget exhausted — total remaining: ${totalBalanceSol.toFixed(4)} SOL`,
        value: totalBalanceSol,
      };
    }

    const initialSol =
      this.state.initialTotalBalanceLamports.toNumber() / LAMPORTS_PER_SOL;
    const usagePercent =
      initialSol > 0
        ? ((initialSol - totalBalanceSol) / initialSol) * 100
        : 0;

    if (usagePercent >= 90) {
      return {
        name: 'budget',
        status: 'warning',
        message: `Budget ${usagePercent.toFixed(0)}% consumed — ${totalBalanceSol.toFixed(4)} SOL remaining`,
        value: totalBalanceSol,
      };
    }

    return {
      name: 'budget',
      status: 'ok',
      message: `Budget ${usagePercent.toFixed(0)}% consumed — ${totalBalanceSol.toFixed(4)} SOL remaining`,
      value: totalBalanceSol,
    };
  }

  // ─── Emergency Sell-All ────────────────────────────────────

  /**
   * Attempt to sell all token positions across all wallets.
   * This is a best-effort operation — individual sell failures
   * are logged but do not prevent the exit from proceeding.
   */
  private async executeEmergencySellAll(): Promise<void> {
    if (!this.state) return;

    this.logger.warn('Executing emergency sell-all', {
      mint: this.state.mint,
      walletCount: this.state.wallets.length,
    });

    this.eventBus.emit(
      'sentinel:emergency_sell_all',
      'trading',
      this.id,
      { mint: this.state.mint, walletCount: this.state.wallets.length },
    );

    // Emit sell request events for each wallet so the swarm coordinator
    // or trader agents can execute the actual sells
    for (const wallet of this.state.wallets) {
      this.eventBus.emit(
        'sentinel:sell_all_tokens',
        'trading',
        this.id,
        {
          mint: this.state.mint,
          walletAddress: wallet.address,
          walletLabel: wallet.label,
          reason: 'emergency_exit',
        },
      );
    }

    // Wait briefly for sell events to propagate
    await new Promise<void>((resolve) => setTimeout(resolve, 2_000));

    if (this.config.reclaimOnExit) {
      this.eventBus.emit(
        'sentinel:reclaim_funds',
        'wallet',
        this.id,
        { walletCount: this.state.wallets.length },
      );
    }
  }
}
