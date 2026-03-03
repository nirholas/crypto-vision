/**
 * Crypto Vision — Social Metrics Data Source
 *
 * Multi-provider social/sentiment data:
 *  - CoinGecko (community data, developer stats)
 *  - CryptoCompare (social stats)
 *  - LunarCrush (social metrics, Galaxy scores)
 *  - Alternative.me (Fear & Greed Index)
 *
 * All endpoints free-tier / public.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";

// ─── CoinGecko Community Data ────────────────────────────────

const CG_BASE = "https://api.coingecko.com/api/v3";

function cgHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { "x-cg-demo-api-key": key } : {};
}

export interface SocialProfile {
  id: string;
  name: string;
  symbol: string;
  twitterFollowers: number;
  redditSubscribers: number;
  redditActiveAccounts: number;
  telegramChannelMembers: number;
  githubForks: number;
  githubStars: number;
  githubSubscribers: number;
  githubTotalIssues: number;
  githubClosedIssues: number;
  githubPullRequestsMerged: number;
  githubCommitCount4Weeks: number;
  devScore: number;
  communityScore: number;
  sentimentVotesUpPercentage: number;
  sentimentVotesDownPercentage: number;
}

/**
 * Get social/community profile for a coin from CoinGecko.
 */
export async function getSocialProfile(id: string): Promise<SocialProfile> {
  return cache.wrap(`social:profile:${id}`, 300, async () => {
    const coin = await fetchJSON<any>(
      `${CG_BASE}/coins/${id}?localization=false&tickers=false&market_data=false&community_data=true&developer_data=true&sparkline=false`,
      { headers: cgHeaders() },
    );

    return {
      id: coin.id,
      name: coin.name,
      symbol: coin.symbol,
      twitterFollowers: coin.community_data?.twitter_followers ?? 0,
      redditSubscribers: coin.community_data?.reddit_subscribers ?? 0,
      redditActiveAccounts: coin.community_data?.reddit_accounts_active_48h ?? 0,
      telegramChannelMembers: coin.community_data?.telegram_channel_user_count ?? 0,
      githubForks: coin.developer_data?.forks ?? 0,
      githubStars: coin.developer_data?.stars ?? 0,
      githubSubscribers: coin.developer_data?.subscribers ?? 0,
      githubTotalIssues: coin.developer_data?.total_issues ?? 0,
      githubClosedIssues: coin.developer_data?.closed_issues ?? 0,
      githubPullRequestsMerged: coin.developer_data?.pull_requests_merged ?? 0,
      githubCommitCount4Weeks: coin.developer_data?.commit_count_4_weeks ?? 0,
      devScore: coin.developer_score ?? 0,
      communityScore: coin.community_score ?? 0,
      sentimentVotesUpPercentage: coin.sentiment_votes_up_percentage ?? 0,
      sentimentVotesDownPercentage: coin.sentiment_votes_down_percentage ?? 0,
    };
  });
}

/**
 * Batch social profiles for multiple coins.
 */
export async function getSocialProfiles(ids: string[]): Promise<SocialProfile[]> {
  const results = await Promise.allSettled(
    ids.map((id) => getSocialProfile(id)),
  );
  return results
    .filter((r): r is PromiseFulfilledResult<SocialProfile> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ─── CryptoCompare Social Stats ──────────────────────────────

const CC_BASE = "https://min-api.cryptocompare.com/data";

function ccHeaders(): Record<string, string> {
  const key = process.env.CRYPTOCOMPARE_API_KEY;
  return key ? { authorization: `Apikey ${key}` } : {};
}

/**
 * CryptoCompare social stats (Twitter, Reddit, Facebook, code repos).
 */
export function getCryptoCompareSocial(coinId: number): Promise<any> {
  return cache.wrap(`social:cc:${coinId}`, 600, () =>
    fetchJSON(`${CC_BASE}/social/coin/latest?coinId=${coinId}`, {
      headers: ccHeaders(),
    }),
  );
}

/**
 * CryptoCompare social history for a coin over time.
 */
export function getCryptoCompareSocialHistory(
  coinId: number,
  aggregate = 1,
  limit = 30,
): Promise<any> {
  return cache.wrap(`social:cc:history:${coinId}:${aggregate}:${limit}`, 600, () =>
    fetchJSON(
      `${CC_BASE}/social/coin/histo/day?coinId=${coinId}&aggregate=${aggregate}&limit=${limit}`,
      { headers: ccHeaders() },
    ),
  );
}

// ─── LunarCrush ──────────────────────────────────────────────

const LUNAR_BASE = "https://lunarcrush.com/api4/public";

function lunarHeaders(): Record<string, string> {
  const key = process.env.LUNARCRUSH_API_KEY;
  return key
    ? { Authorization: `Bearer ${key}`, Accept: "application/json" }
    : { Accept: "application/json" };
}

export interface LunarMetrics {
  symbol: string;
  name: string;
  galaxyScore: number;
  altRank: number;
  socialVolume: number;
  socialDominance: number;
  marketDominance: number;
  socialContributors: number;
  socialScore: number;
  averageSentiment: number;
  correlationRank: number;
  volatility: number;
}

/**
 * LunarCrush coin metrics (Galaxy Score, AltRank, social volume).
 */
export function getLunarMetrics(symbol: string): Promise<any> {
  return cache.wrap(`social:lunar:${symbol}`, 300, () =>
    fetchJSON(`${LUNAR_BASE}/coins/${symbol}/v1`, {
      headers: lunarHeaders(),
    }),
  );
}

/**
 * LunarCrush top coins by social volume.
 */
export function getLunarTopCoins(sort = "galaxy_score", limit = 50): Promise<any> {
  return cache.wrap(`social:lunar:top:${sort}:${limit}`, 300, () =>
    fetchJSON(`${LUNAR_BASE}/coins/list/v2?sort=${sort}&limit=${limit}`, {
      headers: lunarHeaders(),
    }),
  );
}

/**
 * LunarCrush social feed / posts.
 */
export function getLunarFeed(symbol: string, limit = 20): Promise<any> {
  return cache.wrap(`social:lunar:feed:${symbol}:${limit}`, 120, () =>
    fetchJSON(`${LUNAR_BASE}/coins/${symbol}/feeds/v1?limit=${limit}`, {
      headers: lunarHeaders(),
    }),
  );
}

// ─── Fear & Greed Index ──────────────────────────────────────

const FG_API = "https://api.alternative.me/fng";

export interface FearGreedData {
  value: number;
  classification: string;
  timestamp: string;
}

/**
 * Current Fear & Greed Index value.
 */
export function getFearGreed(days = 1): Promise<any> {
  return cache.wrap(`social:feargreed:${days}`, 300, () =>
    fetchJSON(`${FG_API}/?limit=${days}&format=json`),
  );
}

/**
 * Fear & Greed history (up to 365 days).
 */
export function getFearGreedHistory(limit = 30): Promise<any> {
  return cache.wrap(`social:feargreed:history:${limit}`, 600, () =>
    fetchJSON(`${FG_API}/?limit=${limit}&format=json`),
  );
}

// ─── Aggregate Social Dashboard ──────────────────────────────

export interface SocialDashboard {
  fearGreed: any;
  topSocial: SocialProfile[];
  trending: any;
  fetchedAt: string;
}

/**
 * Aggregate social dashboard: Fear & Greed + top coin social data.
 */
export async function getSocialDashboard(): Promise<SocialDashboard> {
  return cache.wrap("social:dashboard", 300, async () => {
    const topCoins = ["bitcoin", "ethereum", "solana", "xrp", "cardano", "dogecoin", "chainlink", "polkadot"];

    const [fearGreed, profiles, trending] = await Promise.all([
      getFearGreed(7).catch(() => null),
      getSocialProfiles(topCoins).catch(() => []),
      fetchJSON<any>(`${CG_BASE}/search/trending`, { headers: cgHeaders() }).catch(() => null),
    ]);

    return {
      fearGreed,
      topSocial: profiles,
      trending: trending?.coins?.slice(0, 10) || [],
      fetchedAt: new Date().toISOString(),
    };
  });
}
