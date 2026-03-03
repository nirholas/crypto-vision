/**
 * Crypto Vision — On-Chain Data Routes
 *
 * GET /api/onchain/gas              — Multi-chain gas prices
 * GET /api/onchain/bitcoin/fees     — Bitcoin fee estimates
 * GET /api/onchain/bitcoin/stats    — Bitcoin network stats
 * GET /api/onchain/bitcoin/overview — Combined Bitcoin overview
 * GET /api/onchain/token/:addr      — Token info by address (DexScreener)
 * GET /api/onchain/prices           — Multi-chain token prices (DeFiLlama)
 * GET /api/onchain/tvl              — Cross-chain TVL summary
 * GET /api/onchain/tvl/:chain       — Single chain TVL history
 * GET /api/onchain/stablecoins      — Stablecoin on-chain data
 * GET /api/onchain/bridges          — Bridge volume data
 * GET /api/onchain/dex-volume       — On-chain DEX volumes
 */

import { Hono } from "hono";
import { ApiError } from "../lib/api-error.js";
import * as alt from "../sources/alternative.js";
import * as llama from "../sources/defillama.js";
import * as bc from "../sources/blockchain.js";

export const onchainRoutes = new Hono();

// ─── GET /api/onchain/gas ────────────────────────────────────

onchainRoutes.get("/gas", async (c) => {
  // Aggregate gas from multiple sources
  const btcFees = await alt.getBitcoinFees();

  return c.json({
    data: {
      bitcoin: {
        fastest: btcFees.fastestFee,
        halfHour: btcFees.halfHourFee,
        hour: btcFees.hourFee,
        economy: btcFees.economyFee,
        minimum: btcFees.minimumFee,
        unit: "sat/vB",
      },
      // TODO: Add EVM gas from on-chain RPCs when GCP infra is ready
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/fees ───────────────────────────

onchainRoutes.get("/bitcoin/fees", async (c) => {
  const data = await alt.getBitcoinFees();

  return c.json({
    data: {
      ...data,
      unit: "sat/vB",
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/stats ──────────────────────────

onchainRoutes.get("/bitcoin/stats", async (c) => {
  const hashrate = await alt.getBitcoinHashrate();

  return c.json({
    data: hashrate,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/token/:address ─────────────────────────

onchainRoutes.get("/token/:address", async (c) => {
  const { pairs } = await alt.dexTokenPairs(c.req.param("address"));

  if (!pairs || pairs.length === 0) {
    return ApiError.notFound(c, `Token not found for address: ${c.req.param("address")}`);
  }

  return c.json({
    data: {
      token: pairs[0].baseToken,
      pairs: pairs.slice(0, 20).map((p) => ({
        chain: p.chainId,
        dex: p.dexId,
        pair: p.pairAddress,
        quoteToken: p.quoteToken,
        priceUsd: p.priceUsd,
        volume24h: p.volume?.h24,
        liquidity: p.liquidity?.usd,
        fdv: p.fdv,
        txns24h: p.txns?.h24,
        createdAt: p.pairCreatedAt,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/prices ─────────────────────────────────

onchainRoutes.get("/prices", async (c) => {
  const coins = c.req.query("coins"); // format: "ethereum:0x...,bsc:0x..."
  if (!coins) {
    return ApiError.missingParam(c, "coins");
  }

  const data = await llama.getTokenPrices(coins.split(","));

  return c.json({
    data: data.coins,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/overview ───────────────────────

onchainRoutes.get("/bitcoin/overview", async (c) => {
  const [fees, hashrate] = await Promise.all([
    alt.getBitcoinFees(),
    alt.getBitcoinHashrate(),
  ]);

  return c.json({
    data: {
      fees: {
        fastest: fees.fastestFee,
        halfHour: fees.halfHourFee,
        hour: fees.hourFee,
        economy: fees.economyFee,
        minimum: fees.minimumFee,
        unit: "sat/vB",
      },
      network: hashrate,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/tvl ────────────────────────────────────

onchainRoutes.get("/tvl", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const chains = await llama.getChainsTVL();

  return c.json({
    data: chains
      .filter((ch) => ch.tvl > 0)
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, limit)
      .map((ch) => ({
        name: ch.name,
        tvl: ch.tvl,
        tokenSymbol: ch.tokenSymbol,
        chainId: ch.chainId,
      })),
    totalTvl: chains.reduce((sum, ch) => sum + ch.tvl, 0),
    chainCount: chains.filter((ch) => ch.tvl > 0).length,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/tvl/:chain ─────────────────────────────

onchainRoutes.get("/tvl/:chain", async (c) => {
  const data = await llama.getChainTVLHistory(c.req.param("chain"));

  return c.json({
    data: data.slice(-365),
    chain: c.req.param("chain"),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/stablecoins ────────────────────────────

onchainRoutes.get("/stablecoins", async (c) => {
  const { peggedAssets } = await llama.getStablecoins();

  return c.json({
    data: peggedAssets
      .map((s) => {
        const totalCirculating = Object.values(s.circulating).reduce(
          (sum, ch) => sum + ((ch as any).peggedUSD || 0),
          0
        );
        return {
          name: s.name,
          symbol: s.symbol,
          pegType: s.pegType,
          circulating: totalCirculating,
          chainCount: s.chains.length,
          chains: s.chains,
        };
      })
      .filter((s) => s.circulating > 0)
      .sort((a, b) => b.circulating - a.circulating),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bridges ────────────────────────────────

onchainRoutes.get("/bridges", async (c) => {
  const { bridges } = await llama.getBridges();

  return c.json({
    data: (bridges || [])
      .sort((a, b) => (b.volumePrevDay || 0) - (a.volumePrevDay || 0))
      .map((b) => ({
        name: b.displayName || b.name,
        volumePrevDay: b.volumePrevDay,
        chains: b.chains,
      })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/dex-volume ─────────────────────────────

onchainRoutes.get("/dex-volume", async (c) => {
  const data = await llama.getDexVolumes();

  return c.json({
    data: {
      protocols: (data.protocols || [])
        .sort((a, b) => (b.total24h || 0) - (a.total24h || 0))
        .slice(0, 50)
        .map((p) => ({
          name: p.name,
          volume24h: p.total24h,
          volume7d: p.total7d,
          change1d: p.change_1d,
        })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/mempool ────────────────────────

onchainRoutes.get("/bitcoin/mempool", async (c) => {
  const [stats, unconfirmed] = await Promise.all([
    bc.getMempoolStats(),
    bc.getUnconfirmedCount(),
  ]);

  return c.json({
    data: {
      txCount: stats.count,
      vsize: stats.vsize,
      totalFee: stats.total_fee,
      unconfirmedCount: unconfirmed,
      feeHistogram: stats.fee_histogram?.slice(0, 15),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/blocks ─────────────────────────

onchainRoutes.get("/bitcoin/blocks", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 10), 15);
  const blocks = await bc.getRecentBlocks();

  return c.json({
    data: blocks.slice(0, limit).map((b) => ({
      hash: b.id,
      height: b.height,
      timestamp: new Date(b.timestamp * 1000).toISOString(),
      txCount: b.tx_count,
      size: b.size,
      weight: b.weight,
      difficulty: b.difficulty,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/difficulty ─────────────────────

onchainRoutes.get("/bitcoin/difficulty", async (c) => {
  const adj = await bc.getDifficultyAdjustment();

  return c.json({
    data: {
      progressPercent: adj.progressPercent,
      difficultyChange: adj.difficultyChange,
      estimatedRetargetDate: new Date(adj.estimatedRetargetDate).toISOString(),
      remainingBlocks: adj.remainingBlocks,
      remainingTime: adj.remainingTime,
      previousRetarget: adj.previousRetarget,
      nextRetargetHeight: adj.nextRetargetHeight,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/lightning ──────────────────────

onchainRoutes.get("/bitcoin/lightning", async (c) => {
  const data = await bc.getLightningStats();
  const l = data.latest;

  return c.json({
    data: {
      channels: l.channel_count,
      nodes: l.node_count,
      totalCapacitySats: l.total_capacity,
      totalCapacityBtc: l.total_capacity / 1e8,
      avgCapacity: l.avg_capacity,
      avgFeeRate: l.avg_fee_rate,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/miners ─────────────────────────

onchainRoutes.get("/bitcoin/miners", async (c) => {
  const period = c.req.query("period") || "1w";
  const data = await bc.getMiningPools(period);

  return c.json({
    data: {
      totalBlocks: data.blockCount,
      hashrate: data.lastEstimatedHashrate,
      pools: (data.pools || []).map((p) => ({
        name: p.name,
        rank: p.rank,
        blocks: p.blockCount,
        share: data.blockCount > 0
          ? Number(((p.blockCount / data.blockCount) * 100).toFixed(2))
          : 0,
      })),
    },
    period,
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/address/:addr ──────────────────

onchainRoutes.get("/bitcoin/address/:addr", async (c) => {
  const address = c.req.param("addr");
  const data = await bc.getAddressInfo(address);

  const chain = data.chain_stats;
  const mempool = data.mempool_stats;
  const balanceSats =
    chain.funded_txo_sum - chain.spent_txo_sum +
    mempool.funded_txo_sum - mempool.spent_txo_sum;

  return c.json({
    data: {
      address: data.address,
      balanceSats,
      balanceBtc: balanceSats / 1e8,
      txCount: chain.tx_count,
      totalReceived: chain.funded_txo_sum,
      totalSent: chain.spent_txo_sum,
      unconfirmedTxs: mempool.funded_txo_count + mempool.spent_txo_count,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/onchain/bitcoin/network ────────────────────────

onchainRoutes.get("/bitcoin/network", async (c) => {
  const stats = await bc.getBtcStats();

  return c.json({
    data: {
      price: stats.market_price_usd,
      hashrate: stats.hash_rate,
      difficulty: stats.difficulty,
      blockHeight: stats.n_blocks_total,
      minutesBetweenBlocks: stats.minutes_between_blocks,
      totalBtcMined: stats.totalbc / 1e8,
      tx24h: stats.n_tx,
      blocksMined24h: stats.n_blocks_mined,
      tradingVolume24h: stats.trade_volume_usd,
      minersRevenue24h: stats.miners_revenue_usd,
      totalFees24h: stats.total_fees_btc / 1e8,
      estimatedTxVolume24h: stats.estimated_transaction_volume_usd,
    },
    source: "blockchain.info",
    timestamp: new Date().toISOString(),
  });
});

