/**
 * Smart Money Flow Visualizer & Wallet Intel — Shared Types
 *
 * Mirrors backend types from src/sources/whales.ts with frontend-specific additions.
 */

// ─── Whale Transaction ──────────────────────────────────────

export type TransactionType =
  | 'exchange_deposit'
  | 'exchange_withdrawal'
  | 'whale_transfer'
  | 'unknown';

export interface WhaleTransaction {
  hash: string;
  blockchain: string;
  from: string;
  to: string;
  amount: number;
  amountUsd: number;
  symbol: string;
  timestamp: string;
  transactionType: TransactionType;
  blockHeight: number;
  fromLabel?: string;
  toLabel?: string;
}

// ─── Whale Classification ───────────────────────────────────

export interface WhaleClassification {
  overallSignal: 'bullish' | 'bearish' | 'neutral';
  signalStrength: number;
  exchangeDeposits: number;
  exchangeWithdrawals: number;
  whaleTransfers: number;
  netExchangeFlow: number;
}

// ─── Smart Money ────────────────────────────────────────────

export interface SmartMoneyTrade {
  wallet: string;
  walletLabel: string;
  token: string;
  action: 'buy' | 'sell' | 'transfer';
  amount: number;
  amountUsd: number;
  timestamp: string;
  hash: string;
}

export interface SmartMoneyAnalysis {
  consensusBuys: Array<{ token: string; count: number; totalUsd: number }>;
  consensusSells: Array<{ token: string; count: number; totalUsd: number }>;
  newPositions: Array<{ token: string; wallet: string; amountUsd: number }>;
  exitingPositions: Array<{ token: string; wallet: string; amountUsd: number }>;
  topPerformingWallets: Array<{
    wallet: string;
    label: string;
    trades: number;
    estimatedPnl: number;
  }>;
  defiTrends: Array<{ protocol: string; action: string; count: number }>;
}

// ─── Exchange Flows ─────────────────────────────────────────

export interface ExchangeFlowData {
  exchange: string;
  address: string;
  chain: string;
  balance: number;
  deposits24h: number;
  withdrawals24h: number;
  netFlow: number;
  depositCount: number;
  withdrawalCount: number;
}

export interface ExchangeFlowSummary {
  totalDeposits24h: number;
  totalWithdrawals24h: number;
  netFlow: number;
  signal: 'bullish' | 'bearish';
  exchangeCount: number;
}

// ─── Accumulation / Distribution ────────────────────────────

export interface AccumulationSignal {
  symbol: string;
  signal: 'accumulation' | 'distribution' | 'neutral';
  strength: number;
  exchangeNetFlow: number;
  whaleBalanceChange: number;
  period: string;
  interpretation: string;
}

// ─── Dormant Wallets ────────────────────────────────────────

export interface DormantWallet {
  address: string;
  chain: string;
  lastActiveDate: string;
  dormantDays: number;
  reactivatedAt: string;
  balanceUsd: number;
  transactionHash: string;
}

// ─── Wallet Profile ─────────────────────────────────────────

export interface WalletProfile {
  address: string;
  chain: string;
  balance: number;
  balanceUsd: number;
  totalReceived: number;
  totalSent: number;
  transactionCount: number;
  firstSeen: string;
  lastSeen: string;
  label?: string;
  isExchange: boolean;
  isTracked: boolean;
}

// ─── Flow Diagram Types ─────────────────────────────────────

export interface FlowNode {
  id: string;
  label: string;
  type: 'wallet' | 'exchange' | 'contract' | 'token';
  chain?: string;
  value: number;
  x?: number;
  y?: number;
}

export interface FlowLink {
  source: string;
  target: string;
  value: number;
  type: TransactionType;
  count: number;
}

export interface FlowData {
  nodes: FlowNode[];
  links: FlowLink[];
  totalVolume: number;
  timeRange: string;
}

// ─── API Response Wrappers ──────────────────────────────────

export interface WhaleTransactionResponse {
  transactions: WhaleTransaction[];
  classification: WhaleClassification;
  totalFiltered: number;
}

export interface SmartMoneyResponse {
  consensusBuys: SmartMoneyAnalysis['consensusBuys'];
  consensusSells: SmartMoneyAnalysis['consensusSells'];
  newPositions: SmartMoneyAnalysis['newPositions'];
  exitingPositions: SmartMoneyAnalysis['exitingPositions'];
  topPerformingWallets: SmartMoneyAnalysis['topPerformingWallets'];
  defiTrends: SmartMoneyAnalysis['defiTrends'];
}

export interface ExchangeFlowResponse {
  flows: ExchangeFlowData[];
  summary: ExchangeFlowSummary;
}
