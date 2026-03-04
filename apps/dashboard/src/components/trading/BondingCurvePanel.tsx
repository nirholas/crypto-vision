/**
 * BondingCurvePanel — Visual bonding curve with graduation progress
 */

'use client';

import React, { useMemo } from 'react';
import type { BondingCurveState } from '@/types/swarm';
import { formatSol } from '@/types/swarm';

// ─── Props ────────────────────────────────────────────────────

interface BondingCurvePanelProps {
  curveState: BondingCurveState | null;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export function BondingCurvePanel({ curveState, loading }: BondingCurvePanelProps) {
  // Generate bonding curve visualization
  const curvePoints = useMemo(() => {
    if (!curveState) return null;

    const points: Array<{ x: number; y: number }> = [];
    const totalTokens = curveState.virtualTokenReserves + curveState.realTokenReserves;
    const totalSol = curveState.virtualSolReserves + curveState.realSolReserves;

    // Pump.fun uses a constant product curve: x * y = k
    const k = totalSol * totalTokens;

    // Generate 100 points along the curve
    for (let i = 0; i <= 100; i++) {
      const tokenReserves = totalTokens * (0.1 + (i / 100) * 0.9);
      const solReserves = k / tokenReserves;
      const price = solReserves / tokenReserves;
      points.push({
        x: (i / 100) * 1000,
        y: price,
      });
    }

    // Normalize y to fit chart
    const maxPrice = Math.max(...points.map((p) => p.y));
    const minPrice = Math.min(...points.map((p) => p.y));
    const priceRange = maxPrice - minPrice || 1;

    return points.map((p) => ({
      x: p.x,
      y: 180 - ((p.y - minPrice) / priceRange) * 160,
    }));
  }, [curveState]);

  // Current position on curve
  const currentPosition = useMemo(() => {
    if (!curveState || !curvePoints) return null;
    const progress = Math.min(Math.max(curveState.graduationProgress / 100, 0), 1);
    const idx = Math.round(progress * (curvePoints.length - 1));
    return curvePoints[idx] ?? curvePoints[0];
  }, [curveState, curvePoints]);

  if (loading) {
    return <BondingCurveSkeleton />;
  }

  const graduationPct = curveState?.graduationProgress ?? 0;
  const graduationColor =
    graduationPct >= 80 ? 'text-emerald-400' : graduationPct >= 50 ? 'text-amber-400' : 'text-gray-400';
  const barColor =
    graduationPct >= 80
      ? 'bg-emerald-500'
      : graduationPct >= 50
        ? 'bg-amber-500'
        : 'bg-indigo-500';

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Bonding Curve</h3>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col gap-3 min-h-0 overflow-y-auto">
        {!curveState ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
            No bonding curve data
          </div>
        ) : (
          <>
            {/* Curve Visualization */}
            <div className="h-32 shrink-0">
              <svg viewBox="0 0 1000 200" preserveAspectRatio="none" className="w-full h-full">
                {/* Grid */}
                <line x1={0} x2={1000} y1={100} y2={100} stroke="#374151" strokeWidth={0.5} strokeDasharray="4,4" />

                {/* Curve path */}
                {curvePoints && (
                  <path
                    d={curvePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')}
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth={2}
                  />
                )}

                {/* Current position marker */}
                {currentPosition && (
                  <>
                    <circle cx={currentPosition.x} cy={currentPosition.y} r={6} fill="#818cf8" />
                    <circle
                      cx={currentPosition.x}
                      cy={currentPosition.y}
                      r={10}
                      fill="none"
                      stroke="#818cf8"
                      strokeWidth={1}
                      opacity={0.5}
                    >
                      <animate attributeName="r" from="8" to="16" dur="2s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.5" to="0" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </>
                )}

                {/* Graduation line */}
                <line x1={920} x2={920} y1={0} y2={200} stroke="#34d399" strokeWidth={1} strokeDasharray="4,4" opacity={0.5} />
                <text x={930} y={15} fill="#34d399" fontSize="10" opacity={0.6}>
                  GRAD
                </text>
              </svg>
            </div>

            {/* Graduation Progress */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-400">Graduation Progress</span>
                <span className={`font-bold tabular-nums ${graduationColor}`}>
                  {graduationPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${barColor} rounded-full transition-all duration-500`}
                  style={{ width: `${Math.min(graduationPct, 100)}%` }}
                />
              </div>
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Current Price" value={`${curveState.currentPriceSol.toFixed(8)} SOL`} />
              <MetricCard label="Market Cap" value={formatSol(curveState.marketCapSol)} />
              <MetricCard
                label="SOL Reserves"
                value={formatSol(curveState.realSolReserves)}
              />
              <MetricCard
                label="Token Reserves"
                value={new Intl.NumberFormat('en-US', { notation: 'compact' }).format(
                  curveState.realTokenReserves,
                )}
              />
            </div>

            {/* Status */}
            <div className="flex items-center gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full font-medium ${
                curveState.complete
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : 'bg-indigo-900/40 text-indigo-400'
              }`}>
                {curveState.complete ? '✓ Graduated' : '◆ Active'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Metric Card ──────────────────────────────────────────────

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/50 rounded px-3 py-2">
      <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-mono text-gray-200 tabular-nums truncate">{value}</p>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function BondingCurveSkeleton() {
  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="h-4 w-28 bg-gray-700 rounded" />
      </div>
      <div className="flex-1 p-4 space-y-3">
        <div className="h-32 bg-gray-800 rounded" />
        <div className="h-4 bg-gray-700 rounded" />
        <div className="h-2 bg-gray-700 rounded-full" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
