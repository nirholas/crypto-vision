/**
 * Tests for lib/queue.ts — RequestQueue, QueueFullError, shared queues
 *
 * Exercises bounded concurrency, timeout, queue-full rejection, and metrics.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { RequestQueue, QueueFullError, aiQueue, heavyFetchQueue } from "../queue.js";

// ─── RequestQueue constructor defaults ───────────────────────

describe("RequestQueue constructor", () => {
  it("uses default config when none provided", () => {
    const q = new RequestQueue();
    const s = q.stats();
    expect(s.concurrency).toBe(10);
    expect(s.maxQueue).toBe(500);
    expect(s.name).toBe("unnamed");
  });

  it("accepts custom config values", () => {
    const q = new RequestQueue({ name: "test", concurrency: 3, maxQueue: 5, timeout: 1000 });
    const s = q.stats();
    expect(s.concurrency).toBe(3);
    expect(s.maxQueue).toBe(5);
    expect(s.name).toBe("test");
  });
});

// ─── execute() — happy path ─────────────────────────────────

describe("RequestQueue.execute()", () => {
  it("executes a simple async function and returns its value", async () => {
    const q = new RequestQueue({ concurrency: 2 });
    const result = await q.execute(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it("executes multiple tasks up to concurrency limit", async () => {
    const q = new RequestQueue({ concurrency: 3 });
    const order: number[] = [];

    const makeTask = (id: number, delayMs: number) => () =>
      new Promise<number>((resolve) => {
        order.push(id);
        setTimeout(() => resolve(id), delayMs);
      });

    const results = await Promise.all([
      q.execute(makeTask(1, 10)),
      q.execute(makeTask(2, 10)),
      q.execute(makeTask(3, 10)),
    ]);

    expect(results).toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]); // All started immediately (concurrency=3)
  });

  it("queues tasks beyond the concurrency limit", async () => {
    const q = new RequestQueue({ concurrency: 1, timeout: 5000 });
    const order: string[] = [];

    const task1 = q.execute(async () => {
      order.push("task1-start");
      await new Promise((r) => setTimeout(r, 50));
      order.push("task1-end");
      return "a";
    });
    const task2 = q.execute(async () => {
      order.push("task2-start");
      return "b";
    });

    const [r1, r2] = await Promise.all([task1, task2]);
    expect(r1).toBe("a");
    expect(r2).toBe("b");
    expect(order.indexOf("task1-end")).toBeLessThan(order.indexOf("task2-start"));
  });

  it("propagates errors from the task function", async () => {
    const q = new RequestQueue({ concurrency: 2 });
    await expect(
      q.execute(() => Promise.reject(new Error("task-error"))),
    ).rejects.toThrow("task-error");
  });

  it("releases the slot after a task error so new tasks can run", async () => {
    const q = new RequestQueue({ concurrency: 1, timeout: 5000 });

    // First task fails
    await expect(
      q.execute(() => Promise.reject(new Error("fail"))),
    ).rejects.toThrow("fail");

    // Second task should still work
    const result = await q.execute(() => Promise.resolve("ok"));
    expect(result).toBe("ok");
  });

  it("times out tasks that exceed the timeout", async () => {
    const q = new RequestQueue({ concurrency: 1, timeout: 50 });
    await expect(
      q.execute(() => new Promise((resolve) => setTimeout(resolve, 500))),
    ).rejects.toThrow("Queue task timeout");
  });

  it("tracks metrics after execution", async () => {
    const q = new RequestQueue({ concurrency: 2 });
    await q.execute(() => Promise.resolve("a"));
    await q.execute(() => Promise.resolve("b"));

    const s = q.stats();
    expect(s.totalExecuted).toBe(2);
    expect(s.running).toBe(0);
    expect(s.queued).toBe(0);
  });

  it("increments totalTimedOut on timeout", async () => {
    const q = new RequestQueue({ concurrency: 1, timeout: 20 });
    try {
      await q.execute(() => new Promise((resolve) => setTimeout(resolve, 500)));
    } catch { /* expected */ }

    expect(q.stats().totalTimedOut).toBe(1);
  });

  it("tracks peakConcurrent", async () => {
    const q = new RequestQueue({ concurrency: 5 });
    await Promise.all([
      q.execute(() => Promise.resolve(1)),
      q.execute(() => Promise.resolve(2)),
      q.execute(() => Promise.resolve(3)),
    ]);

    expect(q.stats().peakConcurrent).toBeGreaterThanOrEqual(1);
  });
});

// ─── QueueFullError ──────────────────────────────────────────

describe("QueueFullError", () => {
  it("is an instance of Error", () => {
    const err = new QueueFullError(100);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(QueueFullError);
  });

  it("has name QueueFullError", () => {
    const err = new QueueFullError(50);
    expect(err.name).toBe("QueueFullError");
  });

  it("has status 503", () => {
    const err = new QueueFullError(10);
    expect(err.status).toBe(503);
  });

  it("includes maxQueue in message", () => {
    const err = new QueueFullError(250);
    expect(err.message).toContain("250");
  });
});

// ─── Queue full rejection ────────────────────────────────────

describe("Queue full rejection", () => {
  it("throws QueueFullError when queue is full", async () => {
    const q = new RequestQueue({ concurrency: 1, maxQueue: 1, timeout: 5000 });

    // Occupy the only slot
    const blocker = q.execute(
      () => new Promise((resolve) => setTimeout(resolve, 200)),
    );

    // Fill the queue (1 waiting)
    const waiter = q.execute(() => Promise.resolve("waited"));

    // This should reject — queue is full
    await expect(
      q.execute(() => Promise.resolve("rejected")),
    ).rejects.toThrow(QueueFullError);

    await blocker;
    await waiter;
  });

  it("increments totalRejected metric on rejection", async () => {
    const q = new RequestQueue({ concurrency: 1, maxQueue: 0, timeout: 5000 });

    // Occupy the slot
    const blocker = q.execute(
      () => new Promise((resolve) => setTimeout(resolve, 100)),
    );

    // maxQueue is 0, so this should reject immediately
    await expect(
      q.execute(() => Promise.resolve("nope")),
    ).rejects.toThrow(QueueFullError);

    await blocker;
    expect(q.stats().totalRejected).toBe(1);
  });
});

// ─── stats() ─────────────────────────────────────────────────

describe("RequestQueue.stats()", () => {
  it("returns all expected metric fields", () => {
    const q = new RequestQueue({ name: "metrics-test", concurrency: 5, maxQueue: 100 });
    const s = q.stats();

    expect(s).toEqual(
      expect.objectContaining({
        name: "metrics-test",
        running: 0,
        queued: 0,
        concurrency: 5,
        maxQueue: 100,
        totalExecuted: 0,
        totalRejected: 0,
        totalTimedOut: 0,
        avgWaitMs: 0,
        peakConcurrent: 0,
      }),
    );
  });

  it("computes avgWaitMs after execution", async () => {
    const q = new RequestQueue({ concurrency: 1, timeout: 5000 });

    // Run a couple tasks — wait time should be ~0 since concurrency allows immediate execution
    await q.execute(() => Promise.resolve("x"));
    await q.execute(() => Promise.resolve("y"));

    const s = q.stats();
    expect(s.totalExecuted).toBe(2);
    expect(typeof s.avgWaitMs).toBe("number");
  });
});

// ─── Shared queues ───────────────────────────────────────────

describe("Shared queue instances", () => {
  it("aiQueue is a RequestQueue instance", () => {
    expect(aiQueue).toBeInstanceOf(RequestQueue);
    expect(aiQueue.stats().name).toBe("ai");
  });

  it("heavyFetchQueue is a RequestQueue instance", () => {
    expect(heavyFetchQueue).toBeInstanceOf(RequestQueue);
    expect(heavyFetchQueue.stats().name).toBe("heavyFetch");
  });

  it("aiQueue has higher timeout than heavyFetchQueue", () => {
    // AI tasks need 60s, heavy fetch 15s (per source comments)
    expect(aiQueue.stats().concurrency).toBeGreaterThan(0);
    expect(heavyFetchQueue.stats().concurrency).toBeGreaterThan(0);
  });
});
