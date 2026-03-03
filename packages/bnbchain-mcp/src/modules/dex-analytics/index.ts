/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerDexAnalyticsTools } from "./tools.js"
import { registerDexAnalyticsPrompts } from "./prompts.js"

/**
 * Register DEX analytics module with the MCP server
 * Provides decentralized exchange data, liquidity pools, and trading analytics
 * 
 * Integrated from:
 * - DexPaprika MCP (MIT License)
 */
export function registerDexAnalytics(server: McpServer) {
  registerDexAnalyticsTools(server)
  registerDexAnalyticsPrompts(server)
}
