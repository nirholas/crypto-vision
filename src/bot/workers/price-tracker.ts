/**
 * Crypto Vision — Price Tracker Worker
 *
 * Background worker that continuously updates call performance by
 * fetching current token prices for all active (non-archived) calls.
 *
 * Runs on a configurable interval (default: 60 seconds).
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { getActiveCalls, updateCallPerformance } from "../services/call-service.js";
import { getTokenPrice } from "../services/token-data.js";
import { evaluateCallForInsiderAlert, getMatchingSubscribers, updateAlertNotifiedCount } from "../services/insider-alerts.js";
import { logger } from "@/lib/logger";

const log = logger.child({ module: "crypto-vision:price-tracker" });

const UPDATE_INTERVAL_MS = 60_000; // 1 minute
const BATCH_SIZE = 50; // Process tokens in batches to avoid rate limits
const MAX_CONSECUTIVE_FAILURES = 5;

let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let consecutiveFailures = 0;

/**
 * Callback for delivering insider alerts to subscribers via Telegram.
 * Set this from the bot module to avoid circular dependencies.
 */
let alertDeliveryCallback: ((
  subscriberTelegramIds: string[],
  call: Awaited<ReturnType<typeof getActiveCalls>>[0],
  alertData: { callerWinRate: number; callerAvgGain: number; callerTotalCalls: number },
) => Promise<void>) | null = null;

export function setAlertDeliveryCallback(
  callback: typeof alertDeliveryCallback,
): void {
  alertDeliveryCallback = callback;
}

/**
 * Process a batch of calls — deduplicate by token address to minimize API calls.
 */
async function processCallBatch(callBatch: Awaited<ReturnType<typeof getActiveCalls>>): Promise<void> {
  // Group calls by token address to avoid redundant price lookups
  const byToken = new Map<string, typeof callBatch>();
  for (const call of callBatch) {
    const existing = byToken.get(call.tokenAddress) || [];
    existing.push(call);
    byToken.set(call.tokenAddress, existing);
  }

  const updatePromises: Promise<void>[] = [];

  for (const [tokenAddress, tokenCalls] of byToken) {
    updatePromises.push(
      (async () => {
        try {
          const price = await getTokenPrice(tokenAddress);
          if (price === null || price <= 0) return;

          for (const call of tokenCalls) {
            const updated = await updateCallPerformance(call.id, price);

            // Check if this update should trigger an insider alert
            if (updated && updated.peakMultiplier !== null && updated.peakMultiplier > (call.peakMultiplier ?? 1)) {
              const alert = await evaluateCallForInsiderAlert(updated);
              if (alert && alertDeliveryCallback) {
                const subscribers = await getMatchingSubscribers(updated, alert);
                if (subscribers.length > 0) {
                  await alertDeliveryCallback(
                    subscribers.map((s) => s.telegramId),
                    updated,
                    {
                      callerWinRate: alert.callerWinRate,
                      callerAvgGain: alert.callerAvgGain,
                      callerTotalCalls: alert.callerTotalCalls,
                    },
                  );
                  await updateAlertNotifiedCount(alert.id, subscribers.length);
                }
              }
            }
          }
        } catch (err) {
          log.warn({ err, tokenAddress }, "Failed to update price for token");
        }
      })(),
    );
  }

  await Promise.allSettled(updatePromises);
}

/**
 * Run one price-tracking cycle.
 */
async function runCycle(): Promise<void> {
  if (isRunning) {
    log.debug("Price tracker cycle already running, skipping");
    return;
  }

  // Skip cycle if in backoff due to consecutive failures
  if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
    const backoffCycles = Math.min(consecutiveFailures - MAX_CONSECUTIVE_FAILURES + 1, 10);
    // Reset after waiting out the backoff period
    if (backoffCycles > 0) {
      consecutiveFailures = 0;
      log.info("Price tracker backoff period ended — resuming");
    }
  }

  isRunning = true;
  const start = Date.now();

  try {
    const activeCalls = await getActiveCalls();
    if (activeCalls.length === 0) {
      log.debug("No active calls to track");
      return;
    }

    log.debug({ callCount: activeCalls.length }, "Starting price tracker cycle");

    // Process in batches
    for (let i = 0; i < activeCalls.length; i += BATCH_SIZE) {
      const batch = activeCalls.slice(i, i + BATCH_SIZE);
      await processCallBatch(batch);

      // Small delay between batches to respect rate limits
      if (i + BATCH_SIZE < activeCalls.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    const elapsed = Date.now() - start;
    log.info(
      { callsProcessed: activeCalls.length, elapsedMs: elapsed },
      "Price tracker cycle complete",
    );
    consecutiveFailures = 0; // reset on success
  } catch (err) {
    consecutiveFailures++;
    const backoffMs = Math.min(UPDATE_INTERVAL_MS * Math.pow(2, consecutiveFailures - 1), 600_000);
    log.error(
      { err, consecutiveFailures, nextRetryMs: backoffMs },
      "Price tracker cycle failed",
    );

    if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      log.warn(
        { consecutiveFailures },
        "Price tracker hit max consecutive failures — pausing until next scheduled interval",
      );
    }
  } finally {
    isRunning = false;
  }
}

/**
 * Start the price tracker worker.
 */
export function startPriceTracker(): void {
  if (intervalHandle) {
    log.warn("Price tracker already running");
    return;
  }

  log.info(
    { intervalMs: UPDATE_INTERVAL_MS },
    "Starting price tracker worker",
  );

  // Run immediately on start
  void runCycle();

  // Then run on interval
  intervalHandle = setInterval(() => {
    void runCycle();
  }, UPDATE_INTERVAL_MS);
}

/**
 * Stop the price tracker worker.
 */
export function stopPriceTracker(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    log.info("Price tracker worker stopped");
  }
}
