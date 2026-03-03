/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import "dotenv/config"

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import cors from "cors"
import express from "express"
import type { Request, Response } from "express"

import Logger from "@/utils/logger"
import { startServer } from "./base"
import { createHostedServer, getServerForSubdomain } from "@/hosting/runtime.js"
import { getServerBySubdomain } from "@/hosting/router.js"
import type { HostedMCPServer } from "@/hosting/types.js"

/**
 * HTTP Server Configuration
 */
export interface HTTPServerConfig {
  /** Port to listen on (default: 3001 or PORT env var) */
  port?: number
  /** Optional subdomain to load hosted server config */
  subdomain?: string
  /** Optional hosted server config (if already loaded) */
  hostedConfig?: HostedMCPServer
}

/**
 * HTTP-based MCP Server for ChatGPT Developer Mode
 * 
 * Supports:
 * - Streamable HTTP transport (recommended for ChatGPT)
 * - Session management for stateful connections
 * - CORS for cross-origin requests
 * - Health check endpoint
 * - Optional subdomain routing for hosted servers
 * 
 * ChatGPT Developer Mode requires:
 * - SSE or Streamable HTTP protocol
 * - No authentication (or OAuth)
 * - readOnlyHint annotations on tools
 */
export const startHTTPServer = async (config: HTTPServerConfig = {}) => {
  try {
    const app = express()
    
    // Middleware
    app.use(cors({
      origin: "*",
      methods: ["GET", "POST", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "mcp-session-id", "last-event-id", "x-payment-proof"],
      exposedHeaders: ["mcp-session-id"]
    }))
    app.use(express.json())

    // Log startup
    Logger.info(`Starting HTTP server with log level: ${Logger.getLevel()}`)

    // Determine if we're running in hosted mode
    let hostedConfig: HostedMCPServer | null = null
    
    if (config.hostedConfig) {
      hostedConfig = config.hostedConfig
      Logger.info("Running in hosted mode with provided config", { 
        name: hostedConfig.name,
        subdomain: hostedConfig.subdomain 
      })
    } else if (config.subdomain) {
      hostedConfig = await getServerBySubdomain(config.subdomain)
      if (hostedConfig) {
        Logger.info("Running in hosted mode for subdomain", { 
          subdomain: config.subdomain,
          name: hostedConfig.name 
        })
      } else {
        Logger.warn("Subdomain not found, falling back to default server", { 
          subdomain: config.subdomain 
        })
      }
    }

    // Session management for stateful connections
    const sessions: Map<string, {
      transport: StreamableHTTPServerTransport
      server: ReturnType<typeof startServer> | Awaited<ReturnType<typeof createHostedServer>>
    }> = new Map()

    // Health check endpoint
    app.get("/health", (_req: Request, res: Response) => {
      res.json({
        status: "healthy",
        name: hostedConfig?.name || "Universal Crypto MCP",
        version: "1.0.0",
        mode: hostedConfig ? "hosted" : "default",
        subdomain: hostedConfig?.subdomain || null,
        sessions: sessions.size,
        timestamp: new Date().toISOString()
      })
    })

    // Server info endpoint (for ChatGPT app discovery)
    app.get("/", (_req: Request, res: Response) => {
      if (hostedConfig) {
        // Return hosted server info
        res.json({
          name: hostedConfig.name,
          description: hostedConfig.description,
          version: "1.0.0",
          url: `https://${hostedConfig.subdomain}.agenti.cash`,
          protocol: "mcp",
          transport: "streamable-http",
          endpoints: {
            mcp: "/mcp",
            health: "/health",
          },
          tools: hostedConfig.tools
            .filter(t => t.enabled)
            .map(t => ({
              name: t.name,
              description: t.description,
              price: t.price > 0 ? { amount: t.price, currency: "USDC" } : null,
            })),
          capabilities: hostedConfig.tools.filter(t => t.enabled).map(t => t.name),
        })
        return
      }
      
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

        // Create the appropriate server based on mode
        const server = hostedConfig 
          ? await createHostedServer(hostedConfig)
          : startServer()

        // Create new session
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => crypto.randomUUID(),
          onsessioninitialized: (newSessionId) => {
            Logger.info("New HTTP session initialized", { 
              sessionId: newSessionId,
              mode: hostedConfig ? "hosted" : "default",
              subdomain: hostedConfig?.subdomain,
            })
            sessions.set(newSessionId, { transport, server })
          }
        })

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

    const PORT = config.port || process.env.PORT || 3001
    app.listen(PORT, () => {
      const serverName = hostedConfig?.name || "Universal Crypto MCP"
      Logger.info(`${serverName} HTTP Server running on http://localhost:${PORT}`)
      Logger.info(`ChatGPT Developer Mode URL: http://localhost:${PORT}/mcp`)
      Logger.info(`Health check: http://localhost:${PORT}/health`)
      if (hostedConfig) {
        Logger.info(`Hosted subdomain: ${hostedConfig.subdomain}.agenti.cash`)
      }
    })

    return { sessions }
  } catch (error) {
    Logger.error("Error starting HTTP Server:", error)
    throw error
  }
}
