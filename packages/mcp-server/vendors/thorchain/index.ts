/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerThorchainTools } from "./tools.js"

/**
 * Register THORChain module with the MCP server
 * Provides THORChain balance, pools, swap quotes, and cross-chain functionality
 * 
 * Environment variables:
 * - THORCHAIN_MNEMONIC: Mnemonic for wallet creation (for write operations)
 */
export function registerThorchain(server: McpServer) {
  registerThorchainTools(server)
}
