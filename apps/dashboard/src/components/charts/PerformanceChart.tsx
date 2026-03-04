'use client';

/**
 * PerformanceChart Component
 * Line chart (using recharts) for portfolio/asset performance over time
 * Features: time range selector, multi-line overlay, benchmark comparison, responsive
 */

import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

export type TimeRange = '24h' | '7d' | '30d' | '90d' | '1y' | 'all';

export interface PerformanceDataPoint {
  timestamp: number;
  value: number;
  /** Additional series keyed by name */
  [key: string]: number;
}

export interface ChartSeries {
  dataKey: string;
  name: string;
  color: string;
  /** Whether this series is visible */
  visible?: boolean;
  /** Stroke dash pattern (for benchmarks) */
  strokeDasharray?: string;
}

interface PerformanceChartProps {
  data: PerformanceDataPoint[];
  /** Additional series/overlays */
  series?: ChartSeries[];
  /** Currently selected time range */
  timeRange?: TimeRange;
  /** Callback when time range changes */
  onTimeRangeChange?: (range: TimeRange) => void;
  /** Height of the chart in pixels */
  height?: number;
  /** Whether to show the time range selector */
  showRangeSelector?: boolean;
  /** Whether to format y-axis as currency */
  isCurrency?: boolean;
  /** Additional class names */
  className?: string;
  /** Whether data is loading */
  isLoading?: boolean;
}

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
  { key: '30d', label: '30D' },
  { key: '90d', label: '90D' },
  { key: '1y', label: '1Y' },
  { key: 'all', label: 'All' },
];

function formatCurrency(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(2)}`;
}

function formatDate(timestamp: number, range: TimeRange): string {
  const date = new Date(timestamp);
  switch (range) {
    case '24h':
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    case '7d':
      return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    case '30d':
    case '90d':
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    case '1y':
    case 'all':
      return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    default:
      return date.toLocaleDateString();
  }
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    name: string;
    color: string;
    dataKey: string;
  }>;
  label?: number;
  isCurrency: boolean;
}

function CustomChartTooltip({ active, payload, label, isCurrency }: CustomTooltipProps) {
  if (!active || !payload || !payload.length || !label) return null;

  return (
    <div className="bg-[var(--surface-elevated)] border border-[var(--surface-border)] rounded-xl p-3 shadow-xl">
      <p className="text-xs text-[var(--text-muted)] mb-2">
        {new Date(label).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-[var(--text-secondary)]">{entry.name}:</span>
          <span className="font-semibold text-[var(--text-primary)]">
            {isCurrency ? formatCurrency(entry.value) : entry.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function PerformanceChart({
  data,
  series = [],
  timeRange = '30d',
  onTimeRangeChange,
  height = 320,
  showRangeSelector = true,
  isCurrency = true,
  className = '',
  isLoading = false,
}: PerformanceChartProps) {
  const [internalRange, setInternalRange] = useState<TimeRange>(timeRange);
  const activeRange = onTimeRangeChange ? timeRange : internalRange;

  const handleRangeChange = (range: TimeRange) => {
    if (onTimeRangeChange) {
      onTimeRangeChange(range);
    } else {
      setInternalRange(range);
    }
  };

  // All visible series (always include the main "value" series)
  const visibleSeries = useMemo(() => {
    const allSeries: ChartSeries[] = [
      { dataKey: 'value', name: 'Portfolio', color: '#3B82F6', visible: true },
      ...series,
    ];
    return allSeries.filter((s) => s.visible !== false);
  }, [series]);

  // Compute chart data domain for better axis formatting
  const [yMin, yMax] = useMemo(() => {
    if (data.length === 0) return [0, 0];
    let min = Infinity;
    let max = -Infinity;
    for (const point of data) {
      for (const s of visibleSeries) {
        const val = point[s.dataKey];
        if (typeof val === 'number') {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
    }
    const padding = (max - min) * 0.05;
    return [Math.max(0, min - padding), max + padding];
  }, [data, visibleSeries]);

  if (isLoading) {
    return (
      <div className={`${className}`}>
        {showRangeSelector && (
          <div className="flex items-center gap-1 mb-4">
            {TIME_RANGES.map((r) => (
              <div key={r.key} className="h-8 w-12 bg-[var(--surface-hover)] rounded-lg animate-pulse" />
            ))}
          </div>
        )}
        <div className="animate-pulse rounded-xl bg-[var(--surface-hover)]" style={{ height }} />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`${className}`}>
        {showRangeSelector && (
          <div className="flex items-center gap-1 mb-4">
            {TIME_RANGES.map((r) => (
              <button
                key={r.key}
                className="px-3 py-1.5 rounded-lg text-sm font-medium text-[var(--text-muted)]"
                disabled
              >
                {r.label}
              </button>
            ))}
          </div>
        )}
        <div
          className="flex items-center justify-center rounded-xl border border-[var(--surface-border)] bg-[var(--surface)]"
          style={{ height }}
        >
          <p className="text-[var(--text-muted)] text-sm">
            Not enough data to display chart
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {showRangeSelector && (
        <div className="flex items-center gap-1 mb-4">
          {TIME_RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => handleRangeChange(r.key)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeRange === r.key
                  ? 'bg-[var(--primary)] text-white'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--surface-border)"
            vertical={false}
          />
          <XAxis
            dataKey="timestamp"
            tickFormatter={(ts) => formatDate(ts, activeRange)}
            stroke="var(--text-muted)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={isCurrency ? formatCurrency : undefined}
            stroke="var(--text-muted)"
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={65}
          />
          <Tooltip
            content={<CustomChartTooltip isCurrency={isCurrency} />}
            cursor={{ stroke: 'var(--text-muted)', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          {visibleSeries.length > 1 && (
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
            />
          )}
          {visibleSeries.map((s) => (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name}
              stroke={s.color}
              strokeWidth={s.dataKey === 'value' ? 2.5 : 1.5}
              strokeDasharray={s.strokeDasharray}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Generate synthetic portfolio performance data for demonstration
 * when no real historical data is available
 */
export function generateMockPerformanceData(
  totalValue: number,
  timeRange: TimeRange,
  volatility: number = 0.02
): PerformanceDataPoint[] {
  const now = Date.now();
  let points: number;
  let intervalMs: number;

  switch (timeRange) {
    case '24h':
      points = 24;
      intervalMs = 60 * 60 * 1000; // 1 hour
      break;
    case '7d':
      points = 7 * 4;
      intervalMs = 6 * 60 * 60 * 1000; // 6 hours
      break;
    case '30d':
      points = 30;
      intervalMs = 24 * 60 * 60 * 1000; // 1 day
      break;
    case '90d':
      points = 90;
      intervalMs = 24 * 60 * 60 * 1000;
      break;
    case '1y':
      points = 52;
      intervalMs = 7 * 24 * 60 * 60 * 1000; // 1 week
      break;
    case 'all':
      points = 100;
      intervalMs = 7 * 24 * 60 * 60 * 1000;
      break;
    default:
      points = 30;
      intervalMs = 24 * 60 * 60 * 1000;
  }

  const data: PerformanceDataPoint[] = [];
  let value = totalValue * (0.7 + Math.random() * 0.2); // Start at 70-90% of current

  // Use a seeded approach with deterministic drift toward current value
  const drift = (totalValue - value) / points;

  for (let i = 0; i < points; i++) {
    const timestamp = now - (points - i) * intervalMs;
    const randomChange = (Math.random() - 0.45) * volatility * value;
    value = Math.max(0, value + drift + randomChange);
    data.push({
      timestamp,
      value: Math.round(value * 100) / 100,
    });
  }

  // Ensure last point matches current total
  if (data.length > 0) {
    data[data.length - 1].value = totalValue;
  }

  return data;
}

export default PerformanceChart;
