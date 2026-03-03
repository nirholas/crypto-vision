/**
 * Unit tests for the unified search engine (src/lib/search.ts).
 *
 * Tests intent detection, individual search strategies, the smartSearch
 * pipeline (deduplication, ranking, caching, suggestions), and edge cases.
 *
 * Mocks all external data sources and the embedding pipeline.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Mock all external dependencies BEFORE imports ───────────

vi.mock("../../sources/coingecko.js", () => ({
  searchCoins: vi.fn(),
}));

vi.mock("../../sources/defillama.js", () => ({
  getProtocols: vi.fn(),
  getYieldPools: vi.fn(),
}));

vi.mock("../../sources/crypto-news.js", () => ({
  searchNews: vi.fn(),
}));

vi.mock("../embeddings.js", () => ({
  generateEmbedding: vi.fn(),
}));

vi.mock("../vector-store.js", () => ({
  vectorStore: {
    count: vi.fn(),
    search: vi.fn(),
  },
}));

vi.mock("../cache.js", () => ({
  cache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock("../logger.js", () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { searchCoins } from "../../sources/coingecko.js";
import { searchNews } from "../../sources/crypto-news.js";
import { getProtocols, getYieldPools } from "../../sources/defillama.js";
import { cache } from "../cache.js";
import { generateEmbedding } from "../embeddings.js";
import { detectIntent, smartSearch, type SearchIntent } from "../search.js";
import { vectorStore } from "../vector-store.js";

// ─── Test Data Factories ─────────────────────────────────────

function mockCoinSearchResult(overrides = {}) {
  return {
    coins: [
      {
        id: "bitcoin",
        name: "Bitcoin",
        symbol: "btc",
        market_cap_rank: 1,
        thumb: "https://img.com/btc.png",
      },
      {
        id: "bitcoin-cash",
        name: "Bitcoin Cash",
        symbol: "bch",
        market_cap_rank: 18,
        thumb: "https://img.com/bch.png",
      },
    ],
    ...overrides,
  };
}

function mockProtocols() {
  return [
    {
      id: "1",
      name: "Aave",
      slug: "aave",
      symbol: "AAVE",
      tvl: 12_000_000_000,
      chainTvls: { Ethereum: 8e9 },
      change_1h: 0.1,
      change_1d: 1.5,
      change_7d: -2.0,
      category: "Lending",
      chains: ["Ethereum", "Polygon", "Avalanche"],
      logo: "https://img.com/aave.png",
      url: "https://aave.com",
      description: "Decentralized lending protocol",
    },
    {
      id: "2",
      name: "Uniswap",
      slug: "uniswap",
      symbol: "UNI",
      tvl: 5_000_000_000,
      chainTvls: { Ethereum: 3e9 },
      change_1h: -0.2,
      change_1d: 0.8,
      change_7d: 3.0,
      category: "DEX",
      chains: ["Ethereum", "Arbitrum", "Polygon"],
      logo: "https://img.com/uni.png",
      url: "https://uniswap.org",
      description: "Decentralized exchange",
    },
  ];
}

function mockYieldPools() {
  return {
    data: [
      {
        chain: "Ethereum",
        project: "aave-v3",
        symbol: "USDC",
        tvlUsd: 500_000_000,
        apyBase: 3.5,
        apyReward: 1.2,
        apy: 4.7,
        pool: "pool-usdc-aave",
        stablecoin: true,
        ilRisk: "no",
        exposure: "single",
        poolMeta: null,
      },
      {
        chain: "Arbitrum",
        project: "gmx",
        symbol: "ETH-USDC",
        tvlUsd: 200_000_000,
        apyBase: 8.0,
        apyReward: 12.0,
        apy: 20.0,
        pool: "pool-eth-usdc-gmx",
        stablecoin: false,
        ilRisk: "yes",
        exposure: "multi",
        poolMeta: null,
      },
      {
        chain: "Ethereum",
        project: "compound",
        symbol: "DAI",
        tvlUsd: 300_000_000,
        apyBase: 2.8,
        apyReward: 0,
        apy: 2.8,
        pool: "pool-dai-compound",
        stablecoin: true,
        ilRisk: "no",
        exposure: "single",
        poolMeta: null,
      },
    ],
  };
}

function mockNewsResponse() {
  return {
    articles: [
      {
        id: "news-1",
        title: "Bitcoin Surges Past $100K",
        description: "Bitcoin has broken through the $100,000 barrier.",
        url: "https://coindesk.com/article-1",
        source: "coindesk",
        sourceName: "CoinDesk",
        publishedAt: new Date().toISOString(),
        categories: ["bitcoin", "markets"],
        imageUrl: "https://img.com/btc-100k.png",
      },
      {
        id: "news-2",
        title: "Ethereum Merge Anniversary",
        description: "One year since the Ethereum merge to proof of stake.",
        url: "https://decrypt.co/article-2",
        source: "decrypt",
        sourceName: "Decrypt",
        publishedAt: new Date().toISOString(),
        categories: ["ethereum", "technology"],
      },
    ],
    totalCount: 2,
    sources: ["coindesk", "decrypt"],
    timestamp: new Date().toISOString(),
  };
}

// ─── Setup ───────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // Default: cache miss
  vi.mocked(cache.get).mockResolvedValue(null);
  vi.mocked(cache.set).mockResolvedValue(undefined);
  // Default: vector store empty
  vi.mocked(vectorStore.count).mockResolvedValue(0);
});

// ═══════════════════════════════════════════════════════════════
// Intent Detection
// ═══════════════════════════════════════════════════════════════

describe("detectIntent", () => {
  const cases: Array<[string, SearchIntent]> = [
    // Price lookup
    ["bitcoin price", "price_lookup"],
    ["what is the price of ETH", "price_lookup"],
    ["how much is solana worth", "price_lookup"],
    ["BTC market cap", "price_lookup"],

    // Comparison
    ["ETH vs SOL", "comparison"],
    ["ethereum versus solana", "comparison"],
    ["bitcoin compared to gold", "comparison"],

    // Event queries
    ["what happened to Luna", "event_query"],
    ["FTX collapse", "event_query"],
    ["Euler hack", "event_query"],
    ["UST depeg", "event_query"],

    // Concept explanations
    ["what is impermanent loss", "concept_explain"],
    ["explain yield farming", "concept_explain"],
    ["how does staking work", "concept_explain"],
    ["define TVL", "concept_explain"],

    // Risk assessment
    ["is USDT safe", "risk_assessment"],
    ["Tether audit", "risk_assessment"],
    ["rug pull warning", "risk_assessment"],

    // Yield search
    ["best stablecoin yields", "yield_search"],
    ["highest APY DeFi", "yield_search"],
    ["where to stake ETH", "yield_search"],
    ["farming rewards", "yield_search"],

    // Protocol search
    ["Aave TVL", "protocol_search"],
    ["top DeFi protocols", "protocol_search"],
    ["lending platforms", "protocol_search"],

    // News search
    ["latest crypto news", "news_search"],
    ["breaking bitcoin news", "news_search"],
    ["crypto announcements", "news_search"],

    // Chain comparison
    ["cheapest L2", "chain_comparison"],
    ["fastest blockchain", "chain_comparison"],
    ["layer 2 rollup comparison", "chain_comparison"],
    ["Arbitrum bridge", "chain_comparison"],

    // General (no specific intent)
    ["random crypto stuff", "general"],
    ["hello world", "general"],
  ];

  it.each(cases)('"%s" → %s', (query, expected) => {
    expect(detectIntent(query)).toBe(expected);
  });
});

// ═══════════════════════════════════════════════════════════════
// Smart Search — Core Pipeline
// ═══════════════════════════════════════════════════════════════

describe("smartSearch", () => {
  // ─── Price Lookup ──────────────────────────────────────────

  describe("price_lookup intent", () => {
    it("returns coin results for price queries", async () => {
      vi.mocked(searchCoins).mockResolvedValue(mockCoinSearchResult());
      vi.mocked(getProtocols).mockResolvedValue(mockProtocols());

      const result = await smartSearch("bitcoin price");

      expect(result.intent).toBe("price_lookup");
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].type).toBe("coin");
      expect(result.results[0].id).toBe("coin:bitcoin");
      expect(result.results[0].title).toContain("Bitcoin");
      expect(result.results[0].title).toContain("BTC");
    });

    it("includes relevance scores based on market cap rank", async () => {
      vi.mocked(searchCoins).mockResolvedValue(mockCoinSearchResult());
      vi.mocked(getProtocols).mockResolvedValue([]);

      const result = await smartSearch("bitcoin price");

      // Bitcoin (rank 1) should have higher score than BCH (rank 18)
      const btc = result.results.find((r) => r.id === "coin:bitcoin");
      const bch = result.results.find((r) => r.id === "coin:bitcoin-cash");
      expect(btc).toBeDefined();
      expect(bch).toBeDefined();
      expect(btc!.relevanceScore).toBeGreaterThan(bch!.relevanceScore);
    });
  });

  // ─── Yield Search ─────────────────────────────────────────

  describe("yield_search intent", () => {
    it("returns yield pools sorted by APY", async () => {
      vi.mocked(getYieldPools).mockResolvedValue(mockYieldPools());
      vi.mocked(getProtocols).mockResolvedValue(mockProtocols());

      const result = await smartSearch("best yields");

      expect(result.intent).toBe("yield_search");
      const pools = result.results.filter((r) => r.type === "pool");
      expect(pools.length).toBeGreaterThan(0);

      // Should be sorted by APY descending
      for (let i = 1; i < pools.length; i++) {
        expect(pools[i - 1].relevanceScore).toBeGreaterThanOrEqual(pools[i].relevanceScore);
      }
    });

    it("filters for stablecoin pools when query mentions stablecoins", async () => {
      vi.mocked(getYieldPools).mockResolvedValue(mockYieldPools());
      vi.mocked(getProtocols).mockResolvedValue([]);

      const result = await smartSearch("stablecoin yields");

      const pools = result.results.filter((r) => r.type === "pool");
      for (const pool of pools) {
        expect(pool.data.stablecoin).toBe(true);
      }
    });
  });

  // ─── News Search ──────────────────────────────────────────

  describe("news_search intent", () => {
    it("returns news articles", async () => {
      vi.mocked(searchNews).mockResolvedValue(mockNewsResponse());
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });

      const result = await smartSearch("latest crypto news");

      expect(result.intent).toBe("news_search");
      const newsResults = result.results.filter((r) => r.type === "news");
      expect(newsResults.length).toBeGreaterThan(0);
      expect(newsResults[0].url).toBeDefined();
    });
  });

  // ─── Protocol Search ──────────────────────────────────────

  describe("protocol_search intent", () => {
    it("returns protocols matched by name", async () => {
      vi.mocked(getProtocols).mockResolvedValue(mockProtocols());
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });

      const result = await smartSearch("Aave TVL");

      expect(result.intent).toBe("protocol_search");
      const protocols = result.results.filter((r) => r.type === "protocol");
      expect(protocols.length).toBeGreaterThan(0);
      expect(protocols[0].title).toBe("Aave");
      expect(protocols[0].data.tvl).toBe(12_000_000_000);
    });

    it("matches protocols by category", async () => {
      vi.mocked(getProtocols).mockResolvedValue(mockProtocols());
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });

      const result = await smartSearch("lending protocol");

      const protocols = result.results.filter((r) => r.type === "protocol");
      expect(protocols.some((p) => p.title === "Aave")).toBe(true);
    });
  });

  // ─── Event Query ──────────────────────────────────────────

  describe("event_query intent", () => {
    it("returns news and semantic results for event queries", async () => {
      vi.mocked(searchNews).mockResolvedValue(mockNewsResponse());
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });
      vi.mocked(vectorStore.count).mockResolvedValue(0);

      const result = await smartSearch("what happened to Luna");

      expect(result.intent).toBe("event_query");
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  // ─── Comparison ───────────────────────────────────────────

  describe("comparison intent", () => {
    it("returns coins and protocols for comparison queries", async () => {
      vi.mocked(searchCoins).mockResolvedValue(mockCoinSearchResult());
      vi.mocked(getProtocols).mockResolvedValue(mockProtocols());

      const result = await smartSearch("ETH vs SOL");

      expect(result.intent).toBe("comparison");
      expect(result.results.length).toBeGreaterThan(0);
    });
  });

  // ─── General Query ────────────────────────────────────────

  describe("general intent", () => {
    it("searches across all sources for general queries", async () => {
      vi.mocked(searchCoins).mockResolvedValue(mockCoinSearchResult());
      vi.mocked(getProtocols).mockResolvedValue(mockProtocols());
      vi.mocked(searchNews).mockResolvedValue(mockNewsResponse());

      const result = await smartSearch("crypto");

      expect(result.intent).toBe("general");
      const types = new Set(result.results.map((r) => r.type));
      // Should have multiple types (coin, protocol, news)
      expect(types.size).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Deduplication ────────────────────────────────────────

  describe("deduplication", () => {
    it("removes duplicate results by ID", async () => {
      // Both coin search and protocol search might return overlapping data
      vi.mocked(searchCoins).mockResolvedValue({
        coins: [
          { id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1 },
          { id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1 },
        ],
      });
      vi.mocked(getProtocols).mockResolvedValue([]);
      vi.mocked(searchNews).mockResolvedValue({
        articles: [],
        totalCount: 0,
        sources: [],
        timestamp: new Date().toISOString(),
      });

      const result = await smartSearch("bitcoin");

      const bitcoinResults = result.results.filter((r) => r.id === "coin:bitcoin");
      expect(bitcoinResults).toHaveLength(1);
    });
  });

  // ─── Relevance Filtering ──────────────────────────────────

  describe("relevance filtering", () => {
    it("filters out results below minRelevance", async () => {
      vi.mocked(searchCoins).mockResolvedValue({
        coins: [
          { id: "bitcoin", name: "Bitcoin", symbol: "btc", market_cap_rank: 1 },
          { id: "obscurecoin", name: "Obscure Coin", symbol: "obs", market_cap_rank: 999 },
        ],
      });

      const result = await smartSearch("bitcoin price", { minRelevance: 0.5 });

      // Very low-ranked coins should be filtered out
      const obscure = result.results.find((r) => r.id === "coin:obscurecoin");
      expect(obscure).toBeUndefined();
    });
  });

  // ─── Limit ────────────────────────────────────────────────

  describe("result limiting", () => {
    it("respects the limit option", async () => {
      const manyCoins = Array.from({ length: 20 }, (_, i) => ({
        id: `coin-${i}`,
        name: `Coin ${i}`,
        symbol: `C${i}`,
        market_cap_rank: i + 1,
      }));
      vi.mocked(searchCoins).mockResolvedValue({ coins: manyCoins });
      vi.mocked(getProtocols).mockResolvedValue([]);

      const result = await smartSearch("bitcoin price", { limit: 3 });

      expect(result.results.length).toBeLessThanOrEqual(3);
    });
  });

  // ─── Type Filtering ───────────────────────────────────────

  describe("type filtering", () => {
    it("only returns results of specified types", async () => {
      vi.mocked(searchCoins).mockResolvedValue(mockCoinSearchResult());
      vi.mocked(getProtocols).mockResolvedValue(mockProtocols());
      vi.mocked(searchNews).mockResolvedValue(mockNewsResponse());

      const result = await smartSearch("crypto", { types: ["coin"] });

      for (const r of result.results) {
        expect(r.type).toBe("coin");
      }
    });
  });

  // ─── Metadata ─────────────────────────────────────────────

  describe("result metadata", () => {
    it("includes searchTimeMs", async () => {
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });

      const result = await smartSearch("test");

      expect(result.searchTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.searchTimeMs).toBe("number");
    });

    it("includes query and intent in result", async () => {
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });

      const result = await smartSearch("bitcoin price");

      expect(result.query).toBe("bitcoin price");
      expect(result.intent).toBe("price_lookup");
    });

    it("generates suggestions", async () => {
      vi.mocked(searchCoins).mockResolvedValue(mockCoinSearchResult());
      vi.mocked(getProtocols).mockResolvedValue([]);

      const result = await smartSearch("bitcoin price");

      expect(result.suggestions).toBeInstanceOf(Array);
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeLessThanOrEqual(5);
    });
  });

  // ─── Caching ──────────────────────────────────────────────

  describe("caching", () => {
    it("returns cached result on cache hit", async () => {
      const cachedResult = {
        query: "test",
        intent: "general",
        results: [{ id: "cached:1", type: "coin", title: "Cached", description: "", relevanceScore: 1, data: {} }],
        suggestions: [],
        totalResults: 1,
        searchTimeMs: 5,
      };
      vi.mocked(cache.get).mockResolvedValue(JSON.stringify(cachedResult));

      const result = await smartSearch("test");

      expect(result.results).toHaveLength(1);
      expect(result.results[0].id).toBe("cached:1");
      // Should not call any external sources
      expect(searchCoins).not.toHaveBeenCalled();
    });

    it("caches results for subsequent requests", async () => {
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });

      await smartSearch("test");

      expect(cache.set).toHaveBeenCalled();
      const [key, , ttl] = vi.mocked(cache.set).mock.calls[0];
      expect(key).toContain("search:");
      expect(ttl).toBe(120);
    });
  });

  // ─── Error Resilience ─────────────────────────────────────

  describe("error resilience", () => {
    it("returns partial results when some strategies fail", async () => {
      vi.mocked(searchCoins).mockRejectedValue(new Error("CoinGecko down"));
      vi.mocked(getProtocols).mockResolvedValue(mockProtocols());
      vi.mocked(searchNews).mockResolvedValue(mockNewsResponse());

      const result = await smartSearch("crypto");

      // Should still have protocol and news results
      expect(result.results.length).toBeGreaterThan(0);
    });

    it("returns empty results when all strategies fail", async () => {
      vi.mocked(searchCoins).mockRejectedValue(new Error("CoinGecko down"));
      vi.mocked(getProtocols).mockRejectedValue(new Error("DeFiLlama down"));
      vi.mocked(searchNews).mockRejectedValue(new Error("News down"));

      const result = await smartSearch("crypto");

      expect(result.results).toHaveLength(0);
      expect(result.totalResults).toBe(0);
    });

    it("handles invalid cache gracefully", async () => {
      vi.mocked(cache.get).mockResolvedValue("not valid json{{{");
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });

      // Should not throw
      const result = await smartSearch("test");
      expect(result).toBeDefined();
    });
  });

  // ─── Semantic Search Integration ──────────────────────────

  describe("semantic search", () => {
    it("includes semantic results for concept queries", async () => {
      vi.mocked(vectorStore.count).mockResolvedValue(100);
      vi.mocked(generateEmbedding).mockResolvedValue(Array(768).fill(0.1));
      vi.mocked(vectorStore.search).mockResolvedValue([
        {
          id: "concept:impermanent-loss",
          content: "Impermanent loss occurs when...",
          metadata: { category: "concept" },
          score: 0.85,
        },
      ]);
      vi.mocked(searchNews).mockResolvedValue({
        articles: [],
        totalCount: 0,
        sources: [],
        timestamp: new Date().toISOString(),
      });
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });

      const result = await smartSearch("what is impermanent loss");

      expect(result.intent).toBe("concept_explain");
      const semantic = result.results.find((r) => r.id === "concept:impermanent-loss");
      expect(semantic).toBeDefined();
      expect(semantic!.type).toBe("concept");
      expect(semantic!.relevanceScore).toBe(0.85);
    });

    it("skips semantic search when vector store is empty", async () => {
      vi.mocked(vectorStore.count).mockResolvedValue(0);
      vi.mocked(searchCoins).mockResolvedValue({ coins: [] });

      await smartSearch("what is impermanent loss");

      expect(generateEmbedding).not.toHaveBeenCalled();
    });
  });
});
