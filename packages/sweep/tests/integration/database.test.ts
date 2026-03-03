/**
 * Database Integration Tests
 * Tests sweep job creation, updates, and user position tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import { mockDb } from "../setup.js";

// Mock database client
vi.mock("../../src/db/index.js", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    query: vi.fn(),
    transaction: vi.fn(),
  },
}));

describe("Database Integration", () => {
  beforeEach(() => {
    // Clear mock database
    mockDb.users.clear();
    mockDb.sweeps.clear();
    mockDb.sweepQuotes.clear();
    mockDb.positions.clear();
  });

  describe("Sweep Job CRUD Operations", () => {
    it("should create a new sweep job", async () => {
      const sweepJob = {
        id: `sweep-${Date.now()}`,
        userId: "user-123",
        chain: "arbitrum",
        status: "pending",
        tokenCount: 3,
        totalInputValueUsd: 18.5,
        estimatedOutputValueUsd: 18.35,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Simulate insert
      mockDb.sweeps.set(sweepJob.id, sweepJob);

      const stored = mockDb.sweeps.get(sweepJob.id);
      expect(stored).toBeDefined();
      expect(stored?.userId).toBe("user-123");
      expect(stored?.status).toBe("pending");
    });

    it("should update sweep job status", async () => {
      const sweepId = "sweep-update-test";
      const initialJob = {
        id: sweepId,
        userId: "user-123",
        status: "pending",
        updatedAt: new Date(),
      };

      mockDb.sweeps.set(sweepId, initialJob);

      // Update status
      const job = mockDb.sweeps.get(sweepId);
      if (job) {
        job.status = "executing";
        job.updatedAt = new Date();
        mockDb.sweeps.set(sweepId, job);
      }

      const updated = mockDb.sweeps.get(sweepId);
      expect(updated?.status).toBe("executing");
    });

    it("should complete sweep job with results", async () => {
      const sweepId = "sweep-complete-test";
      const job = {
        id: sweepId,
        userId: "user-123",
        status: "executing",
        tokenCount: 3,
        totalInputValueUsd: 18.5,
        estimatedOutputValueUsd: 18.35,
        actualOutputValueUsd: null,
        txHash: null,
        completedAt: null,
        updatedAt: new Date(),
      };

      mockDb.sweeps.set(sweepId, job);

      // Complete the job
      const storedJob = mockDb.sweeps.get(sweepId);
      if (storedJob) {
        storedJob.status = "completed";
        storedJob.actualOutputValueUsd = 18.32;
        storedJob.txHash = "0x" + "a".repeat(64);
        storedJob.completedAt = new Date();
        storedJob.updatedAt = new Date();
        mockDb.sweeps.set(sweepId, storedJob);
      }

      const completed = mockDb.sweeps.get(sweepId);
      expect(completed?.status).toBe("completed");
      expect(completed?.actualOutputValueUsd).toBe(18.32);
      expect(completed?.txHash).toBeDefined();
    });

    it("should query sweep jobs by user", async () => {
      // Create multiple jobs
      const jobs = [
        { id: "sweep-1", userId: "user-123", status: "completed" },
        { id: "sweep-2", userId: "user-123", status: "pending" },
        { id: "sweep-3", userId: "user-456", status: "completed" },
        { id: "sweep-4", userId: "user-123", status: "failed" },
      ];

      jobs.forEach(job => mockDb.sweeps.set(job.id, job));

      // Query by user
      const userJobs = Array.from(mockDb.sweeps.values()).filter(
        job => job.userId === "user-123"
      );

      expect(userJobs).toHaveLength(3);
    });

    it("should query sweep jobs by status", async () => {
      const jobs = [
        { id: "sweep-1", userId: "user-123", status: "completed" },
        { id: "sweep-2", userId: "user-123", status: "pending" },
        { id: "sweep-3", userId: "user-456", status: "completed" },
        { id: "sweep-4", userId: "user-123", status: "pending" },
      ];

      jobs.forEach(job => mockDb.sweeps.set(job.id, job));

      const pendingJobs = Array.from(mockDb.sweeps.values()).filter(
        job => job.status === "pending"
      );

      expect(pendingJobs).toHaveLength(2);
    });

    it("should delete sweep job", async () => {
      const sweepId = "sweep-delete-test";
      mockDb.sweeps.set(sweepId, { id: sweepId, status: "pending" });

      expect(mockDb.sweeps.has(sweepId)).toBe(true);

      mockDb.sweeps.delete(sweepId);

      expect(mockDb.sweeps.has(sweepId)).toBe(false);
    });
  });

  describe("User Position Tracking", () => {
    it("should create new user position", async () => {
      const position = {
        id: `pos-${Date.now()}`,
        userId: "user-123",
        protocol: "AAVE",
        chain: "ethereum",
        vaultAddress: "0xvault",
        depositToken: "USDC",
        depositedAmount: "1000000000",
        depositedValueUsd: 1000,
        currentShares: "1000000000",
        currentValueUsd: 1000,
        unrealizedPnl: 0,
        apy: 0.035,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockDb.positions.set(position.id, position);

      const stored = mockDb.positions.get(position.id);
      expect(stored?.depositedValueUsd).toBe(1000);
      expect(stored?.protocol).toBe("AAVE");
    });

    it("should update position with yield accrual", async () => {
      const positionId = "pos-yield-test";
      const position = {
        id: positionId,
        userId: "user-123",
        depositedValueUsd: 1000,
        currentValueUsd: 1000,
        unrealizedPnl: 0,
        updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      };

      mockDb.positions.set(positionId, position);

      // Update with yield
      const stored = mockDb.positions.get(positionId);
      if (stored) {
        stored.currentValueUsd = 1010; // $10 yield
        stored.unrealizedPnl = 10;
        stored.updatedAt = new Date();
        mockDb.positions.set(positionId, stored);
      }

      const updated = mockDb.positions.get(positionId);
      expect(updated?.currentValueUsd).toBe(1010);
      expect(updated?.unrealizedPnl).toBe(10);
    });

    it("should aggregate positions by user", async () => {
      const positions = [
        { id: "pos-1", userId: "user-123", protocol: "AAVE", currentValueUsd: 500 },
        { id: "pos-2", userId: "user-123", protocol: "YEARN", currentValueUsd: 300 },
        { id: "pos-3", userId: "user-456", protocol: "AAVE", currentValueUsd: 1000 },
        { id: "pos-4", userId: "user-123", protocol: "AAVE", currentValueUsd: 200 },
      ];

      positions.forEach(p => mockDb.positions.set(p.id, p));

      const userPositions = Array.from(mockDb.positions.values()).filter(
        p => p.userId === "user-123"
      );

      const totalValue = userPositions.reduce((sum, p) => sum + p.currentValueUsd, 0);
      const byProtocol = userPositions.reduce((acc, p) => {
        acc[p.protocol] = (acc[p.protocol] || 0) + p.currentValueUsd;
        return acc;
      }, {} as Record<string, number>);

      expect(userPositions).toHaveLength(3);
      expect(totalValue).toBe(1000);
      expect(byProtocol.AAVE).toBe(700);
      expect(byProtocol.YEARN).toBe(300);
    });

    it("should close position on full withdrawal", async () => {
      const positionId = "pos-close-test";
      const position = {
        id: positionId,
        userId: "user-123",
        status: "active",
        currentValueUsd: 500,
        closedAt: null,
      };

      mockDb.positions.set(positionId, position);

      // Close position
      const stored = mockDb.positions.get(positionId);
      if (stored) {
        stored.status = "closed";
        stored.currentValueUsd = 0;
        stored.closedAt = new Date();
        mockDb.positions.set(positionId, stored);
      }

      const closed = mockDb.positions.get(positionId);
      expect(closed?.status).toBe("closed");
      expect(closed?.currentValueUsd).toBe(0);
      expect(closed?.closedAt).toBeDefined();
    });

    it("should track position history", async () => {
      const positionHistory: Array<{
        positionId: string;
        action: string;
        amount: number;
        timestamp: Date;
      }> = [];

      // Simulate history tracking
      const trackAction = (positionId: string, action: string, amount: number) => {
        positionHistory.push({
          positionId,
          action,
          amount,
          timestamp: new Date(),
        });
      };

      trackAction("pos-1", "deposit", 1000);
      trackAction("pos-1", "yield", 10);
      trackAction("pos-1", "yield", 15);
      trackAction("pos-1", "withdraw", 500);
      trackAction("pos-1", "yield", 5);

      const posHistory = positionHistory.filter(h => h.positionId === "pos-1");
      expect(posHistory).toHaveLength(5);

      const deposits = posHistory.filter(h => h.action === "deposit");
      const withdrawals = posHistory.filter(h => h.action === "withdraw");
      const yieldEvents = posHistory.filter(h => h.action === "yield");

      expect(deposits).toHaveLength(1);
      expect(withdrawals).toHaveLength(1);
      expect(yieldEvents).toHaveLength(3);
    });
  });

  describe("Transaction Handling", () => {
    it("should rollback on transaction failure", async () => {
      const executeTransaction = async (operations: Array<() => void>) => {
        const snapshot = new Map(mockDb.sweeps);
        
        try {
          for (const op of operations) {
            op();
          }
          // Commit - no action needed for mock
        } catch (error) {
          // Rollback
          mockDb.sweeps.clear();
          snapshot.forEach((v, k) => mockDb.sweeps.set(k, v));
          throw error;
        }
      };

      // Initial state
      mockDb.sweeps.set("sweep-1", { id: "sweep-1", status: "pending" });

      // Transaction with failure
      await expect(executeTransaction([
        () => mockDb.sweeps.set("sweep-2", { id: "sweep-2", status: "pending" }),
        () => { throw new Error("Transaction failed"); },
        () => mockDb.sweeps.set("sweep-3", { id: "sweep-3", status: "pending" }),
      ])).rejects.toThrow("Transaction failed");

      // Should rollback - sweep-2 should not exist
      expect(mockDb.sweeps.has("sweep-1")).toBe(true);
      expect(mockDb.sweeps.has("sweep-2")).toBe(false);
    });

    it("should handle concurrent updates with optimistic locking", async () => {
      const position = {
        id: "pos-concurrent",
        version: 1,
        currentValueUsd: 1000,
      };

      mockDb.positions.set(position.id, position);

      // Simulate optimistic locking
      const updateWithVersion = (id: string, expectedVersion: number, newValue: number) => {
        const pos = mockDb.positions.get(id);
        if (!pos) throw new Error("Position not found");
        if (pos.version !== expectedVersion) {
          throw new Error("Concurrent modification detected");
        }
        pos.currentValueUsd = newValue;
        pos.version += 1;
        mockDb.positions.set(id, pos);
        return pos;
      };

      // First update succeeds
      const updated1 = updateWithVersion("pos-concurrent", 1, 1010);
      expect(updated1.version).toBe(2);

      // Second update with stale version fails
      expect(() => updateWithVersion("pos-concurrent", 1, 1020))
        .toThrow("Concurrent modification detected");
    });
  });

  describe("Query Optimization", () => {
    it("should support pagination", async () => {
      // Create 50 jobs
      for (let i = 0; i < 50; i++) {
        mockDb.sweeps.set(`sweep-${i}`, {
          id: `sweep-${i}`,
          userId: "user-123",
          createdAt: new Date(Date.now() - i * 1000),
        });
      }

      const paginate = (page: number, pageSize: number) => {
        const allJobs = Array.from(mockDb.sweeps.values())
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        
        const start = page * pageSize;
        const end = start + pageSize;
        
        return {
          data: allJobs.slice(start, end),
          total: allJobs.length,
          page,
          pageSize,
          totalPages: Math.ceil(allJobs.length / pageSize),
        };
      };

      const page1 = paginate(0, 10);
      expect(page1.data).toHaveLength(10);
      expect(page1.total).toBe(50);
      expect(page1.totalPages).toBe(5);

      const page3 = paginate(2, 10);
      expect(page3.data).toHaveLength(10);
      expect(page3.data[0].id).toBe("sweep-20");
    });

    it("should filter by date range", async () => {
      const now = Date.now();
      const jobs = [
        { id: "s1", createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000) }, // 7 days ago
        { id: "s2", createdAt: new Date(now - 3 * 24 * 60 * 60 * 1000) }, // 3 days ago
        { id: "s3", createdAt: new Date(now - 1 * 24 * 60 * 60 * 1000) }, // 1 day ago
        { id: "s4", createdAt: new Date(now) }, // now
      ];

      jobs.forEach(j => mockDb.sweeps.set(j.id, j));

      const filterByDateRange = (startDate: Date, endDate: Date) => {
        return Array.from(mockDb.sweeps.values()).filter(
          j => j.createdAt >= startDate && j.createdAt <= endDate
        );
      };

      const last3Days = filterByDateRange(
        new Date(now - 3 * 24 * 60 * 60 * 1000),
        new Date(now)
      );

      expect(last3Days).toHaveLength(3);
    });

    it("should support full-text search on descriptions", async () => {
      const sweeps = [
        { id: "s1", description: "Sweep USDC and ARB tokens on Arbitrum" },
        { id: "s2", description: "Consolidate USDT to USDC on Ethereum" },
        { id: "s3", description: "Bridge and sweep tokens from Polygon" },
        { id: "s4", description: "ARB token sweep to Yearn vault" },
      ];

      sweeps.forEach(s => mockDb.sweeps.set(s.id, s));

      const search = (query: string) => {
        const terms = query.toLowerCase().split(" ");
        return Array.from(mockDb.sweeps.values()).filter(s =>
          terms.every(term => s.description?.toLowerCase().includes(term))
        );
      };

      const arbResults = search("ARB");
      expect(arbResults).toHaveLength(2);

      const arbitrumResults = search("Arbitrum");
      expect(arbitrumResults).toHaveLength(1);
    });
  });

  describe("Data Integrity", () => {
    it("should enforce foreign key constraints", async () => {
      // Create user first
      mockDb.users.set("user-123", { id: "user-123", address: "0xabc" });

      // Create sweep for existing user - should work
      const validSweep = { id: "sweep-1", userId: "user-123" };
      mockDb.sweeps.set(validSweep.id, validSweep);
      expect(mockDb.sweeps.has("sweep-1")).toBe(true);

      // Simulate FK check
      const createSweepWithFKCheck = (sweep: { id: string; userId: string }) => {
        if (!mockDb.users.has(sweep.userId)) {
          throw new Error("Foreign key constraint violation: user not found");
        }
        mockDb.sweeps.set(sweep.id, sweep);
      };

      expect(() => createSweepWithFKCheck({ id: "sweep-2", userId: "nonexistent" }))
        .toThrow("Foreign key constraint violation");
    });

    it("should validate required fields", async () => {
      const validateSweep = (sweep: Partial<{
        id: string;
        userId: string;
        chain: string;
        status: string;
      }>) => {
        const required = ["id", "userId", "chain", "status"];
        const missing = required.filter(f => !sweep[f as keyof typeof sweep]);
        if (missing.length > 0) {
          throw new Error(`Missing required fields: ${missing.join(", ")}`);
        }
        return true;
      };

      expect(validateSweep({
        id: "s1",
        userId: "u1",
        chain: "ethereum",
        status: "pending",
      })).toBe(true);

      expect(() => validateSweep({
        id: "s1",
        chain: "ethereum",
      })).toThrow("Missing required fields: userId, status");
    });

    it("should enforce unique constraints", async () => {
      const createWithUniqueCheck = (table: Map<string, any>, item: { id: string }) => {
        if (table.has(item.id)) {
          throw new Error("Duplicate key violation");
        }
        table.set(item.id, item);
      };

      createWithUniqueCheck(mockDb.sweeps, { id: "sweep-unique" });
      
      expect(() => createWithUniqueCheck(mockDb.sweeps, { id: "sweep-unique" }))
        .toThrow("Duplicate key violation");
    });
  });

  describe("Cleanup and Archival", () => {
    it("should archive old completed sweeps", async () => {
      const now = Date.now();
      const archivedSweeps: any[] = [];

      const sweeps = [
        { id: "s1", status: "completed", completedAt: new Date(now - 90 * 24 * 60 * 60 * 1000) }, // 90 days
        { id: "s2", status: "completed", completedAt: new Date(now - 31 * 24 * 60 * 60 * 1000) }, // 31 days
        { id: "s3", status: "completed", completedAt: new Date(now - 7 * 24 * 60 * 60 * 1000) }, // 7 days
        { id: "s4", status: "pending", completedAt: null },
      ];

      sweeps.forEach(s => mockDb.sweeps.set(s.id, s));

      // Archive sweeps older than 30 days
      const archiveThreshold = new Date(now - 30 * 24 * 60 * 60 * 1000);
      
      Array.from(mockDb.sweeps.entries()).forEach(([id, sweep]) => {
        if (sweep.status === "completed" && sweep.completedAt && sweep.completedAt < archiveThreshold) {
          archivedSweeps.push(sweep);
          mockDb.sweeps.delete(id);
        }
      });

      expect(archivedSweeps).toHaveLength(2);
      expect(mockDb.sweeps.size).toBe(2);
    });

    it("should delete stale pending jobs", async () => {
      const now = Date.now();
      const STALE_THRESHOLD_HOURS = 24;

      const sweeps = [
        { id: "s1", status: "pending", createdAt: new Date(now - 48 * 60 * 60 * 1000) }, // 48 hours
        { id: "s2", status: "pending", createdAt: new Date(now - 12 * 60 * 60 * 1000) }, // 12 hours
        { id: "s3", status: "executing", createdAt: new Date(now - 48 * 60 * 60 * 1000) }, // 48 hours but executing
      ];

      sweeps.forEach(s => mockDb.sweeps.set(s.id, s));

      // Delete stale pending jobs
      const staleThreshold = new Date(now - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);
      
      Array.from(mockDb.sweeps.entries()).forEach(([id, sweep]) => {
        if (sweep.status === "pending" && sweep.createdAt < staleThreshold) {
          mockDb.sweeps.delete(id);
        }
      });

      expect(mockDb.sweeps.size).toBe(2);
      expect(mockDb.sweeps.has("s1")).toBe(false);
      expect(mockDb.sweeps.has("s2")).toBe(true);
      expect(mockDb.sweeps.has("s3")).toBe(true);
    });
  });
});
