/**
 * Telegram module barrel — re-exports all public Telegram APIs
 */

export { TelegramBot } from './bot.js';
export { COMMAND_HANDLERS, routeCommand } from './commands.js';
export type { CommandHandler, SwarmAccessor } from './commands.js';
export { formatter } from './formatter.js';
export { TelegramNotificationService } from './notifications.js';
export type {
    CommandContext,
    MessageFormatter,
    NotificationLevel,
    SwarmStatusSnapshot,
    TelegramBotConfig,
    TelegramNotification,
    TradeNotification,
} from './types.js';
