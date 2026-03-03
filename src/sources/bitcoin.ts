/**
 * Crypto Vision — Blockchain.info / mempool.space extended
 *
 * 100% free, no API key required.
 *
 * Provides: Bitcoin network stats, address lookups,
 *           transaction info, block data, mempool stats.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BLOCKCHAIN = "https://blockchain.info";
const MEMPOOL = "https://mempool.space/api";

// ─── Bitcoin Price ───────────────────────────────────────────

export function getBTCPrice(): Promise<
  Record<string, { last: number; buy: number; sell: number; symbol: string }>
> {
  return cache.wrap("btc:ticker", 60, () =>
    fetchJSON(`${BLOCKCHAIN}/ticker`),
  );
}

// ─── Bitcoin Stats ───────────────────────────────────────────

export function getBTCStats(): Promise<{
  market_price_usd: number;
  hash_rate: number;
  total_fees_btc: number;
  n_btc_mined: number;
  n_tx: number;
  n_blocks_mined: number;
  totalbc: number;
  n_blocks_total: number;
  estimated_transaction_volume_usd: number;
  miners_revenue_usd: number;
  miners_revenue_btc: number;
  trade_volume_btc: number;
  trade_volume_usd: number;
  difficulty: number;
  minutes_between_blocks: number;
  blocks_size: number;
  total_bc_sent: number;
  estimated_btc_sent: number;
  nextretarget: number;
  timestamp: number;
}> {
  return cache.wrap("btc:stats", 120, () =>
    fetchJSON(`${BLOCKCHAIN}/stats?format=json`),
  );
}

// ─── Bitcoin Address Balance ─────────────────────────────────

export function getAddressBalance(address: string): Promise<{
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}> {
  return cache.wrap(`btc:addr:${address}`, 60, () =>
    fetchJSON(`${MEMPOOL}/address/${address}`),
  );
}

// ─── Bitcoin Transaction ─────────────────────────────────────

export function getBTCTransaction(txid: string): Promise<{
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{ txid: string; vout: number; prevout: { value: number; scriptpubkey_address: string } }>;
  vout: Array<{ value: number; scriptpubkey_address: string }>;
  size: number;
  weight: number;
  fee: number;
  status: { confirmed: boolean; block_height: number; block_time: number };
}> {
  return cache.wrap(`btc:tx:${txid}`, 600, () =>
    fetchJSON(`${MEMPOOL}/tx/${txid}`),
  );
}

// ─── Latest Block ────────────────────────────────────────────

export function getLatestBlockHeight(): Promise<number> {
  return cache.wrap("btc:tip", 30, () =>
    fetchJSON(`${MEMPOOL}/blocks/tip/height`),
  );
}

export function getBlock(hash: string): Promise<{
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  difficulty: number;
  nonce: number;
  bits: number;
  previousblockhash: string;
}> {
  return cache.wrap(`btc:block:${hash}`, 3600, () =>
    fetchJSON(`${MEMPOOL}/block/${hash}`),
  );
}

// ─── Mempool Stats ───────────────────────────────────────────

export function getMempoolStats(): Promise<{
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram: [number, number][];
}> {
  return cache.wrap("btc:mempool", 30, () =>
    fetchJSON(`${MEMPOOL}/mempool`),
  );
}

// ─── Difficulty Adjustment ───────────────────────────────────

export function getDifficultyAdjustment(): Promise<{
  progressPercent: number;
  difficultyChange: number;
  estimatedRetargetDate: number;
  remainingBlocks: number;
  remainingTime: number;
  previousRetarget: number;
  nextRetargetHeight: number;
  timeAvg: number;
  timeOffset: number;
}> {
  return cache.wrap("btc:difficulty", 300, () =>
    fetchJSON(`${MEMPOOL}/v1/difficulty-adjustment`),
  );
}

// ─── Lightning Network ───────────────────────────────────────

export function getLightningStats(): Promise<{
  latest: {
    id: number;
    added: string;
    channel_count: number;
    node_count: number;
    total_capacity: number;
    tor_nodes: number;
    clearnet_nodes: number;
    unannounced_nodes: number;
    avg_capacity: number;
    avg_fee_rate: number;
    avg_base_fee_mtokens: number;
    med_capacity: number;
    med_fee_rate: number;
    med_base_fee_mtokens: number;
    clearnet_tor_nodes: number;
  };
}> {
  return cache.wrap("btc:lightning", 600, () =>
    fetchJSON(`${MEMPOOL}/v1/lightning/statistics/latest`),
  );
}
