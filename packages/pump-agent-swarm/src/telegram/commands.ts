/**
 * Telegram Command Handlers — Processes incoming bot commands
 *
 * Maps slash commands (/status, /pnl, /wallets, /pause, /resume, /emergency)
 * to swarm queries and replies. Each handler receives a CommandContext and
 * returns a reply string.
 *
 * Features:
 * - /status  — Current swarm phase, uptime, agent count, trade stats
 * - /pnl     — Per-wallet and aggregate PnL breakdown
 * - /wallets — SOL balances across all trader wallets
 * - /pause   — Pause the trading loop
 * - /resume  — Resume the trading loop
 * - /emergency — Trigger emergency exit
 * - /help    — List available commands
 */

import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import { formatter } from './formatter.js';
import type { CommandContext, SwarmStatusSnapshot } from './types.js';

// ─── Types ────────────────────────────────────────────────────

/**
 * Swarm accessor — thin abstraction so command handlers
 * do not import the full SwarmCoordinator (avoids circular deps).
 */
export interface SwarmAccessor {
    getStatus(): SwarmStatusSnapshot;
    getWalletBalances(): Array<{ address: string; balanceLamports: number }>;
    getPnlSummary(): {
        totalPnlSol: number;
        wallets: Array<{ address: string; pnlSol: number }>;
    };
    getRecentTrades(limit?: number): Array<{
        timestamp: number;
        agentId: string;
        direction: 'buy' | 'sell';
        amountSol: number;
        tokenAmount: number;
        success: boolean;
        signature: string;
    }>;
    getAgentDetails(): Array<{
        id: string;
        role: string;
        status: string;
        trades: number;
        pnlSol: number;
    }>;
    getActiveAlerts(): Array<{
        id: string;
        severity: string;
        message: string;
        createdAt: number;
    }>;
    pause(): void;
    resume(): void;
    stop(): Promise<void>;
    emergencyExit(): Promise<void>;
}

export type CommandHandler = (
    ctx: CommandContext,
    swarm: SwarmAccessor,
) => Promise<string>;

// ─── Handlers ─────────────────────────────────────────────────

const handleStatus: CommandHandler = async (_ctx, swarm) => {
    const snap = swarm.getStatus();
    return formatter.formatStatus(snap);
};

const handlePnl: CommandHandler = async (_ctx, swarm) => {
    const { totalPnlSol, wallets } = swarm.getPnlSummary();
    const lines = [
        `*💰 PnL Summary*`,
        ``,
        `*Total:* ${totalPnlSol.toFixed(4)} SOL`,
        ``,
        ...wallets.slice(0, 10).map(
            (w, i) =>
                `${i + 1}\\. \`${w.address.slice(0, 8)}\` → ${w.pnlSol >= 0 ? '+' : ''}${w.pnlSol.toFixed(4)} SOL`,
        ),
    ];

    if (wallets.length > 10) {
        lines.push(``, `_\\.\\.\\. and ${wallets.length - 10} more wallets_`);
    }

    return lines.join('\n');
};

const handleWallets: CommandHandler = async (_ctx, swarm) => {
    const balances = swarm.getWalletBalances();
    const totalSol = balances.reduce((s, b) => s + b.balanceLamports, 0) / LAMPORTS_PER_SOL;

    const lines = [
        `*👛 Wallet Balances*`,
        ``,
        `*Total:* ${totalSol.toFixed(4)} SOL across ${balances.length} wallets`,
        ``,
        ...balances.slice(0, 15).map(
            (w) =>
                `\`${w.address.slice(0, 8)}\` — ${(w.balanceLamports / LAMPORTS_PER_SOL).toFixed(4)} SOL`,
        ),
    ];

    if (balances.length > 15) {
        lines.push(``, `_\\.\\.\\. and ${balances.length - 15} more_`);
    }

    return lines.join('\n');
};

const handlePause: CommandHandler = async (_ctx, swarm) => {
    swarm.pause();
    return `⏸ *Trading paused*\nUse /resume to continue\\.`;
};

const handleResume: CommandHandler = async (_ctx, swarm) => {
    swarm.resume();
    return `▶️ *Trading resumed*`;
};

const handleEmergency: CommandHandler = async (_ctx, swarm) => {
    await swarm.emergencyExit();
    return `🚨 *Emergency exit triggered*\nAll positions are being unwound\\.`;
};

const handleHelp: CommandHandler = async () => {
    return formatter.formatHelp();
};

const handleTrades: CommandHandler = async (_ctx, swarm) => {
    const trades = swarm.getRecentTrades(10);

    if (trades.length === 0) {
        return `*📈 Recent Trades*\n\nNo trades executed yet\\.`;
    }

    const lines = [
        `*📈 Recent Trades* \\(last ${trades.length}\\)`,
        ``,
    ];

    for (const trade of trades) {
        const emoji = trade.direction === 'buy' ? '🟢' : '🔴';
        const status = trade.success ? '✅' : '❌';
        const time = new Date(trade.timestamp).toLocaleTimeString('en-US', { hour12: false });
        const agentShort = trade.agentId.slice(0, 8);
        lines.push(
            `${emoji} \`${agentShort}\` ${trade.direction.toUpperCase()} ${trade.amountSol.toFixed(4)} SOL ${status}`,
        );
    }

    const totalVol = trades.reduce((sum, t) => sum + t.amountSol, 0);
    lines.push(``, `*Volume:* ${totalVol.toFixed(4)} SOL`);

    return lines.join('\n');
};

const handleAgents: CommandHandler = async (_ctx, swarm) => {
    const agents = swarm.getAgentDetails();

    if (agents.length === 0) {
        return `*🤖 Agents*\n\nNo agents active\\.`;
    }

    const lines = [
        `*🤖 Agent Overview* \\(${agents.length} agents\\)`,
        ``,
    ];

    for (const agent of agents) {
        const statusEmoji = agent.status === 'active' ? '🟢' : agent.status === 'paused' ? '🟡' : '🔴';
        const pnlStr = agent.pnlSol >= 0 ? `\\+${agent.pnlSol.toFixed(4)}` : agent.pnlSol.toFixed(4);
        lines.push(
            `${statusEmoji} *${agent.role}* \`${agent.id.slice(0, 8)}\``,
            `   Trades: ${agent.trades} \\| PnL: ${pnlStr} SOL`,
        );
    }

    return lines.join('\n');
};

const handleAlerts: CommandHandler = async (_ctx, swarm) => {
    const alerts = swarm.getActiveAlerts();

    if (alerts.length === 0) {
        return `*🔔 Alerts*\n\n✅ No active alerts`;
    }

    const severityEmoji: Record<string, string> = {
        critical: '🚨',
        warning: '⚠️',
        info: 'ℹ️',
    };

    const lines = [
        `*🔔 Active Alerts* \\(${alerts.length}\\)`,
        ``,
    ];

    for (const alert of alerts.slice(0, 10)) {
        const emoji = severityEmoji[alert.severity] ?? '📋';
        const age = Math.floor((Date.now() - alert.createdAt) / 60_000);
        const ageStr = age < 1 ? '<1m ago' : `${age}m ago`;
        lines.push(
            `${emoji} *${alert.severity.toUpperCase()}* — ${age > 0 ? ageStr : 'just now'}`,
            `   ${alert.message.slice(0, 100)}`,
        );
    }

    if (alerts.length > 10) {
        lines.push(``, `_\\.\\.\\. and ${alerts.length - 10} more alerts_`);
    }

    return lines.join('\n');
};

const handleExit: CommandHandler = async (_ctx, swarm) => {
    await swarm.stop();
    return `🛑 *Graceful shutdown initiated*\nThe swarm is winding down\\.`;
};

const handleStop: CommandHandler = async (_ctx, swarm) => {
    swarm.pause();
    return `⏸ *Trading stopped*\nUse /resume to restart trading\\.`;
};

// ─── Command Registry ────────────────────────────────────────

export const COMMAND_HANDLERS: Record<string, CommandHandler> = {
    status: handleStatus,
    pnl: handlePnl,
    wallets: handleWallets,
    trades: handleTrades,
    agents: handleAgents,
    alerts: handleAlerts,
    pause: handlePause,
    resume: handleResume,
    stop: handleStop,
    exit: handleExit,
    emergency: handleEmergency,
    help: handleHelp,
    start: handleHelp, // /start is the default Telegram entry point
};

/**
 * Route a command context to the appropriate handler.
 * Returns the reply string or a default "unknown command" message.
 */
export async function routeCommand(
    ctx: CommandContext,
    swarm: SwarmAccessor,
): Promise<string> {
    const handler = COMMAND_HANDLERS[ctx.command];
    if (!handler) {
        return `Unknown command: /${ctx.command}\nType /help for available commands\\.`;
    }
    return handler(ctx, swarm);
}
