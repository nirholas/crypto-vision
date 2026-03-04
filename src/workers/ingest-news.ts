/**
 * Crypto Vision — News Ingestion Worker
 *
 * Fetches crypto news from RSS feeds and CryptoPanic, enriches with
 * metadata, and persists for downstream AI analysis and vector indexing.
 *
 * Schedule: every 5 minutes
 * Pub/Sub topic: crypto-vision-standard
 * BigQuery table: news_articles
 */

import { IngestionWorker, runWorkerCLI, type WorkerConfig } from "./worker-base.js";
import { Tables } from "../lib/bigquery.js";
import { Topics } from "../lib/pubsub.js";
import { log } from "../lib/logger.js";
import { ingestNewsArticles } from "../lib/bq-ingest.js";

class NewsIngestionWorker extends IngestionWorker {
  constructor() {
    const config: WorkerConfig = {
      name: "ingest-news",
      intervalMs: 5 * 60 * 1_000, // 5 minutes
      bqTable: Tables.NEWS_ARTICLES,
      pubsubTopic: Topics.STANDARD,
    };
    super(config);
  }

  async fetch(): Promise<Record<string, unknown>[]> {
    const allRows: Record<string, unknown>[] = [];

    const { getNews, getBreakingNews, getCryptoPanicPosts, getTrendingPosts } =
      await import("../sources/crypto-news.js");

    // Fetch multiple news streams in parallel
    const [general, breaking, cryptoPanic, trending] = await Promise.allSettled([
      getNews({ limit: 50 }),
      getBreakingNews(20),
      getCryptoPanicPosts(),
      getTrendingPosts(),
    ]);

    // 1. General news (RSS feeds)
    if (general.status === "fulfilled" && general.value?.articles?.length) {
      const articles = general.value.articles;
      ingestNewsArticles(articles as unknown as Array<Record<string, unknown>>);

      const rows = articles.map((a) => ({
        type: "news_article",
        article_id: a.id ?? a.url ?? `${a.title}-${Date.now()}`,
        title: a.title,
        description: a.description,
        url: a.url,
        source_name: a.source ?? a.sourceName,
        category: a.categories?.[0] ?? "general",
        published_at: a.publishedAt,
        source: "rss",
      }));
      allRows.push(...rows);
      log.debug({ count: articles.length }, "Fetched general news");
    } else if (general.status === "rejected") {
      log.warn({ err: general.reason?.message }, "Failed to fetch general news");
    }

    // 2. Breaking news
    if (breaking.status === "fulfilled" && breaking.value?.articles?.length) {
      const articles = breaking.value.articles;
      const rows = articles.map((a) => ({
        type: "breaking_news",
        article_id: a.id ?? a.url ?? `breaking-${Date.now()}`,
        title: a.title,
        description: a.description,
        url: a.url,
        source_name: a.source ?? a.sourceName,
        category: "breaking",
        published_at: a.publishedAt,
        source: "rss",
      }));
      allRows.push(...rows);
      log.debug({ count: articles.length }, "Fetched breaking news");
    } else if (breaking.status === "rejected") {
      log.warn({ err: breaking.reason?.message }, "Failed to fetch breaking news");
    }

    // 3. CryptoPanic posts
    if (cryptoPanic.status === "fulfilled" && cryptoPanic.value?.length) {
      const posts = cryptoPanic.value;
      const rows = (posts as unknown as Array<Record<string, unknown>>).map((p) => ({
        type: "cryptopanic_post",
        article_id: p.id ?? p.url ?? `cp-${Date.now()}`,
        title: p.title,
        description: p.body ?? p.description,
        url: p.url,
        source_name: p.source ?? "cryptopanic",
        category: p.kind ?? "news",
        published_at: p.publishedAt ?? p.published_at ?? p.created_at,
        sentiment_label: p.sentiment,
        source: "cryptopanic",
      }));
      allRows.push(...rows);
      log.debug({ count: posts.length }, "Fetched CryptoPanic posts");
    } else if (cryptoPanic.status === "rejected") {
      log.warn({ err: cryptoPanic.reason?.message }, "Failed to fetch CryptoPanic posts");
    }

    // 4. Trending posts
    if (trending.status === "fulfilled" && trending.value?.length) {
      const posts = trending.value;
      const rows = (posts as unknown as Array<Record<string, unknown>>).map((p) => ({
        type: "trending_news",
        article_id: p.id ?? p.url ?? `trend-${Date.now()}`,
        title: p.title,
        url: p.url,
        source_name: p.source ?? "cryptopanic",
        category: "trending",
        published_at: p.publishedAt ?? p.published_at ?? p.created_at,
        source: "cryptopanic",
      }));
      allRows.push(...rows);
      log.debug({ count: posts.length }, "Fetched trending posts");
    } else if (trending.status === "rejected") {
      log.warn({ err: trending.reason?.message }, "Failed to fetch trending posts");
    }

    return allRows;
  }
}

// ── CLI Entry Point ──────────────────────────────────────

const worker = new NewsIngestionWorker();
runWorkerCLI(worker);

export { NewsIngestionWorker };
