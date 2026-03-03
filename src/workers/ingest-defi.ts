/**
 * Crypto Vision — DeFi Data Ingestion Worker
 *
 * Fetches DeFi protocol TVL, chain TVL, yield pools, stablecoins,
 * DEX volumes, fees/revenue, bridges, and funding rounds from DeFiLlama.
 *
 * Schedule: every 5 minutes
 * Pub/Sub topic: crypto-vision-standard
 * BigQuery tables: defi_protocols, chain_tvl, yield_pools, stablecoin_supply,
 *                  funding_rounds
 */

import { IngestionWorker, runWorkerCLI, type WorkerConfig } from "./worker-base.js";
import { Tables } from "../lib/bigquery.js";
import { Topics } from "../lib/pubsub.js";
import { log } from "../lib/logger.js";
import {
  ingestDefiProtocols,
  ingestYieldPools,
  ingestChainTVL,
  ingestStablecoinSupply,
  ingestFundingRounds,
} from "../lib/bq-ingest.js";

class DefiIngestionWorker extends IngestionWorker {
  constructor() {
    const config: WorkerConfig = {
      name: "ingest-defi",
      intervalMs: 5 * 60 * 1_000, // 5 minutes
      bqTable: Tables.DEFI_PROTOCOLS,
      pubsubTopic: Topics.STANDARD,
    };
    super(config);
  }

  async fetch(): Promise<Record<string, unknown>[]> {
    const allRows: Record<string, unknown>[] = [];

    const { getProtocols, getChainsTVL, getYieldPools, getStablecoins, getDexVolumes, getFeesRevenue, getBridges, getRaises } =
      await import("../sources/defillama.js");

    // Run all fetches in parallel for speed
    const [protocols, chains, yieldsResp, stables, dexVols, fees, bridges, raises] = await Promise.allSettled([
      getProtocols(),
      getChainsTVL(),
      getYieldPools(),
      getStablecoins(),
      getDexVolumes(),
      getFeesRevenue(),
      getBridges(),
      getRaises(),
    ]);

    // 1. Protocols
    if (protocols.status === "fulfilled" && protocols.value?.length) {
      const data = protocols.value as unknown as Array<Record<string, unknown>>;
      ingestDefiProtocols(data);
      const rows = data.slice(0, 500).map((p) => ({
        type: "defi_protocol",
        protocol_slug: p.slug ?? p.name,
        name: p.name,
        category: p.category,
        chain: p.chain ?? (p.chains as string[] | undefined)?.[0],
        tvl_usd: p.tvl,
        change_1d: p.change_1d,
        change_7d: p.change_7d,
        source: "defillama",
      }));
      allRows.push(...rows);
      log.debug({ count: data.length }, "Fetched DeFi protocols");
    } else if (protocols.status === "rejected") {
      log.warn({ err: protocols.reason?.message }, "Failed to fetch DeFi protocols");
    }

    // 2. Chain TVL
    if (chains.status === "fulfilled" && chains.value?.length) {
      const data = chains.value as unknown as Array<Record<string, unknown>>;
      ingestChainTVL(data);
      const rows = data.map((c) => ({
        type: "chain_tvl",
        chain_name: c.name ?? c.gecko_id,
        tvl_usd: c.tvl,
        protocols_count: c.protocols,
        source: "defillama",
      }));
      allRows.push(...rows);
      log.debug({ count: data.length }, "Fetched chain TVL");
    } else if (chains.status === "rejected") {
      log.warn({ err: chains.reason?.message }, "Failed to fetch chain TVL");
    }

    // 3. Yield Pools
    if (yieldsResp.status === "fulfilled") {
      const pools = (yieldsResp.value as { data?: unknown[] })?.data ?? [];
      if (pools.length) {
        ingestYieldPools(pools as Array<Record<string, unknown>>);
        // Only send top 1000 to Pub/Sub (yields can be huge)
        const rows = (pools as Array<Record<string, unknown>>).slice(0, 1_000).map((p) => ({
          type: "yield_pool",
          pool_id: p.pool ?? p.configID,
          chain: p.chain,
          project: p.project,
          symbol: p.symbol,
          tvl_usd: p.tvlUsd,
          apy: p.apy,
          source: "defillama",
        }));
        allRows.push(...rows);
        log.debug({ count: pools.length }, "Fetched yield pools");
      }
    } else if (yieldsResp.status === "rejected") {
      log.warn({ err: yieldsResp.reason?.message }, "Failed to fetch yield pools");
    }

    // 4. Stablecoins
    if (stables.status === "fulfilled") {
      const assets = (stables.value as { peggedAssets?: unknown[] })?.peggedAssets ?? [];
      if (assets.length) {
        ingestStablecoinSupply(assets as Array<Record<string, unknown>>);
        const rows = (assets as Array<Record<string, unknown>>).map((s) => ({
          type: "stablecoin",
          name: s.name,
          symbol: s.symbol,
          peg_type: s.pegType,
          circulating: s.circulating ?? s.circulatingSupply,
          source: "defillama",
        }));
        allRows.push(...rows);
        log.debug({ count: assets.length }, "Fetched stablecoins");
      }
    } else if (stables.status === "rejected") {
      log.warn({ err: stables.reason?.message }, "Failed to fetch stablecoins");
    }

    // 5. DEX Volumes
    if (dexVols.status === "fulfilled") {
      const protos = (dexVols.value as { protocols?: unknown[] })?.protocols ?? [];
      if (protos.length) {
        const rows = (protos as Array<Record<string, unknown>>).slice(0, 200).map((d) => ({
          type: "dex_volume",
          name: d.name ?? d.displayName,
          total24h: d.total24h,
          total7d: d.total7d,
          total30d: d.total30d,
          change_1d: d.change_1d,
          source: "defillama",
        }));
        allRows.push(...rows);
        log.debug({ count: protos.length }, "Fetched DEX volumes");
      }
    } else if (dexVols.status === "rejected") {
      log.warn({ err: dexVols.reason?.message }, "Failed to fetch DEX volumes");
    }

    // 6. Fees & Revenue
    if (fees.status === "fulfilled") {
      const protos = (fees.value as { protocols?: unknown[] })?.protocols ?? [];
      if (protos.length) {
        const rows = (protos as Array<Record<string, unknown>>).slice(0, 200).map((f) => ({
          type: "fees_revenue",
          name: f.name ?? f.displayName,
          total24h: f.total24h,
          total7d: f.total7d,
          totalAllTime: f.totalAllTime,
          source: "defillama",
        }));
        allRows.push(...rows);
        log.debug({ count: protos.length }, "Fetched fees/revenue");
      }
    } else if (fees.status === "rejected") {
      log.warn({ err: fees.reason?.message }, "Failed to fetch fees/revenue");
    }

    // 7. Bridges
    if (bridges.status === "fulfilled") {
      const bridgeList = (bridges.value as { bridges?: unknown[] })?.bridges ?? [];
      if (bridgeList.length) {
        const rows = (bridgeList as Array<Record<string, unknown>>).map((b) => ({
          type: "bridge",
          name: b.name ?? b.displayName,
          lastDailyVolume: b.lastDailyVolume,
          currentDayVolume: b.currentDayVolume,
          chains: b.chains,
          source: "defillama",
        }));
        allRows.push(...rows);
        log.debug({ count: bridgeList.length }, "Fetched bridges");
      }
    } else if (bridges.status === "rejected") {
      log.warn({ err: bridges.reason?.message }, "Failed to fetch bridges");
    }

    // 8. Funding Rounds
    if (raises.status === "fulfilled") {
      const raiseList = (raises.value as { raises?: unknown[] })?.raises ?? [];
      if (raiseList.length) {
        ingestFundingRounds(raiseList as Array<Record<string, unknown>>);
        const rows = (raiseList as Array<Record<string, unknown>>).slice(0, 200).map((r) => ({
          type: "funding_round",
          name: r.name,
          category: r.category ?? r.sector,
          amount: r.amount,
          round_type: r.round ?? r.roundType,
          date: r.date,
          source: "defillama",
        }));
        allRows.push(...rows);
        log.debug({ count: raiseList.length }, "Fetched funding rounds");
      }
    } else if (raises.status === "rejected") {
      log.warn({ err: raises.reason?.message }, "Failed to fetch funding rounds");
    }

    return allRows;
  }
}

// ── CLI Entry Point ──────────────────────────────────────

const worker = new DefiIngestionWorker();
runWorkerCLI(worker);

export { DefiIngestionWorker };
