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
 * - Per-coin price throttling (5 Hz) — inspired by Pump.fun's approach
 *   to prevent overwhelming clients with high-frequency ticks
 */

import WebSocket from "ws";
import { logger } from "@/lib/logger";
import { getRedis, getRedisSubscriber } from "@/lib/redis";
import type { WSContext } from "hono/ws";

// ─── Broadcast Throttling ────────────────────────────────────
// CoinCap can emit hundreds of ticks/second across all coins.
// We throttle to PRICE_THROTTLE_HZ per coin so downstream clients
// (especially mobile) don't burn CPU re-rendering at invisible rates.
// Ref: https://medium.com/@pumpfun — "How we 10x improved our React Native app startup time"

const PRICE_THROTTLE_HZ = 5;
const PRICE_THROTTLE_INTERVAL_MS = 1000 / PRICE_THROTTLE_HZ; // 200ms

/** Accumulated latest price per coin, flushed at PRICE_THROTTLE_HZ */
const pendingPrices = new Map<string, string>();
let priceFlushTimer: ReturnType<typeof setInterval> | null = null;

function startPriceThrottle(): void {
  if (priceFlushTimer) return;
  priceFlushTimer = setInterval(() => {
    if (pendingPrices.size === 0) return;

    const batch: Record<string, string> = {};
    for (const [coin, price] of pendingPrices) {
      batch[coin] = price;
    }
    pendingPrices.clear();

    const message: PriceTick = {
      type: "price",
      data: batch,
      timestamp: new Date().toISOString(),
    };
    broadcastRaw("prices", JSON.stringify(message));
  }, PRICE_THROTTLE_INTERVAL_MS);
}

function stopPriceThrottle(): void {
  if (priceFlushTimer) {
    clearInterval(priceFlushTimer);
    priceFlushTimer = null;
  }
  pendingPrices.clear();
}

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

/**
 * Enqueue price ticks into the throttle buffer instead of broadcasting
 * immediately. For non-price topics, broadcast directly.
 * If this instance is the leader, also publish to Redis Pub/Sub.
 */
function broadcast(topic: Topic, message: string): void {
  // Leader publishes to Redis for cross-instance fan-out
  if (isLeader) {
    void publishToChannel(topic, message);
  }

  if (topic === "prices") {
    // Accumulate into throttle buffer — latest value wins per coin
    try {
      const parsed = JSON.parse(message) as PriceTick;
      for (const [coin, price] of Object.entries(parsed.data)) {
        pendingPrices.set(coin, price);
      }
    } catch {
      // Ignore malformed price messages
    }
    return;
  }
  broadcastRaw(topic, message);
}

/**
 * Send a message to all clients subscribed to a topic.
 * Price messages are filtered to only include coins each client subscribed to.
 */
function broadcastRaw(topic: Topic, message: string): void {
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

// ─── Redis Pub/Sub for Cross-Instance Fan-Out ───────────────
//
// At scale (100+ Cloud Run instances), only ONE instance should connect
// to upstream WebSockets (the "leader"). The leader publishes messages
// to Redis Pub/Sub channels, and all instances subscribe to fan out to
// their local clients.
//
// Leader election: SET NX with TTL. Leader renews lease every 10s.
// If leader dies, another instance claims leadership within 30s.

const LEADER_KEY = "cv:ws:leader";
const LEADER_TTL_S = 30;
const LEADER_RENEW_MS = 10_000;
const INSTANCE_ID = `${process.pid}-${Date.now().toString(36)}`;

const PUBSUB_CHANNELS = {
  prices: "cv:ws:ch:prices",
  bitcoin: "cv:ws:ch:bitcoin",
  trades: "cv:ws:ch:trades",
} as const;

let isLeader = false;
let leaderRenewTimer: ReturnType<typeof setInterval> | null = null;

async function tryAcquireLeadership(): Promise<boolean> {
  const r = await getRedis();
  if (!r) {
    // No Redis → every instance is its own leader (single-instance mode)
    isLeader = true;
    return true;
  }
  try {
    const result = await r.set(LEADER_KEY, INSTANCE_ID, "EX", LEADER_TTL_S, "NX");
    if (result === "OK") {
      isLeader = true;
      logger.info({ instanceId: INSTANCE_ID }, "WS leader elected");
      return true;
    }
    // Check if we already hold the lease (e.g., after reconnect)
    const current = await r.get(LEADER_KEY);
    if (current === INSTANCE_ID) {
      isLeader = true;
      return true;
    }
    isLeader = false;
    return false;
  } catch {
    // Redis error → assume leader for resilience
    isLeader = true;
    return true;
  }
}

async function renewLeadership(): Promise<void> {
  if (!isLeader) return;
  const r = await getRedis();
  if (!r) return;
  try {
    const current = await r.get(LEADER_KEY);
    if (current === INSTANCE_ID) {
      await r.expire(LEADER_KEY, LEADER_TTL_S);
    } else {
      // Lost leadership
      logger.warn("Lost WS leader lease — stopping upstreams");
      isLeader = false;
      disconnectCoinCap();
      disconnectMempool();
      stopDexPolling();
    }
  } catch {
    // Best effort
  }
}

function startLeaderRenewal(): void {
  if (leaderRenewTimer) return;
  leaderRenewTimer = setInterval(renewLeadership, LEADER_RENEW_MS);
}

function stopLeaderRenewal(): void {
  if (leaderRenewTimer) {
    clearInterval(leaderRenewTimer);
    leaderRenewTimer = null;
  }
}

/** Publish a message to a Redis Pub/Sub channel (leader only). */
async function publishToChannel(topic: Topic, message: string): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  try {
    await r.publish(PUBSUB_CHANNELS[topic], message);
  } catch {
    // Best effort — local broadcast still works
  }
}

/** Subscribe to Redis Pub/Sub channels and fan out to local clients. */
async function subscribeToChannels(): Promise<void> {
  const sub = await getRedisSubscriber();
  if (!sub) return;

  try {
    await sub.subscribe(
      PUBSUB_CHANNELS.prices,
      PUBSUB_CHANNELS.bitcoin,
      PUBSUB_CHANNELS.trades,
    );

    sub.on("message", (channel: string, message: string) => {
      // Find which topic this channel maps to
      for (const [topic, ch] of Object.entries(PUBSUB_CHANNELS)) {
        if (ch === channel) {
          if (topic === "prices") {
            // Feed into throttle buffer
            try {
              const parsed = JSON.parse(message) as PriceTick;
              for (const [coin, price] of Object.entries(parsed.data)) {
                pendingPrices.set(coin, price);
              }
            } catch { /* ignore malformed */ }
          } else {
            broadcastRaw(topic as Topic, message);
          }
          break;
        }
      }
    });

    logger.info("WS: subscribed to Redis Pub/Sub channels");
  } catch (err) {
    logger.warn({ err }, "WS: failed to subscribe to Redis Pub/Sub");
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

export async function startUpstreams(): Promise<void> {
  logger.info("Starting WebSocket subsystem");

  // All instances subscribe to Pub/Sub for fan-out
  await subscribeToChannels();
  startPriceThrottle();
  startHeartbeat();

  // Only the leader connects to upstream WebSockets
  const elected = await tryAcquireLeadership();
  if (elected) {
    logger.info("This instance is the WS leader — connecting to upstreams");
    connectCoinCap();
    connectMempool();
    startDexPolling();
    startLeaderRenewal();
  } else {
    logger.info("This instance is a WS follower — relying on Pub/Sub fan-out");
    // Periodically try to become leader (in case current leader dies)
    setInterval(async () => {
      if (!isLeader) {
        const elected = await tryAcquireLeadership();
        if (elected) {
          logger.info("Promoted to WS leader — connecting to upstreams");
          connectCoinCap();
          connectMempool();
          startDexPolling();
          startLeaderRenewal();
        }
      }
    }, LEADER_TTL_S * 1000);
  }
}

export async function stopUpstreams(): Promise<void> {
  logger.info("Stopping WebSocket subsystem");
  stopHeartbeat();
  stopPriceThrottle();
  stopLeaderRenewal();
  disconnectCoinCap();
  disconnectMempool();
  stopDexPolling();

  // Release leadership
  if (isLeader) {
    const r = await getRedis();
    if (r) {
      try {
        const current = await r.get(LEADER_KEY);
        if (current === INSTANCE_ID) {
          await r.del(LEADER_KEY);
        }
      } catch { /* best-effort */ }
    }
    isLeader = false;
  }

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
  leader: boolean;
  instanceId: string;
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
    leader: isLeader,
    instanceId: INSTANCE_ID,
  };
}
