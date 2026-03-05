'use client';

import React, { useState, useCallback } from 'react';
import {
  Wallet,
  RefreshCw,
  Send,
  Download,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  Loader2,
  ArrowDownToLine,
  ArrowUpFromLine,
  Eye,
  EyeOff,
  Info,
} from 'lucide-react';
import { useSwarmAgents, useSwarmStatus, useSwarmActions } from '@/hooks/useSwarmData';
import {
  formatSol,
  formatRelativeTime,
  solscanAddressUrl,
  AGENT_ROLE_ICONS,
  AGENT_ROLE_LABELS,
} from '@/types/swarm';
import type { AgentSummary } from '@/types/swarm';

/* ─── Page ───────────────────────────────────────────────────── */

export default function SwarmWalletsPage() {
  const { agents, isLoading, refetch } = useSwarmAgents();
  const { status } = useSwarmStatus();
  const [showKeys, setShowKeys] = useState(false);
  const [copiedAddr, setCopiedAddr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleCopy = useCallback(async (addr: string) => {
    await navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 2000);
  }, []);

  // Aggregate balances
  const totalSol = agents.reduce((s, a) => s + a.solBalance, 0);
  const totalTokens = agents.reduce((s, a) => s + a.tokenBalance, 0);
  const walletCount = agents.length;

  const network = status?.phase ? 'mainnet-beta' : 'devnet'; // TODO: get from config

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <WalletMetric label="Total Wallets" value={`${walletCount}`} icon={<Wallet size={14} />} />
        <WalletMetric label="Total SOL" value={formatSol(totalSol)} icon={<ArrowDownToLine size={14} />} />
        <WalletMetric label="Total Tokens" value={totalTokens.toLocaleString()} icon={<ArrowUpFromLine size={14} />} />
        <WalletMetric
          label="Avg Balance"
          value={walletCount > 0 ? formatSol(totalSol / walletCount) : '—'}
          icon={<Info size={14} />}
        />
      </div>

      {/* Wallet Funding Info */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-[var(--brand)]/5 border border-[var(--brand)]/20">
        <Info size={16} className="text-[var(--brand)] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[var(--text-secondary)] space-y-1">
          <p>
            <strong className="text-[var(--text-primary)]">How wallet funding works:</strong> You only fund the master wallet.
            The swarm automatically distributes SOL to all trader wallets during the funding phase, and reclaims all unused funds back to the master wallet when the swarm completes.
          </p>
          <p>
            Trader wallets are ephemeral — they&apos;re generated fresh for each run using HD derivation from a BIP-39 mnemonic.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Agent Wallets</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowKeys(!showKeys)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all"
          >
            {showKeys ? <EyeOff size={12} /> : <Eye size={12} />}
            {showKeys ? 'Hide' : 'Show'} Addresses
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-[var(--surface-border)] text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-all disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Wallet Table */}
      <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-[var(--text-muted)]" />
          </div>
        ) : agents.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            No wallets active. Launch a swarm to create agent wallets.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)] text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  <th className="px-4 py-2.5 text-left font-medium">Agent</th>
                  <th className="px-4 py-2.5 text-left font-medium">Address</th>
                  <th className="px-4 py-2.5 text-right font-medium">SOL Balance</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tokens</th>
                  <th className="px-4 py-2.5 text-right font-medium">Trades</th>
                  <th className="px-4 py-2.5 text-right font-medium">P&L</th>
                  <th className="px-4 py-2.5 text-center font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--surface-border)]">
                {agents.map((agent) => (
                  <WalletRow
                    key={agent.id}
                    agent={agent}
                    showFull={showKeys}
                    network={network}
                    copiedAddr={copiedAddr}
                    onCopy={handleCopy}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SOL Distribution Bar */}
      {agents.length > 0 && (
        <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-3">
            SOL Distribution
          </h4>
          <div className="h-4 rounded-full bg-[var(--bg-primary)] overflow-hidden flex">
            {agents
              .filter((a) => a.solBalance > 0)
              .sort((a, b) => b.solBalance - a.solBalance)
              .map((agent, i) => {
                const pct = totalSol > 0 ? (agent.solBalance / totalSol) * 100 : 0;
                const colors = [
                  'bg-[var(--brand)]',
                  'bg-blue-500',
                  'bg-purple-500',
                  'bg-amber-500',
                  'bg-pink-500',
                  'bg-cyan-500',
                  'bg-green-500',
                  'bg-red-500',
                  'bg-indigo-500',
                  'bg-orange-500',
                ];
                return (
                  <div
                    key={agent.id}
                    className={`${colors[i % colors.length]} transition-all`}
                    style={{ width: `${Math.max(pct, 0.5)}%` }}
                    title={`${AGENT_ROLE_LABELS[agent.type]}: ${formatSol(agent.solBalance)} (${pct.toFixed(1)}%)`}
                  />
                );
              })}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {agents
              .filter((a) => a.solBalance > 0)
              .sort((a, b) => b.solBalance - a.solBalance)
              .slice(0, 6)
              .map((agent, i) => {
                const colors = ['text-[var(--brand)]', 'text-blue-400', 'text-purple-400', 'text-amber-400', 'text-pink-400', 'text-cyan-400'];
                return (
                  <div key={agent.id} className="flex items-center gap-1 text-[10px]">
                    <span className={`w-2 h-2 rounded-full ${colors[i % colors.length].replace('text-', 'bg-')}`} />
                    <span className="text-[var(--text-muted)]">{AGENT_ROLE_LABELS[agent.type]}</span>
                    <span className="text-[var(--text-secondary)] font-mono tabular-nums">{formatSol(agent.solBalance)}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Wallet Row ─────────────────────────────────────────────── */

function WalletRow({
  agent,
  showFull,
  network,
  copiedAddr,
  onCopy,
}: {
  agent: AgentSummary;
  showFull: boolean;
  network: 'mainnet-beta' | 'devnet';
  copiedAddr: string | null;
  onCopy: (addr: string) => void;
}) {
  const statusColor =
    agent.status === 'active'
      ? 'text-[var(--gain)] bg-[var(--gain)]/10'
      : agent.status === 'error'
        ? 'text-[var(--loss)] bg-[var(--loss)]/10'
        : agent.status === 'paused'
          ? 'text-yellow-400 bg-yellow-500/10'
          : 'text-[var(--text-muted)] bg-gray-500/10';

  return (
    <tr className="hover:bg-[var(--surface-hover)] transition-colors">
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{AGENT_ROLE_ICONS[agent.type]}</span>
          <span className="text-sm text-[var(--text-primary)]">{AGENT_ROLE_LABELS[agent.type]}</span>
        </div>
      </td>
      <td className="px-4 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-xs text-[var(--text-secondary)]">
            {showFull ? agent.walletAddress : `${agent.walletAddress.slice(0, 6)}...${agent.walletAddress.slice(-4)}`}
          </span>
          <button
            onClick={() => onCopy(agent.walletAddress)}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            title="Copy address"
          >
            {copiedAddr === agent.walletAddress ? <Check size={12} className="text-[var(--gain)]" /> : <Copy size={12} />}
          </button>
          <a
            href={solscanAddressUrl(agent.walletAddress, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--text-muted)] hover:text-[var(--brand)] transition-colors"
            title="View on Solscan"
          >
            <ExternalLink size={12} />
          </a>
        </div>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="font-mono text-sm text-[var(--text-primary)] tabular-nums">{agent.solBalance.toFixed(4)}</span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="font-mono text-sm text-[var(--text-secondary)] tabular-nums">{agent.tokenBalance.toLocaleString()}</span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span className="text-sm text-[var(--text-secondary)] tabular-nums">{agent.tradeCount}</span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <span
          className={`font-mono text-sm tabular-nums ${
            agent.pnl >= 0 ? 'text-[var(--gain)]' : 'text-[var(--loss)]'
          }`}
        >
          {agent.pnl >= 0 ? '+' : ''}{agent.pnl.toFixed(4)}
        </span>
      </td>
      <td className="px-4 py-2.5 text-center">
        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${statusColor}`}>
          {agent.status}
        </span>
      </td>
      <td className="px-4 py-2.5 text-right">
        <a
          href={solscanAddressUrl(agent.walletAddress, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--brand)] hover:underline"
        >
          Explorer
        </a>
      </td>
    </tr>
  );
}

/* ─── Metric Card ────────────────────────────────────────────── */

function WalletMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-[var(--surface)] rounded-lg border border-[var(--surface-border)] p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="text-[10px] uppercase tracking-wider font-medium text-[var(--text-muted)]">{label}</span>
      </div>
      <div className="text-lg font-bold text-[var(--text-primary)] tabular-nums">{value}</div>
    </div>
  );
}
