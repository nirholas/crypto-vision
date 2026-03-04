'use client';

/**
 * DonutChart Component
 * SVG-based donut chart for portfolio allocation visualization
 * Features: animated segments, hover tooltips, legend, responsive
 */

import React, { useState, useMemo, useId } from 'react';

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  /** Optional sub-label (e.g. coin symbol) */
  sublabel?: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  /** Outer radius of the donut */
  size?: number;
  /** Width of the donut ring */
  strokeWidth?: number;
  /** Minimum percentage to show label (others grouped into "Other") */
  minPercent?: number;
  /** Title to show in center */
  centerLabel?: string;
  /** Value to show in center */
  centerValue?: string;
  /** Whether to show the legend */
  showLegend?: boolean;
  /** Additional class names */
  className?: string;
}

const CHART_COLORS = [
  '#3B82F6', // blue
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#F59E0B', // amber
  '#10B981', // emerald
  '#06B6D4', // cyan
  '#F97316', // orange
  '#6366F1', // indigo
  '#14B8A6', // teal
  '#EF4444', // red
  '#84CC16', // lime
  '#A855F7', // purple
];

/** Generate a color for a given index */
export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}

/**
 * Group small segments into an "Others" bucket
 */
function groupSmallSegments(segments: DonutSegment[], minPercent: number): DonutSegment[] {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return [];

  const large: DonutSegment[] = [];
  let othersValue = 0;

  for (const segment of segments) {
    const pct = (segment.value / total) * 100;
    if (pct >= minPercent) {
      large.push(segment);
    } else {
      othersValue += segment.value;
    }
  }

  if (othersValue > 0) {
    large.push({
      label: 'Others',
      value: othersValue,
      color: '#6B7280',
    });
  }

  return large;
}

/**
 * Describes an arc path for SVG
 */
function describeArc(
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';

  return [
    'M', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
  ].join(' ');
}

function polarToCartesian(
  cx: number,
  cy: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
}

export function DonutChart({
  segments: rawSegments,
  size = 200,
  strokeWidth = 32,
  minPercent = 2,
  centerLabel,
  centerValue,
  showLegend = true,
  className = '',
}: DonutChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartId = useId();

  const segments = useMemo(
    () => groupSmallSegments(rawSegments, minPercent),
    [rawSegments, minPercent]
  );

  const total = useMemo(
    () => segments.reduce((sum, s) => sum + s.value, 0),
    [segments]
  );

  const arcs = useMemo(() => {
    if (total === 0) return [];

    const result: Array<{
      segment: DonutSegment;
      startAngle: number;
      endAngle: number;
      percent: number;
    }> = [];

    let currentAngle = 0;

    for (const segment of segments) {
      const percent = (segment.value / total) * 100;
      const sweepAngle = (segment.value / total) * 360;
      // Prevent full 360 which causes SVG arc issues
      const clampedSweep = Math.min(sweepAngle, 359.99);

      result.push({
        segment,
        startAngle: currentAngle,
        endAngle: currentAngle + clampedSweep,
        percent,
      });

      currentAngle += sweepAngle;
    }

    return result;
  }, [segments, total]);

  const radius = (size - strokeWidth) / 2;
  const center = size / 2;

  if (segments.length === 0) {
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--surface-border)"
            strokeWidth={strokeWidth}
          />
          <text
            x={center}
            y={center}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--text-muted)"
            fontSize="14"
          >
            No data
          </text>
        </svg>
      </div>
    );
  }

  return (
    <div className={`flex flex-col lg:flex-row items-center gap-6 ${className}`}>
      {/* Chart */}
      <div className="relative flex-shrink-0">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--surface-border)"
            strokeWidth={strokeWidth}
            opacity={0.3}
          />

          {/* Segments */}
          {arcs.map((arc, i) => {
            const isHovered = hoveredIndex === i;
            const path = describeArc(center, center, radius, arc.startAngle, arc.endAngle);

            return (
              <path
                key={`${chartId}-arc-${i}`}
                d={path}
                fill="none"
                stroke={arc.segment.color}
                strokeWidth={isHovered ? strokeWidth + 6 : strokeWidth}
                strokeLinecap="butt"
                className="transition-all duration-200 cursor-pointer"
                style={{
                  filter: isHovered ? 'brightness(1.2)' : undefined,
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              />
            );
          })}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredIndex !== null && arcs[hoveredIndex] ? (
            <>
              <span className="text-xs text-[var(--text-muted)] font-medium">
                {arcs[hoveredIndex].segment.label}
              </span>
              <span className="text-lg font-bold text-[var(--text-primary)]">
                {arcs[hoveredIndex].percent.toFixed(1)}%
              </span>
              <span className="text-xs text-[var(--text-secondary)]">
                ${arcs[hoveredIndex].segment.value.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </span>
            </>
          ) : (
            <>
              {centerLabel && (
                <span className="text-xs text-[var(--text-muted)] font-medium">
                  {centerLabel}
                </span>
              )}
              {centerValue && (
                <span className="text-lg font-bold text-[var(--text-primary)]">
                  {centerValue}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-col gap-2 min-w-0">
          {arcs.map((arc, i) => (
            <button
              key={`${chartId}-legend-${i}`}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg text-left transition-colors ${
                hoveredIndex === i ? 'bg-[var(--surface-hover)]' : ''
              }`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: arc.segment.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {arc.segment.label}
                  {arc.segment.sublabel && (
                    <span className="text-[var(--text-muted)] ml-1">
                      {arc.segment.sublabel}
                    </span>
                  )}
                </p>
              </div>
              <span className="text-sm text-[var(--text-secondary)] tabular-nums flex-shrink-0">
                {arc.percent.toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default DonutChart;
