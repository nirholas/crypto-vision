/**
 * @fileoverview Live Price WebSocket Hook
 *
 * Real-time price updates via WebSocket with reconnection,
 * exponential backoff, and batched updates.
 *
 * @module hooks/useLivePrice
 */
'use client';

import { useState, useEffect, useRef, useCallback, useMemo, createContext, useContext, type ReactNode } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface LivePriceData {
  price: number;
  change24h: number;
  lastUpdate: number;
}

export interface UseLivePriceResult {
  price: number | null;
  change24h: number | null;
  isLive: boolean;
  lastUpdate: Date | null;
  isStale: boolean;
}

export interface UseLivePricesResult {
  prices: Record<string, LivePriceData>;
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  reconnect: () => void;
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

// =============================================================================
// WEBSOCKET CONTEXT (Shared connection)
// =============================================================================

interface WebSocketContextValue {
  status: ConnectionStatus;
  prices: Record<string, LivePriceData>;
  subscribe: (coinIds: string[]) => void;
  unsubscribe: (coinIds: string[]) => void;
  reconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

// Stale threshold: 60 seconds without update
const STALE_THRESHOLD = 60_000;

// Batch update interval: Batch updates to prevent excessive re-renders
const BATCH_INTERVAL = 100;

// =============================================================================
// WEBSOCKET PROVIDER
// =============================================================================

export interface LivePriceProviderProps {
  children: ReactNode;
  wsUrl?: string;
}

export function LivePriceProvider({
  children,
  wsUrl = 'wss://ws.coincap.io/prices',
}: LivePriceProviderProps) {
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [prices, setPrices] = useState<Record<string, LivePriceData>>({});
  
  const wsRef = useRef<WebSocket | null>(null);
  const subscribedCoins = useRef<Set<string>>(new Set());
  const reconnectAttempts = useRef(0);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const batchedUpdates = useRef<Record<string, LivePriceData>>({});
  const batchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const previousPrices = useRef<Record<string, number>>({});

  // Max reconnect attempts before giving up
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY = 1000;

  // Calculate reconnect delay with exponential backoff
  const getReconnectDelay = useCallback(() => {
    const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current);
    return Math.min(delay, 30000); // Cap at 30 seconds
  }, []);

  // Batch updates to prevent excessive re-renders
  const flushBatchedUpdates = useCallback(() => {
    if (Object.keys(batchedUpdates.current).length > 0) {
      setPrices((prev) => ({
        ...prev,
        ...batchedUpdates.current,
      }));
      batchedUpdates.current = {};
    }
  }, []);

  // Schedule batched update
  const scheduleBatchUpdate = useCallback(() => {
    if (!batchTimeoutRef.current) {
      batchTimeoutRef.current = setTimeout(() => {
        flushBatchedUpdates();
        batchTimeoutRef.current = undefined;
      }, BATCH_INTERVAL);
    }
  }, [flushBatchedUpdates]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    if (subscribedCoins.current.size === 0) return;

    setStatus('connecting');

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }

    try {
      const coinList = Array.from(subscribedCoins.current).join(',');
      const ws = new WebSocket(`${wsUrl}?assets=${coinList}`);

      ws.onopen = () => {
        console.log('[LivePrice] Connected to WebSocket');
        setStatus('connected');
        reconnectAttempts.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const timestamp = Date.now();

          Object.entries(data).forEach(([id, priceStr]) => {
            const price = parseFloat(priceStr as string);
            const prevPrice = previousPrices.current[id];
            
            // Calculate 24h change approximation based on price movement
            // In production, you'd get this from the API
            const change24h = prevPrice
              ? ((price - prevPrice) / prevPrice) * 100
              : 0;

            batchedUpdates.current[id] = {
              price,
              change24h,
              lastUpdate: timestamp,
            };

            previousPrices.current[id] = price;
          });

          scheduleBatchUpdate();
        } catch (e) {
          console.error('[LivePrice] Parse error:', e);
        }
      };

      ws.onerror = (error) => {
        console.error('[LivePrice] WebSocket error:', error);
        setStatus('error');
      };

      ws.onclose = (event) => {
        console.log('[LivePrice] Connection closed:', event.code, event.reason);
        wsRef.current = null;
        
        // Attempt reconnect if we still have subscribers
        if (subscribedCoins.current.size > 0) {
          if (reconnectAttempts.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts.current++;
            const delay = getReconnectDelay();
            console.log(`[LivePrice] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current})`);
            
            setStatus('connecting');
            reconnectTimeoutRef.current = setTimeout(connect, delay);
          } else {
            console.log('[LivePrice] Max reconnect attempts reached');
            setStatus('error');
          }
        } else {
          setStatus('disconnected');
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[LivePrice] Connection failed:', error);
      setStatus('error');
    }
  }, [wsUrl, getReconnectDelay, scheduleBatchUpdate]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = undefined;
    }
    if (batchTimeoutRef.current) {
      clearTimeout(batchTimeoutRef.current);
      batchTimeoutRef.current = undefined;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('disconnected');
  }, []);

  // Reconnect with fresh connection
  const reconnect = useCallback(() => {
    reconnectAttempts.current = 0;
    disconnect();
    connect();
  }, [connect, disconnect]);

  // Subscribe to coin price updates
  const subscribe = useCallback((coinIds: string[]) => {
    const newCoins = coinIds.filter((id) => !subscribedCoins.current.has(id));
    
    if (newCoins.length === 0) return;

    newCoins.forEach((id) => subscribedCoins.current.add(id));

    // Reconnect with new coin list if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      disconnect();
      connect();
    } else {
      connect();
    }
  }, [connect, disconnect]);

  // Unsubscribe from coin price updates
  const unsubscribe = useCallback((coinIds: string[]) => {
    coinIds.forEach((id) => subscribedCoins.current.delete(id));

    // If no more subscriptions, disconnect
    if (subscribedCoins.current.size === 0) {
      disconnect();
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      // Reconnect with updated coin list
      disconnect();
      connect();
    }
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const contextValue = useMemo(
    () => ({
      status,
      prices,
      subscribe,
      unsubscribe,
      reconnect,
    }),
    [status, prices, subscribe, unsubscribe, reconnect]
  );

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
}

// =============================================================================
// HOOKS
// =============================================================================

/**
 * Hook to get live price for a single coin
 */
export function useLivePrice(
  coinId: string,
  initialPrice?: number
): UseLivePriceResult {
  const context = useContext(WebSocketContext);
  
  const [localPrice] = useState<number | null>(initialPrice ?? null);

  // Subscribe to this coin
  useEffect(() => {
    if (context) {
      context.subscribe([coinId]);
      return () => context.unsubscribe([coinId]);
    }
  }, [context, coinId]);

  // Get price from context or fallback
  const priceData = context?.prices[coinId];
  const price = priceData?.price ?? localPrice;
  const change24h = priceData?.change24h ?? null;
  const lastUpdate = priceData?.lastUpdate ? new Date(priceData.lastUpdate) : null;
  const isLive = context?.status === 'connected' && !!priceData;
  const isStale = priceData
    ? Date.now() - priceData.lastUpdate > STALE_THRESHOLD
    : false;

  return {
    price,
    change24h,
    isLive,
    lastUpdate,
    isStale,
  };
}

/**
 * Hook to get live prices for multiple coins
 */
export function useLivePrices(coinIds: string[]): UseLivePricesResult {
  const context = useContext(WebSocketContext);

  // Subscribe to all coins
  useEffect(() => {
    if (context && coinIds.length > 0) {
      context.subscribe(coinIds);
      return () => context.unsubscribe(coinIds);
    }
  }, [context, coinIds]);

  if (!context) {
    return {
      prices: {},
      isConnected: false,
      isConnecting: false,
      connectionError: null,
      reconnect: () => {},
    };
  }

  return {
    prices: context.prices,
    isConnected: context.status === 'connected',
    isConnecting: context.status === 'connecting',
    connectionError: context.status === 'error' ? 'Connection failed' : null,
    reconnect: context.reconnect,
  };
}

/**
 * Hook to get WebSocket connection status
 */
export function useConnectionStatus(): {
  status: ConnectionStatus;
  reconnect: () => void;
} {
  const context = useContext(WebSocketContext);

  return {
    status: context?.status ?? 'disconnected',
    reconnect: context?.reconnect ?? (() => {}),
  };
}

export default useLivePrice;
