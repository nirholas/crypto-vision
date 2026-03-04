'use client';

import { type ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/* ─── Types ──────────────────────────────────────────────────────────── */

export interface StatProps {
  label: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: ReactNode;
  prefix?: string;
  suffix?: string;
  variant?: 'default' | 'compact' | 'large';
  glow?: boolean;
  className?: string;
}

/* ─── Component ──────────────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  change,
  changeLabel,
  icon,
  prefix = '',
  suffix = '',
  variant = 'default',
  glow = false,
  className = '',
}: StatProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;
  const isNeutral = change === undefined || change === 0;

  const changeColor = isPositive
    ? 'text-[var(--gain)]'
    : isNegative
      ? 'text-[var(--loss)]'
      : 'text-[var(--text-muted)]';

  const changeBg = isPositive
    ? 'bg-[var(--gain-bg)]'
    : isNegative
      ? 'bg-[var(--loss-bg)]'
      : 'bg-[var(--surface)]';

  const ChangeIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center text-[var(--text-muted)]">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-muted)] mb-0.5">
            {label}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-sm font-semibold text-[var(--text-primary)] font-mono-numbers">
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </span>
            {change !== undefined && (
              <span className={`text-[10px] font-medium ${changeColor}`}>
                {isPositive ? '+' : ''}{change.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (variant === 'large') {
    return (
      <div
        className={`
          glass-card rounded-xl p-5
          ${glow ? 'gradient-border' : ''}
          ${className}
        `}
      >
        <div className="flex items-start justify-between mb-3">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            {label}
          </span>
          {icon && (
            <div className="w-9 h-9 rounded-lg bg-[var(--surface)] flex items-center justify-center text-[var(--primary)]">
              {icon}
            </div>
          )}
        </div>
        <div className="text-2xl font-bold text-[var(--text-primary)] font-mono-numbers mb-2">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </div>
        {change !== undefined && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium ${changeBg} ${changeColor}`}>
            <ChangeIcon size={12} />
            <span>{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
            {changeLabel && (
              <span className="text-[var(--text-muted)] ml-1">{changeLabel}</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Default variant
  return (
    <div
      className={`
        glass-card rounded-xl p-4
        ${glow ? 'gradient-border' : ''}
        ${className}
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-[var(--text-muted)] uppercase tracking-wider">
          {label}
        </span>
        {icon && (
          <span className="text-[var(--text-muted)]">{icon}</span>
        )}
      </div>
      <div className="text-lg font-bold text-[var(--text-primary)] font-mono-numbers mb-1">
        {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
      </div>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${changeColor}`}>
          <ChangeIcon size={12} />
          <span>{isPositive ? '+' : ''}{change.toFixed(2)}%</span>
          {changeLabel && (
            <span className="text-[var(--text-muted)] ml-1">{changeLabel}</span>
          )}
        </div>
      )}
    </div>
  );
}

export default Stat;
