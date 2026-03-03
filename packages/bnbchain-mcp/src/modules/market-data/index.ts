/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerMarketDataTools } from "./tools.js"
import { registerMarketDataPrompts } from "./prompts.js"

/**
 * Register market data module with the MCP server
 * Provides cryptocurrency market data, portfolio tracking, and sentiment analysis
 * 
 * Integrated from:
 * - CoinStats MCP (MIT License)
 * - Crypto Fear & Greed MCP (MIT License)
 */
export function registerMarketData(server: McpServer) {
  registerMarketDataTools(server)
  registerMarketDataPrompts(server)
}
