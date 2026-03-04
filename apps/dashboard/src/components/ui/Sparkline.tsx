'use client';

/**
 * Sparkline Component
 * Professional mini chart for displaying price trends
 * Features: smooth bezier curves, gradient fill, drawing animation, hover effects
 */

import { useMemo, useId } from 'react';

export interface SparklineProps {
  /** Array of numeric data points */
  data: number[];
  /** Width of the sparkline in pixels */
  width?: number;
  /** Height of the sparkline in pixels */
  height?: number;
  /** Whether the trend is positive (green) or negative (red) */
  isPositive?: boolean;
  /** Override the stroke color */
  strokeColor?: string;
  /** Override the fill color (gradient start) */
  fillColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Whether to show the gradient fill under the line */
  showFill?: boolean;
  /** Whether to animate the line drawing on mount */
  animate?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether to show a dot at the end of the line */
  showEndDot?: boolean;
  /** Whether to use smooth bezier curves (vs straight lines) */
  smooth?: boolean;
}

/**
 * Generate a smooth bezier curve path through the given points
 */
function generateSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';

  const path: string[] = [];
  path.push(`M ${points[0].x},${points[0].y}`);

  for (let i = 0; i < points.length - 1; i++) {
    const current = points[i];
    const next = points[i + 1];
    const prev = points[i - 1] || current;
    const afterNext = points[i + 2] || next;

    // Calculate control points for smooth curve
    const tension = 0.3;
    
    const cp1x = current.x + (next.x - prev.x) * tension;
    const cp1y = current.y + (next.y - prev.y) * tension;
    const cp2x = next.x - (afterNext.x - current.x) * tension;
    const cp2y = next.y - (afterNext.y - current.y) * tension;

    path.push(`C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`);
  }

  return path.join(' ');
}

/**
 * Generate a straight line path through the given points
 */
function generateLinearPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';

  return points.map((p, i) => 
    `${i === 0 ? 'M' : 'L'} ${p.x},${p.y}`
  ).join(' ');
}

export default function Sparkline({
  data,
  width = 100,
  height = 32,
  isPositive = true,
  strokeColor,
  fillColor,
  strokeWidth = 1.5,
  showFill = true,
  animate = true,
  className = '',
  showEndDot = false,
  smooth = true,
}: SparklineProps) {
  const uniqueId = useId();
  const gradientId = `sparkline-gradient-${uniqueId}`;
  const maskId = `sparkline-mask-${uniqueId}`;

  const { path, fillPath, points, pathLength } = useMemo(() => {
    if (!data || data.length < 2) {
      return { path: '', fillPath: '', points: [], pathLength: 0 };
    }

    // Normalize data to fit within the SVG
    const padding = 2; // Small padding to prevent clipping
    const effectiveHeight = height - padding * 2;
    const effectiveWidth = width - padding * 2;
    
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;

    // Sample data if too many points (performance optimization)
    const maxPoints = 50;
    const sampledData = data.length > maxPoints 
      ? data.filter((_, i) => i % Math.ceil(data.length / maxPoints) === 0 || i === data.length - 1)
      : data;

    const pts = sampledData.map((value, index) => ({
      x: padding + (index / (sampledData.length - 1)) * effectiveWidth,
      y: padding + effectiveHeight - ((value - min) / range) * effectiveHeight,
    }));

    const linePath = smooth ? generateSmoothPath(pts) : generateLinearPath(pts);
    
    // Create fill path (closed shape under the line)
    const fill = linePath 
      ? `${linePath} L ${width - padding},${height} L ${padding},${height} Z`
      : '';

    // Approximate path length for animation
    const approxLength = pts.reduce((acc, p, i) => {
      if (i === 0) return 0;
      const prev = pts[i - 1];
      return acc + Math.sqrt(Math.pow(p.x - prev.x, 2) + Math.pow(p.y - prev.y, 2));
    }, 0);

    return { 
      path: linePath, 
      fillPath: fill, 
      points: pts,
      pathLength: approxLength 
    };
  }, [data, width, height, smooth]);

  // Determine colors
  const lineColor = strokeColor || (isPositive ? 'var(--gain)' : 'var(--loss)');
  const gradientColor = fillColor || lineColor;

  // Get last point for end dot
  const lastPoint = points[points.length - 1];

  if (!data || data.length < 2) {
    return (
      <div 
        className={`bg-surface-hover rounded animate-pulse ${className}`} 
        style={{ width, height }} 
      />
    );
  }

  return (
    <svg 
      width={width} 
      height={height} 
      className={`sparkline ${animate ? 'sparkline-animated' : ''} ${className}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
      <defs>
        {/* Gradient for fill area */}
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={gradientColor} stopOpacity="0.3" />
          <stop offset="50%" stopColor={gradientColor} stopOpacity="0.1" />
          <stop offset="100%" stopColor={gradientColor} stopOpacity="0" />
        </linearGradient>

        {/* Mask for drawing animation */}
        {animate && (
          <mask id={maskId}>
            <rect 
              x="0" 
              y="0" 
              width={width} 
              height={height} 
              fill="white"
              className="sparkline-mask-rect"
            />
          </mask>
        )}
      </defs>

      {/* Fill area under the line */}
      {showFill && fillPath && (
        <path 
          d={fillPath} 
          fill={`url(#${gradientId})`}
          className="sparkline-fill"
          mask={animate ? `url(#${maskId})` : undefined}
        />
      )}

      {/* Main line */}
      <path
        d={path}
        fill="none"
        stroke={lineColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="sparkline-line"
        style={animate ? {
          strokeDasharray: pathLength,
          strokeDashoffset: pathLength,
        } : undefined}
        mask={animate ? `url(#${maskId})` : undefined}
      />

      {/* End dot */}
      {showEndDot && lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r={3}
          fill={lineColor}
          className="sparkline-dot"
        />
      )}
    </svg>
  );
}

/**
 * Sparkline with built-in loading state
 */
export function SparklineWithLoader({
  data,
  isLoading = false,
  ...props
}: SparklineProps & { isLoading?: boolean }) {
  if (isLoading) {
    return (
      <div 
        className="skeleton rounded" 
        style={{ width: props.width || 100, height: props.height || 32 }} 
      />
    );
  }

  return <Sparkline data={data} {...props} />;
}

/**
 * Inline sparkline for use within text
 */
export function InlineSparkline({
  data,
  isPositive = true,
  className = '',
}: {
  data: number[];
  isPositive?: boolean;
  className?: string;
}) {
  return (
    <Sparkline
      data={data}
      width={60}
      height={16}
      isPositive={isPositive}
      strokeWidth={1}
      showFill={false}
      showEndDot={false}
      animate={false}
      className={`inline-block align-middle ${className}`}
    />
  );
}
