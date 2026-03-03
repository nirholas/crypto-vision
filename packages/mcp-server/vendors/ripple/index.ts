/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerRippleTools } from "./tools.js"

/**
 * Register XRP Ledger (Ripple) module with the MCP server
 * Provides XRP balance, transactions, trustlines, and ledger information
 * 
 * Environment variables:
 * - XRP_RPC_URL: XRP Ledger RPC endpoint (default: wss://s1.ripple.com)
 * - XRP_PRIVATE_KEY: Private key (seed) for write operations
 * - XRP_MNEMONIC: Alternative mnemonic for wallet creation
 * - XRP_ADDRESS: Expected wallet address (for verification)
 */
export function registerRipple(server: McpServer) {
  registerRippleTools(server)
}
