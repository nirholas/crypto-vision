/**
 * Crypto News Aggregator — Ported from free-crypto-news (src/lib/crypto-news.ts)
 * Parses RSS feeds from 7+ crypto news sources.
 *
 * @copyright 2024-2026 nirholas. All rights reserved.
 * @see https://github.com/nirholas/free-crypto-news
 */

import { fetchJSON } from "../lib/fetcher.js";
import { cache } from "../lib/cache.js";
import { log } from "../lib/logger.js";
import { ingestNewsArticles } from "../lib/bq-ingest.js";

// ─── RSS Sources ─────────────────────────────────────────────

export interface NewsSource {
  id: string;
  name: string;
  url: string;
  rssUrl: string;
  category: string;
  icon?: string;
}

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "coindesk",
    name: "CoinDesk",
    url: "https://www.coindesk.com",
    rssUrl: "https://www.coindesk.com/arc/outboundfeeds/rss/",
    category: "general",
    icon: "📰",
  },
  {
    id: "cointelegraph",
    name: "CoinTelegraph",
    url: "https://cointelegraph.com",
    rssUrl: "https://cointelegraph.com/rss",
    category: "general",
    icon: "📡",
  },
  {
    id: "theblock",
    name: "The Block",
    url: "https://www.theblock.co",
    rssUrl: "https://www.theblock.co/rss.xml",
    category: "general",
    icon: "🧱",
  },
  {
    id: "decrypt",
    name: "Decrypt",
    url: "https://decrypt.co",
    rssUrl: "https://decrypt.co/feed",
    category: "general",
    icon: "🔓",
  },
  {
    id: "bitcoinmagazine",
    name: "Bitcoin Magazine",
    url: "https://bitcoinmagazine.com",
    rssUrl: "https://bitcoinmagazine.com/.rss/full/",
    category: "bitcoin",
    icon: "₿",
  },
  {
    id: "blockworks",
    name: "Blockworks",
    url: "https://blockworks.co",
    rssUrl: "https://blockworks.co/feed",
    category: "general",
    icon: "🏗️",
  },
  {
    id: "defiant",
    name: "The Defiant",
    url: "https://thedefiant.io",
    rssUrl: "https://thedefiant.io/feed",
    category: "defi",
    icon: "🦊",
  },
];

// ─── Types ───────────────────────────────────────────────────

export interface Article {
  id: string;
  title: string;
  description: string;
  url: string;
  source: string;
  sourceName: string;
  publishedAt: string;
  categories: string[];
  imageUrl?: string;
}

export interface NewsResponse {
  articles: Article[];
  totalCount: number;
  sources: string[];
  timestamp: string;
}

// ─── RSS Parser (basic XML → Article) ────────────────────────

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, "i"))
    || xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

function extractImageUrl(xml: string): string | undefined {
  // Try media:content or enclosure
  const media = xml.match(/<media:content[^>]*url="([^"]+)"/i)
    || xml.match(/<enclosure[^>]*url="([^"]+)"/i)
    || xml.match(/<media:thumbnail[^>]*url="([^"]+)"/i)
    || xml.match(/<image>[\s\S]*?<url>([^<]+)<\/url>/i);
  return media ? media[1] : undefined;
}

function hashId(source: string, title: string): string {
  // Simple hash for dedup
  let hash = 0;
  const str = `${source}:${title}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function parseRSS(xml: string, source: NewsSource): Article[] {
  const articles: Article[] = [];

  // Split on <item> tags
  const items = xml.split(/<item[\s>]/i).slice(1); // skip preamble

  for (const item of items) {
    try {
      const title = extractTag(item, "title");
      const description = extractTag(item, "description")
        .replace(/<[^>]+>/g, "") // strip HTML
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .slice(0, 500);
      const link = extractTag(item, "link");
      const pubDate = extractTag(item, "pubDate");
      const categories: string[] = [];
      const catMatches = item.matchAll(/<category[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/category>/gi);
      for (const m of catMatches) {
        categories.push(m[1].trim());
      }

      if (!title || !link) continue;

      articles.push({
        id: hashId(source.id, title),
        title,
        description,
        url: link,
        source: source.id,
        sourceName: source.name,
        publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        categories: categories.slice(0, 5),
        imageUrl: extractImageUrl(item),
      });
    } catch {
      // Skip malformed items
    }
  }

  return articles;
}

// ─── Fetch Functions ─────────────────────────────────────────

async function fetchSourceRSS(source: NewsSource): Promise<Article[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(source.rssUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "CryptoVision/1.0 (+https://cryptocurrency.cv)" },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      log.warn({ source: source.id, status: res.status }, "RSS fetch failed");
      return [];
    }

    const xml = await res.text();
    return parseRSS(xml, source);
  } catch (err: any) {
    log.warn({ source: source.id, err: err.message }, "RSS fetch error");
    return [];
  }
}

/**
 * Fetch news from all sources, merge, deduplicate, sort by date.
 */
export async function getNews(options: {
  limit?: number;
  source?: string;
  category?: string;
  page?: number;
} = {}): Promise<NewsResponse> {
  const { limit = 50, source, category, page = 1 } = options;

  const cacheKey = `news:${source || "all"}:${category || "all"}:${page}:${limit}`;

  const result = await cache.wrap(cacheKey, 60, async () => {
    const sourcesToFetch = source
      ? NEWS_SOURCES.filter((s) => s.id === source)
      : NEWS_SOURCES;

    // Fetch all sources in parallel
    const results = await Promise.allSettled(
      sourcesToFetch.map((s) => fetchSourceRSS(s)),
    );

    let articles: Article[] = [];
    const activeSources: string[] = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled" && result.value.length > 0) {
        articles.push(...result.value);
        activeSources.push(sourcesToFetch[i].id);
      }
    }

    // Filter by category if specified
    if (category) {
      const cat = category.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.categories.some((c) => c.toLowerCase().includes(cat)) ||
          a.source === cat, // source id matches category (e.g. "bitcoin" source for "bitcoin" category)
      );
    }

    // Sort by publish date descending
    articles.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
    );

    // Deduplicate by title similarity
    const seen = new Set<string>();
    articles = articles.filter((a) => {
      const key = a.title.toLowerCase().slice(0, 60);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Paginate
    const offset = (page - 1) * limit;
    const paginated = articles.slice(offset, offset + limit);

    return {
      articles: paginated,
      totalCount: articles.length,
      sources: activeSources,
      timestamp: new Date().toISOString(),
    };
  });
  ingestNewsArticles(result.articles as unknown as Array<Record<string, unknown>>);
  return result;
}

/**
 * Search articles by keyword.
 */
export async function searchNews(
  query: string,
  limit = 20,
): Promise<NewsResponse> {
  const all = await getNews({ limit: 200 }); // get a big pool
  const q = query.toLowerCase();

  const matched = all.articles.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      a.description.toLowerCase().includes(q),
  );

  return {
    articles: matched.slice(0, limit),
    totalCount: matched.length,
    sources: [...new Set(matched.map((a) => a.source))],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get breaking news (last 2 hours).
 */
export async function getBreakingNews(limit = 10): Promise<NewsResponse> {
  const all = await getNews({ limit: 100 });
  const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

  const breaking = all.articles.filter(
    (a) => new Date(a.publishedAt).getTime() > twoHoursAgo,
  );

  return {
    articles: breaking.slice(0, limit),
    totalCount: breaking.length,
    sources: [...new Set(breaking.map((a) => a.source))],
    timestamp: new Date().toISOString(),
  };
}

/**
 * Get trending topics from article categories.
 */
export async function getTrending(limit = 10) {
  const all = await getNews({ limit: 100 });
  const counts = new Map<string, number>();

  for (const a of all.articles) {
    for (const cat of a.categories) {
      const key = cat.toLowerCase();
      counts.set(key, (counts.get(key) || 0) + 1);
    }
  }

  const sorted = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);

  return {
    topics: sorted.map(([topic, count]) => ({ topic, count })),
    timestamp: new Date().toISOString(),
  };
}

/**
 * List available sources.
 */
export function getSources() {
  return {
    sources: NEWS_SOURCES.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      category: s.category,
      icon: s.icon,
    })),
    count: NEWS_SOURCES.length,
  };
}

// ═══════════════════════════════════════════════════════════════
// CryptoPanic API Integration
// ═══════════════════════════════════════════════════════════════

import { z } from "zod";

const CRYPTOPANIC_API = "https://cryptopanic.com/api/v1";

function getCryptoPanicKey(): string {
  return process.env.CRYPTOPANIC_API_KEY ?? "";
}

// ─── Zod Schemas ─────────────────────────────────────────────

const CryptoPanicSourceSchema = z.object({
  domain: z.string(),
  title: z.string(),
  region: z.string().optional(),
  path: z.string().nullable().optional(),
});

const CryptoPanicCurrencySchema = z.object({
  code: z.string(),
  title: z.string(),
  slug: z.string().optional(),
  url: z.string().optional(),
});

const CryptoPanicVotesSchema = z.object({
  positive: z.number().default(0),
  negative: z.number().default(0),
  important: z.number().default(0),
  liked: z.number().default(0),
  disliked: z.number().default(0),
  lol: z.number().default(0),
  toxic: z.number().default(0),
  saved: z.number().default(0),
  comments: z.number().default(0),
});

const CryptoPanicPostSchema = z.object({
  kind: z.enum(["news", "media", "analysis"]),
  domain: z.string(),
  title: z.string(),
  published_at: z.string(),
  slug: z.string().optional(),
  id: z.number(),
  url: z.string(),
  created_at: z.string(),
  source: CryptoPanicSourceSchema,
  currencies: z.array(CryptoPanicCurrencySchema).nullable().default([]),
  votes: CryptoPanicVotesSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

const CryptoPanicResponseSchema = z.object({
  count: z.number(),
  next: z.string().nullable(),
  previous: z.string().nullable(),
  results: z.array(CryptoPanicPostSchema),
});

export type CryptoPanicPost = z.infer<typeof CryptoPanicPostSchema>;
export type CryptoPanicVotes = z.infer<typeof CryptoPanicVotesSchema>;
export type CryptoPanicResponse = z.infer<typeof CryptoPanicResponseSchema>;

// ─── CryptoPanic API Client ─────────────────────────────────

async function cryptoPanicFetch(
  endpoint: string,
  params?: Record<string, string>,
): Promise<CryptoPanicResponse> {
  const key = getCryptoPanicKey();
  if (!key) {
    log.warn("CRYPTOPANIC_API_KEY not set — CryptoPanic endpoints unavailable");
    return { count: 0, next: null, previous: null, results: [] };
  }

  const url = new URL(`${CRYPTOPANIC_API}${endpoint}`);
  url.searchParams.set("auth_token", key);
  url.searchParams.set("public", "true");

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const raw = await fetchJSON<unknown>(url.toString(), { timeout: 10_000 });
  const parsed = CryptoPanicResponseSchema.safeParse(raw);
  if (!parsed.success) {
    log.warn({ errors: parsed.error.issues.slice(0, 3) }, "CryptoPanic response validation failed");
    return { count: 0, next: null, previous: null, results: [] };
  }
  return parsed.data;
}

/**
 * Determine sentiment from CryptoPanic vote counts.
 */
function deriveSentiment(votes?: CryptoPanicVotes): "positive" | "negative" | "neutral" {
  if (!votes) return "neutral";
  const score = votes.positive - votes.negative;
  if (score > 5) return "positive";
  if (score < -5) return "negative";
  return "neutral";
}

/**
 * Determine importance from CryptoPanic vote counts.
 */
function deriveImportance(votes?: CryptoPanicVotes): "high" | "medium" | "low" {
  if (!votes) return "low";
  const total = votes.positive + votes.negative + votes.important + votes.liked;
  if (votes.important > 10 || total > 50) return "high";
  if (votes.important > 3 || total > 15) return "medium";
  return "low";
}

/**
 * Convert a CryptoPanic post into a NormalizedArticle-compatible shape.
 */
export function normalizeCryptoPanicPost(post: CryptoPanicPost): CryptoPanicNormalized {
  return {
    id: `cp-${post.id}`,
    title: post.title,
    url: post.url,
    source: "cryptopanic",
    sourceUrl: post.source.domain,
    publishedAt: post.published_at,
    categories: [post.kind],
    coins: (post.currencies ?? []).map((c) => ({ symbol: c.code, name: c.title })),
    sentiment: deriveSentiment(post.votes),
    importance: deriveImportance(post.votes),
    votes: post.votes ? {
      positive: post.votes.positive,
      negative: post.votes.negative,
      important: post.votes.important,
      liked: post.votes.liked,
      disliked: post.votes.disliked,
      lol: post.votes.lol,
      toxic: post.votes.toxic,
      saved: post.votes.saved,
      comments: post.votes.comments,
    } : undefined,
  };
}

export interface CryptoPanicNormalized {
  id: string;
  title: string;
  url: string;
  source: string;
  sourceUrl: string;
  publishedAt: string;
  categories: string[];
  coins: Array<{ symbol: string; name: string }>;
  sentiment: "positive" | "negative" | "neutral";
  importance: "high" | "medium" | "low";
  votes?: {
    positive: number;
    negative: number;
    important: number;
    liked: number;
    disliked: number;
    lol: number;
    toxic: number;
    saved: number;
    comments: number;
  };
}

// ─── CryptoPanic Exported Functions ──────────────────────────

/**
 * Fetch CryptoPanic posts with optional filter, currencies, and region.
 */
export async function getCryptoPanicPosts(
  filter?: "rising" | "hot" | "bullish" | "bearish" | "important" | "saved" | "lol",
  currencies?: string,
  regions?: string,
): Promise<CryptoPanicNormalized[]> {
  const params: Record<string, string> = {};
  if (filter) params.filter = filter;
  if (currencies) params.currencies = currencies;
  if (regions) params.regions = regions;

  const cacheKey = `cp:posts:${filter ?? "all"}:${currencies ?? "all"}:${regions ?? "all"}`;
  return cache.wrap(cacheKey, 60, async () => {
    const res = await cryptoPanicFetch("/posts/", params);
    return res.results.map(normalizeCryptoPanicPost);
  });
}

/**
 * Fetch trending (hot) posts from CryptoPanic.
 */
export async function getTrendingPosts(): Promise<CryptoPanicNormalized[]> {
  return getCryptoPanicPosts("hot");
}

/**
 * Fetch rising posts from CryptoPanic.
 */
export async function getRisingPosts(): Promise<CryptoPanicNormalized[]> {
  return getCryptoPanicPosts("rising");
}

/**
 * Fetch bullish posts from CryptoPanic.
 */
export async function getBullishPosts(): Promise<CryptoPanicNormalized[]> {
  return getCryptoPanicPosts("bullish");
}

/**
 * Fetch bearish posts from CryptoPanic.
 */
export async function getBearishPosts(): Promise<CryptoPanicNormalized[]> {
  return getCryptoPanicPosts("bearish");
}

/**
 * Fetch important posts from CryptoPanic.
 */
export async function getImportantPosts(): Promise<CryptoPanicNormalized[]> {
  return getCryptoPanicPosts("important");
}

/**
 * Fetch CryptoPanic news for a specific coin symbol (e.g. "BTC", "ETH").
 */
export async function getCryptoPanicNewsByCoin(
  symbol: string,
): Promise<CryptoPanicNormalized[]> {
  return getCryptoPanicPosts(undefined, symbol.toUpperCase());
}
