/**
 * Crypto Vision — Macro Data Ingestion Worker
 *
 * Fetches traditional macro indicators from Yahoo Finance:
 * stock indices, commodities, bond yields, VIX, DXY, and
 * crypto benchmarks.
 *
 * Schedule: every 60 minutes
 * Pub/Sub topic: crypto-vision-hourly
 * BigQuery table: market_snapshots (reuses same table with source=macro)
 */

import { Tables } from "../lib/bigquery.js";
import { log } from "../lib/logger.js";
import { Topics } from "../lib/pubsub.js";
import { IngestionWorker, runWorkerCLI, type WorkerConfig } from "./worker-base.js";

class MacroIngestionWorker extends IngestionWorker {
    constructor() {
        const config: WorkerConfig = {
            name: "ingest-macro",
            intervalMs: 60 * 60 * 1_000, // 60 minutes
            bqTable: Tables.MARKET_SNAPSHOTS,
            pubsubTopic: Topics.HOURLY,
        };
        super(config);
    }

    async fetch(): Promise<Record<string, unknown>[]> {
        const allRows: Record<string, unknown>[] = [];

        const { getMacroOverview } = await import("../sources/macro.js");

        try {
            const overview = await getMacroOverview();
            if (!overview) return allRows;

            // 1. Stock Indices
            if (overview.indices?.length) {
                const rows = overview.indices.map((q: Record<string, unknown>) => ({
                    type: "macro_index",
                    symbol: q.symbol,
                    name: q.shortName ?? q.longName,
                    price: q.regularMarketPrice,
                    change: q.regularMarketChange,
                    change_percent: q.regularMarketChangePercent,
                    market_state: q.marketState,
                    source: "yahoo_finance",
                }));
                allRows.push(...rows);
                log.debug({ count: overview.indices.length }, "Fetched stock indices");
            }

            // 2. Commodities
            if (overview.commodities?.length) {
                const rows = overview.commodities.map((q: Record<string, unknown>) => ({
                    type: "macro_commodity",
                    symbol: q.symbol,
                    name: q.shortName ?? q.longName,
                    price: q.regularMarketPrice,
                    change: q.regularMarketChange,
                    change_percent: q.regularMarketChangePercent,
                    source: "yahoo_finance",
                }));
                allRows.push(...rows);
                log.debug({ count: overview.commodities.length }, "Fetched commodities");
            }

            // 3. Bond Yields
            if (overview.bonds?.length) {
                const rows = overview.bonds.map((q: Record<string, unknown>) => ({
                    type: "macro_bond",
                    symbol: q.symbol,
                    name: q.shortName ?? q.longName,
                    yield_value: q.regularMarketPrice,
                    change: q.regularMarketChange,
                    source: "yahoo_finance",
                }));
                allRows.push(...rows);
                log.debug({ count: overview.bonds.length }, "Fetched bond yields");
            }

            // 4. Volatility (VIX)
            if (overview.vix) {
                const vix = overview.vix as Record<string, unknown>;
                allRows.push({
                    type: "macro_vix",
                    symbol: vix.symbol ?? "^VIX",
                    value: vix.regularMarketPrice,
                    change: vix.regularMarketChange,
                    change_percent: vix.regularMarketChangePercent,
                    source: "yahoo_finance",
                });
                log.debug("Fetched VIX");
            }

            // 5. US Dollar Index
            if (overview.dxy) {
                const dxy = overview.dxy as Record<string, unknown>;
                allRows.push({
                    type: "macro_dxy",
                    symbol: dxy.symbol ?? "DX-Y.NYB",
                    value: dxy.regularMarketPrice,
                    change: dxy.regularMarketChange,
                    change_percent: dxy.regularMarketChangePercent,
                    source: "yahoo_finance",
                });
                log.debug("Fetched DXY");
            }

            // 6. Crypto Benchmarks (BTC/ETH/SOL via Yahoo)
            if (overview.crypto?.length) {
                const rows = overview.crypto.map((q: Record<string, unknown>) => ({
                    type: "macro_crypto_benchmark",
                    symbol: q.symbol,
                    name: q.shortName ?? q.longName,
                    price: q.regularMarketPrice,
                    change: q.regularMarketChange,
                    change_percent: q.regularMarketChangePercent,
                    volume: q.regularMarketVolume,
                    source: "yahoo_finance",
                }));
                allRows.push(...rows);
                log.debug({ count: overview.crypto.length }, "Fetched crypto benchmarks");
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            log.warn({ err: msg }, "Failed to fetch macro overview");
        }

        return allRows;
    }
}

// ── CLI Entry Point ──────────────────────────────────────

const worker = new MacroIngestionWorker();
runWorkerCLI(worker);

export { MacroIngestionWorker };
