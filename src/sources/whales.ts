/**
 * Crypto Vision — Whale Tracking Data Source
 *
 * Multi-provider whale and large transaction monitoring:
 *  - Blockchair (multi-chain stats, large BTC transactions)
 *  - Blockchain.info (BTC charts, network stats)
 *  - Etherscan (large ETH transfers, whale balances) — requires API key
 *
 * All primary endpoints are free / no key required.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

// ─── Blockchair ──────────────────────────────────────────────

const BLOCKCHAIR = "https://api.blockchair.com";

function blockchairParams(): string {
  const key = process.env.BLOCKCHAIR_API_KEY;
  return key ? `?key=${key}` : "";
}

/**
 * Blockchair chain stats (bitcoin, ethereum, etc.)
 */
export function getChainStats(chain = "bitcoin"): Promise<any> {
  return cache.wrap(`whale:stats:${chain}`, 120, () =>
    fetchJSON(`${BLOCKCHAIR}/${chain}/stats${blockchairParams()}`),
  );
}

/**
 * Recent large BTC transactions (> threshold BTC) via Blockchair.
 */
export function getLatestBTCTransactions(limit = 25): Promise<any> {
  return cache.wrap(`whale:btc:latest:${limit}`, 60, () =>
    fetchJSON(
      `${BLOCKCHAIR}/bitcoin/transactions${blockchairParams()}${blockchairParams() ? "&" : "?"}limit=${limit}&s=output_total(desc)`,
    ),
  );
}

/**
 * Blockchair address balance lookup (multi-chain).
 */
export function getAddressInfo(chain: string, address: string): Promise<any> {
  return cache.wrap(`whale:addr:${chain}:${address}`, 120, () =>
    fetchJSON(`${BLOCKCHAIR}/${chain}/dashboards/address/${address}${blockchairParams()}`),
  );
}

/**
 * Blockchair raw mempool stats (Bitcoin).
 */
export function getBTCMempool(): Promise<any> {
  return cache.wrap("whale:btc:mempool", 30, () =>
    fetchJSON(`${BLOCKCHAIR}/bitcoin/mempool/transactions${blockchairParams()}`),
  );
}

// ─── Blockchain.info Charts ──────────────────────────────────

const BC_CHARTS = "https://api.blockchain.info/charts";

export type ChartName =
  | "market-price"
  | "hash-rate"
  | "difficulty"
  | "n-transactions"
  | "avg-block-size"
  | "mempool-size"
  | "miners-revenue"
  | "transaction-fees"
  | "cost-per-transaction"
  | "n-unique-addresses"
  | "n-transactions-per-block"
  | "output-volume"
  | "estimated-transaction-volume"
  | "market-cap"
  | "trade-volume";

/**
 * Blockchain.info chart data (Bitcoin network analytics).
 */
export function getBTCChart(
  name: ChartName | string,
  timespan = "1year",
  rollingAverage?: string,
): Promise<any> {
  const params = new URLSearchParams({
    timespan,
    format: "json",
    cors: "true",
  });
  if (rollingAverage) params.set("rollingAverage", rollingAverage);
  return cache.wrap(`whale:chart:${name}:${timespan}`, 600, () =>
    fetchJSON(`${BC_CHARTS}/${name}?${params.toString()}`),
  );
}

// ─── Etherscan Whale Data ────────────────────────────────────

const ETHERSCAN = "https://api.etherscan.io/api";

function etherscanKey(): string {
  return process.env.ETHERSCAN_API_KEY || "";
}

/**
 * Top ETH holders / rich list (requires Etherscan Pro).
 * Falls back to top accounts by balance.
 */
export function getETHRichList(): Promise<any> {
  if (!etherscanKey()) return Promise.resolve({ error: "ETHERSCAN_API_KEY not set" });
  return cache.wrap("whale:eth:richlist", 3600, () =>
    fetchJSON(`${ETHERSCAN}?module=account&action=balancemulti&address=${TOP_ETH_ADDRESSES.join(",")}&tag=latest&apikey=${etherscanKey()}`),
  );
}

/**
 * ERC-20 token top holders (requires Etherscan Pro).
 */
export function getTokenTopHolders(contractAddress: string, page = 1, offset = 25): Promise<any> {
  if (!etherscanKey()) return Promise.resolve({ error: "ETHERSCAN_API_KEY not set" });
  return cache.wrap(`whale:eth:holders:${contractAddress}:${page}`, 600, () =>
    fetchJSON(`${ETHERSCAN}?module=token&action=tokenholderlist&contractaddress=${contractAddress}&page=${page}&offset=${offset}&apikey=${etherscanKey()}`),
  );
}

/**
 * Recent large ETH internal transactions.
 */
export function getRecentLargeETHTransfers(address: string, startblock = 0): Promise<any> {
  if (!etherscanKey()) return Promise.resolve({ error: "ETHERSCAN_API_KEY not set" });
  return cache.wrap(`whale:eth:transfers:${address}:${startblock}`, 120, () =>
    fetchJSON(`${ETHERSCAN}?module=account&action=txlistinternal&address=${address}&startblock=${startblock}&sort=desc&apikey=${etherscanKey()}`),
  );
}

// ─── Known whale addresses for monitoring ────────────────────

const TOP_ETH_ADDRESSES = [
  "0x00000000219ab540356cBB839Cbe05303d7705Fa", // ETH2 Deposit Contract
  "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", // WETH
  "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", // Binance
  "0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf", // Kraken
  "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489", // Robinhood
  "0x1B3cB81E51011b549d78bf720b0d924ac763A7C2", // Grayscale
  "0xF977814e90dA44bFA03b6295A0616a897441aceC", // Binance 8
  "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503", // Binance Founder
];

// ─── Whale Alert style aggregation ───────────────────────────

/**
 * Aggregate whale overview: combine Blockchair + chain stats.
 */
export async function getWhaleOverview(): Promise<{
  btcStats: any;
  ethStats: any;
  btcMempool: any;
}> {
  const [btcStats, ethStats, btcMempool] = await Promise.all([
    getChainStats("bitcoin"),
    getChainStats("ethereum"),
    getBTCMempool().catch(() => null),
  ]);
  return { btcStats, ethStats, btcMempool };
}
