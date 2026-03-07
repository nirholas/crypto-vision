export type {
  WalletInfo,
  AgentInfo,
  SwarmStatus,
  TradeInfo,
  AnalyticsOverview,
  OhlcvCandle,
  Template,
  TrackedWallet,
  SessionResponse,
  FundEstimate,
} from '@/lib/api-client';

export type { AgentRole, SwarmPhase } from '@/lib/constants';

export interface Alert {
  id: string;
  sessionId: string;
  type: 'low-balance' | 'zero-balance' | 'large-trade' | 'error' | 'phase-change' | 'target-reached';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  data?: Record<string, unknown>;
  createdAt: number;
  readAt?: number;
}

export interface PnlSnapshot {
  timestamp: number;
  realizedSol: string;
  unrealizedSol: string;
  totalSol: string;
  gasFeeSol: string;
  jitoTipsSol: string;
}

export interface WsEvents {
  'swarm:status': SwarmStatus;
  'agent:status': { agentId: string; status: string; stats: Record<string, unknown> };
  'trade:executed': TradeInfo;
  'trade:failed': { orderId: string; error: string; agentId: string };
  'pnl:updated': { realized: string; unrealized: string; total: string; timestamp: number };
  'wallet:balance': { address: string; balanceLamports: string; tokenBalance?: string };
  'phase:changed': { from: string; to: string; timestamp: number };
  'alert:created': Alert;
  'config:changed': { section: string; changes: Record<string, unknown> };
  'price:updated': { mint: string; priceSol: number; marketCapSol: number; volume24h: number };
  'candle:updated': {
    resolution: number;
    candle: { time: number; open: number; high: number; low: number; close: number; volume: number };
  };
}

import type { SwarmStatus, TradeInfo } from '@/lib/api-client';
