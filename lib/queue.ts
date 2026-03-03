/**
 * Crypto Vision — Request Queue
 *
 * Bounded concurrency queue for expensive operations (AI / LLM calls).
 * Prevents a traffic spike from simultaneously launching thousands of
 * LLM requests — which would blow API rate limits and cost budgets.
 *
 * At 10M+ users, hundreds of concurrent AI requests are expected.
 * This queue ensures at most `concurrency` run in parallel, with
 * the rest waiting in a FIFO queue (bounded by `maxQueue`).
 */

import { logger } from "./logger.js";

export interface QueueConfig {
  /** Max concurrent executions (default: 10) */
  concurrency: number;
  /** Max queued items; beyond this, new requests are rejected (default: 500) */
  maxQueue: number;
  /** Timeout per task in ms (default: 30_000) */
  timeout: number;
}

export class RequestQueue {
  private running = 0;
  private queue: Array<{
    resolve: (value: void) => void;
    reject: (error: Error) => void;
    enqueued: number;
  }> = [];
  private config: QueueConfig;

  constructor(config: Partial<QueueConfig> = {}) {
    this.config = {
      concurrency: config.concurrency ?? 10,
      maxQueue: config.maxQueue ?? 500,
      timeout: config.timeout ?? 30_000,
    };
  }

  /**
   * Execute `fn` with bounded concurrency.
   * Waits in queue if at capacity. Rejects if queue is full.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();

    try {
      // Wrap with timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Queue task timeout")),
            this.config.timeout,
          ),
        ),
      ]);
      return result;
    } finally {
      this.release();
    }
  }

  private async acquire(): Promise<void> {
    if (this.running < this.config.concurrency) {
      this.running++;
      return;
    }

    if (this.queue.length >= this.config.maxQueue) {
      throw new QueueFullError(this.config.maxQueue);
    }

    return new Promise<void>((resolve, reject) => {
      this.queue.push({ resolve, reject, enqueued: Date.now() });
    });
  }

  private release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      // Check if this waiter has been in the queue too long
      if (Date.now() - next.enqueued > this.config.timeout) {
        next.reject(new Error("Queued too long — timeout"));
        this.release(); // try next in queue
        return;
      }
      next.resolve();
    } else {
      this.running--;
    }
  }

  /** Stats for monitoring */
  stats() {
    return {
      running: this.running,
      queued: this.queue.length,
      concurrency: this.config.concurrency,
      maxQueue: this.config.maxQueue,
    };
  }
}

export class QueueFullError extends Error {
  public status = 503;
  constructor(maxQueue: number) {
    super(`Service busy — ${maxQueue} requests queued. Try again shortly.`);
    this.name = "QueueFullError";
  }
}

// ─── Shared Queues ───────────────────────────────────────────

/** Queue for AI/LLM operations — most expensive */
export const aiQueue = new RequestQueue({
  concurrency: Number(process.env.AI_CONCURRENCY || 10),
  maxQueue: Number(process.env.AI_MAX_QUEUE || 500),
  timeout: 30_000,
});

/** Queue for heavy upstream fetches (e.g. DeFiLlama protocols list) */
export const heavyFetchQueue = new RequestQueue({
  concurrency: Number(process.env.HEAVY_FETCH_CONCURRENCY || 20),
  maxQueue: 1000,
  timeout: 15_000,
});

logger.info(
  { aiConcurrency: aiQueue.stats().concurrency, heavyConcurrency: heavyFetchQueue.stats().concurrency },
  "Request queues initialized",
);
