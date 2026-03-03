import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerTokenPrompts } from "./prompts"
import { registerTokenTools } from "./tools"

export function registerTokens(server: McpServer) {
  registerTokenTools(server)
  registerTokenPrompts(server)
}
