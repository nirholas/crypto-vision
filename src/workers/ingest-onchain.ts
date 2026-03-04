/**
 * Crypto Vision — On-Chain Data Ingestion Worker
 *
 * Fetches on-chain data: gas prices (multi-chain), Bitcoin network stats,
 * mempool data, difficulty adjustment, and lightning network info.
 *
 * Schedule: every 5 minutes
 * Pub/Sub topic: crypto-vision-frequent
 * BigQuery tables: gas_prices, bitcoin_network
 */

import { Tables } from "../lib/bigquery.js";
import { ingestBitcoinNetwork, ingestGasPrices } from "../lib/bq-ingest.js";
import { log } from "../lib/logger.js";
import { Topics } from "../lib/pubsub.js";
import { IngestionWorker, runWorkerCLI, type WorkerConfig } from "./worker-base.js";

class OnchainIngestionWorker extends IngestionWorker {
    constructor() {
        const config: WorkerConfig = {
            name: "ingest-onchain",
            intervalMs: 5 * 60 * 1_000, // 5 minutes
            bqTable: Tables.GAS_PRICES,
            pubsubTopic: Topics.FREQUENT,
        };
        super(config);
    }

    async fetch(): Promise<Record<string, unknown>[]> {
        const allRows: Record<string, unknown>[] = [];

        const [evmModule, btcModule, altModule] = await Promise.all([
            import("../sources/evm.js"),
            import("../sources/bitcoin.js"),
            import("../sources/alternative.js"),
        ]);

        const { getMultiChainGas } = evmModule;
        const { getBTCStats, getMempoolStats, getLightningStats } = btcModule;
        const { getBitcoinFees, getDifficultyAdjustment } = altModule;

        // Run all fetches in parallel
        const [gasData, btcStats, mempoolStats, lightningStats, btcFees, diffAdj] = await Promise.allSettled([
            getMultiChainGas(),
            getBTCStats(),
            getMempoolStats(),
            getLightningStats(),
            getBitcoinFees(),
            getDifficultyAdjustment(),
        ]);

        // 1. Multi-chain gas prices
        if (gasData.status === "fulfilled" && gasData.value?.length) {
            const data = gasData.value as unknown as Array<Record<string, unknown>>;
            ingestGasPrices(data);
            const rows = data.map((g) => ({
                type: "gas_price",
                chain: g.chain ?? "ethereum",
                low: g.low,
                average: g.average,
                high: g.high,
                unit: g.unit ?? "gwei",
                source: "evm_rpc",
            }));
            allRows.push(...rows);
            log.debug({ count: data.length }, "Fetched multi-chain gas prices");
        } else if (gasData.status === "rejected") {
            log.warn({ err: gasData.reason?.message }, "Failed to fetch gas prices");
        }

        // 2. Bitcoin network stats
        if (btcStats.status === "fulfilled" && btcStats.value) {
            const stats = btcStats.value as Record<string, unknown>;
            ingestBitcoinNetwork(stats);
            allRows.push({
                type: "bitcoin_network",
                hashrate: stats.hash_rate ?? stats.hashrate,
                difficulty: stats.difficulty,
                block_height: stats.n_blocks_total ?? stats.block_height,
                market_price_usd: stats.market_price_usd,
                trade_volume_usd: stats.trade_volume_usd,
                miners_revenue_usd: stats.miners_revenue_usd,
                source: "blockchain.com",
            });
            log.debug("Fetched Bitcoin network stats");
        } else if (btcStats.status === "rejected") {
            log.warn({ err: btcStats.reason?.message }, "Failed to fetch BTC stats");
        }

        // 3. Mempool stats
        if (mempoolStats.status === "fulfilled" && mempoolStats.value) {
            const mp = mempoolStats.value as Record<string, unknown>;
            allRows.push({
                type: "mempool_stats",
                count: mp.count,
                vsize: mp.vsize,
                total_fee: mp.total_fee,
                source: "mempool.space",
            });
            log.debug("Fetched mempool stats");
        } else if (mempoolStats.status === "rejected") {
            log.warn({ err: mempoolStats.reason?.message }, "Failed to fetch mempool stats");
        }

        // 4. Lightning Network stats
        if (lightningStats.status === "fulfilled" && lightningStats.value) {
            const ln = lightningStats.value as Record<string, unknown>;
            allRows.push({
                type: "lightning_stats",
                channels: ln.channels ?? ln.channel_count,
                nodes: ln.nodes ?? ln.node_count,
                capacity_btc: ln.capacity ?? ln.total_capacity,
                source: "mempool.space",
            });
            log.debug("Fetched Lightning Network stats");
        } else if (lightningStats.status === "rejected") {
            log.warn({ err: lightningStats.reason?.message }, "Failed to fetch Lightning stats");
        }

        // 5. Bitcoin fee estimates
        if (btcFees.status === "fulfilled" && btcFees.value) {
            const fees = btcFees.value as Record<string, unknown>;
            allRows.push({
                type: "bitcoin_fees",
                fastest_fee: fees.fastestFee,
                half_hour_fee: fees.halfHourFee,
                hour_fee: fees.hourFee,
                economy_fee: fees.economyFee,
                minimum_fee: fees.minimumFee,
                source: "mempool.space",
            });
            log.debug("Fetched Bitcoin fee estimates");
        } else if (btcFees.status === "rejected") {
            log.warn({ err: btcFees.reason?.message }, "Failed to fetch BTC fees");
        }

        // 6. Difficulty adjustment
        if (diffAdj.status === "fulfilled" && diffAdj.value) {
            const da = diffAdj.value as Record<string, unknown>;
            allRows.push({
                type: "difficulty_adjustment",
                progress_percent: da.progressPercent,
                difficulty_change: da.difficultyChange,
                estimated_retarget_date: da.estimatedRetargetDate,
                remaining_blocks: da.remainingBlocks,
                remaining_time: da.remainingTime,
                source: "mempool.space",
            });
            log.debug("Fetched difficulty adjustment");
        } else if (diffAdj.status === "rejected") {
            log.warn({ err: diffAdj.reason?.message }, "Failed to fetch difficulty adjustment");
        }

        return allRows;
    }
}

// ── CLI Entry Point ──────────────────────────────────────

const worker = new OnchainIngestionWorker();
runWorkerCLI(worker);

export { OnchainIngestionWorker };
