/**
 * Immutable Audit Logger — Append-only audit trail for full session traceability
 *
 * Features:
 * - Monotonically increasing sequence numbers (never reset)
 * - Append-only: entries can never be modified or deleted (except FIFO eviction)
 * - Auto-capture from SwarmEventBus for trades, decisions, phase changes, errors
 * - Filtering, searching, and exporting (JSON/CSV)
 * - Trade audit summaries with aggregated statistics
 */

import { v4 as uuidv4 } from 'uuid';

import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';
import type { SwarmEvent } from '../types.js';

// ─── Types ────────────────────────────────────────────────────

export type AuditCategory =
  | 'trade'
  | 'decision'
  | 'phase'
  | 'wallet'
  | 'risk'
  | 'agent'
  | 'system'
  | 'error';

export type AuditSeverity =
  | 'debug'
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

export interface AuditEntry {
  /** Auto-generated unique ID */
  id: string;
  /** Monotonically increasing sequence number */
  sequence: number;
  /** Timestamp */
  timestamp: number;
  /** Category of action */
  category: AuditCategory;
  /** Severity level */
  severity: AuditSeverity;
  /** Agent that performed the action (or 'system') */
  agentId: string;
  /** What happened */
  action: string;
  /** Detailed description */
  details: string;
  /** Relevant token mint address */
  mint?: string;
  /** On-chain transaction signature */
  signature?: string;
  /** Success or failure */
  success: boolean;
  /** Structured metadata */
  metadata: Record<string, unknown>;
}

export interface TradeAuditData {
  agentId: string;
  mint: string;
  type: 'buy' | 'sell';
  amountSOL: number;
  amountTokens: string;
  price: number;
  signature: string;
  slippage: number;
  fee: number;
  success: boolean;
  error?: string;
}

export interface TradeAuditSummary {
  totalTrades: number;
  successfulTrades: number;
  failedTrades: number;
  totalBuys: number;
  totalSells: number;
  totalVolumeSOL: number;
  totalFees: number;
  uniqueTokens: number;
  uniqueAgents: number;
  firstTrade: number;
  lastTrade: number;
  avgTradeSize: number;
  tradesPerAgent: Record<string, number>;
}

export interface DecisionAuditData {
  agentId: string;
  decisionType: string;
  action: string;
  confidence: number;
  reasoning: string;
  parameters: Record<string, unknown>;
}

export interface AuditFilter {
  category?: AuditCategory[];
  severity?: AuditSeverity[];
  agentId?: string;
  mint?: string;
  startTime?: number;
  endTime?: number;
  success?: boolean;
  limit?: number;
  offset?: number;
  /** Text search in action/details */
  search?: string;
}

export interface AuditConfig {
  /** Max entries to keep (FIFO eviction) */
  maxEntries: number;
  /** Auto-subscribe to event bus on construction */
  autoCapture: boolean;
  /** Minimum severity to capture */
  minSeverity: AuditSeverity;
  /** Include raw event data in entries */
  includeRawData: boolean;
}

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_MAX_ENTRIES = 50_000;

const SEVERITY_PRIORITY: Record<AuditSeverity, number> = {
  debug: 0,
  info: 1,
  warning: 2,
  error: 3,
  critical: 4,
};

const CSV_HEADERS = [
  'id',
  'sequence',
  'timestamp',
  'category',
  'severity',
  'agentId',
  'action',
  'details',
  'mint',
  'signature',
  'success',
] as const;

// ─── AuditLogger ──────────────────────────────────────────────

export class AuditLogger {
  private readonly entries: AuditEntry[] = [];
  private readonly eventBus: SwarmEventBus;
  private readonly config: AuditConfig;
  private readonly logger: SwarmLogger;
  private readonly subscriptionIds: string[] = [];
  private sequenceCounter = 0;
  private capturing = false;

  constructor(eventBus: SwarmEventBus, config?: Partial<AuditConfig>) {
    this.eventBus = eventBus;
    this.config = {
      maxEntries: config?.maxEntries ?? DEFAULT_MAX_ENTRIES,
      autoCapture: config?.autoCapture ?? true,
      minSeverity: config?.minSeverity ?? 'info',
      includeRawData: config?.includeRawData ?? false,
    };
    this.logger = SwarmLogger.create('audit-logger', 'coordination');

    if (this.config.autoCapture) {
      this.startAutoCapture();
    }
  }

  // ─── Core Logging ─────────────────────────────────────────

  /**
   * Log any action. Assigns id, timestamp, and sequence automatically.
   * Entries are append-only — once written, they cannot be modified.
   */
  logAction(
    entry: Omit<AuditEntry, 'id' | 'timestamp' | 'sequence'>,
  ): void {
    if (!this.meetsMinSeverity(entry.severity)) {
      return;
    }

    const auditEntry: AuditEntry = {
      ...entry,
      id: uuidv4(),
      sequence: this.nextSequence(),
      timestamp: Date.now(),
    };

    this.appendEntry(auditEntry);
  }

  /**
   * Convenience method for trade logging.
   * Creates a detailed audit entry from structured trade data.
   */
  logTrade(trade: TradeAuditData): void {
    this.logAction({
      category: 'trade',
      severity: trade.success ? 'info' : 'error',
      agentId: trade.agentId,
      action: `trade:${trade.type}`,
      details: trade.success
        ? `${trade.type.toUpperCase()} ${trade.amountSOL} SOL of ${trade.mint.slice(0, 8)}… at price ${trade.price} (slippage: ${trade.slippage}%)`
        : `Failed ${trade.type.toUpperCase()} ${trade.amountSOL} SOL of ${trade.mint.slice(0, 8)}…: ${trade.error ?? 'unknown error'}`,
      mint: trade.mint,
      signature: trade.signature,
      success: trade.success,
      metadata: {
        type: trade.type,
        amountSOL: trade.amountSOL,
        amountTokens: trade.amountTokens,
        price: trade.price,
        slippage: trade.slippage,
        fee: trade.fee,
        ...(trade.error !== undefined && { error: trade.error }),
      },
    });
  }

  /**
   * Convenience method for strategy decision logging.
   */
  logDecision(decision: DecisionAuditData): void {
    this.logAction({
      category: 'decision',
      severity: 'info',
      agentId: decision.agentId,
      action: `decision:${decision.decisionType}`,
      details: `${decision.action} (confidence: ${(decision.confidence * 100).toFixed(1)}%) — ${decision.reasoning}`,
      success: true,
      metadata: {
        decisionType: decision.decisionType,
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        parameters: decision.parameters,
      },
    });
  }

  /**
   * Log a phase transition (e.g. 'trading' → 'graduating').
   */
  logPhaseChange(from: string, to: string, reason: string): void {
    this.logAction({
      category: 'phase',
      severity: 'info',
      agentId: 'system',
      action: 'phase:transition',
      details: `Phase changed from '${from}' to '${to}': ${reason}`,
      success: true,
      metadata: { from, to, reason },
    });
  }

  /**
   * Log an error with full context.
   */
  logError(
    error: Error | string,
    context: Record<string, unknown>,
  ): void {
    const message =
      error instanceof Error ? error.message : error;
    const stack =
      error instanceof Error ? error.stack : undefined;

    this.logAction({
      category: 'error',
      severity: 'error',
      agentId: (context['agentId'] as string) ?? 'system',
      action: 'error:occurred',
      details: message,
      success: false,
      metadata: {
        ...context,
        ...(stack !== undefined && { stack }),
      },
    });
  }

  /**
   * Log wallet activity (funding, draining, transfers).
   */
  logWalletActivity(
    wallet: string,
    activity: string,
    amount?: number,
    signature?: string,
  ): void {
    this.logAction({
      category: 'wallet',
      severity: 'info',
      agentId: 'system',
      action: `wallet:${activity}`,
      details:
        amount !== undefined
          ? `Wallet ${wallet.slice(0, 8)}… ${activity}: ${amount} SOL`
          : `Wallet ${wallet.slice(0, 8)}… ${activity}`,
      signature,
      success: true,
      metadata: {
        wallet,
        activity,
        ...(amount !== undefined && { amount }),
        ...(signature !== undefined && { signature }),
      },
    });
  }

  // ─── Query ────────────────────────────────────────────────

  /**
   * Retrieve audit entries matching the given filter criteria.
   * Returns entries in chronological order (oldest first).
   */
  getAuditTrail(filter?: AuditFilter): AuditEntry[] {
    let results = this.entries.slice();

    if (filter === undefined) {
      return results;
    }

    if (filter.category !== undefined && filter.category.length > 0) {
      const categorySet = new Set(filter.category);
      results = results.filter((e) => categorySet.has(e.category));
    }

    if (filter.severity !== undefined && filter.severity.length > 0) {
      const severitySet = new Set(filter.severity);
      results = results.filter((e) => severitySet.has(e.severity));
    }

    if (filter.agentId !== undefined) {
      results = results.filter((e) => e.agentId === filter.agentId);
    }

    if (filter.mint !== undefined) {
      results = results.filter((e) => e.mint === filter.mint);
    }

    if (filter.startTime !== undefined) {
      results = results.filter((e) => e.timestamp >= filter.startTime!);
    }

    if (filter.endTime !== undefined) {
      results = results.filter((e) => e.timestamp <= filter.endTime!);
    }

    if (filter.success !== undefined) {
      results = results.filter((e) => e.success === filter.success);
    }

    if (filter.search !== undefined && filter.search.length > 0) {
      const searchLower = filter.search.toLowerCase();
      results = results.filter(
        (e) =>
          e.action.toLowerCase().includes(searchLower) ||
          e.details.toLowerCase().includes(searchLower),
      );
    }

    if (filter.offset !== undefined && filter.offset > 0) {
      results = results.slice(filter.offset);
    }

    if (filter.limit !== undefined && filter.limit > 0) {
      results = results.slice(0, filter.limit);
    }

    return results;
  }

  /**
   * Generate an aggregated trade audit summary.
   */
  getTradeAudit(): TradeAuditSummary {
    const tradeEntries = this.entries.filter(
      (e) => e.category === 'trade',
    );

    if (tradeEntries.length === 0) {
      return {
        totalTrades: 0,
        successfulTrades: 0,
        failedTrades: 0,
        totalBuys: 0,
        totalSells: 0,
        totalVolumeSOL: 0,
        totalFees: 0,
        uniqueTokens: 0,
        uniqueAgents: 0,
        firstTrade: 0,
        lastTrade: 0,
        avgTradeSize: 0,
        tradesPerAgent: {},
      };
    }

    const uniqueTokens = new Set<string>();
    const uniqueAgents = new Set<string>();
    const tradesPerAgent: Record<string, number> = {};

    let successfulTrades = 0;
    let failedTrades = 0;
    let totalBuys = 0;
    let totalSells = 0;
    let totalVolumeSOL = 0;
    let totalFees = 0;

    for (const entry of tradeEntries) {
      if (entry.success) {
        successfulTrades++;
      } else {
        failedTrades++;
      }

      const tradeType = entry.metadata['type'] as
        | 'buy'
        | 'sell'
        | undefined;
      if (tradeType === 'buy') {
        totalBuys++;
      } else if (tradeType === 'sell') {
        totalSells++;
      }

      const amountSOL = entry.metadata['amountSOL'];
      if (typeof amountSOL === 'number') {
        totalVolumeSOL += amountSOL;
      }

      const fee = entry.metadata['fee'];
      if (typeof fee === 'number') {
        totalFees += fee;
      }

      if (entry.mint !== undefined) {
        uniqueTokens.add(entry.mint);
      }

      uniqueAgents.add(entry.agentId);
      tradesPerAgent[entry.agentId] =
        (tradesPerAgent[entry.agentId] ?? 0) + 1;
    }

    const firstTrade = tradeEntries[0]!.timestamp;
    const lastTrade = tradeEntries[tradeEntries.length - 1]!.timestamp;

    return {
      totalTrades: tradeEntries.length,
      successfulTrades,
      failedTrades,
      totalBuys,
      totalSells,
      totalVolumeSOL,
      totalFees,
      uniqueTokens: uniqueTokens.size,
      uniqueAgents: uniqueAgents.size,
      firstTrade,
      lastTrade,
      avgTradeSize:
        tradeEntries.length > 0
          ? totalVolumeSOL / tradeEntries.length
          : 0,
      tradesPerAgent,
    };
  }

  // ─── Export ───────────────────────────────────────────────

  /**
   * Export the full audit log in the specified format.
   */
  exportAuditLog(format: 'json' | 'csv'): string {
    if (format === 'json') {
      return JSON.stringify(this.entries, null, 2);
    }

    return this.exportCsv();
  }

  /**
   * Return the current number of audit entries.
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  // ─── Auto-Capture ─────────────────────────────────────────

  /**
   * Subscribe to event bus events and automatically create audit entries.
   * Subscribes to trades, decisions, phase changes, risk, agent, wallet,
   * and error events.
   */
  startAutoCapture(): void {
    if (this.capturing) {
      return;
    }
    this.capturing = true;

    this.logger.info('Starting auto-capture from event bus');

    // trade:executed → category: trade
    this.addSubscription(
      'trade:executed',
      (event) => this.handleTradeExecuted(event),
    );

    // trade:failed → category: trade, success: false
    this.addSubscription(
      'trade:failed',
      (event) => this.handleTradeFailed(event),
    );

    // decision:made → category: decision
    this.addSubscription(
      'decision:*',
      (event) => this.handleDecision(event),
    );

    // phase:transition → category: phase
    this.addSubscription(
      'phase:*',
      (event) => this.handlePhaseChange(event),
    );

    // risk:* → category: risk
    this.addSubscription(
      'risk:*',
      (event) => this.handleRiskEvent(event),
    );

    // agent:* → category: agent (spawned, died, restarted)
    this.addSubscription(
      'agent:*',
      (event) => this.handleAgentEvent(event),
    );

    // wallet:* → category: wallet
    this.addSubscription(
      'wallet:*',
      (event) => this.handleWalletEvent(event),
    );

    // error:* → category: error
    this.addSubscription(
      'error:*',
      (event) => this.handleErrorEvent(event),
    );
  }

  /**
   * Unsubscribe from all event bus auto-capture subscriptions.
   */
  stopAutoCapture(): void {
    if (!this.capturing) {
      return;
    }

    this.logger.info('Stopping auto-capture from event bus');

    for (const subId of this.subscriptionIds) {
      this.eventBus.unsubscribe(subId);
    }
    this.subscriptionIds.length = 0;
    this.capturing = false;
  }

  // ─── Private: Subscription Helpers ────────────────────────

  private addSubscription(
    pattern: string,
    handler: (event: SwarmEvent) => void,
  ): void {
    const subId = this.eventBus.subscribe(pattern, handler, {
      source: 'audit-logger',
    });
    this.subscriptionIds.push(subId);
  }

  // ─── Private: Event Handlers ──────────────────────────────

  private handleTradeExecuted(event: SwarmEvent): void {
    const payload = event.payload;
    this.logAction({
      category: 'trade',
      severity: 'info',
      agentId: event.source,
      action: 'trade:executed',
      details: `Trade executed: ${String(payload['direction'] ?? 'unknown')} ${String(payload['amountSOL'] ?? payload['amount'] ?? '?')} SOL`,
      mint: payload['mint'] as string | undefined,
      signature: payload['signature'] as string | undefined,
      success: true,
      metadata: this.config.includeRawData
        ? { ...payload, rawEvent: event }
        : { ...payload },
    });
  }

  private handleTradeFailed(event: SwarmEvent): void {
    const payload = event.payload;
    this.logAction({
      category: 'trade',
      severity: 'error',
      agentId: event.source,
      action: 'trade:failed',
      details: `Trade failed: ${String(payload['error'] ?? 'unknown error')}`,
      mint: payload['mint'] as string | undefined,
      signature: payload['signature'] as string | undefined,
      success: false,
      metadata: this.config.includeRawData
        ? { ...payload, rawEvent: event }
        : { ...payload },
    });
  }

  private handleDecision(event: SwarmEvent): void {
    const payload = event.payload;
    this.logAction({
      category: 'decision',
      severity: 'info',
      agentId: event.source,
      action: event.type,
      details: `Decision: ${String(payload['action'] ?? event.type)} (confidence: ${String(payload['confidence'] ?? 'N/A')})`,
      success: true,
      metadata: this.config.includeRawData
        ? { ...payload, rawEvent: event }
        : { ...payload },
    });
  }

  private handlePhaseChange(event: SwarmEvent): void {
    const payload = event.payload;
    this.logAction({
      category: 'phase',
      severity: 'info',
      agentId: event.source,
      action: event.type,
      details: `Phase: ${String(payload['from'] ?? '?')} → ${String(payload['to'] ?? '?')} (${String(payload['reason'] ?? 'no reason')})`,
      success: true,
      metadata: this.config.includeRawData
        ? { ...payload, rawEvent: event }
        : { ...payload },
    });
  }

  private handleRiskEvent(event: SwarmEvent): void {
    const payload = event.payload;
    const severity = this.riskSeverity(payload);
    this.logAction({
      category: 'risk',
      severity,
      agentId: event.source,
      action: event.type,
      details: `Risk event: ${String(payload['description'] ?? event.type)}`,
      mint: payload['mint'] as string | undefined,
      success: true,
      metadata: this.config.includeRawData
        ? { ...payload, rawEvent: event }
        : { ...payload },
    });
  }

  private handleAgentEvent(event: SwarmEvent): void {
    const payload = event.payload;
    this.logAction({
      category: 'agent',
      severity: 'info',
      agentId:
        (payload['agentId'] as string) ?? event.source,
      action: event.type,
      details: `Agent event: ${event.type} — ${String(payload['reason'] ?? payload['status'] ?? '')}`,
      success: true,
      metadata: this.config.includeRawData
        ? { ...payload, rawEvent: event }
        : { ...payload },
    });
  }

  private handleWalletEvent(event: SwarmEvent): void {
    const payload = event.payload;
    this.logAction({
      category: 'wallet',
      severity: 'info',
      agentId: event.source,
      action: event.type,
      details: `Wallet: ${String(payload['wallet'] ?? payload['address'] ?? '?')} — ${String(payload['activity'] ?? event.type)}`,
      signature: payload['signature'] as string | undefined,
      success: true,
      metadata: this.config.includeRawData
        ? { ...payload, rawEvent: event }
        : { ...payload },
    });
  }

  private handleErrorEvent(event: SwarmEvent): void {
    const payload = event.payload;
    this.logAction({
      category: 'error',
      severity: 'error',
      agentId: event.source,
      action: event.type,
      details: `Error: ${String(payload['message'] ?? payload['error'] ?? event.type)}`,
      success: false,
      metadata: this.config.includeRawData
        ? { ...payload, rawEvent: event }
        : { ...payload },
    });
  }

  // ─── Private: Helpers ─────────────────────────────────────

  /**
   * Append an entry to the immutable log, enforcing FIFO eviction.
   */
  private appendEntry(entry: AuditEntry): void {
    // FIFO eviction: remove oldest entries when at capacity
    while (this.entries.length >= this.config.maxEntries) {
      this.entries.shift();
    }

    // Freeze the entry to enforce immutability
    Object.freeze(entry);
    this.entries.push(entry);

    this.logger.debug('Audit entry recorded', {
      sequence: entry.sequence,
      category: entry.category,
      action: entry.action,
    });
  }

  /**
   * Generate the next strictly monotonically increasing sequence number.
   * Never resets, even across FIFO evictions.
   */
  private nextSequence(): number {
    return ++this.sequenceCounter;
  }

  /**
   * Check if a severity level meets the configured minimum.
   */
  private meetsMinSeverity(severity: AuditSeverity): boolean {
    return (
      SEVERITY_PRIORITY[severity] >=
      SEVERITY_PRIORITY[this.config.minSeverity]
    );
  }

  /**
   * Determine risk event severity based on payload indicators.
   */
  private riskSeverity(
    payload: Record<string, unknown>,
  ): AuditSeverity {
    const level = payload['level'] ?? payload['severity'];
    if (level === 'critical') return 'critical';
    if (level === 'high' || level === 'error') return 'error';
    if (level === 'medium' || level === 'warning') return 'warning';
    return 'info';
  }

  /**
   * Export entries as CSV with properly escaped fields.
   */
  private exportCsv(): string {
    const lines: string[] = [CSV_HEADERS.join(',')];

    for (const entry of this.entries) {
      const row = CSV_HEADERS.map((header) => {
        const value = entry[header as keyof AuditEntry];
        if (value === undefined || value === null) {
          return '';
        }
        const str = String(value);
        // Escape CSV fields that contain commas, quotes, or newlines
        if (
          str.includes(',') ||
          str.includes('"') ||
          str.includes('\n')
        ) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }
}
