'use client';

import React, { useMemo, useState } from 'react';
import type { PnLResponse, PnLDataPoint } from '@/types/swarm';
import { formatSol } from '@/types/swarm';

// ─── Time Range ───────────────────────────────────────────────

type TimeRange = '5m' | '15m' | '1h' | '4h' | 'all';

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  all: Number.MAX_SAFE_INTEGER,
};

// ─── Props ────────────────────────────────────────────────────

interface PriceChartPanelProps {
  pnlData: PnLResponse | null;
  currentPrice: number | null;
  trades?: Array<{ timestamp: number; direction: 'buy' | 'sell'; price: number }>;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export function PriceChartPanel({ pnlData, currentPrice, trades, loading }: PriceChartPanelProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');

  const filteredPoints = useMemo(() => {
    if (!pnlData?.timeSeries?.points?.length) return [];
    const now = Date.now();
    const cutoff = now - TIME_RANGE_MS[timeRange];
    return pnlData.timeSeries.points.filter((p) => p.timestamp >= cutoff);
  }, [pnlData, timeRange]);

  const { minPrice, maxPrice, priceRange } = useMemo(() => {
    if (filteredPoints.length === 0) return { minPrice: 0, maxPrice: 1, priceRange: 1 };
    const prices = filteredPoints.map((p) => p.cumulativePnl);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const range = max - min || 1;
    return { minPrice: min - range * 0.1, maxPrice: max + range * 0.1, priceRange: range * 1.2 };
  }, [filteredPoints]);

  // Build SVG path
  const chartPath = useMemo(() => {
    if (filteredPoints.length < 2) return '';
    const width = 600;
    const height = 200;
    const points = filteredPoints.map((p, i) => {
      const x = (i / (filteredPoints.length - 1)) * width;
      const y = height - ((p.cumulativePnl - minPrice) / priceRange) * height;
      return `${x},${y}`;
    });
    return `M${points.join(' L')}`;
  }, [filteredPoints, minPrice, priceRange]);

  // Build area path
  const areaPath = useMemo(() => {
    if (!chartPath) return '';
    return `${chartPath} L600,200 L0,200 Z`;
  }, [chartPath]);

  // Volume bars
  const volumeBars = useMemo(() => {
    if (filteredPoints.length === 0) return [];
    const maxVol = Math.max(...filteredPoints.map((p) => p.tradeCount), 1);
    return filteredPoints.map((p, i) => ({
      x: (i / Math.max(filteredPoints.length - 1, 1)) * 600,
      height: (p.tradeCount / maxVol) * 40,
      count: p.tradeCount,
    }));
  }, [filteredPoints]);

  // Trade markers
  const tradeMarkers = useMemo(() => {
    if (!trades?.length || filteredPoints.length < 2) return [];
    const now = Date.now();
    const cutoff = now - TIME_RANGE_MS[timeRange];
    const filtered = trades.filter((t) => t.timestamp >= cutoff);
    const timeStart = filteredPoints[0]?.timestamp ?? cutoff;
    const timeEnd = filteredPoints[filteredPoints.length - 1]?.timestamp ?? now;
    const timeDelta = timeEnd - timeStart || 1;

    return filtered.map((t) => ({
      x: ((t.timestamp - timeStart) / timeDelta) * 600,
      y: 200 - ((t.price - minPrice) / priceRange) * 200,
      direction: t.direction,
    }));
  }, [trades, filteredPoints, timeRange, minPrice, priceRange]);

  const isPositive = (currentPrice ?? 0) >= 0;

  if (loading) {
    return <PriceChartSkeleton />;
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Price Chart</h3>
          {currentPrice !== null && (
            <span
              className={`text-lg font-bold tabular-nums ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {formatSol(currentPrice)}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {(['5m', '15m', '1h', '4h', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                timeRange === range
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 relative p-2 min-h-[200px]">
        {filteredPoints.length < 2 ? (
          <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
            Waiting for price data...
          </div>
        ) : (
          <svg viewBox="0 0 600 240" className="w-full h-full" preserveAspectRatio="none">
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
              <line
                key={pct}
                x1={0}
                y1={pct * 200}
                x2={600}
                y2={pct * 200}
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="4 4"
              />
            ))}

            {/* Area fill */}
            <path d={areaPath} fill={isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'} />

            {/* Price line */}
            <path
              d={chartPath}
              fill="none"
              stroke={isPositive ? '#10b981' : '#ef4444'}
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />

            {/* Volume bars */}
            {volumeBars.map((bar, i) => (
              <rect
                key={i}
                x={bar.x - 2}
                y={240 - bar.height}
                width={4}
                height={bar.height}
                fill="rgba(99,102,241,0.4)"
                rx={1}
              />
            ))}

            {/* Trade markers */}
            {tradeMarkers.map((mark, i) => (
              <circle
                key={i}
                cx={mark.x}
                cy={Math.max(4, Math.min(196, mark.y))}
                r={4}
                fill={mark.direction === 'buy' ? '#10b981' : '#ef4444'}
                stroke="rgba(0,0,0,0.4)"
                strokeWidth={1}
              />
            ))}
          </svg>
        )}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function PriceChartSkeleton() {
  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="h-4 w-24 bg-gray-700 rounded" />
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 w-8 bg-gray-700 rounded" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="h-full bg-gray-800 rounded" />
      </div>
    </div>
  );
}
