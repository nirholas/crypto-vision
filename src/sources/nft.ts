/**
 * Crypto Vision — NFT Data Source
 *
 * Multi-provider NFT data aggregation:
 *  - Reservoir (top collections, activity, bids, asks, floor prices)
 *  - DeFi Llama (NFT marketplace volumes, collection charts)
 *  - CoinGecko (NFT list, trending, detail)
 *
 * All endpoints are free-tier / no API key required.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

// ─── Reservoir (reservoir.tools) ─────────────────────────────

const RESERVOIR_BASE = "https://api.reservoir.tools";

function reservoirHeaders(): Record<string, string> {
  const key = process.env.RESERVOIR_API_KEY;
  return key
    ? { "x-api-key": key, Accept: "application/json" }
    : { Accept: "application/json" };
}

export interface NFTCollection {
  id: string;
  slug: string;
  name: string;
  image: string;
  banner: string;
  description: string;
  tokenCount: string;
  ownerCount: string;
  floorAsk: {
    price: { amount: { native: number; usd: number }; currency: { symbol: string } } | null;
  };
  volume: Record<string, number>;
  volumeChange: Record<string, number>;
  rank: Record<string, number>;
}

/**
 * Top NFT collections by volume (Reservoir).
 */
export function getTopCollections(
  chain = "ethereum",
  sortBy = "1DayVolume",
  limit = 50,
): Promise<{ collections: NFTCollection[] }> {
  return cache.wrap(`nft:top:${chain}:${sortBy}:${limit}`, 120, () =>
    fetchJSON(`${RESERVOIR_BASE}/collections/v7?chain=${chain}&sortBy=${sortBy}&limit=${limit}`, {
      headers: reservoirHeaders(),
    }),
  );
}

/**
 * Single collection detail (Reservoir).
 */
export function getCollection(
  collectionId: string,
  chain = "ethereum",
): Promise<{ collections: NFTCollection[] }> {
  return cache.wrap(`nft:collection:${chain}:${collectionId}`, 120, () =>
    fetchJSON(`${RESERVOIR_BASE}/collections/v7?id=${collectionId}&chain=${chain}`, {
      headers: reservoirHeaders(),
    }),
  );
}

export interface NFTActivity {
  type: string;
  fromAddress: string;
  toAddress: string;
  price: { amount: { native: number; usd: number } } | null;
  timestamp: number;
  token: { tokenId: string; tokenName: string; tokenImage: string } | null;
}

/**
 * Collection activity feed (Reservoir).
 */
export function getCollectionActivity(
  collectionId: string,
  chain = "ethereum",
  limit = 50,
  types = "sale,transfer,mint",
): Promise<{ activities: NFTActivity[] }> {
  return cache.wrap(`nft:activity:${chain}:${collectionId}:${limit}`, 60, () =>
    fetchJSON(
      `${RESERVOIR_BASE}/collections/activity/v6?collection=${collectionId}&chain=${chain}&limit=${limit}&types=${types}`,
      { headers: reservoirHeaders() },
    ),
  );
}

/**
 * Collection daily/hourly stats (Reservoir).
 */
export function getCollectionStats(
  collectionId: string,
  chain = "ethereum",
): Promise<any> {
  return cache.wrap(`nft:stats:${chain}:${collectionId}`, 120, () =>
    fetchJSON(`${RESERVOIR_BASE}/collections/v7?id=${collectionId}&chain=${chain}&includeMintStages=true&includeSecurityConfigs=true`, {
      headers: reservoirHeaders(),
    }),
  );
}

/**
 * Trending collections — most traded in the last period (Reservoir).
 */
export function getTrendingCollections(
  chain = "ethereum",
  period = "1d",
  limit = 50,
): Promise<{ collections: any[] }> {
  return cache.wrap(`nft:trending:${chain}:${period}:${limit}`, 120, () =>
    fetchJSON(`${RESERVOIR_BASE}/collections/trending/v1?chain=${chain}&period=${period}&limit=${limit}`, {
      headers: reservoirHeaders(),
    }),
  );
}

/**
 * Search NFT collections (Reservoir).
 */
export function searchCollections(
  query: string,
  chain = "ethereum",
  limit = 20,
): Promise<{ collections: any[] }> {
  return cache.wrap(`nft:search:${chain}:${query}:${limit}`, 120, () =>
    fetchJSON(`${RESERVOIR_BASE}/search/collections/v2?name=${encodeURIComponent(query)}&chain=${chain}&limit=${limit}`, {
      headers: reservoirHeaders(),
    }),
  );
}

/**
 * Top token bids for a collection (Reservoir).
 */
export function getCollectionBids(
  collectionId: string,
  chain = "ethereum",
  limit = 20,
): Promise<{ orders: any[] }> {
  return cache.wrap(`nft:bids:${chain}:${collectionId}:${limit}`, 60, () =>
    fetchJSON(`${RESERVOIR_BASE}/orders/bids/v6?collection=${collectionId}&chain=${chain}&limit=${limit}&sortBy=price`, {
      headers: reservoirHeaders(),
    }),
  );
}

/**
 * Top asks (listings) for a collection (Reservoir).
 */
export function getCollectionListings(
  collectionId: string,
  chain = "ethereum",
  limit = 20,
): Promise<{ orders: any[] }> {
  return cache.wrap(`nft:listings:${chain}:${collectionId}:${limit}`, 60, () =>
    fetchJSON(`${RESERVOIR_BASE}/orders/asks/v5?collection=${collectionId}&chain=${chain}&limit=${limit}&sortBy=price`, {
      headers: reservoirHeaders(),
    }),
  );
}

/**
 * User NFT portfolio (Reservoir).
 */
export function getUserNFTs(
  userAddress: string,
  chain = "ethereum",
  limit = 50,
): Promise<{ tokens: any[] }> {
  return cache.wrap(`nft:user:${chain}:${userAddress}:${limit}`, 120, () =>
    fetchJSON(`${RESERVOIR_BASE}/users/${userAddress}/tokens/v10?chain=${chain}&limit=${limit}`, {
      headers: reservoirHeaders(),
    }),
  );
}

// ─── DeFi Llama NFT ──────────────────────────────────────────

const LLAMA_NFT_BASE = "https://api.llama.fi";

/**
 * NFT marketplace overview from DeFi Llama.
 */
export function getNFTMarketplaces(): Promise<any> {
  return cache.wrap("nft:marketplaces", 300, () =>
    fetchJSON(`${LLAMA_NFT_BASE}/overview/nfts`),
  );
}

/**
 * NFT collection chart (DeFi Llama protocol endpoint).
 */
export function getNFTCollectionChart(slug: string): Promise<any> {
  return cache.wrap(`nft:chart:${slug}`, 600, () =>
    fetchJSON(`${LLAMA_NFT_BASE}/protocol/${slug}`),
  );
}

/**
 * NFT chains breakdown from DeFi Llama.
 */
export function getNFTChains(): Promise<any> {
  return cache.wrap("nft:chains", 300, () =>
    fetchJSON(`${LLAMA_NFT_BASE}/overview/nfts?dataType=dailyVolume`),
  );
}

// ─── CoinGecko NFT ──────────────────────────────────────────

const CG_BASE = "https://api.coingecko.com/api/v3";

function cgHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { "x-cg-demo-api-key": key } : {};
}

/**
 * CoinGecko NFT list.
 */
export function getNFTList(perPage = 100, page = 1): Promise<any[]> {
  return cache.wrap(`nft:cg:list:${perPage}:${page}`, 600, () =>
    fetchJSON(`${CG_BASE}/nfts/list?per_page=${perPage}&page=${page}`, {
      headers: cgHeaders(),
    }),
  );
}

/**
 * CoinGecko NFT detail by ID.
 */
export function getNFTDetail(id: string): Promise<any> {
  return cache.wrap(`nft:cg:detail:${id}`, 300, () =>
    fetchJSON(`${CG_BASE}/nfts/${id}`, {
      headers: cgHeaders(),
    }),
  );
}

/**
 * CoinGecko NFT market chart.
 */
export function getNFTMarketChart(id: string, days = 30): Promise<any> {
  return cache.wrap(`nft:cg:chart:${id}:${days}`, 600, () =>
    fetchJSON(`${CG_BASE}/nfts/${id}/market_chart?days=${days}`, {
      headers: cgHeaders(),
    }),
  );
}

/**
 * CoinGecko trending NFTs.
 */
export function getTrendingNFTs(): Promise<any> {
  return cache.wrap("nft:cg:trending", 300, async () => {
    const data = await fetchJSON<any>(`${CG_BASE}/search/trending`, {
      headers: cgHeaders(),
    });
    return data.nfts || [];
  });
}
