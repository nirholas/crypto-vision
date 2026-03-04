/**
 * Sect Bot — Main Entry Point
 *
 * Initializes and starts the Telegram bot, background workers,
 * and registers webhook or long-polling mode.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { createBot } from "./telegram/bot.js";
import { startPriceTracker, stopPriceTracker, setAlertDeliveryCallback } from "./workers/price-tracker.js";
import { startHardcoreWorker, stopHardcoreWorker, setKickCallback } from "./workers/hardcore-worker.js";
import { logger } from "@/lib/logger";
import { closeDb } from "./db/index.js";
import type { Bot } from "grammy";
import { formatInsiderAlert } from "./messages/formatter.js";
import { getUserById } from "./services/user-service.js";
import { getGroupById } from "./services/group-service.js";

const log = logger.child({ module: "sectbot" });

const BOT_RESTART_DELAY_MS = 5_000;
const BOT_MAX_RESTART_ATTEMPTS = 10;

let botInstance: Bot | null = null;
let restartAttempts = 0;
let restartTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Start the Sect Bot — connects to Telegram, starts workers.
 */
export async function startBot(): Promise<Bot> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is required");
  }

  log.info("Starting Sect Bot...");

  const bot = createBot(token);
  botInstance = bot;

  // Set up worker callbacks that need access to the bot instance

  // Insider alert delivery — send DM to each subscriber
  setAlertDeliveryCallback(async (subscriberTelegramIds, call, alertData) => {
    try {
      // Look up caller username from call.userId
      const caller = await getUserById(call.userId);
      const callerUsername = caller?.username ?? null;

      const msg = formatInsiderAlert(
        call,
        callerUsername,
        alertData.callerWinRate,
        alertData.callerAvgGain,
        alertData.callerTotalCalls,
      );

      for (const telegramId of subscriberTelegramIds) {
        try {
          await bot.api.sendMessage(telegramId, msg, { parse_mode: "HTML" });
        } catch (sendErr) {
          log.warn({ err: sendErr, telegramId }, "Failed to deliver insider alert to subscriber");
        }
      }
    } catch (err) {
      log.warn({ err }, "Failed to prepare insider alert message");
    }
  });

  // Hardcore kick callback — ban removed users from group
  setKickCallback(async (groupId: string, removedUsers: Array<{ userId: string; username: string | null; winRate: number }>) => {
    try {
      // Resolve internal group ID → Telegram group ID
      const group = await getGroupById(groupId);
      if (!group) {
        log.warn({ groupId }, "Cannot kick users: group not found");
        return;
      }
      const chatId = parseInt(group.telegramId);

      for (const user of removedUsers) {
        try {
          // Look up user's Telegram ID
          const dbUser = await getUserById(user.userId);
          if (!dbUser) continue;

          const userTelegramId = parseInt(dbUser.telegramId);
          await bot.api.banChatMember(chatId, userTelegramId);
          // Immediately unban to allow rejoin (but they've been removed)
          await bot.api.unbanChatMember(chatId, userTelegramId);

          log.info(
            { groupId, userId: user.userId, username: user.username, winRate: user.winRate },
            "Hardcore kick executed",
          );
        } catch (kickErr) {
          log.warn({ err: kickErr, groupId, userId: user.userId }, "Failed to kick user in hardcore mode");
        }
      }
    } catch (err) {
      log.warn({ err, groupId }, "Failed to process hardcore kicks");
    }
  });

  // Start background workers
  startPriceTracker();
  startHardcoreWorker();

  // Set bot commands menu
  await bot.api.setMyCommands([
    { command: "start", description: "Get started with Sect Bot" },
    { command: "leaderboard", description: "View group leaderboards" },
    { command: "last", description: "Show recent calls" },
    { command: "pnl", description: "Generate PNL card" },
    { command: "gpnl", description: "Group PNL card" },
    { command: "calls", description: "View user calls" },
    { command: "alpha", description: "Alpha calls" },
    { command: "gamble", description: "Gamble calls" },
    { command: "winrate", description: "Check win rate" },
    { command: "hardcore", description: "Hardcore mode stats" },
    { command: "rank", description: "Your rank card (DM)" },
    { command: "ref", description: "Referral link (DM)" },
    { command: "payments", description: "Purchase premium (DM)" },
    { command: "settings", description: "Group settings (admin)" },
    { command: "language", description: "Set language (admin)" },
    { command: "premium", description: "Premium status" },
    { command: "channel", description: "Call channels (admin)" },
    { command: "wipeleaderboard", description: "Reset leaderboard (admin)" },
    { command: "block", description: "Block user (admin)" },
    { command: "unblock", description: "Unblock user (admin)" },
    { command: "ads", description: "Custom ads (premium)" },
    { command: "reset", description: "Reset settings (admin)" },
  ]);

  // Start long polling with automatic restart on failure
  startPolling(bot);

  return bot;
}

/**
 * Start long-polling with automatic reconnection.
 * If polling stops unexpectedly (network error, 409 conflict, etc.)
 * it will retry with exponential back-off up to BOT_MAX_RESTART_ATTEMPTS.
 */
function startPolling(bot: Bot): void {
  bot.start({
    onStart: (botInfo) => {
      restartAttempts = 0; // reset on successful start
      log.info({ username: botInfo.username }, "Sect Bot polling started");
    },
    allowed_updates: [
      "message",
      "callback_query",
      "chat_member",
      "my_chat_member",
    ],
    drop_pending_updates: true,
  });

  // grammY resolves the internal polling promise when polling stops.
  // We hook into the bot's internal runner to detect unexpected stops.
  // grammY provides no `onStop` in start(), so we poll the `isRunning` flag.
  const watchdog = setInterval(() => {
    // bot.isInited() is true once the bot has started at least once.
    // If isInited but the internal polling supplier is gone, polling died.
    if (botInstance === bot && !isBotPolling(bot)) {
      clearInterval(watchdog);
      handlePollingDeath(bot);
    }
  }, 10_000);
  watchdog.unref();
}

/** Check if grammY's polling loop is still alive */
function isBotPolling(bot: Bot): boolean {
  // grammY sets `bot.isRunning` (getter) to true while polling.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (bot as any).pollingRunning === true;
  } catch {
    // Fallback: if we can't determine, assume alive
    return true;
  }
}

/** Handle unexpected polling death — restart with backoff */
function handlePollingDeath(bot: Bot): void {
  if (botInstance !== bot) return; // bot was replaced or stopped intentionally

  restartAttempts++;
  if (restartAttempts > BOT_MAX_RESTART_ATTEMPTS) {
    log.error(
      { attempts: restartAttempts },
      "Bot polling died and max restart attempts reached — giving up",
    );
    return;
  }

  const delay = Math.min(BOT_RESTART_DELAY_MS * Math.pow(2, restartAttempts - 1), 300_000);
  log.warn(
    { attempt: restartAttempts, delayMs: delay },
    "Bot polling stopped unexpectedly — scheduling restart",
  );

  restartTimer = setTimeout(() => {
    restartTimer = null;
    if (botInstance !== bot) return;
    log.info({ attempt: restartAttempts }, "Restarting bot polling...");
    startPolling(bot);
  }, delay);
  restartTimer.unref();
}

/**
 * Stop the bot gracefully.
 */
export async function stopBot(): Promise<void> {
  log.info("Stopping Sect Bot...");

  // Cancel any pending restart timer
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }

  stopPriceTracker();
  stopHardcoreWorker();

  if (botInstance) {
    const bot = botInstance;
    botInstance = null; // signal to watchdog that stop was intentional
    await bot.stop();
  }

  await closeDb();
  log.info("Sect Bot stopped");
}

/**
 * Get the running bot instance.
 */
export function getBotInstance(): Bot | null {
  return botInstance;
}
