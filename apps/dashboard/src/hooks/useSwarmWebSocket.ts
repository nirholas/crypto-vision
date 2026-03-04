'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type {
  SwarmWSEvent,
  SwarmWSEventType,
  TradeExecutedEvent,
  AgentStatusEvent,
  PnLUpdatedEvent,
  PhaseChangedEvent,
  StatusResponse,
  HealthReport,
  SwarmPhase,
} from '@/types/swarm';

// ─── Configuration ────────────────────────────────────────────

const DEFAULT_WS_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_SWARM_WS_URL ??
      (process.env.NEXT_PUBLIC_SWARM_API_URL ?? 'http://localhost:3847').replace(/^http/, 'ws') + '/ws')
    : 'ws://localhost:3847/ws';

const MAX_EVENTS = 200;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_MULTIPLIER = 1.5;

// ─── Types ────────────────────────────────────────────────────

type EventHandler<T = unknown> = (event: SwarmWSEvent<T>) => void;

interface UseSwarmWebSocketReturn {
  /** Whether the WebSocket is currently connected */
  connected: boolean;
  /** Number of reconnect attempts since last successful connection */
  reconnectAttempts: number;
  /** All received events (most recent first, capped at MAX_EVENTS) */
  events: SwarmWSEvent[];
  /** Last trade event received */
  lastTrade: TradeExecutedEvent | null;
  /** Current swarm status from phase:changed events */
  swarmPhase: SwarmPhase | null;
  /** Latest PnL update */
  latestPnl: PnLUpdatedEvent | null;
  /** Latest health report from WebSocket */
  latestHealth: HealthReport | null;
  /** Subscribe to specific event types */
  subscribe: <T = unknown>(eventType: SwarmWSEventType, handler: EventHandler<T>) => () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Disconnect the WebSocket */
  disconnect: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useSwarmWebSocket(wsUrl?: string): UseSwarmWebSocketReturn {
  const url = wsUrl ?? DEFAULT_WS_URL;

  const [connected, setConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [events, setEvents] = useState<SwarmWSEvent[]>([]);
  const [lastTrade, setLastTrade] = useState<TradeExecutedEvent | null>(null);
  const [swarmPhase, setSwarmPhase] = useState<SwarmPhase | null>(null);
  const [latestPnl, setLatestPnl] = useState<PnLUpdatedEvent | null>(null);
  const [latestHealth, setLatestHealth] = useState<HealthReport | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY);
  const subscribersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const mountedRef = useRef(true);

  // ── Subscriber management ───────────────────────────────────

  const subscribe = useCallback(<T = unknown>(eventType: SwarmWSEventType, handler: EventHandler<T>) => {
    const key = eventType;
    if (!subscribersRef.current.has(key)) {
      subscribersRef.current.set(key, new Set());
    }
    const handlers = subscribersRef.current.get(key)!;
    const wrappedHandler = handler as EventHandler;
    handlers.add(wrappedHandler);

    // Return unsubscribe function
    return () => {
      handlers.delete(wrappedHandler);
      if (handlers.size === 0) {
        subscribersRef.current.delete(key);
      }
    };
  }, []);

  // ── Dispatch event to subscribers ───────────────────────────

  const dispatchEvent = useCallback((event: SwarmWSEvent) => {
    const handlers = subscribersRef.current.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (err) {
          console.error(`[SwarmWS] Error in handler for ${event.type}:`, err);
        }
      }
    }
  }, []);

  // ── Process incoming message ────────────────────────────────

  const processMessage = useCallback((rawData: string) => {
    try {
      const event = JSON.parse(rawData) as SwarmWSEvent;

      if (!event.type || event.timestamp === undefined) {
        console.warn('[SwarmWS] Received malformed event:', rawData);
        return;
      }

      // Add to event log
      setEvents((prev) => [event, ...prev].slice(0, MAX_EVENTS));

      // Update type-specific state
      switch (event.type) {
        case 'trade:executed':
          setLastTrade(event.data as TradeExecutedEvent);
          break;
        case 'phase:changed': {
          const phaseEvent = event.data as PhaseChangedEvent;
          setSwarmPhase(phaseEvent.to);
          break;
        }
        case 'pnl:updated':
          setLatestPnl(event.data as PnLUpdatedEvent);
          break;
        case 'health:report':
          setLatestHealth(event.data as HealthReport);
          break;
      }

      // Dispatch to subscribers
      dispatchEvent(event);
    } catch (err) {
      console.error('[SwarmWS] Failed to parse message:', err);
    }
  }, [dispatchEvent]);

  // ── Connect logic ───────────────────────────────────────────

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.onerror = null;
      wsRef.current.onmessage = null;
      wsRef.current.onopen = null;
      if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        setConnected(true);
        setReconnectAttempts(0);
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;
        processMessage(event.data as string);
      };

      ws.onerror = (error) => {
        console.error('[SwarmWS] WebSocket error:', error);
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        setConnected(false);

        // Schedule reconnect with exponential backoff
        const delay = reconnectDelayRef.current;
        reconnectDelayRef.current = Math.min(
          delay * RECONNECT_MULTIPLIER,
          MAX_RECONNECT_DELAY,
        );
        setReconnectAttempts((prev) => prev + 1);

        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) {
            connect();
          }
        }, delay);
      };
    } catch (err) {
      console.error('[SwarmWS] Failed to create WebSocket:', err);
      setConnected(false);

      // Retry
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * RECONNECT_MULTIPLIER, MAX_RECONNECT_DELAY);
      setReconnectAttempts((prev) => prev + 1);

      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connect();
        }
      }, delay);
    }
  }, [url, processMessage]);

  // ── Manual reconnect ────────────────────────────────────────

  const reconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    reconnectDelayRef.current = INITIAL_RECONNECT_DELAY;
    connect();
  }, [connect]);

  // ── Disconnect ──────────────────────────────────────────────

  const disconnect = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null; // Prevent reconnect
      wsRef.current.close();
      wsRef.current = null;
    }
    setConnected(false);
  }, []);

  // ── Lifecycle ───────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    connected,
    reconnectAttempts,
    events,
    lastTrade,
    swarmPhase,
    latestPnl,
    latestHealth,
    subscribe,
    reconnect,
    disconnect,
  };
}
