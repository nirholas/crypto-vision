'use client';

/**
 * Stat Item Component
 * Reusable stat display with animated values, tooltips, and interactivity
 */

import { useEffect, useState, useRef, ReactNode } from 'react';
import Link from 'next/link';

interface StatItemProps {
  /** Label text */
  label: string;
  /** Current value to display */
  value: string | number;
  /** Optional prefix (e.g., "$") */
  prefix?: string;
  /** Optional suffix (e.g., "%", "Gwei") */
  suffix?: string;
  /** Optional icon or component to display before value */
  icon?: ReactNode;
  /** Optional trailing component (trend indicator, mini chart, etc.) */
  trailing?: ReactNode;
  /** Link destination when clicked */
  href?: string;
  /** Tooltip content */
  tooltip?: string;
  /** Custom color class */
  colorClass?: string;
  /** Animate number changes */
  animate?: boolean;
  /** Show pulse animation on update */
  pulseOnUpdate?: boolean;
}

function AnimatedNumber({ 
  value, 
  animate = true,
  onAnimationComplete 
}: { 
  value: string | number;
  animate?: boolean;
  onAnimationComplete?: () => void;
}) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValue = useRef(value);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }

    // Check if value actually changed
    if (prevValue.current !== value) {
      setIsNew(true);
      
      // If it's a number, animate it
      if (typeof value === 'number' && typeof prevValue.current === 'number') {
        const start = prevValue.current;
        const end = value;
        const duration = 400;
        const startTime = Date.now();
        
        const animateValue = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easeOut = 1 - Math.pow(1 - progress, 3);
          const current = start + (end - start) * easeOut;
          
          setDisplayValue(current);
          
          if (progress < 1) {
            requestAnimationFrame(animateValue);
          } else {
            setIsNew(false);
            onAnimationComplete?.();
          }
        };
        
        requestAnimationFrame(animateValue);
      } else {
        // For strings, just update with a fade
        setDisplayValue(value);
        setTimeout(() => {
          setIsNew(false);
          onAnimationComplete?.();
        }, 300);
      }
      
      prevValue.current = value;
    }
  }, [value, animate, onAnimationComplete]);

  const formattedValue = typeof displayValue === 'number' 
    ? displayValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : displayValue;

  return (
    <span 
      className={`
        tabular-nums transition-all duration-300
        ${isNew ? 'animate-count-up' : ''}
      `}
    >
      {formattedValue}
    </span>
  );
}

export default function StatItem({
  label,
  value,
  prefix = '',
  suffix = '',
  icon,
  trailing,
  href,
  tooltip,
  colorClass = 'text-text-primary',
  animate = true,
  pulseOnUpdate = true,
}: StatItemProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const prevValue = useRef(value);

  // Trigger pulse on value change
  useEffect(() => {
    if (pulseOnUpdate && prevValue.current !== value) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 500);
      prevValue.current = value;
      return () => clearTimeout(timer);
    }
  }, [value, pulseOnUpdate]);

  const content = (
    <div
      className={`
        relative flex items-center gap-1.5 px-3 py-1 whitespace-nowrap
        rounded-md transition-all duration-200
        hover:bg-surface-hover cursor-pointer
        ${isPulsing ? 'ring-1 ring-primary/30' : ''}
      `}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Icon */}
      {icon && (
        <span className="flex-shrink-0 text-text-muted">
          {icon}
        </span>
      )}
      
      {/* Label */}
      <span className="text-text-muted text-xs font-medium hidden sm:inline">
        {label}:
      </span>
      <span className="text-text-muted text-xs font-medium sm:hidden">
        {label.split(' ')[0]}:
      </span>
      
      {/* Value */}
      <span className={`font-semibold text-sm ${colorClass}`}>
        {prefix}
        <AnimatedNumber value={value} animate={animate} />
        {suffix}
      </span>
      
      {/* Trailing component (trend indicator, mini chart, etc.) */}
      {trailing && (
        <span className="flex-shrink-0 ml-0.5">
          {trailing}
        </span>
      )}

      {/* Tooltip */}
      {tooltip && showTooltip && (
        <div 
          className="
            absolute bottom-full left-1/2 -translate-x-1/2 mb-2 
            px-3 py-2 bg-surface-elevated rounded-lg shadow-elevated
            text-xs text-text-secondary whitespace-nowrap z-50
            animate-fade-in pointer-events-none
            border border-surface-border
          "
        >
          {tooltip}
          <div 
            className="
              absolute top-full left-1/2 -translate-x-1/2 -mt-1
              border-4 border-transparent border-t-surface-elevated
            " 
          />
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
