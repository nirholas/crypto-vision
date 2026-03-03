/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerCoinGeckoTools } from "./tools.js"

/**
 * Register CoinGecko module with the MCP server
 * Provides cryptocurrency price data, market information, and token search
 * 
 * Environment variables:
 * - COINGECKO_API_KEY: CoinGecko API key (demo or pro)
 */
export function registerCoinGecko(server: McpServer) {
  registerCoinGeckoTools(server)
}
