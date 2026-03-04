/**
 * @fileoverview ChainBadge Component
 * 
 * Small badge showing blockchain network with unique colors and icons.
 * DeFiLlama-inspired design with tooltip support.
 * 
 * @module components/ui/ChainBadge
 */
'use client';

import { memo } from 'react';
import Tooltip from './Tooltip';
import { type ChainId, CHAIN_COLORS, getChainConfig } from '@/lib/chains';

// =============================================================================
// TYPES
// =============================================================================

export interface ChainBadgeProps {
  /** Chain identifier */
  chain: ChainId;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Show full chain name instead of just icon */
  showName?: boolean;
  /** Show tooltip on hover */
  showTooltip?: boolean;
  /** Additional class names */
  className?: string;
  /** Click handler */
  onClick?: () => void;
}

// =============================================================================
// SIZE CONFIGURATION
// =============================================================================

const sizeConfig = {
  xs: {
    badge: 'h-4 min-w-4 text-[10px] px-1',
    icon: 'w-2.5 h-2.5',
    iconOnly: 'w-4 h-4',
  },
  sm: {
    badge: 'h-5 min-w-5 text-xs px-1.5',
    icon: 'w-3 h-3',
    iconOnly: 'w-5 h-5',
  },
  md: {
    badge: 'h-6 min-w-6 text-xs px-2',
    icon: 'w-3.5 h-3.5',
    iconOnly: 'w-6 h-6',
  },
  lg: {
    badge: 'h-7 min-w-7 text-sm px-2.5',
    icon: 'w-4 h-4',
    iconOnly: 'w-7 h-7',
  },
};

// =============================================================================
// CHAIN ICONS (SVG paths or Unicode)
// =============================================================================

const ChainIcon = memo(function ChainIcon({
  chain,
  size,
}: {
  chain: ChainId;
  size: 'xs' | 'sm' | 'md' | 'lg';
}) {
  const config = CHAIN_COLORS[chain];
  const iconSize = sizeConfig[size].icon;

  // Use unicode symbol as fallback
  return (
    <span className={`${iconSize} flex items-center justify-center font-bold`}>
      {config.symbol}
    </span>
  );
});

// =============================================================================
// COMPONENT
// =============================================================================

function ChainBadgeComponent({
  chain,
  size = 'sm',
  showName = false,
  showTooltip = true,
  className = '',
  onClick,
}: ChainBadgeProps) {
  const config = getChainConfig(chain);
  const sizes = sizeConfig[size];

  const badgeContent = (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`
        inline-flex items-center justify-center gap-1 rounded-full font-medium
        transition-transform hover:scale-105
        ${showName ? sizes.badge : sizes.iconOnly}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      style={{
        backgroundColor: config.bg,
        color: config.text,
      }}
    >
      <ChainIcon chain={chain} size={size} />
      {showName && <span className="pr-0.5">{config.shortName}</span>}
    </span>
  );

  if (showTooltip) {
    return (
      <Tooltip content={config.name} position="top" delay={100}>
        {badgeContent}
      </Tooltip>
    );
  }

  return badgeContent;
}

export const ChainBadge = memo(ChainBadgeComponent);

// =============================================================================
// CHAIN BADGE GROUP
// =============================================================================

export interface ChainBadgeGroupProps {
  /** Array of chain IDs to display */
  chains: ChainId[];
  /** Maximum number of chains to show before +N */
  maxVisible?: number;
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Additional class names */
  className?: string;
}

/**
 * Display multiple chain badges with overlap and +N indicator
 */
export const ChainBadgeGroup = memo(function ChainBadgeGroup({
  chains,
  maxVisible = 3,
  size = 'sm',
  className = '',
}: ChainBadgeGroupProps) {
  const visibleChains = chains.slice(0, maxVisible);
  const hiddenCount = chains.length - maxVisible;
  const sizes = sizeConfig[size];

  return (
    <div className={`flex items-center -space-x-1.5 ${className}`}>
      {visibleChains.map((chain, index) => (
        <div
          key={chain}
          className="relative"
          style={{ zIndex: visibleChains.length - index }}
        >
          <ChainBadge chain={chain} size={size} showTooltip />
        </div>
      ))}
      {hiddenCount > 0 && (
        <Tooltip
          content={chains.slice(maxVisible).map(c => CHAIN_COLORS[c].name).join(', ')}
          position="top"
        >
          <span
            className={`
              inline-flex items-center justify-center rounded-full font-medium
              bg-surface-hover text-text-secondary border border-surface-border
              ${sizes.iconOnly}
            `}
          >
            +{hiddenCount}
          </span>
        </Tooltip>
      )}
    </div>
  );
});

// =============================================================================
// CHAIN SELECTOR ITEM
// =============================================================================

export interface ChainSelectorItemProps {
  chain: ChainId;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

/**
 * Chain item for selection dropdowns
 */
export const ChainSelectorItem = memo(function ChainSelectorItem({
  chain,
  selected = false,
  onClick,
  className = '',
}: ChainSelectorItemProps) {
  const config = getChainConfig(chain);

  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-3 w-full px-3 py-2 rounded-lg
        transition-colors text-left
        ${selected 
          ? 'bg-primary/10 text-primary' 
          : 'hover:bg-surface-hover text-text-primary'
        }
        ${className}
      `}
    >
      <ChainBadge chain={chain} size="sm" showTooltip={false} />
      <span className="flex-1 font-medium">{config.name}</span>
      {selected && (
        <svg className="w-4 h-4 text-primary" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
    </button>
  );
});

// Default export
export default ChainBadge;
