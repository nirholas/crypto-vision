/**
 * Crypto Vision — WebSocket Manager
 *
 * Manages upstream WebSocket connections (CoinCap, Mempool.space, DexScreener)
 * and fans out real-time data to connected clients.
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Heartbeat / ping-pong keep-alive
 * - Per-topic client subscription management
 * - Graceful shutdown
 */

import WebSocket from "ws";
import { logger } from "@/lib/logger";
import type { WSContext } from "hono/ws";

// ─── Types ───────────────────────────────────────────────────

export type Topic = "prices" | "bitcoin" | "trades";

export interface PriceTick {
  type: "price";
  data: Record<string, string>;
  timestamp: string;
}

export interface BitcoinBlock {
  type: "block";
  data: {
    height: number;
    hash: string;
    timestamp: number;
    size: number;
    txCount: number;
  };
  timestamp: string;
}

export interface BitcoinTx {
  type: "transaction";
  data: {
    txid: string;
    value: number;
    fee: number;
  };
  timestamp: string;
}

export interface DexTrade {
  type: "trade";
  data: {
    pair: string;
    price: string;
    volume: string;
    side: string;
    chain: string;
    dex: string;
    timestamp: number;
  };
  timestamp: string;
}

// ─── Client Registry ────────────────────────────────────────

interface ClientEntry {
  ws: WSContext;
  subscribedCoins?: Set<string>; // for prices topic
}

const clients = new Map<Topic, Set<ClientEntry>>();
clients.set("prices", new Set());
clients.set("bitcoin", new Set());
clients.set("trades", new Set());

export function addClient(
  topic: Topic,
  ws: WSContext,
  options?: { coins?: string[] }
): ClientEntry {
  const entry: ClientEntry = { ws };
  if (topic === "prices" && options?.coins?.length) {
    entry.subscribedCoins = new Set(options.coins);
  }
  clients.get(topic)!.add(entry);
  logger.info({ topic, clients: clients.get(topic)!.size }, "WS client added");
  return entry;
}

export function removeClient(topic: Topic, entry: ClientEntry): void {
  clients.get(topic)!.delete(entry);
  logger.info(
    { topic, clients: clients.get(topic)!.size },
    "WS client removed"
  );
  // If no more price clients, consider pausing upstream
  rebuildPriceSubscription();
}

export function updateClientCoins(
  entry: ClientEntry,
  coins: string[]
): void {
  entry.subscribedCoins = new Set(coins);
  rebuildPriceSubscription();
}

function broadcast(topic: Topic, message: string): void {
  const topicClients = clients.get(topic);
  if (!topicClients) return;

  for (const entry of topicClients) {
    try {
      if (entry.ws.readyState === 1) {
        // Filter prices to only subscribed coins
        if (topic === "prices" && entry.subscribedCoins) {
          const parsed = JSON.parse(message) as PriceTick;
          const filtered: Record<string, string> = {};
          let hasData = false;
          for (const [coin, price] of Object.entries(parsed.data)) {
            if (entry.subscribedCoins.has(coin)) {
              filtered[coin] = price;
              hasData = true;
            }
          }
          if (hasData) {
            entry.ws.send(
              JSON.stringify({ type: "price", data: filtered, timestamp: parsed.timestamp })
            );
          }
        } else {
          entry.ws.send(message);
        }
      }
    } catch {
      // Client gone, will be cleaned up
    }
  }
}

// ─── Upstream: CoinCap Prices ────────────────────────────────

const COINCAP_WS_URL = "wss://ws.coincap.io/prices";
const DEFAULT_COINS = [
  "bitcoin",
  "ethereum",
  "solana",
  "cardano",
  "dogecoin",
  "polkadot",
  "avalanche-2",
  "chainlink",
  "polygon",
  "tron",
];

let coinCapWs: WebSocket | null = null;
let coinCapReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let coinCapReconnectAttempts = 0;
let currentCoinCapAssets: string[] = [];

function getAllSubscribedCoins(): string[] {
  const coins = new Set<string>(DEFAULT_COINS);
  const priceClients = clients.get("prices");
  if (priceClients) {
    for (const entry of priceClients) {
      if (entry.subscribedCoins) {
        for (const coin of entry.subscribedCoins) {
          coins.add(coin);
        }
      }
    }
  }
  return [...coins];
}

function rebuildPriceSubscription(): void {
  const newAssets = getAllSubscribedCoins();
  const sorted = [...newAssets].sort().join(",");
  const currentSorted = [...currentCoinCapAssets].sort().join(",");

  if (sorted !== currentSorted && clients.get("prices")!.size > 0) {
    logger.info({ assets: newAssets.length }, "Rebuilding CoinCap subscription");
    disconnectCoinCap();
    connectCoinCap(newAssets);
  }
}

function connectCoinCap(assets?: string[]): void {
  if (coinCapWs?.readyState === WebSocket.OPEN) return;

  const assetList = assets ?? getAllSubscribedCoins();
  currentCoinCapAssets = assetList;
  const url = `${COINCAP_WS_URL}?assets=${assetList.join(",")}`;

  logger.info({ url: url.slice(0, 100), assets: assetList.length }, "Connecting to CoinCap WS");

  coinCapWs = new WebSocket(url);

  coinCapWs.on("open", () => {
    logger.info("CoinCap WS connected");
    coinCapReconnectAttempts = 0;
  });

  coinCapWs.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString()) as Record<string, string>;
      const message: PriceTick = {
        type: "price",
        data,
        timestamp: new Date().toISOString(),
      };
      broadcast("prices", JSON.stringify(message));
    } catch {
      // Ignore malformed messages
    }
  });

  coinCapWs.on("close", () => {
    logger.warn("CoinCap WS disconnected");
    scheduleReconnect("coincap");
  });

  coinCapWs.on("error", (err) => {
    logger.error({ err: (err as Error).message }, "CoinCap WS error");
  });
}

function disconnectCoinCap(): void {
  if (coinCapReconnectTimer) {
    clearTimeout(coinCapReconnectTimer);
    coinCapReconnectTimer = null;
  }
  if (coinCapWs) {
    coinCapWs.removeAllListeners();
    if (
      coinCapWs.readyState === WebSocket.OPEN ||
      coinCapWs.readyState === WebSocket.CONNECTING
    ) {
      coinCapWs.close();
    }
    coinCapWs = null;
  }
}

// ─── Upstream: Mempool.space Bitcoin ─────────────────────────

const MEMPOOL_WS_URL = "wss://mempool.space/api/v1/ws";
const LARGE_TX_THRESHOLD_BTC = 10; // broadcast txs >= 10 BTC

let mempoolWs: WebSocket | null = null;
let mempoolReconnectTimer: ReturnType<typeof setTimeout> | null = null;
let mempoolReconnectAttempts = 0;
let mempoolPingTimer: ReturnType<typeof setInterval> | null = null;

function connectMempool(): void {
  if (mempoolWs?.readyState === WebSocket.OPEN) return;

  logger.info("Connecting to Mempool.space WS");

  mempoolWs = new WebSocket(MEMPOOL_WS_URL);

  mempoolWs.on("open", () => {
    logger.info("Mempool.space WS connected");
    mempoolReconnectAttempts = 0;

    // Subscribe to blocks and mempool
    mempoolWs!.send(JSON.stringify({ action: "want", data: ["blocks", "mempool-blocks"] }));

    // Start heartbeat ping
    mempoolPingTimer = setInterval(() => {
      if (mempoolWs?.readyState === WebSocket.OPEN) {
        mempoolWs.ping();
      }
    }, 30_000);
  });

  mempoolWs.on("message", (raw) => {
    try {
      const data = JSON.parse(raw.toString());

      // New block
      if (data.block) {
        const block = data.block;
        const message: BitcoinBlock = {
          type: "block",
          data: {
            height: block.height,
            hash: block.id,
            timestamp: block.timestamp,
            size: block.size,
            txCount: block.tx_count,
          },
          timestamp: new Date().toISOString(),
        };
        broadcast("bitcoin", JSON.stringify(message));
      }

      // Large transactions from mempool blocks
      if (data.transactions) {
        for (const tx of data.transactions as Array<{ txid: string; value: number; fee: number }>) {
          const valueBtc = tx.value / 1e8;
          if (valueBtc >= LARGE_TX_THRESHOLD_BTC) {
            const message: BitcoinTx = {
              type: "transaction",
              data: {
                txid: tx.txid,
                value: valueBtc,
                fee: tx.fee,
              },
              timestamp: new Date().toISOString(),
            };
            broadcast("bitcoin", JSON.stringify(message));
          }
        }
      }
    } catch {
      // Ignore malformed messages
    }
  });

  mempoolWs.on("close", () => {
    logger.warn("Mempool.space WS disconnected");
    clearMempoolPing();
    scheduleReconnect("mempool");
  });

  mempoolWs.on("error", (err) => {
    logger.error({ err: (err as Error).message }, "Mempool.space WS error");
  });
}

function clearMempoolPing(): void {
  if (mempoolPingTimer) {
    clearInterval(mempoolPingTimer);
    mempoolPingTimer = null;
  }
}

function disconnectMempool(): void {
  clearMempoolPing();
  if (mempoolReconnectTimer) {
    clearTimeout(mempoolReconnectTimer);
    mempoolReconnectTimer = null;
  }
  if (mempoolWs) {
    mempoolWs.removeAllListeners();
    if (
      mempoolWs.readyState === WebSocket.OPEN ||
      mempoolWs.readyState === WebSocket.CONNECTING
    ) {
      mempoolWs.close();
    }
    mempoolWs = null;
  }
}

// ─── Upstream: DEX Trades (DexScreener polling) ──────────────

// DexScreener doesn't provide a public WS API, so we simulate a
// trade feed by polling their latest-boosted endpoint at short
// intervals and emitting new entries as "trades".

let dexPollTimer: ReturnType<typeof setInterval> | null = null;
const DEX_POLL_INTERVAL_MS = 10_000;
const seenDexPairs = new Set<string>();

async function pollDexTrades(): Promise<void> {
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/latest/v1");
    if (!res.ok) return;

    const boosts = (await res.json()) as Array<{
      tokenAddress: string;
      chainId: string;
      description?: string;
      url?: string;
    }>;

    for (const boost of boosts.slice(0, 20)) {
      const key = `${boost.chainId}:${boost.tokenAddress}`;
      if (seenDexPairs.has(key)) continue;
      seenDexPairs.add(key);

      // Keep set bounded
      if (seenDexPairs.size > 1000) {
        const first = seenDexPairs.values().next().value!;
        seenDexPairs.delete(first);
      }

      const message: DexTrade = {
        type: "trade",
        data: {
          pair: boost.tokenAddress,
          price: "0",
          volume: "0",
          side: "boost",
          chain: boost.chainId,
          dex: "dexscreener",
          timestamp: Date.now(),
        },
        timestamp: new Date().toISOString(),
      };
      broadcast("trades", JSON.stringify(message));
    }
  } catch {
    // Silently ignore polling errors
  }
}

function startDexPolling(): void {
  if (dexPollTimer) return;
  pollDexTrades();
  dexPollTimer = setInterval(pollDexTrades, DEX_POLL_INTERVAL_MS);
}

function stopDexPolling(): void {
  if (dexPollTimer) {
    clearInterval(dexPollTimer);
    dexPollTimer = null;
  }
}

// ─── Reconnection with Exponential Backoff ───────────────────

const MAX_RECONNECT_DELAY_MS = 60_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

function scheduleReconnect(source: "coincap" | "mempool"): void {
  const attempts =
    source === "coincap" ? coinCapReconnectAttempts++ : mempoolReconnectAttempts++;
  const delay = Math.min(
    BASE_RECONNECT_DELAY_MS * 2 ** attempts,
    MAX_RECONNECT_DELAY_MS
  );

  logger.info({ source, delay, attempt: attempts + 1 }, "Scheduling WS reconnect");

  const timer = setTimeout(() => {
    if (source === "coincap") {
      connectCoinCap();
    } else {
      connectMempool();
    }
  }, delay);

  if (source === "coincap") {
    coinCapReconnectTimer = timer;
  } else {
    mempoolReconnectTimer = timer;
  }
}

// ─── Heartbeat — client-side ping/pong ───────────────────────

const HEARTBEAT_INTERVAL_MS = 30_000;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(): void {
  if (heartbeatTimer) return;
  heartbeatTimer = setInterval(() => {
    const now = JSON.stringify({ type: "ping", timestamp: new Date().toISOString() });
    for (const [, topicClients] of clients) {
      for (const entry of topicClients) {
        try {
          if (entry.ws.readyState === 1) {
            entry.ws.send(now);
          }
        } catch {
          // Will be cleaned up by close handler
        }
      }
    }
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────

export function startUpstreams(): void {
  logger.info("Starting WebSocket upstream connections");
  connectCoinCap();
  connectMempool();
  startDexPolling();
  startHeartbeat();
}

export function stopUpstreams(): void {
  logger.info("Stopping WebSocket upstream connections");
  stopHeartbeat();
  disconnectCoinCap();
  disconnectMempool();
  stopDexPolling();

  // Close all client connections
  for (const [, topicClients] of clients) {
    for (const entry of topicClients) {
      try {
        entry.ws.close(1001, "Server shutting down");
      } catch {
        // best-effort
      }
    }
    topicClients.clear();
  }
}

export function wsStats(): {
  clients: Record<Topic, number>;
  upstreams: {
    coinCap: string;
    mempool: string;
    dexPolling: boolean;
  };
} {
  return {
    clients: {
      prices: clients.get("prices")!.size,
      bitcoin: clients.get("bitcoin")!.size,
      trades: clients.get("trades")!.size,
    },
    upstreams: {
      coinCap: coinCapWs
        ? ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][coinCapWs.readyState]
        : "DISCONNECTED",
      mempool: mempoolWs
        ? ["CONNECTING", "OPEN", "CLOSING", "CLOSED"][mempoolWs.readyState]
        : "DISCONNECTED",
      dexPolling: dexPollTimer !== null,
    },
  };
}
