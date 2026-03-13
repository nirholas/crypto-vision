/**
 * Smart Money Live Feed — Animated Transaction Stream
 *
 * Real-time scrolling feed of whale transactions with:
 * - Framer Motion slide-in animation for new entries
 * - Color-coded type badges (deposit/withdrawal/transfer)
 * - Chain badges, wallet labels, explorer links
 * - Auto-refreshes every 60s, highlights new txns
 */

'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, ArrowDownLeft, ArrowUpRight, ArrowRightLeft } from 'lucide-react';
import { tokens } from '@/lib/colors';
import { useWhaleTransactions } from './hooks';
import type { WhaleTransaction } from './types';

// ─── Constants ──────────────────────────────────────────────

const MAX_VISIBLE = 40;

const EXPLORER_URLS: Record<string, string> = {
  bitcoin: 'https://blockchair.com/bitcoin/transaction/',
  ethereum: 'https://etherscan.io/tx/',
  solana: 'https://solscan.io/tx/',
  tron: 'https://tronscan.org/#/transaction/',
};

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; Icon: typeof ArrowDownLeft }> = {
  exchange_deposit: {
    label: 'Deposit',
    color: tokens.semantic.loss,
    bg: tokens.semantic.lossBg,
    Icon: ArrowDownLeft,
  },
  exchange_withdrawal: {
    label: 'Withdrawal',
    color: tokens.semantic.gain,
    bg: tokens.semantic.gainBg,
    Icon: ArrowUpRight,
  },
  whale_transfer: {
    label: 'Transfer',
    color: tokens.brand.primary,
    bg: tokens.semantic.infoBg,
    Icon: ArrowRightLeft,
  },
  unknown: {
    label: 'Transfer',
    color: tokens.text.muted,
    bg: 'rgba(128,128,128,0.1)',
    Icon: ArrowRightLeft,
  },
};

// ─── Component ──────────────────────────────────────────────

export function LiveFeed({ className }: { className?: string }) {
  const { data, isLoading, error } = useWhaleTransactions(50_000, 60);
  const seenRef = useRef(new Set<string>());
  const [filter, setFilter] = useState<'all' | 'exchange_deposit' | 'exchange_withdrawal' | 'whale_transfer'>('all');

  const transactions = useMemo(() => {
    if (!data?.transactions) return [];
    let txs = data.transactions;
    if (filter !== 'all') txs = txs.filter((t) => t.transactionType === filter);
    return txs.slice(0, MAX_VISIBLE);
  }, [data, filter]);

  // Track new transactions
  const newHashes = useMemo(() => {
    const newSet = new Set<string>();
    for (const tx of transactions) {
      if (!seenRef.current.has(tx.hash)) newSet.add(tx.hash);
    }
    return newSet;
  }, [transactions]);

  useEffect(() => {
    for (const tx of transactions) seenRef.current.add(tx.hash);
  }, [transactions]);

  if (error) {
    return (
      <div className={`flex items-center justify-center h-64 text-text-muted ${className ?? ''}`}>
        <p className="text-sm">Failed to load live feed: {error.message}</p>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Filter bar */}
      <div className="flex items-center gap-2 mb-4">
        {(['all', 'exchange_deposit', 'exchange_withdrawal', 'whale_transfer'] as const).map((f) => {
          const label = f === 'all' ? 'All' : TYPE_CONFIG[f].label;
          const active = filter === f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`
                px-3 py-1 text-xs font-medium rounded-full border transition-colors
                ${active
                  ? 'bg-primary/20 border-primary/50 text-primary'
                  : 'bg-surface border-surface-border text-text-muted hover:text-text-secondary'}
              `}
            >
              {label}
            </button>
          );
        })}

        {data?.classification && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-text-muted">Signal:</span>
            <span
              className={`text-xs font-bold ${
                data.classification.overallSignal === 'bullish'
                  ? 'text-gain'
                  : data.classification.overallSignal === 'bearish'
                    ? 'text-loss'
                    : 'text-text-muted'
              }`}
            >
              {data.classification.overallSignal.toUpperCase()} ({data.classification.signalStrength}%)
            </span>
          </div>
        )}
      </div>

      {/* Transaction list */}
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto scrollbar-thin pr-1">
        {isLoading && transactions.length === 0 && (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-surface rounded-lg animate-pulse" />
          ))
        )}

        <AnimatePresence initial={false}>
          {transactions.map((tx) => (
            <TxRow key={tx.hash} tx={tx} isNew={newHashes.has(tx.hash)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Transaction Row ────────────────────────────────────────

function TxRow({ tx, isNew }: { tx: WhaleTransaction; isNew: boolean }) {
  const cfg = TYPE_CONFIG[tx.transactionType] || TYPE_CONFIG.unknown;
  const explorerUrl = EXPLORER_URLS[tx.blockchain];

  return (
    <motion.div
      initial={isNew ? { opacity: 0, x: 40 } : false}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors
        ${isNew
          ? 'bg-primary/5 border-primary/20'
          : 'bg-surface border-surface-border hover:border-surface-hover'}
      `}
    >
      {/* Type icon */}
      <div
        className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: cfg.bg }}
      >
        <cfg.Icon size={14} style={{ color: cfg.color }} />
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {/* From label */}
          <span className="text-xs text-text-secondary truncate max-w-[120px]">
            {tx.fromLabel || shortAddr(tx.from)}
          </span>
          <span className="text-text-muted text-xs">→</span>
          <span className="text-xs text-text-secondary truncate max-w-[120px]">
            {tx.toLabel || shortAddr(tx.to)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {/* Type badge */}
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ color: cfg.color, backgroundColor: cfg.bg }}
          >
            {cfg.label}
          </span>
          {/* Chain badge */}
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-surface-elevated text-text-muted uppercase">
            {tx.blockchain}
          </span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold font-mono text-text-primary">
          ${formatUsd(tx.amountUsd)}
        </p>
        <p className="text-[10px] text-text-muted font-mono">
          {formatAmount(tx.amount)} {tx.symbol}
        </p>
      </div>

      {/* Time + explorer link */}
      <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
        <span className="text-[10px] text-text-muted">{timeAgo(tx.timestamp)}</span>
        {explorerUrl && (
          <a
            href={`${explorerUrl}${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-muted hover:text-primary transition-colors"
            aria-label="View on explorer"
          >
            <ExternalLink size={10} />
          </a>
        )}
      </div>
    </motion.div>
  );
}

// ─── Helpers ────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (!addr || addr === 'unknown') return 'Unknown';
  if (addr.length > 12) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return addr;
}

function formatUsd(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function formatAmount(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(2)}K`;
  if (n >= 1) return n.toFixed(4);
  return n.toFixed(6);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
