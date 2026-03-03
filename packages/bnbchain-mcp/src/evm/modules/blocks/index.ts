import { type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"

import { registerBlockPrompts } from "./prompts.js"
import { registerBlockTools } from "./tools.js"

export function registerBlocks(server: McpServer) {
  registerBlockPrompts(server)
  registerBlockTools(server)
}
