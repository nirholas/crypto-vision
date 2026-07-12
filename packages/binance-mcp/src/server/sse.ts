// src/server/sse.ts
import "dotenv/config"

import { timingSafeEqual } from "crypto"
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import express from "express"
import type { NextFunction, Request, Response } from "express"
import cors from "cors"

import Logger from "../utils/logger.js"
import { startServer } from "./base.js"

const PORT = process.env.PORT || 3002

// Shared-secret gate for the SSE transport. These endpoints can drive
// fund-moving tools that withdraw from Binance using the server's own API key,
// so they must never be reachable by unauthenticated remote callers.
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
    res.status(401).json({ error: "Unauthorized" })
    return
  }
  next()
}

// Start the server in SSE mode
export const startSSEServer = async () => {
  try {
    const app = express()

    // Restrict CORS to an explicit allowlist (MCP_CORS_ORIGINS, comma-split).
    // Default to no cross-origin access when unset — never wildcard.
    const corsOrigins = process.env.MCP_CORS_ORIGINS
      ? process.env.MCP_CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
      : []
    app.use(
      cors({
        origin: corsOrigins.length > 0 ? corsOrigins : false,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
      })
    )
    app.use(express.json())

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

    const server = startServer()
    
    // Store active transports
    const transports: Map<string, SSEServerTransport> = new Map()

    // SSE endpoint
    app.get("/sse", requireAuth, async (req, res) => {
      const sessionId = req.query.sessionId as string || crypto.randomUUID()
      
      Logger.info(`New SSE connection: ${sessionId}`)
      
      const transport = new SSEServerTransport("/message", res)
      transports.set(sessionId, transport)
      
      res.on("close", () => {
        Logger.info(`SSE connection closed: ${sessionId}`)
        transports.delete(sessionId)
      })

      await server.connect(transport)
    })

    // Message endpoint
    app.post("/message", requireAuth, async (req, res) => {
      const sessionId = req.query.sessionId as string
      const transport = transports.get(sessionId)
      
      if (!transport) {
        res.status(404).json({ error: "Session not found" })
        return
      }

      await transport.handlePostMessage(req, res)
    })

    // Health check
    app.get("/health", (req, res) => {
      res.json({ status: "ok", mode: "sse" })
    })

    app.listen(Number(PORT), HOST, () => {
      Logger.info(`Binance MCP Server running on SSE mode at http://${HOST}:${PORT}`)
      Logger.info(`SSE endpoint: http://${HOST}:${PORT}/sse`)
      Logger.info(
        AUTH_TOKEN
          ? "Auth: bearer token required (MCP_AUTH_TOKEN)"
          : "Auth: none — loopback-only. Set MCP_AUTH_TOKEN to allow authenticated remote access."
      )
    })

    return server
  } catch (error) {
    Logger.error("Error starting Binance MCP SSE server:", error)
  }
}
