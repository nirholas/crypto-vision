/**
 * Tests for src/sources/blockchain.ts
 *
 * Uses fetchJSON for some endpoints, raw fetch for others.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
  cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
  getBlockCount,
  getBtcMarketPrice,
  getBtcStats,
  getDifficulty,
  getDifficultyAdjustment,
  getHashrate,
  getLatestBlock,
  getMempoolStats,
  getRecentBlocks,
  getUnconfirmedCount,
} from "../blockchain.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

describe("blockchain source adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  describe("getBtcStats", () => {
    it("calls blockchain.info stats endpoint", async () => {
      const data = { market_price_usd: 40000, hash_rate: 5e20, total_fees_btc: 100, n_btc_mined: 625, n_tx: 300000, n_blocks_mined: 144, minutes_between_blocks: 9.5, totalbc: 19e6, n_blocks_total: 800000, estimated_transaction_volume_usd: 1e10, blocks_size: 1500000, miners_revenue_usd: 5e7, nextretarget: 820000, difficulty: 7e13, estimated_btc_sent: 5e5, miners_revenue_btc: 1250, total_btc_sent: 1e8, trade_volume_btc: 50000, trade_volume_usd: 2e9, timestamp: 1700000000 };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getBtcStats();
      expect(mockFetch).toHaveBeenCalledWith("https://blockchain.info/stats?format=json");
      expect(result.market_price_usd).toBe(40000);
    });

    it("throws on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      await expect(getBtcStats()).rejects.toThrow();
    });
  });

  describe("getDifficulty", () => {
    it("fetches difficulty via raw fetch", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        text: async () => "72006146478853.74",
      } as Response);
      const result = await getDifficulty();
      expect(result).toBeCloseTo(72006146478853.74);
    });
  });

  describe("getBlockCount", () => {
    it("fetches block count via raw fetch", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        text: async () => "800000",
      } as Response);
      const result = await getBlockCount();
      expect(result).toBe(800000);
    });
  });

  describe("getUnconfirmedCount", () => {
    it("fetches unconfirmed tx count", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
        text: async () => "12345",
      } as Response);
      const result = await getUnconfirmedCount();
      expect(result).toBe(12345);
    });
  });

  describe("getLatestBlock", () => {
    it("fetches latest block", async () => {
      const data = { hash: "abc", time: 1700000000, block_index: 800000, height: 800000, txIndexes: [1, 2, 3] };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getLatestBlock();
      expect(mockFetch).toHaveBeenCalledWith("https://blockchain.info/latestblock?format=json");
      expect(result.height).toBe(800000);
    });

    it("throws on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      await expect(getLatestBlock()).rejects.toThrow();
    });
  });

  describe("getBtcMarketPrice", () => {
    it("fetches market price chart", async () => {
      const data = { status: "ok", name: "Market Price", unit: "USD", period: "day", description: "Average USD market price", values: [{ x: 1700000000, y: 40000 }] };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getBtcMarketPrice();
      expect(mockFetch).toHaveBeenCalledWith("https://blockchain.info/charts/market-price?timespan=30days&format=json");
      expect(result.values[0].y).toBe(40000);
    });
  });

  describe("getMempoolStats", () => {
    it("calls mempool.space mempool endpoint", async () => {
      const data = { count: 5000, vsize: 3000000, total_fee: 50000, fee_histogram: [[20, 100]] as [number, number][] };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getMempoolStats();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/mempool");
      expect(result.count).toBe(5000);
    });
  });

  describe("getRecentBlocks", () => {
    it("fetches recent blocks from mempool.space", async () => {
      const data = [{ id: "hash1", height: 800000, version: 2, timestamp: 1700000000, tx_count: 3000, size: 1500000, weight: 3999000, merkle_root: "m", previousblockhash: "p", mediantime: 1699999000, nonce: 12345, bits: 386089497, difficulty: 7e13 }];
      mockFetch.mockResolvedValueOnce(data);
      const result = await getRecentBlocks();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/v1/blocks");
      expect(result[0].height).toBe(800000);
    });
  });

  describe("getDifficultyAdjustment", () => {
    it("calls mempool difficulty endpoint", async () => {
      const data = { progressPercent: 50, difficultyChange: 1.5, estimatedRetargetDate: 1700500000, remainingBlocks: 1008, remainingTime: 604800, previousRetarget: 0.5, nextRetargetHeight: 820000, timeAvg: 600, timeOffset: 0 };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getDifficultyAdjustment();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/v1/difficulty-adjustment");
      expect(result.progressPercent).toBe(50);
    });
  });

  describe("getHashrate", () => {
    it("fetches hashrate data", async () => {
      const data = { hashrates: [{ timestamp: 1700000000, avgHashrate: 5e20 }], difficulty: [{ timestamp: 1700000000, difficulty: 7e13, height: 800000 }], currentHashrate: 5e20, currentDifficulty: 7e13 };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getHashrate("1m");
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/v1/mining/hashrate/1m");
      expect(result.currentHashrate).toBe(5e20);
    });
  });
});
