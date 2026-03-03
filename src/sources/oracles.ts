/**
 * Crypto Vision — Chainlink / On-Chain Oracle Data Source
 *
 * Free public APIs for Chainlink price feeds and on-chain data.
 * Uses data.chain.link's API and public oracle price aggregators.
 *
 * Provides: price feeds, feed metadata.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

const CHAINLINK_API = "https://cl-docs-addresses.web.app/addresses.json";
const PRICE_API = "https://reference-data-directory.vercel.app/feeds-mainnet.json";

export interface ChainlinkFeed {
  name: string;
  path: string;
  contractAddress: string;
  proxyAddress: string;
  decimals: number;
  ens?: string;
  pair: [string, string];
}

export function getMainnetFeeds(): Promise<ChainlinkFeed[]> {
  return cache.wrap("chainlink:mainnet-feeds", 86_400, () =>
    fetchJSON<ChainlinkFeed[]>(PRICE_API)
  );
}

export function getAllNetworkFeeds(): Promise<Record<string, unknown>> {
  return cache.wrap("chainlink:all-feeds", 86_400, () =>
    fetchJSON<Record<string, unknown>>(CHAINLINK_API)
  );
}

const DIA_API = "https://api.diadata.org/v1";

export interface DiaQuotation {
  Symbol: string;
  Name: string;
  Price: number;
  PriceYesterday: number;
  VolumeYesterdayUSD: number;
  Source: string;
  Time: string;
  ITIN: string;
}

export function getDiaQuotation(symbol: string): Promise<DiaQuotation> {
  return cache.wrap(`dia:${symbol}`, 60, () =>
    fetchJSON<DiaQuotation>(`${DIA_API}/quotation/${encodeURIComponent(symbol)}`)
  );
}

export function getDiaAssetList(): Promise<{ Coins: Array<{ Symbol: string; Name: string }> }> {
  return cache.wrap("dia:coins", 3_600, () =>
    fetchJSON(`${DIA_API}/coins`)
  );
}

export function getDiaSupply(symbol: string): Promise<{ Symbol: string; CirculatingSupply: number }> {
  return cache.wrap(`dia:supply:${symbol}`, 300, () =>
    fetchJSON(`${DIA_API}/supply/${encodeURIComponent(symbol)}`)
  );
}

const PYTH_API = "https://hermes.pyth.network/v2";

export interface PythPriceFeed {
  id: string;
  price: { price: string; conf: string; expo: number; publish_time: number };
  ema_price: { price: string; conf: string; expo: number; publish_time: number };
}

export function getPythPriceFeeds(ids: string[]): Promise<PythPriceFeed[]> {
  const query = ids.map((id) => `ids[]=${id}`).join("&");
  return cache.wrap(`pyth:${ids.join(",")}`, 10, () =>
    fetchJSON<PythPriceFeed[]>(`${PYTH_API}/updates/price/latest?${query}`)
  );
}

export function getPythPriceFeedIds(): Promise<string[]> {
  return cache.wrap("pyth:feed-ids", 3_600, () =>
    fetchJSON<string[]>("https://hermes.pyth.network/api/price_feed_ids")
  );
}
