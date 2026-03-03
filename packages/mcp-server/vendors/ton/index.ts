/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerTonTools } from "./tools.js"

/**
 * Register TON blockchain module with the MCP server
 * Provides TON balance, transactions, transfers, and network information
 * 
 * Environment variables:
 * - TON_RPC_URL: TON RPC endpoint (default: toncenter.com mainnet)
 * - TON_API_KEY: API key for TON Center (optional, but recommended)
 * - TON_MNEMONIC: Mnemonic for wallet creation (for write operations)
 * - TON_ADDRESS: Expected wallet address
 */
export function registerTon(server: McpServer) {
  registerTonTools(server)
}
