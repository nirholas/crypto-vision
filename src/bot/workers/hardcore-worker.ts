/**
 * Crypto Vision — Hardcore Mode Worker
 *
 * Background worker that checks for expired hardcore rounds
 * and processes member removals.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { checkExpiredSessions, endHardcoreRound } from "../services/hardcore-service.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:hardcore-worker" });

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Callback for kicking users from groups via Telegram.
 * Set from the bot module to avoid circular dependencies.
 */
let kickCallback: ((
  groupTelegramId: string,
  removedUsers: Array<{ userId: string; username: string | null; winRate: number }>,
) => Promise<void>) | null = null;

export function setKickCallback(
  callback: typeof kickCallback,
): void {
  kickCallback = callback;
}

/**
 * Run one check cycle.
 */
async function runCycle(): Promise<void> {
  try {
    const expiredGroupIds = await checkExpiredSessions();

    for (const groupId of expiredGroupIds) {
      const result = await endHardcoreRound(groupId);

      if (result.removedUsers.length > 0 && kickCallback) {
        // The group service stores the internal group ID.
        // The kick callback needs the Telegram group ID, which we'll resolve in the bot module.
        await kickCallback(groupId, result.removedUsers);
      }

      log.info(
        {
          groupId,
          removedCount: result.removedUsers.length,
          survivedCount: result.survivedUsers,
        },
        "Hardcore round processed",
      );
    }
  } catch (err) {
    log.error({ err }, "Hardcore worker cycle failed");
  }
}

/**
 * Start the hardcore mode worker.
 */
export function startHardcoreWorker(): void {
  if (intervalHandle) return;

  log.info("Starting hardcore mode worker");
  intervalHandle = setInterval(() => void runCycle(), CHECK_INTERVAL_MS);
}

/**
 * Stop the hardcore mode worker.
 */
export function stopHardcoreWorker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    log.info("Hardcore mode worker stopped");
  }
}
