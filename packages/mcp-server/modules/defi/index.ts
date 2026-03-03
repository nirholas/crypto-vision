/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerDefiTools } from "./tools.js"
import { registerDefiPrompts } from "./prompts.js"

/**
 * Register DeFi analytics module with the MCP server
 * Provides protocol TVL, yields, fees, and DeFi ecosystem data
 * 
 * Data sources:
 * - DefiLlama API (free, no key required)
 */
export function registerDefi(server: McpServer) {
  registerDefiTools(server)
  registerDefiPrompts(server)
}
