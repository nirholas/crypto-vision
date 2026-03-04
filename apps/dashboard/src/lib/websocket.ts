/**
 * Crypto Vision — Dashboard WebSocket Client
 *
 * Full-featured WebSocket client for the dashboard that connects
 * to the unified /ws endpoint on the backend.
 *
 * Features:
 *   - Auto-connect on creation
 *   - Auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
 *   - Channel subscribe/unsubscribe
 *   - Connection status events (connected, disconnected, reconnecting)
 *   - Message parsing with type safety
 *   - Heartbeat handling (respond to pings automatically)
 *   - Buffer messages during reconnection, replay after reconnect
 *
 * Usage:
 *   const ws = createWebSocketClient('ws://localhost:8080/ws');
 *   ws.subscribe(['prices', 'news']);
 *   ws.on('price', (data) => { ... });
 *   ws.on('connectionChange', (status) => { ... });
 *   ws.close();
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

// ─── Types ───────────────────────────────────────────────────

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "reconnecting";

export interface PriceData {
  [coinId: string]: {
    usd: number;
    change24h: number;
  };
}

export interface TradeData {
  pair: string;
  exchange: string;
  price: string;
  volume: string;
  chain?: string;
  dex?: string;
  source?: string;
  timestamp?: number;
}

export interface NewsData {
  title: string;
  description?: string;
  url: string;
  source: string;
  publishedAt?: string;
}

export interface AlertData {
  coinId: string;
  type: string;
  value: number;
  message?: string;
}

export interface GasData {
  [chain: string]: {
    low: number;
    average: number;
    high: number;
  };
}

export interface MarketData {
  event: string;
  movers?: Array<{
    coinId: string;
    symbol: string;
    name: string;
    price: number;
    change24h: number;
  }>;
}

export interface AnomalyData {
  coinId: string;
  type: string;
  severity: string;
  message: string;
}

export interface ServerMessage {
  type: string;
  channel?: string;
  data?: unknown;
  timestamp?: string;
  channels?: string[];
  errors?: string[];
  message?: string;
  clientId?: string;
  availableChannels?: string[];
}

/** Event handler types for the WS client. */
export interface WebSocketEventMap {
  price: PriceData;
  trade: TradeData;
  news: NewsData;
  alert: AlertData;
  gas: GasData;
  market: MarketData;
  anomaly: AnomalyData;
  connected: { clientId: string; availableChannels: string[] };
  subscribed: { channels: string[]; errors?: string[] };
  unsubscribed: { channels: string[] };
  connectionChange: ConnectionStatus;
  error: string;
  raw: ServerMessage;
}

type EventHandler<T> = (data: T) => void;

// ─── Buffered Subscription ──────────────────────────────────

interface PendingSubscription {
  type: "subscribe" | "unsubscribe";
  channels: string[];
}

// ─── WebSocket Client ───────────────────────────────────────

export interface CryptoWebSocketClient {
  /** Subscribe to one or more channels. */
  subscribe(channels: string[]): void;
  /** Unsubscribe from one or more channels. */
  unsubscribe(channels: string[]): void;
  /** Add an event listener. */
  on<K extends keyof WebSocketEventMap>(event: K, handler: EventHandler<WebSocketEventMap[K]>): void;
  /** Remove an event listener. */
  off<K extends keyof WebSocketEventMap>(event: K, handler: EventHandler<WebSocketEventMap[K]>): void;
  /** Get the current connection status. */
  getStatus(): ConnectionStatus;
  /** Get the set of currently subscribed channels. */
  getSubscribedChannels(): Set<string>;
  /** Close the connection permanently (no auto-reconnect). */
  close(): void;
  /** Send authentication credentials. */
  authenticate(apiKey: string): void;
}

/**
 * Create a WebSocket client for the Crypto Vision API.
 */
export function createWebSocketClient(
  url: string,
  options?: { apiKey?: string },
): CryptoWebSocketClient {
  let ws: WebSocket | null = null;
  let status: ConnectionStatus = "disconnected";
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const MAX_RECONNECT_DELAY_MS = 30_000;
  const BASE_RECONNECT_DELAY_MS = 1_000;

  /** Channels the user wants to be subscribed to. */
  const desiredChannels = new Set<string>();

  /** Queue of actions to replay after reconnect. */
  const pendingBuffer: PendingSubscription[] = [];

  /** Event handlers. */
  const handlers = new Map<string, Set<EventHandler<unknown>>>();

  // ─── Event Emitter ─────────────────────────────────────

  function emit<K extends keyof WebSocketEventMap>(event: K, data: WebSocketEventMap[K]): void {
    const fns = handlers.get(event as string);
    if (fns) {
      for (const fn of fns) {
        try {
          fn(data);
        } catch {
          // Don't let handler errors crash the WS client
        }
      }
    }
  }

  function setStatus(newStatus: ConnectionStatus): void {
    if (status === newStatus) return;
    status = newStatus;
    emit("connectionChange", newStatus);
  }

  // ─── Connection ────────────────────────────────────────

  function connect(): void {
    if (closed) return;
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return;

    setStatus("connecting");

    const connectUrl = options?.apiKey ? `${url}?apiKey=${encodeURIComponent(options.apiKey)}` : url;
    ws = new WebSocket(connectUrl);

    ws.onopen = () => {
      setStatus("connected");
      reconnectAttempts = 0;

      // Re-subscribe to all desired channels
      if (desiredChannels.size > 0) {
        sendMessage({
          type: "subscribe",
          channels: [...desiredChannels],
        });
      }

      // Replay buffered actions
      while (pendingBuffer.length > 0) {
        const action = pendingBuffer.shift();
        if (action) {
          sendMessage(action);
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        handleMessage(msg);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      ws = null;
      if (!closed) {
        setStatus("reconnecting");
        scheduleReconnect();
      } else {
        setStatus("disconnected");
      }
    };

    ws.onerror = () => {
      // onclose will fire after this, triggering reconnect
    };
  }

  function scheduleReconnect(): void {
    if (closed) return;
    if (reconnectTimer) return;

    const delay = Math.min(
      BASE_RECONNECT_DELAY_MS * 2 ** reconnectAttempts,
      MAX_RECONNECT_DELAY_MS,
    );
    reconnectAttempts++;

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function sendMessage(msg: Record<string, unknown>): void {
    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(msg));
    } else {
      // Buffer subscribe/unsubscribe for replay
      if (msg.type === "subscribe" || msg.type === "unsubscribe") {
        pendingBuffer.push(msg as PendingSubscription);
      }
    }
  }

  // ─── Message Router ───────────────────────────────────

  function handleMessage(msg: ServerMessage): void {
    // Always emit the raw message
    emit("raw", msg);

    switch (msg.type) {
      case "connected":
        emit("connected", {
          clientId: msg.clientId ?? "",
          availableChannels: msg.availableChannels ?? [],
        });
        break;

      case "ping":
        // Auto-respond to server pings
        sendMessage({ type: "ping" });
        break;

      case "pong":
        // Ack from server — nothing to do
        break;

      case "subscribed":
        emit("subscribed", {
          channels: msg.channels ?? [],
          errors: msg.errors,
        });
        break;

      case "unsubscribed":
        emit("unsubscribed", {
          channels: msg.channels ?? [],
        });
        break;

      case "price":
      case "prices":
        if (msg.data) {
          emit("price", msg.data as PriceData);
        }
        break;

      case "trade":
      case "trades":
        if (msg.data) {
          emit("trade", msg.data as TradeData);
        }
        break;

      case "news":
        if (msg.data) {
          emit("news", msg.data as NewsData);
        }
        break;

      case "alert":
      case "alerts":
        if (msg.data) {
          emit("alert", msg.data as AlertData);
        }
        break;

      case "gas":
        if (msg.data) {
          emit("gas", msg.data as GasData);
        }
        break;

      case "market":
        if (msg.data) {
          emit("market", msg.data as MarketData);
        }
        break;

      case "anomaly":
        if (msg.data) {
          emit("anomaly", msg.data as AnomalyData);
        }
        break;

      case "error":
        emit("error", msg.message ?? "Unknown error");
        break;
    }
  }

  // ─── Public API ───────────────────────────────────────

  function subscribe(channels: string[]): void {
    for (const ch of channels) {
      desiredChannels.add(ch);
    }
    sendMessage({ type: "subscribe", channels });
  }

  function unsubscribe(channels: string[]): void {
    for (const ch of channels) {
      desiredChannels.delete(ch);
    }
    sendMessage({ type: "unsubscribe", channels });
  }

  function on<K extends keyof WebSocketEventMap>(
    event: K,
    handler: EventHandler<WebSocketEventMap[K]>,
  ): void {
    if (!handlers.has(event as string)) {
      handlers.set(event as string, new Set());
    }
    handlers.get(event as string)!.add(handler as EventHandler<unknown>);
  }

  function off<K extends keyof WebSocketEventMap>(
    event: K,
    handler: EventHandler<WebSocketEventMap[K]>,
  ): void {
    const fns = handlers.get(event as string);
    if (fns) {
      fns.delete(handler as EventHandler<unknown>);
    }
  }

  function close(): void {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close(1000, "Client closed");
      ws = null;
    }
    setStatus("disconnected");
    handlers.clear();
  }

  function authenticate(apiKey: string): void {
    sendMessage({ type: "auth", apiKey });
  }

  // Auto-connect on creation
  connect();

  return {
    subscribe,
    unsubscribe,
    on,
    off,
    getStatus: () => status,
    getSubscribedChannels: () => new Set(desiredChannels),
    close,
    authenticate,
  };
}

// ─── Convenience: singleton client for dashboard ─────────────

let defaultClient: CryptoWebSocketClient | null = null;

/**
 * Get or create the default WebSocket client for the dashboard.
 * Connects to the backend API server's /ws endpoint.
 */
export function getWebSocketClient(apiKey?: string): CryptoWebSocketClient {
  if (!defaultClient) {
    const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = typeof window !== "undefined" ? window.location.host : "localhost:8080";
    const url = `${protocol}//${host}/ws`;
    defaultClient = createWebSocketClient(url, { apiKey });
  }
  return defaultClient;
}

/**
 * Close the default WebSocket client.
 */
export function closeWebSocketClient(): void {
  if (defaultClient) {
    defaultClient.close();
    defaultClient = null;
  }
}

// ─── Legacy exports (backward compatibility) ────────────────

export interface WSMessage {
  type: "news" | "breaking" | "price" | "alert" | "ping" | "subscribe" | "unsubscribe";
  payload: unknown;
  timestamp: string;
}

export interface NewsUpdate {
  id: string;
  title: string;
  link: string;
  source: string;
  category: string;
  pubDate: string;
  isBreaking?: boolean;
}

export interface PriceUpdate {
  symbol: string;
  price: number;
  change24h: number;
  changePercent24h: number;
}

export interface Subscription {
  sources: string[];
  categories: string[];
  keywords: string[];
  coins: string[];
}

/**
 * @deprecated Use createWebSocketClient() instead.
 */
export function handleConnection(_ws: WebSocket): string {
  return `ws_${Date.now()}_legacy`;
}

/**
 * @deprecated Use createWebSocketClient() instead.
 */
export function handleDisconnection(_clientId: string): void { /* no-op */ }

/**
 * @deprecated Use createWebSocketClient() instead.
 */
export function handleMessage(_clientId: string, _message: string): void { /* no-op */ }

/**
 * @deprecated Use createWebSocketClient() instead.
 */
export function broadcastNews(_news: NewsUpdate): void { /* no-op */ }

/**
 * @deprecated Use createWebSocketClient() instead.
 */
export function broadcastPrice(_price: PriceUpdate): void { /* no-op */ }

/**
 * @deprecated Use createWebSocketClient() instead.
 */
export function broadcastAlert(_clientId: string, _alert: { type: string; message: string; data?: unknown }): void { /* no-op */ }

/**
 * @deprecated Use createWebSocketClient() instead.
 */
export function sendToClient(_clientId: string, _message: WSMessage): void { /* no-op */ }

/**
 * Get connection stats (legacy).
 * @deprecated Use getWebSocketClient().getStatus() instead.
 */
export function getStats(): {
  totalConnections: number;
  activeConnections: number;
  subscriptions: { sources: number; categories: number; keywords: number; coins: number };
} {
  return {
    totalConnections: 0,
    activeConnections: 0,
    subscriptions: { sources: 0, categories: 0, keywords: 0, coins: 0 },
  };
}

/**
 * @deprecated No-op — clients are managed automatically.
 */
export function cleanupStaleConnections(_maxIdleMs?: number): number {
  return 0;
}

/**
 * @deprecated Use getWebSocketClient().getStatus() instead.
 */
export function getClientCount(): number {
  return 0;
}
