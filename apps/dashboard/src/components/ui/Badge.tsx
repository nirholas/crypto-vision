/**
 * @fileoverview Premium Badge Components
 * 
 * Status indicators, tags, and badges with various styles
 * including glow effects and gradients.
 * 
 * @module components/ui/Badge
 */
'use client';

import { ReactNode } from 'react';

export interface BadgeProps {
  variant?: 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'info' | 'outline' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  glow?: boolean;
  dot?: boolean;
  dotColor?: 'green' | 'red' | 'yellow' | 'blue';
  children: ReactNode;
  className?: string;
}

const variantClasses = {
  default: 'bg-surface-hover text-text-secondary',
  primary: 'bg-primary/15 text-primary',
  success: 'bg-gain-bg text-gain',
  danger: 'bg-loss-bg text-loss',
  warning: 'bg-warning/15 text-warning',
  info: 'bg-info/15 text-info',
  outline: 'bg-transparent border border-current',
  gradient: 'bg-gradient-to-r from-primary to-purple-500 text-white',
};

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm',
};

const dotColors = {
  green: 'bg-gain',
  red: 'bg-loss',
  yellow: 'bg-warning',
  blue: 'bg-primary',
};

export default function Badge({
  variant = 'default',
  size = 'md',
  glow = false,
  dot = false,
  dotColor = 'green',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 rounded-full font-medium
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${glow ? 'badge-glow' : ''}
        ${className}
      `}
    >
      {dot && (
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${dotColors[dotColor]} opacity-75`} />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${dotColors[dotColor]}`} />
        </span>
      )}
      {children}
    </span>
  );
}

// Price Change Badge
export interface PriceChangeBadgeProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function PriceChangeBadge({
  value,
  size = 'md',
  showIcon = true,
  className = '',
}: PriceChangeBadgeProps) {
  const isPositive = value >= 0;
  
  return (
    <span
      className={`
        inline-flex items-center gap-1 rounded-md font-medium number-mono
        ${isPositive ? 'bg-gain-bg text-gain' : 'bg-loss-bg text-loss'}
        ${sizeClasses[size]}
        ${className}
      `}
    >
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
      {isPositive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

// Rank Badge
export interface RankBadgeProps {
  rank: number;
  className?: string;
}

export function RankBadge({ rank, className = '' }: RankBadgeProps) {
  const getRankClass = () => {
    if (rank <= 3) return 'rank-badge top-3';
    if (rank <= 10) return 'rank-badge top-10';
    return 'rank-badge';
  };

  return (
    <span className={`${getRankClass()} ${className}`}>
      #{rank}
    </span>
  );
}

// Status Badge
export interface StatusBadgeProps {
  status: 'online' | 'offline' | 'busy' | 'away';
  label?: string;
  className?: string;
}

const statusConfig = {
  online: { color: 'bg-gain', label: 'Online', pulse: true },
  offline: { color: 'bg-text-muted', label: 'Offline', pulse: false },
  busy: { color: 'bg-loss', label: 'Busy', pulse: true },
  away: { color: 'bg-warning', label: 'Away', pulse: false },
};

export function StatusBadge({
  status,
  label,
  className = '',
}: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span
      className={`
        inline-flex items-center gap-2 px-2.5 py-1 rounded-full
        bg-surface-hover text-text-secondary text-xs font-medium
        ${className}
      `}
    >
      <span className="relative flex h-2 w-2">
        {config.pulse && (
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${config.color} opacity-75`} />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${config.color}`} />
      </span>
      {label || config.label}
    </span>
  );
}

// Chain/Network Badge
export interface ChainBadgeProps {
  chain: 'ethereum' | 'bsc' | 'polygon' | 'arbitrum' | 'optimism' | 'avalanche' | 'solana';
  className?: string;
}

const chainConfig = {
  ethereum: { name: 'Ethereum', color: 'bg-[#627EEA]/15 text-[#627EEA]', icon: 'Ξ' },
  bsc: { name: 'BNB Chain', color: 'bg-[#F3BA2F]/15 text-[#F3BA2F]', icon: '◈' },
  polygon: { name: 'Polygon', color: 'bg-[#8247E5]/15 text-[#8247E5]', icon: '⬡' },
  arbitrum: { name: 'Arbitrum', color: 'bg-[#28A0F0]/15 text-[#28A0F0]', icon: '⟠' },
  optimism: { name: 'Optimism', color: 'bg-[#FF0420]/15 text-[#FF0420]', icon: '◎' },
  avalanche: { name: 'Avalanche', color: 'bg-[#E84142]/15 text-[#E84142]', icon: '△' },
  solana: { name: 'Solana', color: 'bg-[#00FFA3]/15 text-[#00FFA3]', icon: '◉' },
};

export function ChainBadge({ chain, className = '' }: ChainBadgeProps) {
  const config = chainConfig[chain];
  
  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2 py-1 rounded-full
        text-xs font-medium
        ${config.color}
        ${className}
      `}
    >
      <span>{config.icon}</span>
      {config.name}
    </span>
  );
}
