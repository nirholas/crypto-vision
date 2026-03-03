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
  fearGreed: unknown;
  topSocial: SocialProfile[];
  trending: unknown;
  fetchedAt: string;
}

interface TrendingCoinResponse {
  coins?: Array<{
    item: {
      id: string;
      coin_id: number;
      name: string;
      symbol: string;
      market_cap_rank: number;
      thumb: string;
      price_btc: number;
      score: number;
    };
  }>;
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
      fetchJSON<TrendingCoinResponse>(`${CG_BASE}/search/trending`, { headers: cgHeaders() }).catch(() => null),
    ]);

    return {
      fearGreed,
      topSocial: profiles,
      trending: trending?.coins?.slice(0, 10) ?? [],
      fetchedAt: new Date().toISOString(),
    };
  });
}

// ─── Aggregated Social Stats ─────────────────────────────────

export interface AggregatedSocialStats {
  symbol: string;
  coinGecko: SocialProfile | null;
  lunarCrush: LunarMetrics | null;
  cryptoCompare: {
    twitter: { followers: number; statuses: number } | null;
    reddit: { subscribers: number; activeUsers: number; postsPerDay: number; commentsPerDay: number } | null;
    codeRepository: Array<{ stars: number; forks: number }> | null;
  } | null;
  composite: {
    totalSocialFollowers: number;
    devScore: number;
    communityScore: number;
    sentimentScore: number;
  };
}

/**
 * Resolve a symbol to its CoinGecko ID via search.
 */
export async function resolveSymbolToGeckoId(symbol: string): Promise<string | null> {
  return cache.wrap(`social:resolve:${symbol}`, 3600, async () => {
    const searchResult = await fetchJSON<{
      coins: Array<{ id: string; symbol: string; name: string; market_cap_rank: number | null }>;
    }>(`${CG_BASE}/search?query=${encodeURIComponent(symbol)}`, { headers: cgHeaders() }).catch(() => ({ coins: [] }));

    const upper = symbol.toUpperCase();
    // Prefer exact symbol match with lowest market cap rank
    const matches = searchResult.coins
      .filter((c) => c.symbol.toUpperCase() === upper)
      .sort((a, b) => (a.market_cap_rank ?? 99999) - (b.market_cap_rank ?? 99999));

    return matches.length > 0 ? matches[0].id : null;
  });
}

/**
 * Get comprehensive social stats for a coin from all providers.
 */
export async function getAggregatedSocialStats(
  symbol: string,
  ccCoinId?: number,
): Promise<AggregatedSocialStats> {
  return cache.wrap(`social:aggregated:${symbol}`, 300, async () => {
    const geckoId = await resolveSymbolToGeckoId(symbol);

    const [cgProfile, lunarMetrics, ccSocial] = await Promise.allSettled([
      geckoId ? getSocialProfile(geckoId) : Promise.reject(new Error("No CoinGecko ID")),
      getLunarMetrics(symbol.toUpperCase()),
      ccCoinId ? getCryptoCompareSocial(ccCoinId) : Promise.reject(new Error("No CC coin ID")),
    ]);

    const cg = cgProfile.status === "fulfilled" ? cgProfile.value : null;
    const lunar = lunarMetrics.status === "fulfilled" ? lunarMetrics.value as LunarMetrics | null : null;

    let ccData: AggregatedSocialStats["cryptoCompare"] = null;
    if (ccSocial.status === "fulfilled") {
      const data = ccSocial.value as {
        Data?: {
          Twitter?: { followers: number; statuses: number };
          Reddit?: { subscribers: number; active_users: number; posts_per_day: number; comments_per_day: number };
          CodeRepository?: { List?: Array<{ stars: number; forks: number }> };
        };
      };
      if (data?.Data) {
        ccData = {
          twitter: data.Data.Twitter
            ? { followers: data.Data.Twitter.followers, statuses: data.Data.Twitter.statuses }
            : null,
          reddit: data.Data.Reddit
            ? {
                subscribers: data.Data.Reddit.subscribers,
                activeUsers: data.Data.Reddit.active_users,
                postsPerDay: data.Data.Reddit.posts_per_day,
                commentsPerDay: data.Data.Reddit.comments_per_day,
              }
            : null,
          codeRepository: data.Data.CodeRepository?.List?.map((r) => ({
            stars: r.stars,
            forks: r.forks,
          })) ?? null,
        };
      }
    }

    // Compute composite scores
    const totalSocialFollowers =
      (cg?.twitterFollowers ?? 0) +
      (cg?.redditSubscribers ?? 0) +
      (cg?.telegramChannelMembers ?? 0) +
      (ccData?.twitter?.followers ?? 0);

    const devScore = cg?.devScore ?? 0;
    const communityScore = cg?.communityScore ?? 0;
    const sentimentScore = cg
      ? cg.sentimentVotesUpPercentage - cg.sentimentVotesDownPercentage
      : (lunar as Record<string, number> | null)?.averageSentiment ?? 0;

    return {
      symbol,
      coinGecko: cg,
      lunarCrush: lunar,
      cryptoCompare: ccData,
      composite: {
        totalSocialFollowers,
        devScore,
        communityScore,
        sentimentScore,
      },
    };
  });
}

// ─── Trending Social ─────────────────────────────────────────

export interface TrendingSocialCoin {
  id: string;
  name: string;
  symbol: string;
  marketCapRank: number | null;
  priceBtc: number;
  source: string;
}

/**
 * Get trending coins across social platforms.
 */
export async function getSocialTrending(): Promise<TrendingSocialCoin[]> {
  return cache.wrap("social:trending", 300, async () => {
    const [cgTrending, lunarTop] = await Promise.allSettled([
      fetchJSON<TrendingCoinResponse>(`${CG_BASE}/search/trending`, { headers: cgHeaders() }),
      getLunarTopCoins("galaxy_score", 20),
    ]);

    const coins: TrendingSocialCoin[] = [];
    const seen = new Set<string>();

    // CoinGecko trending
    if (cgTrending.status === "fulfilled" && cgTrending.value?.coins) {
      for (const c of cgTrending.value.coins) {
        const key = c.item.symbol.toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          coins.push({
            id: c.item.id,
            name: c.item.name,
            symbol: c.item.symbol,
            marketCapRank: c.item.market_cap_rank,
            priceBtc: c.item.price_btc,
            source: "coingecko",
          });
        }
      }
    }

    // LunarCrush top social
    if (lunarTop.status === "fulfilled") {
      const lunarData = lunarTop.value as { data?: Array<{ symbol: string; name: string }> };
      for (const c of lunarData.data ?? []) {
        const key = (c.symbol ?? "").toUpperCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          coins.push({
            id: key.toLowerCase(),
            name: c.name ?? key,
            symbol: key,
            marketCapRank: null,
            priceBtc: 0,
            source: "lunarcrush",
          });
        }
      }
    }

    return coins;
  });
}

// ─── Social Volume over Time ─────────────────────────────────

export interface SocialVolumePoint {
  timestamp: string;
  mentions: number;
  posts: number;
  comments: number;
  followers: number;
  pageViews: number;
}

/**
 * Get social volume (mention count) over time for a coin.
 */
export async function getSocialVolume(
  ccCoinId: number,
  days = 30,
): Promise<SocialVolumePoint[]> {
  return cache.wrap(`social:volume:${ccCoinId}:${days}`, 600, async () => {
    const history = await getCryptoCompareSocialHistory(ccCoinId, 1, days);
    const data = history as {
      Data?: Array<{
        time: number;
        comments: number;
        posts: number;
        followers: number;
        points: number;
        overview_page_views: number;
        analysis_page_views: number;
        total_page_views: number;
      }>;
    };

    return (data.Data ?? []).map((point) => ({
      timestamp: new Date(point.time * 1000).toISOString(),
      mentions: point.posts + point.comments,
      posts: point.posts,
      comments: point.comments,
      followers: point.followers,
      pageViews: point.total_page_views,
    }));
  });
}

// ─── Social Sentiment ────────────────────────────────────────

export interface SocialSentiment {
  symbol: string;
  overall: "bullish" | "bearish" | "neutral";
  score: number;
  breakdown: {
    coinGeckoUp: number;
    coinGeckoDown: number;
    lunarCrushSentiment: number;
    twitterSentiment: string;
  };
  sources: string[];
}

/**
 * Get combined sentiment analysis for a coin.
 */
export async function getSocialSentiment(symbol: string, ccCoinId?: number): Promise<SocialSentiment> {
  return cache.wrap(`social:sentiment:${symbol}`, 300, async () => {
    const geckoId = await resolveSymbolToGeckoId(symbol);

    const [cgProfile, lunarMetrics] = await Promise.allSettled([
      geckoId ? getSocialProfile(geckoId) : Promise.reject(new Error("No CoinGecko ID")),
      getLunarMetrics(symbol.toUpperCase()),
    ]);

    const cg = cgProfile.status === "fulfilled" ? cgProfile.value : null;
    const lunar = lunarMetrics.status === "fulfilled" ? lunarMetrics.value as Record<string, number> | null : null;

    const cgUp = cg?.sentimentVotesUpPercentage ?? 50;
    const cgDown = cg?.sentimentVotesDownPercentage ?? 50;
    const lunarSentiment = lunar?.averageSentiment ?? 50;

    // Weighted composite: CoinGecko (40%), LunarCrush (60%)
    const cgScore = cgUp - cgDown; // -100 to 100
    const lunarNormalized = (lunarSentiment - 50) * 2; // Normalize around 0
    const compositeScore = cgScore * 0.4 + lunarNormalized * 0.6;

    let overall: "bullish" | "bearish" | "neutral" = "neutral";
    if (compositeScore > 15) overall = "bullish";
    else if (compositeScore < -15) overall = "bearish";

    const sources: string[] = [];
    if (cg) sources.push("coingecko");
    if (lunar) sources.push("lunarcrush");

    return {
      symbol,
      overall,
      score: Math.round(compositeScore * 100) / 100,
      breakdown: {
        coinGeckoUp: cgUp,
        coinGeckoDown: cgDown,
        lunarCrushSentiment: lunarSentiment,
        twitterSentiment: compositeScore > 10 ? "positive" : compositeScore < -10 ? "negative" : "neutral",
      },
      sources,
    };
  });
}

// ─── Social Influencers ──────────────────────────────────────

export interface SocialInfluencer {
  username: string;
  platform: string;
  followers: number;
  engagement: number;
  sentiment: string;
  recentPostCount: number;
}

/**
 * Get top social influencers talking about a coin.
 * Leverages LunarCrush feed data to extract contributor info.
 */
export async function getSocialInfluencers(
  symbol: string,
  limit = 20,
): Promise<SocialInfluencer[]> {
  return cache.wrap(`social:influencers:${symbol}:${limit}`, 300, async () => {
    const feedData = await getLunarFeed(symbol.toUpperCase(), 50).catch(() => null);
    const feed = feedData as { data?: Array<{
      creator_display_name?: string;
      social_type?: string;
      interactions_24h?: number;
      sentiment?: number;
      creator_followers?: number;
    }> } | null;

    if (!feed?.data) return [];

    // Aggregate by creator
    const creatorMap = new Map<string, SocialInfluencer>();

    for (const post of feed.data) {
      const name = post.creator_display_name ?? "Unknown";
      const existing = creatorMap.get(name);

      if (existing) {
        existing.recentPostCount++;
        existing.engagement += post.interactions_24h ?? 0;
      } else {
        creatorMap.set(name, {
          username: name,
          platform: post.social_type ?? "unknown",
          followers: post.creator_followers ?? 0,
          engagement: post.interactions_24h ?? 0,
          sentiment: (post.sentiment ?? 0) > 0.5 ? "positive" : (post.sentiment ?? 0) < -0.5 ? "negative" : "neutral",
          recentPostCount: 1,
        });
      }
    }

    return [...creatorMap.values()]
      .sort((a, b) => b.followers - a.followers)
      .slice(0, limit);
  });
}

// ─── Reddit Activity ─────────────────────────────────────────

export interface RedditActivity {
  symbol: string;
  subscribers: number;
  activeAccounts: number;
  postsPerDay: number;
  commentsPerDay: number;
  growthRate: number;
  sources: string[];
}

/**
 * Get Reddit activity metrics for a coin from multiple providers.
 */
export async function getRedditActivity(symbol: string, ccCoinId?: number): Promise<RedditActivity> {
  return cache.wrap(`social:reddit:${symbol}`, 300, async () => {
    const geckoId = await resolveSymbolToGeckoId(symbol);

    const [cgProfile, ccSocial] = await Promise.allSettled([
      geckoId ? getSocialProfile(geckoId) : Promise.reject(new Error("No CoinGecko ID")),
      ccCoinId ? getCryptoCompareSocial(ccCoinId) : Promise.reject(new Error("No CC coin ID")),
    ]);

    const cg = cgProfile.status === "fulfilled" ? cgProfile.value : null;
    const cc = ccSocial.status === "fulfilled"
      ? (ccSocial.value as { Data?: { Reddit?: { subscribers: number; active_users: number; posts_per_day: number; comments_per_day: number } } })
      : null;

    const subscribers = cg?.redditSubscribers ?? cc?.Data?.Reddit?.subscribers ?? 0;
    const activeAccounts = cg?.redditActiveAccounts ?? cc?.Data?.Reddit?.active_users ?? 0;
    const postsPerDay = cc?.Data?.Reddit?.posts_per_day ?? 0;
    const commentsPerDay = cc?.Data?.Reddit?.comments_per_day ?? 0;

    // Growth rate: active accounts / subscribers ratio (higher = more engaged)
    const growthRate = subscribers > 0 ? Math.round((activeAccounts / subscribers) * 10000) / 100 : 0;

    const sources: string[] = [];
    if (cg) sources.push("coingecko");
    if (cc?.Data?.Reddit) sources.push("cryptocompare");

    return {
      symbol,
      subscribers,
      activeAccounts,
      postsPerDay,
      commentsPerDay,
      growthRate,
      sources,
    };
  });
}

// ─── GitHub Activity ─────────────────────────────────────────

export interface GitHubActivity {
  symbol: string;
  forks: number;
  stars: number;
  subscribers: number;
  totalIssues: number;
  closedIssues: number;
  pullRequestsMerged: number;
  commitCount4Weeks: number;
  issueCloseRate: number;
  activityScore: number;
  sources: string[];
}

/**
 * Get GitHub development activity for a coin.
 */
export async function getGitHubActivity(symbol: string, ccCoinId?: number): Promise<GitHubActivity> {
  return cache.wrap(`social:github:${symbol}`, 600, async () => {
    const geckoId = await resolveSymbolToGeckoId(symbol);

    const [cgProfile, ccSocial] = await Promise.allSettled([
      geckoId ? getSocialProfile(geckoId) : Promise.reject(new Error("No CoinGecko ID")),
      ccCoinId ? getCryptoCompareSocial(ccCoinId) : Promise.reject(new Error("No CC coin ID")),
    ]);

    const cg = cgProfile.status === "fulfilled" ? cgProfile.value : null;
    const cc = ccSocial.status === "fulfilled"
      ? (ccSocial.value as { Data?: { CodeRepository?: { List?: Array<{ stars: number; forks: number }> } } })
      : null;

    const forks = cg?.githubForks ?? 0;
    const stars = cg?.githubStars ?? (cc?.Data?.CodeRepository?.List?.[0]?.stars ?? 0);
    const subscribers = cg?.githubSubscribers ?? 0;
    const totalIssues = cg?.githubTotalIssues ?? 0;
    const closedIssues = cg?.githubClosedIssues ?? 0;
    const pullRequestsMerged = cg?.githubPullRequestsMerged ?? 0;
    const commitCount4Weeks = cg?.githubCommitCount4Weeks ?? 0;

    const issueCloseRate = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 10000) / 100 : 0;

    // Activity score: weighted combination of recent commits, PRs merged, and issue close rate
    const activityScore = Math.min(100, Math.round(
      commitCount4Weeks * 2 +
      pullRequestsMerged * 3 +
      issueCloseRate * 0.5,
    ));

    const sources: string[] = [];
    if (cg) sources.push("coingecko");
    if (cc?.Data?.CodeRepository) sources.push("cryptocompare");

    return {
      symbol,
      forks,
      stars,
      subscribers,
      totalIssues,
      closedIssues,
      pullRequestsMerged,
      commitCount4Weeks,
      issueCloseRate,
      activityScore,
      sources,
    };
  });
}

// ─── Social-Price Correlation ────────────────────────────────

export interface SocialPriceCorrelation {
  symbol: string;
  period: string;
  socialPriceCorrelation: number;
  socialLeadsPrice: boolean;
  leadTimeHours: number;
  interpretation: "strong_positive" | "moderate_positive" | "weak" | "negative";
  dataPoints: number;
}

/**
 * Compute Pearson correlation between daily social volume and price.
 */
function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const meanX = xSlice.reduce((s, v) => s + v, 0) / n;
  const meanY = ySlice.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX;
    const dy = ySlice[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : numerator / denom;
}

/**
 * Check if social data leads or lags price by computing shifted correlations.
 */
function computeLeadLag(social: number[], price: number[]): { leads: boolean; hours: number } {
  const n = Math.min(social.length, price.length);
  if (n < 5) return { leads: false, hours: 0 };

  let bestCorr = Math.abs(pearsonCorrelation(social, price));
  let bestShift = 0;

  // Test shifts from -3 to +3 days
  for (let shift = -3; shift <= 3; shift++) {
    if (shift === 0) continue;
    const shiftedSocial = shift > 0
      ? social.slice(shift)
      : social.slice(0, n + shift);
    const shiftedPrice = shift > 0
      ? price.slice(0, n - shift)
      : price.slice(-shift);

    const corr = Math.abs(pearsonCorrelation(shiftedSocial, shiftedPrice));
    if (corr > bestCorr) {
      bestCorr = corr;
      bestShift = shift;
    }
  }

  // Positive shift means social leads price
  return { leads: bestShift > 0, hours: Math.abs(bestShift) * 24 };
}

/**
 * Compute correlation between social activity and price movements.
 */
export async function computeSocialPriceCorrelation(
  symbol: string,
  ccCoinId: number,
  days = 30,
): Promise<SocialPriceCorrelation> {
  return cache.wrap(`social:correlation:${symbol}:${days}`, 600, async () => {
    const [socialHistory, priceHistory] = await Promise.allSettled([
      getCryptoCompareSocialHistory(ccCoinId, 1, days),
      fetchJSON<{
        Data: { Data: Array<{ time: number; close: number }> };
      }>(`https://min-api.cryptocompare.com/data/v2/histoday?fsym=${symbol.toUpperCase()}&tsym=USD&limit=${days}`, {
        headers: (() => {
          const key = process.env.CRYPTOCOMPARE_API_KEY;
          return key ? { authorization: `Apikey ${key}` } : {};
        })(),
      }),
    ]);

    const socialData = socialHistory.status === "fulfilled"
      ? (socialHistory.value as { Data?: Array<{ time: number; posts: number; comments: number; points: number }> }).Data ?? []
      : [];

    const priceData = priceHistory.status === "fulfilled"
      ? (priceHistory.value as { Data?: { Data?: Array<{ time: number; close: number }> } }).Data?.Data ?? []
      : [];

    if (socialData.length < 3 || priceData.length < 3) {
      return {
        symbol,
        period: `${days}d`,
        socialPriceCorrelation: 0,
        socialLeadsPrice: false,
        leadTimeHours: 0,
        interpretation: "weak" as const,
        dataPoints: 0,
      };
    }

    // Extract daily social volume and price series
    const socialVolume = socialData.map((d) => (d.posts ?? 0) + (d.comments ?? 0) + (d.points ?? 0));
    const prices = priceData.map((d) => d.close);

    const pearsonR = pearsonCorrelation(socialVolume, prices);
    const { leads: socialLeadsPrice, hours: leadTime } = computeLeadLag(socialVolume, prices);

    let interpretation: SocialPriceCorrelation["interpretation"] = "weak";
    if (pearsonR > 0.7) interpretation = "strong_positive";
    else if (pearsonR > 0.3) interpretation = "moderate_positive";
    else if (pearsonR < -0.3) interpretation = "negative";

    return {
      symbol,
      period: `${days}d`,
      socialPriceCorrelation: Math.round(pearsonR * 10000) / 10000,
      socialLeadsPrice,
      leadTimeHours: leadTime,
      interpretation,
      dataPoints: Math.min(socialVolume.length, prices.length),
    };
  });
}
