/**
 * Consolidation Integration Tests
 * Tests multi-chain dust consolidation flow
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockRedis } from "../setup.js";

/**
 * JSON replacer that handles BigInt serialization (matches redis.ts)
 */
function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") {
    return { __type: "bigint", value: value.toString() };
  }
  return value;
}

/**
 * JSON reviver that handles BigInt deserialization (matches redis.ts)
 */
function bigIntReviver(_key: string, value: unknown): unknown {
  if (
    value &&
    typeof value === "object" &&
    (value as Record<string, unknown>).__type === "bigint"
  ) {
    return BigInt((value as { value: string }).value);
  }
  return value;
}

// Mock Redis
const mockRedis = createMockRedis();
vi.mock("../../src/utils/redis.js", () => ({
  getRedis: vi.fn(() => mockRedis),
  cacheGet: vi.fn((key) => mockRedis.get(key).then((v: string | null) => v ? JSON.parse(v, bigIntReviver) : null)),
  cacheSet: vi.fn((key, value, ttl) => mockRedis.setex(key, ttl, JSON.stringify(value, bigIntReplacer))),
}));

// Mock bridge aggregator
vi.mock("../../src/services/bridge/index.js", () => ({
  createBridgeAggregator: vi.fn(() => ({
    getAllRoutes: vi.fn(async (params) => {
      // Return mock bridge quotes
      return [
        {
          provider: "across",
          sourceChain: params.sourceChain,
          destinationChain: params.destChain,
          inputAmount: BigInt(params.amount),
          outputAmount: BigInt(Math.floor(Number(params.amount) * 0.995)),
          minOutputAmount: BigInt(Math.floor(Number(params.amount) * 0.99)),
          fees: {
            bridgeFee: 1000000n,
            gasFee: 500000n,
            relayerFee: 500000n,
            totalFeeUsd: 2,
          },
          feeUsd: 2,
          estimatedTime: 300,
          expiresAt: Date.now() + 300000,
          expiry: Date.now() + 300000,
          quoteId: `quote-${Date.now()}`,
          maxSlippage: 0.005,
          route: { steps: [], totalGasEstimate: 100000n, requiresApproval: false },
          sourceToken: { address: "0x" as `0x${string}`, symbol: "USDC", decimals: 6, chain: params.sourceChain },
          destinationToken: { address: "0x" as `0x${string}`, symbol: "USDC", decimals: 6, chain: params.destChain },
        },
      ];
    }),
    getBestQuote: vi.fn(async () => null),
    buildTransaction: vi.fn(async () => ({
      to: "0x0000000000000000000000000000000000000001" as `0x${string}`,
      data: "0x" as `0x${string}`,
      value: 0n,
    })),
    getStatus: vi.fn(async () => ({
      status: "pending",
      inputAmount: 1000000n,
    })),
  })),
  BridgeProvider: {
    ACROSS: "across",
    STARGATE: "stargate",
    HOP: "hop",
    CBRIDGE: "cbridge",
    SOCKET: "socket",
  },
}));

import {
  type ConsolidationEngine,
  createConsolidationEngine,
  ConsolidationStatus,
  ChainOperationStatus,
  type ConsolidationQuoteRequest,
} from "../../src/services/consolidation/index.js";

describe("Consolidation Integration", () => {
  let engine: ConsolidationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.flushall();
    engine = createConsolidationEngine();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Quote Generation", () => {
    it("should generate a consolidation quote for multiple chains", async () => {
      const request: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "base",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "USDC",
                decimals: 6,
                amount: "5000000", // $5
                valueUsd: 5,
              },
            ],
          },
          {
            chain: "arbitrum",
            tokens: [
              {
                address: "0xToken2" as `0x${string}`,
                symbol: "ARB",
                decimals: 18,
                amount: "3000000000000000000", // 3 ARB
                valueUsd: 3,
              },
            ],
          },
          {
            chain: "polygon",
            tokens: [
              {
                address: "0xToken3" as `0x${string}`,
                symbol: "MATIC",
                decimals: 18,
                amount: "8000000000000000000", // 8 MATIC
                valueUsd: 8,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
        priority: "cost",
      };

      const result = await engine.getQuote(request);

      expect(result.success).toBe(true);
      expect(result.plan).toBeDefined();
      expect(result.plan!.id).toMatch(/^plan-/);
      expect(result.plan!.chainPlans.length).toBe(3);
      expect(result.plan!.destinationChain).toBe("base");
      expect(result.plan!.totalInputValueUsd).toBe(16); // 5 + 3 + 8
    });

    it("should skip chains with insufficient value", async () => {
      const request: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "base",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "USDC",
                decimals: 6,
                amount: "5000000",
                valueUsd: 5,
              },
            ],
          },
          {
            chain: "arbitrum",
            tokens: [
              {
                address: "0xToken2" as `0x${string}`,
                symbol: "TOKEN",
                decimals: 18,
                amount: "100",
                valueUsd: 0.5, // Below $1 threshold
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const result = await engine.getQuote(request);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.some((w) => w.includes("Skipped"))).toBe(true);
    });

    it("should fail if no sources provided", async () => {
      const request: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const result = await engine.getQuote(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain("No source chains");
    });

    it("should calculate fees correctly", async () => {
      const request: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "arbitrum",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "USDC",
                decimals: 6,
                amount: "10000000",
                valueUsd: 10,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const result = await engine.getQuote(request);

      expect(result.success).toBe(true);
      expect(result.plan!.totalFeesUsd).toBeGreaterThan(0);
      expect(result.plan!.feePercentage).toBeGreaterThan(0);
      expect(result.plan!.feePercentage).toBeLessThan(100);
      expect(result.plan!.expectedOutputValueUsd).toBeLessThan(result.plan!.totalInputValueUsd);
    });
  });

  describe("Quote Execution", () => {
    it("should execute a consolidation plan", async () => {
      // First generate a quote
      const quoteRequest: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "base",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "USDC",
                decimals: 6,
                amount: "10000000",
                valueUsd: 10,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const quoteResult = await engine.getQuote(quoteRequest);
      expect(quoteResult.success).toBe(true);

      // Execute the plan
      const executeResult = await engine.execute({
        planId: quoteResult.plan!.id,
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      });

      expect(executeResult.success).toBe(true);
      expect(executeResult.consolidationId).toBeDefined();
      expect(executeResult.consolidationId).toMatch(/^cons-/);
      expect(executeResult.status).toBeDefined();
      expect(executeResult.status!.status).toBe(ConsolidationStatus.PENDING);
    });

    it("should reject expired plans", async () => {
      // Create a plan with past expiry
      const quoteRequest: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "base",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "USDC",
                decimals: 6,
                amount: "10000000",
                valueUsd: 10,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const quoteResult = await engine.getQuote(quoteRequest);
      expect(quoteResult.success).toBe(true);

      // Manually expire the plan
      const plan = quoteResult.plan!;
      plan.expiresAt = Date.now() - 1000;
      await mockRedis.setex(
        `consolidation:plan:${plan.id}`,
        300,
        JSON.stringify(plan, bigIntReplacer)
      );

      // Try to execute
      const executeResult = await engine.execute({
        planId: plan.id,
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      });

      expect(executeResult.success).toBe(false);
      expect(executeResult.error).toContain("expired");
    });

    it("should reject mismatched user ID", async () => {
      const quoteRequest: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "base",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "USDC",
                decimals: 6,
                amount: "10000000",
                valueUsd: 10,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const quoteResult = await engine.getQuote(quoteRequest);
      expect(quoteResult.success).toBe(true);

      // Try to execute with different user
      const executeResult = await engine.execute({
        planId: quoteResult.plan!.id,
        userId: "different-user",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      });

      expect(executeResult.success).toBe(false);
      expect(executeResult.error).toContain("mismatch");
    });
  });

  describe("Status Tracking", () => {
    it("should initialize status correctly", async () => {
      const quoteRequest: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "base",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "USDC",
                decimals: 6,
                amount: "5000000",
                valueUsd: 5,
              },
            ],
          },
          {
            chain: "arbitrum",
            tokens: [
              {
                address: "0xToken2" as `0x${string}`,
                symbol: "ARB",
                decimals: 18,
                amount: "3000000000000000000",
                valueUsd: 3,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const quoteResult = await engine.getQuote(quoteRequest);
      const executeResult = await engine.execute({
        planId: quoteResult.plan!.id,
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      });

      expect(executeResult.success).toBe(true);

      const status = await engine.getStatus(executeResult.consolidationId!);
      expect(status).toBeDefined();
      expect(status!.chainOperations.length).toBe(2);
      expect(status!.chainOperations.every((co) => co.status === ChainOperationStatus.PENDING)).toBe(true);
      expect(status!.completedChains).toBe(0);
      expect(status!.totalChains).toBe(2);
      expect(status!.progressPercent).toBe(0);
    });

    it("should return null for non-existent consolidation", async () => {
      const status = await engine.getStatus("non-existent-id");
      expect(status).toBeNull();
    });
  });

  describe("Simulation", () => {
    it("should simulate a consolidation without executing", async () => {
      const request: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "base",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "USDC",
                decimals: 6,
                amount: "10000000",
                valueUsd: 10,
              },
            ],
          },
          {
            chain: "arbitrum",
            tokens: [
              {
                address: "0xToken2" as `0x${string}`,
                symbol: "USDC",
                decimals: 6,
                amount: "5000000",
                valueUsd: 5,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const result = await engine.simulate(request);

      expect(result.success).toBe(true);
      expect(result.simulation).toBeDefined();
      expect(result.simulation!.chains.length).toBe(2);
      expect(result.simulation!.totalExpectedOutput).toBeGreaterThan(0);
      expect(result.simulation!.allRoutesAvailable).toBe(true);
    });
  });

  describe("Multi-Chain Sweep Example", () => {
    it("should handle the example flow: $5 Base + $3 Arbitrum + $8 Polygon → USDC on Base", async () => {
      const request: ConsolidationQuoteRequest = {
        userId: "user-example",
        userAddress: "0xExampleUser12345678901234567890123456" as `0x${string}`,
        sources: [
          {
            chain: "base",
            tokens: [
              {
                address: "0xDustToken1Base" as `0x${string}`,
                symbol: "DUST1",
                decimals: 18,
                amount: "5000000000000000000",
                valueUsd: 5,
              },
            ],
          },
          {
            chain: "arbitrum",
            tokens: [
              {
                address: "0xDustToken2Arb" as `0x${string}`,
                symbol: "DUST2",
                decimals: 18,
                amount: "3000000000000000000",
                valueUsd: 3,
              },
            ],
          },
          {
            chain: "polygon",
            tokens: [
              {
                address: "0xDustToken3Poly" as `0x${string}`,
                symbol: "DUST3",
                decimals: 18,
                amount: "8000000000000000000",
                valueUsd: 8,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`, // USDC on Base
        priority: "cost",
      };

      // Step 1: Get Quote
      const quoteResult = await engine.getQuote(request);
      expect(quoteResult.success).toBe(true);

      const plan = quoteResult.plan!;
      expect(plan.totalInputValueUsd).toBe(16); // $5 + $3 + $8
      expect(plan.chainPlans.length).toBe(3);

      // Verify chain plans
      const basePlan = plan.chainPlans.find((cp) => cp.chain === "base");
      const arbitrumPlan = plan.chainPlans.find((cp) => cp.chain === "arbitrum");
      const polygonPlan = plan.chainPlans.find((cp) => cp.chain === "polygon");

      expect(basePlan).toBeDefined();
      expect(basePlan!.bridge).toBeNull(); // Same chain, no bridge
      expect(arbitrumPlan).toBeDefined();
      expect(arbitrumPlan!.bridge).toBeDefined(); // Needs bridge
      expect(polygonPlan).toBeDefined();
      expect(polygonPlan!.bridge).toBeDefined(); // Needs bridge

      // Fees should be reasonable (less than 50% of total)
      expect(plan.feePercentage).toBeLessThan(50);

      // Expected output should be positive
      expect(plan.expectedOutputValueUsd).toBeGreaterThan(0);
      expect(plan.expectedOutputValueUsd).toBeLessThan(plan.totalInputValueUsd);

      // Step 2: Execute
      const executeResult = await engine.execute({
        planId: plan.id,
        userId: "user-example",
        userAddress: "0xExampleUser12345678901234567890123456" as `0x${string}`,
      });

      expect(executeResult.success).toBe(true);
      expect(executeResult.consolidationId).toBeDefined();

      // Step 3: Check Status
      const status = await engine.getStatus(executeResult.consolidationId!);
      expect(status).toBeDefined();
      expect(status!.totalChains).toBe(3);
      expect(status!.destinationChain).toBe("base");

      console.log("Example consolidation plan:", {
        totalInput: `$${plan.totalInputValueUsd.toFixed(2)}`,
        expectedOutput: `$${plan.expectedOutputValueUsd.toFixed(2)}`,
        totalFees: `$${plan.totalFeesUsd.toFixed(2)} (${plan.feePercentage.toFixed(1)}%)`,
        estimatedTime: `${Math.ceil(plan.estimatedTotalTimeSeconds / 60)} minutes`,
        chains: plan.chainPlans.map((cp) => ({
          chain: cp.chain,
          input: `$${cp.swapInputValueUsd.toFixed(2)}`,
          bridge: cp.bridge?.provider || "none",
        })),
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle same-chain consolidation (no bridges needed)", async () => {
      const request: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "base",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "TOKEN1",
                decimals: 18,
                amount: "5000000000000000000",
                valueUsd: 5,
              },
              {
                address: "0xToken2" as `0x${string}`,
                symbol: "TOKEN2",
                decimals: 18,
                amount: "3000000000000000000",
                valueUsd: 3,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const result = await engine.getQuote(request);

      expect(result.success).toBe(true);
      expect(result.plan!.chainPlans.length).toBe(1);
      expect(result.plan!.chainPlans[0].bridge).toBeNull();
      expect(result.plan!.totalBridgeFeesUsd).toBe(0);
    });

    it("should handle single token consolidation", async () => {
      const request: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "arbitrum",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "TOKEN",
                decimals: 18,
                amount: "10000000000000000000",
                valueUsd: 10,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const result = await engine.getQuote(request);

      expect(result.success).toBe(true);
      expect(result.plan!.sources.length).toBe(1);
      expect(result.plan!.chainPlans[0].bridge).toBeDefined();
    });

    it("should respect priority preferences", async () => {
      const baseRequest: ConsolidationQuoteRequest = {
        userId: "user-123",
        userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
        sources: [
          {
            chain: "arbitrum",
            tokens: [
              {
                address: "0xToken1" as `0x${string}`,
                symbol: "TOKEN",
                decimals: 18,
                amount: "10000000000000000000",
                valueUsd: 10,
              },
            ],
          },
        ],
        destinationChain: "base",
        destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      };

      const costResult = await engine.getQuote({ ...baseRequest, priority: "cost" });
      const speedResult = await engine.getQuote({ ...baseRequest, priority: "speed" });
      const reliabilityResult = await engine.getQuote({ ...baseRequest, priority: "reliability" });

      expect(costResult.plan!.optimizationStrategy).toBe("cost");
      expect(speedResult.plan!.optimizationStrategy).toBe("speed");
      expect(reliabilityResult.plan!.optimizationStrategy).toBe("reliability");
    });
  });
});

describe("Consolidation Optimizer", () => {
  it("should optimize chain execution order", async () => {
    const { createConsolidationOptimizer } = await import(
      "../../src/services/consolidation/optimizer.js"
    );
    const optimizer = createConsolidationOptimizer();

    const sources = [
      { chain: "ethereum" as const, tokens: [], totalValueUsd: 20, estimatedOutputUsd: 19.94, needsBridge: true },
      { chain: "arbitrum" as const, tokens: [], totalValueUsd: 8, estimatedOutputUsd: 7.976, needsBridge: true },
      { chain: "base" as const, tokens: [], totalValueUsd: 5, estimatedOutputUsd: 4.985, needsBridge: false },
    ];

    // Base (same chain) should be first due to no bridge
    // Arbitrum should be before Ethereum due to lower gas costs
    const result = await optimizer.optimize(
      sources,
      "base",
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      "0x1234567890123456789012345678901234567890" as `0x${string}`,
      "cost"
    );

    expect(result.executionOrder[0]).toBe("base"); // Same chain first
    expect(result.strategy).toBe("cost");
  });

  it("should calculate profitability correctly", async () => {
    const { createConsolidationOptimizer } = await import(
      "../../src/services/consolidation/optimizer.js"
    );
    const optimizer = createConsolidationOptimizer();

    // Profitable case
    const profitable = optimizer.isProfitable(100, 95, 3);
    expect(profitable.profitable).toBe(true);
    expect(profitable.ratio).toBe(0.95);
    expect(profitable.netValueUsd).toBe(92);

    // Unprofitable case
    const unprofitable = optimizer.isProfitable(10, 7, 5);
    expect(unprofitable.profitable).toBe(false);
    expect(unprofitable.ratio).toBe(0.7);
  });
});

describe("Status Tracker", () => {
  it("should track chain operation updates", async () => {
    const { getStatusTracker } = await import(
      "../../src/services/consolidation/status-tracker.js"
    );
    const tracker = getStatusTracker();

    const mockPlan = {
      id: "test-plan-123",
      userId: "user-123",
      userAddress: "0x1234567890123456789012345678901234567890" as `0x${string}`,
      sources: [],
      chainPlans: [
        { chain: "base" as const, swapInputValueUsd: 5 },
        { chain: "arbitrum" as const, swapInputValueUsd: 3 },
      ],
      destinationChain: "base" as const,
      destinationToken: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as `0x${string}`,
      totalInputValueUsd: 8,
      totalSwapFeesUsd: 0.024,
      totalBridgeFeesUsd: 2,
      totalGasFeesUsd: 0.15,
      totalFeesUsd: 2.174,
      expectedOutputValueUsd: 5.826,
      feePercentage: 27.175,
      estimatedTotalTimeSeconds: 600,
      createdAt: Date.now(),
      expiresAt: Date.now() + 1800000,
      optimizationStrategy: "cost" as const,
    };

    // Initialize status
    const status = await tracker.initializeStatus(mockPlan);
    expect(status.chainOperations.length).toBe(2);
    expect(status.progressPercent).toBe(0);

    // Mark swap started
    await tracker.markSwapStarted("test-plan-123", "base");
    const statusAfterStart = await tracker.getStatus("test-plan-123");
    expect(statusAfterStart!.chainOperations[0].status).toBe(ChainOperationStatus.SWAPPING);

    // Mark swap completed
    await tracker.markSwapCompleted(
      "test-plan-123",
      "base",
      "0x1234" as `0x${string}`,
      4985000n,
      4.985
    );
    const statusAfterSwap = await tracker.getStatus("test-plan-123");
    expect(statusAfterSwap!.chainOperations[0].status).toBe(ChainOperationStatus.SWAP_COMPLETE);
  });
});
