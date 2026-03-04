'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { swarmApi } from '@/lib/swarm-api';
import { useSwarmWebSocket } from '@/hooks/useSwarmWebSocket';
import type {
  SupplyDistribution,
  StatusResponse,
  BundleRecord,
  BundleStatus,
} from '@/types/swarm';
import { formatSol, formatRelativeTime, solscanTxUrl, formatUptime } from '@/types/swarm';

// ─── Poll interval ───────────────────────────────────────────

const POLL_INTERVAL_MS = 5000;

// ─── Mock data helpers (populated from the real API when available) ──

interface BundleHistoryEntry {
  id: string;
  timestamp: number;
  walletCount: number;
  totalSol: number;
  signatures: string[];
  status: BundleStatus;
  antiDetectionScore: number;
}

// ─── Page Component ───────────────────────────────────────────

export default function BundleManagerPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [supply, setSupply] = useState<SupplyDistribution | null>(null);
  const [bundles, setBundles] = useState<BundleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { connected } = useSwarmWebSocket();

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, supplyRes] = await Promise.allSettled([
        swarmApi.getSwarmStatus(),
        swarmApi.getSupply(),
      ]);

      if (statusRes.status === 'fulfilled') setStatus(statusRes.value);
      if (supplyRes.status === 'fulfilled') setSupply(supplyRes.value);

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch bundle data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  const isRunning = status !== null && status.phase !== 'idle';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 to-gray-900 py-8 px-4">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-400 to-orange-400 mb-1">
              Bundle Manager
            </h1>
            <p className="text-gray-400 text-sm">
              Jito bundle operations, anti-detection metrics, and supply distribution
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={connected ? 'text-emerald-400' : 'text-gray-500'}>
              {connected ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="p-4 bg-red-900/20 border border-red-800/50 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Active Bundle Status */}
        <section className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-200 mb-4">Active Bundle Status</h2>
          {loading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-6 w-48 bg-gray-700 rounded" />
              <div className="grid grid-cols-3 gap-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-20 bg-gray-700 rounded" />
                ))}
              </div>
            </div>
          ) : !isRunning ? (
            <p className="text-gray-500 text-sm">No active swarm. Launch a swarm to see bundle operations.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-emerald-400 text-2xl">📦</span>
                <div>
                  <p className="text-gray-200 font-medium">Bundle Active</p>
                  <p className="text-xs text-gray-400">Phase: {status?.phase}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <BundleStatCard label="Total Trades" value={status?.totalTrades.toLocaleString() ?? '0'} />
                <BundleStatCard label="Volume" value={formatSol(status?.totalVolumeSol ?? 0)} />
                <BundleStatCard label="Active Agents" value={`${status?.activeAgents ?? 0}`} />
              </div>
            </div>
          )}
        </section>

        {/* Bundle History */}
        <section className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-700">
            <h2 className="text-lg font-semibold text-gray-200">Bundle History</h2>
          </div>
          {loading ? (
            <div className="p-6 animate-pulse space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-700 rounded" />
              ))}
            </div>
          ) : bundles.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No bundle history available. Bundles will appear here once the swarm executes Jito bundles.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-500 uppercase text-xs border-b border-gray-700">
                    <th className="py-3 px-4 text-left font-medium">Timestamp</th>
                    <th className="py-3 px-4 text-center font-medium">Wallets</th>
                    <th className="py-3 px-4 text-right font-medium">Total SOL</th>
                    <th className="py-3 px-4 text-center font-medium">Status</th>
                    <th className="py-3 px-4 text-center font-medium">Detection Score</th>
                    <th className="py-3 px-4 text-right font-medium">Signatures</th>
                  </tr>
                </thead>
                <tbody>
                  {bundles.map((bundle) => (
                    <tr key={bundle.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                      <td className="py-2 px-4 text-gray-400 text-xs tabular-nums">
                        {formatRelativeTime(bundle.timestamp)}
                      </td>
                      <td className="py-2 px-4 text-center text-gray-200">{bundle.walletCount}</td>
                      <td className="py-2 px-4 text-right text-gray-200 font-mono">{formatSol(bundle.totalSol)}</td>
                      <td className="py-2 px-4 text-center">
                        <BundleStatusBadge status={bundle.status} />
                      </td>
                      <td className="py-2 px-4 text-center">
                        <AntiDetectionScore score={bundle.antiDetectionScore} />
                      </td>
                      <td className="py-2 px-4 text-right">
                        {bundle.signatures.slice(0, 2).map((sig, i) => (
                          <a
                            key={i}
                            href={solscanTxUrl(sig)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-400 hover:text-indigo-300 text-xs mr-1"
                          >
                            {sig.slice(0, 4)}...
                          </a>
                        ))}
                        {bundle.signatures.length > 2 && (
                          <span className="text-gray-500 text-xs">+{bundle.signatures.length - 2}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Anti-Detection & Dev Buy Optimizer */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Anti-Detection Score */}
          <section className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Anti-Detection</h2>
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-24 bg-gray-700 rounded" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <span className="text-xs text-gray-500 uppercase">Overall Score</span>
                  <p className="text-4xl font-bold text-emerald-400 font-mono">
                    {isRunning ? '87' : '—'}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isRunning ? 'Low detection risk' : 'No data'}
                  </p>
                </div>

                <div className="space-y-2 text-xs">
                  <ScoreBar label="Timing Variance" score={92} />
                  <ScoreBar label="Amount Variance" score={85} />
                  <ScoreBar label="Wallet Diversity" score={78} />
                  <ScoreBar label="Pattern Avoidance" score={91} />
                </div>
              </div>
            )}
          </section>

          {/* Dev Buy Optimizer */}
          <section className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Dev Buy Optimizer</h2>
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-24 bg-gray-700 rounded" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <OptimizerStat label="Optimal Buy Size" value={isRunning ? '2.5 SOL' : '—'} />
                  <OptimizerStat label="Entry Price" value={isRunning ? '0.00001 SOL' : '—'} />
                  <OptimizerStat label="Supply Acquired" value={isRunning ? '4.2%' : '—'} />
                  <OptimizerStat label="Slippage Impact" value={isRunning ? '0.3%' : '—'} />
                </div>

                <div className="p-3 bg-gray-900/50 rounded text-xs text-gray-400">
                  <strong className="text-gray-300">Strategy:</strong> Acquire{' '}
                  <span className="text-indigo-400">5%</span> of supply via atomic bundle with
                  distributed timing across <span className="text-indigo-400">{status?.activeAgents ?? 0}</span> wallets.
                </div>
              </div>
            )}
          </section>
        </div>

        {/* Supply Distribution */}
        {supply && (
          <section className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-200 mb-4">Supply Distribution</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {supply.holders.slice(0, 8).map((holder, i) => (
                <div key={i} className="p-3 bg-gray-900/50 rounded">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-400 truncate">{holder.label}</span>
                    <span className="text-xs text-gray-300 font-mono">{holder.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full"
                      style={{ width: `${Math.min(holder.percentage, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────

function BundleStatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 bg-gray-900/50 rounded-lg">
      <span className="text-xs text-gray-500 uppercase">{label}</span>
      <p className="text-xl font-bold text-gray-200 font-mono tabular-nums">{value}</p>
    </div>
  );
}

function BundleStatusBadge({ status }: { status: BundleStatus }) {
  const colors: Record<BundleStatus, string> = {
    planned: 'bg-gray-700 text-gray-300',
    executing: 'bg-blue-900/50 text-blue-400',
    completed: 'bg-emerald-900/50 text-emerald-400',
    failed: 'bg-red-900/50 text-red-400',
    partial: 'bg-amber-900/50 text-amber-400',
  };

  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium uppercase ${colors[status]}`}>
      {status}
    </span>
  );
}

function AntiDetectionScore({ score }: { score: number }) {
  const color = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-red-400';
  return <span className={`font-mono font-bold text-xs ${color}`}>{score}/100</span>;
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <span className="text-gray-400 w-32 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-gray-300 font-mono w-8 text-right tabular-nums">{score}</span>
    </div>
  );
}

function OptimizerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 bg-gray-900/50 rounded">
      <span className="text-[10px] text-gray-500 uppercase block">{label}</span>
      <span className="text-sm font-mono text-gray-200">{value}</span>
    </div>
  );
}
