/**
 * Crypto Vision — Bitcoin Routes
 *
 * Deep Bitcoin data via mempool.space + blockchain.info (free, no key).
 *
 * GET /api/bitcoin/price           — BTC price ticker (multi-currency)
 * GET /api/bitcoin/stats           — Network stats (hashrate, difficulty, etc.)
 * GET /api/bitcoin/fees            — Fee estimates
 * GET /api/bitcoin/mempool         — Mempool stats (pending txns, fees)
 * GET /api/bitcoin/difficulty      — Difficulty adjustment progress
 * GET /api/bitcoin/lightning       — Lightning Network stats
 * GET /api/bitcoin/address/:addr   — Address balance & tx count
 * GET /api/bitcoin/tx/:txid        — Transaction details
 * GET /api/bitcoin/block-height    — Latest block height
 */

import { Hono } from "hono";
import * as btc from "../sources/bitcoin.js";
import * as alt from "../sources/alternative.js";

export const bitcoinRoutes = new Hono();

// ─── GET /api/bitcoin/price ──────────────────────────────────

bitcoinRoutes.get("/price", async (c) => {
  const ticker = await btc.getBTCPrice();

  return c.json({
    data: Object.entries(ticker).map(([currency, data]) => ({
      currency,
      last: data.last,
      buy: data.buy,
      sell: data.sell,
      symbol: data.symbol,
    })),
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/bitcoin/stats ──────────────────────────────────

bitcoinRoutes.get("/stats", async (c) => {
  const stats = await btc.getBTCStats();

  return c.json({
    data: {
      priceUsd: stats.market_price_usd,
      hashRate: stats.hash_rate,
      difficulty: stats.difficulty,
      minutesBetweenBlocks: stats.minutes_between_blocks,
      totalBlocks: stats.n_blocks_total,
      blocksMinedToday: stats.n_blocks_mined,
      transactionsToday: stats.n_tx,
      totalBtcSent: stats.total_bc_sent / 1e8,
      estimatedTxVolumeUsd: stats.estimated_transaction_volume_usd,
      minersRevenueUsd: stats.miners_revenue_usd,
      totalFeesUsd: stats.total_fees_btc / 1e8,
      tradeVolumeUsd: stats.trade_volume_usd,
      totalBtc: stats.totalbc / 1e8,
      nextRetarget: stats.nextretarget,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/bitcoin/fees ───────────────────────────────────

bitcoinRoutes.get("/fees", async (c) => {
  const fees = await alt.getBitcoinFees();

  return c.json({
    data: {
      fastest: fees.fastestFee,
      halfHour: fees.halfHourFee,
      hour: fees.hourFee,
      economy: fees.economyFee,
      minimum: fees.minimumFee,
      unit: "sat/vB",
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/bitcoin/mempool ────────────────────────────────

bitcoinRoutes.get("/mempool", async (c) => {
  const mempool = await btc.getMempoolStats();

  return c.json({
    data: {
      pendingTxCount: mempool.count,
      virtualSize: mempool.vsize,
      totalFee: mempool.total_fee,
      feeHistogram: mempool.fee_histogram.slice(0, 20).map(([fee, vsize]) => ({
        feeRate: fee,
        vsize,
      })),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/bitcoin/difficulty ─────────────────────────────

bitcoinRoutes.get("/difficulty", async (c) => {
  const data = await btc.getDifficultyAdjustment();

  return c.json({
    data: {
      progressPercent: data.progressPercent,
      difficultyChange: data.difficultyChange,
      estimatedRetargetDate: new Date(data.estimatedRetargetDate).toISOString(),
      remainingBlocks: data.remainingBlocks,
      remainingTime: data.remainingTime,
      previousRetarget: data.previousRetarget,
      nextRetargetHeight: data.nextRetargetHeight,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/bitcoin/lightning ──────────────────────────────

bitcoinRoutes.get("/lightning", async (c) => {
  const { latest } = await btc.getLightningStats();

  return c.json({
    data: {
      nodeCount: latest.node_count,
      channelCount: latest.channel_count,
      totalCapacitySat: latest.total_capacity,
      totalCapacityBtc: latest.total_capacity / 1e8,
      avgCapacitySat: latest.avg_capacity,
      avgFeeRate: latest.avg_fee_rate,
      medianFeeRate: latest.med_fee_rate,
      torNodes: latest.tor_nodes,
      clearnetNodes: latest.clearnet_nodes,
      unannouncedNodes: latest.unannounced_nodes,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/bitcoin/address/:address ───────────────────────

bitcoinRoutes.get("/address/:address", async (c) => {
  const address = c.req.param("address");
  const data = await btc.getAddressBalance(address);

  const funded = data.chain_stats.funded_txo_sum + data.mempool_stats.funded_txo_sum;
  const spent = data.chain_stats.spent_txo_sum + data.mempool_stats.spent_txo_sum;

  return c.json({
    data: {
      address: data.address,
      balanceSat: funded - spent,
      balanceBtc: (funded - spent) / 1e8,
      totalReceived: data.chain_stats.funded_txo_sum,
      totalSent: data.chain_stats.spent_txo_sum,
      txCount: data.chain_stats.tx_count,
      unconfirmedTxCount: data.mempool_stats.tx_count,
      unconfirmedBalance: data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/bitcoin/tx/:txid ───────────────────────────────

bitcoinRoutes.get("/tx/:txid", async (c) => {
  const data = await btc.getBTCTransaction(c.req.param("txid"));

  return c.json({
    data: {
      txid: data.txid,
      confirmed: data.status.confirmed,
      blockHeight: data.status.block_height,
      blockTime: data.status.block_time
        ? new Date(data.status.block_time * 1000).toISOString()
        : null,
      fee: data.fee,
      size: data.size,
      weight: data.weight,
      inputCount: data.vin.length,
      outputCount: data.vout.length,
      totalOutputValue: data.vout.reduce((s, o) => s + o.value, 0),
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/bitcoin/block-height ───────────────────────────

bitcoinRoutes.get("/block-height", async (c) => {
  const height = await btc.getLatestBlockHeight();

  return c.json({
    data: { height },
    timestamp: new Date().toISOString(),
  });
});
