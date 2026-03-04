/**
 * Crypto Vision — Historical Backfill Worker
 *
 * One-time or periodic backfill of historical data for:
 * - OHLC candles (top coins, 1-year history)
 * - Protocol detail snapshots (top protocols by TVL)
 * - Historical TVL data
 *
 * This worker is designed to be run as a one-shot Cloud Run Job.
 * It processes work in batches with rate limiting to avoid
 * overwhelming upstream APIs.
 *
 * Schedule: on-demand (or daily for catch-up)
 * Pub/Sub topic: crypto-vision-daily
 * BigQuery tables: ohlc_candles, defi_protocols
 */

import { IngestionWorker, runWorkerCLI, type WorkerConfig } from "./worker-base.js";
import { Tables } from "../lib/bigquery.js";
import { Topics } from "../lib/pubsub.js";
import { log } from "../lib/logger.js";
import { ingestOHLCCandles, ingestDefiProtocols } from "../lib/bq-ingest.js";

/** Rate-limit helper: sleep between API calls */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Top coins to backfill OHLC data for */
const TOP_COINS = [
  "bitcoin", "ethereum", "solana", "binancecoin", "ripple",
  "cardano", "dogecoin", "avalanche-2", "polkadot", "chainlink",
  "tron", "polygon-ecosystem-token", "near", "litecoin", "bitcoin-cash",
  "uniswap", "internet-computer", "cosmos", "stellar", "arbitrum",
  "optimism", "aptos", "sui", "sei-network", "injective-protocol",
  "stacks", "celestia", "filecoin", "immutable-x", "render-token",
  "fetch-ai", "kaspa", "pepe", "floki", "bonk",
  "jupiter-exchange-solana", "jito-governance-token", "pyth-network",
  "raydium", "ondo-finance", "ethena", "mantle", "beam-2",
  "worldcoin-wld", "aave", "maker", "lido-dao", "rocket-pool",
  "pendle", "eigenlayer",
];

class BackfillWorker extends IngestionWorker {
  constructor(overrides?: Partial<WorkerConfig>) {
    const config: WorkerConfig = {
      name: "backfill-historical",
      intervalMs: 24 * 60 * 60 * 1_000, // 24 hours (one-shot or daily)
      bqTable: Tables.OHLC_CANDLES,
      pubsubTopic: Topics.DAILY,
      ...overrides,
    };
    super(config);
  }

  async fetch(): Promise<Record<string, unknown>[]> {
    const allRows: Record<string, unknown>[] = [];

    // ── Phase 1: OHLC Candle Backfill ────────────────────

    log.info({ coins: TOP_COINS.length }, "Starting OHLC backfill");

    try {
      const { getOHLC } = await import("../sources/coingecko.js");

      for (const coinId of TOP_COINS) {
        try {
          // Fetch 365-day OHLC data (returns [timestamp, open, high, low, close])
          const candles = await getOHLC(coinId, 365);
          if (candles?.length) {
            // Side-effect: also pushes to BQ via bq-ingest
            ingestOHLCCandles(coinId, candles);

            const rows = candles.map((c: [number, number, number, number, number]) => ({
              type: "ohlc_candle",
              coin_id: coinId,
              timestamp_ms: c[0],
              open: c[1],
              high: c[2],
              low: c[3],
              close: c[4],
              source: "coingecko",
            }));
            allRows.push(...rows);
            log.debug({ coinId, candles: candles.length }, "Backfilled OHLC candles");
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          log.warn({ coinId, err: msg }, "Failed to backfill OHLC for coin");
        }

        // Rate limit: 500ms between CoinGecko calls
        await delay(500);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err: msg }, "OHLC backfill phase failed");
    }

    // ── Phase 2: Protocol Detail Backfill ────────────────

    log.info("Starting protocol detail backfill");

    try {
      const { getProtocols, getProtocolDetail } = await import("../sources/defillama.js");
      const protocols = await getProtocols();

      if (protocols?.length) {
        // Take top 200 by TVL
        const sorted = protocols
          .filter((p) => typeof p.tvl === "number" && p.tvl > 0)
          .sort((a, b) => (b.tvl || 0) - (a.tvl || 0))
          .slice(0, 200);

        for (const protocol of sorted) {
          try {
            const detail = await getProtocolDetail(String(protocol.slug));
            if (detail) {
              allRows.push({
                type: "protocol_detail",
                protocol_slug: protocol.slug,
                name: protocol.name,
                category: protocol.category,
                tvl_history_length: (detail.tvl as unknown[])?.length ?? 0,
                current_tvl: protocol.tvl,
                chains: protocol.chains,
                source: "defillama",
              });
            }
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log.warn({ slug: protocol.slug, err: msg }, "Failed to backfill protocol detail");
          }

          // Rate limit: 200ms between DeFiLlama calls (generous rate limit)
          await delay(200);
        }

        // Also send top protocols to BQ
        ingestDefiProtocols(sorted as unknown as Array<Record<string, unknown>>);
        log.debug({ count: sorted.length }, "Backfilled protocol details");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error({ err: msg }, "Protocol detail backfill phase failed");
    }

    log.info({ totalRows: allRows.length }, "Historical backfill complete");
    return allRows;
  }
}

// ── CLI Entry Point ──────────────────────────────────────

const worker = new BackfillWorker();
runWorkerCLI(worker);

export { BackfillWorker };
