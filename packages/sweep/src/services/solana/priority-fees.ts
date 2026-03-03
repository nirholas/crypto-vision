/**
 * Solana Priority Fees Service
 * Dynamic priority fee calculation for fast transaction confirmation
 * 
 * Supports:
 * - Helius Priority Fee API
 * - Triton Priority Fee API
 * - Native Solana RPC fallback
 * - Low/Medium/High fee modes
 */

import { Connection, PublicKey } from "@solana/web3.js";

// ============================================================
// Types
// ============================================================

export type PriorityLevel = "low" | "medium" | "high" | "turbo";

export interface PriorityFeeEstimate {
  level: PriorityLevel;
  microLamports: number;
  estimatedSlotDelay: number;
  description: string;
}

export interface PriorityFeeResponse {
  recommended: PriorityFeeEstimate;
  levels: Record<PriorityLevel, PriorityFeeEstimate>;
  lastUpdated: number;
  source: "helius" | "triton" | "native";
}

export interface HeliusPriorityFeeResponse {
  priorityFeeEstimate: number;
  priorityFeeLevels: {
    min: number;
    low: number;
    medium: number;
    high: number;
    veryHigh: number;
    unsafeMax: number;
  };
}

// ============================================================
// Constants
// ============================================================

// Default fee estimates (micro-lamports) when APIs fail
const DEFAULT_FEES: Record<PriorityLevel, number> = {
  low: 1_000,      // 0.001 lamports per CU
  medium: 10_000,  // 0.01 lamports per CU
  high: 100_000,   // 0.1 lamports per CU
  turbo: 500_000,  // 0.5 lamports per CU
};

// Fee level multipliers relative to median
const FEE_MULTIPLIERS: Record<PriorityLevel, number> = {
  low: 0.5,
  medium: 1.0,
  high: 2.0,
  turbo: 5.0,
};

// Cache TTL (10 seconds)
const CACHE_TTL_MS = 10_000;

// ============================================================
// Priority Fees Service
// ============================================================

export class PriorityFeesService {
  private readonly connection: Connection;
  private readonly heliusApiKey?: string;
  private readonly tritonApiUrl?: string;
  
  // Cache for fee estimates
  private cache: {
    data: PriorityFeeResponse | null;
    timestamp: number;
  } = { data: null, timestamp: 0 };

  constructor(options?: {
    rpcUrl?: string;
    heliusApiKey?: string;
    tritonApiUrl?: string;
  }) {
    const rpcUrl = options?.rpcUrl || process.env.RPC_SOLANA || "https://api.mainnet-beta.solana.com";
    this.connection = new Connection(rpcUrl, { commitment: "confirmed" });
    this.heliusApiKey = options?.heliusApiKey || process.env.HELIUS_API_KEY;
    this.tritonApiUrl = options?.tritonApiUrl || process.env.TRITON_RPC_URL;
  }

  /**
   * Get priority fee estimates
   */
  async getPriorityFees(
    accountKeys?: string[],
    forceRefresh = false
  ): Promise<PriorityFeeResponse> {
    // Check cache
    if (!forceRefresh && this.cache.data && Date.now() - this.cache.timestamp < CACHE_TTL_MS) {
      return this.cache.data;
    }

    let response: PriorityFeeResponse;

    // Try Helius first
    if (this.heliusApiKey) {
      try {
        response = await this.getHeliusPriorityFees(accountKeys);
        this.cache = { data: response, timestamp: Date.now() };
        return response;
      } catch (error) {
        console.warn("Helius priority fee fetch failed:", error);
      }
    }

    // Try Triton
    if (this.tritonApiUrl) {
      try {
        response = await this.getTritonPriorityFees(accountKeys);
        this.cache = { data: response, timestamp: Date.now() };
        return response;
      } catch (error) {
        console.warn("Triton priority fee fetch failed:", error);
      }
    }

    // Fallback to native RPC
    try {
      response = await this.getNativePriorityFees(accountKeys);
    } catch (error) {
      console.warn("Native priority fee fetch failed, using defaults:", error);
      response = this.getDefaultFees();
    }

    this.cache = { data: response, timestamp: Date.now() };
    return response;
  }

  /**
   * Get recommended fee for a specific priority level
   */
  async getRecommendedFee(
    level: PriorityLevel = "medium",
    accountKeys?: string[]
  ): Promise<number> {
    const fees = await this.getPriorityFees(accountKeys);
    return fees.levels[level].microLamports;
  }

  /**
   * Get priority fees from Helius API
   */
  private async getHeliusPriorityFees(accountKeys?: string[]): Promise<PriorityFeeResponse> {
    const url = `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "priority-fee",
        method: "getPriorityFeeEstimate",
        params: [
          {
            accountKeys: accountKeys || [],
            options: {
              includeAllPriorityFeeLevels: true,
              recommended: true,
            },
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      result: HeliusPriorityFeeResponse;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(data.error.message);
    }

    const levels = data.result.priorityFeeLevels;
    const recommended = data.result.priorityFeeEstimate;

    return {
      recommended: {
        level: "medium",
        microLamports: recommended || levels.medium,
        estimatedSlotDelay: 1,
        description: "Recommended for normal transactions",
      },
      levels: {
        low: {
          level: "low",
          microLamports: levels.low,
          estimatedSlotDelay: 5,
          description: "Lower priority, may take longer",
        },
        medium: {
          level: "medium",
          microLamports: levels.medium,
          estimatedSlotDelay: 2,
          description: "Standard priority",
        },
        high: {
          level: "high",
          microLamports: levels.high,
          estimatedSlotDelay: 1,
          description: "High priority, faster confirmation",
        },
        turbo: {
          level: "turbo",
          microLamports: levels.veryHigh,
          estimatedSlotDelay: 0,
          description: "Maximum priority, fastest possible",
        },
      },
      lastUpdated: Date.now(),
      source: "helius",
    };
  }

  /**
   * Get priority fees from Triton API
   */
  private async getTritonPriorityFees(accountKeys?: string[]): Promise<PriorityFeeResponse> {
    const response = await fetch(this.tritonApiUrl!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "priority-fee",
        method: "getRecentPrioritizationFees",
        params: accountKeys ? [accountKeys] : [],
      }),
    });

    if (!response.ok) {
      throw new Error(`Triton API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      result: Array<{ slot: number; prioritizationFee: number }>;
      error?: { message: string };
    };

    if (data.error) {
      throw new Error(data.error.message);
    }

    // Calculate fee levels from recent fees
    const fees = data.result.map((f) => f.prioritizationFee).filter((f) => f > 0);
    
    if (fees.length === 0) {
      return this.getDefaultFees();
    }

    fees.sort((a, b) => a - b);
    const median = fees[Math.floor(fees.length / 2)];

    return this.buildFeeResponse(median, "triton");
  }

  /**
   * Get priority fees from native Solana RPC
   */
  private async getNativePriorityFees(accountKeys?: string[]): Promise<PriorityFeeResponse> {
    let pubkeys: PublicKey[] | undefined;
    if (accountKeys && accountKeys.length > 0) {
      pubkeys = accountKeys.map((k) => new PublicKey(k));
    }

    const recentFees = await this.connection.getRecentPrioritizationFees(
      pubkeys ? { lockedWritableAccounts: pubkeys } : undefined
    );

    const fees = recentFees
      .map((f: { prioritizationFee: number }) => f.prioritizationFee)
      .filter((f: number) => f > 0);

    if (fees.length === 0) {
      return this.getDefaultFees();
    }

    fees.sort((a: number, b: number) => a - b);
    const median = fees[Math.floor(fees.length / 2)];

    return this.buildFeeResponse(median, "native");
  }

  /**
   * Build fee response from median value
   */
  private buildFeeResponse(
    median: number,
    source: "helius" | "triton" | "native"
  ): PriorityFeeResponse {
    return {
      recommended: {
        level: "medium",
        microLamports: Math.floor(median * FEE_MULTIPLIERS.medium),
        estimatedSlotDelay: 2,
        description: "Standard priority",
      },
      levels: {
        low: {
          level: "low",
          microLamports: Math.max(1000, Math.floor(median * FEE_MULTIPLIERS.low)),
          estimatedSlotDelay: 5,
          description: "Lower priority, may take longer",
        },
        medium: {
          level: "medium",
          microLamports: Math.floor(median * FEE_MULTIPLIERS.medium),
          estimatedSlotDelay: 2,
          description: "Standard priority",
        },
        high: {
          level: "high",
          microLamports: Math.floor(median * FEE_MULTIPLIERS.high),
          estimatedSlotDelay: 1,
          description: "High priority, faster confirmation",
        },
        turbo: {
          level: "turbo",
          microLamports: Math.floor(median * FEE_MULTIPLIERS.turbo),
          estimatedSlotDelay: 0,
          description: "Maximum priority, fastest possible",
        },
      },
      lastUpdated: Date.now(),
      source,
    };
  }

  /**
   * Get default fees when all APIs fail
   */
  private getDefaultFees(): PriorityFeeResponse {
    return {
      recommended: {
        level: "medium",
        microLamports: DEFAULT_FEES.medium,
        estimatedSlotDelay: 2,
        description: "Standard priority (default)",
      },
      levels: {
        low: {
          level: "low",
          microLamports: DEFAULT_FEES.low,
          estimatedSlotDelay: 5,
          description: "Lower priority (default)",
        },
        medium: {
          level: "medium",
          microLamports: DEFAULT_FEES.medium,
          estimatedSlotDelay: 2,
          description: "Standard priority (default)",
        },
        high: {
          level: "high",
          microLamports: DEFAULT_FEES.high,
          estimatedSlotDelay: 1,
          description: "High priority (default)",
        },
        turbo: {
          level: "turbo",
          microLamports: DEFAULT_FEES.turbo,
          estimatedSlotDelay: 0,
          description: "Maximum priority (default)",
        },
      },
      lastUpdated: Date.now(),
      source: "native",
    };
  }

  /**
   * Calculate compute unit price for a target fee
   */
  calculateComputeUnitPrice(
    targetFeeLamports: number,
    computeUnits: number
  ): number {
    // Compute unit price is in micro-lamports per compute unit
    // Total priority fee = (compute units * compute unit price) / 1,000,000
    return Math.floor((targetFeeLamports * 1_000_000) / computeUnits);
  }

  /**
   * Estimate total priority fee for a transaction
   */
  estimateTotalFee(
    computeUnits: number,
    microLamportsPerCU: number
  ): {
    priorityFeeLamports: number;
    baseFee: number;
    totalFee: number;
  } {
    const priorityFeeLamports = Math.floor((computeUnits * microLamportsPerCU) / 1_000_000);
    const baseFee = 5000; // 5000 lamports base fee

    return {
      priorityFeeLamports,
      baseFee,
      totalFee: priorityFeeLamports + baseFee,
    };
  }
}

// ============================================================
// Factory and Singleton
// ============================================================

export function createPriorityFeesService(options?: {
  rpcUrl?: string;
  heliusApiKey?: string;
  tritonApiUrl?: string;
}): PriorityFeesService {
  return new PriorityFeesService(options);
}

export const priorityFeesService = new PriorityFeesService();
export default priorityFeesService;
