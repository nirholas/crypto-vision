/**
 * Crypto Vision — Market Data Ingestion Worker
 *
 * Fetches market snapshots, prices, trending coins, global stats,
 * and Fear & Greed from CoinGecko and Alternative.me.
 *
 * Schedule: every 2 minutes
 * Pub/Sub topic: crypto-vision-frequent
 * BigQuery tables: market_snapshots, fear_greed
 */

import { IngestionWorker, runWorkerCLI, type WorkerConfig } from "./worker-base.js";
import { Tables } from "../lib/bigquery.js";
import { Topics } from "../lib/pubsub.js";
import { log } from "../lib/logger.js";
import {
  ingestMarketSnapshots,
  ingestFearGreed,
} from "../lib/bq-ingest.js";
import { channelManager } from "../lib/ws-channels.js";

class MarketIngestionWorker extends IngestionWorker {
  constructor() {
    const config: WorkerConfig = {
      name: "ingest-market",
      intervalMs: 2 * 60 * 1_000, // 2 minutes
      bqTable: Tables.MARKET_SNAPSHOTS,
      pubsubTopic: Topics.FREQUENT,
    };
    super(config);
  }

  async fetch(): Promise<Record<string, unknown>[]> {
    const allRows: Record<string, unknown>[] = [];

    // 1. Market snapshots (top coins)
    try {
      const { getCoins } = await import("../sources/coingecko.js");
      const coins = await getCoins({ perPage: 250, sparkline: false });
      if (coins?.length) {
        // Side-effect: also pushes to BQ via bq-ingest
        ingestMarketSnapshots(coins as unknown as Array<Record<string, unknown>>);

        const rows = coins.map((c) => ({
          type: "market_snapshot",
          coin_id: c.id,
          symbol: c.symbol,
          name: c.name,
          current_price_usd: c.current_price,
          market_cap: c.market_cap,
          market_cap_rank: c.market_cap_rank,
          total_volume: c.total_volume,
          price_change_pct_24h: c.price_change_percentage_24h,
          source: "coingecko",
        }));
        allRows.push(...rows);
        log.debug({ count: coins.length }, "Fetched market snapshots");

        // Broadcast prices to WebSocket channel subscribers
        const priceData: Record<string, { usd: number; change24h: number }> = {};
        for (const c of coins) {
          priceData[c.id] = {
            usd: c.current_price ?? 0,
            change24h: c.price_change_percentage_24h ?? 0,
          };
        }
        channelManager.broadcast("prices", priceData);

        // Extract top movers (>5% change) → broadcast to "market" channel
        const topMovers = coins
          .filter((c) => Math.abs(c.price_change_percentage_24h ?? 0) > 5)
          .slice(0, 10)
          .map((c) => ({
            coinId: c.id,
            symbol: c.symbol,
            name: c.name,
            price: c.current_price,
            change24h: c.price_change_percentage_24h,
          }));
        if (topMovers.length > 0) {
          channelManager.broadcast("market", {
            event: "top_movers",
            movers: topMovers,
          });
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err: msg }, "Failed to fetch market snapshots");
    }

    // 2. Fear & Greed Index
    try {
      const { getFearGreedIndex } = await import("../sources/alternative.js");
      const fgData = await getFearGreedIndex();
      if (fgData?.data?.length) {
        ingestFearGreed(fgData.data as unknown as Array<Record<string, unknown>>);

        const rows = fgData.data.map((d) => ({
          type: "fear_greed",
          value: Number(d.value),
          classification: d.value_classification,
          timestamp_unix: Number(d.timestamp),
          source: "alternative.me",
        }));
        allRows.push(...rows);
        log.debug({ count: fgData.data.length }, "Fetched Fear & Greed data");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err: msg }, "Failed to fetch Fear & Greed");
    }

    // 3. Global market stats
    try {
      const { getGlobal } = await import("../sources/coingecko.js");
      const global = await getGlobal();
      if (global) {
        const data = global.data ?? global;
        allRows.push({
          type: "global_stats",
          active_cryptocurrencies: data.active_cryptocurrencies,
          markets: data.markets,
          total_market_cap_usd: data.total_market_cap?.usd,
          total_volume_24h_usd: data.total_volume?.usd,
          market_cap_change_24h_pct: data.market_cap_change_percentage_24h_usd,
          btc_dominance: data.market_cap_percentage?.btc,
          eth_dominance: data.market_cap_percentage?.eth,
          source: "coingecko",
        });
        log.debug("Fetched global market stats");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err: msg }, "Failed to fetch global stats");
    }

    // 4. Trending coins
    try {
      const { getTrending } = await import("../sources/coingecko.js");
      const trending = await getTrending();
      if (trending?.coins?.length) {
        const rows = trending.coins.map((c) => {
          const item = c.item;
          return {
            type: "trending_coin",
            coin_id: item.id,
            name: item.name,
            symbol: item.symbol,
            market_cap_rank: item.market_cap_rank,
            thumb: item.thumb,
            score: item.score,
            source: "coingecko",
          };
        });
        allRows.push(...rows);
        log.debug({ count: trending.coins.length }, "Fetched trending coins");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.warn({ err: msg }, "Failed to fetch trending coins");
    }

    return allRows;
  }
}

// ── CLI Entry Point ──────────────────────────────────────

const worker = new MarketIngestionWorker();
runWorkerCLI(worker);

export { MarketIngestionWorker };
