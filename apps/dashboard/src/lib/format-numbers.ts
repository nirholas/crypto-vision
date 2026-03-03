/**
 * @fileoverview Professional Number Formatting Utilities
 * 
 * DeFiLlama-style number formatting for cryptocurrency data.
 * Handles currency, percentages, supply, and compact notation.
 * 
 * @module lib/format-numbers
 */

// =============================================================================
// TYPES
// =============================================================================

export interface FormatOptions {
  /** Locale for number formatting (default: 'en-US') */
  locale?: string;
  /** Currency code (default: 'USD') */
  currency?: string;
  /** Show + prefix for positive numbers */
  showPlus?: boolean;
  /** Minimum fraction digits */
  minimumFractionDigits?: number;
  /** Maximum fraction digits */
  maximumFractionDigits?: number;
  /** Use compact notation (K, M, B, T) */
  compact?: boolean;
}

export interface PercentageResult {
  /** Formatted string with % */
  formatted: string;
  /** CSS class for coloring (text-gain or text-loss) */
  colorClass: string;
  /** Whether the value is positive */
  isPositive: boolean;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TRILLION = 1e12;
const BILLION = 1e9;
const MILLION = 1e6;
const THOUSAND = 1e3;

// =============================================================================
// CORE FORMATTING FUNCTIONS
// =============================================================================

/**
 * Format a number as currency with smart compact notation
 * 
 * @example
 * formatCurrency(1.23) // "$1.23"
 * formatCurrency(45600) // "$45.6K"
 * formatCurrency(1200000) // "$1.2M"
 * formatCurrency(3400000000) // "$3.4B"
 * formatCurrency(5600000000000) // "$5.6T"
 */
export function formatCurrency(
  value: number | null | undefined,
  options: FormatOptions = {}
): string {
  if (value == null || isNaN(value)) return '$0.00';

  const { locale = 'en-US', compact = true } = options;
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (!compact) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: options.minimumFractionDigits ?? 2,
      maximumFractionDigits: options.maximumFractionDigits ?? 2,
    }).format(value);
  }

  if (absValue >= TRILLION) {
    return `${sign}$${(absValue / TRILLION).toFixed(1)}T`;
  }
  if (absValue >= BILLION) {
    return `${sign}$${(absValue / BILLION).toFixed(1)}B`;
  }
  if (absValue >= MILLION) {
    return `${sign}$${(absValue / MILLION).toFixed(1)}M`;
  }
  if (absValue >= THOUSAND) {
    return `${sign}$${(absValue / THOUSAND).toFixed(1)}K`;
  }

  // Small values get regular formatting
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as percentage with color class
 * 
 * @example
 * formatPercentage(12.34) // { formatted: "+12.34%", colorClass: "text-gain", isPositive: true }
 * formatPercentage(-5.67) // { formatted: "-5.67%", colorClass: "text-loss", isPositive: false }
 */
export function formatPercentage(
  value: number | null | undefined,
  options: FormatOptions = {}
): PercentageResult {
  if (value == null || isNaN(value)) {
    return {
      formatted: '0.00%',
      colorClass: 'text-text-muted',
      isPositive: false,
    };
  }

  const {
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
    showPlus = true,
  } = options;

  const isPositive = value >= 0;
  const prefix = isPositive && showPlus ? '+' : '';
  const formatted = `${prefix}${value.toFixed(
    Math.min(minimumFractionDigits, maximumFractionDigits)
  )}%`;

  return {
    formatted,
    colorClass: value === 0 ? 'text-text-muted' : isPositive ? 'text-gain' : 'text-loss',
    isPositive,
  };
}

/**
 * Format a percentage as a simple string (for backward compatibility)
 * 
 * @example
 * formatPercentageString(12.34) // "+12.34%"
 * formatPercentageString(-5.67) // "-5.67%"
 */
export function formatPercentageString(
  value: number | null | undefined,
  options: FormatOptions = {}
): string {
  return formatPercentage(value, options).formatted;
}

/**
 * Format supply with token symbol
 * 
 * @example
 * formatSupply(21000000, 'BTC') // "21M BTC"
 * formatSupply(120500000, 'ETH') // "120.5M ETH"
 */
export function formatSupply(
  value: number | null | undefined,
  symbol: string
): string {
  if (value == null || isNaN(value)) return `0 ${symbol.toUpperCase()}`;

  const absValue = Math.abs(value);
  const upperSymbol = symbol.toUpperCase();

  if (absValue >= TRILLION) {
    return `${(value / TRILLION).toFixed(1)}T ${upperSymbol}`;
  }
  if (absValue >= BILLION) {
    return `${(value / BILLION).toFixed(1)}B ${upperSymbol}`;
  }
  if (absValue >= MILLION) {
    return `${(value / MILLION).toFixed(1)}M ${upperSymbol}`;
  }
  if (absValue >= THOUSAND) {
    return `${(value / THOUSAND).toFixed(1)}K ${upperSymbol}`;
  }

  return `${value.toLocaleString('en-US', { maximumFractionDigits: 2 })} ${upperSymbol}`;
}

/**
 * Format number with compact notation (no currency)
 * 
 * @example
 * formatCompact(1200) // "1.2K"
 * formatCompact(45600000) // "45.6M"
 * formatCompact(1200000000) // "1.2B"
 */
export function formatCompact(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '0';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (absValue >= TRILLION) {
    return `${sign}${(absValue / TRILLION).toFixed(1)}T`;
  }
  if (absValue >= BILLION) {
    return `${sign}${(absValue / BILLION).toFixed(1)}B`;
  }
  if (absValue >= MILLION) {
    return `${sign}${(absValue / MILLION).toFixed(1)}M`;
  }
  if (absValue >= THOUSAND) {
    return `${sign}${(absValue / THOUSAND).toFixed(1)}K`;
  }

  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Format price with smart decimal handling
 * 
 * Adapts precision based on value magnitude:
 * - Very small: $0.00001234 (8 decimals, significant figures preserved)
 * - Small: $0.12 (2-4 decimals)
 * - Medium: $1.23 (2 decimals)
 * - Large: $123.45 (2 decimals)
 * - Very large: $1,234.56 (2 decimals with comma separators)
 * 
 * @example
 * formatPrice(0.00001234) // "$0.00001234"
 * formatPrice(0.1234) // "$0.12"
 * formatPrice(1.2345) // "$1.23"
 * formatPrice(123.456) // "$123.46"
 * formatPrice(1234.567) // "$1,234.57"
 */
export function formatPrice(value: number | null | undefined): string {
  if (value == null || isNaN(value)) return '$0.00';
  if (value === 0) return '$0.00';

  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  // Very small values: show significant figures
  if (absValue < 0.0001) {
    // Count leading zeros after decimal
    const str = absValue.toFixed(20);
    const match = str.match(/^0\.0*[1-9]/);
    if (match) {
      const leadingZeros = match[0].length - 2; // subtract "0."
      const significantDecimals = Math.min(leadingZeros + 4, 12);
      return `${sign}$${absValue.toFixed(significantDecimals).replace(/0+$/, '')}`;
    }
    return `${sign}$${absValue.toFixed(8)}`;
  }

  // Small values (< $0.01): 4-6 decimals
  if (absValue < 0.01) {
    return `${sign}$${absValue.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')}`;
  }

  // Small-medium values (< $1): 2-4 decimals
  if (absValue < 1) {
    return `${sign}$${absValue.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`;
  }

  // Medium values ($1-$999): 2 decimals
  if (absValue < 1000) {
    return `${sign}$${absValue.toFixed(2)}`;
  }

  // Large values: comma separators with 2 decimals
  return `${sign}$${absValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format a number for display in tables (right-aligned, monospace)
 * Returns both value and formatting metadata
 */
export function formatTableNumber(
  value: number | null | undefined,
  type: 'price' | 'currency' | 'percent' | 'supply' | 'compact',
  symbol?: string
): { value: string; colorClass?: string; isPositive?: boolean } {
  switch (type) {
    case 'price':
      return { value: formatPrice(value) };
    case 'currency':
      return { value: formatCurrency(value) };
    case 'percent': {
      const result = formatPercentage(value);
      return {
        value: result.formatted,
        colorClass: result.colorClass,
        isPositive: result.isPositive,
      };
    }
    case 'supply':
      return { value: formatSupply(value, symbol || '') };
    case 'compact':
      return { value: formatCompact(value) };
    default:
      return { value: String(value ?? 0) };
  }
}

/**
 * Format a market cap rank
 * 
 * @example
 * formatRank(1) // "#1"
 * formatRank(42) // "#42"
 */
export function formatRank(rank: number | null | undefined): string {
  if (rank == null || isNaN(rank)) return '-';
  return `#${rank}`;
}

/**
 * Get CSS class for percentage value coloring
 */
export function getPercentColorClass(value: number | null | undefined): string {
  if (value == null || value === 0) return 'text-text-muted';
  return value > 0 ? 'text-gain' : 'text-loss';
}
