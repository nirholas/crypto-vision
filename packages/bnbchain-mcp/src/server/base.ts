/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

// EVM modules (blocks, contracts, tokens, swap, staking, etc.)
import { registerEVM } from "@/evm.js"
// Greenfield decentralized storage
import { registerGnfd } from "@/gnfd/index.js"
// Sperax protocol (USDs, SPA, veSPA, Demeter — 72 tools)
import { registerSperax } from "@/sperax/index.js"
import Logger from "@/utils/logger.js"

// Create and start the MCP server
export const startServer = () => {
  try {
    // Create a new MCP server instance
    const server = new McpServer({
      name: "Universal Crypto MCP Server",
      version: "1.0.0"
    })

    // Register all resources, tools, and prompts
    registerEVM(server)     // EVM core + modules (defi, news, market-data, social, dex-analytics, governance, utils)
    registerGnfd(server)    // Greenfield storage
    registerSperax(server)  // Sperax protocol
    return server
  } catch (error) {
    Logger.error("Failed to initialize server:", error)
    process.exit(1)
  }
}
