/**
 * Enhanced Skeleton Components
 * 
 * Multiple skeleton variants with:
 * - Staggered animation with configurable delay
 * - Wave shimmer effect (left to right)
 * - Respects prefers-reduced-motion
 */

'use client';

import { useMemo, type CSSProperties } from 'react';

export interface SkeletonProps {
  className?: string;
  style?: CSSProperties;
  animate?: boolean;
  delay?: number; // Stagger delay in ms
}

/**
 * Base shimmer animation keyframes
 * Uses CSS custom property for stagger delay
 */
const shimmerStyle: CSSProperties = {
  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.08) 50%, transparent 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.5s ease-in-out infinite',
  animationDelay: 'var(--stagger-delay, 0ms)',
};

/**
 * Base skeleton component
 */
export function Skeleton({ 
  className = '', 
  style,
  animate = true,
  delay = 0,
}: SkeletonProps) {
  const combinedStyle = useMemo(() => ({
    ...style,
    '--stagger-delay': `${delay}ms`,
    ...(animate ? shimmerStyle : {}),
  } as CSSProperties), [style, animate, delay]);

  return (
    <div 
      className={`bg-gray-200 dark:bg-gray-700/50 rounded ${className}`}
      style={combinedStyle}
      aria-hidden="true"
    />
  );
}

/**
 * Text skeleton - single line with random width
 */
export function TextSkeleton({ 
  width = 'random',
  height = 'h-4',
  delay = 0,
  className = '',
}: { 
  width?: 'random' | 'full' | string;
  height?: string;
  delay?: number;
  className?: string;
}) {
  const widthClass = useMemo(() => {
    if (width === 'random') {
      const widths = ['w-3/4', 'w-4/5', 'w-2/3', 'w-5/6', 'w-1/2'];
      return widths[Math.floor(Math.random() * widths.length)];
    }
    if (width === 'full') return 'w-full';
    return width;
  }, [width]);

  return (
    <Skeleton 
      className={`${height} ${widthClass} ${className}`}
      delay={delay}
    />
  );
}

/**
 * Avatar skeleton - circular
 */
export function AvatarSkeleton({ 
  size = 'md',
  delay = 0,
  className = '',
}: { 
  size?: 'sm' | 'md' | 'lg' | 'xl';
  delay?: number;
  className?: string;
}) {
  const sizeClass = {
    sm: 'w-6 h-6',
    md: 'w-10 h-10',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  }[size];

  return (
    <Skeleton 
      className={`${sizeClass} rounded-full ${className}`}
      delay={delay}
    />
  );
}

/**
 * Card skeleton - full card with header, content, and footer
 */
export function CardSkeleton({ 
  hasImage = false,
  lines = 3,
  delay = 0,
  className = '',
}: { 
  hasImage?: boolean;
  lines?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden ${className}`}>
      {hasImage && (
        <Skeleton className="w-full h-40" delay={delay} />
      )}
      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-3">
          <AvatarSkeleton size="sm" delay={delay + 50} />
          <TextSkeleton width="w-1/3" delay={delay + 100} />
        </div>
        {/* Title */}
        <TextSkeleton width="w-4/5" height="h-5" delay={delay + 150} />
        {/* Content lines */}
        {Array.from({ length: lines }).map((_, i) => (
          <TextSkeleton 
            key={i} 
            width="random" 
            delay={delay + 200 + i * 50} 
          />
        ))}
        {/* Footer */}
        <div className="flex justify-between pt-2">
          <TextSkeleton width="w-20" delay={delay + 350} />
          <TextSkeleton width="w-16" delay={delay + 400} />
        </div>
      </div>
    </div>
  );
}

/**
 * Table row skeleton - multiple cells
 */
export function TableRowSkeleton({ 
  cells = 5,
  delay = 0,
  className = '',
}: { 
  cells?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <tr className={className}>
      {Array.from({ length: cells }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <Skeleton 
            className={`h-4 ${i === 0 ? 'w-12' : i === 1 ? 'w-32' : 'w-20'}`}
            delay={delay + i * 30}
          />
        </td>
      ))}
    </tr>
  );
}

/**
 * Chart skeleton - chart placeholder with axes
 */
export function ChartSkeleton({ 
  height = 'h-64',
  delay = 0,
  className = '',
}: { 
  height?: string;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`relative ${height} ${className}`}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="w-10 h-3" delay={delay + i * 30} />
        ))}
      </div>
      
      {/* Chart area */}
      <div className="absolute left-14 right-0 top-0 bottom-8 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
        <Skeleton className="w-full h-full" delay={delay + 150} />
        
        {/* Fake bars/lines */}
        <div className="absolute inset-0 flex items-end justify-around px-4 pb-4">
          {[...Array(7)].map((_, i) => (
            <div 
              key={i}
              className="w-8 bg-gray-300 dark:bg-gray-600 rounded-t"
              style={{ 
                height: `${30 + Math.random() * 50}%`,
                opacity: 0.5,
              }}
            />
          ))}
        </div>
      </div>
      
      {/* X-axis labels */}
      <div className="absolute left-14 right-0 bottom-0 h-6 flex justify-between">
        {[...Array(7)].map((_, i) => (
          <Skeleton key={i} className="w-8 h-3" delay={delay + 200 + i * 20} />
        ))}
      </div>
    </div>
  );
}

/**
 * Stats grid skeleton
 */
export function StatsGridSkeleton({ 
  count = 4,
  delay = 0,
  className = '',
}: { 
  count?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i}
          className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
        >
          <TextSkeleton width="w-20" height="h-3" delay={delay + i * 50} className="mb-2" />
          <Skeleton className="h-8 w-24" delay={delay + i * 50 + 30} />
        </div>
      ))}
    </div>
  );
}

/**
 * News feed skeleton
 */
export function NewsFeedSkeleton({ 
  count = 5,
  delay = 0,
  className = '',
}: { 
  count?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div 
          key={i}
          className="flex gap-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <Skeleton className="w-24 h-24 rounded-lg flex-shrink-0" delay={delay + i * 100} />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton className="w-16 h-4 rounded-full" delay={delay + i * 100 + 20} />
              <Skeleton className="w-12 h-4" delay={delay + i * 100 + 40} />
            </div>
            <TextSkeleton width="w-full" height="h-5" delay={delay + i * 100 + 60} />
            <TextSkeleton width="w-4/5" delay={delay + i * 100 + 80} />
            <TextSkeleton width="w-3/5" delay={delay + i * 100 + 100} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Price ticker skeleton
 */
export function PriceTickerSkeleton({ 
  count = 6,
  delay = 0,
  className = '',
}: { 
  count?: number;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-6 overflow-hidden ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-2 flex-shrink-0">
          <AvatarSkeleton size="sm" delay={delay + i * 40} />
          <div className="space-y-1">
            <Skeleton className="w-12 h-3" delay={delay + i * 40 + 15} />
            <Skeleton className="w-16 h-4" delay={delay + i * 40 + 30} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
