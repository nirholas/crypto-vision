/**
 * Smart Money Flow Visualizer — Main Page Component
 *
 * Three-tab layout:
 *   1. Flow Map — SVG Sankey-style wallet → exchange flow diagram
 *   2. Live Feed — Animated real-time whale transaction stream
 *   3. Metrics — Charts, stats, consensus analysis
 */

'use client';

import { useState } from 'react';
import { ArrowRightLeft, Radio, BarChart3, RefreshCw } from 'lucide-react';
import { FlowDiagram } from './FlowDiagram';
import { LiveFeed } from './LiveFeed';
import { FlowMetrics } from './FlowMetrics';
import { useFlowData } from './hooks';

// ─── Tabs ───────────────────────────────────────────────────

type Tab = 'flow' | 'live' | 'metrics';

const TABS: { id: Tab; label: string; Icon: typeof ArrowRightLeft }[] = [
  { id: 'flow', label: 'Flow Map', Icon: ArrowRightLeft },
  { id: 'live', label: 'Live Feed', Icon: Radio },
  { id: 'metrics', label: 'Metrics', Icon: BarChart3 },
];

// ─── Component ──────────────────────────────────────────────

export function SmartMoneyFlow() {
  const [activeTab, setActiveTab] = useState<Tab>('flow');
  const { data: flowData, isLoading } = useFlowData();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-gain flex items-center justify-center">
              <ArrowRightLeft size={18} className="text-white" />
            </div>
            Smart Money Flow
          </h1>
          <p className="text-sm text-text-muted mt-1">
            Real-time visualization of whale movements, exchange flows & smart money positions
          </p>
        </div>

        {/* Connection indicator */}
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <div className="w-2 h-2 rounded-full bg-gain animate-pulse" />
          Live — refreshes every 60s
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 bg-surface/50 p-1 rounded-xl border border-surface-border w-fit">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`
              flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
              ${activeTab === id
                ? 'bg-surface text-text-primary shadow-sm border border-surface-border'
                : 'text-text-muted hover:text-text-secondary'}
            `}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="min-h-[500px]">
        {activeTab === 'flow' && (
          <div className="bg-surface rounded-xl border border-surface-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-text-primary">
                Wallet → Exchange Fund Flows
              </h2>
              {flowData && (
                <span className="text-xs text-text-muted font-mono">
                  {flowData.nodes.length} nodes · {flowData.links.length} flows · $
                  {formatUsd(flowData.totalVolume)} total
                </span>
              )}
            </div>
            {isLoading ? (
              <div className="h-[560px] flex items-center justify-center">
                <RefreshCw size={20} className="animate-spin text-text-muted" />
              </div>
            ) : flowData ? (
              <FlowDiagram data={flowData} />
            ) : (
              <div className="h-[560px] flex items-center justify-center text-text-muted text-sm">
                No flow data available. Backend whale API may be unreachable.
              </div>
            )}
          </div>
        )}

        {activeTab === 'live' && <LiveFeed />}

        {activeTab === 'metrics' && <FlowMetrics />}
      </div>
    </div>
  );
}

// ─── Index Export ────────────────────────────────────────────

export default SmartMoneyFlow;

// ─── Helpers ────────────────────────────────────────────────

function formatUsd(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}
