'use client';

/**
 * Sparkline Cell Component
 * Mini chart for displaying 7-day price history in table cells
 * Uses the enhanced Sparkline component from UI library
 */

import { Sparkline } from '@/components/ui';

interface SparklineCellProps {
  data: number[];
  change: number;
  width?: number;
  height?: number;
  /** Whether to animate the sparkline on mount */
  animate?: boolean;
  /** Whether to show the end dot indicator */
  showEndDot?: boolean;
}

export default function SparklineCell({
  data,
  change,
  width = 100,
  height = 32,
  animate = true,
  showEndDot = false,
}: SparklineCellProps) {
  const isPositive = change >= 0;

  return (
    <div className="sparkline-container flex-shrink-0">
      <Sparkline
        data={data}
        width={width}
        height={height}
        isPositive={isPositive}
        animate={animate}
        showEndDot={showEndDot}
        smooth={true}
        showFill={true}
        strokeWidth={1.5}
      />
    </div>
  );
}
