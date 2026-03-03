// src/server/stdio.ts
import "dotenv/config"

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

import Logger from "../utils/logger.js"
import { startServer } from "./base.js"

// Start the server in stdio mode
export const startStdioServer = async () => {
  try {
    const server = startServer()
    const transport = new StdioServerTransport()
    
    Logger.info("Binance MCP Server running on stdio mode")

    transport.onmessage = (message) => {
      Logger.debug("Received message:", message)
    }
    transport.onclose = () => {
      Logger.info("Stdio server closed")
    }
    transport.onerror = (error) => {
      Logger.error("Stdio server error:", error)
    }

    await server.connect(transport)
    return server
  } catch (error) {
    Logger.error("Error starting Binance MCP Stdio server:", error)
  }
}
