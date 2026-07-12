/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import "dotenv/config"

import { timingSafeEqual } from "node:crypto"

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import cors from "cors"
import express from "express"
import type { NextFunction, Request, Response } from "express"

import Logger from "@/utils/logger"
import { startServer } from "./base"

// Shared-secret gate for the HTTP transport. These endpoints can drive
// fund-moving tools that sign on-chain transfers using the server's own
// PRIVATE_KEY, so they must never be reachable by unauthenticated remote callers.
const AUTH_TOKEN = process.env.MCP_AUTH_TOKEN

// Constant-time comparison of the presented bearer token against MCP_AUTH_TOKEN.
const tokenMatches = (authorization?: string): boolean => {
  if (!AUTH_TOKEN) return false
  if (!authorization?.startsWith("Bearer ")) return false
  const presented = Buffer.from(authorization.slice("Bearer ".length))
  const expected = Buffer.from(AUTH_TOKEN)
  // timingSafeEqual requires equal-length buffers; a length mismatch is a miss.
  if (presented.length !== expected.length) return false
  return timingSafeEqual(presented, expected)
}

// Auth middleware. When MCP_AUTH_TOKEN is unset the listener is bound to
// loopback only (see host resolution below), so local calls are allowed through
// without a token; remote exposure of the unauthenticated transport is impossible.
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!AUTH_TOKEN) {
    next()
    return
  }
  if (!tokenMatches(req.headers.authorization)) {
    res.status(401).json({
      jsonrpc: "2.0",
      error: { code: -32001, message: "Unauthorized" },
      id: (req.body as { id?: unknown })?.id ?? null
    })
    return
  }
  next()
}

/**
 * HTTP-based MCP Server for ChatGPT Developer Mode
 * 
 * Supports:
 * - Streamable HTTP transport (recommended for ChatGPT)
 * - Session management for stateful connections
 * - CORS for cross-origin requests
 * - Health check endpoint
 * 
 * ChatGPT Developer Mode requires:
 * - SSE or Streamable HTTP protocol
 * - No authentication (or OAuth)
 * - readOnlyHint annotations on tools
 */
export const startHTTPServer = async () => {
  try {
    const app = express()
    
    // Middleware
    // Security: Restrict CORS to an explicit allowlist (MCP_CORS_ORIGINS,
    // comma-split). Default to no cross-origin access when unset — never wildcard.
    const corsOrigins = process.env.MCP_CORS_ORIGINS
      ? process.env.MCP_CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
      : []
    app.use(cors({
      origin: corsOrigins.length > 0 ? corsOrigins : false,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "mcp-session-id", "last-event-id"],
      exposedHeaders: ["mcp-session-id"]
    }))
    app.use(express.json())

    // Log startup
    Logger.info(`Starting HTTP server with log level: ${Logger.getLevel()}`)

    // Session management for stateful connections
    const sessions: Map<string, {
      transport: StreamableHTTPServerTransport
      server: ReturnType<typeof startServer>
    }> = new Map()

    // Health check endpoint
    app.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "healthy",
        name: "Universal Crypto MCP",
        version: "1.0.0",
        sessions: sessions.size,
        timestamp: new Date().toISOString()
      })
    })

    // Server info endpoint (for ChatGPT app discovery)
    app.get("/", (_req: Request, res: Response) => {
      res.json({
        name: "Universal Crypto MCP",
        version: "1.0.0",
        description: "Universal MCP server for all EVM-compatible networks",
        protocol: "mcp",
        transport: "streamable-http",
        endpoints: {
          mcp: "/mcp",
          health: "/health",
          sse: "/sse"
        },
        capabilities: [
          "crypto-news",
          "evm-blockchain",
          "defi-operations",
          "token-analysis",
          "wallet-management"
        ]
      })
    })

    // Main MCP endpoint - handles all MCP protocol messages
    app.post("/mcp", requireAuth, async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string | undefined
      let session = sessionId ? sessions.get(sessionId) : undefined

      // Handle new session initialization
      if (!session) {
        if (!isInitializeRequest(req.body)) {
          res.status(400).json({
            jsonrpc: "2.0",
            error: {
              code: -32600,
              message: "Bad Request: No valid session found. Send an initialize request first."
            },
            id: req.body?.id ?? null
          })
          return
        }

        // Create new session
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (newSessionId) => {
            Logger.info("New HTTP session initialized", { sessionId: newSessionId })
            sessions.set(newSessionId, { transport, server })
          }
        })

        const server = startServer()

        // Handle session close
        transport.onclose = () => {
          const sid = transport.sessionId
          if (sid) {
            Logger.info("HTTP session closed", { sessionId: sid })
            sessions.delete(sid)
          }
        }

        await server.connect(transport)
        session = { transport, server }
      }

      // Handle the request
      try {
        await session.transport.handleRequest(req, res, req.body)
      } catch (error) {
        Logger.error("Error handling MCP request", { sessionId, error })
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: "Internal server error"
            },
            id: req.body?.id ?? null
          })
        }
      }
    })

    // Handle GET requests for SSE streams (server-to-client notifications)
    app.get("/mcp", requireAuth, async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string
      const session = sessions.get(sessionId)

      if (!session) {
        res.status(400).json({
          error: "No valid session found. Send an initialize request first."
        })
        return
      }

      try {
        await session.transport.handleRequest(req, res)
      } catch (error) {
        Logger.error("Error handling SSE stream", { sessionId, error })
        if (!res.headersSent) {
          res.status(500).send("Internal server error")
        }
      }
    })

    // Handle session termination
    app.delete("/mcp", requireAuth, async (req: Request, res: Response) => {
      const sessionId = req.headers["mcp-session-id"] as string
      const session = sessions.get(sessionId)

      if (!session) {
        res.status(404).json({ error: "Session not found" })
        return
      }

      try {
        await session.transport.close()
        sessions.delete(sessionId)
        res.status(200).json({ message: "Session terminated" })
        Logger.info("Session terminated via DELETE", { sessionId })
      } catch (error) {
        Logger.error("Error terminating session", { sessionId, error })
        res.status(500).json({ error: "Failed to terminate session" })
      }
    })

    // Legacy SSE endpoint for backwards compatibility
    // ChatGPT also supports SSE protocol
    app.get("/sse", async (_req: Request, res: Response) => {
      res.redirect(307, "/mcp")
    })

    const PORT = process.env.PORT || 3001

    // Resolve the bind host. Default to loopback; only widen when an explicit
    // MCP_HOST is provided. If no auth token is configured, force loopback
    // regardless of MCP_HOST so the unauthenticated transport cannot be reached
    // remotely.
    let HOST = process.env.MCP_HOST || "127.0.0.1"
    if (!AUTH_TOKEN) {
      if (
        process.env.MCP_HOST &&
        process.env.MCP_HOST !== "127.0.0.1" &&
        process.env.MCP_HOST !== "localhost"
      ) {
        Logger.warn(
          `MCP_AUTH_TOKEN is not set — ignoring MCP_HOST=${process.env.MCP_HOST} and binding to loopback (127.0.0.1). This transport exposes fund-moving tools and MUST NOT be exposed unauthenticated. Set MCP_AUTH_TOKEN to enable remote access.`
        )
      } else {
        Logger.warn(
          "MCP_AUTH_TOKEN is not set — binding to loopback (127.0.0.1) only. This transport exposes fund-moving tools; set MCP_AUTH_TOKEN before exposing it to remote callers."
        )
      }
      HOST = "127.0.0.1"
    }

    app.listen(Number(PORT), HOST, () => {
      Logger.info(`Universal Crypto MCP HTTP Server running on http://${HOST}:${PORT}`)
      Logger.info(`ChatGPT Developer Mode URL: http://${HOST}:${PORT}/mcp`)
      Logger.info(`Health check: http://${HOST}:${PORT}/health`)
      Logger.info(
        AUTH_TOKEN
          ? "Auth: bearer token required (MCP_AUTH_TOKEN)"
          : "Auth: none — loopback-only. Set MCP_AUTH_TOKEN to allow authenticated remote access."
      )
    })

    return { sessions }
  } catch (error) {
    Logger.error("Error starting HTTP Server:", error)
    throw error
  }
}
