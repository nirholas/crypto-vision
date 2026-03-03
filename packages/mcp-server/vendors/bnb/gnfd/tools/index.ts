/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerAccountTools } from "./account"
import { registerPaymentTools } from "./payment"
import { registerStorageTools } from "./storage"

export * from "./common"

/**
 * Register all Greenfield-related tools
 */
export function registerGnfdTools(server: McpServer) {
  registerAccountTools(server)
  registerStorageTools(server)
  registerPaymentTools(server)
}
