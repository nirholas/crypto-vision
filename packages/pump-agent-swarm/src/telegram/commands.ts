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
    pause(): void;
    resume(): void;
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

const handleEmergency: CommandHandler = async (ctx, swarm) => {
    await swarm.emergencyExit();
    return `🚨 *Emergency exit triggered*\nAll positions are being unwound\\.`;
};

const handleHelp: CommandHandler = async () => {
    return formatter.formatHelp();
};

// ─── Command Registry ────────────────────────────────────────

export const COMMAND_HANDLERS: Record<string, CommandHandler> = {
    status: handleStatus,
    pnl: handlePnl,
    wallets: handleWallets,
    pause: handlePause,
    resume: handleResume,
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
