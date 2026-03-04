/**
 * @fileoverview TokenWithChain Component
 * 
 * Token icon with small chain badge overlay at bottom-right.
 * Handles missing icons gracefully with fallback display.
 * 
 * @module components/ui/TokenWithChain
 */
'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import { ChainBadge } from './ChainBadge';
import { type ChainId } from '@/lib/chains';

// =============================================================================
// TYPES
// =============================================================================

export interface TokenWithChainProps {
  /** Token symbol (e.g., 'BTC', 'ETH') */
  symbol: string;
  /** Token name for alt text */
  name?: string;
  /** Token icon URL */
  iconUrl?: string | null;
  /** Chain ID for the badge */
  chain?: ChainId;
  /** Size of the token icon */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional class names */
  className?: string;
  /** Show chain badge */
  showChain?: boolean;
}

// =============================================================================
// SIZE CONFIGURATION
// =============================================================================

const sizeConfig = {
  xs: {
    container: 'w-5 h-5',
    icon: 20,
    chainSize: 'xs' as const,
    chainOffset: '-bottom-0.5 -right-0.5',
    fallbackText: 'text-[8px]',
  },
  sm: {
    container: 'w-6 h-6',
    icon: 24,
    chainSize: 'xs' as const,
    chainOffset: '-bottom-0.5 -right-0.5',
    fallbackText: 'text-[10px]',
  },
  md: {
    container: 'w-8 h-8',
    icon: 32,
    chainSize: 'xs' as const,
    chainOffset: '-bottom-1 -right-1',
    fallbackText: 'text-xs',
  },
  lg: {
    container: 'w-10 h-10',
    icon: 40,
    chainSize: 'sm' as const,
    chainOffset: '-bottom-1 -right-1',
    fallbackText: 'text-sm',
  },
  xl: {
    container: 'w-12 h-12',
    icon: 48,
    chainSize: 'sm' as const,
    chainOffset: '-bottom-1.5 -right-1.5',
    fallbackText: 'text-base',
  },
};

// =============================================================================
// FALLBACK COLORS
// =============================================================================

/**
 * Generate a consistent color based on token symbol
 */
function getTokenColor(symbol: string): string {
  const colors = [
    '#627EEA', // Blue
    '#F7931A', // Orange
    '#8DC647', // Green
    '#E84142', // Red
    '#8247E5', // Purple
    '#28A0F0', // Light blue
    '#00FFA3', // Teal
    '#FF0420', // Bright red
  ];
  
  // Simple hash based on symbol
  let hash = 0;
  for (let i = 0; i < symbol.length; i++) {
    hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  return colors[Math.abs(hash) % colors.length];
}

// =============================================================================
// FALLBACK ICON
// =============================================================================

const FallbackIcon = memo(function FallbackIcon({
  symbol,
  size,
}: {
  symbol: string;
  size: keyof typeof sizeConfig;
}) {
  const config = sizeConfig[size];
  const bgColor = getTokenColor(symbol);
  const displaySymbol = symbol.slice(0, 3).toUpperCase();

  return (
    <div
      className={`
        ${config.container} rounded-full flex items-center justify-center
        font-bold text-white
        ${config.fallbackText}
      `}
      style={{ backgroundColor: bgColor }}
    >
      {displaySymbol}
    </div>
  );
});

// =============================================================================
// COMPONENT
// =============================================================================

function TokenWithChainComponent({
  symbol,
  name,
  iconUrl,
  chain,
  size = 'md',
  className = '',
  showChain = true,
}: TokenWithChainProps) {
  const [imageError, setImageError] = useState(false);
  const config = sizeConfig[size];

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div className={`relative inline-flex flex-shrink-0 ${className}`}>
      {/* Token Icon */}
      <div className={`${config.container} rounded-full overflow-hidden`}>
        {iconUrl && !imageError ? (
          <Image
            src={iconUrl}
            alt={name || symbol}
            width={config.icon}
            height={config.icon}
            className="w-full h-full object-cover"
            onError={handleImageError}
            unoptimized
          />
        ) : (
          <FallbackIcon symbol={symbol} size={size} />
        )}
      </div>

      {/* Chain Badge Overlay */}
      {showChain && chain && (
        <div className={`absolute ${config.chainOffset}`}>
          <ChainBadge
            chain={chain}
            size={config.chainSize}
            showTooltip
          />
        </div>
      )}
    </div>
  );
}

export const TokenWithChain = memo(TokenWithChainComponent);

// =============================================================================
// TOKEN ICON (without chain)
// =============================================================================

export interface TokenIconProps {
  /** Token symbol */
  symbol: string;
  /** Token name for alt text */
  name?: string;
  /** Icon URL */
  iconUrl?: string | null;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Additional class names */
  className?: string;
}

/**
 * Simple token icon without chain badge
 */
export const TokenIcon = memo(function TokenIcon({
  symbol,
  name,
  iconUrl,
  size = 'md',
  className = '',
}: TokenIconProps) {
  return (
    <TokenWithChain
      symbol={symbol}
      name={name}
      iconUrl={iconUrl}
      size={size}
      className={className}
      showChain={false}
    />
  );
});

// =============================================================================
// TOKEN WITH INFO
// =============================================================================

export interface TokenWithInfoProps {
  /** Token symbol */
  symbol: string;
  /** Token name */
  name: string;
  /** Icon URL */
  iconUrl?: string | null;
  /** Chain ID */
  chain?: ChainId;
  /** Size variant */
  size?: 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
  /** Show symbol next to name */
  showSymbol?: boolean;
}

/**
 * Token icon with name and symbol display
 */
export const TokenWithInfo = memo(function TokenWithInfo({
  symbol,
  name,
  iconUrl,
  chain,
  size = 'md',
  className = '',
  showSymbol = true,
}: TokenWithInfoProps) {
  const textSizes = {
    sm: { name: 'text-sm', symbol: 'text-xs' },
    md: { name: 'text-base', symbol: 'text-sm' },
    lg: { name: 'text-lg', symbol: 'text-base' },
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <TokenWithChain
        symbol={symbol}
        name={name}
        iconUrl={iconUrl}
        chain={chain}
        size={size}
        showChain={!!chain}
      />
      <div className="flex flex-col min-w-0">
        <span className={`font-medium text-text-primary truncate ${textSizes[size].name}`}>
          {name}
        </span>
        {showSymbol && (
          <span className={`text-text-muted ${textSizes[size].symbol}`}>
            {symbol.toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
});

// Default export
export default TokenWithChain;
