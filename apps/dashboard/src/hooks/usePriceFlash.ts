/**
 * @fileoverview Price Flash Hook
 *
 * Detects price changes and returns flash direction for visual feedback.
 * Auto-clears flash state after animation, debounces rapid changes.
 *
 * @module hooks/usePriceFlash
 */
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type FlashDirection = 'up' | 'down' | null;

export interface UsePriceFlashOptions {
  /** Animation duration in milliseconds (default: 500ms) */
  duration?: number;
  /** Debounce time for rapid changes in milliseconds (default: 100ms) */
  debounceMs?: number;
  /** Minimum price change percentage to trigger flash (default: 0) */
  threshold?: number;
  /** Whether to respect prefers-reduced-motion (default: true) */
  respectMotion?: boolean;
}

export interface UsePriceFlashResult {
  /** Current flash direction: 'up', 'down', or null */
  flash: FlashDirection;
  /** Whether currently flashing */
  isFlashing: boolean;
  /** CSS class for the flash state */
  flashClass: string;
  /** Manually trigger a flash */
  triggerFlash: (direction: FlashDirection) => void;
  /** Reset flash state immediately */
  resetFlash: () => void;
}

// =============================================================================
// HOOK IMPLEMENTATION
// =============================================================================

/**
 * Hook that detects price changes and manages flash state
 *
 * @param currentPrice - Current price value to track
 * @param options - Configuration options
 * @returns Flash state and control functions
 *
 * @example
 * ```tsx
 * const { flash, flashClass } = usePriceFlash(price);
 * return <span className={flashClass}>${price}</span>;
 * ```
 */
export function usePriceFlash(
  currentPrice: number | null | undefined,
  options: UsePriceFlashOptions = {}
): UsePriceFlashResult {
  const {
    duration = 500,
    debounceMs = 100,
    threshold = 0,
    respectMotion = true,
  } = options;

  const [flash, setFlash] = useState<FlashDirection>(null);
  const previousPriceRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const prefersReducedMotion = useRef(false);

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window !== 'undefined' && respectMotion) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      prefersReducedMotion.current = mediaQuery.matches;

      const handler = (e: MediaQueryListEvent) => {
        prefersReducedMotion.current = e.matches;
      };

      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [respectMotion]);

  // Trigger flash with optional direction
  const triggerFlash = useCallback(
    (direction: FlashDirection) => {
      // Skip if reduced motion is preferred
      if (prefersReducedMotion.current && respectMotion) return;
      if (!direction) return;

      // Clear any pending timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      setFlash(direction);

      // Auto-clear after duration
      timeoutRef.current = setTimeout(() => {
        setFlash(null);
      }, duration);
    },
    [duration, respectMotion]
  );

  // Reset flash immediately
  const resetFlash = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setFlash(null);
  }, []);

  // Detect price changes
  useEffect(() => {
    if (currentPrice === null || currentPrice === undefined) return;

    const prevPrice = previousPriceRef.current;

    // Skip first render or no previous price
    if (prevPrice === null) {
      previousPriceRef.current = currentPrice;
      return;
    }

    // Calculate change
    const change = currentPrice - prevPrice;
    const changePercent = prevPrice !== 0 ? Math.abs(change / prevPrice) * 100 : 0;

    // Skip if below threshold
    if (changePercent < threshold) {
      previousPriceRef.current = currentPrice;
      return;
    }

    // Determine direction
    const direction: FlashDirection =
      change > 0 ? 'up' : change < 0 ? 'down' : null;

    // Debounce rapid changes
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      triggerFlash(direction);
      previousPriceRef.current = currentPrice;
    }, debounceMs);

    // Update previous price immediately for next comparison
    previousPriceRef.current = currentPrice;

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [currentPrice, threshold, debounceMs, triggerFlash]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Generate CSS class
  const flashClass = flash === 'up'
    ? 'price-flash-up'
    : flash === 'down'
      ? 'price-flash-down'
      : '';

  return {
    flash,
    isFlashing: flash !== null,
    flashClass,
    triggerFlash,
    resetFlash,
  };
}

/**
 * Hook for batch price flash tracking
 * Useful for tables with many prices
 */
export function usePriceFlashes(
  prices: Record<string, number | null | undefined>,
  options: UsePriceFlashOptions = {}
): Record<string, FlashDirection> {
  const [flashes, setFlashes] = useState<Record<string, FlashDirection>>({});
  const previousPricesRef = useRef<Record<string, number>>({});
  const timeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const { duration = 500, threshold = 0 } = options;

  useEffect(() => {
    const newFlashes: Record<string, FlashDirection> = {};

    Object.entries(prices).forEach(([id, price]) => {
      if (price === null || price === undefined) return;

      const prevPrice = previousPricesRef.current[id];

      if (prevPrice !== undefined && prevPrice !== price) {
        const change = price - prevPrice;
        const changePercent = prevPrice !== 0 ? Math.abs(change / prevPrice) * 100 : 0;

        if (changePercent >= threshold) {
          newFlashes[id] = change > 0 ? 'up' : 'down';

          // Clear previous timeout for this ID
          if (timeoutsRef.current[id]) {
            clearTimeout(timeoutsRef.current[id]);
          }

          // Set timeout to clear flash
          timeoutsRef.current[id] = setTimeout(() => {
            setFlashes((prev) => {
              const next = { ...prev };
              delete next[id];
              return next;
            });
          }, duration);
        }
      }

      previousPricesRef.current[id] = price;
    });

    if (Object.keys(newFlashes).length > 0) {
      setFlashes((prev) => ({ ...prev, ...newFlashes }));
    }

    return () => {
      Object.values(timeoutsRef.current).forEach(clearTimeout);
    };
  }, [prices, duration, threshold]);

  return flashes;
}

export default usePriceFlash;
