/**
 * PriceChartPanel — Bonding curve price over time with volume bars and trade markers
 */

'use client';

import React, { useState, useMemo } from 'react';
import type { PnLResponse, TradeDirection } from '@/types/swarm';

// ─── Types ────────────────────────────────────────────────────

interface TradeMarker {
  timestamp: number;
  direction: TradeDirection;
  price: number;
}

interface PriceChartPanelProps {
  pnlData: PnLResponse | null;
  currentPrice: number | null;
  trades: TradeMarker[];
  loading?: boolean;
}

type TimeRange = '5m' | '15m' | '1h' | '4h' | 'all';

const TIME_RANGE_MS: Record<TimeRange, number> = {
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '4h': 4 * 60 * 60 * 1000,
  all: Number.MAX_SAFE_INTEGER,
};

// ─── Component ────────────────────────────────────────────────

export function PriceChartPanel({ pnlData, currentPrice, trades, loading }: PriceChartPanelProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');

  // Filter data to time range
  const now = Date.now();
  const cutoff = now - TIME_RANGE_MS[timeRange];

  const filteredPoints = useMemo(() => {
    if (!pnlData?.timeSeries?.points) return [];
    return pnlData.timeSeries.points.filter((p) => p.timestamp >= cutoff);
  }, [pnlData, cutoff]);

  const filteredTrades = useMemo(() => {
    return trades.filter((t) => t.timestamp >= cutoff);
  }, [trades, cutoff]);

  // Derive price from PnL data (PnL cumulative can represent price movement)
  const pricePoints = useMemo(() => {
    if (filteredPoints.length === 0) return [];
    return filteredPoints.map((p) => ({
      timestamp: p.timestamp,
      value: p.cumulativePnl,
      volume: p.tradeCount,
    }));
  }, [filteredPoints]);

  // Chart dimensions
  const chartWidth = 100; // percentage
  const chartHeight = 200;
  const volumeHeight = 40;

  // Calculate scales
  const { minVal, maxVal, minVol, maxVol, path, volumeBars, tradeDotsPositions } = useMemo(() => {
    if (pricePoints.length === 0) {
      return { minVal: 0, maxVal: 1, minVol: 0, maxVol: 1, path: '', volumeBars: [], tradeDotsPositions: [] };
    }

    const values = pricePoints.map((p) => p.value);
    const volumes = pricePoints.map((p) => p.volume);
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const range = mx - mn || 1;
    const mnVol = 0;
    const mxVol = Math.max(...volumes) || 1;

    const timeMin = pricePoints[0].timestamp;
    const timeMax = pricePoints[pricePoints.length - 1].timestamp;
    const timeSpan = timeMax - timeMin || 1;

    // SVG path for the line
    const pts = pricePoints.map((p) => {
      const x = ((p.timestamp - timeMin) / timeSpan) * 1000;
      const y = chartHeight - ((p.value - mn) / range) * (chartHeight - 20) - 10;
      return { x, y };
    });

    const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    // Volume bars
    const barWidth = Math.max(2, 1000 / (pricePoints.length + 1));
    const vBars = pricePoints.map((p) => {
      const x = ((p.timestamp - timeMin) / timeSpan) * 1000;
      const h = (p.volume / mxVol) * volumeHeight;
      return { x: x - barWidth / 2, y: volumeHeight - h, w: barWidth, h };
    });

    // Trade marker positions
    const dots = filteredTrades
      .filter((t) => t.timestamp >= timeMin && t.timestamp <= timeMax)
      .map((t) => {
        const x = ((t.timestamp - timeMin) / timeSpan) * 1000;
        // Find closest price point for y position
        let closestIdx = 0;
        let closestDist = Math.abs(pricePoints[0].timestamp - t.timestamp);
        for (let i = 1; i < pricePoints.length; i++) {
          const dist = Math.abs(pricePoints[i].timestamp - t.timestamp);
          if (dist < closestDist) {
            closestDist = dist;
            closestIdx = i;
          }
        }
        const y =
          chartHeight -
          ((pricePoints[closestIdx].value - mn) / range) * (chartHeight - 20) -
          10;
        return { x, y, direction: t.direction };
      });

    return {
      minVal: mn,
      maxVal: mx,
      minVol: mnVol,
      maxVol: mxVol,
      path: pathD,
      volumeBars: vBars,
      tradeDotsPositions: dots,
    };
  }, [pricePoints, filteredTrades, chartHeight]);

  if (loading) {
    return <PriceChartSkeleton />;
  }

  const priceColor = currentPrice !== null && currentPrice >= 0 ? 'text-emerald-400' : 'text-red-400';
  const lineColor = currentPrice !== null && currentPrice >= 0 ? '#34d399' : '#f87171';

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Price</h3>
          {currentPrice !== null && (
            <span className={`text-lg font-bold tabular-nums ${priceColor}`}>
              {currentPrice.toFixed(8)} SOL
            </span>
          )}
        </div>
        {/* Time range selector */}
        <div className="flex gap-1">
          {(['5m', '15m', '1h', '4h', 'all'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-2 py-1 text-[10px] font-medium rounded transition-colors ${
                timeRange === range
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Area */}
      <div className="flex-1 px-2 py-1 min-h-0 flex flex-col">
        {pricePoints.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            No price data available
          </div>
        ) : (
          <>
            {/* Price Line */}
            <div className="flex-1 min-h-0">
              <svg
                viewBox={`0 0 1000 ${chartHeight}`}
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map((frac) => (
                  <line
                    key={frac}
                    x1={0}
                    x2={1000}
                    y1={chartHeight * frac}
                    y2={chartHeight * frac}
                    stroke="#374151"
                    strokeWidth={0.5}
                    strokeDasharray="4,4"
                  />
                ))}

                {/* Gradient fill */}
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={lineColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>

                {/* Fill area */}
                {path && (
                  <path
                    d={`${path} L 1000 ${chartHeight} L 0 ${chartHeight} Z`}
                    fill="url(#priceGradient)"
                  />
                )}

                {/* Price line */}
                <path d={path} fill="none" stroke={lineColor} strokeWidth={2} />

                {/* Trade markers */}
                {tradeDotsPositions.map((dot, i) => (
                  <circle
                    key={i}
                    cx={dot.x}
                    cy={dot.y}
                    r={4}
                    fill={dot.direction === 'buy' ? '#34d399' : '#f87171'}
                    stroke={dot.direction === 'buy' ? '#059669' : '#dc2626'}
                    strokeWidth={1}
                    opacity={0.8}
                  />
                ))}
              </svg>
            </div>

            {/* Volume Bars */}
            <div className="h-10 shrink-0">
              <svg
                viewBox={`0 0 1000 ${volumeHeight}`}
                preserveAspectRatio="none"
                className="w-full h-full"
              >
                {volumeBars.map((bar, i) => (
                  <rect
                    key={i}
                    x={bar.x}
                    y={bar.y}
                    width={bar.w * 0.8}
                    height={bar.h}
                    fill="#6366f1"
                    opacity={0.4}
                    rx={1}
                  />
                ))}
              </svg>
            </div>
          </>
        )}
      </div>

      {/* Y-axis labels */}
      {pricePoints.length > 0 && (
        <div className="absolute right-2 top-14 flex flex-col justify-between h-[calc(100%-80px)] text-[9px] text-gray-500 tabular-nums pointer-events-none">
          <span>{maxVal.toFixed(4)}</span>
          <span>{((maxVal + minVal) / 2).toFixed(4)}</span>
          <span>{minVal.toFixed(4)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function PriceChartSkeleton() {
  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-4 w-12 bg-gray-700 rounded" />
          <div className="h-6 w-32 bg-gray-700 rounded" />
        </div>
        <div className="flex gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 w-8 bg-gray-700 rounded" />
          ))}
        </div>
      </div>
      <div className="flex-1 p-4">
        <div className="h-full bg-gray-800 rounded" />
      </div>
      <div className="h-10 px-4 pb-2">
        <div className="h-full bg-gray-800/50 rounded" />
      </div>
    </div>
  );
}
