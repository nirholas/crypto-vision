/**
 * Crypto Vision — Jupiter / Solana Data Source
 *
 * 100% free, no API key.
 * https://price.jup.ag, https://quote-api.jup.ag, https://token.jup.ag
 * https://api.mainnet-beta.solana.com (Solana JSON-RPC)
 *
 * Provides: Solana token prices, swap quotes, token list,
 *           trending tokens, top tokens by volume, validator stats,
 *           network TPS, SOL supply, staking metrics, NFT collections.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { logger } from "../lib/logger.js";

const PRICE_API = "https://price.jup.ag/v6";
const QUOTE_API = "https://quote-api.jup.ag/v6";
const TOKEN_API = "https://token.jup.ag";
const SOLANA_RPC = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

// ─── Solana JSON-RPC Helper ──────────────────────────────────

interface SolanaRpcResponse<T> {
  jsonrpc: string;
  id: number;
  result: T;
  error?: { code: number; message: string };
}

async function solanaRpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(SOLANA_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });

  if (!res.ok) {
    throw new Error(`Solana RPC error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as SolanaRpcResponse<T>;
  if (data.error) {
    throw new Error(`Solana RPC error: ${data.error.message}`);
  }
  return data.result;
}

// ─── Prices ──────────────────────────────────────────────────

export interface JupiterPrice {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
  timeTaken: number;
}

export function getPrice(ids: string): Promise<{ data: Record<string, JupiterPrice> }> {
  return cache.wrap(`jup:price:${ids}`, 15, () =>
    fetchJSON(`${PRICE_API}/price?ids=${ids}`)
  );
}

export function getPriceVs(
  ids: string,
  vsToken = "USDC",
): Promise<{ data: Record<string, JupiterPrice> }> {
  return cache.wrap(`jup:price:${ids}:${vsToken}`, 15, () =>
    fetchJSON(`${PRICE_API}/price?ids=${ids}&vsToken=${vsToken}`)
  );
}

// ─── Batch Token Prices ──────────────────────────────────────

export interface TokenPriceInfo {
  price: number;
  volume24h: number | null;
}

/**
 * Fetch prices for multiple token mints in a single call.
 * Uses Jupiter Price API with comma-separated IDs.
 */
export async function getTokenPrices(mints: string[]): Promise<Record<string, TokenPriceInfo>> {
  if (mints.length === 0) return {};

  // Jupiter Price API supports comma-separated IDs
  const ids = mints.join(",");
  const cacheKey = `jup:prices:batch:${mints.slice(0, 5).join(",")}:${mints.length}`;

  return cache.wrap(cacheKey, 30, async () => {
    const res = await getPrice(ids);
    const result: Record<string, TokenPriceInfo> = {};

    for (const [mint, priceData] of Object.entries(res.data)) {
      result[mint] = {
        price: priceData.price,
        volume24h: null, // Jupiter v6 price API doesn't include volume
      };
    }

    return result;
  });
}

// ─── Swap Quote ──────────────────────────────────────────────

export interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  priceImpactPct: string;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
}

export function getQuote(
  inputMint: string,
  outputMint: string,
  amount: string,
  slippageBps = 50,
  dexes?: string[],
): Promise<JupiterQuote> {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount,
    slippageBps: String(slippageBps),
  });
  if (dexes?.length) {
    params.set("dexes", dexes.join(","));
  }
  return cache.wrap(`jup:quote:${inputMint}:${outputMint}:${amount}:${slippageBps}`, 10, () =>
    fetchJSON(
      `${QUOTE_API}/quote?${params.toString()}`,
    )
  );
}

// ─── Token List ──────────────────────────────────────────────

export interface JupiterToken {
  address: string;
  chainId: number;
  decimals: number;
  name: string;
  symbol: string;
  logoURI: string;
  tags: string[];
  extensions?: Record<string, string>;
}

export function getTokenList(): Promise<JupiterToken[]> {
  return cache.wrap("jup:tokens", 3600, () =>
    fetchJSON(`${TOKEN_API}/all`)
  );
}

export function getStrictTokenList(): Promise<JupiterToken[]> {
  return cache.wrap("jup:tokens:strict", 3600, () =>
    fetchJSON(`${TOKEN_API}/strict`)
  );
}

// ─── Popular Solana Token Mints ──────────────────────────────

export const POPULAR_MINTS = {
  SOL: "So11111111111111111111111111111111111111112",
  USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  RAY: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  WIF: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  PYTH: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3",
  ORCA: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE",
  MSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
} as const;

export async function getPopularPrices(): Promise<Record<string, JupiterPrice>> {
  const mints = Object.values(POPULAR_MINTS).join(",");
  const res = await getPrice(mints);
  return res.data;
}

// ─── Market helpers ──────────────────────────────────────────

export async function getTopTokensByMarketCap(limit = 50): Promise<JupiterToken[]> {
  const tokens = await getStrictTokenList();
  // The strict list is already curated; return top N
  return tokens.slice(0, limit);
}

export async function searchTokens(query: string, limit = 20): Promise<JupiterToken[]> {
  const tokens = await getStrictTokenList();
  const q = query.toLowerCase();
  return tokens
    .filter((t) =>
      t.symbol.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      t.address === query
    )
    .slice(0, limit);
}

// ─── Solana Network Stats (RPC) ──────────────────────────────

export interface SolanaPerformanceSample {
  slot: number;
  numTransactions: number;
  numSlots: number;
  samplePeriodSecs: number;
  numNonVoteTransactions: number;
}

/**
 * Get recent TPS by averaging recent performance samples.
 * Uses getRecentPerformanceSamples RPC method.
 */
export async function getRecentTps(): Promise<{
  tps: number;
  nonVoteTps: number;
  sampleCount: number;
  avgSlotTime: number;
}> {
  return cache.wrap("sol:tps", 30, async () => {
    const samples = await solanaRpc<SolanaPerformanceSample[]>(
      "getRecentPerformanceSamples",
      [10],
    );

    if (!samples.length) {
      return { tps: 0, nonVoteTps: 0, sampleCount: 0, avgSlotTime: 0 };
    }

    const totalTx = samples.reduce((sum, s) => sum + s.numTransactions, 0);
    const totalNonVoteTx = samples.reduce(
      (sum, s) => sum + (s.numNonVoteTransactions ?? 0),
      0,
    );
    const totalSecs = samples.reduce((sum, s) => sum + s.samplePeriodSecs, 0);
    const totalSlots = samples.reduce((sum, s) => sum + s.numSlots, 0);

    return {
      tps: Math.round(totalTx / totalSecs),
      nonVoteTps: Math.round(totalNonVoteTx / totalSecs),
      sampleCount: samples.length,
      avgSlotTime: totalSlots > 0 ? totalSecs / totalSlots : 0,
    };
  });
}

// ─── SOL Supply ──────────────────────────────────────────────

export interface SolSupply {
  total: number;
  circulating: number;
  nonCirculating: number;
  nonCirculatingAccounts: string[];
}

/**
 * Get SOL supply breakdown (total, circulating, non-circulating).
 * Amounts are in lamports, divided by 1e9 for SOL.
 */
export async function getSolSupply(): Promise<{
  totalSol: number;
  circulatingSol: number;
  nonCirculatingSol: number;
}> {
  return cache.wrap("sol:supply", 120, async () => {
    const result = await solanaRpc<{ value: SolSupply }>("getSupply");
    const v = result.value;
    return {
      totalSol: v.total / 1e9,
      circulatingSol: v.circulating / 1e9,
      nonCirculatingSol: v.nonCirculating / 1e9,
    };
  });
}

// ─── Validators ──────────────────────────────────────────────

export interface SolanaVoteAccount {
  votePubkey: string;
  nodePubkey: string;
  activatedStake: number;
  commission: number;
  epochCredits: Array<[number, number, number]>;
  epochVoteAccount: boolean;
  lastVote: number;
  rootSlot: number;
}

export interface ValidatorInfo {
  votePubkey: string;
  nodePubkey: string;
  activatedStake: number;
  activatedStakeSol: number;
  commission: number;
  lastVote: number;
  epochCredits: number;
  delinquent: boolean;
}

/**
 * Get all vote accounts (active + delinquent) from Solana RPC.
 * Returns sorted by activated stake descending.
 */
export async function getValidators(): Promise<ValidatorInfo[]> {
  return cache.wrap("sol:validators", 300, async () => {
    const result = await solanaRpc<{
      current: SolanaVoteAccount[];
      delinquent: SolanaVoteAccount[];
    }>("getVoteAccounts");

    const mapValidator = (v: SolanaVoteAccount, delinquent: boolean): ValidatorInfo => ({
      votePubkey: v.votePubkey,
      nodePubkey: v.nodePubkey,
      activatedStake: v.activatedStake,
      activatedStakeSol: v.activatedStake / 1e9,
      commission: v.commission,
      lastVote: v.lastVote,
      epochCredits: v.epochCredits.length > 0
        ? v.epochCredits[v.epochCredits.length - 1][1]
        : 0,
      delinquent,
    });

    const current = result.current.map((v) => mapValidator(v, false));
    const delinquent = result.delinquent.map((v) => mapValidator(v, true));

    return [...current, ...delinquent].sort(
      (a, b) => b.activatedStake - a.activatedStake,
    );
  });
}

// ─── Staking Stats ───────────────────────────────────────────

export interface StakingStats {
  totalValidators: number;
  activeValidators: number;
  delinquentValidators: number;
  totalStakedSol: number;
  averageCommission: number;
  medianCommission: number;
  stakingApy: number;
}

/**
 * Compute Solana staking statistics from validator data + supply info.
 */
export async function getStakingStats(): Promise<StakingStats> {
  return cache.wrap("sol:staking-stats", 300, async () => {
    const [validators, supply] = await Promise.all([
      getValidators(),
      getSolSupply(),
    ]);

    const active = validators.filter((v) => !v.delinquent);
    const delinquent = validators.filter((v) => v.delinquent);
    const totalStakedLamports = validators.reduce(
      (sum, v) => sum + v.activatedStake,
      0,
    );
    const totalStakedSol = totalStakedLamports / 1e9;

    const commissions = active.map((v) => v.commission).sort((a, b) => a - b);
    const avgCommission =
      commissions.length > 0
        ? commissions.reduce((s, c) => s + c, 0) / commissions.length
        : 0;
    const medianCommission =
      commissions.length > 0
        ? commissions[Math.floor(commissions.length / 2)]
        : 0;

    // Estimate APY based on inflation curve
    // Solana's current inflation is ~5.5%, decaying 15%/year, min 1.5%
    const stakeRatio = totalStakedSol / supply.totalSol;
    const currentInflation = 0.055; // approximate
    const stakingApy = stakeRatio > 0
      ? (currentInflation / stakeRatio) * (1 - avgCommission / 100)
      : 0;

    return {
      totalValidators: validators.length,
      activeValidators: active.length,
      delinquentValidators: delinquent.length,
      totalStakedSol,
      averageCommission: Math.round(avgCommission * 100) / 100,
      medianCommission,
      stakingApy: Math.round(stakingApy * 10000) / 10000,
    };
  });
}

// ─── Epoch Info ──────────────────────────────────────────────

export interface EpochInfo {
  epoch: number;
  slotIndex: number;
  slotsInEpoch: number;
  absoluteSlot: number;
  blockHeight: number;
  transactionCount: number;
}

export function getEpochInfo(): Promise<EpochInfo> {
  return cache.wrap("sol:epoch", 30, () =>
    solanaRpc<EpochInfo>("getEpochInfo"),
  );
}

// ─── Cluster Nodes ───────────────────────────────────────────

export interface ClusterNode {
  pubkey: string;
  gossip: string | null;
  tpu: string | null;
  rpc: string | null;
  version: string | null;
  featureSet: number | null;
  shredVersion: number;
}

export function getClusterNodes(): Promise<ClusterNode[]> {
  return cache.wrap("sol:cluster-nodes", 300, () =>
    solanaRpc<ClusterNode[]>("getClusterNodes"),
  );
}

// ─── Token Detail by Mint ────────────────────────────────────

/**
 * Get token detail from Jupiter's token list by mint address.
 */
export async function getTokenByMint(mint: string): Promise<JupiterToken | null> {
  const tokens = await getStrictTokenList();
  const found = tokens.find((t) => t.address === mint);
  if (found) return found;

  // Fallback: search in full (unverified) list
  const allTokens = await getTokenList();
  return allTokens.find((t) => t.address === mint) ?? null;
}

// ─── New Tokens ──────────────────────────────────────────────

/**
 * Get recently added tokens by filtering the all-tokens list against the strict list.
 * Tokens in the full list but not in the strict list are likely newer / unverified.
 */
export async function getNewTokens(limit = 50): Promise<JupiterToken[]> {
  return cache.wrap(`jup:new-tokens:${limit}`, 600, async () => {
    const [all, strict] = await Promise.all([
      getTokenList(),
      getStrictTokenList(),
    ]);

    const strictAddresses = new Set(strict.map((t) => t.address));
    const newTokens = all.filter((t) => !strictAddresses.has(t.address));

    // Return the last N (most recently added are typically at the end)
    return newTokens.slice(-limit).reverse();
  });
}

// ─── Memecoins ───────────────────────────────────────────────

/**
 * Get tokens tagged as memecoins from Jupiter's token list.
 */
export async function getMemecoins(): Promise<JupiterToken[]> {
  return cache.wrap("jup:memecoins", 600, async () => {
    const tokens = await getTokenList();
    return tokens.filter(
      (t) =>
        t.tags?.includes("meme") ||
        t.tags?.includes("pump") ||
        t.tags?.includes("community"),
    );
  });
}

// ─── Solana Programs (top by slot) ───────────────────────────

export interface ProgramAccount {
  pubkey: string;
  lamports: number;
  lamportsSol: number;
  executable: boolean;
}

/**
 * Get top programs by querying the largest accounts on the network.
 * Uses getLargestAccounts RPC method filtered to executable programs.
 */
export async function getTopPrograms(limit = 20): Promise<ProgramAccount[]> {
  return cache.wrap(`sol:top-programs:${limit}`, 600, async () => {
    const result = await solanaRpc<{
      value: Array<{ address: string; lamports: number }>;
    }>("getLargestAccounts", [{ filter: "circulating" }]);

    // getLargestAccounts returns the accounts with the most SOL
    // We return them as-is since filtering to executable-only would require
    // individual getAccountInfo calls which is expensive
    return result.value.slice(0, limit).map((a) => ({
      pubkey: a.address,
      lamports: a.lamports,
      lamportsSol: a.lamports / 1e9,
      executable: false, // would need individual lookup
    }));
  });
}

// ─── DEX Pools (Solana via GeckoTerminal) ────────────────────

/**
 * GeckoTerminal pool data specifically for the Solana network.
 * Uses the same API as geckoterminal.ts but scoped to Solana.
 */
export interface SolanaPool {
  id: string;
  name: string;
  address: string;
  baseTokenPriceUsd: string;
  quoteTokenPriceUsd: string;
  fdvUsd: string;
  marketCapUsd: string | null;
  priceChangeH1: string;
  priceChangeH24: string;
  volumeH24: string;
  reserveUsd: string;
  txnsH24Buys: number;
  txnsH24Sells: number;
}

const GECKO_TERMINAL_API = "https://api.geckoterminal.com/api/v2";

export async function getSolanaDexPools(page = 1): Promise<SolanaPool[]> {
  return cache.wrap(`sol:dex-pools:${page}`, 60, async () => {
    const res = await fetchJSON<{
      data: Array<{
        id: string;
        attributes: {
          name: string;
          address: string;
          base_token_price_usd: string;
          quote_token_price_usd: string;
          fdv_usd: string;
          market_cap_usd: string | null;
          price_change_percentage: { h1: string; h24: string };
          volume_usd: { h24: string };
          reserve_in_usd: string;
          transactions: { h24: { buys: number; sells: number } };
        };
      }>;
    }>(`${GECKO_TERMINAL_API}/networks/solana/trending_pools?page=${page}`, {
      headers: { Accept: "application/json;version=20230302" },
    });

    return res.data.map((p) => ({
      id: p.id,
      name: p.attributes.name,
      address: p.attributes.address,
      baseTokenPriceUsd: p.attributes.base_token_price_usd,
      quoteTokenPriceUsd: p.attributes.quote_token_price_usd,
      fdvUsd: p.attributes.fdv_usd,
      marketCapUsd: p.attributes.market_cap_usd,
      priceChangeH1: p.attributes.price_change_percentage.h1,
      priceChangeH24: p.attributes.price_change_percentage.h24,
      volumeH24: p.attributes.volume_usd.h24,
      reserveUsd: p.attributes.reserve_in_usd,
      txnsH24Buys: p.attributes.transactions.h24.buys,
      txnsH24Sells: p.attributes.transactions.h24.sells,
    }));
  });
}

// ─── Solana DEX Volume ───────────────────────────────────────

export async function getSolanaDexVolume(): Promise<{
  totalVolumeH24: number;
  poolCount: number;
  topPools: SolanaPool[];
}> {
  return cache.wrap("sol:dex-volume", 120, async () => {
    const pools = await getSolanaDexPools();
    const totalVolumeH24 = pools.reduce(
      (sum, p) => sum + (parseFloat(p.volumeH24) || 0),
      0,
    );

    return {
      totalVolumeH24: Math.round(totalVolumeH24),
      poolCount: pools.length,
      topPools: pools.slice(0, 10),
    };
  });
}

// ─── NFT Collections (Solana via CoinGecko) ──────────────────

export interface SolanaNftCollection {
  id: string;
  name: string;
  symbol: string;
  floorPriceUsd: number | null;
  floorPriceSol: number | null;
  volume24hUsd: number | null;
  marketCapUsd: number | null;
  holders: number | null;
}

/**
 * Fetch Solana NFT collections from CoinGecko's NFT endpoint
 * filtered to the Solana platform.
 */
export async function getSolanaNftCollections(limit = 20): Promise<SolanaNftCollection[]> {
  return cache.wrap(`sol:nft-collections:${limit}`, 600, async () => {
    try {
      const res = await fetchJSON<Array<{
        id: string;
        name: string;
        symbol: string;
        floor_price: { usd: number | null; native_currency: number | null };
        volume_24h: { usd: number | null };
        market_cap: { usd: number | null };
        number_of_unique_addresses: number | null;
        asset_platform_id: string;
      }>>("https://api.coingecko.com/api/v3/nfts/list?per_page=100&order=volume_usd_24h_desc");

      // Note: CoinGecko free tier may not return all fields; handle gracefully
      const solanaCollections = res
        .filter((c) => c.asset_platform_id === "solana")
        .slice(0, limit)
        .map((c) => ({
          id: c.id,
          name: c.name,
          symbol: c.symbol,
          floorPriceUsd: c.floor_price?.usd ?? null,
          floorPriceSol: c.floor_price?.native_currency ?? null,
          volume24hUsd: c.volume_24h?.usd ?? null,
          marketCapUsd: c.market_cap?.usd ?? null,
          holders: c.number_of_unique_addresses ?? null,
        }));

      return solanaCollections;
    } catch (err) {
      logger.warn({ err }, "Failed to fetch Solana NFT collections");
      return [];
    }
  });
}
