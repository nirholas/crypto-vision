'use client';

/**
 * Trend Indicator Component
 * Displays an animated up/down arrow with percentage change
 */

import { useEffect, useState, useRef } from 'react';

interface TrendIndicatorProps {
  value: number | null | undefined;
  showValue?: boolean;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
}

export default function TrendIndicator({
  value,
  showValue = true,
  size = 'sm',
  animate = true,
}: TrendIndicatorProps) {
  const [displayValue, setDisplayValue] = useState(value ?? 0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value == null) return;
    
    if (animate && prevValue.current !== value) {
      setIsAnimating(true);
      
      // Animate the number change
      const start = prevValue.current ?? 0;
      const end = value;
      const duration = 500;
      const startTime = Date.now();
      
      const animateValue = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Ease out cubic
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = start + (end - start) * easeOut;
        
        setDisplayValue(current);
        
        if (progress < 1) {
          requestAnimationFrame(animateValue);
        } else {
          setIsAnimating(false);
        }
      };
      
      requestAnimationFrame(animateValue);
      prevValue.current = value;
    } else {
      setDisplayValue(value);
    }
  }, [value, animate]);

  const isPositive = (value ?? 0) >= 0;
  const formattedValue = (isPositive ? '+' : '') + displayValue.toFixed(2) + '%';

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-0.5 font-medium
        ${sizeClasses[size]}
        ${isPositive ? 'text-gain' : 'text-loss'}
        ${isAnimating ? 'animate-pulse' : ''}
        transition-colors duration-300
      `}
    >
      {/* Arrow Icon */}
      <svg
        className={`${iconSize[size]} transition-transform duration-300 ${
          isPositive ? '' : 'rotate-180'
        }`}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 15l7-7 7 7"
        />
      </svg>
      
      {showValue && (
        <span className="tabular-nums">{formattedValue}</span>
      )}
    </span>
  );
}
