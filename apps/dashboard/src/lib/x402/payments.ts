/**
 * x402 Payment Receipts & History
 *
 * Tracks payments, generates receipts, and provides payment history
 * for users who pay via x402 micropayments.
 * 
 * Uses unified storage layer (Upstash Redis / memory fallback)
 */

import { CURRENT_NETWORK, USDC_ADDRESS, PAYMENT_ADDRESS } from './config';
import * as storage from '../storage';

// Storage namespace for payment data
const NAMESPACE = 'x402:payments';
const RECEIPTS_KEY = 'receipts'; // Hash of receipt ID -> receipt data
const WALLET_INDEX_PREFIX = 'wallet:'; // wallet:address -> list of receipt IDs
const STATS_KEY = 'stats'; // Aggregate statistics

// =============================================================================
// TYPES
// =============================================================================

export interface PaymentReceipt {
  /** Unique receipt ID */
  id: string;
  /** ISO timestamp of payment */
  timestamp: string;
  /** Amount in USDC atomic units (6 decimals) */
  amount: string;
  /** Amount formatted for display */
  amountFormatted: string;
  /** Payment currency (always USDC) */
  currency: 'USDC';
  /** Network used for payment */
  network: string;
  /** Network name for display */
  networkName: string;
  /** On-chain transaction hash (if settled) */
  transactionHash?: string;
  /** Block explorer URL */
  explorerUrl?: string;
  /** Payer wallet address */
  walletAddress: string;
  /** API resource accessed */
  resource: string;
  /** Human-readable description */
  description: string;
  /** Payment status */
  status: 'pending' | 'settled' | 'failed' | 'refunded';
  /** Settlement timestamp */
  settledAt?: string;
  /** Any error message */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface PaymentHistory {
  /** Wallet address */
  walletAddress: string;
  /** Total payments made */
  totalPayments: number;
  /** Total amount spent (in USD) */
  totalSpentUsd: number;
  /** Payments in current period */
  currentPeriodPayments: number;
  /** Amount in current period */
  currentPeriodSpentUsd: number;
  /** Recent receipts */
  receipts: PaymentReceipt[];
  /** First payment date */
  firstPaymentAt?: string;
  /** Last payment date */
  lastPaymentAt?: string;
}

export interface PaymentStats {
  /** Total revenue (all time) */
  totalRevenue: number;
  /** Revenue today */
  todayRevenue: number;
  /** Revenue this week */
  weekRevenue: number;
  /** Revenue this month */
  monthRevenue: number;
  /** Total number of payments */
  totalPayments: number;
  /** Unique payers */
  uniquePayers: number;
  /** Average payment amount */
  averagePayment: number;
  /** Top endpoints by revenue */
  topEndpoints: Array<{ endpoint: string; revenue: number; count: number }>;
}

// =============================================================================
// STORAGE HELPERS
// =============================================================================

/**
 * Get receipt from storage
 */
async function getReceiptFromStorage(receiptId: string): Promise<PaymentReceipt | null> {
  return storage.hget<PaymentReceipt>(`${NAMESPACE}:${RECEIPTS_KEY}`, receiptId);
}

/**
 * Save receipt to storage
 */
async function saveReceiptToStorage(receipt: PaymentReceipt): Promise<void> {
  // Store receipt in hash
  await storage.hset(`${NAMESPACE}:${RECEIPTS_KEY}`, receipt.id, receipt);
  
  // Add to wallet index
  const walletKey = `${NAMESPACE}:${WALLET_INDEX_PREFIX}${receipt.walletAddress}`;
  await storage.rpush(walletKey, receipt.id);
  
  // Update stats
  await updateStats(receipt);
}

/**
 * Update aggregate stats
 */
async function updateStats(receipt: PaymentReceipt): Promise<void> {
  const usd = parseInt(receipt.amount, 10) / 1_000_000;
  
  // Increment counters
  await storage.incrby(`${NAMESPACE}:stats:total_revenue`, Math.round(usd * 100)); // Store as cents
  await storage.incr(`${NAMESPACE}:stats:total_payments`);
  await storage.sadd(`${NAMESPACE}:stats:unique_wallets`, receipt.walletAddress);
  
  // Daily stats
  const dateKey = new Date().toISOString().slice(0, 10);
  await storage.incrby(`${NAMESPACE}:stats:daily:${dateKey}:revenue`, Math.round(usd * 100));
  await storage.incr(`${NAMESPACE}:stats:daily:${dateKey}:count`);
  await storage.expire(`${NAMESPACE}:stats:daily:${dateKey}:revenue`, 90 * 24 * 60 * 60); // 90 days
  await storage.expire(`${NAMESPACE}:stats:daily:${dateKey}:count`, 90 * 24 * 60 * 60);
  
  // Endpoint stats
  await storage.incrby(`${NAMESPACE}:stats:endpoint:${receipt.resource}:revenue`, Math.round(usd * 100));
  await storage.incr(`${NAMESPACE}:stats:endpoint:${receipt.resource}:count`);
}

/**
 * Get wallet receipt IDs from storage
 */
async function getWalletReceiptIds(walletAddress: string): Promise<string[]> {
  const walletKey = `${NAMESPACE}:${WALLET_INDEX_PREFIX}${walletAddress}`;
  return storage.lrange(walletKey, 0, -1);
}

// =============================================================================
// RECEIPT GENERATION
// =============================================================================

/**
 * Generate a unique receipt ID
 */
function generateReceiptId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `rcpt_${timestamp}_${random}`;
}

/**
 * Format USDC amount for display
 */
function formatUsdcAmount(atomicAmount: string): string {
  const num = parseInt(atomicAmount, 10);
  const usd = num / 1_000_000;
  if (usd < 0.01) {
    return `$${usd.toFixed(4)}`;
  }
  return `$${usd.toFixed(2)}`;
}

/**
 * Get network display name
 */
function getNetworkName(network: string): string {
  const names: Record<string, string> = {
    'eip155:8453': 'Base',
    'eip155:84532': 'Base Sepolia',
    'eip155:1': 'Ethereum',
    'eip155:137': 'Polygon',
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'Solana',
    'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': 'Solana Devnet',
  };
  return names[network] || network;
}

/**
 * Get block explorer URL for transaction
 */
function getExplorerUrl(network: string, txHash: string): string {
  const explorers: Record<string, string> = {
    'eip155:8453': `https://basescan.org/tx/${txHash}`,
    'eip155:84532': `https://sepolia.basescan.org/tx/${txHash}`,
    'eip155:1': `https://etherscan.io/tx/${txHash}`,
    'eip155:137': `https://polygonscan.com/tx/${txHash}`,
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': `https://solscan.io/tx/${txHash}`,
    'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': `https://solscan.io/tx/${txHash}?cluster=devnet`,
  };
  return explorers[network] || '';
}

/**
 * Create a new payment receipt
 */
export async function createReceipt(params: {
  walletAddress: string;
  amount: string;
  resource: string;
  description: string;
  network?: string;
  transactionHash?: string;
  metadata?: Record<string, unknown>;
}): Promise<PaymentReceipt> {
  const id = generateReceiptId();
  const now = new Date().toISOString();
  const network = params.network || CURRENT_NETWORK;

  const receipt: PaymentReceipt = {
    id,
    timestamp: now,
    amount: params.amount,
    amountFormatted: formatUsdcAmount(params.amount),
    currency: 'USDC',
    network,
    networkName: getNetworkName(network),
    walletAddress: params.walletAddress.toLowerCase(),
    resource: params.resource,
    description: params.description,
    status: params.transactionHash ? 'settled' : 'pending',
    transactionHash: params.transactionHash,
    explorerUrl: params.transactionHash ? getExplorerUrl(network, params.transactionHash) : undefined,
    settledAt: params.transactionHash ? now : undefined,
    metadata: params.metadata,
  };

  // Store receipt in persistent storage
  await saveReceiptToStorage(receipt);

  return receipt;
}

/**
 * Update receipt status (e.g., when settled on-chain)
 */
export async function updateReceipt(
  receiptId: string,
  updates: Partial<Pick<PaymentReceipt, 'status' | 'transactionHash' | 'settledAt' | 'error'>>
): Promise<PaymentReceipt | null> {
  const receipt = await getReceiptFromStorage(receiptId);
  if (!receipt) return null;

  const updated = {
    ...receipt,
    ...updates,
  };

  // Add explorer URL if transaction hash provided
  if (updates.transactionHash && !receipt.explorerUrl) {
    updated.explorerUrl = getExplorerUrl(receipt.network, updates.transactionHash);
  }

  await storage.hset(`${NAMESPACE}:${RECEIPTS_KEY}`, receiptId, updated);
  return updated;
}

/**
 * Get a receipt by ID
 */
export async function getReceipt(receiptId: string): Promise<PaymentReceipt | null> {
  return getReceiptFromStorage(receiptId);
}

// =============================================================================
// PAYMENT HISTORY
// =============================================================================

/**
 * Get payment history for a wallet
 */
export async function getPaymentHistory(
  walletAddress: string,
  options: { limit?: number; offset?: number } = {}
): Promise<PaymentHistory> {
  const { limit = 50, offset = 0 } = options;
  const normalizedAddress = walletAddress.toLowerCase();

  const receiptIds = await getWalletReceiptIds(normalizedAddress);
  
  // Fetch all receipts for this wallet
  const receiptPromises = receiptIds.map((id: string) => getReceiptFromStorage(id));
  const receiptsRaw = await Promise.all(receiptPromises);
  
  const allReceipts = receiptsRaw
    .filter((r): r is PaymentReceipt => r !== null)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Calculate totals
  let totalSpentUsd = 0;
  let currentPeriodSpentUsd = 0;
  const now = Date.now();
  const periodStart = now - 30 * 24 * 60 * 60 * 1000; // Last 30 days

  for (const receipt of allReceipts) {
    if (receipt.status === 'settled' || receipt.status === 'pending') {
      const usd = parseInt(receipt.amount, 10) / 1_000_000;
      totalSpentUsd += usd;

      if (new Date(receipt.timestamp).getTime() > periodStart) {
        currentPeriodSpentUsd += usd;
      }
    }
  }

  // Paginate
  const paginatedReceipts = allReceipts.slice(offset, offset + limit);

  return {
    walletAddress: normalizedAddress,
    totalPayments: allReceipts.length,
    totalSpentUsd,
    currentPeriodPayments: allReceipts.filter(
      (r) => new Date(r.timestamp).getTime() > periodStart
    ).length,
    currentPeriodSpentUsd,
    receipts: paginatedReceipts,
    firstPaymentAt: allReceipts.length > 0 ? allReceipts[allReceipts.length - 1].timestamp : undefined,
    lastPaymentAt: allReceipts.length > 0 ? allReceipts[0].timestamp : undefined,
  };
}

// =============================================================================
// PAYMENT ANALYTICS
// =============================================================================

/**
 * Get payment statistics (for admin dashboard)
 */
export async function getPaymentStats(): Promise<PaymentStats> {
  // Get stats from storage counters
  const [
    totalRevenueCents,
    totalPayments,
    uniqueWalletsCount
  ] = await Promise.all([
    storage.get<number>(`${NAMESPACE}:stats:total_revenue`) || 0,
    storage.get<number>(`${NAMESPACE}:stats:total_payments`) || 0,
    storage.smembers(`${NAMESPACE}:stats:unique_wallets`).then(m => m.length),
  ]);

  const totalRevenue = (totalRevenueCents || 0) / 100;
  const totalPaymentsNum = totalPayments || 0;

  // Get daily stats for time-based revenue
  const today = new Date().toISOString().slice(0, 10);
  const dates: string[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }

  // Fetch daily revenue
  const dailyRevenues = await Promise.all(
    dates.map(async (date) => ({
      date,
      revenue: ((await storage.get<number>(`${NAMESPACE}:stats:daily:${date}:revenue`)) || 0) / 100,
    }))
  );

  const todayRevenue = dailyRevenues[0]?.revenue || 0;
  const weekRevenue = dailyRevenues.slice(0, 7).reduce((sum, d) => sum + d.revenue, 0);
  const monthRevenue = dailyRevenues.reduce((sum, d) => sum + d.revenue, 0);

  // Get top endpoints (scan for endpoint stats keys)
  const endpointStats: Array<{ endpoint: string; revenue: number; count: number }> = [];
  const { keys: endpointKeys } = await storage.scan(`${NAMESPACE}:stats:endpoint:*:revenue`);
  
  for (const key of endpointKeys.slice(0, 20)) {
    const endpoint = key.replace(`${NAMESPACE}:stats:endpoint:`, '').replace(':revenue', '');
    const [revenueCents, count] = await Promise.all([
      storage.get<number>(key) || 0,
      storage.get<number>(key.replace(':revenue', ':count')) || 0,
    ]);
    endpointStats.push({
      endpoint,
      revenue: (revenueCents || 0) / 100,
      count: count || 0,
    });
  }

  const topEndpoints = endpointStats
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return {
    totalRevenue,
    todayRevenue,
    weekRevenue,
    monthRevenue,
    totalPayments: totalPaymentsNum,
    uniquePayers: uniqueWalletsCount,
    averagePayment: totalPaymentsNum > 0 ? totalRevenue / totalPaymentsNum : 0,
    topEndpoints,
  };
}

// =============================================================================
// RECEIPT VERIFICATION
// =============================================================================

/**
 * Verify a receipt is valid (for dispute resolution)
 */
export async function verifyReceipt(receiptId: string): Promise<{
  valid: boolean;
  receipt?: PaymentReceipt;
  reason?: string;
}> {
  const receipt = await getReceiptFromStorage(receiptId);

  if (!receipt) {
    return { valid: false, reason: 'Receipt not found' };
  }

  if (receipt.status === 'refunded') {
    return { valid: false, reason: 'Payment was refunded', receipt };
  }

  if (receipt.status === 'failed') {
    return { valid: false, reason: 'Payment failed', receipt };
  }

  return { valid: true, receipt };
}

/**
 * Export receipts for a wallet (for tax/accounting)
 */
export async function exportReceipts(
  walletAddress: string,
  format: 'json' | 'csv' = 'json'
): Promise<string> {
  const history = await getPaymentHistory(walletAddress, { limit: 10000 });

  if (format === 'csv') {
    const headers = [
      'Receipt ID',
      'Date',
      'Amount (USD)',
      'Resource',
      'Description',
      'Status',
      'Transaction Hash',
      'Network',
    ];

    const rows = history.receipts.map((r) => [
      r.id,
      r.timestamp,
      r.amountFormatted,
      r.resource,
      r.description,
      r.status,
      r.transactionHash || '',
      r.networkName,
    ]);

    return [
      headers.join(','),
      ...rows.map((row) => row.map((v) => `"${v}"`).join(',')),
    ].join('\n');
  }

  return JSON.stringify(history, null, 2);
}
