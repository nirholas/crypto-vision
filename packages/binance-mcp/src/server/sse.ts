// src/server/sse.ts
import "dotenv/config"

import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import express from "express"
import cors from "cors"

import Logger from "../utils/logger.js"
import { startServer } from "./base.js"

const PORT = process.env.PORT || 3002

// Start the server in SSE mode
export const startSSEServer = async () => {
  try {
    const app = express()
    app.use(cors())
    app.use(express.json())

    const server = startServer()
    
    // Store active transports
    const transports: Map<string, SSEServerTransport> = new Map()

    // SSE endpoint
    app.get("/sse", async (req, res) => {
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
    app.post("/message", async (req, res) => {
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

    app.listen(PORT, () => {
      Logger.info(`Binance MCP Server running on SSE mode at http://localhost:${PORT}`)
      Logger.info(`SSE endpoint: http://localhost:${PORT}/sse`)
    })

    return server
  } catch (error) {
    Logger.error("Error starting Binance MCP SSE server:", error)
  }
}
