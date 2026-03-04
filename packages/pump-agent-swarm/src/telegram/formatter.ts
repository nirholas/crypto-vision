/**
 * Telegram Message Formatter — Converts swarm data into Markdown messages
 *
 * Stateless utility that formats status snapshots, trade events, phase
 * changes, and errors into Telegram-compatible MarkdownV2 messages.
 */

import type {
    MessageFormatter,
    SwarmStatusSnapshot,
    TradeNotification,
} from './types.js';

// ─── Helpers ──────────────────────────────────────────────────

/** Escape characters that MarkdownV2 requires to be escaped */
function esc(text: string): string {
    return text.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g, '\\$1');
}

function solStr(lamports: number, decimals = 4): string {
    return lamports.toFixed(decimals);
}

function durationStr(ms: number): string {
    const s = Math.floor(ms / 1_000) % 60;
    const m = Math.floor(ms / 60_000) % 60;
    const h = Math.floor(ms / 3_600_000);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
}

// ─── Formatter ────────────────────────────────────────────────

export const formatter: MessageFormatter = {
    formatStatus(snap: SwarmStatusSnapshot): string {
        const lines = [
            `*🤖 Swarm Status*`,
            ``,
            `*Phase:* ${esc(snap.phase)}`,
            `*Uptime:* ${esc(durationStr(snap.uptimeMs))}`,
            `*Active Agents:* ${snap.activeAgents}`,
            `*Wallets:* ${snap.walletsActive}`,
            ``,
            `*📊 Trading*`,
            `  Total Trades: ${snap.totalTrades}`,
            `  Volume: ${esc(solStr(snap.totalVolumeSol))} SOL`,
            `  Net PnL: ${esc(solStr(snap.netPnlSol))} SOL`,
            ``,
            `*Errors:* ${snap.errorCount}`,
        ];
        return lines.join('\n');
    },

    formatTrade(trade: TradeNotification): string {
        const emoji = trade.direction === 'buy' ? '🟢' : '🔴';
        const status = trade.success ? '✅' : '❌';
        const lines = [
            `${emoji} *Trade ${esc(trade.direction.toUpperCase())}* ${status}`,
            ``,
            `*Token:* ${esc(trade.tokenSymbol)}`,
            `*Agent:* \`${esc(trade.agentId.slice(0, 8))}\``,
            `*Amount:* ${esc(solStr(trade.amountSol))} SOL`,
            `*Price:* ${esc(trade.price.toFixed(8))}`,
            `*Sig:* \`${esc(trade.signature.slice(0, 16))}\\.\\.\\.\``,
        ];
        return lines.join('\n');
    },

    formatPhaseChange(from: string, to: string): string {
        return [
            `*🔄 Phase Transition*`,
            ``,
            `${esc(from)} → *${esc(to)}*`,
        ].join('\n');
    },

    formatError(error: string, severity: string): string {
        const emoji = severity === 'critical' ? '🚨' : '⚠️';
        return [
            `${emoji} *${esc(severity.toUpperCase())}*`,
            ``,
            `\`\`\``,
            esc(error.slice(0, 500)),
            `\`\`\``,
        ].join('\n');
    },

    formatHelp(): string {
        return [
            `*📖 Swarm Bot Commands*`,
            ``,
            `/status — Current swarm status`,
            `/pnl — PnL summary`,
            `/wallets — Wallet balances`,
            `/pause — Pause trading`,
            `/resume — Resume trading`,
            `/emergency — Emergency exit`,
            `/help — Show this message`,
        ].join('\n');
    },
};
