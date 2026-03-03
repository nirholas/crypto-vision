#!/usr/bin/env node
/**
 * Universal Crypto MCP Server - Main entry point
 * 
 * @author nich
 * @website https://x.com/nichxbt
 * @github https://github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp"

import { startHTTPServer } from "./server/http"
import { startSSEServer } from "./server/sse"
import { startStdioServer } from "./server/stdio"
import logger from "./utils/logger"

const args = process.argv.slice(2)

// Transport mode flags
const httpMode = args.includes("--http") || args.includes("-h")
const sseMode = args.includes("--sse") || args.includes("-s")
// Default to stdio mode (for Claude Desktop)

function printUsage() {
  console.log(`
Universal Crypto MCP Server

Usage: universal-crypto-mcp [options]

Options:
  --stdio, (default)  Run in stdio mode (for Claude Desktop)
  --sse, -s           Run in SSE mode (legacy HTTP)
  --http, -h          Run in HTTP mode (for ChatGPT Developer Mode)

Environment Variables:
  PORT               Server port (default: 3001)
  PRIVATE_KEY        Wallet private key (for write operations)
  LOG_LEVEL          Logging level (DEBUG, INFO, WARN, ERROR)

Examples:
  # Claude Desktop (stdio)
  universal-crypto-mcp

  # ChatGPT Developer Mode (HTTP)
  universal-crypto-mcp --http

  # Legacy SSE mode
  universal-crypto-mcp --sse
`)
}

async function main() {
  if (args.includes("--help")) {
    printUsage()
    process.exit(0)
  }

  let server: McpServer | { sessions: Map<string, unknown> } | undefined

  if (httpMode) {
    logger.info("Starting in HTTP mode (ChatGPT Developer Mode)")
    server = await startHTTPServer()
  } else if (sseMode) {
    logger.info("Starting in SSE mode (legacy)")
    server = await startSSEServer()
  } else {
    // Default: stdio mode for Claude Desktop
    server = await startStdioServer()
  }

  if (!server) {
    logger.error("Failed to start server")
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
