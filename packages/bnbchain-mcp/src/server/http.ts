/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import "dotenv/config"

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import cors from "cors"
import express from "express"
import type { Request, Response } from "express"

import Logger from "@/utils/logger"
import { startServer } from "./base"

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
    // Security: Restrict CORS to configured origins instead of wildcard
    const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*']
    app.use(cors({
      origin: allowedOrigins.includes('*') ? '*' : allowedOrigins,
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "mcp-session-id", "last-event-id"],
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
    app.post("/mcp", async (req: Request, res: Response) => {
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
    app.get("/mcp", async (req: Request, res: Response) => {
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
    app.delete("/mcp", async (req: Request, res: Response) => {
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
    app.listen(PORT, () => {
      Logger.info(`Universal Crypto MCP HTTP Server running on http://localhost:${PORT}`)
      Logger.info(`ChatGPT Developer Mode URL: http://localhost:${PORT}/mcp`)
      Logger.info(`Health check: http://localhost:${PORT}/health`)
    })

    return { sessions }
  } catch (error) {
    Logger.error("Error starting HTTP Server:", error)
    throw error
  }
}
