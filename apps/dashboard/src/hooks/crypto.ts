/**
 * React Hooks for Crypto Data
 *
 * Custom hooks for real-time crypto data fetching,
 * WebSocket connections, and local storage sync.
 *
 * @module hooks/crypto
 */

'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════

interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  lastUpdated: Date | null;
}

interface UsePriceOptions {
  refreshInterval?: number;
  enabled?: boolean;
}

interface PriceData {
  price: number;
  change24h: number;
  marketCap?: number;
  volume24h?: number;
}

// ═══════════════════════════════════════════════════════════════
// DATA FETCHING HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Generic fetch hook with caching and refresh
 */
export function useFetch<T>(
  url: string | null,
  options: {
    refreshInterval?: number;
    enabled?: boolean;
    initialData?: T;
  } = {}
): FetchState<T> {
  const { refreshInterval, enabled = true, initialData = null } = options;
  const [data, setData] = useState<T | null>(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!url || !enabled) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      setData(json);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [url, enabled]);

  useEffect(() => {
    fetchData();

    if (refreshInterval && enabled) {
      const interval = setInterval(fetchData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, refreshInterval, enabled]);

  return { data, loading, error, refetch: fetchData, lastUpdated };
}

/**
 * Hook for fetching cryptocurrency prices
 */
export function useCryptoPrice(
  coinId: string,
  options: UsePriceOptions = {}
): FetchState<PriceData> & { formattedPrice: string } {
  const { refreshInterval = 30000, enabled = true } = options;

  const url = enabled && coinId ? `/api/market/price?coin=${encodeURIComponent(coinId)}` : null;

  const state = useFetch<{
    price: number;
    change24h: number;
    marketCap?: number;
    volume24h?: number;
  }>(url, { refreshInterval, enabled });

  const formattedPrice = useMemo(() => {
    if (!state.data?.price) return '$--';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: state.data.price < 1 ? 6 : 2,
    }).format(state.data.price);
  }, [state.data?.price]);

  return { ...state, formattedPrice };
}

/**
 * Hook for fetching multiple coin prices
 */
export function useMultiplePrices(
  coinIds: string[],
  options: UsePriceOptions = {}
): FetchState<Record<string, PriceData>> {
  const { refreshInterval = 30000, enabled = true } = options;

  const url =
    enabled && coinIds.length > 0
      ? `/api/market/prices?coins=${encodeURIComponent(coinIds.join(','))}`
      : null;

  return useFetch<Record<string, PriceData>>(url, { refreshInterval, enabled });
}

/**
 * Hook for fetching news articles
 */
export function useCryptoNews(
  options: {
    limit?: number;
    source?: string;
    category?: string;
    refreshInterval?: number;
  } = {}
) {
  const { limit = 10, source, category, refreshInterval = 60000 } = options;

  let url = `/api/news?limit=${limit}`;
  if (source) url += `&source=${encodeURIComponent(source)}`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  return useFetch<{
    articles: Array<{
      title: string;
      link: string;
      description?: string;
      pubDate: string;
      source: string;
      category: string;
      timeAgo: string;
    }>;
    totalCount: number;
  }>(url, { refreshInterval });
}

/**
 * Hook for trending topics
 */
export function useTrendingTopics(hours = 24) {
  return useFetch<{
    trending: Array<{
      topic: string;
      count: number;
      sentiment: 'bullish' | 'bearish' | 'neutral';
    }>;
  }>(`/api/trending?hours=${hours}`, { refreshInterval: 300000 }); // 5 min refresh
}

// ═══════════════════════════════════════════════════════════════
// WEBSOCKET HOOKS
// ═══════════════════════════════════════════════════════════════

interface WebSocketState<T> {
  data: T | null;
  connected: boolean;
  error: Error | null;
  send: (message: unknown) => void;
  reconnect: () => void;
}

/**
 * Generic WebSocket hook with auto-reconnect
 */
export function useWebSocket<T>(
  url: string | null,
  options: {
    onMessage?: (data: T) => void;
    reconnectAttempts?: number;
    reconnectInterval?: number;
  } = {}
): WebSocketState<T> {
  const { onMessage, reconnectAttempts = 5, reconnectInterval = 3000 } = options;
  const [data, setData] = useState<T | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const attemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!url) return;

    try {
      wsRef.current = new WebSocket(url);

      wsRef.current.onopen = () => {
        setConnected(true);
        setError(null);
        attemptsRef.current = 0;
      };

      wsRef.current.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data) as T;
          setData(parsed);
          onMessage?.(parsed);
        } catch {
          // Non-JSON message
        }
      };

      wsRef.current.onerror = () => {
        setError(new Error('WebSocket error'));
      };

      wsRef.current.onclose = () => {
        setConnected(false);

        // Auto-reconnect
        if (attemptsRef.current < reconnectAttempts) {
          attemptsRef.current++;
          setTimeout(connect, reconnectInterval);
        }
      };
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to connect'));
    }
  }, [url, onMessage, reconnectAttempts, reconnectInterval]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  const send = useCallback((message: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const reconnect = useCallback(() => {
    wsRef.current?.close();
    attemptsRef.current = 0;
    connect();
  }, [connect]);

  return { data, connected, error, send, reconnect };
}

/**
 * Hook for real-time price updates via WebSocket
 */
export function useLivePrices(coinIds: string[]) {
  const [prices, setPrices] = useState<Record<string, number>>({});

  const { connected, error } = useWebSocket<{
    type: string;
    data: Record<string, number>;
  }>(coinIds.length > 0 ? `/api/ws/prices?coins=${coinIds.join(',')}` : null, {
    onMessage: (message) => {
      if (message.type === 'prices') {
        setPrices((prev) => ({ ...prev, ...message.data }));
      }
    },
  });

  return { prices, connected, error };
}

// ═══════════════════════════════════════════════════════════════
// LOCAL STORAGE HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Hook for syncing state with localStorage
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue;

    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const valueToStore = value instanceof Function ? value(prev) : value;

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }

        return valueToStore;
      });
    },
    [key]
  );

  const removeValue = useCallback(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(key);
    }
    setStoredValue(initialValue);
  }, [key, initialValue]);

  return [storedValue, setValue, removeValue];
}

/**
 * Hook for managing watchlist
 */
export function useWatchlist() {
  const [watchlist, setWatchlist, clearWatchlist] = useLocalStorage<string[]>(
    'crypto-watchlist',
    []
  );

  const addCoin = useCallback(
    (coinId: string) => {
      setWatchlist((prev) => {
        if (prev.includes(coinId)) return prev;
        return [...prev, coinId];
      });
    },
    [setWatchlist]
  );

  const removeCoin = useCallback(
    (coinId: string) => {
      setWatchlist((prev) => prev.filter((id) => id !== coinId));
    },
    [setWatchlist]
  );

  const toggleCoin = useCallback(
    (coinId: string) => {
      setWatchlist((prev) =>
        prev.includes(coinId) ? prev.filter((id) => id !== coinId) : [...prev, coinId]
      );
    },
    [setWatchlist]
  );

  const isWatching = useCallback((coinId: string) => watchlist.includes(coinId), [watchlist]);

  return {
    watchlist,
    addCoin,
    removeCoin,
    toggleCoin,
    isWatching,
    clearWatchlist,
    count: watchlist.length,
  };
}

/**
 * Hook for managing bookmarked articles
 */
export function useBookmarks() {
  const [bookmarks, setBookmarks, clearBookmarks] = useLocalStorage<
    Array<{ id: string; title: string; link: string; savedAt: string }>
  >('crypto-bookmarks', []);

  const addBookmark = useCallback(
    (article: { id: string; title: string; link: string }) => {
      setBookmarks((prev) => {
        if (prev.some((b) => b.id === article.id)) return prev;
        return [...prev, { ...article, savedAt: new Date().toISOString() }];
      });
    },
    [setBookmarks]
  );

  const removeBookmark = useCallback(
    (id: string) => {
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    },
    [setBookmarks]
  );

  const isBookmarked = useCallback((id: string) => bookmarks.some((b) => b.id === id), [bookmarks]);

  return {
    bookmarks,
    addBookmark,
    removeBookmark,
    isBookmarked,
    clearBookmarks,
    count: bookmarks.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// UI UTILITY HOOKS
// ═══════════════════════════════════════════════════════════════

/**
 * Hook for debouncing a value
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook for throttling a callback
 */
export function useThrottle<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const lastRan = useRef(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();

      if (now - lastRan.current >= delay) {
        callback(...args);
        lastRan.current = now;
      } else {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(
          () => {
            callback(...args);
            lastRan.current = Date.now();
          },
          delay - (now - lastRan.current)
        );
      }
    },
    [callback, delay]
  ) as T;
}

/**
 * Hook for detecting online/offline status
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

/**
 * Hook for media queries
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const media = window.matchMedia(query);
    setMatches(media.matches);

    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);

    return () => media.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

/**
 * Hook for checking if user prefers reduced motion
 */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * Hook for checking if user prefers dark mode
 */
export function usePrefersDarkMode(): boolean {
  return useMediaQuery('(prefers-color-scheme: dark)');
}

/**
 * Hook for intersection observer (lazy loading)
 */
export function useIntersectionObserver(
  options: IntersectionObserverInit = {}
): [React.RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(element);
    return () => observer.disconnect();
  }, [options]);

  return [ref, isIntersecting];
}

/**
 * Hook for copy to clipboard
 */
export function useCopyToClipboard(): [boolean, (text: string) => Promise<boolean>] {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, []);

  return [copied, copy];
}

/**
 * Hook for countdown timer
 */
export function useCountdown(targetDate: Date | null): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
} {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: true,
  });

  useEffect(() => {
    if (!targetDate) return;

    const calculate = () => {
      const diff = targetDate.getTime() - Date.now();

      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
        isExpired: false,
      });
    };

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
}
