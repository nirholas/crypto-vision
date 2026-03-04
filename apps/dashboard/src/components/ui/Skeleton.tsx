/**
 * @fileoverview Premium Skeleton Component
 * 
 * Loading placeholder with shimmer animation.
 * 
 * @module components/ui/Skeleton
 */
'use client';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  lines?: number;
  className?: string;
  animate?: boolean;
}

const variantClasses = {
  text: 'rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-none',
  rounded: 'rounded-xl',
};

export default function Skeleton({
  variant = 'text',
  width,
  height,
  lines = 1,
  className = '',
  animate = true,
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  if (lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`
              ${animate ? 'skeleton' : 'bg-surface-hover'}
              ${variantClasses[variant]}
              ${index === lines - 1 ? 'w-3/4' : 'w-full'}
            `}
            style={{ height: height || '1rem' }}
            aria-hidden="true"
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={`
        ${animate ? 'skeleton' : 'bg-surface-hover'}
        ${variantClasses[variant]}
        ${className}
      `}
      style={style}
      aria-hidden="true"
    />
  );
}

// Pre-built skeleton variants
export function TextSkeleton({ lines = 3, className = '' }: { lines?: number; className?: string }) {
  return <Skeleton variant="text" lines={lines} className={className} />;
}

export function AvatarSkeleton({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 32, md: 40, lg: 48 };
  return <Skeleton variant="circular" width={sizes[size]} height={sizes[size]} className={className} />;
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-surface rounded-xl p-4 space-y-4 ${className}`}>
      <div className="flex items-center gap-3">
        <AvatarSkeleton size="md" />
        <div className="flex-1 space-y-2">
          <Skeleton height={16} width="60%" />
          <Skeleton height={12} width="40%" />
        </div>
      </div>
      <Skeleton lines={3} />
      <div className="flex gap-2">
        <Skeleton height={32} width={80} variant="rounded" />
        <Skeleton height={32} width={80} variant="rounded" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ columns = 5, className = '' }: { columns?: number; className?: string }) {
  return (
    <tr className={className}>
      {Array.from({ length: columns }).map((_, index) => (
        <td key={index} className="px-4 py-3">
          <Skeleton height={20} width={index === 0 ? 24 : index === 1 ? '60%' : '80%'} />
        </td>
      ))}
    </tr>
  );
}

export function CoinRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3 px-4">
      <Skeleton width={32} height={16} variant="rounded" />
      <Skeleton variant="circular" width={32} height={32} />
      <div className="flex-1 space-y-1">
        <Skeleton height={16} width="40%" />
        <Skeleton height={12} width="20%" />
      </div>
      <Skeleton height={16} width={80} />
      <Skeleton height={16} width={60} variant="rounded" />
      <Skeleton height={24} width={80} />
      <Skeleton height={24} width={100} />
      <Skeleton height={32} width={64} variant="rounded" />
    </div>
  );
}

export function ChartSkeleton({ height = 200, className = '' }: { height?: number; className?: string }) {
  return (
    <div className={`bg-surface rounded-xl p-4 ${className}`}>
      <div className="flex justify-between items-center mb-4">
        <Skeleton height={20} width={120} />
        <div className="flex gap-2">
          <Skeleton height={24} width={40} variant="rounded" />
          <Skeleton height={24} width={40} variant="rounded" />
          <Skeleton height={24} width={40} variant="rounded" />
        </div>
      </div>
      <Skeleton height={height} variant="rounded" />
    </div>
  );
}
