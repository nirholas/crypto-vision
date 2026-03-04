'use client';

import React, { useMemo } from 'react';
import type { SupplyDistribution } from '@/types/swarm';
import { formatSol, solscanAddressUrl } from '@/types/swarm';

// ─── Props ────────────────────────────────────────────────────

interface SupplyDistributionPanelProps {
  supply: SupplyDistribution | null;
  network?: 'mainnet-beta' | 'devnet';
  loading?: boolean;
}

// ─── Component ────────────────────────────────────────────────

export function SupplyDistributionPanel({ supply, network = 'mainnet-beta', loading }: SupplyDistributionPanelProps) {
  // Compute Gini coefficient
  const giniCoefficient = useMemo(() => {
    if (!supply?.holders?.length) return 0;
    const balances = supply.holders.map((h) => h.balance).sort((a, b) => a - b);
    const n = balances.length;
    if (n === 0) return 0;
    const total = balances.reduce((a, b) => a + b, 0);
    if (total === 0) return 0;

    let cumulativeSum = 0;
    let weightedSum = 0;
    for (let i = 0; i < n; i++) {
      cumulativeSum += balances[i];
      weightedSum += (i + 1) * balances[i];
    }

    return (2 * weightedSum) / (n * total) - (n + 1) / n;
  }, [supply]);

  // Pie chart segments
  const segments = useMemo(() => {
    if (!supply?.holders?.length) return [];

    // Group into categories
    const categories: Array<{ label: string; percentage: number; color: string }> = [];

    const devHolders = supply.holders.filter((h) => h.label.toLowerCase().includes('dev') || h.label.toLowerCase().includes('creator'));
    const traderHolders = supply.holders.filter((h) => h.label.toLowerCase().includes('trader'));
    const externalHolders = supply.holders.filter(
      (h) => !h.label.toLowerCase().includes('dev') && !h.label.toLowerCase().includes('creator') && !h.label.toLowerCase().includes('trader'),
    );

    const devPct = devHolders.reduce((s, h) => s + h.percentage, 0);
    const traderPct = traderHolders.reduce((s, h) => s + h.percentage, 0);
    const externalPct = externalHolders.reduce((s, h) => s + h.percentage, 0);
    const curvePct = supply.bondingCurveHeld > 0 ? (supply.bondingCurveHeld / supply.totalSupply) * 100 : 0;

    if (devPct > 0) categories.push({ label: 'Dev Wallet', percentage: devPct, color: '#6366f1' });
    if (traderPct > 0) categories.push({ label: 'Trader Wallets', percentage: traderPct, color: '#10b981' });
    if (curvePct > 0) categories.push({ label: 'Bonding Curve', percentage: curvePct, color: '#f59e0b' });
    if (externalPct > 0) categories.push({ label: 'External', percentage: externalPct, color: '#8b5cf6' });

    // Build pie segments
    let cumulativeAngle = 0;
    return categories.map((cat) => {
      const angle = (cat.percentage / 100) * 360;
      const startAngle = cumulativeAngle;
      cumulativeAngle += angle;

      const startRad = (startAngle - 90) * (Math.PI / 180);
      const endRad = (startAngle + angle - 90) * (Math.PI / 180);
      const largeArc = angle > 180 ? 1 : 0;

      const r = 60;
      const cx = 80;
      const cy = 80;
      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const path = angle >= 359.99
        ? `M${cx},${cy - r} A${r},${r} 0 1,1 ${cx - 0.01},${cy - r} Z`
        : `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc},1 ${x2},${y2} Z`;

      return { ...cat, path };
    });
  }, [supply]);

  if (loading) {
    return <SupplySkeleton />;
  }

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Supply Distribution</h3>
      </div>

      {!supply ? (
        <div className="p-8 text-center text-gray-500 text-sm">No supply data available</div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Pie Chart + Legend */}
          <div className="flex items-center gap-6">
            <svg viewBox="0 0 160 160" className="w-32 h-32 shrink-0">
              {segments.map((seg, i) => (
                <path key={i} d={seg.path} fill={seg.color} opacity={0.8} />
              ))}
              {/* Center hole */}
              <circle cx={80} cy={80} r={35} fill="#111827" />
              <text x={80} y={76} textAnchor="middle" fill="#d1d5db" fontSize={10}>
                Gini
              </text>
              <text x={80} y={92} textAnchor="middle" fill="#e5e7eb" fontSize={14} fontWeight="bold">
                {giniCoefficient.toFixed(3)}
              </text>
            </svg>

            <div className="space-y-2 flex-1">
              {segments.map((seg, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-gray-300 flex-1">{seg.label}</span>
                  <span className="text-gray-400 font-mono tabular-nums">{seg.percentage.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Holder Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 uppercase border-b border-gray-700">
                  <th className="py-2 text-left font-medium">Label</th>
                  <th className="py-2 text-left font-medium">Address</th>
                  <th className="py-2 text-right font-medium">Balance</th>
                  <th className="py-2 text-right font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {supply.holders.slice(0, 20).map((holder, i) => (
                  <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-1.5 text-gray-300 truncate max-w-[80px]">{holder.label}</td>
                    <td className="py-1.5">
                      <a
                        href={solscanAddressUrl(holder.address, network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 font-mono"
                      >
                        {holder.address.slice(0, 6)}...{holder.address.slice(-4)}
                      </a>
                    </td>
                    <td className="py-1.5 text-right text-gray-300 font-mono tabular-nums">
                      {holder.balance.toLocaleString()}
                    </td>
                    <td className="py-1.5 text-right text-gray-400 font-mono tabular-nums">
                      {holder.percentage.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────

function SupplySkeleton() {
  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 animate-pulse">
      <div className="px-4 py-3 border-b border-gray-700">
        <div className="h-4 w-32 bg-gray-700 rounded" />
      </div>
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-6">
          <div className="w-32 h-32 bg-gray-800 rounded-full" />
          <div className="flex-1 space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-800 rounded" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
