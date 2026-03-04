/**
 * Dashboard WebSocket Manager — Real-time event streaming to browser clients
 *
 * Features:
 * - Manages WebSocket connections for dashboard clients
 * - Subscribes to SwarmEventBus and forwards relevant events in real-time
 * - Heartbeat-based stale connection detection and cleanup
 * - Per-client event subscription filtering
 * - Message buffering to handle slow clients without backpressure
 * - Sensitive data stripping before forwarding to clients
 */

import { v4 as uuidv4 } from 'uuid';

import type { SwarmEventBus } from '../infra/event-bus.js';
import { SwarmLogger } from '../infra/logger.js';
import type { SwarmEvent } from '../types.js';

// ─── Types ────────────────────────────────────────────────────

/** Event types forwarded to dashboard clients */
export type DashboardEventType =
  | 'trade:executed'
  | 'agent:status'
  | 'pnl:updated'
  | 'phase:changed'
  | 'health:report'
  | 'signal:generated'
  | 'alert:created'
  | 'config:changed'
  | 'swarm:status';

/** Event envelope sent over the WebSocket to clients */
export interface DashboardEvent {
  /** Event type identifier */
  type: DashboardEventType;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Event payload */
  data: Record<string, unknown>;
  /** Source agent ID if applicable */
  agentId?: string;
}

/** Information about a connected client */
export interface ClientInfo {
  /** Unique client identifier */
  id: string;
  /** Connection timestamp (epoch ms) */
  connectedAt: number;
  /** Last heartbeat received (epoch ms) */
  lastPing: number;
  /** Events this client is subscribed to (empty = all) */
  subscriptions: string[];
  /** Number of messages sent to this client */
  messagesSent: number;
}

/** Configuration for the DashboardWebSocket manager */
export interface WebSocketConfig {
  /** Heartbeat interval in ms (default: 30000) */
  heartbeatIntervalMs: number;
  /** Max clients allowed (default: 50) */
  maxClients: number;
  /** Message buffer size per client (default: 100) */
  bufferSize: number;
  /** Events to forward to clients */
  subscribedEvents: string[];
}

/** Client message types the server understands */
interface ClientSubscribeMessage {
  type: 'subscribe';
  events: string[];
}

interface ClientUnsubscribeMessage {
  type: 'unsubscribe';
  events: string[];
}

interface ClientPongMessage {
  type: 'pong';
}

type ClientMessage =
  | ClientSubscribeMessage
  | ClientUnsubscribeMessage
  | ClientPongMessage;

// ─── Constants ────────────────────────────────────────────────

const DEFAULT_CONFIG: WebSocketConfig = {
  heartbeatIntervalMs: 30_000,
  maxClients: 50,
  bufferSize: 100,
  subscribedEvents: [
    'trade:*',
    'agent:*',
    'phase:*',
    'health:*',
    'signal:*',
    'alert:*',
    'config:*',
    'pnl:*',
    'swarm:*',
  ],
};

/** Number of missed pings before a client is considered stale */
const MAX_MISSED_PINGS = 2;

/** Sensitive payload keys stripped before forwarding to clients */
const SENSITIVE_KEYS = new Set([
  'privateKey',
  'secretKey',
  'mnemonic',
  'seed',
  'keypair',
  'x402PrivateKey',
  'password',
  'secret',
  'token',
  'apiKey',
  'apiSecret',
]);

// ─── Internal Client Representation ───────────────────────────

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  connectedAt: number;
  lastPing: number;
  subscriptions: string[];
  messagesSent: number;
  missedPings: number;
  buffer: DashboardEvent[];
  flushing: boolean;
}

// ─── DashboardWebSocket ───────────────────────────────────────

export class DashboardWebSocket {
  private readonly clients = new Map<string, ConnectedClient>();
  private readonly config: WebSocketConfig;
  private readonly logger: SwarmLogger;
  private readonly eventBus: SwarmEventBus;
  private readonly eventBusSubscriptionIds: string[] = [];
  private heartbeatTimer: ReturnType<typeof setInterval> | undefined;
  private stopped = false;

  constructor(eventBus: SwarmEventBus, config?: Partial<WebSocketConfig>) {
    this.eventBus = eventBus;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new SwarmLogger({
      level: 'info',
      category: 'dashboard-ws',
    });

    this.subscribeToEventBus();
    this.startHeartbeat();

    this.logger.info('DashboardWebSocket initialized', {
      maxClients: this.config.maxClients,
      heartbeatIntervalMs: this.config.heartbeatIntervalMs,
      bufferSize: this.config.bufferSize,
      subscribedEvents: this.config.subscribedEvents,
    });
  }

  // ── Public API ────────────────────────────────────────────────

  /**
   * Handle a new WebSocket connection upgrade.
   * Assigns a client ID, registers the connection, wires up event handlers,
   * and sends the current swarm status as the initial message.
   */
  handleUpgrade(ws: WebSocket): void {
    if (this.stopped) {
      ws.close(1013, 'Server is shutting down');
      return;
    }

    if (this.clients.size >= this.config.maxClients) {
      ws.close(1013, `Max clients reached (${this.config.maxClients})`);
      this.logger.warn('Rejected WebSocket connection: max clients reached', {
        current: this.clients.size,
        max: this.config.maxClients,
      });
      return;
    }

    const clientId = uuidv4();
    const now = Date.now();

    const client: ConnectedClient = {
      id: clientId,
      ws,
      connectedAt: now,
      lastPing: now,
      subscriptions: [],
      messagesSent: 0,
      missedPings: 0,
      buffer: [],
      flushing: false,
    };

    this.clients.set(clientId, client);

    this.logger.info('Client connected', {
      clientId,
      totalClients: this.clients.size,
    });

    // Wire up WebSocket event handlers
    ws.addEventListener('message', (event: MessageEvent) => {
      this.handleClientMessage(client, event);
    });

    ws.addEventListener('close', () => {
      this.removeClient(clientId, 'connection closed');
    });

    ws.addEventListener('error', () => {
      this.removeClient(clientId, 'connection error');
    });

    // Send welcome message with client ID and current swarm status
    this.sendToClient(client, {
      type: 'swarm:status',
      timestamp: new Date(now).toISOString(),
      data: {
        clientId,
        connectedClients: this.clients.size,
        eventBusStats: this.eventBus.getStats(),
      },
    });
  }

  /**
   * Broadcast a DashboardEvent to ALL connected clients.
   */
  broadcast(event: DashboardEvent): void {
    for (const client of this.clients.values()) {
      this.enqueueOrSend(client, event);
    }
  }

  /**
   * Broadcast a DashboardEvent only to clients whose subscriptions
   * match the event type (or to clients with no subscriptions, which
   * receive everything).
   */
  broadcastToSubscribed(event: DashboardEvent): void {
    for (const client of this.clients.values()) {
      if (this.clientWantsEvent(client, event.type)) {
        this.enqueueOrSend(client, event);
      }
    }
  }

  /** Return the count of active WebSocket connections */
  getConnectedClients(): number {
    return this.clients.size;
  }

  /** Return detailed info about each connected client */
  getClientDetails(): ClientInfo[] {
    const details: ClientInfo[] = [];
    for (const client of this.clients.values()) {
      details.push({
        id: client.id,
        connectedAt: client.connectedAt,
        lastPing: client.lastPing,
        subscriptions: [...client.subscriptions],
        messagesSent: client.messagesSent,
      });
    }
    return details;
  }

  /** Force-disconnect a specific client */
  disconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      this.logger.warn('Attempted to disconnect unknown client', { clientId });
      return;
    }

    client.ws.close(1000, 'Disconnected by server');
    this.removeClient(clientId, 'force disconnected');
  }

  /** Stop the WebSocket manager, closing all connections and cleaning up */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    this.logger.info('Stopping DashboardWebSocket', {
      clientCount: this.clients.size,
    });

    // Stop heartbeat
    if (this.heartbeatTimer !== undefined) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = undefined;
    }

    // Unsubscribe from event bus
    for (const subId of this.eventBusSubscriptionIds) {
      this.eventBus.unsubscribe(subId);
    }
    this.eventBusSubscriptionIds.length = 0;

    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        client.ws.close(1001, 'Server shutting down');
      } catch {
        // Connection may already be closed — ignore
      }
    }
    this.clients.clear();

    this.logger.info('DashboardWebSocket stopped');
  }

  // ── Event Bus Integration ─────────────────────────────────────

  /**
   * Subscribe to the SwarmEventBus for all configured event patterns
   * and forward matching events to connected dashboard clients.
   */
  private subscribeToEventBus(): void {
    for (const pattern of this.config.subscribedEvents) {
      const subId = this.eventBus.subscribe(
        pattern,
        (event: SwarmEvent) => {
          this.forwardSwarmEvent(event);
        },
        { source: 'dashboard-ws' },
      );
      this.eventBusSubscriptionIds.push(subId);
    }

    this.logger.info('Subscribed to event bus', {
      patterns: this.config.subscribedEvents,
      subscriptionCount: this.eventBusSubscriptionIds.length,
    });
  }

  /**
   * Transform a SwarmEvent into a DashboardEvent (stripping sensitive
   * data) and broadcast to subscribed clients.
   */
  private forwardSwarmEvent(event: SwarmEvent): void {
    const dashboardEvent = this.transformEvent(event);
    this.broadcastToSubscribed(dashboardEvent);
  }

  /**
   * Convert an internal SwarmEvent to a client-safe DashboardEvent.
   * Removes sensitive keys from the payload.
   */
  private transformEvent(event: SwarmEvent): DashboardEvent {
    const sanitizedPayload = this.stripSensitiveData(event.payload);

    // Map the SwarmEvent type to a DashboardEventType.
    // We use the raw event type where it matches a dashboard type,
    // otherwise fall back to a category-based mapping.
    const dashboardType = this.mapEventType(event.type);

    return {
      type: dashboardType,
      timestamp: new Date(event.timestamp).toISOString(),
      data: {
        eventId: event.id,
        originalType: event.type,
        category: event.category,
        ...sanitizedPayload,
      },
      agentId: event.source !== 'system' ? event.source : undefined,
    };
  }

  /**
   * Map a raw SwarmEvent type string to the closest DashboardEventType.
   */
  private mapEventType(type: string): DashboardEventType {
    if (type.startsWith('trade:')) return 'trade:executed';
    if (type.startsWith('agent:')) return 'agent:status';
    if (type.startsWith('pnl:')) return 'pnl:updated';
    if (type.startsWith('phase:')) return 'phase:changed';
    if (type.startsWith('health:')) return 'health:report';
    if (type.startsWith('signal:')) return 'signal:generated';
    if (type.startsWith('alert:')) return 'alert:created';
    if (type.startsWith('config:')) return 'config:changed';
    if (type.startsWith('swarm:')) return 'swarm:status';

    // Default fallback for unmapped events
    return 'swarm:status';
  }

  /**
   * Recursively strip sensitive keys from a payload object.
   */
  private stripSensitiveData(
    data: Record<string, unknown>,
  ): Record<string, unknown> {
    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        clean[key] = '[REDACTED]';
        continue;
      }

      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        clean[key] = this.stripSensitiveData(
          value as Record<string, unknown>,
        );
      } else if (Array.isArray(value)) {
        clean[key] = value.map((item) =>
          item !== null && typeof item === 'object'
            ? this.stripSensitiveData(item as Record<string, unknown>)
            : item,
        );
      } else {
        clean[key] = value;
      }
    }

    return clean;
  }

  // ── Client Message Handling ───────────────────────────────────

  /**
   * Process an incoming message from a client WebSocket.
   * Supports subscribe, unsubscribe, and pong messages.
   */
  private handleClientMessage(
    client: ConnectedClient,
    event: MessageEvent,
  ): void {
    let parsed: ClientMessage;
    try {
      const raw =
        typeof event.data === 'string'
          ? event.data
          : new TextDecoder().decode(event.data as ArrayBuffer);
      parsed = JSON.parse(raw) as ClientMessage;
    } catch {
      this.logger.warn('Invalid message from client', {
        clientId: client.id,
      });
      return;
    }

    switch (parsed.type) {
      case 'subscribe':
        this.handleSubscribe(client, parsed);
        break;

      case 'unsubscribe':
        this.handleUnsubscribe(client, parsed);
        break;

      case 'pong':
        this.handlePong(client);
        break;

      default:
        this.logger.warn('Unknown message type from client', {
          clientId: client.id,
          type: (parsed as Record<string, unknown>).type,
        });
    }
  }

  /**
   * Handle a subscribe message — client wants to receive specific event types.
   */
  private handleSubscribe(
    client: ConnectedClient,
    msg: ClientSubscribeMessage,
  ): void {
    if (!Array.isArray(msg.events) || msg.events.length === 0) {
      this.logger.warn('Invalid subscribe message: no events', {
        clientId: client.id,
      });
      return;
    }

    // Deduplicate and add new subscriptions
    const existing = new Set(client.subscriptions);
    for (const evt of msg.events) {
      if (typeof evt === 'string' && evt.length > 0) {
        existing.add(evt);
      }
    }
    client.subscriptions = [...existing];

    this.logger.info('Client updated subscriptions', {
      clientId: client.id,
      subscriptions: client.subscriptions,
    });

    // Acknowledge
    this.sendToClient(client, {
      type: 'swarm:status',
      timestamp: new Date().toISOString(),
      data: {
        action: 'subscribed',
        subscriptions: client.subscriptions,
      },
    });
  }

  /**
   * Handle an unsubscribe message — client no longer wants specific events.
   */
  private handleUnsubscribe(
    client: ConnectedClient,
    msg: ClientUnsubscribeMessage,
  ): void {
    if (!Array.isArray(msg.events) || msg.events.length === 0) {
      return;
    }

    const toRemove = new Set(msg.events);
    client.subscriptions = client.subscriptions.filter(
      (s) => !toRemove.has(s),
    );

    this.logger.info('Client removed subscriptions', {
      clientId: client.id,
      subscriptions: client.subscriptions,
    });
  }

  /** Handle a pong reply from a client — reset their missed-ping counter */
  private handlePong(client: ConnectedClient): void {
    client.lastPing = Date.now();
    client.missedPings = 0;
  }

  // ── Heartbeat ─────────────────────────────────────────────────

  /** Start the heartbeat interval that sends pings and evicts stale clients */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.heartbeatTick();
    }, this.config.heartbeatIntervalMs);
  }

  /**
   * One heartbeat tick:
   * 1. Identify and remove stale clients (missed ≥ MAX_MISSED_PINGS)
   * 2. Send a ping to all remaining clients
   * 3. Increment their missedPings counter (reset on pong)
   */
  private heartbeatTick(): void {
    const staleIds: string[] = [];

    for (const client of this.clients.values()) {
      if (client.missedPings >= MAX_MISSED_PINGS) {
        staleIds.push(client.id);
      }
    }

    // Evict stale clients
    for (const id of staleIds) {
      const client = this.clients.get(id);
      if (client) {
        try {
          client.ws.close(1001, 'Heartbeat timeout');
        } catch {
          // Already closed — ignore
        }
        this.removeClient(id, 'heartbeat timeout');
      }
    }

    // Send ping to remaining clients and increment miss counter
    for (const client of this.clients.values()) {
      client.missedPings++;
      this.sendRaw(client, JSON.stringify({ type: 'ping' }));
    }

    if (staleIds.length > 0) {
      this.logger.info('Heartbeat: evicted stale clients', {
        evicted: staleIds.length,
        remaining: this.clients.size,
      });
    }
  }

  // ── Message Sending & Buffering ───────────────────────────────

  /**
   * Determine whether to send directly or buffer. If the client's
   * buffer is non-empty (previous sends pending), enqueue. Otherwise
   * attempt a direct send.
   */
  private enqueueOrSend(
    client: ConnectedClient,
    event: DashboardEvent,
  ): void {
    if (client.buffer.length > 0 || client.flushing) {
      this.enqueue(client, event);
      return;
    }

    const success = this.sendToClient(client, event);
    if (!success) {
      this.enqueue(client, event);
    }
  }

  /**
   * Add an event to the client's buffer. If the buffer exceeds capacity,
   * drop the oldest message to prevent unbounded memory growth.
   */
  private enqueue(client: ConnectedClient, event: DashboardEvent): void {
    if (client.buffer.length >= this.config.bufferSize) {
      // Drop oldest message
      client.buffer.shift();
    }
    client.buffer.push(event);
    this.scheduleFlush(client);
  }

  /**
   * Schedule a microtask to flush the client's buffer. Uses a flag
   * to avoid scheduling multiple flushes.
   */
  private scheduleFlush(client: ConnectedClient): void {
    if (client.flushing) return;
    client.flushing = true;

    queueMicrotask(() => {
      this.flushBuffer(client);
    });
  }

  /** Drain the client's buffered messages, sending each in order */
  private flushBuffer(client: ConnectedClient): void {
    while (client.buffer.length > 0) {
      const event = client.buffer.shift();
      if (event) {
        const sent = this.sendToClient(client, event);
        if (!sent) {
          // Re-add to front of buffer and stop flushing
          client.buffer.unshift(event);
          break;
        }
      }
    }
    client.flushing = false;
  }

  /**
   * Send a DashboardEvent to a single client.
   * Returns true if the send succeeded, false otherwise.
   */
  private sendToClient(
    client: ConnectedClient,
    event: DashboardEvent,
  ): boolean {
    const payload = JSON.stringify(event);
    return this.sendRaw(client, payload);
  }

  /**
   * Send a raw string payload to a client's WebSocket.
   * Returns true on success, false on failure.
   */
  private sendRaw(client: ConnectedClient, payload: string): boolean {
    try {
      if (client.ws.readyState !== WebSocket.OPEN) {
        return false;
      }
      client.ws.send(payload);
      client.messagesSent++;
      return true;
    } catch (err) {
      this.logger.warn('Failed to send message to client', {
        clientId: client.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  // ── Subscription Matching ─────────────────────────────────────

  /**
   * Check if a client wants a specific event type.
   * Clients with no subscriptions receive ALL events.
   * Subscriptions support exact match and wildcard prefix (e.g. 'trade:*').
   */
  private clientWantsEvent(client: ConnectedClient, eventType: string): boolean {
    // No subscriptions = receive everything
    if (client.subscriptions.length === 0) return true;

    for (const sub of client.subscriptions) {
      if (sub === eventType) return true;
      if (sub.endsWith('*') && eventType.startsWith(sub.slice(0, -1))) {
        return true;
      }
    }

    return false;
  }

  // ── Client Lifecycle ──────────────────────────────────────────

  /** Remove a client from the pool and log the reason */
  private removeClient(clientId: string, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    this.clients.delete(clientId);

    this.logger.info('Client disconnected', {
      clientId,
      reason,
      messagesDelivered: client.messagesSent,
      connectionDurationMs: Date.now() - client.connectedAt,
      remainingClients: this.clients.size,
    });
  }
}
