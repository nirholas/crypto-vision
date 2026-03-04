/**
 * Telegram Notification Service — Pushes swarm events to Telegram chats
 *
 * Subscribes to SwarmEventBus events (trades, phase changes, errors) and
 * automatically forwards formatted messages to configured Telegram chats.
 * Includes rate limiting and message queue to avoid Telegram API throttling.
 *
 * Features:
 * - Auto-subscribe to trade, phase, and error events
 * - Configurable min trade size filter
 * - Message queue with rate limiting (max 20 msgs/min per chat)
 * - Batch critical notifications
 * - Manual notification API
 */

import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';
import type { SwarmEvent, SwarmEventCategory } from '../types.js';

import { formatter } from './formatter.js';
import type {
    NotificationLevel,
    TelegramBotConfig,
    TelegramNotification,
    TradeNotification,
} from './types.js';

// ─── Constants ────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_MESSAGES_PER_WINDOW = 20;

// ─── Notification Service ─────────────────────────────────────

export class TelegramNotificationService {
    private readonly config: TelegramBotConfig;
    private readonly eventBus: SwarmEventBus;
    private readonly logger: SwarmLogger;

    /** Per-chat message timestamps for rate limiting */
    private rateLimitMap: Map<number, number[]> = new Map();
    /** Queue of pending notifications when rate-limited */
    private queue: TelegramNotification[] = [];
    /** Drain interval handle */
    private drainInterval: ReturnType<typeof setInterval> | null = null;

    constructor(
        config: TelegramBotConfig,
        eventBus: SwarmEventBus,
        logger: SwarmLogger,
    ) {
        this.config = config;
        this.eventBus = eventBus;
        this.logger = logger;
    }

    // ─── Lifecycle ────────────────────────────────────────────

    /**
     * Start listening to event bus and draining the queue.
     */
    start(): void {
        this.subscribeToEvents();
        this.drainInterval = setInterval(() => this.drainQueue(), 3_000);
        this.logger.info('[TelegramNotify] Notification service started');
    }

    /**
     * Stop the drain loop and unsubscribe.
     */
    stop(): void {
        if (this.drainInterval) {
            clearInterval(this.drainInterval);
            this.drainInterval = null;
        }
        this.logger.info('[TelegramNotify] Notification service stopped');
    }

    // ─── Public API ───────────────────────────────────────────

    /**
     * Send a notification to all allowed chats.
     */
    async broadcast(
        level: NotificationLevel,
        title: string,
        body: string,
    ): Promise<void> {
        for (const chatId of this.config.allowedChatIds) {
            await this.enqueue({ chatId, level, title, body, timestamp: Date.now() });
        }
    }

    /**
     * Send a notification to a specific chat.
     */
    async notify(notification: TelegramNotification): Promise<void> {
        await this.enqueue(notification);
    }

    /**
     * Get current queue size.
     */
    getQueueSize(): number {
        return this.queue.length;
    }

    // ─── Event Subscriptions ──────────────────────────────────

    private subscribeToEvents(): void {
        // Trade events
        if (this.config.autoNotifyTrades) {
            this.eventBus.subscribe(
                { category: 'trade' as SwarmEventCategory },
                (event: SwarmEvent) => {
                    this.handleTradeEvent(event);
                },
            );
        }

        // Phase changes
        if (this.config.autoNotifyPhases) {
            this.eventBus.subscribe(
                { category: 'phase' as SwarmEventCategory },
                (event: SwarmEvent) => {
                    this.handlePhaseEvent(event);
                },
            );
        }

        // Errors (always)
        this.eventBus.subscribe(
            { category: 'error' as SwarmEventCategory },
            (event: SwarmEvent) => {
                this.handleErrorEvent(event);
            },
        );
    }

    private handleTradeEvent(event: SwarmEvent): void {
        const meta = event.metadata as Record<string, unknown>;
        const amountSol = (meta['amountSol'] as number) ?? 0;

        // Filter by minimum size
        if (amountSol < this.config.minTradeNotifySol) return;

        const trade: TradeNotification = {
            direction: (meta['direction'] as 'buy' | 'sell') ?? 'buy',
            agentId: event.agentId,
            tokenSymbol: (meta['tokenSymbol'] as string) ?? 'UNKNOWN',
            amountSol,
            price: (meta['price'] as number) ?? 0,
            signature: (meta['signature'] as string) ?? '',
            success: event.success,
        };

        const body = formatter.formatTrade(trade);
        void this.broadcast('info', 'Trade', body);
    }

    private handlePhaseEvent(event: SwarmEvent): void {
        const meta = event.metadata as Record<string, unknown>;
        const from = (meta['from'] as string) ?? 'unknown';
        const to = (meta['to'] as string) ?? 'unknown';
        const body = formatter.formatPhaseChange(from, to);
        void this.broadcast('info', 'Phase Change', body);
    }

    private handleErrorEvent(event: SwarmEvent): void {
        const level: NotificationLevel =
            event.action.includes('critical') ? 'critical' : 'warning';
        const body = formatter.formatError(event.details, level);
        void this.broadcast(level, 'Error', body);
    }

    // ─── Queue & Rate Limiting ────────────────────────────────

    private async enqueue(notification: TelegramNotification): Promise<void> {
        if (this.isRateLimited(notification.chatId)) {
            this.queue.push(notification);
            return;
        }
        await this.sendMessage(notification);
    }

    private async drainQueue(): Promise<void> {
        const pending = [...this.queue];
        this.queue = [];

        for (const notification of pending) {
            if (this.isRateLimited(notification.chatId)) {
                this.queue.push(notification);
                continue;
            }
            await this.sendMessage(notification);
        }
    }

    private isRateLimited(chatId: number): boolean {
        const now = Date.now();
        const timestamps = this.rateLimitMap.get(chatId) ?? [];

        // Prune old entries
        const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
        this.rateLimitMap.set(chatId, recent);

        return recent.length >= MAX_MESSAGES_PER_WINDOW;
    }

    private recordSend(chatId: number): void {
        const timestamps = this.rateLimitMap.get(chatId) ?? [];
        timestamps.push(Date.now());
        this.rateLimitMap.set(chatId, timestamps);
    }

    // ─── Telegram HTTP API ────────────────────────────────────

    private async sendMessage(notification: TelegramNotification): Promise<void> {
        const url = `https://api.telegram.org/bot${this.config.token}/sendMessage`;

        const text =
            notification.body.length > this.config.maxMessageLength
                ? notification.body.slice(0, this.config.maxMessageLength) + '…'
                : notification.body;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: notification.chatId,
                    text,
                    parse_mode: 'MarkdownV2',
                    disable_web_page_preview: true,
                }),
            });

            if (!response.ok) {
                const body = await response.text();
                this.logger.warn(
                    `[TelegramNotify] Failed to send message to ${notification.chatId}: ${response.status} ${body}`,
                );
            }

            this.recordSend(notification.chatId);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`[TelegramNotify] sendMessage error: ${msg}`);
        }
    }
}
