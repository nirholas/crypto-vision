/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerSolanaTools } from "./tools.js"

/**
 * Register Solana blockchain module with the MCP server
 * Provides Solana balance, tokens, transactions, and Jupiter DEX integration
 * 
 * Environment variables:
 * - SOLANA_RPC_URL: Solana RPC endpoint (default: mainnet-beta)
 * - SOLANA_PRIVATE_KEY: Private key for write operations (base58 encoded)
 */
export function registerSolana(server: McpServer) {
  registerSolanaTools(server)
}
