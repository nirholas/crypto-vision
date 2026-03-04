/**
 * WebSocket Integration Tests — Connect, subscribe, receive, unsubscribe.
 *
 * Tests the real WS server at /ws/prices, /ws/bitcoin, /ws/trades, /ws/alerts.
 * Spins up the full API server on a random port.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "../..");

let serverProcess: ChildProcess | undefined;
let BASE_URL: string;
let WS_URL: string;

// ─── Setup ───────────────────────────────────────────────────

async function getRandomPort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      if (addr && typeof addr === "object") {
        const port = addr.port;
        srv.close(() => resolvePort(port));
      } else {
        srv.close(() => reject(new Error("Failed to get random port")));
      }
    });
    srv.on("error", reject);
  });
}

async function waitForHealth(url: string, maxAttempts = 60): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 503) return;
    } catch {
      // Not ready
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server did not become healthy at ${url}`);
}

beforeAll(async () => {
  const port = await getRandomPort();
  BASE_URL = `http://localhost:${port}`;
  WS_URL = `ws://localhost:${port}`;

  serverProcess = spawn("npx", ["tsx", "src/index.ts"], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      LOG_LEVEL: "warn",
      API_KEYS: "ws-test-key:pro",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  serverProcess.stderr?.on("data", (chunk: Buffer) => {
    const msg = chunk.toString().trim();
    if (msg && (msg.includes("FATAL") || msg.includes("Error"))) {
      console.error(`[ws-test] ${msg}`);
    }
  });

  await waitForHealth(`${BASE_URL}/health`);
}, 60_000);

afterAll(async () => {
  if (serverProcess) {
    serverProcess.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      serverProcess!.on("exit", resolve);
      setTimeout(resolve, 5000);
    });
  }
});

// ─── Helpers ─────────────────────────────────────────────────

interface WsMessage {
  type?: string;
  topic?: string;
  coins?: string[];
  feeds?: string[];
  source?: string;
  [key: string]: unknown;
}

/**
 * Connect a WebSocket and wait for it to open.
 * Returns the WebSocket and a helper to collect messages.
 */
function connectWs(
  path: string,
): Promise<{ ws: WebSocket; messages: WsMessage[]; waitForMessage: (predicate: (msg: WsMessage) => boolean, timeoutMs?: number) => Promise<WsMessage> }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_URL}${path}`);
    const messages: WsMessage[] = [];

    ws.on("open", () => {
      resolve({
        ws,
        messages,
        waitForMessage: (predicate, timeoutMs = 10_000) => {
          return new Promise<WsMessage>((resolveMsg, rejectMsg) => {
            // Check already-received messages
            const existing = messages.find(predicate);
            if (existing) {
              resolveMsg(existing);
              return;
            }

            const timer = setTimeout(() => {
              rejectMsg(new Error(`Timed out waiting for WS message (${timeoutMs}ms). Received: ${JSON.stringify(messages)}`));
            }, timeoutMs);

            const handler = (data: WebSocket.Data) => {
              try {
                const msg = JSON.parse(data.toString()) as WsMessage;
                if (predicate(msg)) {
                  clearTimeout(timer);
                  ws.off("message", handler);
                  resolveMsg(msg);
                }
              } catch {
                // Ignore non-JSON messages
              }
            };
            ws.on("message", handler);
          });
        },
      });
    });

    ws.on("message", (data: WebSocket.Data) => {
      try {
        messages.push(JSON.parse(data.toString()) as WsMessage);
      } catch {
        // Ignore non-JSON
      }
    });

    ws.on("error", (err) => reject(err));

    setTimeout(() => reject(new Error("WS connection timeout")), 10_000);
  });
}

function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    ws.on("close", () => resolve());
    ws.close();
    setTimeout(resolve, 3000);
  });
}

// ─── Tests ───────────────────────────────────────────────────

describe("WebSocket: /ws/prices", () => {
  it("connects and receives a subscribed confirmation", async () => {
    const { ws, waitForMessage } = await connectWs("/ws/prices?coins=bitcoin,ethereum");
    try {
      const msg = await waitForMessage((m) => m.type === "subscribed");
      expect(msg.topic).toBe("prices");
      expect(msg.coins).toEqual(expect.arrayContaining(["bitcoin", "ethereum"]));
      expect(msg).toHaveProperty("timestamp");
    } finally {
      await closeWs(ws);
    }
  });

  it("supports subscribe action to change coin list", async () => {
    const { ws, waitForMessage } = await connectWs("/ws/prices?coins=bitcoin");
    try {
      // Wait for initial subscription confirmation
      await waitForMessage((m) => m.type === "subscribed" && m.topic === "prices");

      // Send subscribe with new coins
      ws.send(JSON.stringify({ action: "subscribe", coins: ["solana", "cardano"] }));

      // Wait for updated subscription confirmation
      const msg = await waitForMessage(
        (m) => m.type === "subscribed" && Array.isArray(m.coins) && m.coins.includes("solana"),
      );
      expect(msg.coins).toEqual(expect.arrayContaining(["solana", "cardano"]));
    } finally {
      await closeWs(ws);
    }
  });

  it("handles malformed messages gracefully", async () => {
    const { ws } = await connectWs("/ws/prices?coins=bitcoin");
    try {
      // Send various malformed messages — server should not crash
      ws.send("not json");
      ws.send("{}");
      ws.send(JSON.stringify({ action: "subscribe" })); // missing coins
      ws.send(JSON.stringify({ action: "subscribe", coins: "string-not-array" }));
      ws.send(JSON.stringify({ action: "unknown-action" }));

      // Wait a bit to ensure server processes messages
      await new Promise((r) => setTimeout(r, 1000));

      // Server should still be alive — check health
      const healthRes = await fetch(`${BASE_URL}/health`);
      expect([200, 503]).toContain(healthRes.status);
    } finally {
      await closeWs(ws);
    }
  });
});

describe("WebSocket: /ws/bitcoin", () => {
  it("connects and receives subscribed confirmation", async () => {
    const { ws, waitForMessage } = await connectWs("/ws/bitcoin");
    try {
      const msg = await waitForMessage((m) => m.type === "subscribed");
      expect(msg.topic).toBe("bitcoin");
      expect(msg.feeds).toEqual(expect.arrayContaining(["blocks", "large-transactions"]));
    } finally {
      await closeWs(ws);
    }
  });

  it("responds to pong heartbeat without error", async () => {
    const { ws, waitForMessage } = await connectWs("/ws/bitcoin");
    try {
      await waitForMessage((m) => m.type === "subscribed");
      ws.send(JSON.stringify({ action: "pong" }));
      // No crash, no error — just wait a moment
      await new Promise((r) => setTimeout(r, 500));
      expect(ws.readyState).toBe(WebSocket.OPEN);
    } finally {
      await closeWs(ws);
    }
  });
});

describe("WebSocket: /ws/trades", () => {
  it("connects and receives subscribed confirmation", async () => {
    const { ws, waitForMessage } = await connectWs("/ws/trades");
    try {
      const msg = await waitForMessage((m) => m.type === "subscribed");
      expect(msg.topic).toBe("trades");
      expect(msg.source).toBe("dexscreener");
    } finally {
      await closeWs(ws);
    }
  });
});

describe("WebSocket: /ws/alerts", () => {
  it("connects and receives subscribed confirmation", async () => {
    const { ws, waitForMessage } = await connectWs("/ws/alerts");
    try {
      const msg = await waitForMessage((m) => m.type === "subscribed");
      expect(msg.topic).toBe("alerts");
      expect(msg.feeds).toEqual(expect.arrayContaining(["anomalies"]));
    } finally {
      await closeWs(ws);
    }
  });
});

describe("WebSocket: /ws/status (REST)", () => {
  it("GET /ws/status returns connection stats", async () => {
    const res = await fetch(`${BASE_URL}/ws/status`, {
      headers: { Accept: "application/json" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty("status", "ok");
  });
});

describe("WebSocket: Multiple connections", () => {
  it("supports multiple concurrent connections", async () => {
    const connections = await Promise.all([
      connectWs("/ws/prices?coins=bitcoin"),
      connectWs("/ws/prices?coins=ethereum"),
      connectWs("/ws/bitcoin"),
    ]);

    try {
      // All should receive subscribed messages
      for (const { waitForMessage } of connections) {
        const msg = await waitForMessage((m) => m.type === "subscribed");
        expect(msg).toBeTruthy();
      }
    } finally {
      await Promise.all(connections.map((c) => closeWs(c.ws)));
    }
  });

  it("one connection closing does not affect others", async () => {
    const conn1 = await connectWs("/ws/prices?coins=bitcoin");
    const conn2 = await connectWs("/ws/prices?coins=ethereum");

    try {
      // Both should be subscribed
      await conn1.waitForMessage((m) => m.type === "subscribed");
      await conn2.waitForMessage((m) => m.type === "subscribed");

      // Close first connection
      await closeWs(conn1.ws);

      // Second should still be alive
      await new Promise((r) => setTimeout(r, 500));
      expect(conn2.ws.readyState).toBe(WebSocket.OPEN);
    } finally {
      await closeWs(conn1.ws);
      await closeWs(conn2.ws);
    }
  });
});

describe("WebSocket: Clean disconnect", () => {
  it("client can close connection cleanly", async () => {
    const { ws, waitForMessage } = await connectWs("/ws/prices?coins=bitcoin");
    await waitForMessage((m) => m.type === "subscribed");

    // Close should not throw
    await closeWs(ws);
    expect(ws.readyState).toBe(WebSocket.CLOSED);

    // Server should still be healthy
    const healthRes = await fetch(`${BASE_URL}/health`);
    expect([200, 503]).toContain(healthRes.status);
  });
});
