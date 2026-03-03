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

  return cache.wrap(cacheKey, 60, async () => {
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
