/**
 * Telegram Bot Types — Shared interfaces for the Telegram integration layer
 */

// ─── Bot Configuration ────────────────────────────────────────

export interface TelegramBotConfig {
    /** Telegram Bot API token from @BotFather */
    token: string;
    /** Chat IDs allowed to interact with the bot (empty = allow all) */
    allowedChatIds: number[];
    /** Whether to send trade notifications automatically */
    autoNotifyTrades: boolean;
    /** Whether to send phase-change notifications */
    autoNotifyPhases: boolean;
    /** Minimum trade size (SOL) to trigger a notification */
    minTradeNotifySol: number;
    /** Polling interval for Telegram updates (ms) */
    pollingIntervalMs: number;
    /** Maximum message length before truncation */
    maxMessageLength: number;
}

// ─── Notification Types ───────────────────────────────────────

export type NotificationLevel = 'info' | 'warning' | 'critical';

export interface TelegramNotification {
    /** Target chat ID */
    chatId: number;
    /** Notification level */
    level: NotificationLevel;
    /** Message title (bold) */
    title: string;
    /** Message body (Markdown) */
    body: string;
    /** Timestamp */
    timestamp: number;
}

// ─── Command Context ──────────────────────────────────────────

export interface CommandContext {
    chatId: number;
    messageId: number;
    userId: number;
    username: string | undefined;
    text: string;
    command: string;
    args: string[];
}

// ─── Status Snapshot ──────────────────────────────────────────

export interface SwarmStatusSnapshot {
    phase: string;
    uptimeMs: number;
    activeAgents: number;
    totalTrades: number;
    totalVolumeSol: number;
    netPnlSol: number;
    walletsActive: number;
    errorCount: number;
}

// ─── Formatters ───────────────────────────────────────────────

export interface MessageFormatter {
    formatStatus(snapshot: SwarmStatusSnapshot): string;
    formatTrade(trade: TradeNotification): string;
    formatPhaseChange(from: string, to: string): string;
    formatError(error: string, severity: string): string;
    formatHelp(): string;
}

export interface TradeNotification {
    direction: 'buy' | 'sell';
    agentId: string;
    tokenSymbol: string;
    amountSol: number;
    price: number;
    signature: string;
    success: boolean;
}
