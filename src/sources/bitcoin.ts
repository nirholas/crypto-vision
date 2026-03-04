/**
 * Crypto Vision — Bitcoin Data Source
 *
 * blockchain.info + mempool.space — 100% free, no API key required.
 *
 * Provides: Bitcoin network stats, address lookups, transaction info,
 *           block data, mempool stats, mining data, Lightning Network,
 *           on-chain metrics, fee estimates, and UTXO set analysis.
 */

import { ingestBitcoinNetwork } from "../lib/bq-ingest.js";
import { cache } from "../lib/cache.js";
import { fetchJSON } from "../lib/fetcher.js";

const BLOCKCHAIN = "https://blockchain.info";
const MEMPOOL = "https://mempool.space/api";

// ─── Constants ───────────────────────────────────────────────

/** Blocks between each halving event */
export const HALVING_INTERVAL = 210_000;

/** Initial block subsidy in BTC */
export const INITIAL_BLOCK_REWARD = 50;

/** Maximum BTC supply (consensus rule) */
export const MAX_SUPPLY = 21_000_000;

/** Average block time in seconds (~10 minutes) */
export const AVG_BLOCK_TIME_SECONDS = 600;

/** Approximate blocks mined per year (365.25 * 144) */
export const BLOCKS_PER_YEAR = 52_560;

/** Historical halving data (immutable Bitcoin history) */
export const HALVING_HISTORY = [
  { block: 0, date: "2009-01-03", rewardBtc: 50, era: 0 },
  { block: 210_000, date: "2012-11-28", rewardBtc: 25, era: 1 },
  { block: 420_000, date: "2016-07-09", rewardBtc: 12.5, era: 2 },
  { block: 630_000, date: "2020-05-11", rewardBtc: 6.25, era: 3 },
  { block: 840_000, date: "2024-04-20", rewardBtc: 3.125, era: 4 },
] as const;

// ─── Bitcoin Price ───────────────────────────────────────────

export function getBTCPrice(): Promise<
  Record<string, { last: number; buy: number; sell: number; symbol: string }>
> {
  return cache.wrap("btc:ticker", 60, () =>
    fetchJSON(`${BLOCKCHAIN}/ticker`),
  );
}

// ─── Bitcoin Stats ───────────────────────────────────────────

export async function getBTCStats(): Promise<{
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
  const data = await cache.wrap("btc:stats", 120, () =>
    fetchJSON(`${BLOCKCHAIN}/stats?format=json`),
  );
  ingestBitcoinNetwork(data as unknown as Record<string, unknown>);
  return data as typeof data & {
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
    trade_volume_usd: number;
    trade_volume_btc: number;
    difficulty: number;
    minutes_between_blocks: number;
    blocks_size: number;
    total_bc_sent: number;
    estimated_btc_sent: number;
    nextretarget: number;
    timestamp: number;
  };
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

// ─── Block Hash at Height ────────────────────────────────────

/**
 * Get the block hash for a given block height.
 * mempool.space: GET /api/block-height/:height
 */
export function getBlockHashAtHeight(height: number): Promise<string> {
  return cache.wrap(`btc:bhash:${height}`, 3600, async () => {
    const res = await fetch(`${MEMPOOL}/block-height/${height}`);
    if (!res.ok) {
      throw new Error(`Failed to get block hash at height ${height}: ${res.status}`);
    }
    return res.text();
  });
}

/**
 * Get full block details by height (looks up hash, then fetches block).
 */
export async function getBlockByHeight(height: number): Promise<{
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
  const hash = await getBlockHashAtHeight(height);
  return getBlock(hash);
}

// ─── Latest Blocks ───────────────────────────────────────────

/**
 * Fetch recent blocks from mempool.space.
 * Returns ~15 most recent blocks by default.
 */
export function getLatestBlocks(): Promise<Array<{
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
}>> {
  return cache.wrap("btc:latest-blocks", 30, () =>
    fetchJSON(`${MEMPOOL}/v1/blocks`),
  );
}

// ─── Current Block Height (alias) ────────────────────────────

/**
 * Alias for getLatestBlockHeight — used by halving, S2F, supply endpoints.
 */
export function getCurrentBlockHeight(): Promise<number> {
  return getLatestBlockHeight();
}

// ─── Fee Estimates ───────────────────────────────────────────

/**
 * Recommended fee rates from mempool.space.
 */
export function getFeeEstimates(): Promise<{
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}> {
  return cache.wrap("btc:fees", 30, () =>
    fetchJSON(`${MEMPOOL}/v1/fees/recommended`),
  );
}

// ─── Address Transactions ────────────────────────────────────

/**
 * Get confirmed transaction history for a Bitcoin address.
 */
export function getAddressTransactions(address: string): Promise<Array<{
  txid: string;
  version: number;
  locktime: number;
  vin: Array<{ txid: string; vout: number; prevout: { value: number; scriptpubkey_address: string } }>;
  vout: Array<{ value: number; scriptpubkey_address: string }>;
  size: number;
  weight: number;
  fee: number;
  status: { confirmed: boolean; block_height: number; block_time: number };
}>> {
  return cache.wrap(`btc:addr-txs:${address}`, 60, () =>
    fetchJSON(`${MEMPOOL}/address/${address}/txs`),
  );
}

// ─── On-Chain Metrics (aggregated) ───────────────────────────

export interface OnChainMetrics {
  activeAddresses: number | null;
  transactionCount: number;
  avgTransactionValue: number;
  totalTransferVolume: number;
  hashRate: number;
  difficulty: number;
  blockHeight: number;
  minutesBetweenBlocks: number;
}

/**
 * Aggregate on-chain metrics from blockchain.info stats endpoint.
 * Combines multiple data points into a single metrics object.
 */
export async function getOnChainMetrics(): Promise<OnChainMetrics> {
  const stats = await getBTCStats();
  const height = await getLatestBlockHeight();

  return {
    // blockchain.info doesn't directly expose active addresses;
    // we use the tx count as a proxy for activity
    activeAddresses: null,
    transactionCount: stats.n_tx,
    avgTransactionValue: stats.estimated_transaction_volume_usd / Math.max(stats.n_tx, 1),
    totalTransferVolume: stats.estimated_transaction_volume_usd,
    hashRate: stats.hash_rate,
    difficulty: stats.difficulty,
    blockHeight: height,
    minutesBetweenBlocks: stats.minutes_between_blocks,
  };
}

// ─── Mining Stats (aggregated) ───────────────────────────────

export interface MiningStats {
  hashRate: number;
  difficulty: number;
  blockReward: number;
  blocksMinedToday: number;
  minerRevenue24h: number;
  nextDifficultyAdjustment: {
    estimatedDate: string;
    remainingBlocks: number;
    progressPercent: number;
    difficultyChange: number;
  };
}

/**
 * Aggregate mining statistics from blockchain.info + mempool.space.
 */
export async function getMiningStats(): Promise<MiningStats> {
  const [stats, diffAdj] = await Promise.all([
    getBTCStats(),
    getDifficultyAdjustment(),
  ]);

  // Compute current block reward from current height
  const currentHeight = stats.n_blocks_total;
  const halvingNumber = Math.floor(currentHeight / HALVING_INTERVAL);
  const blockReward = INITIAL_BLOCK_REWARD / Math.pow(2, halvingNumber);

  return {
    hashRate: stats.hash_rate,
    difficulty: stats.difficulty,
    blockReward,
    blocksMinedToday: stats.n_blocks_mined,
    minerRevenue24h: stats.miners_revenue_usd,
    nextDifficultyAdjustment: {
      estimatedDate: new Date(diffAdj.estimatedRetargetDate).toISOString(),
      remainingBlocks: diffAdj.remainingBlocks,
      progressPercent: diffAdj.progressPercent,
      difficultyChange: diffAdj.difficultyChange,
    },
  };
}

// ─── Supply Computation ──────────────────────────────────────

/**
 * Compute the total BTC mined up to a given block height.
 * Accounts for the halving schedule precisely.
 */
export function computeTotalMined(height: number): number {
  let totalSatoshis = 0;
  let currentRewardSats = INITIAL_BLOCK_REWARD * 1e8;
  let remainingBlocks = height;

  while (remainingBlocks > 0 && currentRewardSats >= 1) {
    const blocksInEra = Math.min(remainingBlocks, HALVING_INTERVAL);
    totalSatoshis += blocksInEra * currentRewardSats;
    remainingBlocks -= blocksInEra;
    currentRewardSats = Math.floor(currentRewardSats / 2);
  }

  return totalSatoshis / 1e8;
}

/**
 * Get current Bitcoin supply breakdown.
 */
export async function getSupplyInfo(): Promise<{
  totalMined: number;
  maxSupply: number;
  percentMined: number;
  remainingToMine: number;
  blockHeight: number;
  currentBlockReward: number;
  halvingEra: number;
  circulatingSupply: number;
}> {
  const stats = await getBTCStats();
  const blockHeight = stats.n_blocks_total;
  const halvingEra = Math.floor(blockHeight / HALVING_INTERVAL);
  const currentBlockReward = INITIAL_BLOCK_REWARD / Math.pow(2, halvingEra);
  const totalMined = computeTotalMined(blockHeight);

  // blockchain.info provides totalbc in satoshis
  const circulatingSupply = stats.totalbc / 1e8;

  return {
    totalMined,
    maxSupply: MAX_SUPPLY,
    percentMined: (totalMined / MAX_SUPPLY) * 100,
    remainingToMine: MAX_SUPPLY - totalMined,
    blockHeight,
    currentBlockReward,
    halvingEra,
    circulatingSupply,
  };
}

// ─── Rainbow Chart Price Bands ───────────────────────────────

/**
 * Compute rainbow chart logarithmic regression bands.
 * Based on Bitcoin's price history logarithmic regression model.
 * Uses the genesis date (2009-01-03) as day zero.
 */
export function computeRainbowBands(daysSinceGenesis: number): {
  bandName: string;
  minPrice: number;
  maxPrice: number;
}[] {
  // Logarithmic regression: price = 10^(a * ln(days) + b)
  // Coefficients derived from BTC historical fit
  const a = 5.84;
  const b = -17.01;
  const basePower = a * Math.log(daysSinceGenesis) + b;
  const basePrice = Math.pow(10, basePower);

  // Band multipliers from bottom to top
  const bands = [
    { name: "Fire Sale", low: 0.15, high: 0.25 },
    { name: "BUY!", low: 0.25, high: 0.40 },
    { name: "Accumulate", low: 0.40, high: 0.55 },
    { name: "Still Cheap", low: 0.55, high: 0.70 },
    { name: "HODL!", low: 0.70, high: 0.90 },
    { name: "Is this a bubble?", low: 0.90, high: 1.20 },
    { name: "FOMO intensifies", low: 1.20, high: 1.60 },
    { name: "Sell. Seriously, SELL!", low: 1.60, high: 2.50 },
    { name: "Maximum Bubble Territory", low: 2.50, high: 4.00 },
  ];

  return bands.map((band) => ({
    bandName: band.name,
    minPrice: Math.round(basePrice * band.low * 100) / 100,
    maxPrice: Math.round(basePrice * band.high * 100) / 100,
  }));
}

/**
 * Days elapsed since the Bitcoin genesis block (2009-01-03T18:15:05Z).
 */
export function daysSinceGenesis(now: Date = new Date()): number {
  const genesis = new Date("2009-01-03T18:15:05Z");
  return Math.floor((now.getTime() - genesis.getTime()) / 86_400_000);
}
