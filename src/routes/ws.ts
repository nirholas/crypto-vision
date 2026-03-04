/**
 * Crypto Vision — WebSocket Routes
 *
 * Endpoints:
 *   WS /ws           — Unified channel-based WebSocket (subscribe/unsubscribe to channels)
 *   WS /ws/prices    — Legacy: real-time price ticks (subscribe by coin IDs)
 *   WS /ws/bitcoin   — Legacy: new blocks and large Bitcoin transactions
 *   WS /ws/trades    — Legacy: DEX trade / boost feed
 *   WS /ws/alerts    — Legacy: anomaly alerts
 *
 * Unified /ws client messages (JSON):
 *   { "type": "subscribe", "channels": ["prices", "trades", "news", "alerts", "gas"] }
 *   { "type": "unsubscribe", "channels": ["news"] }
 *   { "type": "ping" }
 *
 * Unified /ws server messages:
 *   { "type": "price", "channel": "prices", "data": { ... }, "timestamp": "..." }
 *   { "type": "trade", "channel": "trades", "data": { ... }, "timestamp": "..." }
 *   { "type": "news", "channel": "news", "data": { ... }, "timestamp": "..." }
 *   { "type": "alert", "channel": "alerts", "data": { ... }, "timestamp": "..." }
 *   { "type": "gas", "channel": "gas", "data": { ... }, "timestamp": "..." }
 *   { "type": "market", "channel": "market", "data": { ... }, "timestamp": "..." }
 *   { "type": "anomaly", "channel": "anomaly", "data": { ... }, "timestamp": "..." }
 *   { "type": "pong" }
 *   { "type": "error", "message": "..." }
 *   { "type": "subscribed", "channels": [...] }
 *   { "type": "unsubscribed", "channels": [...] }
 */

import { Hono } from "hono";
import type { UpgradeWebSocket } from "hono/ws";
import {
  addClient,
  removeClient,
  updateClientCoins,
  wsStats,
  type Topic,
} from "@/lib/ws";
import { channelManager, type ClientInfo } from "@/lib/ws-channels";
import { logger } from "@/lib/logger";
import {
  wsConnectionsTotal,
  wsMessagesReceivedTotal,
  wsErrorsTotal,
} from "@/lib/metrics";

// ─── Message Types ───────────────────────────────────────────

interface ClientSubscribeMsg {
  type: "subscribe";
  channels: string[];
}

interface ClientUnsubscribeMsg {
  type: "unsubscribe";
  channels: string[];
}

interface ClientPingMsg {
  type: "ping";
}

interface ClientAuthMsg {
  type: "auth";
  apiKey: string;
}

type ClientMessage = ClientSubscribeMsg | ClientUnsubscribeMsg | ClientPingMsg | ClientAuthMsg;

function isValidClientMessage(msg: unknown): msg is ClientMessage {
  if (typeof msg !== "object" || msg === null) return false;
  const m = msg as Record<string, unknown>;
  if (typeof m.type !== "string") return false;
  if (m.type === "subscribe" || m.type === "unsubscribe") {
    return Array.isArray(m.channels) && m.channels.every((c: unknown) => typeof c === "string");
  }
  if (m.type === "ping") return true;
  if (m.type === "auth") return typeof m.apiKey === "string";
  return false;
}

// ─── Factory ─────────────────────────────────────────────────

export function createWsRoutes(upgradeWebSocket: UpgradeWebSocket) {
  const ws = new Hono();

  // ─── WS /ws — Unified channel-based WebSocket ───────────────

  ws.get(
    "/ws",
    upgradeWebSocket((c) => {
      const apiKey = c.req.query("apiKey") ?? null;
      let client: ClientInfo | null = null;

      return {
        onOpen(_evt, wsCtx) {
          client = channelManager.registerClient(wsCtx, { apiKey });

          if (!client) {
            wsCtx.send(JSON.stringify({
              type: "error",
              message: "Maximum connections reached",
            }));
            wsCtx.close(1013, "Maximum connections reached");
            return;
          }

          wsConnectionsTotal.inc();

          wsCtx.send(JSON.stringify({
            type: "connected",
            clientId: client.id,
            availableChannels: [
              "prices", "prices:{coinId}",
              "trades", "trades:{exchange}",
              "news", "gas", "alerts", "market", "anomaly",
            ],
            timestamp: new Date().toISOString(),
          }));

          // If API key provided via query param, auto-subscribe to "alerts"
          if (apiKey && client.authenticated) {
            const result = channelManager.subscribe(client.id, ["alerts"]);
            if (result.subscribed.length > 0) {
              wsCtx.send(JSON.stringify({
                type: "subscribed",
                channels: result.subscribed,
                timestamp: new Date().toISOString(),
              }));
            }
          }
        },

        onMessage(evt, wsCtx) {
          if (!client) return;

          // Rate limit check
          if (!channelManager.checkRateLimit(client.id)) {
            wsCtx.send(JSON.stringify({
              type: "error",
              message: "Rate limit exceeded (max 100 messages/min)",
            }));
            return;
          }

          const rawData = typeof evt.data === "string" ? evt.data : evt.data.toString();

          // Max message size check
          if (rawData.length > 64 * 1024) {
            wsCtx.send(JSON.stringify({
              type: "error",
              message: "Message too large (max 64KB)",
            }));
            return;
          }

          try {
            const msg: unknown = JSON.parse(rawData);

            if (!isValidClientMessage(msg)) {
              wsCtx.send(JSON.stringify({
                type: "error",
                message: "Invalid message format. Expected: { type: 'subscribe' | 'unsubscribe' | 'ping', channels?: string[] }",
              }));
              return;
            }

            wsMessagesReceivedTotal.inc({ type: msg.type });

            switch (msg.type) {
              case "subscribe": {
                const result = channelManager.subscribe(client.id, msg.channels);
                wsCtx.send(JSON.stringify({
                  type: "subscribed",
                  channels: result.subscribed,
                  errors: result.errors.length > 0 ? result.errors : undefined,
                  timestamp: new Date().toISOString(),
                }));
                break;
              }

              case "unsubscribe": {
                const unsubscribed = channelManager.unsubscribe(client.id, msg.channels);
                wsCtx.send(JSON.stringify({
                  type: "unsubscribed",
                  channels: unsubscribed,
                  timestamp: new Date().toISOString(),
                }));
                break;
              }

              case "ping": {
                channelManager.recordPong(client.id);
                wsCtx.send(JSON.stringify({ type: "pong" }));
                break;
              }

              case "auth": {
                const info = channelManager.getClient(client.id);
                if (info) {
                  info.authenticated = true;
                  info.apiKey = msg.apiKey;
                }
                wsCtx.send(JSON.stringify({
                  type: "authenticated",
                  timestamp: new Date().toISOString(),
                }));
                break;
              }
            }
          } catch {
            wsCtx.send(JSON.stringify({
              type: "error",
              message: "Invalid JSON",
            }));
          }
        },

        onClose() {
          if (client) {
            channelManager.disconnectClient(client.id);
            client = null;
          }
        },

        onError(evt) {
          wsErrorsTotal.inc();
          logger.error({ error: String(evt) }, "WS /ws error");
          if (client) {
            channelManager.disconnectClient(client.id);
            client = null;
          }
        },
      };
    })
  );

  // ─── WS /ws/prices (legacy) ─────────────────────────────────

  ws.get(
    "/ws/prices",
    upgradeWebSocket((c) => {
      const coinsParam = c.req.query("coins") || "bitcoin,ethereum";
      const coins = coinsParam.split(",").map((s) => s.trim()).filter(Boolean);

      let clientEntry: ReturnType<typeof addClient> | null = null;

      return {
        onOpen(_evt, wsCtx) {
          clientEntry = addClient("prices" as Topic, wsCtx, { coins });
          wsCtx.send(
            JSON.stringify({
              type: "subscribed",
              topic: "prices",
              coins,
              timestamp: new Date().toISOString(),
            })
          );
        },

        onMessage(evt, wsCtx) {
          try {
            const msg = JSON.parse(
              typeof evt.data === "string" ? evt.data : evt.data.toString()
            ) as { action?: string; coins?: string[] };

            if (msg.action === "subscribe" && Array.isArray(msg.coins)) {
              const newCoins = msg.coins.map((s) => s.trim()).filter(Boolean);
              if (clientEntry && newCoins.length > 0) {
                updateClientCoins(clientEntry, newCoins);
                wsCtx.send(
                  JSON.stringify({
                    type: "subscribed",
                    topic: "prices",
                    coins: newCoins,
                    timestamp: new Date().toISOString(),
                  })
                );
              }
            }
            // "pong" is just an ack — nothing to do
          } catch {
            // Ignore malformed messages
          }
        },

        onClose() {
          if (clientEntry) {
            removeClient("prices" as Topic, clientEntry);
            clientEntry = null;
          }
        },

        onError(evt) {
          logger.error({ error: String(evt) }, "WS /ws/prices error");
          if (clientEntry) {
            removeClient("prices" as Topic, clientEntry);
            clientEntry = null;
          }
        },
      };
    })
  );

  // ─── WS /ws/bitcoin (legacy) ────────────────────────────────

  ws.get(
    "/ws/bitcoin",
    upgradeWebSocket(() => {
      let clientEntry: ReturnType<typeof addClient> | null = null;

      return {
        onOpen(_evt, wsCtx) {
          clientEntry = addClient("bitcoin" as Topic, wsCtx);
          wsCtx.send(
            JSON.stringify({
              type: "subscribed",
              topic: "bitcoin",
              feeds: ["blocks", "large-transactions"],
              timestamp: new Date().toISOString(),
            })
          );
        },

        onMessage(evt, wsCtx) {
          try {
            const msg = JSON.parse(
              typeof evt.data === "string" ? evt.data : evt.data.toString()
            ) as { action?: string };

            if (msg.action === "pong") {
              // heartbeat ack
            }

            void wsCtx;
          } catch {
            // Ignore
          }
        },

        onClose() {
          if (clientEntry) {
            removeClient("bitcoin" as Topic, clientEntry);
            clientEntry = null;
          }
        },

        onError(evt) {
          logger.error({ error: String(evt) }, "WS /ws/bitcoin error");
          if (clientEntry) {
            removeClient("bitcoin" as Topic, clientEntry);
            clientEntry = null;
          }
        },
      };
    })
  );

  // ─── WS /ws/trades (legacy) ─────────────────────────────────

  ws.get(
    "/ws/trades",
    upgradeWebSocket(() => {
      let clientEntry: ReturnType<typeof addClient> | null = null;

      return {
        onOpen(_evt, wsCtx) {
          clientEntry = addClient("trades" as Topic, wsCtx);
          wsCtx.send(
            JSON.stringify({
              type: "subscribed",
              topic: "trades",
              source: "dexscreener",
              timestamp: new Date().toISOString(),
            })
          );
        },

        onMessage(evt, wsCtx) {
          try {
            const msg = JSON.parse(
              typeof evt.data === "string" ? evt.data : evt.data.toString()
            ) as { action?: string };

            if (msg.action === "pong") {
              // heartbeat ack
            }

            void wsCtx;
          } catch {
            // Ignore
          }
        },

        onClose() {
          if (clientEntry) {
            removeClient("trades" as Topic, clientEntry);
            clientEntry = null;
          }
        },

        onError(evt) {
          logger.error({ error: String(evt) }, "WS /ws/trades error");
          if (clientEntry) {
            removeClient("trades" as Topic, clientEntry);
            clientEntry = null;
          }
        },
      };
    })
  );

  // ─── WS /ws/alerts (legacy) ─────────────────────────────────

  ws.get(
    "/ws/alerts",
    upgradeWebSocket(() => {
      let clientEntry: ReturnType<typeof addClient> | null = null;

      return {
        onOpen(_evt, wsCtx) {
          clientEntry = addClient("alerts" as Topic, wsCtx);
          wsCtx.send(
            JSON.stringify({
              type: "subscribed",
              topic: "alerts",
              feeds: ["anomalies"],
              timestamp: new Date().toISOString(),
            })
          );
        },

        onMessage(evt, wsCtx) {
          try {
            const msg = JSON.parse(
              typeof evt.data === "string" ? evt.data : evt.data.toString()
            ) as { action?: string };

            if (msg.action === "pong") {
              // heartbeat ack
            }

            void wsCtx;
          } catch {
            // Ignore
          }
        },

        onClose() {
          if (clientEntry) {
            removeClient("alerts" as Topic, clientEntry);
            clientEntry = null;
          }
        },

        onError(evt) {
          logger.error({ error: String(evt) }, "WS /ws/alerts error");
          if (clientEntry) {
            removeClient("alerts" as Topic, clientEntry);
            clientEntry = null;
          }
        },
      };
    })
  );

  // ─── REST: WS stats endpoint ─────────────────────────────────

  ws.get("/ws/status", (c) =>
    c.json({
      status: "ok",
      ...wsStats(),
      channelManager: {
        activeConnections: channelManager.getActiveConnections(),
        subscriptions: channelManager.getSubscriptionCounts(),
      },
    })
  );

  return ws;
}
