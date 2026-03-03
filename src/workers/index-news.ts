/**
 * Crypto Vision — News Indexer Worker
 *
 * Periodically fetches latest crypto news and indexes into vector store
 * for RAG-powered AI question answering.
 *
 * Schedule: every 5 minutes
 */

import { log } from "../lib/logger.js";
import { vectorStore } from "../lib/vector-store.js";
import { generateEmbedding } from "../lib/embeddings.js";
import { cache } from "../lib/cache.js";

// ─── State ───────────────────────────────────────────────────

let timer: ReturnType<typeof setInterval> | null = null;
let lastRun: string | null = null;
let lastCount = 0;
let errorCount = 0;

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ─── Index Logic ─────────────────────────────────────────────

async function indexNewsArticles(): Promise<number> {
  try {
    // Dynamic import to avoid circular deps and allow the source to be optional
    const { getNews } = await import("../sources/crypto-news.js");
    const response = await getNews({ limit: 50 });
    const articles = response.articles;

    if (!articles?.length) {
      log.debug("News indexer: no articles to index");
      return 0;
    }

    let indexed = 0;

    for (const article of articles) {
      const id = `news:${article.id || article.url || article.title}`;
      const content = [article.title, article.description || "", article.source || ""].join(" ").trim();

      if (!content || content.length < 20) continue;

      // Check if already indexed (cache as dedup)
      const dedup = await cache.get(`idx:${id}`);
      if (dedup) continue;

      try {
        const embedding = await generateEmbedding(content);
        await vectorStore.upsert(id, embedding, content, {
          category: "news",
          source: article.source || "unknown",
          title: article.title,
          url: article.url,
          publishedAt: article.publishedAt || new Date().toISOString(),
        });
        await cache.set(`idx:${id}`, "1", 86400); // dedup for 24h
        indexed++;
      } catch (err: unknown) {
        log.warn({ err, id }, "Failed to index news article");
      }
    }

    lastRun = new Date().toISOString();
    lastCount = indexed;
    errorCount = 0;
    log.info({ indexed, total: articles.length }, "News indexer completed");
    return indexed;
  } catch (err: unknown) {
    errorCount++;
    log.error({ err }, "News indexer failed");
    return 0;
  }
}

// ─── Lifecycle ───────────────────────────────────────────────

export function startNewsIndexer(): void {
  if (timer) return;

  log.info({ intervalMs: INTERVAL_MS }, "Starting news indexer");

  // Run immediately, then on interval
  indexNewsArticles().catch(() => {});
  timer = setInterval(() => {
    indexNewsArticles().catch(() => {});
  }, INTERVAL_MS);
}

export function stopNewsIndexer(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    log.info("News indexer stopped");
  }
}

export function newsIndexerStatus() {
  return {
    running: timer !== null,
    lastRun,
    lastCount,
    errorCount,
    intervalMs: INTERVAL_MS,
  };
}
