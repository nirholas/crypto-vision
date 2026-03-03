/**
 * Integration tests for Bitcoin routes.
 *
 * Mocks source adapters (bitcoin, alternative) so no real HTTP calls are made.
 * Uses Hono's app.request() test helper.
 *
 * Covers all 10 endpoints in src/routes/bitcoin.ts:
 *   /price, /stats, /fees, /mempool, /difficulty, /lightning,
 *   /address/:address, /tx/:txid, /block-height, /block/:hash
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mock sources BEFORE importing routes ────────────────────

vi.mock("../../sources/bitcoin.js", () => ({
  getBTCPrice: vi.fn(),
  getBTCStats: vi.fn(),
  getMempoolStats: vi.fn(),
  getDifficultyAdjustment: vi.fn(),
  getLightningStats: vi.fn(),
  getAddressBalance: vi.fn(),
  getBTCTransaction: vi.fn(),
  getLatestBlockHeight: vi.fn(),
  getBlock: vi.fn(),
}));

vi.mock("../../sources/alternative.js", () => ({
  getBitcoinFees: vi.fn(),
}));

// ─── Import AFTER mocks ─────────────────────────────────────

import * as btc from "../../sources/bitcoin.js";
import * as alt from "../../sources/alternative.js";
import { bitcoinRoutes } from "../bitcoin.js";

// ─── Set up app ──────────────────────────────────────────────

const app = new Hono().route("/api/bitcoin", bitcoinRoutes);

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/price
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/price", () => {
  it("returns BTC price ticker for multiple currencies", async () => {
    vi.mocked(btc.getBTCPrice).mockResolvedValue({
      USD: { last: 97250.42, buy: 97240.0, sell: 97260.0, symbol: "$" },
      EUR: { last: 89100.0, buy: 89090.0, sell: 89110.0, symbol: "€" },
      GBP: { last: 76500.0, buy: 76490.0, sell: 76510.0, symbol: "£" },
    });

    const res = await app.request("/api/bitcoin/price");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");
    expect(Array.isArray(json.data)).toBe(true);
    expect(json.data).toHaveLength(3);

    const usd = json.data.find((d: Record<string, unknown>) => d.currency === "USD");
    expect(usd).toBeDefined();
    expect(usd.last).toBe(97250.42);
    expect(usd.buy).toBe(97240.0);
    expect(usd.sell).toBe(97260.0);
    expect(usd.symbol).toBe("$");
  });

  it("returns correct structure for each currency entry", async () => {
    vi.mocked(btc.getBTCPrice).mockResolvedValue({
      JPY: { last: 14500000, buy: 14490000, sell: 14510000, symbol: "¥" },
    });

    const res = await app.request("/api/bitcoin/price");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data[0]).toMatchObject({
      currency: "JPY",
      last: 14500000,
      buy: 14490000,
      sell: 14510000,
      symbol: "¥",
    });
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getBTCPrice).mockRejectedValue(new Error("blockchain.info down"));

    const res = await app.request("/api/bitcoin/price");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/stats
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/stats", () => {
  const mockStats = {
    market_price_usd: 97250.42,
    hash_rate: 650000000,
    total_fees_btc: 350000000,
    n_btc_mined: 90000000000,
    n_tx: 350000,
    n_blocks_mined: 144,
    totalbc: 1975000000000000,
    n_blocks_total: 890234,
    estimated_transaction_volume_usd: 12500000000,
    miners_revenue_usd: 45000000,
    miners_revenue_btc: 463,
    trade_volume_btc: 396000,
    trade_volume_usd: 38500000000,
    difficulty: 95672345678901,
    minutes_between_blocks: 9.8,
    blocks_size: 1500000,
    total_bc_sent: 500000000000000,
    estimated_btc_sent: 250000,
    nextretarget: 891072,
    timestamp: 1709500000000,
  };

  it("returns Bitcoin network stats on success", async () => {
    vi.mocked(btc.getBTCStats).mockResolvedValue(mockStats);

    const res = await app.request("/api/bitcoin/stats");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");

    const data = json.data;
    expect(data.priceUsd).toBe(97250.42);
    expect(data.hashRate).toBe(650000000);
    expect(data.difficulty).toBe(95672345678901);
    expect(data.minutesBetweenBlocks).toBe(9.8);
    expect(data.totalBlocks).toBe(890234);
    expect(data.blocksMinedToday).toBe(144);
    expect(data.transactionsToday).toBe(350000);
    expect(data.nextRetarget).toBe(891072);
  });

  it("converts raw satoshi values correctly", async () => {
    vi.mocked(btc.getBTCStats).mockResolvedValue(mockStats);

    const res = await app.request("/api/bitcoin/stats");
    const json = await res.json();

    // total_bc_sent / 1e8
    expect(json.data.totalBtcSent).toBe(500000000000000 / 1e8);
    // total_fees_btc / 1e8
    expect(json.data.totalFeesUsd).toBe(350000000 / 1e8);
    // totalbc / 1e8
    expect(json.data.totalBtc).toBe(1975000000000000 / 1e8);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getBTCStats).mockRejectedValue(new Error("blockchain.info timeout"));

    const res = await app.request("/api/bitcoin/stats");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/fees
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/fees", () => {
  it("returns fee estimates on success", async () => {
    vi.mocked(alt.getBitcoinFees).mockResolvedValue({
      fastestFee: 45,
      halfHourFee: 35,
      hourFee: 25,
      economyFee: 15,
      minimumFee: 5,
    });

    const res = await app.request("/api/bitcoin/fees");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");

    const data = json.data;
    expect(data.fastest).toBe(45);
    expect(data.halfHour).toBe(35);
    expect(data.hour).toBe(25);
    expect(data.economy).toBe(15);
    expect(data.minimum).toBe(5);
    expect(data.unit).toBe("sat/vB");
  });

  it("handles low-fee environment", async () => {
    vi.mocked(alt.getBitcoinFees).mockResolvedValue({
      fastestFee: 2,
      halfHourFee: 2,
      hourFee: 1,
      economyFee: 1,
      minimumFee: 1,
    });

    const res = await app.request("/api/bitcoin/fees");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.fastest).toBe(2);
    expect(json.data.minimum).toBe(1);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(alt.getBitcoinFees).mockRejectedValue(new Error("mempool.space down"));

    const res = await app.request("/api/bitcoin/fees");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/mempool
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/mempool", () => {
  it("returns mempool information", async () => {
    vi.mocked(btc.getMempoolStats).mockResolvedValue({
      count: 45000,
      vsize: 120000000,
      total_fee: 3.5,
      fee_histogram: [
        [45, 500000],
        [35, 1200000],
        [25, 3000000],
        [15, 8000000],
        [10, 15000000],
        [5, 25000000],
      ],
    });

    const res = await app.request("/api/bitcoin/mempool");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");

    const data = json.data;
    expect(data.pendingTxCount).toBe(45000);
    expect(data.virtualSize).toBe(120000000);
    expect(data.totalFee).toBe(3.5);
    expect(Array.isArray(data.feeHistogram)).toBe(true);
    expect(data.feeHistogram.length).toBeLessThanOrEqual(20);
    expect(data.feeHistogram[0]).toMatchObject({ feeRate: 45, vsize: 500000 });
  });

  it("truncates fee histogram to 20 entries max", async () => {
    // Generate 25 histogram entries
    const histogram: [number, number][] = Array.from({ length: 25 }, (_, i) => [
      50 - i,
      (i + 1) * 100000,
    ]);

    vi.mocked(btc.getMempoolStats).mockResolvedValue({
      count: 80000,
      vsize: 250000000,
      total_fee: 8.2,
      fee_histogram: histogram,
    });

    const res = await app.request("/api/bitcoin/mempool");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.feeHistogram).toHaveLength(20);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getMempoolStats).mockRejectedValue(new Error("mempool API unreachable"));

    const res = await app.request("/api/bitcoin/mempool");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/difficulty
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/difficulty", () => {
  it("returns difficulty adjustment data", async () => {
    const retargetDate = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now

    vi.mocked(btc.getDifficultyAdjustment).mockResolvedValue({
      progressPercent: 65.3,
      difficultyChange: 3.21,
      estimatedRetargetDate: retargetDate,
      remainingBlocks: 700,
      remainingTime: 604800000,
      previousRetarget: -1.5,
      nextRetargetHeight: 891072,
      timeAvg: 590000,
      timeOffset: -10000,
    });

    const res = await app.request("/api/bitcoin/difficulty");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");

    const data = json.data;
    expect(data.progressPercent).toBe(65.3);
    expect(data.difficultyChange).toBe(3.21);
    expect(data.remainingBlocks).toBe(700);
    expect(data.remainingTime).toBe(604800000);
    expect(data.previousRetarget).toBe(-1.5);
    expect(data.nextRetargetHeight).toBe(891072);
    // estimatedRetargetDate is converted to ISO string
    expect(data.estimatedRetargetDate).toBe(new Date(retargetDate).toISOString());
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getDifficultyAdjustment).mockRejectedValue(new Error("fail"));

    const res = await app.request("/api/bitcoin/difficulty");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/lightning
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/lightning", () => {
  it("returns Lightning Network stats", async () => {
    vi.mocked(btc.getLightningStats).mockResolvedValue({
      latest: {
        id: 1234,
        added: "2026-03-01T00:00:00Z",
        channel_count: 72000,
        node_count: 16500,
        total_capacity: 560000000000, // satoshis
        tor_nodes: 9500,
        clearnet_nodes: 5200,
        unannounced_nodes: 1800,
        avg_capacity: 7777778,
        avg_fee_rate: 150,
        avg_base_fee_mtokens: 1200,
        med_capacity: 5000000,
        med_fee_rate: 100,
        med_base_fee_mtokens: 1000,
        clearnet_tor_nodes: 800,
      },
    });

    const res = await app.request("/api/bitcoin/lightning");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");

    const data = json.data;
    expect(data.nodeCount).toBe(16500);
    expect(data.channelCount).toBe(72000);
    expect(data.totalCapacitySat).toBe(560000000000);
    expect(data.totalCapacityBtc).toBe(560000000000 / 1e8);
    expect(data.avgCapacitySat).toBe(7777778);
    expect(data.avgFeeRate).toBe(150);
    expect(data.medianFeeRate).toBe(100);
    expect(data.torNodes).toBe(9500);
    expect(data.clearnetNodes).toBe(5200);
    expect(data.unannouncedNodes).toBe(1800);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getLightningStats).mockRejectedValue(new Error("Lightning API down"));

    const res = await app.request("/api/bitcoin/lightning");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/address/:address
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/address/:address", () => {
  const testAddress = "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh";

  it("returns address balance and transaction info", async () => {
    vi.mocked(btc.getAddressBalance).mockResolvedValue({
      address: testAddress,
      chain_stats: {
        funded_txo_count: 50,
        funded_txo_sum: 500000000,
        spent_txo_count: 40,
        spent_txo_sum: 350000000,
        tx_count: 42,
      },
      mempool_stats: {
        funded_txo_count: 1,
        funded_txo_sum: 10000000,
        spent_txo_count: 0,
        spent_txo_sum: 0,
        tx_count: 1,
      },
    });

    const res = await app.request(`/api/bitcoin/address/${testAddress}`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");

    const data = json.data;
    expect(data.address).toBe(testAddress);
    // balance = (funded chain + funded mempool) - (spent chain + spent mempool)
    expect(data.balanceSat).toBe(500000000 + 10000000 - 350000000 - 0);
    expect(data.balanceBtc).toBe((500000000 + 10000000 - 350000000 - 0) / 1e8);
    expect(data.totalReceived).toBe(500000000);
    expect(data.totalSent).toBe(350000000);
    expect(data.txCount).toBe(42);
    expect(data.unconfirmedTxCount).toBe(1);
    expect(data.unconfirmedBalance).toBe(10000000 - 0);
  });

  it("handles address with zero balance", async () => {
    vi.mocked(btc.getAddressBalance).mockResolvedValue({
      address: "bc1qempty",
      chain_stats: {
        funded_txo_count: 5,
        funded_txo_sum: 100000000,
        spent_txo_count: 5,
        spent_txo_sum: 100000000,
        tx_count: 10,
      },
      mempool_stats: {
        funded_txo_count: 0,
        funded_txo_sum: 0,
        spent_txo_count: 0,
        spent_txo_sum: 0,
        tx_count: 0,
      },
    });

    const res = await app.request("/api/bitcoin/address/bc1qempty");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.balanceSat).toBe(0);
    expect(json.data.balanceBtc).toBe(0);
    expect(json.data.unconfirmedBalance).toBe(0);
  });

  it("correctly computes balance with pending outgoing tx", async () => {
    vi.mocked(btc.getAddressBalance).mockResolvedValue({
      address: "bc1qspending",
      chain_stats: {
        funded_txo_count: 10,
        funded_txo_sum: 200000000,
        spent_txo_count: 5,
        spent_txo_sum: 50000000,
        tx_count: 15,
      },
      mempool_stats: {
        funded_txo_count: 0,
        funded_txo_sum: 0,
        spent_txo_count: 1,
        spent_txo_sum: 30000000,
        tx_count: 1,
      },
    });

    const res = await app.request("/api/bitcoin/address/bc1qspending");
    expect(res.status).toBe(200);

    const json = await res.json();
    // balance = (200M + 0) - (50M + 30M) = 120M
    expect(json.data.balanceSat).toBe(120000000);
    expect(json.data.unconfirmedBalance).toBe(-30000000);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getAddressBalance).mockRejectedValue(new Error("address lookup failed"));

    const res = await app.request("/api/bitcoin/address/bc1qinvalid");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/tx/:txid
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/tx/:txid", () => {
  const testTxid = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";

  it("returns transaction details for confirmed tx", async () => {
    vi.mocked(btc.getBTCTransaction).mockResolvedValue({
      txid: testTxid,
      version: 2,
      locktime: 0,
      vin: [
        {
          txid: "prev_tx_hash_001",
          vout: 0,
          prevout: { value: 50000000, scriptpubkey_address: "bc1qsender" },
        },
      ],
      vout: [
        { value: 49985000, scriptpubkey_address: "bc1qreceiver" },
      ],
      size: 250,
      weight: 900,
      fee: 15000,
      status: { confirmed: true, block_height: 890200, block_time: 1709490000 },
    });

    const res = await app.request(`/api/bitcoin/tx/${testTxid}`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");

    const data = json.data;
    expect(data.txid).toBe(testTxid);
    expect(data.confirmed).toBe(true);
    expect(data.blockHeight).toBe(890200);
    expect(data.blockTime).toBe(new Date(1709490000 * 1000).toISOString());
    expect(data.fee).toBe(15000);
    expect(data.size).toBe(250);
    expect(data.weight).toBe(900);
    expect(data.inputCount).toBe(1);
    expect(data.outputCount).toBe(1);
    expect(data.totalOutputValue).toBe(49985000);
  });

  it("returns null blockTime for unconfirmed tx", async () => {
    vi.mocked(btc.getBTCTransaction).mockResolvedValue({
      txid: "unconfirmed_tx_hash",
      version: 2,
      locktime: 0,
      vin: [
        {
          txid: "prev_tx",
          vout: 1,
          prevout: { value: 100000, scriptpubkey_address: "bc1qfoo" },
        },
      ],
      vout: [
        { value: 50000, scriptpubkey_address: "bc1qbar" },
        { value: 45000, scriptpubkey_address: "bc1qchange" },
      ],
      size: 200,
      weight: 700,
      fee: 5000,
      status: { confirmed: false, block_height: 0, block_time: 0 },
    });

    const res = await app.request("/api/bitcoin/tx/unconfirmed_tx_hash");
    expect(res.status).toBe(200);

    const json = await res.json();
    const data = json.data;
    expect(data.confirmed).toBe(false);
    expect(data.blockTime).toBeNull();
    expect(data.inputCount).toBe(1);
    expect(data.outputCount).toBe(2);
    expect(data.totalOutputValue).toBe(95000);
  });

  it("handles multi-input multi-output transaction", async () => {
    vi.mocked(btc.getBTCTransaction).mockResolvedValue({
      txid: "multi_io_tx",
      version: 2,
      locktime: 890100,
      vin: [
        { txid: "in1", vout: 0, prevout: { value: 30000000, scriptpubkey_address: "bc1qa" } },
        { txid: "in2", vout: 1, prevout: { value: 20000000, scriptpubkey_address: "bc1qb" } },
        { txid: "in3", vout: 0, prevout: { value: 10000000, scriptpubkey_address: "bc1qc" } },
      ],
      vout: [
        { value: 40000000, scriptpubkey_address: "bc1qrecipient" },
        { value: 19990000, scriptpubkey_address: "bc1qchange" },
      ],
      size: 520,
      weight: 1400,
      fee: 10000,
      status: { confirmed: true, block_height: 890150, block_time: 1709495000 },
    });

    const res = await app.request("/api/bitcoin/tx/multi_io_tx");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.inputCount).toBe(3);
    expect(json.data.outputCount).toBe(2);
    expect(json.data.totalOutputValue).toBe(59990000);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getBTCTransaction).mockRejectedValue(new Error("tx not found"));

    const res = await app.request("/api/bitcoin/tx/deadbeef");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/block-height
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/block-height", () => {
  it("returns the latest block height", async () => {
    vi.mocked(btc.getLatestBlockHeight).mockResolvedValue(890234);

    const res = await app.request("/api/bitcoin/block-height");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("timestamp");
    expect(json.data.height).toBe(890234);
  });

  it("handles block height at genesis-like low values", async () => {
    vi.mocked(btc.getLatestBlockHeight).mockResolvedValue(0);

    const res = await app.request("/api/bitcoin/block-height");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.height).toBe(0);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getLatestBlockHeight).mockRejectedValue(new Error("mempool.space unreachable"));

    const res = await app.request("/api/bitcoin/block-height");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// GET /api/bitcoin/block/:hash
// ═══════════════════════════════════════════════════════════════

describe("GET /api/bitcoin/block/:hash", () => {
  const blockHash = "0000000000000000000234abc567def890123456789abcdef0123456789abcdef";

  it("returns block details by hash", async () => {
    vi.mocked(btc.getBlock).mockResolvedValue({
      id: blockHash,
      height: 890234,
      version: 536870912,
      timestamp: 1709500000,
      tx_count: 3400,
      size: 1500000,
      weight: 3993000,
      difficulty: 95672345678901,
      nonce: 2891734567,
      bits: 386089497,
      previousblockhash: "00000000000000000001abcdef1234567890abcdef1234567890abcdef123456",
    });

    const res = await app.request(`/api/bitcoin/block/${blockHash}`);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("data");
    expect(json).toHaveProperty("source", "mempool.space");
    expect(json).toHaveProperty("timestamp");

    const data = json.data;
    expect(data.id).toBe(blockHash);
    expect(data.height).toBe(890234);
    expect(data.version).toBe(536870912);
    expect(data.timestamp).toBe(1709500000);
    expect(data.txCount).toBe(3400);
    expect(data.size).toBe(1500000);
    expect(data.weight).toBe(3993000);
    expect(data.difficulty).toBe(95672345678901);
    expect(data.nonce).toBe(2891734567);
    expect(data.previousBlockHash).toBe(
      "00000000000000000001abcdef1234567890abcdef1234567890abcdef123456"
    );
  });

  it("passes hash param to source function", async () => {
    const specificHash = "000000000000000000023a7c4c1e48abcdef";
    vi.mocked(btc.getBlock).mockResolvedValue({
      id: specificHash,
      height: 890100,
      version: 536870912,
      timestamp: 1709400000,
      tx_count: 2000,
      size: 1200000,
      weight: 3500000,
      difficulty: 92000000000000,
      nonce: 1234567890,
      bits: 386089497,
      previousblockhash: "prev_hash",
    });

    await app.request(`/api/bitcoin/block/${specificHash}`);

    expect(btc.getBlock).toHaveBeenCalledWith(specificHash);
  });

  it("propagates source errors as 500", async () => {
    vi.mocked(btc.getBlock).mockRejectedValue(new Error("block not found"));

    const res = await app.request("/api/bitcoin/block/invalid_hash");
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════
// Cross-cutting concerns
// ═══════════════════════════════════════════════════════════════

describe("Cross-cutting concerns", () => {
  it("all successful responses include ISO timestamp", async () => {
    vi.mocked(btc.getBTCPrice).mockResolvedValue({
      USD: { last: 97000, buy: 96990, sell: 97010, symbol: "$" },
    });

    const res = await app.request("/api/bitcoin/price");
    const json = await res.json();

    // Validate ISO 8601 format
    expect(json.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(new Date(json.timestamp).getTime()).not.toBeNaN();
  });

  it("returns 404 for unknown bitcoin sub-routes", async () => {
    const res = await app.request("/api/bitcoin/nonexistent");
    expect(res.status).toBe(404);
  });

  it("source functions are called exactly once per request", async () => {
    vi.mocked(btc.getLatestBlockHeight).mockResolvedValue(890234);

    await app.request("/api/bitcoin/block-height");

    expect(btc.getLatestBlockHeight).toHaveBeenCalledTimes(1);
  });
});
