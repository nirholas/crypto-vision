/**
 * Crypto Vision — Derivatives Ingestion Worker
 *
 * Fetches derivatives data from CoinGlass (funding rates, open interest,
 * liquidations), Hyperliquid (perps), dYdX, and Deribit (options).
 *
 * Schedule: every 10 minutes
 * Pub/Sub topic: crypto-vision-standard
 * BigQuery table: derivatives_snapshots
 */

import { Tables } from "../lib/bigquery.js";
import { ingestDerivativesSnapshots } from "../lib/bq-ingest.js";
import { log } from "../lib/logger.js";
import { Topics } from "../lib/pubsub.js";
import { IngestionWorker, runWorkerCLI, type WorkerConfig } from "./worker-base.js";

class DerivativesIngestionWorker extends IngestionWorker {
    constructor() {
        const config: WorkerConfig = {
            name: "ingest-derivatives",
            intervalMs: 10 * 60 * 1_000, // 10 minutes
            bqTable: Tables.DERIVATIVES_SNAPSHOTS,
            pubsubTopic: Topics.STANDARD,
        };
        super(config);
    }

    async fetch(): Promise<Record<string, unknown>[]> {
        const allRows: Record<string, unknown>[] = [];

        const [coinglassModule, hlModule, deribitModule] = await Promise.all([
            import("../sources/coinglass.js"),
            import("../sources/hyperliquid.js"),
            import("../sources/deribit.js"),
        ]);

        const { getFundingRates, getOpenInterest, getLiquidations } = coinglassModule;
        const { getMetaAndAssetCtxs } = hlModule;
        const { getBookSummary } = deribitModule;

        // Run all fetches in parallel
        const [funding, oi, liqs, hlMeta, deribitBTC, deribitETH] = await Promise.allSettled([
            getFundingRates(),
            getOpenInterest(),
            getLiquidations(),
            getMetaAndAssetCtxs(),
            getBookSummary("BTC"),
            getBookSummary("ETH"),
        ]);

        // 1. CoinGlass Funding Rates
        if (funding.status === "fulfilled" && funding.value?.data?.length) {
            const data = funding.value.data as Array<Record<string, unknown>>;
            const rows: Record<string, unknown>[] = [];
            for (const item of data) {
                const uMarginList = item.uMarginList as Array<Record<string, unknown>> | undefined;
                if (uMarginList?.length) {
                    for (const entry of uMarginList) {
                        rows.push({
                            type: "funding_rate",
                            symbol: item.symbol,
                            exchange: entry.exchangeName,
                            funding_rate: entry.rate,
                            next_funding_time: entry.nextFundingTime,
                            source: "coinglass",
                        });
                    }
                }
            }
            if (rows.length) {
                ingestDerivativesSnapshots(rows, "coinglass");
                allRows.push(...rows);
                log.debug({ count: rows.length }, "Fetched CoinGlass funding rates");
            }
        } else if (funding.status === "rejected") {
            log.warn({ err: funding.reason?.message }, "Failed to fetch funding rates");
        }

        // 2. CoinGlass Open Interest
        if (oi.status === "fulfilled" && oi.value?.data?.length) {
            const data = oi.value.data as Array<Record<string, unknown>>;
            const rows = data.map((d) => ({
                type: "open_interest",
                symbol: d.symbol,
                open_interest_usd: d.openInterest ?? d.openInterestAmount,
                h24_change: d.h24Change,
                source: "coinglass",
            }));
            allRows.push(...rows);
            log.debug({ count: data.length }, "Fetched CoinGlass open interest");
        } else if (oi.status === "rejected") {
            log.warn({ err: oi.reason?.message }, "Failed to fetch open interest");
        }

        // 3. CoinGlass Liquidations
        if (liqs.status === "fulfilled" && liqs.value?.data?.length) {
            const data = liqs.value.data as Array<Record<string, unknown>>;
            const rows = data.map((d) => ({
                type: "liquidation",
                symbol: d.symbol,
                long_liquidation_usd: d.longLiquidationUsd,
                short_liquidation_usd: d.shortLiquidationUsd,
                total_liquidation_usd: d.totalLiquidationUsd,
                source: "coinglass",
            }));
            allRows.push(...rows);
            log.debug({ count: data.length }, "Fetched CoinGlass liquidations");
        } else if (liqs.status === "rejected") {
            log.warn({ err: liqs.reason?.message }, "Failed to fetch liquidations");
        }

        // 4. Hyperliquid Meta + Asset Contexts
        if (hlMeta.status === "fulfilled" && hlMeta.value) {
            const [meta, assetCtxs] = hlMeta.value;
            if (assetCtxs?.length && meta?.universe?.length) {
                const universe = meta.universe as Array<{ name: string }>;
                const rows = assetCtxs.map((ctx: Record<string, unknown>, i: number) => ({
                    type: "perp_meta",
                    symbol: universe[i]?.name ?? `asset-${i}`,
                    funding_rate: ctx.funding,
                    open_interest_usd: ctx.openInterest,
                    mark_price: ctx.markPx,
                    oracle_price: ctx.oraclePx,
                    premium: ctx.premium,
                    source: "hyperliquid",
                }));
                allRows.push(...rows);
                log.debug({ count: rows.length }, "Fetched Hyperliquid perp data");
            }
        } else if (hlMeta.status === "rejected") {
            log.warn({ err: hlMeta.reason?.message }, "Failed to fetch Hyperliquid data");
        }

        // 5 & 6. Deribit Options (BTC + ETH)
        for (const [currency, result] of [["BTC", deribitBTC], ["ETH", deribitETH]] as const) {
            if (result.status === "fulfilled" && result.value?.length) {
                const data = result.value as Array<Record<string, unknown>>;
                const rows = data.slice(0, 100).map((d) => ({
                    type: "options_summary",
                    instrument_name: d.instrument_name,
                    currency,
                    underlying_price: d.underlying_price,
                    mark_price: d.mark_price,
                    bid_price: d.bid_price,
                    ask_price: d.ask_price,
                    open_interest: d.open_interest,
                    volume: d.volume,
                    source: "deribit",
                }));
                allRows.push(...rows);
                log.debug({ count: data.length, currency }, "Fetched Deribit options");
            } else if (result.status === "rejected") {
                log.warn({ err: result.reason?.message, currency }, "Failed to fetch Deribit options");
            }
        }

        return allRows;
    }
}

// ── CLI Entry Point ──────────────────────────────────────

const worker = new DerivativesIngestionWorker();
runWorkerCLI(worker);

export { DerivativesIngestionWorker };
