/**
 * Tests for src/sources/alternative.ts
 *
 * Covers: Fear & Greed, mempool, DexScreener, CoinPaprika, CoinCap, helpers
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../lib/fetcher.js", () => ({ fetchJSON: vi.fn() }));
vi.mock("../../lib/cache.js", () => ({
  cache: { wrap: vi.fn((_k: string, _t: number, fn: () => unknown) => fn()) },
}));

import { fetchJSON } from "../../lib/fetcher.js";
import {
  dexPairByAddress,
  dexSearch,
  dexTokenPairs,
  getBitcoinFees,
  getBitcoinHashrate,
  getBitcoinPrice,
  getCoinCapAssets,
  getCoinCapHistory,
  getCoinCapRates,
  getCoinPaprikaDetail,
  getCoinPaprikaGlobal,
  getCoinPaprikaTickers,
  getCurrentSentiment,
  getDifficultyAdjustment,
  getFearGreedIndex,
  getLatestTokenProfiles,
  getMempoolStats,
  getRecentBlocks,
  getTopBoostedTokens,
  normalizeChainId,
  normalizeFearGreedEntries,
  normalizeFeeRate,
  unixToISO,
} from "../alternative.js";

const mockFetch = fetchJSON as ReturnType<typeof vi.fn>;

describe("alternative source adapter", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.spyOn(globalThis, "fetch").mockReset();
  });

  // ─── Pure helpers ────────────────────────────────────────

  describe("normalizeChainId", () => {
    it("maps known chain ids", () => {
      expect(normalizeChainId("ethereum")).toBe("Ethereum");
      expect(normalizeChainId("bsc")).toBe("BNB Chain");
      expect(normalizeChainId("solana")).toBe("Solana");
    });
    it("returns raw id for unknown chains", () => {
      expect(normalizeChainId("unknown-chain")).toBe("unknown-chain");
    });
  });

  describe("unixToISO", () => {
    it("converts unix timestamp string to ISO date", () => {
      const iso = unixToISO("1700000000");
      expect(iso).toBe(new Date(1700000000 * 1000).toISOString());
    });
  });

  describe("normalizeFeeRate", () => {
    it("converts sat/vB to multiple units", () => {
      const result = normalizeFeeRate(10, 40000);
      expect(result.satPerVB).toBe(10);
      expect(result.btcPerKB).toBeCloseTo(0.0001);
      expect(typeof result.usdPerTx).toBe("number");
    });
    it("works without btcPriceUsd", () => {
      const result = normalizeFeeRate(5);
      expect(result.satPerVB).toBe(5);
      expect(result.usdPerTx).toBeUndefined();
    });
  });

  describe("normalizeFearGreedEntries", () => {
    it("augments entries with isoDate and numericValue", () => {
      const entries = [
        { value: "75", value_classification: "Greed", timestamp: "1700000000" },
      ];
      const result = normalizeFearGreedEntries(entries);
      expect(result[0]).toHaveProperty("isoDate");
      expect(result[0]).toHaveProperty("numericValue", 75);
    });
  });

  // ─── Fear & Greed Index ──────────────────────────────────

  describe("getFearGreedIndex", () => {
    it("calls correct URL and returns parsed response", async () => {
      const mock = {
        name: "Fear and Greed Index",
        data: [{ value: "72", value_classification: "Greed", timestamp: "1700000000" }],
      };
      mockFetch.mockResolvedValueOnce(mock);

      const result = await getFearGreedIndex(1);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.alternative.me/fng/?limit=1&format=json",
      );
      expect(result.data).toHaveLength(1);
      expect(result.data[0].value).toBe("72");
    });

    it("throws on fetchJSON error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network error"));
      await expect(getFearGreedIndex()).rejects.toThrow("network error");
    });
  });

  describe("getCurrentSentiment", () => {
    it("returns current sentiment object", async () => {
      mockFetch.mockResolvedValueOnce({
        name: "Fear and Greed Index",
        data: [{ value: "25", value_classification: "Extreme Fear", timestamp: "1700000000" }],
      });
      const result = await getCurrentSentiment();
      expect(result.value).toBe(25);
      expect(result.classification).toBe("Extreme Fear");
    });

    it("throws on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      await expect(getCurrentSentiment()).rejects.toThrow();
    });
  });

  // ─── Bitcoin Fees & Mempool ──────────────────────────────

  describe("getBitcoinFees", () => {
    it("calls mempool fees endpoint", async () => {
      const fees = { fastestFee: 20, halfHourFee: 15, hourFee: 10, economyFee: 5, minimumFee: 1 };
      mockFetch.mockResolvedValueOnce(fees);
      const result = await getBitcoinFees();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/v1/fees/recommended");
      expect(result.fastestFee).toBe(20);
    });

    it("throws on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("fail"));
      await expect(getBitcoinFees()).rejects.toThrow();
    });
  });

  describe("getMempoolStats", () => {
    it("calls mempool stats endpoint", async () => {
      const stats = { count: 5000, vsize: 1234567, total_fee: 50000, fee_histogram: [[10, 100]] };
      mockFetch.mockResolvedValueOnce(stats);
      const result = await getMempoolStats();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/mempool");
      expect(result.count).toBe(5000);
    });
  });

  describe("getRecentBlocks", () => {
    it("fetches recent blocks", async () => {
      const blocks = [{ id: "abc", height: 800000, version: 0x20000000, timestamp: 1700000000, tx_count: 3000, size: 1200000, weight: 3999000, nonce: 12345, bits: 386089497, difficulty: 1e14, previousblockhash: "def", mediantime: 1699999000, merkle_root: "aaa" }];
      mockFetch.mockResolvedValueOnce(blocks);
      const result = await getRecentBlocks(1);
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/v1/blocks");
      expect(result).toHaveLength(1);
    });
  });

  describe("getDifficultyAdjustment", () => {
    it("calls difficulty endpoint", async () => {
      const adj = { progressPercent: 50, difficultyChange: 1.5, estimatedRetargetDate: 1700000000, remainingBlocks: 1008, remainingTime: 604800, previousRetarget: 0.5, nextRetargetHeight: 820000, timeAvg: 600, timeOffset: 0 };
      mockFetch.mockResolvedValueOnce(adj);
      const result = await getDifficultyAdjustment();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/v1/difficulty-adjustment");
      expect(result.progressPercent).toBe(50);
    });
  });

  describe("getBitcoinHashrate", () => {
    it("calls hashrate endpoint", async () => {
      const hr = { currentHashrate: 5e20, currentDifficulty: 7e13, hashrates: [{ timestamp: 1700000000, avgHashrate: 5e20 }], difficulty: [{ timestamp: 1700000000, difficulty: 7e13, height: 800000 }] };
      mockFetch.mockResolvedValueOnce(hr);
      const result = await getBitcoinHashrate();
      expect(mockFetch).toHaveBeenCalledWith("https://mempool.space/api/v1/mining/hashrate/3d");
      expect(result.currentHashrate).toBe(5e20);
    });
  });

  // ─── DexScreener ─────────────────────────────────────────

  describe("dexTokenPairs", () => {
    it("calls correct DexScreener URL", async () => {
      const resp = { pairs: [{ chainId: "ethereum", dexId: "uniswap", baseToken: { address: "0x1", name: "Tok", symbol: "TOK" }, quoteToken: { address: "0x2", name: "WETH", symbol: "WETH" }, priceUsd: "1.5", txns: {}, volume: {}, liquidity: {} }], schemaVersion: "1.0.0" };
      mockFetch.mockResolvedValueOnce(resp);
      const result = await dexTokenPairs("0xabc");
      expect(mockFetch).toHaveBeenCalledWith("https://api.dexscreener.com/latest/dex/tokens/0xabc");
      expect(result.pairs).toBeDefined();
    });
  });

  describe("dexPairByAddress", () => {
    it("calls correct URL with chain and pair", async () => {
      mockFetch.mockResolvedValueOnce({ pairs: [], schemaVersion: "1.0.0" });
      await dexPairByAddress("ethereum", "0xpair");
      expect(mockFetch).toHaveBeenCalledWith("https://api.dexscreener.com/latest/dex/pairs/ethereum/0xpair");
    });
  });

  describe("dexSearch", () => {
    it("calls search endpoint", async () => {
      mockFetch.mockResolvedValueOnce({ pairs: [], schemaVersion: "1.0.0" });
      await dexSearch("PEPE");
      expect(mockFetch).toHaveBeenCalledWith("https://api.dexscreener.com/latest/dex/search?q=PEPE");
    });
  });

  describe("getLatestTokenProfiles", () => {
    it("fetches token profiles", async () => {
      mockFetch.mockResolvedValueOnce([{ url: "https://example.com", chainId: "ethereum", tokenAddress: "0x1" }]);
      const result = await getLatestTokenProfiles();
      expect(mockFetch).toHaveBeenCalledWith("https://api.dexscreener.com/token-profiles/latest/v1");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("getTopBoostedTokens", () => {
    it("fetches boosted tokens", async () => {
      mockFetch.mockResolvedValueOnce([]);
      const result = await getTopBoostedTokens();
      expect(mockFetch).toHaveBeenCalledWith("https://api.dexscreener.com/token-boosts/top/v1");
      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── Bitcoin Price (blockchain.info) ─────────────────────

  describe("getBitcoinPrice", () => {
    it("calls blockchain ticker", async () => {
      const resp = { USD: { "15m": 40000, last: 40000, buy: 39999, sell: 40001, symbol: "$" } };
      mockFetch.mockResolvedValueOnce(resp);
      const result = await getBitcoinPrice();
      expect(mockFetch).toHaveBeenCalledWith("https://api.blockchain.info/ticker");
      expect(result.USD.last).toBe(40000);
    });
  });

  // ─── CoinPaprika ─────────────────────────────────────────

  describe("getCoinPaprikaGlobal", () => {
    it("fetches global stats", async () => {
      const data = { market_cap_usd: 2e12, volume_24h_usd: 1e11, bitcoin_dominance_percentage: 52, cryptocurrencies_number: 10000 };
      mockFetch.mockResolvedValueOnce(data);
      const result = await getCoinPaprikaGlobal();
      expect(mockFetch).toHaveBeenCalledWith("https://api.coinpaprika.com/v1/global");
      expect(result.market_cap_usd).toBe(2e12);
    });
  });

  describe("getCoinPaprikaTickers", () => {
    it("fetches tickers with limit", async () => {
      mockFetch.mockResolvedValueOnce([{ id: "btc-bitcoin", name: "Bitcoin", symbol: "BTC", rank: 1 }]);
      const result = await getCoinPaprikaTickers(10);
      expect(mockFetch).toHaveBeenCalledWith("https://api.coinpaprika.com/v1/tickers?limit=10");
      expect(result[0].id).toBe("btc-bitcoin");
    });
  });

  describe("getCoinPaprikaDetail", () => {
    it("fetches coin detail", async () => {
      mockFetch.mockResolvedValueOnce({ id: "btc-bitcoin", name: "Bitcoin", description: "A decentralized currency" });
      const result = await getCoinPaprikaDetail("btc-bitcoin");
      expect(mockFetch).toHaveBeenCalledWith("https://api.coinpaprika.com/v1/coins/btc-bitcoin");
      expect(result.name).toBe("Bitcoin");
    });
  });

  // ─── CoinCap ─────────────────────────────────────────────

  describe("getCoinCapAssets", () => {
    it("fetches assets", async () => {
      mockFetch.mockResolvedValueOnce({ data: [{ id: "bitcoin", name: "Bitcoin", priceUsd: "40000" }] });
      const result = await getCoinCapAssets(10);
      expect(mockFetch).toHaveBeenCalledWith("https://api.coincap.io/v2/assets?limit=10");
      expect(result.data[0].id).toBe("bitcoin");
    });
  });

  describe("getCoinCapHistory", () => {
    it("fetches price history", async () => {
      mockFetch.mockResolvedValueOnce({ data: [{ priceUsd: "40000", time: 1700000000000 }] });
      const result = await getCoinCapHistory("bitcoin", "d1");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("https://api.coincap.io/v2/assets/bitcoin/history"));
      expect(result.data).toHaveLength(1);
    });
  });

  describe("getCoinCapRates", () => {
    it("fetches rates", async () => {
      mockFetch.mockResolvedValueOnce({ data: [{ id: "bitcoin", symbol: "BTC", rateUsd: "40000" }] });
      const result = await getCoinCapRates();
      expect(mockFetch).toHaveBeenCalledWith("https://api.coincap.io/v2/rates");
      expect(result.data[0].id).toBe("bitcoin");
    });
  });
});
