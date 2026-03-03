/**
 * Tests for lib/queue.ts — Bounded Concurrency Request Queue
 *
 * Exercises concurrency limiting, FIFO ordering, timeout handling,
 * queue full rejection, and metrics tracking.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { QueueFullError, RequestQueue } from "../../src/lib/queue.js";

function delay(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

// ─── Basic Execution ─────────────────────────────────────────

describe("RequestQueue — basic execution", () => {
    let q: RequestQueue;

    beforeEach(() => {
        q = new RequestQueue({
            name: "test",
            concurrency: 3,
            maxQueue: 10,
            timeout: 5000,
        });
    });

    it("executes a task and returns its result", async () => {
        const result = await q.execute(() => Promise.resolve(42));
        expect(result).toBe(42);
    });

    it("propagates task errors", async () => {
        await expect(
            q.execute(() => Promise.reject(new Error("boom"))),
        ).rejects.toThrow("boom");
    });

    it("tracks total executed count", async () => {
        await q.execute(() => Promise.resolve("a"));
        await q.execute(() => Promise.resolve("b"));
        expect(q.stats().totalExecuted).toBe(2);
    });

    it("reports running and queued counts", async () => {
        const stats = q.stats();
        expect(stats.running).toBe(0);
        expect(stats.queued).toBe(0);
        expect(stats.name).toBe("test");
        expect(stats.concurrency).toBe(3);
        expect(stats.maxQueue).toBe(10);
    });
});

// ─── Concurrency Limiting ────────────────────────────────────

describe("RequestQueue — concurrency", () => {
    it("limits concurrent executions to configured concurrency", async () => {
        const q = new RequestQueue({
            name: "conc-test",
            concurrency: 2,
            maxQueue: 50,
            timeout: 5000,
        });

        let maxConcurrent = 0;
        let running = 0;

        const tasks = Array.from({ length: 10 }, () =>
            q.execute(async () => {
                running++;
                if (running > maxConcurrent) maxConcurrent = running;
                await delay(20);
                running--;
                return running;
            }),
        );

        await Promise.all(tasks);

        expect(maxConcurrent).toBeLessThanOrEqual(2);
        expect(q.stats().totalExecuted).toBe(10);
    });

    it("queues requests when at capacity", async () => {
        const q = new RequestQueue({
            name: "queue-test",
            concurrency: 1,
            maxQueue: 20,
            timeout: 5000,
        });

        const order: number[] = [];
        const tasks = Array.from({ length: 5 }, (_, i) =>
            q.execute(async () => {
                order.push(i);
                await delay(10);
            }),
        );

        await Promise.all(tasks);

        // All 5 should have completed, first should start first
        expect(order).toHaveLength(5);
        expect(order[0]).toBe(0);
    });
});

// ─── Queue Full Rejection ────────────────────────────────────

describe("RequestQueue — queue full", () => {
    it("throws QueueFullError when max queue is reached", async () => {
        const q = new RequestQueue({
            name: "full-test",
            concurrency: 1,
            maxQueue: 2,
            timeout: 5000,
        });

        // Fill the single slot + occupy the queue
        const blocker = q.execute(() => delay(200));
        const waiter1 = q.execute(() => delay(10));
        const waiter2 = q.execute(() => delay(10));

        // This should be rejected — 1 running + 2 queued = at capacity
        await expect(q.execute(() => delay(10))).rejects.toThrow(QueueFullError);

        await Promise.allSettled([blocker, waiter1, waiter2]);
        expect(q.stats().totalRejected).toBeGreaterThanOrEqual(1);
    });

    it("QueueFullError has correct properties", () => {
        const err = new QueueFullError(100);
        expect(err.name).toBe("QueueFullError");
        expect(err.status).toBe(503);
        expect(err.message).toContain("100");
    });
});

// ─── FIFO Ordering ───────────────────────────────────────────

describe("RequestQueue — FIFO ordering", () => {
    it("processes queued tasks in FIFO order", async () => {
        const q = new RequestQueue({
            name: "fifo-test",
            concurrency: 1,
            maxQueue: 20,
            timeout: 5000,
        });

        const completionOrder: number[] = [];

        const tasks = Array.from({ length: 5 }, (_, i) =>
            q.execute(async () => {
                completionOrder.push(i);
                await delay(5);
            }),
        );

        await Promise.all(tasks);
        expect(completionOrder).toEqual([0, 1, 2, 3, 4]);
    });
});

// ─── Timeout Handling ────────────────────────────────────────

describe("RequestQueue — timeout", () => {
    it("rejects tasks that exceed the timeout", async () => {
        const q = new RequestQueue({
            name: "timeout-test",
            concurrency: 5,
            maxQueue: 10,
            timeout: 50, // 50ms timeout
        });

        await expect(q.execute(() => delay(500))).rejects.toThrow(
            "Queue task timeout",
        );

        expect(q.stats().totalTimedOut).toBeGreaterThanOrEqual(1);
    });

    it("does not affect tasks that complete within timeout", async () => {
        const q = new RequestQueue({
            name: "timeout-ok-test",
            concurrency: 5,
            maxQueue: 10,
            timeout: 1000,
        });

        const result = await q.execute(async () => {
            await delay(10);
            return "done";
        });

        expect(result).toBe("done");
        expect(q.stats().totalTimedOut).toBe(0);
    });
});

// ─── Failure Isolation ───────────────────────────────────────

describe("RequestQueue — failure isolation", () => {
    it("handles task failures without blocking the queue", async () => {
        const q = new RequestQueue({
            name: "fail-test",
            concurrency: 1,
            maxQueue: 10,
            timeout: 5000,
        });

        const results = await Promise.allSettled([
            q.execute(() => Promise.resolve("ok")),
            q.execute(() => Promise.reject(new Error("fail"))),
            q.execute(() => Promise.resolve("also ok")),
        ]);

        expect(results[0]).toMatchObject({
            status: "fulfilled",
            value: "ok",
        });
        expect(results[1]).toMatchObject({ status: "rejected" });
        expect(results[2]).toMatchObject({
            status: "fulfilled",
            value: "also ok",
        });

        // Both successful tasks should be counted
        expect(q.stats().totalExecuted).toBe(2);
    });
});

// ─── Metrics ─────────────────────────────────────────────────

describe("RequestQueue — metrics", () => {
    it("tracks peak concurrent tasks", async () => {
        const q = new RequestQueue({
            name: "peak-test",
            concurrency: 5,
            maxQueue: 50,
            timeout: 5000,
        });

        const tasks = Array.from({ length: 5 }, () =>
            q.execute(() => delay(50)),
        );

        await Promise.all(tasks);
        expect(q.stats().peakConcurrent).toBeGreaterThanOrEqual(1);
    });

    it("tracks average wait time", async () => {
        const q = new RequestQueue({
            name: "wait-test",
            concurrency: 1,
            maxQueue: 50,
            timeout: 5000,
        });

        // First task hogs the slot, others queue and wait
        await Promise.all([
            q.execute(() => delay(30)),
            q.execute(() => delay(5)),
        ]);

        const stats = q.stats();
        expect(stats.avgWaitMs).toBeGreaterThanOrEqual(0);
        expect(stats.totalExecuted).toBe(2);
    });
});
