/**
 * Crypto Vision — Bitcoin Blockchain Data Source
 *
 * blockchain.info + mempool.space — 100% free, no API key.
 *
 * Provides: network stats, latest blocks, difficulty,
 *           unconfirmed tx count, address lookups, mempool stats.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const BLOCKCHAIN = "https://blockchain.info";
const MEMPOOL = "https://mempool.space/api";

// ─── Blockchain.info Stats ──────────────────────────────────

export interface BtcStats {
  market_price_usd: number;
  hash_rate: number;
  total_fees_btc: number;
  n_btc_mined: number;
  n_tx: number;
  n_blocks_mined: number;
  minutes_between_blocks: number;
  totalbc: number;
  n_blocks_total: number;
  estimated_transaction_volume_usd: number;
  blocks_size: number;
  miners_revenue_usd: number;
  nextretarget: number;
  difficulty: number;
  estimated_btc_sent: number;
  miners_revenue_btc: number;
  total_btc_sent: number;
  trade_volume_btc: number;
  trade_volume_usd: number;
  timestamp: number;
}

export function getBtcStats(): Promise<BtcStats> {
  return cache.wrap("bc:stats", 120, () =>
    fetchJSON(`${BLOCKCHAIN}/stats?format=json`)
  );
}

// ─── Difficulty ──────────────────────────────────────────────

export function getDifficulty(): Promise<number> {
  return cache.wrap("bc:difficulty", 600, async () => {
    const res = await fetch(`${BLOCKCHAIN}/q/getdifficulty`);
    return Number(await res.text());
  });
}

// ─── Block Count ─────────────────────────────────────────────

export function getBlockCount(): Promise<number> {
  return cache.wrap("bc:blockcount", 60, async () => {
    const res = await fetch(`${BLOCKCHAIN}/q/getblockcount`);
    return Number(await res.text());
  });
}

// ─── Unconfirmed TX Count ────────────────────────────────────

export function getUnconfirmedCount(): Promise<number> {
  return cache.wrap("bc:unconfirmed", 30, async () => {
    const res = await fetch(`${BLOCKCHAIN}/q/unconfirmedcount`);
    return Number(await res.text());
  });
}

// ─── Latest Block (blockchain.info) ──────────────────────────

export interface LatestBlock {
  hash: string;
  time: number;
  block_index: number;
  height: number;
  txIndexes: number[];
}

export function getLatestBlock(): Promise<LatestBlock> {
  return cache.wrap("bc:latest-block", 30, () =>
    fetchJSON(`${BLOCKCHAIN}/latestblock?format=json`)
  );
}

// ─── Market Price (24h) ──────────────────────────────────────

export function getBtcMarketPrice(): Promise<{
  status: string;
  name: string;
  unit: string;
  period: string;
  description: string;
  values: Array<{ x: number; y: number }>;
}> {
  return cache.wrap("bc:market-price", 300, () =>
    fetchJSON(`${BLOCKCHAIN}/charts/market-price?timespan=30days&format=json`)
  );
}

// ─── Mempool.space — Mempool Stats ───────────────────────────

export interface MempoolStats {
  count: number;
  vsize: number;
  total_fee: number;
  fee_histogram: [number, number][];
}

export function getMempoolStats(): Promise<MempoolStats> {
  return cache.wrap("mp:mempool", 15, () =>
    fetchJSON(`${MEMPOOL}/mempool`)
  );
}

// ─── Mempool.space — Recent Blocks ───────────────────────────

export interface MempoolBlock {
  id: string;
  height: number;
  version: number;
  timestamp: number;
  tx_count: number;
  size: number;
  weight: number;
  merkle_root: string;
  previousblockhash: string;
  mediantime: number;
  nonce: number;
  bits: number;
  difficulty: number;
}

export function getRecentBlocks(): Promise<MempoolBlock[]> {
  return cache.wrap("mp:blocks", 30, () =>
    fetchJSON(`${MEMPOOL}/v1/blocks`)
  );
}

// ─── Mempool.space — Difficulty Adjustment ───────────────────

export interface DifficultyAdjustment {
  progressPercent: number;
  difficultyChange: number;
  estimatedRetargetDate: number;
  remainingBlocks: number;
  remainingTime: number;
  previousRetarget: number;
  nextRetargetHeight: number;
  timeAvg: number;
  timeOffset: number;
}

export function getDifficultyAdjustment(): Promise<DifficultyAdjustment> {
  return cache.wrap("mp:difficulty", 120, () =>
    fetchJSON(`${MEMPOOL}/v1/difficulty-adjustment`)
  );
}

// ─── Mempool.space — Hashrate & Mining ───────────────────────

export interface HashrateData {
  hashrates: Array<{
    timestamp: number;
    avgHashrate: number;
  }>;
  difficulty: Array<{
    timestamp: number;
    difficulty: number;
    height: number;
  }>;
  currentHashrate: number;
  currentDifficulty: number;
}

export function getHashrate(timePeriod = "1m"): Promise<HashrateData> {
  return cache.wrap(`mp:hashrate:${timePeriod}`, 600, () =>
    fetchJSON(`${MEMPOOL}/v1/mining/hashrate/${timePeriod}`)
  );
}

// ─── Mempool.space — Mining Pools ────────────────────────────

export interface MiningPoolStats {
  pools: Array<{
    poolId: number;
    name: string;
    link: string;
    blockCount: number;
    rank: number;
    emptyBlocks: number;
    slug: string;
    avgMatchRate: number;
  }>;
  blockCount: number;
  lastEstimatedHashrate: number;
}

export function getMiningPools(timePeriod = "1w"): Promise<MiningPoolStats> {
  return cache.wrap(`mp:pools:${timePeriod}`, 600, () =>
    fetchJSON(`${MEMPOOL}/v1/mining/pools/${timePeriod}`)
  );
}

// ─── Mempool.space — Address Lookup ──────────────────────────

export interface AddressInfo {
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
}

export function getAddressInfo(address: string): Promise<AddressInfo> {
  return cache.wrap(`mp:addr:${address}`, 30, () =>
    fetchJSON(`${MEMPOOL}/address/${address}`)
  );
}

// ─── Mempool.space — Lightning Network ───────────────────────

export interface LightningStats {
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
}

export function getLightningStats(): Promise<LightningStats> {
  return cache.wrap("mp:lightning", 600, () =>
    fetchJSON(`${MEMPOOL}/v1/lightning/statistics/latest`)
  );
}
