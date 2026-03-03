/**
 * Crypto Vision — Alternative Free Data Sources
 *
 * Comprehensive adapter for free crypto data APIs:
 *  - Fear & Greed Index (alternative.me)
 *  - Bitcoin network (mempool.space)
 *  - DEX token pairs (DexScreener)
 *  - Bitcoin stats (blockchain.info)
 *  - CoinPaprika (free, 25k req/month)
 *  - CoinCap (free, no key)
 *
 * All responses are Zod-validated. All fetches go through cache.wrap().
 */

import { z } from "zod";
import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { ingestFearGreed, ingestBitcoinNetwork, ingestDexPairs } from "../lib/bq-ingest.js";

// ═══════════════════════════════════════════════════════════════
// API BASE URLs
// ═══════════════════════════════════════════════════════════════

const ALTERNATIVE_ME = "https://api.alternative.me";
const MEMPOOL = "https://mempool.space/api";
const DEXSCREENER = "https://api.dexscreener.com";
const BLOCKCHAIN = "https://api.blockchain.info";

// ═══════════════════════════════════════════════════════════════
// CHAIN ID NORMALIZATION
// ═══════════════════════════════════════════════════════════════

const CHAIN_ID_MAP: Record<string, string> = {
  ethereum: "Ethereum",
  bsc: "BNB Chain",
  polygon: "Polygon",
  arbitrum: "Arbitrum",
  optimism: "Optimism",
  avalanche: "Avalanche",
  fantom: "Fantom",
  cronos: "Cronos",
  base: "Base",
  solana: "Solana",
  pulsechain: "PulseChain",
  mantle: "Mantle",
  linea: "Linea",
  blast: "Blast",
  scroll: "Scroll",
  zksync: "zkSync Era",
  polygonzkevm: "Polygon zkEVM",
  sui: "Sui",
  aptos: "Aptos",
  ton: "TON",
  tron: "Tron",
  celo: "Celo",
  gnosis: "Gnosis",
  harmony: "Harmony",
  moonbeam: "Moonbeam",
  moonriver: "Moonriver",
  aurora: "Aurora",
  metis: "Metis",
  manta: "Manta Pacific",
  sei: "Sei",
  osmosis: "Osmosis",
};

/**
 * Normalize a DexScreener chain ID to a human-readable standard name.
 */
export function normalizeChainId(chainId: string): string {
  return CHAIN_ID_MAP[chainId.toLowerCase()] ?? chainId;
}

// ═══════════════════════════════════════════════════════════════
// ZOD SCHEMAS
// ═══════════════════════════════════════════════════════════════

// ─── Fear & Greed ────────────────────────────────────────────

export const FearGreedEntrySchema = z.object({
  value: z.string(),
  value_classification: z.string(),
  timestamp: z.string(),
  time_until_update: z.string().optional(),
});

export const FearGreedResponseSchema = z.object({
  name: z.string(),
  data: z.array(FearGreedEntrySchema),
  metadata: z
    .object({
      error: z.string().nullable().optional(),
    })
    .optional(),
});

export type FearGreedEntry = z.infer<typeof FearGreedEntrySchema>;
export type FearGreedResponse = z.infer<typeof FearGreedResponseSchema>;

// ─── Bitcoin Fees (mempool.space) ────────────────────────────

export const BitcoinFeesSchema = z.object({
  fastestFee: z.number(),
  halfHourFee: z.number(),
  hourFee: z.number(),
  economyFee: z.number(),
  minimumFee: z.number(),
});

export type BitcoinFees = z.infer<typeof BitcoinFeesSchema>;

// ─── Bitcoin Hashrate (mempool.space) ────────────────────────

export const BitcoinHashrateSchema = z.object({
  currentHashrate: z.number(),
  currentDifficulty: z.number(),
});

export type BitcoinHashrate = z.infer<typeof BitcoinHashrateSchema>;

// ─── Mempool Stats (mempool.space) ───────────────────────────

export const MempoolStatsSchema = z.object({
  count: z.number(),
  vsize: z.number(),
  total_fee: z.number(),
  fee_histogram: z.array(z.tuple([z.number(), z.number()])),
});

export type MempoolStats = z.infer<typeof MempoolStatsSchema>;

// ─── Block Info (mempool.space) ──────────────────────────────

export const BlockInfoSchema = z.object({
  id: z.string().optional(),
  height: z.number(),
  hash: z.string().optional(),
  timestamp: z.number(),
  size: z.number(),
  weight: z.number(),
  tx_count: z.number(),
  difficulty: z.number(),
  version: z.number().optional(),
  merkle_root: z.string().optional(),
  previousblockhash: z.string().optional(),
  mediantime: z.number().optional(),
  nonce: z.number().optional(),
  bits: z.number().optional(),
});

export type BlockInfo = z.infer<typeof BlockInfoSchema>;

// ─── Difficulty Adjustment (mempool.space) ───────────────────

export const DifficultyAdjustmentSchema = z.object({
  progressPercent: z.number(),
  difficultyChange: z.number(),
  estimatedRetargetDate: z.number(),
  remainingBlocks: z.number(),
  remainingTime: z.number(),
  previousRetarget: z.number(),
  nextRetargetHeight: z.number(),
  timeAvg: z.number().optional(),
  timeOffset: z.number().optional(),
});

export type DifficultyAdjustment = z.infer<typeof DifficultyAdjustmentSchema>;

// ─── Transaction (mempool.space) ─────────────────────────────

export const TransactionVinSchema = z.object({
  txid: z.string(),
  vout: z.number(),
  prevout: z
    .object({
      scriptpubkey: z.string().optional(),
      scriptpubkey_address: z.string().optional(),
      value: z.number().optional(),
    })
    .nullable()
    .optional(),
  scriptsig: z.string().optional(),
  sequence: z.number().optional(),
  witness: z.array(z.string()).optional(),
});

export const TransactionVoutSchema = z.object({
  scriptpubkey: z.string().optional(),
  scriptpubkey_address: z.string().optional(),
  scriptpubkey_type: z.string().optional(),
  value: z.number(),
});

export const TransactionStatusSchema = z.object({
  confirmed: z.boolean(),
  block_height: z.number().optional(),
  block_hash: z.string().optional(),
  block_time: z.number().optional(),
});

export const TransactionSchema = z.object({
  txid: z.string(),
  version: z.number().optional(),
  locktime: z.number().optional(),
  vin: z.array(TransactionVinSchema),
  vout: z.array(TransactionVoutSchema),
  size: z.number(),
  weight: z.number(),
  fee: z.number(),
  status: TransactionStatusSchema,
});

export type TransactionDetails = z.infer<typeof TransactionSchema>;

// ─── DexScreener Schemas ─────────────────────────────────────

export const DexTokenInfoSchema = z.object({
  address: z.string(),
  name: z.string(),
  symbol: z.string(),
});

export const DexTxnsSchema = z.object({
  m5: z.object({ buys: z.number(), sells: z.number() }).optional(),
  h1: z.object({ buys: z.number(), sells: z.number() }).optional(),
  h6: z.object({ buys: z.number(), sells: z.number() }).optional(),
  h24: z.object({ buys: z.number(), sells: z.number() }).optional(),
});

export const DexVolumeSchema = z.object({
  m5: z.number().optional(),
  h1: z.number().optional(),
  h6: z.number().optional(),
  h24: z.number().optional(),
});

export const DexLiquiditySchema = z.object({
  usd: z.number().optional(),
  base: z.number().optional(),
  quote: z.number().optional(),
});

export const DexPairInfoSchema = z.object({
  imageUrl: z.string().optional(),
  websites: z
    .array(z.object({ label: z.string().optional(), url: z.string() }))
    .optional(),
  socials: z
    .array(z.object({ type: z.string().optional(), url: z.string() }))
    .optional(),
});

export const DexPairSchema = z.object({
  chainId: z.string(),
  dexId: z.string(),
  pairAddress: z.string(),
  baseToken: DexTokenInfoSchema,
  quoteToken: DexTokenInfoSchema,
  priceNative: z.string().optional(),
  priceUsd: z.string().nullable().optional(),
  txns: DexTxnsSchema.optional(),
  volume: DexVolumeSchema.optional(),
  liquidity: DexLiquiditySchema.nullable().optional(),
  fdv: z.number().nullable().optional(),
  pairCreatedAt: z.number().nullable().optional(),
  info: DexPairInfoSchema.nullable().optional(),
  priceChange: z
    .object({
      m5: z.number().optional(),
      h1: z.number().optional(),
      h6: z.number().optional(),
      h24: z.number().optional(),
    })
    .optional(),
  labels: z.array(z.string()).optional(),
  url: z.string().optional(),
});

export type DexPair = z.infer<typeof DexPairSchema>;

export const DexSearchResultSchema = z.object({
  pairs: z.array(DexPairSchema).nullable().optional(),
});

export type DexSearchResult = z.infer<typeof DexSearchResultSchema>;

export const DexTokenProfileSchema = z.object({
  url: z.string().optional(),
  chainId: z.string(),
  tokenAddress: z.string(),
  icon: z.string().optional(),
  description: z.string().optional(),
  links: z
    .array(
      z.object({
        type: z.string().optional(),
        label: z.string().optional(),
        url: z.string(),
      })
    )
    .optional(),
});

export type DexTokenProfile = z.infer<typeof DexTokenProfileSchema>;

// ─── Blockchain.info Ticker ──────────────────────────────────

export const BlockchainTickerEntrySchema = z.object({
  "15m": z.number(),
  last: z.number(),
  buy: z.number(),
  sell: z.number(),
  symbol: z.string(),
});

export const BlockchainTickerSchema = z.record(
  z.string(),
  BlockchainTickerEntrySchema
);

export type BlockchainTickerEntry = z.infer<typeof BlockchainTickerEntrySchema>;

// ═══════════════════════════════════════════════════════════════
// DATA NORMALIZATION HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Convert a Unix timestamp string (seconds) to an ISO 8601 date string.
 */
export function unixToISO(unixStr: string): string {
  return new Date(Number(unixStr) * 1000).toISOString();
}

/**
 * Normalize fee rates with multiple unit conversions.
 * @param satPerVB Fee rate in sat/vB
 * @param btcPriceUsd Optional BTC price for USD conversion (defaults to estimate)
 */
export function normalizeFeeRate(
  satPerVB: number,
  btcPriceUsd?: number
): {
  satPerVB: number;
  btcPerKB: number;
  usdPerTx: number;
} {
  const TYPICAL_TX_VBYTES = 140;
  const SAT_PER_BTC = 1e8;
  const btcPerKB = (satPerVB * 1000) / SAT_PER_BTC;
  const totalSats = satPerVB * TYPICAL_TX_VBYTES;
  const btcCost = totalSats / SAT_PER_BTC;
  const price = btcPriceUsd ?? 60_000;
  const usdPerTx = Number((btcCost * price).toFixed(4));
  return { satPerVB, btcPerKB, usdPerTx };
}

/**
 * Normalize Fear & Greed entries: add ISO dates and numeric values.
 */
export function normalizeFearGreedEntries(
  entries: FearGreedEntry[]
): Array<FearGreedEntry & { isoDate: string; numericValue: number }> {
  return entries.map((entry) => ({
    ...entry,
    isoDate: unixToISO(entry.timestamp),
    numericValue: Number(entry.value),
  }));
}

/**
 * Normalize DexScreener pairs: standardize chain names.
 */
export function normalizeDexPairs(
  pairs: DexPair[]
): Array<DexPair & { normalizedChain: string }> {
  return pairs.map((pair) => ({
    ...pair,
    normalizedChain: normalizeChainId(pair.chainId),
  }));
}

// ═══════════════════════════════════════════════════════════════
// FEAR & GREED INDEX (alternative.me)
// ═══════════════════════════════════════════════════════════════

/** Legacy interface kept for backward compatibility with existing routes */
export interface FearGreedData {
  name: string;
  data: Array<{
    value: string;
    value_classification: string;
    timestamp: string;
  }>;
}

/**
 * Fetch the Fear & Greed Index with optional limit.
 * @param limit Number of data points to return (default: 1)
 */
export async function getFearGreedIndex(limit = 1): Promise<FearGreedResponse> {
  const data = await cache.wrap(`fg:${limit}`, 120, async () => {
    const raw = await fetchJSON<unknown>(
      `${ALTERNATIVE_ME}/fng/?limit=${limit}&format=json`
    );
    return FearGreedResponseSchema.parse(raw);
  });
  ingestFearGreed(data.data as unknown as Array<Record<string, unknown>>);
  return data;
}

/**
 * Fetch Fear & Greed history for the specified number of days.
 */
export async function getFearGreedHistory(days: number): Promise<FearGreedResponse> {
  const data = await cache.wrap(`fg:history:${days}`, 600, async () => {
    const raw = await fetchJSON<unknown>(
      `${ALTERNATIVE_ME}/fng/?limit=${days}&format=json`
    );
    return FearGreedResponseSchema.parse(raw);
  });
  ingestFearGreed(data.data as unknown as Array<Record<string, unknown>>);
  return data;
}

/**
 * Get the current sentiment (latest single entry).
 */
export async function getCurrentSentiment(): Promise<{
  value: number;
  classification: string;
  timestamp: string;
  isoDate: string;
}> {
  const data = await cache.wrap("fg:current", 120, async () => {
    const raw = await fetchJSON<unknown>(
      `${ALTERNATIVE_ME}/fng/?limit=1&format=json`
    );
    return FearGreedResponseSchema.parse(raw);
  });

  const entry = data.data[0];
  if (!entry) {
    throw new Error("No Fear & Greed data available");
  }

  return {
    value: Number(entry.value),
    classification: entry.value_classification,
    timestamp: entry.timestamp,
    isoDate: unixToISO(entry.timestamp),
  };
}

/**
 * Compute a sentiment trend over the given number of days.
 * Returns trend direction, average, volatility, and week-over-week comparison.
 */
export async function getSentimentTrend(days: number): Promise<{
  trend: "improving" | "declining" | "stable";
  avgValue: number;
  volatility: number;
  currentVsPrevWeek: number;
  entries: Array<FearGreedEntry & { isoDate: string; numericValue: number }>;
}> {
  const history = await getFearGreedHistory(days);
  const analysis = analyzeSentimentTrend(history.data);
  const normalized = normalizeFearGreedEntries(history.data);

  return {
    ...analysis,
    entries: normalized,
  };
}

// ═══════════════════════════════════════════════════════════════
// BITCOIN NETWORK (mempool.space)
// ═══════════════════════════════════════════════════════════════

/**
 * Get recommended Bitcoin transaction fees.
 */
export async function getBitcoinFees(): Promise<BitcoinFees> {
  const data = await cache.wrap("mempool:fees", 30, async () => {
    const raw = await fetchJSON<unknown>(`${MEMPOOL}/v1/fees/recommended`);
    return BitcoinFeesSchema.parse(raw);
  });
  ingestBitcoinNetwork({
    fee_fast: data.fastestFee,
    fee_medium: data.halfHourFee,
    fee_slow: data.hourFee,
  });
  return data;
}

/**
 * Get current mempool statistics including fee histogram.
 */
export async function getMempoolStats(): Promise<MempoolStats> {
  const data = await cache.wrap("mempool:stats", 30, async () => {
    const raw = await fetchJSON<unknown>(`${MEMPOOL}/mempool`);
    return MempoolStatsSchema.parse(raw);
  });
  ingestBitcoinNetwork({ mempool_size: data.count });
  return data;
}

/**
 * Get recent Bitcoin blocks.
 * @param count Number of blocks to return (API returns ~15 by default)
 */
export function getRecentBlocks(count?: number): Promise<BlockInfo[]> {
  return cache.wrap(`mempool:blocks:${count ?? "default"}`, 60, async () => {
    const raw = await fetchJSON<unknown[]>(`${MEMPOOL}/v1/blocks`);
    const parsed = z.array(BlockInfoSchema).parse(raw);
    return count ? parsed.slice(0, count) : parsed;
  });
}

/**
 * Get details for a specific block by hash or height.
 * If a numeric string (height) is provided, resolves the hash first.
 */
export function getBlockDetails(hashOrHeight: string): Promise<BlockInfo> {
  return cache.wrap(`mempool:block:${hashOrHeight}`, 3600, async () => {
    let blockHash = hashOrHeight;
    if (/^\d+$/.test(hashOrHeight)) {
      blockHash = await fetchJSON<string>(
        `${MEMPOOL}/block-height/${hashOrHeight}`
      );
    }
    const raw = await fetchJSON<unknown>(`${MEMPOOL}/block/${blockHash}`);
    return BlockInfoSchema.parse(raw);
  });
}

/**
 * Get full transaction details by txid.
 */
export function getTransactionDetails(
  txid: string
): Promise<TransactionDetails> {
  return cache.wrap(`mempool:tx:${txid}`, 3600, async () => {
    const raw = await fetchJSON<unknown>(`${MEMPOOL}/tx/${txid}`);
    return TransactionSchema.parse(raw);
  });
}

/**
 * Get the current difficulty adjustment progress and estimates.
 */
export function getDifficultyAdjustment(): Promise<DifficultyAdjustment> {
  return cache.wrap("mempool:diff-adj", 300, async () => {
    const raw = await fetchJSON<unknown>(
      `${MEMPOOL}/v1/difficulty-adjustment`
    );
    return DifficultyAdjustmentSchema.parse(raw);
  });
}

/**
 * Get the mempool fee histogram.
 * Format: [[feeRate, vsize], ...] — each entry is a fee-rate bucket.
 */
export async function getMempoolFeeHistogram(): Promise<[number, number][]> {
  const stats = await getMempoolStats();
  return stats.fee_histogram;
}

/**
 * Get the current Bitcoin hashrate (3-day average from mempool.space).
 */
export async function getBitcoinHashrate(): Promise<BitcoinHashrate> {
  const data = await cache.wrap("mempool:hashrate", 300, async () => {
    const raw = await fetchJSON<unknown>(
      `${MEMPOOL}/v1/mining/hashrate/3d`
    );
    return BitcoinHashrateSchema.parse(raw);
  });
  ingestBitcoinNetwork({
    hashrate: data.currentHashrate,
    difficulty: data.currentDifficulty,
  });
  return data;
}

// ═══════════════════════════════════════════════════════════════
// DEX (DexScreener)
// ═══════════════════════════════════════════════════════════════

/**
 * Get all DEX pairs for a given token address.
 */
export async function dexTokenPairs(address: string): Promise<DexSearchResult> {
  const data = await cache.wrap(`dex:token:${address}`, 30, async () => {
    const raw = await fetchJSON<unknown>(
      `${DEXSCREENER}/latest/dex/tokens/${address}`
    );
    return DexSearchResultSchema.parse(raw);
  });
  if (data.pairs?.length) ingestDexPairs(data.pairs as unknown as Array<Record<string, unknown>>, "dexscreener");
  return data;
}

/**
 * Get a specific DEX pair by chain and pair address.
 */
export function dexPairByAddress(
  chain: string,
  pairAddress: string
): Promise<DexSearchResult> {
  return cache.wrap(`dex:pair:${chain}:${pairAddress}`, 30, async () => {
    const raw = await fetchJSON<unknown>(
      `${DEXSCREENER}/latest/dex/pairs/${chain}/${pairAddress}`
    );
    return DexSearchResultSchema.parse(raw);
  });
}

/**
 * Search DEX pairs by query string (token name, symbol, or address).
 */
export async function dexSearch(query: string): Promise<DexSearchResult> {
  const data = await cache.wrap(`dex:search:${query}`, 60, async () => {
    const raw = await fetchJSON<unknown>(
      `${DEXSCREENER}/latest/dex/search?q=${encodeURIComponent(query)}`
    );
    return DexSearchResultSchema.parse(raw);
  });
  if (data.pairs?.length) ingestDexPairs(data.pairs as unknown as Array<Record<string, unknown>>, "dexscreener");
  return data;
}

/**
 * Get the latest token profiles from DexScreener.
 */
export function getLatestTokenProfiles(): Promise<DexTokenProfile[]> {
  return cache.wrap("dex:profiles:latest", 120, async () => {
    const raw = await fetchJSON<unknown[]>(
      `${DEXSCREENER}/token-profiles/latest/v1`
    );
    return z.array(DexTokenProfileSchema).parse(raw);
  });
}

/**
 * Get the top boosted tokens on DexScreener.
 */
export function getTopBoostedTokens(): Promise<DexTokenProfile[]> {
  return cache.wrap("dex:boosts:top", 120, async () => {
    const raw = await fetchJSON<unknown[]>(
      `${DEXSCREENER}/token-boosts/top/v1`
    );
    return z.array(DexTokenProfileSchema).parse(raw);
  });
}

/**
 * Get trending DEX pairs, optionally filtered by chain.
 * Sorts by 24h volume descending.
 */
export function getTrendingDexPairs(chain?: string): Promise<DexPair[]> {
  return cache.wrap(`dex:trending:${chain ?? "all"}`, 60, async () => {
    const searchResult = await fetchJSON<unknown>(
      `${DEXSCREENER}/latest/dex/search?q=WETH`
    );
    const parsed = DexSearchResultSchema.parse(searchResult);
    let pairs = parsed.pairs ?? [];

    if (chain) {
      pairs = pairs.filter(
        (p) => p.chainId.toLowerCase() === chain.toLowerCase()
      );
    }

    return pairs
      .filter((p) => p.volume?.h24 && p.volume.h24 > 0)
      .sort((a, b) => (b.volume?.h24 ?? 0) - (a.volume?.h24 ?? 0))
      .slice(0, 50);
  });
}

// ─── Backward-compatible aliases for existing routes ─────────

/**
 * @deprecated Use dexPairByAddress instead
 */
export function dexPairDetail(
  chain: string,
  pairAddress: string
): Promise<{ pair: DexPair }> {
  return cache.wrap(`dex:pair-legacy:${chain}:${pairAddress}`, 15, async () => {
    const result = await dexPairByAddress(chain, pairAddress);
    const pair = result.pairs?.[0];
    if (!pair) {
      throw new Error(`Pair not found: ${chain}/${pairAddress}`);
    }
    return { pair };
  });
}

/**
 * @deprecated Use dexSearch with chain filter instead
 */
export function dexPairsByChain(
  chain: string
): Promise<{ pairs: DexPair[] }> {
  return cache.wrap(`dex:chain:${chain}`, 30, async () => {
    const raw = await fetchJSON<unknown>(
      `${DEXSCREENER}/latest/dex/pairs/${chain}`
    );
    const parsed = DexSearchResultSchema.parse(raw);
    return { pairs: parsed.pairs ?? [] };
  });
}

// ═══════════════════════════════════════════════════════════════
// BLOCKCHAIN.INFO
// ═══════════════════════════════════════════════════════════════

/**
 * Get Bitcoin price in multiple fiat currencies.
 */
export function getBitcoinPrice(): Promise<
  Record<string, BlockchainTickerEntry>
> {
  return cache.wrap("bcapi:ticker", 30, async () => {
    const raw = await fetchJSON<unknown>(`${BLOCKCHAIN}/ticker`);
    return BlockchainTickerSchema.parse(raw);
  });
}

/**
 * Get the count of unconfirmed Bitcoin transactions.
 */
export function getUnconfirmedTxCount(): Promise<number> {
  return cache.wrap("bcapi:unconfirmed", 60, async () => {
    const res = await fetch(`${BLOCKCHAIN}/q/unconfirmedcount`);
    const text = await res.text();
    return Number(text.trim());
  });
}

/**
 * Get the current Bitcoin mining difficulty.
 */
export function getBitcoinDifficulty(): Promise<number> {
  return cache.wrap("bcapi:difficulty", 300, async () => {
    const res = await fetch(`${BLOCKCHAIN}/q/getdifficulty`);
    const text = await res.text();
    return Number(text.trim());
  });
}

/**
 * Backward-compatible alias for getBitcoinPrice.
 * Returns the full multi-currency ticker from blockchain.info.
 */
export function getBtcExchangeRates(): Promise<
  Record<
    string,
    {
      "15m": number;
      last: number;
      buy: number;
      sell: number;
      symbol: string;
    }
  >
> {
  return cache.wrap("bccom:ticker", 60, () =>
    fetchJSON("https://blockchain.info/ticker")
  );
}

// ═══════════════════════════════════════════════════════════════
// COINPAPRIKA (free, 25k req/month)
// ═══════════════════════════════════════════════════════════════

export function getCoinPaprikaGlobal(): Promise<{
  market_cap_usd: number;
  volume_24h_usd: number;
  bitcoin_dominance_percentage: number;
  cryptocurrencies_number: number;
  market_cap_change_24h: number;
}> {
  return cache.wrap("paprika:global", 120, () =>
    fetchJSON("https://api.coinpaprika.com/v1/global")
  );
}

export function getCoinPaprikaTickers(
  limit = 100
): Promise<
  Array<{
    id: string;
    name: string;
    symbol: string;
    rank: number;
    quotes: {
      USD: {
        price: number;
        volume_24h: number;
        market_cap: number;
        percent_change_24h: number;
        percent_change_7d: number;
      };
    };
  }>
> {
  return cache.wrap(`paprika:tickers:${limit}`, 120, () =>
    fetchJSON(`https://api.coinpaprika.com/v1/tickers?limit=${limit}`)
  );
}

/** Coin detail by CoinPaprika ID (e.g. "btc-bitcoin") */
export function getCoinPaprikaDetail(id: string): Promise<{
  id: string;
  name: string;
  symbol: string;
  rank: number;
  type: string;
  description: string;
  open_source: boolean;
  started_at: string | null;
  tags: Array<{ id: string; name: string }>;
  team: Array<{ id: string; name: string; position: string }>;
  links: Record<string, string[]>;
  whitepaper: { link: string; thumbnail: string };
  is_active: boolean;
}> {
  return cache.wrap(`paprika:coin:${id}`, 600, () =>
    fetchJSON(`https://api.coinpaprika.com/v1/coins/${id}`)
  );
}

/** CoinPaprika OHLCV (last 30 days) */
export function getCoinPaprikaOHLCV(
  id: string
): Promise<
  Array<{
    time_open: string;
    time_close: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    market_cap: number;
  }>
> {
  return cache.wrap(`paprika:ohlcv:${id}`, 300, () =>
    fetchJSON(`https://api.coinpaprika.com/v1/coins/${id}/ohlcv/latest/`)
  );
}

/** CoinPaprika exchanges list */
export function getCoinPaprikaExchanges(): Promise<
  Array<{
    id: string;
    name: string;
    active: boolean;
    quotes: {
      USD: {
        reported_volume_24h: number;
        adjusted_volume_24h: number;
      };
    };
    last_updated: string;
  }>
> {
  return cache.wrap("paprika:exchanges", 600, () =>
    fetchJSON("https://api.coinpaprika.com/v1/exchanges")
  );
}

/** CoinPaprika coin events */
export function getCoinPaprikaEvents(
  id: string
): Promise<
  Array<{
    id: string;
    date: string;
    name: string;
    description: string;
    is_conference: boolean;
    link: string;
  }>
> {
  return cache.wrap(`paprika:events:${id}`, 600, () =>
    fetchJSON(`https://api.coinpaprika.com/v1/coins/${id}/events`)
  );
}

// ═══════════════════════════════════════════════════════════════
// COINCAP (free, no key)
// ═══════════════════════════════════════════════════════════════

export function getCoinCapAssets(
  limit = 100
): Promise<{
  data: Array<{
    id: string;
    rank: string;
    symbol: string;
    name: string;
    priceUsd: string;
    marketCapUsd: string;
    volumeUsd24Hr: string;
    changePercent24Hr: string;
    supply: string;
    maxSupply: string | null;
  }>;
}> {
  return cache.wrap(`coincap:assets:${limit}`, 60, () =>
    fetchJSON(`https://api.coincap.io/v2/assets?limit=${limit}`)
  );
}

export function getCoinCapHistory(
  id: string,
  interval:
    | "m1"
    | "m5"
    | "m15"
    | "m30"
    | "h1"
    | "h2"
    | "h6"
    | "h12"
    | "d1" = "h1",
  start?: number,
  end?: number
): Promise<{
  data: Array<{ priceUsd: string; time: number }>;
}> {
  const p = new URLSearchParams({ interval });
  if (start) p.set("start", String(start));
  if (end) p.set("end", String(end));
  return cache.wrap(`coincap:history:${id}:${interval}`, 120, () =>
    fetchJSON(`https://api.coincap.io/v2/assets/${id}/history?${p}`)
  );
}

/** CoinCap exchange rates (fiat + crypto) */
export function getCoinCapRates(): Promise<{
  data: Array<{
    id: string;
    symbol: string;
    currencySymbol: string | null;
    rateUsd: string;
    type: string;
  }>;
}> {
  return cache.wrap("coincap:rates", 120, () =>
    fetchJSON("https://api.coincap.io/v2/rates")
  );
}

/** CoinCap markets (exchange data) */
export function getCoinCapMarkets(
  limit = 50
): Promise<{
  data: Array<{
    exchangeId: string;
    rank: string;
    baseSymbol: string;
    baseId: string;
    quoteSymbol: string;
    quoteId: string;
    priceQuote: string;
    priceUsd: string;
    volumeUsd24Hr: string;
    percentExchangeVolume: string;
  }>;
}> {
  return cache.wrap(`coincap:markets:${limit}`, 120, () =>
    fetchJSON(`https://api.coincap.io/v2/markets?limit=${limit}`)
  );
}

/** CoinCap exchanges */
export function getCoinCapExchanges(): Promise<{
  data: Array<{
    exchangeId: string;
    name: string;
    rank: string;
    percentTotalVolume: string;
    volumeUsd: string;
    tradingPairs: string;
    socket: boolean;
    exchangeUrl: string;
  }>;
}> {
  return cache.wrap("coincap:exchanges", 300, () =>
    fetchJSON("https://api.coincap.io/v2/exchanges")
  );
}

// ═══════════════════════════════════════════════════════════════
// COMPOSITE ANALYTICS
// ═══════════════════════════════════════════════════════════════

/**
 * Analyze a Fear & Greed history series to determine trend, average, and volatility.
 * Uses linear regression for trend detection and standard deviation for volatility.
 */
export function analyzeSentimentTrend(history: FearGreedEntry[]): {
  trend: "improving" | "declining" | "stable";
  avgValue: number;
  volatility: number;
  currentVsPrevWeek: number;
} {
  if (history.length === 0) {
    return { trend: "stable", avgValue: 0, volatility: 0, currentVsPrevWeek: 0 };
  }

  const values = history.map((e) => Number(e.value));
  const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;

  // Standard deviation as volatility measure
  const variance =
    values.reduce((sum, v) => sum + (v - avgValue) ** 2, 0) / values.length;
  const volatility = Math.sqrt(variance);

  // Week-over-week comparison (API returns most-recent first)
  const currentWeek = values.slice(0, Math.min(7, values.length));
  const prevWeek = values.slice(7, Math.min(14, values.length));

  const currentAvg =
    currentWeek.length > 0
      ? currentWeek.reduce((s, v) => s + v, 0) / currentWeek.length
      : avgValue;
  const prevAvg =
    prevWeek.length > 0
      ? prevWeek.reduce((s, v) => s + v, 0) / prevWeek.length
      : currentAvg;

  const currentVsPrevWeek =
    prevAvg !== 0
      ? Number(((currentAvg - prevAvg) / prevAvg * 100).toFixed(2))
      : 0;

  // Linear regression slope for trend detection
  let trend: "improving" | "declining" | "stable";
  if (values.length < 3) {
    trend = "stable";
  } else {
    // Reverse for chronological order (API is most-recent first)
    const chronological = [...values].reverse();
    const n = chronological.length;
    const xMean = (n - 1) / 2;
    const yMean = chronological.reduce((s, v) => s + v, 0) / n;

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (chronological[i] - yMean);
      denominator += (i - xMean) ** 2;
    }
    const slope = denominator !== 0 ? numerator / denominator : 0;

    if (slope > 0.5) {
      trend = "improving";
    } else if (slope < -0.5) {
      trend = "declining";
    } else {
      trend = "stable";
    }
  }

  return {
    trend,
    avgValue: Number(avgValue.toFixed(2)),
    volatility: Number(volatility.toFixed(2)),
    currentVsPrevWeek,
  };
}

/**
 * Analyze mempool congestion level and provide fee recommendations.
 * Classifies congestion by mempool vsize and estimates clear time.
 */
export function analyzeMempoolCongestion(
  stats: MempoolStats,
  fees: BitcoinFees
): {
  congestionLevel: "low" | "medium" | "high" | "extreme";
  estimatedClearTime: number;
  feeRecommendation: { priority: string; fee: number }[];
} {
  const vsizeMB = stats.vsize / 1_000_000;
  let congestionLevel: "low" | "medium" | "high" | "extreme";

  if (vsizeMB < 1) {
    congestionLevel = "low";
  } else if (vsizeMB < 5) {
    congestionLevel = "medium";
  } else if (vsizeMB < 20) {
    congestionLevel = "high";
  } else {
    congestionLevel = "extreme";
  }

  // ~1 MB cleared per block (~10 min block interval)
  const estimatedClearTime = Math.ceil(vsizeMB * 10);

  const feeRecommendation = [
    { priority: "immediate", fee: fees.fastestFee },
    { priority: "fast", fee: fees.halfHourFee },
    { priority: "standard", fee: fees.hourFee },
    { priority: "economy", fee: fees.economyFee },
    { priority: "minimum", fee: fees.minimumFee },
  ];

  return { congestionLevel, estimatedClearTime, feeRecommendation };
}

/**
 * Analyze token health across multiple DEX pairs.
 * Evaluates liquidity depth, volume, buy/sell pressure, and price consensus.
 */
export function analyzeDexTokenHealth(pairs: DexPair[]): {
  totalLiquidity: number;
  totalVolume24h: number;
  buyPressure: number;
  topDex: string;
  priceConsensus: number;
} {
  if (pairs.length === 0) {
    return {
      totalLiquidity: 0,
      totalVolume24h: 0,
      buyPressure: 0.5,
      topDex: "none",
      priceConsensus: 0,
    };
  }

  const totalLiquidity = pairs.reduce(
    (sum, p) => sum + (p.liquidity?.usd ?? 0),
    0
  );

  const totalVolume24h = pairs.reduce(
    (sum, p) => sum + (p.volume?.h24 ?? 0),
    0
  );

  // Buy pressure: total buys / (total buys + total sells)
  let totalBuys = 0;
  let totalSells = 0;
  for (const p of pairs) {
    totalBuys += p.txns?.h24?.buys ?? 0;
    totalSells += p.txns?.h24?.sells ?? 0;
  }
  const totalTxns = totalBuys + totalSells;
  const buyPressure = totalTxns > 0
    ? Number((totalBuys / totalTxns).toFixed(4))
    : 0.5;

  // Top DEX by volume
  const dexVolumes = new Map<string, number>();
  for (const p of pairs) {
    const vol = p.volume?.h24 ?? 0;
    dexVolumes.set(p.dexId, (dexVolumes.get(p.dexId) ?? 0) + vol);
  }

  let topDex = "unknown";
  let maxVol = 0;
  for (const [dex, vol] of dexVolumes) {
    if (vol > maxVol) {
      maxVol = vol;
      topDex = dex;
    }
  }

  // Price consensus: inverse coefficient of variation (0 = no agreement, 1 = perfect)
  const prices = pairs
    .map((p) => Number(p.priceUsd))
    .filter((px) => px > 0 && !Number.isNaN(px));

  let priceConsensus = 1;
  if (prices.length >= 2) {
    const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
    const stdDev = Math.sqrt(
      prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length
    );
    const cv = mean > 0 ? stdDev / mean : 0;
    priceConsensus = Number(Math.max(0, Math.min(1, 1 - cv * 10)).toFixed(4));
  }

  return { totalLiquidity, totalVolume24h, buyPressure, topDex, priceConsensus };
}
