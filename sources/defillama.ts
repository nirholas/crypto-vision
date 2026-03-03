/**
 * Crypto Vision — DeFiLlama Data Source
 *
 * 100% free, no API key, no rate limits.
 *
 * Provides: protocol TVL, chain TVL, yields/pools, stablecoins,
 *           bridges, DEX volumes, fees/revenue, raises (fundraising).
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const API = "https://api.llama.fi";
const YIELDS = "https://yields.llama.fi";
const STABLECOINS = "https://stablecoins.llama.fi";
const COINS = "https://coins.llama.fi";

// ─── Protocols & TVL ─────────────────────────────────────────

export interface Protocol {
  id: string;
  name: string;
  slug: string;
  symbol: string;
  tvl: number;
  chainTvls: Record<string, number>;
  change_1h: number | null;
  change_1d: number | null;
  change_7d: number | null;
  category: string;
  chains: string[];
  logo: string;
  url: string;
  description: string;
  mcap?: number;
}

/** All protocols — big payload, cache aggressively */
export function getProtocols(): Promise<Protocol[]> {
  return cache.wrap("llama:protocols", 300, () =>
    fetchJSON<Protocol[]>(`${API}/protocols`)
  );
}

/** Single protocol detail with historical TVL */
export function getProtocolDetail(slug: string): Promise<{
  id: string;
  name: string;
  symbol: string;
  tvl: Array<{ date: number; totalLiquidityUSD: number }>;
  currentChainTvls: Record<string, number>;
  chains: string[];
  category: string;
}> {
  return cache.wrap(`llama:protocol:${slug}`, 300, () =>
    fetchJSON(`${API}/protocol/${slug}`)
  );
}

// ─── Chain TVL ───────────────────────────────────────────────

export interface ChainTVL {
  gecko_id: string | null;
  tvl: number;
  tokenSymbol: string;
  cmcId: string | null;
  name: string;
  chainId: number | null;
}

export function getChainsTVL(): Promise<ChainTVL[]> {
  return cache.wrap("llama:chains", 300, () =>
    fetchJSON<ChainTVL[]>(`${API}/v2/chains`)
  );
}

export function getChainTVLHistory(chain: string): Promise<Array<{
  date: number;
  tvl: number;
}>> {
  return cache.wrap(`llama:chain-hist:${chain}`, 600, () =>
    fetchJSON(`${API}/v2/historicalChainTvl/${chain}`)
  );
}

// ─── Yields / Pools ──────────────────────────────────────────

export interface YieldPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apyBase: number | null;
  apyReward: number | null;
  apy: number;
  pool: string;
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
  poolMeta: string | null;
}

export function getYieldPools(): Promise<{ data: YieldPool[] }> {
  return cache.wrap("llama:yields", 300, () =>
    fetchJSON(`${YIELDS}/pools`)
  );
}

// ─── Stablecoins ─────────────────────────────────────────────

export function getStablecoins(): Promise<{
  peggedAssets: Array<{
    id: string;
    name: string;
    symbol: string;
    gecko_id: string;
    pegType: string;
    circulating: Record<string, { peggedUSD: number }>;
    chains: string[];
  }>;
}> {
  return cache.wrap("llama:stables", 600, () =>
    fetchJSON(`${STABLECOINS}/stablecoins?includePrices=true`)
  );
}

// ─── DEX Volumes ─────────────────────────────────────────────

export function getDexVolumes(): Promise<{
  totalDataChart: [number, number][];
  protocols: Array<{
    name: string;
    total24h: number;
    total7d: number;
    total30d: number;
    change_1d: number;
  }>;
}> {
  return cache.wrap("llama:dex-volumes", 300, () =>
    fetchJSON(`${API}/overview/dexs`)
  );
}

// ─── Fees & Revenue ──────────────────────────────────────────

export function getFeesRevenue(): Promise<{
  protocols: Array<{
    name: string;
    total24h: number;
    total7d: number;
    total30d: number;
    category: string;
  }>;
}> {
  return cache.wrap("llama:fees", 300, () =>
    fetchJSON(`${API}/overview/fees`)
  );
}

// ─── Bridges ─────────────────────────────────────────────────

export function getBridges(): Promise<{
  bridges: Array<{
    id: number;
    name: string;
    displayName: string;
    volumePrevDay: number;
    chains: string[];
  }>;
}> {
  return cache.wrap("llama:bridges", 600, () =>
    fetchJSON(`${API}/bridges`)
  );
}

// ─── Token Prices (multi-chain) ──────────────────────────────

export function getTokenPrices(
  coins: string[] // format: "chain:address" e.g. "ethereum:0x..."
): Promise<{ coins: Record<string, { price: number; symbol: string; timestamp: number }> }> {
  return cache.wrap(`llama:prices:${coins.join(",")}`, 60, () =>
    fetchJSON(`${COINS}/prices/current/${coins.join(",")}`)
  );
}

// ─── Raises (Fundraising) ────────────────────────────────────

export function getRaises(): Promise<{
  raises: Array<{
    name: string;
    amount: number;
    round: string;
    date: number;
    category: string;
    leadInvestors: string[];
  }>;
}> {
  return cache.wrap("llama:raises", 1800, () =>
    fetchJSON(`${API}/raises`)
  );
}
