/**
 * Smart Money Data Hooks
 *
 * SWR-backed hooks that fetch from the backend Hono whale API.
 * All data auto-refreshes on the configured interval.
 */

'use client';

import useSWR from 'swr';
import type {
  WhaleTransactionResponse,
  SmartMoneyResponse,
  ExchangeFlowResponse,
  DormantWallet,
  FlowData,
  FlowNode,
  FlowLink,
  WhaleTransaction,
} from './types';

// ─── Config ─────────────────────────────────────────────────

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
const REFRESH_INTERVAL = 60_000; // 60s

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return json.data ?? json;
}

// ─── Whale Transactions ─────────────────────────────────────

export function useWhaleTransactions(minUsd = 100_000, limit = 50) {
  return useSWR<WhaleTransactionResponse>(
    `${API_BASE}/api/whales/transactions?min_usd=${minUsd}&limit=${limit}`,
    fetcher,
    { refreshInterval: REFRESH_INTERVAL, revalidateOnFocus: false },
  );
}

// ─── Smart Money Analysis ───────────────────────────────────

export function useSmartMoney(limit = 20) {
  return useSWR<SmartMoneyResponse>(
    `${API_BASE}/api/whales/smart-money?limit=${limit}`,
    fetcher,
    { refreshInterval: REFRESH_INTERVAL, revalidateOnFocus: false },
  );
}

// ─── Exchange Flows ─────────────────────────────────────────

export function useExchangeFlows() {
  return useSWR<ExchangeFlowResponse>(
    `${API_BASE}/api/whales/exchange-flows`,
    fetcher,
    { refreshInterval: REFRESH_INTERVAL, revalidateOnFocus: false },
  );
}

// ─── Dormant Wallets ────────────────────────────────────────

export function useDormantWallets() {
  return useSWR<DormantWallet[]>(
    `${API_BASE}/api/whales/dormant`,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const json = await res.json();
      return json.data?.wallets ?? [];
    },
    { refreshInterval: REFRESH_INTERVAL * 5, revalidateOnFocus: false },
  );
}

// ─── Derived: Flow Diagram Data ─────────────────────────────

/**
 * Transform whale transactions into a Sankey-style flow structure
 * with wallet/exchange nodes and directed links between them.
 */
export function useFlowData(): {
  data: FlowData | undefined;
  isLoading: boolean;
  error: Error | undefined;
} {
  const { data: txData, isLoading, error } = useWhaleTransactions(50_000, 100);

  if (!txData || isLoading || error) {
    return { data: undefined, isLoading, error };
  }

  const nodes = new Map<string, FlowNode>();
  const linkMap = new Map<string, FlowLink>();
  let totalVolume = 0;

  for (const tx of txData.transactions) {
    const fromId = tx.fromLabel || shortAddr(tx.from);
    const toId = tx.toLabel || shortAddr(tx.to);

    if (fromId === 'unknown' && toId === 'unknown') continue;

    // Build nodes
    if (!nodes.has(fromId)) {
      nodes.set(fromId, {
        id: fromId,
        label: tx.fromLabel || shortAddr(tx.from),
        type: classifyNode(tx, 'from'),
        chain: tx.blockchain,
        value: 0,
      });
    }
    if (!nodes.has(toId)) {
      nodes.set(toId, {
        id: toId,
        label: tx.toLabel || shortAddr(tx.to),
        type: classifyNode(tx, 'to'),
        chain: tx.blockchain,
        value: 0,
      });
    }

    const fromNode = nodes.get(fromId)!;
    const toNode = nodes.get(toId)!;
    fromNode.value += tx.amountUsd;
    toNode.value += tx.amountUsd;

    // Build link
    const linkKey = `${fromId}->${toId}`;
    const existing = linkMap.get(linkKey);
    if (existing) {
      existing.value += tx.amountUsd;
      existing.count++;
    } else {
      linkMap.set(linkKey, {
        source: fromId,
        target: toId,
        value: tx.amountUsd,
        type: tx.transactionType,
        count: 1,
      });
    }
    totalVolume += tx.amountUsd;
  }

  const flowData: FlowData = {
    nodes: [...nodes.values()],
    links: [...linkMap.values()].sort((a, b) => b.value - a.value),
    totalVolume,
    timeRange: '24h',
  };

  return { data: flowData, isLoading: false, error: undefined };
}

// ─── Helpers ────────────────────────────────────────────────

function shortAddr(addr: string): string {
  if (!addr || addr === 'unknown') return 'unknown';
  if (addr.length > 12) return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  return addr;
}

function classifyNode(tx: WhaleTransaction, side: 'from' | 'to'): FlowNode['type'] {
  if (side === 'from' && tx.fromLabel) {
    if (tx.transactionType === 'exchange_withdrawal') return 'exchange';
    return 'wallet';
  }
  if (side === 'to' && tx.toLabel) {
    if (tx.transactionType === 'exchange_deposit') return 'exchange';
    return 'wallet';
  }
  return 'wallet';
}
