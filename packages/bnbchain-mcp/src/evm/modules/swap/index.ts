import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerSwapTools } from "./tools.js"
import { registerSwapPrompts } from "./prompts.js"

export function registerSwap(server: McpServer) {
  registerSwapTools(server)
  registerSwapPrompts(server)
}
