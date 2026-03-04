/**
 * Telegram Bot — Long-polling bot that bridges Telegram ↔ Swarm
 *
 * Connects to the Telegram Bot API via long-polling (no webhook server
 * required), routes incoming commands to handlers, and pushes swarm
 * notifications back to authorised chats.
 *
 * Features:
 * - Long-polling with configurable interval
 * - Chat-ID allow-list for security
 * - Automatic command parsing and routing
 * - Integrated notification service for push alerts
 * - Graceful start/stop lifecycle
 *
 * @example
 * ```typescript
 * import { SwarmEventBus } from '../infra/event-bus.js';
 * import { SwarmLogger } from '../infra/logger.js';
 * import { TelegramBot } from './bot.js';
 *
 * const bot = new TelegramBot(
 *   {
 *     token: process.env.TELEGRAM_BOT_TOKEN!,
 *     allowedChatIds: [123456789],
 *     autoNotifyTrades: true,
 *     autoNotifyPhases: true,
 *     minTradeNotifySol: 0.1,
 *     pollingIntervalMs: 1000,
 *     maxMessageLength: 4000,
 *   },
 *   swarmAccessor,
 *   SwarmEventBus.getInstance(),
 *   new SwarmLogger(),
 * );
 *
 * await bot.start();
 * ```
 */

import { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';

import { type SwarmAccessor, routeCommand } from './commands.js';
import { TelegramNotificationService } from './notifications.js';
import type { CommandContext, TelegramBotConfig } from './types.js';

// ─── Telegram Update Types (subset we care about) ─────────

interface TelegramUser {
    id: number;
    username?: string;
}

interface TelegramMessage {
    message_id: number;
    chat: { id: number };
    from?: TelegramUser;
    text?: string;
    entities?: Array<{ type: string; offset: number; length: number }>;
}

interface TelegramUpdate {
    update_id: number;
    message?: TelegramMessage;
}

// ─── TelegramBot ──────────────────────────────────────────────

export class TelegramBot {
    private readonly config: TelegramBotConfig;
    private readonly swarm: SwarmAccessor;
    private readonly logger: SwarmLogger;
    private readonly notifications: TelegramNotificationService;

    private offset = 0;
    private running = false;
    private pollTimeout: ReturnType<typeof setTimeout> | null = null;

    constructor(
        config: TelegramBotConfig,
        swarm: SwarmAccessor,
        eventBus: SwarmEventBus,
        logger: SwarmLogger,
    ) {
        this.config = config;
        this.swarm = swarm;
        this.logger = logger;
        this.notifications = new TelegramNotificationService(config, eventBus, logger);
    }

    // ─── Lifecycle ────────────────────────────────────────────

    async start(): Promise<void> {
        if (this.running) return;
        this.running = true;

        // Validate token
        const me = await this.apiCall<{ ok: boolean; result: { username: string } }>('getMe');
        if (!me?.ok) {
            throw new Error('TelegramBot: Invalid bot token — getMe failed');
        }
        this.logger.info(`[TelegramBot] Started as @${me.result.username}`);

        // Start notification service
        this.notifications.start();

        // Begin polling
        this.poll();
    }

    stop(): void {
        this.running = false;
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = null;
        }
        this.notifications.stop();
        this.logger.info('[TelegramBot] Stopped');
    }

    /**
     * Whether the bot is currently running.
     */
    isRunning(): boolean {
        return this.running;
    }

    /**
     * Access the notification service for manual notifications.
     */
    getNotificationService(): TelegramNotificationService {
        return this.notifications;
    }

    // ─── Polling Loop ─────────────────────────────────────────

    private poll(): void {
        if (!this.running) return;

        void this.fetchUpdates().then(() => {
            if (this.running) {
                this.pollTimeout = setTimeout(
                    () => this.poll(),
                    this.config.pollingIntervalMs,
                );
            }
        });
    }

    private async fetchUpdates(): Promise<void> {
        try {
            const result = await this.apiCall<{
                ok: boolean;
                result: TelegramUpdate[];
            }>('getUpdates', {
                offset: this.offset,
                timeout: 30,
                allowed_updates: ['message'],
            });

            if (!result?.ok || !result.result.length) return;

            for (const update of result.result) {
                this.offset = update.update_id + 1;
                if (update.message) {
                    await this.handleMessage(update.message);
                }
            }
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`[TelegramBot] Polling error: ${msg}`);
        }
    }

    // ─── Message Handling ─────────────────────────────────────

    private async handleMessage(message: TelegramMessage): Promise<void> {
        const chatId = message.chat.id;

        // Enforce allow-list
        if (
            this.config.allowedChatIds.length > 0 &&
            !this.config.allowedChatIds.includes(chatId)
        ) {
            return;
        }

        const text = message.text ?? '';
        if (!text.startsWith('/')) return;

        // Parse command
        const parts = text.split(/\s+/);
        const rawCommand = parts[0]!.slice(1).split('@')[0]!; // strip leading / and @botname
        const args = parts.slice(1);

        const ctx: CommandContext = {
            chatId,
            messageId: message.message_id,
            userId: message.from?.id ?? 0,
            username: message.from?.username,
            text,
            command: rawCommand.toLowerCase(),
            args,
        };

        this.logger.debug(
            `[TelegramBot] Command /${ctx.command} from ${ctx.username ?? ctx.userId}`,
        );

        try {
            const reply = await routeCommand(ctx, this.swarm);
            await this.sendReply(chatId, reply);
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`[TelegramBot] Command handler error: ${msg}`);
            await this.sendReply(chatId, `❌ Error: ${msg}`);
        }
    }

    // ─── Telegram API ─────────────────────────────────────────

    private async sendReply(chatId: number, text: string): Promise<void> {
        await this.apiCall('sendMessage', {
            chat_id: chatId,
            text: text.slice(0, this.config.maxMessageLength),
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true,
        });
    }

    private async apiCall<T = unknown>(
        method: string,
        body?: Record<string, unknown>,
    ): Promise<T | null> {
        const url = `https://api.telegram.org/bot${this.config.token}/${method}`;
        try {
            const response = await fetch(url, {
                method: body ? 'POST' : 'GET',
                headers: body ? { 'Content-Type': 'application/json' } : undefined,
                body: body ? JSON.stringify(body) : undefined,
            });
            return (await response.json()) as T;
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error(`[TelegramBot] API ${method} failed: ${msg}`);
            return null;
        }
    }
}
