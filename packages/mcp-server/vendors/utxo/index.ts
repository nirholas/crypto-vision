/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerBitcoinTools } from "./bitcoin.js"
import { registerLitecoinTools } from "./litecoin.js"
import { registerDogecoinTools } from "./dogecoin.js"

/**
 * Register UTXO-based blockchain modules with the MCP server
 * Provides Bitcoin, Litecoin, and Dogecoin support
 * 
 * Uses xchainjs libraries for chain interactions
 */
export function registerUTXOChains(server: McpServer) {
  registerBitcoinTools(server)
  registerLitecoinTools(server)
  registerDogecoinTools(server)
}

export { registerBitcoinTools, registerLitecoinTools, registerDogecoinTools }
