'use client';

import React from 'react';
import type { BondingCurveState } from '@/types/swarm';
import { formatSol } from '@/types/swarm';

// ─── Props ────────────────────────────────────────────────────

interface BondingCurvePanelProps {
  curveState: BondingCurveState | null;
  entryPrice?: number;
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export function BondingCurvePanel({ curveState, entryPrice, loading }: BondingCurvePanelProps) {
  if (loading) {
    return <BondingCurveSkeleton />;
  }

  const graduationPrice = curveState
    ? curveState.currentPriceSol * (100 / Math.max(curveState.graduationProgress, 0.01))
    : 0;

  // Build bonding curve visualization points
  const curvePoints = React.useMemo(() => {
    if (!curveState) return '';
    const points: string[] = [];
    const width = 300;
    const height = 160;
    // Simulate x^2 bonding curve shape
    for (let i = 0; i <= 50; i++) {
      const t = i / 50;
      const x = t * width;
      const y = height - (t * t) * height;
      points.push(`${x},${y}`);
    }
    return `M${points.join(' L')}`;
  }, [curveState]);

  // Current position on the curve (based on graduation progress)
  const currentPos = React.useMemo(() => {
    if (!curveState) return { x: 0, y: 0 };
    const t = Math.sqrt(curveState.graduationProgress / 100);
    const width = 300;
    const height = 160;
    return {
      x: t * width,
      y: height - (t * t) * height,
    };
  }, [curveState]);

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Bonding Curve</h3>
      </div>

      {!curveState ? (
        <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
          No bonding curve data available
        </div>
      ) : (
        <div className="flex-1 p-3 flex flex-col gap-3">
          {/* Curve SVG */}
          <div className="relative">
            <svg viewBox="0 0 300 160" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
              {/* Grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
                <line
                  key={pct}
                  x1={0}
                  y1={pct * 160}
                  x2={300}
                  y2={pct * 160}
                  stroke="rgba(255,255,255,0.04)"
                  strokeDasharray="3 3"
                />
              ))}

              {/* Curve line */}
              <path d={curvePoints} fill="none" stroke="#6366f1" strokeWidth={2} />

              {/* Area under curve to current position */}
              <path
                d={`${curvePoints.split(' L').slice(0, Math.ceil(50 * Math.sqrt(curveState.graduationProgress / 100)) + 1).join(' L')} L${currentPos.x},160 L0,160 Z`}
                fill="rgba(99,102,241,0.15)"
              />

              {/* Current position dot */}
              <circle cx={currentPos.x} cy={currentPos.y} r={6} fill="#6366f1" stroke="#312e81" strokeWidth={2}>
                <animate attributeName="r" values="5;7;5" dur="2s" repeatCount="indefinite" />
              </circle>

              {/* Entry price marker */}
              {entryPrice !== undefined && entryPrice > 0 && (
                <line
                  x1={0}
                  y1={160 - (Math.sqrt(entryPrice / graduationPrice) ** 2) * 160}
                  x2={300}
                  y2={160 - (Math.sqrt(entryPrice / graduationPrice) ** 2) * 160}
                  stroke="#f59e0b"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.6}
                />
              )}

              {/* Graduation line */}
              <line x1={300} y1={0} x2={300} y2={160} stroke="#10b981" strokeWidth={1} strokeDasharray="4 4" opacity={0.5} />

              {/* Labels */}
              <text x={4} y={155} fill="rgba(255,255,255,0.4)" fontSize={10}>
                SOL Reserves
              </text>
              <text x={260} y={12} fill="rgba(16,185,129,0.6)" fontSize={9}>
                Graduation
              </text>
            </svg>
          </div>

          {/* Graduation Progress */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Graduation Progress</span>
              <span className="text-white font-medium">{curveState.graduationProgress.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(curveState.graduationProgress, 100)}%` }}
              />
            </div>
          </div>

          {/* Key Levels */}
          <div className="grid grid-cols-2 gap-2">
            <KeyLevel label="Current Price" value={formatSol(curveState.currentPriceSol)} color="text-white" />
            {entryPrice !== undefined && entryPrice > 0 && (
              <KeyLevel label="Entry Price" value={formatSol(entryPrice)} color="text-amber-400" />
            )}
            <KeyLevel label="Market Cap" value={formatSol(curveState.marketCapSol)} color="text-indigo-400" />
            <KeyLevel
              label="Graduation"
              value={curveState.complete ? 'Complete' : `${curveState.graduationProgress.toFixed(0)}%`}
              color={curveState.complete ? 'text-emerald-400' : 'text-gray-300'}
            />
          </div>

          {/* Reserves */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 bg-gray-800/50 rounded">
              <span className="text-gray-500">SOL Reserves</span>
              <p className="text-gray-200 font-mono">{curveState.realSolReserves.toFixed(4)}</p>
            </div>
            <div className="p-2 bg-gray-800/50 rounded">
              <span className="text-gray-500">Token Reserves</span>
              <p className="text-gray-200 font-mono">{curveState.realTokenReserves.toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Key Level Component ──────────────────────────────────────

function KeyLevel({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="p-2 bg-gray-800/50 rounded">
      <span className="text-xs text-gray-500">{label}</span>
      <p className={`text-sm font-medium font-mono ${color}`}>{value}</p>
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
      <div className="flex-1 p-3 space-y-3">
        <div className="h-32 bg-gray-800 rounded" />
        <div className="h-2 bg-gray-800 rounded-full" />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-gray-800 rounded" />
          ))}
        </div>
      </div>
    </div>
  );
}
