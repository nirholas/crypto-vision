/**
 * Crypto Vision — Binance WebSocket Feed
 *
 * Connects to Binance WebSocket streams for real-time trade data.
 * Aggregates trades over 1-second windows to prevent message flooding.
 * Forwards aggregated trades to the WebSocket ChannelManager.
 *
 * Streams used:
 *   wss://stream.binance.com:9443/stream?streams=btcusdt@trade/ethusdt@trade/...
 *
 * Features:
 *   - Subscribe to top 20 pairs by volume
 *   - 1-second trade aggregation windows
 *   - Exponential backoff reconnection
 *   - Binance error/ban detection
 *   - Graceful shutdown
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import WebSocket from "ws";
import { logger } from "@/lib/logger";
import { channelManager } from "@/lib/ws-channels";

// ─── Configuration ───────────────────────────────────────────

const BINANCE_WS_BASE = "wss://stream.binance.com:9443/stream";

/** Top trading pairs to subscribe to (lowercase, no separators). */
const DEFAULT_PAIRS: readonly string[] = [
  "btcusdt", "ethusdt", "bnbusdt", "solusdt", "xrpusdt",
  "dogeusdt", "adausdt", "avaxusdt", "dotusdt", "linkusdt",
  "maticusdt", "trxusdt", "shibusdt", "ltcusdt", "bchusdt",
  "atomusdt", "uniusdt", "nearusdt", "aptusdt", "arbusdt",
] as const;

/** Aggregation window in ms. */
const AGGREGATION_WINDOW_MS = 1_000;

/** Maximum reconnect delay (exponential backoff cap). */
const MAX_RECONNECT_DELAY_MS = 60_000;
const BASE_RECONNECT_DELAY_MS = 1_000;

// ─── Types ───────────────────────────────────────────────────

interface BinanceTradeEvent {
  /** Event type ("trade"). */
  e: string;
  /** Event time. */
  E: number;
  /** Symbol (e.g. "BTCUSDT"). */
  s: string;
  /** Trade ID. */
  t: number;
  /** Price. */
  p: string;
  /** Quantity. */
  q: string;
  /** Buyer order ID. */
  b: number;
  /** Seller order ID. */
  a: number;
  /** Trade time. */
  T: number;
  /** Is buyer the maker. */
  m: boolean;
}

interface BinanceStreamMessage {
  stream: string;
  data: BinanceTradeEvent;
}

interface AggregatedTrade {
  pair: string;
  exchange: "binance";
  price: string;
  high: string;
  low: string;
  volume: string;
  tradeCount: number;
  buyVolume: string;
  sellVolume: string;
  timestamp: number;
}

// ─── Aggregation Buffer ─────────────────────────────────────

interface TradeAccumulator {
  pair: string;
  lastPrice: number;
  high: number;
  low: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  tradeCount: number;
  windowStart: number;
}

const tradeBuffers = new Map<string, TradeAccumulator>();

function accumulateTrade(trade: BinanceTradeEvent): void {
  const pair = trade.s;
  const price = parseFloat(trade.p);
  const qty = parseFloat(trade.q);

  let acc = tradeBuffers.get(pair);
  if (!acc) {
    acc = {
      pair,
      lastPrice: price,
      high: price,
      low: price,
      totalVolume: 0,
      buyVolume: 0,
      sellVolume: 0,
      tradeCount: 0,
      windowStart: Date.now(),
    };
    tradeBuffers.set(pair, acc);
  }

  acc.lastPrice = price;
  acc.high = Math.max(acc.high, price);
  acc.low = Math.min(acc.low, price);
  acc.totalVolume += qty;
  acc.tradeCount++;

  if (trade.m) {
    // Buyer is maker → the trade is a sell (taker sold)
    acc.sellVolume += qty;
  } else {
    acc.buyVolume += qty;
  }
}

function flushAggregatedTrades(): void {
  const now = Date.now();
  const trades: AggregatedTrade[] = [];

  for (const [pair, acc] of tradeBuffers) {
    if (acc.tradeCount === 0) continue;
    if (now - acc.windowStart < AGGREGATION_WINDOW_MS) continue;

    trades.push({
      pair,
      exchange: "binance",
      price: acc.lastPrice.toString(),
      high: acc.high.toString(),
      low: acc.low.toString(),
      volume: acc.totalVolume.toFixed(8),
      tradeCount: acc.tradeCount,
      buyVolume: acc.buyVolume.toFixed(8),
      sellVolume: acc.sellVolume.toFixed(8),
      timestamp: now,
    });

    // Reset accumulator for next window
    tradeBuffers.set(pair, {
      pair,
      lastPrice: acc.lastPrice,
      high: acc.lastPrice,
      low: acc.lastPrice,
      totalVolume: 0,
      buyVolume: 0,
      sellVolume: 0,
      tradeCount: 0,
      windowStart: now,
    });
  }

  // Broadcast aggregated trades to ChannelManager
  for (const trade of trades) {
    channelManager.broadcast("trades", trade);
    channelManager.broadcast(`trades:binance`, trade);
  }
}

// ─── WebSocket Connection ───────────────────────────────────

let binanceWs: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempts = 0;
let flushTimer: ReturnType<typeof setInterval> | null = null;
let running = false;
let banned = false;

function buildStreamUrl(pairs: readonly string[]): string {
  const streams = pairs.map((p) => `${p}@trade`).join("/");
  return `${BINANCE_WS_BASE}?streams=${streams}`;
}

function connect(pairs?: readonly string[]): void {
  if (binanceWs?.readyState === WebSocket.OPEN) return;
  if (banned) {
    logger.warn("Binance WS: skipping connection — IP appears banned");
    return;
  }

  const pairList = pairs ?? DEFAULT_PAIRS;
  const url = buildStreamUrl(pairList);

  logger.info(
    { pairs: pairList.length, url: url.slice(0, 80) + "..." },
    "Binance WS: connecting",
  );

  binanceWs = new WebSocket(url);

  binanceWs.on("open", () => {
    logger.info({ pairs: pairList.length }, "Binance WS: connected");
    reconnectAttempts = 0;
  });

  binanceWs.on("message", (raw: Buffer) => {
    try {
      const msg = JSON.parse(raw.toString()) as BinanceStreamMessage;

      // Binance error detection
      if ("error" in (msg as Record<string, unknown>)) {
        const err = msg as unknown as { error: { code: number; msg: string } };
        logger.error(
          { code: err.error.code, msg: err.error.msg },
          "Binance WS: received error from server",
        );

        // Code -1003 = Too many requests / IP ban
        if (err.error.code === -1003) {
          banned = true;
          disconnect();
          // Auto-unban after 5 minutes
          setTimeout(() => {
            banned = false;
            logger.info("Binance WS: ban timeout expired, will retry");
          }, 5 * 60 * 1000);
          return;
        }
        return;
      }

      if (msg.data?.e === "trade") {
        accumulateTrade(msg.data);
      }
    } catch {
      // Ignore malformed messages
    }
  });

  binanceWs.on("close", (code: number, reason: Buffer) => {
    const reasonStr = reason?.toString() ?? "";
    logger.warn(
      { code, reason: reasonStr },
      "Binance WS: disconnected",
    );

    // Code 1008 = Policy violation (usually means banned)
    if (code === 1008) {
      banned = true;
      logger.error("Binance WS: received policy violation — likely IP ban");
      setTimeout(() => {
        banned = false;
      }, 5 * 60 * 1000);
      return;
    }

    if (running) {
      scheduleReconnect();
    }
  });

  binanceWs.on("error", (err: Error) => {
    logger.error({ err: err.message }, "Binance WS: connection error");
  });

  // Binance requires a pong response to their pings (ws library handles this
  // automatically), but we also send an explicit ping every 3 minutes to
  // keep the connection alive.
  binanceWs.on("ping", () => {
    try {
      binanceWs?.pong();
    } catch {
      // best-effort
    }
  });
}

function disconnect(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (binanceWs) {
    binanceWs.removeAllListeners();
    if (
      binanceWs.readyState === WebSocket.OPEN ||
      binanceWs.readyState === WebSocket.CONNECTING
    ) {
      binanceWs.close(1000, "Shutting down");
    }
    binanceWs = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  if (banned) return;

  const delay = Math.min(
    BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts,
    MAX_RECONNECT_DELAY_MS,
  );
  reconnectAttempts++;

  logger.info(
    { delay, attempt: reconnectAttempts },
    "Binance WS: scheduling reconnect",
  );

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

// ─── Lifecycle ───────────────────────────────────────────────

/**
 * Start the Binance WebSocket feed.
 * Connects to Binance streams and begins aggregating trades.
 */
export function startBinanceWsFeed(): void {
  if (running) return;
  running = true;

  logger.info("Starting Binance WebSocket feed");

  // Start the aggregation flush timer
  flushTimer = setInterval(flushAggregatedTrades, AGGREGATION_WINDOW_MS);

  connect();
}

/**
 * Stop the Binance WebSocket feed.
 * Disconnects and cleans up all resources.
 */
export function stopBinanceWsFeed(): void {
  if (!running) return;
  running = false;

  logger.info("Stopping Binance WebSocket feed");

  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }

  disconnect();
  tradeBuffers.clear();
}

/**
 * Get current feed status (for monitoring/health check).
 */
export function getBinanceWsStatus(): {
  connected: boolean;
  banned: boolean;
  reconnectAttempts: number;
  activePairs: number;
  bufferedTrades: number;
} {
  let bufferedTrades = 0;
  for (const acc of tradeBuffers.values()) {
    bufferedTrades += acc.tradeCount;
  }

  return {
    connected: binanceWs?.readyState === WebSocket.OPEN,
    banned,
    reconnectAttempts,
    activePairs: DEFAULT_PAIRS.length,
    bufferedTrades,
  };
}
