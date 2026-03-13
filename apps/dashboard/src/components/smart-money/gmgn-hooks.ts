/**
 * GMGN Wallet Intelligence — Data Hooks
 *
 * SWR hooks for GMGN wallet data + trade event streaming.
 */

'use client';

import useSWR from 'swr';
import type {
  GmgnWalletApiResponse,
  GmgnWalletSummary,
  GmgnWalletCategory,
  GmgnChain,
  TradeEvent,
} from './gmgn-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json.data ?? json;
}

// ─── GMGN Wallet Leaderboard ────────────────────────────────

export function useGmgnWallets(opts?: {
  chain?: GmgnChain;
  category?: GmgnWalletCategory;
  sort?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();
  if (opts?.chain) params.set('chain', opts.chain);
  if (opts?.category) params.set('category', opts.category);
  if (opts?.sort) params.set('sort', opts.sort);
  if (opts?.limit) params.set('limit', String(opts.limit));

  const qs = params.toString();
  return useSWR<GmgnWalletApiResponse>(
    `${API_BASE}/api/gmgn/wallets${qs ? `?${qs}` : ''}`,
    fetcher,
    { refreshInterval: 120_000, revalidateOnFocus: false },
  );
}

// ─── GMGN Trade Events ─────────────────────────────────────

export function useGmgnTrades(chain?: GmgnChain, limit = 200) {
  const params = new URLSearchParams();
  if (chain) params.set('chain', chain);
  params.set('limit', String(limit));

  return useSWR<{ events: TradeEvent[]; total: number }>(
    `${API_BASE}/api/gmgn/trades?${params}`,
    fetcher,
    { refreshInterval: 60_000, revalidateOnFocus: false },
  );
}

// ─── GMGN Category Summary ─────────────────────────────────

export function useGmgnCategories() {
  return useSWR<{
    bsc: Record<string, { count: number; totalPnl7d: number; avgWinrate: number }>;
    sol: Record<string, { count: number; totalPnl7d: number; avgWinrate: number }>;
  }>(
    `${API_BASE}/api/gmgn/categories`,
    fetcher,
    { refreshInterval: 300_000, revalidateOnFocus: false },
  );
}
