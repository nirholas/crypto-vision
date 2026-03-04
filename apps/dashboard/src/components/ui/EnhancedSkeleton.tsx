/**
 * @fileoverview Enhanced Skeleton Component
 *
 * Premium loading placeholder with multiple variants,
 * wave shimmer effect, staggered animation, and motion preferences support.
 *
 * @module components/ui/EnhancedSkeleton
 */
'use client';

import { useMemo, useEffect, useState } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export type SkeletonVariant = 'text' | 'avatar' | 'card' | 'table-row' | 'chart' | 'button' | 'badge';

export interface EnhancedSkeletonProps {
  /** Skeleton variant type */
  variant?: SkeletonVariant;
  /** Width (number for px, string for CSS value) */
  width?: string | number;
  /** Height (number for px, string for CSS value) */
  height?: string | number;
  /** For text variant: number of lines */
  lines?: number;
  /** Animation delay in ms for staggered effect */
  delay?: number;
  /** Whether to animate (respects prefers-reduced-motion by default) */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to use random width for text lines */
  randomWidth?: boolean;
  /** Number of columns for table-row variant */
  columns?: number;
  /** Custom border radius */
  borderRadius?: string | number;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Generate random width percentage for text skeleton lines */
function getRandomWidth(index: number, total: number): string {
  // Last line is typically shorter
  if (index === total - 1) {
    return `${50 + Math.random() * 30}%`;
  }
  // Other lines vary between 80-100%
  return `${80 + Math.random() * 20}%`;
}

/** Convert size value to CSS string */
function toCssSize(value: string | number | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === 'number' ? `${value}px` : value;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function EnhancedSkeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
  delay = 0,
  animate = true,
  className = '',
  randomWidth = false,
  columns = 5,
  borderRadius,
}: EnhancedSkeletonProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [randomWidths, setRandomWidths] = useState<string[]>([]);

  // Check for reduced motion preference
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  // Generate random widths for text lines on mount
  useEffect(() => {
    if (randomWidth && variant === 'text' && lines > 1) {
      setRandomWidths(
        Array.from({ length: lines }, (_, i) => getRandomWidth(i, lines))
      );
    }
  }, [randomWidth, variant, lines]);

  const shouldAnimate = animate && !prefersReducedMotion;

  // Base classes for all skeletons
  const baseClasses = useMemo(() => {
    const animateClass = shouldAnimate ? 'skeleton-enhanced' : 'bg-surface-hover';
    const radiusClass = borderRadius ? '' : getVariantRadius(variant);
    return `${animateClass} ${radiusClass}`;
  }, [shouldAnimate, variant, borderRadius]);

  // Inline styles
  const baseStyle = useMemo(
    () => ({
      width: toCssSize(width),
      height: toCssSize(height),
      animationDelay: delay > 0 ? `${delay}ms` : undefined,
      borderRadius: toCssSize(borderRadius),
    }),
    [width, height, delay, borderRadius]
  );

  // Render based on variant
  switch (variant) {
    case 'avatar':
      return (
        <div
          className={`${baseClasses} rounded-full ${className}`}
          style={{
            ...baseStyle,
            width: toCssSize(width) || '40px',
            height: toCssSize(height) || '40px',
          }}
          aria-hidden="true"
        />
      );

    case 'card':
      return (
        <div
          className={`bg-surface rounded-xl p-4 space-y-4 ${className}`}
          style={{ animationDelay: delay > 0 ? `${delay}ms` : undefined }}
          aria-hidden="true"
        >
          {/* Header with avatar */}
          <div className="flex items-center gap-3">
            <EnhancedSkeleton
              variant="avatar"
              animate={shouldAnimate}
              delay={delay}
            />
            <div className="flex-1 space-y-2">
              <EnhancedSkeleton
                height={16}
                width="60%"
                animate={shouldAnimate}
                delay={delay + 50}
              />
              <EnhancedSkeleton
                height={12}
                width="40%"
                animate={shouldAnimate}
                delay={delay + 100}
              />
            </div>
          </div>
          {/* Body text */}
          <EnhancedSkeleton
            variant="text"
            lines={3}
            randomWidth
            animate={shouldAnimate}
            delay={delay + 150}
          />
          {/* Actions */}
          <div className="flex gap-2">
            <EnhancedSkeleton
              variant="button"
              width={80}
              animate={shouldAnimate}
              delay={delay + 300}
            />
            <EnhancedSkeleton
              variant="button"
              width={80}
              animate={shouldAnimate}
              delay={delay + 350}
            />
          </div>
        </div>
      );

    case 'table-row':
      return (
        <tr className={className} aria-hidden="true">
          {Array.from({ length: columns }).map((_, index) => (
            <td key={index} className="px-4 py-3">
              <EnhancedSkeleton
                height={20}
                width={index === 0 ? 24 : index === 1 ? '60%' : '80%'}
                animate={shouldAnimate}
                delay={delay + index * 50}
              />
            </td>
          ))}
        </tr>
      );

    case 'chart':
      return (
        <div
          className={`bg-surface rounded-xl p-4 ${className}`}
          style={{ animationDelay: delay > 0 ? `${delay}ms` : undefined }}
          aria-hidden="true"
        >
          {/* Chart header */}
          <div className="flex justify-between items-center mb-4">
            <EnhancedSkeleton
              height={20}
              width={120}
              animate={shouldAnimate}
              delay={delay}
            />
            <div className="flex gap-2">
              {['1H', '1D', '1W'].map((_, i) => (
                <EnhancedSkeleton
                  key={i}
                  variant="badge"
                  width={40}
                  animate={shouldAnimate}
                  delay={delay + 50 + i * 30}
                />
              ))}
            </div>
          </div>
          {/* Chart area with fake axes */}
          <div className="relative" style={{ height: toCssSize(height) || '200px' }}>
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-8 w-10 flex flex-col justify-between">
              {[0, 1, 2, 3].map((i) => (
                <EnhancedSkeleton
                  key={i}
                  height={12}
                  width={32}
                  animate={shouldAnimate}
                  delay={delay + 100 + i * 20}
                />
              ))}
            </div>
            {/* Chart body */}
            <div className="ml-12 h-full">
              <EnhancedSkeleton
                height="100%"
                width="100%"
                borderRadius={8}
                animate={shouldAnimate}
                delay={delay + 200}
              />
            </div>
            {/* X-axis labels */}
            <div className="ml-12 mt-2 flex justify-between">
              {[0, 1, 2, 3, 4].map((i) => (
                <EnhancedSkeleton
                  key={i}
                  height={12}
                  width={40}
                  animate={shouldAnimate}
                  delay={delay + 250 + i * 20}
                />
              ))}
            </div>
          </div>
        </div>
      );

    case 'button':
      return (
        <div
          className={`${baseClasses} rounded-lg ${className}`}
          style={{
            ...baseStyle,
            height: toCssSize(height) || '32px',
          }}
          aria-hidden="true"
        />
      );

    case 'badge':
      return (
        <div
          className={`${baseClasses} rounded-full ${className}`}
          style={{
            ...baseStyle,
            height: toCssSize(height) || '24px',
          }}
          aria-hidden="true"
        />
      );

    case 'text':
    default:
      if (lines > 1) {
        return (
          <div className={`space-y-2 ${className}`} aria-hidden="true">
            {Array.from({ length: lines }).map((_, index) => (
              <div
                key={index}
                className={`${baseClasses}`}
                style={{
                  height: toCssSize(height) || '1rem',
                  width: randomWidth && randomWidths[index]
                    ? randomWidths[index]
                    : index === lines - 1
                      ? '75%'
                      : '100%',
                  animationDelay: delay + index * 50 > 0 ? `${delay + index * 50}ms` : undefined,
                }}
              />
            ))}
          </div>
        );
      }

      return (
        <div
          className={`${baseClasses} ${className}`}
          style={{
            ...baseStyle,
            height: toCssSize(height) || '1rem',
          }}
          aria-hidden="true"
        />
      );
  }
}

/** Get appropriate border radius class for variant */
function getVariantRadius(variant: SkeletonVariant): string {
  switch (variant) {
    case 'avatar':
      return 'rounded-full';
    case 'badge':
      return 'rounded-full';
    case 'button':
      return 'rounded-lg';
    case 'card':
      return 'rounded-xl';
    default:
      return 'rounded';
  }
}

// =============================================================================
// STAGGER WRAPPER
// =============================================================================

export interface SkeletonStaggerProps {
  children: React.ReactNode;
  /** Base delay in ms */
  baseDelay?: number;
  /** Delay increment per child in ms */
  staggerDelay?: number;
  /** Animation direction */
  direction?: 'down' | 'up' | 'left' | 'right';
  /** Container className */
  className?: string;
}

export function SkeletonStagger({
  children,
  baseDelay = 0,
  staggerDelay = 50,
  direction = 'down',
  className = '',
}: SkeletonStaggerProps) {
  // Direction-based animation classes
  const directionClass = {
    down: 'stagger-fade-down',
    up: 'stagger-fade-up',
    left: 'stagger-fade-left',
    right: 'stagger-fade-right',
  }[direction];

  return (
    <div className={`${directionClass} ${className}`}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <div
              key={index}
              style={{
                animationDelay: `${baseDelay + index * staggerDelay}ms`,
              }}
              className="stagger-item"
            >
              {child}
            </div>
          ))
        : children}
    </div>
  );
}

// =============================================================================
// PRE-BUILT SKELETON VARIANTS (Enhanced)
// =============================================================================

export function EnhancedTextSkeleton({
  lines = 3,
  className = '',
  delay = 0,
  randomWidth = true,
}: {
  lines?: number;
  className?: string;
  delay?: number;
  randomWidth?: boolean;
}) {
  return (
    <EnhancedSkeleton
      variant="text"
      lines={lines}
      className={className}
      delay={delay}
      randomWidth={randomWidth}
    />
  );
}

export function EnhancedAvatarSkeleton({
  size = 'md',
  className = '',
  delay = 0,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  delay?: number;
}) {
  const sizes = { sm: 32, md: 40, lg: 48, xl: 64 };
  return (
    <EnhancedSkeleton
      variant="avatar"
      width={sizes[size]}
      height={sizes[size]}
      className={className}
      delay={delay}
    />
  );
}

export function EnhancedCardSkeleton({
  className = '',
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  return <EnhancedSkeleton variant="card" className={className} delay={delay} />;
}

export function EnhancedTableRowSkeleton({
  columns = 5,
  className = '',
  delay = 0,
}: {
  columns?: number;
  className?: string;
  delay?: number;
}) {
  return (
    <EnhancedSkeleton
      variant="table-row"
      columns={columns}
      className={className}
      delay={delay}
    />
  );
}

export function EnhancedChartSkeleton({
  height = 200,
  className = '',
  delay = 0,
}: {
  height?: number;
  className?: string;
  delay?: number;
}) {
  return (
    <EnhancedSkeleton
      variant="chart"
      height={height}
      className={className}
      delay={delay}
    />
  );
}

export default EnhancedSkeleton;
