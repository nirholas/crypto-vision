/**
 * Price Flash Hook
 * 
 * Detects price changes and returns flash direction for visual feedback.
 * Auto-clears flash state after animation duration.
 * Debounces rapid changes to prevent flashing overload.
 */

'use client';

import { useState, useEffect, useRef } from 'react';

export type FlashDirection = 'up' | 'down' | null;

export interface UsePriceFlashOptions {
  price: number | null;
  debounceMs?: number;
  flashDurationMs?: number;
  threshold?: number; // Minimum change percentage to trigger flash
}

export interface UsePriceFlashReturn {
  flashDirection: FlashDirection;
  isFlashing: boolean;
  previousPrice: number | null;
  priceChange: number;
  priceChangePercent: number;
}

/**
 * Hook that detects price changes and returns flash direction
 */
export function usePriceFlash({
  price,
  debounceMs = 100,
  flashDurationMs = 500,
  threshold = 0,
}: UsePriceFlashOptions): UsePriceFlashReturn {
  const [flashDirection, setFlashDirection] = useState<FlashDirection>(null);
  const [previousPrice, setPreviousPrice] = useState<number | null>(null);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);
  
  const lastPriceRef = useRef<number | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flashTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      lastPriceRef.current = price;
      setPreviousPrice(price);
      return;
    }

    if (price === null || price === lastPriceRef.current) return;

    // Clear any pending debounce
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      const oldPrice = lastPriceRef.current;
      
      if (oldPrice !== null && price !== oldPrice) {
        const change = price - oldPrice;
        const changePercent = (change / oldPrice) * 100;
        
        // Update price change values
        setPriceChange(change);
        setPriceChangePercent(changePercent);
        
        // Only flash if change exceeds threshold
        if (Math.abs(changePercent) >= threshold) {
          const direction: FlashDirection = change > 0 ? 'up' : 'down';
          setFlashDirection(direction);
          
          // Clear any pending flash timeout
          if (flashTimeoutRef.current) {
            clearTimeout(flashTimeoutRef.current);
          }
          
          // Auto-clear flash after duration
          flashTimeoutRef.current = setTimeout(() => {
            setFlashDirection(null);
          }, flashDurationMs);
        }
      }
      
      setPreviousPrice(lastPriceRef.current);
      lastPriceRef.current = price;
    }, debounceMs);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [price, debounceMs, flashDurationMs, threshold]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, []);

  return {
    flashDirection,
    isFlashing: flashDirection !== null,
    previousPrice,
    priceChange,
    priceChangePercent,
  };
}

export default usePriceFlash;
