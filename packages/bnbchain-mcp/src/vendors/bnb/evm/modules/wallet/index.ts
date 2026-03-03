/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerWaletPrompts } from "./prompts"
import { registerWalletTools } from "./tools"

export function registerWallet(server: McpServer) {
  registerWalletTools(server)
  registerWaletPrompts(server)
}
