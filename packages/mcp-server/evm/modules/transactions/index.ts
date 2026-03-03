/**
 * @author nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license Apache-2.0
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerTransactionPrompts } from "./prompts"
import { registerTransactionTools } from "./tools"

export function registerTransactions(server: McpServer) {
  registerTransactionTools(server)
  registerTransactionPrompts(server)
}
