/**
 * Crypto Vision — DEX Data Ingestion Worker
 *
 * Fetches DEX pair data from DexScreener (via alternative.ts) and
 * GeckoTerminal for trending pools, new pools, and top pairs.
 *
 * Schedule: every 2 minutes
 * Pub/Sub topic: crypto-vision-frequent
 * BigQuery table: dex_pairs
 */

import { IngestionWorker, runWorkerCLI, type WorkerConfig } from "./worker-base.js";
import { Tables } from "../lib/bigquery.js";
import { Topics } from "../lib/pubsub.js";
import { log } from "../lib/logger.js";
import { ingestDexPairs } from "../lib/bq-ingest.js";

class DexIngestionWorker extends IngestionWorker {
  constructor() {
    const config: WorkerConfig = {
      name: "ingest-dex",
      intervalMs: 2 * 60 * 1_000, // 2 minutes
      bqTable: Tables.DEX_PAIRS,
      pubsubTopic: Topics.FREQUENT,
    };
    super(config);
  }

  async fetch(): Promise<Record<string, unknown>[]> {
    const allRows: Record<string, unknown>[] = [];

    // Fetch from both DexScreener (via alternative.ts) and GeckoTerminal
    const [altModule, geckoModule] = await Promise.all([
      import("../sources/alternative.js"),
      import("../sources/geckoterminal.js"),
    ]);

    const { getTrendingDexPairs } = altModule;
    const { getTrendingPools, getNewPools, getTopPools } = geckoModule;

    // Run all fetches in parallel
    const [dexTrending, gtTrending, gtNew, gtTopEth, gtTopSol] = await Promise.allSettled([
      getTrendingDexPairs(),
      getTrendingPools(),
      getNewPools(),
      getTopPools("eth"),
      getTopPools("solana"),
    ]);

    // 1. DexScreener trending pairs
    if (dexTrending.status === "fulfilled" && dexTrending.value?.length) {
      const pairs = dexTrending.value as unknown as Array<Record<string, unknown>>;
      ingestDexPairs(pairs, "dexscreener");
      const rows = pairs.map((p) => ({
        type: "dex_pair",
        pair_address: p.pairAddress ?? p.address,
        chain_id: p.chainId ?? p.chain,
        dex_id: p.dexId ?? p.dex,
        base_token_symbol: typeof p.baseToken === "object" ? (p.baseToken as Record<string, unknown>)?.symbol : p.baseTokenSymbol,
        price_usd: p.priceUsd ?? p.price_usd,
        volume_24h: typeof p.volume === "object" ? (p.volume as Record<string, unknown>)?.h24 : p.volume_24h,
        liquidity_usd: typeof p.liquidity === "object" ? (p.liquidity as Record<string, unknown>)?.usd : p.liquidity_usd,
        source: "dexscreener",
      }));
      allRows.push(...rows);
      log.debug({ count: pairs.length }, "Fetched DexScreener trending pairs");
    } else if (dexTrending.status === "rejected") {
      log.warn({ err: dexTrending.reason?.message }, "Failed to fetch DexScreener trending");
    }

    // 2. GeckoTerminal trending pools
    if (gtTrending.status === "fulfilled") {
      const poolData = gtTrending.value?.data ?? [];
      if (poolData.length) {
        const rows = (poolData as Array<Record<string, unknown>>).map((p) => {
          const attrs = (p as { attributes?: Record<string, unknown> }).attributes ?? p;
          return {
            type: "dex_pool_trending",
            pool_address: attrs.address ?? (p as Record<string, unknown>).id,
            name: attrs.name,
            fdv_usd: attrs.fdv_usd,
            reserve_in_usd: attrs.reserve_in_usd,
            volume_usd_h24: (attrs.volume_usd as Record<string, unknown>)?.h24,
            price_change_h24: (attrs.price_change_percentage as Record<string, unknown>)?.h24,
            source: "geckoterminal",
          };
        });
        allRows.push(...rows);
        log.debug({ count: poolData.length }, "Fetched GeckoTerminal trending pools");
      }
    } else if (gtTrending.status === "rejected") {
      log.warn({ err: gtTrending.reason?.message }, "Failed to fetch GeckoTerminal trending");
    }

    // 3. GeckoTerminal new pools
    if (gtNew.status === "fulfilled") {
      const poolData = gtNew.value?.data ?? [];
      if (poolData.length) {
        const rows = (poolData as Array<Record<string, unknown>>).map((p) => {
          const attrs = (p as { attributes?: Record<string, unknown> }).attributes ?? p;
          return {
            type: "dex_pool_new",
            pool_address: attrs.address ?? (p as Record<string, unknown>).id,
            name: attrs.name,
            pool_created_at: attrs.pool_created_at,
            reserve_in_usd: attrs.reserve_in_usd,
            source: "geckoterminal",
          };
        });
        allRows.push(...rows);
        log.debug({ count: poolData.length }, "Fetched GeckoTerminal new pools");
      }
    } else if (gtNew.status === "rejected") {
      log.warn({ err: gtNew.reason?.message }, "Failed to fetch GeckoTerminal new pools");
    }

    // 4 & 5. GeckoTerminal top pools (ETH + SOL)
    for (const [label, result] of [["eth", gtTopEth], ["solana", gtTopSol]] as const) {
      if (result.status === "fulfilled") {
        const poolData = result.value?.data ?? [];
        if (poolData.length) {
          const rows = (poolData as Array<Record<string, unknown>>).map((p) => {
            const attrs = (p as { attributes?: Record<string, unknown> }).attributes ?? p;
            return {
              type: "dex_pool_top",
              chain: label,
              pool_address: attrs.address ?? (p as Record<string, unknown>).id,
              name: attrs.name,
              reserve_in_usd: attrs.reserve_in_usd,
              volume_usd_h24: (attrs.volume_usd as Record<string, unknown>)?.h24,
              source: "geckoterminal",
            };
          });
          allRows.push(...rows);
          log.debug({ count: poolData.length, chain: label }, "Fetched GeckoTerminal top pools");
        }
      } else if (result.status === "rejected") {
        log.warn({ err: result.reason?.message, chain: label }, "Failed to fetch GT top pools");
      }
    }

    return allRows;
  }
}

// ── CLI Entry Point ──────────────────────────────────────

const worker = new DexIngestionWorker();
runWorkerCLI(worker);

export { DexIngestionWorker };
