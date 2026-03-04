/**
 * @fileoverview FormattedNumber Component
 * 
 * Professional number display with monospace font, alignment,
 * color-coding, and optional animations.
 * 
 * @module components/ui/FormattedNumber
 */
'use client';

import { memo, useEffect, useRef, useState } from 'react';
import {
  formatPrice,
  formatCurrency,
  formatCompact,
  formatPercentage,
  formatSupply,
  getPercentColorClass,
} from '@/lib/format-numbers';

// =============================================================================
// TYPES
// =============================================================================

export type NumberType = 'price' | 'currency' | 'percent' | 'supply' | 'compact' | 'raw';

export interface FormattedNumberProps {
  /** The numeric value to display */
  value: number | null | undefined;
  /** Type of formatting to apply */
  type?: NumberType;
  /** Token symbol (required for 'supply' type) */
  symbol?: string;
  /** Show +/- prefix for changes */
  showSign?: boolean;
  /** Color-code gains (green) and losses (red) */
  colorize?: boolean;
  /** Use tabular/monospace numerals */
  mono?: boolean;
  /** Right-align for table columns */
  align?: 'left' | 'center' | 'right';
  /** Animate on value change */
  animate?: boolean;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional class names */
  className?: string;
  /** Prefix string (e.g., '$') */
  prefix?: string;
  /** Suffix string (e.g., '%') */
  suffix?: string;
  /** Number of decimal places (for raw type) */
  decimals?: number;
}

// =============================================================================
// SIZE CLASSES
// =============================================================================

const sizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-xl',
};

// =============================================================================
// COMPONENT
// =============================================================================

function FormattedNumberComponent({
  value,
  type = 'raw',
  symbol = '',
  showSign = false,
  colorize = false,
  mono = true,
  align = 'right',
  animate = false,
  size = 'md',
  className = '',
  prefix = '',
  suffix = '',
  decimals = 2,
}: FormattedNumberProps) {
  const [displayValue, setDisplayValue] = useState<string>('');
  const [isAnimating, setIsAnimating] = useState(false);
  const [changeDirection, setChangeDirection] = useState<'up' | 'down' | null>(null);
  const prevValueRef = useRef<number | null | undefined>(value);

  // Format the value based on type
  useEffect(() => {
    let formatted: string;

    switch (type) {
      case 'price':
        formatted = formatPrice(value);
        break;
      case 'currency':
        formatted = formatCurrency(value);
        break;
      case 'compact':
        formatted = formatCompact(value);
        break;
      case 'percent': {
        const result = formatPercentage(value, { showPlus: showSign });
        formatted = result.formatted;
        break;
      }
      case 'supply':
        formatted = formatSupply(value, symbol);
        break;
      case 'raw':
      default:
        if (value == null || isNaN(value)) {
          formatted = '0';
        } else {
          formatted = value.toLocaleString('en-US', {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
          });
        }
        break;
    }

    // Add prefix/suffix for raw type
    if (type === 'raw') {
      formatted = `${prefix}${formatted}${suffix}`;
    }

    // Handle animation
    if (animate && prevValueRef.current !== value) {
      const prevVal = prevValueRef.current ?? 0;
      const newVal = value ?? 0;
      
      if (newVal > prevVal) {
        setChangeDirection('up');
      } else if (newVal < prevVal) {
        setChangeDirection('down');
      }
      
      setIsAnimating(true);
      setTimeout(() => {
        setIsAnimating(false);
        setChangeDirection(null);
      }, 500);
    }

    prevValueRef.current = value;
    setDisplayValue(formatted);
  }, [value, type, symbol, showSign, prefix, suffix, decimals, animate]);

  // Determine color class
  const getColorClass = (): string => {
    if (!colorize) return 'text-text-primary';
    
    if (type === 'percent') {
      return getPercentColorClass(value);
    }
    
    // For other types with sign display
    if (value == null || value === 0) return 'text-text-muted';
    return value > 0 ? 'text-gain' : 'text-loss';
  };

  // Alignment classes
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  // Animation classes
  const getAnimationClass = (): string => {
    if (!isAnimating || !changeDirection) return '';
    return changeDirection === 'up' 
      ? 'animate-flash-green' 
      : 'animate-flash-red';
  };

  return (
    <span
      className={`
        ${mono ? 'font-mono tabular-nums' : ''}
        ${sizeClasses[size]}
        ${alignClasses[align]}
        ${getColorClass()}
        ${getAnimationClass()}
        ${className}
      `.trim().replace(/\s+/g, ' ')}
    >
      {displayValue}
    </span>
  );
}

// Memoize for performance in tables
export const FormattedNumber = memo(FormattedNumberComponent);

// =============================================================================
// SPECIALIZED VARIANTS
// =============================================================================

export interface PriceDisplayProps {
  value: number | null | undefined;
  size?: FormattedNumberProps['size'];
  className?: string;
  animate?: boolean;
}

/**
 * Optimized component for displaying prices
 */
export const PriceDisplay = memo(function PriceDisplay({
  value,
  size = 'md',
  className = '',
  animate = false,
}: PriceDisplayProps) {
  return (
    <FormattedNumber
      value={value}
      type="price"
      size={size}
      className={className}
      animate={animate}
    />
  );
});

export interface PercentChangeProps {
  value: number | null | undefined;
  size?: FormattedNumberProps['size'];
  showIcon?: boolean;
  className?: string;
}

/**
 * Optimized component for displaying percentage changes
 */
export const PercentChange = memo(function PercentChange({
  value,
  size = 'md',
  showIcon = false,
  className = '',
}: PercentChangeProps) {
  const isPositive = (value ?? 0) >= 0;
  
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {showIcon && (
        <svg
          className={`w-3 h-3 ${isPositive ? '' : 'rotate-180'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <FormattedNumber
        value={value}
        type="percent"
        showSign
        colorize
        size={size}
      />
    </span>
  );
});

export interface MarketCapDisplayProps {
  value: number | null | undefined;
  size?: FormattedNumberProps['size'];
  className?: string;
}

/**
 * Optimized component for displaying market cap
 */
export const MarketCapDisplay = memo(function MarketCapDisplay({
  value,
  size = 'md',
  className = '',
}: MarketCapDisplayProps) {
  return (
    <FormattedNumber
      value={value}
      type="currency"
      size={size}
      className={className}
    />
  );
});

export interface SupplyDisplayProps {
  value: number | null | undefined;
  symbol: string;
  size?: FormattedNumberProps['size'];
  className?: string;
}

/**
 * Optimized component for displaying token supply
 */
export const SupplyDisplay = memo(function SupplyDisplay({
  value,
  symbol,
  size = 'md',
  className = '',
}: SupplyDisplayProps) {
  return (
    <FormattedNumber
      value={value}
      type="supply"
      symbol={symbol}
      size={size}
      className={className}
    />
  );
});

// Default export
export default FormattedNumber;
