"use client";

import type {
  WebSocketMessage,
  WebSocketMessageType,
  TransactionUpdateEvent,
  PriceUpdateEvent,
  SubscriptionTriggerEvent,
  ConsolidationUpdateEvent,
} from "./types";

// WebSocket connection URL from environment
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:3001/ws";

// Reconnection configuration
const RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const RECONNECT_DECAY = 1.5;

/** Event handler types */
type MessageHandler<T = unknown> = (data: T) => void;

/** WebSocket connection state */
export type ConnectionState = "connecting" | "connected" | "disconnected" | "error";

/** Event listeners map */
interface EventListeners {
  transaction_update: Set<MessageHandler<TransactionUpdateEvent>>;
  price_update: Set<MessageHandler<PriceUpdateEvent>>;
  subscription_trigger: Set<MessageHandler<SubscriptionTriggerEvent>>;
  consolidation_update: Set<MessageHandler<ConsolidationUpdateEvent>>;
  connected: Set<MessageHandler<void>>;
  error: Set<MessageHandler<Error>>;
}

/**
 * WebSocket client for real-time updates
 * Handles connection management, reconnection, and event dispatching
 */
export class SweepWebSocket {
  private ws: WebSocket | null = null;
  private state: ConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private wallet: string | null = null;

  private listeners: EventListeners = {
    transaction_update: new Set(),
    price_update: new Set(),
    subscription_trigger: new Set(),
    consolidation_update: new Set(),
    connected: new Set(),
    error: new Set(),
  };

  private stateChangeListeners = new Set<(state: ConnectionState) => void>();

  /**
   * Connect to the WebSocket server
   * @param wallet - Wallet address to associate with this connection
   */
  connect(wallet: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      // Already connected, just update wallet subscription
      this.subscribeToWallet(wallet);
      return;
    }

    this.wallet = wallet;
    this.state = "connecting";
    this.notifyStateChange();

    try {
      this.ws = new WebSocket(`${WS_URL}?wallet=${wallet}`);
      this.setupEventHandlers();
    } catch (error) {
      console.error("[WebSocket] Failed to create connection:", error);
      this.handleError(error as Error);
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.cleanup();
    this.state = "disconnected";
    this.notifyStateChange();
    this.reconnectAttempts = 0;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Subscribe to state changes
   */
  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateChangeListeners.add(handler);
    return () => this.stateChangeListeners.delete(handler);
  }

  /**
   * Subscribe to transaction updates
   */
  onTransactionUpdate(handler: MessageHandler<TransactionUpdateEvent>): () => void {
    this.listeners.transaction_update.add(handler);
    return () => this.listeners.transaction_update.delete(handler);
  }

  /**
   * Subscribe to price updates
   */
  onPriceUpdate(handler: MessageHandler<PriceUpdateEvent>): () => void {
    this.listeners.price_update.add(handler);
    return () => this.listeners.price_update.delete(handler);
  }

  /**
   * Subscribe to subscription triggers
   */
  onSubscriptionTrigger(handler: MessageHandler<SubscriptionTriggerEvent>): () => void {
    this.listeners.subscription_trigger.add(handler);
    return () => this.listeners.subscription_trigger.delete(handler);
  }

  /**
   * Subscribe to consolidation updates
   */
  onConsolidationUpdate(handler: MessageHandler<ConsolidationUpdateEvent>): () => void {
    this.listeners.consolidation_update.add(handler);
    return () => this.listeners.consolidation_update.delete(handler);
  }

  /**
   * Subscribe to connection events
   */
  onConnected(handler: MessageHandler<void>): () => void {
    this.listeners.connected.add(handler);
    return () => this.listeners.connected.delete(handler);
  }

  /**
   * Subscribe to error events
   */
  onError(handler: MessageHandler<Error>): () => void {
    this.listeners.error.add(handler);
    return () => this.listeners.error.delete(handler);
  }

  /**
   * Send a message to the server
   */
  send(type: string, data: unknown): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      console.warn("[WebSocket] Cannot send message, not connected");
      return;
    }

    this.ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
  }

  /**
   * Subscribe to updates for a specific sweep
   */
  subscribeSweep(sweepId: string): void {
    this.send("subscribe_sweep", { sweepId });
  }

  /**
   * Unsubscribe from updates for a specific sweep
   */
  unsubscribeSweep(sweepId: string): void {
    this.send("unsubscribe_sweep", { sweepId });
  }

  /**
   * Subscribe to updates for a consolidation
   */
  subscribeConsolidation(consolidationId: string): void {
    this.send("subscribe_consolidation", { consolidationId });
  }

  /**
   * Unsubscribe from consolidation updates
   */
  unsubscribeConsolidation(consolidationId: string): void {
    this.send("unsubscribe_consolidation", { consolidationId });
  }

  // ============================================
  // Private Methods
  // ============================================

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log("[WebSocket] Connected");
      this.state = "connected";
      this.reconnectAttempts = 0;
      this.notifyStateChange();
      this.startHeartbeat();
      this.dispatchEvent("connected", undefined);

      // Subscribe to wallet updates if wallet is set
      if (this.wallet) {
        this.subscribeToWallet(this.wallet);
      }
    };

    this.ws.onclose = (event) => {
      console.log("[WebSocket] Disconnected:", event.code, event.reason);
      this.cleanup();
      this.state = "disconnected";
      this.notifyStateChange();

      // Attempt reconnection unless intentionally closed
      if (event.code !== 1000) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (event) => {
      console.error("[WebSocket] Error:", event);
      this.handleError(new Error("WebSocket connection error"));
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.handleMessage(message);
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    };
  }

  private handleMessage(message: WebSocketMessage): void {
    switch (message.type) {
      case "transaction_update":
        this.dispatchEvent("transaction_update", message.data as TransactionUpdateEvent);
        break;
      case "price_update":
        this.dispatchEvent("price_update", message.data as PriceUpdateEvent);
        break;
      case "subscription_trigger":
        this.dispatchEvent("subscription_trigger", message.data as SubscriptionTriggerEvent);
        break;
      case "consolidation_update":
        this.dispatchEvent("consolidation_update", message.data as ConsolidationUpdateEvent);
        break;
      default:
        console.log("[WebSocket] Unknown message type:", message.type);
    }
  }

  private dispatchEvent<T>(type: keyof EventListeners, data: T): void {
    const handlers = this.listeners[type];
    handlers.forEach((handler) => {
      try {
        (handler as MessageHandler<T>)(data);
      } catch (error) {
        console.error(`[WebSocket] Error in ${type} handler:`, error);
      }
    });
  }

  private subscribeToWallet(wallet: string): void {
    this.send("subscribe_wallet", { wallet });
  }

  private handleError(error: Error): void {
    this.state = "error";
    this.notifyStateChange();
    this.dispatchEvent("error", error);
  }

  private notifyStateChange(): void {
    this.stateChangeListeners.forEach((handler) => {
      try {
        handler(this.state);
      } catch (error) {
        console.error("[WebSocket] Error in state change handler:", error);
      }
    });
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send("ping", {});
      }
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(RECONNECT_DECAY, this.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectAttempts++;

      if (this.wallet) {
        this.connect(this.wallet);
      }
    }, delay);
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;

      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(1000, "Client disconnect");
      }
      this.ws = null;
    }
  }
}

// Singleton instance for use across the app
let instance: SweepWebSocket | null = null;

/**
 * Get the singleton WebSocket instance
 */
export function getWebSocket(): SweepWebSocket {
  if (!instance) {
    instance = new SweepWebSocket();
  }
  return instance;
}

/**
 * React hook for WebSocket connection state
 * Use this to track connection status in components
 */
export function useWebSocketState() {
  // Implementation in hooks/useTransactionStatus.ts
  // This is just a type export for reference
}
