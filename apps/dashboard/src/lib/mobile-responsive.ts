/**
 * Mobile Responsiveness Utilities & Audit
 * 
 * This file provides:
 * - Responsive breakpoint utilities
 * - Touch interaction helpers
 * - Mobile-first utility classes
 * - Viewport detection hooks
 * 
 * Mobile Audit Checklist:
 * ✅ MobileNav - Full-screen slide-in drawer, touch-friendly targets (44px+)
 * ✅ Header - Responsive breakpoints, mobile menu trigger
 * ✅ Touch targets - Minimum 44x44px for all interactive elements
 * ✅ Font scaling - Proper responsive typography
 * ✅ Scroll behavior - overscroll-contain, smooth scrolling
 * ✅ Forms - Mobile keyboard handling, input zoom prevention
 * ✅ Images - Responsive sizing, lazy loading
 * ✅ Modal dialogs - Full-screen on mobile, proper focus trap
 * ✅ Bottom navigation - Fixed footer nav for mobile
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';

// =============================================================================
// BREAKPOINTS
// =============================================================================

export const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

// =============================================================================
// VIEWPORT DETECTION
// =============================================================================

export function useViewport() {
  const [viewport, setViewport] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    height: typeof window !== 'undefined' ? window.innerHeight : 768,
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isLandscape: false,
    isPortrait: true,
    isTouchDevice: false,
    safeAreaInsets: {
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    },
  });

  useEffect(() => {
    const updateViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Safe area insets for notched devices
      const style = getComputedStyle(document.documentElement);
      const safeAreaInsets = {
        top: parseInt(style.getPropertyValue('--sat') || '0', 10),
        bottom: parseInt(style.getPropertyValue('--sab') || '0', 10),
        left: parseInt(style.getPropertyValue('--sal') || '0', 10),
        right: parseInt(style.getPropertyValue('--sar') || '0', 10),
      };

      setViewport({
        width,
        height,
        isMobile: width < BREAKPOINTS.md,
        isTablet: width >= BREAKPOINTS.md && width < BREAKPOINTS.lg,
        isDesktop: width >= BREAKPOINTS.lg,
        isLandscape: width > height,
        isPortrait: height >= width,
        isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        safeAreaInsets,
      });
    };

    // Initial update
    updateViewport();

    // Listen for resize
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  return viewport;
}

// =============================================================================
// RESPONSIVE VALUE SELECTOR
// =============================================================================

export function useResponsiveValue<T>(values: {
  xs?: T;
  sm?: T;
  md?: T;
  lg?: T;
  xl?: T;
  '2xl'?: T;
}): T | undefined {
  const { width } = useViewport();

  return useMemo(() => {
    const breakpoints = Object.entries(BREAKPOINTS)
      .sort(([, a], [, b]) => b - a);

    for (const [key, minWidth] of breakpoints) {
      if (width >= minWidth && values[key as Breakpoint] !== undefined) {
        return values[key as Breakpoint];
      }
    }

    return values.xs;
  }, [width, values]);
}

// =============================================================================
// TOUCH INTERACTION HELPERS
// =============================================================================

export function useTouchInteractions() {
  const [touchState, setTouchState] = useState({
    isTouching: false,
    touchStartX: 0,
    touchStartY: 0,
    touchCurrentX: 0,
    touchCurrentY: 0,
    swipeDirection: null as 'left' | 'right' | 'up' | 'down' | null,
  });

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchState(prev => ({
      ...prev,
      isTouching: true,
      touchStartX: touch.clientX,
      touchStartY: touch.clientY,
      touchCurrentX: touch.clientX,
      touchCurrentY: touch.clientY,
      swipeDirection: null,
    }));
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setTouchState(prev => {
      const deltaX = touch.clientX - prev.touchStartX;
      const deltaY = touch.clientY - prev.touchStartY;
      
      let swipeDirection: typeof prev.swipeDirection = null;
      const threshold = 30;
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > threshold) swipeDirection = 'right';
        else if (deltaX < -threshold) swipeDirection = 'left';
      } else {
        if (deltaY > threshold) swipeDirection = 'down';
        else if (deltaY < -threshold) swipeDirection = 'up';
      }

      return {
        ...prev,
        touchCurrentX: touch.clientX,
        touchCurrentY: touch.clientY,
        swipeDirection,
      };
    });
  }, []);

  const handleTouchEnd = useCallback(() => {
    setTouchState(prev => ({
      ...prev,
      isTouching: false,
    }));
  }, []);

  return {
    touchState,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd,
    },
  };
}

// =============================================================================
// SWIPE TO CLOSE HOOK
// =============================================================================

export function useSwipeToClose(
  onClose: () => void,
  options: {
    direction?: 'left' | 'right' | 'down';
    threshold?: number;
    enabled?: boolean;
  } = {}
) {
  const { direction = 'right', threshold = 100, enabled = true } = options;
  const { touchState, handlers } = useTouchInteractions();

  const handleTouchEnd = useCallback(() => {
    if (!enabled) return;
    
    const deltaX = touchState.touchCurrentX - touchState.touchStartX;
    const deltaY = touchState.touchCurrentY - touchState.touchStartY;

    switch (direction) {
      case 'left':
        if (deltaX < -threshold) onClose();
        break;
      case 'right':
        if (deltaX > threshold) onClose();
        break;
      case 'down':
        if (deltaY > threshold) onClose();
        break;
    }

    handlers.onTouchEnd();
  }, [enabled, direction, threshold, touchState, handlers, onClose]);

  return {
    handlers: {
      ...handlers,
      onTouchEnd: handleTouchEnd,
    },
    progress: useMemo(() => {
      if (!touchState.isTouching) return 0;
      
      const delta = direction === 'down'
        ? touchState.touchCurrentY - touchState.touchStartY
        : touchState.touchCurrentX - touchState.touchStartX;
      
      if (direction === 'left') return Math.max(0, Math.min(1, -delta / threshold));
      return Math.max(0, Math.min(1, delta / threshold));
    }, [touchState, direction, threshold]),
  };
}

// =============================================================================
// SAFE AREA INSETS CSS VARIABLES
// =============================================================================

export function useSafeAreaInsets() {
  useEffect(() => {
    // Set CSS variables for safe area insets
    const style = document.documentElement.style;
    
    style.setProperty('--sat', 'env(safe-area-inset-top, 0px)');
    style.setProperty('--sab', 'env(safe-area-inset-bottom, 0px)');
    style.setProperty('--sal', 'env(safe-area-inset-left, 0px)');
    style.setProperty('--sar', 'env(safe-area-inset-right, 0px)');
  }, []);
}

// =============================================================================
// MOBILE KEYBOARD DETECTION
// =============================================================================

export function useMobileKeyboard() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      // On mobile, the viewport height changes when keyboard opens
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      
      const heightDiff = windowHeight - viewportHeight;
      const isOpen = heightDiff > 100; // Threshold to detect keyboard
      
      setIsKeyboardOpen(isOpen);
      setKeyboardHeight(isOpen ? heightDiff : 0);
    };

    // Use visualViewport API if available
    const visualViewport = window.visualViewport;
    if (visualViewport) {
      visualViewport.addEventListener('resize', handleResize);
      visualViewport.addEventListener('scroll', handleResize);
    }

    window.addEventListener('resize', handleResize);

    return () => {
      if (visualViewport) {
        visualViewport.removeEventListener('resize', handleResize);
        visualViewport.removeEventListener('scroll', handleResize);
      }
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return { isKeyboardOpen, keyboardHeight };
}

// =============================================================================
// PREVENT ZOOM ON INPUT FOCUS (iOS)
// =============================================================================

export function usePreventInputZoom() {
  useEffect(() => {
    // Set font-size to 16px minimum to prevent iOS zoom
    const metaViewport = document.querySelector('meta[name=viewport]');
    if (metaViewport) {
      const content = metaViewport.getAttribute('content') || '';
      if (!content.includes('maximum-scale')) {
        metaViewport.setAttribute(
          'content',
          `${content}, maximum-scale=1.0, user-scalable=0`
        );
      }
    }
  }, []);
}

// =============================================================================
// TOUCH RIPPLE EFFECT
// =============================================================================

export function useTouchRipple() {
  const createRipple = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    
    const x = 'touches' in e 
      ? e.touches[0].clientX - rect.left 
      : e.clientX - rect.left;
    const y = 'touches' in e 
      ? e.touches[0].clientY - rect.top 
      : e.clientY - rect.top;
    
    const ripple = document.createElement('span');
    ripple.className = 'touch-ripple';
    ripple.style.cssText = `
      position: absolute;
      left: ${x}px;
      top: ${y}px;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: currentColor;
      opacity: 0.3;
      transform: translate(-50%, -50%);
      pointer-events: none;
      animation: ripple 0.6s ease-out forwards;
    `;
    
    target.style.position = 'relative';
    target.style.overflow = 'hidden';
    target.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  }, []);

  return { createRipple };
}

// =============================================================================
// RESPONSIVE GRID UTILITY
// =============================================================================

export function getResponsiveGridCols(
  width: number,
  options: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  } = {}
): number {
  const { xs = 1, sm = 2, md = 3, lg = 4, xl = 5, '2xl': xxl = 6 } = options;

  if (width >= BREAKPOINTS['2xl']) return xxl;
  if (width >= BREAKPOINTS.xl) return xl;
  if (width >= BREAKPOINTS.lg) return lg;
  if (width >= BREAKPOINTS.md) return md;
  if (width >= BREAKPOINTS.sm) return sm;
  return xs;
}

// =============================================================================
// MOBILE-FIRST UTILITY CLASSES (Tailwind-compatible)
// =============================================================================

export const mobileClasses = {
  // Touch-friendly tap targets (minimum 44x44px)
  touchTarget: 'min-w-[44px] min-h-[44px] flex items-center justify-center',
  
  // Safe area padding
  safeTop: 'pt-[env(safe-area-inset-top)]',
  safeBottom: 'pb-[env(safe-area-inset-bottom)]',
  safeLeft: 'pl-[env(safe-area-inset-left)]',
  safeRight: 'pr-[env(safe-area-inset-right)]',
  safeAll: 'p-[env(safe-area-inset-top)] p-[env(safe-area-inset-right)] p-[env(safe-area-inset-bottom)] p-[env(safe-area-inset-left)]',
  
  // Mobile scroll behavior
  scrollSnap: 'scroll-snap-type-x-mandatory scroll-snap-align-start',
  overscrollContain: 'overscroll-contain',
  
  // Mobile typography
  mobileTitle: 'text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold',
  mobileBody: 'text-sm sm:text-base',
  mobileCaption: 'text-xs sm:text-sm',
  
  // Mobile spacing
  mobilePadding: 'px-4 sm:px-6 lg:px-8',
  mobileGap: 'gap-3 sm:gap-4 lg:gap-6',
  
  // Mobile grid
  mobileGrid: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
  
  // Bottom navigation
  bottomNav: 'fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-area-pb',
  
  // Mobile modal
  mobileModal: 'fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-lg sm:w-full sm:rounded-2xl',
  
  // Mobile card
  mobileCard: 'p-4 sm:p-6 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-800',
};

// Export ripple animation CSS
export const rippleStyles = `
@keyframes ripple {
  from {
    width: 0;
    height: 0;
    opacity: 0.5;
  }
  to {
    width: 300px;
    height: 300px;
    opacity: 0;
  }
}
`;

export default {
  BREAKPOINTS,
  useViewport,
  useResponsiveValue,
  useTouchInteractions,
  useSwipeToClose,
  useSafeAreaInsets,
  useMobileKeyboard,
  usePreventInputZoom,
  useTouchRipple,
  getResponsiveGridCols,
  mobileClasses,
};
