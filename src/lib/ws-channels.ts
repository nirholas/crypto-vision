/**
 * Crypto Vision — WebSocket Channel Manager
 *
 * Manages per-client channel subscriptions and efficiently routes
 * broadcast messages to the correct subscribers.
 *
 * Channels:
 *   "prices"           — Top 100 coin prices, broadcast every 30s
 *   "prices:{coinId}"  — Specific coin price, broadcast every 10s
 *   "trades"           — Large trades across exchanges, broadcast as they arrive
 *   "trades:{exchange}" — Trades from a specific exchange
 *   "news"             — Breaking news, broadcast as they arrive
 *   "gas"              — Multi-chain gas prices, broadcast every 30s
 *   "alerts"           — User-specific alerts (requires auth)
 *   "market"           — Market-wide events (new ATH, large liquidations)
 *   "anomaly"          — Anomaly detection alerts
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { logger } from "@/lib/logger";
import {
  wsConnectionsActive,
  wsMessagesSentTotal,
} from "@/lib/metrics";
import type { WSContext } from "hono/ws";

// ─── Types ───────────────────────────────────────────────────

/** All supported top-level channels. */
export type Channel =
  | "prices"
  | "trades"
  | "news"
  | "gas"
  | "alerts"
  | "market"
  | "anomaly";

/** Wildcard-style channels with a qualifier (e.g. "prices:bitcoin"). */
export type QualifiedChannel = `prices:${string}` | `trades:${string}`;

/** Any valid channel string. */
export type AnyChannel = Channel | QualifiedChannel;

/** Auth-required channels. */
const AUTH_REQUIRED_CHANNELS: ReadonlySet<string> = new Set(["alerts"]);

/** All known base channels for validation. */
const VALID_BASE_CHANNELS: ReadonlySet<string> = new Set([
  "prices",
  "trades",
  "news",
  "gas",
  "alerts",
  "market",
  "anomaly",
]);

export interface ClientInfo {
  id: string;
  ws: WSContext;
  channels: Set<string>;
  authenticated: boolean;
  apiKey: string | null;
  /** Messages received in current rate-limit window */
  messageCount: number;
  /** Timestamp when rate-limit window started */
  windowStart: number;
  /** Last activity time (for stale detection) */
  lastActivity: number;
  /** Last pong received (for heartbeat) */
  lastPong: number;
}

// ─── Channel Manager ────────────────────────────────────────

/** Maximum message size in bytes. */
const MAX_MESSAGE_SIZE = 64 * 1024;
/** Maximum clients. */
const MAX_CONNECTIONS = Number(process.env.WS_MAX_CONNECTIONS) || 1000;
/** Rate limit: messages per minute from a client. */
const RATE_LIMIT_PER_MIN = 100;
/** Rate limit window in ms. */
const RATE_LIMIT_WINDOW_MS = 60_000;

class ChannelManager {
  /** clientId → ClientInfo */
  private readonly clients = new Map<string, ClientInfo>();
  /** channel → Set<clientId> */
  private readonly subscriptions = new Map<string, Set<string>>();
  /** Monotonic ID counter */
  private nextId = 0;

  // ─── Client Lifecycle ──────────────────────────────────

  /**
   * Register a new client connection.
   * Returns the client ID or null if max connections reached.
   */
  registerClient(
    ws: WSContext,
    options?: { apiKey?: string | null },
  ): ClientInfo | null {
    if (this.clients.size >= MAX_CONNECTIONS) {
      logger.warn(
        { current: this.clients.size, max: MAX_CONNECTIONS },
        "WS: max connections reached, rejecting client",
      );
      return null;
    }

    const id = `ws_${++this.nextId}_${Date.now().toString(36)}`;
    const now = Date.now();
    const client: ClientInfo = {
      id,
      ws,
      channels: new Set(),
      authenticated: !!options?.apiKey,
      apiKey: options?.apiKey ?? null,
      messageCount: 0,
      windowStart: now,
      lastActivity: now,
      lastPong: now,
    };

    this.clients.set(id, client);
    wsConnectionsActive.inc();
    logger.info({ clientId: id, total: this.clients.size }, "WS client connected");
    return client;
  }

  /**
   * Disconnect and clean up a client.
   */
  disconnectClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all channel subscriptions
    for (const channel of client.channels) {
      const subs = this.subscriptions.get(channel);
      if (subs) {
        subs.delete(clientId);
        if (subs.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    }

    // Try to close the WebSocket
    try {
      if (client.ws.readyState === 1) {
        client.ws.close(1000, "Disconnected");
      }
    } catch {
      // Client already gone
    }

    this.clients.delete(clientId);
    wsConnectionsActive.dec();
    logger.info({ clientId, total: this.clients.size }, "WS client disconnected");
  }

  // ─── Subscriptions ────────────────────────────────────

  /**
   * Subscribe a client to one or more channels.
   * Returns the list of successfully subscribed channels and any errors.
   */
  subscribe(
    clientId: string,
    channels: string[],
  ): { subscribed: string[]; errors: string[] } {
    const client = this.clients.get(clientId);
    if (!client) return { subscribed: [], errors: ["Client not found"] };

    const subscribed: string[] = [];
    const errors: string[] = [];

    for (const channel of channels) {
      // Validate channel name
      if (!this.isValidChannel(channel)) {
        errors.push(`Unknown channel: ${channel}`);
        continue;
      }

      // Check auth requirement
      if (AUTH_REQUIRED_CHANNELS.has(channel) && !client.authenticated) {
        errors.push(`Channel "${channel}" requires authentication`);
        continue;
      }

      // Add subscription
      client.channels.add(channel);
      if (!this.subscriptions.has(channel)) {
        this.subscriptions.set(channel, new Set());
      }
      this.subscriptions.get(channel)!.add(clientId);
      subscribed.push(channel);
    }

    return { subscribed, errors };
  }

  /**
   * Unsubscribe a client from one or more channels.
   */
  unsubscribe(clientId: string, channels: string[]): string[] {
    const client = this.clients.get(clientId);
    if (!client) return [];

    const unsubscribed: string[] = [];
    for (const channel of channels) {
      if (client.channels.has(channel)) {
        client.channels.delete(channel);
        const subs = this.subscriptions.get(channel);
        if (subs) {
          subs.delete(clientId);
          if (subs.size === 0) {
            this.subscriptions.delete(channel);
          }
        }
        unsubscribed.push(channel);
      }
    }
    return unsubscribed;
  }

  // ─── Broadcasting ─────────────────────────────────────

  /**
   * Broadcast a message to all subscribers of a channel.
   * Also fans out to qualified sub-channels (e.g. "prices" → "prices:bitcoin").
   */
  broadcast(channel: string, data: unknown): number {
    const message = JSON.stringify({
      type: channel.split(":")[0],
      channel,
      data,
      timestamp: new Date().toISOString(),
    });

    if (message.length > MAX_MESSAGE_SIZE) {
      logger.warn(
        { channel, size: message.length, max: MAX_MESSAGE_SIZE },
        "WS: broadcast message exceeds max size, dropping",
      );
      return 0;
    }

    let sent = 0;

    // Direct channel subscribers
    sent += this.sendToSubscribers(channel, message);

    // If broadcasting to a base channel (e.g. "prices"), also send to
    // qualified sub-channel listeners (e.g. "prices:bitcoin")
    const baseChannel = channel.split(":")[0];
    if (channel === baseChannel) {
      // Also deliver to subscribers of the base channel
      // (they already got it above if they subscribed to the base channel)
    } else {
      // Broadcasting to a qualified channel — also send to base subscribers
      sent += this.sendToSubscribers(baseChannel, message);
    }

    wsMessagesSentTotal.inc({ channel: baseChannel }, sent);
    return sent;
  }

  /**
   * Broadcast a pre-serialized message string to a channel.
   * More efficient when the same message is sent to multiple channels.
   */
  broadcastRaw(channel: string, message: string): number {
    if (message.length > MAX_MESSAGE_SIZE) return 0;

    let sent = 0;
    sent += this.sendToSubscribers(channel, message);

    // Also deliver to base-channel subscribers for qualified channels
    const baseChannel = channel.split(":")[0];
    if (channel !== baseChannel) {
      sent += this.sendToSubscribers(baseChannel, message);
    }

    wsMessagesSentTotal.inc({ channel: baseChannel }, sent);
    return sent;
  }

  private sendToSubscribers(channel: string, message: string): number {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) return 0;

    let sent = 0;
    const stale: string[] = [];

    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (!client) {
        stale.push(clientId);
        continue;
      }

      try {
        if (client.ws.readyState === 1) {
          client.ws.send(message);
          sent++;
        } else {
          stale.push(clientId);
        }
      } catch {
        stale.push(clientId);
      }
    }

    // Lazy cleanup of stale subscribers
    for (const id of stale) {
      subscribers.delete(id);
    }

    return sent;
  }

  // ─── Rate Limiting ────────────────────────────────────

  /**
   * Check if a client has exceeded the rate limit.
   * Returns true if the message should be allowed, false if rate-limited.
   */
  checkRateLimit(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    const now = Date.now();

    // Reset window if expired
    if (now - client.windowStart > RATE_LIMIT_WINDOW_MS) {
      client.messageCount = 0;
      client.windowStart = now;
    }

    client.messageCount++;
    client.lastActivity = now;

    return client.messageCount <= RATE_LIMIT_PER_MIN;
  }

  /**
   * Record that a client responded to a heartbeat.
   */
  recordPong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPong = Date.now();
      client.lastActivity = Date.now();
    }
  }

  // ─── Monitoring ───────────────────────────────────────

  /**
   * Get the number of subscribers for a channel.
   */
  getSubscriberCount(channel: string): number {
    return this.subscriptions.get(channel)?.size ?? 0;
  }

  /**
   * Get all channel subscription counts.
   */
  getSubscriptionCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const [channel, subs] of this.subscriptions) {
      counts[channel] = subs.size;
    }
    return counts;
  }

  /**
   * Get total active connections.
   */
  getActiveConnections(): number {
    return this.clients.size;
  }

  /**
   * Get a client by ID.
   */
  getClient(clientId: string): ClientInfo | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all clients iterator (for heartbeat/cleanup).
   */
  getAllClients(): IterableIterator<ClientInfo> {
    return this.clients.values();
  }

  /**
   * Remove stale clients that haven't responded to heartbeats.
   */
  removeStaleClients(heartbeatTimeoutMs: number): number {
    const now = Date.now();
    let removed = 0;

    for (const [clientId, client] of this.clients) {
      if (now - client.lastPong > heartbeatTimeoutMs) {
        logger.info(
          { clientId, lastPong: new Date(client.lastPong).toISOString() },
          "WS: removing stale client (heartbeat timeout)",
        );
        this.disconnectClient(clientId);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Gracefully close all connections (for shutdown).
   */
  closeAll(code: number, reason: string): void {
    for (const [clientId] of this.clients) {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.ws.close(code, reason);
        } catch {
          // best-effort
        }
      }
    }
    this.clients.clear();
    this.subscriptions.clear();
    wsConnectionsActive.set(0);
  }

  // ─── Internals ────────────────────────────────────────

  private isValidChannel(channel: string): boolean {
    // Check base channel
    if (VALID_BASE_CHANNELS.has(channel)) return true;

    // Check qualified channels (e.g. "prices:bitcoin", "trades:binance")
    const [base] = channel.split(":");
    if (base === "prices" || base === "trades") {
      return channel.includes(":");
    }

    return false;
  }
}

// ─── Singleton ───────────────────────────────────────────────

export const channelManager = new ChannelManager();
