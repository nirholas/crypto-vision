/**
 * Crypto Vision — WebSocket Routes
 *
 * WS /ws/prices  — Real-time price ticks (subscribe by coin IDs)
 * WS /ws/bitcoin — New blocks and large Bitcoin transactions
 * WS /ws/trades  — DEX trade / boost feed (via DexScreener)
 *
 * Client messages (JSON):
 *   { "action": "subscribe", "coins": ["bitcoin","ethereum"] }
 *   { "action": "pong" }   // heartbeat response
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
import { logger } from "@/lib/logger";

// ─── Factory ─────────────────────────────────────────────────

export function createWsRoutes(upgradeWebSocket: UpgradeWebSocket) {
  const ws = new Hono();

  // ─── WS /ws/prices ──────────────────────────────────────────

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

  // ─── WS /ws/bitcoin ─────────────────────────────────────────

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

            // Could add subscription filters in the future
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

  // ─── WS /ws/trades ──────────────────────────────────────────

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

  // ─── REST: WS stats endpoint ─────────────────────────────────

  ws.get("/ws/status", (c) => c.json({ status: "ok", ...wsStats() }));

  return ws;
}
