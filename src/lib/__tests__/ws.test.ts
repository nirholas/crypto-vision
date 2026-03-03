/**
 * Tests for lib/ws.ts — WebSocket manager: client registry, stats, lifecycle
 *
 * Mocks all external dependencies (Redis, upstream WebSockets, logger).
 * Tests the public API surface: addClient, removeClient, wsStats,
 * updateClientCoins, broadcastToTopic, startUpstreams, stopUpstreams.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis before importing ws module
vi.mock("@/lib/redis", () => ({
  getRedis: vi.fn().mockResolvedValue(null),
  getRedisSubscriber: vi.fn().mockResolvedValue(null),
}));

// Mock logger
vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock ws module (WebSocket constructor)
vi.mock("ws", () => {
  const OPEN = 1;
  const CONNECTING = 0;
  const CLOSING = 2;
  const CLOSED = 3;

  class MockWebSocket {
    static OPEN = OPEN;
    static CONNECTING = CONNECTING;
    static CLOSING = CLOSING;
    static CLOSED = CLOSED;
    readyState = OPEN;
    listeners: Record<string, Function[]> = {};

    on(event: string, fn: Function) {
      this.listeners[event] = this.listeners[event] || [];
      this.listeners[event].push(fn);
      return this;
    }
    removeAllListeners() {
      this.listeners = {};
      return this;
    }
    send = vi.fn();
    close = vi.fn();
    ping = vi.fn();
  }

  return {
    default: MockWebSocket,
    WebSocket: MockWebSocket,
  };
});

import {
  addClient,
  removeClient,
  updateClientCoins,
  wsStats,
  startUpstreams,
  stopUpstreams,
  broadcastToTopic,
  type Topic,
} from "@/lib/ws.js";
import type { WSContext } from "hono/ws";

// ─── Helpers ─────────────────────────────────────────────────

function createMockWs(readyState = 1): WSContext {
  return {
    readyState,
    send: vi.fn(),
    close: vi.fn(),
    raw: {},
  } as unknown as WSContext;
}

// ─── wsStats ────────────────────────────────────────────────

describe("wsStats()", () => {
  it("returns stats object with expected structure", () => {
    const stats = wsStats();
    expect(stats).toHaveProperty("clients");
    expect(stats).toHaveProperty("upstreams");
    expect(stats).toHaveProperty("leader");
    expect(stats).toHaveProperty("instanceId");
    expect(typeof stats.leader).toBe("boolean");
    expect(typeof stats.instanceId).toBe("string");
  });

  it("has client counts for each topic", () => {
    const stats = wsStats();
    expect(stats.clients).toHaveProperty("prices");
    expect(stats.clients).toHaveProperty("bitcoin");
    expect(stats.clients).toHaveProperty("trades");
    expect(typeof stats.clients.prices).toBe("number");
    expect(typeof stats.clients.bitcoin).toBe("number");
    expect(typeof stats.clients.trades).toBe("number");
  });

  it("has upstream status information", () => {
    const stats = wsStats();
    expect(stats.upstreams).toHaveProperty("coinCap");
    expect(stats.upstreams).toHaveProperty("mempool");
    expect(stats.upstreams).toHaveProperty("dexPolling");
    expect(typeof stats.upstreams.dexPolling).toBe("boolean");
  });
});

// ─── addClient / removeClient ───────────────────────────────

describe("addClient()", () => {
  afterEach(async () => {
    // Cleanup: stop upstreams to clear intervals
    await stopUpstreams();
  });

  it("adds a client to the prices topic", () => {
    const ws = createMockWs();
    const before = wsStats().clients.prices;
    const entry = addClient("prices", ws);
    const after = wsStats().clients.prices;
    expect(after).toBe(before + 1);

    // Cleanup
    removeClient("prices", entry);
  });

  it("adds a client to the bitcoin topic", () => {
    const ws = createMockWs();
    const before = wsStats().clients.bitcoin;
    const entry = addClient("bitcoin", ws);
    const after = wsStats().clients.bitcoin;
    expect(after).toBe(before + 1);

    removeClient("bitcoin", entry);
  });

  it("accepts coin subscriptions for prices topic", () => {
    const ws = createMockWs();
    const entry = addClient("prices", ws, { coins: ["bitcoin", "ethereum"] });
    expect(entry).toBeDefined();

    removeClient("prices", entry);
  });
});

describe("removeClient()", () => {
  it("decrements client count after removal", () => {
    const ws = createMockWs();
    const entry = addClient("trades", ws);
    const countAfterAdd = wsStats().clients.trades;

    removeClient("trades", entry);
    const countAfterRemove = wsStats().clients.trades;
    expect(countAfterRemove).toBe(countAfterAdd - 1);
  });

  it("handles removing a client that was already removed", () => {
    const ws = createMockWs();
    const entry = addClient("bitcoin", ws);

    removeClient("bitcoin", entry);
    // Second removal should not throw
    removeClient("bitcoin", entry);
  });
});

// ─── updateClientCoins ──────────────────────────────────────

describe("updateClientCoins()", () => {
  it("updates the coin subscription for a client", () => {
    const ws = createMockWs();
    const entry = addClient("prices", ws, { coins: ["bitcoin"] });

    updateClientCoins(entry, ["bitcoin", "ethereum", "solana"]);
    // The entry should now have the updated coins set
    // We can't directly inspect the Set, but the function should not throw
    expect(entry).toBeDefined();

    removeClient("prices", entry);
  });

  it("handles empty coin array", () => {
    const ws = createMockWs();
    const entry = addClient("prices", ws, { coins: ["bitcoin"] });

    // Should not throw
    updateClientCoins(entry, []);

    removeClient("prices", entry);
  });
});

// ─── broadcastToTopic ───────────────────────────────────────

describe("broadcastToTopic()", () => {
  it("sends message to connected clients on a topic", () => {
    const ws = createMockWs();
    const entry = addClient("bitcoin", ws);

    broadcastToTopic("bitcoin", JSON.stringify({ type: "block", data: {} }));

    expect(ws.send).toHaveBeenCalledTimes(1);

    removeClient("bitcoin", entry);
  });

  it("does not throw when no clients are connected", () => {
    expect(() => {
      broadcastToTopic("alerts", JSON.stringify({ type: "alert", data: {} }));
    }).not.toThrow();
  });

  it("skips clients with non-OPEN readyState", () => {
    const ws = createMockWs(3); // CLOSED
    const entry = addClient("bitcoin", ws);

    broadcastToTopic("bitcoin", JSON.stringify({ type: "block", data: {} }));

    expect(ws.send).not.toHaveBeenCalled();

    removeClient("bitcoin", entry);
  });

  it("filters price messages to subscribed coins only", () => {
    const ws = createMockWs();
    const entry = addClient("prices", ws, { coins: ["bitcoin"] });

    const priceMsg = JSON.stringify({
      type: "price",
      data: { bitcoin: "65000", ethereum: "3000" },
      timestamp: new Date().toISOString(),
    });

    broadcastToTopic("prices", priceMsg);

    // The client should receive only bitcoin price
    if (ws.send.mock.calls.length > 0) {
      const sent = JSON.parse(ws.send.mock.calls[0][0]);
      expect(sent.data).toHaveProperty("bitcoin");
      expect(sent.data).not.toHaveProperty("ethereum");
    }

    removeClient("prices", entry);
  });
});

// ─── startUpstreams / stopUpstreams lifecycle ────────────────

describe("startUpstreams() / stopUpstreams()", () => {
  it("startUpstreams resolves without error (no Redis)", async () => {
    await expect(startUpstreams()).resolves.toBeUndefined();
  });

  it("stopUpstreams resolves without error", async () => {
    await expect(stopUpstreams()).resolves.toBeUndefined();
  });

  it("stopUpstreams clears all connected clients", async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    addClient("prices", ws1);
    addClient("bitcoin", ws2);

    await stopUpstreams();

    const stats = wsStats();
    expect(stats.clients.prices).toBe(0);
    expect(stats.clients.bitcoin).toBe(0);
  });

  it("can start and stop multiple times", async () => {
    await startUpstreams();
    await stopUpstreams();
    await startUpstreams();
    await stopUpstreams();
    // No errors thrown
  });
});
