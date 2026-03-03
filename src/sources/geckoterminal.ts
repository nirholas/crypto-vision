/**
 * Crypto Vision — GeckoTerminal Data Source
 *
 * 100% free, no API key required. ~30 req/min.
 *
 * Provides: DEX pool analytics, trending pools, OHLCV candles,
 *           new pools, token info across 100+ networks.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { ingestDexPairs } from "../lib/bq-ingest.js";

const API = "https://api.geckoterminal.com/api/v2";

function gt<T>(path: string, ttl: number): Promise<T> {
  return cache.wrap(`gt:${path}`, ttl, () =>
    fetchJSON<T>(`${API}${path}`, {
      headers: { Accept: "application/json;version=20230302" },
    }),
  );
}

// ─── Networks ────────────────────────────────────────────────

export function getNetworks(): Promise<{
  data: Array<{
    id: string;
    type: string;
    attributes: { name: string; coingecko_asset_platform_id: string };
  }>;
}> {
  return gt("/networks?page=1", 3600);
}

// ─── Trending Pools ──────────────────────────────────────────

export interface PoolAttributes {
  name: string;
  address: string;
  base_token_price_usd: string;
  quote_token_price_usd: string;
  fdv_usd: string;
  market_cap_usd: string | null;
  price_change_percentage: { h1: string; h24: string };
  transactions: { h1: { buys: number; sells: number }; h24: { buys: number; sells: number } };
  volume_usd: { h1: string; h24: string };
  reserve_in_usd: string;
}

export async function getTrendingPools(network?: string): Promise<{
  data: Array<{
    id: string;
    type: string;
    attributes: PoolAttributes;
    relationships: { base_token: { data: { id: string } }; quote_token: { data: { id: string } } };
  }>;
}> {
  const path = network
    ? `/networks/${network}/trending_pools`
    : "/networks/trending_pools";
  const data = await gt<{
    data: Array<{
      id: string;
      type: string;
      attributes: PoolAttributes;
      relationships: { base_token: { data: { id: string } }; quote_token: { data: { id: string } } };
    }>;
  }>(path, 60);
  if (data.data?.length) {
    ingestDexPairs(
      data.data.map(p => ({
        pairAddress: p.attributes.address,
        chainId: network ?? p.id.split("_")[0],
        priceUsd: p.attributes.base_token_price_usd,
        volume: { h24: Number(p.attributes.volume_usd?.h24 ?? 0) },
        liquidity: { usd: Number(p.attributes.reserve_in_usd ?? 0) },
      })),
      "geckoterminal",
    );
  }
  return data;
}

// ─── New Pools ───────────────────────────────────────────────

export function getNewPools(network?: string): Promise<{
  data: Array<{
    id: string;
    attributes: PoolAttributes & { pool_created_at: string };
  }>;
}> {
  const path = network
    ? `/networks/${network}/new_pools`
    : "/networks/new_pools";
  return gt(path, 60);
}

// ─── Token Info ──────────────────────────────────────────────

export function getTokenInfo(
  network: string,
  address: string,
): Promise<{
  data: {
    id: string;
    attributes: {
      name: string;
      symbol: string;
      address: string;
      decimals: number;
      coingecko_coin_id: string | null;
      price_usd: string;
      fdv_usd: string;
      total_supply: string;
      volume_usd: { h24: string };
      market_cap_usd: string | null;
    };
  };
}> {
  return gt(`/networks/${network}/tokens/${address}`, 60);
}

// ─── Token Pools ─────────────────────────────────────────────

export function getTokenPools(
  network: string,
  address: string,
): Promise<{
  data: Array<{
    id: string;
    attributes: PoolAttributes;
  }>;
}> {
  return gt(`/networks/${network}/tokens/${address}/pools?page=1`, 60);
}

// ─── Pool OHLCV ──────────────────────────────────────────────

export function getPoolOHLCV(
  network: string,
  poolAddress: string,
  timeframe: "day" | "hour" | "minute" = "day",
  aggregate = 1,
  limit = 100,
): Promise<{
  data: {
    id: string;
    attributes: {
      ohlcv_list: [number, number, number, number, number, number][]; // [ts, o, h, l, c, vol]
    };
  };
}> {
  return gt(
    `/networks/${network}/pools/${poolAddress}/ohlcv/${timeframe}?aggregate=${aggregate}&limit=${limit}`,
    120,
  );
}

// ─── Search ──────────────────────────────────────────────────

export function searchPools(query: string): Promise<{
  data: Array<{
    id: string;
    attributes: {
      name: string;
      address: string;
      fdv_usd: string;
      reserve_in_usd: string;
      price_change_percentage: { h24: string };
      volume_usd: { h24: string };
    };
  }>;
}> {
  return gt(`/search/pools?query=${encodeURIComponent(query)}&page=1`, 30);
}

// ─── Top Pools by Network ────────────────────────────────────

export async function getTopPools(network: string): Promise<{
  data: Array<{
    id: string;
    attributes: PoolAttributes;
  }>;
}> {
  const data = await gt<{
    data: Array<{ id: string; attributes: PoolAttributes }>;
  }>(`/networks/${network}/pools?page=1&sort=h24_volume_usd_liquidity_desc`, 120);
  if (data.data?.length) {
    ingestDexPairs(
      data.data.map(p => ({
        pairAddress: p.attributes.address,
        chainId: network,
        priceUsd: p.attributes.base_token_price_usd,
        volume: { h24: Number(p.attributes.volume_usd?.h24 ?? 0) },
        liquidity: { usd: Number(p.attributes.reserve_in_usd ?? 0) },
      })),
      "geckoterminal",
    );
  }
  return data;
}
