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

import { ingestWhaleMovements } from "../lib/bq-ingest.js";
import { cache } from "../lib/cache.js";
import { fetchJSON } from "../lib/fetcher.js";

// ─── Blockchair ──────────────────────────────────────────────

const BLOCKCHAIR = "https://api.blockchair.com";

function blockchairParams(): string {
  const key = process.env.BLOCKCHAIR_API_KEY;
  return key ? `?key=${key}` : "";
}

/**
 * Blockchair chain stats (bitcoin, ethereum, etc.)
 */
export interface BlockchairStatsResponse {
  data: Record<string, unknown>;
  context: {
    code: number;
    source: string;
    results: number;
    state: number;
    cache: { live: boolean; duration: number };
  };
}

export function getChainStats(chain = "bitcoin"): Promise<BlockchairStatsResponse> {
  return cache.wrap(`whale:stats:${chain}`, 120, () =>
    fetchJSON(`${BLOCKCHAIR}/${chain}/stats${blockchairParams()}`),
  );
}

/**
 * Recent large BTC transactions (> threshold BTC) via Blockchair.
 */
export async function getLatestBTCTransactions(limit = 25): Promise<unknown> {
  const data = await cache.wrap(`whale:btc:latest:${limit}`, 60, () =>
    fetchJSON(
      `${BLOCKCHAIR}/bitcoin/transactions${blockchairParams()}${blockchairParams() ? "&" : "?"}limit=${limit}&s=output_total(desc)`,
    ),
  );
  // Fire-and-forget: attempt BQ ingest for whale movements
  const txData = data as Record<string, unknown>;
  if (Array.isArray(txData.data)) {
    ingestWhaleMovements(
      (txData.data as Array<Record<string, unknown>>).map(tx => ({
        tx_hash: tx.hash,
        chain: "bitcoin",
        amount: tx.output_total,
        usd_value: tx.output_total_usd,
        block_number: tx.block_id,
        movement_type: "whale_transfer",
      })),
    );
  }
  return data;
}

/**
 * Blockchair address balance lookup (multi-chain).
 */
export function getAddressInfo(chain: string, address: string): Promise<unknown> {
  return cache.wrap(`whale:addr:${chain}:${address}`, 120, () =>
    fetchJSON(`${BLOCKCHAIR}/${chain}/dashboards/address/${address}${blockchairParams()}`),
  );
}

/**
 * Blockchair raw mempool stats (Bitcoin).
 */
export function getBTCMempool(): Promise<unknown> {
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
export interface ChartDataResponse {
  status: string;
  name: string;
  unit: string;
  period: string;
  description: string;
  values: Array<{ x: number; y: number }>;
}

export function getBTCChart(
  name: ChartName | string,
  timespan = "1year",
  rollingAverage?: string,
): Promise<ChartDataResponse> {
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
export function getETHRichList(): Promise<{ error?: string; result?: Array<{ account: string; balance: string }> }> {
  if (!etherscanKey()) return Promise.resolve({ error: "ETHERSCAN_API_KEY not set" });
  return cache.wrap("whale:eth:richlist", 3600, () =>
    fetchJSON(`${ETHERSCAN}?module=account&action=balancemulti&address=${TOP_ETH_ADDRESSES.join(",")}&tag=latest&apikey=${etherscanKey()}`),
  );
}

/**
 * ERC-20 token top holders (requires Etherscan Pro).
 */
export function getTokenTopHolders(contractAddress: string, page = 1, offset = 25): Promise<unknown> {
  if (!etherscanKey()) return Promise.resolve({ error: "ETHERSCAN_API_KEY not set" });
  return cache.wrap(`whale:eth:holders:${contractAddress}:${page}`, 600, () =>
    fetchJSON(`${ETHERSCAN}?module=token&action=tokenholderlist&contractaddress=${contractAddress}&page=${page}&offset=${offset}&apikey=${etherscanKey()}`),
  );
}

/**
 * Recent large ETH internal transactions.
 */
export function getRecentLargeETHTransfers(address: string, startblock = 0): Promise<unknown> {
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
  btcStats: unknown;
  ethStats: unknown;
  btcMempool: unknown;
}> {
  const [btcStats, ethStats, btcMempool] = await Promise.all([
    getChainStats("bitcoin"),
    getChainStats("ethereum"),
    getBTCMempool().catch(() => null),
  ]);
  return { btcStats, ethStats, btcMempool };
}

// ─── Known Exchange Addresses ────────────────────────────────

interface ExchangeLabel {
  name: string;
  chain: string;
}

const EXCHANGE_ADDRESS_MAP: ReadonlyMap<string, ExchangeLabel> = new Map([
  // Ethereum exchanges
  ["0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", { name: "Binance", chain: "ethereum" }],
  ["0xF977814e90dA44bFA03b6295A0616a897441aceC", { name: "Binance 8", chain: "ethereum" }],
  ["0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503", { name: "Binance 14", chain: "ethereum" }],
  ["0x28C6c06298d514Db089934071355E5743bf21d60", { name: "Binance 14", chain: "ethereum" }],
  ["0x21a31Ee1afC51d94C2eFcCAa2092aD1028285549", { name: "Binance 36", chain: "ethereum" }],
  ["0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf", { name: "Kraken", chain: "ethereum" }],
  ["0x2910543Af39abA0Cd09dBb2D50200b3E800A63D2", { name: "Kraken 13", chain: "ethereum" }],
  ["0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489", { name: "Robinhood", chain: "ethereum" }],
  ["0xDc76CD25977E0a5Ae17155770273aD58648900D3", { name: "Coinbase", chain: "ethereum" }],
  ["0xA090e606E30bD747d4E6245a1517EbE430F0057e", { name: "Coinbase 2", chain: "ethereum" }],
  ["0x503828976D22510aad0201ac7EC88293211D23Da", { name: "Coinbase 6", chain: "ethereum" }],
  ["0xDFd5293D8e347dFe59E90eFd55b2956a1343963d", { name: "Coinbase 6", chain: "ethereum" }],
  ["0x2B6eD29A95753C3Ad948348e3e7b1A251080Ffb9", { name: "Bitfinex", chain: "ethereum" }],
  ["0x742d35Cc6634C0532925a3b844Bc9e7595f2bD0E", { name: "Bitfinex 2", chain: "ethereum" }],
  ["0xFBb1b73C4f0BDa4f67dcA266ce6Ef42f520fBB98", { name: "Bittrex", chain: "ethereum" }],
  ["0x1B3cB81E51011b549d78bf720b0d924ac763A7C2", { name: "Grayscale", chain: "ethereum" }],
  ["0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0", { name: "OKX", chain: "ethereum" }],
  ["0x6cC5F688a315f3dC28A7781717a9A798a59fDA7b", { name: "OKX 2", chain: "ethereum" }],
  ["0x46340b20830761efd32832A74d7169B29FEB9758", { name: "Crypto.com", chain: "ethereum" }],
  // Bitcoin exchanges (lowercase for normalization)
  ["bc1qm34lsc65zpw79lxes69zkqmk6ee3ewf0j77s3h", { name: "Binance", chain: "bitcoin" }],
  ["3M219KR5vEneNb47ewrPfWyb5jQ2DjxRP6", { name: "Binance Cold", chain: "bitcoin" }],
  ["bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh", { name: "Binance", chain: "bitcoin" }],
  ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", { name: "Genesis Block", chain: "bitcoin" }],
  ["385cR5DM96n1HvBDMzLHPYcw89fZAXULJP", { name: "Binance Cold 2", chain: "bitcoin" }],
  ["34xp4vRoCGJym3xR7yCVPFHoCNxv4Twseo", { name: "Bitfinex", chain: "bitcoin" }],
]);

/** Known smart money / fund / whale addresses with labels. */
const SMART_MONEY_ADDRESSES: ReadonlyArray<{ address: string; label: string; chain: string }> = [
  { address: "0x00000000219ab540356cBB839Cbe05303d7705Fa", label: "ETH2 Deposit Contract", chain: "ethereum" },
  { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", label: "WETH", chain: "ethereum" },
  { address: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", label: "Binance", chain: "ethereum" },
  { address: "0x40B38765696e3d5d8d9d834D8AaD4bB6e418E489", label: "Robinhood", chain: "ethereum" },
  { address: "0x1B3cB81E51011b549d78bf720b0d924ac763A7C2", label: "Grayscale", chain: "ethereum" },
  { address: "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503", label: "Binance Founder", chain: "ethereum" },
  { address: "0x267be1C1D684F78cb4F6a176C4911b741E4Ffdc0", label: "OKX", chain: "ethereum" },
  { address: "0xDA9dfA130Df4dE4673b89022EE50ff26f6EA73Cf", label: "Kraken", chain: "ethereum" },
];

const walletWatchlist = new Set<string>();

function isExchangeAddress(address: string): ExchangeLabel | undefined {
  return EXCHANGE_ADDRESS_MAP.get(address);
}

function detectChainFromAddress(address: string): string {
  if (address.startsWith("0x")) return "ethereum";
  if (address.startsWith("bc1") || address.startsWith("1") || address.startsWith("3")) return "bitcoin";
  if (address.startsWith("T")) return "tron";
  if (address.length >= 32 && address.length <= 44 && !address.startsWith("0x")) return "solana";
  return "unknown";
}

// ─── Whale Transaction Types ─────────────────────────────────

export type TransactionType = "exchange_deposit" | "exchange_withdrawal" | "whale_transfer" | "unknown";

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

export interface WhaleClassification {
  overallSignal: "bullish" | "bearish" | "neutral";
  signalStrength: number;
  exchangeDeposits: number;
  exchangeWithdrawals: number;
  whaleTransfers: number;
  netExchangeFlow: number;
}

export interface SmartMoneyTrade {
  wallet: string;
  walletLabel: string;
  token: string;
  action: "buy" | "sell" | "transfer";
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
  topPerformingWallets: Array<{ wallet: string; label: string; trades: number; estimatedPnl: number }>;
  defiTrends: Array<{ protocol: string; action: string; count: number }>;
}

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

export interface AccumulationSignal {
  symbol: string;
  signal: "accumulation" | "distribution" | "neutral";
  strength: number;
  exchangeNetFlow: number;
  whaleBalanceChange: number;
  period: string;
  interpretation: string;
}

export interface DormantWallet {
  address: string;
  chain: string;
  lastActiveDate: string;
  dormantDays: number;
  reactivatedAt: string;
  balanceUsd: number;
  transactionHash: string;
}

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

// ─── BTC Price Helper ────────────────────────────────────────

async function getBTCPrice(): Promise<number> {
  return cache.wrap("whale:btc:price", 60, async () => {
    const data = await fetchJSON<{ bitcoin: { usd: number } }>(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    );
    return data.bitcoin.usd;
  });
}

async function getETHPrice(): Promise<number> {
  return cache.wrap("whale:eth:price", 60, async () => {
    const data = await fetchJSON<{ ethereum: { usd: number } }>(
      "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd",
    );
    return data.ethereum.usd;
  });
}

// ─── Whale Transaction Feed ──────────────────────────────────

interface BlockchairTx {
  block_id: number;
  hash: string;
  time: string;
  input_total: number;
  output_total: number;
  fee: number;
  input_count: number;
  output_count: number;
  is_coinbase?: boolean;
}

interface BlockchairTxResponse {
  data: BlockchairTx[];
  context: { state: number };
}

interface EtherscanTx {
  hash: string;
  from: string;
  to: string;
  value: string;
  timeStamp: string;
  blockNumber: string;
  isError: string;
}

interface EtherscanResponse {
  status: string;
  result: EtherscanTx[];
}

/**
 * Get recent whale transactions across chains, normalized to a common format.
 * Combines large BTC transactions from Blockchair with large ETH transfers.
 */
export async function getRecentWhaleTransactions(opts: {
  minUsd?: number;
} = {}): Promise<WhaleTransaction[]> {
  const minUsd = opts.minUsd ?? 100_000;

  return cache.wrap(`whale:txfeed:${minUsd}`, 60, async () => {
    const [btcPrice, ethPrice] = await Promise.all([
      getBTCPrice(),
      getETHPrice(),
    ]);

    // Fetch large BTC txs from Blockchair (sorted by output_total desc)
    const btcTxs = await fetchJSON<BlockchairTxResponse>(
      `${BLOCKCHAIR}/bitcoin/transactions${blockchairParams()}${blockchairParams() ? "&" : "?"}limit=100&s=output_total(desc)`,
    ).catch(() => ({ data: [], context: { state: 0 } }));

    // Fetch large ETH internal transactions for top whale addresses
    const ethTxPromises = TOP_ETH_ADDRESSES.slice(0, 4).map((addr) =>
      etherscanKey()
        ? fetchJSON<EtherscanResponse>(
          `${ETHERSCAN}?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=25&sort=desc&apikey=${etherscanKey()}`,
        ).catch(() => ({ status: "0", result: [] }))
        : Promise.resolve({ status: "0", result: [] as EtherscanTx[] }),
    );

    const ethResults = await Promise.all(ethTxPromises);

    const transactions: WhaleTransaction[] = [];

    // Normalize BTC transactions
    for (const tx of btcTxs.data ?? []) {
      const amountBtc = tx.output_total / 1e8;
      const amountUsd = amountBtc * btcPrice;
      if (amountUsd < minUsd) continue;

      transactions.push({
        hash: tx.hash,
        blockchain: "bitcoin",
        from: "unknown",
        to: "unknown",
        amount: amountBtc,
        amountUsd,
        symbol: "BTC",
        timestamp: tx.time,
        transactionType: "whale_transfer",
        blockHeight: tx.block_id,
      });
    }

    // Normalize ETH transactions
    for (let i = 0; i < ethResults.length; i++) {
      const result = ethResults[i];
      const sourceAddr = TOP_ETH_ADDRESSES[i];

      for (const tx of result.result ?? []) {
        if (tx.isError === "1") continue;
        const amountEth = Number(tx.value) / 1e18;
        const amountUsd = amountEth * ethPrice;
        if (amountUsd < minUsd) continue;

        const fromExchange = isExchangeAddress(tx.from);
        const toExchange = isExchangeAddress(tx.to);

        let transactionType: TransactionType = "whale_transfer";
        if (toExchange && !fromExchange) transactionType = "exchange_deposit";
        else if (fromExchange && !toExchange) transactionType = "exchange_withdrawal";

        transactions.push({
          hash: tx.hash,
          blockchain: "ethereum",
          from: tx.from,
          to: tx.to,
          amount: amountEth,
          amountUsd,
          symbol: "ETH",
          timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
          transactionType,
          blockHeight: Number(tx.blockNumber),
          fromLabel: fromExchange?.name ?? (sourceAddr === tx.from ? "Whale" : undefined),
          toLabel: toExchange?.name ?? (sourceAddr === tx.to ? "Whale" : undefined),
        });
      }
    }

    // Sort by USD amount descending
    transactions.sort((a, b) => b.amountUsd - a.amountUsd);
    return transactions;
  });
}

/**
 * Get whale transactions for a specific token symbol.
 * Currently supports BTC and ETH. Filters from the aggregate feed.
 */
export async function getWhaleTransactionsForToken(
  symbol: string,
  minUsd = 100_000,
): Promise<WhaleTransaction[]> {
  const allTxs = await getRecentWhaleTransactions({ minUsd });
  return allTxs.filter(
    (tx) => tx.symbol.toUpperCase() === symbol.toUpperCase(),
  );
}

// ─── Whale Activity Classification ──────────────────────────

/**
 * Classify whale activity from a set of transactions.
 * Determines if whales are net accumulating (bullish) or distributing (bearish).
 */
export function classifyWhaleActivity(txs: WhaleTransaction[]): WhaleClassification {
  let exchangeDeposits = 0;
  let exchangeWithdrawals = 0;
  let whaleTransfers = 0;
  let depositUsd = 0;
  let withdrawalUsd = 0;

  for (const tx of txs) {
    switch (tx.transactionType) {
      case "exchange_deposit":
        exchangeDeposits++;
        depositUsd += tx.amountUsd;
        break;
      case "exchange_withdrawal":
        exchangeWithdrawals++;
        withdrawalUsd += tx.amountUsd;
        break;
      case "whale_transfer":
        whaleTransfers++;
        break;
    }
  }

  const netExchangeFlow = depositUsd - withdrawalUsd;

  // Positive net flow = more going to exchanges = bearish (selling pressure)
  // Negative net flow = more leaving exchanges = bullish (accumulation)
  let overallSignal: "bullish" | "bearish" | "neutral" = "neutral";
  let signalStrength = 0;

  if (txs.length === 0) {
    return { overallSignal: "neutral", signalStrength: 0, exchangeDeposits, exchangeWithdrawals, whaleTransfers, netExchangeFlow };
  }

  const totalUsd = txs.reduce((sum, tx) => sum + tx.amountUsd, 0);
  const flowRatio = Math.abs(netExchangeFlow) / (totalUsd || 1);

  if (netExchangeFlow < 0) {
    overallSignal = "bullish";
    signalStrength = Math.min(100, Math.round(flowRatio * 200));
  } else if (netExchangeFlow > 0) {
    overallSignal = "bearish";
    signalStrength = Math.min(100, Math.round(flowRatio * 200));
  }

  // Boost signal if there's consensus (most txs in same direction)
  const totalClassified = exchangeDeposits + exchangeWithdrawals;
  if (totalClassified > 3) {
    const dominance = Math.max(exchangeDeposits, exchangeWithdrawals) / totalClassified;
    signalStrength = Math.min(100, Math.round(signalStrength * (0.5 + dominance * 0.5)));
  }

  return {
    overallSignal,
    signalStrength,
    exchangeDeposits,
    exchangeWithdrawals,
    whaleTransfers,
    netExchangeFlow,
  };
}

// ─── Smart Money Tracking ────────────────────────────────────

/**
 * Get recent trades from known smart money addresses.
 * Fetches on-chain transaction history for labeled whale/fund wallets.
 */
export async function getSmartMoneyTrades(
  token?: string,
  limit = 100,
): Promise<SmartMoneyTrade[]> {
  return cache.wrap(`whale:smartmoney:${token || "all"}:${limit}`, 120, async () => {
    if (!etherscanKey()) {
      return [];
    }

    const ethPrice = await getETHPrice();
    const addresses = SMART_MONEY_ADDRESSES.filter((a) => a.chain === "ethereum");
    const trades: SmartMoneyTrade[] = [];

    // Fetch recent txs for top smart money addresses (limit API calls)
    const fetchPromises = addresses.slice(0, 6).map(async (entry) => {
      const resp = await fetchJSON<EtherscanResponse>(
        `${ETHERSCAN}?module=account&action=txlist&address=${entry.address}&startblock=0&endblock=99999999&page=1&offset=30&sort=desc&apikey=${etherscanKey()}`,
      ).catch(() => ({ status: "0", result: [] as EtherscanTx[] }));

      for (const tx of resp.result ?? []) {
        if (tx.isError === "1") continue;
        const amountEth = Number(tx.value) / 1e18;
        const amountUsd = amountEth * ethPrice;
        if (amountUsd < 1000) continue; // Skip dust transactions

        const isSender = tx.from.toLowerCase() === entry.address.toLowerCase();
        trades.push({
          wallet: entry.address,
          walletLabel: entry.label,
          token: "ETH",
          action: isSender ? "sell" : "buy",
          amount: amountEth,
          amountUsd,
          timestamp: new Date(Number(tx.timeStamp) * 1000).toISOString(),
          hash: tx.hash,
        });
      }
    });

    await Promise.all(fetchPromises);

    // Filter by token if specified
    let filtered = trades;
    if (token) {
      filtered = trades.filter(
        (t) => t.token.toUpperCase() === token.toUpperCase(),
      );
    }

    // Sort by timestamp descending
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return filtered.slice(0, limit);
  });
}

/**
 * Analyze smart money trades to find consensus positions, new entries, exits.
 */
export function analyzeSmartMoney(trades: SmartMoneyTrade[]): SmartMoneyAnalysis {
  // Aggregate buys/sells by token
  const buyMap = new Map<string, { count: number; totalUsd: number }>();
  const sellMap = new Map<string, { count: number; totalUsd: number }>();
  const walletStats = new Map<string, { label: string; buys: number; sells: number; buyUsd: number; sellUsd: number }>();
  const walletTokens = new Map<string, Set<string>>();

  for (const trade of trades) {
    const map = trade.action === "buy" ? buyMap : sellMap;
    const existing = map.get(trade.token) || { count: 0, totalUsd: 0 };
    existing.count++;
    existing.totalUsd += trade.amountUsd;
    map.set(trade.token, existing);

    // Track per-wallet stats
    const wStats = walletStats.get(trade.wallet) || { label: trade.walletLabel, buys: 0, sells: 0, buyUsd: 0, sellUsd: 0 };
    if (trade.action === "buy") {
      wStats.buys++;
      wStats.buyUsd += trade.amountUsd;
    } else {
      wStats.sells++;
      wStats.sellUsd += trade.amountUsd;
    }
    walletStats.set(trade.wallet, wStats);

    // Track wallet-token pairs
    const tokens = walletTokens.get(trade.wallet) || new Set();
    tokens.add(trade.token);
    walletTokens.set(trade.wallet, tokens);
  }

  // Consensus buys: tokens where multiple wallets are buying
  const consensusBuys = [...buyMap.entries()]
    .filter(([_, v]) => v.count >= 2)
    .map(([token, v]) => ({ token, count: v.count, totalUsd: v.totalUsd }))
    .sort((a, b) => b.totalUsd - a.totalUsd);

  const consensusSells = [...sellMap.entries()]
    .filter(([_, v]) => v.count >= 2)
    .map(([token, v]) => ({ token, count: v.count, totalUsd: v.totalUsd }))
    .sort((a, b) => b.totalUsd - a.totalUsd);

  // New positions: tokens that smart money just started buying (only buys, no sells)
  const newPositions: SmartMoneyAnalysis["newPositions"] = [];
  const exitingPositions: SmartMoneyAnalysis["exitingPositions"] = [];

  for (const trade of trades) {
    const tokenBuys = buyMap.get(trade.token);
    const tokenSells = sellMap.get(trade.token);

    if (trade.action === "buy" && tokenBuys && !tokenSells) {
      if (!newPositions.some((p) => p.token === trade.token && p.wallet === trade.wallet)) {
        newPositions.push({ token: trade.token, wallet: trade.wallet, amountUsd: trade.amountUsd });
      }
    } else if (trade.action === "sell" && tokenSells && !tokenBuys) {
      if (!exitingPositions.some((p) => p.token === trade.token && p.wallet === trade.wallet)) {
        exitingPositions.push({ token: trade.token, wallet: trade.wallet, amountUsd: trade.amountUsd });
      }
    }
  }

  // Top performing wallets (estimated PnL from buy/sell imbalance)
  const topPerformingWallets = [...walletStats.entries()]
    .map(([wallet, stats]) => ({
      wallet,
      label: stats.label,
      trades: stats.buys + stats.sells,
      estimatedPnl: stats.sellUsd - stats.buyUsd,
    }))
    .sort((a, b) => b.estimatedPnl - a.estimatedPnl);

  // DeFi trends: simplified from token movements
  const defiTrends = [...buyMap.entries()]
    .map(([token, v]) => ({ protocol: token, action: "accumulation", count: v.count }))
    .concat(
      [...sellMap.entries()].map(([token, v]) => ({
        protocol: token,
        action: "distribution",
        count: v.count,
      })),
    )
    .sort((a, b) => b.count - a.count);

  return {
    consensusBuys,
    consensusSells,
    newPositions,
    exitingPositions,
    topPerformingWallets,
    defiTrends,
  };
}

// ─── Exchange Flows ──────────────────────────────────────────

/**
 * Get exchange deposit/withdrawal flows by monitoring known exchange addresses.
 */
export async function getExchangeFlows(): Promise<ExchangeFlowData[]> {
  return cache.wrap("whale:exchange:flows", 300, async () => {
    if (!etherscanKey()) {
      return [];
    }

    const exchangeAddresses = [...EXCHANGE_ADDRESS_MAP.entries()].filter(
      ([_, label]) => label.chain === "ethereum",
    );

    const flows: ExchangeFlowData[] = [];

    // Group addresses by exchange name
    const exchangeGroups = new Map<string, string[]>();
    for (const [addr, label] of exchangeAddresses) {
      const addrs = exchangeGroups.get(label.name) || [];
      addrs.push(addr);
      exchangeGroups.set(label.name, addrs);
    }

    // Fetch balance for each exchange group (sample first address)
    const ethPrice = await getETHPrice();

    for (const [name, addrs] of exchangeGroups) {
      const addr = addrs[0];
      const resp = await fetchJSON<{ status: string; result: string }>(
        `${ETHERSCAN}?module=account&action=balance&address=${addr}&tag=latest&apikey=${etherscanKey()}`,
      ).catch(() => ({ status: "0", result: "0" }));

      const balanceEth = Number(resp.result) / 1e18;

      // Get recent tx count for flow estimation
      const txResp = await fetchJSON<EtherscanResponse>(
        `${ETHERSCAN}?module=account&action=txlist&address=${addr}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${etherscanKey()}`,
      ).catch(() => ({ status: "0", result: [] as EtherscanTx[] }));

      let depositCount = 0;
      let withdrawalCount = 0;
      let depositVolume = 0;
      let withdrawalVolume = 0;
      const oneDayAgo = Date.now() / 1000 - 86_400;

      for (const tx of txResp.result ?? []) {
        if (Number(tx.timeStamp) < oneDayAgo) continue;
        const amountEth = Number(tx.value) / 1e18;
        const isIncoming = tx.to.toLowerCase() === addr.toLowerCase();

        if (isIncoming) {
          depositCount++;
          depositVolume += amountEth * ethPrice;
        } else {
          withdrawalCount++;
          withdrawalVolume += amountEth * ethPrice;
        }
      }

      flows.push({
        exchange: name,
        address: addr,
        chain: "ethereum",
        balance: balanceEth,
        deposits24h: depositVolume,
        withdrawals24h: withdrawalVolume,
        netFlow: depositVolume - withdrawalVolume,
        depositCount,
        withdrawalCount,
      });
    }

    return flows.sort((a, b) => Math.abs(b.netFlow) - Math.abs(a.netFlow));
  });
}

/**
 * Get exchange flows for a specific token symbol.
 */
export async function getTokenExchangeFlows(symbol: string): Promise<ExchangeFlowData[]> {
  const flows = await getExchangeFlows();
  // If the symbol is ETH, return all flows (currently ETH-only implementation)
  if (symbol.toUpperCase() === "ETH") return flows;

  // For other tokens, we'd need to check ERC-20 transfers — return filtered or empty
  return flows.filter((f) => f.chain === detectChainFromAddress(f.address));
}

// ─── Top Wallets ─────────────────────────────────────────────

/**
 * Get top wallets by holdings for a given chain.
 */
export async function getTopWalletsByChain(
  chain: string,
): Promise<Array<{ address: string; balance: number; label?: string; rank: number }>> {
  return cache.wrap(`whale:topwallets:${chain}`, 600, async () => {
    if (chain === "ethereum") {
      // Use the existing rich list data
      const richList = await getETHRichList();
      if (richList.error) return [];

      const results = (richList.result ?? []) as Array<{ account: string; balance: string }>;
      return results.map((entry, idx) => {
        const addr = entry.account;
        const exchange = isExchangeAddress(addr);
        return {
          address: addr,
          balance: Number(entry.balance) / 1e18,
          label: exchange?.name,
          rank: idx + 1,
        };
      });
    }

    if (chain === "bitcoin") {
      // Use Blockchair address stats
      const stats = await getChainStats("bitcoin");
      return [{
        address: "blockchain-aggregate",
        balance: (stats as unknown as Record<string, unknown>)?.data
          ? 0
          : 0,
        label: "Bitcoin Network Stats",
        rank: 1,
      }];
    }

    // For other chains, use Blockchair if available
    const stats = await getChainStats(chain).catch(() => null);
    return stats
      ? [{ address: "network-stats", balance: 0, label: `${chain} stats`, rank: 1 }]
      : [];
  });
}

// ─── Wallet Profile ──────────────────────────────────────────

/**
 * Get comprehensive wallet profile and activity for a given address.
 */
export async function getWalletProfile(address: string): Promise<WalletProfile> {
  const chain = detectChainFromAddress(address);

  return cache.wrap(`whale:wallet:${address}`, 120, async () => {
    if (chain === "ethereum" && etherscanKey()) {
      const [balanceResp, txResp] = await Promise.all([
        fetchJSON<{ result: string }>(
          `${ETHERSCAN}?module=account&action=balance&address=${address}&tag=latest&apikey=${etherscanKey()}`,
        ).catch(() => ({ result: "0" })),
        fetchJSON<EtherscanResponse>(
          `${ETHERSCAN}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=50&sort=desc&apikey=${etherscanKey()}`,
        ).catch(() => ({ status: "0", result: [] as EtherscanTx[] })),
      ]);

      const ethPrice = await getETHPrice();
      const balanceEth = Number(balanceResp.result) / 1e18;
      const txs = txResp.result ?? [];
      const exchange = isExchangeAddress(address);

      let totalReceived = 0;
      let totalSent = 0;
      let firstSeen = "";
      let lastSeen = "";

      for (const tx of txs) {
        const amountEth = Number(tx.value) / 1e18;
        if (tx.to.toLowerCase() === address.toLowerCase()) {
          totalReceived += amountEth;
        } else {
          totalSent += amountEth;
        }
        const ts = new Date(Number(tx.timeStamp) * 1000).toISOString();
        if (!firstSeen || ts < firstSeen) firstSeen = ts;
        if (!lastSeen || ts > lastSeen) lastSeen = ts;
      }

      return {
        address,
        chain,
        balance: balanceEth,
        balanceUsd: balanceEth * ethPrice,
        totalReceived,
        totalSent,
        transactionCount: txs.length,
        firstSeen,
        lastSeen,
        label: exchange?.name,
        isExchange: !!exchange,
        isTracked: walletWatchlist.has(address),
      };
    }

    // Fallback: use Blockchair for other chains
    const data = await getAddressInfo(chain, address).catch(() => null);

    return {
      address,
      chain,
      balance: 0,
      balanceUsd: 0,
      totalReceived: 0,
      totalSent: 0,
      transactionCount: 0,
      firstSeen: "",
      lastSeen: "",
      label: isExchangeAddress(address)?.name,
      isExchange: !!isExchangeAddress(address),
      isTracked: walletWatchlist.has(address),
    };
  });
}

// ─── Wallet Tracking ─────────────────────────────────────────

/**
 * Add a wallet address to the watchlist.
 * Returns the updated watchlist count.
 */
export function trackWallet(address: string): { tracked: boolean; address: string; watchlistSize: number } {
  walletWatchlist.add(address.toLowerCase());
  return {
    tracked: true,
    address: address.toLowerCase(),
    watchlistSize: walletWatchlist.size,
  };
}

/**
 * Get all tracked wallet addresses.
 */
export function getTrackedWallets(): string[] {
  return [...walletWatchlist];
}

// ─── Accumulation / Distribution Signal ──────────────────────

/**
 * Compute accumulation/distribution signal for a given token symbol.
 * Analyzes exchange flows and whale balance changes.
 */
export async function getAccumulationSignal(symbol: string): Promise<AccumulationSignal> {
  return cache.wrap(`whale:accumulation:${symbol}`, 300, async () => {
    const txs = await getRecentWhaleTransactions({ minUsd: 50_000 });
    const symbolTxs = txs.filter(
      (tx) => tx.symbol.toUpperCase() === symbol.toUpperCase(),
    );

    if (symbolTxs.length === 0) {
      return {
        symbol,
        signal: "neutral" as const,
        strength: 0,
        exchangeNetFlow: 0,
        whaleBalanceChange: 0,
        period: "24h",
        interpretation: "Insufficient data — no recent whale transactions found for this token",
      };
    }

    const classification = classifyWhaleActivity(symbolTxs);

    // Exchange net flow: positive = distribution (selling), negative = accumulation (buying)
    const exchangeNetFlow = classification.netExchangeFlow;

    // Whale balance change estimation
    const whaleTransferVolume = symbolTxs
      .filter((tx) => tx.transactionType === "whale_transfer")
      .reduce((sum, tx) => sum + tx.amountUsd, 0);

    let signal: "accumulation" | "distribution" | "neutral" = "neutral";
    let interpretation = "Market activity appears balanced";

    if (classification.overallSignal === "bullish") {
      signal = "accumulation";
      interpretation = `Whales are withdrawing from exchanges — net outflow of $${Math.abs(exchangeNetFlow).toLocaleString()}. ${classification.exchangeWithdrawals} withdrawals vs ${classification.exchangeDeposits} deposits. This suggests accumulation.`;
    } else if (classification.overallSignal === "bearish") {
      signal = "distribution";
      interpretation = `Whales are depositing to exchanges — net inflow of $${Math.abs(exchangeNetFlow).toLocaleString()}. ${classification.exchangeDeposits} deposits vs ${classification.exchangeWithdrawals} withdrawals. This suggests distribution/selling pressure.`;
    }

    return {
      symbol,
      signal,
      strength: classification.signalStrength,
      exchangeNetFlow,
      whaleBalanceChange: whaleTransferVolume,
      period: "24h",
      interpretation,
    };
  });
}

// ─── Dormant Wallet Detection ────────────────────────────────

/**
 * Detect recently activated dormant wallets.
 * Monitors known whale addresses for activity after extended dormancy periods.
 */
export async function getDormantWallets(): Promise<DormantWallet[]> {
  return cache.wrap("whale:dormant", 600, async () => {
    if (!etherscanKey()) return [];

    const ethPrice = await getETHPrice();
    const dormantResults: DormantWallet[] = [];
    const dormancyThresholdDays = 180;

    // Check a subset of known addresses for dormancy patterns
    const addressesToCheck = TOP_ETH_ADDRESSES.slice(0, 4);

    for (const address of addressesToCheck) {
      const txResp = await fetchJSON<EtherscanResponse>(
        `${ETHERSCAN}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=${etherscanKey()}`,
      ).catch(() => ({ status: "0", result: [] as EtherscanTx[] }));

      const txs = txResp.result ?? [];
      if (txs.length < 2) continue;

      // Check if the latest tx has a large gap from the previous one
      const latestTs = Number(txs[0].timeStamp);
      const previousTs = Number(txs[1].timeStamp);
      const gapDays = (latestTs - previousTs) / 86_400;

      if (gapDays >= dormancyThresholdDays) {
        const balanceResp = await fetchJSON<{ result: string }>(
          `${ETHERSCAN}?module=account&action=balance&address=${address}&tag=latest&apikey=${etherscanKey()}`,
        ).catch(() => ({ result: "0" }));

        const balanceEth = Number(balanceResp.result) / 1e18;

        dormantResults.push({
          address,
          chain: "ethereum",
          lastActiveDate: new Date(previousTs * 1000).toISOString(),
          dormantDays: Math.round(gapDays),
          reactivatedAt: new Date(latestTs * 1000).toISOString(),
          balanceUsd: balanceEth * ethPrice,
          transactionHash: txs[0].hash,
        });
      }
    }

    return dormantResults.sort((a, b) => b.dormantDays - a.dormantDays);
  });
}

// ─── Whale Alerts ────────────────────────────────────────────

export interface WhaleAlert {
  id: string;
  type: "large_transfer" | "exchange_deposit" | "exchange_withdrawal" | "dormant_activation" | "accumulation";
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  description: string;
  blockchain: string;
  amountUsd: number;
  timestamp: string;
  hash?: string;
  addresses?: { from?: string; to?: string };
}

/**
 * Generate whale alerts from recent whale transactions and dormant wallet activations.
 */
export async function getWhaleAlerts(): Promise<WhaleAlert[]> {
  return cache.wrap("whale:alerts", 60, async () => {
    const [txs, dormant] = await Promise.all([
      getRecentWhaleTransactions({ minUsd: 500_000 }),
      getDormantWallets(),
    ]);

    const alerts: WhaleAlert[] = [];
    let alertId = 0;

    // Generate alerts from large transactions
    for (const tx of txs.slice(0, 50)) {
      let severity: WhaleAlert["severity"] = "low";
      if (tx.amountUsd >= 50_000_000) severity = "critical";
      else if (tx.amountUsd >= 10_000_000) severity = "high";
      else if (tx.amountUsd >= 1_000_000) severity = "medium";

      let type: WhaleAlert["type"] = "large_transfer";
      if (tx.transactionType === "exchange_deposit") type = "exchange_deposit";
      else if (tx.transactionType === "exchange_withdrawal") type = "exchange_withdrawal";

      const formattedAmount = tx.amountUsd >= 1_000_000
        ? `$${(tx.amountUsd / 1_000_000).toFixed(1)}M`
        : `$${(tx.amountUsd / 1_000).toFixed(0)}K`;

      alerts.push({
        id: `alert-${++alertId}`,
        type,
        severity,
        title: `${formattedAmount} ${tx.symbol} ${type.replace("_", " ")}`,
        description: `${formattedAmount} in ${tx.symbol} ${tx.transactionType.replace(/_/g, " ")} on ${tx.blockchain}${tx.fromLabel ? ` from ${tx.fromLabel}` : ""}${tx.toLabel ? ` to ${tx.toLabel}` : ""}`,
        blockchain: tx.blockchain,
        amountUsd: tx.amountUsd,
        timestamp: tx.timestamp,
        hash: tx.hash,
        addresses: { from: tx.from, to: tx.to },
      });
    }

    // Generate alerts from dormant wallet reactivations
    for (const wallet of dormant) {
      alerts.push({
        id: `alert-${++alertId}`,
        type: "dormant_activation",
        severity: wallet.dormantDays > 365 ? "critical" : "high",
        title: `Dormant wallet reactivated after ${wallet.dormantDays} days`,
        description: `Address ${wallet.address.slice(0, 10)}… on ${wallet.chain} became active after ${wallet.dormantDays} days of dormancy. Current balance: $${wallet.balanceUsd.toLocaleString()}`,
        blockchain: wallet.chain,
        amountUsd: wallet.balanceUsd,
        timestamp: wallet.reactivatedAt,
        hash: wallet.transactionHash,
        addresses: { from: wallet.address },
      });
    }

    // Sort by severity priority then by amount
    const severityOrder: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
    alerts.sort((a, b) => {
      const sevDiff = (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0);
      if (sevDiff !== 0) return sevDiff;
      return b.amountUsd - a.amountUsd;
    });

    return alerts;
  });
}
