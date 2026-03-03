/**
 * Consolidation API Routes
 * Cross-chain dust consolidation endpoints
 */

import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import {
  getConsolidationEngine,
  type ConsolidationQuoteRequest,
  type ConsolidationExecuteRequest,
  ConsolidationStatus,
} from "../../services/consolidation/index.js";
import { addConsolidationJob } from "../../queue/index.js";
import type { SupportedChain } from "../../config/chains.js";

const consolidateRoutes = new Hono();

// Initialize consolidation engine
const engine = getConsolidationEngine();

// ============================================================
// Validation Schemas
// ============================================================

const chainSchema = z.enum([
  "ethereum",
  "base",
  "arbitrum",
  "polygon",
  "bsc",
  "linea",
  "optimism",
]);

const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address");

const tokenSchema = z.object({
  address: addressSchema,
  symbol: z.string(),
  decimals: z.number().int().min(0).max(18),
  amount: z.string().regex(/^\d+$/, "Amount must be a numeric string"),
  valueUsd: z.number().min(0),
});

const sourceSchema = z.object({
  chain: chainSchema,
  tokens: z.array(tokenSchema).min(1, "At least one token required per chain"),
});

const quoteRequestSchema = z.object({
  userId: z.string().min(1),
  userAddress: addressSchema,
  sources: z.array(sourceSchema).min(1, "At least one source chain required"),
  destinationChain: chainSchema,
  destinationToken: addressSchema,
  slippage: z.number().min(0).max(0.1).optional(), // Max 10%
  priority: z.enum(["speed", "cost", "reliability"]).optional(),
});

const executeRequestSchema = z.object({
  planId: z.string().min(1),
  userId: z.string().min(1),
  userAddress: addressSchema,
  signature: z.string().optional(),
  permitSignatures: z.record(z.string()).optional(), // Chain -> signature
});

const statusParamsSchema = z.object({
  id: z.string().min(1),
});

const historyQuerySchema = z.object({
  userId: z.string().min(1),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

// ============================================================
// Helper Functions
// ============================================================

/**
 * Serialize BigInt values for JSON response
 */
function serializeForJson<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );
}

/**
 * Calculate estimated completion time based on status
 */
function calculateEstimatedCompletion(
  status: any,
  estimatedTimeSeconds: number
): number | undefined {
  if (
    status.status === ConsolidationStatus.COMPLETED ||
    status.status === ConsolidationStatus.FAILED
  ) {
    return undefined;
  }

  if (status.startedAt) {
    const elapsed = (Date.now() - status.startedAt) / 1000;
    const remaining = Math.max(0, estimatedTimeSeconds - elapsed);
    return Date.now() + remaining * 1000;
  }

  return Date.now() + estimatedTimeSeconds * 1000;
}

// ============================================================
// Routes
// ============================================================

/**
 * POST /consolidate/quote
 * Get a quote for multi-chain consolidation
 */
consolidateRoutes.post(
  "/quote",
  zValidator("json", quoteRequestSchema),
  async (c) => {
    const body = c.req.valid("json");

    try {
      // Convert to engine request format
      const request: ConsolidationQuoteRequest = {
        userId: body.userId,
        userAddress: body.userAddress as `0x${string}`,
        sources: body.sources.map((s) => ({
          chain: s.chain as SupportedChain,
          tokens: s.tokens.map((t) => ({
            address: t.address as `0x${string}`,
            symbol: t.symbol,
            decimals: t.decimals,
            amount: t.amount,
            valueUsd: t.valueUsd,
          })),
        })),
        destinationChain: body.destinationChain as SupportedChain,
        destinationToken: body.destinationToken as `0x${string}`,
        slippage: body.slippage,
        priority: body.priority,
      };

      const result = await engine.getQuote(request);

      if (!result.success) {
        return c.json(
          {
            error: result.error || "Failed to generate quote",
            warnings: result.warnings,
          },
          400
        );
      }

      return c.json({
        success: true,
        quote: serializeForJson(result.plan),
        warnings: result.warnings,
        meta: {
          timestamp: Date.now(),
          expiresAt: result.plan?.expiresAt,
        },
      });
    } catch (error) {
      console.error("[ConsolidateAPI] Quote error:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

/**
 * POST /consolidate/execute
 * Execute a consolidation plan
 */
consolidateRoutes.post(
  "/execute",
  zValidator("json", executeRequestSchema),
  async (c) => {
    const body = c.req.valid("json");

    try {
      const request: ConsolidationExecuteRequest = {
        planId: body.planId,
        userId: body.userId,
        userAddress: body.userAddress as `0x${string}`,
        signature: body.signature,
        permitSignatures: body.permitSignatures,
      };

      // Execute via engine (initializes tracking)
      const result = await engine.execute(request);

      if (!result.success) {
        return c.json(
          {
            error: result.error || "Failed to execute consolidation",
          },
          400
        );
      }

      // Queue the consolidation job for background processing
      const jobData = await engine.getJobData(result.consolidationId!);
      if (jobData) {
        await addConsolidationJob(jobData);
      }

      return c.json({
        success: true,
        consolidationId: result.consolidationId,
        status: serializeForJson(result.status),
        tracking: {
          statusUrl: `/consolidate/${result.consolidationId}/status`,
          eventsUrl: `/consolidate/${result.consolidationId}/events`,
        },
      });
    } catch (error) {
      console.error("[ConsolidateAPI] Execute error:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

/**
 * GET /consolidate/:id/status
 * Get consolidation status
 */
consolidateRoutes.get(
  "/:id/status",
  zValidator("param", statusParamsSchema),
  async (c) => {
    const { id } = c.req.valid("param");

    try {
      const status = await engine.getStatus(id);

      if (!status) {
        return c.json(
          {
            error: "Consolidation not found",
          },
          404
        );
      }

      // Get the plan for estimated time
      const plan = await engine.getPlan(id);

      return c.json({
        success: true,
        status: serializeForJson(status),
        estimatedCompletionAt: plan
          ? calculateEstimatedCompletion(status, plan.estimatedTotalTimeSeconds)
          : undefined,
      });
    } catch (error) {
      console.error("[ConsolidateAPI] Status error:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

/**
 * GET /consolidate/:id/events
 * Get consolidation events (for detailed tracking)
 */
consolidateRoutes.get("/:id/events", zValidator("param", statusParamsSchema), async (c) => {
  const { id } = c.req.valid("param");
  const limit = parseInt(c.req.query("limit") || "50", 10);

  try {
    const status = await engine.getStatus(id);

    if (!status) {
      return c.json(
        {
          error: "Consolidation not found",
        },
        404
      );
    }

    // Get events from status tracker
    const { getStatusTracker } = await import(
      "../../services/consolidation/index.js"
    );
    const tracker = getStatusTracker();
    const events = await tracker.getEvents(id, limit);

    return c.json({
      success: true,
      events: serializeForJson(events),
      count: events.length,
    });
  } catch (error) {
    console.error("[ConsolidateAPI] Events error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * GET /consolidate/history
 * Get user's consolidation history
 */
consolidateRoutes.get(
  "/history",
  zValidator("query", historyQuerySchema),
  async (c) => {
    const { userId, limit = 20, offset = 0 } = c.req.valid("query");

    try {
      const history = await engine.getUserHistory(userId, limit, offset);

      return c.json({
        success: true,
        history: serializeForJson(history),
        count: history.length,
        pagination: {
          limit,
          offset,
          hasMore: history.length === limit,
        },
      });
    } catch (error) {
      console.error("[ConsolidateAPI] History error:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

/**
 * GET /consolidate/:id/plan
 * Get the original consolidation plan
 */
consolidateRoutes.get("/:id/plan", zValidator("param", statusParamsSchema), async (c) => {
  const { id } = c.req.valid("param");

  try {
    // Try to get plan by ID (could be plan ID or consolidation ID)
    const plan = await engine.getPlan(id);

    // If not found, try to get from status and use planId
    if (!plan) {
      const status = await engine.getStatus(id);
      if (status) {
        // Status exists but plan expired - common case
        return c.json(
          {
            error: "Plan has expired",
            message: "The consolidation plan has expired. Status is still available.",
          },
          410 // Gone
        );
      }
      return c.json(
        {
          error: "Plan not found",
        },
        404
      );
    }

    return c.json({
      success: true,
      plan: serializeForJson(plan),
    });
  } catch (error) {
    console.error("[ConsolidateAPI] Plan error:", error);
    return c.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});

/**
 * POST /consolidate/simulate
 * Simulate a consolidation without executing
 */
consolidateRoutes.post(
  "/simulate",
  zValidator("json", quoteRequestSchema),
  async (c) => {
    const body = c.req.valid("json");

    try {
      const request: ConsolidationQuoteRequest = {
        userId: body.userId,
        userAddress: body.userAddress as `0x${string}`,
        sources: body.sources.map((s) => ({
          chain: s.chain as SupportedChain,
          tokens: s.tokens.map((t) => ({
            address: t.address as `0x${string}`,
            symbol: t.symbol,
            decimals: t.decimals,
            amount: t.amount,
            valueUsd: t.valueUsd,
          })),
        })),
        destinationChain: body.destinationChain as SupportedChain,
        destinationToken: body.destinationToken as `0x${string}`,
        slippage: body.slippage,
        priority: body.priority,
      };

      const result = await engine.simulate(request);

      if (!result.success) {
        return c.json(
          {
            error: result.error || "Simulation failed",
          },
          400
        );
      }

      return c.json({
        success: true,
        simulation: result.simulation,
      });
    } catch (error) {
      console.error("[ConsolidateAPI] Simulate error:", error);
      return c.json(
        {
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500
      );
    }
  }
);

export { consolidateRoutes };
