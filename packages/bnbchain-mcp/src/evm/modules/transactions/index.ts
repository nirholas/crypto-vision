import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerTransactionPrompts } from "./prompts"
import { registerTransactionTools } from "./tools"

export function registerTransactions(server: McpServer) {
  registerTransactionTools(server)
  registerTransactionPrompts(server)
}
