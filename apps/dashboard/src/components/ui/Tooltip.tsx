/**
 * @fileoverview Premium Tooltip Component
 * 
 * Lightweight tooltip with elegant styling and positioning.
 * 
 * @module components/ui/Tooltip
 */
'use client';

import { useState, useRef, ReactNode, useEffect } from 'react';

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  className?: string;
}

export default function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  className = '',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showTooltip = () => {
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses = {
    top: 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rotate-45',
    bottom: 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45',
    left: 'right-0 top-1/2 -translate-y-1/2 translate-x-1/2 rotate-45',
    right: 'left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 rotate-45',
  };

  return (
    <div 
      className="relative inline-flex"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && content && (
        <div
          role="tooltip"
          className={`
            absolute z-50 px-3 py-2
            bg-surface-elevated text-text-primary text-sm
            rounded-lg shadow-lg border border-surface-border
            whitespace-nowrap animate-scale-in
            ${positionClasses[position]}
            ${className}
          `}
        >
          <div
            className={`
              absolute w-2 h-2
              bg-surface-elevated border-surface-border
              ${position === 'top' ? 'border-r border-b' : ''}
              ${position === 'bottom' ? 'border-l border-t' : ''}
              ${position === 'left' ? 'border-t border-r' : ''}
              ${position === 'right' ? 'border-b border-l' : ''}
              ${arrowClasses[position]}
            `}
          />
          {content}
        </div>
      )}
    </div>
  );
}
