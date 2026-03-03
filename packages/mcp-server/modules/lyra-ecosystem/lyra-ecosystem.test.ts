/**
 * @file lyra-ecosystem.test.ts
 * @author n1ch0las
 * @copyright (c) 2026 nich.xbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum n1ch-0las-4e49-4348-786274000000
 */

/**
 * Lyra Ecosystem Tests
 * @description Unit tests for the Lyra unified payment layer
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import axios from "axios";

// Mock axios
vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
    })),
  },
}));

// Mock the x402 client
vi.mock("@/x402/client.js", () => ({
  createX402Client: vi.fn().mockResolvedValue({
    client: {},
    wrapAxios: (api: unknown) => api,
    hasNetwork: () => true,
    registeredNetworks: ["eip155:8453"],
  }),
}));

import { LyraClient, getLyraClient, resetLyraClient } from "./client.js";
import { LyraIntel } from "./intel.js";
import { LyraRegistry } from "./registry.js";
import { LyraDiscovery } from "./discovery.js";
import { LYRA_PRICES, TOOL_CATEGORIES, DISCOVERABLE_PROTOCOLS } from "./constants.js";

describe("LyraClient", () => {
  let client: LyraClient;

  beforeEach(() => {
    resetLyraClient();
    client = new LyraClient({
      x402Wallet: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should create client with default config", () => {
      const defaultClient = new LyraClient();
      expect(defaultClient).toBeDefined();
      expect(defaultClient.intel).toBeInstanceOf(LyraIntel);
      expect(defaultClient.registry).toBeInstanceOf(LyraRegistry);
      expect(defaultClient.discovery).toBeInstanceOf(LyraDiscovery);
    });

    it("should create client from environment variables", () => {
      const envClient = LyraClient.fromEnv();
      expect(envClient).toBeDefined();
    });

    it("should create read-only client", () => {
      const readOnlyClient = LyraClient.readOnly();
      expect(readOnlyClient).toBeDefined();
      expect(readOnlyClient.isPaymentEnabled()).toBe(false);
    });
  });

  describe("usage tracking", () => {
    it("should return empty usage stats initially", () => {
      const stats = client.getUsageStats("day");
      expect(stats.totalSpent).toBe("0.00");
      expect(stats.requestCount).toBe(0);
      expect(stats.byService.intel.requests).toBe(0);
      expect(stats.byService.registry.requests).toBe(0);
      expect(stats.byService.discovery.requests).toBe(0);
    });

    it("should return empty payment history initially", () => {
      const history = client.getPaymentHistory();
      expect(history).toHaveLength(0);
    });

    it("should return full daily allowance initially", () => {
      const remaining = client.getRemainingDailyAllowance();
      expect(parseFloat(remaining)).toBeGreaterThan(0);
    });
  });

  describe("pricing", () => {
    it("should return pricing information", () => {
      const pricing = client.getPricing();
      expect(pricing.intel).toBeDefined();
      expect(pricing.registry).toBeDefined();
      expect(pricing.discovery).toBeDefined();
    });

    it("should estimate total cost", () => {
      const cost = client.estimateTotalCost([
        { service: "intel", operation: "securityScan", count: 1 },
        { service: "registry", operation: "toolDetails", count: 2 },
        { service: "discovery", operation: "compatibility", count: 1 },
      ]);
      // $0.05 + $0.02 + $0.02 = $0.09
      expect(parseFloat(cost)).toBeCloseTo(0.09, 2);
    });
  });

  describe("getLyraClient singleton", () => {
    it("should return the same instance", () => {
      const client1 = getLyraClient();
      const client2 = getLyraClient();
      expect(client1).toBe(client2);
    });

    it("should reset the singleton", () => {
      const client1 = getLyraClient();
      resetLyraClient();
      const client2 = getLyraClient();
      expect(client1).not.toBe(client2);
    });
  });
});

describe("LYRA_PRICES", () => {
  it("should have correct Intel pricing", () => {
    expect(LYRA_PRICES.intel.fileAnalysis).toBe("0.00");
    expect(LYRA_PRICES.intel.securityScan).toBe("0.05");
    expect(LYRA_PRICES.intel.repoAudit).toBe("0.10");
    expect(LYRA_PRICES.intel.enterpriseAnalysis).toBe("1.00");
  });

  it("should have correct Registry pricing", () => {
    expect(LYRA_PRICES.registry.browse).toBe("0.00");
    expect(LYRA_PRICES.registry.toolDetails).toBe("0.01");
    expect(LYRA_PRICES.registry.privateRegistration).toBe("0.05");
    expect(LYRA_PRICES.registry.featuredListing).toBe("10.00");
  });

  it("should have correct Discovery pricing", () => {
    expect(LYRA_PRICES.discovery.basicDiscovery).toBe("0.00");
    expect(LYRA_PRICES.discovery.compatibility).toBe("0.02");
    expect(LYRA_PRICES.discovery.generateConfig).toBe("0.10");
    expect(LYRA_PRICES.discovery.fullAssistance).toBe("0.50");
  });
});

describe("Constants", () => {
  it("should have valid tool categories", () => {
    expect(TOOL_CATEGORIES).toContain("blockchain");
    expect(TOOL_CATEGORIES).toContain("ai-ml");
    expect(TOOL_CATEGORIES).toContain("web3");
  });

  it("should have valid discoverable protocols", () => {
    expect(DISCOVERABLE_PROTOCOLS).toContain("mcp");
    expect(DISCOVERABLE_PROTOCOLS).toContain("openapi");
    expect(DISCOVERABLE_PROTOCOLS).toContain("graphql");
  });
});

describe("LyraIntel", () => {
  let mockApi: ReturnType<typeof axios.create>;
  let intel: LyraIntel;

  beforeEach(() => {
    mockApi = axios.create() as ReturnType<typeof axios.create>;
    intel = new LyraIntel(mockApi);
  });

  it("should return pricing", () => {
    const pricing = intel.getPricing();
    expect(pricing.securityScan).toBe("0.05");
  });

  it("should estimate cost", () => {
    expect(intel.estimateCost("securityScan")).toBe("0.05");
    expect(intel.estimateCost("enterpriseAnalysis")).toBe("1.00");
  });
});

describe("LyraRegistry", () => {
  let mockApi: ReturnType<typeof axios.create>;
  let registry: LyraRegistry;

  beforeEach(() => {
    mockApi = axios.create() as ReturnType<typeof axios.create>;
    registry = new LyraRegistry(mockApi);
  });

  it("should return categories", () => {
    const categories = registry.getCategories();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories).toContain("blockchain");
  });

  it("should return pricing", () => {
    const pricing = registry.getPricing();
    expect(pricing.toolDetails).toBe("0.01");
  });
});

describe("LyraDiscovery", () => {
  let mockApi: ReturnType<typeof axios.create>;
  let discovery: LyraDiscovery;

  beforeEach(() => {
    mockApi = axios.create() as ReturnType<typeof axios.create>;
    discovery = new LyraDiscovery(mockApi);
  });

  it("should return supported protocols", () => {
    const protocols = discovery.getSupportedProtocols();
    expect(protocols).toContain("mcp");
    expect(protocols).toContain("openapi");
  });

  it("should return pricing", () => {
    const pricing = discovery.getPricing();
    expect(pricing.compatibility).toBe("0.02");
  });

  it("should clear cache", () => {
    discovery.clearCache();
    // Should not throw
    expect(true).toBe(true);
  });
});


/* EOF - nich | 0.14.9.3 */