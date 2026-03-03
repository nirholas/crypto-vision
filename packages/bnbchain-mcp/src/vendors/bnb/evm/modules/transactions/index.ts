/**
 * @author Nich
 * @website x.com/nichxbt
 * @github github.com/nirholas
 * @license MIT
 */
import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerTransactionPrompts } from "./prompts"
import { registerTransactionTools } from "./tools"

export function registerTransactions(server: McpServer) {
  registerTransactionTools(server)
  registerTransactionPrompts(server)
}
