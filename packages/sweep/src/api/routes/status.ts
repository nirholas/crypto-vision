import { Hono } from "hono";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { optionalAuthMiddleware, authMiddleware } from "../middleware/auth.js";
import { walletRateLimit } from "../middleware/ratelimit.js";
import { getDb, sweeps } from "../../db/index.js";
import { eq, and } from "drizzle-orm";
import { cacheGet } from "../../utils/redis.js";

const status = new Hono();

// Apply rate limiting
status.use("*", walletRateLimit(200, 60)); // More generous for status checks

// Validation schemas
const sweepIdSchema = z.object({
  id: z.string().uuid("Invalid sweep ID"),
});

/**
 * GET /api/sweep/:id/status
 * Get the current status of a sweep
 */
status.get(
  "/:id/status",
  zValidator("param", sweepIdSchema),
  optionalAuthMiddleware,
  async (c) => {
    const { id } = c.req.valid("param");

    try {
      // Try cache first for fast response
      const cached = await cacheGet<any>(`sweep:status:${id}`);

      if (cached) {
        return c.json({
          sweepId: id,
          ...cached,
        });
      }

      // Fall back to database
      const db = getDb();
      const sweep = await db.query.sweeps.findFirst({
        where: eq(sweeps.id, id),
      });

      if (!sweep) {
        return c.json({ error: "Sweep not found" }, 404);
      }

      // Check authorization for detailed info
      const userId = c.get("userId");
      const isOwner = userId && sweep.userId === userId;

      // Return different levels of detail based on auth
      const response: any = {
        sweepId: id,
        status: sweep.status,
        createdAt: sweep.createdAt?.getTime(),
        updatedAt: sweep.updatedAt?.getTime(),
        completedAt: sweep.completedAt?.getTime(),
      };

      if (isOwner) {
        // Full details for owner
        response.chains = sweep.chains;
        response.tokens = sweep.tokens;
        response.quote = sweep.quote;
        response.txHashes = sweep.txHashes;
        response.userOpHashes = sweep.userOpHashes;
        response.outputToken = sweep.outputToken;
        response.outputAmount = sweep.outputAmount;
        response.outputChain = sweep.outputChain;
        response.totalInputValueUsd = sweep.totalInputValueUsd;
        response.totalOutputValueUsd = sweep.totalOutputValueUsd;
        response.errorMessage = sweep.errorMessage;
        response.defiProtocol = sweep.defiProtocol;
        response.defiDestination = sweep.defiDestination;
      } else {
        // Limited info for non-owners
        response.tokenCount = (sweep.tokens as any[])?.length || 0;
        response.chainCount = (sweep.chains as any[])?.length || 0;
      }

      return c.json(response);
    } catch (error) {
      console.error("Error fetching sweep status:", error);
      return c.json({ error: "Failed to fetch sweep status" }, 500);
    }
  }
);

/**
 * GET /api/sweep/:id/transactions
 * Get transaction details for a sweep
 */
status.get(
  "/:id/transactions",
  zValidator("param", sweepIdSchema),
  authMiddleware,
  async (c) => {
    const { id } = c.req.valid("param");
    const userId = c.get("userId");

    try {
      const db = getDb();
      const sweep = await db.query.sweeps.findFirst({
        where: and(eq(sweeps.id, id), eq(sweeps.userId, userId)),
      });

      if (!sweep) {
        return c.json({ error: "Sweep not found" }, 404);
      }

      const txHashes = (sweep.txHashes || {}) as Record<string, string>;
      const userOpHashes = (sweep.userOpHashes || {}) as Record<string, string>;

      // Build transaction details with block explorer links
      const transactions = Object.entries(txHashes).map(([chain, txHash]) => ({
        chain,
        txHash,
        userOpHash: userOpHashes[chain],
        explorerUrl: getExplorerUrl(chain, txHash),
        bundlerUrl: userOpHashes[chain]
          ? getBundlerUrl(chain, userOpHashes[chain])
          : undefined,
      }));

      return c.json({
        sweepId: id,
        status: sweep.status,
        transactions,
      });
    } catch (error) {
      console.error("Error fetching transactions:", error);
      return c.json({ error: "Failed to fetch transactions" }, 500);
    }
  }
);

/**
 * GET /api/sweep/:id/stream
 * WebSocket endpoint for real-time sweep status updates
 */
status.get(
  "/:id/stream",
  zValidator("param", sweepIdSchema),
  async (c) => {
    const { id } = c.req.valid("param");

    // Check if WebSocket upgrade is requested
    const upgradeHeader = c.req.header("Upgrade");
    if (upgradeHeader !== "websocket") {
      return c.json({
        error: "WebSocket upgrade required",
        hint: "Connect with a WebSocket client to receive real-time updates",
      }, 426);
    }

    // Note: Actual WebSocket handling depends on the runtime
    // For Bun, we'd use createBunWebSocket
    // For Node.js with @hono/node-server, we'd need additional setup

    // Return upgrade response with instructions
    return c.json({
      message: "WebSocket endpoint",
      sweepId: id,
      protocol: "wss",
      events: [
        "status:pending",
        "status:signing",
        "status:submitted",
        "status:confirmed",
        "status:failed",
        "tx:submitted",
        "tx:confirmed",
        "progress:update",
      ],
    });
  }
);

/**
 * GET /api/sweeps
 * List sweeps for the authenticated user
 */
status.get(
  "/",
  authMiddleware,
  zValidator(
    "query",
    z.object({
      status: z
        .enum(["pending", "signing", "submitted", "confirmed", "failed", "cancelled"])
        .optional(),
      limit: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v) : 20)),
      offset: z
        .string()
        .optional()
        .transform((v) => (v ? parseInt(v) : 0)),
    })
  ),
  async (c) => {
    const userId = c.get("userId");
    const { status: statusFilter, limit, offset } = c.req.valid("query");

    try {
      const db = getDb();

      const userSweeps = await db.query.sweeps.findMany({
        where: statusFilter
          ? and(eq(sweeps.userId, userId), eq(sweeps.status, statusFilter))
          : eq(sweeps.userId, userId),
        orderBy: (sweeps, { desc }) => [desc(sweeps.createdAt)],
        limit: Math.min(limit, 100),
        offset,
      });

      return c.json({
        sweeps: userSweeps.map((s) => ({
          id: s.id,
          status: s.status,
          chains: s.chains,
          tokenCount: (s.tokens as any[])?.length || 0,
          totalInputValueUsd: s.totalInputValueUsd,
          totalOutputValueUsd: s.totalOutputValueUsd,
          createdAt: s.createdAt?.getTime(),
          completedAt: s.completedAt?.getTime(),
        })),
        pagination: {
          limit,
          offset,
          hasMore: userSweeps.length === limit,
        },
      });
    } catch (error) {
      console.error("Error listing sweeps:", error);
      return c.json({ error: "Failed to list sweeps" }, 500);
    }
  }
);

// Helper functions
function getExplorerUrl(chain: string, txHash: string): string {
  const explorers: Record<string, string> = {
    ethereum: "https://etherscan.io/tx/",
    base: "https://basescan.org/tx/",
    arbitrum: "https://arbiscan.io/tx/",
    polygon: "https://polygonscan.com/tx/",
    optimism: "https://optimistic.etherscan.io/tx/",
    bsc: "https://bscscan.com/tx/",
    linea: "https://lineascan.build/tx/",
  };
  return `${explorers[chain] || "https://etherscan.io/tx/"}${txHash}`;
}

function getBundlerUrl(chain: string, userOpHash: string): string {
  // JiffyScan for UserOp tracking
  const chainIds: Record<string, number> = {
    ethereum: 1,
    base: 8453,
    arbitrum: 42161,
    polygon: 137,
    optimism: 10,
    bsc: 56,
    linea: 59144,
  };
  const chainId = chainIds[chain] || 1;
  return `https://jiffyscan.xyz/userOpHash/${userOpHash}?network=${chainId}`;
}

export { status };
