// src/server/base.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerBinance } from "../binance.js"
import Logger from "../utils/logger.js"

// Create and start the MCP server
export const startServer = () => {
  try {
    // Create a new MCP server instance
    const server = new McpServer({
      name: "binance-mcp",
      version: "1.0.0",
      description: "MCP server for Binance exchange - spot trading, staking, wallet, NFT, pay, mining, and more"
    })

    // Register all Binance modules
    registerBinance(server)
    return server
  } catch (error) {
    Logger.error("Failed to initialize server:", error)
    process.exit(1)
  }
}
