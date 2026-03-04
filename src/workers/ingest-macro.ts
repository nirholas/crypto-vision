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
    constructor(overrides?: Partial<WorkerConfig>) {
        const config: WorkerConfig = {
            name: "ingest-macro",
            intervalMs: 60 * 60 * 1_000, // 60 minutes
            bqTable: Tables.MARKET_SNAPSHOTS,
            pubsubTopic: Topics.HOURLY,
            ...overrides,
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
                const rows = overview.indices.map((q) => ({
                    type: "macro_index",
                    symbol: q.symbol,
                    name: q.name,
                    price: q.price,
                    change: q.change,
                    change_percent: q.changePercent,
                    market_state: undefined,
                    source: "yahoo_finance",
                }));
                allRows.push(...rows);
                log.debug({ count: overview.indices.length }, "Fetched stock indices");
            }

            // 2. Commodities
            if (overview.commodities?.length) {
                const rows = overview.commodities.map((q) => ({
                    type: "macro_commodity",
                    symbol: q.symbol,
                    name: q.name,
                    price: q.price,
                    change: q.change,
                    change_percent: q.changePercent,
                    source: "yahoo_finance",
                }));
                allRows.push(...rows);
                log.debug({ count: overview.commodities.length }, "Fetched commodities");
            }

            // 3. Bond Yields
            if (overview.bonds?.length) {
                const rows = overview.bonds.map((q) => ({
                    type: "macro_bond",
                    symbol: q.symbol,
                    name: q.name,
                    yield_value: q.price,
                    change: q.change,
                    source: "yahoo_finance",
                }));
                allRows.push(...rows);
                log.debug({ count: overview.bonds.length }, "Fetched bond yields");
            }

            // 4. Volatility (VIX)
            if (overview.volatility) {
                const vix = overview.volatility;
                allRows.push({
                    type: "macro_vix",
                    symbol: vix.symbol ?? "^VIX",
                    value: vix.price,
                    change: vix.change,
                    change_percent: vix.changePercent,
                    source: "yahoo_finance",
                });
                log.debug("Fetched VIX");
            }

            // 5. US Dollar Index
            if (overview.dxy) {
                const dxy = overview.dxy;
                allRows.push({
                    type: "macro_dxy",
                    symbol: dxy.symbol ?? "DX-Y.NYB",
                    value: dxy.price,
                    change: dxy.change,
                    change_percent: dxy.changePercent,
                    source: "yahoo_finance",
                });
                log.debug("Fetched DXY");
            }

            // 6. Crypto Benchmarks (BTC/ETH/SOL via Yahoo)
            if (overview.crypto?.length) {
                const rows = overview.crypto.map((q) => ({
                    type: "macro_crypto_benchmark",
                    symbol: q.symbol,
                    name: q.name,
                    price: q.price,
                    change: q.change,
                    change_percent: q.changePercent,
                    volume: q.volume,
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
