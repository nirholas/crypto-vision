#!/usr/bin/env node
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { startSSEServer } from "./server/sse.js"
import { startStdioServer } from "./server/stdio.js"
import Logger from "./utils/logger.js"

const args = process.argv.slice(2)

// Transport mode flags
const sseMode = args.includes("--sse") || args.includes("-s")
// Default to stdio mode (for Claude Desktop)

function printUsage() {
  console.log(`
Binance MCP Server

Usage: binance-mcp [options]

Options:
  --stdio, (default)  Run in stdio mode (for Claude Desktop)
  --sse, -s           Run in SSE mode (HTTP)

Environment Variables:
  PORT                Server port for SSE mode (default: 3002)
  BINANCE_API_KEY     Binance API key
  BINANCE_API_SECRET  Binance API secret
  LOG_LEVEL           Logging level (DEBUG, INFO, WARN, ERROR)

Examples:
  # Claude Desktop (stdio)
  binance-mcp

  # SSE mode
  binance-mcp --sse
`)
}

async function main() {
  if (args.includes("--help")) {
    printUsage()
    process.exit(0)
  }

  let server: McpServer | undefined

  if (sseMode) {
    Logger.info("Starting in SSE mode")
    server = await startSSEServer()
  } else {
    // Default: stdio mode for Claude Desktop
    server = await startStdioServer()
  }

  if (!server) {
    Logger.error("Failed to start server")
    process.exit(1)
  }

  const handleShutdown = async () => {
    if ("close" in server && typeof server.close === "function") {
      await server.close()
    }
    process.exit(0)
  }

  // Handle process termination
  process.on("SIGINT", handleShutdown)
  process.on("SIGTERM", handleShutdown)
}

main()
