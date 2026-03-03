import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { timing } from "hono/timing";
import { compress } from "hono/compress";
import { serve } from "@hono/node-server";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

// Import routes
import { health } from "./routes/health.js";
import { wallet } from "./routes/wallet.js";
import { quote } from "./routes/quote.js";
import { sweep } from "./routes/sweep.js";
import { status } from "./routes/status.js";

// Import middleware
import {
  authMiddleware,
  generateSiweNonce,
  verifySiweMessage,
  invalidateSession,
} from "./middleware/auth.js";
import { authRateLimit, defaultRateLimit } from "./middleware/ratelimit.js";

// Import workers for initialization
import { createScanWorker } from "../queue/workers/scan.js";
import { createPriceWorker } from "../queue/workers/price.js";
import { createSweepWorker, createTrackWorker } from "../queue/workers/sweep.js";

// Create Hono app
const app = new Hono();

// ============================================================
// Global Middleware
// ============================================================

// Security headers
app.use("*", secureHeaders());

// Request logging
app.use("*", logger());

// Response timing
app.use("*", timing());

// Compression
app.use("*", compress());

// CORS configuration
app.use(
  "*",
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-session-token",
      "x-wallet-address",
      "x-payment",
    ],
    exposeHeaders: [
      "X-RateLimit-Limit",
      "X-RateLimit-Remaining",
      "X-RateLimit-Reset",
      "X-Payment-Required",
      "x-payment-response",
    ],
    credentials: true,
    maxAge: 3600,
  })
);

// Default rate limiting
app.use("/api/*", defaultRateLimit);

// ============================================================
// Health Check Routes (no auth required)
// ============================================================
app.route("/health", health);

// ============================================================
// Authentication Routes
// ============================================================
const auth = new Hono();

// Rate limit auth endpoints more strictly
auth.use("*", authRateLimit);

/**
 * GET /auth/nonce
 * Get a nonce for SIWE authentication
 */
auth.get(
  "/nonce",
  zValidator(
    "query",
    z.object({
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"),
    })
  ),
  async (c) => {
    const { address } = c.req.valid("query");
    const nonce = await generateSiweNonce(address);
    return c.json({ nonce });
  }
);

/**
 * POST /auth/verify
 * Verify a SIWE message and create a session
 */
auth.post(
  "/verify",
  zValidator(
    "json",
    z.object({
      message: z.string().min(1),
      signature: z.string().min(1),
    })
  ),
  async (c) => {
    const { message, signature } = c.req.valid("json");

    try {
      const { session, token } = await verifySiweMessage(message, signature);

      return c.json({
        success: true,
        token,
        user: {
          id: session.userId,
          walletAddress: session.walletAddress,
          smartWalletAddress: session.smartWalletAddress,
        },
        expiresAt: session.expiresAt,
      });
    } catch (error) {
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : "Authentication failed",
        },
        401
      );
    }
  }
);

/**
 * POST /auth/logout
 * Invalidate the current session
 */
auth.post("/logout", async (c) => {
  const token = c.req.header("x-session-token");
  if (token) {
    await invalidateSession(token);
  }
  return c.json({ success: true });
});

/**
 * GET /auth/session
 * Get current session info
 */
auth.get("/session", authMiddleware, async (c) => {
  const session = c.get("session");
  return c.json({
    user: {
      id: session.userId,
      walletAddress: session.walletAddress,
      smartWalletAddress: session.smartWalletAddress,
      chainId: session.chainId,
    },
    issuedAt: session.issuedAt,
    expiresAt: session.expiresAt,
  });
});

app.route("/auth", auth);

// ============================================================
// API Routes
// ============================================================
app.route("/api/wallet", wallet);
app.route("/api/quote", quote);
app.route("/api/sweep", sweep);
app.route("/api/sweep", status); // Nested under /api/sweep for status endpoints

// ============================================================
// Error Handling
// ============================================================
app.onError((err, c) => {
  console.error("Unhandled error:", err);

  // Handle known error types
  if (err.name === "ZodError") {
    return c.json(
      {
        error: "Validation error",
        details: (err as any).errors,
      },
      400
    );
  }

  if (err.message.includes("UNAUTHORIZED") || err.message.includes("401")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  if (err.message.includes("FORBIDDEN") || err.message.includes("403")) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json(
    {
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    },
    500
  );
});

app.notFound((c) => {
  return c.json(
    {
      error: "Not found",
      path: c.req.path,
    },
    404
  );
});

// ============================================================
// API Documentation (basic)
// ============================================================
app.get("/", (c) => {
  return c.json({
    name: "Sweep API",
    version: process.env.npm_package_version || "0.1.0",
    description: "Multi-chain dust sweeper API",
    endpoints: {
      health: {
        "GET /health": "Basic health check",
        "GET /health/ready": "Readiness check (dependencies)",
        "GET /health/live": "Liveness check",
      },
      auth: {
        "GET /auth/nonce?address=0x...": "Get SIWE nonce",
        "POST /auth/verify": "Verify SIWE signature, get session token",
        "POST /auth/logout": "Invalidate session",
        "GET /auth/session": "Get current session info",
      },
      wallet: {
        "GET /api/wallet/:address/dust": "Scan wallet for dust tokens",
        "GET /api/wallet/:address/dust?chains=base,arbitrum": "Scan specific chains",
        "GET /api/wallet/:address/dust?async=true": "Async scan (returns job ID)",
        "GET /api/wallet/:address/balances": "Get all token balances",
        "GET /api/wallet/:address/history": "Get sweep history (auth required)",
      },
      quote: {
        "POST /api/quote": "Get sweep quote",
        "GET /api/quote/:quoteId": "Get existing quote",
      },
      sweep: {
        "POST /api/sweep": "Execute sweep (auth + payment required)",
        "POST /api/sweep/preview": "Preview sweep without executing",
        "GET /api/sweep/:id/status": "Get sweep status",
        "GET /api/sweep/:id/transactions": "Get transaction details",
        "GET /api/sweep/:id/stream": "WebSocket for real-time updates",
        "GET /api/sweep": "List user's sweeps (auth required)",
      },
    },
    authentication: {
      method: "SIWE (Sign-In with Ethereum)",
      header: "x-session-token",
    },
    rateLimit: {
      default: "100 requests/minute per wallet",
      auth: "5 requests/minute per IP",
      sweep: "10 requests/minute per wallet",
    },
    payment: {
      protocol: "x402",
      sweepFee: "$0.10 USDC per sweep execution",
    },
  });
});

// ============================================================
// Server Startup
// ============================================================
export { app };

// Start server and workers if run directly
const port = parseInt(process.env.PORT || "3000");
const host = process.env.HOST || "0.0.0.0";

// Initialize workers
let workers: any[] = [];

async function startWorkers() {
  console.log("🔧 Starting background workers...");

  try {
    workers = [
      createScanWorker(),
      createPriceWorker(),
      createSweepWorker(),
      createTrackWorker(),
    ];
    console.log("✅ Background workers started");
  } catch (error) {
    console.error("❌ Failed to start workers:", error);
  }
}

async function stopWorkers() {
  console.log("🛑 Stopping background workers...");
  await Promise.all(workers.map((w) => w.close()));
}

// Graceful shutdown
async function shutdown() {
  console.log("\n🛑 Shutting down...");

  await stopWorkers();

  const { closeQueues } = await import("../queue/index.js");
  await closeQueues();

  const { closeDb } = await import("../db/index.js");
  await closeDb();

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start server
console.log(`🧹 Sweep API starting on ${host}:${port}...`);

// Start workers in background
startWorkers();

serve(
  {
    fetch: app.fetch,
    port,
    hostname: host,
  },
  (info) => {
    console.log(`🚀 Server running at http://${info.address}:${info.port}`);
  }
);
