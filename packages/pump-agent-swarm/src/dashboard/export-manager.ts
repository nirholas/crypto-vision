/**
 * Export Manager — Session data export in JSON, CSV, and Markdown formats
 *
 * Aggregates data from all dashboard/coordination components and produces
 * structured exports for post-mortem analysis and record keeping.
 *
 * Supported formats:
 * - JSON: Full session data as structured object
 * - CSV: Trade, P&L, and agent metric tables
 * - Markdown: Human-readable report with formatted tables
 * - Full: Combined Markdown report with all sections
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { AgentMonitor, AgentPerformanceMetrics, AgentSummaryView } from './agent-monitor.js';
import type { EventTimeline } from './event-timeline.js';
import type { AuditLogger, AuditEntry } from '../coordination/audit-logger.js';

// ─── Interfaces ───────────────────────────────────────────────

/**
 * Minimal interface for TradeVisualizer (P63).
 * Decoupled from the concrete class so the export manager compiles
 * even before the trade-visualizer module is implemented.
 */
export interface TradeVisualizerAdapter {
  getTrades(): TradeRecord[];
}

/**
 * Minimal interface for PnLDashboard (P65).
 * Decoupled from the concrete class so the export manager compiles
 * even before the pnl-dashboard module is implemented.
 */
export interface PnLDashboardAdapter {
  getPnLSeries(): PnLSnapshot[];
  getCurrentPnL(): { realized: number; unrealized: number; total: number };
  getROI(): number;
  getMaxDrawdown(): number;
}

export interface TradeRecord {
  id: string;
  timestamp: number;
  agentId: string;
  direction: string;
  solAmount: number;
  tokenAmount: number;
  price: number;
  slippage?: number;
  signature: string;
  success: boolean;
}

export interface PnLSnapshot {
  timestamp: number;
  realized: number;
  unrealized: number;
  total: number;
  roi?: number;
}

export interface ExportContext {
  tradeVisualizer: TradeVisualizerAdapter;
  pnlDashboard: PnLDashboardAdapter;
  agentMonitor: AgentMonitor;
  eventTimeline: EventTimeline;
  auditLogger: AuditLogger;
  sessionId: string;
  startedAt: number;
}

export interface SessionExport {
  /** Export metadata */
  meta: {
    sessionId: string;
    exportedAt: number;
    startedAt: number;
    duration: number;
    version: string;
  };
  /** Summary statistics */
  summary: {
    totalTrades: number;
    successfulTrades: number;
    totalVolumeSol: number;
    finalPnl: number;
    roi: number;
    maxDrawdown: number;
    agentCount: number;
    phaseHistory: string[];
  };
  /** All trade records */
  trades: Array<{
    id: string;
    timestamp: number;
    agentId: string;
    direction: string;
    solAmount: number;
    tokenAmount: number;
    price: number;
    signature: string;
    success: boolean;
  }>;
  /** P&L time series */
  pnl: Array<{
    timestamp: number;
    realized: number;
    unrealized: number;
    total: number;
  }>;
  /** Agent performance summary */
  agents: Array<{
    id: string;
    type: string;
    tradeCount: number;
    pnl: number;
    winRate: number;
    volumeTraded: number;
  }>;
  /** Audit trail */
  audit: Array<{
    timestamp: number;
    type: string;
    agentId: string;
    action: string;
    details: Record<string, unknown>;
  }>;
  /** Key events */
  events: Array<{
    timestamp: number;
    category: string;
    severity: string;
    title: string;
    description: string;
  }>;
}

export type ExportFormat = 'json' | 'csv' | 'markdown' | 'full';

// ─── Constants ────────────────────────────────────────────────

const EXPORT_VERSION = '1.0.0';

const TRADE_CSV_HEADERS = [
  'timestamp',
  'agent_id',
  'direction',
  'sol_amount',
  'token_amount',
  'price',
  'slippage',
  'signature',
  'success',
] as const;

const PNL_CSV_HEADERS = [
  'timestamp',
  'realized',
  'unrealized',
  'total',
  'roi',
] as const;

const AGENT_CSV_HEADERS = [
  'agent_id',
  'type',
  'trade_count',
  'pnl',
  'win_rate',
  'volume_traded',
  'best_trade',
  'worst_trade',
] as const;

// ─── Helpers ──────────────────────────────────────────────────

/**
 * Escape a value for safe inclusion in a CSV field.
 * Wraps in double-quotes if the value contains commas, quotes, or newlines,
 * and doubles any internal quotes per RFC 4180.
 */
function escapeCsvField(value: unknown): string {
  if (value === undefined || value === null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Format milliseconds into a human-readable duration string. */
function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1_000) % 60;
  const minutes = Math.floor(ms / 60_000) % 60;
  const hours = Math.floor(ms / 3_600_000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/** Format a UNIX millisecond timestamp into an ISO string. */
function formatTimestamp(ms: number): string {
  return new Date(ms).toISOString();
}

/** Format a number to a fixed number of decimal places. */
function fmt(value: number, decimals = 6): string {
  return value.toFixed(decimals);
}

// ─── ExportManager ────────────────────────────────────────────

export class ExportManager {
  private readonly ctx: ExportContext;

  constructor(context: ExportContext) {
    this.ctx = context;
  }

  // ── Structured Export ───────────────────────────────────────

  /**
   * Build a full structured session export containing all session data.
   */
  exportSession(): SessionExport {
    const now = Date.now();
    const trades = this.ctx.tradeVisualizer.getTrades();
    const pnlSeries = this.ctx.pnlDashboard.getPnLSeries();
    const agents = this.ctx.agentMonitor.getAllAgents();
    const auditEntries = this.ctx.auditLogger.getAuditTrail();
    const events = this.ctx.eventTimeline.getEvents();
    const currentPnl = this.ctx.pnlDashboard.getCurrentPnL();
    const roi = this.ctx.pnlDashboard.getROI();
    const maxDrawdown = this.ctx.pnlDashboard.getMaxDrawdown();

    // Extract phase history from audit trail
    const phaseHistory = this.extractPhaseHistory(auditEntries);

    const successfulTrades = trades.filter((t) => t.success).length;
    const totalVolumeSol = trades.reduce((sum, t) => sum + t.solAmount, 0);

    return {
      meta: {
        sessionId: this.ctx.sessionId,
        exportedAt: now,
        startedAt: this.ctx.startedAt,
        duration: now - this.ctx.startedAt,
        version: EXPORT_VERSION,
      },
      summary: {
        totalTrades: trades.length,
        successfulTrades,
        totalVolumeSol,
        finalPnl: currentPnl.total,
        roi,
        maxDrawdown,
        agentCount: agents.length,
        phaseHistory,
      },
      trades: trades.map((t) => ({
        id: t.id,
        timestamp: t.timestamp,
        agentId: t.agentId,
        direction: t.direction,
        solAmount: t.solAmount,
        tokenAmount: t.tokenAmount,
        price: t.price,
        signature: t.signature,
        success: t.success,
      })),
      pnl: pnlSeries.map((p) => ({
        timestamp: p.timestamp,
        realized: p.realized,
        unrealized: p.unrealized,
        total: p.total,
      })),
      agents: this.buildAgentExport(agents),
      audit: auditEntries.map((a) => ({
        timestamp: a.timestamp,
        type: a.category,
        agentId: a.agentId,
        action: a.action,
        details: a.metadata,
      })),
      events: events.map((e) => ({
        timestamp: e.timestamp,
        category: e.category,
        severity: e.severity,
        title: e.title,
        description: e.description,
      })),
    };
  }

  // ── CSV Exports ─────────────────────────────────────────────

  /**
   * Export all trades as a CSV string.
   */
  exportTrades(): string {
    const trades = this.ctx.tradeVisualizer.getTrades();
    const lines: string[] = [TRADE_CSV_HEADERS.join(',')];

    for (const t of trades) {
      const row = [
        escapeCsvField(t.timestamp),
        escapeCsvField(t.agentId),
        escapeCsvField(t.direction),
        escapeCsvField(fmt(t.solAmount)),
        escapeCsvField(fmt(t.tokenAmount, 2)),
        escapeCsvField(fmt(t.price, 10)),
        escapeCsvField(t.slippage !== undefined ? fmt(t.slippage, 4) : ''),
        escapeCsvField(t.signature),
        escapeCsvField(t.success),
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Export audit trail as a JSON string.
   */
  exportAudit(): string {
    const entries = this.ctx.auditLogger.getAuditTrail();
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Export P&L time series as a CSV string.
   */
  exportPnL(): string {
    const series = this.ctx.pnlDashboard.getPnLSeries();
    const roi = this.ctx.pnlDashboard.getROI();
    const lines: string[] = [PNL_CSV_HEADERS.join(',')];

    for (let i = 0; i < series.length; i++) {
      const s = series[i]!;
      // Compute point-in-time ROI if the adapter provides it, else use the final ROI for last entry
      const pointRoi = s.roi !== undefined ? s.roi : (i === series.length - 1 ? roi : 0);
      const row = [
        escapeCsvField(s.timestamp),
        escapeCsvField(fmt(s.realized)),
        escapeCsvField(fmt(s.unrealized)),
        escapeCsvField(fmt(s.total)),
        escapeCsvField(fmt(pointRoi, 4)),
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Export per-agent performance metrics as a CSV string.
   */
  exportAgentMetrics(): string {
    const agents = this.ctx.agentMonitor.getAllAgents();
    const lines: string[] = [AGENT_CSV_HEADERS.join(',')];

    for (const agent of agents) {
      const perf = this.ctx.agentMonitor.getAgentPerformance(agent.id);
      const row = [
        escapeCsvField(agent.id),
        escapeCsvField(agent.type),
        escapeCsvField(agent.tradeCount),
        escapeCsvField(fmt(agent.totalPnl)),
        escapeCsvField(fmt(perf.winRate, 4)),
        escapeCsvField(fmt(perf.averageTradeSize)),
        escapeCsvField(fmt(perf.bestTrade)),
        escapeCsvField(fmt(perf.worstTrade)),
      ];
      lines.push(row.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Export event timeline as a JSON string.
   */
  exportEvents(): string {
    const events = this.ctx.eventTimeline.getEvents();
    return JSON.stringify(events, null, 2);
  }

  // ── Markdown Report ─────────────────────────────────────────

  /**
   * Generate a comprehensive Markdown session report.
   */
  exportFullReport(): string {
    const session = this.exportSession();
    const agents = this.ctx.agentMonitor.getAllAgents();
    const perfMap = new Map<string, AgentPerformanceMetrics>();
    for (const agent of agents) {
      perfMap.set(agent.id, this.ctx.agentMonitor.getAgentPerformance(agent.id));
    }

    const lines: string[] = [];

    // ── Header ──────────────────────────────────────────────
    lines.push('# Swarm Session Report');
    lines.push('');

    // ── Session Info ────────────────────────────────────────
    lines.push('## Session Info');
    lines.push('');
    lines.push(`- **Session ID**: ${session.meta.sessionId}`);
    lines.push(`- **Duration**: ${formatDuration(session.meta.duration)}`);
    lines.push(`- **Started**: ${formatTimestamp(session.meta.startedAt)}`);
    lines.push(`- **Exported**: ${formatTimestamp(session.meta.exportedAt)}`);
    lines.push(`- **Export Version**: ${session.meta.version}`);
    lines.push('');

    // ── Summary ─────────────────────────────────────────────
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Value |');
    lines.push('|--------|-------|');
    lines.push(`| Total Trades | ${session.summary.totalTrades} |`);
    lines.push(`| Successful Trades | ${session.summary.successfulTrades} |`);
    lines.push(`| Volume | ${fmt(session.summary.totalVolumeSol, 4)} SOL |`);
    lines.push(`| P&L | ${fmt(session.summary.finalPnl, 4)} SOL |`);
    lines.push(`| ROI | ${fmt(session.summary.roi * 100, 2)}% |`);
    lines.push(`| Max Drawdown | ${fmt(session.summary.maxDrawdown * 100, 2)}% |`);
    lines.push(`| Agents | ${session.summary.agentCount} |`);
    lines.push('');

    // ── Phase History ───────────────────────────────────────
    if (session.summary.phaseHistory.length > 0) {
      lines.push('## Phase History');
      lines.push('');
      lines.push(session.summary.phaseHistory.map((p) => `\`${p}\``).join(' → '));
      lines.push('');
    }

    // ── Agent Performance ───────────────────────────────────
    lines.push('## Agent Performance');
    lines.push('');
    lines.push('| Agent | Type | Trades | P&L (SOL) | Win Rate | Volume (SOL) | Best Trade | Worst Trade |');
    lines.push('|-------|------|--------|-----------|----------|--------------|------------|-------------|');
    for (const agent of session.agents) {
      const perf = perfMap.get(agent.id);
      lines.push(
        `| ${agent.id} | ${agent.type} | ${agent.tradeCount} | ${fmt(agent.pnl, 4)} | ${fmt(agent.winRate * 100, 1)}% | ${fmt(agent.volumeTraded, 4)} | ${fmt(perf?.bestTrade ?? 0, 4)} | ${fmt(perf?.worstTrade ?? 0, 4)} |`,
      );
    }
    lines.push('');

    // ── Key Events ──────────────────────────────────────────
    const keyEvents = session.events.filter(
      (e) => e.severity === 'warning' || e.severity === 'error' || e.severity === 'critical',
    );
    if (keyEvents.length > 0) {
      lines.push('## Key Events');
      lines.push('');
      for (const event of keyEvents) {
        const ts = formatTimestamp(event.timestamp);
        const sevBadge = event.severity === 'critical'
          ? '🔴'
          : event.severity === 'error'
            ? '🟠'
            : '🟡';
        lines.push(`- ${sevBadge} **${ts}**: ${event.title}`);
        if (event.description) {
          lines.push(`  - ${event.description}`);
        }
      }
      lines.push('');
    }

    // ── Trade Log ───────────────────────────────────────────
    lines.push('## Trade Log');
    lines.push('');
    if (session.trades.length === 0) {
      lines.push('*No trades recorded.*');
    } else {
      lines.push('| Time | Agent | Direction | SOL | Tokens | Price | Success |');
      lines.push('|------|-------|-----------|-----|--------|-------|---------|');
      for (const t of session.trades) {
        const ts = formatTimestamp(t.timestamp);
        const successIcon = t.success ? '✅' : '❌';
        lines.push(
          `| ${ts} | ${t.agentId} | ${t.direction} | ${fmt(t.solAmount, 4)} | ${fmt(t.tokenAmount, 2)} | ${fmt(t.price, 10)} | ${successIcon} |`,
        );
      }
    }
    lines.push('');

    // ── P&L Time Series (last 20 entries for readability) ──
    if (session.pnl.length > 0) {
      lines.push('## P&L Time Series');
      lines.push('');
      lines.push('| Time | Realized | Unrealized | Total |');
      lines.push('|------|----------|------------|-------|');
      const displayPnl = session.pnl.length > 20
        ? session.pnl.slice(session.pnl.length - 20)
        : session.pnl;
      if (session.pnl.length > 20) {
        lines.push(`| ... | *(${session.pnl.length - 20} earlier entries omitted)* | | |`);
      }
      for (const p of displayPnl) {
        lines.push(
          `| ${formatTimestamp(p.timestamp)} | ${fmt(p.realized, 4)} | ${fmt(p.unrealized, 4)} | ${fmt(p.total, 4)} |`,
        );
      }
      lines.push('');
    }

    // ── Footer ──────────────────────────────────────────────
    lines.push('---');
    lines.push(`*Report generated at ${formatTimestamp(Date.now())} by pump-agent-swarm export-manager v${EXPORT_VERSION}*`);
    lines.push('');

    return lines.join('\n');
  }

  // ── File Export ─────────────────────────────────────────────

  /**
   * Write session data to disk in the specified format.
   * Creates parent directories if they don't exist.
   */
  async exportToFile(format: ExportFormat, outputPath: string): Promise<void> {
    const dir = dirname(outputPath);
    await mkdir(dir, { recursive: true });

    let content: string;

    switch (format) {
      case 'json': {
        const session = this.exportSession();
        content = JSON.stringify(session, null, 2);
        break;
      }
      case 'csv': {
        // Combined CSV: trades, then P&L, then agents — separated by blank lines
        const tradeCsv = this.exportTrades();
        const pnlCsv = this.exportPnL();
        const agentCsv = this.exportAgentMetrics();
        content = [
          '# Trades',
          tradeCsv,
          '',
          '# P&L Time Series',
          pnlCsv,
          '',
          '# Agent Metrics',
          agentCsv,
        ].join('\n');
        break;
      }
      case 'markdown':
      case 'full': {
        content = this.exportFullReport();
        break;
      }
      default: {
        const _exhaustive: never = format;
        throw new Error(`Unknown export format: ${String(_exhaustive)}`);
      }
    }

    await writeFile(outputPath, content, 'utf-8');
  }

  // ── Private Helpers ─────────────────────────────────────────

  /**
   * Build the agents section of the session export, enriched with performance metrics.
   */
  private buildAgentExport(agents: AgentSummaryView[]): SessionExport['agents'] {
    return agents.map((agent) => {
      const perf = this.ctx.agentMonitor.getAgentPerformance(agent.id);
      return {
        id: agent.id,
        type: agent.type,
        tradeCount: agent.tradeCount,
        pnl: agent.totalPnl,
        winRate: perf.winRate,
        volumeTraded: perf.averageTradeSize * agent.tradeCount,
      };
    });
  }

  /**
   * Extract an ordered list of phase names from the audit trail.
   * Reads phase:transition entries to reconstruct the phase lifecycle.
   */
  private extractPhaseHistory(entries: AuditEntry[]): string[] {
    const phases: string[] = [];

    for (const entry of entries) {
      if (entry.category === 'phase' && entry.action === 'phase:transition') {
        const from = entry.metadata['from'];
        const to = entry.metadata['to'];

        // Add the origin phase on first encounter
        if (phases.length === 0 && typeof from === 'string') {
          phases.push(from);
        }
        if (typeof to === 'string') {
          phases.push(to);
        }
      }
    }

    return phases;
  }
}
