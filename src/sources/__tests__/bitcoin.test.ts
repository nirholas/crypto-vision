/**
 * Tests for src/sources/bitcoin.ts
 *
 * Bitcoin adapter uses fetchJSON via cache.wrap for most funcs,
 * plus raw fetch for a couple of blockchain.info endpoints.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
  cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
  getBTCPrice,
  getBTCStats,
  getAddressBalance,
  getBTCTransaction,
  getLatestBlockHeight,
  getBlock,
  getMempoolStats,
  getDifficultyAdjustment,
  getLightningStats,
} from "../bitcoin.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

describe("bitcoin source adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe("getBTCPrice", () => {
    it("calls blockchain.info ticker", async () => {
      const data = { USD: { last: 40000, buy: 39999, sell: 40001, symbol: "$" } };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getBTCPrice();
      expect(mockFetch).toHaveBeenCalledWith("https://blockchain.info/ticker");
      expect(result.USD.last).toBe(40000);
    });

    it("throws on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network"));
      await expect(getBTCPrice()).rejects.toThrow("network");
    });
  });

  describe("getBTCStats", () => {
    it("calls blockchain.info stats", async () => {
      const data = { market_price_usd: 40000, hash_rate: 5e20, total_fees_btc: 100, n_btc_mined: 625, n_tx: 300000, n_blocks_mined: 144, totalbc: 19e6, n_blocks_total: 800000, estimated_transaction_volume_usd: 1e10, miners_revenue_usd: 5e7, miners_revenue_btc: 1250, trade_volume_btc: 50000, trade_volume_usd: 2e9, difficulty: 7e13, minutes_between_blocks: 9.5, blocks_size: 1500000, total_bc_sent: 1e8, estimated_btc_sent: 5e5, nextretarget: 820000, timestamp: 1700000000 };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getBTCStats();
      expect(mockFetch).toHaveBeenCalledWith("https://blockchain.info/stats?format=json");
      expect(result.market_price_usd).toBe(40000);
    });
  });

  describe("getAddressBalance", () => {
    it("calls mempool address endpoint", async () => {
      const data = { address: "bc1q...", chain_stats: { funded_txo_count: 10, funded_txo_sum: 100000000, spent_txo_count: 5, spent_txo_sum: 50000000, tx_count: 15 }, mempool_stats: { funded_txo_count: 0, funded_txo_sum: 0, spent_txo_count: 0, spent_txo_sum: 0, tx_count: 0 } };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getAddressBalance("bc1q...");
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/address/bc1q...");
      expect(result.chain_stats.tx_count).toBe(15);
    });

    it("throws on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("not found"));
      await expect(getAddressBalance("bad")).rejects.toThrow();
    });
  });

  describe("getBTCTransaction", () => {
    it("calls mempool tx endpoint", async () => {
      const data = { txid: "abc123", version: 2, locktime: 0, vin: [], vout: [], size: 250, weight: 660, fee: 5000, status: { confirmed: true, block_height: 800000, block_time: 1700000000 } };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getBTCTransaction("abc123");
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/tx/abc123");
      expect(result.txid).toBe("abc123");
    });
  });

  describe("getLatestBlockHeight", () => {
    it("returns block height number", async () => {
      mockFetch.mockResolvedValueOnce(800000);
      const result = await getLatestBlockHeight();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/blocks/tip/height");
      expect(result).toBe(800000);
    });
  });

  describe("getBlock", () => {
    it("calls mempool block endpoint", async () => {
      const data = { id: "hash123", height: 800000, version: 0x20000000, timestamp: 1700000000, tx_count: 3000, size: 1500000, weight: 3999000, difficulty: 7e13, nonce: 12345, bits: 386089497, previousblockhash: "prevhash" };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getBlock("hash123");
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/block/hash123");
      expect(result.height).toBe(800000);
    });
  });

  describe("getMempoolStats", () => {
    it("calls mempool stats endpoint", async () => {
      const data = { count: 10000, vsize: 5000000, total_fee: 100000, fee_histogram: [[20, 500], [10, 300]] as [number, number][] };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getMempoolStats();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/mempool");
      expect(result.count).toBe(10000);
    });
  });

  describe("getDifficultyAdjustment", () => {
    it("calls difficulty endpoint", async () => {
      const data = { progressPercent: 45, difficultyChange: 2.1, estimatedRetargetDate: 1700500000, remainingBlocks: 1100, remainingTime: 660000, previousRetarget: 1.5, nextRetargetHeight: 821000, timeAvg: 595, timeOffset: -5 };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getDifficultyAdjustment();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/v1/difficulty-adjustment");
      expect(result.progressPercent).toBe(45);
    });
  });

  describe("getLightningStats", () => {
    it("calls lightning stats endpoint", async () => {
      const data = { latest: { id: 1, added: "2024-01-01", channel_count: 60000, node_count: 16000, total_capacity: 5000, tor_nodes: 10000, clearnet_nodes: 5000, unannounced_nodes: 1000, avg_capacity: 1000000, avg_fee_rate: 100, avg_base_fee_mtokens: 1000, med_capacity: 500000, med_fee_rate: 50, med_base_fee_mtokens: 500, clearnet_tor_nodes: 1000 } };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getLightningStats();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/v1/lightning/statistics/latest");
      expect(result.latest.channel_count).toBe(60000);
    });

    it("throws on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      await expect(getLightningStats()).rejects.toThrow();
    });
  });
});
