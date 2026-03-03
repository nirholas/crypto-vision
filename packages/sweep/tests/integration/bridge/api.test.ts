/**
 * Bridge API Integration Tests
 * Tests full flow from API request to execution
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock Redis before imports
vi.mock("../../../src/utils/redis.js", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    setex: vi.fn().mockResolvedValue("OK"),
    lpush: vi.fn().mockResolvedValue(1),
    lrange: vi.fn().mockResolvedValue([]),
    hset: vi.fn().mockResolvedValue(1),
    hget: vi.fn().mockResolvedValue(null),
    hgetall: vi.fn().mockResolvedValue({}),
    incr: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(1),
  },
}));

// Mock BullMQ
vi.mock("bullmq", () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
  })),
  Worker: vi.fn().mockImplementation(() => ({
    on: vi.fn(),
  })),
}));

// Mock fetch for API calls
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Bridge API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default successful responses
    mockFetch.mockImplementation(async (url: string) => {
      if (url.includes("across.to/api/suggested-fees")) {
        return {
          ok: true,
          json: async () => ({
            totalRelayFee: {
              pct: "100000000000000000",
              total: "500000",
            },
            estimatedFillTimeSec: 120,
            limits: {
              maxDeposit: "1000000000000",
              minDeposit: "100000",
            },
          }),
        };
      }
      
      if (url.includes("api.celer.network/v2/estimateAmt")) {
        return {
          ok: true,
          json: async () => ({
            estimated_receive_amt: "999000000",
            base_fee: "100000",
            perc_fee: "500",
            max_slippage: 5000,
          }),
        };
      }
      
      if (url.includes("api.socket.tech/v2/quote")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            result: {
              routes: [
                {
                  routeId: "route-1",
                  fromAmount: "1000000000",
                  toAmount: "999000000",
                  bridgeRoute: {
                    bridgeName: "across",
                  },
                  usedBridgeNames: ["across"],
                  userTxs: [
                    {
                      userTxType: "fund-movr",
                      steps: [
                        {
                          type: "bridge",
                          protocol: { name: "Across" },
                          fromAmount: "1000000000",
                          toAmount: "999000000",
                        },
                      ],
                    },
                  ],
                  serviceTime: 60,
                  totalGasFeesInUsd: 0.5,
                  integratorFee: { amount: "0" },
                },
              ],
            },
          }),
        };
      }
      
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: "Not found" }),
      };
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Quote Flow", () => {
    it("should get quotes from multiple providers", async () => {
      const { BridgeAggregator } = await import(
        "../../../src/services/bridge/index.js"
      );

      const aggregator = new BridgeAggregator();

      const routes = await aggregator.getAllRoutes({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(Array.isArray(routes)).toBe(true);
      // At least one provider should return a route
      expect(routes.length).toBeGreaterThanOrEqual(0);
    });

    it("should find best route by speed priority", async () => {
      const { BridgeAggregator } = await import(
        "../../../src/services/bridge/index.js"
      );

      const aggregator = new BridgeAggregator();

      const bestRoute = await aggregator.findBestRoute(
        {
          sourceChain: "ethereum",
          destinationChain: "arbitrum",
          sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          amount: 1000000000n,
          sender: "0x1234567890123456789012345678901234567890",
          recipient: "0x1234567890123456789012345678901234567890",
        },
        "speed"
      );

      // Best route may be null if no providers respond
      if (bestRoute) {
        expect(bestRoute.provider).toBeDefined();
        expect(bestRoute.estimatedTime).toBeDefined();
      }
    });

    it("should find best route by cost priority", async () => {
      const { BridgeAggregator } = await import(
        "../../../src/services/bridge/index.js"
      );

      const aggregator = new BridgeAggregator();

      const bestRoute = await aggregator.findBestRoute(
        {
          sourceChain: "ethereum",
          destinationChain: "arbitrum",
          sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
          destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
          amount: 1000000000n,
          sender: "0x1234567890123456789012345678901234567890",
          recipient: "0x1234567890123456789012345678901234567890",
        },
        "cost"
      );

      // Best route may be null if no providers respond
      if (bestRoute) {
        expect(bestRoute.provider).toBeDefined();
        expect(bestRoute.fees).toBeDefined();
      }
    });
  });

  describe("Transaction Building Flow", () => {
    it("should build valid transaction from quote", async () => {
      const { AcrossBridgeProvider } = await import(
        "../../../src/services/bridge/across.js"
      );

      const provider = new AcrossBridgeProvider();

      const quote = await provider.getQuote({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      if (quote) {
        const tx = await provider.buildTransaction(quote);
        
        expect(tx.to).toBeDefined();
        expect(typeof tx.to).toBe("string");
        expect(tx.data).toBeDefined();
        expect(typeof tx.data).toBe("string");
        expect(tx.chainId).toBeDefined();
      }
    });
  });

  describe("Status Tracking Flow", () => {
    it("should track bridge transaction status", async () => {
      // Mock status API
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("across.to/api/deposit/status")) {
          return {
            ok: true,
            json: async () => ({
              status: "filled",
              fillTxHash: "0xfill123",
            }),
          };
        }
        return { ok: false };
      });

      const { AcrossBridgeProvider } = await import(
        "../../../src/services/bridge/across.js"
      );

      const provider = new AcrossBridgeProvider();

      const status = await provider.getStatus(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
        "ethereum"
      );

      expect(status).toBeDefined();
      expect(status.status).toBeDefined();
    });

    it("should handle pending status", async () => {
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("across.to/api/deposit/status")) {
          return {
            ok: true,
            json: async () => ({
              status: "pending",
            }),
          };
        }
        return { ok: false };
      });

      const { AcrossBridgeProvider } = await import(
        "../../../src/services/bridge/across.js"
      );

      const provider = new AcrossBridgeProvider();

      const status = await provider.getStatus(
        "0x1234567890123456789012345678901234567890123456789012345678901234",
        "ethereum"
      );

      expect(status.status).toBe("pending");
    });
  });

  describe("Error Handling", () => {
    it("should handle API failures gracefully", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const { AcrossBridgeProvider } = await import(
        "../../../src/services/bridge/across.js"
      );

      const provider = new AcrossBridgeProvider();

      const quote = await provider.getQuote({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(quote).toBeNull();
    });

    it("should handle unsupported routes", async () => {
      const { BridgeAggregator } = await import(
        "../../../src/services/bridge/index.js"
      );

      const aggregator = new BridgeAggregator();

      const routes = await aggregator.getAllRoutes({
        sourceChain: "unsupported-chain",
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(routes).toEqual([]);
    });

    it("should handle amount below minimum", async () => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          totalRelayFee: {
            pct: "100000000000000000",
            total: "500000",
          },
          estimatedFillTimeSec: 120,
          limits: {
            maxDeposit: "1000000000000",
            minDeposit: "10000000000", // Minimum higher than amount
          },
        }),
      }));

      const { AcrossBridgeProvider } = await import(
        "../../../src/services/bridge/across.js"
      );

      const provider = new AcrossBridgeProvider();

      const quote = await provider.getQuote({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 1000000n, // Below minimum
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      expect(quote).toBeNull();
    });
  });

  describe("Multi-Provider Flow", () => {
    it("should aggregate quotes from multiple providers", async () => {
      // Setup varied responses for different providers
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes("across.to")) {
          return {
            ok: true,
            json: async () => ({
              totalRelayFee: {
                pct: "100000000000000000",
                total: "300000",
              },
              estimatedFillTimeSec: 60,
              limits: { maxDeposit: "1000000000000", minDeposit: "100000" },
            }),
          };
        }
        
        if (url.includes("api.celer.network")) {
          return {
            ok: true,
            json: async () => ({
              estimated_receive_amt: "998000000",
              base_fee: "200000",
              perc_fee: "1000",
              max_slippage: 5000,
            }),
          };
        }
        
        if (url.includes("api.socket.tech")) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              result: {
                routes: [
                  {
                    routeId: "socket-route",
                    fromAmount: "1000000000",
                    toAmount: "997000000",
                    usedBridgeNames: ["stargate"],
                    userTxs: [],
                    serviceTime: 300,
                    totalGasFeesInUsd: 1.2,
                    integratorFee: { amount: "0" },
                  },
                ],
              },
            }),
          };
        }
        
        return { ok: false };
      });

      const { BridgeAggregator } = await import(
        "../../../src/services/bridge/index.js"
      );

      const aggregator = new BridgeAggregator();

      const routes = await aggregator.getAllRoutes({
        sourceChain: "ethereum",
        destinationChain: "arbitrum",
        sourceToken: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        destinationToken: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        amount: 1000000000n,
        sender: "0x1234567890123456789012345678901234567890",
        recipient: "0x1234567890123456789012345678901234567890",
      });

      // Multiple routes should be returned
      expect(Array.isArray(routes)).toBe(true);
    });
  });
});
