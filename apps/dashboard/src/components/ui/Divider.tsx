/**
 * @fileoverview Premium Divider Component
 * 
 * Horizontal and vertical dividers with various styles.
 * 
 * @module components/ui/Divider
 */
'use client';

import { ReactNode } from 'react';

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  variant?: 'solid' | 'dashed' | 'gradient' | 'glow';
  label?: ReactNode;
  className?: string;
}

export default function Divider({
  orientation = 'horizontal',
  variant = 'solid',
  label,
  className = '',
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        className={`
          w-px self-stretch
          ${variant === 'gradient' ? 'bg-gradient-to-b from-transparent via-surface-border to-transparent' : ''}
          ${variant === 'glow' ? 'divider-glow' : ''}
          ${variant === 'solid' ? 'bg-surface-border' : ''}
          ${variant === 'dashed' ? 'border-l border-dashed border-surface-border' : ''}
          ${className}
        `}
        role="separator"
        aria-orientation="vertical"
      />
    );
  }

  if (label) {
    return (
      <div
        className={`flex items-center gap-4 ${className}`}
        role="separator"
      >
        <div
          className={`
            flex-1 h-px
            ${variant === 'gradient' ? 'bg-gradient-to-r from-transparent to-surface-border' : 'bg-surface-border'}
          `}
        />
        <span className="text-sm text-text-muted font-medium">{label}</span>
        <div
          className={`
            flex-1 h-px
            ${variant === 'gradient' ? 'bg-gradient-to-l from-transparent to-surface-border' : 'bg-surface-border'}
          `}
        />
      </div>
    );
  }

  return (
    <div
      className={`
        w-full h-px
        ${variant === 'gradient' ? 'divider-gradient' : ''}
        ${variant === 'glow' ? 'divider-glow' : ''}
        ${variant === 'solid' ? 'bg-surface-border' : ''}
        ${variant === 'dashed' ? 'border-t border-dashed border-surface-border' : ''}
        ${className}
      `}
      role="separator"
      aria-orientation="horizontal"
    />
  );
}
