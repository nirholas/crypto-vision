/**
 * useSwarmWebSocket — Real-time event stream from the pump-agent-swarm dashboard API
 *
 * Connects to ws://<host>:3847/ws with auto-reconnect and exponential backoff.
 * Returns connection state, latest events, and subscription helpers.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { swarmApi } from '@/lib/swarm-api';
import type {
  SwarmWSEvent,
  SwarmWSEventType,
  TradeExecutedEvent,
  AgentStatusEvent,
  PnLUpdatedEvent,
  PhaseChangedEvent,
  SwarmPhase,
  HealthReport,
} from '@/types/swarm';

// ─── Constants ────────────────────────────────────────────────

const INITIAL_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const MAX_EVENTS_BUFFER = 200;

// ─── Types ────────────────────────────────────────────────────

type EventHandler<T = unknown> = (data: T, event: SwarmWSEvent<T>) => void;

interface Subscription {
  id: string;
  type: SwarmWSEventType | '*';
  handler: EventHandler;
}

interface UseSwarmWebSocketReturn {
  /** Whether the WebSocket is connected */
  connected: boolean;
  /** Number of reconnect attempts */
  reconnectAttempts: number;
  /** Buffered events (last N) */
  events: SwarmWSEvent[];
  /** Latest trade event */
  lastTrade: TradeExecutedEvent | null;
  /** Latest PnL update */
  latestPnl: PnLUpdatedEvent | null;
  /** Current swarm phase from WS */
  swarmPhase: SwarmPhase | null;
  /** Latest health report */
  healthReport: HealthReport | null;
  /** Agent status updates keyed by agent ID */
  agentStatuses: Map<string, AgentStatusEvent>;
  /** Subscribe to a specific event type */
  subscribe: <T = unknown>(type: SwarmWSEventType | '*', handler: EventHandler<T>) => string;
  /** Unsubscribe by subscription ID */
  unsubscribe: (id: string) => void;
  /** Force reconnect */
  reconnect: () => void;
}

// ─── Hook ─────────────────────────────────────────────────────

export function useSwarmWebSocket(): UseSwarmWebSocketReturn {
  const [connected, setConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [events, setEvents] = useState<SwarmWSEvent[]>([]);
  const [lastTrade, setLastTrade] = useState<TradeExecutedEvent | null>(null);
  const [latestPnl, setLatestPnl] = useState<PnLUpdatedEvent | null>(null);
  const [swarmPhase, setSwarmPhase] = useState<SwarmPhase | null>(null);
  const [healthReport, setHealthReport] = useState<HealthReport | null>(null);
  const [agentStatuses, setAgentStatuses] = useState<Map<string, AgentStatusEvent>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const subscriptionsRef = useRef<Subscription[]>([]);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY_MS);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const subIdCounterRef = useRef(0);

  // ── Dispatch event to subscribers ───────────────────────────

  const dispatchEvent = useCallback((event: SwarmWSEvent) => {
    for (const sub of subscriptionsRef.current) {
      if (sub.type === '*' || sub.type === event.type) {
        try {
          sub.handler(event.data, event);
        } catch (err) {
          console.error(`[SwarmWS] subscriber error for ${event.type}:`, err);
        }
      }
    }
  }, []);

  // ── Handle incoming message ─────────────────────────────────

  const handleMessage = useCallback(
    (raw: string) => {
      try {
        const event = JSON.parse(raw) as SwarmWSEvent;
        if (!event.type) return;

        // Buffer event
        setEvents((prev) => {
          const next = [...prev, event];
          return next.length > MAX_EVENTS_BUFFER ? next.slice(-MAX_EVENTS_BUFFER) : next;
        });

        // Update convenience state
        switch (event.type) {
          case 'trade:executed':
            setLastTrade(event.data as TradeExecutedEvent);
            break;
          case 'pnl:updated':
            setLatestPnl(event.data as PnLUpdatedEvent);
            break;
          case 'phase:changed': {
            const phaseEvent = event.data as PhaseChangedEvent;
            setSwarmPhase(phaseEvent.to);
            break;
          }
          case 'health:report':
            setHealthReport(event.data as HealthReport);
            break;
          case 'agent:status': {
            const agentEvent = event.data as AgentStatusEvent;
            setAgentStatuses((prev) => {
              const next = new Map(prev);
              next.set(agentEvent.agentId, agentEvent);
              return next;
            });
            break;
          }
        }

        // Dispatch to custom subscribers
        dispatchEvent(event);
      } catch {
        // Ignore non-JSON or malformed messages
      }
    },
    [dispatchEvent],
  );

  // ── Connect ─────────────────────────────────────────────────

  const connect = useCallback(() => {
    if (!mountedRef.current) return;

    // Clean up existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      const url = swarmApi.getWebSocketUrl();
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }
        setConnected(true);
        setReconnectAttempts(0);
        retryDelayRef.current = INITIAL_RETRY_DELAY_MS;

        // Start heartbeat
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, HEARTBEAT_INTERVAL_MS);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          handleMessage(event.data);
        }
      };

      ws.onclose = () => {
        setConnected(false);
        wsRef.current = null;

        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        // Schedule reconnect with exponential backoff
        if (mountedRef.current) {
          const delay = retryDelayRef.current;
          retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
          setReconnectAttempts((prev) => prev + 1);

          retryTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      ws.onerror = () => {
        // onclose will handle reconnection
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      // Schedule retry
      if (mountedRef.current) {
        const delay = retryDelayRef.current;
        retryDelayRef.current = Math.min(delay * 2, MAX_RETRY_DELAY_MS);
        setReconnectAttempts((prev) => prev + 1);

        retryTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      }
    }
  }, [handleMessage]);

  // ── Subscribe / Unsubscribe ─────────────────────────────────

  const subscribe = useCallback(<T = unknown>(
    type: SwarmWSEventType | '*',
    handler: EventHandler<T>,
  ): string => {
    const id = `sub_${++subIdCounterRef.current}`;
    subscriptionsRef.current.push({
      id,
      type,
      handler: handler as EventHandler,
    });
    return id;
  }, []);

  const unsubscribe = useCallback((id: string) => {
    subscriptionsRef.current = subscriptionsRef.current.filter((s) => s.id !== id);
  }, []);

  // ── Force reconnect ────────────────────────────────────────

  const reconnect = useCallback(() => {
    retryDelayRef.current = INITIAL_RETRY_DELAY_MS;
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    connect();
  }, [connect]);

  // ── Lifecycle ───────────────────────────────────────────────

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;

      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }

      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
        heartbeatRef.current = null;
      }

      if (wsRef.current) {
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
    latestPnl,
    swarmPhase,
    healthReport,
    agentStatuses,
    subscribe,
    unsubscribe,
    reconnect,
  };
}
