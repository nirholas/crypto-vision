#!/usr/bin/env node
/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp"

import { startSSEServer } from "./server/sse"
import { startStdioServer } from "./server/stdio"
import logger from "./utils/logger"

const args = process.argv.slice(2)
const sseMode = args.includes("--sse") || args.includes("-s")

async function main() {
  let server: McpServer | undefined
  if (sseMode) {
    server = await startSSEServer()
  } else {
    server = await startStdioServer()
  }

  if (!server) {
    logger.error("Failed to start server")
    process.exit(1)
  }

  const handleShutdown = async () => {
    await server.close()
    process.exit(0)
  }
  // Handle process termination
  process.on("SIGINT", handleShutdown)
  process.on("SIGTERM", handleShutdown)
}

main()
