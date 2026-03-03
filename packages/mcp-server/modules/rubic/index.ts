/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerRubicTools } from "./tools.js"

/**
 * Register Rubic cross-chain bridge module with the MCP server
 * Provides cross-chain bridging quotes, supported chains, and transaction status
 * 
 * Data source:
 * - Rubic Exchange API (free, no key required)
 */
export function registerRubic(server: McpServer) {
  registerRubicTools(server)
}
